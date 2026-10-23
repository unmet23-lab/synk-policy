// SYNK 홈페이지 v11 · 메뉴, 나타나기, 질문(자주 묻는 질문 + 직접 묻기), 다운로드 창, 서비스 목록, 알림.
// v10의 대화 구(점묘 구 · 「대화 시작」)는 2026-10-23 v11에서 뺐다 — 질문 입력칸 하나로 묻는다.
// 질문의 답은 공개 안내(knowledge.json) 안에서만 고른다. 대화는 저장하지 않는다.
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const lang = document.documentElement.lang === 'en' ? 'en' : 'ko';
const T = lang === 'en'
  ? { copied: 'Email address copied.', copyFail: 'Select hello@synk.im to copy it.', more: 'Keep reading', mine: 'Your question', follow: 'Follow-up', termOpen: 'open the note', related: 'Ask next', sources: 'Source', reviewed: 'Checked against public notes', synk: 'SYNK', loadFail: 'Could not load the notes. Please ask again in a moment.', tooLong: 'Please keep questions under 500 characters.', loading: 'Looking for the answer…', copyAnswer: 'Copy', answerCopied: 'Answer copied.', noCopy: 'Copy is not available here.' }
  : { copied: '이메일 주소를 복사했어요.', copyFail: 'hello@synk.im 주소를 선택해 복사해 주세요.', more: '이어서 읽기', mine: '내 질문', follow: '이어서', termOpen: '안내 열기', related: '이어서 물어보기', sources: '안내 자료', reviewed: '공개 자료 확인', synk: 'SYNK 안내', loadFail: '안내 자료를 불러오지 못했어요. 잠시 뒤 다시 물어봐 주세요.', tooLong: '질문은 500자 안으로 적어 주세요.', loading: '답을 찾는 중…', copyAnswer: '복사', answerCopied: '답변을 복사했어요.', noCopy: '복사를 쓸 수 없어요. 답을 선택해 복사해 주세요.' };
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
// 어두운 처마 입구가 메뉴 뒤에 있는 동안만 어두운 유리로 둔다(v11 본문은 흰 바탕이라 입구를 지나면 밝은 유리)
const gate = $('.gate');
if (gate && bar) {
  if ('IntersectionObserver' in window) {
    // 관찰 결과의 좌표를 쓴다. 매 스크롤 프레임에 문서 전체 레이아웃을 강제로 읽지 않는다.
    new IntersectionObserver(entries => {
      bar.classList.toggle('on-dark', entries[0].boundingClientRect.bottom > 64);
    }, { rootMargin: '-64px 0px 0px 0px' }).observe(gate);
  } else {
    const tone = () => bar.classList.toggle('on-dark', gate.getBoundingClientRect().bottom > 64);
    addEventListener('scroll', tone, { passive: true });
    addEventListener('resize', tone); tone();
  }
}

/* 부드러운 이동: 사람이 처음 누르거나 키를 친 뒤에 켠다. 주소(#…)로 들어온 첫 이동은 움직임 없이 바로 그 자리다 */
const smooth = () => { document.documentElement.classList.add('smooth'); removeEventListener('pointerdown', smooth, true); removeEventListener('keydown', smooth, true); };
addEventListener('pointerdown', smooth, true); addEventListener('keydown', smooth, true);

