// synk.im 사이트 방문 기록(익명) — 2026-11-17, 유호님 「방문자 분석 프로그램도 더 치밀하게 구성해서 내가 솔리오에서 확인할수있게」.
// 모든 회사 쪽(한국어 · 영어 · 몽골어)에서 들어옴 · 떠남 · 누름을 익명으로 센다. 홈 「어떤 일로 오셨어요?」 세기(home-ask.js)와 같은 길이고, 그 파일은 그대로 둔다.
// 받는 곳: SYNK 운영 계정의 구글 설문지 「synk.im 방문 기록(익명)」. 질문은 「기록」 하나이고 값은 아래 목록의 글만 담은 JSON 한 줄이다
//   (칸을 더해도 설문지를 고치지 않게 — 보기 글이 다르면 설문지가 조용히 버리는 일을 피한다). 숫자는 SYNK-appsscript tools/사이트방문/이 센다.
// 보내는 것: 기록(들어옴/떠남/누름) · 쪽(주소의 경로만) · 쪽 언어 · 들어온 곳(갈래 이름) · 들어온 곳 이름(검색 · AI 서비스 이름만) · 처음 들어온 곳(이 탭의 첫 갈래)
//   · 기기(화면 넓이로 둘 중 하나) · 링크 꼬리표(?from= · utm_source=) · 머문 시간(구간) · 내려 본 곳(구간) · 다음(사이트 안 · 바깥 링크 · 화면을 떠남)
//   · 누른 것(링크가 가는 곳의 뜻 이름) · 다시 연 쪽(새로 고침 · 뒤로·앞으로로 다시 불러온 들어옴만) · 판. 구글 설문지가 받은 시각을 더한다. 이 목록은 처리방침 「사이트 방문 통계」(privacy #site-visits · #site-visits-en)와 같아야 한다.
// 보내지 않는 것: 이름 · 이메일 · 쿠키 · 기기 식별값 · 전체 주소 · 주소의 질의 값 · referrer 원문 · 누른 링크의 주소 · 방문자가 쓴 글 · 사람을 잇는 번호.
//   기기에는 이 탭의 「처음 들어온 곳」 갈래 이름 하나만 둔다(sessionStorage, 탭을 닫으면 사라진다. 세지 않는 방문은 두지 않는다). ?from=self|qa로 연
//   점검 탭에는 대신 「이 탭은 세지 않음」 표시 하나를 둔다. 끄기 표시(localStorage)는 방문자가 ?nocount=1로 끌 때만 생긴다.
// 세지 않는 때(home-ask.js와 같다): synk.im이 아님(미리 보기 · 시험 주소) · 자동화 브라우저 · 로봇 · 전역 개인정보 신호(GPC) · 미리 불러오기 · ?from=self|qa · 이 브라우저에서 끔(?nocount=1, 되돌리기 ?nocount=0).
// 들어옴은 쪽이 보이는 채로 4초가 지나거나 그 전에 사람의 입력(휠 · 끌기 · 누름 · 자판)이 있을 때 한 번 보낸다(보기만 하고 바로 떠난 것은 로봇과 가려낼 수 없어 세지 않는다).
// 새로 고침이나 뒤로 가기로 다시 불러온 쪽은 처음의 referrer와 주소가 그대로 돌아와 같은 방문이 다시 들어온 것처럼 보인다 — 들어옴에 「다시 연 쪽」을 실어
//   모으기가 사람 방문에서 뺀다(탐색 종류: performance.getEntriesByType('navigation')[0].type). bfcache로 되살린 쪽은 이 파일이 다시 돌지 않는다.
// 누른 것의 이름은 화면의 자리가 아니라 링크가 가는 곳으로 정한다 — 홈이 방과 라벨로 다시 짜여도 같은 목적지면 같은 이름으로 이어진다. href 없는 단추는 data-measure="<뜻 이름>".
// 설계: SYNK-appsscript docs/마케팅/사이트방문_분석/설계.md 1절. 시험: qa/visit-count.test.mjs.

export const FORM = {
  action: 'https://docs.google.com/forms/d/e/1FAIpQLSefBXjwN-5J597FlBwfpRdr9YKD6XOp4J194LlSUUnaE7K7xw/formResponse',
  record: 'entry.1246660192',
};
export const VERSION = 'visit-v1';

