const root=document.documentElement;
const homeTitle=document.title;
const entry=document.querySelector('[data-cosmic-entry]');
const portal=document.querySelector('[data-cosmic-atlas]');
const planet=document.querySelector('[data-cosmic-planet]');
const clamp=(value,min,max)=>Math.min(max,Math.max(min,value));
const setView=view=>{root.dataset.entryView=view;};
const isAtlasPath=()=>location.pathname.replace(/\/$/,'')==='/atlas';
let frame,ready=false,resolveReady;
const readyPromise=new Promise(resolve=>{resolveReady=resolve;});

function pauseAtlas(value){try{frame?.contentWindow?.atlasPreview?.setPreloadPaused(value);}catch{}}
function showAtlas(push=true){
  if(!ready)return false;
  if(push)history.pushState({synkAtlas:true},'',portal.href);
  root.dataset.cosmicAtlas='active';
  if(entry)entry.inert=true;
  frame.removeAttribute('aria-hidden');
  frame.inert=false;
  pauseAtlas(false);
  document.title='Atlas | SYNK';
  if(push){
    const heading=frame.contentDocument.querySelector('h1');
    if(heading){heading.tabIndex=-1;heading.style.outline='none';heading.focus({preventScroll:true});}
  }
  return true;
}
function hideAtlas(){
  root.dataset.cosmicAtlas='';
  if(entry)entry.inert=false;
  if(frame){frame.setAttribute('aria-hidden','true');frame.inert=true;}
  pauseAtlas(true);
  document.title=homeTitle;
}
function syncRoute(){
  if(isAtlasPath()&&ready){showAtlas(false);return;}
  hideAtlas();
  setView(location.hash?'company':'intro');
  if(!location.hash)prepareAtlas();
}
function showCompany(){
  history.pushState({},'','/#top');
  hideAtlas();
  setView('company');
  requestAnimationFrame(()=>document.getElementById('top')?.scrollIntoView());
}
function prepareAtlas(){
  if(!portal||!planet||frame||location.hash||isAtlasPath())return;
  try{sessionStorage.removeItem('synk-atlas-handoff');}catch{}
  frame=document.createElement('iframe');
  frame.className='cosmic-atlas-frame';
  frame.title='Atlas';
  frame.setAttribute('aria-hidden','true');
  frame.inert=true;
  frame.src=portal.href;
  frame.addEventListener('load',()=>{
    let child;
    try{child=frame.contentWindow;}catch{return;}
    child.document.querySelector('.synk-portal')?.addEventListener('click',event=>{
      if(event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showCompany();
    },true);
    const started=performance.now();
    const check=()=>{
      if(ready)return;
      try{
        const preview=child.atlasPreview;
        if(preview?.getSummary()?.frames>=1&&child.document.fonts.status==='loaded'){
          preview.setPreloadPaused(true);
          ready=true;
          resolveReady(true);
          return;
        }
      }catch{}
      if(performance.now()-started<12000)setTimeout(check,100);
    };
    check();
  },{once:true});
  document.body.append(frame);
}
function waitForAtlas(ms){
  if(ready)return Promise.resolve(true);
  return Promise.race([readyPromise,new Promise(resolve=>setTimeout(()=>resolve(false),ms))]);
}
addEventListener('hashchange',syncRoute);
addEventListener('popstate',syncRoute);
addEventListener('pageshow',syncRoute);
document.querySelector('[data-cosmic-company]')?.addEventListener('click',()=>setView('company'));
if(portal&&planet)requestAnimationFrame(()=>requestAnimationFrame(prepareAtlas));

// Match the Atlas canvas nucleus even when the viewport or fonts differ.
function atlasOrbTarget(){
  if(ready){
    try{
      const canvas=frame.contentDocument.getElementById('constellation');
      const rect=canvas.getBoundingClientRect();
      const summary=frame.contentWindow.atlasPreview.getSummary();
      if(rect.width&&summary?.cinematic?.nucleusRadius)
        return {x:rect.left+summary.width*.5,y:rect.top+summary.height*.493,radius:summary.cinematic.nucleusRadius};
    }catch{}
  }
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
function nativeHandoff(target){
  try{sessionStorage.setItem('synk-atlas-handoff',JSON.stringify({x:target.x-target.radius,y:target.y-target.radius,size:target.radius*2,time:Date.now()}));}catch{}
  location.assign(portal.href);
}
if(portal&&planet){
  let departing=false;
  portal.addEventListener('click',async event=>{
    if(departing||event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const mask='radial-gradient(circle,#000 59%,transparent 61%)';
    const animate=!matchMedia('(prefers-reduced-motion: reduce)').matches&&!matchMedia('(forced-colors: active)').matches&&(CSS.supports('mask-image',mask)||CSS.supports('-webkit-mask-image',mask));
    event.preventDefault();
    departing=true;
    if(!animate){
      if(!showAtlas())location.assign(portal.href);
      departing=false;
      return;
    }
    const rect=planet.getBoundingClientRect();
    const target=atlasOrbTarget();
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
    await new Promise(resolve=>setTimeout(resolve,1580));
    if(!await waitForAtlas(2500)){nativeHandoff(target);return;}
    showAtlas();
    overlay.classList.add('is-completing');
    setTimeout(()=>{overlay.remove();departing=false;},450);
  });
}
