// The content, native details and destination links work without JavaScript.
for(const section of document.querySelectorAll('[data-showroom]')){
 const toolbar=section.querySelector('[data-showroom-toolbar]');
 const cards=[...section.querySelectorAll('[data-showroom-case]')];
 const buttons=[...section.querySelectorAll('[data-showroom-filter]')];
 const count=section.querySelector('[data-showroom-count]');
 const english=document.documentElement.lang==='en';
 function filter(value){
  let visible=0;
  for(const card of cards){card.hidden=value!=='all'&&card.dataset.showroomCase!==value;if(!card.hidden)visible++;}
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.showroomFilter===value));
  count.textContent=english?`${visible} ${visible===1?'project':'projects'}`:`${visible}개 사례`;
 }
 for(const button of buttons)button.addEventListener('click',()=>filter(button.dataset.showroomFilter));
 function revealLinkedCase(){
  const card=cards.find(item=>'#'+item.id===location.hash);
  if(!card)return;
  filter('all');
  card.querySelector('details').open=true;
  // Browsers resolve the fragment before the enhancement when returning from a filtered view.
  requestAnimationFrame(()=>card.scrollIntoView({block:'start',behavior:'instant'}));
 }
 toolbar.hidden=false;
 addEventListener('hashchange',revealLinkedCase);
 revealLinkedCase();
}
