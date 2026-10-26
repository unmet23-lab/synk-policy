// 기준 이미지·접근성(2026-10-21). 쪽마다 컴퓨터·휴대폰 전체 화면을 찍어 baseline/의 기준 그림과 odiff로 견주고,
// axe로 접근성 규칙을 재어 기준(baseline/axe.json)에 없던 위반을 센다.
// 기준은 이 점검이 바꾸지 않는다. 의도한 변경일 때만 SYNK-appsscript의 `node tools/공개.js 기준 …`이
// 이 점검이 남긴 그 회차 캡처(아티팩트 site-check-shots)를 골라 기준으로 올린다.
// 그림: 컴퓨터 0.5배(720px 폭)·휴대폰 1배(390px 폭) JPEG, 높이 12000px까지 — 33쪽 × 2기기 한 벌이 14MB 안팎(10-21 실측).
// 한 번에 찍는 높이는 장치 화소 8192까지다(10-26) — CI 실행기의 소프트웨어 GPU(SwiftShader)는 그보다 긴 전체 화면을 8192행부터
// 쪽 머리로 되풀이해 찍는다. 그보다 긴 그림(휴대폰의 긴 쪽)은 고르게 나눠 PNG로 찍고 그 쪽에서 떼어 둔 캔버스로 이어 JPEG 한 장으로 만든다.
// 흔들림: 두 번 잇달아 같은 그림이 나올 때까지(최대 6번) 찍고, 끝내 같지 않으면 견주지 않고 「흔들림」으로 남긴다
// (10-21 두 회차 견줌에서 /world/는 한 번은 검은 화면, 한 번은 첫 그림이었다). 동영상·캔버스·iframe은 분홍 상자로 가린다.
// 새로 생긴 치명(critical) 접근성 위반만 점검을 실패시키고, 그림 차이와 나머지 위반은 보고만 한다.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const VISUAL_DEVICES = [
  {key: 'desktop', name: '컴퓨터', options: {viewport: {width: 1440, height: 900}, deviceScaleFactor: 0.5}},
  {key: 'mobile', name: '휴대폰', options: {viewport: {width: 390, height: 844}, deviceScaleFactor: 1, isMobile: true, hasTouch: true}},
];
export const FIXED_TIME = '2026-10-01T10:00:00+09:00';
export const MAX_HEIGHT = 12000;
export const TILE_LIMIT = 8192;
export const JPEG_QUALITY = 70;
// 이보다 작은 차이는 같은 것으로 본다 — 10-21 두 회차 견줌에서 흔들리지 않은 쪽의 차이는 모두 0.01% 아래(글자 가장자리 몇십 화소)였다.
export const CHANGE_PERCENT = 0.05;
export const IMPACTS = ['critical', 'serious', 'moderate', 'minor'];
export const IMPACT_NAME = {critical: '치명', serious: '심각', moderate: '보통', minor: '가벼움'};
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export const slugOf = route => route === '/' ? 'home' : route.replace(/^\/+|\/+$/g, '').replace(/\//g, '~');
export const shotFile = (route, device) => `${device}/${slugOf(route)}.jpg`;
export const deviceName = key => VISUAL_DEVICES.find(d => d.key === key)?.name || key;

/** 글꼴·늦게 뜨는 그림을 기다리고 끝까지 한 번 훑는다(스크롤로 나타나는 지면). */
export async function settle(page) {
  await page.waitForLoadState('networkidle', {timeout: 10000}).catch(() => {});
  await page.evaluate(async () => {
    await document.fonts?.ready;
    const end = Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0);
    for (let y = 0; y < end; y += Math.max(400, innerHeight * 0.8)) { scrollTo(0, y); await new Promise(r => setTimeout(r, 40)); }
    scrollTo(0, 0);
    await Promise.all([...document.images].filter(i => !i.complete).map(i => new Promise(r => {
      i.addEventListener('load', r, {once: true}); i.addEventListener('error', r, {once: true}); setTimeout(r, 4000);
    })));
  }).catch(() => {});
  await page.waitForLoadState('networkidle', {timeout: 5000}).catch(() => {});
}

/** 위에서 height(CSS px)까지를 scale배로 찍을 조각: 조각마다 장치 화소 limit 아래가 되게 고르게 나눈다(짧으면 한 조각). */
export function tilesOf(height, scale, limit = TILE_LIMIT) {
  const count = Math.max(1, Math.ceil(height * scale / limit));
  const step = Math.ceil(height / count);
  const tiles = [];
  for (let y = 0; y < height; y += step) tiles.push({y, height: Math.min(step, height - y)});
  return tiles;
}

