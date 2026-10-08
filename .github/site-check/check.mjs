// synk.im 배포 점검(2026-10-03). synk-policy main에 올라갈 때마다 GitHub Actions에서 돈다(.github/workflows/site-check.yml).
// 손으로 하던 공개 확인을 그대로 옮겼다:
// 1. 반영 기다리기 — 이번 커밋에서 바뀐 파일이 synk.im에서 저장소와 바이트가 같아질 때까지(지운 파일은 404까지) 기다린다.
// 2. 도구 이름 — 공개 글·데이터·MP3 태그에 제작 도구 이름(음악·영상·그림·음성 생성 도구와 음성 모델 이름)이 없는지 저장소 파일로 본다.
//    개인정보·약관처럼 처리 업체를 적어야 하는 곳과 도구 사용법 안내(brief)는 뺀다(2026-10-02 원칙).
//    찾을 이름 목록은 이 저장소가 공개라 검색에 걸리지 않게 base64로 적었다.
// 3. 페이지 — 주요 페이지를 컴퓨터·휴대폰으로 열어 콘솔 오류·실패한 요청·가로 넘침이 없는지 본다.
// 4. LAB 게임 — LAB 게임 카드(data-game)마다 /try/<게임>/을 열고 시작 단추가 풀리면 눌러 8초 뒤 오류가 없는지 본다. 카드의 플레이 장면 영상 주소도 받아지는지 본다.
// 5. 질문창 — LAB 질문창에 하나 물어 답이 나오는지 본다.
// 정적 GET/HEAD의 502·503·504만 쓰기 없는 시나리오를 새 context에서 한 번 재검사한다.
// 첫 실패 JSON·화면을 성공 여부와 무관하게 보존하며 복구는 별도 경고로 남긴다.
// Usage: node .github/site-check/check.mjs   (환경: SITE_BASE=https://synk.im, PLAYWRIGHT_MODULE=플레이라이트 경로, CI=true)
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {createBrowserProbe} from './browser-probe.mjs';
import {runScenarioCheck} from './scenario-recovery.mjs';

const base = (process.env.SITE_BASE || 'https://synk.im').replace(/\/$/, '');
const ci = process.env.CI === 'true';
const out = 'site-check-artifacts';
const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
fs.mkdirSync(out, {recursive: true});
const git = (...a) => execFileSync('git', a, {encoding: 'buffer', maxBuffer: 1 << 30});
const problems = [], notes = [], recoveredScenarios = [];
const fail = (step, text) => { problems.push(`[${step}] ${text}`); console.log(`  ✗ ${text}`); };
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const wait = ms => new Promise(r => setTimeout(r, ms));
const staticPaths = new Set(git('ls-files', '-z').toString('utf8').split('\0').filter(Boolean));
async function get(url) {
  try {
    const r = await fetch(url, {headers: {'Cache-Control': 'no-cache'}, redirect: 'follow'});
    return {status: r.status, body: Buffer.from(await r.arrayBuffer())};
  } catch {
    // 이 PC처럼 Node fetch가 막힌 곳에서 손으로 돌릴 때를 위해 curl로 한 번 더 받는다.
    const raw = execFileSync('curl', ['-s', '-L', '-H', 'Cache-Control: no-cache', '-w', '\n%{http_code}', url], {maxBuffer: 1 << 30});
    const cut = raw.lastIndexOf(10);
    return {status: Number(raw.subarray(cut + 1).toString()), body: raw.subarray(0, cut)};
  }
}
const urlOf = p => base + '/' + p.split('/').map(encodeURIComponent).join('/');

