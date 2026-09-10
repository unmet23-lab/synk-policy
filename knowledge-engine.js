// Reviewed public passages only; no internal files, private records or model calls.
export const normalize = value => String(value ?? '').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣\s]/g,' ').replace(/\s+/g,' ').trim();
const compact = value => normalize(value).replace(/\s/g,'');
const normalizeQuery = value => normalize(value).replace(/시프트/g,'shift').replace(/펄스/g,'pulse').replace(/싱크/g,'synk').replace(/인공지능/g,'ai').replace(/케이\s*팝|케이팝|k\s*팝|k\s*pop|케이\s*컬처/g,'k컬처');
const brandIds={lab:'lab-intro',shift:'shift-intro',pulse:'pulse-intro'};
const generic=new Set(['synk','싱크','lab','랩','shift','시프트','pulse','펄스','어떤','무슨','누구','어디','현재','사람','준비','과정','사용','질문','답변','소개','방법','결과','만든','경험','ai']);
function brandsIn(q){const out=['lab','shift','pulse'].filter(b=>new RegExp('(?:^|[^a-z])'+b+'(?:$|[^a-z])').test(q));if(/(?:^|\s)랩(?:은|이|에|의|도|에서는|$)/.test(q)&&!out.includes('lab'))out.push('lab');return out;}
function similarity(a,b){const grams=t=>{const c=compact(t);return new Set(Array.from({length:Math.max(0,c.length-1)},(_,i)=>c.slice(i,i+2)));};const A=grams(a),B=grams(b);if(!A.size||!B.size)return 0;let n=0;for(const x of A)if(B.has(x))n++;return 2*n/(A.size+B.size);}

