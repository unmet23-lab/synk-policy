// One policy for reviewed answer links. Local destinations are verified by QA;
// external destinations remain explicit so public data cannot create open redirects.
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

export function isPublicActionHref(href) {
  if (typeof href !== 'string' || !href || /[\s\\\u0000-\u001f\u007f]/u.test(href)) return false;
  if (externalLinks.has(href)) return true;
  if (/^#[A-Za-z][A-Za-z0-9_-]*$/.test(href)) return true;
  // Exactly one leading slash, plain path segments and an optional named anchor.
  // Percent escapes, credentials, query redirects and dot segments are excluded.
  if (!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]*(?:#[A-Za-z][A-Za-z0-9_-]*)?$/.test(href)) return false;
  return !href.split(/[\/#]/).some(segment => segment === '.' || segment === '..');
}

export function appendPublicActions(parent, records) {
  const document = parent.ownerDocument;
  const container = document.createElement('div');
  container.className = 'answer-actions';
  const used = new Set();
  for (const record of records) {
    for (const action of record.actions || (record.action ? [record.action] : [])) {
      if (!action || used.has(action.href) || !isPublicActionHref(action.href) ||
          typeof action.label !== 'string' || !action.label.trim()) continue;
      used.add(action.href);
      const link = document.createElement('a');
      link.className = 'answer-action';
      link.href = action.href;
      link.textContent = action.label + ' ↗';
      container.append(link);
    }
  }
  if (container.childNodes.length) parent.append(container);
  return container;
}
