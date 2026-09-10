import {createKnowledgeEngine} from './knowledge-engine.js';
const $=s=>document.querySelector(s);
const conversation=$('#questions'),form=$('#question-form'),input=$('#question'),send=$('#send'),messages=$('#messages'),dialog=$('#document-dialog');
let engine=null,context={},busy=false,activeDoc=null,lastTrigger=null,toastTimer;
const readyNote=$('#answer-note').textContent;
const names={company:'SYNK',lab:'SYNK LAB',shift:'SYNK SHIFT',pulse:'SYNK PULSE',philosophy:'SYNK',guide:'SYNK'};
function element(tag,cls,text){const el=document.createElement(tag);if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el;}
function toast(text){const el=$('#toast');el.textContent=text;el.hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.hidden=true,2400);}
function syncInput(){input.style.height='auto';input.style.height=Math.min(input.scrollHeight,160)+'px';send.disabled=busy||!input.value.trim();}
function paragraphs(parent,text){String(text).split(/\n\n/).forEach(p=>parent.append(element('p','',p)));}
const pending=fetch('/knowledge.json?v=20260910-story').then(r=>{if(!r.ok)throw new Error('자료를 불러오지 못했어요.');return r.json();}).then(data=>{
  engine=createKnowledgeEngine(data);return engine;
}).catch(error=>{console.error('Public notes unavailable');$('#answer-note').textContent='공개 안내를 불러오지 못했어요. 질문을 보내 다시 시도해 주세요.';throw error;});
// Keep the initial document load from producing an unhandled rejection when no one asks.
pending.catch(()=>{});