// 1. 반영 기다리기
console.log('1. synk.im 반영 기다리기');
{
  // 잇달아 올라오면 앞 점검은 취소되므로, 바로 앞 커밋이 아니라 마지막으로 통과한 점검의 커밋부터 바뀐 파일을 본다.
  let since = 'HEAD~1', listing = '';
  if (process.env.GH_TOKEN && process.env.GITHUB_REPOSITORY) {
    try {
      const last = JSON.parse(execFileSync('gh', ['run', 'list', '-R', process.env.GITHUB_REPOSITORY, '--workflow', 'site-check.yml',
        '--status', 'success', '-L', '1', '--json', 'headSha'], {encoding: 'utf8'}))[0]?.headSha;
      if (last) {
        // 얕게 받은 CI 사본에만 그 커밋을 더 받는다(손으로 돌리는 전체 저장소를 얕게 바꾸지 않게).
        if (git('rev-parse', '--is-shallow-repository').toString().trim() === 'true') git('fetch', '-q', '--depth=1', 'origin', last);
        since = last;
      }
    } catch { notes.push('마지막으로 통과한 점검을 못 찾아 바로 앞 커밋과 비교함'); }
  }
  for (const from of [...new Set([since, 'HEAD~1'])]) {
    try { listing = git('diff', '--name-status', from, 'HEAD').toString('utf8'); since = from; break; } catch {}
  }
  if (!listing) notes.push('비교할 앞 커밋이 없거나 바뀐 파일이 없어 반영 기다리기를 건너뜀');
  console.log(`  비교: ${since === 'HEAD~1' ? '바로 앞 커밋' : '마지막 통과 ' + since.slice(0, 7)}부터`);
  let changed = [], removed = [];
  for (const line of listing.split('\n').filter(Boolean)) {
    const [kind, ...rest] = line.split('\t'), file = rest.at(-1);
    if (file.startsWith('.github/') || file.startsWith('_') || file.startsWith('.')) continue;
    if (kind === 'D') removed.push(file); else if (/^[AMR]/.test(kind)) changed.push(file);
  }
  // 페이지·스크립트·데이터는 모두, 나머지는 앞에서 30개까지 본다.
  const key = changed.filter(f => /\.(html|js|json|css|txt|xml)$/.test(f));
  const pick = [...new Set([...key, ...changed.filter(f => !key.includes(f)).slice(0, 30)])].slice(0, 80);
  const gone = removed.slice(0, 10);
  const want = Object.fromEntries(pick.map(f => [f, sha(git('show', 'HEAD:' + f))]));
  const deadline = Date.now() + 12 * 60 * 1000;
  let left = new Set(pick), leftGone = new Set(gone);
  while ((left.size || leftGone.size) && Date.now() < deadline) {
    for (const f of [...left]) { const r = await get(urlOf(f) + '?probe=' + Math.random().toString(36).slice(2)); if (r.status === 200 && sha(r.body) === want[f]) left.delete(f); }
    for (const f of [...leftGone]) { const r = await get(urlOf(f) + '?probe=' + Math.random().toString(36).slice(2)); if (r.status === 404) leftGone.delete(f); }
    if (left.size || leftGone.size) await wait(20000);
  }
  if (left.size || leftGone.size) fail('반영', `12분 안에 반영되지 않음: ${[...left, ...leftGone].slice(0, 8).join(', ')}`);
  else console.log(`  바뀐 파일 ${pick.length}개 같음, 지운 파일 ${gone.length}개 404`);
}