export const KINDS = { arrive: '들어옴', leave: '떠남', click: '누름' };
export const LANGS = { ko: '한국어 쪽', en: '영어 쪽', mn: '몽골어 쪽' };
export const SOURCES = {
  direct: '직접', search: '검색', ai: 'AI 답변', instagram: '인스타그램', youtube: '유튜브', tiktok: '틱톡', threads: '스레드',
  facebook: '페이스북', x: 'X', linkedin: '링크드인', blog: '블로그', other: '다른 사이트', internal: 'SYNK 안',
};
export const DEVICES = { phone: '휴대폰', wide: '컴퓨터·태블릿' };
export const DWELL = ['10초 아래', '10~30초', '30초~1분', '1~3분', '3~10분', '10분 넘음'];
export const DEPTH = ['4분의 1 아래', '절반 아래', '4분의 3 아래', '끝 앞', '끝까지'];
export const NEXT = { inside: '사이트 안 다른 쪽', outside: '바깥 링크', gone: '화면을 떠남' };
export const AGAIN = { reload: '새로 고침', back_forward: '뒤로·앞으로' };
export const TARGETS = ['문의 메일', '문의 메일 주소 복사', '문의 양식', '광고 의뢰', '광고 예시 보기', '앱 받기(Windows)', '앱 받기(Mac)', '웹 플랫폼 열기', 'WORLD 열기', '체험 열기', 'SNS 채널', '다른 바깥 링크'];

// AI 답변 → 검색 → SNS 차례로 본다(구글 도메인 아래의 AI 답변 서비스가 구글 검색으로 잡히지 않게).
const AI_HOSTS = [
  [/(^|\.)(chatgpt\.com|chat\.openai\.com)$/, 'ChatGPT'], [/(^|\.)perplexity\.ai$/, '퍼플렉시티'], [/^gemini\.google\.com$/, 'Gemini'],
  [/(^|\.)copilot\.microsoft\.com$/, 'Copilot'], [/(^|\.)claude\.ai$/, 'Claude'], [/(^|\.)grok\.com$/, '그록'],
];
const AI_TAGS = [[/^(chatgpt(\.com)?|chat\.openai\.com|openai)$/, 'ChatGPT'], [/^perplexity(\.ai)?$/, '퍼플렉시티'], [/^gemini(\.google\.com)?$/, 'Gemini'], [/^copilot(\.microsoft\.com)?$/, 'Copilot'], [/^claude(\.ai)?$/, 'Claude'], [/^grok(\.com)?$/, '그록']];
const SEARCH_HOSTS = [
  [/(^|\.)google\.[a-z.]+$/, '구글'], [/(^|\.)search\.naver\.com$/, '네이버'], [/(^|\.)bing\.com$/, '빙'], [/(^|\.)daum\.net$/, '다음'],
  [/(^|\.)(search\.yahoo\.[a-z.]+|duckduckgo\.com|baidu\.com|yandex\.[a-z.]+|ecosia\.org|search\.brave\.com)$/, '그 밖의 검색'],
];
const SOCIAL_HOSTS = [
  [/(^|\.)instagram\.com$/, 'instagram'], [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'], [/(^|\.)tiktok\.com$/, 'tiktok'], [/(^|\.)threads\.(net|com)$/, 'threads'],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com)$/, 'facebook'], [/(^|\.)(x\.com|twitter\.com|t\.co)$/, 'x'], [/(^|\.)(linkedin\.com|lnkd\.in)$/, 'linkedin'],
  [/(^|\.)(blog\.naver\.com|tistory\.com|brunch\.co\.kr|medium\.com)$/, 'blog'],
];
const TAGS = [[/^(ig|insta)/, 'instagram'], [/^(yt|youtube)/, 'youtube'], [/^(tt|tiktok)/, 'tiktok'], [/^(th|threads)/, 'threads'], [/^(fb|facebook)/, 'facebook'], [/^(x|twitter)(-|$)/, 'x'], [/^(li|linkedin)(-|$)/, 'linkedin'], [/^(blog|tistory|naver)/, 'blog']];
const SELF_TAGS = /^(self|qa)$/;
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pagespeed/i;
const INTERNAL = /^(www\.)?synk\.im$/; // 이 사이트의 쪽(링크의 목적지를 가를 때)
const SAME_SITE = /(^|\.)synk\.im$/; // 들어온 곳이 「SYNK 안」인가 — workspace.synk.im 같은 우리 서비스에서 돌아온 것도 새 방문이 아니다(홈 세기와 같다)

/** ?from= 꼬리표(영소문자 · 숫자 · 하이픈 40자). 아니면 빈 글. utm_source도 같은 규칙으로 받는다(home-ask.js와 같다). */
export function fromTag(href) {
  try {
    const q = new URL(href).searchParams;
    const v = String(q.get('from') || q.get('utm_source') || '').toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,39}$/.test(v) ? v : '';
  } catch { return ''; }
}

