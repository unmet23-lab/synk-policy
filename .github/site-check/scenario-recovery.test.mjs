import test from 'node:test';
import assert from 'node:assert/strict';
import {canRetryScenario, runScenarioCheck} from './scenario-recovery.mjs';

const base = 'https://synk.im';
const url = `${base}/try/rhythm/dist/game.js`;
const clean = () => ({bad: [], httpFailures: [], requestFailures: [], consoleErrors: [],
  pageErrors: [], writeRequests: [], assertions: [], exception: null});
function transient({status = 503, resourceUrl = url, method = 'GET', resourceType = 'script', staticFile = true} = {}) {
  return {...clean(), bad: [`${status} ${resourceUrl}`],
    httpFailures: [{url: resourceUrl, status, method, resourceType, staticFile}],
    consoleErrors: [{url: resourceUrl, text: `Failed to load resource: the server responded with a status of ${status} (Service Unavailable)`}]};
}
async function execute(observations) {
  const calls = [], saved = [], delays = [];
  const result = await runScenarioCheck({base,
    run: async attempt => { calls.push(attempt); return observations[attempt - 1]; },
    onAttempt: async (observation, attempt) => saved.push({attempt, observation: structuredClone(observation)}),
    wait: async delay => delays.push(delay)});
  return {result, calls, saved, delays};
}

test('clean first scenario runs once without a delay', async () => {
  const observation = clean();
  const {result, calls, saved, delays} = await execute([observation]);
  assert.deepEqual(result, {ok: true, recovered: false, attempts: [observation]});
  assert.deepEqual(calls, [1]);
  assert.deepEqual(saved, [{attempt: 1, observation}]);
  assert.deepEqual(delays, []);
});

test('transient static 503 repeats the whole scenario once and preserves the first failure', async () => {
  const first = transient(), second = clean();
  const {result, calls, saved, delays} = await execute([first, second]);
  assert.deepEqual(result, {ok: true, recovered: true, attempts: [first, second]});
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(saved, [{attempt: 1, observation: first}, {attempt: 2, observation: second}]);
  assert.deepEqual(delays, [1500]);
});

test('persistent 503 remains failed after exactly two attempts', async () => {
  const first = transient(), second = transient();
  const {result, calls, saved, delays} = await execute([first, second, clean()]);
  assert.equal(result.ok, false);
  assert.equal(result.recovered, false);
  assert.deepEqual(result.attempts, [first, second]);
  assert.deepEqual(calls, [1, 2]);
  assert.equal(saved.length, 2);
  assert.deepEqual(delays, [1500]);
});

for (const status of [404, 401, 429, 500]) {
  test(`HTTP ${status} is a permanent failure for this check`, async () => {
    const observation = transient({status});
    assert.equal(canRetryScenario(observation, base), false);
    const {result, calls, delays} = await execute([observation, clean()]);
    assert.equal(result.ok, false);
    assert.deepEqual(calls, [1]);
    assert.deepEqual(delays, []);
  });
}

for (const [name, change] of [
  ['POST', observation => { observation.httpFailures[0].method = 'POST'; }],
  ['cross origin', observation => { observation.httpFailures[0].url = 'https://cdn.synk.im/game.js'; }],
  ['lookalike origin', observation => { observation.httpFailures[0].url = 'https://synk.im.evil.test/game.js'; }],
  ['document response', observation => { observation.httpFailures[0].resourceType = 'document'; }],
  ['untracked static file', observation => { observation.httpFailures[0].staticFile = false; }],
  ['missing tracked file proof', observation => { delete observation.httpFailures[0].staticFile; }],
  ['runtime error', observation => { observation.pageErrors.push('TypeError: game.start is not a function'); }],
  ['horizontal overflow', observation => { observation.assertions.push('가로 넘침 720/390/390'); }],
  ['write request', observation => { observation.writeRequests.push({url: `${base}/api/save`, method: 'POST'}); }],
  ['ordinary timeout', observation => { observation.exception = 'TimeoutError: waiting for start button'; }],
  ['unrelated network failure', observation => { observation.requestFailures.push({url: `${base}/assets/other.js`, method: 'GET', error: 'net::ERR_FAILED'}); }],
  ['matching failed request', observation => { observation.requestFailures.push({url, method: 'GET', error: 'net::ERR_ABORTED'}); }],
  ['unrelated console error', observation => { observation.consoleErrors.push({url, text: 'Game failed to initialize'}); }],
  ['console status mismatch', observation => { observation.consoleErrors[0].text = 'Failed to load resource: the server responded with a status of 502 (Bad Gateway)'; }],
  ['console URL mismatch', observation => { observation.consoleErrors[0].url = `${base}/other.js`; }],
  ['console extra error text', observation => { observation.consoleErrors[0].text += '\nTypeError: failed'; }],
  ['missing error origin', observation => { delete observation.consoleErrors[0].url; }],
  ['missing resource type', observation => { delete observation.httpFailures[0].resourceType; }],
  ['unknown resource type', observation => { observation.httpFailures[0].resourceType = 'unknown'; }],
  ['websocket resource', observation => { observation.httpFailures[0].resourceType = 'websocket'; }],
  ['missing diagnostics', observation => { delete observation.assertions; }],
  ['missing exception field', observation => { delete observation.exception; }],
  ['ambiguous status', observation => { observation.httpFailures[0].status = '503'; }],
]) {
  test(`${name} prevents a retry even alongside static 503`, async () => {
    const observation = transient();
    change(observation);
    assert.equal(canRetryScenario(observation, base), false);
    const {result, calls} = await execute([observation, clean()]);
    assert.equal(result.ok, false);
    assert.deepEqual(calls, [1]);
    assert.deepEqual(result.attempts, [observation]);
  });
}

