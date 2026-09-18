import './atlas/engine.js?v=8b9ef8254860';
import './atlas/experiences.js?v=8b9ef8254860';
const A=globalThis.SynkAtlas,X=globalThis.SynkAtlasExperiences;
const key='synk-letter-atlas-v1',scope={domain:'LAB',workspace:'letter-demo',subject:'this-browser'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const choices={
 goal:{label:'중점적으로 연습할 내용',options:[['explore','직접 써 보며 정하기'],['clarity','요청 기간을 정확하게 쓰기'],['expression','정중한 높임말 쓰기'],['study','내 글을 읽고 고치기']]},
 time:{label:'연습 분량',options:[['standard','기본 분량'],['short','짧게 연습하기'],['unlimited','충분히 연습하기']]},
 support:{label:'점검 항목을 보는 방법',options:[['choose','필요한 항목 고르기'],['step','한 항목부터 보기'],['independent','필요할 때 직접 열기']]},
};
export function createAtlasUI({storage=null,clock=()=>new Date().toISOString()}={}){
 let memory=false,error='',session,plan,completion=null,response=null,open=false,allChecks=false;
 try{const raw=storage?.getItem(key);if(raw){const saved=JSON.parse(raw);if(saved.version!==1||!Array.isArray(saved.events))throw Error('format');session=A.createSession({scope,events:saved.events,clock});memory=true;}}
 catch{error='지난 설정을 읽지 못했어요. 이번에는 기본 흐름으로 시작해요.';}
 session ||= A.createSession({scope,clock});
 const persist=()=>{if(memory)try{storage.setItem(key,JSON.stringify({version:1,events:session.events()}));}catch{memory=false;error='저장하지 못했어요. 이번 페이지에서만 반영해요.';}};
 let contextStamp='';
 const replan=()=>{plan=session.plan('professor-letter',X.modesFor('LAB'));contextStamp=JSON.stringify(session.state().context);persist();};replan();
 const selectedChecks=checks=>{const preferred=plan.focus==='expression'?'tone':plan.focus==='clarity'?'clarity':'purpose';return [...checks].sort((a,b)=>Number(b.id===preferred)-Number(a.id===preferred));};
 return {
  get plan(){return plan;},get completion(){return completion;},get allChecks(){return allChecks;},set allChecks(v){allChecks=v;},get open(){return open;},set open(v){open=v;},selectedChecks,
  refresh(){if(JSON.stringify(session.state().context)!==contextStamp)replan();},
  visibleChecks(checks){const sorted=selectedChecks(checks);if(!allChecks&&plan.support==='independent')return [];return !allChecks&&(plan.selected.pace==='short'||plan.support==='step')?sorted.slice(0,1):sorted;},
  set(field,value){session.set(field,value,field==='time'?new Date(Date.parse(clock())+4*3600000).toISOString():null);allChecks=false;replan();},
  resetRound(){completion=null;response=null;allChecks=false;replan();},
  complete(){if(!completion||completion.decisionId!==plan.id){completion=session.complete(plan);response=null;}persist();},
  feedback(value){if(!completion)return;session.feedback(completion.id,value);response=value;persist();},
  remember(value){
   if(!storage){error='이 브라우저에서는 저장할 수 없어요.';return;}
   if(!value){try{storage.removeItem(key);memory=false;}catch{error='저장된 설정을 지우지 못했어요. 브라우저의 사이트 데이터를 확인해 주세요.';}return;}
   memory=true;persist();
  },
  clear(){try{storage?.removeItem(key);}catch{error='저장된 설정을 지우지 못했어요. 브라우저의 사이트 데이터를 확인해 주세요.';return false;}memory=false;session.clear();completion=null;response=null;allChecks=false;error='';replan();return true;},
  panel(){const g=X.guidance(plan),context=session.state().context;return `<section class="atlas-panel" aria-label="연습 설정"><div class="atlas-summary"><strong>${esc(g.title)}</strong><p>${esc(g.description)}</p><p class="atlas-reason">${esc(g.reason)}</p></div><details id="atlas-settings"${open?' open':''}><summary>연습 분량과 도움 방식 바꾸기</summary><div class="atlas-settings">${Object.entries(choices).map(([field,def])=>`<label>${esc(def.label)}<select data-atlas-field="${field}">${def.options.map(([value,label])=>`<option value="${value}"${(context[field]||def.options[0][0])===value?' selected':''}>${esc(label)}</option>`).join('')}</select></label>`).join('')}</div><p class="action-note">연습 분량 선택은 4시간 뒤 기본값으로 돌아갑니다. 연습 시간에는 제한이 없으며, 메일에 쓸 상황과 요청 사항은 그대로입니다.</p><label class="atlas-remember"><input type="checkbox" data-atlas-remember${memory?' checked':''}> 이 브라우저에 설정과 연습 기록 저장</label><p class="action-note">설정, 완료 여부, 연습 후 선택한 답변만 저장합니다. 작성한 글은 저장하거나 서버로 보내지 않습니다. 공용 기기에서는 저장을 끄고 이용해 주세요.</p><button type="button" class="quiet" data-action="atlas-clear">설정과 연습 기록 초기화</button></details>${error?`<p role="status">${esc(error)}</p>`:''}</section>`;},
  focus(){return `<p class="atlas-focus">${esc(X.letterFocus(plan.focus))}</p>`;},
  reviewMore(checks){const count=this.visibleChecks(checks).length;return count<checks.length?`<button type="button" class="quiet" data-action="atlas-all-checks">${count?'점검 항목 모두 보기':'점검 항목 보기'}</button>`:'';},
  extra(){return plan.selected.pace==='deep'?'<p class="atlas-focus">한 문장을 다른 표현으로 바꿔 보고 뜻과 말투를 비교해 보세요. 원래 글은 아래에서 다시 볼 수 있어요.</p>':'';},
  feedbackPanel(){const options=[['helpful','적당했어요'],['too_much','확인할 내용이 많았어요'],['want_more','조금 더 연습하고 싶어요'],['not_fit','나에게 맞지 않았어요']];const next=response==='too_much'?'다음 연습에서는 점검 항목을 한 개부터 보여드립니다.':response==='want_more'?'다음 연습에서는 다른 표현을 비교하는 안내도 추가합니다. 짧게 연습하도록 설정하면 해당 설정을 우선합니다.':response==='helpful'?'다음 연습의 분량과 도움 방식을 정할 때 참고합니다.':response==='not_fit'?'다음 연습 방식을 정할 때 참고합니다. 위의 연습 설정도 직접 바꿀 수 있습니다.':'';return `<section class="atlas-feedback" aria-labelledby="atlas-feedback-title"><h2 id="atlas-feedback-title">연습 분량과 도움 방식은 어땠나요?</h2><p>선택한 답변은 다음 연습의 분량과 도움 방식을 조정할 때 참고합니다. 답하지 않아도 됩니다.</p><div class="atlas-feedback-options">${options.map(([value,label])=>`<button type="button" class="quiet" data-atlas-feedback="${value}" aria-pressed="${response===value}"${completion?'':' disabled'}>${esc(label)}</button>`).join('')}</div><p role="status">${esc(next)}</p></section>`;},
 };
}
