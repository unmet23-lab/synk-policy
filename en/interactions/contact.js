// Loading a form is explicit; Google owns validation and the actual receipt.
const panel=document.querySelector('[data-contact-panel]');
const slot=document.querySelector('[data-contact-frame]');
function openForm(){
 if(!panel||!slot)return;
 panel.open=true;
 if(slot.querySelector('iframe'))return;
 const frame=document.createElement('iframe');
 frame.title="SYNK enquiry form (in Korean)";frame.src=slot.dataset.src;frame.height='1400';frame.referrerPolicy='strict-origin-when-cross-origin';slot.append(frame);
}
panel?.addEventListener('toggle',()=>{if(panel.open)openForm();});
// Answers add links after page load. Delegation also reopens a closed panel when
// the address already has this hash and no new hashchange will be emitted.
document.addEventListener('click',event=>{
 const link=event.target.closest('a');if(!link)return;
 const url=new URL(link.href,location.href);
 if(url.origin===location.origin&&url.pathname===location.pathname&&url.hash==='#contact-web')openForm();
});
if(location.hash==='#contact-web')openForm();
window.addEventListener('hashchange',()=>{if(location.hash==='#contact-web')openForm();});
