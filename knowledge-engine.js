// Reviewed public passages only; no internal files, private records or model calls.
export const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣\s]/g,' ').replace(/\s+/g,' ').trim();
const compact = value => normalize(value).replace(/\s/g,'');
const normalizeQuery = value => normalize(value).replace(/시프트/g,'shift').replace(/패스/g,'path').replace(/펄스/g,'pulse').replace(/싱크/g,'synk').replace(/인공지능|챗\s*지피티|챗\s*gpt|chat\s*gpt|지피티|(?<![a-z])gpt(?![a-z])/g,'ai').replace(/hangeul|hanguel|hangul/g,'한글').replace(/유툽|유튭/g,'유튜브').replace(/취직/g,'취업').replace(/음원/g,'음악').replace(/이력(?!서)/g,'기록').replace(/초급자/g,'초보').replace(/뭔데|뭔지|뭔가요|뭔/g,'뭐').replace(/케이\s*팝|케이팝|k\s*팝|k\s*pop|케이\s*컬처|아이돌/g,'k컬처');
const brandIds={lab:'lab-intro',shift:'shift-intro',pulse:'pulse-intro',path:'path-intro'};
function brandsIn(q){const out=['lab','shift','pulse','path'].filter(b=>new RegExp('(?:^|[^a-z])'+b+'(?:$|[^a-z])').test(q));if(/(?:^|\s)랩(?=\s|은|이|에|의|도|에서|$)/.test(q)&&!out.includes('lab'))out.push('lab');return out;}

// Retrieval ranks the reviewed titles, example questions, keywords and answer passages.
// It tolerates spacing, endings, typing slips and everyday synonyms, and only chooses
// among existing public answers. It never writes or sends a sentence anywhere.
const en=words=>'(?<![a-z])(?:'+words+')(?![a-z])';
const CONCEPTS=[
  ['토픽','한국어\\s*능력\\s*시험|토픽|'+en('topik')],
  ['비용','학원비|수업료|수강비|수강료|교육비|레슨비|등록비|등록금|학비|요금|가격|비용|견적|얼마(?!나)|얼마나\\s*(?:들|드|해요|하나요|내야)|'+en('price|prices|pricing|fee|fees|tuition|cost|costs')],
  ['선생님','선생님|선생|쌤|교사|강사|티처|튜터|'+en('teachers?|tutors?|instructors?')],
  ['수업','수업|클래스|레슨|'+en('class|classes|lessons?')],
  ['강의','강의|강좌|특강|'+en('lectures?')],
  ['교육','교육|연수|트레이닝|워크숍|워크샵|세미나|'+en('training|workshops?|education')],
  ['회화','회화|말하기|스피킹|'+en('speaking|conversation')],
  ['듣기','듣기|청해|'+en('listening')],
  ['한국어','한국어|한국말|한글|'+en('korean')],
  ['영어','영어|'+en('english')],
  ['학생','학생|학습자|수강생|'+en('students?|learners?')],
  ['아이','자녀|애들|우리\\s*애|초등학생|중학생|고등학생|청소년|'+en('kids?|child|children|teens?')],
  ['보호자','학부모|부모님|부모|엄마|아빠|어머니|아버지|보호자|'+en('parents?')],
  ['위치','위치|주소|장소|지점|캠퍼스|'+en('location|address|campus')],
  ['연락','연락처|연락|문의처|이메일|메일\\s*주소|전화\\s*번호|전화|카톡|카카오톡|'+en('contact|e\\s*mail|email|phone')],
  ['유학','유학|진학|'+en('study\\s*abroad')],
  ['취업','취업|취직|일자리|구직|'+en('jobs?|employment|career')],
  ['비자','비자|사증|'+en('visa')],
  ['음악','음악|노래|음원|플레이\\s*리스트|로파이|'+en('bgm|music|songs?|lofi|playlist')+'|(?<![가-힣])곡(?![가-힣])'],
  ['영상','영상|비디오|동영상|쇼츠|릴스|뮤비|'+en('videos?')],
  ['캐릭터','캐릭터|마스코트|'+en('characters?|mascots?')],
  ['ai','인공\\s*지능|챗\\s*gpt|chat\\s*gpt|지피티|생성형\\s*ai|클로드|제미나이|'+en('gpt|llm|claude|gemini|ai')],
  ['기업','기업|사내|임직원|직원|조직|기관|'+en('companies|corporate|organization|business')],
  ['브랜딩','브랜딩|브랜드\\s*디자인|로고|'+en('branding|logo|bi|ci')],
  ['광고','광고|홍보|마케팅|캠페인|협찬|'+en('ads?|advertising|marketing')],
  ['앱','어플리케이션|애플리케이션|어플|앱|'+en('apps?|application')],
  ['개인정보','개인\\s*정보|프라이버시|정보\\s*보호|'+en('privacy')],
  ['초보','왕초보|초보|입문|기초|처음\\s*배|(?:아예|전혀|하나도|잘)\\s*(?:모르|몰라|모름)|'+en('beginners?')],
  ['온라인','온라인|비대면|원격|인터넷으로|줌|'+en('online|zoom')],
  ['vr','가상\\s*현실|메타버스|브이알|'+en('vr')],
  ['춤','댄스|안무|(?<![가-힣])춤|'+en('dance|dancing')],
  ['k컬처','한류|k컬처'],
  ['협업','협업|협력|제휴|파트너십|파트너|콜라보|'+en('collab\\w*|partnership')],
  ['채용','채용|구인|입사|인턴|알바|'+en('recruit\\w*|hiring')],
  ['철학','철학|가치관|신념|핵심\\s*가치|'+en('philosophy|values')],
  ['비전','비전|미래상|'+en('vision')],
  ['교재','교재|교과서|문법책|회화책|(?<![가-힣])책(?![임상])|'+en('textbooks?|books?')],
  ['게임','게임|'+en('games?')],
  ['편지','편지|'+en('letters?')],
  ['피드백','교정|첨삭|고쳐|고칠|수정해|피드백|코멘트|'+en('feedback')],
  ['기록','기록|이력|'+en('history|records?')],
  ['개인화','개인화|맞춤형|맞춤|'+en('personali[sz]\\w*|customi[sz]\\w*')],
  ['면접','면접|인터뷰|'+en('interviews?')],
  ['포트폴리오','포트폴리오|'+en('portfolio')],
  ['대학','대학교|대학|'+en('university|universities|college')],
  ['기간','기간|몇\\s*개월|몇\\s*달|몇\\s*년|얼마나\\s*걸|오래\\s*걸|'+en('duration')],
  ['일정','일정|개강|시작일|언제\\s*시작|언제부터|날짜|시간표|'+en('schedule')],
  ['신청','신청|등록|접수|가입|'+en('apply|register|enrol\\w*|enroll\\w*')],
  ['무료','무료|공짜|'+en('free')],
  ['인원','몇\\s*명|인원|정원|소수\\s*정예|'+en('class\\s*size')],
  ['수준','레벨|수준|'+en('level')],
  ['라디오','라디오|'+en('radio')],
  ['체험','체험|데모|'+en('demo|trial')],
  ['학습','공부|학습|배우|배워|배울|배운|배웠|익히|익혀|'+en('study|studying|learn\\w*')],
  ['가르치','가르치|가르쳐|가르칠|'+en('teach\\w*')],
  ['제작','만들어|만들|만드|만든|제작|'+en('creat\\w*|make|making')],
  // "듣다" means listening only next to music; "수업을 듣다" means taking a class.
  ['감상','(?<=(?:음악|라디오|영상)\\s*(?:을|를|은|는|도)?\\s*(?:어디서|어디에서|어떻게|여기서|지금|바로|계속)?\\s*)(?:들어|드러|들을|듣)|감상|청취|'+en('listen\\w*')],
  ['몽골','몽골|울란바토르|'+en('mongolia\\w*|ulaanbaatar')],
  ['외국인','외국인|'+en('foreigners?|international')],
  ['문법','문법|'+en('grammar')],
  ['어휘','어휘|단어|'+en('vocabulary|words')],
].map(([to,source])=>[to,new RegExp(source,'g')]);
const STOP=new Set(('알려 알려줘 알려주 알려주세요 궁금 궁금해 궁금해요 궁금합니다 설명 설명해 해주세요 해줘 해주 주세요 줘 좀 혹시 그럼 그러면 근데 그런데 저기 정말 진짜 너무 많이 어떻게 어떤 어떠 무슨 무엇 뭐 뭘 뭐야 뭐예요 뭐에요 뭔가 있 있어 있어요 있니 있음 있을 있는 있는지 있습니까 되 돼 돼요 되요 될 되는 되는지 가능 가능해 할 수 하 해 해요 합니까 하는 하고 하면 해서 인 나요 까요 요 저 제 나 내 우리 저희 여기 거기 이거 그거 이것 그것 것 거 건 게 더 자세히 좀더 이 그 싶 싶어 싶어요 싶습니다 싶은데 싶다 원해 원해요 부탁 부탁해요 부탁드립니다 안녕하세요 네 예 아 음 대해 대해서 관해 관해서 관련 알고 보고 말해 말해줘 은 는 가 을 를 의 에 와 과 도 만 로 으로 에서 께 한테 에게 입니다 이에요 예요 에요 야 냐 니 지 죠 임 the a an is are what how do does can i you me about please tell').split(' '));
const hasFinal=ch=>{const code=ch.charCodeAt(0)-0xac00;return code>=0&&code<11172&&code%28!==0;};
const finalIsL=ch=>(ch.charCodeAt(0)-0xac00)%28===8;
const LONG_TAIL=/(?:에서는|에서도|에서|에게는|에게|한테는|한테|께서|으로는|으로|로는|부터|까지|보다|처럼|이랑|하고|이나|이란|인데|는데|은데|인가요|인가|인지|이에요|예요|에요|이죠|이고|이요|입니다|습니까|습니다|합니다|했어요|했나요|할까요|하나요|해줘요|해주세요|해줘|해요|해도|하면|해서|나요|까요|니까|네요|는지|던데|이야|이냐|이다|이면)$/;
function stripWord(word){
  let w=word;
  for(let i=0;i<2&&w.length>1;i++){
    const long=w.match(LONG_TAIL);
    if(long&&w.length-long[0].length>=1){w=w.slice(0,-long[0].length);continue;}
    const last=w.at(-1),prev=w.at(-2);
    if(w.length<2||!prev)break;
    const consonant=hasFinal(prev);
    const ok=/[은을이과]/.test(last)?consonant:/[는를가와]/.test(last)?!consonant:last==='로'?!consonant||finalIsL(prev):/[의에도만요임랑]/.test(last)&&w.length>=3;
    if(ok&&(w.length>=3||/[은는을를이]/.test(last))){w=w.slice(0,-1);continue;}
    break;
  }
  return w;
}
// Particles and endings left over after a concept word is separated ("위치랑" → "위치", "랑").
const PARTICLES=/^(?:은|는|이|가|을|를|의|에|와|과|도|만|요|랑|하고|에서|에게|한테|께|부터|까지|보다|처럼|나|로|으로|세요|이세요|이에요|예요|에요|야|니|냐|인가요|인가|인지|일까요|나요|까요|습니까|입니까|죠|지요|고|며|인데|는데|라|란|면|라도|든|에는|에도|로는|과는|와는)+$/;
function prepare(text){
  let s=' '+normalizeQuery(text).replace(/(?<![가-힣])랩(?=[은는이가을를에의도]|에서|\s|$)/g,'lab')+' ';
  for(const [to,re] of CONCEPTS)s=s.replace(re,' '+to+' ');
  return s.split(/\s+/).filter(Boolean).map(stripWord).filter(w=>w&&!STOP.has(w)&&!PARTICLES.test(w));
}
function gramsOf(words){
  const out=new Set();
  for(const w of words){
    if(w.length===1){out.add('·'+w);continue;}
    // Grams stay inside each word; an unspaced phrase still shares its words' grams.
    for(let n=2;n<=3;n++)for(let i=0;i+n<=w.length;i++)out.add(w.slice(i,i+n));
  }
  return out;
}
// One-letter slips in distinctive words ("슈강료", "스트라다"). Words with common near neighbours are excluded.
const TYPO_WORDS=['수강료','수업료','커리큘럼','포트폴리오','아틀라스','울란바토르','컨설팅','브랜딩','장학금','원어민','연락처','개인정보','시냅스','스트라타','오프라인','온라인','선생님','라디오','캐릭터','유학생','이메일','홈페이지','시간표','프롬프트','챗지피티','스포티파이','유튜브','인스타그램','브이로그','플레이리스트','레퍼런스','워크숍','디자이너','프리랜서','스타트업','소상공인','쇼핑몰','상세페이지','마케팅','미드저니','제미나이','애니메이션','일러스트','피규어','어학당','에이전시','자기소개서','학업계획서','메타버스','헤드셋','교수님','견적서','수료증','자격증','성적표'];
// Two-syllable words are corrected only as a whole word, where one slip leaves no usable fragment.
const SHORT_TYPO_WORDS=['견적','환불','면접','채용','상담','수강','학원','위치','비용','게임','회화','문법','발음','편지','강의','등록','신청','음악','비자'];
const jamo=ch=>{const code=ch.charCodeAt(0)-0xac00;return code<0||code>=11172?[ch]:[Math.floor(code/588),Math.floor(code%588/28),code%28];};
function jamoDistance(a,b){let d=0;for(let i=0;i<a.length;i++){const x=jamo(a[i]),y=jamo(b[i]);if(x.length!==y.length){d+=3;continue;}for(let k=0;k<x.length;k++)if(x[k]!==y[k])d++;}return d;}
export function correctTypos(text,known=new Set()){
  return String(text).replace(/[가-힣]{2,}/g,word=>{
    // Words that appear in the reviewed answers are never "corrected".
    if(known.has(word))return word;
    if(word.length===2)return SHORT_TYPO_WORDS.find(target=>jamoDistance(word,target)===1)||word;
    for(const target of TYPO_WORDS){
      if(word.includes(target))continue;
      for(let i=0;i+target.length<=word.length;i++){
        if(jamoDistance(word.slice(i,i+target.length),target)===1)return word.slice(0,i)+target+word.slice(i+target.length);
      }
    }
    return word;
  });
}
export function createRetriever(list){
  const df=new Map();
  const index=list.map(r=>{
    const ask=[r.title,...r.questionExamples].map(t=>gramsOf(prepare(t)));
    const meta=new Set([...ask.flatMap(s=>[...s]),...gramsOf(prepare(r.keywords.join(' ')))]);
    const paras=r.answer.split('\n\n').map(p=>gramsOf(prepare(p)));
    const all=new Set([...meta,...paras.flatMap(s=>[...s])]);
    for(const g of all)df.set(g,(df.get(g)||0)+1);
    return {r,ask,meta,paras};
  });
  const N=list.length,idf=g=>{const d=df.get(g);return d?Math.log((N+1)/(d+.5)):0;};
  const average=[...df.keys()].reduce((s,g)=>s+idf(g),0)/Math.max(1,df.size);
  const norm=set=>Math.sqrt([...set].reduce((s,g)=>s+idf(g)**2,0))||1;
  for(const x of index)x.askNorms=x.ask.map(norm);
  function query(input){
    const words=prepare(input),grams=gramsOf(words),known=[...grams].filter(g=>df.has(g));
    const unknown=grams.size-known.length,weight=known.reduce((s,g)=>s+idf(g),0);
    const denominator=weight+unknown*average*.35,q2=Math.sqrt(known.reduce((s,g)=>s+idf(g)**2,0))||1;
    return {words,grams,known,weight,denominator,q2,penalty:Math.sqrt(weight/(denominator||1))};
  }
  const cover=(q,set)=>{let s=0;for(const g of q.known)if(set.has(g))s+=idf(g);return q.denominator?s/q.denominator:0;};
  function score(q,x){
    let ask=0;
    x.ask.forEach((set,i)=>{let s=0;for(const g of q.known)if(set.has(g))s+=idf(g)**2;ask=Math.max(ask,s/(q.q2*x.askNorms[i])*q.penalty);});
    let para=0,best=0;
    x.paras.forEach((set,i)=>{const v=cover(q,set);if(v>para){para=v;best=i;}});
    const meta=cover(q,x.meta);
    return {id:x.r.id,brand:x.r.brand,ask,meta,para,paragraph:best,score:.45*ask+.3*meta+.25*para};
  }
  function rank(input,{brands=[],brand=null,previous=[]}={}){
    const q=query(input);
    if(!q.known.length)return {q,ranked:[]};
    const related=new Set(previous.flatMap(r=>[r.id,...(r.relatedIds||[])]));
    const ranked=index.map(x=>{
      const s=score(q,x);
      if(brands.length)s.score+=brands.includes(s.brand)?.04:s.brand==='synk'?0:-.12;
      else if(brand&&s.brand===brand)s.score+=.03;
      if(related.has(s.id))s.score+=.02;
      return s;
    }).sort((a,b)=>b.score-a.score);
    return {q,ranked};
  }
  function focus(record,input){
    const x=index.find(item=>item.r.id===record.id);if(!x||x.paras.length<2)return 0;
    const q=query(input);if(!q.known.length)return 0;
    const values=x.paras.map(set=>cover(q,set));
    let best=0;values.forEach((v,i)=>{if(v>values[best])best=i;});
    return best>0&&values[best]>=.42&&values[best]-values[0]>=.12?best:0;
  }
  // How much of a question one record's own passages and titles cover, for continuing a conversation.
  function passage(record,input){
    const x=index.find(item=>item.r.id===record.id);if(!x)return {best:0,value:0,meta:0};
    const q=query(input);if(!q.known.length)return {best:0,value:0,meta:0};
    const values=x.paras.map(set=>cover(q,set));let best=0;values.forEach((v,i)=>{if(v>values[best])best=i;});
    return {best,value:values[best],meta:cover(q,x.meta)};
  }
  return {rank,focus,passage};
}

