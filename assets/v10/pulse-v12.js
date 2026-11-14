// SYNK PULSE 「시사실」 v12 · 2026-11-06 — /pulse/ · /en/pulse/ 두 쪽만 싣는다(build.mjs shell). 묶지 않고 그대로 싣는다(import 없음).
// ① 쇼릴: 화면 비율로 가로 · 세로 판을 골라 소리 없이 튼다(비율이 바뀌면 다시 고른다). 움직임 줄이기면 싣지 않고 첫 그림만 둔다. 첫 화면을 벗어나면 멈춘다.
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
  const tallMq = matchMedia('(max-aspect-ratio: 4/5)'), posterWide = reel.getAttribute('poster');
  const now = hall.querySelector('[data-now]'), live = hall.querySelector('[data-now-live]');
  const buttons = [...hall.querySelectorAll('[data-index] button')];
  let shown = data.timeline[0]?.work, visible = true, raf = 0, hold = null, swap = 0;
  const segAt = t => { let cur = data.timeline[0]; for (const seg of data.timeline) if (t >= seg.at) cur = seg; return cur; };
  // 작품 이름 줄: 「…」로 묶인 작품 이름은 한 덩이로 둔다 — 칸이 좁아 줄이 꺾일 때 회사 이름 뒤에서 꺾인다(작품 이름 가운데가 아니라).
  const nameLine = w => {
    const strong = document.createElement('strong'), at = w.title.indexOf('「');
    if (at > 0) strong.append(w.title.slice(0, at), Object.assign(document.createElement('span'), { textContent: w.title.slice(at) }));
    else strong.textContent = w.title;
    return [strong, Object.assign(document.createElement('span'), { textContent: w.sub })];
  };
  if (now && data.works[shown]) now.replaceChildren(...nameLine(data.works[shown]));
  const paint = () => {
    const t = hold ?? reel.currentTime, cur = segAt(t);
    if (cur && cur.work !== shown && data.works[cur.work]) {
      shown = cur.work;
      now.replaceChildren(...nameLine(data.works[shown]));
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
  // 쇼릴 판(가로 · 세로)은 화면 비율(4:5)로 고른다. 기기를 돌리거나 창 비율이 그 선을 넘나들면 다시 고른다 — 첫 화면 배치가 같은 선으로 갈리고(pulse-v12.css ①-1 · ①-2 · ①-3),
  // 배치마다 「글은 얼굴 줄 아래」를 그 판에서 쟀다. 두 판은 시각표가 같아 보던 자리에서 잇는다. 새 판이 그 자리로 갈 때까지는 영상 시각이 0이라,
  // 작품 줄 · 번호 줄은 보던 시각(hold)으로 그린다(첫 작품으로 깜빡이지 않게). 그 사이 번호 단추를 누르면 hold가 누른 작품의 시각으로 바뀌고, 새 판은 그때의 hold로 간다.
  // hold는 새 판의 영상 시각이 그 자리 가까이(0.5초 안) 왔을 때 푼다 — seeked가 와도 시각이 아직 0으로 읽히는 브라우저가 있어 seeked · timeupdate마다 시각을 본다.
  // 그 사건이 오지 않는 브라우저를 받쳐 자리를 넣은 4초 뒤에도 푼다. 판을 연달아 바꾸면 마지막 것만 푼다(swap).
  const pick = () => {
    const tall = tallMq.matches, poster = tall && reel.dataset.posterTall ? reel.dataset.posterTall : posterWide;
    if (poster && reel.getAttribute('poster') !== poster) reel.poster = poster;
    if (still) return;
    const src = tall ? reel.dataset.tall : reel.dataset.wide;
    if (!src || reel.getAttribute('src') === src) return;
    const at = hold ?? reel.currentTime;
    reel.src = src;
    reel.muted = true;
    if (at > 0) {
      hold = at;
      const mine = ++swap;
      const free = () => { if (swap === mine) hold = null; reel.removeEventListener('seeked', reach); reel.removeEventListener('timeupdate', reach); };
      const reach = () => { if (swap !== mine || hold == null || Math.abs(reel.currentTime - hold) < 0.5) free(); };
      reel.addEventListener('loadedmetadata', () => { reel.currentTime = hold ?? at; reel.addEventListener('seeked', reach); reel.addEventListener('timeupdate', reach); setTimeout(free, 4000); }, { once: true });
      reel.addEventListener('error', free, { once: true });
    }
    if (visible) reel.play().catch(() => {});
  };
  pick();
  if (tallMq.addEventListener) tallMq.addEventListener('change', pick); else tallMq.addListener?.(pick);
  if (!still) {
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
    if (seg) { if (hold != null) hold = seg.at + 0.05; reel.currentTime = seg.at + 0.05; reel.play().catch(() => {}); start(); }
    if (live && w) live.textContent = w.say || w.title;
  });
}

