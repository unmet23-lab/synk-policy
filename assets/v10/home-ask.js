// 홈 첫 화면 「어떤 일로 오셨어요?」 — 방문자가 고른 칸을 익명으로 센다(2026-10-30, 유호님 「방문자가 왜 왔는지 통계조사도」).
// 받는 곳: SYNK 운영 계정의 구글 폼 「synk.im 방문 목적(익명)」. 폼의 응답 탭 요약이 곧 통계다(질문마다 원그래프).
// 한 탭에서 한 번만 센다 — 처음 누른 칸(고름) 또는 고르지 않고 입구를 지나 내려간 것(지나침) 가운데 먼저 일어난 하나. 분모 = 고름 + 지나침.
//   (보기만 하고 떠난 것은 세지 않는다 — 사람이 보지 않는 미리 불러오기 · 검색 로봇과 가려낼 수 없어서다.)
// 보내는 것: 고름/지나침 · 고른 칸 · 쪽 언어(한국어 쪽/영어 쪽) · 들어온 곳(분류 이름만) · 기기(화면 넓이로 둘 중 하나) · 링크 꼬리표(?from=) · 판.
//   구글 폼이 받은 시각을 더한다. 이 목록은 처리방침 「홈페이지 방문 통계」 절과 같아야 한다.
// 보내지 않는 것: 이름 · 이메일 · 쿠키 · 기기 식별값 · 전체 주소 · referrer 원문 · 사람을 잇는 번호. 기기에는 이 탭의 「이미 셈」 표시 하나만 둔다(탭을 닫으면 사라진다).
// 세지 않는 때: synk.im이 아님(미리 보기) · 자동화 브라우저 · 로봇 · 전역 개인정보 신호(GPC) · 미리 불러오기 · ?from=self|qa · 이 브라우저에서 끔(?nocount=1, 되돌리기 ?nocount=0).
// 같은 방식의 선례: LAB TOPIK 4급 관심 등록 쪽(구글 폼 formResponse에 no-cors로 바로 보낸다 — 응답은 읽지 못한다).
// 폼의 질문 · 보기 글을 고치면 여기 FORM · 보기 글을 같이 고친다(보기 글이 한 글자라도 다르면 폼이 그 응답을 조용히 버린다). 폼에서 바꾸면 안 되는 것은 site-v10/README.md 「방문 목적 입구」.

// 폼 편집 주소 · 설정 · 바꾸면 안 되는 것은 site-v10/README.md 「방문 목적 입구」.
export const FORM = {
  action: 'https://docs.google.com/forms/d/e/1FAIpQLScYJEDpLqq6llPtHH-IaB40ZoLug0jVfroz_D2YcIm_yXT3Aw/formResponse',
  kind: 'entry.1058128059', pick: 'entry.1626241903', lang: 'entry.1872538132', source: 'entry.1015153301', device: 'entry.168759306', from: 'entry.654413425', version: 'entry.562044090',
};
export const VERSION = 'gate-v1';

// 폼 보기 글(한국어 — 통계를 읽는 사람은 유호님이다). 영어 쪽도 같은 글로 보낸다. 화면의 칸 이름을 다듬어도 이 글은 그대로 둔다.
export const KINDS = { pick: '칸을 고름', pass: '고르지 않고 내려감' };
export const PICKS = {
  lab: 'LAB · 한국어', shift: 'SHIFT · AI 강의·자동화', pulse: 'PULSE · 광고·영상', path: 'PATH · 유학·취업',
  app: '내 홈(회원)', other: '문의',
};
export const LANGS = { ko: '한국어 쪽', en: '영어 쪽' };
export const SOURCES = {
  direct: '직접', search: '검색', instagram: '인스타그램', youtube: '유튜브', tiktok: '틱톡', threads: '스레드',
  facebook: '페이스북', blog: '블로그', other: '다른 사이트', internal: 'SYNK 안',
};
export const DEVICES = { phone: '휴대폰', wide: '컴퓨터·태블릿' };

const HOSTS = [
  [/(^|\.)synk\.im$/, 'internal'],
  [/(^|\.)instagram\.com$/, 'instagram'],
  [/(^|\.)(youtube\.com|youtu\.be)$/, 'youtube'],
  [/(^|\.)tiktok\.com$/, 'tiktok'],
  [/(^|\.)threads\.(net|com)$/, 'threads'],
  [/(^|\.)(facebook\.com|fb\.me|fb\.com)$/, 'facebook'],
  [/(^|\.)(blog\.naver\.com|tistory\.com|brunch\.co\.kr|medium\.com)$/, 'blog'],
  [/(^|\.)(google\.[a-z.]+|bing\.com|search\.naver\.com|daum\.net|search\.yahoo\.[a-z.]+|duckduckgo\.com|baidu\.com|yandex\.[a-z.]+|ecosia\.org|search\.brave\.com)$/, 'search'],
];
// 꼬리표 이름 → 들어온 곳(링크에 ?from=ig-… 처럼 붙인 경우 referrer보다 앞선다 — 앱 안 브라우저는 referrer를 자주 비운다)
const TAGS = [[/^(ig|insta)/, 'instagram'], [/^(yt|youtube)/, 'youtube'], [/^(tt|tiktok)/, 'tiktok'], [/^(th|threads)/, 'threads'], [/^(fb|facebook)/, 'facebook'], [/^(blog|tistory|naver)/, 'blog']];
const SELF_TAGS = /^(self|qa)$/;
const BOTS = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pagespeed/i;

