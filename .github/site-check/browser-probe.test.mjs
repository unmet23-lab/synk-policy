import assert from 'node:assert/strict';
import http from 'node:http';
import {after, before, test} from 'node:test';
import {pathToFileURL} from 'node:url';
import {createBrowserProbe} from './browser-probe.mjs';
import {runScenarioCheck} from './scenario-recovery.mjs';

const {chromium} = await import(process.env.PLAYWRIGHT_MODULE
  ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
let browser;
before(async () => {
  browser = await chromium.launch({headless: true,
    ...(process.platform === 'win32' && process.env.CI !== 'true' ? {channel: 'chrome'} : {})});
});
after(async () => { await browser?.close(); });

// These anonymous fixtures only contact their ephemeral loopback HTTP server.
// The MP3 case verifies a GET for audio bytes; it does not claim playback QA.
async function scenario(t, {status = attempt => attempt === 1 ? 503 : 200,
  asset = 'asset.js', tracked = true, runtimeError = false, writeOn = []} = {}) {
  const counts = {documents: 0, assets: 0, starts: 0, writes: 0};
  const records = [], contexts = [], evidence = [], external = [], waits = [];
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://localhost');
    response.setHeader('Cache-Control', 'no-store');
    if (url.pathname === '/') {
      const attempt = ++counts.documents;
      const audio = asset.endsWith('.mp3');
      response.setHeader('Content-Type', 'text/html; charset=utf-8');
      response.end(`<!doctype html><meta charset="utf-8"><link rel="icon" href="data:,">
        <button id="start">Start</button><script>
          window.fixtureBefore = localStorage.getItem('fixture-marker');
          localStorage.setItem('fixture-marker', 'document-${attempt}');
          window.fixtureDone = false;
          window.fixtureAssetSettled = ${audio ? 'false' : 'true'};
          document.querySelector('#start').addEventListener('click', async () => {
            await fetch('/started?attempt=${attempt}');
            ${writeOn.includes(attempt) ? "await fetch('/save', {method: 'POST', body: 'fixture'}).catch(() => {});" : ''}
            window.fixtureDone = true;
          });
          ${runtimeError ? "throw new Error('fixture runtime failure');" : ''}
        </script>
        ${audio ? `<script>fetch('/${asset}').then(r => r.arrayBuffer()).catch(() => {}).finally(() => { window.fixtureAssetSettled = true; });</script>`
          : `<script src="/${asset}"></script>`}`);
    } else if (url.pathname === `/${asset}`) {
      counts.assets++;
      const code = status(counts.documents);
      response.statusCode = code;
      response.setHeader('Content-Type', asset.endsWith('.mp3') ? 'audio/mpeg' : 'text/javascript');
      response.end(code === 200 ? (asset.endsWith('.mp3') ? Buffer.from('ID3 fixture bytes') : 'window.fixtureScriptLoaded = true;') : 'unavailable');
    } else if (url.pathname === '/started') {
      counts.starts++;
      response.end('started');
    } else if (url.pathname === '/save' && request.method === 'POST') {
      counts.writes++;
      request.resume();
      response.end('saved');
    } else {
      response.statusCode = 404;
      response.end('missing');
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => {
    await Promise.all(contexts.map(context => context.close().catch(() => {})));
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  });
  const base = `http://127.0.0.1:${server.address().port}`;
  const result = await runScenarioCheck({base, delayMs: 0,
    wait: async milliseconds => { waits.push(milliseconds); },
    onAttempt: async (observation, attempt) => { evidence.push({attempt, observation: structuredClone(observation)}); },
    run: async attempt => {
      // The first evidence must exist before any second navigation or button action.
      assert.equal(evidence.length, attempt - 1);
      const probe = await createBrowserProbe({browser, base, device: {viewport: {width: 640, height: 480}},
        staticPaths: new Set(tracked ? [asset] : []), readOnly: attempt === 2});
      contexts.push(probe.context);
      await probe.context.route('**/*', async route => {
        if (new URL(route.request().url()).origin === base) return route.fallback();
        external.push(route.request().url());
        return route.abort('blockedbyclient');
      });
      try {
        await probe.page.goto(base, {waitUntil: 'load', timeout: 10000});
        await probe.page.waitForFunction(() => window.fixtureAssetSettled, undefined, {timeout: 10000});
        await probe.page.click('#start');
        await probe.page.waitForFunction(() => window.fixtureDone, undefined, {timeout: 10000});
        records.push(await probe.page.evaluate(() => ({before: window.fixtureBefore,
          marker: localStorage.getItem('fixture-marker'), done: window.fixtureDone})));
        return probe.snapshot();
      } finally {
        await probe.context.close();
      }
    },
  });
  assert.deepEqual(external, [], 'No fixture may make an external request');
  assert.equal(evidence.length, result.attempts.length);
  assert.deepEqual(evidence.map(item => item.observation), result.attempts, 'Both attempts retain their original evidence');
  return {result, counts, contexts, records, evidence, waits};
}

test('tracked JavaScript 503 then 200 repeats the full scenario in a fresh anonymous context', async t => {
  const {result, counts, contexts, records, evidence, waits} = await scenario(t);
  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(result.attempts.length, 2);
  assert.deepEqual(counts, {documents: 2, assets: 2, starts: 2, writes: 0});
  assert.notEqual(contexts[0], contexts[1]);
  assert.deepEqual(records.map(record => record.before), [null, null]);
  assert.deepEqual(records.map(record => record.marker), ['document-1', 'document-2']);
  assert.equal(evidence[0].observation.httpFailures[0].staticFile, true);
  assert.equal(evidence[0].observation.httpFailures[0].status, 503);
  assert.equal(evidence[0].observation.bad.length > 0, true);
  assert.deepEqual(evidence[1].observation.bad, []);
  assert.deepEqual(waits, [0]);
});

test('tracked MP3 GET 503 then 200 repeats and preserves the audio request evidence', async t => {
  const {result, counts} = await scenario(t, {asset: 'voice/r02.mp3'});
  assert.equal(result.ok, true);
  assert.equal(result.recovered, true);
  assert.equal(counts.starts, 2);
  assert.equal(result.attempts[0].httpFailures[0].method, 'GET');
  assert.equal(result.attempts[0].httpFailures[0].url.endsWith('/voice/r02.mp3'), true);
  assert.equal(result.attempts[0].httpFailures[0].staticFile, true);
});

test('persistent tracked 503 fails after exactly two full attempts', async t => {
  const {result, counts, waits} = await scenario(t, {status: () => 503});
  assert.equal(result.ok, false);
  assert.equal(result.recovered, false);
  assert.equal(result.attempts.length, 2);
  assert.equal(counts.documents, 2);
  assert.equal(counts.starts, 2);
  assert.equal(waits.length, 1);
  assert.deepEqual(result.attempts.map(attempt => attempt.httpFailures[0].status), [503, 503]);
});

test('tracked 404 remains a one-attempt failure', async t => {
  const {result, counts, waits} = await scenario(t, {status: () => 404});
  assert.equal(result.ok, false);
  assert.equal(result.attempts.length, 1);
  assert.equal(counts.starts, 1);
  assert.equal(result.attempts[0].httpFailures[0].status, 404);
  assert.deepEqual(waits, []);
});

test('a runtime error together with a tracked 503 remains a one-attempt failure', async t => {
  const {result, counts} = await scenario(t, {runtimeError: true});
  assert.equal(result.ok, false);
  assert.equal(result.attempts.length, 1);
  assert.equal(counts.starts, 1);
  assert.equal(result.attempts[0].pageErrors.some(error => error.includes('fixture runtime failure')), true);
});

test('a first-attempt POST prevents replay and is sent only once', async t => {
  const {result, counts} = await scenario(t, {writeOn: [1, 2]});
  assert.equal(result.ok, false);
  assert.equal(result.attempts.length, 1);
  assert.equal(counts.starts, 1);
  assert.equal(counts.writes, 1);
  assert.deepEqual(result.attempts[0].writeRequests.map(request => request.method), ['POST']);
});

test('a POST introduced only on the second attempt is blocked before server receipt and fails', async t => {
  const {result, counts} = await scenario(t, {writeOn: [2]});
  assert.equal(result.ok, false);
  assert.equal(result.recovered, false);
  assert.equal(result.attempts.length, 2);
  assert.equal(counts.starts, 2);
  assert.equal(counts.writes, 0);
  assert.deepEqual(result.attempts[1].writeRequests.map(request => request.method), ['POST']);
  assert.equal(result.attempts[1].bad.some(error => error.includes('재검사 쓰기 차단 POST')), true);
});

test('an untracked JavaScript URL with 503 is not eligible for retry', async t => {
  const {result, counts} = await scenario(t, {tracked: false});
  assert.equal(result.ok, false);
  assert.equal(result.attempts.length, 1);
  assert.equal(counts.starts, 1);
  assert.equal(result.attempts[0].httpFailures[0].staticFile, false);
});
