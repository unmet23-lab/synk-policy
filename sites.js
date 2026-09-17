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
if(location.pathname==='/'){
 const hash=location.hash.slice(1);
 const brand=hash.startsWith('lab')||hash==='contact-lab'?'lab':hash.startsWith('shift')||['contact-business','contact-pathways','design-notes'].includes(hash)?'shift':hash.startsWith('pulse')||hash==='contact-pulse'?'pulse':null;
 if(brand)location.replace('/'+brand+'/'+(hash===brand?'':'#'+hash));
 else if(hash==='work')location.replace('/#worlds');
}
