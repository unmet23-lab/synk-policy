// SYNK SHIFT 「운행표」 v12 · 2026-11-06 — /shift/ · /en/shift/ 두 쪽만 싣는다(build.mjs shell). 묶지 않고 그대로 싣는다(import 없음).
// 운행표: 서울 시각 · 요일로 지난 줄은 흐리게, 다음 줄은 켜고(뒤집히듯 바뀜), 요일이 정해진 줄(화 · 금)이 안 도는 날은 「오늘 없음」으로 흐리게 둔다.
// 다음 줄이 있으면 판에 has-next를 달아 휴대폰에서는 지난 줄을 접는다(출발 안내판처럼 — 첫 화면에 다음 줄들이 보이게).
// 시각과 「다음까지」는 보이는 장식이라 화면 낭독기에는 읽히지 않는다(표 줄은 그대로 읽힌다). 15초마다 다시 그린다.
const board = document.querySelector('[data-board]');
if (board) {
  let words = {};
  try { words = JSON.parse(board.querySelector('[data-board-words]').textContent); } catch {}
  const clock = board.querySelector('[data-clock]'), nextIn = board.querySelector('[data-next]');
  const items = [...board.querySelectorAll('.sv-rows li')];
  const at = t => { const [a, b] = t.split(':').map(Number); return a * 60 + b; };
  const seoul = () => { const d = new Date(Date.now() + 9 * 3600e3); return { h: d.getUTCHours(), m: d.getUTCMinutes(), w: d.getUTCDay() }; };
  const runs = (li, w) => !li.dataset.days || li.dataset.days.split(',').map(Number).includes(w);
  let lastNext = -1;
  const draw = () => {
    const { h, m, w } = seoul();
    if (clock) clock.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const now = h * 60 + m;
    const next = items.findIndex(li => runs(li, w) && at(li.dataset.at) > now);
    items.forEach((li, i) => {
      const on = runs(li, w);
      li.classList.toggle('off', !on);
      const every = li.querySelector('.sv-every');
      every.textContent = on ? every.dataset.every : words.off || every.dataset.every;
      // 지난 줄: 오늘 도는 줄은 다음 줄 앞이면, 오늘 안 도는 줄(오늘 없음)도 시각이 지났으면 — 휴대폰에서 지난 줄을 접을 때 지난 「오늘 없음」 줄만 남지 않게.
      li.classList.toggle('past', on ? (next >= 0 ? i < next : true) : at(li.dataset.at) <= now);
      li.classList.toggle('next', i === next);
    });
    if (next !== lastNext && next >= 0 && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      items[next].classList.remove('flip'); void items[next].offsetWidth; items[next].classList.add('flip');
    }
    lastNext = next;
    board.classList.toggle('has-next', next >= 0);
    if (!nextIn) return;
    if (next >= 0) {
      const left = at(items[next].dataset.at) - now, hh = Math.floor(left / 60), mm = left % 60;
      const hour = hh ? `${hh}${words.hour === 'h' ? ' h' : words.hour}` : '', min = mm || !hh ? `${mm}${words.min === 'min' ? ' min' : words.min}` : '';
      nextIn.textContent = [words.next, hour, min].filter(Boolean).join(' ');
    } else nextIn.textContent = words.done || '';
  };
  draw();
  setInterval(draw, 15000);
}
