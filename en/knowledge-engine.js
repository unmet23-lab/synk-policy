// English retrieval uses reviewed public passages only. Nothing is generated or sent to a service.
export const normalize=value=>String(value??'').normalize('NFKC').toLowerCase().replace(/[^a-z0-9가-힣\s]/g,' ').replace(/\s+/g,' ').trim();
const stop=new Set('a an the and or of for to in on at is are was be do does can could would should will i we you your me us it this that how what which when where who why about please tell explain more synk lab shift pulse path'.split(' '));
const tokens=value=>new Set(normalize(value).split(' ').filter(w=>w.length>1&&!stop.has(w)).map(w=>w.length>4?w.replace(/(?:ing|es|s)$/,''):w));
export function createKnowledgeEngine(data){
 if(!data||!Array.isArray(data.docs)||!Array.isArray(data.records))throw Error('Public information could not be loaded.');
 const docs=new Map(data.docs.map(d=>[d.id,d])),records=new Map(data.records.map(r=>[r.id,r]));
 if(records.size!==data.records.length||docs.size!==data.docs.length)throw Error('Duplicate public information.');
 for(const r of records.values())if(!docs.has(r.sourceId)||!r.answer?.trim()||!r.questionExamples?.length||!Array.isArray(r.keywords)||r.relatedIds?.some(id=>!records.has(id))||r.answer.split('\n\n').some(p=>!docs.get(r.sourceId).paragraphs.includes(p)))throw Error('Public source verification failed: '+r.id);
 const from=(ids,status='matched')=>{const selected=[...new Set(ids)].map(id=>records.get(id)).filter(Boolean).slice(0,3);return {status,records:selected,sourceIds:[...new Set(selected.map(r=>r.sourceId))],brand:selected.length===1?selected[0].brand:'synk',relatedIds:[...new Set(selected.flatMap(r=>r.relatedIds||[]))].filter(id=>!ids.includes(id)).slice(0,3)};};
 const unknown=brand=>({status:'unanswered',records:[],sourceIds:['guide'],brand:null,relatedIds:[brand&&records.has(brand+'-intro')?brand+'-intro':'synk-choose','guide-contact'],message:records.get('guide-unknown').answer});
 const exact=new Map();for(const r of records.values())for(const q of [r.title,...r.questionExamples,...(r.aliases||[])]){const key=normalize(q);if(!exact.has(key))exact.set(key,[]);exact.get(key).push(r.id);}
 const indexed=data.records.map(r=>({r,phrases:[r.title,...r.questionExamples,...r.keywords],words:tokens([r.title,...r.questionExamples,...r.keywords].join(' '))}));
 function answer(input,context={}){
  if(typeof input!=='string'||!input.trim()||input.length>500)return {...unknown(),status:'invalid',message:'Please keep your question within 500 characters.'};
  const q=normalize(input),brand=['lab','shift','pulse','path'].find(b=>new RegExp('\\b'+b+'\\b').test(q))||context.brand;
  if(/<\/?[a-z!]|onerror\s*=|javascript:/i.test(input))return unknown(brand);
  if(/password|api key|access token|secret key|system prompt|ignore.*(?:instruction|rule)|(?:private|internal|confidential).*(?:document|source code|contract|database|manual)/.test(q))return from(['guide-boundary'],'restricted');
  if(/(?:show|list|download|give|send|reveal).*(?:student|customer|client).*(?:record|grade|phone|address|contact|name)|(?:student|customer|client) list/.test(q))return from(['guide-personal'],'restricted');
  // Exact reviewed questions take precedence over broad topic words.
  if(exact.has(q)){const ids=exact.get(q);const local=ids.filter(id=>records.get(id).brand===brand);return from(local.length?local:ids);}
  if(/^(thanks|thank you|many thanks)$/.test(q))return {status:'courtesy',records:[],sourceIds:[],brand:null,relatedIds:['synk-choose'],message:records.get('guide-courtesy').answer};
  if(/^(more|tell me more|more details|explain more|go on)$/.test(q)&&context.recordIds?.length)return {...from(context.recordIds),expanded:true};
  if(/\b(?:weather|stock|share price|nvidia|bitcoin|football|recipe)\b/.test(q))return unknown(brand);
  if(/\b(?:price|priced|prices|pricing|cost|costs|fee|fees|refund|enrol|enroll|enrollment|enrolment|available now|start date)\b/.test(q))return from([brand==='lab'?'lab-availability':'guide-availability'],'needs_confirmation');
  if(/guarantee.*(?:job|admission|visa)|(?:job|admission|visa).*guarantee/.test(q))return from(['path-support'],'needs_confirmation');
  if(/\b(?:contact|email address|phone number|reach you|send an enquiry|send an inquiry)\b/.test(q))return from(['guide-contact']);
  if(/privacy|cookie|(?:save|store|retain|record).*(?:chat|conversation|question)/.test(q))return from(['guide-privacy']);
  const engines=['core','loom','vellum','trail','prism','temper','reed','strata'].filter(name=>new RegExp('\\b'+name+'\\b').test(q));
  if(engines.length&&(/\b(?:engine|atlas|work|does|explain|what is)\b/.test(q)||engines.includes(q))&&!/core (?:value|values|textbook|book|books)/.test(q))return from(engines.map(name=>'atlas-'+name));
  if(/\batlas\b/.test(q))return from(['synk-atlas']);
  if(/\blab\b/.test(q)&&/\bshift\b/.test(q)&&/differ|compare/.test(q))return from(['synk-brands']);
  if(/listen|\bradio\b/.test(q)&&/music|pulse|radio/.test(q))return from([/radio/.test(q)?'pulse-radio':'pulse-listening']);
  if(/\b(?:company|corporate) branding\b/.test(q))return from(['shift-services']);
  if(/examples of (?:your )?work|production examples|case studies/.test(q))return from(['shift-making']);
  if(/commission|collaborat/.test(q))return from([brand==='pulse'?'pulse-collaboration':'guide-collaboration']);
  if(/(?:learn|study) korean/.test(q)&&!/how|online|level|textbook|class/.test(q))return from(['lab-intro']);
  if(/online/.test(q)&&(/stud|learn|class/.test(q)))return from(['lab-adult']);
  if(/(?:no|without|new to).*ai.*experience|no ai|ai beginner/.test(q))return from(['shift-start']);
  if(/(?:staff|employee|team|organization|company).*(?:training|education)|(?:training|education).*(?:staff|employee|team|organization|company)/.test(q))return from(['shift-services']);
  if(/job preparation|studying in korea|study abroad|study in korea/.test(q))return from(['path-support']);
  if(/\b(?:hello|hi|hey)\b/.test(q)&&tokens(q).size<2)return from(['synk-choose']);
  const words=tokens(q);if(!words.size)return ['lab','shift','pulse','path'].includes(brand)?from([brand+'-intro']):unknown(brand);
  const ranked=indexed.map(({r,phrases,words:rw})=>{let hits=0;for(const word of words)if(rw.has(word))hits++;
   const overlap=hits/words.size,phrase=phrases.some(p=>{const n=normalize(p);return n.length>7&&q.includes(n);});
   return {r,hits,overlap,score:overlap*5+Math.min(hits,5)*.35+(phrase?2:0)+(r.brand===brand ? .25 : 0)};
  }).filter(v=>v.hits>0).sort((a,b)=>b.score-a.score);
  const first=ranked[0],second=ranked[1];
  if(first&&first.overlap>=.65&&(first.hits>=2||first.score>=7)&&(!second||first.score-second.score>=.4))return from([first.r.id]);
  if(first&&first.overlap>=.5&&first.hits>=2)return {...unknown(brand),status:'clarify',relatedIds:ranked.slice(0,3).map(v=>v.r.id),message:'Which of these topics would you like to explore? Select a question below.'};
  return unknown(brand);
 }
 return {answer,docs,records};
}