/** 들어온 곳 → { source, name }. referrer는 호스트 이름만 보고 버린다. utm_source가 AI 서비스 이름이면 AI 답변이다(AI 검색 답의 링크에는 그 서비스 이름의 utm_source가 붙는다). */
export function sourceOf(referrer, href) {
  let utm = '';
  try { utm = String(new URL(href).searchParams.get('utm_source') || '').toLowerCase(); } catch {}
  for (const [re, name] of AI_TAGS) if (utm && re.test(utm)) return { source: 'ai', name };
  const tag = fromTag(href);
  for (const [re, key] of TAGS) if (tag && re.test(tag)) return { source: key, name: '' };
  if (!referrer) return { source: 'direct', name: '' };
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { return { source: 'other', name: '' }; }
  if (SAME_SITE.test(host)) return { source: 'internal', name: '' };
  for (const [re, name] of AI_HOSTS) if (re.test(host)) return { source: 'ai', name };
  for (const [re, name] of SEARCH_HOSTS) if (re.test(host)) return { source: 'search', name };
  for (const [re, key] of SOCIAL_HOSTS) if (re.test(host)) return { source: key, name: '' };
  return { source: 'other', name: '' };
}

export const deviceOf = width => (width <= 700 ? 'phone' : 'wide');

/** 주소의 경로만, 정해 둔 글자만. 다른 꼴이면 「다른 쪽」 */
export function pageOf(href) {
  try {
    let p = new URL(href).pathname.toLowerCase().replace(/\/index\.html$/, '/');
    if (!p.endsWith('/') && !/\.[a-z0-9]+$/.test(p)) p += '/';
    return /^\/[a-z0-9/_.-]{0,79}$/.test(p) ? p : '다른 쪽';
  } catch { return '다른 쪽'; }
}

/** 보인 시간(ms) → 구간 이름 */
export function dwellOf(ms) {
  const s = ms / 1000;
  return DWELL[s < 10 ? 0 : s < 30 ? 1 : s < 60 ? 2 : s < 180 ? 3 : s < 600 ? 4 : 5];
}
/** 가장 깊이 내린 비율(0~1) → 구간 이름 */
export function depthOf(r) {
  return DEPTH[r >= 0.98 ? 4 : r >= 0.75 ? 3 : r >= 0.5 ? 2 : r >= 0.25 ? 1 : 0];
}

