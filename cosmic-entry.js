const root=document.documentElement;
const homeTitle=document.title;
const companyPath=(location.pathname.startsWith('/en/')?'/en/':'/')+'#top';
const entry=document.querySelector('[data-cosmic-entry]');
const portal=document.querySelector('[data-cosmic-atlas]');
const companyPortal=document.querySelector('[data-cosmic-company]');
const startPortal=document.querySelector('[data-cosmic-start]');
const atlasStatus=document.querySelector('[data-atlas-entry-status]');
const english=location.pathname.startsWith('/en/');
const say=(ko,en)=>english?en:ko;
const setAtlasStatus=text=>{if(atlasStatus)atlasStatus.textContent=text;};
const preferenceKey='synk-entry-start-v1';
const preferences=Array.from(document.querySelectorAll?.('[data-entry-preference]')||[]);
const preferenceStatuses=Array.from(document.querySelectorAll?.('[data-entry-preference-status]')||[]);
const readPreference=()=>{try{return localStorage.getItem(preferenceKey)==='1';}catch{return false;}};
const updatePreferences=()=>{const checked=readPreference();for(const input of preferences)input.checked=checked;};
for(const input of preferences){
  input.closest('[data-entry-preference-wrap]').hidden=false;
  input.addEventListener('change',()=>{
    let message;
    try{
      if(input.checked)localStorage.setItem(preferenceKey,'1');else localStorage.removeItem(preferenceKey);
      message=input.checked?say('다음 방문에는 체험 목록이 바로 열립니다.','Your next visit will open the free programs.') :say('다음 방문에는 첫 화면이 열립니다.','Your next visit will open the entrance.');
    }catch{message=say('시작 화면 설정을 저장하지 못했어요. 바로 시작은 계속 이용할 수 있습니다.','Could not save this setting. You can still use Start now.');}
    updatePreferences();
    for(const status of preferenceStatuses)status.textContent=message;
  });
}
updatePreferences();
addEventListener('storage',event=>{if(event.key===preferenceKey||event.key===null)updatePreferences();});
const ieung=document.querySelector('[data-cosmic-ieung]');
const IEUNG_DURATION=1100;
if(portal)portal.href='/atlas/';
if(companyPortal)companyPortal.href=companyPath;
if(startPortal)startPortal.href=companyPath.replace(/#.*$/,'')+'#products';
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
  setAtlasStatus('');
  portal?.removeAttribute('aria-busy');
  updatePreferences();
  document.querySelector('.cosmic-transition')?.remove();
  if(isAtlasPath()&&ready){showAtlas(false);return;}
  hideAtlas();
  setView(location.hash?'company':'intro');
  // The view switched in this task, so the section can be scrolled to at once.
  if(location.hash)sectionOf(location.hash)?.scrollIntoView();
}
// The element a company address names (#top, #contact, ...), if the page has it.
function sectionOf(hash){
  let id='';
  try{id=decodeURIComponent(hash.slice(1));}catch{}
  return id?document.getElementById(id):null;
}
function showCompany(hash='#top'){
  routeRevision++;
  activeTravel?.();
  setAtlasStatus('');
  portal?.removeAttribute('aria-busy');
  history.pushState({},'',companyPath.replace(/#.*$/,'')+hash);
  hideAtlas();
  setView('company');
  requestAnimationFrame(()=>{
    const target=sectionOf(hash)||document.getElementById('top');
    target?.scrollIntoView();
    const main=document.getElementById('top');
    const focusTarget=target===main?main:target?.querySelector('h2,h3')||main;
    if(focusTarget){focusTarget.tabIndex=-1;focusTarget.focus?.({preventScroll:true});}
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
    const companyBase=companyPath.replace(/#.*$/,'');
    child.document.querySelectorAll('a[href^="/#"],a[href="/"]').forEach(link=>{link.href=companyBase+link.getAttribute('href').slice(1);});
    child.document.addEventListener('click',event=>{
      const link=event.target.closest?.('a[href]');
      if(!link||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
      const url=new URL(link.href,location.href);
      if(url.origin!==location.origin||url.pathname!==companyBase||!url.hash)return;
      event.preventDefault();
      event.stopImmediatePropagation();
      showCompany(url.hash);
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
    const scaleX=state.rx/target.radius,scaleY=state.ry/target.radius;
    frame.style.transform=`translate(${state.x-target.x}px,${state.y-target.y}px) scale(${scaleX},${scaleY})`;
    // Atlas is never clipped, so the browser paints all of it; the white paper above it has a window where
    // the sphere shows, and the window opens over the page at the end. (A growing clip on the frame left a
    // band the browser had not painted yet, seen as a black crescent for a frame.)
    const opening=`radial-gradient(${radius*scaleX}px ${radius*scaleY}px at ${state.x}px ${state.y}px,#0000 calc(100% - .5px),#000 100%)`;
    backdrop.style.webkitMaskImage=opening;
    backdrop.style.maskImage=opening;
    frame.style.opacity=String(state.orbOpacity);
    entry.style.transform=`scale(${state.sceneScale})`;
    entry.style.opacity=String(state.sceneOpacity);
    // Once the ㅇ has faded it is no longer drawn, so the last part of the change repaints less.
    if(state.ringOpacity>.005){path.setAttribute('d',ieungOutline(state));ring.style.opacity=String(state.ringOpacity);}
    else if(ring.style.visibility!=='hidden')ring.style.visibility='hidden';
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
startPortal?.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
  event.preventDefault();
  showCompany('#products');
});
// Atlas is loaded when a visitor reaches for it (a pointer over the link, a touch or keyboard focus),
// not with the entrance: a visit that goes to the company never downloads it.
if(portal&&entry)for(const type of ['pointerenter','pointerdown','focus','touchstart'])portal.addEventListener(type,()=>{if(!location.hash)prepareAtlas();},{passive:true});

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
    setAtlasStatus(say('아틀라스를 여는 중입니다…','Opening Atlas…'));
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
    prepareAtlas();
    if(!ready)portal.setAttribute('aria-busy','true');
    const available=await waitForAtlas(2500);
    portal.removeAttribute('aria-busy');
    if(routeRevision!==originRevision||location.pathname+(location.search||'')+location.hash!==originRoute){departing=false;return;}
    if(!available){setAtlasStatus(say('준비가 조금 길어져 아틀라스로 바로 이동합니다.','Taking a little longer. Opening Atlas directly.'));location.assign(portal.href);return;}
    const target=departure?atlasTarget():null;
    if(target)await travelFromIeung(overlay,target,departure);
    if(routeRevision!==originRevision||location.pathname+(location.search||'')+location.hash!==originRoute){overlay.remove();departing=false;return;}
    showAtlas();
    setAtlasStatus('');
    overlay.remove();
    departing=false;
  });
}
