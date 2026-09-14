import {experience} from './data.js';

const main = document.querySelector('#experience');
const notice = document.querySelector('#notice');
const dialog = document.querySelector('#restart-dialog');
const state = {stage: 'story', guide: null, strategy: null, draft: '', original: '', bookmark: '인사'};
const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const picture = (file, alt, className = 'scene-image', loading = 'lazy') => `<img class="${className}" src="./assets/${file}.webp" alt="${escape(alt)}" loading="${loading}" width="1536" height="1024">`;
const person = () => experience.people.find(item => item.name === state.guide);
const strategy = () => person()?.scene.전략.find(item => item.option_id === state.strategy);
const room = () => `<figure class="room" aria-label="안경과 작은 콧수염이 있는 펠트 교수님의 연구실"><img src="./assets/research.webp" width="1672" height="941" alt="따뜻한 불빛 아래, 교수님이 책상에서 편지를 기다려요." fetchpriority="high"><img class="blink left" src="./assets/research-blink.webp" width="1672" height="941" alt="" aria-hidden="true"><img class="blink right" src="./assets/research-blink.webp" width="1672" height="941" alt="" aria-hidden="true"></figure>`;
const speech = (title, paragraphs) => `<div class="professor-speech"><span class="small-label">${escape(title)}</span>${paragraphs.map(text => `<p>${escape(text)}</p>`).join('')}</div>`;
const steps = () => `<ol class="steps" aria-label="편지 체험 순서">${[['story','상황과 말투'],['write','내 말로 쓰기'],['reply','답장 예시']].map(([id,label]) => `<li${state.stage===id?' aria-current="step"':''}>${label}</li>`).join('')}</ol>`;
const intro = () => `<div class="intro"><div><span class="eyebrow">오늘의 이야기 · 교수님 멘탈 구하기</span><h1 tabindex="-1">${state.stage==='story'?'아직 도착하지 않은 편지':state.stage==='write'?'이제, 내 말로 전해 볼까요.':'내 말로 남긴 한 통의 편지.'}</h1><p class="subtitle">${state.stage==='story'?'상황을 읽고, 말하는 방법을 골라 교수님께 편지를 써 보세요.':state.stage==='write'?'예시를 참고해도 좋아요. 내 상황과 마음은 내 문장으로 써 보세요.':'쓴 글을 그대로 남겼어요. 한 번 더 읽고, 다음에 전할 말도 생각해 보세요.'}</p></div><span class="experience-label">가상 상황 · 한국어 편지 체험</span></div>${steps()}`;
const tone = value => `<div class="tone-example"><h4>말투 예시</h4><p class="instruction">말투를 참고하고, 상황에 맞게 내 방식대로 직접 써 보세요.</p><span class="small-label">교수님께 쓰는 문장</span><blockquote>${escape(value.예문)}</blockquote></div>`;
const guides = () => `<section class="guide-section" aria-labelledby="guide-title"><div class="section-heading"><h2 id="guide-title">누구와 함께 편지를 써볼까요?</h2><p>함께할 친구를 고르면 내 상황과 세 가지 방법을 볼 수 있어요.</p></div><div class="guides" role="group" aria-label="함께할 친구">${experience.people.map(item=>`<button type="button" class="guide" data-guide="${item.name}" aria-pressed="${state.guide===item.name}"><img src="./assets/${item.id}.webp" width="1024" height="1024" alt=""><span><strong>${item.name}</strong><span class="guide-note">${state.guide===item.name?'함께하는 친구':{몽글:'같이 생각해 보자!',까몽:'이 몸이 도와주지.',마린:'상황 확인. …함께.'}[item.name]}</span></span></button>`).join('')}</div></section>`;
function story() {
  const friend = person();
  let html = `<div class="professor-row">${room()}${speech('교수님의 생각',friend?.scene.교수.대사||experience.professorIntro)}</div>${guides()}`;
  if (!friend) return html;
  const scene = friend.scene;
  html += `<section class="situation" aria-labelledby="situation-title"><h2 id="situation-title" tabindex="-1">지금 내 상황</h2><div class="situation-row">${picture(friend.id+'-sick',friend.name+'이 아파서 쉬며 아직 내지 못한 과제를 걱정하고 있어요.')}<div class="situation-copy"><p>${escape(scene.원문.질문)}</p><dl class="clues">${scene.단서.map(item=>`<div><dt>${escape(item.이름)}</dt><dd>${escape(item.값)}</dd></div>`).join('')}</dl><span class="small-label">오늘 쓸 편지</span><div class="mission">${escape(scene.원문.지시문)}</div></div></div><div class="friend-line"><span class="small-label">${friend.name}의 한마디</span><p>${escape(scene.친구.대사.join(' '))}</p></div></section>`;
  html += `<section class="strategies-section" aria-labelledby="strategy-title"><div class="section-heading"><h2 id="strategy-title">어떻게 말씀드릴까요?</h2><p>아래에서 말씀드릴 방법을 골라 보세요. 누르면 예시 문장을 볼 수 있어요.</p></div><div class="strategies">${scene.전략.map(item=>`<button type="button" class="strategy" data-strategy="${escape(item.option_id)}" aria-pressed="${state.strategy===item.option_id}">${picture(friend.strategies[item.option_id],friend.name+'이 '+item.소품+(item.소품==='편지 봉투'?'를':'을')+' 보며 편지를 준비해요.')}<h3>${escape(item.제목)}</h3><p>${escape(item.설명)}</p><span class="selection-label">${state.strategy===item.option_id?'지금 살펴보는 방법':'눌러서 살펴보기'}</span></button>`).join('')}</div></section>`;
  const selected = strategy();
  if (selected) html += `<section class="selection" aria-labelledby="selection-title"><span class="small-label">내가 고른 방법</span><h3 id="selection-title" tabindex="-1">${escape(selected.제목)}</h3><div class="selected-scene">${picture(friend.strategies[selected.option_id],friend.name+'이 선택한 방법으로 편지를 준비해요.')}<div class="friend-line"><span class="small-label">${friend.name}</span><p>${escape(selected.미리보기)}</p></div></div>${tone(selected)}<div class="actions"><button type="button" class="primary" data-action="write">이 방법으로 편지 쓰기 <span aria-hidden="true">→</span></button><p class="action-note">다음 화면에서 직접 써요.</p></div></section>`;
  return html;
}
function writing() {
  const friend = person(), selected = strategy();
  return `<div class="writing-layout"><form class="writing-card" id="letter-form"><div class="recipient">${room()}<div><span class="small-label">받는 사람</span><strong>교수님</strong></div></div><label for="letter-body">교수님께 쓸 편지</label><textarea id="letter-body" name="letter" maxlength="6000" placeholder="첫 인사부터 천천히 써 보세요." aria-describedby="writing-note writing-error" spellcheck="false">${escape(state.draft)}</textarea><p class="error" id="writing-error" role="alert"></p><button type="submit" class="primary">다 썼어요. 답장 예시 보기 <span aria-hidden="true">→</span></button><p class="action-note" id="writing-note">가상 상황에 맞춰 써 보세요. 실제 이름이나 연락처는 필요 없어요. 글은 외부로 보내지지 않습니다.</p></form><aside class="writing-guide" aria-label="선택한 친구의 편지 안내">${picture(friend.strategies[selected.option_id],friend.name+'이 편지 쓰기를 도와줘요.')}<h2>${escape(selected.제목)}</h2><div class="friend-line"><span class="small-label">${friend.name}</span><p>${escape(selected.미리보기)}</p></div><div class="bookmarks" role="group" aria-label="생각을 돕는 책갈피">${experience.steps.map(label=>`<button type="button" data-bookmark="${label}" aria-pressed="${state.bookmark===label}">${label}</button>`).join('')}</div><p class="bookmark-hint" id="bookmark-hint" aria-live="polite">${escape(friend.bookmarks[state.bookmark])}</p><details><summary>말투 예시 다시 보기</summary>${tone(selected)}</details><p class="reminder">${escape(friend.scene.원문.지시문)}<br>책갈피는 생각을 돕는 안내예요. 문법을 채점하지 않습니다.</p></aside></div><div class="actions"><button type="button" class="quiet" data-action="story">← 말하는 방법 다시 살펴보기</button></div>`;
}
function reply() {
  return `<div class="reply-intro"><span class="small-label">여기까지, 직접 써봤어요.</span><h2>내 마음이 잘 담겼나요?</h2><p>원문을 바꾸지 않았어요. 다듬고 싶은 말이 있으면 다시 써볼 수 있어요.</p></div><div class="reply-layout"><section class="your-letter"><span class="small-label">내가 쓴 그대로</span><h3>교수님께</h3><pre class="letter-original">${escape(state.original)}</pre><div class="actions"><button type="button" data-action="edit">다시 다듬기</button><button type="button" class="quiet" data-action="download">내 편지 내려받기</button></div></section><section class="sample-reply" aria-label="교수님의 반응 예시">${room()}${speech('교수님의 반응 · 체험용 예시',['사정을 말하는 첫마디가 쉽지는 않지. 필요한 시간과 앞으로의 계획도 함께 전해 주면 좋겠구나.','천천히 다시 읽어 보렴. 네 마음이 잘 닿을 말을 찾아보자꾸나.'])}<p class="sample-note">미리 준비한 반응 예시예요. 쓴 글을 읽고 평가한 답장이나 실제 교수님의 답장이 아닙니다.</p></section></div><figure class="workshop"><img src="./assets/letter-studio.webp" width="1672" height="941" loading="lazy" alt="몽글, 까몽, 마린이 함께 편지를 준비하는 따뜻한 펠트 작업실."><figcaption>어려운 첫마디도, 세 친구와 함께.</figcaption></figure><div class="actions"><button type="button" class="primary" data-action="restart">다른 친구와 다시 해보기</button><a class="quiet" href="/#lab">SYNK LAB 돌아보기 ↗</a></div>`;
}

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
function render(focusSelector) {
  stopBlink();
  main.innerHTML=intro()+(state.stage==='story'?story():state.stage==='write'?writing():reply());
  observeRooms();
  if (focusSelector) {
    const element=main.querySelector(focusSelector);
    element?.focus({preventScroll:true});
    element?.scrollIntoView({block:'start',behavior:'instant'});
  }
}
function reset() {
  Object.assign(state,{stage:'story',guide:null,strategy:null,draft:'',original:'',bookmark:'인사'});
  render('h1');
}
main.addEventListener('click',event=>{
  const button=event.target.closest('button');
  if (!button) return;
  if (button.dataset.guide) {state.guide=button.dataset.guide;state.strategy=null;render('#situation-title');return;}
  if (button.dataset.strategy) {state.strategy=button.dataset.strategy;render('#selection-title');return;}
  if (button.dataset.bookmark) {
    state.bookmark=button.dataset.bookmark;
    main.querySelectorAll('[data-bookmark]').forEach(element=>element.setAttribute('aria-pressed',String(element===button)));
    main.querySelector('#bookmark-hint').textContent=person().bookmarks[state.bookmark];
    return;
  }
  const action=button.dataset.action;
  if (action==='write'||action==='edit') {state.stage='write';render('h1');}
  if (action==='story') {state.stage='story';render('#strategy-title');}
  if (action==='restart') {if (state.draft) dialog.showModal();else reset();}
  if (action==='download') {
    const blob=new Blob(['교수님께\n\n'+state.original],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='내가-쓴-편지.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    notice.textContent='내가 쓴 편지를 파일로 내려받았어요.';
  }
});
main.addEventListener('input',event=>{if(event.target.id==='letter-body'){state.draft=event.target.value;main.querySelector('#writing-error').textContent='';}});
main.addEventListener('submit',event=>{
  event.preventDefault();
  if (event.target.id!=='letter-form') return;
  state.draft=main.querySelector('#letter-body').value;
  if (!state.draft.trim()) {main.querySelector('#writing-error').textContent='먼저 교수님께 전할 말을 써 주세요.';main.querySelector('#letter-body').focus();return;}
  state.original=state.draft;state.stage='reply';render('h1');
});
document.querySelector('#restart-cancel').addEventListener('click',()=>dialog.close());
document.querySelector('#restart-confirm').addEventListener('click',()=>{dialog.close();reset();});
document.addEventListener('visibilitychange',()=>document.hidden?stopBlink():startBlink());
reduced.addEventListener('change',startBlink);
window.addEventListener('pagehide',()=>{stopBlink();blinkObserver?.disconnect();});
window.addEventListener('pageshow',observeRooms);
render();
