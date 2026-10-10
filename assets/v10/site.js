// SYNK 홈페이지 v10 · 메뉴, 나타나기, 질문(자주 묻는 질문 + 직접 묻기), 게임 장면, 알림.
// 질문의 답은 공개 안내(knowledge.json) 안에서만 고른다. 대화는 저장하지 않는다.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lang = document.documentElement.lang === 'en' ? 'en' : 'ko';
const T = lang === 'en'
  ? { copied: 'Email address copied.', copyFail: 'Select hello@synk.im to copy it.', more: 'Read more', related: 'Ask next', sources: 'Source', reviewed: 'Checked against public notes', synk: 'SYNK', loadFail: 'Could not load the notes. Please ask again in a moment.', tooLong: 'Please keep questions under 500 characters.', loading: 'Looking for the answer…', copyAnswer: 'Copy answer', answerCopied: 'Answer copied.', noCopy: 'Copy is not available here.' }
  : { copied: '이메일 주소를 복사했어요.', copyFail: 'hello@synk.im 주소를 선택해 복사해 주세요.', more: '자세히 보기', related: '이어서 물어보기', sources: '안내 자료', reviewed: '공개 자료 확인', synk: 'SYNK 안내', loadFail: '안내 자료를 불러오지 못했어요. 잠시 뒤 다시 물어봐 주세요.', tooLong: '질문은 500자 안으로 적어 주세요.', loading: '답을 찾는 중…', copyAnswer: '답변 복사', answerCopied: '답변을 복사했어요.', noCopy: '복사를 쓸 수 없어요. 답을 선택해 복사해 주세요.' };
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

/* 답 링크 규칙: 빌드가 아래 자리에 src/public-actions.js의 허용 목록과 isPublicActionHref를 넣는다 */
const externalLinks = new Set([
  'https://www.youtube.com/@synkkorean/live',
  'https://www.youtube.com/@synkkorean',
  'https://www.instagram.com/synk.mn/',
  'https://t.me/synkmn',
  'mailto:hello@synk.im',
  'https://synk.im/name/',
  'https://synk.im/privacy/#website-questions',
  'https://synk.im/privacy/#ko',
  'https://synk-field-notes.unmet23.chatgpt.site/자료실/index.html',
  'https://synk-field-notes.unmet23.chatgpt.site/01-lab-youtube/index.html',
]);

function isPublicActionHref(href) {
  if (typeof href !== 'string' || !href || /[\s\\\u0000-\u001f\u007f]/u.test(href)) return false;
  if (externalLinks.has(href)) return true;
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(href)) return true;
  // Exactly one leading slash, plain path segments and an optional named anchor.
  // Percent escapes, credentials, query redirects and dot segments are excluded.
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]*(?:#[A-Za-z][A-Za-z0-9_-]*)?$/.test(href)) return false;
  return !href.split(/[\/#]/).some(segment => segment === '.' || segment === '..');
}

/* 알림 */
let toastTimer;
function toast(text) { const el = $('#toast'); if (!el) return; el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 2600); }

/* 메뉴 */
const bar = $('[data-bar]'), toggle = $('[data-bar-toggle]');
function setMenu(open) { if (!bar) return; bar.classList.toggle('open', open); toggle?.setAttribute('aria-expanded', String(open)); }
toggle?.addEventListener('click', () => setMenu(!bar.classList.contains('open')));
$('[data-bar-panel]')?.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && bar?.classList.contains('open')) { setMenu(false); toggle?.focus(); } });
matchMedia('(min-width: 901px)').addEventListener('change', () => setMenu(false));
// 어두운 싱ㅋ 표지가 메뉴 뒤에 있는 동안만 어두운 유리로 둔다
const cover = $('.cover');
if (cover && bar) {
  let ticking = false;
  const tone = () => { ticking = false; bar.classList.toggle('on-dark', cover.getBoundingClientRect().bottom > 64); };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tone); } }, { passive: true });
  addEventListener('resize', tone);
  tone();
}

/* 부드러운 이동: 사람이 처음 누르거나 키를 친 뒤에 켠다. 주소(#…)로 들어온 첫 이동은 움직임 없이 바로 그 자리다 */
const smooth = () => { document.documentElement.classList.add('smooth'); removeEventListener('pointerdown', smooth, true); removeEventListener('keydown', smooth, true); };
addEventListener('pointerdown', smooth, true); addEventListener('keydown', smooth, true);

/* 시작 화면(2026-10-08 확정): 고른 사람만 다음 방문에 체험 목록부터 연다. 이 브라우저에만 저장하고, 주소에 #이 있거나 ?intro=1이면 따르지 않는다.
   주소는 <head>의 짧은 스크립트가 바꾸고, 여기서는 그 자리로 한 번에 옮긴다. */
