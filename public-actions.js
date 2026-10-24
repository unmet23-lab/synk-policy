// 답 링크 판정은 src/public-link-policy.js 하나다. 여기는 그 판정을 지난 링크로 답 버튼을 만든다.
import {isPublicActionHref} from './public-link-policy.js?v=be75ce60dc88';

export {isPublicActionHref};

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
