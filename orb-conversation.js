// A still sphere of ink printed with grains of light, the same material as the Atlas map.
// The light rests at the upper left and turns toward the pointer while it moves over the sphere.
// Nothing moves on its own; no microphone, remote renderer or recorded input.
// Its two inks come from CSS (color = the dark grains, caret-color = the lit ones), so on a colour
// field it is printed in a deep tone of that colour.
const GRID=64;let grainJob=null;
function random(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
// The grain order and the sphere's shape take about 40 ms on a fast laptop and four times that on a slow phone.
// They are worked out in slices of a few milliseconds while the page is idle, so no task is long and scrolling
// never waits for them; the sphere is the same, pixel for pixel (2026-10-01, qa/perf-20261001).
const whenIdle=window.requestIdleCallback?callback=>requestIdleCallback(callback,{timeout:1000}):callback=>setTimeout(()=>callback(null),16);
function inSlices(steps){
 return new Promise(resolve=>{
  const run=deadline=>{
   const stop=performance.now()+(deadline&&!deadline.didTimeout?Math.min(8,deadline.timeRemaining()):8);
   for(;;){const next=steps.next();if(next.done){resolve(next.value);return;}if(performance.now()>=stop)break;}
   whenIdle(run);
  };
  whenIdle(run);
 });
}
// An even order for the grains: each next grain goes to the emptiest place (same seed as the Atlas map).
function* grainSteps(){
 const count=GRID*GRID,rnd=random(862104),crowd=new Float32Array(count),taken=new Uint8Array(count);
 const reach=9,span=reach*2+1,near=new Float32Array(span*span);
 for(let y=-reach;y<=reach;y++)for(let x=-reach;x<=reach;x++)near[(y+reach)*span+x+reach]=Math.exp(-(x*x+y*y)/7.22);
 for(let i=0;i<count;i++)crowd[i]=rnd()*1e-4;
 const rowLeast=new Float32Array(GRID),rowPlace=new Int32Array(GRID);
 const recount=row=>{let place=-1,least=Infinity;for(let i=row*GRID,end=i+GRID;i<end;i++)if(!taken[i]&&crowd[i]<least){least=crowd[i];place=i;}rowLeast[row]=least;rowPlace[row]=place;};
 for(let row=0;row<GRID;row++)recount(row);
 const order=new Float32Array(count);
 for(let step=0;step<count;step++){
  let py=0;for(let row=1;row<GRID;row++)if(rowLeast[row]<rowLeast[py])py=row;
  const place=rowPlace[py],px=place%GRID;taken[place]=1;order[place]=(step+.5)/count;
  for(let y=-reach;y<=reach;y++){const row=(py+y+GRID)%GRID,line=(y+reach)*span+reach;for(let x=-reach;x<=reach;x++)crowd[row*GRID+(px+x+GRID)%GRID]+=near[line+x];recount(row);}
  if(step%128===127)yield;
 }
 return order;
}
function grainOrder(){return grainJob??=inSlices(grainSteps());}
const LIGHT={angle:-Math.PI*2*.108,lift:.56,fall:2.4,gain:.9,floor:.02,rim:.06};
const FALL=new Float32Array(1025);for(let i=0;i<=1024;i++)FALL[i]=Math.pow(i/1024,LIGHT.fall)*LIGHT.gain;
// Any CSS colour to [r,g,b,a] through a one-pixel canvas.
let probe=null;
function rgba(value,fallback){
 probe??=Object.assign(document.createElement('canvas'),{width:1,height:1}).getContext('2d',{willReadFrequently:true});
 probe.clearRect(0,0,1,1);probe.fillStyle=fallback;probe.fillStyle=value||fallback;probe.fillRect(0,0,1,1);
 return Array.from(probe.getImageData(0,0,1,1).data);
}
function mountOrb(button){
 const canvas=button.querySelector('canvas'),surface=button.querySelector('.orb-surface');
 const ctx=canvas?.getContext('2d');if(!ctx||!surface)return;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),fine=matchMedia('(hover: hover) and (pointer: fine)');
 let angle=LIGHT.angle,lift=LIGHT.lift,frame=0,drawn='',shape=null,preparing='';
 // Everything that depends only on the size is worked out once: where each device pixel sits on the
 // sphere, how much of it the edge covers, and the grain it is compared with.
 function* measureSteps(size,dpr,grain){
  const cell=Math.max(1,Math.round(dpr*.62)),radius=size/2-dpr,middle=size/2,outer=(1+1.5/radius)**2;
  const index=[],cx=[],cy=[],cz=[],rim=[],threshold=[],cover=[];
  for(let py=0;py<size;py++){
   const y=(py+.5-middle)/radius,gy=Math.floor(py/cell),sy=((gy+.5)*cell-middle)/radius,row=(gy%GRID)*GRID;
   for(let px=0;px<size;px++){
    const x=(px+.5-middle)/radius,reach=x*x+y*y;if(reach>outer)continue;
    const edge=Math.round(Math.min(1,Math.max(0,(1-Math.sqrt(reach))*radius+.5))*255);if(!edge)continue;
    const gx=Math.floor(px/cell),sx=((gx+.5)*cell-middle)/radius,z=Math.sqrt(Math.max(0,1-sx*sx-sy*sy));
    index.push((py*size+px)*4);cx.push(sx);cy.push(sy);cz.push(z);rim.push(LIGHT.floor+Math.pow(1-z,5)*LIGHT.rim);threshold.push(grain[row+gx%GRID]);cover.push(edge);
   }
   if(py%32===31)yield;
  }
  return {size,dpr,index:Int32Array.from(index),cx:Float32Array.from(cx),cy:Float32Array.from(cy),cz:Float32Array.from(cz),rim:Float32Array.from(rim),threshold:Float32Array.from(threshold),cover:Uint8Array.from(cover)};
 }
 // Worked out in idle slices (above); the frame after it is ready draws it.
 function prepare(size,dpr){
  const want=size+'|'+dpr;
  if(preparing===want)return;
  preparing=want;
  grainOrder().then(grain=>inSlices(measureSteps(size,dpr,grain))).then(next=>{if(preparing!==want)return;preparing='';shape=next;request();});
 }
 function paint(){
  frame=0;
  if(!near)return;
  const dpr=Math.min(Math.max(devicePixelRatio||1,1),3),width=surface.getBoundingClientRect().width;if(!width)return;
  const style=getComputedStyle(surface),inks=style.color+'/'+style.caretColor;
  const size=Math.round(width*dpr),key=size+'|'+dpr+'|'+angle.toFixed(2)+'|'+lift.toFixed(2)+'|'+inks;
  if(key===drawn)return;
  if(!shape||shape.size!==size||shape.dpr!==dpr){prepare(size,dpr);return;}
  drawn=key;
  if(canvas.width!==size)canvas.width=canvas.height=size;
  // A hair over the exact quotient so the browser never draws the bitmap a pixel short (grains stay sharp).
  const css=(size+.004)/dpr+'px';if(canvas.style.width!==css){canvas.style.width=canvas.style.height=css;}
  const image=ctx.createImageData(size,size),data=image.data,side=Math.sqrt(1-lift*lift),lx=Math.sin(angle)*side,ly=-Math.cos(angle)*side;
  const {index,cx,cy,cz,rim,threshold,cover}=shape;
  const dark=rgba(style.color,'#0a0a0a'),light=rgba(style.caretColor,'#fff');
  for(let k=0;k<index.length;k++){
   const facing=Math.max(0,Math.min(1,cx[k]*lx+cy[k]*ly+cz[k]*lift)),lit=rim[k]+FALL[(facing*1024)|0]>threshold[k],i=index[k],ink=lit?light:dark;
   data[i]=ink[0];data[i+1]=ink[1];data[i+2]=ink[2];data[i+3]=cover[k]*ink[3]/255;
  }
  ctx.putImageData(image,0,0);
  surface.classList.add('orb-rendered');
 }
 const request=()=>{if(!frame)frame=requestAnimationFrame(paint);};
 // The sphere sits at the foot of the page. It is worked out in a quiet moment soon after the page settles,
 // or when it comes within reach, whichever is first, so scrolling down never waits for it (2026-10-01).
 let near=!('IntersectionObserver' in window),idle=0;
 const quiet=window.requestIdleCallback?callback=>requestIdleCallback(callback,{timeout:2500}):callback=>setTimeout(callback,300);
 const later=()=>{if(idle)return;idle=quiet(()=>{idle=0;near=true;request();});};
 if(!near)new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){near=true;request();}},{rootMargin:'800px 0px'}).observe(surface);
 new ResizeObserver(later).observe(surface);
 button.addEventListener('pointermove',event=>{
  if(reduced.matches||!fine.matches||event.pointerType==='touch')return;
  const r=surface.getBoundingClientRect(),dx=(event.clientX-r.left)/r.width*2-1,dy=(event.clientY-r.top)/r.height*2-1,d=Math.min(1,Math.hypot(dx,dy));
  // Straight on at the centre, raking toward the rim.
  angle=Math.round(Math.atan2(dx,-dy)*60)/60;lift=Math.round((.92-.5*d)*50)/50;request();
 });
 button.addEventListener('pointerleave',()=>{angle=LIGHT.angle;lift=LIGHT.lift;request();});
 window.addEventListener('pageshow',request);
 // A density query matches one value only, so it is renewed after every change.
 let density=null;
 const watch=()=>{density?.removeEventListener?.('change',changed);density=matchMedia('(resolution: '+(devicePixelRatio||1)+'dppx)');density.addEventListener?.('change',changed);};
 const changed=()=>{watch();request();};
 watch();
 request();
}