/* 나타나기 */
// 옆으로 넘기는 띠(PATH 서울 여행 세 단계, 900px 아래): 넘칠 때만 탭으로 닿고 이름을 단다.
for (const el of document.querySelectorAll('[data-scroll-x]')) {
  const sync = () => {
    if (el.scrollWidth > el.clientWidth + 1) { el.tabIndex = 0; el.setAttribute('role', 'region'); el.setAttribute('aria-label', el.dataset.scrollLabel || ''); }
    else { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label'); }
  };
  sync();
  addEventListener('resize', sync, { passive: true });
}
const reveals = $$('.reveal');
if ('IntersectionObserver' in window && !reduced.matches) {
  const io = new IntersectionObserver(entries => { for (const en of entries) if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }, { rootMargin: '0px 0px -8% 0px', threshold: 0.06 });
  reveals.forEach(el => io.observe(el));
  // 최초 화면·앵커 진입도 observer가 통지한다. 읽기/쓰기 교대로 강제 레이아웃을 만들지 않는다.
} else reveals.forEach(el => el.classList.add('in'));

/* 이메일 복사 */
$$('[data-copy-email]').forEach(b => b.addEventListener('click', async () => { try { await navigator.clipboard.writeText('hello@synk.im'); toast(T.copied); } catch { toast(T.copyFail); } }));

/* 다운로드 창(2026-10-13 시그널): JS가 없으면 details와 바로 받기, 지원되는 브라우저에서는 플랫폼 포스터가 붙은 작은 창.
   받기를 누르면(다운로드는 막지 않는다) 같은 창이 다음 할 일 세 단계로 바뀐다. Mac은 칩을 알 수 있으면 맞는 파일을 맨 위에 둔다. */
const downloadArea = $('[data-platform-downloads]');
if (downloadArea && typeof HTMLDialogElement !== 'undefined' && HTMLDialogElement.prototype.showModal) {
  const makeDialog = (panel, id, title) => {
    const dialog = document.createElement('dialog');
    dialog.id = id; dialog.className = 'download-dialog';
    dialog.setAttribute('aria-labelledby', title);
    dialog.append(panel); document.body.append(dialog);
    const close = $('[data-download-close]', dialog); close.hidden = false;
    close.addEventListener('click', () => dialog.close());
    dialog.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      const controls = $$('button:not([disabled]), a[href]', dialog).filter(el => !el.closest('[hidden]')), first = controls[0], last = controls.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === $('#' + title, dialog))) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    dialog.addEventListener('click', e => {
      const r = dialog.getBoundingClientRect();
      if (e.target === dialog && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dialog.close();
    });
    return dialog;
  };
  const open = (dialog, trigger, focus) => {
    if (!dialog.open) dialog.showModal();
    document.documentElement.classList.add('download-open');
    focus.focus({ preventScroll: true });
    dialog.addEventListener('close', () => { document.documentElement.classList.remove('download-open'); trigger.focus({ preventScroll: true }); }, { once: true });
  };
  // 받은 뒤: 고르기를 걷고 다음 할 일을 보인다. 다시 받기는 방금 고른 파일로 맞춘다
  const showNext = (dialog, href) => {
    const next = $('[data-download-next]', dialog), choose = $('[data-download-choose]', dialog);
    if (!next) return;
    if (choose) choose.hidden = true;
    next.hidden = false;
    const retry = $('[data-download-retry]', next); if (retry && href) retry.href = href;
    dialog.setAttribute('aria-describedby', 'download-started-' + dialog.id);
    const started = $('[data-download-started]', next); started.id = 'download-started-' + dialog.id;
    started.focus({ preventScroll: true });
  };

  // Mac: details → 창
  const picker = $('[data-download-picker]', downloadArea);
  if (picker) {
    const summary = $('summary', picker), panel = $('.download-panel', picker);
    const trigger = document.createElement('button');
    trigger.type = 'button'; trigger.className = summary.className;
    trigger.append(...[...summary.childNodes].map(n => n.cloneNode(true)));
    trigger.setAttribute('aria-haspopup', 'dialog'); trigger.setAttribute('aria-controls', 'mac-download-dialog');
    const dialog = makeDialog(panel, 'mac-download-dialog', 'mac-download-title');
    dialog.setAttribute('aria-describedby', 'mac-download-description');
    picker.replaceWith(trigger);
    const reset = () => {
      const next = $('[data-download-next]', dialog), choose = $('[data-download-choose]', dialog);
      if (next) next.hidden = true; if (choose) choose.hidden = false;
      dialog.setAttribute('aria-describedby', 'mac-download-description');
    };
    dialog.addEventListener('close', reset);
    let detected = false;
    trigger.addEventListener('click', async () => {
      open(dialog, trigger, $('#mac-download-title', dialog));
      if (detected) return; detected = true;
      const chip = await macChip();
      const pick = chip && $(`.download-choice[data-chip="${chip}"]`, dialog);
      if (!pick) return;
      pick.classList.add('is-recommended');
      const tag = document.createElement('span'); tag.className = 'download-tag'; tag.textContent = panel.dataset.recommended || '';
      $('strong', pick).after(tag);
      pick.parentElement.prepend(pick);
      const note = document.createElement('p'); note.className = 'download-detected'; note.textContent = panel.dataset.detected || '';
      $('.download-choices', dialog).before(note);
    });
    $$('.download-choice', dialog).forEach(a => a.addEventListener('click', () => showNext(dialog, a.href)));
    const back = $('[data-download-back]', dialog);
    if (back) back.addEventListener('click', () => { reset(); $('#mac-download-title', dialog).focus({ preventScroll: true }); });
  }

  // Windows: 받기는 그대로 두고, 같은 모양의 창에 다음 할 일을 연다
  const windowsLink = $('a.btn[href$=".exe"]', downloadArea), template = $('#windows-download-guide');
  if (windowsLink && template) {
    const dialog = makeDialog(template.content.firstElementChild.cloneNode(true), 'windows-download-dialog', 'windows-download-title');
    windowsLink.addEventListener('click', () => { open(dialog, windowsLink, $('#windows-download-title', dialog)); showNext(dialog, windowsLink.href); });
  }
}