/** 두 번 잇달아 같은 그림이 나올 때까지 찍는다. 끝내 같지 않으면 unstable. shoot은 Buffer나 Buffer 배열(나눠 찍은 조각)을 낸다. */
export async function stableShot(page, shoot, {tries = 6, gap = 500} = {}) {
  const parts = x => Array.isArray(x) ? x : [x];
  const same = (a, b) => parts(a).length === parts(b).length && parts(a).every((x, i) => x.equals(parts(b)[i]));
  let last = await shoot();
  for (let i = 1; i < tries; i++) {
    await page.waitForTimeout(gap);
    const next = await shoot();
    if (same(next, last)) return {image: next, unstable: false, shots: i + 1};
    last = next;
  }
  return {image: last, unstable: true, shots: tries};
}

/**
 * 나눠 찍은 쪽의 resize 흔적을 지운다. 실행기 브라우저는 조각을 찍거나 같은 브라우저에 새 쪽을 열 때 가끔 쪽을 4×4로 resize했다가
 * 되돌리는데, 되돌리는 resize 때 배치가 아직 낡아 resize마다 넘침을 재는 쪽 스크립트가 엉뚱하게 판정한다(10-27 진단 —
 * /path/ 휴대폰 가로 칸의 tabindex가 빠져 axe scrollable-region-focusable). 배치가 자리 잡은 뒤 지금 크기로 resize를 한 번 더 보낸다.
 */
export async function replayResize(page) {
  await page.evaluate(() => new Promise(done => {
    const timer = setTimeout(done, 1500);
    const frame = f => requestAnimationFrame(() => requestAnimationFrame(f));
    frame(() => { dispatchEvent(new Event('resize')); frame(() => { clearTimeout(timer); done(); }); });
  })).catch(() => {});
}

/**
 * 나눠 찍은 PNG 조각을 찍은 그 쪽에서, 문서에 붙이지 않은 캔버스에 위아래로 잇고 JPEG로 굽는다(쪽의 화면은 건드리지 않는다).
 * 같은 브라우저에 새 쪽을 열지 않는다 — 열면 위의 4×4 resize가 더 잦다(10-27 진단).
 */
export async function stitchJpeg(page, tiles, quality = JPEG_QUALITY) {
  const data = await page.evaluate(async ({tiles, quality}) => {
    const images = await Promise.all(tiles.map(b64 => createImageBitmap(new Blob([Uint8Array.from(atob(b64), c => c.charCodeAt(0))], {type: 'image/png'}),
      {colorSpaceConversion: 'none', premultiplyAlpha: 'none'})));
    const canvas = document.createElement('canvas');
    canvas.width = images[0].width;
    canvas.height = images.reduce((sum, image) => sum + image.height, 0);
    const g = canvas.getContext('2d');
    let y = 0;
    for (const image of images) { g.drawImage(image, 0, y); y += image.height; image.close(); }
    return canvas.toDataURL('image/jpeg', quality / 100).split(',')[1];
  }, {tiles: tiles.map(b => b.toString('base64')), quality});
  return Buffer.from(data, 'base64');
}

/** axe 위반: CSP가 인라인 스크립트를 막는 쪽(/care/·/fortune/)이 있어 script 태그가 아니라 evaluate로 넣는다(10-21). */
export async function runAxe(page, axeSource) {
  await page.evaluate(axeSource);
  return page.evaluate(async () => (await window.axe.run(document, {resultTypes: ['violations']})).violations
    .map(v => ({id: v.id, impact: v.impact || 'minor', count: v.nodes.length, targets: v.nodes.slice(0, 3).map(n => String(n.target?.[0] ?? '').slice(0, 120))})));
}