export function createKnowledgeEngine(data){
  if(!data||!Array.isArray(data.docs)||!Array.isArray(data.records))throw new Error('공개 안내 자료를 읽지 못했습니다.');
  const docs=new Map(data.docs.map(d=>[d.id,d])),records=new Map(data.records.map(r=>[r.id,r]));
  if(docs.size!==data.docs.length||records.size!==data.records.length)throw new Error('공개 안내 항목이 중복되었습니다.');
  for(const r of records.values()){
    if(!docs.has(r.sourceId)||typeof r.answer!=='string'||!r.answer.trim()||!Array.isArray(r.questionExamples)||!r.questionExamples.length||!Array.isArray(r.keywords))throw new Error('답변 문서 연결을 확인해 주세요.');
    if(r.relatedIds?.some(id=>!records.has(id))||r.answer.split('\n\n').some(p=>!docs.get(r.sourceId).paragraphs.includes(p)))throw new Error('답변의 공개 근거를 확인해 주세요.');
  }
  const from=(ids,status='matched')=>{
    const selected=[...new Set(ids)].map(id=>records.get(id)).filter(Boolean).slice(0,3);
    return {status,records:selected,sourceIds:[...new Set(selected.map(r=>r.sourceId))],brand:selected.length===1?selected[0].brand:'synk',relatedIds:[...new Set(selected.flatMap(r=>r.relatedIds||[]))].filter(id=>!ids.includes(id)).slice(0,3)};
  };
  const unknown=(brand=null)=>({status:'unanswered',records:[],sourceIds:['guide'],brand:null,relatedIds:brand?[brandIds[brand],'guide-contact']:['synk-choose','guide-contact'],message:'공개 안내에서 이 질문에 답할 근거를 찾지 못했습니다. 확인되지 않은 내용은 추측하지 않습니다.\n\n한국어 교육, AI로 일하는 과정, 음악·작품, 협업 중 어떤 내용이 궁금한지 알려주세요. 개별 조건을 확인하려면 공개 문의 경로를 이용할 수 있습니다.'});
  function answer(input,context={}){
    if(typeof input!=='string'||!input.trim()||input.length>500)return {status:'invalid',records:[],sourceIds:[],brand:null,relatedIds:[],message:'질문을 500자 이내로 적어주세요.'};
    const q=normalizeQuery(input),brands=brandsIn(q);
    let c=compact(q);
    // Only explicit exclusions of private material are removed from the intent.
    c=c.replace(/(?:(?:내부|비공개)(?:운영|사업)?(?:자료|문서|원문)|학생실제(?:성적표|답안))(?:는|은|를|을)?(?:빼도되니|제외하고|빼고|필요없고)/g,'');
    const followup=/^(그럼|그러면|거기|그곳|그건|그거|더|또|그리고|그자료|그작품)/.test(c);
    let brand=brands[0];
    if(!brand){
      // Child/learner context precedes founder/business context.
      if(/아이|학부모|보호자|부모|학생|한국어|몽골|학원|유학|k컬처|말하기|토픽|topik/.test(c))brand='lab';
      else if(/음악|라디오|노래|곡명|작품|감상|가게|매장|캐릭터/.test(c))brand='pulse';
      else if(followup&&brandIds[context?.brand])brand=context.brand;
      else if(/1인|혼자.*(사업|브랜드)|브랜딩|ai|사업을준비|브랜드를만들/.test(c))brand='shift';
      else if(/수업|교육|배운내용/.test(c)&&!/기관|기업|팀/.test(c))brand='lab';
      else if(/자료|로고|스티치|고객.*질문|서비스.*정리|실제일한과정/.test(c))brand='shift';
    }
    if(/<\/?[a-z!]|onerror\s*=|javascript:/i.test(input))return unknown();
    if(/(지시|규칙|설정).*(무시|우회|해제)|이전지시|systemprompt|ignore.*(instruction|rule)|개발자모드|관리자모드/.test(c))return from(['guide-boundary'],'restricted');
    if(/비밀번호|password|apikey|api키|접속토큰|인증토큰|주민등록|주민번호|계좌번호|secretkey/.test(c))return from(['guide-boundary'],'restricted');
    if(/(학생|보호자|고객|회원|아이).*(명단|성적|답안|상담|연락처|전화번호|원문|원본|기록).*(보여|알려|열람|출력|뽑|다운|제공|볼수)|(?:학생|고객|아이|회원)(?:별)?(?:개인)?정보(?:를|을)?(?:함께|모두|전부)?(?:보여|알려|열람|제공|출력)|학생명단|성적표|상담기록|회원정보|개인정보.*(목록|명단|추출|다운로드)/.test(c))return from(['guide-personal'],'restricted');
    if(/사업시스템.*원문|(내부|비공개|비밀|미공개).*(시스템|구조|설계|운영|자료|문서|계약|전략|가격|프롬프트|도구|원가|코드|계획|매뉴얼)|운영매뉴얼|데이터베이스|소스코드|서버설정|시스템지시|저장소|엔진설계|전체지식.*(출력|덤프)/.test(c))return from(/synk.*하는일|synk.*어떤회사/.test(c)?['guide-boundary','synk-intro']:['guide-boundary'],'restricted');
    if(/(?:제|본인)(?:개인)?정보.*(삭제|수정|확인)/.test(c))return from(['guide-personal']);
    if(/개인정보|프라이버시|대화.*(저장|기록|남|전송)|질문.*(저장|기록|남|전송)|저장.*(대화|질문)|쿠키|보관기간|학생정보.*(다루|보호|처리)|(?:질문|대화|입력).*(외부ai|학습에|보내)/.test(c))return from(['guide-privacy']);
    if(/날씨|일기예보|주가|주식|코인|환율|대통령|선거|파스타|삼성|애플|주차장|카페메뉴|치료법|약물/.test(c))return unknown(brand);
    if(/^(안녕(?:하세요)?|하이|hello|hi|반가워(?:요)?)[!?.\s]*$/i.test(input.trim()))return from(['synk-choose'],'greeting');
    if(/^(고마워(?:요)?|감사(?:합니다|해요)?|thanks|thank you)[!?.\s]*$/i.test(input.trim()))return {status:'courtesy',records:[],sourceIds:[],brand:null,relatedIds:['synk-choose'],message:'함께 살펴봐 주셔서 감사합니다. 더 궁금한 내용이 있으면 이어서 물어보세요.'};
    // Specific public facts, rights and contact intents precede general topics.
    if(/사업자등록번호|사업자번호|등록번호/.test(c))return from(/연락|문의/.test(c)?['synk-registration','guide-contact']:['synk-registration']);
    if(/상업|저작권|재배포|이용권|라이선스|복사해|광고에|영상에|유튜브에|매장|가게/.test(c)&&(/음악|곡|노래|작품|pulse|로고|캐릭터|몽글|까몽|마린/.test(c)||brand==='pulse'))return from(['pulse-rights']);
    if((brand==='pulse'||/로고|캐릭터|몽글|까몽|마린/.test(c))&&/써도|사용해도|사용범위|사용허락|이용조건|무료로쓰|허가/.test(c))return from(['pulse-rights']);
    if(/접수|전달되|담당자.*답|나중에답|회신|여기에.*(보내|적었)|연락할곳|연락처|이메일|메일주소|문의주소|연락주소|전화번호|어디.*문의|문의.*어디/.test(c))return from(['guide-contact']);
    if(/자료.*(?:실제고객|실제사례|성공사례)|가상.*예시/.test(c))return from(['shift-materials']);
    if(brand==='shift'&&/수익|매출/.test(c)&&/따라|쓰면|나죠|낼수|얻|보장/.test(c))return from(['shift-results']);
    if(/협력대학.*목록|강사.*명단/.test(c))return from(['guide-unpublished'],'needs_confirmation');
    if(/경쟁사|다른회사보다|몇배|성공률|몇퍼센트|비교수치/.test(c))return from(['guide-evidence']);
    if(/매출|수익|원가|직원|인력|설립|창립|연혁|소재지|본사주소|고객사|인증|수상|투자|협약|제휴처|파트너사/.test(c)){
      if(brand==='shift'&&/성과|보장|성공|늘|증가|같은/.test(c))return from(['shift-results']);
      return from(['guide-unpublished'],'needs_confirmation');
    }
    const exact=data.records.find(r=>r.questionExamples.some(ex=>compact(normalizeQuery(ex))===c));
    if(exact)return from([exact.id]);
    if(/대표.*(이름|성함|누구)|기획자.*(누구|역할)|만드는사람/.test(c))return from(['synk-planner']);
    if(/기획자|창업자/.test(c)&&/추구|원하|방향|만들고싶|철학/.test(c))return from(['synk-founder']);
    if(/비자|법률|법적|입학보장|취업보장/.test(c))return brand==='lab'||/학교|합격|보장/.test(c)?from(['lab-topik']):unknown(brand);
    if(/copyright|저작권표시|저작권표기|카피라이트/.test(c))return from(['synk-registration']);
    if(/캐릭터|마스코트|몽글|까몽|마린/.test(c)&&/이름|소개|누구|뭐|알려|궁금|어떤/.test(c))return from(['synk-characters']);
    if(/이름경험|한글이름|이름을한국어/.test(c))return from(['lab-start']);
    if(brand==='pulse'&&/곡명|대표작|제목|전곡|실시간|스트리밍|생방송/.test(c))return from(['pulse-listening']);
    if(/교재제목|교재이름|강사이름|학교이름|모델이름|모델명|언어모델|책추천/.test(c))return unknown(brand);
    if(/topik|토픽|합격|급수/.test(c)&&brand==='lab')return from(['lab-topik']);
    if((brand==='pulse'||/음악|작품/.test(c))&&/공부|학습|효과|집중력|치유/.test(c))return from(['pulse-not-study']);
    if(/보장|성과|시간절감|성공/.test(c))return from([brand==='shift'?'shift-results':'guide-evidence']);
    if(/자료/.test(c)&&/가입|무료|댓글|다운|어디/.test(c))return from(['shift-materials']);
    if(/수강료|가격|요금|비용|환불|견적|계약조건|결제|모집|개강|언제|날짜|일정|신청|등록|이용조건|얼마/.test(c))return from([brand==='lab'?'lab-availability':'guide-availability'],'needs_confirmation');
    if(/답.*없으면.*(만들|알려)|새답변|생성형|챗봇|답변기준|출처|근거|공개문서|무엇을물어|뭐물어|어떻게이용|ai상담|실시간검색/.test(c))return from(['guide-ask']);
    if(/협업|협력|의뢰|함께일|연락|문의/.test(c))return from([brand==='pulse'?'pulse-collaboration':'guide-collaboration']);
    if(brands.length>1){if(/차이|관계|다르|같|각각|구분|비교|브랜드|사업/.test(c))return from(['synk-brands']);return from(brands.map(b=>brandIds[b]));}
    if(/세(?:가지)?사업|세(?:가지)?브랜드|3개사업|사업구성|브랜드구성|사업구조/.test(c))return from(['synk-brands']);
    if(/차별|강점|차이점|더좋|왜선택|선택할때|다른곳/.test(c))return from(['synk-value']);
    if(/(?:철학말고|실제로보여|실제결과|실제일한과정)/.test(c))return from(['shift-making']);
    if(/교육.*ai.*음악.*(왜|회사)|왜.*한회사/.test(c))return from(['synk-brands']);
    if(/철학|가치|중요|믿음|지향|교육과창작|왜.*함께/.test(c))return from(['philosophy-purpose']);
    if(/품질|완성|마무리|사용뒤|완성도/.test(c))return from(['philosophy-quality']);
    if(brand==='lab'){
      if(/ai.*(아이|가르|수업|선생|교육)|(아이|교사|선생님).*(ai|기술)|선생님역할/.test(c))return from(['lab-teacher']);
      if(/성인|직장인|온라인|한국에살|한국거주/.test(c))return from(['lab-adult']);
      if(/유학.*(아직|결정|고민)|아직.*유학|대학생활|고등학생/.test(c))return from(['lab-explore']);
      if(/초보|처음배|배워보고|하나도못|한글.*모르|시작하면/.test(c))return from(['lab-start']);
      if(/춤|촬영|k컬처|문화|취향|활동/.test(c))return from(['lab-culture']);
      if(/보호자|학부모|부모|아이를보내/.test(c))return from(['lab-parent']);
      if(/누구|대상|청소년|몇살|나이/.test(c))return from(['lab-audience']);
      if(/개인|맞춤|이해|선생님|학생마다/.test(c))return from(['lab-personal']);
      if(/어떻게|배우|배워|배울|배운|말하기|문법|표현|연습|방식/.test(c))return from(['lab-learning']);
    }
    if(brand==='shift'){
      if(/다른사업|넓은사업|사업범위|사업방향/.test(c))return from(['shift-scope']);
      if(/강의만|강의브랜드|강사보다|ai교육|교육.*신청/.test(c))return from(['shift-education']);
      if(/초보|ai.*모르|잘못해|처음.*ai|제일을만들/.test(c))return from(['shift-start']);
      if(/실패|프롬프트|요청예시|잘된결과만|공개범위/.test(c))return from(['shift-publicity']);
      if(/자료실|다운로드|pdf|수정원본|소개문|업무지도|고객질문지도|먼저볼자료|자료.*어디|서비스.*정리|고객.*질문|공개.*업무지도/.test(c))return from(['shift-materials']);
      if(/짓|제작과정|만든과정|만드는과정|제작이야기|회사제작|실제작업|고친사례|로고|실땀|선택|수정|시도/.test(c))return from(['shift-making']);
      if(/배우|배워|배울|수업|실습|자료|예시|가져|적용/.test(c))return from(['shift-takeaway']);
      if(/누구|대상|1인|사업자|혼자.*사업/.test(c))return from(['shift-audience']);
      if(/ai|자동화|도구/.test(c)&&!/(어떤일|무슨일|소개)/.test(c))return from(['shift-ai']);
    }
    if(brand==='pulse'&&/감상|독서|듣|라디오|휴식|재생|음악만/.test(c))return from(['pulse-listening']);
    if(/(사람|선생님).*(ai|기술)|(ai|기술).*(사람|선생님)|기술.*기준/.test(c))return from(['philosophy-people']);
    if(/지금.*(운영|단계|준비|출시)|현재.*(운영|단계|준비|출시)|이미출시|열었|모두운영/.test(c))return from(['synk-stage']);
    if(/어디부터|처음왔|추천|둘러|시작하면|맞는사업|뭘볼/.test(c))return from(['synk-choose']);
    const introOnly=c.replace(/synk|lab|shift|pulse|소개|알려|궁금|어떤|무슨|무엇|뭐|하는|하고|하나|하니|만들어|만드는|회사|사업|곳|브랜드|작품|일|예요|인가요|해주세요|해줘|주세요|해요|세요|줘|요|야|은|는|을|를|이|가|에|대해|좀|알고싶어|나요|니|다|있/g,'');
    if(!brands.length&&/synk|회사|기업/.test(c)&&/어떤사업|무슨사업|하는사업|사업을해/.test(c))return from(['synk-intro']);
    if(/synk.*처음.*(어떤곳|뭐|소개)/.test(c))return from(['synk-intro']);
    if(brand&&introOnly.length===0)return from([brandIds[brand]]);
    if(/synk|회사|기업/.test(c)&&introOnly.length===0)return from(['synk-intro']);
    const candidates=data.records.filter(r=>!brand||r.brand===brand||r.id.startsWith('philosophy-')).map(r=>{
      const hits=r.keywords.filter(k=>!generic.has(compact(k))&&compact(k).length>1&&c.includes(compact(k)));
      const sim=Math.max(...r.questionExamples.map(ex=>similarity(q,normalizeQuery(ex))),0);
      return {id:r.id,hits,sim,score:hits.length*2+sim*3};
    }).sort((a,b)=>b.score-a.score);
    const best=candidates[0];
    if(best&&((best.hits.length>=2&&best.sim>=.4)||(best.hits.length>=1&&best.sim>=.66)))return from([best.id]);
    return unknown(brand);
  }
  return {answer,docs,records};
}
