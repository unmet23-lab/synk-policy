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

// A public illustration of explicitly chosen explanation order, not a learner diagnosis.
const explanation=document.querySelector('[data-explanation]');
if(explanation){
  const controls=[...document.querySelectorAll('[data-explanation-order]')];
  controls.forEach(button=>button.addEventListener('click',()=>{
    const selected=button.dataset.explanationOrder;
    const first=explanation.querySelector(`[data-explanation-part="${selected}"]`);
    if(!first)return;
    explanation.prepend(first);
    controls.forEach(control=>control.setAttribute('aria-pressed',String(control===button)));
  }));
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