/** 한 쪽·한 기기: 새 context(고정 시각·움직임 줄임)에서 열어 그림 한 장과 axe 결과를 낸다. */
export async function capturePage({browser, base, route, device, shotsDir, axeSource}) {
  const context = await browser.newContext({...device.options, serviceWorkers: 'block', reducedMotion: 'reduce', locale: 'ko-KR', timezoneId: 'Asia/Seoul'});
  try {
    await context.clock.setFixedTime(new Date(FIXED_TIME));
    const page = await context.newPage();
    await page.goto(base + route, {waitUntil: 'load', timeout: 90000});
    await settle(page);
    const height = await page.evaluate(() => Math.max(document.documentElement.scrollHeight, document.body?.scrollHeight || 0));
    const clipHeight = Math.min(height, MAX_HEIGHT);
    const width = device.options.viewport.width;
    const common = {fullPage: true, animations: 'disabled', caret: 'hide', mask: [page.locator('video, canvas, iframe')], maskColor: '#FF00FF'};
    const tiles = tilesOf(clipHeight, device.options.deviceScaleFactor);
    const shoot = tiles.length === 1
      ? () => page.screenshot({type: 'jpeg', quality: JPEG_QUALITY, ...common, clip: {x: 0, y: 0, width, height: clipHeight}})
      : async () => { const parts = []; for (const t of tiles) parts.push(await page.screenshot({type: 'png', ...common, clip: {x: 0, y: t.y, width, height: t.height}})); return parts; };
    let {image, unstable, shots} = await stableShot(page, shoot);
    if (tiles.length > 1) await replayResize(page);
    let axe = null, axeError = null;
    if (axeSource) { try { axe = await runAxe(page, axeSource); } catch (error) { axeError = String(error).split('\n')[0].slice(0, 200); } }
    // 잇기는 쪽 화면을 건드리지 않지만 재는 일(axe)을 먼저 둔다.
    if (tiles.length > 1) image = await stitchJpeg(page, image);
    const file = shotFile(route, device.key);
    fs.mkdirSync(path.dirname(path.join(shotsDir, file)), {recursive: true});
    fs.writeFileSync(path.join(shotsDir, file), image);
    return {route, device: device.key, shot: {file, sha256: sha(image), bytes: image.length, cssHeight: height, clipped: height > MAX_HEIGHT, tiles: tiles.length}, unstable, shots, axe, axeError};
  } finally { await context.close(); }
}

/**
 * odiff 결과 하나를 가른다: same | changed | layout | missing(기준 없음). odiff-bin 4.5.0은 크기가 다른 그림도 layout-diff가 아니라
 * 겹치는 곳을 견주고 남는 줄을 모두 차이로 센 pixel-diff로 돌려준다(10-22 확인: 40×40과 40×60 → pixel-diff 33%) — 높이가 바뀐 쪽은 changed로 오고 퍼센트에 그 줄이 든다.
 */
export function classify(result, {threshold = CHANGE_PERCENT} = {}) {
  if (!result) return 'missing';
  if (result.match) return 'same';
  if (result.reason === 'layout-diff') return 'layout';
  if (result.reason === 'file-not-exists') return 'missing';
  return (result.diffPercentage ?? 100) >= threshold ? 'changed' : 'same';
}

/** 기준 axe(쪽|기기 → 규칙 → 곳 수)와 견줘 새로 생기거나 늘어난 위반만. */
export function compareAxe(current, baseline) {
  const fresh = [];
  let known = 0;
  for (const [key, rules] of Object.entries(current)) {
    const before = baseline?.[key] || {};
    for (const [id, v] of Object.entries(rules)) {
      const was = before[id]?.count ?? 0;
      if (v.count > was) fresh.push({key, id, impact: v.impact, count: v.count, was, targets: v.targets || []});
      else known++;
    }
  }
  return {fresh: fresh.sort((a, b) => IMPACTS.indexOf(a.impact) - IMPACTS.indexOf(b.impact) || a.key.localeCompare(b.key)), known};
}

/** 쪽|기기 → 규칙 → {impact, count, targets} (기준 axe.json의 꼴). */
export function axeTable(pages) {
  const table = {};
  for (const p of pages) if (p.axe) table[`${p.route}|${p.device}`] = Object.fromEntries(p.axe.map(v => [v.id, {impact: v.impact, count: v.count, targets: v.targets}]));
  return table;
}

/** 이 회차 캡처의 목록(기준 manifest.json과 같은 꼴). */
export function shotsManifest(pages, {commit = null, run = null, env = {}} = {}) {
  const shots = {};
  for (const p of pages) if (p.shot && !p.unstable) (shots[p.route] ||= {})[p.device] = {file: p.shot.file, sha256: p.shot.sha256, cssHeight: p.shot.cssHeight};
  return {createdAt: new Date().toISOString(), commit, run, env, shots};
}