const SNS_HOSTS = /(^|\.)(instagram\.com|youtube\.com|youtu\.be|tiktok\.com|threads\.(net|com)|facebook\.com|x\.com|twitter\.com|linkedin\.com)$/;
/** 누른 것 → 뜻 이름. 사이트 안 다른 쪽으로 가는 링크는 null(다음 쪽의 들어옴이 보인다). 모르는 것도 null. */
export function targetOf(el, here) {
  if (!el || !el.getAttribute) return null;
  const named = el.getAttribute('data-measure');
  if (named) return TARGETS.includes(named) ? named : null;
  if (el.hasAttribute && el.hasAttribute('data-copy-email')) return '문의 메일 주소 복사';
  const href = el.getAttribute('href');
  if (!href) return null;
  let u;
  try { u = new URL(href, here); } catch { return null; }
  if (u.protocol === 'mailto:') return /@synk\.im$/i.test(decodeURIComponent(u.pathname)) ? '문의 메일' : '다른 바깥 링크';
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  const host = u.hostname.toLowerCase();
  if (host === 'docs.google.com' && u.pathname.startsWith('/forms/')) return '문의 양식';
  if (host === 'workspace.synk.im' && u.pathname.startsWith('/pulse-app/')) return u.searchParams.has('demo') && u.searchParams.get('start') !== 'request' ? '광고 예시 보기' : '광고 의뢰';
  if (host === 'github.com' && u.pathname.includes('/releases/download/')) return /\.dmg$/i.test(u.pathname) ? '앱 받기(Mac)' : /\.exe$/i.test(u.pathname) ? '앱 받기(Windows)' : '다른 바깥 링크';
  if (INTERNAL.test(host)) {
    if (u.pathname.startsWith('/account/')) return '웹 플랫폼 열기';
    if (u.pathname.startsWith('/world/')) return 'WORLD 열기';
    if (u.pathname.startsWith('/try/')) return '체험 열기';
    return null;
  }
  if (SNS_HOSTS.test(host)) return 'SNS 채널';
  return '다른 바깥 링크';
}

/** 누른 링크가 사이트 안으로 가는가 — 떠남 줄의 「다음」에 쓴다 */
function insideLink(el, here) {
  try { const u = new URL(el.getAttribute('href'), here); return INTERNAL.test(u.hostname.toLowerCase()) && (u.protocol === 'https:' || u.protocol === 'http:'); } catch { return false; }
}

/**
 * 쪽 안 이동인가 — href 원문에 #이 있고, 경로 · 질의가 지금 쪽과 같은 링크. # 없는 같은 주소 링크(로고, 지금 쪽 메뉴)는
 * 쪽을 다시 불러오므로 쪽 안 이동이 아니다. href="#"은 URL의 hash가 빈 글이라 원문으로 본다(화면 검수 11-17).
 */
function samePageLink(el, here) {
  try {
    const raw = el.getAttribute('href') || '';
    if (!raw.includes('#')) return false;
    const u = new URL(raw, here), h = new URL(here);
    return u.origin === h.origin && u.pathname === h.pathname && u.search === h.search;
  } catch { return false; }
}

/** 설문지에 보낼 값. 허용 목록 밖의 값이 있으면 null(보내지 않는다). 값은 JSON 한 줄로 「기록」 칸 하나에 담는다. */
export function payload(kind, ctx, extra = {}, form = FORM) {
  if (!KINDS[kind] || !LANGS[ctx.lang] || !SOURCES[ctx.source] || !DEVICES[ctx.device]) return null;
  if (ctx.first && !SOURCES[ctx.first]) return null;
  if (ctx.again && !Object.values(AGAIN).includes(ctx.again)) return null;
  const rec = { 판: VERSION, 기록: KINDS[kind], 쪽: ctx.page, '쪽 언어': LANGS[ctx.lang], '들어온 곳': SOURCES[ctx.source], 기기: DEVICES[ctx.device] };
  if (ctx.name) rec['들어온 곳 이름'] = ctx.name;
  if (ctx.first) rec['처음 들어온 곳'] = SOURCES[ctx.first];
  if (ctx.from) rec['꼬리표'] = ctx.from;
  if (kind === 'arrive' && ctx.again) rec['다시 연 쪽'] = ctx.again;
  if (kind === 'leave') {
    if (!DWELL.includes(extra.dwell) || !DEPTH.includes(extra.depth) || !Object.values(NEXT).includes(extra.next)) return null;
    Object.assign(rec, { '머문 시간': extra.dwell, '내려 본 곳': extra.depth, 다음: extra.next });
  }
  if (kind === 'click') {
    if (!TARGETS.includes(extra.target)) return null;
    rec['누른 것'] = extra.target;
  }
  const p = new URLSearchParams();
  p.set(form.record, JSON.stringify(rec));
  return p;
}

const OFF_KEY = 'synk.count.off';
const FIRST_KEY = 'synk.visit.first';
const SKIP_KEY = 'synk.visit.skip'; // ?from=self|qa로 연 탭 — 그 탭의 다음 쪽도 세지 않는다(화면 검수 11-17)

