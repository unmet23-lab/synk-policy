const root=document.documentElement;
const homeTitle=document.title;
const companyPath=(location.pathname.startsWith('/en/')?'/en/':'/')+'#top';
const entry=document.querySelector('[data-cosmic-entry]');
const portal=document.querySelector('[data-cosmic-atlas]');
const companyPortal=document.querySelector('[data-cosmic-company]');
const ieung=document.querySelector('[data-cosmic-ieung]');
const IEUNG_DURATION=1100;
if(portal)portal.href='/atlas/';
if(companyPortal)companyPortal.href=companyPath;
const setView=view=>{root.dataset.entryView=view;if(view==='company')document.dispatchEvent(new Event('synk:company-view'));};
const isAtlasPath=()=>location.pathname.replace(/\/$/,'')==='/atlas';
let frame,ready=false,resolveReady,routeRevision=0,activeTravel=null;
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
  routeRevision++;
  activeTravel?.();
  document.querySelector('.cosmic-transition')?.remove();
  if(isAtlasPath()&&ready){showAtlas(false);return;}
  hideAtlas();
  setView(location.hash?'company':'intro');
  if(!location.hash)prepareAtlas();
}
function showCompany(){
  routeRevision++;
  activeTravel?.();
  history.pushState({},'',companyPath);
  hideAtlas();
  setView('company');
  requestAnimationFrame(()=>{
    const top=document.getElementById('top');
    top?.scrollIntoView();
    top?.focus({preventScroll:true});
  });
}
function prepareAtlas(){
  if(!portal||!entry||frame||location.hash||isAtlasPath())return;
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
    const companyLink=child.document.querySelector('.synk-portal');
    if(companyLink)companyLink.href=companyPath;
    companyLink?.addEventListener('click',event=>{
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
function atlasTarget(){
  const canvas=frame?.contentDocument?.getElementById('constellation');
  const rect=canvas?.getBoundingClientRect();
  const summary=frame?.contentWindow?.atlasPreview?.getSummary();
  const center=summary?.cinematic?.nucleusCenter;
  if(!rect?.width||!summary?.width||!center||!summary.cinematic.nucleusRadius)return null;
  const ratio=rect.width/summary.width;
  const target={x:rect.left+center.x*ratio,y:rect.top+center.y*ratio,radius:summary.cinematic.nucleusRadius*ratio};
  return Object.values(target).every(Number.isFinite)&&target.radius>0?target:null;
}

function ieungDeparture(){
  const rect=ieung?.getBoundingClientRect();
  if(!rect||![rect.left,rect.top,rect.width,rect.height].every(Number.isFinite)||rect.width<=0||rect.height<=0||rect.bottom<=0||rect.top>=innerHeight)return null;
  // These ratios describe the existing letter's inner counter, not a new ring asset.
  return {x:rect.left+rect.width/2,y:rect.top+rect.height/2,rx:rect.width*67/248,ry:rect.height*20/130,outerRx:rect.width/2,outerRy:rect.height/2,ink:getComputedStyle(ieung).fill};
}

function sampleIeungTransition(departure,target,progress){
  const smooth=value=>{const t=Math.min(1,Math.max(0,value));return t*t*(3-2*t);};
  const move=smooth(progress/.72);
  const travel=smooth((progress-.22)/.5);
  const mix=(a,b)=>a+(b-a)*move;
  return {
    x:departure.x+(target.x-departure.x)*travel,y:departure.y+(target.y-departure.y)*travel,
    rx:mix(departure.rx,target.radius),ry:mix(departure.ry,target.radius),
    outerRx:mix(departure.outerRx,target.radius+2),outerRy:mix(departure.outerRy,target.radius+2),
    round:move,sceneScale:1+.22*smooth(progress/.4),sceneOpacity:1-smooth((progress-.06)/.34),
    ringOpacity:1-smooth((progress-.35)/.38),orbOpacity:smooth(progress/.24),reveal:smooth((progress-.72)/.28)
  };
}

function ieungOutline(state){
  const {x,y,rx,ry,outerRx,outerRy,round}=state;
  const curve=(a,b,cx,cy)=>`M${x} ${y-b}C${x-a*cx} ${y-b} ${x-a} ${y-b*cy} ${x-a} ${y}C${x-a} ${y+b*cy} ${x-a*cx} ${y+b} ${x} ${y+b}C${x+a*cx} ${y+b} ${x+a} ${y+b*cy} ${x+a} ${y}C${x+a} ${y-b*cy} ${x+a*cx} ${y-b} ${x} ${y-b}Z`;
  const control=initial=>initial+(.55228475-initial)*round;
  return curve(outerRx,outerRy,control(76/124),control(41/65))+curve(rx,ry,control(42/67),control(12/20));
}

function travelFromIeung(overlay,target,departure){
  const backdrop=document.createElement('div');
  backdrop.className='cosmic-transition-backdrop';
  const ring=document.createElementNS('http://www.w3.org/2000/svg','svg');
  ring.setAttribute('class','cosmic-transition-ieung');
  ring.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);
  const path=document.createElementNS('http://www.w3.org/2000/svg','path');
  path.setAttribute('fill-rule','evenodd');
  path.setAttribute('fill',departure.ink);
  ring.append(path);
  overlay.append(backdrop,ring);
  document.body.append(overlay);
  const previousStyle=frame.getAttribute('style');
  const entryStyle=entry.getAttribute('style');
  const cover=Math.hypot(Math.max(target.x,innerWidth-target.x),Math.max(target.y,innerHeight-target.y))+4;
  frame.classList.add('is-matching-ieung');
  entry.classList.add('is-ieung-departing');
  root.dataset.cosmicTransition='ieung';
  frame.style.transformOrigin=`${target.x}px ${target.y}px`;
  entry.style.transformOrigin=`${departure.x}px ${departure.y+scrollY}px`;
  const render=progress=>{
    const state=sampleIeungTransition(departure,target,progress);
    const radius=target.radius+1+(cover-target.radius-1)*state.reveal;
    frame.style.transform=`translate(${state.x-target.x}px,${state.y-target.y}px) scale(${state.rx/target.radius},${state.ry/target.radius})`;
    frame.style.clipPath=`circle(${radius}px at ${target.x}px ${target.y}px)`;
    frame.style.opacity=String(state.orbOpacity);
    entry.style.transform=`scale(${state.sceneScale})`;
    entry.style.opacity=String(state.sceneOpacity);
    path.setAttribute('d',ieungOutline(state));
    ring.style.opacity=String(state.ringOpacity);
  };
  render(0);
  return new Promise(resolve=>{
    let raf=0,start=null,settled=false;
    const finish=()=>{
      if(settled)return;
      settled=true;
      cancelAnimationFrame(raf);
      removeEventListener('resize',finish);
      document.removeEventListener('visibilitychange',onVisibility);
      frame.classList.remove('is-matching-ieung');
      entry.classList.remove('is-ieung-departing');
      delete root.dataset.cosmicTransition;
      if(previousStyle===null)frame.removeAttribute('style');else frame.setAttribute('style',previousStyle);
      if(entryStyle===null)entry.removeAttribute('style');else entry.setAttribute('style',entryStyle);
      overlay.remove();
      activeTravel=null;
      resolve();
    };
    const onVisibility=()=>{if(document.hidden)finish();};
    const tick=now=>{
      if(start===null)start=now;
      const progress=Math.min(1,(now-start)/IEUNG_DURATION);
      render(progress);
      if(progress===1)finish();else raf=requestAnimationFrame(tick);
    };
    activeTravel=finish;
    addEventListener('resize',finish,{once:true});
    document.addEventListener('visibilitychange',onVisibility);
    raf=requestAnimationFrame(tick);
  });
}
addEventListener('hashchange',syncRoute);
addEventListener('popstate',syncRoute);
addEventListener('pageshow',syncRoute);
companyPortal?.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  showCompany();
});
if(portal&&entry)requestAnimationFrame(()=>requestAnimationFrame(prepareAtlas));

