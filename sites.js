import {initOrbConversation} from './orb-conversation.js?v=c58dacaadcd4';
import {initGlassControls} from './glass-controls.js?v=c58dacaadcd4';
initGlassControls();
// A deliberate brand preview: swiping selects; following a link navigates.
const brandDeck=document.querySelector('[data-brand-deck]');
if(brandDeck){
 const track=brandDeck.querySelector('.brand-carousel-track');
 const slides=[...brandDeck.querySelectorAll('[data-brand-slide]')];
 const panels=[...brandDeck.querySelectorAll('[data-brand-menu]')];
 const positions=[...brandDeck.querySelectorAll('[data-position]')];
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let selected=slides.findIndex(slide=>slide.dataset.brandSlide===brandDeck.dataset.selectedBrand),timer,wheelTotal=0,wheelTime=0,wheelHandled=false,pointer=null,suppressClick=false;
 const status=brandDeck.querySelector('[data-brand-status]');
 function choose(index,announce=true){
  selected=(index+slides.length)%slides.length;
  clearTimeout(timer);
  const brand=slides[selected].dataset.brandSlide;
  brandDeck.dataset.selectedBrand=brand;
  panels.forEach(panel=>{panel.hidden=true;panel.classList.remove('is-revealed');});
  slides.forEach((slide,i)=>{
   let offset=i-selected;if(offset>2)offset-=slides.length;if(offset< -2)offset+=slides.length;
   slide.style.setProperty('--offset',offset);
   slide.tabIndex=i===selected?0:-1;slide.setAttribute('aria-hidden',String(i!==selected));
   positions[i].classList.toggle('is-selected',i===selected);
  });
  const reveal=()=>{panels[selected].hidden=false;panels[selected].classList.add('is-revealed');if(announce)status.textContent=slides[selected].querySelector('img').alt+' 선택. 아래 메뉴나 브랜드 이름으로 이동할 수 있습니다.';};
  if(reduced.matches)reveal();else timer=setTimeout(reveal,200);
 }
 brandDeck.querySelectorAll('[data-brand-step]').forEach(button=>{button.hidden=false;button.addEventListener('click',()=>choose(selected+Number(button.dataset.brandStep)));});
 track.addEventListener('keydown',event=>{
  let next;if(event.key==='ArrowRight')next=selected+1;else if(event.key==='ArrowLeft')next=selected-1;else if(event.key==='Home')next=0;else if(event.key==='End')next=slides.length-1;else if(event.key==='Enter'&&event.target===track){slides[selected].click();return;}else return;
  event.preventDefault();track.focus({preventScroll:true});choose(next);
 });
 track.addEventListener('wheel',event=>{
  // One continuous gesture, including its momentum, can select only one neighbour.
  const now=performance.now();
  if(now-wheelTime>250){wheelTotal=0;wheelHandled=false;}
  wheelTime=now;
  const horizontal=Math.abs(event.deltaX)>Math.abs(event.deltaY),delta=horizontal?event.deltaX:event.shiftKey?event.deltaY:0;
  if(!delta)return;event.preventDefault();if(wheelHandled||pointer)return;
  wheelTotal+=delta*(event.deltaMode===1?16:event.deltaMode===2?track.clientWidth:1);
  if(Math.abs(wheelTotal)>=35){wheelHandled=true;choose(selected+Math.sign(wheelTotal));}
 },{passive:false});
 track.addEventListener('pointerdown',event=>{if(event.button!==0||event.isPrimary===false||pointer)return;pointer={id:event.pointerId,x:event.clientX,y:event.clientY,startIndex:selected,moved:false};suppressClick=false;});
 track.addEventListener('pointermove',event=>{if(!pointer||pointer.id!==event.pointerId)return;const x=event.clientX-pointer.x,y=event.clientY-pointer.y;if(Math.abs(x)>12&&Math.abs(x)>Math.abs(y)){pointer.moved=true;track.setPointerCapture(event.pointerId);}});
 track.addEventListener('pointerup',event=>{if(!pointer||pointer.id!==event.pointerId)return;const dx=event.clientX-pointer.x,dy=event.clientY-pointer.y;suppressClick=pointer.moved;if(Math.abs(dx)>35&&Math.abs(dx)>Math.abs(dy))choose(pointer.startIndex+(dx<0?1:-1));pointer=null;});
 track.addEventListener('pointercancel',()=>{pointer=null;});
 track.addEventListener('lostpointercapture',()=>{pointer=null;});
 track.addEventListener('dragstart',event=>event.preventDefault());
 track.addEventListener('click',event=>{if(suppressClick){event.preventDefault();suppressClick=false;}});
 reduced.addEventListener('change',()=>choose(selected,false));
 choose(selected,false);
}