/** 이 방문을 세도 되는가(위 「세지 않는 때」, home-ask.js와 같다). ?nocount=1 · 0은 이 브라우저의 끄기 표시를 남기거나 지운다. */
export function counting(win, doc = {}) {
  try {
    const url = new URL(win.location.href);
    const off = url.searchParams.get('nocount');
    if (off === '1') win.localStorage.setItem(OFF_KEY, '1');
    else if (off === '0') win.localStorage.removeItem(OFF_KEY);
    if (url.hostname !== 'synk.im') return false;
    const nav = win.navigator || {};
    if (nav.webdriver || nav.globalPrivacyControl || BOTS.test(nav.userAgent || '')) return false;
    if (doc.prerendering) return false;
    // 점검 꼬리표로 연 탭은 표시 하나를 남겨, 같은 탭에서 사이트 안 링크로 넘어간 쪽도 세지 않는다(화면 검수 11-17)
    if (SELF_TAGS.test(fromTag(url.href))) { try { win.sessionStorage.setItem(SKIP_KEY, '1'); } catch {} return false; }
    try { if (win.sessionStorage.getItem(SKIP_KEY) === '1') return false; } catch {}
    return win.localStorage.getItem(OFF_KEY) !== '1';
  } catch { return false; }
}

/**
 * 세기를 만든다. 화면에 붙이는 것은 mount가 한다(시험은 이 함수를 가짜 창 · 시계로 부른다).
 * @returns { on, ctx, arrive(), leave(next), click(target), state() }
 */
export function createVisit({ win = globalThis.window, doc = globalThis.document, fetcher = (...a) => globalThis.fetch(...a), now = () => Date.now(), form = FORM } = {}) {
  const on = counting(win, doc);
  const src = sourceOf(doc.referrer, win.location.href);
  const html = doc.documentElement || {};
  const lang = html.lang === 'en' ? 'en' : html.lang === 'mn' ? 'mn' : 'ko';
  let first = '';
  // 세지 않는 방문(끈 브라우저, GPC, ?from=qa|self, 시험 주소)은 탭 저장소에 아무것도 남기지 않는다 — 점검 때 연 갈래가
  // 「처음 들어온 곳」으로 뒤의 방문에 실리지 않게(화면 검수 11-17)
  if (on) {
    try {
      first = win.sessionStorage.getItem(FIRST_KEY) || '';
      if (!SOURCES[first]) first = '';
      if (!first && src.source !== 'internal') { first = src.source; win.sessionStorage.setItem(FIRST_KEY, first); }
    } catch {}
  }
  let again = '';
  try {
    const entry = win.performance?.getEntriesByType?.('navigation')?.[0];
    // 탐색 목록이 비는 옛 브라우저는 옛 값(performance.navigation.type: 1 새로 고침, 2 뒤로·앞으로)을 본다(설계 검토 2차 P3-5)
    again = AGAIN[entry ? entry.type : ({ 1: 'reload', 2: 'back_forward' })[win.performance?.navigation?.type]] || '';
  } catch {}
  const ctx = { page: pageOf(win.location.href), lang, source: src.source, name: src.name, first, device: deviceOf(win.innerWidth), from: fromTag(win.location.href), again };
  let arrived = false, left = false;
  let visibleMs = 0, visibleSince = doc.visibilityState === 'visible' ? now() : null, maxDepth = 0;
  function post(body) {
    if (!body) return false;
    try { fetcher(form.action, { method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, body }).catch(() => {}); } catch {}
    return true;
  }
  function seen() { return visibleMs + (visibleSince == null ? 0 : now() - visibleSince); }
  const visit = {
    on, ctx,
    /** 보이는지가 바뀌었다 */
    visibility(state) {
      if (state === 'visible') { if (visibleSince == null) visibleSince = now(); }
      else if (visibleSince != null) { visibleMs += now() - visibleSince; visibleSince = null; }
    },
    /** 내린 비율을 알린다(0~1) */
    scrolled(r) { if (Number.isFinite(r)) maxDepth = Math.max(maxDepth, Math.min(1, Math.max(0, r))); },
    seen,
    arrive() {
      if (!on || arrived) return false;
      arrived = true;
      return post(payload('arrive', ctx, {}, form));
    },
    leave(next) {
      if (!on || !arrived || left) return false;
      left = true;
      return post(payload('leave', ctx, { dwell: dwellOf(seen()), depth: depthOf(maxDepth), next }, form));
    },
    click(target) {
      if (!on || !target) return false;
      if (!arrived) visit.arrive();
      return post(payload('click', ctx, { target }, form));
    },
    state: () => ({ arrived, left }),
  };
  return visit;
}

