// Shared DOM adapter: the two hosts use the same explicit correction actions.
// Values and claims always come from the rendered Core report, never a URL.
export function bindMemberUnderstandingEditor(root, { controller, getReport } = {}) {
  const report = () => getReport?.()?.understanding;
  function draft(form) {
    if (!form) return;
    const input = form.querySelector('[data-insight-field="note"]');
    const note = [...(input?.value || '')].slice(0, 200).join('');
    if (input && input.value !== note) input.value = note;
    controller.updateDraft({ note,
      values: [...form.querySelectorAll('[name="insight-choice"]:checked')].map(input => input.value) });
  }
  const onInput = event => { const form = event.target.closest?.('[data-insight-editor]'); if (form && root.contains(form)) draft(form); };
  const onSubmit = event => {
    if (!event.target.matches?.('[data-insight-editor]')) return;
    event.preventDefault(); event.stopPropagation(); draft(event.target); void controller.save();
  };
  const onClick = event => {
    const button = event.target.closest?.('[data-insight-action]');
    if (!button || !root.contains(button) || button.disabled) return;
    const action = button.dataset.insightAction;
    if (!action?.startsWith('understanding-')) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const current = report(), facet = current?.facets?.find(row => row.id === button.dataset.insightFacet);
    if (action === 'understanding-review' && facet?.available && facet.claim) {
      controller.begin({ facetId: facet.id, mode: 'review', verdict: button.dataset.insightVerdict, claim: facet.claim, values: facet.selected || [], facet });
    } else if (action === 'understanding-edit' && facet?.choices?.length) {
      controller.begin({ facetId: facet.id, mode: 'override', values: facet.selected || [], facet });
    } else if (action === 'understanding-save') {
      draft(button.closest('[data-insight-editor]')); void controller.save();
    } else if (action === 'understanding-cancel') controller.cancel();
    else if (action === 'understanding-remove') {
      const row = current?.history?.find(item => item.id === button.dataset.insightId && item.kind === button.dataset.insightKind);
      if (row) void controller.remove({ kind: row.kind, id: row.id, facetId: row.facetId });
    } else if (action === 'understanding-clear') void controller.clear();
  };
  root.addEventListener('click', onClick, true);
  root.addEventListener('input', onInput);
  root.addEventListener('change', onInput);
  root.addEventListener('submit', onSubmit);
  return () => { root.removeEventListener('click', onClick, true); root.removeEventListener('input', onInput); root.removeEventListener('change', onInput); root.removeEventListener('submit', onSubmit); };
}

export function captureMemberUnderstandingFocus(container) {
  const active = container.ownerDocument.activeElement;
  if (!active || !container.contains(active)) return () => {};
  const attributes = ['id', 'data-insight-action', 'data-insight-facet', 'data-insight-verdict', 'data-insight-kind', 'data-insight-id', 'data-insight-target', 'data-insight-field', 'name', 'value'];
  const keys = attributes.map(key => [key, active.getAttribute(key)]).filter(([, value]) => value !== null);
  const start = active.selectionStart, end = active.selectionEnd;
  return () => {
    if (!keys.length) return;
    const next = [...container.querySelectorAll('a,button,input,select,textarea')].find(node => keys.every(([key, value]) => node.getAttribute(key) === value));
    next?.focus({ preventScroll: true });
    if (typeof start === 'number' && typeof next?.setSelectionRange === 'function') { try { next.setSelectionRange(start, end); } catch {} }
  };
}