/* ② 작품 영상 */
// 11-09: 「더 많은 작품」 목록(.pv-tile)도 같다. 넓은 화면은 한 줄에 둘 · 셋이 함께 보여, 손이 있는 화면에서는 손을 올린 한 편만 튼다(가운데 1초 규칙은 손이 없는 화면에서만).
const films = [...document.querySelectorAll('.pv-work video[data-src], .pv-tile video[data-src]')];
const hover = matchMedia('(hover: hover) and (pointer: fine)').matches;
const card = v => v.closest('.pv-work, .pv-tile');
const going = v => !!v.getAttribute('src') && !v.paused;
const play = v => { if (still) return; if (!v.getAttribute('src')) v.src = v.dataset.src; v.muted = true; v.play().catch(() => {}); card(v)?.classList.add('playing'); };
const rest = v => { card(v)?.classList.remove('playing'); if (going(v)) { v.pause(); v.currentTime = 0; v.load(); } };
if (films.length && !still) {
  // 저절로 도는 것은 어느 화면이든 한 번에 한 편이다(큰 모니터 · 세로 작품 줄에서 여럿이 함께 보여도) — 보이는 칸 가운데 앞 번호가 1초 뒤 돌고,
  // 그 편이 화면을 나가면 아직 보이는 다음 칸이 1초 뒤 돈다. 고른 칸이 그대로면 다른 칸이 드나들어도 1초를 다시 세지 않는다.
  // 손 있는 화면의 목록 칸은 손을 올린 칸만 돌고 이 차례에 들지 않는다(목록에 손을 올려도 도는 큰 줄은 멈추지 않는다).
  const pool = films.filter(v => !(hover && v.closest('.pv-tile')));
  const inView = new Set();
  let turn = 0, waiting = null;
  const hold = () => { clearTimeout(turn); waiting = null; };
  const next = () => {
    if (pool.some(going)) { hold(); return; }
    const v = pool.find(x => inView.has(x)) || null;
    if (v === waiting) return;
    hold(); waiting = v;
    if (v) turn = setTimeout(() => { waiting = null; play(v); }, 1000);
  };
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      for (const e of es) {
        const v = e.target;
        if (!e.isIntersecting) { inView.delete(v); rest(v); }
        else inView.add(v);
      }
      next();
    }, { threshold: 0.7 });
    pool.forEach(v => io.observe(v));
  }
  // 차례에 드는 칸에 손을 올리면 그 칸이 차례를 넘겨받고, 손을 떼도 화면에 있으면 그대로 돈다.
  for (const v of films) {
    const box = v.parentElement, inTurn = pool.includes(v);
    box.addEventListener('pointerenter', e => {
      if (e.pointerType !== 'mouse') return;
      if (inTurn) { hold(); pool.forEach(x => { if (x !== v) rest(x); }); }
      play(v);
    });
    box.addEventListener('pointerleave', e => {
      if (e.pointerType !== 'mouse' || (inTurn && inView.has(v))) return;
      rest(v); next();
    });
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

/* ③-2 더 많은 작품 줄: 옆으로 넘길 것이 있을 때(휴대폰)만 키보드로 닿게 한다 */
const rows = document.querySelector('[data-rows]');
if (rows) {
  const reach = () => { if (rows.scrollWidth > rows.clientWidth + 2) rows.tabIndex = 0; else rows.removeAttribute('tabindex'); };
  addEventListener('resize', reach, { passive: true });
  reach();
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
