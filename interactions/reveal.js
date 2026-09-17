// One owner for the first entrance; scroll effects never animate the same hero text.
export async function initInitialReveal(gsap) {
  const entry = window.synkEntry;
  if (!entry || !gsap) return;
  const targets = [...document.querySelectorAll('[data-enter]')];
  const image = document.querySelector('.companions-scene');
  let waitTimer;
  await Promise.race([
    Promise.allSettled([document.fonts?.ready, image?.decode()]),
    new Promise(resolve => { waitTimer = setTimeout(resolve, 650); })
  ]);
  clearTimeout(waitTimer);
  if (window.synkEntry !== entry) return;
  if (scrollY > 40 || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    entry.finish(); return;
  }
  let timeline;
  const restore = () => {
    timeline?.kill();
    gsap.set(targets, {clearProps:'opacity,--entry-y'});
    window.removeEventListener('synk:entry-finish', restore);
  };
  window.addEventListener('synk:entry-finish', restore);
  try {
    gsap.set(targets, {opacity:0, '--entry-y':'12px'});
    document.documentElement.classList.remove('entry-pending');
    timeline = gsap.timeline({defaults:{duration:.52, ease:'power2.out'}, onComplete:entry.finish});
    const reveal = (name, at, stagger=0) => {
      const group=targets.filter(target=>target.dataset.enter===name);
      if(group.length)timeline.to(group,{opacity:1,'--entry-y':'0px',stagger},at);
    };
    reveal('brand', 0);
    reveal('navigation', .1);
    reveal('copy', .3, .09);
    reveal('image', .46);
    reveal('actions', .6);
  } catch {
    entry.finish();
  }
}