for (const pathname of ['/api/data.json', '/auth/sdk.js', '/oauth/token.json', '/oauth2/client.js',
  '/token/keys.json', '/id/sdk.js', '/id-rehearsal/sdk.js', '/identity/client.js', '/assets/auth-sdk.js',
  '/%61pi/data.json', '/assets%2Fauth%2Fsdk.js', '/%2561pi/data.json', '/api%252Fdata.json',
  '/assets/main.html', '/assets/image', '/assets/malformed%ZZ.js']) {
  test(`sensitive or ambiguous path is excluded: ${pathname}`, () => {
    assert.equal(canRetryScenario(transient({resourceUrl: base + pathname}), base), false);
  });
}

test('only explicitly supported asset extensions and transient HTTP statuses qualify', () => {
  for (const extension of ['js', 'mjs', 'css', 'json', 'wasm', 'mp3', 'wav', 'ogg', 'm4a', 'mp4',
    'webm', 'png', 'jpg', 'jpeg', 'webp', 'avif', 'svg', 'woff', 'woff2', 'ttf', 'otf', 'ico']) {
    for (const status of [502, 503, 504]) {
      assert.equal(canRetryScenario(transient({status, resourceUrl: `${base}/assets/main.${extension}`}), base), true);
    }
  }
  assert.equal(canRetryScenario(transient({method: 'HEAD', resourceType: 'fetch', resourceUrl: `${base}/assets/clip.MP4?v=1`}), new URL(base)), true);
  const noConsoleMessage = transient();
  noConsoleMessage.consoleErrors = [];
  assert.equal(canRetryScenario(noConsoleMessage, base), true);
});

for (const status of [502, 503, 504]) {
  test(`Chromium HTTP ${status} with an empty status description still requires exact URL and status`, async () => {
    const observation = transient({status});
    observation.consoleErrors[0].text = `Failed to load resource: the server responded with a status of ${status} ()`;
    assert.equal(canRetryScenario(observation, base), true);
    const {result, calls} = await execute([observation, clean()]);
    assert.equal(result.ok, true);
    assert.equal(result.recovered, true);
    assert.deepEqual(calls, [1, 2]);
    const differentStatus = structuredClone(observation);
    differentStatus.httpFailures[0].status = status === 502 ? 503 : 502;
    assert.equal(canRetryScenario(differentStatus, base), false);
    const differentUrl = structuredClone(observation);
    differentUrl.consoleErrors[0].url = `${base}/assets/other.js`;
    assert.equal(canRetryScenario(differentUrl, base), false);
  });
}

test('all HTTP failures must be eligible, including failures with no console message', () => {
  const observation = transient();
  observation.httpFailures.push({url: `${base}/assets/missing.css`, method: 'GET', status: 404, resourceType: 'stylesheet', staticFile: true});
  assert.equal(canRetryScenario(observation, base), false);
});

