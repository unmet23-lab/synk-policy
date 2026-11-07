// SYNK PATH 「하루 지도」 v12 · 2026-11-07 — /path/ · /en/path/ 두 쪽만 싣는다. 시안: SYNK-appsscript docs/디자인/synk.im_리디자인_20261106/시안/path.html.
// ① 서울 하루: 공개 서울 하루 엔진(/try/travel/의 planner-chooser · planner · places-v2 · planner-storage · walking-router)을 그대로 불러 고른 것 · 시간으로 하루를 짜고,
//    보행 길망(OSM) 지도 위에 동선 · 핀을 그린다. 화면은 고른 것 · 시간을 넘기고 돌아온 하루를 그리기만 한다 — 계산은 공개 앱과 같다(planner-ui의 첫 화면과 같은 순서).
//    엔진을 못 불러오면 빌드가 찍어 둔 예시 하루(path-sample)를 그대로 두고 앱 링크로 보낸다.
// ② 면접 방: 보이면 듣는 모습(소리 없이), 「질문 먼저 들어 보기」는 첫 질문을 소리와 함께 한 번(3.6초에서 끊는다).
// ③ 옛 주소(#study · #portfolio …)로 들어오면 그 역의 「무엇을 하나요」를 연다.
// import 없이 그대로 싣는다(엔진은 동적 import). 움직임 줄이기면 동선 · 핀 · 지도 이동의 움직임과 듣는 영상 재생을 하지 않는다.
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const svgNS = 'http://www.w3.org/2000/svg';

