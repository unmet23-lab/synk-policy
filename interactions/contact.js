// Loading a form is explicit; Google owns validation and the actual receipt.
const panel=document.querySelector('[data-contact-panel]');
const slot=document.querySelector('[data-contact-frame]');
function openForm(){
 if(!panel||!slot)return;
 panel.open=true;
 if(slot.querySelector('iframe'))return;
 const frame=document.createElement('iframe');
 frame.title='SYNK 문의 접수 양식';frame.src=slot.dataset.src;frame.height='1400';frame.referrerPolicy='strict-origin-when-cross-origin';slot.append(frame);
}
panel?.addEventListener('toggle',()=>{if(panel.open)openForm();});
// Answers add links after page load. Delegation also reopens a closed panel when
// the address already has this hash and no new hashchange will be emitted.
document.addEventListener('click',event=>{
 if(event.target.closest('a[href="#contact-web"],.contact-options a'))openForm();
});
if(location.hash==='#contact-web')openForm();
window.addEventListener('hashchange',()=>{if(location.hash==='#contact-web')openForm();});