/* Mac 칩 알아내기: Chrome·Edge는 클라이언트 힌트, 그 밖에는 WebGL 그래픽 이름에 Apple M·Intel이 드러날 때만.
   Safari는 Apple Silicon에서도 「Intel」로 적으므로 브라우저 이름표(UA)는 쓰지 않는다. 모르면 null(두 파일을 같은 무게로 둔다). */
async function macChip() {
  const ua = navigator.userAgentData;
  const mac = ua ? ua.platform === 'macOS' : /Mac/.test(navigator.platform || '');
  if (!mac) return null;
  try { if (ua?.getHighEntropyValues) { const v = await ua.getHighEntropyValues(['architecture']); if (v.architecture === 'arm') return 'arm64'; if (v.architecture === 'x86') return 'x64'; } } catch {}
  try {
    const gl = document.createElement('canvas').getContext('webgl'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    const name = gl ? String(gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER)) : '';
    if (/Apple M\d/i.test(name)) return 'arm64';
    if (/Intel/i.test(name)) return 'x64';
  } catch {}
  return null;
}

$$('dialog [data-close]').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
$$('dialog:not(.download-dialog)').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

/* 질문 */
const askRoot = $('[data-ask]');
const form = $('#question-form'), input = $('#question'), send = $('#send'), messages = $('#messages');
const site = askRoot?.dataset.site || 'synk';
let engine = null, pending = null, guideData = null, localEngine = null, queryWorker = null, workerUnavailable = false, querySequence = 0;
let context = { brand: ['lab', 'shift', 'pulse', 'path'].includes(site) ? site : 'synk' }, busy = false;
const queries = new Map();
function stopQueryWorker() {
  workerUnavailable = true; queryWorker?.terminate(); queryWorker = null;
  for (const query of queries.values()) { clearTimeout(query.timer); query.reject(new Error('worker unavailable')); }
  queries.clear();
}
function startQueryWorker() {
  if (queryWorker || workerUnavailable || !guideData) return;
  if (typeof Worker === 'undefined') { workerUnavailable = true; return; }
  try {
    queryWorker = new Worker(new URL('./answer-worker-b280f79e438e.js', import.meta.url), { type: 'module' });
    queryWorker.onmessage = ({ data }) => {
      const query = queries.get(data.id); if (!query) return;
      queries.delete(data.id); clearTimeout(query.timer);
      if (data.error) query.reject(new Error(data.error)); else query.resolve(data.result);
    };
    queryWorker.onerror = event => { event.preventDefault(); stopQueryWorker(); };
    queryWorker.onmessageerror = stopQueryWorker;
    queryWorker.postMessage({ type: 'init', src: new URL(askRoot.dataset.engine, location.href).href, data: guideData });
  } catch { stopQueryWorker(); }
}
async function queryAnswer(question, previous) {
  startQueryWorker();
  if (queryWorker) {
    try {
      return await new Promise((resolve, reject) => {
        const id = ++querySequence, timer = setTimeout(stopQueryWorker, 15000);
        queries.set(id, { resolve, reject, timer });
        try { queryWorker.postMessage({ type: 'answer', id, question, context: previous }); }
        catch { stopQueryWorker(); }
      });
    } catch { stopQueryWorker(); }
  }
  // Worker를 차단한 브라우저도 같은 공개 검색 엔진으로 답한다. 질문하지 않으면 색인을 만들지 않는다.
  localEngine ??= import(askRoot.dataset.engine).then(mod => mod.createKnowledgeEngine(guideData)).catch(error => { localEngine = null; throw error; });
  return (await localEngine).answer(question, previous);
}
function loadEngine() {
  if (engine) return Promise.resolve(engine);
  if (pending) return pending;
  const data = askRoot.dataset.knowledge;
  pending = fetch(data).then(r => { if (!r.ok) throw new Error('knowledge'); return r.json(); })
    .then(json => {
      // FAQ와 출처 열기는 색인 없이 원문에서 바로 읽는다. 스크롤만 해도 검색 색인을 만들던 지연을 없앤다.
      // Keep the same public-source validation as createKnowledgeEngine before exposing any answer.
      if (!json || !Array.isArray(json.docs) || !Array.isArray(json.records)) throw new Error('knowledge');
      const docs = new Map(json.docs.map(d => [d.id, d])), records = new Map(json.records.map(r => [r.id, r]));
      if (docs.size !== json.docs.length || records.size !== json.records.length) throw new Error('duplicate knowledge');
      for (const r of records.values()) {
        if (!docs.has(r.sourceId) || typeof r.answer !== 'string' || !r.answer.trim() || !Array.isArray(r.questionExamples) || !r.questionExamples.length || !Array.isArray(r.keywords)) throw new Error('knowledge source');
        if (r.relatedIds?.some(id => !records.has(id)) || r.answer.split('\n\n').some(p => !docs.get(r.sourceId).paragraphs.includes(p))) throw new Error('knowledge evidence');
      }
      guideData = json;
      return engine = { docs, records };
    })
    .catch(err => { pending = null; throw err; });
  return pending;
}
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
const paras = (parent, text) => String(text || '').split(/\n\n/).filter(Boolean).forEach(p => parent.append(el('p', '', p)));

