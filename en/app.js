import {createKnowledgeEngine} from '/en/knowledge-engine.js?v=b7ed3b304f6a';
import {appendPublicActions} from '/public-actions.js?v=d512021296';
const $=s=>document.querySelector(s);
const conversation=$('#questions'),form=$('#question-form'),input=$('#question'),send=$('#send'),messages=$('#messages'),dialog=$('#document-dialog');
const initialContext=()=>({brand:['lab','shift','pulse','path'].includes(document.body.dataset.site)?document.body.dataset.site:'synk'});
let engine=null,context=initialContext(),busy=false,activeDoc=null,lastTrigger=null,toastTimer;
const readyNote=$('#answer-note').textContent;
const names={company:'SYNK',lab:'SYNK LAB',shift:'SYNK SHIFT',pulse:'SYNK PULSE',path:'SYNK PATH',philosophy:'SYNK',vision:'SYNK',guide:'SYNK'};
const menuToggle=$('.menu-toggle'),mainNav=$('#main-nav'),header=$('.header');
function closeMenu({focus=false}={}){header.classList.remove('menu-open');menuToggle?.setAttribute('aria-expanded','false');if(focus)menuToggle?.focus();}
menuToggle?.addEventListener('click',()=>{const open=menuToggle.getAttribute('aria-expanded')!=='true';menuToggle.setAttribute('aria-expanded',String(open));header.classList.toggle('menu-open',open);});
mainNav.addEventListener('click',event=>{const link=event.target.closest('a');if(!link)return;closeMenu();const url=new URL(link.href,location.href);if(url.origin!==location.origin||url.pathname!==location.pathname)return;const target=document.getElementById(url.hash.slice(1));if(target){target.setAttribute('tabindex','-1');target.focus({preventScroll:true});}});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&header.classList.contains('menu-open'))closeMenu({focus:true});});
matchMedia(document.body.dataset.site?'(max-width: 900px)':'(max-width: 560px)').addEventListener('change',()=>closeMenu());
$('#copy-email').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('hello@synk.im');toast("Email address copied.");}catch{toast("Select and copy hello@synk.im.");}});
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function toast(text){const el=$('#toast');el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2400);}
function syncInput(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,160)+'px';send.disabled=busy||!input.value.trim();}
function paragraphs(parent,text){String(text).split(/\n\n/).forEach(p=>parent.append(element('p','',p)));}
const pending=fetch('/en/knowledge.json?v=b7ed3b304f6a').then(r=>{if(!r.ok)throw new Error("Public information could not be loaded.");return r.json();}).then(data=>{
  engine=createKnowledgeEngine(data);return engine;
}).catch(error=>{console.error('Public notes unavailable');$('#answer-note').textContent="Public information could not be loaded. Send a question to try again.";throw error;});
// Keep the initial document load from producing an unhandled rejection when no one asks.
pending.catch(()=>{});