export function initOrbConversation(){
 const root=document.querySelector('.orb-help');if(!root)return;
 const launch=root.querySelector('.orb-launch'),workspace=root.querySelector('.orb-workspace'),close=root.querySelector('.orb-close');
 const panels=[root.querySelector('#questions'),root.querySelector('#contact-web')],switches=[...root.querySelectorAll('[data-orb-mode]')];
 const input=root.querySelector('#question');
 root.querySelectorAll('.suggestions button').forEach((button,index)=>{button.style.setProperty('--faq-order',index);});
 function open(mode,{focus=false,remember=false}={}){
  workspace.hidden=false;root.classList.add('is-open');root.dataset.mode=mode;launch.setAttribute('aria-expanded','true');launch.setAttribute('aria-label','질문 입력창으로 이동');close.hidden=false;
  panels.forEach(panel=>panel.hidden=panel.id!==mode);switches.forEach(button=>button.hidden=button.dataset.orbMode===mode);
  if(remember){const url=new URL(location.href);url.hash=mode==='questions'?'questions':'contact-web';history.replaceState(null,'',url);}
  if(focus){if(mode==='questions')input.focus({preventScroll:true});else{const title=root.querySelector('#enquiry-title');title.tabIndex=-1;title.focus({preventScroll:true});}root.scrollIntoView({block:'start',behavior:'instant'});}
 }
 function collapse(){workspace.hidden=true;root.classList.remove('is-open');launch.setAttribute('aria-expanded','false');launch.setAttribute('aria-label','무엇이든 물어보세요. 질문창 열기');switches.forEach(button=>button.hidden=button.dataset.orbMode==='questions');const url=new URL(location.href);url.hash='';history.replaceState(null,'',url);launch.focus({preventScroll:true});}
 function modeForHash(hash){if(['#questions','#question'].includes(hash))return 'questions';if(hash.startsWith('#contact-'))return 'contact-web';return null;}
 launch.hidden=false;launch.addEventListener('click',()=>open('questions',{focus:true,remember:true}));close.addEventListener('click',collapse);
 switches.forEach(button=>button.addEventListener('click',()=>open(button.dataset.orbMode,{focus:true,remember:true})));
 root.addEventListener('keydown',e=>{if(e.key==='Escape'&&root.classList.contains('is-open')&&!document.querySelector('dialog[open]')){e.preventDefault();collapse();}});
 document.addEventListener('synk:show-answers',()=>open('questions'));
 input.addEventListener('input',()=>document.dispatchEvent(new CustomEvent('synk:orb-state',{detail:input.value?'typing':'idle'})));
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;const url=new URL(link.href,location.href);if(url.origin===location.origin&&url.pathname===location.pathname){const mode=modeForHash(url.hash);if(mode){event.preventDefault();open(mode,{focus:true,remember:true});}} },true);
 window.addEventListener('hashchange',()=>{const mode=modeForHash(location.hash);if(mode){open(mode);requestAnimationFrame(()=>root.scrollIntoView({block:'start',behavior:'instant'}));}});
 root.classList.add('orb-ready');workspace.hidden=true;const initial=modeForHash(location.hash);
 if(initial){
  open(initial);let interacted=false;
  root.addEventListener('pointerdown',()=>interacted=true,{once:true});root.addEventListener('keydown',()=>interacted=true,{once:true});
  const align=()=>requestAnimationFrame(()=>{if(!interacted)root.scrollIntoView({block:'start',behavior:'instant'});});
  if(document.readyState==='complete')align();else window.addEventListener('load',align,{once:true});
  root.querySelector('.orb-stage').addEventListener('transitionend',event=>{if(event.propertyName==='min-height')align();},{once:true});
 }
 mountOrb(launch);
}