// 답 안의 제품·사업 이름: 형광 줄로 표시하고, 누르면 그 이름의 공개 안내를 바로 연다(검색을 거치지 않는다).
// 긴 이름부터 찾고, 답 하나에 셋까지, 지금 답과 같은 기록은 표시하지 않는다.
const TERMS = (lang === 'en'
  ? [['SYNK platform', 'synk-platform'], ['SYNK WORLD', 'synk-platform'], ['member benefits', 'synk-benefits'], ['Atlas', 'synk-atlas'], ['SYNK LAB', 'lab-intro'], ['SYNK SHIFT', 'shift-intro'], ['SYNK PULSE', 'pulse-intro'], ['PATH', 'path-intro']]
  : [['SYNK 플랫폼', 'synk-platform'], ['SYNK WORLD', 'synk-platform'], ['회원 혜택', 'synk-benefits'], ['무료 체험', 'synk-products'], ['아틀라스', 'synk-atlas'], ['SYNK LAB', 'lab-intro'], ['SYNK SHIFT', 'shift-intro'], ['SYNK PULSE', 'pulse-intro'], ['PATH', 'path-intro']]
).sort((a, b) => b[0].length - a[0].length);
const termRe = new RegExp(TERMS.map(([t]) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');
const latin = ch => /[A-Za-z0-9]/.test(ch || '');
function markTerms(p, text, used) {
  let last = 0;
  for (const m of String(text).matchAll(termRe)) {
    const [term] = m, id = TERMS.find(([t]) => t === term)?.[1];
    const edge = latin(term[0]) && latin(text[m.index - 1]) || latin(term.at(-1)) && latin(text[m.index + term.length]);
    if (!id || edge || used.has(id) || used.size >= used.cap || !engine?.records.has(id)) continue;
    used.add(id);
    p.append(text.slice(last, m.index));
    const b = el('button', 'qa-term', term); b.type = 'button'; b.dataset.askRecord = id;
    b.setAttribute('aria-label', term + (lang === 'en' ? ': ' : ' ') + T.termOpen); b.title = T.termOpen;
    p.append(b); last = m.index + term.length;
  }
  p.append(text.slice(last));
  return p;
}

// 2026-10-19 유호님 「너무 ai스러워 … 싱ㅋ처럼 힙한 느낌, 전달력·사용성」: 말풍선·둥근 상자·같은 모양 알약 대신 질문 색인과 같은 줄 문법의 답 시트.
// 왼쪽 「A」 꼬리표와 가는 선, 큰 첫 문장, 주 행동 하나, 「이어서 물어보기」 번호 줄, 맨 아래 확인 날짜·자료·복사 한 줄.
function renderAnswer(result, { inline = false } = {}) {
  const records = result.records || [];
  const wrap = el('div', 'qa-a' + (inline ? ' is-inline' : ''));
  const rail = el('p', 'qa-rail'); rail.setAttribute('aria-hidden', 'true'); rail.append(el('span', 'qa-mark', 'A')); wrap.append(rail);
  const body = el('div', 'qa-body');
  const used = Object.assign(new Set(records.map(r => r.id)), { cap: records.length + 3 });
  let first = true;
  const say = (parent, text) => { parent.append(markTerms(el('p', first ? 'qa-lead' : ''), text, used)); first = false; };
  if (result.message) String(result.message).split(/\n\n/).filter(Boolean).forEach(t => say(body, t));
  for (const record of records) {
    if (records.length > 1) { body.append(el('h4', 'qa-sub', record.title)); first = true; }
    const parts = String(record.answer || '').split(/\n\n/);
    const focus = result.focus?.[record.id];
    say(body, parts[0]);
    if (focus > 0 && focus < parts.length) say(body, parts[focus]);
    const rest = parts.filter((_, i) => i > 0 && i !== focus);
    if (rest.length) {
      const d = el('details', 'qa-more'), s = el('summary');
      s.append(el('span', '', T.more), el('span', 'qa-count', '+' + rest.length));
      const inner = el('div'); rest.forEach(t => inner.append(markTerms(el('p'), t, used)));
      d.append(s, inner); body.append(d);
    }
  }
  // 주 행동: 검토한 주소만 링크로 만든다(규칙은 빌드 때 src/public-actions.js에서 들어온다). 영어 안내의 링크는 이미 /en/ 판이다.
  const seen = new Set(), go = el('div', 'qa-go');
  for (const record of records) {
    const a = record.action;
    if (a?.href && !seen.has(a.href) && typeof a.label === 'string' && a.label.trim() && isPublicActionHref(a.href)) {
      seen.add(a.href);
      const link = el('a', seen.size === 1 ? 'qa-go-main' : 'qa-go-more'); link.href = a.href;
      link.append(el('span', '', a.label), el('span', 'arr', '↗'));
      go.append(link);
    }
  }
  if (go.children.length) body.append(go);
  const related = (result.relatedIds || []).slice(0, result.status === 'clarify' ? 3 : 2).map(id => engine?.records.get(id)).filter(Boolean);
  if (related.length) {
    const next = el('div', 'qa-next'), list = el('ul');
    next.append(el('p', 'qa-label', T.related));
    related.forEach((r, i) => {
      const b = el('button'); b.type = 'button'; b.dataset.askQ = r.questionExamples?.[0] || r.title;
      b.append(el('span', 'qa-text', r.title), el('span', 'arr', '→'));
      const li = el('li'); li.append(b); list.append(li);
    });
    next.append(list); body.append(next);
  }
  const meta = el('p', 'qa-meta');
  const dates = [...new Set(records.map(r => r.reviewedAt).filter(Boolean))].sort();
  meta.append(el('span', '', T.synk));
  if (dates.length) { const d = el('span'); d.append(T.reviewed + ' ', el('span', 'qa-date', dates.at(-1).replace(/-/g, '.'))); meta.append(d); }
  (result.sourceIds || []).slice(0, 2).forEach(id => {
    const doc = engine?.docs.get(id); if (!doc) return;
    const b = el('button', '', T.sources + ' · ' + doc.title.split(' — ')[0]); b.type = 'button'; b.dataset.doc = id; meta.append(b);
  });
  const copy = el('button', '', T.copyAnswer); copy.type = 'button';
  copy.addEventListener('click', async () => { try { await navigator.clipboard.writeText([result.message, ...records.map(r => r.answer)].filter(Boolean).join('\n\n')); toast(T.answerCopied); } catch { toast(T.noCopy); } });
  meta.append(copy);
  body.append(meta);
  wrap.append(body);
  return wrap;
}

async function answer(question) {
  const result = await queryAnswer(question, context);
  if (['matched', 'needs_confirmation'].includes(result.status)) context = { brand: ['lab', 'shift', 'pulse', 'path'].includes(result.brand) ? result.brand : context.brand, recordIds: (result.records || []).map(r => r.id) };
  else if (!['clarify', 'courtesy'].includes(result.status)) context = { brand: context.brand };
  return result;
}

// 직접 물은 질문은 자주 묻는 질문 번호를 이어 받아 색인 한 줄이 된다(말풍선 없음).
let asked = 0;
function entry(question, result, typed = true) {
  const art = el('article', 'qa-entry'), head = el('div', 'qa-q');
  head.append(el('span', 'qa-no', String($$('.faq-q').length + ++asked).padStart(2, '0')), el('h3', 'qa-q-text', question), el('span', 'qa-tag', typed ? T.mine : T.follow));
  art.append(head, renderAnswer(result));
  // 머리줄 개수: 자주 묻는 질문 수 + 직접 물은 수(움직임 없이 글자만 바뀐다)
  const count = $('#questions .qx-count'), pad = n => String(n).padStart(2, '0');
  if (count) count.textContent = pad($$('.faq-q').length) + ' + ' + pad(asked);
  messages.append(art);
  while (messages.children.length > 12) messages.firstElementChild.remove();
  return head;
}
async function ask(text, { scroll = true, record = null, typed = false } = {}) {
  const q = String(text || '').trim();
  if (!q || busy) return;
  if (q.length > 500) { toast(T.tooLong); return; }
  busy = true; form?.setAttribute('aria-busy', 'true'); syncSend();
  try {
    await loadEngine();
    // 답 안의 이름을 누르면 그 기록을 그대로 연다(자주 묻는 질문과 같은 방식).
    const r = record && engine.records.get(record);
    let result;
    if (r) { result = { status: 'matched', records: [r], sourceIds: [r.sourceId], relatedIds: (r.relatedIds || []).slice(0, 2), brand: r.brand }; context = { brand: ['lab', 'shift', 'pulse', 'path'].includes(r.brand) ? r.brand : context.brand, recordIds: [r.id] }; }
    else result = await answer(q);
    const head = entry(q, result, typed);
    if (typed) { input.value = ''; autosize(); }
    if (scroll) head.scrollIntoView({ behavior: reduced.matches ? 'auto' : 'smooth', block: 'start' });
  } catch { toast(T.loadFail); }
  finally { busy = false; form?.setAttribute('aria-busy', 'false'); syncSend(); }
}
function autosize() { if (!input) return; input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 160) + 'px'; }
function syncSend() { if (send) send.disabled = busy || !input.value.trim(); }
if (askRoot) {
  // 입력하려는 순간 별도 스레드를 준비한다. 질문·답은 이 기기를 벗어나지 않는다.
  input.addEventListener('focus', () => { loadEngine().then(startQueryWorker).catch(() => {}); });
  input.addEventListener('input', () => { autosize(); syncSend(); });
  input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); if (input.value.trim()) form.requestSubmit(); } });
  form.addEventListener('submit', e => { e.preventDefault(); ask(input.value, { typed: true }); });
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
      const result = record ? { status: 'matched', records: [record], sourceIds: [record.sourceId], relatedIds: (record.relatedIds || []).slice(0, 2), brand: record.brand } : await answer(btn.dataset.faq);
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
  const b = e.target.closest('[data-ask-q],[data-ask-record]');
  if (!b || !askRoot) return;
  e.preventDefault();
  // 새 색인 줄(질문 머리)로 바로 간다. 답 안의 이름은 그 기록의 대표 질문으로 묻는다.
  const r = b.dataset.askRecord && engine?.records.get(b.dataset.askRecord);
  ask(r ? (r.questionExamples?.[0] || r.title) : b.dataset.askQ, { record: r ? r.id : null });
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

