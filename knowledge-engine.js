// Public-document retrieval. Every factual answer is an authored passage in knowledge.json.
// No generated facts, external search, hidden company files, or model calls.
export const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣\s]/g,' ').replace(/\s+/g,' ').trim();
const compact = value => normalize(value).replace(/\s/g,'');
const generic = new Set(['synk','싱크','lab','랩','shift','시프트','pulse','펄스','어떤','무슨','누구','어디','현재','사람','준비','과정','사용','질문','답변','소개','방법','결과','만든','경험']);
const synonyms=[[/시프트/g,'shift'],[/펄스/g,'pulse'],[/싱크/g,'synk'],[/혼자/g,'1인'],[/창업/g,'사업'],[/배우|배워|배울/g,'배움'],[/브랜드를?\s*만들/g,'브랜딩'],[/인공지능/g,'ai'],[/요금|수강료|비용|얼마(?!나)|금액|가격표|결제/g,'가격'],[/신청|접수/g,'등록'],[/언제|개강|날짜/g,'일정'],[/추천해|골라|어디부터/g,'추천'],[/케이\s*컬처|케이\s*팝|케이팝|k\s*pop/g,'k컬처']];
const normalizeQuery=q=>{let s=normalize(q);for(const [re,v] of synonyms)s=s.replace(re,v);return s;};
const brandIds={lab:'lab-intro',shift:'shift-intro',pulse:'pulse-intro'};
function brandsIn(q){const b=[];for(const brand of ['lab','shift','pulse'])if(new RegExp(`(?:^|[^a-z])${brand}(?:$|[^a-z])`).test(q))b.push(brand);if(/(?:^|\s)랩(?:은|이|에|의|도|에서는|$)/.test(q)&&!b.includes('lab'))b.push('lab');return b;}
function ngrams(text){const c=compact(text);const out=new Set();for(let i=0;i<c.length-1;i++)out.add(c.slice(i,i+2));return out;}
function similarity(a,b){const A=ngrams(a),B=ngrams(b);if(!A.size||!B.size)return 0;let overlap=0;for(const x of A)if(B.has(x))overlap++;return 2*overlap/(A.size+B.size);}

