// 드라마 상황극 장면 재생기 · 2026-10-30 (홈 #drama 띠 · LAB #drama 구역, build.mjs scenePlayer가 그린 마크업을 켠다 — 뿌리 클래스는 .dscene: site.css의 .scene(PULSE 장면 카드)과 겹치지 않게)
// · 「내가 배역 맡기」는 내 대사에서 멈추고(모범 듣기 · 녹음 · 다음), 「끝까지 듣기」는 모범 읽기까지 틀며 멈추지 않는다.
// · 감독 노트가 붙은 내 대사 뒤에는 노트 예시(테이크 1 → 노트 → 테이크 2 → 칭찬)가 나온다. 이 쪽은 말을 판정하지 않는다 — 예시는 원고 그대로다.
// · 소리는 누를 때만 받는다(오디오 요소 하나를 다시 쓴다 — iOS가 사용자 동작 뒤의 연속 재생을 막지 않게). 다음 줄만 미리 받는다.
// · 녹음은 누를 때만 마이크를 묻고 최대 10초, 이 기기 메모리(Blob URL)에서만 다시 듣는다. 어디로도 보내지 않는다.
// · 소리를 못 받으면 글자 길이만큼 기다렸다 넘어간다. 탭이 가려지면 멈춘다. 움직임 줄이기 설정이면 CSS가 전환을 끈다.

const MAX_TAKE_MS = 10000;
const readMs = text => Math.min(9000, 1400 + [...String(text || '')].length * 120);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

for (const root of document.querySelectorAll('[data-scene]')) {
  try { setup(root); } catch (e) { console.warn('scene', e); }
}

