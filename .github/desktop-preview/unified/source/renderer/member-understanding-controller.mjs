import { emptyMemberUnderstanding, validateMemberUnderstanding, updateMemberUnderstanding } from './generated/member-understanding-data.mjs';

// The host owns identity. Only explicitly submitted corrections are persisted;
// editor drafts and account-bound response snapshots stay in memory.
export function createMemberUnderstanding({ getIdentity, request, now = Date.now, uuid = () => crypto.randomUUID(), timeoutMs = 12000 } = {}) {
  let binding = '', epoch = 0, queue = Promise.resolve(), stopped = false;
  let document = null, revision = 0, status = 'unavailable', pending = 0;
  let editor = null, editToken = 0, message = '', error = null;
  const listeners = new Set();
  const clone = value => value === null ? null : structuredClone(value);
  const identity = () => { const v = getIdentity?.() || {}; return { ...v, accountId: v.accountId || v.account?.synk_user_id }; };
  const key = v => JSON.stringify([v.status, v.signedIn, v.accountId, v.sessionGeneration]);
  const signed = v => v.status === 'signed-in' && v.signedIn === true && typeof v.accountId === 'string' && !!v.accountId;
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  const conflict = () => Object.assign(new Error('correction conflict'), { code: 'UNDERSTANDING_CONFLICT' });
  const collection = kind => kind === 'review' ? 'reviews' : 'overrides';
  const entry = (doc, kind, facetId) => doc?.[collection(kind)]?.find(row => row.facetId === facetId) || null;
  function sync() {
    const owner = identity(), next = key(owner);
    if (next !== binding) {
      binding = next; epoch++; queue = Promise.resolve(); document = null; revision = 0;
      status = signed(owner) ? 'loading' : 'unavailable'; pending = 0; editor = null; editToken++; message = ''; error = null;
    }
    return owner;
  }
  function read() {
    sync();
    const draft = editor ? { facetId: editor.facetId, mode: editor.mode, verdict: editor.verdict, values: [...editor.values], note: editor.note, facet: clone(editor.facet) } : null;
    return { status, document: clone(document), revision, pending: pending > 0, editor: draft, message, error };
  }
  function emit() { if (!stopped) { const value = read(); for (const fn of listeners) fn(value); } }
  const current = (owner, token) => !stopped && token === epoch && owner === key(identity()) && signed(identity());
  async function call(operation, params, owner, token) {
    let timer;
    try {
      if (!current(owner, token)) throw new Error('changed');
      const raw = await Promise.race([
        Promise.resolve().then(() => { if (!current(owner, token)) throw new Error('changed'); return request(operation, params); }),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); }),
      ]);
      if (!current(owner, token)) throw new Error('changed');
      if (raw?.ok === false) throw Object.assign(new Error('request'), raw.error || {});
      const result = raw?.data || raw;
      if (result?.ok === false) throw Object.assign(new Error('request'), result.error || {});
      if (result?.ok !== true || result.scope !== 'synk-personal' || result.resource !== 'member-understanding'
        || result.accountId !== identity().accountId || !Number.isSafeInteger(result.revision) || result.revision < 0
        || !Object.hasOwn(result, 'state')) throw new Error('response');
      return { document: result.state === null ? emptyMemberUnderstanding() : validateMemberUnderstanding(result.state), revision: result.revision };
    } finally { clearTimeout(timer); }
  }
  async function load(owner, token) {
    let result;
    try { result = await call('understandingLoad', {}, owner, token); }
    catch (failure) { if (current(owner, token)) status = 'error'; throw failure; }
    if (!current(owner, token)) throw new Error('changed');
    document = result.document; revision = result.revision; status = 'ready'; return result;
  }
  function enqueue(work, mutation = false) {
    const account = sync(); if (stopped || !signed(account)) return Promise.resolve(read());
    const owner = binding, token = epoch;
    if (mutation) { pending++; message = ''; error = null; }
    const job = queue.then(async () => {
      if (!current(owner, token)) return read();
      try { await work(owner, token); }
      catch (failure) {
        if (current(owner, token)) {
          error = failure?.code === 'UNDERSTANDING_CONFLICT' ? 'conflict' : 'save-failed';
          if (!document) status = 'error';
          message = error === 'conflict' ? '다른 곳에서 이 내용을 바꿨어요. 최신 내용을 확인한 뒤 다시 수정해 주세요.'
            : mutation ? '저장하지 못했어요. 입력한 내용은 그대로 있으니 다시 시도해 주세요.' : '확인·수정한 내용을 불러오지 못했어요. 다시 불러와 주세요.';
        }
      } finally { if (current(owner, token)) { if (mutation) pending--; emit(); } }
      return read();
    });
    queue = job.catch(() => {}); if (mutation) emit(); return job;
  }
  function mutate(action, expected, expectedEditor = null) {
    return enqueue(async (owner, token) => {
      const kind = action.type.includes('review') ? 'review' : 'override';
      const facetId = action.value?.facetId || action.facetId;
      for (let attempt = 0; attempt < 2; attempt++) {
        await load(owner, token); if (!current(owner, token)) throw new Error('changed');
        const currentEntry = entry(document, kind, facetId);
        // A timed-out acknowledgement can be recovered without a duplicate write.
        const alreadySaved = action.value && same(currentEntry, action.value);
        if (!alreadySaved && !same(currentEntry, expected)) throw conflict();
        if (!alreadySaved) {
          const next = updateMemberUnderstanding(document, action, now());
          try {
            const saved = await call('understandingSave', { state: next, expected_revision: revision }, owner, token);
            if (!current(owner, token)) throw new Error('changed');
            document = saved.document; revision = saved.revision; status = 'ready';
          } catch (failure) {
            if (attempt === 0 && ['REVISION_CONFLICT', 'PERSONAL_REVISION_CONFLICT'].includes(failure.code)) continue;
            throw failure;
          }
        }
        if (expectedEditor !== null && expectedEditor === editToken) editor = null;
        error = null; message = action.type.startsWith('remove-') ? '이 확인·수정을 되돌렸어요. 원래 기록은 그대로예요.' : '확인·수정한 내용을 저장했어요.';
        return;
      }
    }, true);
  }
  function begin({ facetId, mode = 'review', verdict = 'agree', claim = null, values = [], facet = null } = {}) {
    sync(); if (stopped || status !== 'ready' || pending || !['review', 'override'].includes(mode) || !['agree', 'disagree', 'contextual'].includes(verdict)) return false;
    const previous = entry(document, mode, facetId);
    editor = { facetId, mode, verdict, claim: clone(claim), values: [...values], note: previous?.note || '', expected: clone(previous), facet: clone(facet) };
    editToken++; message = ''; error = null; emit(); return true;
  }
  function updateDraft({ note, values } = {}) {
    sync(); if (!editor || pending) return false;
    if (typeof note === 'string' && note !== editor.note) { editor.note = note; editor.submission = null; }
    if (Array.isArray(values) && !same(values, editor.values)) { editor.values = [...values]; editor.submission = null; }
    return true;
  }
  function save() {
    sync(); if (!editor || pending) return Promise.resolve(read());
    const draft = clone(editor), expectedEditor = editToken;
    const value = draft.submission || { id: uuid(), facetId: draft.facetId, ...(draft.mode === 'review' ? { verdict: draft.verdict, claim: draft.claim } : { values: draft.values }), note: draft.note, at: new Date(now()).toISOString() };
    editor.submission = clone(value);
    return mutate({ type: draft.mode, value }, draft.expected, expectedEditor);
  }
  function remove({ kind, id, facetId } = {}) {
    sync(); if (status !== 'ready' || pending || !['review', 'override'].includes(kind)) return Promise.resolve(read());
    const previous = entry(document, kind, facetId);
    if (!previous || previous.id !== id) { error = 'conflict'; message = '내용이 바뀌었어요. 최신 확인·수정 내역을 살펴봐 주세요.'; emit(); return Promise.resolve(read()); }
    return mutate({ type: 'remove-' + kind, facetId }, clone(previous));
  }
  function clear() {
    sync(); if (status !== 'ready' || pending) return Promise.resolve(read());
    const expected = clone(document);
    return enqueue(async (owner, token) => {
      await load(owner, token); if (!current(owner, token)) throw new Error('changed'); if (!same(document, expected)) throw conflict();
      // Delete advances the existing revision even when no correction exists.
      const saved = await call('understandingDelete', { expected_revision: revision }, owner, token);
      if (!current(owner, token)) throw new Error('changed');
      document = saved.document; revision = saved.revision; status = 'ready'; editor = null; editToken++; error = null; message = '확인·수정한 내용을 모두 지웠어요. 원래 이용·학습 기록은 그대로예요.';
    }, true);
  }
  return Object.freeze({ read, begin, updateDraft, save, remove, clear,
    refresh: () => enqueue(async (owner, token) => { await load(owner, token); if (!current(owner, token)) throw new Error('changed'); if (!editor) { message = ''; error = null; } }),
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    cancel() { sync(); if (!pending) { editor = null; editToken++; message = ''; error = null; emit(); } },
    hide() { epoch++; binding = ''; document = null; revision = 0; status = 'unavailable'; pending = 0; editor = null; editToken++; message = ''; error = null; queue = Promise.resolve(); },
    stop() { stopped = true; epoch++; document = null; editor = null; listeners.clear(); },
  });
}