// Keep anchor destinations below the shared, sticky navigation.
const siteHeader=document.querySelector('.site-header-wrap');
if(siteHeader){
 const sizeHeader=()=>{if(!siteHeader.querySelector('.menu-open'))document.documentElement.style.setProperty('--site-header-height',Math.ceil(siteHeader.getBoundingClientRect().height)+'px');};
 sizeHeader();new ResizeObserver(sizeHeader).observe(siteHeader);
}

// Show one visual explanation at a time. The full content remains available without JavaScript.
document.querySelectorAll('[data-scene-explorer]').forEach(explorer=>{
 const nav=explorer.querySelector('[data-scene-nav]');
 const tabs=[...nav.querySelectorAll('[data-scene-choice]')];
 const panels=[...explorer.querySelectorAll('[data-scene-panel]')];
 if(!tabs.length||tabs.length!==panels.length)return;
 function show(index,{focus=false}={}){
  tabs.forEach((tab,i)=>{const selected=i===index;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;panels[i].hidden=!selected;if(selected&&focus)tab.focus({preventScroll:true});});
  explorer.dataset.sceneIndex=String(index);
 }
 nav.hidden=false;nav.setAttribute('role','tablist');
 tabs.forEach((tab,index)=>{
  tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panels[index].id);
  panels[index].setAttribute('role','tabpanel');panels[index].setAttribute('aria-labelledby',tab.id);
  tab.addEventListener('click',()=>show(index));
  tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();show(next,{focus:true});});
 });
 explorer.classList.add('is-interactive');show(0);
 // Prepare alternative goal artwork shortly before the visitor reaches its tabs.
 if(explorer.hasAttribute('data-prefetch-scenes')){
  const warmImages=()=>explorer.querySelectorAll('img[loading="lazy"]').forEach(image=>{image.loading='eager';});
  if('IntersectionObserver' in window){
   const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){warmImages();observer.disconnect();}},{rootMargin:'300px'});
   observer.observe(explorer);
  }else warmImages();
 }
 // Bookmarks and answer links can target an individual scene as well as its section.
 function revealScene(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);const panel=panels.findIndex(p=>target&&p.contains(target));if(panel>=0)show(panel);}
 revealScene();window.addEventListener('hashchange',revealScene);
});

// Unfold scene explanations in 200ms, retaining native details and keyboard behaviour.
const disclosureMotion=matchMedia('(prefers-reduced-motion: reduce)');
document.querySelectorAll('details.visual-scene-detail').forEach(detail=>{
 const summary=detail.querySelector(':scope > summary'),body=detail.querySelector(':scope > p');
 if(!summary||!body||typeof detail.animate!=='function')return;
 let motion=null,fade=null,expanded=detail.open;
 function finish(){
  detail.open=expanded;
  motion?.cancel();fade?.cancel();motion=fade=null;
  detail.style.removeProperty('overflow');
  document.dispatchEvent(new CustomEvent('synk:layout'));
 }
 summary.addEventListener('click',event=>{
  if(event.defaultPrevented)return;
  if(disclosureMotion.matches){if(motion)finish();return;}
  event.preventDefault();
  const from=detail.getBoundingClientRect().height;
  const opacity=detail.open?Number(getComputedStyle(body).opacity):0;
  expanded=!(motion?expanded:detail.open);
  motion?.cancel();fade?.cancel();
  // Keep the content laid out until collapse completes; reversing starts at its current height.
  detail.open=true;
  detail.style.overflow='clip';
  const style=getComputedStyle(detail);
  const closed=summary.getBoundingClientRect().height+parseFloat(style.paddingTop)+parseFloat(style.paddingBottom)+parseFloat(style.borderTopWidth)+parseFloat(style.borderBottomWidth);
  const to=expanded?detail.getBoundingClientRect().height:closed;
  const timing={duration:200,easing:'cubic-bezier(.22,1,.36,1)',fill:'both'};
  motion=detail.animate([{height:from+'px'},{height:to+'px'}],timing);
  fade=body.animate([{opacity},{opacity:expanded?1:0}],timing);
  motion.onfinish=finish;
 });
 disclosureMotion.addEventListener('change',()=>{if(motion&&disclosureMotion.matches)finish();});
 window.addEventListener('resize',()=>{if(motion)finish();});
});