/** ?from= 꼬리표(lab-topik4와 같은 꼴: 영소문자 · 숫자 · 하이픈 40자). 아니면 빈 글. utm_source도 같은 규칙으로 받는다. 꼬리표는 캠페인 단위로만 쓴다(한 사람에게만 준 링크에 붙이지 않는다). */
export function fromTag(href) {
  try {
    const q = new URL(href).searchParams;
    const v = String(q.get('from') || q.get('utm_source') || '').toLowerCase();
    return /^[a-z0-9][a-z0-9-]{0,39}$/.test(v) ? v : '';
  } catch { return ''; }
}

/** 들어온 곳 분류. referrer는 호스트 이름만 보고 버린다. */
export function sourceOf(referrer, href) {
  const tag = fromTag(href);
  for (const [re, key] of TAGS) if (tag && re.test(tag)) return key;
  if (!referrer) return 'direct';
  let host = '';
  try { host = new URL(referrer).hostname.toLowerCase(); } catch { return 'other'; }
  for (const [re, key] of HOSTS) if (re.test(host)) return key;
  return 'other';
}

export const deviceOf = width => (width <= 700 ? 'phone' : 'wide');

/** 폼에 보낼 값. 허용 목록 밖의 값이면 null(보내지 않는다). */
export function payload(kind, pick, ctx, form = FORM) {
  if (!KINDS[kind] || (kind === 'pick') !== Boolean(PICKS[pick])) return null;
  if (!LANGS[ctx.lang] || !SOURCES[ctx.source] || !DEVICES[ctx.device]) return null;
  const p = new URLSearchParams();
  p.set(form.kind, KINDS[kind]);
  if (kind === 'pick') p.set(form.pick, PICKS[pick]);
  p.set(form.lang, LANGS[ctx.lang]);
  p.set(form.source, SOURCES[ctx.source]);
  p.set(form.device, DEVICES[ctx.device]);
  if (ctx.from) p.set(form.from, ctx.from);
  p.set(form.version, ctx.version || VERSION);
  return p;
}

const OFF_KEY = 'synk.count.off';
const DONE_KEY = 'synk.visit.counted';

/** 이 방문을 세도 되는가(위 「세지 않는 때」). ?nocount=1 · 0은 이 브라우저의 끄기 표시를 남기거나 지운다. */
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
    if (SELF_TAGS.test(fromTag(url.href))) return false;
    return win.localStorage.getItem(OFF_KEY) !== '1';
  } catch { return false; }
}

export function createCounter({ win = globalThis.window, doc = globalThis.document, fetcher = (...a) => globalThis.fetch(...a), form = FORM } = {}) {
  const on = counting(win, doc);
  const ctx = {
    lang: doc.documentElement.lang === 'en' ? 'en' : 'ko',
    source: sourceOf(doc.referrer, win.location.href),
    device: deviceOf(win.innerWidth),
    from: fromTag(win.location.href),
  };
  let done = false;
  try { done = win.sessionStorage.getItem(DONE_KEY) === '1'; } catch {}
  /** 고름 또는 지나침을 한 탭에 한 번만 보낸다. 보냈으면 true. */
  function send(kind, pick) {
    if (!on || done) return false;
    if (doc.visibilityState && doc.visibilityState !== 'visible') return false;
    const body = payload(kind, pick, ctx, form);
    if (!body) return false;
    done = true;
    try { win.sessionStorage.setItem(DONE_KEY, '1'); } catch {}
    try {
      fetcher(form.action, { method: 'POST', mode: 'no-cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, body }).catch(() => {});
    } catch {}
    return true;
  }
  return { send, ctx, on };
}

/** 화면에 붙인다: 칸을 누르면 고름, 입구를 본 뒤 고르지 않고 지나 내려가면 지나침.
 *  /#platform · /#contact처럼 입구 아래 구역 주소로 바로 들어온 방문은 입구를 보지 않았으니 지나침으로 세지 않는다
 *  (관찰을 붙이자마자 오는 첫 알림이 「입구가 이미 위로 벗어남」이다). */
export function mount({ win = globalThis.window, doc = globalThis.document, counter = createCounter({ win, doc }) } = {}) {
  const gate = doc.querySelector('[data-visit]');
  if (!gate || !counter.on) return counter;
  const onPick = e => { const a = e.target.closest?.('a[data-pick]'); if (a) counter.send('pick', a.dataset.pick); };
  gate.addEventListener('click', onPick);
  gate.addEventListener('auxclick', e => { if (e.button === 1) onPick(e); });
  if ('IntersectionObserver' in win) {
    let seen = false;
    new win.IntersectionObserver(entries => {
      for (const en of entries) {
        if (en.isIntersecting) seen = true;
        else if (seen && en.boundingClientRect.bottom < 0) counter.send('pass');
      }
    }).observe(gate);
  }
  return counter;
}

// 주소창 예측으로 미리 불러온 쪽은 사람이 실제로 열 때(prerenderingchange) 붙인다 — 미리 불러오는 동안 세지 않는 판정이 그대로 굳지 않게.
if (typeof document !== 'undefined' && typeof window !== 'undefined') {
  if (document.prerendering) document.addEventListener('prerenderingchange', () => mount(), { once: true });
  else mount();
}