export function createKnowledgeEngine(data){
  if(!data||!Array.isArray(data.docs)||!Array.isArray(data.records))throw new Error('공개 안내 자료를 읽지 못했습니다.');
  const docs=new Map(data.docs.map(d=>[d.id,d])),records=new Map(data.records.map(r=>[r.id,r]));
  if(docs.size!==data.docs.length||records.size!==data.records.length)throw new Error('공개 안내 항목이 중복되었습니다.');
  for(const r of records.values()){
    if(!docs.has(r.sourceId)||typeof r.answer!=='string'||!r.answer.trim()||!Array.isArray(r.questionExamples)||!r.questionExamples.length||!Array.isArray(r.keywords))throw new Error('답변 문서 연결을 확인해 주세요.');
    if(r.relatedIds?.some(id=>!records.has(id))||r.answer.split('\n\n').some(p=>!docs.get(r.sourceId).paragraphs.includes(p)))throw new Error('답변의 공개 근거를 확인해 주세요.');
  }
  // Words that appear in the reviewed answers are never treated as typing slips.
  const vocabulary=new Set();
  for(const r of records.values())for(const text of [r.title,...r.questionExamples,...r.keywords,r.answer])for(const w of normalize(text).split(' '))if(w.length>=2)vocabulary.add(w);
  const from=(ids,status='matched')=>{
    const selected=[...new Set(ids)].map(id=>records.get(id)).filter(Boolean).slice(0,3);
    return {status,records:selected,sourceIds:[...new Set(selected.map(r=>r.sourceId))],brand:selected.length===1?selected[0].brand:'synk',relatedIds:[...new Set(selected.flatMap(r=>r.relatedIds||[]))].filter(id=>!ids.includes(id)).slice(0,3)};
  };
  const unknown=(brand=null)=>({status:'unanswered',records:[],sourceIds:['guide'],brand:null,relatedIds:brand?[brandIds[brand],'guide-contact']:['synk-choose','guide-contact'],message:records.get('guide-unknown').answer});
  const retriever=createRetriever(data.records.filter(r=>!['guide-unknown','guide-courtesy'].includes(r.id)));
  function ruleAnswer(input,context={}){
    if(typeof input!=='string'||!input.trim()||input.length>500)return {status:'invalid',records:[],sourceIds:[],brand:null,relatedIds:[],message:'질문을 500자 이내로 적어주세요.'};
    const q=normalizeQuery(input),brands=brandsIn(q);
    let c=compact(q);
    // Only explicit exclusions of private material are removed from the intent.
    c=c.replace(/(?:(?:내부|비공개)(?:운영|사업)?(?:자료|문서|원문)|학생실제(?:성적표|답안))(?:는|은|를|을)?(?:빼도되니|제외하고|빼고|필요없고)/g,'').replace(/(?:성적표|성적|점수|등수)(?:는|은|를|을)?(?:말고요|말고|빼고|제외하고|처럼|같이|대신)/g,'');
    const previous=(context.recordIds||[]).map(id=>records.get(id)).filter(Boolean),prevIds=new Set(previous.map(r=>r.id));
    // A question that opens with a back-reference continues the previous answer unless it names a new topic.
    const followupCue=previous.length>0&&(/^(?:그럼|그러면|그거|그건|그게|그런|거기|거긴|거기서|거기는|거기에|그곳|그쪽|그때|그분|그사람|그친구|그수업|그과정|그앱|그게임|그영상|그노래|그곡|그자료|그가이드|그다음|그이후|그후|이거|이건|이게|이후|다음|아까|방금|저거|저건|또|그리고|근데|그런데|그래서|그러니까|혹시|여기서|그다섯|그세가지|그네가지|그두|그중|그내용|그부분|그기능|그런거|그걸|그것|그점|그건데|그작품|그책|그교재|그시험|그연습|그vr|그프로그램|그서비스|그기록|그체험|지금도|아직도|여전히|요즘도)/.test(c)||/(?:좀|조금)?더(?:자세히|설명|알려|구체적으로)/.test(c));
    let brand=brands[0];
    // PUBLIC BUSINESS ROUTING 2026-09-14: service intent is distinct from unpublished company facts.
    const advertisingEducation=/광고/.test(c)&&(/제작법|만드는법|만드는방법|배우|배워|배울|가르치|가르쳐/.test(c)||/광고(?:강의|강좌|수업|교육|연수)|광고.*(?:제작|만들기).*(?:강의|강좌|수업|교육|연수)/.test(c));
    const advertisingService=/광고/.test(c)&&!advertisingEducation;
    const organizationService=/기관|기업|조직|직원|임직원|팀/.test(c)&&(/교육|강의|연수|컨설팅|브랜딩|가르치|가르쳐|배우|배워|실무|활용|도입|찾아주|진단|자동화|업무개선|효율화/.test(c)||advertisingEducation);
    const languageStudy=(/영어/.test(c)&&/배우|배워|학습|공부|수업|회화|선생|교사|강사|교육|처음|초보|못해|못하|잘못|어려|걱정|괜찮|같이|병행|도되|도돼|도가능|도있|봐주|봐줘|가르|알려주|도해|도하|도배|실력|시험|토익|토플|점수/.test(c)&&!/영어로(?:물어|질문|답|대답|안내|문의|채팅|대화|이용|써도|해도|보|읽)|영어페이지|영문/.test(c))||/원어민(?:회화|선생|교사|강사)|한국(?:인)?(?:선생|교사|강사|쌤)|한국어회화|발음(?:도|을|이)?(?:고쳐|교정|봐주)/.test(c);
    const classLength=/(?:수업|클래스|레슨)(?:은|이|한번|하나|당)?(?:시간(?!표)(?:은|이)?(?:얼마|몇|길)|몇분|얼마나(?:길|돼|되|해|걸))|(?:수업|클래스|레슨|강의).{0,4}몇분(?:짜리|동안)?|몇분(?:짜리|동안)?(?:수업|클래스|레슨|강의)|한(?:번|수업|타임|교시)(?:에|은|이|당)?몇분/.test(c);
    const classFormat=!languageStudy&&((/90분|30분|그룹별발화|그룹발화|소그룹발화|발화시간/.test(c)&&/수업|발화|그룹/.test(c))||classLength);
    const learnerCompetency=/창의|협동|협업|배려|수용성|가치관|자기이해|자기주도|리더십|크루|나침반|ai시대.*역량/.test(c)&&/학생|학습|교육|수업|배우|기르|키우|문화활동|크루|나침반/.test(c);
    const pathwayDirection=!brands.includes('lab')&&!languageStudy&&!/한국어.*(?:수업|교육|공부)|학교합격/.test(c)&&((/유학/.test(c)&&/취업/.test(c))||(/유학|취업|대학/.test(c)&&/연계|연결|알선|상담|준비|가려|가고|계획|하고싶/.test(c))||/비자(?!면접|인터뷰)|학교.*(?:골라|고르|선택)|(?:회사|기업)(?:랑|와|과|에)?.{0,4}(?:연결|연계|소개)|채용박람회|취업박람회|일자리(?:연결|소개|알선)/.test(c));
    if(!brand){
      if(advertisingEducation)brand='shift';
      else if(advertisingService)brand='pulse';
      else if(pathwayDirection)brand='path';
      else if(organizationService)brand='shift';
      else if(languageStudy)brand='lab';
      else if(classFormat)brand='lab';
      else if(learnerCompetency)brand='lab';
      else if(/유학원|에이전시|대행사/.test(c))brand='path';
      else if(context.brand==='path'&&/유학|취업|비자|학교|대학|면접|포트폴리오|전공|입시|어학당/.test(c))brand='path';
      else if(/아이|우리애|애가|자녀|학부모|보호자|부모|학생|한국어|외국인|학원|k컬처|말하기|토픽|topik/.test(c)||(/유학/.test(c)&&context.brand!=='path'))brand='lab';
      else if(/음악|라디오|노래|곡명|작품|감상|가게|매장|캐릭터/.test(c)&&!(context.brand!=='pulse'&&/프로그램|툴|도구|ai|가이드|만들어보|해보고싶|제작법|요청문|프롬프트|방법|스테이블디퓨전|미드저니/.test(c)))brand='pulse';
      // The page being read outranks the weak one-word guesses below; "AI" alone names no brand.
      else if(brandIds[context?.brand])brand=context.brand;
      else if(/1인|혼자.*(사업|브랜드)|브랜딩|사업을준비|브랜드를만들/.test(c))brand='shift';
      else if(/업무프로세스|업무(?:에)?적용|컨설팅|도입|저희업무|우리업무|현업|사후지원|출장(?:강의|교육)|출강|지방(?:강의|교육)|방문(?:교육|강의)|워크숍|세미나|실무교육|후속지원|스테이블디퓨전|미드저니|런웨이|프롬프트|요청문|ai(?:교육|강의|연수|컨설팅)/.test(c)&&!/아이|자녀|학생|한국어/.test(c))brand='shift';
      else if(/수업|교육|배운내용|온라인.*공부|배울내용|초보|나한테.*배우|다음공부/.test(c)&&!/기관|기업|팀/.test(c))brand='lab';
      else if(/자료|로고|스티치|고객.*질문|서비스.*정리|실제일한과정|제작사례/.test(c))brand='shift';
    }
    if(!brand&&brandIds[context.brand])brand=context.brand;
    if(!brand&&/포트폴리오/.test(c))brand='path';
    const pathwayService=brand==='path'||pathwayDirection||(brand==='shift'&&/유학|취업|대학/.test(c));
    if(/<\/?[a-z!]|onerror\s*=|javascript:/i.test(input))return unknown();
    if(/(지시|규칙|설정|규정|정책|가이드라인|제한).*(무시|우회|해제|신경쓰지|상관없이|잊고|잊어|넘어가|무시하)|이전지시|systemprompt|ignore.*(instruction|rule)|개발자모드|관리자모드|(?:지금부터|이제부터).{0,20}(?:다말해|전부말해|다알려|전부알려|숨기지)/.test(c))return from(['guide-boundary'],'restricted');
    if(/비밀번호|password|apikey|api키|접속토큰|인증토큰|주민등록|주민번호|계좌번호|secretkey/.test(c))return from(['guide-boundary'],'restricted');
    if(/(?:알고리즘|엔진|시스템|아틀라스|atlas|질문창|답변창|대화창|챗봇|홈페이지).{0,12}(?:코드|소스|프롬프트|가중치|학습데이터|내부구조|설계도|설계문서|데이터베이스|규칙파일|규칙|로직|설정파일)/.test(c)&&/보여|공개|알려|줘|볼수|보내|공유|달라|주실/.test(c))return from(['guide-boundary'],'restricted');
    if(/(?:너|넌|너는|당신)(?:은|는)?(?:이제부터|지금부터|이제|앞으로).{0,24}(?:비서|역할|처럼|말고)|(?:이제부터|지금부터)(?:너|넌|너는)|역할(?:을)?(?:바꿔|바꾸)|인척해|처럼행동해|안내말고/.test(c))return from(['guide-boundary'],'restricted');
    // Source files a client receives after training or branding are a deliverable question, not an internal-material request.
    const deliverableAsk=(brand==='shift'||organizationService||/브랜딩|로고|디자인|교육자료|강의자료|워크숍자료|납품/.test(c))&&/넘겨|전달|제공|주시|받을수|납품|주나요|주시나요|받나요|받을수있|주는지|소유|가지|갖|귀속|권리|저희것|우리것|받는건가|받게/.test(c)&&!/내부|비공개|정답|채점|학생|고객사|다른회사|다른기업/.test(c);
    if(!deliverableAsk&&/(?:정답표|채점표|답안지|해설지|내부용|내부커리큘럼|원본파일|원본데이터|설문원본|분석원본|원데이터|로우데이터|raw데이터|교사용(?:매뉴얼|자료|지도서|가이드)|교안|지도안|매뉴얼원본|계획서원본|사업계획서|재무제표|손익)/.test(c)&&!/명단|연락처|이메일|리스트/.test(c)&&/받을수|보내|보여|공유|줄수|달라|주실|주세요|볼수|가능|파일/.test(c))return from(['guide-boundary'],'restricted');
    if(deliverableAsk&&/원본|파일|결과물|산출물|납품|소스|편집가능|수정가능|psd|ai파일/.test(c))return from(['shift-takeaway']);
    if(/(?:시청자|구독자|조회수|매출|이용자|방문자|청취자).{0,8}(?:분석|통계|데이터|자료|리포트)/.test(c)&&/공유|보여|보내|받을|가능|알려/.test(c))return from(['guide-boundary'],'restricted');
    // A teacher's or staff member's personal contact, and group chats with other families, are private too.
    if(/(?:선생님|강사|교사|원장|직원|튜터)(?:님)?(?:의|들의?)?(?:개인)?(?:연락처|전화번호|번호|휴대폰|핸드폰|카톡|카카오톡|개인이메일|집주소|인스타)/.test(c)||(/학부모|보호자|학생|수강생|엄마들/.test(c)&&/단톡|단체방|단체채팅|오픈채팅|채팅방|카톡방/.test(c)))return from(['guide-personal'],'restricted');
    const personalTopic=/(학생|학부모|보호자|고객|회원|아이|우리애|애|자녀|아들|딸|친구|선배|후배|동기|합격생|합격자|졸업생|수료생|성적표|상담기록|상담내역|교육생|수강생|참가자|참여자|다른회사|다른기업|다른사람|다른분|교육받은|교육을받은|받은회사|수강한|참여한|회사직원들|고객사직원|구독자|시청자|팔로워|이용자|청취자|회사들|기업들|회사명단|기업명단|광고주|협업(?:한)?(?:브랜드|회사|업체|사)|거래처|파트너사|클라이언트|의뢰인|고객사|같이일한|함께일한)/.test(c);
    const recordTopic=/명단|목록|성적|진도|답안|상담|연락처|전화번호|원문|원본|기록|개인정보|학생정보|아이별정보|결과물|과제물|작업물|실습결과|샘플|이름|성함|학교|이메일|리스트|설문|만족도|문의한내용|문의내용|문의내역|질문내용|자기소개서|자소서|에세이|작문|과제/.test(c);
    const processQuestion=/어떻게알려주|어디서볼수|어디서봐|어디서보|어디에서봐|어디에서확인|어떻게확인|어떻게봐|부모가.*볼수|부모.*확인할수|보호자도.*볼수|부모에게|보호자에게|열람절차|확인하는절차|볼수있는권한|어떻게보관|어디에남|보관하나요|저장되나요|어디에보관|어디에저장|누가볼수|누가보/.test(c);
    // A request to explain a protection method is not a request for a person's data.
    const demandText=c.replace(/(?:개인정보|학생정보)(?:를)?보호(?:하는)?(?:방법|기준)(?:을)?보여(?:주세요|줘)/g,'개인정보보호방법').replace(/(?:부모|보호자)에게(?:도)?(?:어떤방식으로)?보여주나요/g,'보호자전달절차');
    const directDemand=/보여|출력|추출|다운로드|여기로보내|(?<!받아|해|봐|들어|먹어|써)보고싶|보기만|볼래|(?:내역|기록|성적표)(?:을|를)?주세요|(?:다른|타|옆|같은반|재학|현재다니|지금다니)(?:는|고있는)?(?:학생|아이|애|친구|사람|학습자|수강생|수강자|교육생|반|분)(?:들)?(?:의)?.{0,10}(?:성적|성적표|진도표|진도|점수|답안|과제물?|출석|기록|사례)(?:이나|이랑|과|와|도|을|를|은|는)?(?:같은거|같은것|같은)?.{0,10}(?:볼수|보여|받을수|공유|주실|보내|열람|참고|확인)|(?:연락처|전화번호|성적|정보)(?:를|을|도)?(?:함께|같이|모두|전부|좀|먼저){0,2}(?:알려줘|알려주세요|열람|제공|부탁)|(?:연락처|전화번호|정보|명단|결과물|과제물|작업물|샘플).{0,10}(?:소개해|넘겨|공유해|전달해|주실|줄수|받을수|보내주|알수있|볼수있|확인할수|받아볼)|(?:상담|기록|내역|명단).{0,12}(?:확인해\s*주|확인해줘|조회)|(?:받았는지|했는지|다니는지|등록했는지).{0,8}확인|(?:이름|성함|학교|명단)(?:이랑|과|와|을|를|도)?.{0,10}(?:알려|보여|공유)|(?:자기소개서|자소서|에세이|작문|답안|과제|포트폴리오|결과물|문의한내용|문의내용|설문|이메일|리스트).{0,12}(?:볼수|보여|받을수|공유|살수|구매|팔아|주실|보내)|(?:학생|고객|학부모|수강생|졸업생|선배).{0,14}(?:연결해|소개해|만나게|연락하게|인터뷰하게)/.test(demandText);
    const privateList=personalTopic&&/명단|목록/.test(c)&&!/수집항목|어떤항목/.test(c);
    if(/(?:다른|타|기존|이전|지난)(?:광고주|고객사|회사|기업|클라이언트|거래처|의뢰인)(?:랑|와|과|하고|들|의|과의|에)?.{0,20}(?:계약(?:했던|한|서|금액|조건)?|금액|단가|계약조건|견적서|보고서|결과물|산출물|원본|납품(?:했던|한)?(?:자료|파일|결과물|디자인|시안))/.test(c)&&/알려|보여|공개|말해|주실|줄수|볼수|받을수|보내|공유/.test(c)&&!/매출|효과|수치|평균|얼마나올|성과|명단|연락처|이메일|교육생|수강생|학생|참가자|직원들이만든|들이만든|이만든/.test(c))return from(['guide-boundary'],'restricted');
    if(privateList||(personalTopic&&recordTopic&&(directDemand||(!processQuestion&&/원문|원본|성적표|회원정보/.test(c)))))return from(['guide-personal'],'restricted');
    if(/사업시스템.*원문|(내부|비공개|비밀|미공개).*(시스템|구조|설계|운영|자료|문서|계약|전략|가격|프롬프트|도구|원가|코드|계획|매뉴얼|커리큘럼|원본|파일|기준표|정답|채점|평가표|설문|데이터|규칙|정보|사정|규정|이야기)|(?:커리큘럼|기준표|채점|평가표|정답|자료|문서|파일).{0,10}(?:내부용|내부자료|비공개)|운영매뉴얼|데이터베이스|소스코드|서버설정|시스템지시|저장소|엔진설계|전체지식.*(출력|덤프)/.test(c))return from(/synk.*하는일|synk.*어떤회사/.test(c)?['guide-boundary','synk-intro']:['guide-boundary'],'restricted');
    if(processQuestion&&personalTopic&&/부모|보호자|아이|우리애|애가|자녀|아들|딸/.test(c)&&!/보관|저장|어디에남/.test(c))return from(['lab-parent']);
    // A bare topic word typed on a brand page opens that brand's answer for it.
    const ONE_WORD={lab:[[/^(?:교재|책|시냅스|교과서)$/,'lab-curriculum'],[/^(?:게임|앱|어플|학습앱)$/,'lab-personalization'],[/^vr$/,'lab-vr'],[/^(?:토픽|topik|4급|급수)$/,'lab-topik'],[/^(?:커리큘럼|과정|1년과정|정규과정)$/,'lab-year'],[/^(?:영어|회화|원어민)$/,'lab-languages'],[/^(?:위치|주소|장소|어디)$/,'lab-location'],[/^(?:수업|수업방식|90분)$/,'lab-class'],[/^(?:대상|누구|나이)$/,'lab-audience'],[/^(?:성인|직장인|어른)$/,'lab-adult'],[/^(?:학부모|보호자|부모)$/,'lab-parent'],[/^(?:개인화|맞춤|맞춤형)$/,'lab-personal'],[/^(?:k컬처|춤|댄스|문화)$/,'lab-culture'],[/^(?:선생님|교사|강사|ai)$/,'lab-teacher'],[/^(?:초보|처음|입문)$/,'lab-start']],
      shift:[[/^(?:가이드|자료|자료실|제작법|제작가이드|가이드링크|자료링크)$/,'shift-materials'],[/^(?:제안서|제안|견적요청|문의방법)$/,'guide-collaboration'],[/^(?:서비스|사업|하는일)$/,'shift-services'],[/^(?:대상|누구|개인|1인|프리랜서)$/,'shift-audience'],[/^(?:진행|절차|프로세스|진행방식|순서)$/,'shift-delivery'],[/^(?:결과물|산출물|납품)$/,'shift-takeaway'],[/^(?:사례|제작사례|실제사례|포트폴리오)$/,'shift-making'],[/^(?:강사|선생님|교육|강의|실습)$/,'shift-education'],[/^(?:초보|입문|비전공)$/,'shift-start'],[/^(?:툴|도구|ai|프로그램)$/,'shift-ai'],[/^(?:브랜딩|로고)$/,'shift-scope'],[/^(?:프롬프트|요청문|실패)$/,'shift-publicity']],
      pulse:[[/^(?:라디오|lofi|로파이|klofi|방송|라이브|스트리밍|라이브스트리밍|생방송|실시간방송)$/,'pulse-radio'],[/^(?:캐릭터|마스코트|몽글|까몽|마린)$/,'synk-characters'],[/^(?:광고|광고협업|협찬)$/,'pulse-advertising'],[/^(?:협업|콜라보|제작협업|의뢰)$/,'pulse-collaboration'],[/^(?:저작권|사용|이용|권리|라이선스)$/,'pulse-rights'],[/^(?:음악|노래|곡|영상|감상)$/,'pulse-listening'],[/^(?:ip|지식재산|세계관)$/,'pulse-ip'],[/^(?:콘텐츠|작품)$/,'pulse-content']],
      path:[[/^(?:비자|법률|보장)$/,'path-support'],[/^(?:포트폴리오|결과물)$/,'path-why'],[/^(?:면접|vr|연습|입국심사)$/,'path-journey'],[/^(?:유학계획|전공|학교선택|계획|일정)$/,'path-personal'],[/^(?:유학|취업|지원)$/,'path-support']]};
    if(/^(?:ai)?(?:요청문|프롬프트)(?:예시|모음|공개)?$/.test(c))return from(['shift-materials']);
    const page=brandIds[context.brand]?context.brand:null;
    if(page&&ONE_WORD[page]&&c.length<=8&&(!brand||brand===page)){const bare=c.replace(/(?:은요|는요|이요|은|는|이|가|요|도|좀|들)$/,'');const hit=ONE_WORD[page].find(([re])=>re.test(bare));if(hit&&records.has(hit[1]))return from([hit[1]]);}
    const aboutEngines=/엔진/.test(c)||/(?:어느|어떤)(?:부분|기능|모듈|쪽)(?:이|가)?(?:맡|담당)|(?:맡|담당)(?:는|은|하는)(?:엔진|부분|기능)/.test(c)||(context.recordIds||[]).some(id=>id==='synk-atlas'||id.startsWith('atlas-'));
    if(aboutEngines&&/엔진|담당|역할|어떤거|누가|뭐|어느|맡/.test(c)&&!/비공개|코드|소스|명단|프로그래밍|언어로|사람(?:선생님)?(?:이|은)?맡|선생님이맡|ai(?:가|는)?맡는부분|역할(?:을|은)?(?:어떻게)?나누/.test(c)){
      const roles=[['atlas-trail',/기록|변화|예전(?:답|것|거)|이전(?:답|것|거)|얼마나늘|달라진|성장|진전|발전|히스토리/],['atlas-prism',/비슷한(?:학생|학습자|사례|사람)|여러(?:학생|학습자|사례|사람)|다른(?:학생|학습자|사람)들?|반복되는|패턴|비교/],['atlas-temper',/도움이?됐|도움이?되었|효과(?:를|가)?확인|검증|먹혔|통했/],['atlas-vellum',/힌트|설명해주는|설명하는|설명담당|막혔을때|막히면|왜이걸|왜이것을/],['atlas-loom',/화면|장면|시각|보이는|움직임|애니메이션|모션/],['atlas-reed',/음악|소리|사운드|배경음/],['atlas-core',/판단하는|판단담당|판단해주|판단하|결정하는|다음과제|정하는|정해주는|다음에뭘|다음할일|무엇을할지|뭘시킬지|필요한지|뭐가필요/],['atlas-strata',/순서|지도|배울내용|아직|예정|개발(?:이)?안|준비중|계획중/]];
      let hit=roles.filter(([id,re])=>re.test(c)&&records.has(id)).map(([id])=>id);
      // Comparing one learner's earlier and later answers is Trail; Prism compares across learners.
      if(hit.includes('atlas-prism')&&hit.includes('atlas-trail')&&/예전|이전|지금|얼마나늘|달라진|성장|진전/.test(c))hit=hit.filter(id=>id!=='atlas-prism');
      if(hit.includes('atlas-core')&&hit.includes('atlas-strata')&&/순서|배울내용|지도/.test(c))hit=hit.filter(id=>id!=='atlas-core');
      if(hit.length&&hit.length<=(/뭐고|이고|랑|과|와|그리고/.test(c)?3:2))return from(hit);
      if(/여러개|여러|나눠|나누|전체|각각|구조|구성|소개|설명|어떤것|어떤게|뭐뭐|목록|몇개/.test(c)&&!/코어|룸|벨룸|트레일|프리즘|템퍼|리드|스트라타|core|loom|vellum|trail|prism|temper|reed|strata/.test(c))return from(['synk-atlas']);
    }
    if(/(?:힌트|설명|도움|연습|피드백|판단|추천|제안|과제)(?:을|를|이|가)?.{0,8}(?:실제로|진짜)?(?:도움이?됐|도움이?되었|효과가?있|먹혔|통했)(?:는지|나|는가)?.{0,6}(?:어떻게|확인|알아|알수|검증|측정)/.test(c))return from(['atlas-temper']);
    // Comparing a learner's earlier and later answers is Trail; comparing with other learners is Prism.
    if(/(?:예전|이전|과거|전에|처음)(?:에)?(?:쓴|썼던|낸|냈던|했던|한)?(?:답|글|답안|문장|것|거)(?:이랑|과|와|하고|랑).{0,8}(?:지금|최근|현재|나중|이번|요즘)(?:에)?(?:쓴|낸|한)?(?:답|글|답안|문장|것|거)?(?:을|를)?.{0,4}비교|(?:처음쓴글|첫답|이전답|예전답)(?:과|와|이랑|랑).{0,6}비교/.test(c)&&!/다른(?:학생|학습자|사람|친구)/.test(c))return from(['atlas-trail']);
    if(/다른(?:학생|학습자|사람|친구)(?:들)?(?:의)?(?:사례|답|기록|경우|패턴|데이터)?(?:이랑|과|와|하고|랑)(?:도)?.{0,6}비교/.test(c)&&!/명단|연락처|성적|점수|보여|알려/.test(c))return from(/(?:예전|이전|과거|처음)(?:에)?(?:쓴|썼던)/.test(c)?['atlas-trail','atlas-prism']:['atlas-prism']);
    if(/(?:장면|분위기|화면|상황)(?:에|의|마다)?.{0,6}(?:맞는|맞춰|맞게|어울리는|맞춤)(?:은)?.{0,4}(?:소리|음악|사운드|배경음|효과음)(?:을|를|이|가)?.{0,8}(?:골라|고르|추천|정해|맞춰|ai|자동|기술)/.test(c)&&!/써도|사용해도|저작권|만들어줄|제작해주/.test(c))return from(['atlas-reed']);
    if(/막혔을때|막히면|막힐때/.test(c)&&/설명|힌트|알려주|이유/.test(c))return from(['atlas-vellum']);
    if(/(?:화면|캐릭터|장면|마스코트)(?:속|의|들이|이|가)?.{0,14}(?:움직|반응|부드럽|애니메이션|모션|살아있)/.test(c)&&/기술|엔진|어떻게|무슨|뭐로|만든|만들|구현/.test(c)&&!/써도|사용해도|저작권|해보고싶|프로그램|툴/.test(c))return from(['atlas-loom']);
    if(/(?:지난번|전에|예전|이전|어제|저번)(?:에)?.{0,8}(?:상담|문의)|(?:상담|문의)(?:받은|했던|한)(?:내용|내역|기록)/.test(c)&&/다시|볼수|확인|찾|보여|남아|있어/.test(c))return from(['guide-records']);
    if(/(?:지난번|예전|이전|어제|저번)(?:에)?.{0,8}(?:대화|질문|채팅)/.test(c)&&/다시|볼수|확인|찾|보여|남아|있어/.test(c))return from(['guide-privacy']);
    if(/(?:학교|대학|기업|회사)(?:에|로|쪽에|측에)?.{0,6}(?:넘어가|공유되|공유해|전달되|보내지|제공되)/.test(c)&&/기록|자료|포트폴리오|정보|성적/.test(c))return from(['path-why']);
    if(/(?:상담|학습|학생|아이|자녀|수업|과제)(?:가|의|이|들이)?.{0,10}(?:기록|쓴글|답안|개인정보|정보)|학생상담내용/.test(c)&&/남|저장|보관|삭제|열람|확인|처리|누가볼|누가보|어디에/.test(c)&&!/이질문창|홈페이지|여기에/.test(c))return from(['guide-records']);
    if(/(?:자료|기록|포트폴리오|글|정보|데이터|내용)(?:는|은|를|을|도|들은|들을)?.{0,10}(?:지울수|지워|삭제|없앨수|없애|폐기|철회|지우고)/.test(c)&&!/이질문창|여기에|여기서|제가쓴|내가쓴|제정보|내정보|본인|제개인|내개인|어디에문의|어디로문의/.test(c))return from(['guide-records']);
    if(/상담.*(?:이질문창|홈페이지).*기록/.test(c))return from(['guide-privacy']);
    if(/제가쓴내용.*지워|제정보.*삭제|(?:내|제|본인)(?:개인)?정보.*(?:지워|삭제)/.test(c))return from(['guide-personal']);
    if(/상담/.test(c)&&/받|원해|원합|하고싶|가능|있나요|신청|무료/.test(c)){
      if((organizationService||pathwayService||advertisingService||advertisingEducation)&&/무료/.test(c))return from(['guide-availability'],'needs_confirmation');
      if(!organizationService&&!pathwayService&&!advertisingService&&!advertisingEducation)return from(brand==='lab'?['guide-contact','lab-availability']:['guide-contact']);
    }
    if(!/이력서(?:에|에다|에는|상|에도)(?:도|는)?.{0,8}(?:써도|적어도|쓸수|넣어도|기재|올려도|쓸까|적을수|써야|넣을수|적어야)|경력(?:으로|이|에)?(?:써도|인정|쓸수|넣어도|되나)|보여줄게없|연결해주|취업연계|박람회|졸업하고|졸업후|취업(?:도)?도와|일자리(?:를)?(?:구해|찾아|연결)|회사랑연결|기업과연결/.test(c)&&!(brand==='path'&&/지원서|포트폴리오|결과물|첨부/.test(c))&&!/(?:지원서|자소서)(?:에|를|용|는)?.{0,6}(?:첨부할|쓸만한|넣을|작성|준비|도와|만들|봐주|첨삭)/.test(c)&&/채용|구인공고|구인중|입사|강사모집|선생님모집|인턴모집|인턴십|인턴채용|직원모집|모집공고|이력서|지원서|(?:여기서|여기에서|synk에서|이회사에서|lab에서|shift에서|pulse에서|path에서)일하고싶|(?:강사|선생님|교사|직원|인턴|알바|디자이너|개발자)(?:로|으로)(?:지원|일하|근무|들어가)|(?:개발자|디자이너|강사|선생님|직원|인턴|알바|사람)(?:을|를)?(?:뽑|모집해|구하|구해|채용해)|(?:포트폴리오|이력서)(?:는|를|을)?.{0,6}(?:보내|제출|접수)|(?:디자이너|개발자|작곡가|일러스트레이터|강사|선생님)(?:인데|입니다|이에요|예요).{0,20}(?:같이|함께)일하/.test(c)||/(?:^|\s)구인(?:\s|$)/.test(q))return from(['guide-careers'],'needs_confirmation');
    if(/(?:인터뷰|기사|보도|언론|매체)(?:가|이|는|은|에)?.{0,6}(?:실린|나온|난|실렸|있나|있어|있었|링크)|기사링크|언론보도|인터뷰기사|보도된적/.test(c)&&!/요청|하고싶|신청|가능한가요|가능해요|할수있/.test(c))return {...unknown(brand),relatedIds:['synk-planner','guide-contact']};
    if(/보도자료|기자|언론|취재|인터뷰요청|인터뷰를요청|인터뷰하고싶|미디어문의|방송출연|인터뷰(?:가능|할수|부탁|되나|돼요)|기사(?:를)?(?:쓰|작성)/.test(c)&&!/연결고리|공통점|왜같이|왜함께|한회사가|어떻게소개|한문장|한줄로|성함|이름/.test(c))return from(['guide-contact']);
    if((/깔아도|깔수|넣어도|써도|사용해도|이용해도|틀어도|틀어놔도|삽입해도|쓸수있|사용할수있|써볼수|깔고싶|넣고싶|쓰고싶/.test(c)||(/배경(?:음악)?으로|bgm으로|브금으로/.test(c)&&/제|내|저희|우리|영상|브이로그|채널|매장|가게|깔/.test(c)))&&/음악|노래|곡|라디오|lofi|로파이|영상|캐릭터|몽글|까몽|마린|작품/.test(c)&&!/내가만든|제가만든|직접만든|요청문|프롬프트|예문|가이드|제작법|어디서들|어디서봐|풀버전/.test(c))return from(['pulse-rights']);
    if((brand==='shift'||brand==='pulse'||organizationService)&&/포트폴리오|이전(?:에)?(?:진행|작업|제작|하신|하셨)|이전프로젝트|지난프로젝트|작업물|사례모음|해온일|해온작업|작업사례|제작사례|실제사례|레퍼런스|작업했던|진행했던|(?:실제)?(?:작업|제작|만드는|만든)과정/.test(c)&&!/학생|유학|path|명단|연락처|캡처|캡쳐|넣어도|써도|사용해도|가져다|퍼가|내포트폴리오|제포트폴리오/.test(c)&&/볼수|보여|있나|있어|어디|페이지|링크|보고싶|구경|공개|있을까/.test(c))return from([brand==='pulse'?'pulse-content':/참고|볼만한|가이드/.test(c)?'shift-materials':'shift-making']);
    if(/다른(?:회사|학원|교육).*얼마나|다른학원보다|얼마나낫|레퍼런스|실적|강의이력|강의한곳|어디서강의|후기|리뷰|합격생|합격자|합격사례|성공사례|고객사례|실제사례/.test(c)&&!/자료|가이드|예시|가상/.test(c))return from([brand==='shift'&&/수익|매출|벌/.test(c)&&!/다른(?:회사|고객|기업)|수치|실제로얼마나|보여|볼수/.test(c)?'shift-results':'guide-evidence']);
    if(/몇\s*(?:%|퍼센트|프로)|수치|정량/.test(input+c)&&/줄|늘|효과|절감|향상|오르|높아/.test(c))return from([brand==='shift'||/업무|직원|ai/.test(c)?'shift-results':'guide-evidence']);
    if(/(?:월|한달에?|연|일년에?)(?:\d+|천|백|억)(?:만)?(?:원)?.{0,4}(?:벌|수익|매출)|돈(?:을)?(?:많이)?벌|수익(?:이|을)?(?:낼|날|얻)|벌수있|(?:매출|수익).{0,6}(?:오르|오를|오른|올라|늘|증가|높아)|몇퍼(?:센트)?(?:올라|오르|늘)/.test(c))return from([brand==='shift'||/ai|창업|사업/.test(c)?'shift-results':'guide-evidence']);
    if(/협력대학|협약맺은.*대학|언제만들었|언제만든회사|언제세워|세워진|설립된|만들어진지|생긴지|몇년차|창업(?:했|한지|연도|일)|언제창업|나라장터|조달청|조달|입찰|등록업체|벤더등록/.test(c))return from(['guide-unpublished'],'needs_confirmation');
    if(/효과(?:는|를)?(?:어떻게)?(?:측정|평가|검증)|성과(?:는|를)?(?:어떻게)?(?:측정|평가)|만족도조사/.test(c))return from([brand==='shift'?'shift-results':'guide-evidence']);
    if(/카카오톡|카톡/.test(c)&&/문의|연락|상담/.test(c))return from(['guide-contact']);
    if(/음악|노래|영상|곡|캐릭터|마스코트|일러스트|그림|로고/.test(c)&&/만들어줄|만들어주|제작해주|맞춤.*제작|만들어주기도|제작도해/.test(c))return from([/로고|브랜딩/.test(c)&&!/캐릭터|마스코트/.test(c)?'shift-scope':'pulse-collaboration']);
    if((brand==='shift'||organizationService)&&/반나절|하루짜리|하루만|이틀|단기|장기|일회성|1회성|원데이|한번만|몇시간|시간짜리|세션|회차|몇회|몇번|특강형태|단발/.test(c)&&/가능|되나|돼요|해주|있나|있어|해요|하나요|만|되죠|되는지/.test(c))return from(['shift-education','guide-availability'],'needs_confirmation');
    if(/(?:의뢰|협업|맡기|제안|공동제작|콜라보|컬래버|협력|문의|연락|상담)(?:하려면|하기전|전에|할때|할땐|하고싶은데|하려고하는데|드리기전|드릴때).{0,12}(?:뭘|무엇을|무엇부터|뭐부터|어떤걸|어떤것을|어떤내용을)?.{0,8}(?:정리|준비|알려|챙기|보내|첨부|필요|적어|말씀)/.test(c))return from([brand==='pulse'||/음악|캐릭터|작품|노래|곡|영상|몽글|까몽|마린/.test(c)?'pulse-collaboration':'guide-collaboration']);
    if(/기간|얼마나걸|몇주|몇달|며칠|몇개월/.test(c)&&(brand==='shift'||organizationService||/컨설팅|브랜딩|의뢰/.test(c))&&brand!=='lab'&&!/1년|4급|토픽/.test(c))return from(['guide-availability'],'needs_confirmation');
    if(/(?:회사|기업|서비스)?소개(?:자료|서|서류|브로셔|브로슈어|pdf)(?:같은거|같은건|는|은|를|을|도)?.{0,8}(?:받을수|보내|주실|있나요|있어요|주세요|요청)/.test(c)&&!/만들|제작|디자인|정리해|통일/.test(c))return from(['guide-contact']);
    if(/(?:광고|협업)(?:이랑|과|와|랑|하고).{0,8}(?:브랜딩|로고).{0,14}(?:창구|담당|다른|따로|같은곳|어디|각각)|(?:브랜딩|로고)(?:이랑|과|와|랑|하고).{0,8}(?:광고|협업).{0,14}(?:창구|담당|다른|따로|같은곳|어디|각각)/.test(c))return from(['pulse-advertising','synk-brands']);
    if(!(followupCue&&/따로|만|그중/.test(c))&&!/창구|다른가요|다르나요|둘다|각각|어느쪽|어디서/.test(c)&&/로고|브랜딩|홈페이지톤|톤앤매너|브랜드정리|시각(?:물|자료)/.test(c)&&/만들어줄|만들어주|제작해주|제작의뢰|맡기|맡아|맡길|맡겨|의뢰|리뉴얼|새로만들|바꾸고|바꿔|교체|디자인해|해줄수|해주나|해주세요|가능|정리해|통일|묶고싶|손보|손봐|정비/.test(c)&&!/써도|사용|쓸수|이용|과정|사례|고친이야기|고친사례/.test(c))return from(['shift-scope']);
    if(/shift/.test(c)&&/과정/.test(c)&&/협업/.test(c))return from(['shift-scope','guide-collaboration']);
    if(!languageStudy&&/(?:4급|사급|시험|토픽|topik|급수)(?:에|을|를|에서)?.{0,6}(?:미달|못따|못받|불합격|떨어지|떨어졌|낙방|실패|못붙|안되면|망하|망치)|6개월.*(?:케어|지원|연장|무료|유료|돈|비용|따로)|(?:앱|계정)(?:을)?연장/.test(c)&&(brand==='lab'||!brand||/4급|토픽|topik/.test(c)))return from(['lab-year']);
    if(!languageStudy&&/4급|사급/.test(c)&&/커리큘럼|과정구성|과정내용|수업내용|1년/.test(c))return from(['lab-year']);
    if(brand==='lab'&&!brands.filter(b=>b!=='lab').length&&/기간|몇개월|몇달|몇년|얼마나걸|얼마동안/.test(c)&&/과정|교육|수업|코스|배우|공부|다녀/.test(c)&&!/수업시간|몇분/.test(c))return from(['lab-year']);
    if(/(?:왜|굳이).{0,10}(?:4급|사급|그위|더높은|높은단계|위단계|상위급|위급수)|(?:더높은|위단계|높은단계|그위|상위)(?:단계|급수)?(?:까지|를|을)?.{0,8}(?:목표|왜|굳이|시키|시킨|시켜|부담|잡은|필요|요구)/.test(c))return from(['lab-topik']);
    if(/(?:3급|삼급)(?:이랑|과|와|하고|랑|에서)?.{0,8}(?:4급|사급)?.{0,6}(?:다른|다르|차이|뭐가|머가|모가|달라)|(?:4급|사급)(?:이랑|과|와|하고|랑)(?:은|는)?.{0,6}(?:3급|삼급).{0,6}(?:다른|다르|차이|달라)/.test(c)&&!languageStudy)return from(['lab-topik']);
    if(/1년(?:과정|커리큘럼|코스)|(?:1년|정규)(?:과정)?(?:의)?커리큘럼|커리큘럼(?:이|은)?(?:어떻게|어떤|뭐|자세히)/.test(c)&&(brand==='lab'||!brand)&&!/기업|직원|ai교육/.test(c))return from(['lab-year']);
    if(/(?:급수|토픽|topik|시험)(?:따는|취득|합격|공부)(?:거|것)?(?:랑|과|와|하고|이랑).{0,14}(?:회화|말하기|말하는|대화|얘기|소통|실전)|(?:회화|말하기)(?:수업|연습)?(?:을|를)?(?:들으면|하면|배우면|듣고)?(?:랑|과|와|하고|이랑)?.{0,8}(?:급수|토픽|topik|시험)(?:이랑|과|와|하고|랑)?(?:도|과도|와도)?.{0,8}(?:연결|이어|따로|별개|상관|연관|도움)/.test(c))return from(['lab-language-use']);
    if(!languageStudy&&/4급|사급/.test(c))return from(['lab-topik']);
    if(/몇급|급수가?|몇등급|어느급|무슨급/.test(c)&&/대학|입학|유학|진학|취업|필요|목표|따야|받아야|있어야|이어야|돼야|되어야|비자/.test(c))return from(['lab-topik']);
    if(/[56]급|오급|육급|고급(?:반|과정|단계)?/.test(c)&&/안가르|안해|없어|없나|있어|있나|배울수|가능|다루|까지|안배|못배/.test(c)&&(brand==='lab'||!brand))return from(['lab-provides']);
    if(/\d권/.test(c)&&/급|수준|레벨|내용|목표|배우|단계|뭐|어떤/.test(c)&&(brand==='lab'||!brand)&&!/구매|구입|살수|판매|가격|얼마/.test(c))return from(['lab-curriculum']);
    if(/자소서|자기소개서|학업계획서|(?<!지)원서|지원서류/.test(c)&&/도와|준비|첨삭|봐주|써주|써줘|같이/.test(c))return from([brand==='lab'?'lab-year':'path-personal']);
    if(/면접|자기소개|입국심사|인터뷰/.test(c)&&/연습|준비|시켜|도와|무서|긴장|떨려|어떻게|뭐물어|무슨질문|어떤질문|질문(?:이|은)?뭐/.test(c)&&!/인터뷰요청|취재|기자|무료|유료|비용|돈|얼마|가격|수강료|지금바로|지금받|당장|신청|바로받|지금해볼|지금할수|지금가능/.test(c))return from([brand==='path'?'path-journey':'lab-vr']);
    if(/내성적|소극적|부끄러|낯가림|낯을가|말이없|말수가적|조용한(?:아이|편|성격)|수줍|발표(?:를|가|나)?.{0,4}(?:무서|싫어|못해|두려|떨)|토론(?:을|이)?.{0,4}(?:무서|싫어|못해)/.test(c)&&(brand==='lab'||/아이|학생|자녀|애/.test(c))&&!/춤|댄스|k컬처|공연|촬영|빠져도|빠질수|안해도|안하면/.test(c))return from(['lab-class']);
    if(/긴장|무서|떨려|걱정|자신없/.test(c)&&/교수님|질문|발표|수업|대화|생활/.test(c)&&!/(?:기계|ai|로봇|컴퓨터|앱)(?:가|이|만|으로|로)?.{0,6}(?:가르|수업|알아서|봐주)|선생님?없이|사람없이|담임/.test(c))return from([brand==='path'?'path-journey':'lab-languages']);
    if(/온라인|비대면|줌|원격|zoom|화상/.test(c)&&/강의|교육|수업|과정|컨설팅/.test(c)&&/가능|되나|돼요|있어|있나|해요|하나요/.test(c)&&!/비용|가격|수강료/.test(c))return from([(brand==='shift'||organizationService)?'shift-education':'lab-adult']);
    if(organizationService&&/한국어/.test(c)&&!/ai/.test(c))return from(['lab-adult']);
    if(/(?:먼저|보다).{0,10}(?:좋아|선호|편해|원해)|내스타일|취향대로|원하는방식|선호하는/.test(c)&&/돼|되나|가능|할수|맞춰/.test(c)&&(!brand||brand==='lab'))return from(['lab-personalization']);
    if((brand==='lab'||!brand||/학원|lab|오프라인|교실|개원/.test(c))&&/학원.*어디|울란바토르|첫(?:오프라인)?거점|어느(?:도시|지역).*개원|주소가어디|수업장소|(?:lab|학원).*위치|다른나라.*(?:학원|개원|지점|수업|교실)|(?:학원|지점|캠퍼스|교실).*(?:다른나라|해외|다른도시|한국에도)|학원.*(?:가볼|방문|찾아갈|주소)|(?<!메일|이메일|문의|유튜브|채널)주소좀|(?<!메일|이메일|문의|유튜브|채널)주소(?:가|는|를)?(?:뭐|어디|알려)|가볼수있는곳|방문할수있는곳|오프라인(?:공간|장소|교실|수업)(?:은|는|이)?(?:어디|있)/.test(c))return from(['lab-location']);
    // Who can join a LAB class: children, teenagers, adults, parents, foreigners.
    const learnerType=/초등|중학생|고등학생|청소년|어린이|아이|자녀|애들|유아|성인|어른|직장인|회사원|회사다녀|직장다녀|퇴근|대학생|대학원생|외국인|노인|어르신|시니어|주부|엄마|아빠|부모님|[1-9]0대|\d{1,2}(?:살|세)|(?:에|에서)살아|살고있|거주|사는데|국적|사람이(?:에요|예요|야|고|라서|인데)|사람인데|출신|에서왔|아들|딸|고[123]|중[123]|초[1-6]/.test(c);
    if(learnerType&&!organizationService&&(!brand||brand==='lab')&&/가능|들을수|배울수|수강할수|수강가능|참여할수|참여가능|다닐수|등록할수|대상|받아주|괜찮|수업(?:이|은)?있|맞을까|맞나|적합|어울릴/.test(c)&&!/비용|수강료|가격|명단|정보|기록|성적|교육담당|직원교육|춤|촬영|k컬처|문화|활동|영어|회화|vr|게임|체험|프로젝트|90분|30분/.test(c))return from([/성인|어른|직장인|대학생|대학원생|노인|어르신|시니어|주부|엄마|아빠|부모님|[2-9]0대|[2-9]\d(?:살|세)|회사원|회사다녀|직장다녀|퇴근/.test(c)?'lab-adult':'lab-audience']);
    // Someone with no Korean at all asking whether they may join is asking who the classes are for.
    if((brand==='lab'||!brand)&&/아예모르|아예몰|하나도모르|하나도몰|전혀모르|전혀몰|왕초보|완전초보|기초도없|한글도모르|한글도몰|배운적없|제로베이스|제로에서/.test(c)&&/등록|수강|참여|들을수|다닐수|받아주|되는과정|수강할수|들어갈수|대상/.test(c)&&!/비용|수강료|가격|얼마|뭐부터|어디부터|무엇부터/.test(c))return from(['lab-audience','lab-start']);
    if(!/[가-힣]/.test(input)&&(/[\u0400-\u04ff]/.test(input)||/[a-z]{2,}\s+[a-z]{2,}/i.test(input)))return from(['guide-language'],'language');
    if(/중간(?:부터|에)?(?:들어|합류|참여|편입|시작|입학)|중간편입|편입|레벨테스트|반편성|수준별반|처음부터다시|(?:내|제)수준에맞는반|어느반|몇급반|급수별반|어느레벨|무슨반|어떤반/.test(c)&&(brand==='lab'||!brand)&&!/기업|직원/.test(c))return from(['lab-availability'],'needs_confirmation');
    if(/간식|점심|급식|도시락|식사제공|셔틀|통학|기숙사|숙소|교복|준비물/.test(c)&&(brand==='lab'||/아이|수업|학원/.test(c)))return {...unknown(brand),relatedIds:['lab-parent','lab-availability']};
    // Release and streaming questions about the music belong to the K-LOFI page, which lists the release notice.
    if(/(?:음악|노래|곡)(?:으로|도|이|은|는)?(?:도)?(?:나와|나오|발매|출시|판매|살수|구매|다운|나옴)|(?:파일|버전|풀버전|전체버전)(?:으로|로)?(?:도)?(?:나와|나오|받을수|다운|살수|구매|발매)|스포티파이|spotify|멜론|애플뮤직|유튜브뮤직|지니|벅스|스트리밍(?:앱|서비스|플랫폼|으로|사이트)|발매|앨범/.test(c)&&(brand==='pulse'||!brand||/라디오|lofi|로파이|klofi|pulse|앨범|스트리밍/.test(c))&&!/저작권|써도|사용해도|이용해도|허락|광고에|매장|가게|만들어줄|제작해/.test(c))return from(['pulse-radio']);
    if(brand==='pulse'&&/(?:틀어놓|틀어두|틀어놔|배경으로|부담없이|편하게|가볍게)(?:기)?(?:에)?(?:좋은|들을|듣는|딱인)?.{0,6}(?:콘텐츠|작품)(?:을|를|들을|들)?.{0,6}(?:위주|만드|제작|편인가|편이에요|중심|주로)/.test(c)&&!/저작권|써도|사용해도|허락|매장|가게/.test(c))return from(['pulse-content']);
    if(/틀어|틀어놓|틀만|배경음|작업용|노동요/.test(c)&&/음악|노래|로파이|lofi|라디오|플레이리스트|bgm|잔잔|영상/.test(c)&&!/저작권|허락|상업|광고|매장|가게|카페|식당|상점|영업|손님|써도|사용해도|이용해도|틀어도|틀어놔도|영상에|유튜브에|늘어|도움|효과|좋아지|향상/.test(c))return from(['pulse-radio']);
    if(/라디오|klofi|케이로파이|k로파이|로파이|lofi|24시간.*(?:방송|음악|틀)|하루종일.*(?:틀|음악|방송)/.test(c)&&!/공부|학습|집중|저작권|허락|사용|상업|광고에|매장|가게|카페|식당|상점|영업|손님|틀어도|틀어놔도|틀어놓아도|궁극|비전|철학|지향|목표는|만드는분|만든분|누가만|애니메이션|만화|시리즈|왜같이|한회사|연결고리|같이하는|함께하는|왜함께/.test(c))return from(/감상영상|저영상|오늘밤제일환한|전곡/.test(c)?['pulse-listening','pulse-radio']:['pulse-radio']);
    if(/유튜브채널|인스타그램|텔레그램|공개채널|sns채널/.test(c)||(/틱톡|tiktok|인스타|페이스북|트위터|스레드|블로그|카카오채널|유튜브|텔레그램/.test(c)&&/해요|하나요|있어|있나|운영|계정|채널|주소|링크|팔로우|구독/.test(c)&&!/써도|사용|올려도|광고|저작권|팔로워늘|늘리|올릴|올리|게시|포스팅|제계정|내계정|저희계정|우리계정|손님|메뉴|홍보용|만들어보|만들고싶|만드는|쓰려고|하려고|운영해요|운영합니다|운영하고|운영중|구독자있|구독자가|채널로고|채널운영/.test(c)))return brands.includes('shift')?from(['guide-contact']):from(['guide-channels']);
    if(/(?:제|본인)(?:개인)?정보.*(삭제|수정|확인)/.test(c))return from(['guide-personal']);
    if(/개인정보|프라이버시|(?:여기|질문창|채팅|대화창|이창|이질문창)(?:에|서|다|에다)?(?:쓴|적은|입력한|남긴|친|보낸|말한)(?:거|것|내용|글|말)?(?:은|는|이|가|도)?.{0,6}(?:저장|보관|남|기록|누가봐|누가보|볼수있|공개|어디로가|어디가|가요|전송|읽)|(?:여기|질문창|채팅|대화창|이창|이질문창)(?:에|서|다|에다)?.{0,16}(?:써도|적어도|입력해도|쓰면|적으면|남기면|치면).{0,8}(?:저장|남|기록|보관|어디)|(?:이름|학교|개인정보|연락처|번호|나이)(?:이랑|과|와|을|를|도|같은거|같은것)?.{0,8}(?:써도|적어도|입력해도|쓰면|적으면).{0,8}(?:저장|남|기록|어디|수집)|^누가(?:봐요|보나요|보는거|읽어|확인해|보죠)|(?:정보|내용)(?:가|는|를|도|이|은)?(?:저장|보관|수집|남아|남나|남는)|데이터(?:를)?수집|수집하는|수집해|(?:어떤|무슨)\S{0,4}(?:들었는지|들은지|봤는지|보는지)|취향(?:을)?분석|기록(?:을)?(?:모으|수집|저장|남기)|(?:뭐|무엇을)(?:듣는지|보는지|하는지|검색하는지)|대화.*(저장|기록|남|전송)|질문.*(저장|기록|남|전송)|저장.*(대화|질문)|쿠키|보관기간|학생정보.*(다루|보호|처리)|(?:질문|대화|입력).*(외부ai|학습에|보내)/.test(c))return from(['guide-privacy']);
    if(/(?:제일|가장|최고|유명한|좋은)(?:좋은)?.{0,6}(?:학원|학당|어학당|대학|학교|회사|업체)(?:추천|알려|어디)|(?:학원|학당|어학당|대학교?)(?:추천|순위|랭킹)/.test(c)&&!/synk|lab|shift|pulse|path/.test(c))return unknown(brand);
    if(/topik|토픽/.test(c)&&/시험(?:일|날짜|일정|접수|장소)|접수(?:일|기간|언제|시작)|원서접수|시험언제|언제시험|시험(?:은|이)?언제|성적발표|결과발표/.test(c))return {...unknown(brand),relatedIds:['lab-topik','guide-contact']};
    if(/무슨뜻|뜻이?뭐|의미가?뭐|어떻게읽|맞춤법|문법(?:이|을)?(?:알려|설명|질문)|차이(?:가|는)?뭐|뭐가달라/.test(c)&&/['"‘’“”]|-[가-힣]/.test(input))return {...unknown(brand),relatedIds:['lab-start','guide-contact']};
    if(/한반|반인원|반정원|정원이?몇|몇명(?:이|씩)?(?:한반|같이|들어|수업|정도|이서)|학생(?:이|은|수)?(?:몇명|몇분)|인원(?:이|은)?(?:몇|얼마)|소수정예/.test(c)&&!/직원|synk|회사|팀원|일해|일하|근무|창업/.test(c))return {...unknown(brand),relatedIds:['lab-class','lab-availability']};
    if(/(?:몽골어|모국어|현지어|러시아어|중국어|베트남어|우즈벡어|카자흐어)(?:로|로도)(?:설명|수업|가르|진행|통역)|통역/.test(c)&&/수업|선생|강의|설명/.test(c))return {...unknown(brand),relatedIds:['lab-languages','lab-start']};
    if((c.match(/chatgpt|챗gpt|claude|클로드|gemini|제미나이|미드저니|midjourney|copilot|코파일럿|퍼플렉시티|perplexity|(?<![a-z])ai(?![a-z])/g)||[]).length>=2&&/중에|중|vs|비교|보다|랑|과|와|이랑/.test(c)&&/(?:뭐가|어느게|어떤게|어떤걸|뭘|누가)(?:더)?(?:나아|낫|좋|추천|쓸까|써야|골라)|더나아|더낫|더좋|추천/.test(c))return {...unknown(brand),relatedIds:['shift-ai','guide-contact']};
    if(/엑셀|vlookup|파워포인트|포토샵|한글파일|워드문서/.test(c)&&/쓰는법|사용법|하는법|방법|알려|만드는법/.test(c))return unknown(brand);
    if(/월세|전세|원룸|집값|조회수|부동산|생활비|물가|교통비|서류작성|세무|회계|노무|법률자문|인테리어|이사업체|대출|보험|팔로워|구독자늘|스마트폰|게임중독|날씨|일기예보|주가|주식|코인|환율|대통령|선거|파스타|삼성|애플|주차장|카페메뉴|점심메뉴|저녁메뉴|메뉴추천|음식추천|뭐먹을지|뭐먹지|치료법|약물|콘서트|팬미팅|연예인|bts|블랙핑크|뉴진스|맛집|레시피|요리법|여행지|숙소예약|호텔|항공권|비행기표|로또|운세|수학문제|번역해줘|숙제해줘|코딩해줘/.test(c)&&!/수업|학원|가르치|배우|공부|활동|k컬처|한국어|브랜딩|로고|홍보/.test(c))return unknown(brand);
    // Everyday conversation: greetings, thanks, short acknowledgements and questions about this assistant.
    const plain=input.trim().toLowerCase().replace(/[~!?？.,…ㅎㅋ^\s]+$/g,'').replace(/\s+/g,' ');
    if(/^(?:안녕(?:하세요|하십니까|하세여)?|하이(?:요)?|헬로|hello|hi|hey|ㅎㅇ|반가워(?:요)?|반갑습니다)(?:[~!?.,\s]*(?:질문|문의|궁금한\s*(?:게|것|점))(?:이|가)?\s*(?:있어요|있습니다|있는데요?|있어서요?|드려요|드립니다|할게요|해도\s*될까요)?)?$/i.test(plain))return from(['synk-choose'],'greeting');
    if(/(?:이것저것|아무거나|뭐든|질문)(?:을|이나|도)?.{0,4}(?:물어봐도|물어도|여쭤봐도|질문해도|물어보면)(?:되|돼|괜찮)/.test(c))return from(['guide-ask']);
    // A greeting followed by small talk ("구경하러 왔어요") is still a greeting; a question after it is answered.
    if(/^(?:안녕(?:하세요|하십니까|하세여)?|하이(?:요)?|헬로|hello|hi|hey|ㅎㅇ|반가워(?:요)?|반갑습니다)[~!,.\s]*(?:구경|둘러보|처음\s*(?:왔|이에요|입니다|이라)|지나가다|우연히|들렀|들어왔|반가|잘\s*부탁|좋은\s*(?:아침|하루|저녁)|만나서|안녕|hello|hi)/i.test(plain)&&plain.length<=40&&!/[?？]|물어|궁금|알려|뭐|무엇|어떻게|언제|어디|얼마|싶어|배우|공부|수업|문의|상담|신청/.test(plain))return from(['synk-choose'],'greeting');
    if((/(?:고마워|고맙|감사)/.test(plain)&&/도움|됐어요|됐습니다|잘봤|잘읽|많이배|덕분|친절/.test(plain)&&!/[?？]|나요|까요|알려|주세요|어떻게|언제|어디|얼마|뭐|무엇/.test(input))||(/^(?:고마워(?:요)?|고맙습니다|감사(?:합니다|해요|드립니다|드려요)?|땡큐|ㄱㅅ|thx|thanks|thank you)(?:[~!.,\s]+[^?？]*)?$/i.test(plain)&&!/[?？]|나요|까요|알려|주세요|어떻게|언제|어디|얼마|뭐|무엇/.test(input))||/^(?:네|넵|넹|예|응|ㅇㅇ|ㅇㅋ|오케이|ok|okay|알겠(?:어요|습니다|어)|알았어(?:요)?|좋아요|좋네요|그렇군요|그렇구나|아하|오호|와|우와|대박|굿)$/i.test(plain)||(/(?:감사(?:합니다|해요|드립니다)|고마워요|고맙습니다|수고\s*(?:하세요|하십시오|많으십니다|많으세요|하셨습니다)|좋은\s*(?:하루|주말|저녁)(?:\s*(?:되세요|보내세요|되십시오))?|안녕히(?:\s*(?:계세요|가세요))?|다음에\s*(?:또|올게)|잘\s*있어요|bye|바이)$/i.test(plain)&&!/[?？]|나요|까요|알려|주세요|어떻게|언제|어디|얼마|뭐|무엇/.test(input)))return {status:'courtesy',records:[],sourceIds:[],brand:null,relatedIds:['synk-choose'],message:records.get('guide-courtesy').answer};
    if(/^(?:너|넌|너는|당신)\s*(?:그냥|혹시|설마|진짜|정말|지금|완전|그럼)?\s*(?:gpt|챗\s*gpt|챗지피티|ai|인공지능|봇|로봇|사람|클로드|제미나이)(?:야|예요|에요|이야|이에요|니|냐|임)?(?:[?？\s]|$)/.test(plain))return from(['guide-ask']);
    if(/(?:진짜|실제|리얼|찐)\s*(?:사람|상담사|상담원|직원|담당자)(?:이|가|은|는)?\s*(?:아니|맞|이에요|예요|인가요|입니까)/.test(plain)&&!/연결|바꿔|통화|대화하고|얘기하고|이야기하고|상담받|상담하고/.test(plain))return from(['guide-ask']);
    if(/^(?:너|넌|너는|당신(?:은)?|이\s*(?:질문창|챗봇|대화창)(?:은|는)?)\s*(?:누구|정체(?:가)?\s*뭐|뭐|ai|인공지능|챗봇|봇|로봇|사람|챗\s*gpt|챗지피티|지피티|gpt|클로드|제미나이|진짜\s*사람|상담원|직원)(?:야|예요|에요|이야|이에요|이세요|세요|니|냐|임|인가요|입니까|이니|인지)?$/.test(plain)||/^(?:ai|챗봇|봇|로봇|사람|gpt|상담원)(?:이세요|세요|야|예요|에요|이야|이에요|이니|니|냐|인가요|입니까|임)$/.test(plain)||/^(?:사람|봇|ai)(?:이야|야|이에요|예요)?\s*(?:봇|ai|사람)(?:이야|야|이에요|예요)?$/.test(plain)||/(?:이거|이건|여기|이\s*질문창|답변|대답)(?:은|는|이|가)?\s*(?:ai|챗\s*gpt|챗지피티|gpt|사람|로봇|봇|자동|클로드)(?:이|가)?\s*(?:답|대답|응답|하는|쓰는|만든|해주는)/.test(plain))return from(['guide-ask']);
    if(/(?:러시아어|몽골어|영어|중국어|일본어|베트남어|우즈벡어|카자흐어|외국어|다른언어|모국어|인도네시아어|태국어)(?:로|로도)(?:물어|질문|답|대답|안내|문의|채팅|대화|이용|써도|해도)/.test(c)&&!/수업|강의|선생|설명해/.test(c))return from(['guide-language'],'language');
    if(/(?:사람|상담원|상담사|직원|담당자|매니저)(?:이랑|하고|과|와|한테|에게)?(?:직접)?(?:대화|얘기|이야기|통화|연결|상담|말하)/.test(c)&&!/교육|강의|연수|명단|몇명|직원수/.test(c))return from(['guide-contact']);
    if(/답답|대답을?(?:못|안)|왜(?:몰라|모르|대답을?못)|엉뚱한|이상한답|쓸모없|바보|멍청/.test(c))return from(['guide-ask']);
    // Specific public facts, rights and contact intents precede general topics.
    if(/별도법인|각각법인|따로법인|다른법인|한회사(?:안|내|소속)|같은회사|사업부(?:인가|예요|에요|로|인지)|자회사|계열사|하나의회사|한법인|법인이(?:하나|여러|따로)/.test(c))return from(['synk-brands']);
    if(/(?:이|귀|이런|여기|해당)?회사(?:를|는|을|가)?.{0,6}(?:한문장|한줄|한문단|짧게|간단히|요약|한마디)|한문장으로|한줄로|한마디로|짧게소개/.test(c)&&/소개|설명|정리|요약|표현|말하|쓰면|하면/.test(c)&&!/다르|차이|차별|접근|비교|아틀라스|atlas|엔진|lab|shift|pulse|path/.test(c))return from(['synk-intro']);
    if(/프로그래밍언어|언어로(?:짜|만들|개발|작성)|파이썬|자바스크립트|리액트|유니티|언리얼|기술스택|프레임워크|서버(?:는|가)?어디|클라우드|aws|gcp|데이터베이스(?:는|가)?뭐|어떤db|무슨db/.test(c)&&/엔진|아틀라스|앱|시스템|홈페이지|서비스|만들|개발|짜여|구현/.test(c))return {...unknown(brand),relatedIds:['synk-atlas','guide-contact']};
    if(/법인(?:등록|설립)?(?:은|이)?(?:된|되어|했|있)|정식(?:회사|법인)|등록된회사|회사등록|사업자등록(?:은|이)?(?:된|되어|했|있|돼)|사업자(?:등록)?(?:가|는)?있|법인형태|개인사업자인지|법인인지/.test(c))return from(['synk-registration']);
    if(/사업자등록번호|사업자번호|등록번호/.test(c))return from(/연락|문의/.test(c)?['synk-registration','guide-contact']:['synk-registration']);
    if(/저작권|권리|소유권/.test(c)&&/맡기|맡겨|의뢰|제작해|만들어준|만들면|납품/.test(c)&&!/법적|법률|판례|생성형|ai로만든/.test(c))return from([/로고|브랜딩|홈페이지|웹/.test(c)?'shift-scope':'pulse-collaboration']);
    if(/광고(?:표기|표시|고지|문구|라고표|임을)|유료광고|협찬(?:표시|표기|고지)|뒷광고|광고인거|광고인지/.test(c))return from(['pulse-advertising']);
    if(/(?:저희|우리|제|내)(?:회사|브랜드|제품|가게|매장)?.{0,6}광고(?:에|영상에|물에)?.{0,8}(?:캐릭터|몽글|까몽|마린|음악|노래)(?:를|을|들)?.{0,8}(?:써보고|쓰고|넣고|출연|활용|나오게|등장)|(?:캐릭터|몽글|까몽|마린)(?:를|을|들)?.{0,6}(?:저희|우리|제)?(?:브랜드|회사)?광고에/.test(c)&&/싶|가능|되나|돼요|될까|문의/.test(c))return from(['pulse-advertising']);
    // Who to ask for permission to use a work is a collaboration enquiry, not the rights notice itself.
    if((brand==='pulse'||prevIds.has('pulse-rights')||/음악|캐릭터|몽글|까몽|마린|노래|곡|영상|작품/.test(c))&&/(?:허락|허가|승인|사용문의|이용문의|라이선스|사용권)(?:은|는|을|를)?.{0,6}(?:누구|어디|누가)(?:한테|에게|에|로|께|서)?.{0,6}(?:받|문의|연락|물어|요청|구해)|(?:누구|어디)(?:한테|에게|에|로|께)?.{0,4}(?:허락|허가|승인)(?:을|를)?(?:받|구해|맡)/.test(c))return from(['pulse-collaboration']);
    if(/콜라보|컬래버|협업|같이찍|함께찍|출연|협찬|같이만들|함께만들|같이뭔가|뭔가만들어보/.test(c)&&/캐릭터|몽글|까몽|마린|pulse|영상|유튜브|음악|노래/.test(c)&&!/기업교육|직원/.test(c))return from(['pulse-collaboration']);
    if(/요청문|프롬프트|예문/.test(c)&&/복사|복붙|그대로|써도|사용해도/.test(c)&&!/공개하|공개해|공개하시|보여주시|실패/.test(c))return from(['shift-materials']);
    if(/(?:인형|굿즈|피규어|키링|스티커|엽서|포스터|상품|제품|머그|티셔츠|장난감)(?:을|를|은|는|도|이|가)?.{0,8}(?:사고싶|살수|사려면|파나|팔아|판매|구매|구입|어디서사|출시|나와|나오|있어|있나|만들어)/.test(c)&&(brand==='pulse'||/몽글|까몽|마린|캐릭터|synk|pulse/.test(c))&&!/내가만든|제가만든|직접만든|팔아도|팔고싶|판매해도/.test(c))return {...from(['guide-availability'],'needs_confirmation'),relatedIds:['pulse-ip','pulse-rights','guide-contact']};
    if(/캡처|캡쳐|퍼가|가져다|넣어도|올려도|써도|사용해도|이용해도|틀어도|틀어놔도|틀어놓아도|팔고싶|팔아도|판매|굿즈|스티커|인쇄해|만들어팔|상품으로/.test(c)&&/이미지|그림|사진|캐릭터|몽글|까몽|마린|로고|음악|노래|영상|작품|일러스트/.test(c)&&!/내가만든|제가만든|직접만든/.test(c))return from(['pulse-rights']);
    if(/상업|저작권|재배포|이용권|라이선스|복사해|광고에|영상에|유튜브에|매장|가게|카페|식당|상점|영업장/.test(c)&&(/음악|곡|노래|작품|pulse|로고|캐릭터|몽글|까몽|마린|lofi|로파이|라디오/.test(c)||brand==='pulse'))return from(['pulse-rights']);
    if((brand==='pulse'||/로고|캐릭터|몽글|까몽|마린/.test(c))&&/써도|사용해도|사용범위|사용허락|이용조건|무료로쓰|허가/.test(c))return from(['pulse-rights']);
    if(/교수님?(?:한테|에게|께)?.{0,6}(?:이메일|메일|편지)|(?:이메일|메일|편지)(?:쓰기|보내기|작성)(?:체험|연습|게임)?|(?:이메일|메일)(?:보내는|쓰는)(?:연습|체험|게임)|(?:교수님?|실제|진짜)(?:한테|에게|께)?(?:로)?.{0,6}(?:가는|보내지는|전송|발송)(?:거|건)?(?:아니|맞)/.test(c)&&!/문의|연락처|답장이|회신|문의메일|메일주소|고쳐|교정|첨삭|피드백|답장|자동|진도|저장|기록|화면인가|실제(?:로)?.{0,6}(?:저장|기록|반영|남)/.test(c))return from(['lab-start']);
    if((brand==='shift'||!brand||/가이드|제작법/.test(c))&&/자료|가이드|공개글|제작법/.test(c)&&/계정|이메일|가입|로그인|회원|댓글|구독|넣어야|입력해야|남겨야|무료/.test(c)&&/보려면|볼때|보는데|봐도|읽으려면|열려면|받으려면|필요|되나|돼요|해야|건가요|인가요/.test(c)&&!/문의|협업|의뢰/.test(c))return from(['shift-materials']);
    if(!(brand==='pulse'&&/캐릭터|음악|노래|콜라보|협업|같이만들|함께만들|같이뭔가/.test(c))&&(/접수|전달되|담당자.*답|나중에답|회신|연락(?:은|을|처는)?어디로|어디로(?:연락|문의|드리|보내)|누구한테연락|여기에.*(보내|적었)|여기(?:에|다|에다)?.{0,16}(?:남기|적으|쓰|적어두|남겨두|적어놓)(?:면|으면).{0,8}(?:답장|답변|연락|회신)|연락할곳|연락처|이메일|메일주소|문의주소|연락주소|전화번호|연락.*어떻게|어떻게.*연락/.test(c)||(!advertisingService&&!advertisingEducation&&/어디.*문의|문의.*어디|어디(?:에|로|에다|다)?(?:물어|여쭤|연락)|누구(?:한테|에게)(?:물어|문의|연락)/.test(c))))return from(['guide-contact']);
    if(/자료.*(?:실제고객|실제사례|성공사례)|가상.*예시/.test(c))return from(['shift-materials']);
    if(brand==='shift'&&/수익|매출/.test(c)&&/따라|쓰면|나죠|낼수|얻|보장/.test(c))return from(['shift-results']);
    if((brand==='shift'||organizationService)&&/따라올수|따라갈수|따라올|따라갈|따라가면서|따라가|안써본|안써보|써본적|처음써|익숙하지|익숙치|낯설|어르신|[456]0대|나이많|컴맹|기초부터|왕초보|한번도|문외한|잘몰라|지식(?:이|도)?(?:전혀|아예|하나도)?없/.test(c))return from(/프리랜서|1인|혼자|소상공인|자영업|개인사업/.test(c)?['shift-start','shift-audience']:['shift-start']);
    if((brand==='shift'||/컨설팅|브랜딩|ai교육|ai강의/.test(c))&&/개인(?:도|은|이|만)(?:아예|따로|전혀)?(?:가능|되나|돼요|신청|참여|괜찮|받을|받아|받으|이용|안되|안돼|안받)|회사만|기업만|법인만|개인은안|기업대상(?:이라|만|인가)/.test(c))return from(['shift-audience']);
    if((brand==='shift'||organizationService)&&/사후지원|후속지원|사후관리|출장(?:강의|교육)|출강|지방(?:강의|교육)|방문(?:교육|강의)|와주실수|찾아와주/.test(c))return from(['shift-education'],'needs_confirmation');
    if(/(?:변화|성장|발전|늘었는지|달라진|나아졌는지)(?:를|을|가|이|은|는)?.{0,8}(?:어떻게)?(?:보여|알려|확인|볼수|알수|공유)/.test(c)&&(brand==='lab'||/아이|자녀|학생|우리애|부모|보호자/.test(c))&&!/기업|직원|매출|성과/.test(c))return from(['lab-parent']);
    if(/(?:방법|가이드|요청문|프롬프트)(?:은|도|을|이|대로)?.{0,8}(?:다른(?:툴|도구|프로그램|ai)|스테이블디퓨전|미드저니|달리|런웨이|피카|소라)(?:으로|로)?(?:도)?(?:되|돼|가능|쓸수|적용|먹히)/.test(c))return from(['shift-results']);
    if(brand==='pulse'&&/더있|더없|다른(?:곡|영상|노래|작품)|비슷한(?:거|곡|영상|스타일)|이런(?:스타일|느낌|거)|그런(?:감성|느낌|분위기)?(?:영상|노래|곡)|다른것도|또있|더보고싶|더듣고싶/.test(c))return from(/영상|노래|곡|음악|추석|감성|분위기/.test(c)&&!/캐릭터|이야기|스토리|콘텐츠|작품/.test(c)?['pulse-listening','pulse-content']:['pulse-content']);
    if(/(?:결과|결과물|산출물|퀄리티|품질|완성도|제품|서비스|가치|원칙|약속)(?:가|이|을|를|의|는|은|에서는|에서|들을|들이)?.{0,14}(?:괜찮은지|좋은지|맞는지|판단|평가|검토|확인|기준|검수|점검|지키고|지켜지)/.test(c)&&!/성과|보장|수익|매출|비교수치|효과|다르게|다른결과|왜다르|안하고|않고|그대로|써도|사용해도/.test(c))return from(['philosophy-quality']);
    if(/(?:사람|인력|직원|사람들)(?:을|의|이)?.{0,4}(?:줄|대체|없애|자르|감원|대신)|사람(?:의)?역할|(?:사람|인간)(?:과|이랑|와)(?:ai|기술|기계)|(?:ai|기술|기계)(?:와|과|이랑)(?:사람|인간)|(?:중요한)?(?:결정|판단)(?:도|은|을|이|들)?(?:결국|전부|다|모두|전체)?(?:ai|인공지능|기계|시스템)(?:가|이)?(?:다|모두|전부)?(?:내리|하|정하|해버)|사람(?:의)?몫|사람(?:이|의)?(?:직접)?(?:판단|결정)(?:할|하는|해야|하도록)(?:부분|영역|일|것|거)|(?:ai|인공지능|기계)(?:가|이)?(?:다|모두|전부|알아서)(?:결정|판단)(?:하|해버리|내리)/.test(c)&&/역할|대체|줄|생각|보세요|기준|어떻게|대신|없애|감원|몫|남겨|따로|결정|판단|내리/.test(c)&&!/선생|교사|강사|가르치|가르쳐|수업|아이|우리애|자녀/.test(c))return from(['philosophy-people']);
    if(/똑같이|같은결과|동일한결과|똑같은결과|결과가같|다르게나|다른결과|결과가다|매번다|왜다르|결과가달라|똑같이안|같게안나/.test(c)&&(brand==='shift'||/요청문|프롬프트|가이드|ai/.test(c)))return from(['shift-results']);
    if(/협력대학.*목록|강사.*명단/.test(c))return from(['guide-unpublished'],'needs_confirmation');
    if(/경쟁사|다른회사보다|몇배|성공률|몇퍼센트|비교수치|(?:다른|타)(?:업체|회사|경쟁사|곳|학원|기업)(?:들)?(?:보다|에비해|대비|와비교|과비교|랑비교|하고비교).{0,12}(?:낫|우수|뛰어나|좋|앞서|월등).{0,12}(?:자료|수치|데이터|근거|증거|통계|보여)/.test(c))return from(['guide-evidence']);
    // Only SYNK's own headcount is unpublished; a client's staff training is a service question.
    const companyPeopleFact=/팀규모|회사규모|조직규모|규모가(?:어느|얼마)|(?:직원|인력)(?:수|은몇|이몇|규모|몇명)|(?:기업|회사|고객사|기관|업체)(?:이|은|가|수|들이|들은|들이|는)?(?:지금까지|현재|총|모두|다|이제껏|여태)?(?:몇곳|몇개|몇군데|얼마나(?:많|되)|몇이나)|(?:몇곳|몇개|몇군데)(?:의|나)?(?:기업|회사|고객사|기관|업체)|(?:직원|인력)(?:이|은)?(?:지금|현재|총|다|모두)?(?:몇|얼마나)|몇(?:명|분)(?:이|의|이서)?(?:직원|일해|일하|근무)|(?:synk|회사|싱크)(?:의|에는|에)?(?:직원|인력)(?:은|이)?(?:몇|많|누구)|(?:선생님|강사|교사)(?:이|은|님은|님이)?(?:몇분|몇명)|몇(?:분|명)(?:이나)?(?:의)?(?:선생님|강사|교사)/.test(c);
    // The founder's own awards and career are on the public founder page.
    if((companyPeopleFact||/매출|수익|(?<!학|원|병|유치)원가(?!입|고|서|는|려|면)|설립(?!자)|창립|연혁|소재지|본사주소|(?:회사|본사|사무실)(?:는|가|의|이)?(?:어디에있|어디있|위치|주소)|synk(?:는|가|의)?(?:사무실|위치|주소)|고객사(?!례)|인증|수상|투자|협약|제휴처|파트너사|(?:제휴|협약|협력|파트너십?)(?:을|를|이|가)?(?:맺은|맺고|한|된|중인)?.{0,6}(?:대학|기관|학교|회사|업체|기업|곳|파트너)(?:이|은|는|도|가)?.{0,4}(?:있|어디|누구|목록|몇)/.test(c))&&!/(?:창업자|대표|기획자|양유호|설립자).{0,8}(?:수상|학력|경력|이력|기록|배경)|수익창출|수익화|제채널|내채널|브이로그|유튜브에|영상에|지금.*(?:돌아가|운영|단계)|현재.*(?:돌아가|운영|단계)|실제로(?:돌아가|운영)/.test(c)){
      if(brand==='shift'&&/성과|보장|성공|늘|증가|같은/.test(c))return from(['shift-results']);
      return from(['guide-unpublished'],'needs_confirmation');
    }
    if(/지금.*(?:운영|단계|준비|출시|돌아가|굴러가|되는|열린|쓸수|써볼|해볼|이용할|체험할|당장)|현재.*(?:운영|단계|준비|출시|돌아가|되는)|이미출시|열었|모두운영|실제로(?:돌아가|하는|되는|운영)|서비스중|운영중인/.test(c)&&!/비용|수강료|신청|앱|라디오|방송|수업|과정|직원|몇명|인원|명이나|매출|수익|엔진|비자|면접|인터뷰|연습|체험/.test(c)&&!followupCue&&!(brands.length&&/사업영역|사업|서비스|영역/.test(c)))return from(['synk-stage']);
    if(/(?:정확히|구체적으로)?(?:어떤|무슨)(?:일|교육|서비스|사업|도움|회사|곳)(?:을|를|이|인지)?(?:하는|해주는|주는)?(?:곳|회사|데)?(?:인지|이에요|예요|인가요)?.{0,14}(?:소개|설명|알려|알아보)/.test(c)&&!/차이|다른|비교|철학|비전|방향|엔진|아틀라스|가격|비용|어떤도움을받을|도움을받을/.test(c))return from([brandIds[brand]||brandIds[context.brand]||'synk-intro']);
    // "So it is a brand that does X, right?" confirms what a brand is; the introduction answers it.
    if(brandIds[brand]&&brand!=='lab'&&/(?:브랜드|서비스|회사|팀|곳|프로그램|사업|기업|스튜디오|레이블)(?:이|라고|이라고|로|으로|이라)?(?:보면|이해하면|생각하면|봐도|이해해도|알면|받아들이면)(?:되|맞|될까|괜찮)|(?:브랜드|서비스|회사|팀|프로그램|사업|기업)(?:인가요|이에요|예요|인거죠|인건가요|맞나요|맞죠|인거예요|인가봐요|인지)$/.test(c)&&!/차이|다른|비교|가격|비용|일정|누구|어디|얼마|언제|명단|연락처|왜|철학|비전|목표|계약|저작권|사용|써도|채용|모집|범위|어디까지|정확히|구체적으로|강의|교육만|컨설팅만|만하는|만드는회사|만드는곳/.test(c)&&!data.records.some(r=>r.questionExamples.some(ex=>compact(normalizeQuery(ex))===c)))return from([brandIds[brand]]);
    if(/어디부터(?:보|봐|시작|읽|들어가)|뭐부터(?:보|봐|읽)|어느(?:페이지|쪽|메뉴|브랜드|사업)(?:부터|를|을)?(?:보|봐|시작|들어가)|둘다관심|양쪽다|둘다궁금|브랜드가(?:너무)?많|사업이(?:너무)?많|맞는(?:브랜드|사업)(?:이|은)?(?:어디|뭐|어느)/.test(c)&&(!brand||brands.length>1||/유학.*한국어|한국어.*유학|둘다|양쪽|브랜드가(?:너무)?많|사업이(?:너무)?많|어느(?:브랜드|사업)|맞는(?:브랜드|사업)/.test(c))&&!/처음배우|초보|한국어(?:를|가)?처음/.test(c))return from(['synk-choose']);
    if(brands.length>1&&/둘다|따로|각각|같이|함께|중복|동시에/.test(c)&&/등록|신청|가입|이용|다녀|들어/.test(c))return from(['synk-brands']);
    if(/synk|싱크/.test(c)&&brands.length===0&&/소개(?:해|글|문)|한문단|한줄|요약해|정리해/.test(c))return from(['synk-intro']);
    if((/(?:교육|학원|한국어|ai|컨설팅).{0,16}(?:음악|노래|작품|콘텐츠|로파이|라디오)|(?:음악|노래|로파이).{0,16}(?:교육|학원|한국어|컨설팅)/.test(c))&&/왜|이상|같이|함께|한회사|하나의회사|어떻게연결|연결고리|공통점|접점|연관|관계|무슨상관/.test(c))return from(/왜|굳이|특이|이상/.test(c)&&!/연결고리|공통점|접점/.test(c)?['synk-intro','synk-brands']:/연결고리|공통점|접점|왜같이|왜함께/.test(c)?['synk-brands','synk-intro']:['synk-brands']);
    if(/다른(?:\S{0,6})?(?:업체|회사|학원|곳|기관|유학원|교육기관)(?:이랑|과|와|보다|하고|랑)?.{0,8}(?:다르|다른지|다른가|다른데|달라|차이|차별|나은|좋)|차별점|차별화|왜여기|왜synk|(?:유학원|에이전시|대행사|학원|업체|다른곳)(?:이랑|과|와|하고|랑)?(?:똑같|같은거|뭐가다|차이|다르|다른|모가다)|(?:여기|synk|너네|이곳|lab|shift|path|pulse)(?:는|가|이|랑|은)?.{0,6}(?:뭐가|무엇이|어떤점이)다(?:르|른|라)/.test(c)&&brands.length<2)return from([/유학원|에이전시|대행사/.test(c)||brand==='path'?'path-why':brand==='lab'?'lab-method':'synk-value']);
    if(/어디(?:서|에서)?(?:담당|맡|해요|하나|해)|어디(?:에|로|에다|다|다가)?(?:물어|문의|여쭤|연락|얘기)|어느(?:브랜드|쪽|곳)(?:이|에서)?(?:담당|맡|해)|누가담당/.test(c)&&(brands.length>1||(/브랜딩|광고|교육|음악|유학|한국어|컨설팅/.test(c)&&/이랑|과|와|하고|랑/.test(c))))return from(['synk-choose']);
    if(/(?:남는게|남는것|손에남|뭐가남|얻는게|얻는것)/.test(c)&&/1년|과정|수업|교육|끝나|하면/.test(c))return from([brand==='shift'||organizationService?'shift-takeaway':'lab-year']);
    if(/알바|아르바이트|시간제|파트타임/.test(c)&&/시간|몇|허용|가능|할수|돼|되/.test(c))return from(['lab-topik']);
    // Continue a topic only when the visitor has not named a different one.
    if(!brands.length&&previous.length&&/^(?:(?:좀|조금)?더(?:자세히)?|자세히)(?:설명|알려|말해|보여)?(?:해줘|해주세요|줘|주세요|요|해|줄래|줄래요)?$/.test(c)){
      const result=from(previous.map(r=>r.id));return {...result,expanded:true};
    }
    const exact=data.records.find(r=>r.questionExamples.some(ex=>compact(normalizeQuery(ex))===c));
    if(exact)return from([exact.id]);
    if(/(?:synk|싱크|회사)(?:라는|의)?(?:이름|명칭)(?:은|이)?.{0,8}(?:뜻|의미|유래|왜)|이름의(?:뜻|의미|유래)/.test(c))return {...unknown(brand),relatedIds:['synk-intro','guide-contact']};
    // The founder page is public: who builds SYNK and the founder's education, career and awards.
    const founderWord='(?:창업자|창업하신분|창업한분|설립자|대표(?:님|이사|분|께서)|기획자|양유호|ceo|사장님|(?:회사를|synk를|싱크를|여기를)?(?:시작|세운|세우신|만든|만드신|창업)(?:한|하신)?분)';
    const founderRef=!/(?:사장|대표|창업자|기획자)(?:님)?(?:인데|이에요|입니다|이라서|이라|으로서|이고|인데요|예요)/.test(c)&&!/크레딧|제작진|스태프|작곡|작사|(?:곡|노래|영상|음악|캐릭터)(?:을|를)?만든분/.test(c)&&(new RegExp(founderWord).test(c)||/대표(?=학교|대학|학력|전공|경력|프로필|수상|나이|이름|성함|누구)/.test(c)||(/^(?:그분|그사람|그|이분|본인|그는|그녀|저분)/.test(c)&&['synk-planner','synk-founder','synk-founder-background'].some(id=>prevIds.has(id))));
    if(founderRef&&/나이|고향|결혼|가족|연봉|주소|연락처|몇살|생일|사는곳|어디살|출신(?:지|지역|국가|나라)/.test(c)&&!/학교|대학|학력|전공|경력/.test(c))return {...unknown(brand),relatedIds:['synk-founder-background','guide-contact']};
    if(founderRef&&/학교|대학|학력|전공|경력|기록|경험|프로필|수상|배경|걸어온|뭐했|무슨일했|원래뭐|뭐하던|뭐하시던|해오신|하시던|출신|나오셨|나왔/.test(c))return from(['synk-founder-background']);
    if((founderRef&&/누구|이름|성함|누가|어떤사람|어떤분|소개/.test(c))||/양유호(?:는|가|씨|님)?(?:누구|소개)?$|(?:창업한|설립한|세운|만든)사람|^(?:ceo|대표|대표님|창업자|사장님?)$/.test(c))return from(['synk-planner']);
    if(/누가(?:이끌|운영|맡|대표|책임)|이끄는사람|리더(?:가|는)?누구/.test(c)&&!brands.length&&!/교육|수업|강의|컨설팅|브랜딩|광고|상담|과정/.test(c))return from(['synk-planner']);
    if(/대표.*(이름|성함|누구)|기획자.*(누구|역할)|만드는사람/.test(c))return from(['synk-planner']);
    if(/(?:만드신|만든|시작하신|세우신|창업하신)(?:이유|계기|동기)|추구하(?:시)?는(?:방향|것|가치)|왜만드셨|왜시작하셨/.test(c)&&!/엔진|아틀라스|캐릭터|음악/.test(c))return from(['synk-founder']);
    if(/기획자|창업자/.test(c)&&/추구|원하|방향|만들고싶|철학/.test(c))return from(['synk-founder']);
    if(/비자|법률|법적|입학보장|취업보장/.test(c))return pathwayService?from(['path-support'],'needs_confirmation'):brand==='lab'||/학교|합격|보장/.test(c)?from(['lab-topik']):unknown(brand);
    if(/copyright|저작권표시|저작권표기|카피라이트/.test(c))return from(['synk-registration']);
    if(/캐릭터|마스코트|몽글|까몽|마린|이친구들|얘네|이애들/.test(c)&&/이야기|스토리|세계관|에피소드|영상|콘텐츠|나와|나오|등장|애니메이션|애니|만화|시리즈/.test(c)&&!/이름|누구|프로그램|툴|도구|가이드|눈움직|움직이게|해보고싶|써도|사용해도|만들어주/.test(c)&&brand!=='shift')return from(['pulse-content']);
    if(/(?:만드는|만든|운영하는|하는)(?:분|사람|팀)(?:들)?(?:이|은|가)?(?:누구|누가)|(?:만드는|만든|운영하는)(?:곳|회사)(?:이|은|가)?(?:어디|누구)|회사(?:예요|에요|인가요)?개인(?:이에요|이예요|인가요)|개인(?:이에요|이예요)?회사(?:예요|인가요)/.test(c))return from([brandIds[brand]||'synk-planner']);
    if(/(?:작곡가|작사가|가수|보컬|편곡자|성우|디자이너)(?:가|는|은|이)?(?:누구|누가)/.test(c))return {...unknown(brand),relatedIds:[brand==='pulse'?'pulse-listening':'synk-characters','guide-contact']};
    if(/코랄|동글동글|실땀|초록눈|갈색털|남색투구|노란눈|투구쓴|털복숭이|귀여운(?:애|캐릭터|친구|아이)|저애|그애|이애|쟤/.test(c)&&/이름|누구|뭐예요|뭐야|정체|친구들|다른|있나요|있어요/.test(c)&&!/장식|글자|로고|읽혔|얘기|사례/.test(c))return from(['synk-characters']);
    if(/캐릭터|마스코트|몽글|까몽|마린/.test(c)&&/이름|소개|누구|누가|뭐|알려|궁금|어떤|생겼|생김새|외모|모습|인기|최애|유명|셋중|둘중|제일|가장/.test(c)&&!/프로그램|툴|도구|가이드|눈움직|움직이게|해보고싶|만들때|어떻게만|써도|사용해도/.test(c))return from(['synk-characters']);
    if(/교수님.*(?:편지|체험)|synkworld|싱크월드/.test(c))return from(['lab-start']);
    if(brand==='pulse'&&/곡명|대표작|제목|전곡|실시간|스트리밍|생방송|추천|몇분|길이|재생시간|러닝타임/.test(c))return from(['pulse-listening']);
    if(/(?:교재|교과서|시냅스|책)(?:는|은|가|이|시리즈)?.{0,10}(?:구성|나뉘|나눠|몇권|몇단계|단계|권별|어떻게돼|어떻게되|체계|목차|커리큘럼)|문법(?:책|교재)?(?:따로|과|이랑|랑|와).{0,6}(?:말하기|회화)(?:책|교재)?/.test(c)&&!/추천/.test(c))return from(['lab-curriculum']);
    if(/교재|시냅스|(?<![가-힣])책|문법책|회화책|교과서|워크북/.test(q)&&/제목|이름|몇권|구매|구입|살수|사고싶|판매|출간|출판|언제나와|어디서사|서점|전자책|나왔|나온|나와|다나|발간|완성|나오나|나옴|어떤걸|뭘쓰|무슨교재|어떤교재|뭐로|무엇으로|어떤책/.test(c)&&!/책추천/.test(c))return from(['lab-curriculum']);
    if(/앱|어플/.test(c)&&!/개인정보|저장|기록|앱스크립트/.test(c)){
      if(/언제|출시|나오|나와|오픈|다운|설치|깔|받을수|스토어|써볼|쓸수|사용할수|어디서/.test(c))return from(['lab-availability'],'needs_confirmation');
      if(/(?:못하는|약한|부족한|틀리는|모르는|어려워하는|헷갈리는)(?:지|거|것|부분|걸|데)|약점|취약|파악|알아채|알아요|알아내|알수있|이해해|맞춰|맞춤|분석/.test(c))return from(['lab-personalization']);
      if(/이름|어떤앱|무슨앱|기능|있어|있나/.test(c))return from(['lab-personalization']);
    }
    if((/게임|체험|편지|메일쓰기/.test(c)||prevIds.has('lab-start')||prevIds.has('lab-game-demo'))&&/고쳐|교정|피드백|첨삭|답장|자동으로|진도(?:가|는|도)?(?:저장|기록|반영|남)|(?:실제|진짜)(?:로)?.{0,6}(?:저장|기록|반영)|기록(?:이|은|되는)?(?:저장|남|화면)|저장되는화면/.test(c)&&!/개인정보|누가봐|누가보|삭제/.test(c))return from(['lab-game-demo']);
    if(/게임/.test(c)&&/공부|학습|효과|배우|배운|배워|실력|늘|도움|되나|돼요|끝나|만하|장난|놀기만|시간낭비|무슨말|어떻게|뭔데|무슨게임|어떤게임|연습|다음에|정해주|골라주|맞춰|쓴문장|쓴글|제가쓴|내가쓴|방식/.test(c)&&(!brand||brand==='lab')&&!/체험|편지|메일/.test(c))return from(['lab-personalization']);
    if(/운동|몸풀기|워밍업|스트레칭|움직이/.test(c)&&/수업|전에|이유|왜/.test(c)&&(!brand||brand==='lab'))return from(['lab-culture']);
    if(/english\s*page|영어\s*페이지|영어로\s*(?:보|읽|된|볼|안내|되어)|영어\s*(?:버전|판|안내)|영문(?:페이지|사이트|판)|english\s*version/.test(q))return from(['guide-language'],'language');
    if(/게임|체험|편지|메일쓰기/.test(c)&&/해보|해볼|하고싶|어디서|어디에|무료|공짜|링크|어떻게해|시작|할수있|하려면/.test(c)&&!/vr|직업|문화|k컬처|춤|면접|가상/.test(c)&&!(followupCue&&!prevIds.has('lab-start')))return from(['lab-start']);
    if(/강사이름|학교이름|모델이름|모델명|언어모델|책추천|(?:툴|도구|프로그램)(?:의)?(?:이름|명)/.test(c))return unknown(brand);
    if(languageStudy&&/(?:선생님?|교사|강사)(?:의)?(?:이름|성함)/.test(c))return unknown(brand);
    if(/선생|교사|강사|쌤|튜터/.test(c)&&!/모집|채용|지원하|되고싶|명단|연락처/.test(c)&&!/(?:선생님?|교사|강사|튜터)(?:인데|이에요|입니다|예요|라서|으로서|로서|로일)/.test(c)){
      if(/(?:선생님?|교사|강사|쌤)(?:님|진|분들|님들)?(?:의|들의?)?(?:이름|성함|경력|학력|자격증|프로필|약력)/.test(c))return (brand==='shift'||organizationService)?from(['shift-education'],'needs_confirmation'):unknown(brand);
      if((brand==='shift'||organizationService)&&/(?:강사|선생님?|교사|트레이너)(?:는|은|가|이|진|님|분)?(?:누구|누가|어떤분|어떤사람|배정|섭외|직접|외부|몇명)|누가(?:가르|강의|진행)/.test(c))return from(['shift-education']);
      if(/k컬처|춤|댄스|안무|전공/.test(c))return from(['lab-culture']);
      if(/한국인|한국사람|한국분|원어민|네이티브|외국인선생|영어/.test(c))return from(['lab-languages']);
      if(/ai|대신|로봇|기계|없이|없나요|없어요|없는|없어|앱으로만|혼자서만|자동으로만|사람없|진짜사람|실제사람|사람이(?:에요|예요|가르|맞|야|니|해)/.test(c))return from(['lab-teacher']);
    }
    if(/(?:과정|실패|시행착오|ai쓴|ai를쓴|ai썼|ai를썼)(?:한|를|을|다|것을|걸|사례|사례도|사례를|한사례도?)?.{0,8}(?:드러내|공개|보여주|밝히|왜)/.test(c)&&(brand==='shift'||/ai|작업/.test(c)))return from([/실패|시행착오/.test(c)&&/잘된(?:것|거)만|성공(?:한거|한것|사례)?만|좋은(?:것|거)만|만보여|아니면/.test(c)&&!/왜|이유|굳이/.test(c)?'shift-publicity':'shift-making']);
    if(/돈안들|돈들이지|무료로|공짜|비용없이|예산(?:이)?(?:거의)?없|돈(?:이)?없|부담없이|무료자료|무료로볼|무료인거/.test(c)&&/볼수|볼만|자료|뭐가있|뭐있|시작|가이드|배울|읽을|참고/.test(c)&&(brand==='shift'||/ai|브랜딩|가이드|자료/.test(c)))return from(['shift-materials']);
    if(brand!=='lab'&&/(?:혼자|1인|프리랜서|소상공인|자영업|개인사업|작은가게|동네|혼자서)(?:서|로|인데|이고|라서)?.{0,10}(?:쇼핑몰|가게|카페|식당|매장|사업|장사|브랜드|온라인몰|스마트스토어|공방|스튜디오|유튜브|채널|블로그|일하|운영|하는데|해요|입니다|인데|이에요|예요|라서|인데요)/.test(c)&&(brand==='shift'||/ai|브랜딩|배우|배울|가이드|자료|상세페이지|로고|마케팅|만드는|제작/.test(c))&&!/기업|기관|직원|임직원|명단|연락처|한국어|토픽|topik|한글|공부|따라할|따라올|따라가|하나도모르|하나도몰|전혀없|전혀모르|전혀몰|지식(?:이|도)?없|기초부터|왕초보|초보|컴맹|사례|가이드보면|참고할|어느브랜드/.test(c))return from(['shift-audience']);
    if(/(?:작은|소규모|스타트업|중소|개인사업|\d+명짜리|몇명짜리)(?:회사|기업|팀|사업|업체)?(?:도|은|는)?(?:돼|되|가능|괜찮|받을수|신청|들을수|대상(?:이|에)?(?:되|포함|들어))/.test(c)&&(brand==='shift'||/회사|기업|팀|업체/.test(c)))return from(['shift-audience']);
    if(/장소|출강|방문|와주|찾아와|오프라인교육|어디서해|어디서진행/.test(c)&&/교육|강의|수업|컨설팅|진행/.test(c))return (brand==='shift'||organizationService)?from(['shift-education']):from(['lab-location']);
    if(/환급|국비|내일배움|고용노동부|hrd/.test(c))return (brand==='lab')?{...unknown(brand),relatedIds:['lab-availability','guide-contact']}:from(['shift-education']);
    if(/(?:뭘|무엇을|어떤걸|뭐)(?:꼭)?(?:물어봐|확인해|체크해|알아봐)|확인할것|체크리스트|(?:학원|곳|업체)(?:을|를)?(?:고를|선택할)때/.test(c))return from([brand==='lab'||/학원|아이|애|자녀/.test(c)?'lab-parent':'synk-value']);
    if(/자격증|수료증|ncs|공인|인증과정|학점인정/.test(c)&&/과정|교육|강의|수업|나오|발급|주나|받을수/.test(c))return (brand==='shift'||organizationService)?from(['shift-education']):{...unknown(brand),relatedIds:[brand==='lab'?'lab-availability':'guide-availability','guide-contact']};
    if(!languageStudy&&/topik|토픽|합격|급수/.test(c)&&brand==='lab')return from(['lab-topik']);
    if((brand==='pulse'||/음악|작품|노래/.test(c))&&(/공부|학습|효과|집중력|치유/.test(c)||(/한국어/.test(c)&&/늘|실력|향상|도움|좋아/.test(c))))return from(['pulse-not-study']);
    if(/보장|시간절감|성공|(?<!창의|수용|협동|유연|다양|적응|자율)성과/.test(c))return pathwayService?from(['path-support'],'needs_confirmation'):from([brand==='shift'?'shift-results':'guide-evidence']);
    if((brand==='shift'||!brand||/가이드|제작법/.test(c))&&/가이드|자료/.test(c)&&/몇편|몇개|몇가지|몇종|얼마나많|몇건|한편뿐|한편밖에|더없|또있|링크|주소|url|바로가기|어디서봐|어디서보/.test(c))return from(['shift-materials']);
    if((/(?:그림체|원본|스타일|화풍|캐릭터|디자인|톤|느낌)(?:을|를|은|는|이|가|도)?.{0,8}(?:안망가|망가지지|망가뜨리지|유지|지키|살리|보존|안바뀌|안변|해치지|훼손|그대로)/.test(c)||/(?:얼굴|모습|생김새|캐릭터|스타일|그림체)(?:이|가|은|는)?.{0,6}(?:매번|자꾸|계속|맨날)?(?:바뀌|달라지|변하|일관성)/.test(c))&&/ai|생성|만들|제작|쓰는|활용|사용|요청|썸네일|가이드/.test(c)&&!/저작권|써도|이용해도/.test(c))return from(['shift-materials']);
    if((brand==='shift'||!brand||/가이드|제작법/.test(c))&&/자료|가이드/.test(c)&&/가입|무료|댓글|다운|어디|로그인/.test(c))return from(['shift-materials']);
    if(/업무지도|고객질문지도|질문지도|제작가이드|자료실/.test(c))return from(['shift-materials']);
    // A study or application plan drawn up with the student is PATH's personal planning, not a class schedule.
    if((brand==='path'||pathwayService)&&/(?:일정|계획|스케줄|플랜|타임라인|로드맵)(?:은|을|이|도|표)?.{0,6}(?:어떻게)?(?:짜|세워|세우|잡아|만들어|정해|관리|같이)|(?:맞춰서|맞춤으로|하나하나)(?:계획|일정|준비)|계획(?:을)?(?:같이)?(?:짜|세)/.test(c)&&!/수강료|가격|비용|얼마|개강|모집|신청|접수/.test(c))return from(['path-personal']);
    // Whether services are booked separately or as a package is a services question.
    if((brand==='shift'||organizationService)&&/(?:따로|각각|별도로|개별로)(?:신청|계약|진행|해야|받아야|결제)|패키지|묶어서|한꺼번에|세트로|같이신청|함께신청|통합(?:으로)?(?:신청|진행)/.test(c)&&/강의|컨설팅|브랜딩|교육|서비스/.test(c)&&!/가격|비용|얼마|견적/.test(c))return from(['shift-services']);
    if(/주\d*(?:몇|\d)\s*(?:회|번|일)|일주일에(?:몇|\d)|몇번수업|수업횟수|매일수업|무슨요일|몇요일|수강료|강사료|강의료|출강비|교육비|단가|가격|요금|비용|환불|견적|계약조건|결제|돈(?:을)?(?:내|드|들|받)|유료|(?<!역)할인|분납|할부|위약금|모집|개강|언제|날짜|일정|신청|등록|이용조건|시간표|얼마(?!나)|얼마나(?:들|드|해요|하나요|내야)|몇월|기수|시작일|개강일|접수기간|다음달|이번달|다음주|이번주|셋째주|둘째주|첫째주|넷째주|월말|월초|하루잡|날잡|시간잡|가능한날|스케줄|진행가능한지|가능한지확인/.test(c)||((advertisingService||advertisingEducation||languageStudy)&&/무료/.test(c))){
      if(pathwayService&&!/수강료|가격|요금|비용|환불|견적|계약조건|결제|이용조건|얼마(?!나)/.test(c))return from(['path-support'],'needs_confirmation');
      return from([brand==='lab'?'lab-availability':'guide-availability'],'needs_confirmation');
    }
    const engineAliases={core:'코어',loom:'룸',vellum:'벨룸',trail:'트레일',prism:'프리즘',temper:'템퍼',reed:'리드',strata:'스트라타'};
    // Synapse Core is a textbook title, and ordinary words such as room or lead are not engine names.
    const namedEngines=Object.entries(engineAliases).filter(([en,ko])=>!(en==='core'&&/시냅스|교재|문법|회화|(?<![가-힣])톡|(?<![가-힣])책|\d\s*권/.test(q))&&(new RegExp('(?:^|[^a-z])'+en+'(?:$|[^a-z])').test(q)||new RegExp('(?:^|[^가-힣])'+ko+'(?!메|서비스|쉐어|더십|더)').test(q))).map(([en])=>'atlas-'+en).filter(id=>records.has(id));
    if(namedEngines.length)return from(namedEngines);
    if(/목표(?:가|이)?(?:바뀌|달라지|변하|바꼈)/.test(c)&&/시스템|학습|과제|계획|따라|공부/.test(c))return from([/시스템|아틀라스|엔진/.test(c)?'synk-atlas':brand==='path'?'path-personal':brand==='lab'?'lab-personal':'synk-atlas']);
    if(/아틀라스|atlas|여덟(?:개(?:의)?)?엔진|8개(?:의)?엔진|엔진(?:이|은)?(?:8|여덟)개/.test(c))return from(['synk-atlas']);
    if(/(?:개인화|맞춤형?)(?:학습|교육|수업)?(?:이|가|은|는)?(?:어떻게|원리|방식|작동|이뤄|이루어)/.test(c)&&!/개인화시스템|철학|가치/.test(c))return from([brand==='path'?'path-personal':brand==='lab'?'lab-personalization':'synk-atlas']);
    if(/지금(?:바로)?.{0,10}(?:받아볼수|받을수|이용|수강|시작할수|해볼수|할수있|가능)|바로(?:진행|시작|신청|받)|당장(?:진행|시작|해볼|할수)|개인과외|일대일수업/.test(c)&&!followupCue)return from([brand==='lab'||/과외|일대일/.test(c)?'lab-availability':brand==='path'?'path-support':'guide-availability'],'needs_confirmation');
    if(followupCue&&/지금(?:바로)?.{0,10}(?:받아볼수|받을수|시작할수|해볼수|할수있|가능)|바로(?:진행|시작|신청|받)|당장(?:진행|시작|해볼)/.test(c)&&!/체험|버전|미리/.test(c))return from([brand==='lab'?'lab-availability':brand==='path'?'path-support':'guide-availability'],'needs_confirmation');
    // Privacy, unpublished facts, evidence and commercial conditions above retain priority.
    if(/프로젝트|크루|나침반|시즌제|8주/.test(c)&&(brand==='lab'||/한국어|학생|수업/.test(c))&&/어떤식|어떻게|굴러가|진행|뭐예요|뭔가요|하는거|무슨|설명/.test(c)&&!/기업|회사|의뢰|컨설팅|언어|영어|한국어와/.test(c))return from(['lab-ai-practice']);
    // Making something together as a team in the curriculum is the crew project; co-creation after class is culture.
    if(brand==='lab'&&/(?:팀|크루|조별|모둠|친구들이랑|친구들과|친구랑|다같이|여럿이)(?:으로|을짜서|별로|서)?.{0,10}(?:뭔가)?(?:함께|같이)?(?:만드는|만들어보는|만들어가는|제작하는|기획하는|완성하는|해보는)(?:활동|프로젝트|수업|과제|시간|거|것|건)?/.test(c)&&!/캐릭터|음악|노래|콜라보|협업|의뢰|기업|직원/.test(c))return from(['lab-ai-practice','lab-culture']);
    if(brand==='lab'&&classFormat)return from(['lab-class']);
    if(brand==='lab'&&learnerCompetency)return from([/크루|나침반|문화활동|문화프로젝트|포트폴리오/.test(c)?'lab-ai-practice':'lab-ai']);
    const publicDirection=/비전|vision|철학|가치관|중요하게|중요히|믿음|지향|목표로하는|궁극적|최종목표|결국(?:뭘|무엇을|뭐)|원칙|신조|모토|신경쓰|중시|우선시|중요한(?:게|것|점|건)|중요시|포기(?:안|하지않|못)|양보(?:안|하지않|못)|그리는방향|나아가는방향|방향(?:이|성이)?궁금|지향하는방향|어디로가는|방향성|그런그림|큰그림|그림이에요|그림인가요|(?:어떤|무슨)그림(?:을)?(?:그리|인지)|그림을그리|(?:synk|lab|shift|pulse|path|싱크|랩|쉬프트|시프트|펄스|패스|회사|브랜드)(?:의|은|는|이)?목표(?:가|는|은|이)?(?:뭐|무엇|어떻게|궁금)/.test(c);
    if(!publicDirection){
      if(brand==='path'&&/(?:어느|어디|어떤)(?:범위|정도|선|단계)까지|범위(?:까지|가|는|를)|어디까지(?:도와|지원|해주|봐주|같이|함께)/.test(c)&&!/비자|보장|가격|비용/.test(c))return from(['path-support']);
      if(languageStudy&&brand==='lab')return from([/topik|토픽|급수|4급|유학|대학|적응|취업|결과물|포트폴리오/.test(c)?'lab-language-use':'lab-languages']);
      if(/vr|가상현실|직업체험/.test(c))return from([brand==='path'||prevIds.has('path-journey')?'path-journey':'lab-vr']);
      if(brand==='path'&&/연습|상황|시뮬레이션|미리해보|미리경험|가상|체험|리허설/.test(c))return from(['path-journey']);
      if(brand==='path'&&/뭘도와|뭐도와|무엇을도와|어떤도움|도와줄수있|도움받을수|뭘해줄수|무엇을해줄|뭘해주/.test(c))return from(['path-support']);
      if(brand==='path'&&/결과물|보여줄(?:게|것|만한)|첨부|증명할|경험을설명|뭘했는지|증빙|자료집|원서낼때|지원할때|포트폴리오/.test(c))return from(['path-why']);
      if(brand==='path'&&/스스로|적응하게|자립|스스로적응/.test(c)&&!/비자|면접|연습/.test(c))return from(['path-philosophy']);
      if(brand==='path'&&/차별|차이|왜|선택|유학원/.test(c)&&!/학교.*선택|학교선택|전공선택|학교.*(?:골라|고르)/.test(c))return from(['path-why']);
      if(brand==='path'&&/포트폴리오/.test(c))return from(['path-why']);
      if(brand==='path'&&/개인화|관리|기록|성향/.test(c))return from(['path-personal']);
      if(brand==='path'&&/유학.*(?:준비|가려|계획)|전공|학교.*(?:선택|골라|고르)|대학.*(?:가고|가려|준비|입시)|입시/.test(c))return from(['path-personal']);
      if(brand==='path'&&/준비|과정|단계/.test(c)&&!(/보장|조건/.test(c)))return from(['path-journey']);
      if(brand==='pulse'&&/ip|지식재산|캐릭터(?:들)?(?:을|를)?(?:가지고|로)(?:하는)?사업|캐릭터사업|사업도따로/.test(c))return from(['pulse-ip']);
      if(advertisingEducation)return from(['shift-education']);
      if(advertisingService)return from(['pulse-collaboration']);
      if(pathwayService)return from(['path-support']);
      if((organizationService||brand==='shift')&&/진행방식|진행하|진행과정|어떻게진행|절차|프로세스|방식(?:이|은)?어떻게|대상(?:이면|에따라|별로)|직급|부서별|직무별|달라지|진행순서|순서(?:는|가|를|요)|단계(?:는|가|별|로)|흐름|스텝/.test(c))return from(['shift-delivery']);
      if((organizationService||brand==='shift')&&/툴|도구|프로그램|소프트웨어|ai|클로드|제미나이|미드저니/.test(c)&&/써요|쓰나|쓰는|쓰세요|사용하|활용하는|쓰신|쓰셨|썼|사용하신|어떤프로그램|무슨프로그램|어떤툴|무슨툴|뭐로만|뭘로만|뭐쓰|뭘쓰/.test(c)&&!/모델이름|모델명/.test(c))return from(['shift-ai']);
      if((organizationService||(brand==='shift'&&/강의|교육|컨설팅|브랜딩/.test(c)))&&!/자료|실습|예시|배우|배워|배울|가져|적용|강의만|강의브랜드|써먹|결과물|산출물|남는|남나|끝나는게아니|듣고끝/.test(c))return from(['shift-services']);
    }
    if(/답.*없으면.*(만들|알려)|새답변|생성형|챗봇|답변기준|출처|근거|공개문서|무엇을물어|뭐물어|어떻게이용|ai상담|실시간검색/.test(c)&&!/아이|학생|자녀|애가|베끼|습관|의존|숙제|직원/.test(c))return from(['guide-ask']);
    if(/협업|협력|의뢰|함께일|연락|문의/.test(c))return from([brand==='pulse'?'pulse-collaboration':'guide-collaboration']);
    // Public visions are future direction. Privacy, terms and factual limits above still take priority.
    if(/비전|vision|지향하는미래|꿈꾸는미래|미래상|어떤미래|앞으로.*(?:되려|지향|꿈꾸)|만들고싶은미래|지향(?:해|하나|하는게|점)|목표로하는|궁극적|최종목표|결국(?:뭘|무엇을|뭐)|장기목표|장기적목표|앞으로의목표|미래목표|큰그림|그런그림|그림이에요|그림인가요|(?:어떤|무슨)그림(?:을)?(?:그리|인지)|그림을그리|장기계획|장기적(?:으로)?(?:뭘|무엇)|그리는방향|나아가는방향|방향(?:이|성이)?궁금|지향하는방향|어디로가는|방향성|(?:synk|lab|shift|pulse|path|싱크|랩|쉬프트|시프트|펄스|패스|회사|브랜드)(?:의|은|는|이)?목표(?:가|는|은|이)?(?:뭐|무엇|어떻게|궁금)/.test(c)&&!/수업|과정|학생|4급|토픽/.test(c)){
      if(brands.length>=3||/(?:네|다섯|4개|5개|모든|전체)(?:브랜드|회사)|네개(?:의)?(?:사업|브랜드)|4개(?:의)?(?:사업|브랜드)|사업(?:이|의)?각각|각각(?:그리는|의)|사업별|세(?:가지)?(?:브랜드|사업)|각(?:브랜드|회사)|각각의비전|전체비전|전부.*비전|비전.*전부|비전.*모두|모두.*비전/.test(c))return from(['synk-visions']);
      if(brands.length>1)return from(brands.map(key=>key+'-vision'));
      if(brands.length&&/synk\s*(?:와|과|및)\s*(?:lab|shift|pulse|path|랩)/.test(q))return from(['synk-vision',...brands.map(key=>key+'-vision')]);
      const visionBrand=brands[0]||(/synk/.test(c)?'synk':brand||'synk');
      return from([visionBrand+'-vision']);
    }
    if(/철학|가치관|중요하게|중요히|믿음|원칙|신조|모토|포기(?:안|하지않|못)|신경쓰|중시|우선시|중요한(?:게|것|점|건)|중요시|양보(?:안|하지않|못)/.test(c)&&!/철학말고|실제로보여|실제결과|실제일한과정/.test(c)){
      if(brands.length>1)return from(brands.map(key=>key+'-philosophy'));
      const philosophyBrand=brands[0]||(/synk/.test(c)?'synk':brand);
      if(brandIds[philosophyBrand])return from([philosophyBrand+'-philosophy']);
      // The company's own principles live in the philosophy records.
      if(/품질|완성|마무리|검수/.test(c))return from(['philosophy-quality']);
      if(/사람|기술|ai/.test(c))return from(['philosophy-people']);
      return from(['philosophy-purpose']);
    }
    if(brands.length>1){if(/어디(?:에|로)|어느쪽|어느곳|맡|담당|누구한테|누가/.test(c))return from(['synk-choose']);if(/차이|관계|다르|같|각각|구분|비교|브랜드|사업/.test(c))return from(['synk-brands']);return from(brands.map(b=>brandIds[b]));}
    if(/(?:세|네)(?:가지)?사업|(?:세|네)(?:가지)?브랜드|[34]개사업|사업구성|브랜드구성|사업구조/.test(c))return from(['synk-brands']);
    if(/차별|강점|차이점|더좋|왜선택|선택할때|다른곳/.test(c))return from(['synk-value']);
    if(!followupCue&&/왜.*(?:이일|이런일|시작|만들)|너네.*목적|존재이유|(?:창업|회사를만든|시작하게된|만들게된).{0,6}(?:계기|이유|동기|배경)|(?:계기|이유)(?:가|는)?.{0,4}(?:창업|만들)/.test(c))return from(['synk-founder']);
    if(/(?:철학말고|실제로보여|실제결과|실제일한과정)/.test(c))return from(['shift-making']);
    if(/교육.*ai.*음악.*(왜|회사)|왜.*한회사/.test(c))return from(['synk-brands']);
    if(/철학|가치|중요|믿음|지향|교육과창작|왜.*함께|개인화시스템/.test(c))return from(['philosophy-purpose']);
    if(/품질|완성|마무리|사용뒤|완성도|점검|검수|잘만들어졌|품질기준/.test(c))return from(['philosophy-quality']);
    if(/ai|번역기|통역앱|파파고|번역앱|자동번역/.test(c)&&/굳이|필요(?:가)?있|배워야|배울필요|공부해야|의미(?:가)?있|왜(?:배우|공부|배워|필요|해야|굳이)|쓸모|소용|필요없|안배워도/.test(c)&&/한국어|언어|배우|공부|외국어/.test(c))return from(['lab-ai']);
    if(/(?:몽골|현지)(?:사람|인)?(?:이)?(?:아니어도|아니라도|아닌데)|국적(?:이)?(?:상관|달라도)|외국인(?:도|이어도|인데)/.test(c)&&(!brand||brand==='lab'))return from(['lab-audience']);
    if(/유학(?:갈)?(?:생각|계획)?(?:은|이)?(?:딱히|별로|아직)?(?:없|안)|유학(?:은|을)?(?:안갈|안할|안가)|유학말고|유학생각없|유학은아직|유학(?:은)?결정(?:을)?(?:못|안)|유학(?:할지)?(?:말지)?고민|유학(?:갈지|할지)?(?:말지)?(?:결정|정하)(?:을)?(?:못|안|아직)|결정못했|아직결정|갈지말지/.test(c)&&(!brand||brand==='lab'))return from(['lab-explore']);
    if(/한국어|한국말|한글|korean/.test(c)&&/공부하고싶|wheredoistart|start|배우고싶|시작하고싶|배워보고싶|공부해보고싶|공부하려고|배우려고|처음인데|처음이에요|처음이라|뭐부터|무엇부터|어디서부터/.test(c)&&!/어떻게배우|방식|비용|수강료|영어|결정못|아직결정|갈지말지|유학(?:은|을)?(?:안갈|안할|안가)|유학말고|춤|댄스|k컬처|어디부터|브랜드/.test(c))return from(['lab-start']);
    // Broad brand fallbacks below yield to a strong match on the reviewed text of a specific answer.
    // Explicitly excluded private material is left out of the text used for ranking as well.
    const ranking=input.replace(/(?:(?:내부|비공개)\s*(?:운영|사업)?\s*(?:자료|문서|원문)|학생\s*실제\s*(?:성적표|답안))\s*(?:는|은|를|을)?\s*(?:빼도\s*되니|제외하고|빼고|필요\s*없고)/g,' ');
    if(/(?:근데|그런데|그래서|혹시|아무튼|암튼)(?:여긴|여기는|여기|너네|너희)(?:는|가)?(?:뭐하는|무슨|어떤|하는일|뭐해)/.test(c))return from([brandIds[brand]||brandIds[context.brand]||'synk-intro']);
    if(/(?:한국어|애들|아이들)(?:를|을)?.{0,4}(?:가르치는|가르쳐주는)(?:데|곳|회사|학원)(?:가|이)?(?:맞|인가|예요|에요)|(?:it|아이티|소프트웨어|기술)회사(?:같은데|인가요|예요|인지|아닌)|학원(?:이)?맞|교육(?:회사|기관)(?:가|이)?맞/.test(c))return from([brandIds[brand]||'lab-intro']);
    const strong=judge(ranking,{brand,brands,previous});
    // A back-reference to the previous answer continues it unless another answer clearly fits better.
    // A back-reference continues the previous answer unless another brand's topic is named or a clearly better answer exists.
    const shifted=previous.length>0&&((/한국어|한국말|한글|토픽|topik|학원|수업/.test(c)&&!previous.some(r=>r.brand==='lab'))||(/브랜딩|로고|컨설팅|기업교육|직원교육/.test(c)&&!previous.some(r=>r.brand==='shift'))||(/음악|라디오|노래|캐릭터|로파이/.test(c)&&!previous.some(r=>r.brand==='pulse'))||(/유학|비자|취업/.test(c)&&!previous.some(r=>r.brand==='path')));
    if(prevIds.has('synk-choose')&&/말고|다른것|다른거|또뭐|그외/.test(c))return from(['synk-brands']);
    if(followupCue&&!brands.length&&!shifted&&!/말고|다른거|다른건|다른것|딴거|다른사례|다른예시/.test(c)){
      const own=previous.map(r=>{const p=retriever.passage(r,ranking);return {r,cover:Math.max(p.value,p.meta),s:strong.ranked.find(x=>x.id===r.id)};}).sort((a,b)=>b.cover-a.cover)[0];
      const near=own?.s&&(!strong.confident||own.s.score>=strong.first.score-.12);
      if(own&&((near&&(own.cover>=.2||!strong.confident))||own.cover>=.45))return {...from([own.r.id]),ranked:own.s?.score||0};
    }
    if(strong.confident&&strong.first.score>=.5&&strong.margin>=.05)return {...from([strong.first.id]),ranked:strong.first.score};
    const prefer=id=>strong.confident&&strong.first.id!==id&&strong.first.score>=.45&&strong.margin>=.05?{...from([strong.first.id]),ranked:strong.first.score}:from([id]);
    if(brand==='lab'){
      if(/ai(?:툴|도구|활용)?.{0,16}(?:가르쳐|가르치|배울수|배우|알려주|수업|교육)|(?:챗봇|ai|지피티)(?:한테|에게|에)?.{0,8}(?:물어보고|베끼|의존|답만|그대로|복붙|시키|맡기)|(?:베끼|의존|복붙)(?:는|하는)?(?:습관|버릇)|ai(?:를|을)?(?:책임|올바르|제대로|잘)(?:쓰|사용|활용)/.test(c)&&!/선생님?(?:을|를)?대신|대신|혼자가르|아이를가르/.test(c))return from(['lab-ai']);
      if(/(?:기계|ai|로봇|컴퓨터|앱|화면)(?:가|이|만|으로|로)?.{0,6}(?:가르치|가르쳐|수업|하는건지|하는거|봐주|봐줘)|사람(?:이|은)?(?:하는건지|가르치|가르쳐|봐주|봐줘|직접)|화면만(?:보|들여다)/.test(c))return from(['lab-teacher']);
      if(/(?:글|작문|답|과제|숙제|쓴것|쓴거|쓴글)(?:은|는|을|를|이|도)?.{0,6}(?:누가|누구가)(?:고쳐|첨삭|봐주|교정|확인|검사|채점)/.test(c))return from(['lab-teacher']);
      if(/ai.*(아이|가르|수업|선생|교육)|(아이|교사|선생님).*(ai|기술)|선생님역할/.test(c))return from(['lab-teacher']);
      if(/성인|직장인|온라인|한국에살|한국거주/.test(c))return from(['lab-adult']);
      if(/유학.*(아직|결정|고민)|아직.*유학|대학생활|고등학생|(?:한국|유학)(?:에)?(?:갈지|가야할지|가도될지|갈까).{0,8}(?:고민|모르|결정|말지)|유학(?:갈)?(?:생각|계획)?(?:은|이)?(?:딱히|별로|아직)?(?:없|안)|유학(?:은|을)?(?:안갈|안할|안가)|유학말고|유학생각없|유학은아직/.test(c))return from(['lab-explore']);
      if(/초보|처음배|배워보고|하나도못|하나도몰|하나도모르|한글.*(?:모르|못읽|못써|몰라)|한글도|hangul|시작하면|아예몰|전혀몰|한국어.*몰라|배운적없/.test(c))return from(['lab-start']);
      if(/춤|촬영|k컬처|문화|취향|활동|덕후|팬이라|좋아하는걸로|놀다오|놀러가|공동제작|공연/.test(c))return prefer('lab-culture');
      if(/보호자|학부모|부모|아이를보내/.test(c))return from(['lab-parent']);
      if(/누구|대상|청소년|몇살|나이/.test(c))return from(['lab-audience']);
      if(/개인|맞춤|이해|학생마다|내수준|수준에따라|나한테|다음공부|한명한명|한사람한사람|각자|다르게봐|다르게보|따로봐|아이마다|학생별|개인별|저마다|성향/.test(c))return prefer('lab-personal');
      if(/배울내용|학습순서|무엇부터|뭘먼저/.test(c))return from(['atlas-strata']);
      if(/어떻게|배우|배워|배울|배운|말하기|문법|표현|연습|방식/.test(c))return prefer('lab-learning');
    }
    if(brand==='shift'){
      if(/다른사업|넓은사업|사업범위|사업방향|(?:말고|외에|이외에|그밖에).{0,10}(?:늘어날|추가|더할|새로운|다른|앞으로).{0,8}(?:서비스|사업)|(?:앞으로|추후|향후|나중에).{0,8}(?:늘어날|추가|생길|더할|준비중인|확장|늘릴).{0,6}(?:서비스|사업|영역)/.test(c))return from(['shift-scope']);
      if(/따라올수|따라갈수|따라올|따라갈|따라가면서|따라가|안써본|안써보|써본적|처음써|익숙하지|익숙치|낯설|어르신|[456]0대|나이많|컴맹|기초부터|왕초보|한번도|처음이라|문외한|잘몰라/.test(c))return from(['shift-start']);
      if(/회사만|기업만|법인만|개인(?:도|은|이|만)(?:가능|되나|돼요|신청|참여|괜찮|받을|이용|안되|안돼)|프리랜서|소상공인|자영업자?/.test(c))return from(['shift-audience']);
      if(/(?:파일|요청문|결과물|자료|원본|산출물|프롬프트)(?:이랑|과|와|도|은|는|을|를)?.{0,12}(?:계속|끝나고도|이후에도|나중에도|가져|갖고|가질수|소유|쓸수|써도|재사용|다시쓸|써먹)|(?:결과물|산출물|성과물)(?:이|가|은|는)?(?:실제로|직접|진짜)?(?:남|생기|나오|손에)|(?:써먹을|쓸수있는|활용할|적용할)(?:결과물|산출물|것이남|게남|거남)|듣고끝나는게아니|듣고끝나지않|듣고끝이아니/.test(c))return from(['shift-takeaway']);
      if(/(?:말고|외에|외의|또다른|다른)(?:다른)?.{0,4}(?:사례|예시|작업|케이스|가이드|자료)(?:도|는|가|은)?.{0,6}(?:있|없|볼수|더)/.test(c))return from(['shift-materials','shift-publicity']);
      if(/강의만|강의브랜드|강사보다|ai교육|교육.*신청/.test(c))return from(['shift-education']);
      if(/초보|ai.*모르|잘못해|처음.*ai|제일을만들|난이도|따라갈수|비개발|비전공|어렵/.test(c))return from(['shift-start']);
      if(/진행방식|진행하|진행과정|어떻게진행|절차|프로세스|방식(?:이|은)?어떻게|진행순서|순서(?:는|가|를|요)|단계(?:는|가|별|로)|흐름|스텝/.test(c))return from(['shift-delivery']);
      if(/원본|파일|결과물|산출물|납품/.test(c)&&/넘겨|전달|제공|주시|받을수|주나/.test(c))return from(['shift-takeaway']);
      if(/업무적용|적용까지|사후|교육후|끝나고|이후에도|팔로업|후속/.test(c))return from(['shift-education']);
      if(/툴|도구|프로그램|소프트웨어|ai|클로드|제미나이|미드저니/.test(c)&&/써요|쓰나|쓰는|쓰세요|사용|활용|쓰신|쓰셨|썼|어떤프로그램|무슨프로그램|어떤툴|무슨툴|뭐로만|뭘로만|뭐쓰|뭘쓰/.test(c)&&!/모델이름|모델명/.test(c))return from(['shift-ai']);
      if(/실패|망한|망친|안된결과|못나온|프롬프트|요청예시|잘된결과만|공개범위/.test(c))return from(['shift-publicity']);
      if(/자료실|다운로드|pdf|수정원본|소개문|업무지도|고객질문지도|먼저볼자료|자료.*어디|서비스.*정리|고객.*질문|공개.*업무지도/.test(c))return from(['shift-materials']);
      if(/짓|제작사례|제작과정|만든과정|만드는과정|제작이야기|회사제작|실제작업|고친사례|로고|실땀|선택|수정|시도/.test(c))return from(['shift-making']);
      if(/강의|교육|컨설팅|브랜딩/.test(c)&&!/자료|실습|예시|배우|배워|배울|가져|적용/.test(c))return prefer('shift-services');
      if(/배우|배워|배울|수업|실습|자료|예시|가져|적용/.test(c))return prefer('shift-takeaway');
      if(/누구|대상|1인|사업자|혼자.*사업|개인(?:도|은|이|만)|프리랜서|소상공인|자영업|회사만|기업만|법인만|개인은/.test(c))return from(['shift-audience']);
      if(/ai|자동화|도구/.test(c)&&!/(어떤일|무슨일|소개)/.test(c))return prefer('shift-ai');
    }
    if(brand==='pulse'&&/감상|독서|듣|들으|(?<!만)들어|들을|라디오|휴식|재생|음악만/.test(c))return from(['pulse-listening']);
    if(/(사람|선생님).*(ai|기술)|(ai|기술).*(사람|선생님)|기술.*기준/.test(c))return from(['philosophy-people']);
    if(/ai/.test(c)&&/바꿔|고쳐|수정|편집|고친|고칠|바꾼|손본|손댄|첨삭/.test(c)&&/문장|글|답|쓴|과제|작문|에세이/.test(c))return from([/멋대로|마음대로|허락|저장|구분|원본|따로|섞/.test(c)?'philosophy-purpose':'lab-game-demo']);
    if(/(?:직접|스스로).{0,12}(?:ai|기계).{0,12}(?:짐작|추측|추정|판단)|(?:짐작|추측|추정)(?:한|하는|한거)?.{0,10}(?:섞|구분)/.test(c))return from(['lab-personal']);
    if(/(?:계획|준비).{0,8}(?:실제|운영).{0,12}구분/.test(c))return from(['philosophy-purpose']);
    if(/ai|기술|시스템|아틀라스|앱|캐릭터|취향|데이터|좋아하는|게임/.test(c)&&/판단|평가|낙인|멋대로|함부로|단정|실수|분석|추측|짐작|규정|결정해버/.test(c)&&/성격|성향|취향|저를|나를|제가|우리애|아이|학생|수준|사람을/.test(c))return from(['lab-personal']);
    if(/지금.*(운영|단계|준비|출시)|현재.*(운영|단계|준비|출시)|이미출시|열었|모두운영/.test(c))return from(['synk-stage']);
    if(/어디부터|처음왔|추천|둘러|시작하면|맞는사업|뭘볼|어떤걸도와|무엇을도와|뭘할수|뭘도와|뭐도와|어떤도움|도와줄수있|도움받을수|도움을받을|뭐가있나요|뭐가있어요/.test(c))return from([brand==='path'?'path-support':brandIds[brand]||'synk-choose']);
    if(/^(여긴|여기는|여기|너네|너희)(뭐하는|무슨|어떤|하는일|뭐해)/.test(c))return from([brandIds[context.brand]||'synk-intro']);
    const introOnly=c.replace(/synk|lab|shift|pulse|path|소개|알려|궁금|어떤|무슨|무엇|뭐|하는|하고|하나|하니|만들어|만드는|회사|사업|곳|브랜드|작품|일|예요|인가요|해주세요|해줘|주세요|해요|세요|줘|요|야|은|는|을|를|이|가|에|대해|좀|알고싶어|나요|니|다|있|임/g,'');
    if(!brands.length&&/synk|회사|기업/.test(c)&&/어떤사업|무슨사업|하는사업|사업을해/.test(c))return from(['synk-intro']);
    if(/synk.*처음.*(어떤곳|뭐|소개)/.test(c))return from(['synk-intro']);
    if(brand&&introOnly.length===0)return from([brandIds[brand]]);
    if(/synk|회사|기업/.test(c)&&introOnly.length===0)return from(['synk-intro']);
    return retrieve(ranking,{brand,brands,previous});
  }
  // Rank every reviewed answer when no specific rule applies. A confident match answers;
  // a plausible one offers the closest questions; anything else keeps the unknown guidance.
  function judge(input,{brand,brands,previous}){
    const {q,ranked}=retriever.rank(input,{brands,brand,previous});
    const [first,second]=ranked;
    if(!first||first.score<.2)return {ranked,first:null,confident:false};
    // One or two words found equally in many answers ("한국어", "선생님") are a topic, not a question.
    const tied=ranked.filter(x=>x.meta>=.99&&x.para>=.99).length;
    const informative=q.weight>=2.2&&!(tied>=3&&(q.words.length===1||(q.words.length===2&&first.score-(second?.score||0)<.2)));
    // Most of what was asked must appear in the chosen answer; a partly covered question offers choices.
    const covered=Math.max(first.meta,first.para)>=.62;
    const clear=informative&&covered&&first.score>=.42&&(!second||first.score-second.score>=.05);
    return {ranked,first,confident:clear||(informative&&covered&&first.score>=.52),margin:first.score-(second?.score||0)};
  }
  function retrieve(input,{brand,brands,previous}){
    const {ranked,first,confident}=judge(input,{brand,brands,previous});
    if(!first)return unknown(brand);
    if(confident)return {...from([first.id]),ranked:first.score};
    if(first.score<.25||Math.max(first.meta,first.para)<.3)return unknown(brand);
    const close=ranked.filter(x=>x.score>=Math.max(.2,first.score*.7)&&x.id!=='guide-contact').slice(0,3).map(x=>x.id);
    // Offer the nearest reviewed questions; fewer than three leave room for a direct enquiry.
    const choices=close.length<3?[...close,'guide-contact']:close;
    return {...unknown(brand),status:'clarify',relatedIds:choices,message:close.length===1?'정확히 맞는 공개 답변은 찾지 못했어요. 가장 가까운 안내를 선택하면 이어서 보여 드릴게요.':'이 중 어떤 내용이 궁금하신가요? 질문을 선택하면 이어서 안내해 드릴게요.'};
  }
  // Two separate requests in one message are answered together; a restricted part keeps the whole boundary.
  function combined(input,context,result){
    if(typeof input!=='string'||input.length>500||['restricted','invalid','greeting','courtesy','language','unanswered'].includes(result.status))return result;
    const text=input.trim();
    let parts=text.split(/(?<=[?？!])\s+|(?<=[.。])\s+|(?<=궁금하고|궁금하구요|궁금하구|알고싶고|알고싶구요),?\s+|\n+|\s*(?:그리고|그리구|또한|아울러|그 ?다음에|그 ?외에)\s+|\s+(?:근데|그런데|그나저나|아참)\s+/).map(p=>p.trim()).filter(Boolean),joined=false;
    const before=parts.length;
    // Nouns joined by 랑/과/와 share one predicate ("위치랑 수강료 알려줘"); comparisons stay one question.
    // Self-descriptions ("저는 몽골 사람이에요", "…혼자 운영하는데요") give context rather than a separate question.
    const asks=p=>/[?？]|나요|까요|가요|주세요|알려|궁금|되나|돼요|될까|있어요$|있나|맞죠|맞나|건가요|인가요|해요$|어때요|되죠|는지$|인지$/.test(p);
    const statement=p=>/(?:입니다|습니다|거든요|인데요|이에요|예요|라서요|어서요|해서요|왔어요|됐어요|였어요|있었어요|하는데요|는데요|더라구요|더라고요|더라구|더라고|봤어요|봤는데요|했어요|었어요|았어요|네요|음|봄|함)$/.test(p.replace(/[ㅋㅎㅠㅜ~!.…\s^]+$/,''))&&!asks(p);
    parts=parts.filter(p=>!(/^(?:저는|전|나는|난|제가|저희는?|우리는?)\s/.test(p)&&!asks(p))&&!statement(p));
    const preamble=parts.length<before;
    // A single question left after its preamble is answered on its own.
    if(parts.length===1&&preamble){
      const broad=new Set(['synk-intro','lab-intro','shift-intro','pulse-intro','path-intro','synk-choose','guide-ask']);
      const weak=!result.records?.length||!['matched','needs_confirmation'].includes(result.status)||result.ranked!==undefined||broad.has(result.records[0].id);
      if(!weak)return result;
      const only=ruleAnswer(parts[0],{...context,brand:brandsIn(normalizeQuery(text))[0]||context.brand});
      return only.records.length&&['matched','needs_confirmation'].includes(only.status)?{...only,combined:true}:result;
    }
    if(parts.length<2&&!/차이|비교|다른\s*점|다르|관계|연결|연관|이어|같은\s*점|같이|함께|똑같|같은\s*거|비슷|둘\s*다|vs|사이|중에|중에서|나누|나눠|구분|역할/.test(text)&&!/(?:선생님?|친구|사람|강사|교사|부모|엄마|아빠|형제|동생|언니|오빠|누나|형|팀원|직원|아이|애|학생|캐릭터|몽글|까몽|마린)(?:이랑|랑|과|와)\s/.test(text)){parts=text.split(/(?<=[가-힣a-z0-9])(?:이랑|랑|과|와)\s+(?=[가-힣a-z0-9])/i).map(p=>p.trim()).filter(Boolean);joined=true;}
    if(parts.length<2||parts.length>3||parts.some(p=>compact(p).length<2))return result;
    const brand=brandsIn(normalizeQuery(text))[0]||context.brand;
    const found=parts.map(p=>ruleAnswer(p,{...context,brand}));
    if(found.some(r=>r.status==='restricted'))return result;
    const generic=new Set(['synk-intro','lab-intro','shift-intro','pulse-intro','path-intro','synk-choose','guide-ask']);
    // A bare noun only adds an answer when it names a specific reviewed topic.
    const answered=found.filter(r=>r.records.length&&['matched','needs_confirmation'].includes(r.status)&&!((joined||r.ranked)&&generic.has(r.records[0].id))&&!(r.ranked&&r.ranked<(joined?.5:.42)));
    if(!answered.length)return result;
    const base=result.records?.length&&['matched','needs_confirmation'].includes(result.status)?result:null;
    // When every remaining part is a question of its own, or a preamble was set aside, the parts lead in their order.
    const partsLead=preamble||(answered.length===parts.length&&parts.length>=2&&(!base||base.ranked!==undefined||generic.has(base.records[0].id)));
    const ids=partsLead?[...answered.map(r=>r.records[0].id),...(base?base.records.map(r=>r.id):[])]:[...(base?base.records.map(r=>r.id):[]),...answered.map(r=>r.records[0].id)];
    const unique=[...new Set(ids)].filter((id,i,all)=>!(id==='guide-availability'&&all.includes('lab-availability')));
    if(base&&unique.length===base.records.length)return result;
    const status=[base,...answered].some(r=>r?.status==='needs_confirmation')?'needs_confirmation':'matched';
    return {...from(unique,status),combined:true};
  }
  // A question about a specific unpublished detail (a name, a birthday, a device model) does not
  // receive a general introduction as if it answered it; the related topic stays one click away.
  const DETAIL=/(?:원장|선생님?|강사|교사|직원|저자|작가|집필진|작곡가|디자이너|감독|피디)(?:님)?(?:의|들의?)?(?:성함|이름|프로필|경력|약력|학력|나이)|(?:몽글|까몽|마린|캐릭터)(?:이|는|은|가|의)?.{0,6}(?:무슨동물|어떤동물|종족|생일|몇살|나이|키(?:는|가|얼마|몇)|몸무게|혈액형|mbti|성우|목소리|성별|고향)|성우|기종|모델명|헤드셋|(?:vr)?(?:기기|장비)(?:는|은|가|이)?.{0,8}(?:어떤|무슨|어느|뭐|모델|제품|회사)|메타퀘스트|퀘스트|오큘러스|피코|쉬는시간|휴식시간|점심시간|간식|급식|셔틀|통학버스|(?:노래|곡|음악)(?:의)?가사(?:는|가|도|를|좀|전문|전체|전부|다|모두|풀|해석|번역){0,2}(?:뭐|어떻게|알려|보여|볼수|있어|있나|궁금|찾|해줘|주세요|좀)|가사(?:도|를|는|좀|전문|전체|전부|다|모두|풀|해석|번역){0,2}(?:볼수|보여|알려|있어|있나|궁금|찾|해줘|주세요)|곡목|선곡|무슨노래|어떤노래|노래제목|몇곡|트랙리스트|트랙목록|곡목록|수록곡|\d+과(?:의)?(?:제목|이름)|목차|단원명|저자|집필|몇장(?:뽑|만들|생성)|시도횟수|몇번(?:시도|만에|뽑|생성|돌려)|엔진(?:이|은)?몇개(?:가)?(?:완성|작동|운영|돌아가)|완성(?:돼서|된)(?:작동|운영)중인엔진|몇개(?:가)?(?:완성|작동|돌아가)|(?:직업체험|직종|직업)(?:은|는|이|에|에는)?.{0,4}(?:(?:어떤|무슨|어느)(?:직종|직업|종류|분야)|목록|리스트|종류가)|(?:간호사|요리사|의사|엔지니어|미용사|바리스타|승무원)(?:도|는)?(?:있|체험|가능)/;
  // These details stay unanswered even when the matched record usually covers the topic.
  const HARD=/가사|몇곡|트랙리스트|트랙목록|곡목록|수록곡|성우|기종|모델명|헤드셋|퀘스트|오큘러스|몇장|시도횟수|몇번(?:시도|만에)|직종|직업체험|간호사|몇개(?:가)?(?:완성|작동|돌아가)/;
  const DETAIL_OK={'synk-planner':/대표|기획자|창업자|만드는사람/,'pulse-listening':/곡|노래|대표작|음악|라디오|제목/,'pulse-radio':/음악|노래|라디오/,'shift-education':/강사|선생|교사|프로필|경력|학력/};
  function detailAware(input,result){
    if(!['matched','needs_confirmation'].includes(result.status)||!result.records?.length)return result;
    const c=compact(normalizeQuery(input)),top=result.records[0];
    if(!DETAIL.test(c)||(!HARD.test(c)&&DETAIL_OK[top.id]?.test(c)))return result;
    return {...unknown(null),relatedIds:[/몽글|까몽|마린|캐릭터/.test(c)?'synk-characters':top.id,'guide-contact']};
  }
  function answer(input,context={}){
    if(typeof input==='string')input=correctTypos(input,vocabulary);
    const result=detailAware(input,combined(input,context,ruleAnswer(input,context)));
    if(result.records?.length&&['matched','needs_confirmation'].includes(result.status)){
      const focus={};
      for(const record of result.records){const i=retriever.focus(record,input);if(i>0)focus[record.id]=i;}
      if(Object.keys(focus).length)return {...result,focus};
    }
    return result;
  }
  return {answer,docs,records};
}
