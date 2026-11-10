// synk.im 「쓸수록 달라지는 것」(2026-11-09). 홈 · 아틀라스 · LAB 쪽만 싣는다(build.mjs LEARNER_PAGES). 스크립트가 없으면 홈 · 아틀라스는 모든 칸을 펼치고, LAB 구역은 숨는다.
// 안 B의 일정은 SYNK WORLD 코드와 같은 규칙이다: 틀림 1분 뒤 · 처음 맞힘 내일(experiences/synk-world-app/life-progress.mjs), 틀린 답도 1 · 7 · 30일 확인의 첫 기록(atlas/temper.js).
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const narrow = matchMedia('(max-width:900px)');
const DUR = 8000; // 한 칸 상영(자동 넘김). 사람이 고르면 자동 넘김은 멈춘다.

/* ── 홈 · 아틀라스: 시간 줄을 누르면 그때의 창가 · 물음 · 실제 화면. 좁은 화면은 옆으로 넘기는 줄(모두 펼침). ── */
for (const root of document.querySelectorAll('[data-lw]')) {
  const frames = [...root.querySelectorAll('.lw-frame')];
  const rail = root.querySelector('[data-lw-rail]');
  const tabs = [...rail.querySelectorAll('.lw-tab')];
  const pause = root.querySelector('.lw-pause');
  const track = root.querySelector('[data-lw-frames]');
  const stage = root.querySelector('.lw-stage');
  let now = 0, timer = 0, inView = false, held = false, stopped = reduce, cleanup = 0;
  const still = () => stopped || held || !inView || narrow.matches;
  const paint = () => {
    frames.forEach((f, k) => f.classList.toggle('is-on', k === now));
    tabs.forEach((t, k) => { const on = k === now; t.classList.toggle('is-on', on); if (!narrow.matches) { t.setAttribute('aria-selected', on ? 'true' : 'false'); t.tabIndex = on ? 0 : -1; frames[k].tabIndex = on ? 0 : -1; } else frames[k].removeAttribute('tabindex'); });
  };
  const arm = (wait = DUR) => {
    clearTimeout(timer);
    root.classList.remove('is-run');
    if (still()) return;
    root.style.setProperty('--dur', `${wait}ms`);
    void root.offsetWidth; // 선이 처음부터 다시 차오르게
    root.classList.add('is-run');
    timer = setTimeout(() => show((now + 1) % frames.length), wait);
  };
  function show(n, { focus = false } = {}) {
    if (n === now) { arm(); return; }
    clearTimeout(cleanup);
    frames.forEach(f => f.classList.remove('was-on'));
    frames[now].classList.add('was-on');
    now = n; paint();
    cleanup = setTimeout(() => frames.forEach(f => f.classList.remove('was-on')), 950);
    if (focus) tabs[now].focus({ preventScroll: true });
    arm();
  }
  const setStopped = v => {
    stopped = v;
    // 눌림 상태(aria-pressed)를 쓰지 않는다 — 이름이 「멈추기」↔「켜기」로 바뀌는 단추라 상태와 이름이 엇갈려 읽힌다(WAI 캐러셀 꼴)
    if (pause) { pause.dataset.state = v ? 'stopped' : 'running'; pause.setAttribute('aria-label', v ? pause.dataset.play : pause.dataset.stop); }
    arm();
  };
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => { setStopped(true); show(i); });
    t.addEventListener('keydown', e => {
      const n = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
      if (n === undefined) return;
      e.preventDefault(); setStopped(true); show((n + tabs.length) % tabs.length, { focus: true });
    });
  });
  if (pause) pause.addEventListener('click', () => setStopped(!stopped));
  // 손을 올리거나 글을 읽으려고 멈춰 있으면 넘기지 않는다. 떼면 4초 뒤 다음 칸.
  for (const el of [stage, rail.parentElement]) {
    el.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse') { held = true; arm(); } });
    el.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') { held = false; arm(4000); } });
  }
  root.addEventListener('focusin', () => { held = true; arm(); });
  root.addEventListener('focusout', () => { held = false; arm(4000); });
  new IntersectionObserver(es => { inView = es[0].isIntersecting; arm(); }, { threshold: .5 }).observe(stage);
  // 무대가 가까워지면 모든 칸의 사진을 미리 받는다(칸이 바뀔 때 빈 바탕이 비치지 않게).
  const near = new IntersectionObserver(es => { if (es[0].isIntersecting) { for (const i of root.querySelectorAll('img')) i.loading = 'eager'; near.disconnect(); } }, { rootMargin: '900px 0px' });
  near.observe(stage);
  // 좁은 화면: 탭 역할을 빼고, 몇 번째 칸인지 적는다.
  const mode = () => {
    const list = !narrow.matches;
    if (list) { rail.setAttribute('role', 'tablist'); track.removeAttribute('tabindex'); track.removeAttribute('role'); track.removeAttribute('aria-label'); }
    else { rail.removeAttribute('role'); track.tabIndex = 0; track.setAttribute('role', 'group'); track.setAttribute('aria-label', rail.getAttribute('aria-label')); }
    tabs.forEach(t => { if (list) t.setAttribute('role', 'tab'); else { t.removeAttribute('role'); t.removeAttribute('aria-selected'); t.tabIndex = -1; } });
    frames.forEach((f, i) => { if (list) { f.setAttribute('role', 'tabpanel'); f.setAttribute('aria-labelledby', tabs[i].id); } else { f.removeAttribute('role'); f.removeAttribute('aria-labelledby'); } });
    paint(); arm();
  };
  narrow.addEventListener('change', mode); mode();
  // 부품은 실제 화면 그림이다. 그 안의 단추를 눌러 보는 사람이 막히지 않게 누르면 다음 걸음으로 간다(키보드 · 화면 읽기는 머리의 진짜 단추).
  const go = root.querySelector('.lw-go a.btn, .lw-go a.k-btn'); // 한국어 뼈대 홈은 k-btn(2026-11-11)
  if (go) for (const piece of root.querySelectorAll('.lw-piece')) {
    piece.classList.add('is-go');
    piece.addEventListener('click', () => { location.href = go.href; });
  }
  const count = root.querySelector('[data-lw-count]');
  const upNext = root.querySelector('[data-lw-next]');
  const steps = [...root.querySelectorAll('.lw-step')];
  // 좁은 화면: 지금 보이는 칸(가운데에 가장 가까운 칸)
  const current = () => {
    const mid = track.scrollLeft + track.clientWidth / 2;
    let best = 0, gap = Infinity;
    frames.forEach((f, i) => { const d = Math.abs(f.offsetLeft + f.offsetWidth / 2 - mid); if (d < gap) { gap = d; best = i; } });
    return best;
  };
  for (const b of steps) b.addEventListener('click', () => {
    const t = Math.max(0, Math.min(frames.length - 1, current() + Number(b.dataset.step)));
    track.scrollTo({ left: frames[t].offsetLeft - parseFloat(getComputedStyle(track).paddingLeft || '0'), behavior: reduce ? 'auto' : 'smooth' });
  });
  if (count) {
    const total = String(frames.length).padStart(2, '0');
    track.addEventListener('scroll', () => {
      const best = current();
      if (steps.length) { steps[0].disabled = best === 0; steps[1].disabled = best === frames.length - 1; }
      count.textContent = `${String(best + 1).padStart(2, '0')} / ${total}`;
      if (upNext) { const after = tabs[best + 1]; upNext.hidden = !after; if (after) upNext.lastElementChild.textContent = after.textContent.trim(); }
    }, { passive: true });
  }
}

