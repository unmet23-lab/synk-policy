// SYNK PULSE 「시사실」 v12 · 2026-11-06 — /pulse/ · /en/pulse/ 두 쪽만 싣는다(build.mjs shell). 묶지 않고 그대로 싣는다(import 없음).
// ① 쇼릴: 화면 비율로 가로 · 세로 판을 골라 소리 없이 튼다. 움직임 줄이기면 싣지 않고 첫 그림만 둔다. 첫 화면을 벗어나면 멈춘다.
//    지금 나오는 작품 이름 · 번호 줄은 쇼릴 시각표(data-reel-data)로 맞추고, 화면 낭독기에는 번호 단추를 누를 때만 읽어 준다.
// ② 작품 영상: 포스터로 멈춰 두고 손을 올리거나 화면 가운데에 1초 머물면 재생, 손을 떼거나 화면을 벗어나면 멈추고 포스터로 돌아간다.
// ③ AI 모델 줄: 앞뒤 단추로 넘기고, 끝에 닿으면 그쪽 단추를 끈다.
// ④ 머리 막대: 검은 칸이 막대 밑에 있는 동안 어두운 유리, 의뢰 띠(#request)가 막대 밑에 닿으면 밝은 유리.
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ① 쇼릴 */
const hall = document.querySelector('[data-reel]');
const reel = hall?.querySelector('.pv-reel');
if (hall && reel) {
  let data = { total: 0, timeline: [], works: {} };
  try { data = JSON.parse(hall.querySelector('[data-reel-data]').textContent); } catch {}
  const tall = matchMedia('(max-aspect-ratio: 4/5)').matches;
  if (tall && reel.dataset.posterTall) reel.poster = reel.dataset.posterTall;
  const now = hall.querySelector('[data-now]'), live = hall.querySelector('[data-now-live]');
  const buttons = [...hall.querySelectorAll('[data-index] button')];
  let shown = data.timeline[0]?.work, visible = true, raf = 0;
  const segAt = t => { let cur = data.timeline[0]; for (const seg of data.timeline) if (t >= seg.at) cur = seg; return cur; };
  const paint = () => {
    const t = reel.currentTime, cur = segAt(t);
    if (cur && cur.work !== shown && data.works[cur.work]) {
      shown = cur.work;
      const w = data.works[shown];
      now.replaceChildren(Object.assign(document.createElement('strong'), { textContent: w.title }), Object.assign(document.createElement('span'), { textContent: w.sub }));
      now.classList.remove('swap'); void now.offsetWidth; now.classList.add('swap');
    }
    if (cur) {
      const i = data.timeline.indexOf(cur), end = (data.timeline[i + 1] || { at: data.total }).at;
      for (const b of buttons) {
        const on = b.dataset.work === shown;
        b.classList.toggle('on', on);
        b.querySelector('span').style.setProperty('--p', on ? Math.min(1, Math.max(0, (t - cur.at) / (end - cur.at))).toFixed(3) : '0');
      }
    }
  };
  const loop = () => { paint(); raf = visible && !reel.paused ? requestAnimationFrame(loop) : 0; };
  const start = () => { if (!raf) raf = requestAnimationFrame(loop); };
  if (!still) {
    reel.src = tall ? reel.dataset.tall : reel.dataset.wide;
    reel.muted = true;
    reel.play().catch(() => {});
    reel.addEventListener('play', start);
    // 첫 화면을 벗어나면 쇼릴을 멈춘다(돌아오면 다시)
    if ('IntersectionObserver' in window) new IntersectionObserver(es => {
      visible = es[0].isIntersecting;
      if (visible) { reel.play().catch(() => {}); start(); } else reel.pause();
    }, { threshold: 0.05 }).observe(hall);
  } else buttons.forEach(b => b.classList.toggle('on', b.dataset.work === shown));
  for (const b of buttons) b.addEventListener('click', () => {
    const w = data.works[b.dataset.work];
    if (still) { document.getElementById(b.dataset.target)?.scrollIntoView(); return; }
    const seg = data.timeline.find(x => x.work === b.dataset.work);
    if (seg) { reel.currentTime = seg.at + 0.05; reel.play().catch(() => {}); start(); }
    if (live && w) live.textContent = w.say || w.title;
  });
}

/* ② 작품 영상 */
const films = [...document.querySelectorAll('.pv-work video[data-src]')];
const play = v => { if (still) return; if (!v.getAttribute('src')) v.src = v.dataset.src; v.muted = true; v.play().catch(() => {}); v.closest('.pv-work')?.classList.add('playing'); };
const rest = v => { clearTimeout(v._t); v.closest('.pv-work')?.classList.remove('playing'); if (v.getAttribute('src') && !v.paused) { v.pause(); v.currentTime = 0; v.load(); } };
if (films.length && !still) {
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      for (const e of es) {
        const v = e.target;
        if (e.isIntersecting) { clearTimeout(v._t); v._t = setTimeout(() => play(v), 1000); } else rest(v);
      }
    }, { threshold: 0.7 });
    films.forEach(v => io.observe(v));
  }
  for (const v of films) {
    const box = v.parentElement;
    box.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') play(v); });
    box.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') rest(v); });
  }
}

/* ③ AI 모델 줄 */
const cast = document.querySelector('[data-cast]');
const go = [...document.querySelectorAll('[data-cast-go]')];
if (cast && go.length) {
  const sync = () => {
    const max = cast.scrollWidth - cast.clientWidth - 2;
    for (const b of go) b.disabled = Number(b.dataset.castGo) < 0 ? cast.scrollLeft <= 2 : cast.scrollLeft >= max;
  };
  for (const b of go) b.addEventListener('click', () => cast.scrollBy({ left: Number(b.dataset.castGo) * cast.clientWidth * 0.8, behavior: still ? 'auto' : 'smooth' }));
  cast.addEventListener('scroll', () => requestAnimationFrame(sync), { passive: true });
  addEventListener('resize', sync, { passive: true });
  sync();
}

/* ④ 머리 막대 */
const bar = document.querySelector('[data-bar]'), light = document.getElementById('request');
if (bar && light) {
  let ticking = false;
  const tone = () => { ticking = false; bar.classList.toggle('on-dark', light.getBoundingClientRect().top > 64); };
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(tone); } }, { passive: true });
  addEventListener('resize', tone, { passive: true });
  tone();
}
