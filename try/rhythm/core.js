export const LEVELS = {
  easy: {label:'편하게', step:1, window:.28, perfect:.115, great:.195, approach:3.5},
  normal: {label:'리드미컬', step:.5, window:.23, perfect:.085, great:.155, approach:2.9},
  hard: {label:'도전', step:.5, window:.20, perfect:.065, great:.125, approach:2.55},
};
const item=(category,prompt,question,options,answer,explanation,recall)=>({category,prompt,question,options,answer,explanation,recall});
export const TRACKS=[
  {id:0,title:'내일의 약속',subtitle:'일상 속 시간과 장소',bpm:112,bars:32,tag:'TOPIK I · 일상 표현',color:'#f36f63',key:0,questions:[
    item('시간 표현','오늘은 바빠서 내일 도서관에 갈 거예요.','언제 도서관에 가요?',['오늘','내일','어제','안 가요'],'내일','오늘은 바쁘고, 도서관에 가는 날은 내일이에요.',{prompt:'내일은 바빠서 오늘 도서관에 가요.',question:'언제 도서관에 가요?',options:['오늘','내일','어제','안 가요'],answer:'오늘'}),
    item('장소 표현','카페에서 친구를 기다리고 있어요.','지금 어디에 있어요?',['카페','학교','도서관','시장'],'카페','“카페에서”는 기다리는 장소를 알려줘요.',{prompt:'친구와 카페에 가기 전에 도서관에서 책을 빌리고 있어요.',question:'지금 어디에 있어요?',options:['카페','학교','도서관','시장'],answer:'도서관'}),
    item('문장 연결','아침에는 비가 왔지만 지금은 맑아요.','지금 날씨는 어때요?',['맑아요','비가 와요','눈이 와요','안개가 껴요'],'맑아요','“하지만” 뒤에서 지금의 다른 상황을 말하고 있어요.',{prompt:'아침에는 맑았지만 지금은 비가 와요.',question:'지금 날씨는 어때요?',options:['맑아요','비가 와요','눈이 와요','안개가 껴요'],answer:'비가 와요'}),
    item('대신 표현','저는 커피 대신 차를 주문했어요.','무엇을 주문했어요?',['차','커피','우유','주스'],'차','“커피 대신 차”는 커피를 고르지 않고 차를 골랐다는 뜻이에요.',{prompt:'차 대신 주스를 주문했어요.',question:'무엇을 주문했어요?',options:['차','커피','우유','주스'],answer:'주스'}),
    item('변경된 시간','회의가 두 시에서 세 시로 바뀌었어요.','회의는 몇 시에 시작해요?',['한 시','두 시','세 시','네 시'],'세 시','처음 시간은 두 시, 바뀐 시간은 세 시예요.',{prompt:'회의가 세 시에서 네 시로 바뀌었어요.',question:'회의는 몇 시에 시작해요?',options:['한 시','두 시','세 시','네 시'],answer:'네 시'}),
  ]},
  {id:1,title:'비가 와도',subtitle:'문장과 문장을 잇는 말',bpm:124,bars:32,tag:'TOPIK 준비 · 문장 연결',color:'#86aaf4',key:2,questions:[
    item('원인과 결과','비가 많이 왔어요. ___ 소풍을 취소했어요.','원인과 결과를 잇는 말은?',['그래서','하지만','또는','예를 들어'],'그래서','비가 온 것이 원인, 소풍을 취소한 것이 결과예요.',{prompt:'버스를 놓쳤어요. ___ 택시를 탔어요.',question:'원인과 결과를 잇는 말은?',options:['그래서','하지만','또는','예를 들어'],answer:'그래서'}),
    item('대조','이 가방은 비싸요. ___ 오래 쓸 수 있어요.','단점과 장점을 대비하는 말은?',['하지만','그래서','또는','즉'],'하지만','비싸다는 단점과 오래 쓴다는 장점을 대비하고 있어요.',{prompt:'이 집은 작아요. ___ 교통이 편리해요.',question:'단점과 장점을 대비하는 말은?',options:['하지만','그래서','또는','즉'],answer:'하지만'}),
    item('목적','친구를 만나___ 카페에 갔어요.','카페에 간 목적을 나타내려면?',['려고','지만','거나','면서'],'려고','“-려고”는 어떤 행동을 하는 목적을 나타내요.',{prompt:'한국어를 배우___ 학원에 등록했어요.',question:'등록한 목적을 나타내려면?',options:['려고','지만','거나','면서'],answer:'려고'}),
    item('진행 중인 행동','지금 음악을 듣고 있어요.','어떤 뜻이에요?',['지금 들어요','어제 들었어요','나중에 들어요','듣지 않아요'],'지금 들어요','“-고 있어요”는 지금 진행 중인 행동을 나타낼 수 있어요.',{prompt:'어제 음악을 들었어요.',question:'어떤 뜻이에요?',options:['지금 들어요','어제 들었어요','나중에 들어요','듣지 않아요'],answer:'어제 들었어요'}),
    item('이유','날씨가 추우니까 창문을 닫으세요.','창문을 닫으라고 한 이유는?',['추운 날씨','시끄러운 소리','많은 비','강한 햇빛'],'추운 날씨','“-으니까” 앞의 추운 날씨가 이유예요.',{prompt:'밖이 시끄러우니까 창문을 닫으세요.',question:'창문을 닫으라고 한 이유는?',options:['추운 날씨','시끄러운 소리','많은 비','강한 햇빛'],answer:'시끄러운 소리'}),
  ]},
  {id:2,title:'다른 말, 같은 마음',subtitle:'다르게 표현된 같은 뜻',bpm:128,bars:32,tag:'TOPIK II 준비 · 뜻 이해',color:'#ffe07a',key:-2,questions:[
    item('바꿔 말하기','이 식당은 예약해야 이용할 수 있어요.','같은 뜻을 고르세요.',['미리 신청해야 해요','언제든 갈 수 있어요','예약할 수 없어요','음식이 없어요'],'미리 신청해야 해요','예약은 이용하기 전에 자리를 미리 신청하는 거예요.',{prompt:'이 식당은 예약하지 않아도 이용할 수 있어요.',question:'같은 뜻을 고르세요.',options:['예약이 필요 없어요','미리 신청해야 해요','이용할 수 없어요','음식이 없어요'],answer:'예약이 필요 없어요'}),
    item('비교','상품의 가격이 지난해보다 올랐어요.','같은 뜻을 고르세요.',['더 비싸졌어요','더 싸졌어요','가격이 같아요','판매를 멈췄어요'],'더 비싸졌어요','가격이 오르면 이전보다 더 비싸져요.',{prompt:'상품의 가격이 지난해보다 내렸어요.',question:'같은 뜻을 고르세요.',options:['더 비싸졌어요','더 싸졌어요','가격이 같아요','판매를 멈췄어요'],answer:'더 싸졌어요'}),
    item('의견','직원들은 새로운 방법에 찬성했어요.','직원들의 생각은?',['방법에 동의해요','방법에 반대해요','방법을 몰라요','결정을 미뤄요'],'방법에 동의해요','찬성은 제안이나 의견에 동의한다는 뜻이에요.',{prompt:'직원들은 새로운 방법에 반대했어요.',question:'직원들의 생각은?',options:['방법에 동의해요','방법에 반대해요','방법을 몰라요','결정을 미뤄요'],answer:'방법에 반대해요'}),
    item('일정','일정을 변경하기 어려워요.','같은 뜻을 고르세요.',['날짜를 바꾸기 힘들어요','날짜를 바꿨어요','날짜를 몰라요','일정이 없어요'],'날짜를 바꾸기 힘들어요','변경은 바꾸는 것, 어렵다는 것은 하기 힘들다는 뜻이에요.',{prompt:'일정을 변경했어요.',question:'같은 뜻을 고르세요.',options:['날짜를 바꾸기 힘들어요','날짜를 바꿨어요','날짜를 몰라요','일정이 없어요'],answer:'날짜를 바꿨어요'}),
    item('생활 표현','교통이 편리한 곳으로 이사했어요.','같은 뜻을 고르세요.',['이동하기 좋은 곳으로 집을 옮겼어요','집에서만 지내요','교통이 불편해요','집을 고쳤어요'],'이동하기 좋은 곳으로 집을 옮겼어요','교통이 편리하면 이동하기 좋고, 이사는 사는 곳을 옮기는 일이에요.',{prompt:'교통이 불편한 곳에서 살고 있어요.',question:'같은 뜻을 고르세요.',options:['이동하기 어려운 곳에 살아요','이동하기 좋은 곳에 살아요','집을 고쳤어요','집을 옮겼어요'],answer:'이동하기 어려운 곳에 살아요'}),
  ]},
];

