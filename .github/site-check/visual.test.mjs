import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {createRequire} from 'node:module';
import {after, before, test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {classify, compareAxe, axeTable, shotsManifest, summaryLines, slugOf, shotFile, runVisualCheck, capturePage, replayResize, tilesOf, CHANGE_PERCENT, TILE_LIMIT, VISUAL_DEVICES} from './visual.mjs';

const require = createRequire(import.meta.url);

test('쪽 이름과 그림 자리: / 는 home, 하위 쪽은 ~로 잇는다', () => {
  assert.equal(slugOf('/'), 'home');
  assert.equal(slugOf('/lab/topik4/'), 'lab~topik4');
  assert.equal(shotFile('/en/lab/', 'mobile'), 'mobile/en~lab.jpg');
});

test('나눠 찍기: 장치 화소 8192를 넘는 높이만 고르게 나누고, 조각은 빈틈없이 잇닿는다', () => {
  assert.deepEqual(tilesOf(8192, 1), [{y: 0, height: 8192}]);
  assert.deepEqual(tilesOf(12000, 1), [{y: 0, height: 6000}, {y: 6000, height: 6000}]);
  assert.deepEqual(tilesOf(12000, 0.5), [{y: 0, height: 12000}], '컴퓨터(0.5배)는 12000px까지 한 번에 찍는다');
  for (const [height, scale] of [[8193, 1], [9001, 1], [12000, 1], [24577, 1], [20000, 0.5]]) {
    const tiles = tilesOf(height, scale);
    assert.ok(tiles.length > 1 && tiles.every(t => t.height * scale <= TILE_LIMIT), `${height}px × ${scale}`);
    assert.ok(tiles.every((t, i) => t.y === (i ? tiles[i - 1].y + tiles[i - 1].height : 0)) && tiles.at(-1).y + tiles.at(-1).height === height);
  }
});

test('odiff 결과 가르기: 아주 작은 차이는 같음, 기준 파일이 없으면 기준 없음', () => {
  assert.equal(classify({match: true}), 'same');
  assert.equal(classify({match: false, reason: 'pixel-diff', diffPercentage: CHANGE_PERCENT / 2}), 'same');
  assert.equal(classify({match: false, reason: 'pixel-diff', diffPercentage: 3.2}), 'changed');
  assert.equal(classify({match: false, reason: 'layout-diff'}), 'layout');
  assert.equal(classify({match: false, reason: 'file-not-exists', file: 'x'}), 'missing');
  assert.equal(classify(null), 'missing');
});

test('axe 견주기: 기준에 없던 규칙과 곳 수가 는 규칙만 새것, 무거운 것부터', () => {
  const current = {'/lab/|desktop': {'color-contrast': {impact: 'serious', count: 8, targets: ['.a']}, 'button-name': {impact: 'critical', count: 1, targets: ['#go']}},
    '/|mobile': {region: {impact: 'moderate', count: 2}}};
  const baseline = {'/lab/|desktop': {'color-contrast': {impact: 'serious', count: 6}}, '/|mobile': {region: {impact: 'moderate', count: 3}}};
  const {fresh, known} = compareAxe(current, baseline);
  assert.deepEqual(fresh.map(x => `${x.impact} ${x.id} ${x.was}→${x.count}`), ['critical button-name 0→1', 'serious color-contrast 6→8']);
  assert.equal(known, 1);
  assert.equal(compareAxe(current, null).fresh.length, 3);
});

test('기준 목록: 흔들린 쪽은 기준 후보에 넣지 않는다 · axe 표는 쪽|기기 열쇠', () => {
  const pages = [
    {route: '/', device: 'desktop', shot: {file: 'desktop/home.jpg', sha256: 'a', cssHeight: 900}, unstable: false, axe: [{id: 'region', impact: 'moderate', count: 1, targets: []}]},
    {route: '/', device: 'mobile', shot: {file: 'mobile/home.jpg', sha256: 'b', cssHeight: 1200}, unstable: true, axe: []},
  ];
  const m = shotsManifest(pages, {commit: 'c', run: 7, env: {os: 'ubuntu24'}});
  assert.deepEqual(Object.keys(m.shots['/']), ['desktop']);
  assert.equal(m.run, 7);
  assert.deepEqual(Object.keys(axeTable(pages)), ['/|desktop', '/|mobile']);
});

test('요약 줄: 기준이 없으면 올리는 명령을, 있으면 달라진 쪽과 고르는 명령을 보인다', () => {
  const none = summaryLines({baseline: null, checked: 2, same: 0, changed: [], layout: [], missing: [], unstable: [], removed: [], errors: []}, null);
  assert.match(none.join('\n'), /공개\.js 기준 --전부/);
  const some = summaryLines({baseline: {commit: 'abcdef123', run: 5}, run: 9, checked: 66, same: 64, changed: [{route: '/lab/', device: 'mobile', percent: 3.21, rows: [120, 860], height: [5000, 5100]}],
    layout: [], missing: [], unstable: [{route: '/world/', device: 'desktop'}], removed: [], errors: []},
  {baseline: true, checked: 66, fresh: [{key: '/lab/|desktop', id: 'button-name', impact: 'critical', count: 1, was: 0, targets: ['#go']}], known: 40, errors: []}).join('\n');
  assert.match(some, /달라짐 \/lab\/ 휴대폰 3\.21% \(위에서 120~860px\) · 높이 5000→5100px\(늘거나 준 줄도 차이로 센다\)/);
  assert.match(some, /달라짐 1\(그중 높이 바뀜 1\)/);
  assert.ok(!/크기만 다름/.test(some), 'odiff가 크기 다름을 따로 내지 않으면 그 칸을 보이지 않는다');
  assert.match(some, /`node tools\/공개\.js 기준 --점검 9 <쪽 경로…>`/);
  assert.match(some, /흔들림.*\/world\/ 컴퓨터/);
  assert.match(some, /치명 1 · 심각 0/);
});

// 실제로 찍고 견주기: 이 PC 고리 주소의 작은 쪽 하나. 플레이라이트·odiff가 없으면(손으로 돌릴 때) 건너뛴다.
// 브라우저는 CI 점검(check.mjs)과 같은 SwiftShader로 띄운다 — 긴 그림의 8192행 되풀이가 이 PC에서도 난다.
let browser = null, odiff = null, axeSource = null;
before(async () => {
  try {
    const {chromium} = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
    browser = await chromium.launch({headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
      ...(process.platform === 'win32' && process.env.CI !== 'true' ? {channel: 'chrome'} : {})});
  } catch { /* 아래 시험이 건너뛴다 */ }
  try {
    odiff = require(process.env.ODIFF_MODULE || 'odiff-bin');
    axeSource = fs.readFileSync(process.env.AXE_SOURCE || require.resolve('axe-core/axe.min.js'), 'utf8');
  } catch { /* 아래 시험이 건너뛴다 */ }
});
after(async () => { await browser?.close(); });

test('찍고 견주기: 첫 회차는 기준 없음 → 그 캡처를 기준으로 두면 같음 → 글을 바꾸면 달라짐 · 새 치명 위반만 알린다', async t => {
  if (!browser || !odiff || !axeSource) return t.skip('플레이라이트·odiff·axe-core가 없다');
  let page = '<h1>SYNK</h1><p>첫 판</p>';
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.setHeader('Cache-Control', 'no-store');
    response.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><link rel="icon" href="data:,"><title>시험</title><main style="font:20px sans-serif;padding:40px">${page}</main></html>`);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'site-check-visual-'));
  t.after(() => fs.rmSync(root, {recursive: true, force: true}));
  const dirs = {baselineDir: path.join(root, 'baseline'), shotsDir: path.join(root, 'shots'), diffDir: path.join(root, 'artifacts', 'visual')};
  const run = async () => { const critical = []; const r = await runVisualCheck({browser, base, routes: ['/'], ...dirs, odiff, axeSource, env: {os: 'test'}, onCritical: x => critical.push(x)}); return {...r, critical}; };

  const first = await run();
  assert.equal(first.visual.baseline, null);
  const shots = JSON.parse(fs.readFileSync(path.join(dirs.shotsDir, 'manifest.json'), 'utf8')).shots;
  assert.deepEqual(Object.keys(shots['/']).sort(), ['desktop', 'mobile']);
  fs.cpSync(dirs.shotsDir, dirs.baselineDir, {recursive: true});

  const second = await run();
  assert.equal(second.visual.same, 2);
  assert.equal(second.visual.changed.length, 0);
  assert.equal(second.a11y.fresh.length, 0);

  page = '<h1>SYNK</h1><p>둘째 판 — 글이 바뀌었다</p><button></button>';
  const third = await run();
  assert.deepEqual(third.visual.changed.map(x => x.device).sort(), ['desktop', 'mobile']);
  assert.ok(third.visual.changed.every(x => x.percent > CHANGE_PERCENT && fs.existsSync(path.join(root, 'artifacts', x.diff))));
  assert.ok(third.critical.some(x => x.id === 'button-name'), '이름 없는 단추는 새 치명 위반');
});

test('긴 휴대폰 쪽: 8192px 아래도 그 자리의 화면이 찍히고, 조각 사이에 이음매가 없다', async t => {
  if (!browser) return t.skip('플레이라이트가 없다');
  // 띠마다 색이 다르고(500px) 맨 위는 100vh 머리 — 나눠 찍을 때 화면 높이가 바뀌면 머리 높이가 달라진다.
  const bands = Array.from({length: 20}, (_, i) => `<div style="height:500px;background:hsl(${i * 37 % 360},70%,60%)"></div>`).join('');
  const server = http.createServer((request, response) => {
    response.setHeader('Content-Type', 'text/html; charset=utf-8');
    response.end(`<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><link rel="icon" href="data:,"><title>긴 쪽</title><body style="margin:0"><div style="height:100vh;background:#000"></div>${bands}</body></html>`);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  t.after(() => new Promise(r => server.close(r)));
  const shotsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'site-check-tall-'));
  t.after(() => fs.rmSync(shotsDir, {recursive: true, force: true}));
  const mobile = VISUAL_DEVICES.find(d => d.key === 'mobile');
  const p = await capturePage({browser, base: `http://127.0.0.1:${server.address().port}`, route: '/', device: mobile, shotsDir});
  assert.equal(p.shot.cssHeight, 844 + 20 * 500);
  assert.equal(p.shot.tiles, 2);
  // 찍힌 JPEG를 브라우저에서 풀어, 띠마다 위·가운데·아래 줄의 색을 페이지가 그린 색과 견준다(머리가 밀리면 띠 끝이 어긋난다).
  const page = await browser.newPage();
  t.after(() => page.context().close());
  const {width, height, rows} = await page.evaluate(async b64 => {
    const image = await createImageBitmap(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], {type: 'image/jpeg'}));
    const canvas = Object.assign(document.createElement('canvas'), {width: image.width, height: image.height});
    const g = canvas.getContext('2d', {willReadFrequently: true});
    g.drawImage(image, 0, 0);
    const at = y => [...g.getImageData(195, y, 1, 1).data.slice(0, 3)];
    return {width: image.width, height: image.height, rows: Array.from({length: 20}, (_, i) => [20, 250, 480].map(d => at(844 + i * 500 + d)))};
  }, fs.readFileSync(path.join(shotsDir, p.shot.file)).toString('base64'));
  assert.deepEqual([width, height], [390, 844 + 20 * 500]);
  const want = await page.evaluate(() => Array.from({length: 20}, (_, i) => {
    const probe = Object.assign(document.createElement('canvas'), {width: 1, height: 1}).getContext('2d');
    probe.fillStyle = `hsl(${i * 37 % 360},70%,60%)`; probe.fillRect(0, 0, 1, 1);
    return [...probe.getImageData(0, 0, 1, 1).data.slice(0, 3)];
  }));
  const off = rows.map((band, i) => Math.max(...band.flatMap(c => c.map((v, k) => Math.abs(v - want[i][k])))));
  assert.ok(off.every(d => d <= 12), `띠 색 차이(위에서 띠마다): ${off.join(' ')}`);
});

test('resize 바로잡기: 낡은 배치에서 뗀 tabindex를 쪽의 resize 처리기가 지금 배치로 다시 붙인다', async t => {
  if (!browser) return t.skip('플레이라이트가 없다');
  const page = await browser.newPage({viewport: {width: 390, height: 844}});
  t.after(() => page.context().close());
  // synk.im 가로 칸(site.js [data-scroll-x])과 같은 처리기: 넘치면 tabindex를 붙이고 아니면 뗀다.
  await page.setContent(`<div id="x" style="overflow-x:auto;width:300px"><div style="width:900px;height:20px"></div></div>
    <script>const x = document.getElementById('x'); const sync = () => x.scrollWidth > x.clientWidth + 1 ? x.tabIndex = 0 : x.removeAttribute('tabindex');
    sync(); addEventListener('resize', sync);</script>`);
  // 4×4에서 돌아오는 resize가 낡은 배치로 tabindex를 뗀 때와 같은 상태
  await page.evaluate(() => document.getElementById('x').removeAttribute('tabindex'));
  await replayResize(page);
  assert.equal(await page.evaluate(() => document.getElementById('x').getAttribute('tabindex')), '0');
});
