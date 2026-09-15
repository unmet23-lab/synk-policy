/**
 * LAB's progressive enhancements.
 * - The curriculum is fully readable without this module.
 * - Every example panel is initially visible. Only a complete tab controller hides panels.
 * - All changing states are illustrative, never student data or learning scores.
 * - GSAP is optional and only draws the explanatory path for pointer actions.
 */
const activeInstances = new WeakMap();

const exampleStates = [
  { original: '보존', correction: '대기', next: '미정' },
  { original: '보존', correction: '도착', next: '선택 전' },
  { original: '보존', correction: '확인', next: '예정' },
];

function motionIsReduced(preference) {
  if (typeof preference === 'function') return Boolean(preference());
  if (preference && typeof preference === 'object' && 'matches' in preference) return preference.matches;
  return Boolean(preference) || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function snapshotAttributes(element, names) {
  const values = names.map(name => [name, element.getAttribute(name)]);
  return () => values.forEach(([name, value]) => {
    if (value === null) element.removeAttribute(name);
    else element.setAttribute(name, value);
  });
}

export function initLearningInteractions({ gsap, reducedMotion = false, initialIndex = 0 } = {}) {
  const root = document.querySelector('#lab.lab-bento');
  if (!root) return () => {};
  activeInstances.get(root)?.();

  const cleanups = [];
  let currentTween = null;
  let panelAnimation = null;
  let layoutFrame = 0;
  let disposed = false;
  const listen = (element, event, listener) => {
    element.addEventListener(event, listener);
    cleanups.push(() => element.removeEventListener(event, listener));
  };
  const notifyLayout = () => {
    cancelAnimationFrame(layoutFrame);
    layoutFrame = requestAnimationFrame(() => {
      if (!disposed) document.dispatchEvent(new CustomEvent('synk:layout'));
    });
  };

  const demo = root.querySelector('[data-learning-demo]');
  const tablist = demo?.querySelector('[data-learning-tabs]');
  const tabs = tablist ? [...tablist.querySelectorAll('[data-learning-tab]')] : [];
  const panels = tabs.map(tab => root.querySelector(`#${tab.getAttribute('aria-controls')}`));
  const validPanels = panels.length === 3 && panels.every(Boolean) && new Set(panels).size === 3;

  if (demo && tablist && tabs.length === 3 && validPanels) {
    const line = demo.querySelector('[data-learning-line]');
    const summary = demo.querySelector('[data-learning-summary]');
    const nodes = [...demo.querySelectorAll('[data-learning-node]')];
    const statuses = [...demo.querySelectorAll('[data-learning-status]')];
    let selectedIndex = -1;
    cleanups.push(snapshotAttributes(tablist, ['role', 'hidden']));
    cleanups.push(snapshotAttributes(demo, ['data-learning-enhanced']));
    if (summary) cleanups.push(snapshotAttributes(summary, ['hidden']));
    tabs.forEach(tab => cleanups.push(snapshotAttributes(tab, ['role', 'tabindex', 'aria-selected'])));
    panels.forEach(panel => cleanups.push(snapshotAttributes(panel, ['role', 'tabindex', 'aria-labelledby', 'hidden'])));
    nodes.forEach(node => cleanups.push(snapshotAttributes(node, ['class'])));
    if (line) cleanups.push(snapshotAttributes(line, ['style']));
    statuses.forEach(status => {
      const originalText = status.textContent;
      cleanups.push(() => { status.textContent = originalText; });
    });

    function drawConnection(index, animate) {
      if (!line) return;
      currentTween?.kill();
      currentTween = null;
      const end = 1 - index / (tabs.length - 1);
      // No tween on keyboard activation or when motion is reduced. A failed animation
      // never prevents the selected panel or its state label from being shown.
      if (animate && !motionIsReduced(reducedMotion) && gsap?.to) {
        try {
          currentTween = gsap.to(line, { strokeDashoffset: end, duration: .24, ease: 'power2.out', overwrite: true });
        } catch {
          line.style.strokeDashoffset = String(end);
        }
      } else line.style.strokeDashoffset = String(end);
    }

    function select(index, { focus = false, animate = false } = {}) {
      if (index < 0 || index >= tabs.length) return;
      if (selectedIndex === index) {
        if (focus) tabs[index].focus({ preventScroll: true });
        return;
      }
      selectedIndex = index;
      panelAnimation?.cancel();
      panelAnimation = null;
      tabs.forEach((tab, position) => {
        const selected = position === index;
        tab.setAttribute('aria-selected', String(selected));
        tab.tabIndex = selected ? 0 : -1;
        panels[position].hidden = !selected;
      });
      nodes.forEach((node, position) => {
        node.classList.toggle('is-current', position === index);
        node.classList.toggle('is-complete', position < index);
      });
      statuses.forEach(status => {
        const value = exampleStates[index][status.dataset.learningStatus];
        if (value) status.textContent = value;
      });
      drawConnection(index, animate);
      if (animate && !motionIsReduced(reducedMotion) && panels[index].animate) {
        // The whole example is available immediately. No fake typing or AI progress.
        try { panelAnimation = panels[index].animate(
          [{opacity:.55,transform:'translateY(5px)'},{opacity:1,transform:'translateY(0)'}],
          {duration:180,easing:'cubic-bezier(.2,0,0,1)'}
        ); } catch { /* Static selection is already complete. */ }
      }
      if (focus) tabs[index].focus({ preventScroll: true });
      notifyLayout();
    }

    tabs.forEach((tab, index) => {
      listen(tab, 'click', event => select(index, { animate: event.detail > 0 }));
      listen(tab, 'keydown', event => {
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
        else if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = tabs.length - 1;
        else return;
        event.preventDefault();
        select(next, { focus: true });
      });
    });

    // Enhance only after the entire set has been verified and listeners are attached.
    tablist.setAttribute('role', 'tablist');
    tabs.forEach((tab, index) => {
      tab.setAttribute('role', 'tab');
      panels[index].setAttribute('role', 'tabpanel');
      panels[index].setAttribute('aria-labelledby', tab.id);
      panels[index].tabIndex = 0;
    });
    demo.dataset.learningEnhanced = '';
    // The owner preserves selection across a reduced-motion remount; focus restoration
    // stays with that owner so initializing this module never steals focus.
    const startIndex = Number.isFinite(initialIndex)
      ? Math.max(0, Math.min(tabs.length - 1, Math.trunc(initialIndex)))
      : 0;
    select(startIndex);
    tablist.hidden = false;
    if (summary) summary.hidden = false;
  }

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(layoutFrame);
    currentTween?.kill();
    panelAnimation?.cancel();
    for (const restore of cleanups.reverse()) restore();
    activeInstances.delete(root);
  };
  activeInstances.set(root, cleanup);
  return cleanup;
}