export function random(seed=1){let a=seed>>>0;return()=>{a+=0x6d2b79f5;let t=Math.imul(a^(a>>>15),1|a);t^=t+Math.imul(t^(t>>>7),61|t);return((t^(t>>>14))>>>0)/4294967296;};}
export function shuffle(array,rng){const out=[...array];for(let i=out.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}
export function timingQuality(delta,level){const d=Math.abs(delta);return d<=level.perfect?1:d<=level.great?.8:d<=level.window?.5:0;}
export function buildChart(track,levelName='easy',seed=1){
  const level=LEVELS[levelName],rng=random(seed),beat=60/track.bpm;
  const questions=track.questions.map((q,i)=>({...q,id:`q${i}`,beat:24+i*24,time:(24+i*24)*beat,showTime:(24+i*24-10)*beat,closeTime:(24+i*24)*beat+.65,options:shuffle(q.options,rng),intent:null,response:null,quality:0,state:'pending'}));
  const notes=[],occupied=[0,0,0,0];
  const patterns=[[0,1,2,3,2,1,0,3],[0,2,1,3,1,2,3,0],[3,2,0,1,2,3,1,0]];
  const pattern=patterns[Math.floor(rng()*patterns.length)];
  for(let b=4;b<126;b+=level.step){
    if(questions.some(q=>b>=q.beat-10&&b<=q.beat+2))continue;
    if(levelName==='normal'&&b%1!==0&&Math.floor(b)%4<2)continue;
    if(levelName==='hard'&&b%1!==0&&Math.floor(b)%8===7)continue;
    const idx=Math.floor(b/level.step),lane=(pattern[idx%8]+Math.floor(b/32))%4;
    const hold=b%8===0&&b>8&&b<119&&(levelName!=='easy'||b%16===0);
    const duration=hold?(levelName==='hard'?2:1.5)*beat:0;
    if(b*beat>occupied[lane]+.18){notes.push({id:`n${notes.length}`,beat:b,time:b*beat,lane,duration,endTime:b*beat+duration,state:'pending',quality:0});occupied[lane]=b*beat+duration;}
    if(levelName==='hard'&&b%8===4){const other=(lane+2)%4;if(b*beat>occupied[other]+.2){notes.push({id:`n${notes.length}`,beat:b,time:b*beat,lane:other,duration:0,endTime:b*beat,state:'pending',quality:0});occupied[other]=b*beat;}}
  }
  return {notes,questions,duration:track.bars*4*beat,beat,level};
}

export class RoundState{
  constructor(track,levelName='easy',seed=1){Object.assign(this,buildChart(track,levelName,seed));this.track=track;this.levelName=levelName;this.combo=0;this.maxCombo=0;this.score=0;this.earned=0;this.processed=0;this.possible=this.notes.reduce((n,x)=>n+(x.duration?2:1),0)+this.questions.length;this.events=[];}
  record(quality,type,lane){this.processed++;this.earned+=quality;this.score+=Math.round(quality*1000);if(quality>0){this.combo++;this.maxCombo=Math.max(this.maxCombo,this.combo);}else this.combo=0;const event={type,lane,quality,combo:this.combo};this.events.push(event);return event;}
  activeQuestion(time){return this.questions.find(q=>time>=q.showTime&&time<=q.closeTime+1.5);}
  input(lane,time){
    const q=this.questions.find(q=>q.state==='pending'&&time>=q.showTime&&time<=q.closeTime);
    if(q){
      q.intent=lane;
      if(time<q.time-this.level.window)return {type:'intent',lane,q};
      q.response=lane;q.quality=timingQuality(time-q.time,this.level);q.state='answered';
      const event=this.record(q.quality,'question',lane);return {...event,q,correct:q.options[lane]===q.answer};
    }
    // An answered gate remains exclusive: a chord cannot submit four answers.
    if(this.questions.some(x=>x.state!=='pending'&&time>=x.time-this.level.window&&time<=x.closeTime))return null;
    const note=this.notes.filter(n=>n.state==='pending'&&n.lane===lane&&Math.abs(n.time-time)<=this.level.window).sort((a,b)=>Math.abs(a.time-time)-Math.abs(b.time-time))[0];
    if(!note)return null;
    note.quality=timingQuality(time-note.time,this.level);note.state=note.duration?'holding':'hit';
    return {...this.record(note.quality,note.duration?'hold-start':'tap',lane),note};
  }
  release(lane,time){
    const note=this.notes.find(n=>n.state==='holding'&&n.lane===lane);if(!note)return null;
    const complete=time>=note.endTime-.10;note.state=complete?'hit':'broken';return {...this.record(complete?note.quality:0,complete?'hold-end':'hold-break',lane),note};
  }
  update(time,pressed=new Set()){
    const out=[];
    for(const n of this.notes){
      if(n.state==='pending'&&time>n.time+this.level.window){n.state='missed';out.push(this.record(0,'miss',n.lane));if(n.duration)out.push(this.record(0,'hold-miss',n.lane));}
      else if(n.state==='holding'&&time>=n.endTime){n.state=pressed.has(n.lane)?'hit':'broken';out.push({...this.record(n.state==='hit'?n.quality:0,n.state==='hit'?'hold-end':'hold-break',n.lane),note:n});}
    }
    for(const q of this.questions){if(q.state==='pending'&&time>q.closeTime){q.response=q.intent;q.state=q.intent===null?'unanswered':'answered';q.quality=0;out.push({...this.record(0,'question',q.response),q,correct:q.response!==null&&q.options[q.response]===q.answer});}}
    return out;
  }
  get accuracy(){return this.processed?this.earned/this.processed:0;}
  get correctCount(){return this.questions.filter(q=>q.response!==null&&q.options[q.response]===q.answer).length;}
  get answeredCount(){return this.questions.filter(q=>q.response!==null).length;}
}
