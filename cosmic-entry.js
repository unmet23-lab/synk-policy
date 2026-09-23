const setView=view=>{document.documentElement.dataset.entryView=view;};
addEventListener('hashchange',()=>setView(location.hash?'company':'intro'));
addEventListener('pageshow',()=>setView(location.hash?'company':'intro'));
document.querySelector('[data-cosmic-company]')?.addEventListener('click',()=>setView('company'));

const portal=document.querySelector('[data-cosmic-atlas]');
const planet=document.querySelector('[data-cosmic-planet]');
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));

// Match the constellation canvas layout and nucleus radius in atlas-landing.html.
// The arrival page measures the real canvas again to correct any font or viewport difference.
function atlasOrbTarget(){
  const probe=document.createElement('div');
  probe.style.cssText='position:absolute;width:100px;height:100px;overflow:scroll;visibility:hidden';
  planet.parentElement.append(probe);
  const width=innerWidth-(probe.offsetWidth-probe.clientWidth);
  probe.remove();
  const height=innerHeight;
  if(width<=760){
    const stageHeight=width<=370?390:440;
    const radius=width<520?clamp(width*.125,39,50):clamp(Math.min(width,stageHeight)*.132,68,92);
    return {x:width*.5,y:width<=370?527.262:560.115,radius};
  }
  const short=height<=820,wide=width>=1700,tablet=width<=1100;
  const padding=width*(wide?.055:tablet?.034:.044);
  const contentWidth=width-padding*2;
  const left=short?.28:wide?.25:tablet?.29:.26;
  const right=short?-.05:wide?-.04:tablet?-.07:-.05;
  const top=short?-5:tablet?10:-21;
  const bottom=short?30:wide?25:tablet?65:44;
  const workspaceHeight=short?Math.max(505,height-226):wide?Math.max(760,height-274):clamp(height-251,660,1000);
  const stageWidth=contentWidth*(1-left-right);
  const stageHeight=workspaceHeight-top-bottom;
  const radius=stageWidth<520?clamp(stageWidth*.125,39,50):clamp(Math.min(stageWidth,stageHeight)*.132,68,92);
  return {x:padding+contentWidth*(left+(1-left-right)*.5),y:(short?79:103)+top+stageHeight*.493,radius};
}
if(portal&&planet){
  let departing=false;
  portal.addEventListener('click',event=>{
    const mask='radial-gradient(circle,#000 59%,transparent 61%)';
    if(departing||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey||matchMedia('(prefers-reduced-motion: reduce)').matches||matchMedia('(forced-colors: active)').matches||!(CSS.supports('mask-image',mask)||CSS.supports('-webkit-mask-image',mask)))return;
    event.preventDefault();
    departing=true;
    const rect=planet.getBoundingClientRect();
    const target=atlasOrbTarget();
    // The source image's circular silhouette occupies about 83.5% of its box.
    const size=target.radius*2/.835;
    const overlay=document.createElement('div');
    overlay.className='cosmic-transition';
    overlay.setAttribute('aria-hidden','true');
    overlay.style.setProperty('--planet-left',`${rect.left}px`);
    overlay.style.setProperty('--planet-top',`${rect.top}px`);
    overlay.style.setProperty('--planet-size',`${rect.width}px`);
    overlay.style.setProperty('--planet-dx',`${target.x-size/2-rect.left}px`);
    overlay.style.setProperty('--planet-dy',`${target.y-size/2-rect.top}px`);
    overlay.style.setProperty('--planet-scale',`${size/rect.width}`);
    overlay.style.setProperty('--planet-image-transform',getComputedStyle(planet.querySelector('img')).transform);
    overlay.innerHTML='<div class="cosmic-transition-sphere"><div class="cosmic-transition-orb"></div><div class="cosmic-transition-planet"><img src="/assets/cosmic-planet-20260923.webp" alt=""></div></div>';
    document.body.append(overlay);
    requestAnimationFrame(()=>requestAnimationFrame(()=>overlay.classList.add('is-traveling')));
    setTimeout(()=>{
      try{sessionStorage.setItem('synk-atlas-handoff',JSON.stringify({x:target.x-target.radius,y:target.y-target.radius,size:target.radius*2,time:Date.now()}));}catch{}
      location.assign(portal.href);
    },1580);
  });
}
