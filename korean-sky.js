export const SKY_DURATION=25000;

const frames=[
  {at:0,sunset:0,night:0,moon:0,x:.8,y:0,phase:'day'},
  {at:SKY_DURATION*.28,sunset:1,night:0,moon:0,x:0,y:1,phase:'sunset'},
  {at:SKY_DURATION*.5,sunset:1,night:1,moon:1,x:.45,y:.3,phase:'night'},
  {at:SKY_DURATION*19/30,sunset:1,night:1,moon:1,x:.85,y:0,phase:'night'},
  {at:SKY_DURATION*.8,sunset:1,night:0,moon:0,x:1,y:.85,phase:'dawn'},
  {at:SKY_DURATION,sunset:0,night:0,moon:0,x:.8,y:0,phase:'day'}
];

export function sampleSkyState(elapsedMs){
  const time=((elapsedMs%SKY_DURATION)+SKY_DURATION)%SKY_DURATION;
  const next=frames.findIndex(frame=>frame.at>time);
  const a=frames[next-1],b=frames[next];
  const progress=(time-a.at)/(b.at-a.at);
  const ease=progress*progress*(3-2*progress);
  const state={phase:time<SKY_DURATION/6?'day':time<SKY_DURATION*.4?'sunset':time<SKY_DURATION*.7?'night':'dawn'};
  for(const key of ['sunset','night','moon','x','y'])state[key]=a[key]+(b[key]-a[key])*ease;
  return state;
}

function initSky(){
  const entry=document.querySelector('[data-cosmic-entry]');
  const portal=entry?.querySelector('.cosmic-atlas-link');
  if(!entry||!portal)return;
  const root=document.documentElement;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const forced=matchMedia('(forced-colors: active)');
  let elapsed=0,last=0,raf=0,ready=false,hovered=false,focused=false,departing=false;

  const render=()=>{
    const state=sampleSkyState(elapsed);
    entry.style.setProperty('--sky-sunset',state.sunset.toFixed(4));
    entry.style.setProperty('--sky-night',state.night.toFixed(4));
    entry.dataset.skyPhase=state.phase;
    entry.dataset.skyTime=String(Math.round(elapsed%SKY_DURATION));
  };
  const blocked=()=>!ready||hovered||focused||departing||document.hidden||reduced.matches||forced.matches||entry.hasAttribute('data-korean-arrival')||root.dataset.entryView!=='intro'||root.dataset.cosmicAtlas==='active';
  const tick=now=>{
    raf=0;
    if(blocked()){last=0;return;}
    if(last)elapsed+=Math.min(now-last,100);
    last=now;
    render();
    raf=requestAnimationFrame(tick);
  };
  const sync=()=>{
    if(blocked()){
      cancelAnimationFrame(raf);raf=0;last=0;
    }else if(!raf)raf=requestAnimationFrame(tick);
  };
  const syncPreference=()=>{
    if(reduced.matches||forced.matches){elapsed=0;render();}
    sync();
  };
  portal.addEventListener('pointerenter',event=>{if(event.pointerType!=='touch'){hovered=true;sync();}});
  portal.addEventListener('pointerleave',()=>{hovered=false;sync();});
  portal.addEventListener('focus',()=>{focused=true;sync();});
  portal.addEventListener('blur',()=>{focused=false;sync();});
  entry.addEventListener('synk:entry-depart',()=>{departing=true;sync();});
  for(const event of ['popstate','hashchange','pageshow'])window.addEventListener(event,()=>{departing=false;sync();});
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',syncPreference);
  forced.addEventListener('change',syncPreference);
  new MutationObserver(sync).observe(root,{attributes:true,attributeFilter:['data-entry-view','data-cosmic-atlas']});
  new MutationObserver(sync).observe(entry,{attributes:true,attributeFilter:['data-korean-arrival']});

  // Keep one stable daylight scene until every crossfade image can be displayed.
  const images=[...entry.querySelectorAll('.korean-architecture img')];
  Promise.all(images.map(image=>image.decode())).then(()=>{
    ready=true;entry.dataset.skyReady='';syncPreference();
  }).catch(()=>{});
  render();
}

if(typeof document!=='undefined')initSky();