test('ambiguous observations and bases fail conservatively', () => {
  for (const observation of [undefined, null, {}, clean(), {...transient(), bad: []},
    {...transient(), httpFailures: [undefined]}, {...transient(), bad: [undefined]}]) {
    assert.equal(canRetryScenario(observation, base), false);
  }
  for (const invalidBase of [undefined, null, '', '/relative', 'file:///local', 'https://name:secret@synk.im']) {
    assert.equal(canRetryScenario(transient(), invalidBase), false);
  }
});

test('a different error on the second attempt is never hidden by the earlier 503', async () => {
  const first = transient();
  const second = {...clean(), bad: ['ReferenceError: game is not defined'], pageErrors: ['ReferenceError: game is not defined']};
  const {result, calls, saved} = await execute([first, second, clean()]);
  assert.deepEqual(result, {ok: false, recovered: false, attempts: [first, second]});
  assert.deepEqual(calls, [1, 2]);
  assert.equal(saved.length, 2);
});

test('a second attempt that writes remains failed and cannot cause a third run', async () => {
  const second = {...clean(), bad: ['재검사 중 쓰기 요청 차단'],
    writeRequests: [{url: `${base}/api/progress`, method: 'POST'}]};
  const {result, calls} = await execute([transient(), second, clean()]);
  assert.equal(result.ok, false);
  assert.equal(result.recovered, false);
  assert.deepEqual(calls, [1, 2]);
});

test('a second attempt with a write request cannot pass even if its bad list is empty', async () => {
  const second = {...clean(), writeRequests: [{url: `${base}/api/progress`, method: 'POST'}]};
  const {result, calls} = await execute([transient(), second, clean()]);
  assert.equal(result.ok, false);
  assert.equal(result.recovered, false);
  assert.deepEqual(result.attempts[1], second);
  assert.deepEqual(calls, [1, 2]);
});

test('a clean first scenario keeps its existing write behavior and is not repeated', async () => {
  const first = {...clean(), writeRequests: [{url: `${base}/api/progress`, method: 'POST'}]};
  const {result, calls, delays} = await execute([first]);
  assert.deepEqual(result, {ok: true, recovered: false, attempts: [first]});
  assert.deepEqual(calls, [1]);
  assert.deepEqual(delays, []);
});

test('onAttempt is awaited before the delay and next scenario; first snapshot cannot be changed by reuse', async () => {
  const events = [], observation = transient(), original = structuredClone(observation);
  const result = await runScenarioCheck({base, delayMs: 7,
    run: async attempt => {
      events.push(`run${attempt}`);
      if (attempt === 2) Object.assign(observation, clean());
      return observation;
    },
    onAttempt: async (_observation, attempt) => {
      events.push(`save${attempt}`);
      await Promise.resolve();
      events.push(`saved${attempt}`);
    },
    wait: async milliseconds => events.push(`wait${milliseconds}`)});
  assert.deepEqual(events, ['run1', 'save1', 'saved1', 'wait7', 'run2', 'save2', 'saved2']);
  assert.deepEqual(result.attempts, [original, clean()]);
});

test('an unexpected thrown timeout is recorded and never retried', async () => {
  let count = 0;
  const saved = [];
  const result = await runScenarioCheck({base,
    run: async () => { count++; throw new Error('navigation timed out'); },
    onAttempt: async observation => saved.push(observation),
    wait: async () => assert.fail('A thrown exception must not be retried')});
  assert.equal(count, 1);
  assert.equal(result.ok, false);
  assert.equal(result.recovered, false);
  assert.match(result.attempts[0].exception, /navigation timed out/);
  assert.deepEqual(saved, result.attempts);
});

test('artifact persistence failure stops before retrying', async () => {
  let count = 0;
  await assert.rejects(runScenarioCheck({base,
    run: async () => { count++; return transient(); },
    onAttempt: async () => { throw new Error('cannot save first failure'); },
    wait: async () => assert.fail('Unsaved first failure must not be retried')}), /cannot save first failure/);
  assert.equal(count, 1);
});

test('an inconsistent empty bad list cannot turn an HTTP error into success', async () => {
  const observation = transient();
  observation.bad = [];
  const {result, calls} = await execute([observation]);
  assert.equal(result.ok, false);
  assert.deepEqual(calls, [1]);
});

test('malformed observations cannot be reported as a clean pass', async () => {
  for (const observation of [undefined, null, {}, {...clean(), writeRequests: [undefined]}]) {
    const {result, calls} = await execute([observation]);
    assert.equal(result.ok, false);
    assert.deepEqual(calls, [1]);
  }
});
