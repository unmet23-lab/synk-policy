import './atlas/engine.js?v=e16032eea501';
import './atlas/experiences.js?v=e16032eea501';
const A=globalThis.SynkAtlas,X=globalThis.SynkAtlasExperiences;
const key='synk-letter-atlas-v1',scope={domain:'LAB',workspace:'letter-demo',subject:'this-browser'};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const choices={
 goal:{label:'이번에 집중할 것',options:[['explore','직접 해 보며 찾기'],['clarity','내용을 분명하게'],['expression','정중한 표현'],['study','쓰고 다듬는 연습']]},
 time:{label:'지금의 여유',options:[['standard','차근차근'],['short','핵심부터 짧게'],['unlimited','충분히 살펴보기']]},
 support:{label:'도움 방식',options:[['choose','필요한 도움 고르기'],['step','하나씩 살펴보기'],['independent','먼저 혼자 해 보기']]},
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
  panel(){const g=X.guidance(plan),context=session.state().context;return `<section class="atlas-panel" aria-label="나에게 맞추기"><div class="atlas-summary"><strong>${esc(g.title)}</strong><p>${esc(g.description)}</p><p class="atlas-reason">${esc(g.reason)}</p></div><details id="atlas-settings"${open?' open':''}><summary>지금 나에게 맞추기</summary><div class="atlas-settings">${Object.entries(choices).map(([field,def])=>`<label>${esc(def.label)}<select data-atlas-field="${field}">${def.options.map(([value,label])=>`<option value="${value}"${(context[field]||def.options[0][0])===value?' selected':''}>${esc(label)}</option>`).join('')}</select></label>`).join('')}</div><p class="action-note">시간 선택은 지금부터 4시간 동안만 적용해요. 글의 상황과 정답은 바꾸지 않아요.</p><label class="atlas-remember"><input type="checkbox" data-atlas-remember${memory?' checked':''}> 이 브라우저에서 설정과 내 응답 기억하기</label><p class="action-note">설정과 진행·응답 기록만 저장해요. 작성한 글은 저장하지 않으며 서버로 전송하지 않아요. 공용 기기에서는 끄고 사용해 주세요.</p><button type="button" class="quiet" data-action="atlas-clear">설정과 응답 지우기</button></details>${error?`<p role="status">${esc(error)}</p>`:''}</section>`;},
  focus(){return `<p class="atlas-focus">${esc(X.letterFocus(plan.focus))}</p>`;},
  reviewMore(checks){return this.visibleChecks(checks).length<checks.length?'<button type="button" class="quiet" data-action="atlas-all-checks">다른 부분도 살펴보기</button>':'';},
  extra(){return plan.selected.pace==='deep'?'<p class="atlas-focus">한 문장을 다른 표현으로 바꿔 보고 뜻과 말투를 비교해 보세요. 원래 글은 아래에서 다시 볼 수 있어요.</p>':'';},
  feedbackPanel(){const options=[['helpful','이 흐름이 좋았어요'],['too_much','한 번에 볼 게 많았어요'],['want_more','더 해 보고 싶어요'],['not_fit','나에게 맞지 않았어요']];const next=response==='too_much'?'다음에는 확인할 부분을 하나부터 보여드릴게요.':response==='want_more'?'다음에는 다른 표현도 살펴볼 자리를 준비할게요. 시간이 짧으면 핵심부터 진행해요.':response==='helpful'?'다음에도 이 흐름을 고를 때 참고할게요.':response==='not_fit'?'다음 흐름을 고를 때 반영할게요. 원하는 방향도 직접 바꿀 수 있어요.':'';return `<section class="atlas-feedback" aria-labelledby="atlas-feedback-title"><h2 id="atlas-feedback-title">이번 흐름은 어땠나요?</h2><p>글의 점수와 관계없이, 다음 진행 방식을 맞추는 데 써요. 답하지 않아도 괜찮아요.</p><div class="atlas-feedback-options">${options.map(([value,label])=>`<button type="button" class="quiet" data-atlas-feedback="${value}" aria-pressed="${response===value}"${completion?'':' disabled'}>${esc(label)}</button>`).join('')}</div><p role="status">${esc(next)}</p></section>`;},
 };
}
