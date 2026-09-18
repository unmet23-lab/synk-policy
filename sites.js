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
 // Bookmarks and answer links can target an individual scene as well as its section.
 function revealScene(){let id;try{id=decodeURIComponent(location.hash.slice(1));}catch{return;}const target=document.getElementById(id);const panel=panels.findIndex(p=>target&&p.contains(target));if(panel>=0)show(panel);}
 revealScene();window.addEventListener('hashchange',revealScene);
});

// One help area, with distinct public answers and actual enquiries. Without JS both remain readable.
const helpTabs=document.querySelector('[data-help-tabs]');
if(helpTabs){
 const tabs=[...helpTabs.querySelectorAll('[data-help-target]')];
 const panels=tabs.map(tab=>document.getElementById(tab.dataset.helpTarget));
 function showHelp(id,{focus=false,remember=false}={}){
  tabs.forEach((tab,index)=>{const selected=tab.dataset.helpTarget===id;tab.setAttribute('aria-selected',String(selected));tab.tabIndex=selected?0:-1;panels[index].hidden=!selected;if(selected&&focus)tab.focus();});
  if(remember){const url=new URL(location.href);url.hash=id==='questions'?'questions':'contact';history.replaceState(null,'',url);}
 }
 function helpForHash(hash){
  if(hash==='#contact'||hash.startsWith('#contact-'))return 'contact-web';
  if(['#questions','#question'].includes(hash))return 'questions';
  return null;
 }
 helpTabs.hidden=false;helpTabs.setAttribute('role','tablist');helpTabs.setAttribute('aria-label','안내와 문의 방법');
 tabs.forEach((tab,index)=>{
  tab.setAttribute('role','tab');tab.setAttribute('aria-controls',panels[index].id);
  panels[index].setAttribute('role','tabpanel');panels[index].setAttribute('aria-labelledby',tab.id);
  tab.addEventListener('click',()=>showHelp(tab.dataset.helpTarget,{remember:true}));
  tab.addEventListener('keydown',event=>{let next;if(event.key==='ArrowRight')next=(index+1)%tabs.length;else if(event.key==='ArrowLeft')next=(index+tabs.length-1)%tabs.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=tabs.length-1;else return;event.preventDefault();showHelp(tabs[next].dataset.helpTarget,{focus:true,remember:true});});
 });
 helpTabs.closest('.help-section').classList.add('help-enhanced');
 showHelp(helpForHash(location.hash)||'questions');
 document.addEventListener('click',event=>{const link=event.target.closest('a[href]');if(!link)return;const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname!==location.pathname)return;const id=helpForHash(url.hash);if(id)showHelp(id);},true);
 window.addEventListener('hashchange',()=>{const id=helpForHash(location.hash);if(id)showHelp(id);});
 document.addEventListener('synk:show-answers',()=>showHelp('questions',{remember:true}));
}

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
