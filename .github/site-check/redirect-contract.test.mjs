import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {REDIRECT_CONTRACTS, REDIRECT_CASES, splitPageRoutes, redirectDestination, checkRedirectContract} from './redirect-contract.mjs';

const script = fs.readFileSync(new URL('../../assets/v10/pulse-redirect.js', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../../pulse-app/index.html', import.meta.url), 'utf8');
const contract = REDIRECT_CONTRACTS[0], base = 'https://synk.im';
const device = {name: 'test', viewport: {width: 390, height: 844}};

// Run the actual published alias script in a VM. The browser-shaped transport is
// only a deterministic request/event fixture; real navigation runs in check.mjs.
function browserFixture(options = {}) {
  const handlers = {}, pageHandlers = {}, mainFrame = {}, calls = [];
  let routing, current = '', marker = false, closed = false, javascript = true;
  const emit = (collection, type, value) => collection[type]?.(value);
  const page = {
    on(type, fn) {pageHandlers[type] = fn;},
    mainFrame() {return mainFrame;},
    url() {return current;},
    async waitForURL(expected) {if (current !== expected) throw new Error(`Wrong destination: ${current}`);},
    async waitForSelector() {if (!marker) throw new Error('Destination not intercepted');},
    async evaluate() {
      const source = options.html ?? html;
      return {
        link: /id="pulse-link" href="([^"]+)"/.exec(source)?.[1] || '',
        text: /id="pulse-link"[^>]*>([^<]+)</.exec(source)?.[1] || '',
        canonical: /rel="canonical" href="([^"]+)"/.exec(source)?.[1] || '',
        robots: /name="robots" content="([^"]+)"/.exec(source)?.[1] || '',
      };
    },
    async goto(url) {
      current = url;
      await request(url, {navigation: true, status: options.sourceStatus ?? 200});
      if (!javascript || options.sourceStatus >= 400) return;
      const scriptUrl = new URL(contract.script, base).href;
      await request(scriptUrl, {status: options.scriptStatus ?? 200});
      if (options.scriptStatus >= 400) return;
      if (options.extra) await request(options.extra.url, options.extra);
      if (options.consoleError) emit(pageHandlers, 'console', {type: () => 'error', text: () => options.consoleError, location: () => ({url: scriptUrl})});
      let navigation;
      const source = new URL(url);
      try {
        vm.runInNewContext(options.script ?? script, {
          URL, window: {location: {search: source.search, hash: source.hash,
            replace(destination) {navigation = request(destination, {navigation: true, iframe: options.iframe});}}},
          document: {querySelector() {return {}; }},
        });
      } catch (error) {emit(pageHandlers, 'pageerror', error);}
      await navigation;
    },
  };
  async function request(href, {method = 'GET', navigation = false, status = 200, iframe = false} = {}) {
    const url = new URL(href); url.hash = '';
    const req = {url: () => url.href, method: () => method, isNavigationRequest: () => navigation,
      frame: () => iframe ? {} : mainFrame, failure: () => ({errorText: 'net::ERR_BLOCKED_BY_CLIENT'})};
    await routing({request: () => req,
      async continue() {calls.push(['continue', url.href]); emit(handlers, 'response', {url: () => url.href, status: () => status});},
      async fulfill(value) {calls.push(['fulfill', url.href]); current = href; marker = value.body.includes('id="redirect-contract-arrival"');},
      async abort() {calls.push(['abort', url.href]); emit(handlers, 'requestfailed', req);},
    });
  }
  return {calls, get closed() {return closed;}, async newContext(settings) {
    javascript = settings.javaScriptEnabled;
    assert.equal(settings.serviceWorkers, 'block');
    return {async newPage() {return page;}, async route(pattern, fn) {assert.equal(pattern, '**/*'); routing = fn;},
      on(type, fn) {handlers[type] = fn;}, async close() {closed = true;}};
  }};
}

async function run(options = {}, variant = {}) {
  const browser = browserFixture(options);
  const result = await checkRedirectContract({browser, base, device, contract, ...variant});
  assert.equal(browser.closed, true, 'isolated context always closes');
  return {result, calls: browser.calls};
}

