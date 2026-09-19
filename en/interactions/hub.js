// Reading context only: no identity inference, analytics, storage or network requests.
const chapterNames={top:"Learning · Work · Culture",philosophy:"SYNK · About",work:"SYNK · Activities and guides",lab:"LAB · Korean learning",shift:"SHIFT · Business",pulse:"PULSE · Culture",contact:"SYNK · Enquiries and collaboration"};
const note=document.querySelector('.header-note');
const chapters=Object.keys(chapterNames).map(id=>document.getElementById(id)).filter(Boolean);
const targets=chapters.map(el=>el.id==='top'?el.querySelector('.hero-meta')||el:el);
const roadmap=document.querySelector('[data-roadmap-context]');
const rows=[...document.querySelectorAll('[data-curriculum-step]')];
const links=[...document.querySelectorAll('.roadmap-nav a')];
let observers=[];
function selectVolume(index){
 if(!roadmap||!rows[index])return;
 const row=rows[index];
 roadmap.hidden=false;
 roadmap.querySelector('[data-roadmap-current]').textContent=`Core ${index+1} · ${row.querySelector('.lab-volume__body').textContent.trim()}`;
 roadmap.querySelector('[data-roadmap-pair]').textContent=index<2?"Conversation practice · Synapse Talk 1":index<5?"Conversation practice · Synapse Talk 2":"Advanced Core · Discussing specialist and abstract topics";
 rows.forEach((item,i)=>item.classList.toggle('is-roadmap-current',i===index));
 links.forEach((link,i)=>{if(i===index)link.setAttribute('aria-current','step');else link.removeAttribute('aria-current');});
 document.querySelectorAll('[data-talk-volume]').forEach(item=>item.classList.toggle('is-talk-paired',Number(item.dataset.talkVolume)===(index<2?1:index<5?2:0)));
}
links.forEach((link,index)=>link.addEventListener('click',()=>selectVolume(index)));
function mount(){
 observers.forEach(observer=>observer.disconnect());observers=[];
 if(!('IntersectionObserver' in window))return;
 const chapterObserver=new IntersectionObserver(entries=>{
  for(const entry of entries){
   if(!entry.isIntersecting)continue;
   const id=entry.target.classList.contains('hero-meta')?'top':entry.target.id;
   if(!chapterNames[id])continue;
   if(note&&!document.body.dataset.site)note.textContent=chapterNames[id];
   document.body.dataset.readingChapter=id;
  }
 },{rootMargin:'-12% 0px -65% 0px',threshold:0});
 targets.forEach(el=>chapterObserver.observe(el));observers.push(chapterObserver);
 const rowObserver=new IntersectionObserver(entries=>{
  const visible=entries.filter(entry=>entry.isIntersecting);
  if(visible.length){const closest=visible.sort((a,b)=>Math.abs(a.boundingClientRect.top-180)-Math.abs(b.boundingClientRect.top-180))[0];selectVolume(rows.indexOf(closest.target));}
 },{rootMargin:'-16% 0px -55% 0px',threshold:0});
 rows.forEach(el=>rowObserver.observe(el));observers.push(rowObserver);
}
mount();
addEventListener('pagehide',()=>observers.forEach(observer=>observer.disconnect()));
addEventListener('pageshow',event=>{if(event.persisted)mount();});
