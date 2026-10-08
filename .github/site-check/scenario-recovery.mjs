// 한 시나리오의 첫 실패를 보존하면서, 확인된 정적 파일의 일시적 HTTP 오류만 한 번 재검사한다.
const staticExtension = /\.(?:js|mjs|css|json|wasm|mp3|wav|ogg|m4a|mp4|webm|png|jpe?g|webp|avif|svg|woff2?|ttf|otf|ico)$/i;
const protectedPath = /(?:^|[/._-])(?:apis?|auth(?:entication|orization)?|oauth\d*|tokens?|id|identity|idp)(?:$|[/._-])/i;
const loadError = /^Failed to load resource: the server responded with a status of (502|503|504)(?: \([^\r\n()]*\))?$/;
const staticResourceTypes = new Set(['stylesheet', 'image', 'media', 'font', 'script', 'xhr', 'fetch', 'other']);
const fields = ['bad', 'httpFailures', 'requestFailures', 'consoleErrors', 'pageErrors', 'writeRequests', 'assertions'];
const nonempty = value => typeof value === 'string' && value.trim().length > 0;
const strings = value => Array.isArray(value) && Array.from(value).every(nonempty);

function observationShape(value) {
  return value !== null && typeof value === 'object'
    && fields.every(key => Array.isArray(value[key]))
    && strings(value.bad) && strings(value.pageErrors) && strings(value.assertions)
    && Array.from(value.writeRequests).every(request => request && nonempty(request.url) && nonempty(request.method))
    && (value.exception === null || nonempty(value.exception));
}

function staticUrl(failure, origin) {
  if (!failure || failure.staticFile !== true || !nonempty(failure.url)
    || !['GET', 'HEAD'].includes(failure.method)
    || ![502, 503, 504].includes(failure.status)
    || !staticResourceTypes.has(failure.resourceType)) return false;
  try {
    const url = new URL(failure.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin
      || url.username || url.password || url.hash) return false;
    let pathname = url.pathname;
    // 인코딩된 경로 구분자나 인증 경로도 일반 경로와 같은 기준으로 검사한다.
    for (let i = 0; i < 3 && pathname.includes('%'); i++) pathname = decodeURIComponent(pathname);
    return !pathname.includes('%') && staticExtension.test(pathname) && !protectedPath.test(pathname);
  } catch { return false; }
}

export function canRetryScenario(observation, base) {
  if (!observationShape(observation) || !observation.bad.length || !observation.httpFailures.length
    || observation.requestFailures.length || observation.pageErrors.length || observation.writeRequests.length
    || observation.assertions.length || observation.exception !== null) return false;
  let origin;
  try {
    const parsed = new URL(base);
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return false;
    origin = parsed.origin;
  } catch { return false; }
  if (!Array.from(observation.httpFailures).every(failure => staticUrl(failure, origin))) return false;
  return Array.from(observation.consoleErrors).every(error => {
    if (!error || !nonempty(error.url) || typeof error.text !== 'string') return false;
    const match = error.text.match(loadError);
    return Boolean(match && observation.httpFailures.some(failure =>
      failure.url === error.url && failure.status === Number(match[1])));
  });
}

function passed(observation, attempt) {
  return observationShape(observation) && !observation.bad.length
    && !observation.httpFailures.length && !observation.requestFailures.length
    && !observation.consoleErrors.length && !observation.pageErrors.length
    && !observation.assertions.length && observation.exception === null
    && (attempt === 1 || !observation.writeRequests.length);
}

function thrownObservation(error) {
  const message = String(error) || 'Scenario did not return an observation';
  return {bad: [message], httpFailures: [], requestFailures: [], consoleErrors: [], pageErrors: [],
    writeRequests: [], assertions: [], exception: message};
}

export async function runScenarioCheck({run, base, onAttempt = async () => {},
  wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)), delayMs = 1500}) {
  if (typeof run !== 'function' || typeof onAttempt !== 'function' || typeof wait !== 'function'
    || !Number.isFinite(delayMs) || delayMs < 0) throw new TypeError('Invalid scenario check options');
  const attempts = [];
  for (let attempt = 1; attempt <= 2; attempt++) {
    let observation;
    try { observation = await run(attempt); }
    catch (error) { observation = thrownObservation(error); }
    let snapshot;
    try { snapshot = structuredClone(observation); }
    catch (error) { snapshot = thrownObservation(error); }
    attempts.push(snapshot);
    // 기록이 끝난 다음에만 다음 시도를 시작한다. 기록 저장 오류는 숨기지 않는다.
    await onAttempt(observation, attempt);
    if (passed(snapshot, attempt)) return {ok: true, recovered: attempt === 2, attempts};
    if (attempt === 2 || !canRetryScenario(snapshot, base)) break;
    await wait(delayMs);
  }
  return {ok: false, recovered: false, attempts};
}
