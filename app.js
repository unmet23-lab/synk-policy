import {createKnowledgeEngine} from './knowledge-engine.js?v=4ee8278a4f';
import {appendPublicActions} from './public-actions.js?v=4ee8278a4f';
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
$('#copy-email').addEventListener('click',async()=>{try{await navigator.clipboard.writeText('hello@synk.im');toast('이메일 주소를 복사했어요.');}catch{toast('hello@synk.im 주소를 선택해 복사해 주세요.');}});
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function toast(text){const el=$('#toast');el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2400);}
function syncInput(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,160)+'px';send.disabled=busy||!input.value.trim();}
function paragraphs(parent,text){String(text).split(/\n\n/).forEach(p=>parent.append(element('p','',p)));}
let pending=null;
function startKnowledge(){
 if(pending)return pending;
 pending=fetch('/knowledge.json?v=457789da4cb7').then(r=>{if(!r.ok)throw new Error('자료를 불러오지 못했어요.');return r.json();}).then(data=>{
  engine=createKnowledgeEngine(data);return engine;
}).catch(error=>{console.error('Public notes unavailable');$('#answer-note').textContent='공개 안내를 불러오지 못했어요. 질문을 보내 다시 시도해 주세요.';throw error;});
// A background failure should not become an unhandled rejection before anyone asks.
 pending.catch(()=>{});
 return pending;
}
if(document.body.dataset.site!=='synk'||document.documentElement.dataset.entryView!=='intro')startKnowledge();
else document.addEventListener('synk:company-view',startKnowledge,{once:true});

