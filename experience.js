// Independent enhancements. The semantic page and native controls work without GSAP.
import {initLearningInteractions} from './interactions/learning.js?v=20260915-narrative';
import {initCurriculumNarrative} from './interactions/curriculum.js?v=20260915-css-motion';
import {initFeltInteractions} from './interactions/felt.js?v=20260915-selected';
import {initScrollExperience} from './interactions/scroll.js?v=20260915-narrative';
import {initInitialReveal} from './interactions/reveal.js?v=20260915-presence';

let gsap, ScrollTrigger;
// Complete a direct section link after initial layout/ScrollTrigger refresh.
// Native smooth fragment scrolling can otherwise be interrupted by that refresh.
const initialFragment=location.hash;
let visitorActed=false;
const markVisitor=()=>{visitorActed=true;};
for(const type of ['pointerdown','keydown','wheel','touchstart'])addEventListener(type,markVisitor,{once:true,passive:true});
const loadClassicScript=src=>new Promise((resolve,reject)=>{
  const script=document.createElement('script');
  const timeout=setTimeout(()=>reject(new Error('Motion load timed out')),1500);
  script.src=new URL(src,import.meta.url).href;
  script.onload=()=>{clearTimeout(timeout);resolve();};
  script.onerror=()=>{clearTimeout(timeout);reject(new Error('Motion unavailable'));};
  document.head.append(script);
});
try {
  await loadClassicScript('./vendor/gsap.min.js');
  gsap=window.gsap;
  initInitialReveal(gsap);
  await loadClassicScript('./vendor/ScrollTrigger.min.js');
  gsap=window.gsap;
  ScrollTrigger=window.ScrollTrigger;
  if(gsap&&ScrollTrigger)gsap.registerPlugin(ScrollTrigger);
} catch { window.synkEntry?.finish(); /* Native reading and controls remain available. */ }

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
  for(const init of [initScrollExperience,initLearningInteractions,initFeltInteractions,initCurriculumNarrative]){
    try {const cleanup=init(options);if(typeof cleanup==='function')cleanups.push(cleanup);}
    catch(error){console.warn('SYNK enhancement unavailable:',init.name,error);}
  }
  if(learningState.focusId)document.getElementById(learningState.focusId)?.focus({preventScroll:true});
}
mount();
Promise.allSettled([document.fonts?.ready,document.readyState==='complete'?Promise.resolve():new Promise(resolve=>addEventListener('load',resolve,{once:true}))]).then(()=>requestAnimationFrame(()=>requestAnimationFrame(()=>{
  if(!visitorActed&&initialFragment&&initialFragment!=='#top'&&location.hash===initialFragment){
    try {document.getElementById(decodeURIComponent(initialFragment.slice(1)))?.scrollIntoView({behavior:'instant',block:'start'});} catch { /* Ignore malformed fragments. */ }
  }
  for(const type of ['pointerdown','keydown','wheel','touchstart'])removeEventListener(type,markVisitor);
})));
preference.addEventListener('change',mount);
// Page cache restores need fresh positions; ordinary navigation releases observers.
addEventListener('pageshow',event=>{if(event.persisted)mount();});
addEventListener('pagehide',()=>{rememberLearningState();cleanups.splice(0).reverse().forEach(cleanup=>cleanup());});
