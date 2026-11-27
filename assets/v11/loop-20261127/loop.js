/* 한국 유학 다섯 쪽의 위쪽 순환 메뉴 「다섯 장면」(2026-11-27).
   처음 들어오면: 지금 쪽 창이 열려 있다가, 열린 창이 다음 창으로 차례로 옮겨 가며 아래 줄에 그곳의 한 줄이 뜬다.
   모임 다음은 다시 한국어 창이 열린다. 한 바퀴 돌아 지금 쪽 창이 다시 열리면 멈추고, 아래 줄은 다음 정거장 링크가 된다.
   같은 창(탭)에서 다른 정거장을 눌러 넘어오면 앞 쪽 창이 닫히고 이 쪽 창이 열리는 한 번만 움직인다. 쪽을 다시 열면 움직이지 않는다.
   움직임 줄이기(또는 주소의 ?still)면 처음부터 지금 쪽 창이 열려 있다. 메뉴가 화면에 안 보이는 채로 열리면 돌지 않는다. */
(() => {
  const nav = document.querySelector('nav.loop');
  if (!nav) return;
  const q = new URLSearchParams(location.search);
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches || q.has('still');
  const lis = [...nav.querySelectorAll('li')], N = lis.length, cur = +nav.dataset.cur;
  const say = nav.querySelector('.lp-say'), INVITE = say.innerHTML;
  const KEY = 'synk-loop';
  let mem = {};
  try { mem = JSON.parse(sessionStorage.getItem(KEY) || '{}') || {}; } catch (e) { /* 저장소가 막혀도 한 바퀴 돈다 */ }
  try { sessionStorage.setItem(KEY, JSON.stringify({ lap: 1, at: cur })); } catch (e) { /* 다음 쪽에서도 다시 한 바퀴 돈다 */ }

  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const E = k => 1 - (1 - k) ** 3;                 // 열고 닫기는 빨리 시작해 천천히 멈춘다
  const G = () => (matchMedia('(max-width:900px)').matches ? 1.9 : 2.5);

  // 일정: 시각마다 여는 창 · 닫는 창 · 아래 줄에 띄울 곳
  const ev = [], D = 560, STEP = 600;
  let first = cur, T = 0;
  if (!still && (q.has('lap') || !mem.lap)) {
    T = 450;
    let p = cur;
    for (let k = 1; k <= N; k++) { const n = (cur + k) % N; ev.push({ t: T, open: n, close: p, mark: k === N ? -1 : n }); T += STEP; p = n; }
    T += 200;
  } else if (!still && Number.isInteger(mem.at) && mem.at !== cur && mem.at >= 0 && mem.at < N) {
    first = mem.at;
    ev.push({ t: 300, open: cur, close: mem.at, mark: -1 });
    T = 300 + D + 100;
  }
  const END = T;

  function growAt(i, t) {
    const g = G();
    let e = null;
    for (const x of ev) if (x.t <= t && (x.open === i || x.close === i)) e = x;
    if (!e) return i === first ? g : 1;
    const k = E(clamp((t - e.t) / D));
    return e.open === i ? 1 + (g - 1) * k : g - (g - 1) * k;
  }
  function hereAt(t) { let h = -1; for (const x of ev) if (x.t + D * 0.35 <= t) h = x.mark; return h; }

  let shown = null, hover = -1, done = !ev.length, here = -1, lastT = 0;
  const peek = i => `<span class="lp-peek"><b>${lis[i].dataset.name}</b> ${lis[i].dataset.line}</span>`;
  function setSay(html) {
    if (html === shown) return;
    shown = html;
    if (still) { say.innerHTML = html; return; }
    say.classList.add('swap');
    setTimeout(() => { if (shown === html) { say.innerHTML = html; say.classList.remove('swap'); } }, 140);
  }
  const openOnly = i => lis.forEach((li, k) => li.classList.toggle('open', k === i));
  function draw(t) {
    if (done) {
      lis.forEach(li => { li.style.flexGrow = ''; });
      openOnly(hover >= 0 ? hover : cur);
      nav.classList.add('ready');
    } else {
      nav.classList.remove('ready');
      lis.forEach((li, i) => { li.classList.remove('open'); li.style.flexGrow = growAt(i, t).toFixed(4); });
    }
    here = done ? -1 : hereAt(t);
    lis.forEach((li, k) => li.classList.toggle('here', k === here && k !== cur));
    if (hover < 0) { if (done) setSay(INVITE); else if (here >= 0) setSay(peek(here)); }
  }

  let t0 = 0, raf = 0;
  // 도는 중에 사람이 창을 가리키면(마우스 · 키보드) 그 자리에서 돌기를 끝낸다 — 위에서는 다른 창이 열리고 아래 줄은 가리킨 곳을 말하던 어긋남(카본 A3)
  function stopTour() { if (done) return; cancelAnimationFrame(raf); raf = 0; done = true; draw(END); }
  function frame(nowT) {
    lastT = nowT - t0;
    if (lastT >= END) { done = true; draw(END); raf = 0; return; }
    draw(lastT);
    raf = requestAnimationFrame(frame);
  }
  function run() { if (raf || done) return; t0 = performance.now(); raf = requestAnimationFrame(frame); }
  draw(0);
  if (!done) {
    // 메뉴가 화면에 보일 때 한 번 돈다. 열 때 이미 화면 밖이면(아래로 내려 둔 채 다시 연 쪽) 돌지 않고 멈춘 모습으로 둔다
    const go = () => new IntersectionObserver((es, o) => {
      o.disconnect();
      if (es.some(e => e.isIntersecting)) setTimeout(run, 250);
      else { done = true; draw(END); }
    }, { threshold: 0.6 }).observe(nav);
    Promise.all([...nav.querySelectorAll('img')].map(im => (im.decode ? im.decode().catch(() => 0) : 0))).then(go, go);
  }

  // 마우스를 올리면 그 창이 넓어진다(잠깐 머물 때만 — 지나가는 마우스에 창이 흔들리지 않게). 줄에서 나가면 지금 쪽 창으로 돌아온다
  let intent = 0;
  lis.forEach((li, i) => {
    const a = li.querySelector('a');
    // 키보드로 닿을 때는 아래 줄을 바꾸지 않는다: 아래 줄의 「다음 …」 링크가 사라져 Tab이 그 링크를 건너뛰었다(카본 A2)
    const on = byKey => { hover = i; stopTour(); openOnly(i); if (!byKey) setSay(peek(i)); };
    a.addEventListener('pointerenter', e => { if (e.pointerType !== 'mouse') return; clearTimeout(intent); intent = setTimeout(() => on(false), 90); });
    a.addEventListener('focus', () => on(true));
    a.addEventListener('blur', () => { hover = -1; if (done) openOnly(cur); setSay(!done && here >= 0 ? peek(here) : INVITE); });
  });
  nav.querySelector('ol').addEventListener('pointerleave', e => {
    if (e.pointerType !== 'mouse') return;
    clearTimeout(intent); hover = -1; if (done) openOnly(cur); setSay(!done && here >= 0 ? peek(here) : INVITE);
  });
  addEventListener('resize', () => draw(done ? END : lastT));
  // 뒤로 가기로 되살아난 쪽(bfcache)은 스크립트가 다시 돌지 않아, 떠날 때 가리키던 창이 열린 채 남았다(카본 A4) — 지금 쪽으로 되돌리고 자리를 다시 적는다
  addEventListener('pageshow', e => {
    if (!e.persisted) return;
    clearTimeout(intent); hover = -1; stopTour(); openOnly(cur); setSay(INVITE);
    try { sessionStorage.setItem(KEY, JSON.stringify({ lap: 1, at: cur })); } catch (err) { /* 저장소가 막혀도 그대로 */ }
  });

  // 메뉴가 예전 줄보다 높아서, 창이 낮으면 쪽 머리 글이 메뉴 밑으로 내려가게 자리를 잰다(컴퓨터 폭만 — CSS가 쓴다)
  const room = () => { const h = nav.closest('.hero'); if (h) h.style.setProperty('--loop-room', Math.ceil(nav.offsetTop + nav.offsetHeight + 40) + 'px'); };
  room(); addEventListener('resize', room); if (document.fonts) document.fonts.ready.then(room);
})();