test('only the registered exact alias leaves the ordinary-page list; a missing alias fails', () => {
  const routes = ['/', '/pulse-app/', '/pulse/', '/pulse-app/other/', '/practice/'];
  assert.deepEqual(splitPageRoutes(routes).pages, ['/', '/pulse/', '/pulse-app/other/', '/practice/']);
  assert.deepEqual(splitPageRoutes(routes).redirects, REDIRECT_CONTRACTS);
  assert.throws(() => splitPageRoutes(['/']), /Missing redirect entry/);
});

for (const variant of REDIRECT_CASES) test(`published redirect preserves ${variant.search || '(no query)'} ${variant.hash || '(no hash)'}`, async () => {
  const {result, calls} = await run({}, variant);
  assert.equal(result.ok, true, result.issues.join('\n'));
  assert.equal(result.actual, redirectDestination(contract, variant));
  assert.equal(result.sourceStatus, 200);
  assert.equal(result.scriptStatus, 200);
  assert.equal(calls.filter(([kind]) => kind === 'fulfill').length, 1);
  assert.ok(!calls.some(([kind, url]) => kind === 'continue' && !url.startsWith(base + '/')), 'no external application request reaches the network');
});

test('no-script fallback stays on the alias and points to its canonical noindex destination', async () => {
  const {result, calls} = await run({}, {javaScriptEnabled: false});
  assert.equal(result.ok, true, result.issues.join('\n'));
  assert.equal(calls.some(([kind]) => kind === 'fulfill'), false);
});

for (const [name, options, variant] of [
  ['alias 404', {sourceStatus: 404}, {}],
  ['script 404', {scriptStatus: 404}, {}],
  ['broken script', {script: 'throw new Error("broken alias")'}, {}],
  ['console failure', {consoleError: 'Unexpected alias failure'}, {}],
  ['wrong host', {script: script.replace('workspace.synk.im', 'example.invalid')}, {}],
  ['wrong path', {script: script.replace('workspace.synk.im/pulse-app/', 'workspace.synk.im/other/')}, {}],
  ['lost query', {script: script.replace('destination.search = window.location.search;', '')}, {search: '?demo=film'}],
  ['lost fragment', {script: script.replace('destination.hash = window.location.hash;', '')}, {hash: '#invite=synthetic'}],
  ['destination iframe', {iframe: true}, {}],
  ['external API read', {extra: {url: 'https://workspace.synk.im/pulse/api/project'}}, {}],
  ['same-origin write', {extra: {url: 'https://synk.im/log', method: 'POST'}}, {}],
  ['external write', {extra: {url: 'https://workspace.synk.im/pulse/api/open', method: 'POST'}}, {}],
  ['source resource failure', {extra: {url: 'https://synk.im/missing.js', status: 404}}, {}],
  ['missing fallback', {html: html.replace('id="pulse-link"', 'id="missing"')}, {javaScriptEnabled: false}],
  ['wrong canonical', {html: html.replace('rel="canonical"', 'rel="alternate"')}, {javaScriptEnabled: false}],
  ['indexable alias', {html: html.replace('noindex,follow', 'index,follow')}, {javaScriptEnabled: false}],
]) test(`${name} cannot pass the redirect contract`, async () => {
  const {result} = await run(options, variant);
  assert.equal(result.ok, false);
  assert.ok(result.issues.length);
});

test('check.mjs executes redirect contracts and records them while preserving ordinary error rules', () => {
  const source = fs.readFileSync(new URL('./check.mjs', import.meta.url), 'utf8');
  assert.match(source, /splitPageRoutes\(discoveredRoutes\)/);
  assert.match(source, /await checkRedirectContract\(/);
  assert.match(source, /if \(!result\.ok\) fail\('호환 이동'/);
  assert.match(source, /redirect-contracts\.json/);
  assert.match(source, /recoveredScenarios, redirectChecks, visual, a11y/);
  assert.match(source, /for \(const device of devices\) for \(const route of routes\)/);
  assert.match(source, /runVisualCheck\(\{browser, base, routes,/);
});
