// One policy for reviewed answer links. Local destinations are verified by QA;
// external destinations remain explicit so public data cannot create open redirects.
// 화면을 만들지 않는 판정만 둔다 — v10 site.js(빌드가 묶음)와 src/public-actions.js가 이 모듈을 그대로 import한다.
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

export function isPublicActionHref(href) {
  if (typeof href !== 'string' || !href || /[\s\\\u0000-\u001f\u007f]/u.test(href)) return false;
  if (externalLinks.has(href)) return true;
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(href)) return true;
  // Exactly one leading slash, plain path segments and an optional named anchor.
  // Percent escapes, credentials, query redirects and dot segments are excluded.
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]*(?:#[A-Za-z][A-Za-z0-9_-]*)?$/.test(href)) return false;
  return !href.split(/[\/#]/).some(segment => segment === '.' || segment === '..');
}