const day = $('[data-day]');
if (day) {
  const D = JSON.parse($('[data-day-data]', day).textContent);
  const W = D.words, ko = D.lang === 'ko';
  const KO = ko ? '' : ' lang="ko"';
  // 공개 쪽은 같은 주소에서, 미리 보기(localhost)는 공개 주소에서 엔진을 부른다(모듈 · 길망 JSON은 Access-Control-Allow-Origin: *).
  const BASE = /(^|\.)synk\.im$/.test(location.hostname) ? '/try/travel/' : 'https://synk.im/try/travel/';
  const PICK = Object.fromEntries(D.picks), HOURS = Object.fromEntries(D.hours.map(([h, t]) => [h, t]));
  const hourText = h => (W.hourText && W.hourText[h]) || HOURS[h];
  const pickOne = id => (W.picked && W.picked[id]) || PICK[id];
  const state = { picks: [...D.start.picks], hours: D.start.hours };
  // 받침에 따라 은/는 · 을/를(공개 앱 planner-ui의 withEun · josa와 같은 규칙). 영어 글은 {x:은}을 {x}처럼 쓴다.
  const final = w => { const c = w.charCodeAt(w.length - 1) - 0xac00; return c >= 0 && c <= 11171 && c % 28 !== 0; };
  const josa = (w, j) => !ko ? w : w + (j === '은' ? (final(w) ? '은' : '는') : j === '을' ? (final(w) ? '을' : '를') : j);
  const fill = (t, v) => t.replace(/\{(\w+)(?::(\S))?\}/g, (_, k, j) => j ? josa(String(v[k] ?? ''), j) : String(v[k] ?? ''));
  const names = ids => ids.map(pickOne).join(W.join);
  const cap = t => t.charAt(0).toUpperCase() + t.slice(1);

  const map = $('[data-map]', day), svg = $('[data-map-svg]', day), pins = $('[data-pins]', day);
  const sumEl = $('[data-sum]', day), stopsEl = $('[data-stops]', day), spanEl = $('[data-span]', day);
  let mod = null, net = null, routeLeg = null, view = null, viewAnim = 0, lastPlan = null, route = null, dropped = '';
  const LAT0 = 37.577, LON0 = 126.9815, K = 111320, COS = Math.cos(LAT0 * Math.PI / 180);
  const P = (lon, lat) => [(lon - LON0) * K * COS, (LAT0 - lat) * K];

  // 지도: 보행 길망 한 벌을 길 종류마다 path 하나로. 좌표는 미터(위도 37.577 기준).
  function drawBase() {
    const groups = { park: [], foot: [], minor: [], major: [] };
    const cls = k => k === 'park' ? 'park' : ['primary', 'secondary', 'tertiary'].includes(k) ? 'major' : ['footway', 'path', 'steps'].includes(k) ? 'foot' : 'minor';
    for (const w of net.ways) {
      const pts = w.n.map(i => P(net.nodes[i][0], net.nodes[i][1]));
      groups[cls(w.kind)].push('M' + pts.map(p => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join('L') + (w.kind === 'park' ? 'Z' : ''));
    }
    for (const k of ['park', 'foot', 'minor', 'major']) { const p = document.createElementNS(svgNS, 'path'); p.setAttribute('class', 'w-' + k); p.setAttribute('d', groups[k].join('')); svg.appendChild(p); }
    const dots = document.createElementNS(svgNS, 'g'); svg.appendChild(dots);
    for (const pl of mod.places.TRAVEL_PLACES) {
      if (!pl.coordinates || pl.dayPlannerEligible === false) continue;
      const [x, y] = P(pl.coordinates.lon, pl.coordinates.lat), c = document.createElementNS(svgNS, 'circle');
      c.setAttribute('class', 'p-dot'); c.setAttribute('cx', x); c.setAttribute('cy', y); c.setAttribute('r', 7); dots.appendChild(c);
    }
    route = document.createElementNS(svgNS, 'g'); svg.appendChild(route);
  }
  // 보이는 칸(넓은 화면은 글 단 오른쪽, 1240px 아래는 지도 상자 전체) 안에 동선이 들어오게 viewBox를 맞춘다.
  // 넓은 화면은 글 단(.pa-copy) 오른쪽 끝 + 80px(펠트 반폭 · 이름표 여유)부터, 들를 곳 카드 윗줄 24px 위까지 — 곳이 많은 「하루」에서
  // 서쪽 끝 곳이 글 위로 오르거나 카드 뒤로 숨지 않게(검수 F2).
  function focusRect() {
    const W0 = map.clientWidth, H0 = map.clientHeight, narrow = innerWidth <= 1240;  // path-v12.css와 같은 경계(첫 화면을 쌓는 폭)
    if (narrow) return { W: W0, H: H0, x: W0 * .1, y: H0 * .18, w: W0 * .8, h: H0 * .66 };
    const m = map.getBoundingClientRect(), copy = $('.pa-copy', day).getBoundingClientRect(), cards = stopsEl.getBoundingClientRect();
    const x = Math.max(W0 * .47, copy.right - m.left + 80), right = W0 * .91, y = H0 * .16;
    // 카드가 두 줄이어도 맞춤 칸은 지도 높이의 46%까지는 남긴다(검수 FA1)
    const bottom = Math.max(H0 * .46, Math.min(H0 * .66, cards.height ? cards.top - m.top - 24 : H0 * .66));
    return { W: W0, H: H0, x, y, w: Math.max(200, right - x), h: Math.max(160, bottom - y) };
  }
  function fit(points) {
    const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    // 가장 좁게 보는 너비(미터) — 휴대폰은 지도 상자가 작아 덜 물러선다(펠트 핀끼리 겹치지 않게)
    const minSpan = innerWidth <= 700 ? 480 : 650, cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const w = Math.max(x1 - x0, minSpan), h = Math.max(y1 - y0, minSpan * .7);
    const F = focusRect(), s = Math.min(F.w / w, F.h / h);
    return { s, x: cx - (F.x + F.w / 2) / s, y: cy - (F.y + F.h / 2) / s, W: F.W, H: F.H };
  }
  function apply(v) {
    view = v; svg.setAttribute('viewBox', `${v.x} ${v.y} ${v.W / v.s} ${v.H / v.s}`);
    for (const el of pins.children) { const [x, y] = el._xy; el.style.left = ((x - v.x) * v.s) + 'px'; el.style.top = ((y - v.y) * v.s) + 'px'; }
  }
  function animateTo(target) {
    cancelAnimationFrame(viewAnim);
    if (!view || reduce) { apply(target); untangle(); return; }
    const from = { ...view }, t0 = performance.now(), dur = 1000, ease = t => 1 - Math.pow(2, -10 * t);
    const step = now => {
      const t = Math.min(1, (now - t0) / dur), e = t === 1 ? 1 : ease(t);
      apply({ s: from.s * Math.pow(target.s / from.s, e), x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e, W: target.W, H: target.H });
      if (t < 1) viewAnim = requestAnimationFrame(step); else untangle();
    };
    viewAnim = requestAnimationFrame(step);
  }
  // 이름표 자리: 오른쪽 · 왼쪽 · 아래 · 위 가운데 처음으로 안 겹치는 곳, 다 겹치면 가장 덜 겹치는 곳(핀 아이콘은 모두 먼저 장애물로 둔다).
  // 글 단과 들를 곳 카드도 장애물이다 — 이름표가 글 쪽 · 카드 쪽을 고르지 않게(검수 F2). 1240px 아래 글 단은 display:contents라 상자가 0이다.
  function untangle() {
    const icons = [...pins.children].map(el => $('.pa-ic, .pa-mk', el)).filter(Boolean).map(x => x.getBoundingClientRect()), tags = [];
    const walls = [$('.pa-copy', day).getBoundingClientRect(), stopsEl.getBoundingClientRect()].filter(r => r.width && r.height);
    const area = (r, b) => Math.max(0, Math.min(r.right, b.right) - Math.max(r.left, b.left)) * Math.max(0, Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top));
    const m = map.getBoundingClientRect();
    for (const el of pins.children) {
      const tag = $('.pa-tag', el); if (!tag) continue;
      const own = $('.pa-ic, .pa-mk', el)?.getBoundingClientRect();
      let best = null;
      for (const side of ['', 'is-flip', 'is-down', 'is-up']) {
        tag.classList.remove('is-flip', 'is-down', 'is-up'); if (side) tag.classList.add(side);
        const r = tag.getBoundingClientRect();
        const out = (r.left < m.left || r.right > m.right || r.top < m.top + 8 || r.bottom > m.bottom - 8) ? 1e6 : 0;
        const cost = out + [...tags, ...walls, ...icons.filter(b => !(own && b.left === own.left && b.top === own.top))].reduce((n, b) => n + area(r, b), 0);
        if (!best || cost < best.cost) best = { side, cost };
        if (cost === 0) break;
      }
      tag.classList.remove('is-flip', 'is-down', 'is-up'); if (best.side) tag.classList.add(best.side);
      tags.push(tag.getBoundingClientRect());
    }
  }

  // 하루 짜기 — planner-ui.mjs가 첫 화면에서 하는 것과 같은 순서(고르기 경계 → 여행 조건 → 엔진).
  function plan() {
    const C = mod.chooser, now = new Date().toISOString();
    const raw = mod.storage.createTravelMemory().query;
    const request = { now, query: { origin: raw.origin, date: null, startTime: null }, picks: state.picks, hours: state.hours, places: mod.places.TRAVEL_PLACES, routeLeg };
    const chosen = C.planChooser(request);
    const { input } = C.chooserTripInput(raw, request, { plan: chosen });
    const result = mod.planner.planTravel(input, { now, feedback: [], routeLeg, intents: C.dayIntentRules(input), ask: false });
    return { chosen, input, result, request };
  }
  const whenOf = span => span.today ? W.today : span.when === '내일' ? W.tomorrow
    : ko ? span.when : new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Seoul' }).format(new Date(span.date + 'T12:00:00+09:00'));
  function render() {
    const C = mod.chooser, H = C.CHOOSER_HOURS;
    let out;
    try { out = plan(); } catch (e) { sumEl.textContent = W.fail; console.error(e); return; }
    const { chosen, input, result } = out, p = result.primary;
    const span = D.spans[state.hours];
    if (spanEl) spanEl.textContent = spanEl.hasAttribute('data-cap') ? cap(span) : span;
    if (!p) { sumEl.textContent = W.none; stopsEl.innerHTML = ''; pins.innerHTML = ''; route.innerHTML = ''; return; }
    // 고르기 안내 — 공개 앱 시간 화면(planner-ui syncTime)과 같은 경우: 세 개 넘음, 이 시간에 안 들어감(몇 시간부터 넉넉한지), 한 곳으로 꽉 참, 이번에는 뺌, 잇기 어려움.
    // 말없이 빼는 길은 두지 않는다.
    const notes = [];
    if (dropped) notes.push(dropped);
    if (chosen.misses?.length) {
      const later = chosen.misses.map(id => C.chooserLaterHours(id, out.request).sameDay).filter(Boolean);
      notes.push(fill(W.misses, { x: names(chosen.misses), span }) + (later.length ? fill(W.later, { h: hourText(Math.max(...later)) }) : ''));
    }
    if (chosen.long) notes.push(fill(W.long, { x: pickOne(chosen.long) }));
    if (chosen.left?.length) notes.push(chosen.together ? fill(W.together, { x: names(chosen.left), h: hourText(chosen.together) }) : fill(W.left, { x: names(chosen.left) }));
    if (chosen.apart?.length) notes.push(fill(W.apart, { x: names(chosen.apart), span }));
    dropped = '';
    const walk = p.walking ? ' · ' + esc(fill(W.walking, { a: p.walking.minMinutes, b: p.walking.maxMinutes })) : '';
    sumEl.innerHTML = `<b>${esc(whenOf(chosen.span))} ${p.startTime}</b> ${fill(esc(W.from), { name: `<span${KO}>${esc(input.origin.name)}</span>` })} → <b>${p.endTime}</b> · ${esc(fill(W.count, { n: p.stops.length }))}${walk}`
      + (notes.length ? `<span class="pa-notes">${esc(notes.join(W.sep))}.</span>` : '');
    // 들를 곳 — 엔진이 그 시각 운영을 확인하지 못한 곳(schedule.status ≠ matched — 공식 안내 확인일이 30일을 넘은 곳 등)은 「운영 확인 필요」를 단다.
    stopsEl.innerHTML = p.stops.map((s, i) => {
      const pl = s.place, picked = state.picks.find(id => C.servesDayIntent(pl, id));
      const what = picked ? pickOne(picked) : (W.kinds[pl.category] || '');
      const check = s.schedule?.status !== 'matched' ? `<span class="pa-s-c">${esc(W.check)}</span>` : '';
      const leg = p.legs[i] ? ` <span>${esc(fill(W.leg, { a: p.legs[i].minMinutes, b: p.legs[i].maxMinutes }))}</span>` : '';
      return `<li><span class="pa-s-t">${i + 1} · <b>${s.arrivalTime}</b>–${s.departureTime}</span><span class="pa-s-n"${KO}>${esc(pl.name)}</span><span class="pa-s-m"><span>${what ? esc(what) + ' · ' : ''}${esc(fill(W.stay, { n: s.stayMinutes }))}</span>${leg}</span>${check}</li>`;
    }).join('');
    // 지도: 동선(종이색 테두리 + 초록 선, 출발지에서부터 그려진다) · 핀
    route.innerHTML = '';
    const line = p.legs.flatMap(l => (l.coordinates || []).map(q => P(q[0], q[1])));
    if (line.length) {
      const d = 'M' + line.map(q => q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('L');
      for (const c of ['r-case', 'r-line']) { const el = document.createElementNS(svgNS, 'path'); el.setAttribute('class', c); el.setAttribute('d', d); route.appendChild(el); }
      if (!reduce) {
        const len = route.lastChild.getTotalLength();
        for (const x of route.children) { x.style.strokeDasharray = len; x.style.strokeDashoffset = len; x.getBoundingClientRect(); x.style.transition = 'stroke-dashoffset 1.6s cubic-bezier(.19,1,.22,1) .25s'; x.style.strokeDashoffset = 0; }
      }
    }
    pins.innerHTML = '';
    const origin = P(input.origin.lon, input.origin.lat);
    const add = (xy, html, cls) => { const el = document.createElement('div'); el.className = 'pa-pin ' + cls; el.innerHTML = html; el._xy = xy; pins.appendChild(el); return el; };
    add(origin, `<span class="pa-mk"></span><span class="pa-tag"><span${KO}>${esc(input.origin.name)}</span> ${p.startTime}</span>`, 'is-origin');
    // 고른 것을 채우는 곳만 펠트 물건, 나머지는 번호 점. 펠트끼리 너무 가까우면(55m 안) 뒤엣것은 번호 점으로.
    const felted = [];
    p.stops.forEach((s, i) => {
      const pl = s.place, xy = P(pl.coordinates.lon, pl.coordinates.lat);
      let picked = state.picks.find(id => C.servesDayIntent(pl, id));
      if (picked && felted.some(q => Math.hypot(q[0] - xy[0], q[1] - xy[1]) < 55)) picked = null;
      if (picked) felted.push(xy);
      const tag = `<span class="pa-tag"><b><span${KO}>${esc(pl.name)}</span></b><span>${s.arrivalTime}</span></span>`;
      const el = add(xy, picked ? `<span class="pa-ic"><img src="/assets/v10/path-felt-${picked}.webp" alt=""><span class="pa-n">${i + 1}</span></span>${tag}` : `<span class="pa-mk">${i + 1}</span>${tag}`, picked ? 'is-felt' : 'is-plain');
      // 차례로 떨어지게(CSSOM — 인라인 style 속성을 쓰지 않는다)
      const ic = $('.pa-ic img, .pa-mk', el); if (ic) ic.style.animationDelay = (.2 + i * .12) + 's';
    });
    lastPlan = [origin, ...line, ...p.stops.map(s => P(s.place.coordinates.lon, s.place.coordinates.lat))];
    animateTo(fit(lastPlan));
  }

  let timer = 0;
  const replan = () => { sumEl.innerHTML = `<span class="is-busy">${esc(W.busy)}</span>`; clearTimeout(timer); timer = setTimeout(() => requestAnimationFrame(render), 60); };
  const felts = $('.pa-felts', day), hours = $('.pa-hours', day);
  felts.addEventListener('click', e => {
    const b = e.target.closest('[data-pick]'); if (!b || !mod) return;
    const id = b.dataset.pick, on = state.picks.includes(id);
    // 세 개까지 — 넘치면 먼저 고른 것부터 빼고 그렇게 말한다(공개 앱과 같은 말)
    if (!on && state.picks.length >= 3) { const gone = state.picks.shift(); dropped = fill(W.dropped, { x: pickOne(gone) }); }
    state.picks = on ? state.picks.filter(x => x !== id) : [...state.picks, id];
    for (const x of felts.querySelectorAll('[data-pick]')) x.setAttribute('aria-pressed', state.picks.includes(x.dataset.pick));
    b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop');
    replan();
  });
  const pickHours = b => {
    state.hours = +b.dataset.hours;
    for (const x of hours.querySelectorAll('[data-hours]')) { const on = x === b; x.setAttribute('aria-checked', on); x.tabIndex = on ? 0 : -1; }
    replan();
  };
  hours.addEventListener('click', e => { const b = e.target.closest('[data-hours]'); if (b && mod) pickHours(b); });
  hours.addEventListener('keydown', e => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key) || !mod) return;
    const bs = [...hours.querySelectorAll('[data-hours]')], i = bs.findIndex(b => b.getAttribute('aria-checked') === 'true');
    const n = bs[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length];
    n.focus(); pickHours(n); e.preventDefault();
  });
  addEventListener('resize', () => { if (lastPlan) { apply(fit(lastPlan)); untangle(); } });

  // 빌드가 찍은 예시 하루 요약(「예시 — 날짜 …」) — 엔진을 못 불러오면 이것을 남기고 실패 글을 덧붙인다(검수 F4)
  const sampleSum = sumEl.innerHTML;
  sumEl.innerHTML = `<span class="is-busy">${esc(W.busy)}</span>`;
  (async () => {
    const [places, planner, chooser, storage, router] = await Promise.all(['places-v2.mjs', 'planner.mjs', 'planner-chooser.mjs', 'planner-storage.mjs', 'walking-router.mjs'].map(f => import(BASE + f)));
    mod = { places, planner, chooser, storage };
    net = await fetch(BASE + 'assets/jongno-walking.json').then(r => { if (!r.ok) throw new Error('길망 ' + r.status); return r.json(); });
    routeLeg = router.createWalkingRouter(net);
    drawBase();
    render();
    map.classList.add('is-live');
  })().catch(e => {
    // 엔진을 못 불러왔으면 빌드가 찍은 예시 하루(그림 · 들를 곳)를 그대로 두고, 고르기 칸은 숨기고, 앱으로 보낸다.
    map.classList.add('is-fallback'); $('[data-pick-ui]', day).hidden = true;
    sumEl.innerHTML = `${sampleSum}<span class="pa-notes">${esc(W.fail)}</span>`; console.error(e);
  });
}

