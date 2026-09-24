// English retrieval uses reviewed public passages only. Nothing is generated or sent to a service.
export const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣\s]/g,' ').replace(/\s+/g,' ').trim();
const stop=new Set('a an the and or of for to in on at is are was be do does can could would should will i we you your me us it this that how what which when where who why about please tell explain more synk lab shift pulse path'.split(' '));
const tokens=value=>new Set(normalize(value).split(' ').filter(w=>w.length>1&&!stop.has(w)).map(w=>w.length>4?w.replace(/(?:ing|es|s)$/,''):w));

// Chat shorthand and one-letter slips in the words that carry a visitor's intent.
const SHORTHAND=[[/\bu\b/g,'you'],[/\bur\b/g,'your'],[/\br\b/g,'are'],[/\b(?:pls|plz)\b/g,'please'],[/\bwanna\b/g,'want to'],[/\bgonna\b/g,'going to'],[/\bim\b/g,'i am'],[/\bcant\b/g,'cannot'],[/\bdont\b/g,'do not'],[/\bdoesnt\b/g,'does not'],[/\b(?:thx|ty)\b/g,'thanks'],[/\bvids?\b/g,'videos'],[/\binfo\b/g,'information'],[/\breg no\b/g,'registration number'],[/\bbiz\b/g,'business'],[/\bk pop\b|\bkpop\b/g,'kpop'],[/\blo fi\b/g,'lofi']];
const KEY_WORDS='tuition price prices cost fee fees much teacher teachers course courses class classes lesson lessons korean english learn learning study studying visa university universities company companies training trainings branding music character characters privacy contact email guarantee difference different would anything anyone where when what which whether shift pulse path atlas engine engines schedule available beginner beginners textbook textbooks register registration enroll enrollment apply application interview portfolio consultation collaboration advertising license copyright radio lofi founder philosophy vision mission values school academy location address online offline level levels grammar vocabulary pronunciation homework attendance record records parents children employees workshop consulting certificate refund discount scholarship business mascot mascots student students separate planned year years synapse charge master masters listen watch videos songs native feedback writing proposal budget timeline adapt headset platform drama chuseok mongle kkamong marin'.split(' ');
function damerau(a,b,max){
 if(Math.abs(a.length-b.length)>max)return max+1;
 const d=Array.from({length:a.length+1},(_,i)=>[i,...Array(b.length).fill(0)]);for(let j=1;j<=b.length;j++)d[0][j]=j;
 for(let i=1;i<=a.length;i++){let best=Infinity;for(let j=1;j<=b.length;j++){const cost=a[i-1]===b[j-1]?0:1;d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+cost);if(i>1&&j>1&&a[i-1]===b[j-2]&&a[i-2]===b[j-1])d[i][j]=Math.min(d[i][j],d[i-2][j-2]+1);best=Math.min(best,d[i][j]);}if(best>max)return max+1;}
 return d[a.length][b.length];
}
// Words that appear in the reviewed answers, and everyday words, are never "corrected".
const COMMON=new Set('were want what went well will with wish when then than that this these there their they them here have from your some same more most many much must make made like just know need does done good great also only into over each very while where which would could should about after again also always another because been before being both came come doing down even ever every first gets give goes going gone into keep kind last long look many maybe mean mine next once open other part people place same seem show since still such sure take tell than those though till time told took turn used using want ways week well went what whole whom whose wide will with word work year yours feed feel feels fine free fair fast fact face lead lean read real seal sell self send sent sort soon sale seems sounds looks'.split(' '));
const VOCABULARY=new Set();
export function tidy(text){
 let s=normalize(text);for(const [re,to] of SHORTHAND)s=s.replace(re,to);
 return s.split(' ').map(w=>{
  if(w.length<4||KEY_WORDS.includes(w)||COMMON.has(w)||VOCABULARY.has(w)||/\d/.test(w))return w;
  const hit=KEY_WORDS.find(k=>k.length>=4&&damerau(w,k,w.length>=8?2:1)<=(w.length>=8?2:1)&&w[0]===k[0]);
  return hit||w;
 }).join(' ');
}

// Ranking tolerates word forms, everyday synonyms and small typing slips, and only chooses among
// the reviewed titles, example questions, keywords and answer passages.
const CONCEPTS=[
 ['studyabroad',/\b(?:study(?:ing)? abroad|study(?:ing)? in korea|universit(?:y|ies)|colleges?|admissions?|degrees?)\b/g],
 ['cost',/\b(?:prices?|pricing|priced|fees?|tuition|costs?|costing|expensive|cheap|afford\w*|how much|rates?)\b/g],
 ['teacher',/\b(?:teachers?|tutors?|instructors?|lecturers?|trainers?|coach(?:es)?)\b/g],
 ['class',/\b(?:class(?:es)?|lessons?|courses?|sessions?)\b/g],
 ['korean',/\b(?:korean|hangul|hangeul)\b/g],
 ['child',/\b(?:kids?|child(?:ren)?|teens?|teenagers?|sons?|daughters?|minors?)\b/g],
 ['parent',/\b(?:parents?|mom|mum|dad|mother|father|guardians?)\b/g],
 ['location',/\b(?:locations?|address|located|campus|branch(?:es)?)\b/g],
 ['contact',/\b(?:contact\w*|e ?mail|phone|get in touch)\b/g],
 ['career',/\b(?:jobs?|careers?|employment|employ(?:ed|er|ers)?)\b/g],
 ['visa',/\bvisas?\b/g],
 ['music',/\b(?:music|songs?|tracks?|playlists?|bgm)\b/g],
 ['character',/\b(?:characters?|mascots?)\b/g],
 ['app',/\b(?:apps?|application)\b/g],
 ['beginner',/\b(?:beginners?|from scratch|from zero|never (?:studied|learned)|complete novice|no korean|new to (?:korean|learning|the language)|just starting|starting out)\b/g],
 ['student',/\b(?:students?|learners?|pupils?)\b/g],
 ['kpop',/\b(?:kpop|dance|dancing|choreograph\w*)\b/g],
 ['online',/\b(?:online|remote(?:ly)?|zoom)\b/g],
 ['vr',/\b(?:vr|virtual reality|metaverse)\b/g],
 ['branding',/\b(?:branding|brand identity|logos?)\b/g],
 ['advert',/\b(?:advert\w*|ads?|marketing|promotion\w*|campaigns?|sponsor\w*|commercials?)\b/g],
 ['privacy',/\b(?:privacy|personal data|data protection)\b/g],
 ['textbook',/\b(?:textbooks?|books?|workbooks?)\b/g],
 ['feedback',/\b(?:feedback|correct(?:ion|ions|s|ed)?|proofread\w*|fix(?:es|ed)? my)\b/g],
 ['ai',/\b(?:ai|artificial intelligence|chat ?gpt|gpt|llm|claude|gemini)\b/g],
 ['organization',/\b(?:compan(?:y|ies)|organi[sz]ations?|institutions?|corporate|business(?:es)?|firms?|employees?|staff|teams?|workplace)\b/g],
 ['learn',/\b(?:learn\w*|study(?:ing)?|studies)\b/g],
 ['personal',/\b(?:personali[sz]\w*|customi[sz]\w*|tailor\w*|adapt\w*)\b/g],
 ['free',/\b(?:free|no charge)\b/g],
];
const RANK_STOP=new Set([...stop,'there','here','any','some','my','our','its','their','them','they','he','she','his','her','as','by','with','from','if','so','just','really','also','get','got','have','has','had','want','like','know','am','im','id','ll','ve','don','doesn','didn','not','no','yes','ok','okay','hi','hello','hey','thanks','thank','need','kind','sort','thing','things','something','anything','bit','lot','very','much','many','whether','then','than','into','out','up','down','over','these','those','did','been','being','were','wa','ha','each','every','actually','exactly','even','still','only','yet','already','going','cool','hmm','fine','well','right','sure']);
const stem=w=>w.length>4?w.replace(/(?:ing|edly|ed|ies|es|s|ly)$/,m=>m==='ies'?'y':''):w;
function prepare(text){
 let s=' '+tidy(text)+' ';
 for(const [to,re] of CONCEPTS)s=s.replace(re,' '+to+' ');
 return s.split(' ').filter(Boolean).map(stem).filter(w=>w.length>1&&!RANK_STOP.has(w));
}
function gramsOf(words){
 const out=new Set();
 for(const w of words){out.add('#'+w);if(w.length>=5)for(let i=0;i+3<=w.length;i++)out.add(w.slice(i,i+3));}
 return out;
}
export function createRetriever(list){
 const df=new Map();
 const index=list.map(r=>{
  const ask=[r.title,...r.questionExamples,...(r.aliases||[]).filter(a=>!/[가-힣]/.test(a))].map(t=>gramsOf(prepare(t)));
  const meta=new Set([...ask.flatMap(s=>[...s]),...gramsOf(prepare(r.keywords.join(' ')))]);
  const paras=r.answer.split('\n\n').map(p=>gramsOf(prepare(p)));
  const all=new Set([...meta,...paras.flatMap(s=>[...s])]);
  for(const g of all)df.set(g,(df.get(g)||0)+1);
  return {r,ask,meta,paras};
 });
 const N=list.length,idf=g=>{const d=df.get(g);return d?Math.log((N+1)/(d+.5))*(g[0]==='#'?1.6:1):0;};
 const average=[...df.keys()].reduce((s,g)=>s+idf(g),0)/Math.max(1,df.size);
 const norm=set=>Math.sqrt([...set].reduce((s,g)=>s+idf(g)**2,0))||1;
 for(const x of index)x.askNorms=x.ask.map(norm);
 function query(input){
  const words=prepare(input),grams=gramsOf(words),known=[...grams].filter(g=>df.has(g));
  const unknown=[...grams].filter(g=>!df.has(g)&&g[0]==='#').length,weight=known.reduce((s,g)=>s+idf(g),0);
  const denominator=weight+unknown*average*.35,q2=Math.sqrt(known.reduce((s,g)=>s+idf(g)**2,0))||1;
  return {words,known,weight,denominator,q2,penalty:Math.sqrt(weight/(denominator||1))};
 }
 const cover=(q,set)=>{let s=0;for(const g of q.known)if(set.has(g))s+=idf(g);return q.denominator?s/q.denominator:0;};
 function score(q,x){
  let ask=0;x.ask.forEach((set,i)=>{let s=0;for(const g of q.known)if(set.has(g))s+=idf(g)**2;ask=Math.max(ask,s/(q.q2*x.askNorms[i])*q.penalty);});
  let para=0;x.paras.forEach(set=>{para=Math.max(para,cover(q,set));});
  const meta=cover(q,x.meta);
  return {id:x.r.id,brand:x.r.brand,ask,meta,para,score:.45*ask+.3*meta+.25*para};
 }
 function rank(input,{brand=null,named=[]}={}){
  const q=query(input);if(!q.known.length)return {q,ranked:[]};
  const ranked=index.map(x=>{
   const s=score(q,x);
   if(named.length)s.score+=named.includes(s.brand)?.04:s.brand==='synk'?0:-.12;else if(brand&&s.brand===brand)s.score+=.03;
   return s;
  }).sort((a,b)=>b.score-a.score);
  return {q,ranked};
 }
 function passage(record,input){
  const x=index.find(item=>item.r.id===record.id);if(!x)return {best:0,value:0,first:0};
  const q=query(input);if(!q.known.length)return {best:0,value:0,first:0};
  const values=x.paras.map(set=>cover(q,set));let best=0;values.forEach((v,i)=>{if(v>values[best])best=i;});
  return {best,value:values[best],first:values[0],meta:cover(q,x.meta)};
 }
 function focus(record,input){
  const {best,value,first}=passage(record,input);
  return best>0&&value>=.42&&value-first>=.12?best:0;
 }
 return {rank,focus,passage};
}

