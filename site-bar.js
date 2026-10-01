// The company bar on /atlas/: the same frosted glass as on the company page, and on narrow windows the
// same folding list. On the company page app.js and sites.js do this for the same markup.
import {initGlassControls} from '/glass-controls.js?v=c59f5584849b';
initGlassControls();
const header=document.querySelector('.site-header-wrap .header');
const toggle=header?.querySelector('.menu-toggle');
if(header&&toggle){
 const close=({focus=false}={})=>{header.classList.remove('menu-open');toggle.setAttribute('aria-expanded','false');if(focus)toggle.focus();};
 toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));header.classList.toggle('menu-open',open);});
 header.addEventListener('click',event=>{if(event.target.closest('a[href]'))close();});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&header.classList.contains('menu-open'))close({focus:true});});
 matchMedia('(min-width:1181px)').addEventListener('change',event=>{if(event.matches)close();});
}
