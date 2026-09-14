// A quiet, opt-in material response. No requests, recordings or user text are used.
const PREFERENCE_KEY = 'synk.ui-sound';
const MIN_INTERVAL_MS = 160;
const ACTIONS = [
  'a.primary-link', 'a.quiet-link', 'a.work-card', 'a.line-link',
  'button.primary', 'button.line-link', 'button[data-action="write"]',
].join(',');
let activeCleanup;

// Deterministic, non-tonal, band-limited noise; also exported for offline audition.
// The buffer includes its envelope and quiet gain, so it cannot start with a click.
export function createTactileSamples(sampleRate = 48000) {
  if (!Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000) {
    throw new RangeError('A sample rate between 8000 and 192000 Hz is required.');
  }
  const samples = new Float32Array(Math.round(sampleRate * .105));
  const softAlpha = 1 - Math.exp(-2 * Math.PI * 1050 / sampleRate);
  const grainAlpha = 1 - Math.exp(-2 * Math.PI * 3400 / sampleRate);
  const floorAlpha = 1 - Math.exp(-2 * Math.PI * 85 / sampleRate);
  let seed = 0x53594e4b, soft = 0, grain = 0, floor = 0, peak = 0;
  for (let i = 0; i < samples.length; i++) {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    const noise = (seed >>> 0) / 0xffffffff * 2 - 1;
    soft += softAlpha * (noise - soft);
    grain += grainAlpha * (noise - grain);
    floor += floorAlpha * (soft - floor);
    const t = i / sampleRate;
    const attack = Math.sin(Math.min(1, t / .009) * Math.PI / 2) ** 2;
    const release = Math.min(1, (samples.length - 1 - i) / (sampleRate * .018)) ** 2;
    const envelope = attack * Math.exp(-t / .031) * release;
    samples[i] = ((soft - floor) * .88 + (grain - soft) * .12) * envelope;
    peak = Math.max(peak, Math.abs(samples[i]));
  }
  // At most -20 dBFS peak; no oscillator, bright digital tick or long tail.
  const gain = peak ? .1 / peak : 0;
  for (let i = 0; i < samples.length; i++) samples[i] *= gain;
  return samples;
}

export function initSonicUI() {
  if (typeof window === 'undefined' || typeof document === 'undefined' || !document.body) return () => {};
  activeCleanup?.();
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  const cleanups = [], sources = new Set();
  let enabled = false, disposed = false, pagePaused = false;
  let context, buffer, generation = 0, lastPlayed = -Infinity, lastStarted = -Infinity;
  try { enabled = localStorage.getItem(PREFERENCE_KEY) === 'on'; } catch { /* Preference storage is optional. */ }
  if (!AudioEngine) enabled = false;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sonic-toggle';
  button.setAttribute('aria-label', '효과음');
  const label = document.createElement('span');
  label.className = 'sonic-toggle__label';
  label.textContent = '효과음';
  label.setAttribute('aria-hidden', 'true');
  const status = document.createElement('span');
  status.className = 'sonic-toggle__state';
  status.setAttribute('aria-hidden', 'true');
  button.append(label, status);
  document.body.append(button);

  const paint = () => {
    button.setAttribute('aria-pressed', String(enabled));
    status.textContent = !AudioEngine ? '소리 사용 불가' : enabled ? '소리 켬' : '소리 끔';
    button.disabled = !AudioEngine;
    button.title = !AudioEngine ? '이 브라우저에서는 효과음을 사용할 수 없습니다.' : enabled ? '효과음 끄기' : '효과음 켜기';
  };
  const remember = () => {
    try { localStorage.setItem(PREFERENCE_KEY, enabled ? 'on' : 'off'); } catch { /* Continue without storage. */ }
  };
  const listen = (target, event, handler, options) => {
    target.addEventListener(event, handler, options);
    cleanups.push(() => target.removeEventListener(event, handler, options));
  };
  const stop = () => {
    for (const source of sources) {
      try { source.stop(); } catch { /* A short source may already have ended. */ }
      source.disconnect();
    }
    sources.clear();
  };
  const suspend = () => {
    generation++;
    stop();
    if (context && context.state !== 'closed') context.suspend().catch(() => {});
  };
  const turnOff = () => {
    enabled = false;
    remember();
    paint();
    suspend();
  };
  const play = async () => {
    if (!enabled || disposed || pagePaused || document.hidden) return;
    const now = performance.now();
    if (now - lastPlayed < MIN_INTERVAL_MS) return;
    lastPlayed = now;
    const request = generation;
    try {
      // This function is called only from a trusted click, including keyboard activation.
      if (!context || context.state === 'closed') {
        context = new AudioEngine();
        const samples = createTactileSamples(context.sampleRate);
        buffer = context.createBuffer(1, samples.length, context.sampleRate);
        buffer.copyToChannel(samples, 0);
      }
      if (context.state !== 'running') await context.resume();
      if (request !== generation || !enabled || disposed || pagePaused || document.hidden) return;
      if (context.state !== 'running') throw new Error('Audio is unavailable.');
      // Two requests awaiting a slow resume must not become simultaneous sounds.
      const startTime = performance.now();
      if (startTime - lastStarted < MIN_INTERVAL_MS) return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      sources.add(source);
      source.onended = () => { sources.delete(source); source.disconnect(); };
      source.start();
      lastStarted = startTime;
    } catch {
      if (!disposed && request === generation) turnOff();
    }
  };

  listen(button, 'click', event => {
    if (!event.isTrusted || button.disabled) return;
    if (enabled) return turnOff();
    generation++;
    enabled = true;
    remember();
    paint();
    // One small response confirms the visitor's explicit choice to enable sound.
    void play();
  });
  // Capture before the letter experience replaces its clicked element. Never intercept
  // navigation or form submission, and never respond to a synthetic download click.
  listen(document, 'click', event => {
    if (!event.isTrusted || !enabled || event.defaultPrevented || event.button !== 0 ||
        event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = event.target?.closest?.(ACTIONS);
    if (!target || target === button || target.disabled || target.getAttribute('aria-disabled') === 'true' ||
        target.closest('[inert]') || target.hasAttribute('download') ||
        ['download', 'restart', 'story', 'toggle-hints', 'more-hint'].includes(target.dataset.action)) return;
    if (target.matches('a') && !target.getAttribute('href')) return;
    void play();
  }, {capture: true, passive: true});
  listen(window, 'pagehide', () => { pagePaused = true; suspend(); });
  listen(window, 'pageshow', () => { pagePaused = false; });
  listen(document, 'visibilitychange', () => { if (document.hidden) suspend(); });
  paint();

  const cleanup = () => {
    if (disposed) return;
    disposed = true;
    generation++;
    cleanups.reverse().forEach(remove => remove());
    stop();
    if (context && context.state !== 'closed') context.close().catch(() => {});
    button.remove();
    if (activeCleanup === cleanup) activeCleanup = undefined;
  };
  activeCleanup = cleanup;
  return cleanup;
}