const START_KEY = 'synk-entry-start-v1';
if (document.documentElement.dataset.start === 'try') $('#try')?.scrollIntoView({ block: 'start' });
const startPref = $('[data-start-pref]');
if (startPref) {
  const input = $('input', startPref), status = $('[data-start-pref-status]', startPref);
  const read = () => { try { return localStorage.getItem(START_KEY) === '1'; } catch { return false; } };
  startPref.hidden = false; input.checked = read();
  input.addEventListener('change', () => {
    try { if (input.checked) localStorage.setItem(START_KEY, '1'); else localStorage.removeItem(START_KEY); status.textContent = input.checked ? status.dataset.on : status.dataset.off; }
    catch { input.checked = read(); status.textContent = status.dataset.fail; }
  });
  addEventListener('storage', e => { if (e.key === START_KEY || e.key === null) input.checked = read(); });
}

/* 나타나기 */
const reveals = $$('.reveal');
if ('IntersectionObserver' in window && !reduced.matches) {
  const io = new IntersectionObserver(entries => { for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  reveals.forEach(el => io.observe(el));
  // 인쇄·앵커 이동 직후처럼 관찰 전에 화면 안에 있던 것은 바로 보인다
  requestAnimationFrame(() => reveals.forEach(el => { const r = el.getBoundingClientRect(); if (r.top < innerHeight && r.bottom > 0) el.classList.add('in'); }));
} else reveals.forEach(el => el.classList.add('in'));

/* 이메일 복사 */
$$('[data-copy-email]').forEach(b => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText('hello@synk.im'); toast(T.copied); } catch { toast(T.copyFail); } }));

/* 게임 플레이 장면: LAB 카드는 5초 장면만 보여 준다(2026-10-05 유호님 요청으로 게임으로 가는 링크는 두지 않는다) */
const clip = $('#clip-dialog'), video = $('#clip-video');
let clipTrigger = null;
$$('[data-clip]').forEach(b => b.addEventListener('click', () => {
  if (!clip?.showModal) { location.href = b.dataset.clip; return; }
  clipTrigger = b; video.src = b.dataset.clip;
  clip.showModal(); video.play().catch(() => {});
}));
clip?.addEventListener('close', () => { video.pause(); video.removeAttribute('src'); video.load(); clipTrigger?.focus(); });
$$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

/* 질문 */
const askRoot = $('[data-ask]');
const form = $('#question-form'), input = $('#question'), send = $('#send'), messages = $('#messages');
const site = askRoot?.dataset.site || 'synk';
let engine = null, pending = null, context = { brand: ['lab', 'shift', 'pulse', 'path'].includes(site) ? site : 'synk' }, busy = false;
function loadEngine() {
  if (engine) return Promise.resolve(engine);
  if (pending) return pending;
  const src = askRoot.dataset.engine, data = askRoot.dataset.knowledge;
  pending = Promise.all([import(src), fetch(data).then(r => { if (!r.ok) throw new Error('knowledge'); return r.json(); })])
    .then(([mod, json]) => (engine = mod.createKnowledgeEngine(json)))
    .catch(err => { pending = null; throw err; });
  return pending;
}
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const paras = (parent, text) => String(text || '').split(/\n\n/).filter(Boolean).forEach(p => parent.append(el('p', '', p)));

function renderAnswer(result, { inline = false } = {}) {
  const wrap = el('div', inline ? 'answer' : 'msg-answer');
  if (!inline) { const lab = el('p', 'msg-label', T.synk); wrap.append(lab); }
  const body = el('div', 'answer');
  if (result.message) paras(body, result.message);
  for (const record of result.records || []) {
    if ((result.records || []).length > 1) body.append(el('h4', '', record.title));
    const parts = String(record.answer || '').split(/\n\n/);
    const focus = result.focus?.[record.id];
    paras(body, parts[0]);
    if (focus > 0 && focus < parts.length) paras(body, parts[focus]);
    const rest = parts.filter((_, i) => i > 0 && i !== focus);
    if (rest.length) { const d = el('details'); d.append(el('summary', '', T.more)); const inner = el('div'); rest.forEach(p => paras(inner, p)); d.append(inner); body.append(d); }
  }
  wrap.append(body);
  const foot = el('div', 'answer-foot');
  const seen = new Set();
  for (const record of result.records || []) {
    const a = record.action;
    // 검토한 주소만 링크로 만든다(규칙은 빌드 때 src/public-actions.js에서 들어온다). 영어 안내의 링크는 이미 /en/ 판이다.
    if (a?.href && !seen.has(a.href) && typeof a.label === 'string' && a.label.trim() && isPublicActionHref(a.href)) {
      seen.add(a.href);
      const link = el('a', 'primary', a.label + ' ↗');
      link.href = a.href;
      foot.append(link);
    }
  }
  (result.sourceIds || []).slice(0, 2).forEach(id => {
    const doc = engine?.docs.get(id); if (!doc) return;
    const b = el('button', '', T.sources + ' · ' + doc.title.split(' — ')[0]); b.type = 'button'; b.dataset.doc = id; foot.append(b);
  });
  const copy = el('button', '', T.copyAnswer); copy.type = 'button';
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText([result.message, ...(result.records || []).map(r => r.answer)].filter(Boolean).join('\n\n')); toast(T.answerCopied); } catch { toast(T.noCopy); } });
  foot.append(copy);
  (result.relatedIds || []).slice(0, result.status === 'clarify' ? 3 : 2).forEach(id => {
    const r = engine?.records.get(id); if (!r) return;
    const b = el('button', '', r.title); b.type = 'button'; b.dataset.askQ = r.questionExamples?.[0] || r.title; foot.append(b);
  });
  wrap.append(foot);
  const dates = [...new Set((result.records || []).map(r => r.reviewedAt).filter(Boolean))].sort();
  if (dates.length) wrap.append(el('p', 'answer-date', T.reviewed + ' · ' + dates.at(-1)));
  return wrap;
}