function setup(root) {
  const data = JSON.parse(root.querySelector('[data-scene-data]').textContent);
  const U = data.ui;
  const $ = s => root.querySelector(s);
  const el = {
    poster: $('[data-scene-poster]'), sub: $('[data-scene-sub]'), who: $('[data-scene-who]'), ko: $('[data-scene-ko]'), mean: $('[data-scene-mean]'),
    deck: $('[data-scene-deck]'), take: $('[data-scene-take]'), pause: $('[data-scene-pause]'), restart: $('[data-scene-restart]'),
    script: [...root.querySelectorAll('[data-scene-script] li')], panels: [...root.querySelectorAll('[data-panel]')],
  };
  const audio = new Audio();
  audio.preload = 'none';
  let warm = null;
  let idx = -1, mode = 'cast', token = 0, paused = false, engaged = false, recorder = null, recTimer = 0, asking = false;
  const takes = new Map();
  const watchers = new Set();
  const stage = $('.scene-stage');
  stage.tabIndex = -1;

  for (const b of root.querySelectorAll('[data-scene-start],[data-scene-jump]')) b.disabled = false;
  root.classList.add('is-ready');
  // 대본 칸(details): 홈(compact)에서는 화면에서 감춘 글이라 초점 · 읽기 순서에서 뺀다(inert — 자막과 카드가 같은 글을 전한다).
  // LAB은 넓은 화면에서 늘 펼쳐 두고(제목은 누를 거리가 아니라 Tab에서도 뺀다), 900px 아래에서는 접어 둔 채 시작해 제목으로 연다.
  const side = root.querySelector('details.scene-side');
  if (side && root.classList.contains('dscene--compact')) side.inert = true;
  else if (side) {
    const narrow = matchMedia('(max-width:900px)');
    const summary = side.querySelector('summary');
    const fit = () => { summary.tabIndex = narrow.matches ? 0 : -1; if (!narrow.matches) side.open = true; };
    if (narrow.matches) side.open = false;
    fit();
    narrow.addEventListener('change', fit);
    summary.addEventListener('click', e => { if (!narrow.matches) e.preventDefault(); });
  }

  // ---------- 보이기 ----------
  const showPanel = name => { for (const im of el.panels) im.classList.toggle('is-on', im.dataset.panel === name); };
  const panelAt = n => { let p = 'poster'; for (let k = 0; k <= n && k < data.lines.length; k++) if (data.lines[k].panel) p = data.lines[k].panel; return p; };
  const subtitle = (who, ko, mean) => {
    el.sub.classList.toggle('is-on', !!ko);
    el.sub.dataset.who = who || '';
    el.who.textContent = who ? U.who[who] : '';
    el.ko.textContent = ko || '';
    el.mean.textContent = mean || '';
  };
  const mark = n => el.script.forEach((li, k) => { if (k === n) li.setAttribute('aria-current', 'step'); else li.removeAttribute('aria-current'); });
  const setTake = t => { el.take.textContent = 'TAKE ' + t; };
  const busy = on => {
    root.classList.toggle('is-playing', on);
    el.pause.hidden = !on && !paused;
  };
  // 카드를 비우면 그 카드의 대사 열쇠도 지운다 — 녹음이 늦게 끝나도 지나간 카드를 다시 그리지 않게.
  // 초점이 카드 안에 있었는데 새 카드에 단추가 없으면(상대 대사 · 감독 노트) 무대로 옮긴다 — 키보드 초점이 페이지 맨 위로 떨어지지 않게.
  const card = html => {
    const had = el.deck.contains(document.activeElement);
    el.deck.innerHTML = html; el.deck.hidden = !html; if (!html) el.deck.dataset.key = '';
    if (had && !el.deck.querySelector('button')) stage.focus({ preventScroll: true });
  };
  // 사람이 장면을 누르며 따라오는 중이면(engaged) 새 카드의 단추로 초점을 옮긴다 — 키보드로 끝까지 갈 수 있게. 장면 밖으로 나갔으면 옮기지 않는다.
  const focusDeck = act => {
    if (!engaged) return;
    const b = (act && el.deck.querySelector(`[data-act="${act}"]`)) || el.deck.querySelector('[data-act="next"],[data-act="again"]') || el.deck.querySelector('button');
    if (b) b.focus({ preventScroll: true });
  };

  // ---------- 소리 ----------
  // 한 줄을 틀고 끝나면 true로 풀린다. 멈춤 · 처음부터 · 다른 줄로 뛰기로 끊기면 false.
  const src = file => /^(blob:|https?:|\/)/.test(file) ? file : data.base + file;
  const play = (file, who, ko, mean) => {
    const my = ++token;
    subtitle(who, ko, mean);
    busy(true);
    return new Promise(resolve => {
      let settled = false, wait = 0;
      const stop = () => done(false);
      const onEnd = () => done(true);
      // 소리를 못 받으면 읽을 시간만큼 글을 보여 주고 넘어간다(멈춤 동안은 기다린다).
      const onErr = () => { clearTimeout(wait); const tick = () => { if (paused) { wait = setTimeout(tick, 400); return; } done(true); }; wait = setTimeout(tick, readMs(ko)); };
      function done(ok) {
        if (settled) return; settled = true;
        clearTimeout(wait);
        watchers.delete(stop);
        audio.removeEventListener('ended', onEnd); audio.removeEventListener('error', onErr);
        if (my === token) busy(false);
        resolve(ok && my === token);
      }
      watchers.add(stop);
      audio.addEventListener('ended', onEnd);
      audio.addEventListener('error', onErr);
      audio.src = src(file);
      const p = audio.play();
      if (p && p.catch) p.catch(err => { if (my !== token || (err && err.name === 'AbortError')) return; onErr(); });
    });
  };
  const cancel = () => {
    token++;
    audio.pause();
    for (const w of [...watchers]) w();
    paused = false;
    el.pause.textContent = U.pause;
    busy(false);
  };
  const prefetch = file => { if (!file) return; warm = new Audio(); warm.preload = 'auto'; warm.src = src(file); };

  // ---------- 흐름 ----------
  const begin = m => {
    mode = m;
    // 누른 단추가 포스터와 함께 사라지니 초점을 무대로 옮긴다(키보드로 이어서 「멈춤」 · 「처음부터」에 닿게).
    const fromPoster = el.poster.contains(document.activeElement);
    el.poster.hidden = true;
    el.restart.hidden = false;
    root.classList.add('is-started');
    if (fromPoster) stage.focus({ preventScroll: true });
  };
  const start = m => {
    stopRec(); cancel(); begin(m);
    setTake(1);
    idx = -1; step();
  };
  const step = async () => {
    idx++;
    if (idx >= data.lines.length) return end();
    const line = data.lines[idx];
    if (line.panel) showPanel(line.panel);
    mark(idx);
    prefetch(data.lines[idx + 1]?.audio);
    if (line.who !== 'me') {
      card('');
      if (await play(line.audio, line.who, line.ko, line.mean)) step();
      return;
    }
    if (mode === 'watch') {
      card('');
      if (line.note) return noteFlow(line);
      if (await play(line.audio, 'me', line.ko, line.mean)) step();
      return;
    }
    myTurn(line);
  };

  // 내 차례: 대사 카드에서 멈춘다. retake면 감독 노트 뒤의 테이크 2.
  const myTurn = (line, { retake = false, focus } = {}) => {
    subtitle('me', line.ko, line.mean);
    const key = idx + (retake ? ':2' : '');
    const mine = takes.get(key);
    const rec = !!recorder && recorder.key === key;
    card(`<p class="scene-card-label">${esc(retake ? U.retake : U.mine)}${line.to ? `<span>${esc(line.to)}</span>` : ''}</p>
<p class="scene-card-line" lang="ko">${esc(line.ko)}</p>${line.mean ? `<p class="scene-card-mean" lang="en">${esc(line.mean)}</p>` : ''}
<div class="scene-acts"><button class="scene-btn" type="button" data-act="model"><span aria-hidden="true">▶</span> ${esc(U.model)}</button><button class="scene-btn${rec ? ' is-rec' : ''}" type="button" data-act="rec" aria-pressed="${rec}"><span class="scene-dot" aria-hidden="true"></span> ${esc(rec ? U.stop : U.rec)}</button>${mine ? `<button class="scene-btn" type="button" data-act="mine"><span aria-hidden="true">▶</span> ${esc(U.mytake)}</button>` : ''}<button class="scene-btn primary" type="button" data-act="next">${esc(U.next)} <span aria-hidden="true">→</span></button></div>
<p class="scene-card-note" data-rec-note>${esc(rec ? U.recording : U.privacy)}</p>`);
    el.deck.dataset.key = key;
    el.deck.dataset.retake = retake ? '1' : '';
    focusDeck(focus);
  };

  // 감독 노트 예시: 테이크 1(원고의 예시 글) → 노트 소리 → 테이크 2(배역 맡기면 내가, 끝까지 듣기면 모범 읽기) → 칭찬 → 다음 줄.
  const noteFlow = async line => {
    const N = line.note;
    // 빠진 「요」는 점선 칸으로 보이되, 읽어 주기에서는 맞는 문장으로 들리지 않게 칸 글자를 감추고 「(빠진 끝맺음: 요)」로 읽힌다.
    const take1 = esc(N.take1).replace(esc(N.at), `${esc(N.at)}<span class="scene-miss" aria-hidden="true">${esc(N.want)}</span><span class="sr-only"> (${esc(N.missLabel)})</span>`);
    card(`<p class="scene-card-label is-note">${esc(U.noteLabel)}<span>${esc(U.example)}</span></p>
<p class="scene-take"><span class="scene-take-no">TAKE 1</span><span lang="ko">${take1}</span></p>
<p class="scene-tip"><b>${esc(N.kind)}</b>${esc(N.tip)}</p>
<p class="scene-example">${esc(U.exampleNote)}</p>`);
    el.deck.dataset.key = '';
    setTake(1);
    if (!(await play(N.say.audio, 'director', N.say.ko, N.say.mean))) return;
    setTake(2);
    if (mode === 'cast') return myTurn(line, { retake: true });
    if (!(await play(line.audio, 'me', line.ko, line.mean))) return;
    if (!(await play(N.praise.audio, 'director', N.praise.ko, N.praise.mean))) return;
    setTake(1);
    step();
  };
  const afterRetake = async line => {
    card('');
    if (!(await play(line.note.praise.audio, 'director', line.note.praise.ko, line.note.praise.mean))) return;
    setTake(1);
    step();
  };

  const end = () => {
    mark(-1);
    showPanel('next');
    subtitle('', '');
    card(`<p class="scene-card-label is-end">${esc(U.endTitle)}</p>
<p class="scene-end-next">${esc(U.endNext)}</p>
<div class="scene-acts">${data.next ? `<button class="scene-btn" type="button" data-act="nextvoice"><span aria-hidden="true">▶</span> ${esc(U.endVoice)}</button>` : ''}<button class="scene-btn primary" type="button" data-act="again">${esc(U.replay)} <span aria-hidden="true">↺</span></button></div>`);
    el.deck.dataset.key = '';
    focusDeck('again');
  };
  const reset = () => {
    stopRec(); cancel(); card(''); subtitle('', ''); mark(-1); showPanel('poster'); setTake(1);
    el.poster.hidden = false; el.restart.hidden = true; root.classList.remove('is-started'); idx = -1;
    const s = el.poster.querySelector('button');
    if (s && engaged) s.focus({ preventScroll: true });
  };

  // ---------- 녹음(이 기기 메모리에서만) ----------
  const recNote = text => { const n = el.deck.querySelector('[data-rec-note]'); if (n) n.textContent = text; };
  function stopRec() { if (recorder && recorder.state !== 'inactive') recorder.stop(); }
  const recording = on => root.classList.toggle('is-recording', on);
  const record = async () => {
    if (recorder) return stopRec();
    // 마이크 허락을 기다리는 동안 다시 누르면 무시한다 — 두 번째 스트림이 생겨 멈추지 않는 마이크가 남지 않게.
    if (asking) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') return recNote(U.micFail);
    const key = el.deck.dataset.key;
    if (!key) return;
    let stream;
    asking = true;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return recNote(U.micFail); }
    finally { asking = false; }
    // 마이크를 허락하는 동안 다른 카드로 넘어갔거나 이미 녹음 중이면 이 스트림은 바로 닫는다.
    if (el.deck.dataset.key !== key || recorder) { for (const t of stream.getTracks()) t.stop(); return; }
    cancel();
    const chunks = [];
    let r;
    try { r = new MediaRecorder(stream); } catch { for (const t of stream.getTracks()) t.stop(); return recNote(U.micFail); }
    r.key = key;
    r.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
    r.onstop = () => {
      clearTimeout(recTimer);
      for (const t of stream.getTracks()) t.stop();
      recorder = null;
      recording(false);
      if (chunks.length) {
        const old = takes.get(key);
        if (old) URL.revokeObjectURL(old);
        takes.set(key, URL.createObjectURL(new Blob(chunks, { type: r.mimeType || 'audio/webm' })));
      }
      // 아직 그 대사 카드에 있으면 다시 그린다(「내 테이크 듣기」가 생긴다).
      if (el.deck.dataset.key === key && data.lines[idx]?.who === 'me') {
        const now = el.deck.contains(document.activeElement) && document.activeElement.dataset.act;
        myTurn(data.lines[idx], { retake: key.endsWith(':2'), focus: !now || now === 'rec' ? 'mine' : now });
      }
    };
    recorder = r;
    r.start();
    recording(true);
    recTimer = setTimeout(stopRec, MAX_TAKE_MS);
    myTurn(data.lines[idx], { retake: key.endsWith(':2'), focus: 'rec' });
  };

  // ---------- 누르기 ----------
  root.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b || !root.contains(b)) return;
    engaged = true;
    if (b.dataset.sceneStart) return start(b.dataset.sceneStart);
    if (b.hasAttribute('data-scene-restart')) return reset();
    if (b.hasAttribute('data-scene-pause')) {
      if (paused) { paused = false; el.pause.textContent = U.pause; root.classList.add('is-playing'); audio.play().catch(() => {}); }
      else { paused = true; el.pause.textContent = U.resume; audio.pause(); root.classList.remove('is-playing'); el.pause.hidden = false; }
      return;
    }
    if (b.dataset.sceneJump) {
      // 대본 줄을 누르면 그 줄부터 — 아직 시작 전이면 「내가 배역 맡기」로 시작한다.
      stopRec(); cancel();
      if (!root.classList.contains('is-started')) begin('cast');
      const n = Number(b.dataset.sceneJump);
      showPanel(panelAt(n));
      setTake(1);
      idx = n - 1; step();
      return;
    }
    const act = b.dataset.act;
    if (!act) return;
    const line = data.lines[idx];
    if (act === 'model') { stopRec(); cancel(); play(line.audio, 'me', line.ko, line.mean); return; }
    if (act === 'rec') { record(); return; }
    if (act === 'mine') { if (recorder) return; const url = takes.get(el.deck.dataset.key); if (url) { cancel(); play(url, 'me', line.ko, line.mean); } return; }
    if (act === 'next') {
      stopRec(); cancel();
      if (el.deck.dataset.retake) return afterRetake(line);
      if (line && line.note) return noteFlow(line);
      return step();
    }
    if (act === 'nextvoice' && data.next) { cancel(); play(data.next.audio, data.next.who, data.next.ko, data.next.mean); return; }
    if (act === 'again') start(mode);
  });
  document.addEventListener('focusin', e => { if (!root.contains(e.target)) engaged = false; });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && root.classList.contains('is-playing')) { paused = true; el.pause.textContent = U.resume; el.pause.hidden = false; audio.pause(); root.classList.remove('is-playing'); }
  });
}
