// A contextual hint beside the system pointer, never a replacement for native affordances.
export function initContextCursor({gsap,reducedMotion=false}={}){
  const fine=matchMedia('(hover: hover) and (pointer: fine)');
  const ring=document.createElement('div');
  ring.className='context-cursor';ring.setAttribute('aria-hidden','true');
  document.body.append(ring);
  let target=null;
  const hide=()=>{target=null;ring.classList.remove('is-visible');};
  const move=event=>{
    if(reducedMotion||!fine.matches||event.pointerType!=='mouse'||document.querySelector('dialog[open]'))return hide();
    const next=event.target.closest?.('.work-card,.lab-volumes summary,[data-felt]');
    if(!next)return hide();
    if(target!==next){target=next;ring.textContent=next.matches('[data-felt]')?'눌러보기':next.matches('summary')?'펼쳐보기':next.dataset.cursorLabel||'Explore';}
    ring.style.left=Math.min(event.clientX+18,innerWidth-78)+'px';
    ring.style.top=Math.min(event.clientY+18,innerHeight-78)+'px';
    ring.classList.add('is-visible');
  };
  const keys=event=>{if(event.key==='Tab'||event.key==='Escape')hide();};
  document.addEventListener('pointermove',move,{passive:true});
  document.addEventListener('pointerdown',hide,{passive:true});
  document.addEventListener('keydown',keys);
  document.addEventListener('scroll',hide,{passive:true});
  document.addEventListener('visibilitychange',hide);
  document.documentElement.addEventListener('pointerleave',hide);
  addEventListener('blur',hide);fine.addEventListener('change',hide);
  return ()=>{
    document.removeEventListener('pointermove',move);document.removeEventListener('pointerdown',hide);
    document.removeEventListener('keydown',keys);document.removeEventListener('scroll',hide);
    document.removeEventListener('visibilitychange',hide);document.documentElement.removeEventListener('pointerleave',hide);
    removeEventListener('blur',hide);fine.removeEventListener('change',hide);ring.remove();
  };
}
