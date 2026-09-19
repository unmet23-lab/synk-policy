// Reflections follow deliberate pointer movement. No idle animation or sensor
// access; touch and reduced-motion users see the same static material.
export function initGlassControls(){
 const fine=matchMedia('(hover: hover) and (pointer: fine)');
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const selector='.brand-carousel-track,.felt-control,.learning-choices button,.visual-scene-nav button,.atlas-map-controls button,.quiet-link,.story-continuation[data-destination]';
 let active=null,frame=0,point=null;
 function reset(){
  if(frame)cancelAnimationFrame(frame);
  frame=0;point=null;
  if(active){active.style.removeProperty('--glass-x');active.style.removeProperty('--glass-y');}
  active=null;
 }
 document.addEventListener('pointermove',event=>{
  if(!fine.matches||reduced.matches||event.pointerType==='touch')return;
  const target=event.target.closest?.(selector);
  if(!target){if(active)reset();return;}
  if(target!==active){reset();active=target;}
  point={x:event.clientX,y:event.clientY};
  if(frame)return;
  frame=requestAnimationFrame(()=>{
   frame=0;if(!active||!point)return;
   const rect=active.getBoundingClientRect();
   active.style.setProperty('--glass-x',Math.max(10,Math.min(90,(point.x-rect.left)/rect.width*100)).toFixed(1)+'%');
   active.style.setProperty('--glass-y',Math.max(0,Math.min(80,(point.y-rect.top)/rect.height*80)).toFixed(1)+'%');
  });
 },{passive:true});
 document.documentElement.addEventListener('pointerleave',reset);
 window.addEventListener('blur',reset);
 document.addEventListener('visibilitychange',()=>{if(document.hidden)reset();});
 fine.addEventListener('change',reset);reduced.addEventListener('change',reset);
}
