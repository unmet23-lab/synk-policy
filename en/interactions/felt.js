// A small, input-driven response on the supplied bitmap; no 3D model or idle loop.
// Markup: <button type="button" data-felt aria-label="… 살짝 누르기">
//           <img data-felt-surface ...>
//         </button>. Keep the figure's caption outside the button.
let activeCleanup;

export function initFeltInteractions({gsap: _gsap, reducedMotion = false} = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  activeCleanup?.();
  const controls = [...document.querySelectorAll('button[data-felt]')]
    .map(button => ({button, surface: button.querySelector('[data-felt-surface]')}))
    .filter(({surface}) => surface);
  if (!controls.length) return () => {};

  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const coarsePointer = window.matchMedia('(pointer: coarse)');
  const cleanups = [];
  const attrs = ['data-felt-ready', 'data-felt-state', 'data-felt-input', 'data-felt-motion', 'data-felt-active', 'type'];
  const properties = ['--felt-rx', '--felt-ry', '--felt-sx', '--felt-sy'];
  let disposed = false;

  const listen = (target, name, handler, options) => {
    target.addEventListener(name, handler, options);
    cleanups.push(() => target.removeEventListener(name, handler, options));
  };
  const requestedReduction = () => typeof reducedMotion === 'function'
    ? !!reducedMotion()
    : typeof reducedMotion === 'object' && reducedMotion !== null
      ? !!reducedMotion.matches
      : !!reducedMotion;
  const mayMove = state => !disposed && state.visible && !document.hidden &&
    !requestedReduction() && !motionPreference.matches && finePointer.matches && !coarsePointer.matches;
  const setPose = (state, rx = 0, ry = 0, sx = 1, sy = 1) => {
    state.surface.style.setProperty('--felt-rx', `${rx.toFixed(2)}deg`);
    state.surface.style.setProperty('--felt-ry', `${ry.toFixed(2)}deg`);
    state.surface.style.setProperty('--felt-sx', String(sx));
    state.surface.style.setProperty('--felt-sy', String(sy));
  };
  const clearTimer = (state, key) => {
    window.clearTimeout(state[key]);
    state[key] = 0;
  };
  const cancelFrame = state => {
    if (state.frame) window.cancelAnimationFrame(state.frame);
    state.frame = 0;
  };
  const rest = (state, immediate = false) => {
    clearTimer(state, 'restTimer');
    clearTimer(state, 'settleTimer');
    cancelFrame(state);
    state.pressed = false;
    state.rect = null;
    state.button.dataset.feltMotion = immediate || !mayMove(state) ? 'off' : 'on';
    setPose(state);
    if (state.button.dataset.feltState !== 'confirmed') state.button.dataset.feltState = 'idle';
    if (immediate) state.button.removeAttribute('data-felt-active');
    else state.settleTimer = window.setTimeout(() => state.button.removeAttribute('data-felt-active'), 220);
  };
  const stop = state => {
    clearTimer(state, 'feedbackTimer');
    state.button.dataset.feltState = 'idle';
    state.feedback.textContent = '';
    rest(state, true);
  };

  const states = controls.map(({button, surface}) => {
    const originals = new Map(attrs.map(name => [name, button.getAttribute(name)]));
    const originalStyles = properties.map(name => [name, surface.style.getPropertyValue(name), surface.style.getPropertyPriority(name)]);
    const feedback = document.createElement('span');
    feedback.className = 'felt-interaction-feedback';
    feedback.setAttribute('role', 'status');
    feedback.setAttribute('aria-live', 'polite');
    feedback.setAttribute('aria-atomic', 'true');
    // A sibling live region does not change the button's accessible name.
    button.insertAdjacentElement('afterend', feedback);
    const rect = button.getBoundingClientRect();
    const state = {button, surface, feedback, visible: rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth,
      pressed: false, rect: null, x: 0, y: 0, frame: 0, restTimer: 0, settleTimer: 0, feedbackTimer: 0};
    button.type = 'button';
    button.dataset.feltReady = 'true';
    button.dataset.feltState = 'idle';
    button.dataset.feltMotion = mayMove(state) ? 'on' : 'off';
    setPose(state);

    const move = event => {
      if (event.pointerType !== 'mouse' || !mayMove(state) || button.disabled) return;
      state.rect ||= button.getBoundingClientRect();
      if (!state.rect.width || !state.rect.height) return;
      state.x = Math.max(-1, Math.min(1, (event.clientX - state.rect.left) / state.rect.width * 2 - 1));
      state.y = Math.max(-1, Math.min(1, (event.clientY - state.rect.top) / state.rect.height * 2 - 1));
      button.dataset.feltInput = 'mouse';
      button.dataset.feltMotion = 'on';
      button.dataset.feltActive = 'true';
      clearTimer(state, 'settleTimer');
      clearTimer(state, 'restTimer');
      // One frame per batch of pointer events, never a self-scheduling RAF loop.
      if (!state.frame) state.frame = window.requestAnimationFrame(() => {
        state.frame = 0;
        if (!mayMove(state)) return rest(state, true);
        setPose(state, -state.y * 1.4, state.x * 2, state.pressed ? 0.998 : 1, state.pressed ? 0.99 : 1);
      });
      if (!state.pressed) state.restTimer = window.setTimeout(() => rest(state), 520);
    };
    listen(button, 'pointerenter', event => { state.rect = null; move(event); }, {passive: true});
    listen(button, 'pointermove', move, {passive: true});
    listen(button, 'pointerleave', () => rest(state), {passive: true});
    listen(button, 'pointerdown', event => {
      if (event.button !== 0 || button.disabled || !state.visible || document.hidden) return;
      clearTimer(state, 'restTimer');
      state.pressed = true;
      button.dataset.feltInput = event.pointerType === 'mouse' ? 'mouse' : 'touch';
      button.dataset.feltState = 'pressed';
      const moving = event.pointerType === 'mouse' && mayMove(state);
      button.dataset.feltMotion = moving ? 'on' : 'off';
      if (moving) {
        button.dataset.feltActive = 'true';
        setPose(state, -state.y * 1.4, state.x * 2, 0.998, 0.99);
      } else setPose(state);
    }, {passive: true});
    listen(button, 'keydown', event => {
      if (!['Enter', ' '].includes(event.key) || event.repeat || button.disabled) return;
      rest(state, true);
      button.dataset.feltInput = 'keyboard';
      button.dataset.feltState = 'pressed';
      // Native button activation handles Enter and Space; no synthetic double click.
    });
    listen(button, 'keyup', event => {
      if (['Enter', ' '].includes(event.key) && button.dataset.feltState === 'pressed') button.dataset.feltState = 'idle';
    });
    listen(button, 'click', event => {
      if (button.disabled || !state.visible || document.hidden) return;
      if (event.detail === 0) button.dataset.feltInput = 'keyboard';
      rest(state, button.dataset.feltInput !== 'mouse');
      clearTimer(state, 'feedbackTimer');
      button.dataset.feltState = 'confirmed';
      feedback.textContent = "You gently pressed the felt.";
      button.dispatchEvent(new CustomEvent('felt:press', {bubbles: true, detail: {source: button.dataset.feltInput || 'keyboard'}}));
      state.feedbackTimer = window.setTimeout(() => {
        button.dataset.feltState = 'idle';
        feedback.textContent = '';
      }, 900);
    });
    listen(button, 'blur', () => stop(state));
    cleanups.push(() => {
      stop(state);
      feedback.remove();
      for (const [name, value] of originals) value === null ? button.removeAttribute(name) : button.setAttribute(name, value);
      for (const [name, value, priority] of originalStyles) value ? surface.style.setProperty(name, value, priority) : surface.style.removeProperty(name);
    });
    return state;
  });

  const refresh = () => states.forEach(state => {
    stop(state);
    state.button.dataset.feltMotion = mayMove(state) ? 'on' : 'off';
  });
  for (const media of [motionPreference, finePointer, coarsePointer]) listen(media, 'change', refresh);
  if (typeof reducedMotion === 'object' && reducedMotion?.addEventListener && reducedMotion !== motionPreference) listen(reducedMotion, 'change', refresh);
  listen(document, 'visibilitychange', refresh);
  listen(window, 'blur', () => states.forEach(stop));
  listen(window, 'pagehide', () => states.forEach(stop));
  listen(window, 'pointerup', () => states.forEach(state => { if (state.pressed) rest(state); }), {passive: true});
  listen(window, 'pointercancel', () => states.forEach(stop), {passive: true});
  listen(window, 'resize', refresh, {passive: true});
  listen(window, 'scroll', () => states.forEach(state => { if (state.rect || state.frame || state.pressed) rest(state, true); }), {passive: true});

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        const state = states.find(item => item.button === entry.target);
        state.visible = entry.isIntersecting;
        if (!state.visible) stop(state);
        else state.button.dataset.feltMotion = mayMove(state) ? 'on' : 'off';
      }
    });
    states.forEach(state => observer.observe(state.button));
    cleanups.push(() => observer.disconnect());
  } else {
    const measureVisibility = () => states.forEach(state => {
      const rect = state.button.getBoundingClientRect();
      state.visible = rect.bottom > 0 && rect.top < window.innerHeight && rect.right > 0 && rect.left < window.innerWidth;
      if (!state.visible) stop(state);
    });
    listen(window, 'scroll', measureVisibility, {passive: true});
    listen(window, 'resize', measureVisibility, {passive: true});
  }

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    cleanups.reverse().forEach(dispose => dispose());
    if (activeCleanup === cleanup) activeCleanup = undefined;
  };
  activeCleanup = cleanup;
  return cleanup;
}