/** 요약 줄(마크다운). */
export function summaryLines(visual, a11y) {
  const lines = [];
  if (visual) {
    const who = x => `${x.route} ${deviceName(x.device)}`;
    if (!visual.baseline) lines.push(`- 기준 이미지가 아직 없다 — 이 회차 캡처(site-check-shots)를 \`node tools/공개.js 기준 --전부\`로 기준으로 올린다`);
    else {
      const from = visual.baseline.commit ? visual.baseline.commit.slice(0, 7) : visual.baseline.createdAt ? visual.baseline.createdAt.slice(0, 10) : '?';
      const 높이바뀜 = x => Array.isArray(x.height) && x.height[0] != null && x.height[0] !== x.height[1];
      const 높이수 = visual.changed.filter(높이바뀜).length;
      lines.push(`- 기준(${from}${visual.baseline.run ? ` · 실행 ${visual.baseline.run}` : ''})과 견줌: 쪽 ${visual.checked}장 · 같음 ${visual.same}${visual.tiny?.length ? `(그중 ${CHANGE_PERCENT}% 미만 작은 차이 ${visual.tiny.length})` : ''} · 달라짐 ${visual.changed.length}${높이수 ? `(그중 높이 바뀜 ${높이수})` : ''}${visual.layout.length ? ` · 크기만 다름 ${visual.layout.length}` : ''} · 기준 없음 ${visual.missing.length} · 흔들림 ${visual.unstable.length}`);
      for (const x of visual.changed.slice(0, 20)) lines.push(`  - 달라짐 ${who(x)} ${x.percent.toFixed(2)}%${x.rows ? ` (위에서 ${x.rows[0]}~${x.rows[1]}px)` : ''}${높이바뀜(x) ? ` · 높이 ${x.height[0]}→${x.height[1]}px(늘거나 준 줄도 차이로 센다)` : ''}`);
      for (const x of visual.layout.slice(0, 10)) lines.push(`  - 크기만 다름 ${who(x)} · 높이 ${x.height ? `${x.height[0]}→${x.height[1]}` : '?'}`);
      if (visual.missing.length) lines.push(`  - 기준 없음(새 쪽): ${visual.missing.slice(0, 10).map(who).join(', ')}`);
      if (visual.removed.length) lines.push(`  - 기준에만 있음(없어진 쪽): ${visual.removed.slice(0, 10).map(who).join(', ')}`);
      if (visual.envChanged) lines.push(`  - 점검 환경이 기준과 다르다(${visual.envChanged}) — 모든 쪽이 조금씩 달라질 수 있다`);
      const update = `node tools/공개.js 기준${visual.run ? ` --점검 ${visual.run}` : ''} <쪽 경로…>`;
      if (visual.changed.length || visual.layout.length) lines.push(`  - 의도한 변경이면 \`${update}\`로 그 쪽만 기준을 바꾼다. 차이 그림은 아티팩트 site-check-screens의 visual/`);
    }
    if (visual.unstable.length) lines.push(`- 흔들림(두 번 잇달아 같은 그림이 안 나와 견주지 않음): ${visual.unstable.slice(0, 10).map(who).join(', ')}`);
    for (const e of visual.errors.slice(0, 5)) lines.push(`- 캡처 오류: ${e}`);
  }
  if (a11y) {
    const by = impact => a11y.fresh.filter(x => x.impact === impact).length;
    lines.push(`- 접근성(axe): ${a11y.baseline ? '기준에 없던 위반' : '기준 없음 — 지금 위반'} 치명 ${by('critical')} · 심각 ${by('serious')} · 보통 ${by('moderate')} · 가벼움 ${by('minor')}${a11y.baseline ? ` / 알던 것 ${a11y.known}` : ''} (쪽 ${a11y.checked}장)`);
    for (const x of a11y.fresh.slice(0, 15)) {
      const [route, device] = x.key.split('|');
      lines.push(`  - ${IMPACT_NAME[x.impact] || x.impact} ${x.id} ${route} ${deviceName(device)} ${x.was}→${x.count}곳${x.targets.length ? ` · 예: ${x.targets.slice(0, 2).join(' , ')}` : ''}`);
    }
    for (const e of a11y.errors.slice(0, 5)) lines.push(`- axe 오류: ${e}`);
  }
  return lines;
}

/**
 * 6단계 전체: 쪽마다 찍고 기준과 견준다. 기준 폴더에 manifest.json이 없으면 견주지 않고 이 회차 캡처만 남긴다.
 * 반환 {visual, a11y} — result.json에 그대로 싣는다. 새 치명 위반은 onCritical로 알린다(점검 실패).
 */
