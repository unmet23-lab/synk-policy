// Theme changes happen at chapter boundaries. No scroll hijacking or continuous paint loop.
export function initScrollExperience({gsap,ScrollTrigger,reducedMotion=false}={}){
  const worlds=document.querySelector('#worlds');
  if(!worlds||!gsap||!ScrollTrigger)return ()=>{};
  const tokens=getComputedStyle(document.documentElement);
  const color=name=>tokens.getPropertyValue('--synk-'+name).trim();
  const themes={lab:color('coral-wash'),shift:color('lapis-soft'),pulse:color('pop-soft')};
  const triggers=[];
  const completed=new WeakSet();
  let current='',refreshFrame=0;
  const select=id=>{
    if(current===id)return;
    current=id;
    worlds.dataset.world=id;
    gsap.to(worlds,{backgroundColor:themes[id]||color('paper'),duration:reducedMotion?0:.6,ease:'power2.out',overwrite:'auto'});
  };
  const context=gsap.context(()=>{
    for(const id of Object.keys(themes)){
      triggers.push(ScrollTrigger.create({trigger:'#'+id,start:'top 55%',end:'bottom 55%',onEnter:()=>select(id),onEnterBack:()=>select(id)}));
    }
    triggers.push(ScrollTrigger.create({trigger:worlds,start:'top bottom',end:'bottom top',onLeave:()=>select(''),onLeaveBack:()=>select('')}));
    if(!reducedMotion){
      // Only decorative movement; opacity never drops to zero and focus cancels reveals.
      const revealTargets=document.querySelectorAll('.world-heading,.worlds-heading,.lab-card,.shift-heading,.shift-mission,.shift-pillars > section,.making-note,.pulse-layout,.pulse-formats,.section-intro,.work-card,.company-note-inner,.principles');
      for(const target of revealTargets){
        target.setAttribute('data-reveal','');
        triggers.push(ScrollTrigger.create({trigger:target,start:'top 92%',once:true,onEnter:()=>{
          if(completed.has(target))return;
          completed.add(target);
          gsap.fromTo(target,{'--reveal-y':'22px',opacity:.35},{'--reveal-y':'0px',opacity:1,duration:.65,ease:'power2.out',clearProps:'--reveal-y,opacity'});
        }}));
      }
      for(const object of document.querySelectorAll('.learning-scene > [data-felt],.pulse-scene > [data-felt]')){
        gsap.fromTo(object,{y:6},{y:-6,ease:'none',scrollTrigger:{trigger:object.parentElement,start:'top bottom',end:'bottom top',scrub:.6}});
      }

    }
  });
  const refresh=()=>{cancelAnimationFrame(refreshFrame);refreshFrame=requestAnimationFrame(()=>{ScrollTrigger.refresh();refreshFrame=0;});};
  const focus=event=>{
    // Keyboard navigation must not land in a partly transparent moving region.
    for(const target of document.querySelectorAll('[data-reveal]'))if(target.contains(event.target)){
      completed.add(target);gsap.killTweensOf(target);
      target.style.removeProperty('opacity');target.style.removeProperty('--reveal-y');
    }
  };
  document.addEventListener('synk:layout',refresh);
  document.addEventListener('toggle',refresh,true);
  document.addEventListener('focusin',focus);
  document.fonts?.ready.then(()=>{if(worlds.isConnected&&active)refresh();});
  let active=true;
  refresh();
  return ()=>{
    active=false;cancelAnimationFrame(refreshFrame);
    document.removeEventListener('synk:layout',refresh);
    document.removeEventListener('toggle',refresh,true);
    document.removeEventListener('focusin',focus);
    triggers.forEach(trigger=>trigger.kill());context.revert();gsap.killTweensOf(worlds);
    worlds.style.removeProperty('background-color');delete worlds.dataset.world;
    document.querySelectorAll('[data-reveal]').forEach(target=>{
      gsap.killTweensOf(target);target.style.removeProperty('opacity');target.style.removeProperty('--reveal-y');target.removeAttribute('data-reveal');
    });
  };
}