// 2. 도구 이름
console.log('2. 제작 도구 이름');
{
  const skipDir = /(^|\/)(vendor|node_modules)\//;
  const skipPage = /^(en\/)?(privacy|terms|data-deletion|brief)\//;
  // 질문창 엔진은 “그림 만드는 AI는 뭘 써요?” 같은 질문을 알아듣는 단어 목록을 코드로 갖고 있다(표기가 아니다).
  const skipFile = /(^|\/)knowledge-engine\.js$/;
  const listOf = b64 => new RegExp(Buffer.from(b64, 'base64').toString('utf8'), 'i');
  const words = listOf('c3Vub3xoaWdnc2ZpZWxkfG5hbm8gYmFuYW5hfG1pZGpvdXJuZXl8Z3B0Wy0gXWltYWdlfGVkZ2VbLV8gXXR0c3xlbGV2ZW5sYWJzfGdlbWluaS1bMC05XVtcdy4tXSp0dHN8a28tS1ItW0EtWmEtel0rTmV1cmFsfG1hZGUgd2l0aCAoc3Vub3x1ZGlvKQ==');
  const tagWords = listOf('c3Vub3xcYnVkaW9cYnxnZW1pbml8ZWxldmVubGFic3xvcGVuYWl8ZWRnZVstXyBdP3R0cw==');
  const files = git('ls-files', '-z').toString('utf8').split('\0').filter(Boolean);
  let scanned = 0;
  for (const f of files) {
    if (skipDir.test(f) || skipPage.test(f) || skipFile.test(f) || f.startsWith('.github/')) continue;
    if (/\.(html|js|mjs|css|json|txt|xml|md|svg|webmanifest)$/i.test(f)) {
      // 글꼴·그림을 글자로 넣은 data: 주소와 긴 base64 덩어리는 우연히 겹치는 글자가 있어 빼고 본다.
      const text = fs.readFileSync(f, 'utf8').replace(/data:[^"')\s]+/g, '').replace(/[A-Za-z0-9+/=]{300,}/g, '');
      const m = text.match(words);
      scanned++;
      if (m) fail('도구 이름', `${f}: “${text.slice(Math.max(0, m.index - 30), m.index + 40).replace(/\s+/g, ' ')}”`);
    } else if (/\.mp3$/i.test(f)) {
      const head = fs.readFileSync(f).subarray(0, 8192).toString('latin1');
      scanned++;
      const m = head.match(tagWords);
      if (head.startsWith('ID3') && m) fail('도구 이름', `${f}: MP3 태그에 “${m[0]}”`);
    }
  }
  console.log(`  파일 ${scanned}개 봄`);
}

const browser = await chromium.launch(ci
  ? {headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required']}
  : {channel: 'chrome', headless: true, args: ['--enable-gpu', '--use-angle=d3d11', '--autoplay-policy=no-user-gesture-required']});
const devices = [
  {name: '컴퓨터', viewport: {width: 1440, height: 900}, deviceScaleFactor: 1},
  {name: '휴대폰', viewport: {width: 390, height: 844}, deviceScaleFactor: 2, isMobile: true, hasTouch: true},
];
const shot = async (page, name) => {
  try { await page.screenshot({path: path.join(out, name.replace(/[^\w.-]+/g, '_') + '.png')}); return null; }
  catch (error) { return `실패 화면 저장 오류: ${String(error).split('\n')[0]}`; }
};
async function open(device, route, readOnly = false) {
  const probe = await createBrowserProbe({browser, base, device, staticPaths, readOnly});
  try { await probe.page.goto(base + route, {waitUntil: 'load', timeout: 90000}); }
  catch (error) { error.probe = probe; throw error; }
  return probe;
}

// A transient static read gets one whole-scenario replay, never just a file re-fetch.
let scenarioId = 0;
async function checkScenario(step, device, route, exercise) {
  const id = `${++scenarioId}-${step}-${device.name}-${route}`.replace(/[^\w.-]+/g, '_');
  const result = await runScenarioCheck({
    base,
    run: async attempt => {
      let probe, exception = null;
      const assertions = [];
      try {
        probe = await open(device, route, attempt > 1);
        await exercise(probe.page, assertions);
      } catch (error) {
        probe ||= error.probe;
        exception = String(error).split('\n')[0].slice(0, 240);
      }
      const observation = probe ? probe.snapshot({assertions, exception}) : {
        bad: [exception || '브라우저를 열지 못함'], httpFailures: [], requestFailures: [], consoleErrors: [],
        pageErrors: [], writeRequests: [], assertions, exception: exception || '브라우저를 열지 못함',
      };
      if (probe && observation.bad.length) {
        const screenshotError = await shot(probe.page, `${id}-attempt-${attempt}`);
        if (screenshotError) { observation.assertions.push(screenshotError); observation.bad.push(screenshotError); }
      }
      await probe?.context.close();
      return observation;
    },
    onAttempt: async (observation, attempt) => {
      if (observation.bad.length || attempt > 1) {
        fs.writeFileSync(path.join(out, `${id}-attempt-${attempt}.json`), JSON.stringify({step, device: device.name, route, attempt, ...observation}, null, 2) + '\n');
      }
    },
  });
  if (result.recovered) {
    const initial = result.attempts[0].httpFailures.map(f => `${f.status} ${new URL(f.url).pathname}`).join(', ');
    const note = `${device.name} ${route}: 첫 ${initial} → 새 화면 전체 재검사 1회 통과 (첫 실패 증거 보존)`;
    notes.push(note);
    recoveredScenarios.push({step, device: device.name, route, evidencePrefix: id, attempts: result.attempts.length});
    console.log(`  △ ${note}`);
    if (ci) console.log(`::warning::${note.replace(/%/g, '%25').replace(/\r/g, '%0D').replace(/\n/g, '%0A')}`);
  } else if (!result.ok) {
    fail(step, `${device.name} ${route}: ${result.attempts.at(-1).bad.slice(0, 3).join(' | ')}${result.attempts.length > 1 ? ' (재검사도 실패)' : ''}`);
  }
}

// 3. 페이지
console.log('3. 페이지');
// 저장소의 두 단계 아래까지 있는 index.html이 페이지다. 게임(try/)은 4단계에서 따로 보고, 로그인 흐름(id/·id-rehearsal/)과
// 회의 안내(brief/)는 들어오는 조건이 따로 있어 뺀다.
const routes = git('ls-files', '-z').toString('utf8').split('\0')
  .filter(f => /^(?:[^/]+\/){0,2}index\.html$/.test(f) && !/^(try|id|id-rehearsal|brief)\//.test(f))
  .map(f => '/' + f.replace(/index\.html$/, ''));
for (const device of devices) for (const route of routes) {
  await checkScenario('페이지', device, route, async (page, assertions) => {
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 800) { await page.evaluate(v => window.scrollTo(0, v), y); await page.waitForTimeout(40); }
    await page.waitForTimeout(800);
    const wide = await page.evaluate(() => ({inner: innerWidth, visual: Math.round(visualViewport.width), scroll: document.documentElement.scrollWidth}));
    const overflow = wide.scroll > wide.inner + 1 || wide.inner > wide.visual + 1;
    if (overflow) assertions.push(`가로 넘침 ${wide.scroll}/${wide.inner}/${wide.visual}`);
  });
}
console.log(`  ${routes.length}쪽 × ${devices.length}기기`);

// 4. LAB 게임 — 게임 카드에서 게임 목록을 읽는다. 10-05부터 카드는 게임으로 가는 링크 없이 플레이 장면 창만 연다(게임은 /try/<id>/에 그대로 둔다).
// 게임마다 시작 단추는 아래 표로 정한다(새 게임은 여기에 더한다).
console.log('4. LAB 게임');
const startOf = {racing: '#watch', rhythm: '#start-button', runner: '#start', 'order-rush': '#start', 'story-classroom': '#start', 'entry-check': '#rec-start', 'blank-slice': '#btn-start', 'talk-rally': '#btn-start'};
let games = [];
{
  const s = await open(devices[0], '/lab/');
  games = await s.page.evaluate(() => Promise.all([...document.querySelectorAll('article.game-card[data-game]')].map(async a => ({id: a.dataset.game, href: `/try/${a.dataset.game}/`, video: a.dataset.video || '', videoOk: a.dataset.video ? (await fetch(a.dataset.video, {method: 'HEAD', cache: 'no-store'}).catch(() => ({ok: false}))).ok : false}))));
  await s.context.close();
  if (!games.length) fail('게임', 'LAB 페이지에서 게임 카드를 못 찾음');
  for (const g of games) if (!g.videoOk) fail('게임', `LAB 카드 ${g.id}: 플레이 장면 영상 ${g.video || '(주소 없음)'}을 못 받음`);
}
for (const device of devices) for (const game of games) {
  await checkScenario('게임', device, game.href, async page => {
    await page.waitForTimeout(1500);
    const start = startOf[game.id];
    if (!start) notes.push(`${game.id}: 시작 단추를 몰라 열기만 확인함`);
    else {
      await page.waitForSelector(`${start}:not([disabled])`, {state: 'visible', timeout: 90000});
      await page.click(start, {timeout: 10000});
      await page.waitForTimeout(8000);
    }
  });
}
console.log(`  게임 ${games.length}개 × ${devices.length}기기`);

// 5. 질문창
console.log('5. 질문창');
{
  let s;
  try {
    s = await open(devices[0], '/lab/');
    const before = await s.page.locator('#messages > *').count();
    await s.page.evaluate(q => { const input = document.querySelector('#question'); input.value = q; input.dispatchEvent(new Event('input', {bubbles: true})); document.querySelector('#question-form').requestSubmit(); }, 'SYNK LAB은 무엇을 하나요?');
    await s.page.waitForFunction(n => document.querySelectorAll('#messages > *').length >= n + 2, before, {timeout: 20000});
    const answer = await s.page.evaluate(() => { const all = document.querySelectorAll('#messages > *'); return all[all.length - 1].innerText.replace(/\s+/g, ' ').trim(); });
    if (answer.length < 30) fail('질문창', `답이 너무 짧음: ${answer}`);
    if (s.errors.length) fail('질문창', s.errors.slice(0, 2).join(' | '));
    console.log(`  답: ${answer.slice(0, 60)}…`);
  } catch (e) { fail('질문창', String(e).split('\n')[0].slice(0, 140)); }
  await s?.context.close();
}
await browser.close();

const status = problems.length ? 'failed' : recoveredScenarios.length ? 'transient-recovered' : 'passed';
fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify({status, checkedAt: new Date().toISOString(), problems, notes, recoveredScenarios}, null, 2) + '\n');
const summary = [`## synk.im 배포 점검 ${problems.length ? `— 문제 ${problems.length}개` : recoveredScenarios.length ? `— 일시 오류 ${recoveredScenarios.length}개 재검사로 복구` : '— 문제 없음'}`, '',
  ...(problems.length ? problems.map(p => `- ${p}`) : ['- 반영, 도구 이름, 페이지, LAB 게임, 질문창 모두 통과']),
  ...(notes.length ? ['', ...notes.map(n => `- 참고: ${n}`)] : [])].join('\n');
if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
console.log('\n' + summary);
process.exit(problems.length ? 1 : 0);