async function getEngine(){if(engine)return engine;try{return await startKnowledge();}catch{const r=await fetch('/knowledge.json?v=457789da4cb7',{cache:'reload'});if(!r.ok)throw new Error('자료를 불러오지 못했어요. 잠시 뒤 다시 질문해 주세요.');engine=createKnowledgeEngine(await r.json());$('#answer-note').textContent=readyNote;return engine;}}
function showAnswers(){document.dispatchEvent(new Event('synk:show-answers'));}
function enterChat(){showAnswers();conversation.classList.add('is-chatting');$('#introduction').hidden=true;$('#chat-area').hidden=false;}
function focusQuestion(){showAnswers();input.focus({preventScroll:true});if(!conversation.closest('.orb-help'))(conversation.closest('.help-frame')||conversation).scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
function reset(){context=initialContext();messages.replaceChildren();conversation.classList.remove('is-chatting');$('#introduction').hidden=false;$('#chat-area').hidden=true;input.value='';syncInput();input.focus({preventScroll:true});document.dispatchEvent(new CustomEvent('synk:orb-state',{detail:'idle'}));}
function appendAnswer(result){
  const article=element('article','message-assistant');article.dataset.status=result.status;
  const label=element('div','message-label');const mark=element('img','answer-wordmark');mark.src='/assets/brand-synk.webp?v=20260910-story';mark.alt='SYNK';mark.width=744;mark.height=360;label.append(mark,element('span','',result.status==='restricted'?'공개 가능한 내용':result.status==='needs_confirmation'?'문의가 필요한 내용':'SYNK 안내'));article.append(label);
  const body=element('div','answer-text');
  if(result.message)paragraphs(body,result.message);
  for(const record of result.records){
    if(result.records.length>1)body.append(element('h3','',record.title));
    const parts=record.answer.split(/\n\n/),focus=result.focus?.[record.id];
    paragraphs(body,parts[0]);
    // Keep the reviewed passage closest to the question visible; the rest stays in its original order.
    if(focus>0&&focus<parts.length)paragraphs(body,parts[focus]);
    const rest=parts.filter((_,i)=>i>0&&i!==focus);
    if(rest.length){const more=element('details','answer-more');more.open=!!result.expanded;more.append(element('summary','','자세히 보기'));const extended=element('div','');rest.forEach(p=>paragraphs(extended,p));more.append(extended);body.append(more);}
  }
  article.append(body);const dates=[...new Set(result.records.map(r=>r.reviewedAt).filter(Boolean))];if(dates.length)article.append(element('p','answer-reviewed','공개 자료 확인 · '+dates.sort().at(-1)));
  const sources=element('div','answer-sources');
  result.sourceIds.forEach((id,i)=>{const doc=engine.docs.get(id);if(!doc)return;const button=element('button','source-button');button.type='button';button.dataset.doc=id;button.dataset.recordId=result.records.find(r=>r.sourceId===id)?.id||'';button.append(element('span','',String(i+1).padStart(2,'0')),document.createTextNode(doc.title.split(' — ')[0]+' · 출처 보기 ↗'));sources.append(button);});
  const copy=element('button','copy-answer','답변 복사');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText([result.message,...result.records.map(r=>r.answer)].filter(Boolean).join('\n\n'));toast('답변을 복사했어요.');}catch{toast('복사를 사용할 수 없어요. 답변을 선택해 복사해 주세요.');}});sources.append(copy);article.append(sources);
  appendPublicActions(article,result.records);
  const related=element('div','related-questions');
  result.relatedIds.slice(0,result.status==='clarify'?3:2).forEach(id=>{const r=engine.records.get(id);if(!r)return;const b=element('button','',r.title);b.type='button';b.dataset.ask=r.questionExamples[0];related.append(b);});if(related.childNodes.length)article.append(related);
  messages.append(article);
}
async function ask(text,{scroll=true}={}){
  const question=String(text||'').trim();if(!question)return {status:'invalid'};if(question.length>500){toast('질문을 500자 이내로 적어주세요.');return {status:'invalid'};}if(busy)return {status:'busy'};
  busy=true;form.setAttribute('aria-busy','true');document.dispatchEvent(new CustomEvent('synk:orb-state',{detail:'busy'}));syncInput();
  try{
    await getEngine();enterChat();
    const previous=[...messages.children].filter(el=>!el.classList.contains('orb-history'));
    if(previous.length){let history=messages.querySelector('.orb-history');if(!history){history=element('details','orb-history');history.append(element('summary','','이전 대화'));messages.prepend(history);}previous.forEach(el=>history.append(el));while(history.children.length>21){history.children[1].remove();history.children[1]?.remove();}history.open=false;history.querySelector('summary').textContent='이전 대화 '+history.querySelectorAll('.message-user').length+'개';}
    const questionEl=element('div','message-user',question);messages.append(questionEl);
    const result=engine.answer(question,context);appendAnswer(result);
    if(['matched','needs_confirmation'].includes(result.status))context={brand:['lab','shift','pulse','path'].includes(result.brand)?result.brand:context.brand,recordIds:result.records.map(r=>r.id)};
    else if(!['clarify','courtesy'].includes(result.status))context=initialContext();
    input.value='';if(scroll){focusQuestion();questionEl.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
    // Bound DOM/session memory. No conversation data is persisted.
    while(messages.children.length>24){messages.firstElementChild.remove();messages.firstElementChild?.remove();}
    return {status:result.status,answer:result.message||result.records.map(r=>r.answer).join('\n\n'),sources:result.sourceIds.map(id=>({id,title:engine.docs.get(id)?.title})),brand:result.brand};
  }catch(error){toast(error.message||'자료를 불러오는 중 문제가 생겼어요. 다시 질문해 주세요.');return {status:'error'};}
  finally{busy=false;form.setAttribute('aria-busy','false');document.dispatchEvent(new CustomEvent('synk:orb-state',{detail:'idle'}));syncInput();}
}
async function openDoc(id,trigger){
  try{
    await getEngine();const doc=engine.docs.get(id);if(!doc)return;
    activeDoc=id;if(!dialog.open)lastTrigger=trigger||document.activeElement;
    $('#document-title').textContent=doc.title.split(' — ').slice(1).join(' — ')||doc.title;
    $('#document-brand').textContent=(names[id]||'SYNK')+' · '+doc.updatedAt+' 확인';
    const body=$('#document-body');body.replaceChildren();let target=null;
    for(const record of engine.records.values()){
      if(record.sourceId!==id)continue;
      const section=element('section','document-answer');section.dataset.recordId=record.id;
      section.append(element('h3','',record.title));paragraphs(section,record.answer);body.append(section);
      if(record.id===trigger?.dataset.recordId)target=section;
    }
    $('#document-related').replaceChildren();
    for(const related of ['company','lab','shift','pulse','path','vision']){
      if(related===id)continue;const b=element('button','',(related==='vision'?'브랜드 소개':names[related])+' ↗');b.type='button';b.dataset.doc=related;$('#document-related').append(b);
    }
    if(!dialog.open)dialog.showModal();dialog.scrollTop=0;$('#close-document').focus({preventScroll:true});
    if(target)target.scrollIntoView({behavior:'instant',block:'start'});
  }catch{toast('안내 문서를 불러오지 못했습니다. 다시 열어주세요.');}
}
function closeDoc(){dialog.close();lastTrigger?.focus?.({preventScroll:true});}
form.addEventListener('submit',event=>{event.preventDefault();void ask(input.value);});
input.addEventListener('input',syncInput);
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(input.value.trim())void ask(input.value);}});
document.addEventListener('click',event=>{const q=event.target.closest('[data-ask]');if(q){void ask(q.dataset.ask);return;}const d=event.target.closest('[data-doc]');if(d){void openDoc(d.dataset.doc,d);return;}const a=event.target.closest('a[href="#question"]');if(a){event.preventDefault();focusQuestion();}});
$('#reset').addEventListener('click',reset);$('#close-document').addEventListener('click',closeDoc);
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDoc();}});
dialog.addEventListener('cancel',()=>{queueMicrotask(()=>lastTrigger?.focus?.({preventScroll:true}));});
$('#ask-about-document').addEventListener('click',()=>{const id=activeDoc;closeDoc();const questions={company:'SYNK는 어떤 회사인가요?',lab:'LAB에서는 어떻게 배우나요?',shift:'SHIFT는 어떤 일을 하나요?',pulse:'PULSE는 어떤 작품을 만드나요?',path:'PATH는 어떤 곳인가요?',philosophy:'SYNK의 철학은 무엇인가요?',vision:'브랜드 소개를 모두 알려 주세요',guide:'무엇을 물어볼 수 있나요?'};void ask(questions[id]||questions.company);});
syncInput();

// Optional browser-native agent access uses the exact same visible question flow.
if(document.modelContext?.registerTool){
  const modelContext=document.modelContext,lifecycle=new AbortController();
  try{Promise.resolve(modelContext.registerTool({name:'ask_synk',title:'SYNK에 질문하기',description:'Ask a question about SYNK using its public documents and display the answer in the conversation.',inputSchema:{type:'object',properties:{question:{type:'string',minLength:1,maxLength:500}},required:['question'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(value){if(!value||typeof value.question!=='string'||!value.question.trim()||value.question.length>500||Object.keys(value).some(k=>k!=='question'))throw new Error('question must contain 1–500 characters.');return ask(value.question);}}, {signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