/* ── LAB: 한 문제를 풀고 30일을 빨리 감는다. 누를 곳은 언제나 하나, 왼쪽의 같은 자리다. ── */
for (const root of document.querySelectorAll('[data-try]')) {
  const Q = JSON.parse(root.querySelector('[data-try-data]').textContent);
  const $ = s => root.querySelector(s);
  const when = $('[data-when]'), say = $('[data-say]'), sub = $('[data-sub]'), next = $('[data-next]');
  const quiz = $('[data-quiz]'), context = $('[data-context]'), prompt = $('[data-prompt]'), box = $('[data-choices]');
  const qhead = $('[data-qhead]'), qcount = $('[data-qcount]'), qbar = $('[data-qbar]');
  const shots = [...root.querySelectorAll('[data-shot]')], photos = [...root.querySelectorAll('[data-photo]')], steps = [...root.querySelectorAll('[data-steps] li')];
  const arrow = '<span class="arr" aria-hidden="true">→</span>';
  let sceneTimer = 0;
  const scene = at => {
    const was = photos.find(p => p.classList.contains('is-on'));
    if (was?.dataset.photo === at) return;
    clearTimeout(sceneTimer);
    photos.forEach(p => { p.classList.remove('was-on'); p.classList.toggle('is-on', p.dataset.photo === at); });
    was?.classList.add('was-on');
    sceneTimer = setTimeout(() => was?.classList.remove('was-on'), 1150);
  };
  const showShot = name => { quiz.hidden = !!name; shots.forEach(s => { s.hidden = s.dataset.shot !== name; }); };
  const stepTo = n => steps.forEach((li, i) => { li.classList.toggle('is-past', i < n); li.classList.toggle('is-now', i === n); if (i === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
  const text = (w, s, t) => { if (w !== null) when.textContent = w; say.textContent = s; sub.textContent = t; };
  const button = (label, fn, cls = 'btn btn-light') => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = cls; b.innerHTML = label;
    b.addEventListener('click', fn);
    return b;
  };
  const link = (label, href) => { const a = document.createElement('a'); a.className = 'btn btn-light'; a.href = href; a.innerHTML = label; return a; };
  // 좁은 화면은 글(위) · 문제 카드 · 누를 곳(아래) 순서라, 답하거나 다음 문제로 넘어가면 바뀐 글이나 단추가 화면 밖에 걸릴 수 있다.
  // 글 머리부터 end(단추 · 마지막 보기)까지 한 화면에 들면 그만큼 끌어 올리고, 안 들면(360×640 같은 작은 화면) 바뀐 글부터 보인다.
  // 위 기준은 화면 위에 붙은 사이트 머리띠(.bar, 약 66px) 아래다 — 16px에 맞추면 때 글과 물음이 머리띠 뒤로 숨었다(11-10 검수)
  const lift = end => {
    if (!started || !narrow.matches || !end) return;
    const bar = document.querySelector('.bar'), br = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect() : null;
    const top = (br && br.bottom > 0 ? br.bottom : 0) + 12, head = when.parentElement.getBoundingClientRect(), bottom = end.getBoundingClientRect().bottom;
    const behavior = reduce ? 'auto' : 'smooth';
    if (bottom - head.top + top + 16 <= innerHeight) { if (head.top < top) scrollBy({ top: head.top - top, behavior }); else if (bottom > innerHeight - 16) scrollBy({ top: bottom - innerHeight + 16, behavior }); }
    else if (head.top < top || head.top > innerHeight / 2) scrollBy({ top: head.top - top, behavior });
  };
  const act = (...els) => {
    next.replaceChildren(...els);
    if (els[0] && document.activeElement && (root.contains(document.activeElement) || document.activeElement === document.body) && started) els[0].focus({ preventScroll: true });
    lift(els[0]);
  };
  let started = false;
  // 부품 그림을 눌러도 막히지 않게: 지금 단계의 주 단추와 같다.
  for (const s of shots) s.addEventListener('click', () => next.querySelector('.btn')?.click());
  const ask = (q, done) => {
    text(q.when, q.say, q.sub);
    showShot(null);
    context.textContent = q.context; prompt.textContent = q.prompt;
    // 앱 문제 화면의 머리(레슨 이름 · 몇 번째 · 진행 막대) 그대로
    if (q.head) { qhead.textContent = q.head[0]; qcount.textContent = q.head[1]; qbar.style.width = `${Math.round(q.head[2] * 100)}%`; }
    box.replaceChildren();
    for (const c of q.choices) {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'lwq-choice'; b.textContent = c.text;
      b.dataset.id = c.id;
      b.addEventListener('click', () => {
        started = true;
        const right = c.id === q.answerId;
        for (const x of box.children) x.disabled = true;
        b.classList.add(right ? 'is-right' : 'is-wrong');
        if (!right) [...box.children].find(x => x.dataset.id === q.answerId)?.classList.add('is-right');
        done(right);
      });
      box.append(b);
    }
    next.replaceChildren();
    if (started) box.firstElementChild.focus({ preventScroll: true });
    // 다음 문제(1분 뒤 · 30일 뒤)로 넘어갈 때도 새 때 · 물음부터 보이게
    lift(box.lastElementChild);
  };
  // 한 날: 실제 화면 한 장(shot), 또는 그날 처음 보는 문제(ask — 30일 뒤 다시 확인. 답하면 맞음 · 틀림 글로 바뀐다)
  const day = i => {
    const d = Q.days[i];
    scene(d.at); stepTo(d.step);
    const onward = () => {
      if (d.next) act(button(`${d.next} ${arrow}`, () => day(i + 1)));
      else act(link(`${Q.go.label} <span class="arr" aria-hidden="true">${Q.go.arrow}</span>`, Q.go.href), button(Q.again, () => { started = true; first(); }, 'lw-link lw-again'));
    };
    if (d.ask) ask({ ...d.ask, when: d.when, say: d.say, sub: d.sub }, right => { const r = right ? d.right : d.wrong; text(null, r.say, r.sub); onward(); });
    else { text(d.when, d.say, d.sub); showShot(d.shot); onward(); }
  };
  const second = () => {
    scene(Q.start); stepTo(1);
    ask(Q.second, right => {
      if (right) { text(null, Q.backRight.say, Q.backRight.sub); act(button(`${Q.toDay1} ${arrow}`, () => day(0))); }
      else { text(null, Q.backWrong.say, Q.backWrong.sub); act(button(`${Q.toMinute} ${arrow}`, second)); }
    });
  };
  function first() {
    scene(Q.start); stepTo(0);
    ask(Q.first, right => {
      if (right) { text(null, Q.right.say, Q.right.sub); act(button(`${Q.toDay1} ${arrow}`, () => day(0))); }
      else { text(null, Q.wrong.say, Q.wrong.sub); act(button(`${Q.toMinute} ${arrow}`, second)); }
    });
  }
  first();
  const near = new IntersectionObserver(es => { if (es[0].isIntersecting) { for (const i of root.querySelectorAll('img')) i.loading = 'eager'; near.disconnect(); } }, { rootMargin: '900px 0px' });
  near.observe(root);
}
