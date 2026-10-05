// LAB 게임 소개(2026-10-05): 카드를 누르면 그 게임의 실제 플레이 장면(5초, 소리 없음)과 설명을 한 창에서 보여 준다.
// 창의 글은 누른 카드에서 옮겨 온다. 영어 페이지는 카드가 이미 번역돼 있어 따로 둘 글이 없다(단추 이름은 표시에 있음).
// 움직임 줄이기에서는 저절로 재생하지 않고 「영상 재생」을 누를 때만 튼다. 창을 닫으면 내려받기도 멈춘다.
// 주소 #game-<id>로 들어오면 그 게임의 창을 연다.
const dialog = document.getElementById('game-dialog');
if (dialog && typeof dialog.showModal === 'function') {
  const cards = [...document.querySelectorAll('.game-card[data-game][data-video]')];
  const $ = (id) => dialog.querySelector('#' + id);
  const video = $('game-dialog-video'), toggle = dialog.querySelector('.game-dialog-toggle'), close = dialog.querySelector('.game-dialog-close');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let index = -1, opener = null;

  const playing = (on) => dialog.toggleAttribute('data-playing', on);
  video.addEventListener('playing', () => playing(true));
  video.addEventListener('pause', () => playing(false));
  const start = () => { const p = video.play(); if (p) p.catch(() => playing(false)); };   // 저절로 재생이 막히면 단추로 튼다

  function show(i) {
    index = (i + cards.length) % cards.length;
    const card = cards[index];
    $('game-dialog-kicker').textContent = card.querySelector('.game-card-kicker').textContent;
    $('game-dialog-title').textContent = card.querySelector('h4').textContent;
    $('game-dialog-text').textContent = card.querySelector('.game-card-body > p').textContent;
    $('game-dialog-facts').replaceChildren(...[...card.querySelectorAll('.game-facts li')].map((li) => li.cloneNode(true)));
    $('game-dialog-alt').textContent = card.querySelector('img').alt;
    playing(false);
    video.poster = card.dataset.poster;
    video.src = card.dataset.video;
    if (!still.matches) start();
    history.replaceState(null, '', '#game-' + card.dataset.game);
  }
  function open(i, from) {
    if (i < 0) return;
    opener = from || null;
    show(i);
    if (!dialog.open) dialog.showModal();
    close.focus();
  }

  dialog.addEventListener('close', () => {
    video.pause(); video.removeAttribute('src'); video.load();
    if (location.hash.startsWith('#game-')) history.replaceState(null, '', '#work');
    opener?.focus({ preventScroll: true });
  });
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-game-open]');
    if (trigger) { const card = trigger.closest('.game-card'); open(cards.indexOf(card), card.querySelector('.game-card-open')); return; }
    if (e.target === dialog) dialog.close();   // 창 바깥(흐린 배경)을 누르면 닫는다
  });
  close.addEventListener('click', () => dialog.close());
  for (const b of dialog.querySelectorAll('[data-step]')) b.addEventListener('click', () => show(index + Number(b.dataset.step)));
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault(); show(index + (e.key === 'ArrowRight' ? 1 : -1));
  });
  const flip = () => (video.paused ? start() : video.pause());
  toggle.addEventListener('click', flip);
  video.addEventListener('click', flip);

  const fromHash = () => { const id = /^#game-([a-z-]+)$/.exec(location.hash)?.[1]; const i = cards.findIndex((c) => c.dataset.game === id); if (i >= 0) open(i, cards[i].querySelector('.game-card-open')); };
  fromHash();
  addEventListener('hashchange', fromHash);
}
