// Six existing learning targets; animation never determines content availability.
export function initCurriculumNarrative({reducedMotion=false}={}) {
  const rows=[...document.querySelectorAll('[data-curriculum-step]')];
  if(reducedMotion||!('IntersectionObserver' in window))return ()=>{};
  const animations=new Set();
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      observer.unobserve(entry.target);
      if(typeof entry.target.animate!=='function')continue;
      const animation=entry.target.animate(
        [{opacity:.65,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],
        {duration:320,easing:'cubic-bezier(.2,0,0,1)'}
      );
      animations.add(animation);
      animation.onfinish=()=>animations.delete(animation);
    }
  },{threshold:.15});
  rows.forEach(row=>observer.observe(row));
  return ()=>{observer.disconnect();animations.forEach(animation=>animation.cancel());animations.clear();};
}
