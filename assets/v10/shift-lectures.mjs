// SHIFT 「강의와 강사」(#lectures) · 2026-10-27
// 고른 기관 · 강의 · 강사로 문의 유형과 문의 글을 만들고, 공용 Google Forms를 그 두 칸이 미리 적힌 채로 여는 주소를 만든다.
// 빌드(build.mjs, JS가 없을 때의 기본 링크)와 SHIFT 두 쪽의 화면(아래 mount)이 같은 함수를 쓴다. site.js 묶음에는 넣지 않는다.
// 문의는 사용자가 양식에서 고치고 직접 보내야 접수된다 — 이 파일은 아무것도 보내거나 저장하지 않는다.

// 주소 상한: 양식 6,000자, 메일 1,800자(Windows가 긴 mailto를 자른다 — PULSE 캐스팅북과 같은 값).
export const FORM_MAX = 6000;
export const MAIL_MAX = 1800;

// D: 원고의 lectures.inquiry에 강의별 문의 글 이름(courses)을 더한 것. sel: { org, course, instructor } — 비어 있으면 「정하지 않음」.
export function lectureType(D, sel) {
  return sel.instructor === 'recommend' ? D.types.agency : D.types.lecture;
}

export function lectureText(D, sel) {
  const course = sel.course && D.courses[sel.course];
  const who = sel.instructor === 'yuho' ? D.yuho : sel.instructor === 'recommend' ? D.recommend : D.instructorNone;
  return [D.hello, '', D.picked,
    `${D.org}: ${sel.org || D.orgNone}`,
    `${D.course}: ${course || D.courseNone}`,
    `${D.instructor}: ${who}`,
    '', D.ask, ...D.fields.map(f => `${f}: `)].join('\n');
}

const formUrl = (form, type, text) => `${form.href}?usp=pp_url&${form.fields.type}=${encodeURIComponent(type)}&${form.fields.text}=${encodeURIComponent(text)}`;

// 양식 주소가 상한을 넘으면 빈 양식으로 연다(fit: false — 화면은 글을 복사해 둔다). 메일은 본문이 넘치면 제목만 담는다.
export function lectureLinks(D, form, email, sel) {
  const type = lectureType(D, sel), text = lectureText(D, sel);
  const full = formUrl(form, type, text);
  const formFit = full.length <= FORM_MAX;
  const subject = `mailto:${email}?subject=${encodeURIComponent(D.subject)}`;
  const mailFull = `${subject}&body=${encodeURIComponent(text)}`;
  const mailFit = mailFull.length <= MAIL_MAX;
  return { type, text, form: formFit ? full : form.href, formFit, mail: mailFit ? mailFull : subject, mailFit };
}

/* ---------- 화면 ---------- */
// 원고는 쪽 안의 <script type="application/json" id="lc-data">에 있다(build.mjs가 넣는다). 고른 것은 저장하지 않는다(새로 고치면 처음부터).
export function mount(doc = document) {
  const root = doc.getElementById('lectures');
  const dataEl = doc.getElementById('lc-data');
  if (!root || !dataEl) return;
  const { D, form, email, names, msg } = JSON.parse(dataEl.textContent);
  const $ = s => root.querySelector(s);
  const $$ = s => [...root.querySelectorAll(s)];
  const sel = { org: '', course: '', instructor: '' };
  const status = $('[data-lc-status]');
  let current = null;
  const say = t => { if (status) status.textContent = t; };

  function update() {
    current = lectureLinks(D, form, email, sel);
    $('[data-lc-open]').href = current.form;
    $('[data-lc-mail]').href = current.mail;
    $('[data-lc-preview]').textContent = current.text;
    $('[data-lc-type]').textContent = names.type[current.type === D.types.agency ? 'agency' : 'lecture'];
    $('[data-lc-row="org"]').textContent = sel.org || names.none;
    $('[data-lc-row="course"]').textContent = (sel.course && names.course[sel.course]) || names.courseNone;
    $('[data-lc-row="instructor"]').textContent = names.instructor[sel.instructor || 'none'];
    for (const card of $$('[data-lc-card]')) card.classList.toggle('is-on', !!card.querySelector('input:checked'));
    const n = (sel.course ? 1 : 0) + (sel.instructor ? 1 : 0);
    const count = $('[data-lc-count]');
    if (count) count.textContent = `${n}/2`;
  }

  for (const b of $$('[data-lc-org]')) b.addEventListener('click', () => {
    const on = b.getAttribute('aria-pressed') !== 'true';
    for (const o of $$('[data-lc-org]')) o.setAttribute('aria-pressed', 'false');
    b.setAttribute('aria-pressed', String(on));
    sel.org = on ? b.dataset.lcOrg : '';
    update();
  });
  for (const r of $$('input[type=radio][name^="lc-"]')) r.addEventListener('change', () => {
    if (!r.checked) return;
    sel[r.name === 'lc-course' ? 'course' : 'instructor'] = r.value === 'none' ? '' : r.value;
    update();
  });
  // 카드의 빈 곳을 눌러도 그 카드를 고른다. 링크 · 펼치기 · 라벨은 자기 동작을 한다.
  for (const card of $$('[data-lc-card]')) card.addEventListener('click', e => {
    if (e.target.closest('a, button, summary, details, label, input')) return;
    const r = card.querySelector('input[type=radio]');
    if (r && !r.checked) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
  });
  // 「바꾸기」: 그 묶음의 고른 칸(없으면 첫 칸)으로 초점을 옮긴다.
  for (const a of $$('[data-lc-change]')) a.addEventListener('click', e => {
    const group = doc.getElementById(a.getAttribute('href').slice(1));
    if (!group) return;
    e.preventDefault();
    const target = group.querySelector('input:checked') || group.querySelector('[aria-pressed="true"]') || group.querySelector('input, button');
    // 초점이 갈 칸(고른 카드, 기본이면 묶음 맨 아래 「아직」)을 화면 가운데로 — 묶음 맨 위로 굴리면 초점이 화면 밖에 남는다.
    (target || group).scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    if (target) target.focus({ preventScroll: true });
  });

  async function copy(okMsg) {
    try { await navigator.clipboard.writeText(current.text); say(okMsg); return true; }
    catch { say(msg.copyFail); return false; }
  }
  $('[data-lc-copy]').addEventListener('click', () => copy(msg.copied));
  $('[data-lc-mail]').addEventListener('click', () => { if (!current.mailFit) copy(msg.mailCopied); });
  $('[data-lc-open]').addEventListener('click', () => { if (!current.formFit) copy(msg.copied); });

  // 휴대폰: 구역 안에 있고 문의 글 칸이 안 보일 때만 아래 막대를 띄운다.
  const bar = $('[data-lc-bar]');
  const summary = doc.getElementById('lc-summary');
  if (bar && summary && 'IntersectionObserver' in window) {
    let inSection = false, summarySeen = false;
    const show = () => { bar.hidden = !(inSection && !summarySeen); doc.documentElement.classList.toggle('lc-bar-on', !bar.hidden); };
    new IntersectionObserver(([e]) => { inSection = e.isIntersecting; show(); }).observe(root);
    new IntersectionObserver(([e]) => { summarySeen = e.isIntersecting; show(); }).observe(summary);
  }
  root.classList.add('lc-ready');
  update();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => mount());
  else mount();
}
