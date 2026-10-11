// SYNK 홈페이지 v10 · 메뉴, 나타나기, 대화 구, 질문(자주 묻는 질문 + 직접 묻기), 게임 장면, 알림.
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

/* 대화 구(2026-10-11 유호님 「예전에 SYNK 구체같은거 … 그거 추가해주고」): 9월 질문창의 구를 그대로 옮겨 왔다(공개본 orb-conversation.js).
   빛 알갱이를 찍은 잉크 구. 빛은 왼쪽 위에 머물다가, 포인터가 구 위에서 움직일 때만 그쪽으로 돈다. 저절로 움직이지 않는다.
   두 잉크는 CSS에서 온다(color = 어두운 알갱이, caret-color = 빛난 알갱이). 알갱이 순서는 아틀라스 지도와 같아 이 브라우저에 한 번만 계산해 둔다. */
const ORB_GRID = 64; let grainJob = null;
function orbRandom(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const whenIdle = window.requestIdleCallback ? cb => requestIdleCallback(cb, { timeout: 1000 }) : cb => setTimeout(() => cb(null), 16);
function inSlices(steps) {
  return new Promise(resolve => {
    const run = deadline => {
      const stop = performance.now() + (deadline && !deadline.didTimeout ? Math.min(8, deadline.timeRemaining()) : 8);
      for (;;) { const next = steps.next(); if (next.done) { resolve(next.value); return; } if (performance.now() >= stop) break; }
      whenIdle(run);
    };
    whenIdle(run);
  });
}
const GRAIN_KEY = 'synk-grain-order-v1';
function storedGrain(count) {
  try {
    const text = localStorage.getItem(GRAIN_KEY); if (!text || text.length !== Math.ceil(count * 2 / 3) * 4) return null;
    const bytes = Uint8Array.from(atob(text), c => c.charCodeAt(0)), steps = new Uint16Array(bytes.buffer, 0, count);
    const seen = new Uint8Array(count), order = new Float32Array(count);
    for (let place = 0; place < count; place++) { const step = steps[place]; if (step >= count || seen[step]) return null; seen[step] = 1; order[place] = (step + .5) / count; }
    return order;
  } catch { return null; }
}
function storeGrain(order) {
  try {
    const count = order.length, steps = new Uint16Array(count);
    for (let place = 0; place < count; place++) steps[place] = Math.round(order[place] * count - .5);
    const bytes = new Uint8Array(steps.buffer); let text = '';
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    localStorage.setItem(GRAIN_KEY, btoa(text));
  } catch {}
}
// 고른 순서: 다음 알갱이는 가장 빈 자리로(아틀라스 지도와 같은 씨앗)
function* grainSteps() {
  const G = ORB_GRID, count = G * G, rnd = orbRandom(862104), crowd = new Float32Array(count), taken = new Uint8Array(count);
  const reach = 9, span = reach * 2 + 1, near = new Float32Array(span * span);
  for (let y = -reach; y <= reach; y++) for (let x = -reach; x <= reach; x++) near[(y + reach) * span + x + reach] = Math.exp(-(x * x + y * y) / 7.22);
  for (let i = 0; i < count; i++) crowd[i] = rnd() * 1e-4;
  const rowLeast = new Float32Array(G), rowPlace = new Int32Array(G);
  const recount = row => { let place = -1, least = Infinity; for (let i = row * G, end = i + G; i < end; i++) if (!taken[i] && crowd[i] < least) { least = crowd[i]; place = i; } rowLeast[row] = least; rowPlace[row] = place; };
  for (let row = 0; row < G; row++) recount(row);
  const order = new Float32Array(count);
  for (let step = 0; step < count; step++) {
    let py = 0; for (let row = 1; row < G; row++) if (rowLeast[row] < rowLeast[py]) py = row;
    const place = rowPlace[py], px = place % G; taken[place] = 1; order[place] = (step + .5) / count;
    for (let y = -reach; y <= reach; y++) { const row = (py + y + G) % G, line = (y + reach) * span + reach; for (let x = -reach; x <= reach; x++) crowd[row * G + (px + x + G) % G] += near[line + x]; recount(row); }
    if (step % 128 === 127) yield;
  }
  return order;
}
function grainOrder() {
  if (grainJob) return grainJob;
  const stored = storedGrain(ORB_GRID * ORB_GRID);
  return grainJob = stored ? Promise.resolve(stored) : inSlices(grainSteps()).then(order => { storeGrain(order); return order; });
}
const LIGHT = { angle: -Math.PI * 2 * .108, lift: .56, fall: 2.4, gain: .9, floor: .02, rim: .06 };
const FALL = new Float32Array(1025); for (let i = 0; i <= 1024; i++) FALL[i] = Math.pow(i / 1024, LIGHT.fall) * LIGHT.gain;
let probe = null;
function rgba(value, fallback) {
  probe ??= Object.assign(document.createElement('canvas'), { width: 1, height: 1 }).getContext('2d', { willReadFrequently: true });
  probe.clearRect(0, 0, 1, 1); probe.fillStyle = fallback; probe.fillStyle = value || fallback; probe.fillRect(0, 0, 1, 1);
  return Array.from(probe.getImageData(0, 0, 1, 1).data);
}
function mountOrb(holder) {
  const canvas = $('canvas', holder), surface = $('.orb-surface', holder);
  const ctx = canvas?.getContext('2d'); if (!ctx || !surface) return;
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  let angle = LIGHT.angle, lift = LIGHT.lift, frame = 0, drawn = '', shape = null, preparing = '';
  function* measureSteps(size, dpr, grain) {
    const G = ORB_GRID, cell = Math.max(1, Math.round(dpr * .62)), radius = size / 2 - dpr, middle = size / 2, outer = (1 + 1.5 / radius) ** 2;
    const index = [], cx = [], cy = [], cz = [], rim = [], threshold = [], cover = [];
    for (let py = 0; py < size; py++) {
      const y = (py + .5 - middle) / radius, gy = Math.floor(py / cell), sy = ((gy + .5) * cell - middle) / radius, row = (gy % G) * G;
      for (let px = 0; px < size; px++) {
        const x = (px + .5 - middle) / radius, reachSq = x * x + y * y; if (reachSq > outer) continue;
        const edge = Math.round(Math.min(1, Math.max(0, (1 - Math.sqrt(reachSq)) * radius + .5)) * 255); if (!edge) continue;
        const gx = Math.floor(px / cell), sx = ((gx + .5) * cell - middle) / radius, z = Math.sqrt(Math.max(0, 1 - sx * sx - sy * sy));
        index.push((py * size + px) * 4); cx.push(sx); cy.push(sy); cz.push(z); rim.push(LIGHT.floor + Math.pow(1 - z, 5) * LIGHT.rim); threshold.push(grain[row + gx % G]); cover.push(edge);
      }
      if (py % 32 === 31) yield;
    }
    return { size, dpr, index: Int32Array.from(index), cx: Float32Array.from(cx), cy: Float32Array.from(cy), cz: Float32Array.from(cz), rim: Float32Array.from(rim), threshold: Float32Array.from(threshold), cover: Uint8Array.from(cover) };
  }
  function prepare(size, dpr) {
    const want = size + '|' + dpr; if (preparing === want) return; preparing = want;
    grainOrder().then(grain => inSlices(measureSteps(size, dpr, grain))).then(next => { if (preparing !== want) return; preparing = ''; shape = next; request(); });
  }
  let near = !('IntersectionObserver' in window), idle = 0;
  function paint() {
    frame = 0; if (!near) return;
    const dpr = Math.min(Math.max(devicePixelRatio || 1, 1), 3), width = surface.getBoundingClientRect().width; if (!width) return;
    const style = getComputedStyle(surface), inks = style.color + '/' + style.caretColor;
    const size = Math.round(width * dpr), key = size + '|' + dpr + '|' + angle.toFixed(2) + '|' + lift.toFixed(2) + '|' + inks;
    if (key === drawn) return;
    if (!shape || shape.size !== size || shape.dpr !== dpr) { prepare(size, dpr); return; }
    drawn = key;
    if (canvas.width !== size) canvas.width = canvas.height = size;
    const css = (size + .004) / dpr + 'px'; if (canvas.style.width !== css) canvas.style.width = canvas.style.height = css;
    const image = ctx.createImageData(size, size), data = image.data, side = Math.sqrt(1 - lift * lift), lx = Math.sin(angle) * side, ly = -Math.cos(angle) * side;
    const { index, cx, cy, cz, rim, threshold, cover } = shape;
    const dark = rgba(style.color, '#0a0a0a'), light = rgba(style.caretColor, '#fff');
    for (let k = 0; k < index.length; k++) {
      const facing = Math.max(0, Math.min(1, cx[k] * lx + cy[k] * ly + cz[k] * lift)), lit = rim[k] + FALL[(facing * 1024) | 0] > threshold[k], i = index[k], ink = lit ? light : dark;
      data[i] = ink[0]; data[i + 1] = ink[1]; data[i + 2] = ink[2]; data[i + 3] = cover[k] * ink[3] / 255;
    }
    ctx.putImageData(image, 0, 0);
    surface.classList.add('orb-rendered');
  }
  const request = () => { if (!frame) frame = requestAnimationFrame(paint); };
  // 구는 질문 구역에 있다. 화면이 조용해진 뒤나 가까이 왔을 때 먼저 오는 쪽에 계산한다(스크롤이 기다리지 않게).
  const quiet = window.requestIdleCallback ? cb => requestIdleCallback(cb, { timeout: 2500 }) : cb => setTimeout(cb, 300);
  const later = () => { if (idle) return; idle = quiet(() => { idle = 0; near = true; request(); }); };
  if (!near) new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { near = true; request(); } }, { rootMargin: '800px 0px' }).observe(surface);
  new ResizeObserver(later).observe(surface);
  holder.addEventListener('pointermove', event => {
    if (reduced.matches || !fine.matches || event.pointerType === 'touch') return;
    const r = surface.getBoundingClientRect(), dx = (event.clientX - r.left) / r.width * 2 - 1, dy = (event.clientY - r.top) / r.height * 2 - 1, d = Math.min(1, Math.hypot(dx, dy));
    angle = Math.round(Math.atan2(dx, -dy) * 60) / 60; lift = Math.round((.92 - .5 * d) * 50) / 50; request();
  });
  holder.addEventListener('pointerleave', () => { angle = LIGHT.angle; lift = LIGHT.lift; request(); });
  addEventListener('pageshow', request);
  let density = null;
  const watch = () => { density?.removeEventListener?.('change', changed); density = matchMedia('(resolution: ' + (devicePixelRatio || 1) + 'dppx)'); density.addEventListener?.('change', changed); };
  const changed = () => { watch(); request(); };
  watch(); request();
}
// 구나 「대화 시작」을 누르면 질문 입력창으로
const goAsk = () => { const q = $('#question'); if (!q) return; q.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' }); q.focus({ preventScroll: true }); };
$$('[data-orb]').forEach(o => { mountOrb(o); o.addEventListener('click', goAsk); });
$$('[data-ask-start]').forEach(b => b.addEventListener('click', goAsk));

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