async function getEngine(){if(engine)return engine;try{return await pending;}catch{const r=await fetch('/en/knowledge.json?v=b7ed3b304f6a',{cache:'reload'});if(!r.ok)throw new Error("Public information could not be loaded. Please try again shortly.");engine=createKnowledgeEngine(await r.json());$('#answer-note').textContent=readyNote;return engine;}}
function showAnswers(){document.dispatchEvent(new Event('synk:show-answers'));}
function enterChat(){showAnswers();conversation.classList.add('is-chatting');$('#introduction').hidden=true;$('#chat-area').hidden=false;}
function focusQuestion(){showAnswers();input.focus({preventScroll:true});if(!conversation.closest('.orb-help'))(conversation.closest('.help-frame')||conversation).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
function reset(){context=initialContext();messages.replaceChildren();conversation.classList.remove('is-chatting');$('#introduction').hidden=false;$('#chat-area').hidden=true;input.value='';syncInput();input.focus({preventScroll:true});document.dispatchEvent(new CustomEvent('synk:orb-state',{detail:'idle'}));}
function appendAnswer(result){
  const article=element('article','message-assistant');article.dataset.status=result.status;
  const label=element('div','message-label');const mark=element('img','answer-wordmark');mark.src='/assets/brand-synk.webp?v=20260910-story';mark.alt='SYNK';mark.width=744;mark.height=360;label.append(mark,element('span','',result.status==='restricted'?"Public information":result.status==='needs_confirmation'?"Please contact us to confirm":"SYNK guide"));article.append(label);
  const body=element('div','answer-text');
  if(result.message)paragraphs(body,result.message);
  for(const record of result.records){
    if(result.records.length>1)body.append(element('h3','',record.title));
    const parts=record.answer.split(/\n\n/);
    paragraphs(body,parts[0]);
    if(parts.length>1){const more=element('details','answer-more');more.open=!!result.expanded;more.append(element('summary','',"Read more"));const extended=element('div','');parts.slice(1).forEach(p=>paragraphs(extended,p));more.append(extended);body.append(more);}
  }
  article.append(body);const dates=[...new Set(result.records.map(r=>r.reviewedAt).filter(Boolean))];if(dates.length)article.append(element('p','answer-reviewed',"Public information reviewed · "+dates.sort().at(-1)));
  const sources=element('div','answer-sources');
  result.sourceIds.forEach((id,i)=>{const doc=engine.docs.get(id);if(!doc)return;const button=element('button','source-button');button.type='button';button.dataset.doc=id;button.dataset.recordId=result.records.find(r=>r.sourceId===id)?.id||'';button.append(element('span','',String(i+1).padStart(2,'0')),document.createTextNode(doc.title.split(' — ')[0]+" · View source ↗"));sources.append(button);});
  const copy=element('button','copy-answer',"Copy answer");copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText([result.message,...result.records.map(r=>r.answer)].filter(Boolean).join('\n\n'));toast("Answer copied.");}catch{toast("Automatic copying is unavailable. Select and copy the answer.");}});sources.append(copy);article.append(sources);
  appendPublicActions(article,result.records);
  const related=element('div','related-questions');
  result.relatedIds.slice(0,result.status==='clarify'?3:2).forEach(id=>{const r=engine.records.get(id);if(!r)return;const b=element('button','',r.title);b.type='button';b.dataset.ask=r.questionExamples[0];related.append(b);});if(related.childNodes.length)article.append(related);
  messages.append(article);
}
async function ask(text,{scroll=true}={}){
  const question=String(text||'').trim();if(!question)return {status:'invalid'};if(question.length>500){toast("Please keep your question within 500 characters.");return {status:'invalid'};}if(busy)return {status:'busy'};
  busy=true;form.setAttribute('aria-busy','true');document.dispatchEvent(new CustomEvent('synk:orb-state',{detail:'busy'}));syncInput();
  try{
    await getEngine();enterChat();
    const previous=[...messages.children].filter(el=>!el.classList.contains('orb-history'));
    if(previous.length){let history=messages.querySelector('.orb-history');if(!history){history=element('details','orb-history');history.append(element('summary','',"Previous questions"));messages.prepend(history);}previous.forEach(el=>history.append(el));while(history.children.length>21){history.children[1].remove();history.children[1]?.remove();}history.open=false;history.querySelector('summary').textContent="Previous questions · "+history.querySelectorAll('.message-user').length+"";}
    const questionEl=element('div','message-user',question);messages.append(questionEl);
    const result=engine.answer(question,context);appendAnswer(result);
    if(['matched','needs_confirmation'].includes(result.status))context={brand:['lab','shift','pulse','path'].includes(result.brand)?result.brand:context.brand,recordIds:result.records.map(r=>r.id)};
    else if(!['clarify','courtesy'].includes(result.status))context=initialContext();
    input.value='';if(scroll){focusQuestion();questionEl.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
    // Bound DOM/session memory. No conversation data is persisted.
    while(messages.children.length>24){messages.firstElementChild.remove();messages.firstElementChild?.remove();}
    return {status:result.status,answer:result.message||result.records.map(r=>r.answer).join('\n\n'),sources:result.sourceIds.map(id=>({id,title:engine.docs.get(id)?.title})),brand:result.brand};
  }catch(error){toast(error.message||"There was a problem loading the information. Please try again.");return {status:'error'};}
  finally{busy=false;form.setAttribute('aria-busy','false');document.dispatchEvent(new CustomEvent('synk:orb-state',{detail:'idle'}));syncInput();}
}
async function openDoc(id,trigger){
  try{
    await getEngine();const doc=engine.docs.get(id);if(!doc)return;
    activeDoc=id;if(!dialog.open)lastTrigger=trigger||document.activeElement;
    $('#document-title').textContent=doc.title.split(' — ').slice(1).join(' — ')||doc.title;
    $('#document-brand').textContent=(names[id]||'SYNK')+' · '+doc.updatedAt+" · reviewed";
    const body=$('#document-body');body.replaceChildren();let target=null;
    for(const record of engine.records.values()){
      if(record.sourceId!==id)continue;
      const section=element('section','document-answer');section.dataset.recordId=record.id;
      section.append(element('h3','',record.title));paragraphs(section,record.answer);body.append(section);
      if(record.id===trigger?.dataset.recordId)target=section;
    }
    $('#document-related').replaceChildren();
    for(const related of ['company','lab','shift','pulse','path','vision']){
      if(related===id)continue;const b=element('button','',(related==='vision'?"Our brands":names[related])+' ↗');b.type='button';b.dataset.doc=related;$('#document-related').append(b);
    }
    if(!dialog.open)dialog.showModal();dialog.scrollTop=0;$('#close-document').focus({preventScroll:true});
    if(target)target.scrollIntoView({behavior:'instant',block:'start'});
  }catch{toast("The guide could not be loaded. Please open it again.");}
}
function closeDoc(){dialog.close();lastTrigger?.focus?.({preventScroll:true});}
form.addEventListener('submit',event=>{event.preventDefault();void ask(input.value);});
input.addEventListener('input',syncInput);
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(input.value.trim())void ask(input.value);}});
document.addEventListener('click',event=>{const q=event.target.closest('[data-ask]');if(q){void ask(q.dataset.ask);return;}const d=event.target.closest('[data-doc]');if(d){void openDoc(d.dataset.doc,d);return;}const a=event.target.closest('a[href="#question"]');if(a){event.preventDefault();focusQuestion();}});
$('#reset').addEventListener('click',reset);$('#close-document').addEventListener('click',closeDoc);
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDoc();}});
dialog.addEventListener('cancel',()=>{queueMicrotask(()=>lastTrigger?.focus?.({preventScroll:true}));});
$('#ask-about-document').addEventListener('click',()=>{const id=activeDoc;closeDoc();const questions={company:"What is SYNK?",lab:"How do students learn at LAB?",shift:"What does SHIFT do?",pulse:"What does PULSE create?",path:"What is PATH?",philosophy:"What is SYNK's philosophy?",vision:"Tell me about all the SYNK brands.",guide:"What can I ask here?"};void ask(questions[id]||questions.company);});
syncInput();

// Optional browser-native agent access uses the exact same visible question flow.
if(document.modelContext?.registerTool){
  const modelContext=document.modelContext,lifecycle=new AbortController();
  try{Promise.resolve(modelContext.registerTool({name:'ask_synk',title:"Ask SYNK",description:'Ask a question about SYNK using its public documents and display the answer in the conversation.',inputSchema:{type:'object',properties:{question:{type:'string',minLength:1,maxLength:500}},required:['question'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(value){if(!value||typeof value.question!=='string'||!value.question.trim()||value.question.length>500||Object.keys(value).some(k=>k!=='question'))throw new Error('question must contain 1–500 characters.');return ask(value.question);}}, {signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
