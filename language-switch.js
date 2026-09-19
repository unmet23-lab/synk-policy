// Matching pages share section IDs, so language changes preserve the current section.
document.addEventListener('click',event=>{
 const link=event.target.closest('a[data-language-switch]');if(!link||!location.hash)return;
 const target=new URL(link.href,location.href);if(target.origin!==location.origin)return;
 target.hash=location.hash;link.href=target.pathname+target.search+target.hash;
});