/** 화면에 붙인다 */
export function mount({ win = globalThis.window, doc = globalThis.document, visit = createVisit({ win, doc }), arriveAfterMs = 4000 } = {}) {
  if (!visit.on) return visit;
  let lastLink = null; // { inside, at }
  const depthNow = () => {
    const el = doc.documentElement, body = doc.body || {};
    const total = Math.max(el.scrollHeight || 0, body.scrollHeight || 0);
    return total > 0 ? ((win.scrollY || el.scrollTop || 0) + (win.innerHeight || 0)) / total : 0;
  };
  visit.scrolled(depthNow());
  let timer = null;
  const tryArrive = () => { if (doc.visibilityState === 'visible') visit.arrive(); };
  // 숨은 동안에는 타이머를 걸지 않는다 — 보이는 시간이 늘지 않아 다시 걸기만 되풀이했다. 다시 보이면 visibilitychange가 건다(화면 검수 11-17)
  const schedule = () => {
    clearTimeout(timer);
    if (visit.state().arrived || doc.visibilityState !== 'visible') return;
    const left = Math.max(0, arriveAfterMs - visit.seen());
    timer = setTimeout(() => { if (visit.seen() >= arriveAfterMs) tryArrive(); else schedule(); }, left + 50);
  };
  const onInteract = () => tryArrive();
  // 들어옴을 앞당기는 것은 사람의 입력뿐이다. scroll은 브라우저가 스스로도 낸다(# 주소로 열기, 새로 고침의 자리 되살리기) —
  // 그것으로 앞당기면 바로 떠난 방문도 세어진다. scroll로는 내려 본 정도만 적는다(화면 검수 11-17)
  for (const type of ['pointerdown', 'keydown', 'touchstart', 'wheel', 'touchmove']) doc.addEventListener(type, onInteract, { capture: true, passive: true });
  win.addEventListener('scroll', () => { visit.scrolled(depthNow()); }, { passive: true });
  const onClick = e => {
    if (e.type === 'auxclick' && e.button !== 1) return;
    const el = e.target && e.target.closest ? e.target.closest('a[href],[data-measure],[data-copy-email]') : null;
    if (!el) return;
    const target = targetOf(el, win.location.href);
    if (target) visit.click(target);
    // 같은 쪽 안의 # 링크는 쪽을 옮기지 않는다 — 「떠남」의 다음 쪽으로 삼지 않는다(화면 검수 11-17)
    if (el.getAttribute('href') && !samePageLink(el, win.location.href)) lastLink = { inside: insideLink(el, win.location.href) && !e.ctrlKey && !e.metaKey && !e.shiftKey && e.type !== 'auxclick', outside: !insideLink(el, win.location.href), at: Date.now() };
  };
  doc.addEventListener('click', onClick, { capture: true });
  doc.addEventListener('auxclick', onClick, { capture: true });
  const leave = () => {
    const recent = lastLink && Date.now() - lastLink.at < 3000 ? lastLink : null;
    visit.leave(recent?.inside ? NEXT.inside : recent?.outside ? NEXT.outside : NEXT.gone);
  };
  doc.addEventListener('visibilitychange', () => {
    visit.visibility(doc.visibilityState);
    if (doc.visibilityState === 'hidden') leave();
    else schedule();
  });
  win.addEventListener('pagehide', leave);
  schedule();
  return visit;
}

// 주소창 예측으로 미리 불러온 쪽은 사람이 실제로 열 때(prerenderingchange) 붙인다.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.prerendering) document.addEventListener('prerenderingchange', () => mount(), { once: true });
  else mount();
}
