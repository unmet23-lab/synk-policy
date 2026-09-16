import {initLearningInteractions} from '/interactions/learning.js';

// Native links and disclosures remain useful without this enhancement.
initLearningInteractions({reducedMotion:true});

function revealTarget(hash, scroll=false) {
  let target;
  try { target=document.getElementById(decodeURIComponent(hash.slice(1))); } catch { return; }
  if(!target)return;
  for(let parent=target.parentElement;parent;parent=parent.parentElement){
    if(parent.tagName==='DETAILS')parent.open=true;
  }
  if(scroll)requestAnimationFrame(()=>target.scrollIntoView({behavior:'instant',block:'start'}));
}
document.addEventListener('click',event=>{
  const anchor=event.target.closest('a[href^="#"]');
  if(anchor)revealTarget(anchor.hash);
});
addEventListener('hashchange',()=>revealTarget(location.hash,true));
if(location.hash)revealTarget(location.hash,true);

// A short press response also runs for Enter and Space; this is not a toggle.
for(const button of document.querySelectorAll('[data-felt]')){
  let release;
  button.addEventListener('click',()=>{
    clearTimeout(release);
    button.classList.add('is-pressed');
    release=setTimeout(()=>button.classList.remove('is-pressed'),180);
  });
}