export function createKnowledgeEngine(data){
  if(!data||!Array.isArray(data.docs)||!Array.isArray(data.records))throw new Error('공개 안내 자료를 읽지 못했습니다.');
  const docs=new Map(data.docs.map(d=>[d.id,d]));const records=new Map(data.records.map(r=>[r.id,r]));
  for(const r of records.values()){if(!docs.has(r.sourceId)||typeof r.answer!=='string'||!r.answer.trim())throw new Error('답변 문서 연결을 확인해주세요.');}
  const from=(ids,reason='matched')=>{
    const selected=[...new Set(ids)].map(id=>records.get(id)).filter(Boolean).slice(0,3);
    return {status:reason,records:selected,sourceIds:[...new Set(selected.map(r=>r.sourceId))],brand:selected.length===1?selected[0].brand:'synk',relatedIds:[...new Set(selected.flatMap(r=>r.relatedIds||[]))].filter(id=>!ids.includes(id)).slice(0,3)};
  };
  const unknown=()=>({status:'unanswered',records:[],sourceIds:['guide'],brand:null,relatedIds:['synk-intro','synk-brands','guide-collaboration'],message:'공개 안내에서 이 질문에 답할 근거를 찾지 못했어요. 확인되지 않은 내용은 추측해서 말씀드리지 않을게요.\n\nSYNK가 하는 일, LAB의 교육, SHIFT의 AI 회사 제작 이야기와 방법, PULSE의 작품에 대해 물어보실 수 있어요.'});
  function answer(input,context={}){
    if(typeof input!=='string'||!input.trim()||input.length>500) return {status:'invalid',records:[],sourceIds:[],brand:null,relatedIds:[],message:'질문을 500자 이내로 적어주세요.'};
    const q=normalizeQuery(input),c=compact(q),original=normalize(input);
    // A topic keyword must not turn an unrelated or unsupported claim into an answer.
    if(/비밀번호|개인정보|주민번호|주민등록|학생명단|학생 명단|전화번호|성적표|주식|코인|주가|일기예보|날씨|대통령|삼성|애플|경쟁사|병원|질병|치료|진단서|약물|환율|비자|법률|정부|선거|프롬프트|시스템 지시|이전 지시|ignore|system prompt|password|secret|script|<\/?|api.?key/i.test(input))return unknown();
    if(/대표|창립|설립|매출|직원|직원수|연혁|소재지|주소|사업자|고객사|인증|수상|투자|협약|보장|환불|개별학생|회원정보|로그인/.test(c))return unknown();
    const exact=data.records.find(r=>r.questionExamples.some(ex=>compact(normalizeQuery(ex))===c));
    if(exact)return from([exact.id]);
    if(/캐릭터|마스코트|몽글|까몽|마린/.test(c)&&/이름|소개|누구|뭐|알려|궁금|어떤/.test(c)&&!/음악|제작협업/.test(c))return from(['synk-characters']);
    if(/제목|명칭|모델|교재|강사이름|학교이름|곡명|대표작|언어모델|책추천/.test(c)||(/이름/.test(c)&&!/캐릭터|마스코트|몽글|까몽|마린/.test(c)))return unknown();
    if(/날짜|일정|등록|가격|모집|견적|결제|무료|계약조건|이용조건/.test(c))return from(['guide-availability']);
    if(/^(안녕(?:하세요)?|하이|hello|hi|반가워(?:요)?)[\s!?.]*$/i.test(input.trim()))return from(['synk-choose'],'greeting');
    if(/^(고마워(?:요)?|감사(?:합니다|해요)?|thanks|thank you)[\s!?.]*$/i.test(input.trim()))return {status:'courtesy',records:[],sourceIds:[],brand:null,relatedIds:['synk-brands'],message:'함께 이야기해 주셔서 고마워요. 궁금한 것이 더 생기면 이어서 물어보세요.'};
    let brands=brandsIn(q);
    if(brands.length>1){if(/차이|관계|다르|같|각각|구분|비교|브랜드|사업/.test(q))return from(['synk-brands']);return from(brands.map(b=>brandIds[b]));}
    if(/세(?:가지)?사업|세(?:가지)?브랜드|3개사업|사업구성|브랜드구성|사업구조/.test(c))return from(['synk-brands']);
    if(/(음악|작품|pulse).*(공부|학습|교육|효과|집중력)|(학습|집중력).*(음악|작품|pulse)/.test(c))return from(['pulse-not-study']);
    if(/효과|몇명|몇퍼센트|몇배|실적|성공률/.test(c))return unknown();
    if(/대화.*(저장|기록)|저장.*대화/.test(c))return from(['guide-privacy']);
    if(/챗봇|답변기준|출처|근거|공개문서|무엇을물어|뭐물어|어떻게이용/.test(c))return from(['guide-ask']);
    if(/협업|협력|의뢰|함께일|연락|문의/.test(c))return from([brands.includes('pulse')||/음악|영상|캐릭터/.test(q)?'pulse-collaboration':'guide-collaboration']);
    if(!brands.length&&/synk|회사|기업/.test(q)&&/어떤사업|무슨사업|하는사업|사업을해|무슨일/.test(c)&&!/1인|브랜딩|음악|한국어/.test(q))return from(['synk-intro']);
    if(!brands.length&&/^(그럼|그러면|거기|그곳|그건|그거|더|또|그리고)/.test(q)&&['lab','shift','pulse'].includes(context.brand)&&!/한국어|몽골|학원|브랜딩|1인|음악/.test(q))brands=[context.brand];
    if(!brands.length){
      if(/1인|브랜딩|사업/.test(q))brands=['shift'];
      else if(/음악|라디오|작품|캐릭터|영상|감상|소리/.test(q))brands=['pulse'];
      else if(/한국어|몽골|학생|수업|학원|k컬처|문법|말하기|유학/.test(q))brands=['lab'];
      else if(/^(그럼|그러면|거기|그곳|그건|그거|더|또|그리고)/.test(q)&&['lab','shift','pulse'].includes(context.brand))brands=[context.brand];
    }
    const brand=brands[0];
    if(/철학|가치|중요|믿음|지향|교육과창작|왜.*함께/.test(c))return from(['philosophy-purpose']);
    if(/품질|완성|마무리|사용뒤|완성도/.test(c))return from(['philosophy-quality']);
    if(/(사람|선생님).*(ai|기술)|(ai|기술).*(사람|선생님)|기술.*기준/.test(c))return from(['philosophy-people']);
    if(brand==='lab'){
      if(/누구|대상|성인|청소년|몇살|나이/.test(q))return from(['lab-audience']);
      if(/k컬처|문화|취향|활동/.test(q))return from(['lab-culture']);
      if(/개인|맞춤|이해|선생님|학생마다/.test(q))return from(['lab-personal']);
      if(/어떻게|배움|말하기|문법|표현|연습|방식/.test(q))return from(['lab-learning']);
    }
    if(brand==='shift'){
      if(/다른사업|넓은사업|사업범위|사업방향/.test(c))return from(['shift-scope']);
      if(/짓|제작과정|만든과정|만드는과정|제작이야기|회사제작|실제작업|선택|수정|시도/.test(c))return from(['shift-making']);
      if(/ai|자동화|도구/.test(q))return from(['shift-ai']);
      if(/누구|대상|1인|사업자/.test(q)&&!(/배움|자료|실습|강의/.test(q)))return from(['shift-audience']);
      if(/배움|수업|실습|자료|예시|남|적용|가져/.test(q))return from(['shift-takeaway']);
      if(/제작과정|만든과정|운영도구|실제작업/.test(c))return from(['shift-making']);
    }
    if(brand==='pulse'&&/감상|독서|듣|라디오|휴식|재생/.test(q))return from(['pulse-listening']);
    if(/지금.*(운영|단계|준비|출시)|현재.*(운영|단계|준비|출시)|이미출시|열었/.test(c))return from(['synk-stage']);
    if(/어디부터|처음왔|추천|둘러|시작하면|맞는사업/.test(c))return from(['synk-choose']);
    // An introduction is only an answer to an introduction question. Unknown objects
    // such as "LAB의 카페 메뉴" must not be replaced by an unrelated brand paragraph.
    const introOnly=c.replace(/synk|lab|shift|pulse|소개|알려|궁금|어떤|무슨|무엇|뭐|하는|하고|하나|하니|만들어|만드는|회사|사업|곳|브랜드|작품|일|예요|인가요|해주세요|해줘|주세요|해요|세요|줘|요|야|은|는|을|를|이|가|에|대해|좀|알고싶어|나요|니|다|있/g,'');
    if(brand&&introOnly.length===0)return from([brandIds[brand]]);
    if((/synk|회사|기업/.test(q)&&introOnly.length===0)||c==='synk')return from(['synk-intro']);
    const candidates=data.records.filter(r=>!brand||r.brand===brand||r.id.startsWith('philosophy-')).map(r=>{
      const hits=r.keywords.filter(k=>!generic.has(compact(k))&&compact(k).length>1&&c.includes(compact(k)));
      const sim=Math.max(...r.questionExamples.map(ex=>similarity(q,normalizeQuery(ex))),0);
      return {id:r.id,hits,sim,score:hits.length*2+sim*3};
    }).sort((a,b)=>b.score-a.score);
    const best=candidates[0];
    if(best&&((best.hits.length>=2&&best.sim>=.18)||(best.hits.length>=1&&best.sim>=.55)))return from([best.id]);
    return unknown();
  }
  return {answer,docs,records};
}
