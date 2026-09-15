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
for(const link of document.querySelectorAll('a[href="#contact-web"],.contact-options a'))link.addEventListener('click',openForm);
if(location.hash==='#contact-web')openForm();
window.addEventListener('hashchange',()=>{if(location.hash==='#contact-web')openForm();});
