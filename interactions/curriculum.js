// CSS owns the movement; this observer only starts each row once per page visit.
const seenRows = new WeakSet();
export function initCurriculumNarrative({reducedMotion=false}={}) {
  const rows=[...document.querySelectorAll('[data-curriculum-step]')];
  if(reducedMotion||!('IntersectionObserver' in window))return ()=>{};
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      if(!entry.isIntersecting)continue;
      observer.unobserve(entry.target);
      if(seenRows.has(entry.target))continue;
      seenRows.add(entry.target);
      entry.target.classList.add('is-curriculum-entering');
    }
  },{threshold:.15});
  rows.filter(row=>!seenRows.has(row)).forEach(row=>observer.observe(row));
  return ()=>{observer.disconnect();rows.forEach(row=>row.classList.remove('is-curriculum-entering'));};
}