/* 서비스 목록(SHIFT·PULSE, 2026-10-19): 넓은 화면은 왼쪽 큰 글자 목록에서 하나를 골라 오른쪽에 보인다.
   좁은 화면과 JS가 없을 때는 모두 펼친다. 주소의 #service-N·#film-N(위 이동 줄 포함)으로 오면 그 서비스를 연다. */
$$('[data-svc]').forEach(root => {
  const tabs = $$('[data-svc-tab]', root), panels = $$('.svc-panel', root), list = $('.svc-list', root);
  const wide = matchMedia('(min-width: 901px)');
  let on = 0;
  const show = (i, focus) => {
    on = i;
    tabs.forEach((t, k) => { t.setAttribute('aria-selected', String(k === i)); t.tabIndex = k === i ? 0 : -1; });
    panels.forEach((p, k) => p.classList.toggle('is-on', k === i));
    if (focus) tabs[i].focus();
  };
  const apply = () => {
    const tabsMode = wide.matches;
    root.classList.toggle('is-tabs', tabsMode);
    if (tabsMode) { list.setAttribute('role', 'tablist'); list.setAttribute('aria-orientation', 'vertical'); tabs.forEach(t => t.setAttribute('role', 'tab')); panels.forEach((p, k) => { p.setAttribute('role', 'tabpanel'); p.setAttribute('aria-labelledby', tabs[k].id); }); }
    else { ['role', 'aria-orientation'].forEach(a => list.removeAttribute(a)); tabs.forEach(t => t.removeAttribute('role')); panels.forEach(p => { p.removeAttribute('role'); p.removeAttribute('aria-labelledby'); }); }
    show(on);
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(i));
    t.addEventListener('keydown', e => {
      const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
      if (d) { e.preventDefault(); show((i + d + tabs.length) % tabs.length, true); }
      else if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); show(e.key === 'Home' ? 0 : tabs.length - 1, true); }
    });
  });
  const go = (hash, smooth) => {
    const i = panels.findIndex(p => '#' + p.id === hash);
    if (i < 0) return false;
    show(i);
    if (wide.matches) root.scrollIntoView({ behavior: smooth && !reduced.matches ? 'smooth' : 'auto', block: 'start' });
    return true;
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href*="#"]');
    if (!a || !wide.matches) return;
    const url = new URL(a.href, location.href);
    if (url.pathname !== location.pathname || !go(url.hash, true)) return;
    e.preventDefault(); history.replaceState(null, '', url.hash);
  });
  wide.addEventListener('change', apply);
  apply(); go(location.hash, false);
  addEventListener('hashchange', () => go(location.hash, true));
});
