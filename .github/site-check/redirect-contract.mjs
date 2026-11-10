// Public compatibility URLs have their own contract. Their destination application
// is not a static synk.im page and must not be booted by this anonymous site check.
export const REDIRECT_CONTRACTS = Object.freeze([
  Object.freeze({path: '/pulse-app/', destination: 'https://workspace.synk.im/pulse-app/', script: '/assets/v10/pulse-redirect.js'}),
]);
export const REDIRECT_CASES = Object.freeze([
  Object.freeze({search: '', hash: ''}),
  Object.freeze({search: '?demo=film', hash: ''}),
  Object.freeze({search: '', hash: '#invite=site-check%2Fsynthetic'}),
  Object.freeze({search: '?demo=film&next=https%3A%2F%2Fexample.invalid%2F', hash: '#invite=site-check%2Fsynthetic'}),
]);

export function splitPageRoutes(routes) {
  for (const contract of REDIRECT_CONTRACTS) {
    if (!routes.includes(contract.path)) throw new Error(`Missing redirect entry: ${contract.path}`);
  }
  const aliases = new Set(REDIRECT_CONTRACTS.map(c => c.path));
  return {pages: routes.filter(route => !aliases.has(route)), redirects: [...REDIRECT_CONTRACTS]};
}

export function redirectDestination(contract, {search = '', hash = ''} = {}) {
  const destination = new URL(contract.destination);
  destination.search = search;
  destination.hash = hash;
  return destination.href;
}

const withoutHash = value => { const url = new URL(value); url.hash = ''; return url.href; };
const neutralDocument = '<!doctype html><html lang="en"><head><title>Redirect contract destination</title><link rel="icon" href="data:,"></head><body><p id="redirect-contract-arrival">Destination intercepted for the redirect contract only.</p></body></html>';

export async function checkRedirectContract({browser, base, device, contract, search = '', hash = '', javaScriptEnabled = true, timeout = 15000}) {
  const source = new URL(contract.path, base);
  source.search = search; source.hash = hash;
  const expected = redirectDestination(contract, {search, hash});
  const scriptUrl = new URL(contract.script, base).href;
  const issues = [], arrivals = [];
  let sourceStatus = null, scriptStatus = null, actual = null, fallback = null;
  const context = await browser.newContext({...device, serviceWorkers: 'block', javaScriptEnabled});
  try {
    const page = await context.newPage();
    // No credentials are supplied, and no write or unexpected external request
    // can leave this context. Only the exact destination's main document is fake.
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['GET', 'HEAD'].includes(request.method())) {
        issues.push(`Write blocked: ${request.method()} ${url.href}`);
        return route.abort('blockedbyclient');
      }
      if (url.origin === source.origin) return route.continue();
      if (javaScriptEnabled && request.method() === 'GET' && request.isNavigationRequest()
        && request.frame() === page.mainFrame() && url.href === withoutHash(expected)) {
        arrivals.push(url.href);
        return route.fulfill({status: 200, contentType: 'text/html; charset=utf-8', body: neutralDocument});
      }
      issues.push(`Unexpected external request: ${url.href}`);
      return route.abort('blockedbyclient');
    });
    context.on('response', response => {
      const url = new URL(response.url()), status = response.status();
      if (withoutHash(url.href) === withoutHash(source.href)) sourceStatus = status;
      if (url.href === scriptUrl) scriptStatus = status;
      if (url.origin === source.origin && status >= 400 && url.pathname !== '/favicon.ico') issues.push(`HTTP ${status} ${url.href}`);
    });
    context.on('requestfailed', request => {
      const failure = request.failure()?.errorText || 'request failed';
      if (!/ERR_ABORTED/.test(failure)) issues.push(`Request failed: ${request.url()} ${failure}`);
    });
    page.on('pageerror', error => issues.push(`Page error: ${String(error)}`));
    page.on('console', message => {
      if (message.type() === 'error' && !/\/favicon\.ico(?:\?|$)/.test(message.location()?.url || '')) issues.push(`Console error: ${message.text()}`);
    });
    try {
      await page.goto(source.href, {waitUntil: 'load', timeout});
      if (javaScriptEnabled) {
        await page.waitForURL(expected, {waitUntil: 'load', timeout});
        await page.waitForSelector('#redirect-contract-arrival', {state: 'attached', timeout});
        actual = page.url();
        if (actual !== expected) issues.push(`Destination mismatch: ${actual}`);
        if (arrivals.length !== 1) issues.push(`Expected one main-document arrival, got ${arrivals.length}`);
        if (scriptStatus !== 200) issues.push(`Redirect script did not load: ${scriptStatus}`);
      } else {
        actual = page.url();
        fallback = await page.evaluate(() => ({
          link: document.querySelector('#pulse-link')?.href || '',
          text: document.querySelector('#pulse-link')?.textContent.trim() || '',
          canonical: document.querySelector('link[rel="canonical"]')?.href || '',
          robots: document.querySelector('meta[name="robots"]')?.content || '',
        }));
        if (actual !== source.href) issues.push(`No-script page navigated: ${actual}`);
        if (fallback.link !== contract.destination || !fallback.text) issues.push('Missing or incorrect no-script link');
        if (fallback.canonical !== contract.destination) issues.push('Incorrect canonical destination');
        if (!fallback.robots.split(/\s*,\s*/).includes('noindex')) issues.push('Alias is not marked noindex');
      }
    } catch (error) { issues.push(String(error).split('\n')[0].slice(0, 240)); }
    if (sourceStatus !== 200) issues.push(`Alias HTML did not load: ${sourceStatus}`);
    return {ok: issues.length === 0, route: contract.path, device: device.name, mode: javaScriptEnabled ? 'redirect' : 'no-script',
      search, hash, expected: javaScriptEnabled ? expected : source.href, actual, sourceStatus, scriptStatus, arrivals, fallback, issues};
  } finally { await context.close(); }
}