function answer(question) {
  const result = engine.answer(question, context);
  if (['matched', 'needs_confirmation'].includes(result.status)) context = { brand: ['lab', 'shift', 'pulse', 'path'].includes(result.brand) ? result.brand : context.brand, recordIds: (result.records || []).map(r => r.id) };
  else if (!['clarify', 'courtesy'].includes(result.status)) context = { brand: context.brand };
  return result;
}

async function ask(text, { scroll = true } = {}) {
  const q = String(text || '').trim();
  if (!q || busy) return;
  if (q.length > 500) { toast(T.tooLong); return; }
  busy = true; form?.setAttribute('aria-busy', 'true'); syncSend();
  try {
    await loadEngine();
    const user = el('div', 'msg-user', q); messages.append(user);
    messages.append(renderAnswer(answer(q)));
    while (messages.children.length > 24) messages.firstElementChild.remove();
    input.value = ''; autosize();
    if (scroll) user.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  } catch { toast(T.loadFail); }
  finally { busy = false; form?.setAttribute('aria-busy', 'false'); syncSend(); }
}
function autosize() { if (!input) return; input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; }
function syncSend() { if (send) send.disabled = busy || !input.value.trim(); }
if (askRoot) {
  input.addEventListener('input', () => { autosize(); syncSend(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (input.value.trim()) form.requestSubmit(); } });
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value); });
  // 자주 묻는 질문: 누르면 그 자리에서 펼쳐 답한다
  $$('[data-faq]').forEach(btn => btn.addEventListener('click', async () => {
    const panel = document.getElementById(btn.getAttribute('aria-controls'));
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    panel.hidden = open;
    if (open || panel.dataset.ready) return;
    panel.textContent = T.loading;
    try {
      await loadEngine();
      // 자주 묻는 질문은 정해 둔 공개 답을 그대로 보여 준다(검색 순위에 흔들리지 않게).
      const record = engine.records.get(btn.dataset.record);
      const result = record ? { status: 'matched', records: [record], sourceIds: [record.sourceId], relatedIds: (record.relatedIds || []).slice(0, 2), brand: record.brand } : answer(btn.dataset.faq);
      if (record) context = { brand: ['lab', 'shift', 'pulse', 'path'].includes(record.brand) ? record.brand : context.brand, recordIds: [record.id] };
      panel.replaceChildren(renderAnswer(result, { inline: true })); panel.dataset.ready = '1';
    }
    catch { panel.textContent = T.loadFail; }
  }));
  // 사람이 질문을 보기 전에 미리 불러 둔다(보이기 시작할 때)
  if ('IntersectionObserver' in window) { const io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { loadEngine().catch(() => {}); io.disconnect(); } }, { rootMargin: '600px' }); io.observe(askRoot); }
}
// 다른 곳의 "이 질문 묻기" 단추(바닥의 사업자 정보, 관련 질문)
document.addEventListener('click', e => {
  const b = e.target.closest('[data-ask-q]');
  if (!b || !askRoot) return;
  e.preventDefault();
  $('#contact')?.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  ask(b.dataset.askQ, { scroll: false });
});

/* 안내 자료 창 */
const docDialog = $('#doc-dialog');
document.addEventListener('click', async e => {
  const b = e.target.closest('[data-doc]');
  if (!b || !docDialog?.showModal) return;
  try {
    await loadEngine();
    const doc = engine.docs.get(b.dataset.doc); if (!doc) return;
    $('#doc-title').textContent = doc.title.split(' — ').slice(1).join(' — ') || doc.title;
    $('#doc-brand').textContent = (doc.title.split(' — ')[0] || 'SYNK') + (doc.updatedAt ? ' · ' + doc.updatedAt : '');
    const body = $('#doc-body'); body.replaceChildren();
    for (const r of engine.records.values()) { if (r.sourceId !== b.dataset.doc) continue; const s = el('section'); s.append(el('h3', '', r.title)); paras(s, r.answer); body.append(s); }
    docDialog.showModal();
  } catch { toast(T.loadFail); }
});
