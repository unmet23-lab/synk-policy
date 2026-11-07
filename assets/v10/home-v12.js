// SYNK 홈 「네 무대」 v12 · 2026-11-07 — / · /en/ 두 쪽의 사업 칸(#business)만. 시안: SYNK-appsscript docs/디자인/synk.im_리디자인_20261106/시안/home.html.
// 칸 넷(LAB 상황극 장면 · SHIFT 예약표 · PULSE 쇼릴 · PATH 서울 하루 동선)이 한 칸씩 차례로 움직이고 나머지는 첫 장면에 멈춘다. 칸 아래 선이 그 칸의 길이만큼 찬다.
// 넓은 화면: 손을 올리거나 칸에 닿으면 그 칸부터(그동안 멈춤), 떼면 4초 뒤 다음 칸. 1100px 아래: 옆으로 넘겨 가운데 온 칸이 상영(줄이 화면에 들어왔을 때만).
// 움직임 줄이기면 아무것도 돌리지 않는다(영상은 첫 장면, 예약표는 지금 시각에 맞춘 줄, 동선은 다 그린 하루). import 없이 그대로 싣는다.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const stages = $('[data-stages]');
if (stages) {
  const cells = [...stages.querySelectorAll('.hs')];

  // SHIFT 칸 — 서울 시각으로 지난 줄은 흐리게, 다음 줄은 켜고, 그날 안 도는 줄은 「오늘 없음」(SHIFT 쪽 shift-v12.js와 같은 규칙).
  const rowsEl = $('[data-rows]', stages), clock = $('[data-clock]', stages);
  const seoul = () => {
    const f = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', weekday: 'short', hourCycle: 'h23' }).formatToParts(new Date());
    const g = t => f.find(x => x.type === t).value;
    return { hm: g('hour') + ':' + g('minute'), day: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(g('weekday')) };
  };
  function tickBoard(scroll) {
    if (!rowsEl) return;
    const { hm, day } = seoul();
    if (clock) clock.textContent = hm;
    let next = -1;
    [...rowsEl.children].forEach((li, i) => {
      const days = li.dataset.days ? li.dataset.days.split(',').map(Number) : null, off = days && !days.includes(day);
      li.classList.toggle('is-off', !!off); li.classList.toggle('is-past', !off && li.dataset.at < hm);
      const isNext = next < 0 && !off && li.dataset.at >= hm; if (isNext) next = i; li.classList.toggle('is-next', isNext);
    });
    if (scroll) { const li = rowsEl.children[Math.max(0, (next < 0 ? rowsEl.children.length - 1 : next) - 2)]; rowsEl.style.transform = `translateY(${-li.offsetTop}px)`; }
  }
  tickBoard(false); setInterval(() => tickBoard(false), 20000);

  // PATH 칸 — 이름표 자리: 오른쪽 · 왼쪽 · 아래 · 위 가운데 칸 안에서 다른 이름표 · 아이콘과 가장 덜 겹치는 곳(PATH 쪽과 같은 규칙).
  const box = $('.hs-map', stages);
  const routes = box ? [...box.querySelectorAll('[data-route]')] : [];
  for (const r of routes) r._len = r.getTotalLength();
  function untangle() {
    if (!box) return;
    const m = box.getBoundingClientRect(), pins = [...box.querySelectorAll('.hp-pin')];
    if (!m.width) return;
    const icons = pins.map(p => ($('img', p) || $('.hp-mk', p)).getBoundingClientRect()), tags = [];
    const area = (r, b) => Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
    pins.forEach((p, i) => {
      let best = null;
      for (const side of ['is-left', 'is-right', 'is-down', 'is-up']) {
        p.classList.remove('is-left', 'is-right', 'is-down', 'is-up'); p.classList.add(side);
        const r = $('.hp-tag', p).getBoundingClientRect();
        const out = r.left < m.left + 4 || r.right > m.right - 4 || r.top < m.top + 4 || r.bottom > m.bottom - 60 ? 1e6 : 0;
        const cost = out + [...tags, ...icons.filter((_, k) => k !== i)].reduce((n, b) => n + area(r, b), 0);
        if (!best || cost < best.cost) best = { side, cost };
      }
      p.classList.remove('is-left', 'is-right', 'is-down', 'is-up'); p.classList.add(best.side);
      tags.push($('.hp-tag', p).getBoundingClientRect());
    });
  }
  untangle(); addEventListener('resize', untangle);
  // 상영 차례가 오면 동선을 출발지에서부터 다시 그린다(멈춰 있을 때는 다 그린 하루).
  const drawRoute = () => { for (const r of routes) { r.style.transition = 'none'; r.style.strokeDasharray = r._len; r.style.strokeDashoffset = r._len; r.getBoundingClientRect(); r.style.transition = 'stroke-dashoffset 2.6s cubic-bezier(.45,0,.2,1) .3s'; r.style.strokeDashoffset = 0; } };

  if (!reduce) {
    let active = -1, timer = 0, inView = false, held = false, centered = 0;
    const narrow = matchMedia('(max-width:1100px)');
    const load = v => { if (v && !v.src) v.src = v.dataset.src; };
    const count = $('[data-count]');
    function show(i) {
      cells.forEach((c, k) => {
        const on = k === i, v = $('video', c); c.classList.toggle('is-on', on);
        if (v) { if (on) { load(v); v.currentTime = 0; v.play().catch(() => {}); } else v.pause(); }
      });
      const c = cells[i]; c.style.setProperty('--dur', c.dataset.dur + 's');
      if (c.classList.contains('hs-shift')) tickBoard(true); else if (rowsEl) rowsEl.style.transform = '';
      if (c.classList.contains('hs-path')) drawRoute();
      if (count) count.textContent = String(i + 1).padStart(2, '0') + ' / ' + String(cells.length).padStart(2, '0');
      active = i;
    }
    const run = i => { clearTimeout(timer); show(i); if (!held) timer = setTimeout(() => run((i + 1) % cells.length), cells[i].dataset.dur * 1000); };
    const stop = () => { clearTimeout(timer); cells.forEach(c => { c.classList.remove('is-on'); $('video', c)?.pause(); }); };
    new IntersectionObserver(es => { for (const e of es) { inView = e.isIntersecting; if (!inView) stop(); else if (narrow.matches) { held = true; run(centered); } else { held = false; run(active < 0 ? 0 : active); } } }, { threshold: .35 }).observe(stages);
    const resume = () => { held = false; clearTimeout(timer); timer = setTimeout(() => run((active + 1) % cells.length), 4000); };
    cells.forEach((c, i) => {
      c.addEventListener('pointerenter', () => { if (narrow.matches || !inView) return; held = true; if (active !== i) run(i); else clearTimeout(timer); });
      c.addEventListener('pointerleave', () => { if (narrow.matches || !inView) return; resume(); });
      const f = $('.hs-frame', c);
      f.addEventListener('focus', () => { held = true; run(i); });
      f.addEventListener('blur', () => { if (!narrow.matches) resume(); });
    });
    const io = new IntersectionObserver(es => { if (!narrow.matches) return; for (const e of es) if (e.isIntersecting) { centered = cells.indexOf(e.target); if (inView) { held = true; run(centered); } } }, { root: stages, threshold: .7 });
    cells.forEach(c => io.observe(c));
  }
}