export function createKnowledgeEngine(data){
 if(!data||!Array.isArray(data.docs)||!Array.isArray(data.records))throw Error('Public information could not be loaded.');
 const docs=new Map(data.docs.map(d=>[d.id,d])),records=new Map(data.records.map(r=>[r.id,r]));
 if(records.size!==data.records.length||docs.size!==data.docs.length)throw Error('Duplicate public information.');
 for(const r of records.values())if(!docs.has(r.sourceId)||!r.answer?.trim()||!r.questionExamples?.length||!Array.isArray(r.keywords)||r.relatedIds?.some(id=>!records.has(id))||r.answer.split('\n\n').some(p=>!docs.get(r.sourceId).paragraphs.includes(p)))throw Error('Public source verification failed: '+r.id);
 const from=(ids,status='matched')=>{const selected=[...new Set(ids)].map(id=>records.get(id)).filter(Boolean).slice(0,3);return {status,records:selected,sourceIds:[...new Set(selected.map(r=>r.sourceId))],brand:selected.length===1?selected[0].brand:'synk',relatedIds:[...new Set(selected.flatMap(r=>r.relatedIds||[]))].filter(id=>!ids.includes(id)).slice(0,3)};};
 const unknown=brand=>({status:'unanswered',records:[],sourceIds:['guide'],brand:null,relatedIds:[brand&&records.has(brand+'-intro')?brand+'-intro':'synk-choose','guide-contact'],message:records.get('guide-unknown').answer});
 const courtesy=()=>({status:'courtesy',records:[],sourceIds:[],brand:null,relatedIds:['synk-choose'],message:records.get('guide-courtesy').answer});
 const exact=new Map();for(const r of records.values())for(const q of [r.title,...r.questionExamples,...(r.aliases||[])]){const key=normalize(q);if(!exact.has(key))exact.set(key,[]);exact.get(key).push(r.id);}
 for(const r of records.values())for(const text of [r.title,...r.questionExamples,...r.keywords,r.answer])for(const w of normalize(text).split(' '))if(w.length>=4)VOCABULARY.add(w);
 const retriever=createRetriever(data.records.filter(r=>!['guide-unknown','guide-courtesy'].includes(r.id)));
 function retrieve(input,brand,named,context){
  const {q,ranked}=retriever.rank(input,{brand,named});
  const [first,second]=ranked;
  // A follow-up about something inside the previous answer continues that answer.
  const previous=(context.recordIds||[]).map(id=>records.get(id)).filter(Boolean);
  if(previous.length&&!named.length&&q.words.length<=6){
   for(const record of previous){const p=retriever.passage(record,input);const own=ranked.find(x=>x.id===record.id);if(!own)continue;const near=!first||own.score>=first.score-.12;if((p.value>=.5&&near)||(own===first&&Math.max(p.value,p.meta)>=.3))return from([record.id]);}
  }
  if(!first||first.score<.25||Math.max(first.meta,first.para)<.3)return {...unknown(brand),retrieved:true};
  // A single word found equally in many answers is a topic; offer the closest questions instead.
  const tied=ranked.filter(x=>x.meta>=.99&&x.para>=.99).length;
  const informative=q.weight>=2.2&&!(tied>=3&&(q.words.length===1||(q.words.length===2&&first.score-(second?.score||0)<.2)));
  const covered=Math.max(first.meta,first.para)>=.55;
  if(informative&&covered&&((first.score>=.4&&(!second||first.score-second.score>=.04))||first.score>=.5))return {...from([first.id]),retrieved:true};
  const close=ranked.filter(x=>x.score>=Math.max(.2,first.score*.7)&&x.id!=='guide-contact').slice(0,3).map(x=>x.id);
  return {...unknown(brand),status:'clarify',retrieved:true,relatedIds:close.length<3?[...close,'guide-contact']:close,message:'Which of these topics would you like to explore? Select a question below.'};
 }
 function ruleAnswer(input,context={}){
  if(typeof input!=='string'||!input.trim()||input.length>500)return {...unknown(),status:'invalid',message:'Please keep your question within 500 characters.'};
  const raw=normalize(input);let q=tidy(input);
  // A greeting in front of a real question is dropped so the question itself is read.
  const GREET=/^(?:hello|hi|hey|good (?:morning|afternoon|evening)|greetings|annyeong\w*|anyong\w*|annyong\w*|hola|bonjour|salaam|salam|namaste|merhaba|sain baina uu)\b(?: there| everyone| team| all| synk| guys)?/;
  if(GREET.test(q)){const rest=q.replace(GREET,'').trim();if(rest.split(' ').filter(Boolean).length>=3&&/\?|\b(?:how|what|when|where|who|why|which|can|could|do|does|did|is|are|will|would|should|may|any|tell me|wonder\w*|curious|possible|looking for|want to|need|interested|please)\b/.test(rest+(/\?/.test(input)?'?':'')))q=rest;}
  const named=['lab','shift','pulse','path'].filter(b=>new RegExp('\\b'+b+'\\b').test(q)),brand=named[0]||context.brand;
  const asks=/\?|\b(?:how|what|when|where|who|why|which|can|could|do|does|is|are|will|would|should|may)\b/.test(input.toLowerCase());
  if(/<\/?[a-z!]|onerror\s*=|javascript:/i.test(input))return unknown(brand);
  // Internal material and other people's records keep their boundary in every wording.
  if(/password|api key|access token|secret key|system prompt|ignore.*(?:instruction|rule)|(?:private|internal|confidential|proprietary).*(?:document|source code|contract|database|manual|prompts?|library|playbook|templates?|process|code)|(?:source code|algorithm code|model weights|training data|system prompts?) (?:of|for|behind)|(?:show|share|send|give|see).{0,30}(?:source code|algorithm code|internal design|database|system prompts?)|(?:design|architecture|technical) (?:specs?|specifications|docs?|documents?|documentation)|operations? manual|internal (?:handbook|playbook|guidelines?)|prompts? (?:your team|you) use internally|use internally/.test(q)&&!(/\bexamples?\b|public guide/.test(q)&&!/\b(?:internal|private|confidential|proprietary|full)\b/.test(q)))return from(['guide-boundary'],'restricted');
  const others=/\b(?:students?|customers?|clients?|parents?|trainees?|learners?|members?|graduates?|alumni|classmates?|other (?:kids|children|people|families|parents|companies|students|clients|learners|employees)|(?:companies|clients|customers|people|students|organi[sz]ations|teams) (?:you )?(?:ve |have )?(?:already )?(?:trained|taught|worked with|served)|(?:our|my) (?:employees|staff|team members|students|trainees)|my (?:friend|classmate|child|son|daughter|kid)|(?:his|her|their) (?:grades?|records?)|friends?)\b/;
  const demandData=/\b(?:show|send|give|share|email|forward|look up|lookup|check|pull up|download|list|reveal|see|view|access|introduce|pass on|tell me|compare)\b.{0,60}\b(?:grades?|scor\w*|records?|attendance|homework|assignments?|marks|results?|progress|notes|files?|contacts?|contact (?:details|info\w*)|phone(?: numbers?)?|numbers|address(?:es)?|emails?|names?|list|portfolios?|work samples|essays?|writing|answers|submissions|recordings|consultation (?:notes|records|history))\b/;
  if((others.test(q)&&demandData.test(q))||/(?:student|customer|client|parent|trainee) (?:list|names|contacts|phone numbers)/.test(q)||/\b(?:which|who) of (?:our|my|the|your) (?:employees|staff|students|kids|children|team|trainees|members)\b.{0,60}\b(?:finished|completed|attended|passed|failed|scor\w*|grades?)\b/.test(q)||/\bhow (?:the )?other (?:kids|children|students|learners|parents)\b.{0,30}\b(?:scor\w*|did|performed|grades?)\b/.test(q))return from(['guide-personal'],'restricted');
  if(/\b(?:connect|put) me (?:directly )?(?:in touch |with |to )?(?:with |to )?(?:one of your |a |your |some )?(?:current |former |past |existing )?(?:students?|learners?|clients?|customers?|parents?|graduates?|alumni)\b|\b(?:talk|speak|chat) (?:to|with) (?:one of your |a |your |some )?(?:current |former |existing )?(?:students?|clients?|customers?|graduates?|parents?)\b|\bintroduce me to (?:a |one of your |your )?(?:students?|clients?|customers?)\b/.test(q))return from(['guide-personal'],'restricted');
  if(/\b(?:send|share|give|email|pass) (?:me |us )?(?:the |your )?(?:original|source|master|raw|design|psd|vector|ai|working) files?\b|\b(?:original|source|master|design) files?\b.{0,40}\b(?:send|share|give|download|print|sell|merch\w*)\b/.test(q))return from(['guide-boundary'],'restricted');
  // Exact reviewed questions take precedence over broad topic words.
  if(exact.has(raw)){const ids=exact.get(raw);const local=ids.filter(id=>records.get(id).brand===brand);return from(local.length?local:ids);}
  if(exact.has(q)){const ids=exact.get(q);const local=ids.filter(id=>records.get(id).brand===brand);return from(local.length?local:ids);}
  // Everyday conversation.
  if(/^(?:thanks|thank you|many thanks|cheers|appreciate it|much appreciated|great thanks|ok thanks|okay thanks|got it|ok|okay|great|perfect|cool|nice|bye|goodbye|see you|have a (?:nice|good|great) (?:day|one|week(?:end)?))(?: (?:so much|a lot|very much|again|for (?:the|your) (?:help|answer|information)|that helps|that helped|this helps))*$/.test(q)||(/\b(?:thanks|thank you|cheers|appreciate|bye|goodbye|see you|have a (?:nice|good|great) (?:day|one))\b/.test(q)&&!/\?/.test(input)&&!/\b(?:how|what|when|where|who|why|which|can i|could you|do you|is there|are there)\b/.test(q)))return courtesy();
  if(/^(?:more|tell me more|more details|explain more|go on)$/.test(q)&&context.recordIds?.length)return {...from(context.recordIds),expanded:true};
  if(/\b(?:reply by email|does (?:your|the) team (?:get|see|read)|will (?:someone|you|your team) (?:reply|respond|get back)|get back to me|is this (?:sent|forwarded) to)\b/.test(q))return from(['guide-contact']);
  if(/\b(?:powered by|running on|built on|run by)\b.{0,20}\b(?:chatgpt|chat gpt|gpt|ai|model|claude|gemini)\b|\bwhich (?:ai )?model\b.{0,20}\b(?:chat|assistant|this)\b/.test(q))return from(['guide-ask']);
  if(/^(?:hello|hi|hey|good (?:morning|afternoon|evening)|greetings|annyeong\w*|anyong\w*|annyong\w*|hola|bonjour|salaam|salam|namaste|merhaba|sain baina uu)\b/.test(q)&&!/\?/.test(input)&&!/\b(?:how|what|when|where|who|why|which|can|could|do you|is there|are there|tell me|want to|looking for|interested in)\b/.test(q))return from(['synk-choose'],'greeting');
  if(/^(?:are you|is this|am i (?:talking|chatting) (?:to|with))(?: an?| a real)? (?:bot|robot|ai|human|person|real person|chatgpt|chat gpt|gpt|machine|automated|live agent)\b|\bam i (?:talking|chatting|speaking) (?:to|with)\b.{0,20}\b(?:bot|robot|ai|human|person)\b|\b(?:real person or (?:a )?bot|bot or (?:a )?(?:real )?person|human or (?:a )?bot|bot or (?:a )?human|is this (?:a )?bot)\b|^who are you|^what are you\b|^(?:is this|are these answers) (?:ai|automated|generated)/.test(q))return from(['guide-ask']);
  if(/\b(?:talk|speak|chat) (?:to|with) (?:a )?(?:human|person|real person|someone|agent|representative|staff)|human (?:agent|support)|live (?:agent|chat)|call me back\b/.test(q))return from(['guide-contact']);
  if(/\b(?:weather|stock|share price|nvidia|bitcoin|crypto|football|soccer|recipe|restaurant|hotel|flight|rent|apartment|housing|horoscope|lottery|celebrity|bts|blackpink|concert|election|president|homework help|translate this|write (?:me|my) (?:a|an)? ?(?:cover letter|essay|resume|cv|code|email|letter)|cover letter|in your opinion|best (?:kpop )?(?:group|band|idol|singer)|translate|recommend (?:me )?(?:a |some )?(?:good )?(?:korean )?(?:drama|dramas|movie|movies|show|shows|kdrama|k drama|youtuber|netflix|webtoon)|drama recommendation)\b/.test(q))return unknown(brand);
  if(/\b(?:japanese|chinese|mandarin|spanish|french|german|russian|vietnamese|arabic|thai)\b/.test(q)&&/\b(?:teach|learn|class|course|lesson|study)\w*/.test(q)&&!/\b(?:ask|questions?|answer|chat|speak to)\b/.test(q))return {...unknown(brand),relatedIds:['lab-languages','guide-contact']};
  if(/\b(?:ask|questions?|answers?|chat|reply|write|talk|materials?|information|version|explanations?|support|website|site|guides?|read|available)\b.{0,20}\bin (?:mongolian|russian|chinese|japanese|vietnamese|spanish|french|korean|uzbek|kazakh|another language|my language|my own language|other languages)\b|\bin (?:mongolian|russian|chinese|japanese|vietnamese|spanish|french|uzbek|kazakh) instead\b/.test(q)&&!/\b(?:teach|learn|class|course|lesson)\w*\b.{0,20}\b(?:japanese|chinese|spanish|french|russian)\b/.test(q))return from(['guide-language'],'language');
  if(/\btopik\b/.test(q)&&/\b(?:exam|test) (?:date|dates|schedule)|(?:register|registration|sign up) for (?:the )?topik|when is (?:the )?(?:next )?topik/.test(q))return {...unknown(brand),relatedIds:['lab-topik','guide-contact']};
  // A bare topic word typed on a brand page opens that brand's answer for it.
  const ANY_WORD=[[/^(?:hangul|hangeul|korean alphabet)$/,'lab-start'],[/^topik$/,'lab-topik'],[/^(?:lofi|radio|k lofi)$/,'pulse-radio'],[/^vr$/,'lab-vr'],[/^(?:textbooks?)$/,'lab-curriculum'],[/^(?:visas?)$/,'path-support'],[/^(?:kpop|k pop|dance)$/,'lab-culture'],[/^(?:founder|ceo)$/,'synk-planner']];
  if(!brand&&q.split(' ').length<=2){const hit=ANY_WORD.find(([re])=>re.test(q));if(hit&&records.has(hit[1]))return from([hit[1]]);}
  const ONE_WORD={lab:[[/^(?:textbooks?|books?|synapse)$/,'lab-curriculum'],[/^(?:korean (?:lessons?|classes?|course)|lessons?)$/,'lab-intro'],[/^(?:apps?|games?)$/,'lab-personalization'],[/^(?:vr|vr (?:interviews?|practice|class(?:es)?|lessons?|sessions?|training))$/,'lab-vr'],[/^(?:class schedule|schedule|timetable|weekly schedule)$/,'lab-class'],[/^(?:topik|level ?4)$/,'lab-topik'],[/^(?:curriculum|course|program|one year|1 year)$/,'lab-year'],[/^(?:english|conversation|speaking)$/,'lab-languages'],[/^(?:location|address|where)$/,'lab-location'],[/^(?:class|classes|lessons?|90 minutes)$/,'lab-class'],[/^(?:teachers?|tutors?|ai)$/,'lab-teacher'],[/^(?:parents?)$/,'lab-parent'],[/^(?:adults?|working adults?)$/,'lab-adult'],[/^(?:kpop|k pop|dance|culture)$/,'lab-culture'],[/^(?:beginners?|start)$/,'lab-start'],[/^(?:personali[sz]ation|personali[sz]ed)$/,'lab-personal']],
   shift:[[/^(?:guides?|materials?|resources?)$/,'shift-materials'],[/^(?:services?)$/,'shift-services'],[/^(?:process|steps|procedure)$/,'shift-delivery'],[/^(?:deliverables?|files?|outputs?)$/,'shift-takeaway'],[/^(?:examples?|portfolio|cases?|case studies)$/,'shift-making'],[/^(?:tools?)$/,'shift-ai'],[/^(?:branding|logos?)$/,'shift-scope'],[/^(?:prompts?|failures?)$/,'shift-publicity'],[/^(?:trainers?|instructors?|training|workshops?)$/,'shift-education'],[/^(?:beginners?)$/,'shift-start'],[/^(?:freelancers?|individuals?|solo)$/,'shift-audience']],
   pulse:[[/^(?:radio|lofi|k lofi|klofi|stream)$/,'pulse-radio'],[/^(?:characters?|mascots?|mongle|kkamong|marin)$/,'synk-characters'],[/^(?:ads?|advertising|sponsorship)$/,'pulse-advertising'],[/^(?:collab\w*|partnership)$/,'pulse-collaboration'],[/^(?:licen\w*|rights|copyright|usage)$/,'pulse-rights'],[/^(?:music|songs?|videos?|tracks?)$/,'pulse-listening'],[/^(?:ip|intellectual property)$/,'pulse-ip'],[/^(?:content|works?)$/,'pulse-content']],
   path:[[/^(?:visas?|legal|visa (?:help|support|questions?|stuff|process|prep))$/,'path-support'],[/^(?:portfolio|portfolios)$/,'path-why'],[/^(?:interviews?|vr|practice|vr (?:interviews?|practice))$/,'path-journey'],[/^(?:plan|planning|timeline|majors?|schools?)$/,'path-personal'],[/^(?:jobs?|employment|admissions?)$/,'path-support']]};
  if(brand&&ONE_WORD[brand]&&q.length<=22&&q.split(' ').length<=2){const hit=ONE_WORD[brand].find(([re])=>re.test(q));if(hit&&records.has(hit[1]))return from([hit[1]]);}
  if(/\bwhat (?:exactly |actually )?(?:is|does) (?:lab|shift|pulse|path) (?:actually |exactly )?(?:do|offer|for)\b|\bin (?:plain|simple|basic) (?:terms|words|english)\b|\bwhat (?:exactly )?is (?:lab|shift|pulse|path)\b/.test(q)&&!/\b(?:different|differ|compared|versus|vs)\b/.test(q))return from([(named[0]&&records.has(named[0]+'-intro'))?named[0]+'-intro':brand&&records.has(brand+'-intro')?brand+'-intro':'synk-intro']);
  if(/\bwhat (?:kind of |sort of )?(?:topics|things|questions) (?:are |can i |is )?(?:actually )?(?:fair game|ask|okay|allowed|covered)\b|\bfair game\b|\bwhat can i ask\b|\bwhat (?:do|can) you (?:help (?:me )?with|answer)\b/.test(q))return from(['guide-ask']);
  if(previousIs(context,'guide-unpublished')&&/\b(?:timeline|when|share|public|date|eta)\b/.test(q))return from(['guide-unpublished'],'needs_confirmation');
  if(/\b(?:self paced|self study version|on demand|recorded (?:version|sessions?|course)|asynchronous|pre recorded)\b/.test(q))return {...unknown(brand),relatedIds:[brand==='lab'?'lab-adult':'shift-education','guide-contact']};
  // Registration, press coverage, unpublished specifics and visitor situations before general topics.
  if(/\b(?:registered (?:as a )?(?:company|business)|company registration|business registration|legal entity|incorporated|copyright line|footer)\b/.test(q)&&!/\b(?:not|no|without) (?:a |an |yet )?(?:registered|company)\b/.test(q))return from(['synk-registration']);
  if(/\b(?:lms|learning management|which platform|what platform|deliver(?:ed)? (?:the training )?on (?:zoom|teams|which|what))\b/.test(q))return {...unknown(brand),relatedIds:['shift-delivery','guide-contact']};
  if(/\b(?:programming language|written in|coded in|built (?:with|in|on)|tech stack|framework|python|javascript|typescript|react|unity|unreal)\b/.test(q)&&/\b(?:atlas|engine|engines|app|site|website|system)\b/.test(q))return {...unknown(brand),relatedIds:['synk-atlas','guide-contact']};
  if(/\b(?:embassy|consulate|visa) (?:interview|might call|may call|call me|calls me)|(?:nervous|scared|anxious)\b.{0,40}\b(?:interview|practice)|practice for (?:that|the interview|it|this)|interview practice\b/.test(q)&&!/\bjob\b|\bheadset\b|\bquest ?\d\b|\boculus\b/.test(q))return from(brand==='path'?['path-journey']:brand==='lab'?['lab-vr']:['lab-vr','path-journey']);
  if(/\b(?:professor (?:email|e mail|letter|mail)|email exercise|letter exercise|writing game|email game|letter game|letter writing (?:demo|game|sample|exercise|thing)|(?:letter|email|mail|writing) demo|demo on (?:the|this|your) (?:site|website|page)|correction (?:reply )?screen)\b/.test(q))return from([/\b(?:fix\w*|correct\w*|grammar|mistakes?|feedback|spot|answer|explain|stuck|hints?|wrong|reply|record\w*|track\w*|progress|real|sample|for show|actual)\b/.test(q)?'lab-game-demo':'lab-start']);
  if(/\b(?:agents?|agency|agencies|brokers?)\b.{0,60}\b(?:same thing|same as|different|like that|just fill|paperwork|forms)\b|\bis what you offer the same\b|\bsame as (?:an? )?(?:agent|agency)\b/.test(q)&&!/\bad agency\b/.test(q))return from(['path-why']);
  if(/\b(?:skip|opt out|not into|hate|dislike)\b.{0,30}\b(?:dancing|dance|kpop|k pop|choreo\w*)\b|\b(?:kpop|dance) (?:part|session|class|warm ?up)\b|\bwarm ?up\b/.test(q))return from(['lab-culture']);
  if(/\b(?:make|create|need|have) an account|sign ?up|log ?in|register(?:ed)? to|email (?:address )?to (?:read|see|download|access)|paywall|behind a (?:login|paywall)|free to read\b/.test(q)&&(brand==='shift'||previousIs(context,'shift-materials')||/\b(?:guide|read it|article|materials?|download)\b/.test(q))&&!/\b(?:class|course|lesson|app|korean|chat ?gpt|gpt|copilot|everyone|nobody|staff|employees|team|firm|company)\b/.test(q))return from(['shift-materials']);
  if(/\b(?:public sector|government (?:teams|agencies|offices|bodies)|ngos?|nonprofits?|non profits?|municipal)\b/.test(q)&&/\b(?:train|training|workshop|consult|teams?)\b/.test(q))return from(['shift-audience']);
  if(/\b(?:story behind|the making of|how (?:did|was) (?:the|your) (?:\w+ )?(?:logo|characters?|mascots?|website|site|brand) (?:made|designed|created|born|come about)|behind (?:the|your) (?:\w+ )?(?:logo|brand|characters?|mascots?|redesign|rebrand\w*))\b/.test(q)&&!/\b(?:philosophy|belief|vision|why (?:did|do) you (?:start|build))\b/.test(q))return from([/\b(?:characters?|mascots?|mongle|kkamong|marin)\b/.test(q)&&brand!=='shift'?'synk-characters':'shift-making']);
  if(/\b(?:redo|redesign|refresh|rework|update) (?:our|the|my) (?:logo|branding|brand)|new logo|logo redesign|rebrand\w*\b/.test(q))return from(['shift-services']);
  if(/\b(?:characters?|mascots?|eyes?)\b.{0,40}\b(?:move|moving|moves|animated?|animation|blink\w*|react)\b/.test(q)&&/\b(?:how|why|what|code|video|tech\w*|made|make)\b/.test(q)&&!/\b(?:use|allowed|licen\w*|sell|my (?:own )?character)\b/.test(q))return from(['atlas-loom']);
  if(/\b(?:90 minute|ninety minute|half an hour|30 minutes?|group (?:talk|speaking|discussion|time)|talking in groups|speaking time)\b/.test(q)&&!/\b(?:price|cost|fee)\b/.test(q))return from(['lab-class']);
  if(/\bhow long (?:does|do|would|will) (?:it|the (?:training|consulting|project|program|course|process)|a project|consulting)\b.{0,20}\btake\b|\bhow long is (?:the )?(?:training|program|course|consulting)\b|\bduration of\b|\btimeline for (?:the|a) (?:project|training)\b/.test(q))return brand==='lab'?from(['lab-year']):from(['guide-availability','shift-delivery'],'needs_confirmation');
  if(/\b(?:hand me the answer|give (?:me )?the answer|explain why|explains? (?:the|my) (?:mistake|error)|get stuck|stuck in|hints?)\b/.test(q)&&/\b(?:game|exercise|app|writing|sentence|lesson)\b/.test(q))return from([/\b(?:explain|hint|why)\b/.test(q)?'atlas-vellum':'lab-game-demo']);
  if(/\b(?:academic korean|follow (?:the )?lectures|university lectures|lectures in korean|classroom korean|not just (?:the )?test)\b/.test(q))return from(['lab-language-use']);
  if(/\bpaste (?:my )?(?:cv|resume)\b|\b(?:cv|resume) in here\b/.test(q))return from(['guide-careers'],'needs_confirmation');
  if(/\b(?:which|what) (?:vr )?headset\b|\bquest ?\d\b|\boculus\b|\bmeta quest\b|\bpico\b/.test(q))return {...unknown(brand),relatedIds:[brand==='path'?'path-journey':'lab-vr','guide-contact']};
  if(/\b(?:patent\w*|defensible|moat|own (?:any )?ip|intellectual property|proprietary tech)\b/.test(q)&&/\b(?:engine|adaptive|technology|tech|personali\w*|atlas|algorithm)\b/.test(q))return from([brand==='lab'||/personali/.test(q)?'lab-personalization':'synk-atlas']);
  if(/\b(?:coral|stitch|stitches|green eyes|brown fur|navy|helmet|yellow eyes|round one|fluffy one|cute one|the (?:pink|orange|blue|green) one)\b/.test(q)&&/\b(?:name|who|called|friends?|others?|other two)\b/.test(q))return from(['synk-characters']);
  if(/\b(?:keep|kept|preserve|protect|maintain|wreck|ruin|destroy|lose|losing|consistent|same look|looking like|stay(?:s|ed)? the same)\b/.test(q)&&/\b(?:characters?|style|look|art|drawings?|designs?|mongle)\b/.test(q)&&/\bai\b|generat\w*|prompt/.test(q))return from(['shift-materials']);
  if(/\b(?:done|made|created|produced|handled) by (?:the )?ai\b|\bai (?:vs|versus|or) (?:people|humans|a person)\b|\b(?:people|humans) (?:vs|versus|or) ai\b|\bhow much (?:of the (?:work|creative work) )?(?:is|does|do) (?:the )?ai (?:do|actually do|handle)\b/.test(q))return from(['philosophy-people']);
  if(/\b(?:chatbot|bot|ai|robot|machine|app|software)\b.{0,40}\b(?:teach\w*|tutor\w*|instead of (?:a |an )?(?:real |actual |human )?(?:person|teacher|human)|replac\w*)\b|\breal (?:teacher|person|human)\b.{0,30}\b(?:teach|there|involved|class|instead|checks?|checking|grades?|grading|reviews?|marks?|looks?|reads?|corrects?|oversee\w*|supervis\w*)|\bhuman teachers?\b|\bactual (?:person|teacher)\b|\bai (?:does not|doesn t|just|alone|only|simply)\b.{0,20}\b(?:grades?|grading|checks?|marks?|corrects?)\b/.test(q)&&(brand==='lab'||/\b(?:kids?|son|daughter|child|children|students?|class|lesson|my)\b/.test(q))&&!/\b(?:responsib\w*|copy\w*|cheat\w*|banned|allowed|talking to|chatting)\b/.test(q))return from(['lab-teacher']);
  if(/\b(?:make the (?:important |final |big |key |real )?(?:calls?|decisions?)|final say|in charge|in control|(?:decided|run|controlled|handled|judged) by (?:the |an )?ai\b|ai (?:decides|makes (?:the |all the )?(?:decisions|calls))|humans? (?:still )?(?:involved|in the loop|oversee\w*|decide|deciding))\b/.test(q)&&!/\b(?:kids?|child|children|students?)\b.{0,20}\b(?:use|banned|allowed)\b/.test(q))return from(['philosophy-people']);
  if(/\bwhat (?:exactly |actually )?(?:does|do|will) (?:the )?ai (?:do|actually do|handle|cover)\b/.test(q))return from([brand==='shift'?'shift-ai':previousIs(context,'lab-teacher')||brand==='lab'?'lab-teacher':'philosophy-people']);
  if(/\b(?:which (?:of your )?(?:services|parts|brands|products|things)(?: of (?:the|your) (?:business|company))? (?:are|is) (?:actually )?(?:live|available|running|open|real|working)|on the roadmap|still (?:planned|coming|in progress|being built|on the roadmap)|live today|running today|actually live|what (?:is|s) (?:actually )?(?:live|running) (?:today|now))\b/.test(q)&&!/\b(?:stream|radio|lofi|24 ?7|playlist|music|broadcast|loop\w*)\b/.test(q))return from(['synk-stage']);
  if(/\b(?:what (?:do|would) you need (?:from (?:us|me))?|what (?:info|information|details) (?:do you |would you )?need|to scope|scope (?:a|the|this)|proposal|send (?:a|the|our) brief|what should (?:i|we) (?:send|include|prepare)|before (?:i|we) (?:contact|email|reach out)|first step)\b/.test(q)&&!/\b(?:price|prices|cost|fee|fees|tuition)\b/.test(q))return from([brand==='pulse'||/\b(?:ad|ads|branded content|music|track|song|character)\b/.test(q)?'pulse-collaboration':'guide-collaboration']);
  if(/\b(?:who owns?|who (?:is|will be|would be) owning|who (?:gets|keeps) the rights|ownership|owns? the (?:finished|final|rights|creative|work|thing)|own the (?:finished|final|rights|creative|work)|rights to the|usage rights|licen\w* terms|keep the rights)\b/.test(q)&&/\b(?:ad|ads|commission\w*|creative|music|character|pulse|brand|deliverables?|logo|files?)\b/.test(q))return from([/\b(?:logo|branding|deliverables?|files?)\b/.test(q)&&!/\b(?:ad|ads|music|character)\b/.test(q)?'shift-takeaway':'pulse-collaboration']);
  if(/\b(?:no (?:background|experience|clue|idea) (?:in|with|about) ai|know nothing about ai|zero (?:ai )?(?:clue|experience)|never (?:touched|tried) ai)\b/.test(q)&&!/\b(?:kickoff|handover|engagement|written|read through)\b/.test(q))return from(['shift-start']);
  if(/\b(?:no budget|zero budget|without (?:a )?budget|can t afford|cannot afford|on my own|by myself|for free|free (?:stuff|resources|materials|guides?))\b/.test(q)&&/\b(?:use|read|try|anything|something|start|guide|resources?|materials?|here)\b/.test(q)&&!/\b(?:korean|class|lesson|learn)\b/.test(q))return from(['shift-materials']);
  if(/\b(?:try (?:it )?(?:right )?now|try (?:out )?(?:for )?free|anything (?:i can )?try|free (?:trial|demo|experience)|what can i (?:try|do) (?:here|now)|is there a demo|right now for free)\b/.test(q)&&!/\bapps?\b/.test(q)&&!named.length)return from([brand==='lab'||/\bkorean|learn/.test(q)?'lab-start':'synk-stage']);
  // Unpublished company facts, evidence, careers and press.
  if(/\b(?:team size|company size|size of (?:your|the) team|what year did (?:the company|you|synk) (?:start|begin|launch)|year (?:you|synk|the company) (?:started|launched)|revenue|profit|turnover|headcount|how many (?:employees|staff|people work|teachers)|number of (?:employees|staff|teachers)|founded|when (?:was|were) (?:you|synk|the company) (?:founded|started|established)|investors?|funding|valuation|partner(?:ed)? (?:universities|schools|companies)|partnered with|client list|which universities (?:are you|do you)|government (?:registered|approved) vendor|raised so far|how much have you raised|backers|fundraising|seed round|series a|angel investors?|mrr|paying (?:users|customers)|how many (?:users|customers|subscribers|clients|learners (?:do you|have))|active users|monthly recurring|burn rate|runway|cap table|user numbers|number of (?:users|students|customers))\b/.test(q))return from(['guide-unpublished'],'needs_confirmation');
  const namedEngines=['core','loom','vellum','trail','prism','temper','reed','strata'].filter(name=>new RegExp('\\b'+name+'\\b').test(q)).filter(name=>name!=='core'||!/core (?:value|values|textbook|book|books|belief|beliefs|idea|principle|principles|mission|business|team)|synapse/.test(q));
  if(/\b(?:reviews?|testimonials?|success (?:rate|stories)|pass rate|references?|track record|past clients|how effective|proof|better than|compared (?:to|with)|compare (?:to|with|against)|comparison|versus|vs|data showing|any data|statistics|real numbers|hard numbers|numbers on|growth (?:numbers|figures|data|rate)|traction|any (?:numbers|figures|stats)|clients saved|time (?:your )?clients saved)\b/.test(q)&&!/\bexamples? of (?:your )?work\b/.test(q)&&!namedEngines.length&&!/\bsynapse\b/.test(q)){
   if(/\b(?:better than|compared (?:to|with)|compare (?:to|with|against)|versus|vs|instead of)\b/.test(q)&&!/\b(?:data|evidence|proof|statistics|numbers|research|studies)\b/.test(q))return from([brand==='path'||/agenc/.test(q)?'path-why':brand==='lab'?'lab-method':'synk-value']);
   return from([brand==='shift'?'shift-results':'guide-evidence']);
  }
  if(/\b(?:instead of|rather than|same as|different from|differs? from) (?:a |the |my |just |any |all the |other )?(?:\w+ ){0,3}(?:agency|agencies|academy|academies|school|schools|institutes?|apps?|compan(?:y|ies)|lectures?|seminars?|workshops?|courses?|trainings?|vendors?|providers?|programs?|flashcards?|schools?)\b|study agency/.test(q)&&!/\b(?:not (?:a |an )?(?:registered |register |real |proper )?(?:company|business)|fall under|some other service|solo|freelanc\w*|one person)\b/.test(q))return from([brand==='path'||/agenc/.test(q)?'path-why':brand==='lab'?'lab-method':brand==='shift'&&/\b(?:lectures?|seminars?|workshops?|trainings?|vendors?|providers?|courses?)\b/.test(q)?'shift-education':'synk-value']);
  if(/\b(?:sets? (?:synk|you|it|lab|shift|pulse|path|this) apart|what makes (?:synk|you|lab|shift|pulse|path|it|this) (?:actually |really )?(?:different|special|unique|stand out|better)|why (?:should (?:i|we) )?(?:choose|pick|go with) (?:synk|you)|stand out from|your (?:edge|advantage|usp|selling point)|unique selling|why you (?:over|instead of)|(?:apart|different) from (?:the )?(?:others|competitors?|the competition))\b/.test(q))return from([brand==='path'?'path-why':brand==='lab'?'lab-method':'synk-value']);
  if(/\b(?:(?:openings?|positions?|opportunit\w*) for (?:\w+ )?(?:teachers?|tutors?|designers?|developers?|staff)|looking for (?:\w+ )?(?:teachers?|tutors?|staff|instructors?|trainers?|educators?)|(?:are you|you guys|is synk) (?:looking for|hiring|taking on|recruiting|in need of) (?:\w+ )?(?:instructors?|teachers?|tutors?|people|staff)|(?:i have been|i ve been|been) teaching (?:korean |english )?(?:for )?\d+ years?|teaching jobs?|work as a (?:teacher|tutor)|hiring|recruit\w*|vacanc\w*|job openings?|work (?:for|at) (?:you|synk)|join (?:your|the) team|send (?:my )?(?:cv|resume)|(?:cv|resume)\b.{0,30}\b(?:apply|paste|send|chat)|apply (?:for a job|as a (?:teacher|tutor|designer|developer))|taking applications|accepting applications|applications for (?:instructors|teachers|tutors)|visa sponsorship|sponsor (?:a |my |work )?visas?|instructor role|i am a (?:certified |qualified |licensed )?(?:korean )?(?:teacher|tutor|instructor)|teacher based in|looking to teach|want to teach (?:for|with|at) you|instructor (?:positions?|roles?))\b/.test(q))return from(['guide-careers'],'needs_confirmation');
  if(/\b(?:press|journalist|media (?:inquiry|enquiry)|interview (?:request|with (?:you|the founder)))\b/.test(q))return from(['guide-contact']);
  // Details that are not published: class size, breaks, people's names, characters' species or birthdays.
  if(/\b(?:class size|how many (?:students|kids|children|people|learners) (?:are |is |will be )?(?:usually |typically |normally |there )?(?:in|per) (?:a|each|the|one) (?:class|group|classroom)|students per class|break time|lunch|shuttle|dorm\w*|accommodation)\b/.test(q))return {...unknown(brand),relatedIds:['lab-class','lab-availability']};
  if(/\b(?:teacher|tutor|instructor|director|author|voice actor|principal)s?'?s? (?:names?|background|qualifications?|profile)|(?:who|what) (?:is|are) the (?:teachers?|author|voice)|\b(?:birthday|species|what animal|voice actor|lyrics|headset model|which headset|chapter titles?|what software|which software|who sings|singer s? name|vocalist|who (?:is|s) the singer)\b|(?:mongle|kkamong|marin)\b.{0,30}\b(?:bear|dog|cat|rabbit|animal|age|old)\b|\b(?:how old|age of)\b.{0,20}\b(?:mongle|kkamong|marin)\b/.test(q))return {...unknown(brand),relatedIds:[/mongle|kkamong|marin|character/.test(q)?'synk-characters':brand&&records.has(brand+'-intro')?brand+'-intro':'synk-choose','guide-contact']};
  // Conditions, guarantees and contact.
  if(/\b(?:fail|failed|don t pass|do not pass|miss)\b.{0,20}\b(?:topik|level 4|level four)\b|\b(?:topik|level 4)\b.{0,40}\b(?:fail|don t pass|do not pass|below level|under level|still below|not reach)\b|\b(?:below|under) level (?:4|four)\b|\b(?:6|six) (?:extra )?months?\b|\b(?:app )?extension\b|\b(?:if i|what if i|when i) fail\b|\bfail (?:the )?(?:exam|test|topik)\b|\bfail at the end\b|\bdo not pass (?:the )?(?:exam|test)\b/.test(q))return from(['lab-year']);
  if(/\b(?:guarantee\w*|definitely|promise|for sure|100)\b/.test(q)&&/\b(?:pass|topik|level)\b/.test(q)&&!/\b(?:job|visa|admission|university)\b/.test(q))return from(['lab-year']);
  if(/\b(?:topik ?4|level ?4|level four)\b/.test(q)&&/\b(?:unlock|scholarship\w*|part time|work|allowed|benefits?|get (?:you|me)|good for|useful|why|enough|what can i do)\b/.test(q))return from(['lab-topik']);
  if(/\b(?:topik ?4|level ?4|level four)\b/.test(q)&&/\b(?:realistic|achievable|doable|feasible|ambitious|reachable|possible|attainable)\b/.test(q))return from(['lab-topik','lab-year']);
  if((/\b(?:guarantee\w*|promise)\b/.test(q)&&/\b(?:save|hours|revenue|profit|productivity|sales|results?)\b/.test(q))||(/\b(?:measurable|productivity gains?|roi|return on investment|numbers|metrics|kpis?|time sav\w*|hours sav\w*)\b/.test(q)&&/\b(?:expect|will|can we|get|see|show|prove|board|ask|adopt)\b/.test(q)&&!/\bmrr\b/.test(q)))return from(['shift-results']);
  if(/\bvr\b/.test(q)&&/\b(?:now|yet|try|available|use it|open)\b/.test(q))return from([brand==='path'?'path-support':'lab-vr'],'needs_confirmation');
  if(/\b(?:free to (?:listen|stream|watch|play)|listen (?:to (?:it |them |that )?)?for free|(?:need|make|create|have) an account (?:to|for|before) (?:listen|stream|play|watch)|(?:is|are) (?:it|that|they|the (?:radio|stream|playlist|music|mix)) free\b|any (?:subscription|fee|charge|cost) to listen|pay to listen|behind a paywall)\b/.test(q)&&(brand==='pulse'||previousIs(context,'pulse-radio','pulse-listening')||/\b(?:radio|stream|lofi|playlist|music|songs?|tracks?|mix)\b/.test(q)))return from([previousIs(context,'pulse-radio')||/\b(?:radio|stream|lofi|24|all day|mix)\b/.test(q)?'pulse-radio':'pulse-listening']);
  if(/\b(?:price|priced|prices|pricing|cost|costs|fee|fees|tuition|rates?|quote|budget|charge\w*|how much(?! time| longer| does it take)|discount|instal+ments?|refund|enrol|enroll|enrollment|enrolment|available now|start date|open yet|launched yet|live yet|available yet|when (?:does|do|can) (?:it|classes|the course|i) (?:start|begin|open))\b/.test(q))return from([brand==='lab'?'lab-availability':brand==='path'&&/\b(?:open|launched|live|available) yet\b/.test(q)?'path-support':'guide-availability'],'needs_confirmation');
  if(/guarantee.*(?:job|admission|visa|university)|(?:job|admission|visa|university).*guarantee/.test(q))return from(['path-support'],'needs_confirmation');
  if(/\b(?:contact|email address|phone number|reach you|send an enquiry|send an inquiry)\b|who (?:do|should) i (?:email|contact|write to)|where (?:do|should) i (?:email|send)/.test(q))return from([brand==='pulse'&&/\b(?:use|rights|licen|collab|track|music)\w*/.test(q)?'pulse-collaboration':'guide-contact']);
  if(/\bprivacy|\bcookies?\b|\b(?:save|store|retain|record|collect|track|keep|log|send|sent|upload|transmit)(?:s|ed|ing)?\b.*\b(?:chats?|conversations?|questions?|data|what (?:i|she|he|they|we|my \w+) (?:listen|type|ask|write|say|enter)\w*|anything (?:i|she|he|they|we) (?:type|write|say)\w*|somewhere|servers?|cloud|third part\w*|here)\b|\b(?:chat|conversation|data|anything (?:i|she|he|they) type\w*|what (?:i|she|he) type\w*)\b.*\b(?:saved|stored|collected|tracked|kept|logged|sent)\b/.test(q)&&!/consultation|chat ?gpt|chatbot|brief|proposal|files?/.test(q))return from(['guide-privacy']);
  if((/\bconsultation|counsel\w*/.test(q)&&/\b(?:notes?|records?|keep|kept|delete|deleted|how long|store)\b/.test(q))||/\b(?:where|how long) (?:exactly )?(?:do|will|would) you (?:keep|store|hold|retain)\b.{0,50}\b(?:notes|progress|records|files|information)\b|\bwho (?:can |gets to )?(?:see|access|view|read) (?:his|her|their|my|the|our) (?:notes|records|progress|files?|data)\b/.test(q))return from(['guide-records']);
  if(/\b(?:updates?|reports?|progress|how (?:she|he|my (?:child|kid|son|daughter)) (?:is|s) doing|hear from (?:the|that|her|his|a) teacher|how often (?:would|will|do|can) (?:i|we) hear)\b/.test(q)&&(/\b(?:she|he|my (?:child|kid|son|daughter)|parent)\b/.test(q)||previousIs(context,'lab-teacher','lab-parent')))return from(['lab-parent']);
  // Rights and collaboration before channel names.
  if(/\b(?:do you (?:ever |also |guys |even )?(?:make|create|produce|release|put out|plan to make)|any (?:plans? for|chance of)) (?:\w+ ){0,3}(?:music videos?|animations?|animated (?:videos?|shorts|series)|character(?: driven)? (?:videos?|content|stories|series|animations?)|stories|story videos?|videos? (?:with|featuring|starring) (?:the )?characters?|full (?:songs?|tracks?|albums?)|vocal (?:tracks?|songs?)|lyrics? (?:songs?|tracks?))\b/.test(q)&&(brand==='pulse'||/\b(?:lofi|music|characters?|mongle|kkamong|marin|pulse|songs?|tracks?)\b/.test(q)))return from(['pulse-content','pulse-listening']);
  if(/\b(?:use|play|put|upload|sell|print|make|include)\b.{0,40}\b(?:music|songs?|tracks?|lofi|characters?|mongle|kkamong|marin|logo|artwork|images?|them)\b.{0,40}\b(?:video|videos|vlogs?|reels?|tiktok|shorts|content|instagram|study with me|monetized|thumbnails?|shop|store|cafe|caf|restaurant|business|commercial|merch\w*|stickers?|products?|channel|youtube|stream|podcast|bgm|allowed|okay|ok)\b|\b(?:can|may) i (?:use|play|sell|put)\b|\bam i allowed\b/.test(q)&&!/\b(?:cv|resume|as experience|my experience|what i learn|skills|university|job interview|application)\b/.test(q)&&!/\bdo you (?:ever |also |guys |even )?(?:make|create|produce|release|put out)\b/.test(q))return from(['pulse-rights']);
  if(/\b(?:compose|original (?:music|song|track)|custom (?:music|song|track)|make a (?:track|song) with|feature|pitch|collab\w*)\b/.test(q)&&(brand==='pulse'||/\b(?:music|track|song|pulse|singer|songwriter|producer|artist|tv spot|ad)\b/.test(q)))return from(['pulse-collaboration']);
  if(/\b(?:instagram|youtube|tiktok|telegram|facebook|social media|sns)\b/.test(q))return from(['guide-channels']);
  // Atlas engines by name or by role.
  if(/\bsynapse\b/.test(q)||/\bcore\b.{0,20}\btalk\b/.test(q))return from(['lab-curriculum']);
  const engines=namedEngines;
  if(engines.length&&(/\b(?:engine|engines|atlas|work|works|does|do|explain|what|difference|different|vs|versus|compare|similar|role|job)\b/.test(q)||engines.includes(q)))return from(engines.map(name=>'atlas-'+name));
  if((/\bengines?\b/.test(q)||previousIs(context,'synk-atlas')||/\b(?:which (?:one|part|piece) (?:of (?:those|them|these) )?(?:decides|handles|takes care|is responsible)|which (?:part|piece|module) (?:handles|decides)|who or what (?:picks|decides|chooses))\b/.test(q))&&!engines.length){
   const roles=[['atlas-trail',/record|track|history|progress/],['atlas-prism',/compar/],['atlas-temper',/(?:check|verif|test).*(?:help|work|effect)|effective/],['atlas-vellum',/hint|explanation|explain(?:s|ing)? to/],['atlas-loom',/screen|scene|visual|animation|movement/],['atlas-reed',/music|sound|audio/],['atlas-core',/decid|judg|next task|study next|next step|what (?:i|to) (?:should )?study|picks? the next|choose the next|next (?:one|exercise|task|question)|keep (?:getting wrong|messing up)/],['atlas-strata',/order|map|sequence|what to learn/]];
   const hit=roles.filter(([,re])=>re.test(q)).map(([id])=>id);if(hit.length&&hit.length<=2)return from(hit);
  }
  if(previousIs(context,'synk-atlas')&&/\b(?:planned|not yet|coming|upcoming|still|later|future)\b/.test(q))return from(['atlas-strata']);
  if(/\b(?:hint|help|support)\b.{0,30}\b(?:actually )?(?:helped|worked|effective|made a difference)\b|\b(?:check|verify|measure|know)\b.{0,30}\bhelped\b/.test(q))return from(['atlas-temper']);
  if(/\batlas\b/.test(q))return from(['synk-atlas']);
  // Brands, company and philosophy.
  if(named.length>1&&/\b(?:which|who|where) (?:one|brand|team|should)|\bhandle/.test(q))return from(['synk-choose']);
  if(named.length>1||/\bseparate compan/.test(q)){if(/differ|compare|vs|versus|between|separate|relationship|same|how are .* related|fit together|under one company|one company|connected|relate to each other|work together/.test(q))return from(['synk-brands']);}
  if(/\b(?:what (?:exactly )?is synk|what kind of (?:company|business)|is synk a|school or|tech company)\b/.test(q)&&!named.length)return from(['synk-intro']);
  if(/\b(?:sum up|summari[sz]e|in a (?:couple of|few) (?:lines|sentences|words)|in one (?:line|sentence)|elevator pitch|overview of synk|brief(?:ly)? (?:describe|introduce))\b/.test(q)&&!named.length)return from(['synk-intro']);
  if(/\bwhy (?:does|do|would) (?:one|a single|the same|a|one single) company\b|\bfeels? (?:a bit )?random\b|\bso (?:different|unrelated)\b|\bwhy all (?:these|three|four)\b/.test(q))return from(['synk-brands']);
  if(/\bwho(?: is| s)? (?:actually )?(?:running|behind|runs)\b|\bwho (?:started|founded|created) (?:synk|it|the company)\b/.test(q))return from(['synk-planner','synk-founder']);
  if(/\b(?:actually running|running today|up and running today|still being prepared|which (?:of your )?(?:services|parts|brands) (?:are|is) (?:live|available|running|open))\b/.test(q))return from(['synk-stage']);
  if(/\b(?:who|which|what)(?: is| s| are)? (?:the )?(?:\w+ ){0,3}(?:characters?|mascots?)\b/.test(q)&&!/\b(?:use|allowed|licen|sell|merch)\w*/.test(q))return from(['synk-characters']);
  if(/\b(?:lore|backstor(?:y|ies)|origin stor(?:y|ies)|stories (?:about|behind|of) (?:them|the characters?|mongle|kkamong|marin|the mascots?)|more (?:about|on|of) (?:them|the characters?|mongle|kkamong|marin)|character (?:bios?|profiles?|stories|lore|pages?)|(?:their|the characters ) (?:personalit\w*|relationships?|world))\b/.test(q)&&/\b(?:characters?|mascots?|mongle|kkamong|marin|them|their)\b/.test(q)&&!/\b(?:use|allowed|licen|sell|merch)\w*/.test(q))return from(['synk-characters','pulse-intro']);
  if(/\b(?:student work and ai|ai edits?|keep(?:ing)? .{0,30} apart|separate (?:the )?(?:student|original)|what the student wrote)\b/.test(q))return from(['philosophy-purpose']);
  if(/\b(?:which (?:of your |of the )?(?:brands?|one|part|service)s?\b.{0,25}\b(?:start|begin|first|pick|choose|for me|fits?|suits?|go to|look at)|matter which|not sure which (?:brand|one|part|service)|which (?:brand|one) (?:should|do|would) i)\b/.test(q)&&named.length<=1&&!namedEngines.length)return from(['synk-choose']);
  if(/\bwho (?:is|s|are) (?:lab|shift|pulse|path|it|this|synk|you|the (?:program|course|service|app|classes|training)) (?:actually |really |mainly |mostly |primarily )?(?:meant|intended|designed|made|built|aimed|geared|suited|targeted|good|best) (?:for|at|to)\b|\bwho (?:is|s) (?:it|this|that) (?:all )?for\b|\btarget (?:audience|users?|customers?|market|group)\b|\bwho (?:do|are) you (?:mainly |mostly |actually )?(?:serve|help|teach|target|work with|aim at|cater to)\b/.test(q)){const b=named[0]||(brand&&brand!=='synk'?brand:null);return from([b==='lab'?'lab-audience':b==='shift'?'shift-audience':b==='pulse'?'pulse-intro':b==='path'?'path-vision':'synk-choose']);}
  if(/\b(?:first time|new here|where (?:do i|to|should i) (?:even )?(?:begin|start)|where to begin)\b/.test(q)&&!/\b(?:korean|hangul|learn|written|read through|guide|article|ai tools)\b/.test(q))return from([brand==='lab'?'lab-start':brand==='shift'?'shift-start':'synk-choose']);
  if(/\b(?:how far along|what stage|which parts are (?:actually )?running|still being built|in development|up and running|launched)\b/.test(q))return from([brand==='path'?'path-support':'synk-stage']);
  if(/\b(?:long ?term (?:goal|plan|aim)|long game|in the long run|long run|vision|mission|where (?:is|are) (?:synk|you|pulse|lab|shift|path) (?:heading|going|hoping to take)|hoping to take|ultimate goal|end goal|end game|big (?:ambition|picture|goal|plan)|ambitions?|ultimately (?:want|trying|aiming|building|working)|working towards?|building toward|what (?:is|s) the (?:goal|plan|aim) (?:for|of|with))\b/.test(q)&&!/\b(?:my|our) (?:goal|plan|ambition)\b/.test(q))return from([(named[0]||(brand&&brand!=='synk'?brand:'synk'))+'-vision'].filter(id=>records.has(id)).concat(records.has('synk-vision')?[]:['synk-visions']));
  if(/\b(?:independen(?:ce|t)|self reliant|adapt on their own|stand on their own)\b/.test(q)&&/\b(?:students?|learners?|korea|kids?|day to day)\b/.test(q))return from(['path-philosophy']);
  if(/\b(?:belief|beliefs|philosophy|values|principles|care about most|believe|vibe|going for|want people to feel|feel when|mood you|aesthetic|atmosphere|thinking behind|reasoning behind|rationale|idea behind)\b/.test(q)&&!/\b(?:my|our) (?:values|beliefs)\b/.test(q)){const b=named[0]||(brand&&brand!=='synk'?brand:null);return from([b&&records.has(b+'-philosophy')?b+'-philosophy':'philosophy-purpose']);}
  // The founder page is public: who builds SYNK and the founder's education, career and awards.
  const founderAsk=/\b(?:founder|ceo|yuho)\b/.test(q)&&!/\b(?:solo|startup|start up|i am a|im a|i m a|as a|we are|our|fellow) founders?\b/.test(q);
  if(founderAsk&&/\bhow old\b|\bwhat age\b|\bage of\b|\b(?:his|her|their|founder s|ceo s|yuho s) (?:age|family|kids|children|salary|income|address)\b|\b(?:born|birthday|hometown|married|marriage|wife|husband|spouse|girlfriend|boyfriend|net worth)\b|\b(?:has|have) (?:kids|children)\b|\bwhere (?:does|do) (?:the )?(?:founder|ceo|yuho) live\b/.test(q))return {...unknown(brand),relatedIds:['synk-founder-background','guide-contact']};
  if(founderAsk&&/\b(?:background|education|studied|study|school|university|college|degree|major|career|experience|awards?|resume|cv|worked|did before)\b/.test(q))return from(['synk-founder-background']);
  if(/\bwho (?:is|s) (?:the )?(?:founder|ceo)\b|\b(?:founder|ceo)(?: s)? name\b|\bwho (?:is|s) yuho\b|\byuho yang\b/.test(q))return from(['synk-planner']);
  if((founderAsk&&/\bfounder/.test(q))||/why did (?:you|they|he|she) (?:start|build|create|found)|why (?:build|start|create) synk\b/.test(q))return from(['synk-founder']);
  if(/\b(?:good enough|quality|polish\w*|ready to ship|ship it|before (?:you )?release|finish\w* (?:a|the) (?:feature|product))\b/.test(q)&&!/\b(?:went wrong|failures?|mistakes|messy|only the (?:polished|good|final)|realistic examples|show)\b/.test(q))return from(['philosophy-quality']);
  if(/\b(?:ai|technology|machines?|computers?)\b.{0,40}\b(?:people|humans?|teachers?|decide|replace)\b|\bdraw the line\b/.test(q)&&!/\bkids?\b.*\b(?:use|banned)\b/.test(q)&&!/\b(?:over (?:my|our) heads?|zero ai|no ai (?:people|experience)|beginners?|ai people)\b/.test(q))return from(['philosophy-people']);
  if(/\b(?:business (?:registration|reg)|registration number|company number|biz number)\b/.test(q))return from(['synk-registration']);
  if(/\b(?:music label|record label|entertainment company)\b/.test(q))return from(['pulse-intro']);
  if(/^(?:the )?(?:mascots?|characters?)$/.test(q))return from(['synk-characters']);
  if(/^(?:company )?branding$/.test(q))return from(['shift-services']);
  // LAB.
  if(/\b(?:new to korean|never (?:studied|learned) (?:korean|hangul)|complete beginner|total beginner|from scratch|no korean at all|do not (?:speak|know|no) (?:any |much )?(?:korean|hangul)|know no korean|zero korean|cannot (?:even )?read (?:hangul|korean)|can t read hangul|where do i (?:even )?(?:start|begin)|how do i (?:even )?(?:start|begin))\b/.test(q))return from(['lab-start']);
  if(/\b(?:know|read|learn|master|memori[sz]e) (?:hangul|hangeul|the (?:korean )?alphabet)\b.{0,15}\b(?:first|before|already|beforehand|in advance)\b|\balready (?:know|read) (?:hangul|hangeul|the alphabet)\b|\bneed to (?:already )?(?:know|read|learn) (?:hangul|hangeul|the alphabet)\b|\b(?:hangul|hangeul) (?:first|before|beforehand|required|a prerequisite)\b/.test(q))return from(['lab-start']);
  if(/\b(?:(?:do not|cannot|can t|don t|dont) (?:speak|know|read|understand) (?:any )?korean myself|myself (?:do not|don t|dont) (?:speak|know)|as a (?:non korean speaking |non korean )?(?:parent|mom|dad|mother|father)|judge (?:whether|if) (?:this|the|a|it)|(?:good|right|worth it|safe|suitable) for my (?:kid|child|son|daughter|teenager|teen))\b/.test(q)&&(brand==='lab'||!brand||brand==='synk'))return from(['lab-parent']);
  if(/\b(?:not sure|have not decided|haven t decided|undecided|just like|only interested|just want to learn|not planning to study|before i (?:ve |have )?(?:truly |really )?decided|not decided yet|still deciding|look around|just (?:looking|browsing|exploring))\b/.test(q)&&/\b(?:korea|korean|language|study|lab|moving)\b/.test(q))return from(['lab-explore']);
  if(/\b(?:i am|im|i m) (?:\d\d|thirty|forty|fifty)\b|\bwork(?:ing)? full time\b|\bworking (?:adult|professional)\b|\bnot a student\b|\badults?\b|\bgrown ups?\b|\bolder learners?\b|\btoo old\b|\boffice worker\b/.test(q)&&/\b(?:join|learn|study|class|course|still|can i|only for|welcome|lessons?)\b/.test(q)&&(brand==='lab'||!brand||brand==='synk'))return from(['lab-adult']);
  if(/\b(?:i am from|im from|from (?:nigeria|india|brazil|mongolia|vietnam|indonesia|uzbekistan|kazakhstan|philippines|mexico|egypt|kenya|pakistan|bangladesh|nepal|peru|turkey|another country)|living in|based in|live in|outside (?:korea|mongolia)|not in mongolia|only (?:for )?mongolia|only mongolians?|from abroad|overseas|another country|other countr\w+|any nationality|foreigners?|international students?|who can (?:join|apply|study)|eligible)\b/.test(q)&&/\b(?:learn|join|study|apply|class|course|lessons?|korean|lab|eligible|can i|ok|okay)\b/.test(q)&&!/\b(?:study in korea|university|visa)\b/.test(q))return from(['lab-audience']);
  if(/\bwhere\b.{0,20}\b(?:school|academy|campus|classes|lab|located|be)\b|\b(?:location|address)\b/.test(q)&&(!brand||brand==='lab'||brand==='synk')&&!/\bstudy in korea\b/.test(q))return from(['lab-location']);
  if(/\b(?:buy|purchase|order|get)\b.{0,20}\b(?:books?|textbooks?|them)\b/.test(q)&&(previousIs(context,'lab-curriculum')||/books?|textbooks?/.test(q))&&!/\bwhat do i (?:actually )?get\b|\bmore than\b|\bjust textbooks\b/.test(q))return from(['lab-curriculum']);
  if(/\b(?:books?|textbooks?|volumes?|series|synapse|manuscripts?|all (?:\d+|eight|six|two))\b/.test(q)&&/\b(?:finished|done|complete\w*|ready|published|printed|out yet|available|written|exist)\b/.test(q)&&(previousIs(context,'lab-curriculum')||brand==='lab'||/\bsynapse\b/.test(q))&&!/\b(?:buy|price|cost|fee|how much)\b/.test(q))return from(['lab-curriculum']);
  if(/\bapp\b/.test(q)&&/\b(?:download|available|released|release|already out|app store|play store|install|when (?:is|will|does|can) (?:the |your )?app|is the app out|app (?:be )?(?:ready|out|launch\w*))\b/.test(q))return from(['lab-availability'],'needs_confirmation');
  if(/\bapp\b.{0,80}\b(?:know|bad at|weak|struggle|struggling|mistakes|adapt|next|what to study|recommend|suggest|tell me what|figure|shows me|based on (?:what|how) i|same (?:\w+ )?for everyone)\b/.test(q))return from(['lab-personalization']);
  if(/\b(?:master s|masters|master|graduate school|grad school|phd|doctorate|bachelor s|bachelors|undergraduate)\b/.test(q)&&/\b(?:help|ready|prepare|plan|study|korea|seoul|path)\b/.test(q))return from(['path-personal']);
  if(/\b(?:language school|an app|or both|what kind of (?:school|program|company)|physical school|classrooms?|software company|real school|actual school|edtech|is lab an?|online only)\b/.test(q)&&(brand==='lab'||named.includes('lab')))return from(['lab-intro']);
  if(/\benglish\b/.test(q)&&/\btopik\b/.test(q))return from(['lab-language-use']);
  if(/\b(?:placement|level test|decide (?:my|the) (?:class )?level|which level|my level)\b/.test(q)&&/\b(?:english|korean|class|level)\b/.test(q))return from(['lab-languages']);
  if(/\b(?:chatgpt|ai|chatbots?)\b/.test(q)&&/\b(?:kids?|students?|class|children|teens?|teenagers?|young people|my (?:son|daughter|child)|learners?)\b/.test(q)&&/\b(?:use|using|banned|allowed|responsib\w*|teach|copy\w*|cheat\w*|depend\w*|rely)\b/.test(q))return from(['lab-ai']);
  if(/\b(?:visa interview|embassy|consulate)\b/.test(q)&&/\b(?:airport|immigration|arrival|land|border|entry)\b/.test(q))return from(brand==='path'?['path-journey']:['lab-vr']);
  if(/\b(?:native speakers?|real (?:koreans?|people|humans?)|talk(?:ing)? (?:to|with) (?:real )?koreans|speaking practice with|conversation with (?:a )?(?:real|native))\b/.test(q)&&/\b(?:practice|speak\w*|talk\w*|conversation|class|lessons?|or is it|all ai)\b/.test(q))return from(['lab-languages']);
  if(/\benglish (?:lessons?|class(?:es)?|courses?|track)\b/.test(q)&&/\b(?:included|separate|package|extra|also|still|too|as well|both|optional)\b/.test(q))return from(['lab-languages']);
  if(/\b(?:feedback|corrections?|corrected)\b/.test(q)&&/\b(?:writing|essays?|texts?|sentences?|homework|my work|what i (?:write|wrote))\b/.test(q)&&!/\bemail\b/.test(q))return from(['lab-game-demo']);
  if(/\b(?:take (?:that|this|it) into account|my (?:learning )?(?:style|preferences?|way)|prefer (?:to|examples|rules|seeing)|examples? (?:first|after)|rules? first|the way i learn|how i learn|learn better when|visual learner|adapts? to (?:me|my|how i)|set up that way|decide for me|adjusts? based on|based on (?:my|the|your) answers|same lesson twice|never see the same)\b/.test(q)&&(brand==='lab'||!brand||brand==='synk'))return from([/\b(?:apps?|games?)\b/.test(q)?'lab-personalization':'lab-personal']);
  if(/\b(?:eight week|8 week|seasons?|crew projects?|compass)\b/.test(q)&&(brand==='lab'||/\b(?:crew|compass|lab)\b/.test(q)))return from(['lab-ai-practice']);
  if(/\b(?:interview (?:coaching|practice|prep\w*|training|sessions?)|job interviews?|after graduation|stop at admission|beyond admission|mock interviews?|rehearse|practice in (?:the )?vr|vr thing|vr practice)\b/.test(q)&&!/\b(?:visa interview|immigration|airport|separate tracks?|university application|both a)\b/.test(q))return from([brand==='path'?'path-journey':'lab-vr']);
  if(/\b(?:too late|is it late|enough time|only have \d+ ?(?:yr|year|years|months?)|before (?:my )?applications?|in time for)\b/.test(q)&&(brand==='path'||/\b(?:apply|applications?|admission|university|topik)\b/.test(q)))return from(['path-personal']);
  if(/\b(?:which (?:schools?|universit\w+)|school (?:choice|selection)|choose (?:a|the right) (?:school|university)|fit my major|timeline|study plan|application plan|apply(?:ing)? to (?:a )?(?:korean )?universit\w*|build a plan|compare (?:requirements|schools|universities)|requirements (?:between|of|for) (?:different )?(?:schools|universities)|admission requirements|separate tracks?|(?:both|toward|towards) (?:a )?(?:university|college) (?:application|admission))\b/.test(q)&&!/\b(?:teach|training|consult|company|staff|share|public|release|launch|announce)\b/.test(q))return from(['path-personal']);
  if(/\b(?:landing|land|get|getting|find|finding|secure|securing) a job\b|\bjob (?:placement|support|after)\b|\bafter (?:graduation|graduating|the (?:course|program))\b.{0,30}\bjob\b|\bfrom (?:studying|learning) (?:the language|korean) to\b/.test(q)&&(brand==='path'||/\b(?:study|korea|korean|university|graduat\w*)\b/.test(q))&&!/\b(?:hiring|work for you|join your team)\b/.test(q))return from(['path-support']);
  if(/\b(?:as (?:her|his|a|the) (?:mother|father|parent|mom|dad)(?: of)?|my (?:daughter|son|child|kid|teenager) (?:is|wants|would like))\b/.test(q)&&/\b(?:look(?:ing)? (?:at|for|out|into)|check|consider|ask|before (?:i|we) (?:commit|sign|pay|decide)|what should i|worried|concern\w*|sign (?:him|her|them|my \w+) up|enrol\w*)\b/.test(q))return from(['lab-parent']);
  if(/\bfit (?:my|each|the|every) (?:child|kid|student|learner)\b|\bone fixed track\b|\bone size fits all\b|\bsame (?:\w+ )?for (?:everyone|everybody|all students)\b|\bfixed (?:track|curriculum|path)\b|\btailored to (?:my|each|every)\b|\bfollowing one (?:fixed )?(?:track|path)\b/.test(q))return from(['lab-personal']);
  if(/\b(?:portfolios?|personal statements?|statements? of purpose|motivation letters?|self introductions?|application (?:essays?|documents?))\b/.test(q)&&(brand==='path'||named.includes('path')||/\b(?:apply|applications?|universit\w*|jobs?|korea|employer|school)\b/.test(q))&&!/\b(?:shift|branding|design|art|freelanc\w*)\b/.test(q))return from(['path-why']);
  if(/\b(?:1|one) ?(?:yr|year) (?:program|course|track|curriculum)\b|\bhow (?:is|s) the (?:whole )?(?:program|course|year|curriculum) (?:set up|structured|organi[sz]ed|laid out)\b|\bsame every day\b|\bdaily schedule\b/.test(q)&&(brand==='lab'||!brand||brand==='synk'))return from(['lab-year']);
  if(/\bwhat do i (?:actually )?get\b|\bwhat (?:is|s) included\b|\bmore than (?:just )?(?:textbooks?|books)\b|\bjust textbooks\b/.test(q)&&(brand==='lab'||/\b(?:textbooks?|books|sign up|course|lessons?)\b/.test(q))&&!/\b(?:team|staff|workshop|consult\w*|deliverables?)\b/.test(q))return from(['lab-provides']);
  if(/\b(?:kpop|k pop|dance|dancing|choreograph\w*|songs?)\b/.test(q)&&/\b(?:learn\w*|through|lessons?|class(?:es)?|activity|activities|event|really|warm|part of|one off|curriculum|marketing|actually use|in class)\b/.test(q)&&!/\b(?:licen\w*|music videos?|use (?:your|the|their|it|them)\b|pulse|radio|lofi|enjoy\w*|hidden|buried|listen\w*|playlist|sleep|relax\w*|background)\b/.test(q))return from(['lab-culture']);
  // SHIFT.
  if(/\b(?:know (?:literally )?(?:nothing|little) about ai|over (?:my|our) heads?|too (?:hard|difficult|advanced)|non ?technical|not technical|not a developer|zero ai (?:people|experience|knowledge|skills)|no ai (?:people|experience|knowledge|skills))\b/.test(q))return from(['shift-start']);
  if(/\b(?:never used ai|not used ai|used ai (?:once|only once)|tried chat ?gpt once|beyond (?:trying )?chat ?gpt|nobody (?:here )?has used|first time with ai|older (?:staff|employees|team)|in their (?:50s|60s)|not tech savvy)\b/.test(q)&&!/\b(?:kickoff|handover|engagement|process|look like)\b/.test(q))return from(['shift-start']);
  if(/\b(?:something (?:written|to read)|read through|written down|any (?:guide|article|write ?up)|where to start with ai tools)\b/.test(q)&&!/\b(?:korean|class|lesson)\b/.test(q))return from(['shift-materials']);
  if(/\b(?:no (?:background|experience|clue|idea) (?:in|with|about) ai|know nothing about ai|zero (?:ai )?(?:clue|experience)|never (?:touched|tried) ai)\b/.test(q)&&!/\b(?:kickoff|handover|engagement)\b/.test(q))return from(['shift-start']);
  if(/\b(?:not (?:total |complete |all )?beginners?|already (?:use|uses|using|mess(?:es)? around|play|tried|familiar)|beyond (?:the )?basics|intermediate|some experience|not new to ai)\b/.test(q)&&(brand==='shift'||/\b(?:team|staff|workshop|training|ai)\b/.test(q))&&!/\b(?:korean|kids?|child)\b/.test(q))return from(['shift-audience']);
  if(/\b(?:different from|differs? from|compared to|unlike) (?:a |the |any )?(?:normal|regular|typical|traditional|ordinary|usual|standard) (?:language |korean )?(?:class|classes|school|academy|course|lessons?|institute)\b|\bway of teaching\b.{0,30}\bdifferent\b/.test(q))return from([brand==='path'?'path-why':brand==='shift'?'shift-ai':'lab-method']);
  if(/\b(?:also do|do you (?:also |guys )?do|besides|other than|as well as|or just|or only)\b.{0,20}\b(?:branding|consult\w*)\b|\bbranding (?:stuff|too|as well|and)\b/.test(q))return from(['shift-services']);
  if(/\b(?:pay (?:you|your team)|hire (?:you|your team)|commission (?:you|your team)|do (?:something similar|this|that|it) for (?:me|us|my|our)|can you do (?:it|this|that) for)\b/.test(q))return from([brand==='pulse'?'pulse-collaboration':'guide-collaboration']);
  if(/\b(?:besides ai training|other (?:stuff|services|things|areas)|planning to offer|what else do you (?:offer|do)|offer later|in the pipeline)\b/.test(q)&&(brand==='shift'||/\b(?:training|ai|consult)\b/.test(q)))return from(['shift-scope']);
  if(/\b(?:what would (?:your|the) training (?:actually )?change|change about how (?:they|we) work)\b/.test(q))return from(['shift-takeaway']);
  if(/\b(?:do something with ai|apply (?:it|ai|this|that) to (?:daily|everyday|day to day|our|real|actual|their) work|use ai (?:in|for) (?:daily|everyday|our|real|actual) work|ai (?:in|into|for) (?:daily|everyday|day to day) work|nobody (?:actually |really )?knows how|no one (?:actually |really )?knows how|kind of gap|gap (?:you|shift) (?:is |are )?(?:meant|trying|there) to (?:close|fill|address))\b/.test(q)&&(brand==='shift'||/\b(?:ai|shift)\b/.test(q))&&!/\b(?:korean|kids?|child)\b/.test(q))return from(['shift-intro']);
  if(/\b(?:(?:same|similar|those|these|comparable|identical) (?:business |kind of )?(?:results|outcomes|numbers|gains)|(?:repeat|replicate|reproduce|achieve|expect|get) (?:the |those |these |your )?(?:same |similar )?(?:results|outcomes)|results (?:shown|in your (?:examples|guides|case studies)|like (?:yours|those|that)))\b/.test(q)&&(brand==='shift'||/\b(?:training|staff|team|examples|guides?|ai|consult\w*)\b/.test(q))&&!/\b(?:korean|topik|kids?)\b/.test(q))return from(['shift-results']);
  if(/\b(?:hands on|hands-on|practical|workshop|build something|built something|leave having built|actually (?:build|make|do|produce)|lectures? only|lectures? (?:on|about)|ai theory|just (?:slides|lectures|theory)|theory only|slides of tools|show slides|different about how you teach|how you teach|teaching (?:approach|style|method)|practical stuff|day to day|how (?:you|we) (?:actually )?use (?:it|them|ai))\b/.test(q)&&(brand==='shift'||/\b(?:staff|team|employees|training|trainers?|session|ai)\b/.test(q))&&!/\b(?:walk away|take away|takeaways?|deliverables?|what do (?:we|i) get|source files|solo|freelanc\w*|one person|someone like me|not a company|individuals?|small business)\b/.test(q))return from([/\b(?:actual work|our work|real work|results are|already use)\b/.test(q)?'shift-services':/\b(?:slides|how you teach|teaching (?:approach|style|method)|different about|practical stuff|day to day|how (?:you|we) (?:actually )?use)\b/.test(q)?'shift-ai':'shift-education']);
  if(/\b(?:came out (?:wrong|bad|cursed|weird|different|terrible)|did not work|didn t work|doing it wrong|different results?|results? (?:vary|differ)|not the same result|mine looks|why (?:is|does) (?:the )?(?:result|output) different|every time (?:it s |is )?different)\b/.test(q)&&(brand==='shift'||/\b(?:guide|prompt|ai|tutorial)\b/.test(q)))return from(['shift-results']);
  if(/\b(?:one person|one man|one woman|solo|freelanc\w*|etsy|small shop|side hustle|my own (?:\w+ )?(?:shop|store|brand|bu[si]+ness|company)|small (?:\w+ )?bu[si]+ness|individuals?|just me|not (?:a |an )?(?:registered |register |real |proper |big )?(?:company|bu[si]+ness|corporation|corporate)|no company|self employed|sole (?:trader|proprietor)|solopreneur|someone like me|people like me|smaller (?:teams?|compan\w*|firms?|shops?)|small (?:teams?|firms?|startups?)|startups?|(?:huge|large|big|major) (?:corporations?|companies|enterprises|firms)|only (?:for |built for |aimed at |meant for |designed for )(?:big |large |huge |major )?(?:compan\w*|corporations?|enterprises?|corporates?|teams))\b/.test(q)&&/\b(?:use|join|for me|help|eligible|only|can i|could i|would|anything|guide|work with|even (?:though|tho|if)|still|too|as well|fall under|welcome|accept|take on)\b/.test(q)&&(brand==='shift'||/\b(?:ai|branding|consult\w*|guide|training|shift|service)\b/.test(q))&&!/\b(?:korean|kids?|child|topik)\b/.test(q))return from(['shift-audience']);
  if(/\b(?:messy process|whole process|the process|behind the scenes|giving away|show your work|publish(?:ing)? (?:the|your) (?:process|work|method|failures)|went wrong along the way|realistic examples|only the polished)\b/.test(q))return from(['shift-publicity','shift-making']);
  if(/\b(?:engagement|kickoff|kick off|handover|hand over|end to end|start to finish|from start|how (?:does|would|will) (?:a|the) (?:project|engagement) (?:run|go|unfold|work)|what happens (?:after|once|when) we (?:sign|start))\b/.test(q)&&(brand==='shift'||/\b(?:consult\w*|training|project|company|team|staff)\b/.test(q)))return from(['shift-delivery']);
  if(/\b(?:failures?|flopped|flops|mistakes|what went wrong|wins)\b/.test(q)&&(brand==='shift'||/\b(?:post|share|show|publish)\b/.test(q)))return from(['shift-publicity']);
  if(/\bprompts?\b/.test(q)&&/\b(?:mongle|animate|examples?|used|guide|copy|reuse|re use|use|client|own work|adapt|take|those|these)\b/.test(q))return from(['shift-materials']);
  if(/\b(?:freelanc\w*|solo|one person|small business|for me too|only for (?:big )?compan\w*|individuals?)\b/.test(q)&&(brand==='shift'||named.includes('shift')))return from(['shift-audience']);
  if(/\b(?:walk away with|take away|takeaways?|deliverables?|what do (?:we|i) get|what (?:does|will) (?:my|our) team get|source files|editable (?:files|versions?)|original files|final version|leave with|end up with|piece of paper|at the end of (?:the|it|the year)|when the year is over|after the (?:year|program|course))\b/.test(q))return from([brand==='lab'||/\b(?:year|program|course|admissions?|university|paper)\b/.test(q)&&brand!=='shift'?'lab-year':'shift-takeaway']);
  if(previousIs(context,'shift-materials')&&/\b(?:other (?:image )?tools|same approach|work (?:in|with) other|only the one)\b/.test(q))return from(['shift-materials']);
  if(/\b(?:certificat\w*|accredit\w*|diploma)\b/.test(q)&&(brand==='shift'||/\b(?:staff|employees|team|course|training)\b/.test(q)))return from(['shift-education']);
  if(/\b(?:look like|process|how (?:does|would|will) (?:it|consulting|the training|a project) (?:work|run|go)|steps|what happens|start to finish|run|unfold)\b/.test(q)&&/\b(?:consult\w*|training|workshop|project|engagement)\b/.test(q))return from(['shift-delivery']);
  if(/\b(?:working with you|work with you|partner with you|partnership|collaborate with you)\b/.test(q)&&/\b(?:email|contact|reach|include|first step|start|write)\b/.test(q))return from(['guide-collaboration']);
  if(/\b(?:team|company|staff|employees|we)\b/.test(q)&&/\b(?:help|support|improve)\b/.test(q)&&/\b(?:work|results|workflow|ai|process)\b/.test(q)&&(brand==='shift'||/\bai\b/.test(q)))return from(['shift-services']);
  // PULSE.
  if((/\b(?:learn|study|improve|help)\w*\b.{0,30}\b(?:korean|language)\b/.test(q)||/\bkorean (?:will|would|get|gets|become|becomes) (?:be )?better\b|\bimprove my korean\b|\bhelp (?:my|with) korean\b|\bgood for (?:my )?korean\b|\bonly for relax\w*\b|\bjust (?:for )?relax\w*\b|\bonly (?:for )?(?:relaxing|background)\b|\b(?:vocabulary|grammar|hidden) lessons?\b|\bjust enjoy\b|\bonly for (?:fun|enjoyment)\b|\beducational\b|\bmeant to teach\b|\bteach me korean\b|\bmade for studying\b|\bmeant to be enjoyed\b|\bfor studying\b|\bstudy music\b/.test(q))&&/\b(?:music|lofi|songs?|radio|listen\w*|sleep|relax\w*|tracks?)\b/.test(q))return from(['pulse-not-study']);
  if(/\b(?:song|track|video)\b.{0,40}\b(?:called|title|name)\b|\bwhat s the song\b/.test(q))return from(['pulse-listening']);
  if(/\b(?:brand identity|only the ad|ad content)\b/.test(q)&&(brand==='pulse'||/\bad\b/.test(q)))return from(['pulse-advertising']);
  if(/\bip partnership\b|\blicen\w* (?:deal|partnership|agreement)\b|\bas (?:a |our |the )?mascot\b|\bcharacter licensing\b/.test(q)&&brand!=='shift')return from(['pulse-ip']);
  if(brand==='pulse'&&/\b(?:what kind of|what sort of|which) (?:music|videos?|content|songs)\b|\bput out\b|\bproper songs\b|\bambient\b/.test(q))return from(['pulse-listening']);
  if(/\b(?:ad spot|ads?|advert\w*|commercials?|campaigns?|tv spot|promo\w*|\d+ second spot|spots?|in (?:a|our|the) (?:video|ad|spot|campaign)|product placement|(?:our|my) (?:products?|brands?) (?:in|into|featured|placed|appear)|get (?:our|my) (?:products?|brands?) into|endorse\w*|sponsor\w*|brand deals?|feature (?:our|my|a) (?:products?|brands?)|promote (?:our|my) (?:products?|brands?)|branded content|paid partnerships?)\b/.test(q)&&/\b(?:mongle|kkamong|marin|characters?|friends|pulse|music|videos?|radio|stream|lofi)\b/.test(q)&&!/\b(?:use|play|allowed|licen)\w*\b.{0,30}\b(?:in|for) (?:my|our)\b/.test(q))return from(['pulse-advertising']);
  if(/(?:listen|\bradio\b|lofi|background music|play (?:music|while)|all day|24 ?7|24 hours)/.test(q)&&/music|pulse|radio|lofi|songs?|while (?:i )?(?:study|work)|all day|24/.test(q)&&!/\b(?:use|shop|store|cafe|caf|restaurant|business|commercial|allowed|permission|learn|improve)\b/.test(q))return from([/radio|lofi|all day|24/.test(q)?'pulse-radio':'pulse-listening']);
  // Original service routing.
  if(/\b(?:company|corporate) branding\b/.test(q))return from(['shift-services']);
  if(/examples of (?:your )?work|production examples|case studies/.test(q))return from([/\b(?:numbers|data|saved|hours|metrics|roi|proof|results)\b/.test(q)?'guide-evidence':'shift-making']);
  if(/commission|collaborat/.test(q))return from([brand==='pulse'?'pulse-collaboration':'guide-collaboration']);
  if(/(?:learn|study) korean/.test(q)&&!/how|online|level|textbook|class|cost|price|fee/.test(q))return from([/\b(?:never|beginner|from scratch|from zero|new to|no korean|start)\b/.test(q)?'lab-start':'lab-intro']);
  if(/online/.test(q)&&(/stud|learn|class/.test(q)))return from(['lab-adult']);
  if(/\b(?:adapt\w*|personali[sz]\w*|tailor\w*|customi[sz]\w*|individual\w*|each (?:student|learner)|different levels)\b/.test(q)&&/\b(?:class\w*|learn\w*|student\w*|lesson\w*|teach\w*|study\w*)\b/.test(q)&&(!brand||brand==='lab'||brand==='synk'))return from([/\b(?:game|app)\b/.test(q)?'lab-personalization':'lab-personal']);
  if(/(?:no|without|new to).*ai.*experience|no ai|ai beginner/.test(q))return from(['shift-start']);
  if(/(?:staff|employee|team|organization|company|companies).*(?:training|education)|(?:training|education).*(?:staff|employee|team|organization|company|companies)/.test(q))return from([/\bkorean\b/.test(q)?'lab-adult':'shift-services']);
  if(/\b(?:plan|planning)\b/.test(q)&&/\b(?:study|major|university|nursing|degree)\b/.test(q)&&(brand==='path'||named.includes('path')))return from(['path-personal']);
  if(/job preparation|studying in korea|study abroad|study in korea/.test(q))return from(['path-support']);
  if(/\b(?:hello|hi|hey)\b/.test(q)&&tokens(q).size<2)return from(['synk-choose']);
  const words=tokens(q);if(!words.size)return ['lab','shift','pulse','path'].includes(brand)?from([brand+'-intro']):unknown(brand);
  return retrieve(input,brand,named,context);
 }
 function previousIs(context,...ids){return (context.recordIds||[]).some(id=>ids.includes(id));}
 // Two separate questions in one message are answered together; a restricted part keeps the boundary.
 function combined(input,context,result){
  if(typeof input!=='string'||input.length>500||['restricted','invalid','courtesy','greeting','language'].includes(result.status))return result;
  // An explicit "not published" or off-topic ruling stands; only retrieval misses are retried by part.
  if(result.status==='unanswered'&&!result.retrieved)return result;
  let parts=input.split(/[?!]\s+|\.\s+|\n+|;\s*|,\s*and\s+|\s+(?:and also|also|plus)\s+|\s+and\s+(?=(?:can|could|do|does|is|are|will|would|who|what|how|where|when|am i|should)\b)/i).map(p=>p.trim()).filter(p=>normalize(p).length>3);
  if(parts.length<2||parts.length>3)return result;
  // A visitor's own situation in front of the question is context, not a second question.
  const asksP=p=>/\?|\b(?:how|what|when|where|who|why|which|can|could|do|does|did|is|are|will|would|should|may|might|any|tell me|wonder\w*|curious|possible|ok to|okay to|able to)\b/i.test(p);
  if(parts.some(asksP)&&parts.some(p=>!asksP(p)))parts=parts.filter(asksP);
  const strong=result.records?.length&&['matched','needs_confirmation'].includes(result.status)&&!result.retrieved;
  if(parts.length===1){
   if(strong)return result;
   const only=ruleAnswer(parts[0],context);
   return only.records.length&&['matched','needs_confirmation'].includes(only.status)?{...only,combined:true}:result;
  }
  const found=parts.map(p=>ruleAnswer(p,context));
  if(found.some(r=>r.status==='restricted'))return found.find(r=>r.status==='restricted');
  const answered=found.filter(r=>r.records.length&&['matched','needs_confirmation'].includes(r.status));
  if(!answered.length)return result;
  const base=result.records?.length&&['matched','needs_confirmation'].includes(result.status)?result:null;
  const ruleParts=answered.filter(r=>!r.retrieved).map(r=>r.records[0].id);
  const baseIds=base?base.records.map(r=>r.id):[];
  const ids=base?.retrieved&&ruleParts.length?[...new Set([...ruleParts,...baseIds,...answered.map(r=>r.records[0].id)])]:[...new Set([...baseIds,...answered.map(r=>r.records[0].id)])];
  if(base&&ids.length===base.records.length&&ids[0]===baseIds[0])return result;
  return {...from(ids,[base,...answered].some(r=>r?.status==='needs_confirmation')?'needs_confirmation':'matched'),combined:true};
 }
 function answer(input,context={}){
  const result=combined(input,context,ruleAnswer(input,context));
  if(result.records?.length&&['matched','needs_confirmation'].includes(result.status)){
   const focus={};for(const record of result.records){const i=retriever.focus(record,input);if(i>0)focus[record.id]=i;}
   if(Object.keys(focus).length)return {...result,focus};
  }
  return result;
 }
 return {answer,docs,records};
}