if(portal&&entry){
  let departing=false;
  portal.addEventListener('click',async event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    if(departing||root.dataset.cosmicAtlas==='active')return;
    entry.dispatchEvent?.(new Event('synk:entry-depart'));
    const animate=!matchMedia('(prefers-reduced-motion: reduce)').matches&&!matchMedia('(forced-colors: active)').matches;
    // The sky clock stops synchronously before this snapshot is measured.
    const departure=animate?ieungDeparture():null;
    departing=true;
    if(!animate){
      if(!showAtlas())location.assign(portal.href);
      departing=false;
      return;
    }
    const originRoute=location.pathname+(location.search||'')+location.hash;
    const originRevision=routeRevision;
    const overlay=document.createElement('div');
    overlay.className='cosmic-transition';
    overlay.setAttribute('aria-hidden','true');
    const available=await waitForAtlas(2500);
    if(routeRevision!==originRevision||location.pathname+(location.search||'')+location.hash!==originRoute){departing=false;return;}
    if(!available){location.assign(portal.href);return;}
    const target=departure?atlasTarget():null;
    if(target)await travelFromIeung(overlay,target,departure);
    if(routeRevision!==originRevision||location.pathname+(location.search||'')+location.hash!==originRoute){overlay.remove();departing=false;return;}
    showAtlas();
    overlay.remove();
    departing=false;
  });
}
