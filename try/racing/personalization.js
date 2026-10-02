import { CAMPAIGN } from './campaign.js';
import { FINALES } from './finales.js';

// Authored practice tags, not official TOPIK grade assignments.
const SKILLS = [
  ['detail','detail','detail','detail','detail'],
  ['detail','detail','detail','detail','detail'],
  ['grammar','grammar','grammar','grammar','grammar'],
  ['reason','main','vocabulary','sequence','reason'],
  ['detail','detail','detail','detail','detail'],
  ['detail','detail','negation','detail','detail'],
  ['detail','negation','main','detail','detail'],
  ['main','main','negation','detail','main'],
  ['detail','detail','detail','detail','negation'],
  ['detail','detail','detail','detail','detail'],
  ['reason','negation','negation','sequence','negation'],
  ['condition','detail','condition','condition','detail']
];
const indexed = new Map(CAMPAIGN.flatMap((stage,i)=>stage.items.map((item,j)=>[
  item.id,{stage,item,skillId:`ko.${item.mode==='reading'?'reading':'listening'}.${SKILLS[i][j]}`}
])));

// Finale questions retain their real input modality. They are assessable when
// independently answered, but never recycled into personalized practice before
// a learner reaches the chapter finale's new situations.
const FINALE_SKILLS = [
  ['detail','detail','detail','detail','detail'],
  ['grammar','grammar','reason','grammar','detail'],
  ['detail','detail','detail','detail','detail'],
  ['detail','detail','main','detail','negation'],
  ['condition','detail','negation','detail','detail'],
  ['reason','condition','negation','condition','sequence']
];
FINALES.forEach((stage,i)=>stage.items.forEach((item,j)=>indexed.set(item.id,{
  stage,item,skillId:`ko.${item.mode==='reading'?'reading':'listening'}.${FINALE_SKILLS[i][j]}`
})));

export function racingItem(item){
  const found=indexed.get(item.id),reading=item.mode==='reading';
  const itemKey=`korean-racing:${item.id||item.answer}:v1`;
  return {id:item.id||item.answer,itemKey,familyKey:itemKey,
    skillId:found?.skillId||'ko.listening.word',difficulty:found?Math.min(3,Math.ceil(found.stage.chapter/2)):1,
    modality:reading?'reading':'listening',responseFormat:'single-choice',audioRequired:!reading,confounded:false,
    conceptIds:!found&&/^w\d{4}$/.test(item.answer||'')?[`ko.word.${item.answer}`]:[]};
}

export const RACING_CANDIDATES = CAMPAIGN.flatMap(stage=>stage.items.map(item=>{
  const meta=racingItem(item);
  return {id:item.id,itemKey:meta.itemKey,skillIds:[meta.skillId],difficulty:meta.difficulty,
    modality:meta.modality,responseFormat:meta.responseFormat,label:`${stage.title} · ${item.prompt}`,item};
}));

export function personalizedStage(coach,{audioAvailable=true,modality=null}={}){
  const candidates=modality?RACING_CANDIDATES.filter(c=>c.modality===modality):RACING_CANDIDATES;
  const chosen=[],excluded=[];let reason='';
  for(let i=0;i<5;i++){
    const recommendation=coach.recommend(candidates,{audioAvailable,excludeIds:excluded});
    if(recommendation.status!=='ready'||!recommendation.selected)break;
    if(!reason)reason=recommendation.reason;
    chosen.push(recommendation.selected.item);excluded.push(recommendation.selected.id);
  }
  if(!chosen.length)return null;
  return {reason,stage:{id:'personalized',title:'나에게 맞는 5문항',campaign:true,review:true,personalized:true,
    chapter:1,level:1,scene:'bloom',mode:'mixed',skill:'기록에 맞춘 듣기·읽기',words:[],items:chosen}};
}