// One help area, with distinct public answers and actual enquiries. Without JS both remain readable.
initOrbConversation();

// The existing letter workshop runs locally in its own document. Only layout and stage are shared.
const letterFrame=document.querySelector('[data-letter-embed]');
if(letterFrame){
 const status=document.querySelector('[data-letter-status]');
 status.hidden=false;
 let ready=false;
 const slowLoad=setTimeout(()=>{if(!ready)status.textContent='화면이 나타나지 않으면 아래 ‘새 창에서 체험하기’를 이용해 주세요.';},12000);
 window.addEventListener('message',event=>{
  const data=event.data;
  if(event.origin!==location.origin||event.source!==letterFrame.contentWindow||data?.type!=='synk:letter-view')return;
  if(!['story','write','review','done'].includes(data.stage)||!Number.isFinite(data.height)||data.height<100||data.height>20000)return;
  ready=true;clearTimeout(slowLoad);status.hidden=true;
  letterFrame.height=String(Math.ceil(data.height));
  document.querySelectorAll('[data-letter-stage]').forEach(item=>{if(item.dataset.letterStage.split(' ').includes(data.stage))item.setAttribute('aria-current','step');else item.removeAttribute('aria-current');});
  if(data.focus)letterFrame.scrollIntoView({block:'start',behavior:'instant'});
 });
}

// Open a curriculum disclosure before the browser measures a fragment destination.
function openFragmentDetails(hash){
  if(!hash)return;
  let target;
  try{target=document.getElementById(decodeURIComponent(hash.slice(1)));}catch{return;}
  for(let detail=target?.closest('details');detail;detail=detail.parentElement?.closest('details'))detail.open=true;
}
openFragmentDetails(location.hash);
document.addEventListener('click',event=>{
  const link=event.target.closest('a[href]');
  if(!link)return;
  const url=new URL(link.href,location.href);
  if(url.origin===location.origin&&url.pathname===location.pathname)openFragmentDetails(url.hash);
},true);

// Preserve shared-page bookmarks when visiting the new company homepage.
if(location.pathname==='/shift/'&&['#shift-people','#contact-pathways'].includes(location.hash))location.replace('/path/'+(location.hash==='#shift-people'?'#path-journey':location.hash));
if(location.pathname==='/shift/'&&location.hash==='#shift-business')location.replace('/shift/#shift-services');
if(location.pathname==='/'){
 const hash=location.hash.slice(1);
 const brand=hash.startsWith('path')||hash==='contact-pathways'||hash==='shift-people'?'path':hash.startsWith('lab')||hash==='contact-lab'?'lab':hash.startsWith('shift')||['contact-business','contact-pathways','design-notes'].includes(hash)?'shift':hash.startsWith('pulse')||hash==='contact-pulse'?'pulse':null;
 if(brand)location.replace('/'+brand+'/'+(hash===brand?'':'#'+(hash==='shift-people'?'path-journey':hash==='shift-business'?'shift-services':hash)));
 else if(hash==='work')location.replace('/#worlds');
}
// Opening a saved or answer-linked section also reveals its enclosing detail panels.
function revealLinkedDetails(hash=location.hash){
 let id;try{id=decodeURIComponent(hash.slice(1));}catch{return;}
 const target=document.getElementById(id);if(!target)return;
 let node=target.parentElement,opened=false;
 while(node){if(node.tagName==='DETAILS'&&!node.open){node.open=true;opened=true;}node=node.parentElement;}
 if(opened)document.dispatchEvent(new CustomEvent('synk:layout'));
}
revealLinkedDetails();
window.addEventListener('hashchange',()=>revealLinkedDetails());
document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const target=new URL(link.href,location.href);if(target.origin===location.origin&&target.pathname===location.pathname)revealLinkedDetails(target.hash);},true);
