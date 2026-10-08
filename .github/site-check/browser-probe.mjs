// Fresh anonymous observations; the second attempt cannot send a write request.
export async function createBrowserProbe({browser, base, device, staticPaths, readOnly = false}) {
  const origin = new URL(base).origin;
  const context = await browser.newContext({...device, serviceWorkers: 'block'});
  const failed = [], errors = [];
  const httpFailures = [], requestFailures = [], consoleErrors = [], pageErrors = [], writeRequests = [];
  const sameOrigin = url => { try { return new URL(url).origin === origin; } catch { return false; } };
  const isStatic = url => {
    try {
      const parsed = new URL(url);
      return parsed.origin === origin && staticPaths.has(decodeURIComponent(parsed.pathname).slice(1));
    } catch { return false; }
  };
  const display = url => sameOrigin(url) ? url.slice(origin.length) : url;
  context.on('request', request => {
    if (!['GET', 'HEAD'].includes(request.method())) writeRequests.push({url: request.url(), method: request.method()});
  });
  // Routing covers all pages/popups. Service workers cannot bypass the write guard.
  if (readOnly) await context.route('**/*', route => {
    if (['GET', 'HEAD'].includes(route.request().method())) return route.continue();
    failed.push(`재검사 쓰기 차단 ${route.request().method()} ${display(route.request().url())}`);
    return route.abort('blockedbyclient');
  });
  context.on('response', response => {
    const url = response.url();
    if (response.status() < 400 || !sameOrigin(url) || new URL(url).pathname === '/favicon.ico') return;
    const request = response.request();
    httpFailures.push({url, status: response.status(), method: request.method(), resourceType: request.resourceType(), staticFile: isStatic(url)});
    failed.push(`${response.status()} ${display(url)}`);
  });
  context.on('requestfailed', request => {
    const url = request.url(), error = request.failure()?.errorText || '';
    if (!sameOrigin(url) || /ERR_ABORTED/.test(error)) return;
    requestFailures.push({url, method: request.method(), error});
    failed.push(`실패 ${display(url)} ${error}`);
  });
  const page = await context.newPage();
  page.on('pageerror', error => { pageErrors.push(String(error)); errors.push(String(error).slice(0, 160)); });
  page.on('console', message => {
    const url = message.location()?.url || '';
    if (message.type() !== 'error' || /\/favicon\.ico$/.test(url)) return;
    consoleErrors.push({text: message.text(), url});
    errors.push(message.text().slice(0, 160));
  });
  return {
    context, page, failed, errors,
    snapshot({assertions = [], exception = null} = {}) {
      return {
        bad: [...failed, ...errors, ...assertions, ...(exception ? [exception] : [])],
        httpFailures: [...httpFailures], requestFailures: [...requestFailures],
        consoleErrors: [...consoleErrors], pageErrors: [...pageErrors], writeRequests: [...writeRequests],
        assertions: [...assertions], exception,
      };
    },
  };
}
