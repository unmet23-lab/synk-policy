const setView=view=>{document.documentElement.dataset.entryView=view;};
addEventListener('hashchange',()=>setView(location.hash?'company':'intro'));
addEventListener('pageshow',()=>setView(location.hash?'company':'intro'));
document.querySelector('[data-cosmic-company]')?.addEventListener('click',()=>setView('company'));

const portal=document.querySelector('[data-cosmic-atlas]');
const planet=document.querySelector('[data-cosmic-planet]');
if(portal&&planet){
  let departing=false;
  portal.addEventListener('click',event=>{
    const mask='radial-gradient(circle,#000 59%,transparent 61%)';
    if(departing||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||matchMedia('(prefers-reduced-motion: reduce)').matches||!(CSS.supports('mask-image',mask)||CSS.supports('-webkit-mask-image',mask)))return;
    event.preventDefault();
    departing=true;
    const rect=planet.getBoundingClientRect();
    const size=Math.min(300,innerWidth*.29,innerHeight*.36);
    const centerX=innerWidth*.47,centerY=innerHeight*.51;
    const overlay=document.createElement('div');
    overlay.className='cosmic-transition';
    overlay.setAttribute('aria-hidden','true');
    overlay.style.setProperty('--planet-left',`${rect.left}px`);
    overlay.style.setProperty('--planet-top',`${rect.top}px`);
    overlay.style.setProperty('--planet-size',`${rect.width}px`);
    overlay.style.setProperty('--planet-dx',`${centerX-size/2-rect.left}px`);
    overlay.style.setProperty('--planet-dy',`${centerY-size/2-rect.top}px`);
    overlay.style.setProperty('--planet-scale',`${size/rect.width}`);
    overlay.innerHTML='<div class="cosmic-transition-orb"></div><div class="cosmic-transition-planet"></div>';
    document.body.append(overlay);
    requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add('is-traveling')));
    setTimeout(()=>location.assign(portal.href),1180);
  });
}