export async function runVisualCheck({browser, base, routes, baselineDir, shotsDir, diffDir, odiff, axeSource, env = {}, commit = null, run = null, log = () => {}, onCritical = () => {}}) {
  fs.rmSync(shotsDir, {recursive: true, force: true});
  fs.mkdirSync(shotsDir, {recursive: true});
  const read = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
  const baseline = read(path.join(baselineDir, 'manifest.json'));
  const baseAxe = read(path.join(baselineDir, 'axe.json'));
  const pages = [], errors = [], failed = new Set();
  for (const device of VISUAL_DEVICES) for (const route of routes) {
    try { pages.push(await capturePage({browser, base, route, device, shotsDir, axeSource})); }
    catch (error) { failed.add(`${route}|${device.key}`); errors.push(`${route} ${device.name}: ${String(error).split('\n')[0].slice(0, 200)}`); }
  }
  const visual = {baseline: baseline ? {commit: baseline.commit, run: baseline.run, createdAt: baseline.createdAt} : null, run, checked: pages.length,
    same: 0, tiny: [], changed: [], layout: [], missing: [], unstable: [], removed: [], errors, envChanged: null};
  if (baseline && JSON.stringify(baseline.env || {}) !== JSON.stringify(env)) {
    visual.envChanged = Object.keys({...baseline.env, ...env}).filter(k => (baseline.env || {})[k] !== env[k]).map(k => `${k} ${(baseline.env || {})[k] ?? '-'}→${env[k] ?? '-'}`).join(', ');
  }
  for (const p of pages) {
    if (p.unstable) { visual.unstable.push({route: p.route, device: p.device}); continue; }
    const want = baseline?.shots?.[p.route]?.[p.device];
    if (!baseline) continue;
    if (!want) { visual.missing.push({route: p.route, device: p.device}); continue; }
    if (want.sha256 === p.shot.sha256) { visual.same++; continue; }
    const diffFile = path.join(diffDir, p.shot.file.replace(/\.jpg$/, '.png'));
    fs.mkdirSync(path.dirname(diffFile), {recursive: true});
    let result;
    try {
      result = await odiff.compare(path.join(baselineDir, want.file), path.join(shotsDir, p.shot.file), diffFile, {threshold: 0.1, antialiasing: true, captureDiffLines: true, diffOverlay: true, noFailOnFsErrors: true});
    } catch (error) { errors.push(`${p.route} ${deviceName(p.device)} 견주기: ${String(error).split('\n')[0].slice(0, 200)}`); continue; }
    const kind = classify(result);
    const scale = VISUAL_DEVICES.find(d => d.key === p.device).options.deviceScaleFactor;
    const height = [want.cssHeight ?? null, p.shot.cssHeight];
    if (kind === 'same') {
      visual.same++;
      if (!result.match) visual.tiny.push({route: p.route, device: p.device, percent: result.diffPercentage});
      fs.rmSync(diffFile, {force: true});
    }
    else if (kind === 'missing') visual.missing.push({route: p.route, device: p.device});
    else if (kind === 'layout') visual.layout.push({route: p.route, device: p.device, height});
    else visual.changed.push({route: p.route, device: p.device, percent: result.diffPercentage, height,
      ...(result.diffLines?.length ? {rows: [Math.round(result.diffLines[0] / scale), Math.round(result.diffLines.at(-1) / scale)]} : {}),
      diff: path.relative(path.dirname(diffDir), diffFile).split(path.sep).join('/')});
  }
  if (baseline) for (const [route, devices] of Object.entries(baseline.shots || {})) for (const device of Object.keys(devices)) {
    if (!failed.has(`${route}|${device}`) && !pages.some(p => p.route === route && p.device === device)) visual.removed.push({route, device});
  }
  const current = axeTable(pages);
  const {fresh, known} = compareAxe(current, baseAxe);
  const a11y = {baseline: Boolean(baseAxe), checked: pages.filter(p => p.axe).length, fresh, known,
    errors: pages.filter(p => p.axeError).map(p => `${p.route} ${deviceName(p.device)}: ${p.axeError}`)};
  // 새 치명 위반만 실패 — 기준이 없을 때는 지금 위반이 다 새것이라 실패시키지 않는다.
  if (baseAxe) for (const x of fresh.filter(v => v.impact === 'critical')) onCritical(x);
  fs.writeFileSync(path.join(shotsDir, 'manifest.json'), JSON.stringify(shotsManifest(pages, {commit, run, env}), null, 1) + '\n');
  fs.writeFileSync(path.join(shotsDir, 'axe.json'), JSON.stringify(current, null, 1) + '\n');
  // 기준 갱신(공개.js 기준)이 쪽 일부만 바꿀 때 나머지를 잇도록 견준 기준도 같이 남긴다
  if (baseline) fs.writeFileSync(path.join(shotsDir, 'baseline-before.json'), JSON.stringify(baseline, null, 1) + '\n');
  if (baseAxe) fs.writeFileSync(path.join(shotsDir, 'baseline-axe-before.json'), JSON.stringify(baseAxe, null, 1) + '\n');
  log(`  쪽 ${routes.length}개 × ${VISUAL_DEVICES.length}기기 · 찍음 ${pages.length} · 흔들림 ${visual.unstable.length} · 오류 ${errors.length}`);
  return {visual, a11y};
}
