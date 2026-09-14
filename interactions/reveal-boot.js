// Tiny, parser-time enhancement. No JS or a failed module always leaves a readable page.
(() => {
  const root = document.documentElement;
  const preference = matchMedia('(prefers-reduced-motion: reduce)');
  if (preference.matches || (location.hash && location.hash !== '#top') ||
      performance.getEntriesByType('navigation')[0]?.type === 'back_forward') return;
  let timer;
  const events = ['keydown', 'pointerdown', 'wheel', 'touchstart', 'pagehide'];
  const finish = () => {
    clearTimeout(timer);
    root.classList.remove('entry-pending');
    for (const type of events) window.removeEventListener(type, finish, true);
    preference.removeEventListener('change', finish);
    window.dispatchEvent(new Event('synk:entry-finish'));
    window.synkEntry = null;
  };
  window.synkEntry = {finish};
  root.classList.add('entry-pending');
  for (const type of events) window.addEventListener(type, finish, {capture:true, passive:true});
  preference.addEventListener('change', finish);
  timer = setTimeout(finish, 1800);
})();
