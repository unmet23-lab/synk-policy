import {createScene,stepScene} from './loom-scene.js';
const {composeEyeOnly}=await import('./eye-composite.js'+new URL(import.meta.url).search);

const image=src=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Image unavailable'));img.src=src;});
export async function initBlinkDemo() {
  const region=document.querySelector('[data-blink-demo]');if(!region)return;
  const canvas=region.querySelector('canvas'),fallback=region.querySelector('[data-blink-fallback]');
  const controls=region.querySelector('[data-blink-controls]');
  const replay=region.querySelector('[data-blink-replay]'),hold=region.querySelector('[data-blink-hold]');
  const motion=region.querySelector('[data-blink-motion]'),status=region.querySelector('[data-blink-status]');
  try {
    const manifest=await fetch('./blink-manifest.json'+new URL(import.meta.url).search).then(response=>{if(!response.ok)throw new Error('Manifest unavailable');return response.json();});
    const [base,closed]=await Promise.all([image(manifest.base),image(manifest.closed)]);
    const frames=composeEyeOnly(base,closed,manifest);
    canvas.width=frames.open.width;canvas.height=frames.open.height;
    const ctx=canvas.getContext('2d');
    const state=createScene({seed:913,windStrength:0,gustStrength:0});
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    let running=!preference.matches,visible=true,held=false,raf=0,last=0,lastClosed=null,pageHidden=false;
    state.nextBlink=.65;
    const draw=value=>{if(lastClosed===value)return;ctx.putImageData(value?frames.closed:frames.open,0,0);lastClosed=value;canvas.dataset.frame=value?'closed':'open';};
    const refresh=()=>{
      motion.textContent=running?'자동 깜빡임 멈추기':'자동 깜빡임 켜기';motion.setAttribute('aria-pressed',String(running));
      hold.textContent=held?'눈 뜨기':'눈감음 멈춰 보기';hold.setAttribute('aria-pressed',String(held));
      status.textContent=held?'눈감음 정지 화면':running?'마감한 눈 깜빡임을 보고 있어요.':'정지 화면 · 버튼으로 표정을 살펴보세요.';
    };
    const tick=timestamp=>{
      raf=0;
      const frozen=!running||held||!visible||document.hidden||pageHidden;
      const pose=stepScene(state,last?(timestamp-last)/1000:0,{paused:frozen});last=timestamp;
      if(!held)draw(pose.blink>.47);
      if(!frozen)raf=requestAnimationFrame(tick);
    };
    const wake=()=>{if(raf)cancelAnimationFrame(raf);raf=0;last=0;if(running&&!held&&visible&&!document.hidden&&!pageHidden)raf=requestAnimationFrame(tick);};
    const setRest=()=>{state.blinkStart=-100;draw(false);};
    replay.addEventListener('click',()=>{
      held=false;
      if(preference.matches){held=true;running=false;draw(true);}else{running=true;setRest();state.nextBlink=state.time+.15;}
      refresh();wake();
    });
    hold.addEventListener('click',()=>{held=!held;if(held){running=false;draw(true);}else{setRest();}refresh();wake();});
    motion.addEventListener('click',()=>{running=!running;held=false;setRest();state.nextBlink=state.time+.65;refresh();wake();});
    const onVisibility=()=>{stepScene(state,0,{hidden:document.hidden});wake();};
    const onPreference=()=>{running=false;held=false;setRest();refresh();wake();};
    document.addEventListener('visibilitychange',onVisibility);
    preference.addEventListener('change',onPreference);
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;stepScene(state,0,{paused:!visible});wake();},{threshold:.1});observer.observe(canvas);
    // A cached-page return keeps the same controller and the visitor's controls.
    const onPageHide=()=>{pageHidden=true;stepScene(state,0,{paused:true});wake();};
    const onPageShow=()=>{pageHidden=false;stepScene(state,0,{paused:!visible});wake();};
    window.addEventListener('pagehide',onPageHide);
    window.addEventListener('pageshow',onPageShow);
    region.dataset.audit=JSON.stringify(frames.audit);region.dataset.ready='true';
    draw(false);canvas.hidden=false;fallback.hidden=true;controls.hidden=false;refresh();wake();
  }catch(error){status.textContent='움직임을 불러오지 못해 원본을 보여드립니다.';region.dataset.ready='false';console.warn('Blink preview unavailable:',error.message);}
}