// ② 면접 방
const stage = $('[data-stage]');
if (stage) {
  const R = JSON.parse($('[data-room]').textContent);
  const listen = $('.pa-listen', stage), ask = $('.pa-ask', stage), line = $('[data-line]'), hear = $('[data-hear]');
  const load = v => { if (!v.src) v.src = v.dataset.src; };
  const say = (text, gloss, wait) => {
    line.classList.toggle('is-wait', !!wait);
    line.innerHTML = gloss ? `<span lang="ko">${esc(text)}</span><small>${esc(gloss)}</small>` : esc(text);
  };
  // 듣는 영상은 공개 면접 연습 manifest가 loop:false다 — 끝(10.08초)에서 처음으로 바로 넘기면 이음새가 보여, 안전 구간(9~9.98초)에 들면 0.1초로 되돌린다.
  listen.addEventListener('timeupdate', () => { if (listen.currentTime > 9.3) listen.currentTime = 0.1; });
  listen.addEventListener('ended', () => { listen.currentTime = 0.1; listen.play().catch(() => {}); });
  if (!reduce) new IntersectionObserver(es => { for (const e of es) { if (e.isIntersecting) { load(listen); listen.play().catch(() => {}); } else { listen.pause(); ask.pause(); } } }, { threshold: .35 }).observe(stage);
  hear.hidden = false;
  hear.addEventListener('click', async () => {
    load(ask); ask.currentTime = 0; ask.muted = false; stage.classList.add('is-asking');
    say(R.question, R.lang === 'ko' ? '' : R.gloss, false);
    try { await ask.play(); } catch { stage.classList.remove('is-asking'); say(R.wait, '', true); }
  });
  // 첫 질문은 3.6초에서 끝난다(공개 면접 연습 strict-question의 answerStartSeconds) — 그 뒤는 답을 기다리는 장면이라 듣는 모습으로 돌아간다.
  ask.addEventListener('timeupdate', () => {
    if (ask.currentTime <= 3.6 || !stage.classList.contains('is-asking')) return;
    stage.classList.remove('is-asking'); ask.pause();
    if (!reduce) { load(listen); listen.play().catch(() => {}); }
    say(R.after, '', true);
  });
}

// ③ 옛 주소로 들어오면 그 역의 「무엇을 하나요」를 연다
const openStation = () => {
  const t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  const st = t && t.closest('.pa-st'), d = st && $('details', st);
  if (d) d.open = true;
};
addEventListener('hashchange', openStation); openStation();