async function getEngine(){if(engine)return engine;try{return await pending;}catch{const r=await fetch('/knowledge.json?v=20260910-story',{cache:'reload'});if(!r.ok)throw new Error('자료를 불러오지 못했어요. 잠시 뒤 다시 질문해 주세요.');engine=createKnowledgeEngine(await r.json());$('#answer-note').textContent=readyNote;return engine;}}
function enterChat(){conversation.classList.add('is-chatting');$('#introduction').hidden=true;$('#chat-area').hidden=false;}
function focusQuestion(){input.focus({preventScroll:true});conversation.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});}
function reset(){context={};messages.replaceChildren();conversation.classList.remove('is-chatting');$('#introduction').hidden=false;$('#chat-area').hidden=true;input.value='';syncInput();input.focus({preventScroll:true});}
function appendAnswer(result){
  const article=element('article','message-assistant');
  const label=element('div','message-label');const mark=element('img','answer-wordmark');mark.src='/assets/brand-synk.webp?v=20260910-story';mark.alt='SYNK';mark.width=744;mark.height=360;label.append(mark,element('span','','공개 문서 안내'));article.append(label);
  const body=element('div','answer-text');
  if(result.message)paragraphs(body,result.message);
  for(const record of result.records){if(result.records.length>1)body.append(element('h3','',record.title));paragraphs(body,record.answer);}
  article.append(body);
  const sources=element('div','answer-sources');
  result.sourceIds.forEach((id,i)=>{const doc=engine.docs.get(id);if(!doc)return;const button=element('button','source-button');button.type='button';button.dataset.doc=id;button.append(element('span','',String(i+1).padStart(2,'0')),document.createTextNode(doc.title.split(' — ')[0]+' · 근거 읽기 ↗'));sources.append(button);});
  const copy=element('button','copy-answer','답변 복사');copy.type='button';copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(body.innerText);toast('답변을 복사했어요.');}catch{toast('복사를 사용할 수 없어요. 답변을 선택해 복사해 주세요.');}});sources.append(copy);article.append(sources);
  const actions=element('div','answer-actions');const used=new Set();
  for(const record of result.records){if(!record.action||used.has(record.action.href)||!/^#(?:worlds|lab|shift|pulse)$/.test(record.action.href))continue;used.add(record.action.href);const a=element('a','answer-action',record.action.label+' ↗');a.href=record.action.href;actions.append(a);}if(actions.childNodes.length)article.append(actions);
  const related=element('div','related-questions');
  result.relatedIds.slice(0,2).forEach(id=>{const r=engine.records.get(id);if(!r)return;const b=element('button','',r.title);b.type='button';b.dataset.ask=r.questionExamples[0];related.append(b);});if(related.childNodes.length)article.append(related);
  messages.append(article);article.scrollIntoView({behavior:'instant',block:'nearest'});
}
async function ask(text,{scroll=true}={}){
  const question=String(text||'').trim();if(!question)return {status:'invalid'};if(question.length>500){toast('질문을 500자 이내로 적어주세요.');return {status:'invalid'};}if(busy)return {status:'busy'};
  busy=true;form.setAttribute('aria-busy','true');syncInput();
  try{
    await getEngine();enterChat();
    messages.append(element('div','message-user',question));
    const result=engine.answer(question,context);appendAnswer(result);
    if(result.status==='matched'&&result.brand)context={brand:result.brand};else if(result.status==='unanswered')context={};
    input.value='';if(scroll)focusQuestion();
    // Bound DOM/session memory. No conversation data is persisted.
    while(messages.children.length>24){messages.firstElementChild.remove();messages.firstElementChild?.remove();}
    return {status:result.status,answer:result.message||result.records.map(r=>r.answer).join('\n\n'),sources:result.sourceIds.map(id=>({id,title:engine.docs.get(id)?.title})),brand:result.brand};
  }catch(error){toast(error.message||'자료를 불러오는 중 문제가 생겼어요. 다시 질문해 주세요.');return {status:'error'};}
  finally{busy=false;form.setAttribute('aria-busy','false');syncInput();}
}
async function openDoc(id,trigger){
  try{await getEngine();const doc=engine.docs.get(id);if(!doc)return;activeDoc=id;if(!dialog.open)lastTrigger=trigger||document.activeElement;$('#document-title').textContent=doc.title.split(' — ').slice(1).join(' — ')||doc.title;$('#document-brand').textContent=names[id]||'SYNK';$('#document-body').replaceChildren();for(const p of doc.paragraphs)paragraphs($('#document-body'),p);$('#document-related').replaceChildren();for(const related of ['company','lab','shift','pulse']){if(related===id)continue;const b=element('button','',names[related]+' ↗');b.type='button';b.dataset.doc=related;$('#document-related').append(b);}if(!dialog.open)dialog.showModal();dialog.scrollTop=0;$('#close-document').focus({preventScroll:true});}catch{toast('안내 문서를 불러오지 못했어요. 다시 열어주세요.');}}
function closeDoc(){dialog.close();lastTrigger?.focus?.({preventScroll:true});}
form.addEventListener('submit',event=>{event.preventDefault();void ask(input.value);});
input.addEventListener('input',syncInput);
input.addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.isComposing){event.preventDefault();if(input.value.trim())void ask(input.value);}});
document.addEventListener('click',event=>{const q=event.target.closest('[data-ask]');if(q){void ask(q.dataset.ask);return;}const d=event.target.closest('[data-doc]');if(d){void openDoc(d.dataset.doc,d);return;}const a=event.target.closest('a[href="#question"]');if(a){event.preventDefault();focusQuestion();}});
$('#reset').addEventListener('click',reset);$('#close-document').addEventListener('click',closeDoc);
dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeDoc();}});
dialog.addEventListener('cancel',()=>{queueMicrotask(()=>lastTrigger?.focus?.({preventScroll:true}));});
$('#ask-about-document').addEventListener('click',()=>{const id=activeDoc;closeDoc();const questions={company:'SYNK는 어떤 회사인가요?',lab:'LAB에서는 어떻게 배우나요?',shift:'SHIFT의 AI 회사 제작 이야기가 궁금해요',pulse:'PULSE는 어떤 작품을 만드나요?',philosophy:'SYNK의 철학은 무엇인가요?',guide:'무엇을 물어볼 수 있나요?'};void ask(questions[id]||questions.company);});
syncInput();

// Optional browser-native agent access uses the exact same visible question flow.
if(document.modelContext?.registerTool){
  const modelContext=document.modelContext,lifecycle=new AbortController();
  try{Promise.resolve(modelContext.registerTool({name:'ask_synk',title:'SYNK에 질문하기',description:'Ask a question about SYNK using its public documents and display the answer in the conversation.',inputSchema:{type:'object',properties:{question:{type:'string',minLength:1,maxLength:500}},required:['question'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},async execute(value){if(!value||typeof value.question!=='string'||!value.question.trim()||value.question.length>500||Object.keys(value).some(k=>k!=='question'))throw new Error('question must contain 1–500 characters.');return ask(value.question);}}, {signal:lifecycle.signal})).catch(()=>{});}catch{}
  window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});
}
