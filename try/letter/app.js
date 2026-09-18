import {copy} from './data.js?v=8b9ef8254860';
import {createViews} from './views.js?v=8b9ef8254860';
import {createSession,updateDraft,beginReview,finishLetter} from './session.js?v=8b9ef8254860';
import {createAtlasUI} from './atlas-ui.js?v=8b9ef8254860';
const main=document.querySelector('#experience'),notice=document.querySelector('#notice'),dialog=document.querySelector('#restart-dialog');
const state=createSession(),views=createViews(state);
let atlasStorage=null;try{atlasStorage=window.localStorage;}catch{}
state.atlas=createAtlasUI({storage:atlasStorage});
const embedded=window.parent!==window&&new URLSearchParams(location.search).get('embed')==='lab';
if(embedded)document.documentElement.classList.add('lab-embedded');
function notifyHost(focus=false){
 if(!embedded)return;
 parent.postMessage({type:'synk:letter-view',stage:state.stage,height:Math.ceil(document.body.getBoundingClientRect().height)+2,focus},location.origin);
}
const resizeObserver=embedded?new ResizeObserver(()=>notifyHost()):null;
resizeObserver?.observe(document.body);
let blinkTimer, blinkObserver;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
function stopBlink() {
  clearTimeout(blinkTimer);
  document.querySelectorAll('.room').forEach(element=>element.removeAttribute('data-blink'));
}
function startBlink() {
  stopBlink();
  if (reduced.matches || document.hidden) return;
  const blink = () => {
    if (reduced.matches || document.hidden) return stopBlink();
    const visible = [...document.querySelectorAll('.room')].filter(element=>element.dataset.visible==='true');
    if (!visible.length) return;
    visible.forEach(element=>element.dataset.blink='true');
    blinkTimer = setTimeout(()=>{visible.forEach(element=>element.removeAttribute('data-blink'));blinkTimer=setTimeout(blink,7200);},140);
  };
  blinkTimer=setTimeout(blink,2200);
}
function observeRooms() {
  blinkObserver?.disconnect();
  blinkObserver = new IntersectionObserver(entries=>{entries.forEach(entry=>entry.target.dataset.visible=String(entry.isIntersecting));if ([...document.querySelectorAll('.room')].some(element=>element.dataset.visible==='true'))startBlink();else stopBlink();});
  document.querySelectorAll('.room').forEach(element=>blinkObserver.observe(element));
}

function render(focusSelector){
 stopBlink();
 state.atlas.open=main.querySelector('#atlas-settings')?.open??state.atlas.open;
 state.atlas.refresh();
 const screens={story:views.story,write:views.writing,review:views.review,done:views.done};
 main.innerHTML=views.intro()+(state.stage==='story'?'':state.atlas.panel())+screens[state.stage]();observeRooms();
 main.querySelector('#atlas-settings')?.addEventListener('toggle',event=>{if(event.target.isConnected)state.atlas.open=event.target.open;});
 if(embedded)main.querySelectorAll('.letter-original').forEach(element=>element.tabIndex=0);
 if(focusSelector){const el=main.querySelector(focusSelector);el?.focus({preventScroll:true});el?.scrollIntoView({block:'start',behavior:'instant'});}
 requestAnimationFrame(()=>notifyHost(focusSelector==='h1'));
}
function reset(){const atlas=state.atlas;Object.assign(state,createSession());state.atlas=atlas;atlas.resetRound();render('h1');notice.textContent='';}
function refreshHints(selector){
 main.querySelector('#hints-panel').innerHTML=views.hints();
 main.querySelector(selector)?.focus({preventScroll:true});
}
main.addEventListener('click',event=>{
 const b=event.target.closest('button');if(!b)return;
 if(b.dataset.atlasFeedback){state.atlas.feedback(b.dataset.atlasFeedback);render('[data-atlas-feedback="'+b.dataset.atlasFeedback+'"]');return;}
 if(b.dataset.guide){state.guide=b.dataset.guide;state.hintsOpen=false;state.hint=null;state.hintMore=false;render('[data-guide="'+state.guide+'"]');return;}
 if(b.dataset.hint){state.hint=b.dataset.hint;state.hintMore=false;refreshHints('[data-hint="'+state.hint+'"]');return;}
 const action=b.dataset.action;
 if(action==='atlas-clear'){const cleared=state.atlas.clear();render('#atlas-settings summary');notice.textContent=cleared?'설정과 응답을 지웠어요. 작성 중인 글은 그대로예요.':'설정을 지우지 못했어요.';return;}
 if(action==='atlas-all-checks'){state.atlas.allChecks=true;render('[data-check]');return;}
 if(action==='toggle-hints'){state.hintsOpen=!state.hintsOpen;refreshHints('[data-action="toggle-hints"]');return;}
 if(action==='more-hint'){state.hintMore=true;refreshHints('[data-hint="'+state.hint+'"]');return;}
 if(['write','story','review'].includes(action)){
  if(action==='write'&&!state.guide)return;
  state.stage=action;render('h1');return;
 }
 if(action==='restart'){if(state.draft)dialog.showModal();else reset();}
 if(action==='download'){
  const url=URL.createObjectURL(new Blob([state.final],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');
  a.href=url;a.download=copy.ui.downloadFilename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notice.textContent=copy.ui.downloadNotice;
 }
});
main.addEventListener('input',event=>{
 if(event.target.id!=='letter-body')return;
 updateDraft(state,event.target.value);main.querySelector('#writing-error').textContent='';
 main.querySelectorAll('[data-check]').forEach(el=>el.checked=false);
});
main.addEventListener('change',event=>{
 if(event.target.dataset.atlasField){const field=event.target.dataset.atlasField;state.atlas.set(field,event.target.value);render('[data-atlas-field="'+field+'"]');notice.textContent='현재 선택에 맞춰 진행 방식을 바꿨어요. 작성한 글은 그대로예요.';return;}
 if(event.target.hasAttribute('data-atlas-remember')){state.atlas.remember(event.target.checked);render('[data-atlas-remember]');return;}
 const id=event.target.dataset.check;if(!id||!copy.checks.some(c=>c.id===id))return;
 state.checks=state.checks.filter(c=>c!==id);if(event.target.checked)state.checks.push(id);
});
main.addEventListener('submit',event=>{
 event.preventDefault();if(event.target.id!=='letter-form')return;
 updateDraft(state,main.querySelector('#letter-body').value);
 const valid=state.stage==='write'?beginReview(state):finishLetter(state);
 if(!valid){main.querySelector('#writing-error').textContent=copy.ui.emptyError;main.querySelector('#letter-body').focus();return;}
 if(state.stage==='done')state.atlas.complete();
 render('h1');
});
document.querySelector('#restart-cancel').addEventListener('click',()=>dialog.close());
document.querySelector('#restart-confirm').addEventListener('click',()=>{dialog.close();reset();});
document.addEventListener('visibilitychange',()=>document.hidden?stopBlink():startBlink());
reduced.addEventListener('change',startBlink);
window.addEventListener('pagehide',()=>{stopBlink();blinkObserver?.disconnect();resizeObserver?.disconnect();});
window.addEventListener('pageshow',()=>{observeRooms();resizeObserver?.observe(document.body);notifyHost();});
render();
