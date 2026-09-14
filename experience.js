// Independent enhancements. The semantic page and native controls work without GSAP.
import {initLearningInteractions} from './interactions/learning.js?v=20260915-selected';
import {initFeltInteractions} from './interactions/felt.js?v=20260915-selected';
import {initScrollExperience} from './interactions/scroll.js?v=20260915-selected';
import {initContextCursor} from './interactions/cursor.js?v=20260915-selected';

let gsap, ScrollTrigger;
const loadClassicScript=src=>new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  script.src=new URL(src,import.meta.url).href;
  script.onload=resolve;script.onerror=reject;
  document.head.append(script);
});
try {
  await loadClassicScript('./vendor/gsap.min.js');
  await loadClassicScript('./vendor/ScrollTrigger.min.js');
  gsap=window.gsap;
  ScrollTrigger=window.ScrollTrigger;
  if(gsap&&ScrollTrigger)gsap.registerPlugin(ScrollTrigger);
} catch { /* Native reading and controls remain available if motion cannot load. */ }

const preference=matchMedia('(prefers-reduced-motion: reduce)');
let cleanups=[];
const learningState={initialIndex:0,focusId:null};
function rememberLearningState(){
  const tabs=[...document.querySelectorAll('[data-learning-tab]')];
  const selected=tabs.findIndex(tab=>tab.getAttribute('aria-selected')==='true');
  if(selected>=0){
    learningState.initialIndex=selected;
    const focused=document.activeElement;
    learningState.focusId=focused?.closest('[data-learning-demo]')&&focused.id?focused.id:null;
  }
}
function mount(){
  rememberLearningState();
  cleanups.splice(0).reverse().forEach(cleanup=>cleanup());
  const options={gsap,ScrollTrigger,reducedMotion:preference.matches,initialIndex:learningState.initialIndex};
  for(const init of [initScrollExperience,initLearningInteractions,initFeltInteractions,initContextCursor]){
    try {const cleanup=init(options);if(typeof cleanup==='function')cleanups.push(cleanup);}
    catch(error){console.warn('SYNK enhancement unavailable:',init.name,error);}
  }
  if(learningState.focusId)document.getElementById(learningState.focusId)?.focus({preventScroll:true});
}
mount();
preference.addEventListener('change',mount);
// Page cache restores need fresh positions; ordinary navigation releases observers.
addEventListener('pageshow',event=>{if(event.persisted)mount();});
addEventListener('pagehide',()=>{rememberLearningState();cleanups.splice(0).reverse().forEach(cleanup=>cleanup());});
