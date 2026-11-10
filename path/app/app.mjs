var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res, err) => function __init() {
  if (err) throw err[0];
  try {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  } catch (e) {
    throw err = [e], e;
  }
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// experiences/synk-account/src/core.mjs
var core_exports = {};
__export(core_exports, {
  PRODUCTS: () => PRODUCTS,
  authorizationProduct: () => authorizationProduct,
  base64url: () => base64url,
  beginOAuth: () => beginOAuth,
  consumeCallback: () => consumeCallback,
  createPKCE: () => createPKCE,
  firstPartyAuthorization: () => firstPartyAuthorization,
  isLoopback: () => isLoopback,
  publicUrl: () => publicUrl,
  readConfig: () => readConfig,
  scopedStorage: () => scopedStorage,
  tokenRequest: () => tokenRequest,
  trustedConsentRedirect: () => trustedConsentRedirect
});
function callbackUrl(value) {
  const url = new URL(value);
  if (!nativeSchemes.has(url.protocol)) publicUrl(value);
  if (url.username || url.password || url.hash || [...url.searchParams.keys()].some((key) => url.searchParams.getAll(key).length !== 1) || ["code", "state", "error", "error_description", "access_token", "refresh_token"].some((key) => url.searchParams.has(key))) throw new Error("로그인 도착 주소의 형식을 확인해 주세요.");
  return url;
}
function callbackMatches(actual, expected) {
  if (actual.username || actual.password || actual.hash || actual.protocol !== expected.protocol || actual.host !== expected.host || actual.pathname !== expected.pathname) return false;
  const allowed = /* @__PURE__ */ new Set([...expected.searchParams.keys(), "code", "state", "error", "error_description"]);
  return [...actual.searchParams.keys()].every((key) => allowed.has(key) && actual.searchParams.getAll(key).length === 1) && [...expected.searchParams].every(([key, value]) => actual.searchParams.get(key) === value) && !(actual.searchParams.has("code") && actual.searchParams.has("error"));
}
function publicUrl(value, { relative = false, base } = {}) {
  const url = relative ? new URL(value, base) : new URL(value);
  if (url.username || url.password || !["https:", "http:"].includes(url.protocol) || url.protocol === "http:" && !isLoopback(url.hostname)) throw new Error("HTTPS 또는 로컬 개발 주소만 사용할 수 있어요.");
  return url;
}
function readConfig(value, base) {
  const allowed = ["version", "supabaseUrl", "supabasePublishableKey", "accountApiUrl", "portalUrl", "learningUrl", "messengerUrl", "clients", "authorizationClients"];
  if (!value || value.version !== 1 || Object.keys(value).some((key2) => !allowed.includes(key2))) throw new Error("공개 설정 파일의 형식을 확인해 주세요.");
  const key = value.supabasePublishableKey || "";
  if (typeof key !== "string" || key.startsWith("sb_secret_")) throw new Error("서버 비밀 키를 브라우저 설정에 넣을 수 없어요.");
  if (key.split(".").length === 3) {
    try {
      if (JSON.parse(atob(key.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))).role !== "anon") throw new Error("role");
    } catch {
      throw new Error("브라우저에는 공개 publishable 또는 anon 키만 사용할 수 있어요.");
    }
  }
  const config = { ...value, clients: {}, configured: !!value.supabaseUrl && !!key && !!value.portalUrl };
  for (const field of ["supabaseUrl", "accountApiUrl", "portalUrl"]) if (value[field]) publicUrl(value[field]);
  for (const product of Object.keys(PRODUCTS)) {
    const client = value.clients?.[product] || {};
    if (Object.keys(client).some((key2) => !["clientId", "redirectUri"].includes(key2))) throw new Error("공개 OAuth 클라이언트에는 비밀 키를 넣지 않아요.");
    if (client.redirectUri) {
      publicUrl(client.redirectUri);
      callbackUrl(client.redirectUri);
    }
    config.clients[product] = { clientId: client.clientId || "", redirectUri: client.redirectUri || "" };
  }
  config.authorizationClients = (value.authorizationClients || []).map((client) => {
    if (!PRODUCTS[client.product] || typeof client.clientId !== "string" || !Array.isArray(client.redirectUris) || Object.keys(client).some((key2) => !["product", "clientId", "redirectUris"].includes(key2))) throw new Error("제품별 로그인 도착 주소 설정을 확인해 주세요.");
    for (const value2 of client.redirectUris) callbackUrl(value2);
    return { ...client };
  });
  config.accountApiUrl ||= config.supabaseUrl;
  config.learningUrl = publicUrl(value.learningUrl || "../learning-hub/", { relative: true, base }).href;
  return config;
}
async function createPKCE(cryptoAPI = globalThis.crypto) {
  const verifier = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const state2 = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await cryptoAPI.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, state: state2, challenge };
}
async function beginOAuth({ config, product, storage, now = Date.now(), cryptoAPI }) {
  const client = config.clients[product];
  if (!config.configured || !client?.clientId || !client.redirectUri) throw new Error("이 화면의 로그인 설정이 아직 없어요.");
  const pkce = await createPKCE(cryptoAPI), transaction = { ...pkce, product, clientId: client.clientId, redirectUri: client.redirectUri, createdAt: now };
  storage.setItem(`synk.oauth.pending.${product}`, JSON.stringify(transaction));
  const url = new URL("/auth/v1/oauth/authorize", config.supabaseUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: client.clientId,
    redirect_uri: client.redirectUri,
    state: pkce.state,
    code_challenge: pkce.challenge,
    code_challenge_method: "S256",
    scope: "openid email profile"
  });
  return url.href;
}
function consumeCallback({ config, product, url, storage, now = Date.now() }) {
  const params = new URL(url).searchParams, key = `synk.oauth.pending.${product}`, raw = storage.getItem(key);
  if (!raw) throw new Error("이 브라우저에서 시작한 로그인 요청이 아니에요. 다시 시작해 주세요.");
  const pending = JSON.parse(raw), client = config.clients[product];
  if (!pending || pending.product !== product || pending.clientId !== client?.clientId || pending.redirectUri !== client?.redirectUri || params.get("state") !== pending.state || now - pending.createdAt > 6e5 || now < pending.createdAt) throw new Error("로그인 요청이 만료되었거나 상태가 달라졌어요. 다시 시작해 주세요.");
  const actual = new URL(url), expected = new URL(client.redirectUri);
  if (!callbackMatches(actual, expected)) throw new Error("로그인 뒤 돌아온 주소가 달라요. 다시 로그인해 주세요.");
  storage.removeItem(key);
  if (params.has("error")) throw new Error(params.get("error") === "access_denied" ? "제품 연결을 취소했어요." : "로그인을 마치지 못했어요. 다시 시작해 주세요.");
  const code = params.get("code");
  if (!code) throw new Error("로그인 응답이 비어 있어요. 다시 로그인해 주세요.");
  return { grant_type: "authorization_code", client_id: client.clientId, redirect_uri: client.redirectUri, code, code_verifier: pending.verifier };
}
async function tokenRequest(config, fields, fetcher = fetch) {
  const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12e3);
  try {
    let response;
    try {
      response = await fetcher(new URL("/auth/v1/oauth/token", config.supabaseUrl), {
        method: "POST",
        signal: abort.signal,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(fields),
        credentials: "omit",
        cache: "no-store"
      });
    } catch {
      throw Object.assign(new Error("인터넷 연결이 끊겨 로그인 서버에 닿지 못했어요. 연결되면 다시 시도해 주세요."), { code: "NETWORK", retryable: true });
    }
    let data;
    try {
      data = await response.json();
    } catch (error) {
      if (response.ok && error?.name !== "SyntaxError") throw Object.assign(new Error("로그인 응답을 끝까지 받지 못했어요. 연결되면 다시 시도해 주세요."), { code: "NETWORK", retryable: true });
      data = null;
    }
    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      throw Object.assign(new Error(retryable ? "로그인 서버가 잠시 응답하지 않아요. 잠시 뒤 다시 시도해 주세요." : "로그인 연결을 마치지 못했어요. 다시 로그인해 주세요."), { code: retryable ? "AUTH_UNAVAILABLE" : "AUTH_REQUIRED", status: response.status, retryable });
    }
    if (!data || typeof data.access_token !== "string" || !data.access_token) throw Object.assign(new Error("로그인 응답을 확인하지 못했어요. 다시 로그인해 주세요."), { code: "INVALID_RESPONSE" });
    return { access_token: data.access_token, refresh_token: data.refresh_token || null, expires_at: Date.now() + Number(data.expires_in || 3600) * 1e3 };
  } finally {
    clearTimeout(timer);
  }
}
function trustedConsentRedirect(value, config, clientId) {
  const target = new URL(value);
  if (target.username || target.password || target.hash) throw new Error("등록한 SYNK 제품의 도착 주소를 확인하지 못했어요.");
  const matchesClient = (c) => c.clientId && (!clientId || c.clientId === clientId);
  const redirects = [...Object.values(config.clients).filter(matchesClient).map((c) => c.redirectUri), ...config.authorizationClients.filter(matchesClient).flatMap((c) => c.redirectUris)];
  const match = redirects.some((uri) => {
    if (!uri) return false;
    const allowed = new URL(uri);
    return callbackMatches(target, allowed);
  });
  if (!match) throw new Error("등록한 SYNK 제품의 도착 주소를 확인하지 못했어요.");
  return target.href;
}
function authorizationProduct(clientId, config) {
  return Object.entries(config.clients).find(([, client]) => client.clientId && client.clientId === clientId)?.[0] || config.authorizationClients.find((client) => client.clientId && client.clientId === clientId)?.product || null;
}
function firstPartyAuthorization(details, config) {
  const clientId = details?.client?.id;
  const product = typeof clientId === "string" && clientId ? authorizationProduct(clientId, config) : null;
  if (!product) throw new Error("등록된 SYNK 서비스의 로그인 요청인지 확인하지 못했어요.");
  const destination = trustedConsentRedirect(details.redirect_uri, config, clientId);
  const clients = [...Object.values(config.clients), ...config.authorizationClients].filter((client) => client.clientId === clientId);
  if (!clients.some((client) => [client.redirectUri, ...client.redirectUris || []].filter(Boolean).some((uri) => new URL(uri).href === destination)))
    throw new Error("등록한 SYNK 서비스의 로그인 도착 주소와 달라요.");
  const scopes = typeof details.scope === "string" ? details.scope.trim().split(/\s+/) : [];
  if (!scopes.includes("openid") || new Set(scopes).size !== scopes.length || scopes.some((scope) => !["openid", "email", "profile"].includes(scope)))
    throw new Error("SYNK 로그인에 필요한 기본 계정 정보만 연결할 수 있어요.");
  return Object.freeze({ clientId, product, destination, scopes: Object.freeze(scopes) });
}
function scopedStorage(storage, accountKey, revision2, guard) {
  const prefix = `synk.account.${accountKey}.r${revision2}.`;
  let enumeration = null;
  const scoped = Object.fromEntries(["getItem", "setItem", "removeItem"].map((method) => [method, (key, ...args) => {
    guard();
    try {
      return storage[method](prefix + key, ...args);
    } finally {
      if (method !== "getItem") enumeration = null;
    }
  }]));
  if (storage && typeof storage.key === "function" && "length" in storage) {
    const scan = () => {
      guard();
      const count = storage.length, names = [];
      if (!Number.isSafeInteger(count) || count < 0) throw Error("Storage enumeration unavailable");
      for (let index = 0; index < count; index++) {
        const name = storage.key(index);
        if (typeof name === "string" && name.startsWith(prefix)) names.push(name.slice(prefix.length));
      }
      guard();
      return names;
    };
    Object.defineProperty(scoped, "length", { enumerable: true, get() {
      enumeration = scan();
      return enumeration.length;
    } });
    scoped.key = (index) => {
      guard();
      if (!Number.isSafeInteger(index) || index < 0) {
        enumeration = null;
        return null;
      }
      const names = enumeration || scan(), name = names[index] ?? null;
      enumeration = index >= names.length - 1 ? null : names;
      return name;
    };
  }
  return Object.freeze(scoped);
}
var PRODUCTS, nativeSchemes, isLoopback, base64url;
var init_core = __esm({
  "experiences/synk-account/src/core.mjs"() {
    PRODUCTS = Object.freeze({ platform: "SYNK 플랫폼", world: "SYNK WORLD", messenger: "SYNK Workspace", care: "SYNK 플레저", path: "SYNK PATH", "path-travel": "SYNK PATH 여행", "path-app": "SYNK PATH" });
    nativeSchemes = /* @__PURE__ */ new Set(["synktalk:", "im.synk.platform:", "im.synk.world:", "im.synk.messenger:", "im.synk.care:"]);
    isLoopback = (hostname) => ["localhost", "127.0.0.1", "[::1]"].includes(hostname);
    base64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
});

// experiences/path-app/content.mjs
var GOALS = [
  {
    id: "study",
    label: { ko: "해외에서 한국을 준비해요", en: "Preparing for Korea from abroad" },
    description: { ko: "학교·유학", en: "Schools · study abroad" },
    homeTitle: { ko: "한국 유학, 과정 비교부터 시작해요", en: "Start by comparing study programs in Korea" },
    homeAction: { ko: "과정 비교하기", en: "Compare programs" },
    defaultLocation: "abroad",
    interests: [
      { id: "school", label: { ko: "학교·과정 고르기", en: "Choosing a school or program" } },
      { id: "scholarship", label: { ko: "장학 정보", en: "Scholarships" } },
      { id: "language", label: { ko: "한국어 준비", en: "Korean language prep" } },
      { id: "documents", label: { ko: "지원 서류 정리", en: "Organizing application documents" } }
    ]
  },
  {
    id: "student",
    label: { ko: "한국에서 유학 중이에요", en: "Studying in Korea now" },
    description: { ko: "생활·졸업", en: "Campus life · graduation" },
    homeTitle: { ko: "학교생활과 졸업 이후를 함께 준비해요", en: "Plan campus life and what comes after graduation" },
    homeAction: { ko: "준비할 것 고르기", en: "Pick what to prepare" },
    defaultLocation: "korea",
    interests: [
      { id: "campus", label: { ko: "학교생활 적응", en: "Settling into campus life" } },
      { id: "graduation", label: { ko: "졸업 준비", en: "Graduation planning" } },
      { id: "career", label: { ko: "진로 탐색", en: "Exploring career paths" } },
      { id: "parttime", label: { ko: "학업과 일 병행 고민", en: "Balancing study and work" } }
    ]
  },
  {
    id: "job",
    label: { ko: "취업을 준비하고 있어요", en: "Preparing for a job" },
    description: { ko: "공고·지원·면접", en: "Postings · applications · interviews" },
    homeTitle: { ko: "공고를 비교하고 지원 자료를 준비해요", en: "Compare postings and prepare your application" },
    homeAction: { ko: "공고 비교하기", en: "Compare postings" },
    defaultLocation: "unknown",
    interests: [
      { id: "resume", label: { ko: "이력서 정리", en: "Resume" } },
      { id: "interview", label: { ko: "면접 연습", en: "Interview practice" } },
      { id: "compare", label: { ko: "공고 조건 비교", en: "Comparing postings" } },
      { id: "korean", label: { ko: "업무 한국어", en: "Workplace Korean" } }
    ]
  }
];
var OPPORTUNITIES = [
  {
    id: "demo-study-a",
    goal: "study",
    title: { ko: "예시대학A · 학부 과정", en: "Example University A · Undergraduate" },
    summary: { ko: "학부 과정을 가정한 데모 예시입니다. 실제 모집 요강은 학교 공식 안내에서 확인하세요.", en: "A demo example of an undergraduate program. Check the school’s official guide for real admission details." },
    source: "demo",
    requirements: [
      { ko: "지원하려는 이유를 내 말로 정리", en: "Put your reason for applying in your own words" },
      { ko: "지금까지의 학업 경험 정리", en: "Summarize your academic background" },
      { ko: "확인이 필요한 질문 목록 만들기", en: "List questions you still need to confirm" }
    ],
    prompt: { ko: "이 과정을 고려하는 이유와 지금까지의 학업 경험을 적어 보세요.", en: "Write why you are considering this program and your academic experience so far." }
  },
  {
    id: "demo-study-b",
    goal: "study",
    title: { ko: "예시대학B · 어학 과정", en: "Example University B · Language program" },
    summary: { ko: "한국어 어학 과정을 가정한 데모 예시입니다. 기간과 비용은 표시하지 않습니다.", en: "A demo example of a Korean language program. Duration and costs are not shown." },
    source: "demo",
    requirements: [
      { ko: "현재 한국어 수준을 솔직하게 기록", en: "Note your current Korean level honestly" },
      { ko: "어학 과정 이후 계획 정리", en: "Outline your plan after the language program" }
    ],
    prompt: { ko: "지금 한국어 수준과 어학 과정 이후의 계획을 적어 보세요.", en: "Describe your current Korean level and your plan after the program." }
  },
  {
    id: "demo-student-a",
    goal: "student",
    title: { ko: "예시 졸업 준비 점검", en: "Example graduation checklist" },
    summary: { ko: "졸업 전에 스스로 점검할 항목을 정리하는 데모 예시입니다. 실제 요건은 소속 학교에 확인하세요.", en: "A demo checklist for reviewing before graduation. Confirm real requirements with your school." },
    source: "demo",
    requirements: [
      { ko: "남은 학기와 이수 상황을 내 기록으로 정리", en: "Record your remaining terms and credits yourself" },
      { ko: "학과 사무실에 물어볼 질문 적기", en: "Write questions for your department office" }
    ],
    prompt: { ko: "남은 학기 계획과 학교에 확인할 질문을 적어 보세요.", en: "Write your plan for the remaining terms and questions for your school." }
  },
  {
    id: "demo-student-b",
    goal: "student",
    title: { ko: "예시 진로 탐색 노트", en: "Example career exploration note" },
    summary: { ko: "졸업 후 진로를 생각해 보는 데모 예시입니다. 특정 기관이나 프로그램이 아닙니다.", en: "A demo note for thinking about life after graduation. Not a specific organization or program." },
    source: "demo",
    requirements: [
      { ko: "관심 분야 두세 가지 적기", en: "List two or three fields of interest" },
      { ko: "관련 수업·활동 경험 정리", en: "Summarize related classes or activities" }
    ],
    prompt: { ko: "관심 있는 분야와 관련된 수업이나 활동 경험을 적어 보세요.", en: "Write fields you are interested in and related classes or activities." }
  },
  {
    id: "demo-job-a",
    goal: "job",
    title: { ko: "예시공고A · 사무 지원 직무", en: "Example Posting A · Office support role" },
    summary: { ko: "사무 지원 직무를 가정한 데모 공고입니다. 급여·마감·자격 조건은 포함하지 않습니다.", en: "A demo posting for an office support role. No pay, deadline, or eligibility conditions included." },
    source: "demo",
    requirements: [
      { ko: "직무와 관련된 경험 한 가지 구체적으로 적기", en: "Describe one relevant experience in detail" },
      { ko: "지원 동기 짧게 정리", en: "Summarize your motivation briefly" }
    ],
    prompt: { ko: "이 직무와 관련된 경험 하나와 지원 동기를 적어 보세요.", en: "Write one related experience and why you want this role." }
  },
  {
    id: "demo-job-b",
    goal: "job",
    title: { ko: "예시공고B · 돌봄 서비스 직무", en: "Example Posting B · Care service role" },
    summary: { ko: "돌봄 서비스 직무를 가정한 데모 공고입니다. 실제 채용 조건은 공식 공고에서 확인하세요.", en: "A demo posting for a care service role. Check official postings for real hiring conditions." },
    source: "demo",
    requirements: [
      { ko: "사람을 돕거나 돌본 경험 정리", en: "Summarize experience helping or caring for people" },
      { ko: "어려웠던 상황과 대처 방법 적기", en: "Describe a difficult situation and how you handled it" }
    ],
    prompt: { ko: "누군가를 돕거나 돌본 경험과 어려웠던 순간의 대처를 적어 보세요.", en: "Write about helping or caring for someone and how you handled a hard moment." }
  }
];
var OFFICIAL_LINKS = [
  {
    id: "study-in-korea",
    goal: "study",
    title: { ko: "Study in Korea", en: "Study in Korea" },
    summary: { ko: "한국 유학 공식 안내 사이트입니다. 세부 조건은 원문에서 직접 확인하세요.", en: "Official guide to studying in Korea. Check details on the original site." },
    source: "official",
    url: "https://www.studyinkorea.go.kr/",
    checkedAt: "2026-11-09",
    summaryOnly: true
  },
  {
    id: "work24",
    goal: "job",
    title: { ko: "고용24", en: "Work24" },
    summary: { ko: "고용·채용 관련 공공 서비스입니다. PATH와 연동되어 있지 않습니다.", en: "Public employment service. Not connected to PATH." },
    source: "official",
    url: "https://www.work24.go.kr/",
    checkedAt: "2026-11-09",
    summaryOnly: true
  },
  {
    id: "hikorea",
    goal: null,
    title: { ko: "하이코리아", en: "HiKorea" },
    summary: { ko: "외국인 체류 관련 공공 안내입니다. 본인 상황은 원문과 공식 문의로 확인하세요.", en: "Public information on stay in Korea for foreign nationals. Confirm your case via the original source and official inquiry." },
    source: "official",
    url: "https://www.hikorea.go.kr/",
    checkedAt: "2026-11-09",
    summaryOnly: true
  }
];
var EXISTING_TOOLS = [
  {
    id: "travel",
    title: { ko: "SYNK 여행 체험", en: "SYNK travel experience" },
    summary: { ko: "별도 페이지에서 열립니다. 이 앱의 저장 내용과 분리됩니다.", en: "Opens as a separate page. Kept apart from this app’s saved data." },
    url: "https://synk.im/try/travel/"
  },
  {
    id: "interview",
    title: { ko: "면접 리허설 (돌봄 직무 상황)", en: "Interview rehearsal (care role scenario)" },
    summary: { ko: "현재 돌봄 직무 상황만 다룹니다. 모든 직종을 지원하지 않으며 별도 페이지에서 열립니다.", en: "Currently covers a care role scenario only, not every job type. Opens as a separate page." },
    url: "https://synk.im/path/interview/film/rehearsal.html"
  }
];

// experiences/synk-account/src/platform-entry.mjs
var PARAM = "synk-platform-account";
var CANCEL = "synk-platform-cancelled";
var validId = (value) => typeof value === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
var mismatch = () => Object.assign(new Error("플랫폼에서 로그인한 SYNK ID와 이 화면의 계정이 달라요. 같은 계정으로 로그인한 뒤 다시 열어 주세요."), { code: "PLATFORM_ACCOUNT_MISMATCH" });
function createPlatformEntry({ clientKey, getUrl, replaceUrl }) {
  const key = `synk.platform.entry.${clientKey}`;
  let captured = false, restored = false, invalid = false, cancelled = false, intent = null, storage;
  function capture(value) {
    if (captured) return;
    const url = new URL(getUrl()), params = new URLSearchParams(url.hash.slice(1));
    if (params.get(CANCEL) === clientKey) {
      cancelled = true;
      captured = true;
      return;
    }
    if (!params.has(PARAM)) {
      captured = true;
      return;
    }
    const values = params.getAll(PARAM), next = values.length === 1 && validId(values[0]) ? { version: 1, accountId: values[0], attempted: false } : { version: 1, invalid: true };
    try {
      storage = typeof value === "function" ? value() : value;
      storage.setItem(key, JSON.stringify(next));
    } catch {
      throw Object.assign(new Error("브라우저가 저장을 막아 플랫폼의 로그인을 이어받지 못했어요. 사이트 데이터 저장을 허용한 뒤 다시 열어 주세요."), { code: "PLATFORM_ENTRY_STORAGE", retryable: true });
    }
    intent = next;
    invalid = next.invalid === true;
    params.delete(PARAM);
    url.hash = params.toString();
    replaceUrl(url.href);
    captured = true;
  }
  function persist() {
    storage.setItem(key, JSON.stringify(intent));
  }
  return {
    capture,
    restore(value) {
      if (invalid) throw mismatch();
      if (restored) return;
      storage = value;
      const text2 = storage.getItem(key);
      if (text2) {
        try {
          if (text2.length > 1024) throw mismatch();
          intent = JSON.parse(text2);
        } catch {
          throw mismatch();
        }
        if (intent?.version !== 1 || !validId(intent.accountId) && !(intent.cancelled === true && intent.accountId === void 0) || typeof intent.attempted !== "boolean" || intent.cancelled !== void 0 && typeof intent.cancelled !== "boolean") throw mismatch();
        cancelled ||= intent.cancelled === true;
      }
      restored = true;
    },
    accountId: () => intent?.accountId || null,
    assertAccount(id) {
      if (intent?.accountId && id !== intent.accountId) throw mismatch();
    },
    isCancelled: () => cancelled,
    resume() {
      if (!cancelled) return;
      if (intent?.accountId) {
        intent.cancelled = false;
        intent.attempted = true;
        persist();
      } else {
        storage.removeItem(key);
        if (storage.getItem(key) !== null) throw mismatch();
        intent = null;
      }
      const url = new URL(getUrl()), params = new URLSearchParams(url.hash.slice(1));
      params.delete(CANCEL);
      url.hash = params.toString();
      replaceUrl(url.href);
      cancelled = false;
    },
    beginAttempt() {
      if (cancelled || !intent || intent.attempted) return false;
      intent.attempted = true;
      persist();
      return true;
    },
    stop() {
      if (intent) {
        intent.attempted = true;
        persist();
      }
    },
    cancel() {
      if (!intent && !cancelled && !new URLSearchParams(new URL(getUrl()).hash.slice(1)).has(PARAM)) return;
      cancelled = true;
      let durable = false;
      try {
        intent ||= { version: 1, attempted: true };
        intent.cancelled = true;
        intent.attempted = true;
        persist();
        durable = true;
      } catch {
      }
      if (!durable) {
        try {
          storage.removeItem(key);
          if (storage.getItem(key) !== null) throw mismatch();
        } catch {
        }
      }
      const url = new URL(getUrl()), params = new URLSearchParams(url.hash.slice(1));
      params.delete(PARAM);
      if (!durable) params.set(CANCEL, clientKey);
      url.hash = params.toString();
      try {
        if (url.href !== getUrl()) replaceUrl(url.href);
      } catch {
        throw Object.assign(new Error("로그아웃은 했지만 자동 로그인 끄기를 저장하지 못했어요. 이 창을 닫아 주세요."), { code: "PLATFORM_ENTRY_STORAGE", retryable: false });
      }
    }
  };
}
var PUBLIC = Object.freeze({ world: "https://synk.im/world/", care: "https://synk.im/care/", fortune: "https://synk.im/fortune/" });

// experiences/synk-account/src/product-account.mjs
var AUTH_ERRORS = /* @__PURE__ */ new Set(["AUTH_REQUIRED", "AUTH_SESSION_MISSING", "SESSION_REVOKED"]);
var fault = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
var missingAsset = (error) => ["ASSET_NOT_FOUND", "ASSET_NOT_CONFIRMED"].includes(error?.code) && typeof error?.assetId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(error.assetId) ? { assetId: error.assetId } : {};
var publicError = (error) => ({ code: error.code || "ACCOUNT_UNAVAILABLE", message: error.message || "계정 연결을 확인하지 못했어요.", retryable: error.retryable === true, ...error.status ? { status: error.status } : {}, ...missingAsset(error) });
function createProductAccount({
  clientKey,
  endpoint,
  scope,
  validateState,
  resource = null,
  operations = { load: "careLoad", save: "careSave", delete: "careDelete" },
  onStatus = () => {
  },
  bridge,
  fetcher = globalThis.fetch,
  storage = globalThis.sessionStorage,
  getUrl = () => globalThis.location.href,
  configUrl = "/api/account-config",
  replaceUrl = (url) => globalThis.history.replaceState(null, "", url),
  navigate = (url) => globalThis.location.assign(url),
  loadCore = () => Promise.resolve().then(() => (init_core(), core_exports)),
  now = Date.now,
  cryptoAPI
} = {}) {
  const pathApp = clientKey === "path-app" || endpoint === "synk-path";
  if (typeof validateState !== "function" || (pathApp ? clientKey !== "path-app" || endpoint !== "synk-path" || scope !== "synk-path" || resource !== "path-app" : !["care", "path", "path-travel"].includes(clientKey) || !["synk-care", "synk-personal"].includes(endpoint))) throw new TypeError("앱 계정 설정 형식이 맞지 않아요.");
  const LIMIT = 4 * 1024 * 1024 + 32768;
  const SESSION_KEY2 = `synk.oauth.session.${clientKey}`;
  const OPERATIONS2 = new Set(Object.values(operations));
  const bridgeRequest = bridge?.accountRequest || bridge?.request;
  const native = typeof bridgeRequest === "function" && typeof bridge?.authStatus === "function";
  const platformEntry = native ? null : createPlatformEntry({ clientKey, getUrl, replaceUrl });
  let automaticNavigations = 0;
  let snapshot = { configured: false, signedIn: false, status: "unconfigured", accountId: null, account: null, sessionGeneration: 0, error: null };
  let config, core, session2 = null, pendingExchange = null, epoch = 0, loginIntent = 0, disposed = false, starting, started = false, refreshing, unsubscribe, nativeIdentity = null, nativeLoad = null, nativeGeneration = -1;
  const controllers = /* @__PURE__ */ new Set();
  const status = () => ({ ...snapshot, account: snapshot.account ? { ...snapshot.account } : null, error: snapshot.error ? { ...snapshot.error } : null });
  const emit = (patch) => {
    snapshot = { ...snapshot, ...patch, sessionGeneration: epoch };
    if (!disposed) onStatus(status());
    return status();
  };
  const guard = (expected) => {
    if (disposed || expected !== epoch) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
  };
  const binding = () => [config.supabaseUrl, config.accountApiUrl, config.clients[clientKey].clientId, config.clients[clientKey].redirectUri].join("|");
  function stopRequests() {
    for (const controller of controllers) controller.abort();
  }
  function clearSession(error, nextStatus = "signed-out") {
    epoch++;
    session2 = null;
    pendingExchange = null;
    nativeIdentity = null;
    nativeLoad = null;
    stopRequests();
    if (!native) {
      try {
        storage?.removeItem(SESSION_KEY2);
      } catch {
        error ||= fault("STORAGE", "화면의 로그인은 종료했지만 저장을 지우지 못했어요. 이 창을 닫아 주세요.");
      }
    }
    return emit({ signedIn: false, status: snapshot.configured ? nextStatus : "unconfigured", accountId: null, account: null, error: error ? publicError(error) : null });
  }
  function saveSession(next) {
    session2 = next;
    try {
      storage.setItem(SESSION_KEY2, JSON.stringify({ ...next, configKey: binding() }));
    } catch {
      throw fault("STORAGE", "이 탭에 로그인을 보관하지 못했어요. 브라우저 저장 설정을 확인해 주세요.");
    }
  }
  async function responseJson(response) {
    if (!response.body?.getReader) {
      const text3 = await response.text();
      if (new TextEncoder().encode(text3).byteLength > LIMIT) throw fault("INVALID_RESPONSE", "계정 자료의 크기를 확인하지 못했어요.");
      try {
        return JSON.parse(text3);
      } catch {
        return null;
      }
    }
    const reader = response.body.getReader(), decoder = new TextDecoder();
    let bytes = 0, text2 = "";
    try {
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > LIMIT) {
          await reader.cancel();
          throw fault("INVALID_RESPONSE", "계정 자료의 크기를 확인하지 못했어요.");
        }
        text2 += decoder.decode(value, { stream: true });
      }
      text2 += decoder.decode();
      try {
        return JSON.parse(text2);
      } catch {
        return null;
      }
    } finally {
      reader.releaseLock();
    }
  }
  async function send(url, token, body, { logout = false } = {}) {
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 12e3);
    controllers.add(abort);
    try {
      const response = await fetcher(url, {
        method: body === void 0 ? "GET" : "POST",
        signal: abort.signal,
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        headers: { apikey: config.supabasePublishableKey, Authorization: `Bearer ${token}`, "X-SYNK-Product": "platform", "X-SYNK-Contract": "1", ...body === void 0 ? {} : { "Content-Type": "application/json" } },
        ...body === void 0 ? {} : { body: JSON.stringify(body) }
      });
      const data = logout && response.status === 204 ? null : await responseJson(response);
      return { response, data };
    } catch (error) {
      if (error.code) throw error;
      throw fault("NETWORK", "계정 서버에 연결하지 못했어요. 현재 자료를 유지하고 다시 시도해 주세요.", { retryable: true });
    } finally {
      clearTimeout(timer);
      controllers.delete(abort);
    }
  }
  async function refresh(expected) {
    if (refreshing) return refreshing;
    const old = session2;
    if (!old?.refresh_token) throw fault("AUTH_REQUIRED", "SYNK ID로 다시 로그인해 주세요.");
    const promise = (async () => {
      const next = await core.tokenRequest(config, { grant_type: "refresh_token", client_id: config.clients[clientKey].clientId, refresh_token: old.refresh_token }, fetcher);
      guard(expected);
      saveSession({ ...next, refresh_token: next.refresh_token || old.refresh_token });
      return session2.access_token;
    })();
    refreshing = promise;
    try {
      return await promise;
    } finally {
      if (refreshing === promise) refreshing = null;
    }
  }
  function requestBody(operation, values = {}) {
    if (!OPERATIONS2.has(operation) || !values || typeof values !== "object" || Array.isArray(values)) throw fault("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    const careLibrarySave = clientKey === "care" && endpoint === "synk-care" && resource === null && operation === operations.save;
    const allowed = operation === operations.load ? [] : operation === operations.save ? ["expected_revision", "state", ...careLibrarySave ? ["messageLibraryVersion", "checkinPreferenceVersion"] : []] : ["expected_revision"];
    if (Object.keys(values).some((key) => !allowed.includes(key))) throw fault("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    if (Object.hasOwn(values, "messageLibraryVersion") && (!careLibrarySave || values.messageLibraryVersion !== 1)) throw fault("INVALID_REQUEST", "문구 보관함 자료 형식이 맞지 않아요.");
    if (Object.hasOwn(values, "checkinPreferenceVersion") && (!careLibrarySave || values.checkinPreferenceVersion !== 1)) throw fault("INVALID_REQUEST", "안부 설정 자료 형식이 맞지 않아요.");
    if (operation === operations.load) return void 0;
    if (!Number.isSafeInteger(values.expected_revision) || values.expected_revision < 0) throw fault("INVALID_REQUEST", "저장할 자료의 버전을 확인해 주세요.");
    return { action: operation === operations.save ? "save" : "delete", expected_revision: values.expected_revision, ...operation === operations.save ? { state: validateState(values.state) } : {}, ...Object.hasOwn(values, "messageLibraryVersion") ? { messageLibraryVersion: 1 } : {}, ...Object.hasOwn(values, "checkinPreferenceVersion") ? { checkinPreferenceVersion: 1 } : {} };
  }
  function validateResponse(data, ownerId) {
    if (data?.ok !== true) throw fault(data?.error?.code || "ACCOUNT_UNAVAILABLE", data?.error?.message || "계정 자료를 확인하지 못했어요.", { retryable: data?.error?.retryable === true, status: data?.error?.status, revision: data?.revision, ...missingAsset(data?.error) });
    if (data.scope !== scope || resource && data.resource !== resource || typeof data.accountId !== "string" || !data.accountId || data.accountId.length > 100 || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Object.hasOwn(data, "state")) throw fault("INVALID_RESPONSE", "계정 자료의 형식을 확인하지 못했어요. 현재 자료를 유지해 주세요.");
    if (ownerId && data.accountId !== ownerId) throw fault("ACCOUNT_CHANGED", "다른 계정의 응답이 도착해 자료를 적용하지 않았어요.");
    return { ok: true, scope, ...resource ? { resource } : {}, accountId: data.accountId, revision: data.revision, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null, state: data.state === null ? null : validateState(data.state) };
  }
  async function dispatch(operation, values, expected, ownerId) {
    const body = requestBody(operation, values);
    guard(expected);
    let data;
    if (native) {
      const params = operation === operations.load ? {} : operation === operations.save ? { expected_revision: body.expected_revision, state: body.state, ...Object.hasOwn(body, "messageLibraryVersion") ? { messageLibraryVersion: body.messageLibraryVersion } : {}, ...Object.hasOwn(body, "checkinPreferenceVersion") ? { checkinPreferenceVersion: body.checkinPreferenceVersion } : {} } : { expected_revision: body.expected_revision };
      data = await bridgeRequest.call(bridge, operation, params);
      guard(expected);
    } else {
      if (!session2?.access_token) throw fault("AUTH_REQUIRED", "SYNK ID로 로그인해 주세요.");
      let token = session2.access_token;
      if (session2.expires_at <= now() + 3e4) token = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/${endpoint}${resource && body === void 0 ? `?resource=${encodeURIComponent(resource)}` : ""}`;
      let result = await send(url, token, body === void 0 || !resource ? body : { ...body, resource });
      guard(expected);
      if (result.response.status === 401 && session2?.refresh_token) {
        token = session2.access_token !== token ? session2.access_token : await refresh(expected);
        guard(expected);
        result = await send(url, token, body === void 0 || !resource ? body : { ...body, resource });
        guard(expected);
      }
      if (!result.response.ok || result.data?.ok !== true) {
        const code = result.data?.error?.code || (result.response.status === 401 ? "AUTH_REQUIRED" : "ACCOUNT_UNAVAILABLE");
        throw fault(code, code === "REVISION_CONFLICT" ? "다른 기기에서 자료가 바뀌었어요. 계정 자료를 다시 불러와 주세요." : "계정 요청을 마치지 못했어요. 지금 화면의 자료는 그대로예요.", { status: result.response.status, revision: result.data?.revision, retryable: result.response.status === 429 || result.response.status >= 500, ...missingAsset(result.data?.error) });
      }
      data = result.data;
    }
    guard(expected);
    return validateResponse(data, ownerId);
  }
  async function nativeStatus(source) {
    if (disposed) return status();
    const identity = source?.account?.synk_user_id, generation = source?.sessionGeneration ?? 0;
    if (!Number.isSafeInteger(generation) || generation < nativeGeneration) return status();
    nativeGeneration = generation;
    if (source?.status === "restoring" && nativeIdentity && nativeIdentity.endsWith(`:${generation}`)) return emit({ signedIn: false, status: "restoring", error: null });
    if (!source?.signedIn || !identity) {
      snapshot.configured = source?.configured === true;
      return clearSession(source?.error ? Object.assign(new Error(source.error.message), source.error) : null, source?.status || "signed-out");
    }
    const key = `${identity}:${generation}`;
    if (key === nativeIdentity && snapshot.accountId) return emit({ configured: true, signedIn: true, status: "signed-in", error: null });
    if (key === nativeIdentity && nativeLoad) return nativeLoad;
    epoch++;
    nativeIdentity = key;
    const expected = epoch;
    emit({ configured: true, signedIn: false, status: "restoring", accountId: null, account: null, error: null });
    const promise = (async () => {
      try {
        const data = await dispatch(operations.load, {}, expected, identity);
        guard(expected);
        return emit({ configured: true, signedIn: true, status: "signed-in", accountId: data.accountId, account: { synk_user_id: data.accountId, display_name: source.account.display_name || "" }, error: null });
      } catch (error) {
        if (expected === epoch && !disposed) return clearSession(error, "error");
        return status();
      }
    })();
    nativeLoad = promise;
    try {
      return await promise;
    } finally {
      if (nativeLoad === promise) nativeLoad = null;
    }
  }
  async function begin() {
    const expected = epoch;
    platformEntry?.capture(storage);
    if (native) {
      const environment = await bridge.getEnvironment();
      guard(expected);
      if (environment?.clientId !== clientKey) throw fault("INVALID_BRIDGE", "제품 앱의 로그인 연결을 확인해 주세요.");
      if (disposed) return status();
      unsubscribe?.();
      unsubscribe = bridge.onAuthChanged((source2) => {
        void nativeStatus(source2).catch(() => {
        });
      });
      const source = await bridge.authStatus();
      guard(expected);
      return nativeStatus(source);
    }
    try {
      core = await loadCore();
    } catch {
      throw fault("NETWORK", "로그인 설정을 못 불러왔어요. 인터넷이 연결되면 다시 시도해 주세요.", { retryable: true });
    }
    guard(expected);
    let raw;
    const configEndpoint = new URL(configUrl, getUrl());
    if (configEndpoint.origin !== new URL(getUrl()).origin || configEndpoint.username || configEndpoint.password || configEndpoint.hash) throw fault("AUTH_CONFIG", "이 앱의 계정 설정 주소를 확인해 주세요.");
    const abort = new AbortController(), timer = setTimeout(() => abort.abort(), 8e3);
    controllers.add(abort);
    try {
      const response = await fetcher(configEndpoint.href, { cache: "no-store", credentials: "omit", signal: abort.signal, redirect: "error" });
      if (response.ok) raw = await response.json();
      else if (response.status !== 404) throw fault("AUTH_CONFIG", "로그인 설정을 못 불러왔어요. 잠시 뒤 다시 시도해 주세요.", { status: response.status, retryable: response.status === 429 || response.status >= 500 });
    } catch (error) {
      if (error.code) throw error;
      throw fault("NETWORK", "로그인 설정을 못 불러왔어요. 인터넷이 연결되면 다시 시도해 주세요.", { retryable: true });
    } finally {
      clearTimeout(timer);
      controllers.delete(abort);
    }
    guard(expected);
    config = core.readConfig(raw || { version: 1 }, getUrl());
    const configured = !!(config.configured && config.clients[clientKey]?.clientId && config.clients[clientKey]?.redirectUri);
    if (!configured) {
      pendingExchange = null;
      return emit({ configured: false, status: "unconfigured", error: null });
    }
    emit({ configured: true, status: "restoring", error: null });
    platformEntry.restore(storage);
    if (platformEntry.isCancelled()) {
      session2 = null;
      pendingExchange = null;
      return emit({ signedIn: false, status: "signed-out", accountId: null, account: null, error: null });
    }
    const url = new URL(getUrl());
    if (url.searchParams.has("code") || url.searchParams.has("error")) {
      platformEntry.stop();
      try {
        pendingExchange = { fields: core.consumeCallback({ config, product: clientKey, url: url.href, storage, now: now() }), configKey: binding() };
      } finally {
        for (const key of ["code", "state", "error", "error_description"]) url.searchParams.delete(key);
        replaceUrl(url.href);
      }
    }
    if (pendingExchange) {
      if (pendingExchange.configKey !== binding()) throw fault("AUTH_REQUIRED", "로그인 연결 설정이 바뀌었어요. SYNK ID로 다시 로그인해 주세요.");
      const next = await core.tokenRequest(config, pendingExchange.fields, fetcher);
      guard(expected);
      pendingExchange = null;
      saveSession(next);
    } else {
      try {
        const text2 = storage.getItem(SESSION_KEY2);
        if (text2 && text2.length > 65536) throw Error("INVALID_SESSION");
        const value = JSON.parse(text2 || "null");
        if (value) {
          if (value.configKey !== binding() || typeof value.access_token !== "string" || !value.access_token || value.access_token.length > 16384 || value.refresh_token !== null && typeof value.refresh_token !== "string" || !Number.isFinite(value.expires_at)) throw Error("INVALID_SESSION");
          session2 = { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: value.expires_at };
        }
      } catch {
        storage.removeItem(SESSION_KEY2);
        session2 = null;
      }
    }
    if (!session2) return await automaticSignIn(expected) || emit({ signedIn: false, status: "signed-out", accountId: null, account: null, error: null });
    emit({ status: "restoring" });
    let data;
    try {
      data = await dispatch(operations.load, {}, expected, platformEntry.accountId());
      guard(expected);
    } catch (error) {
      guard(expected);
      if (!platformEntry.accountId() || ![...AUTH_ERRORS, "ACCOUNT_CHANGED"].includes(error.code)) throw error;
      session2 = null;
      storage.removeItem(SESSION_KEY2);
      const redirected = await automaticSignIn(expected);
      if (redirected) return redirected;
      platformEntry.assertAccount(null);
      throw error;
    }
    platformEntry.assertAccount(data.accountId);
    platformEntry.stop();
    return emit({ signedIn: true, status: "signed-in", accountId: data.accountId, account: { synk_user_id: data.accountId, display_name: "" }, error: null });
  }
  async function automaticSignIn(expected) {
    if (!platformEntry.beginAttempt()) return null;
    emit({ signedIn: false, accountId: null, account: null, status: "signing-in", error: null });
    const url = await core.beginOAuth({ config, product: clientKey, storage, now: now(), cryptoAPI });
    guard(expected);
    automaticNavigations++;
    navigate(url);
    return status();
  }
  async function start() {
    if (disposed) throw fault("ACCOUNT_CHANGED", "계정 연결이 종료됐어요.");
    if (starting) return starting;
    if (started && !snapshot.error?.retryable) return status();
    started = true;
    const expected = epoch;
    emit({ status: "restoring", error: null });
    const operation = begin().catch((error) => {
      if (disposed || expected !== epoch) return status();
      if (!native && error.retryable === true && !AUTH_ERRORS.has(error.code) && error.code !== "ACCOUNT_CHANGED")
        return emit({ signedIn: false, accountId: null, account: null, status: "error", error: publicError(error) });
      return clearSession(error, "error");
    });
    starting = operation;
    try {
      return await operation;
    } finally {
      if (starting === operation) starting = null;
    }
  }
  async function signIn() {
    const intent = ++loginIntent;
    const before = automaticNavigations;
    await start();
    if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
    if (snapshot.signedIn || automaticNavigations !== before) return status();
    if (native && snapshot.error?.retryable) {
      let result;
      try {
        result = await bridgeRequest.call(bridge, "load", {});
      } catch {
        result = { ok: false, error: { code: "NETWORK", message: "계정을 다시 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.", retryable: true } };
      }
      if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      const source = await bridge.authStatus();
      if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      await nativeStatus(source);
      if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      if (snapshot.signedIn) return status();
      const error = snapshot.error || result?.error || { code: "AUTH_REQUIRED", message: "저장된 로그인을 확인하지 못했어요. SYNK ID로 다시 로그인해 주세요.", retryable: false };
      if (!snapshot.error) emit({ signedIn: false, accountId: null, account: null, status: "error", error: publicError(error) });
      throw Object.assign(new Error(error.message), error);
    }
    if (snapshot.error?.retryable) throw Object.assign(new Error(snapshot.error.message), snapshot.error);
    if (!snapshot.configured) throw fault("AUTH_CONFIG", "SYNK ID 로그인 설정이 아직 없어요. 지금은 이 기기의 수첩을 쓸 수 있어요.");
    if (native) {
      const result = await bridge.authSignIn();
      if (disposed || intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      if (result?.ok === false) throw Object.assign(new Error(result.error?.message), result.error);
      return nativeStatus(result);
    }
    const expected = epoch;
    platformEntry.resume();
    const url = await core.beginOAuth({ config, product: clientKey, storage, now: now(), cryptoAPI });
    guard(expected);
    if (intent !== loginIntent) throw fault("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
    emit({ status: "signing-in", error: null });
    navigate(url);
    return status();
  }
  async function signOut() {
    loginIntent++;
    let entryError;
    try {
      platformEntry?.cancel();
    } catch (error) {
      entryError = error;
    }
    const old = session2;
    clearSession(entryError);
    if (native) {
      const result = await bridge.authSignOut();
      await nativeStatus(await bridge.authStatus());
      return result;
    }
    let serverSessionRevoked = !old, refreshRevoked = !old;
    if (old?.access_token && config) {
      const accountUrl = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/synk-account`;
      try {
        const loaded = await send(accountUrl, old.access_token);
        const current = loaded.data?.sessions?.find((item) => item.current && !item.revoked);
        if (current?.id) {
          const revoked = await send(accountUrl, old.access_token, { action: "revoke-session", session_id: current.id });
          serverSessionRevoked = revoked.response.ok && revoked.data?.ok === true;
          refreshRevoked = serverSessionRevoked && revoked.data.current === true && revoked.data.refreshRevoked === true;
        }
      } catch {
      }
      if (!refreshRevoked) {
        try {
          const result = await send(new URL("/auth/v1/logout?scope=local", config.supabaseUrl).href, old.access_token, {}, { logout: true });
          refreshRevoked = result.response.ok || result.response.status === 404 || serverSessionRevoked && result.response.status === 401;
        } catch {
        }
      }
    }
    return { ok: !snapshot.error, status: status(), serverRevoked: serverSessionRevoked && refreshRevoked, serverSessionRevoked, refreshRevoked };
  }
  async function request(operation, values = {}) {
    if (!snapshot.signedIn || !snapshot.accountId) throw fault("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 계정 자료를 확인해 주세요.");
    const expected = epoch, ownerId = snapshot.accountId;
    try {
      return await dispatch(operation, values, expected, ownerId);
    } catch (error) {
      if (expected === epoch && (AUTH_ERRORS.has(error.code) || error.code === "ACCOUNT_CHANGED")) clearSession(error);
      throw error;
    }
  }
  async function requestPush(action, values = {}) {
    if (clientKey !== "care" || endpoint !== "synk-care" || native) throw fault("PUSH_UNSUPPORTED", "예약 알림은 플레저 웹에서 설정해 주세요.");
    if (!snapshot.signedIn || !snapshot.accountId) throw fault("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 알림을 설정해 주세요.");
    const allowed = { status: ["endpoint"], subscribe: ["subscription", "hour", "minute"], update: ["endpoint", "hour", "minute"], unsubscribe: ["endpoint"] };
    if (!Object.hasOwn(allowed, action) || !values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).some((key) => !allowed[action].includes(key))) throw fault("INVALID_REQUEST", "알림 설정 형식이 맞지 않아요.");
    if (["subscribe", "update"].includes(action) && (!Number.isInteger(values.hour) || values.hour < 0 || values.hour > 23 || !Number.isInteger(values.minute) || values.minute < 0 || values.minute > 59)) throw fault("INVALID_REQUEST", "알림 시간이 맞지 않아요. 다시 골라 주세요.");
    if ((action === "update" || action === "unsubscribe" || Object.hasOwn(values, "endpoint")) && (typeof values.endpoint !== "string" || values.endpoint.length > 2048 || !values.endpoint.startsWith("https://"))) throw fault("INVALID_REQUEST", "이 기기의 알림 연결이 끊겼어요. 알림을 다시 켜 주세요.");
    if (action === "subscribe" && (!values.subscription || typeof values.subscription !== "object" || Array.isArray(values.subscription))) throw fault("INVALID_REQUEST", "이 기기의 알림 연결이 끊겼어요. 알림을 다시 켜 주세요.");
    const body = { action, ...values };
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 8192) throw fault("INVALID_REQUEST", "알림 설정이 너무 커서 저장할 수 없어요.");
    const expected = epoch, ownerId = snapshot.accountId;
    try {
      guard(expected);
      let token = session2?.access_token;
      if (!token) throw fault("AUTH_REQUIRED", "SYNK ID로 다시 로그인해 주세요.");
      if (session2.expires_at <= now() + 3e4) token = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/synk-care-push`;
      let result = await send(url, token, body);
      guard(expected);
      if (result.response.status === 401 && session2?.refresh_token) {
        token = session2.access_token !== token ? session2.access_token : await refresh(expected);
        guard(expected);
        result = await send(url, token, body);
        guard(expected);
      }
      const data = result.data;
      if (!result.response.ok || data?.ok !== true) throw fault(data?.error?.code || (result.response.status === 401 ? "AUTH_REQUIRED" : "PUSH_UNAVAILABLE"), "예약 알림을 설정하지 못했어요. 잠시 뒤 다시 시도해 주세요.", { status: result.response.status, retryable: result.response.status === 429 || result.response.status >= 500 });
      if (data.accountId !== ownerId) throw fault("ACCOUNT_CHANGED", "계정이 바뀌어 알림 설정을 적용하지 않았어요.");
      if (data.scope !== "synk-care-push" || typeof data.enabled !== "boolean" || data.timeZone !== "Asia/Seoul" || !Number.isInteger(data.hour) || data.hour < 0 || data.hour > 23 || !Number.isInteger(data.minute) || data.minute < 0 || data.minute > 59 || typeof data.publicKey !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(data.publicKey)) throw fault("INVALID_RESPONSE", "알림 서버의 응답을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      return { ok: true, scope: data.scope, accountId: ownerId, enabled: data.enabled, hour: data.hour, minute: data.minute, timeZone: data.timeZone, publicKey: data.publicKey, ...typeof data.deviceId === "string" ? { deviceId: data.deviceId } : {} };
    } catch (error) {
      if (expected === epoch && (AUTH_ERRORS.has(error.code) || error.code === "ACCOUNT_CHANGED")) clearSession(error);
      throw error;
    }
  }
  function dispose() {
    disposed = true;
    epoch++;
    loginIntent++;
    session2 = null;
    pendingExchange = null;
    nativeIdentity = null;
    unsubscribe?.();
    stopRequests();
  }
  return Object.freeze({ start, status, signIn, signOut, request, requestPush, dispose });
}

// experiences/synk-account/src/document-sync.mjs
var validRevision = (value) => Number.isSafeInteger(value) && value >= 0;
var failure = (code, revision2) => Object.assign(new Error(code), { code, ...validRevision(revision2) ? { revision: revision2 } : {} });
var messages = {
  CARE_CLIENT_UPDATE_REQUIRED: "더 새 판의 앱에서 저장한 문구 보관함이나 안부 설정이 있어요. 지금 자료를 파일로 내보낸 뒤 페이지를 새로 고쳐 주세요.",
  CARE_LIBRARY_RECOVERY_REVIEW: "계정 보관함의 이전 문구·즐겨찾기 또는 안부 주기 설정이 이 임시기록에는 없어요. 임시기록을 복구 파일로 백업한 뒤 계정 수첩을 선택해 주세요.",
  REVISION_CONFLICT: "다른 기기에서 기록이 바뀌었어요. 어느 기록을 사용할지 골라 주세요.",
  LOCAL_CHANGED_DURING_REFRESH: "가져오는 동안 새로 수정한 내용이 있어요. 기록을 다시 골라 주세요.",
  AUTH_REQUIRED: "SYNK 계정에 다시 로그인해 주세요.",
  SESSION_REVOKED: "로그인이 종료되었어요. 다시 로그인해 주세요.",
  ACCOUNT_UNAVAILABLE: "지금은 이 계정의 기록을 사용할 수 없어요.",
  PRODUCT_FORBIDDEN: "이 로그인으로는 플레저 기록에 접근할 수 없어요.",
  CARE_ACCOUNT_MISMATCH: "로그인 계정과 기록의 계정이 달라요. 다시 로그인해 주세요.",
  INVALID_CARE_RESPONSE: "계정에서 받은 기록을 확인하지 못했어요. 다시 불러와 주세요.",
  INVALID_CARE_STATE: "저장할 기록을 확인하지 못했어요. 현재 자료를 내보내 주세요.",
  INVALID_LOCAL_CACHE: "읽지 못한 기기 임시 기록의 원본을 그대로 보존했어요. 로그인한 계정의 기록으로 확인된 원본만 복구 파일로 내보내거나 직접 지울 수 있어요.",
  LOCAL_DRAFT_CONFLICT: "이 계정의 미저장 기록이 기기에 남아 있어요. 다른 탭에서 편집 중일 수도 있으니 이어서 사용할 기록을 직접 골라 주세요. 고르지 않은 기록도 보존해요.",
  LOCAL_STORAGE_UNAVAILABLE: "이 기기의 임시 기록을 보관하거나 지우지 못했어요. 저장 결과를 확인하고 현재 자료를 내보내 주세요.",
  LOCAL_CACHE_IN_USE: "현재 변경을 저장하거나 계정 저장본으로 전환한 뒤 이 계정의 임시기록을 지울 수 있어요. 진행 중인 저장·조회도 먼저 마쳐 주세요.",
  LOCAL_RECOVERY_AUTH_REQUIRED: "임시기록을 남긴 SYNK 계정으로 로그인해야 복구 파일 내보내기와 삭제를 할 수 있어요.",
  PAYLOAD_TOO_LARGE: "저장할 기록이 계정 보관 크기를 넘었어요. 먼저 내보낸 뒤 내용을 줄여 저장해 주세요.",
  INVALID_PERSONAL_STATE: "저장할 기록 형식을 확인하지 못했어요. 현재 자료를 내보내 보관해 주세요.",
  PERSONAL_DATA_TOO_LARGE: "저장할 기록이 계정 보관 크기를 넘었어요. 먼저 내보낸 뒤 내용을 줄여 저장해 주세요.",
  REVISION_CAPACITY: "이 기록의 저장 횟수 한도에 도달했어요. 현재 자료를 내보내 보관하고 지원을 요청해 주세요.",
  ASSET_NOT_FOUND: "앨범 원본을 찾지 못했어요. 현재 화면에 원본이 있다면 저장 다시 시도로 다시 올려 주세요.",
  ASSET_NOT_CONFIRMED: "앨범 원본의 보관을 확인하지 못했어요. 저장 다시 시도로 원본을 다시 올려 주세요.",
  MEDIA_QUOTA_EXCEEDED: "사진·음성 보관 공간 20MiB 또는 파일 수 한도에 도달했어요. 기존 사진·음성을 제거하고 저장을 마친 뒤 새 파일을 추가해 주세요.",
  CARE_UNAVAILABLE: "계정 저장 연결이 아직 준비되지 않았어요. 현재 기록은 이 기기에서 보관해요.",
  AUTH_UNAVAILABLE: "로그인 서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요."
};
var documentSyncErrorMessage = (error) => messages[error?.code] || error?.message || "계정에 저장하지 못했어요. 연결을 확인한 뒤 다시 시도해 주세요.";
function createDocumentSync({ transport, storage, onState = () => {
}, onStatus = () => {
}, onSaved = () => {
}, onRemoved = () => {
}, validateState, emptyState, requiresConflictReview = () => false, preferRemoteOnOpen = false, scope, resource = null, cachePrefix, operations = { load: "careLoad", save: "careSave", delete: "careDelete" } }) {
  if (typeof validateState !== "function" || typeof emptyState !== "function" || typeof requiresConflictReview !== "function" || !scope || !cachePrefix) throw new TypeError("제품 기록 계약이 필요해요.");
  const clone2 = (value) => validateState(value);
  const PREFIX = cachePrefix;
  if (typeof transport !== "function") throw new TypeError("계정 저장 통로가 필요해요.");
  let active = null, generation = 0, localError = null;
  const records = /* @__PURE__ */ new Map(), knownKeys = /* @__PURE__ */ new Set();
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const localSummary = () => {
    const all = [...records.values()], own = active ? all.filter((value) => value.accountId === active.accountId) : [];
    return {
      count: active ? own.length : all.length,
      pending: own.filter((value) => value.pending).length,
      corrupt: own.filter((value) => value.corrupt).length,
      exportable: own.length,
      unknown: all.filter((value) => !value.accountId).length,
      error: localError
    };
  };
  function recordOwner(key, cached) {
    if (typeof cached?.accountId !== "string" || !cached.accountId || cached.accountId.length > 120 || /[\x00-\x20]/.test(cached.accountId)) return null;
    const base = PREFIX + encodeURIComponent(cached.accountId);
    return key === base && cached.draftId === void 0 || UUID.test(cached.draftId || "") && key === base + ":draft:" + cached.draftId ? cached.accountId : null;
  }
  function cacheRecord(key, raw) {
    let accountId = null;
    try {
      if (new TextEncoder().encode(raw).byteLength > 4 * 1024 * 1024 + 32768) throw failure("INVALID_LOCAL_CACHE");
      const cached = JSON.parse(raw);
      accountId = recordOwner(key, cached);
      const base = PREFIX + encodeURIComponent(cached?.accountId);
      const draft = typeof cached?.draftId === "string" && UUID.test(cached.draftId);
      if (cached?.version !== 1 || typeof cached.accountId !== "string" || !(draft ? key === base + ":draft:" + cached.draftId : cached.draftId === void 0 && key === base) || draft && (typeof cached.createdAt !== "string" || !Number.isFinite(Date.parse(cached.createdAt))) || typeof cached.pending !== "boolean" || cached.baseRevision !== null && !validRevision(cached.baseRevision)) throw failure("INVALID_LOCAL_CACHE");
      const state2 = clone2(cached.state);
      return { accountId, pending: cached.pending, corrupt: false, cached: { ...cached, state: state2 } };
    } catch {
      return { accountId, pending: false, corrupt: true };
    }
  }
  function localEntries() {
    const keys = new Set(knownKeys);
    if (typeof storage?.key !== "function" || !Number.isSafeInteger(storage.length) || storage.length < 0) throw failure("LOCAL_STORAGE_UNAVAILABLE");
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (typeof key === "string" && key.startsWith(PREFIX)) keys.add(key);
    }
    if (!storage?.getItem) throw failure("LOCAL_STORAGE_UNAVAILABLE");
    return [...keys].sort().flatMap((key) => {
      const raw = storage.getItem(key);
      return raw === null || raw === void 0 ? [] : [{ key, raw }];
    });
  }
  function erase(key, expectedRaw) {
    if (!storage?.removeItem) throw failure("LOCAL_STORAGE_UNAVAILABLE");
    if (expectedRaw !== void 0 && storage.getItem(key) !== expectedRaw) return false;
    storage.removeItem(key);
    records.delete(key);
    knownKeys.delete(key);
    return true;
  }
  function localRecords() {
    try {
      const entries = localEntries();
      records.clear();
      localError = null;
      for (const { key, raw } of entries) {
        knownKeys.add(key);
        const record = cacheRecord(key, raw);
        records.set(key, { ...record, key, raw });
        if (active && record.accountId === active.accountId && !record.pending && !record.corrupt) try {
          erase(key, raw);
        } catch {
          localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
        }
      }
    } catch {
      localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
    }
    return localSummary();
  }
  function exportLocalRecords() {
    if (!active) throw failure("LOCAL_RECOVERY_AUTH_REQUIRED");
    try {
      return { format: "synk-account-local-recovery", version: 1, scope, resource, accountId: active.accountId, entries: localEntries().filter(({ key, raw }) => cacheRecord(key, raw).accountId === active.accountId) };
    } catch {
      localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
      if (active) emit(active, "storage-error", failure("LOCAL_STORAGE_UNAVAILABLE"));
      else emitClosed();
      throw failure("LOCAL_STORAGE_UNAVAILABLE");
    }
  }
  function emitClosed() {
    const local = localSummary(), error = localError || (local.corrupt ? { code: "INVALID_LOCAL_CACHE", message: messages.INVALID_LOCAL_CACHE } : null);
    onStatus({ status: "closed", revision: null, accountId: null, error, pending: false, pendingStored: true, localPersistenceError: !!localError, localRecords: local, localDrafts: [] });
  }
  function clearLocalRecords() {
    const context = active;
    if (!context) {
      emitClosed();
      return false;
    }
    if (context.pending || context.busy || context.deleting) {
      emit(context, "error", failure("LOCAL_CACHE_IN_USE"));
      return false;
    }
    try {
      for (const { key, raw } of localEntries()) if (cacheRecord(key, raw).accountId === context.accountId) erase(key, raw);
      localRecords();
      localError = null;
      context.storageError = false;
      context.invalidCache = false;
      context.localChoice = false;
      emit(context, "synced");
      return true;
    } catch {
      context.storageError = true;
      localRecords();
      localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
      emit(context, "storage-error", failure("LOCAL_STORAGE_UNAVAILABLE"));
      return false;
    }
  }
  localRecords();
  const isCurrent = (context) => active === context && context.generation === generation;
  const emitState = (context) => {
    if (isCurrent(context)) onState(clone2(context.state));
  };
  function draftGroups(context, all = false) {
    localRecords();
    const groups = /* @__PURE__ */ new Map(), excluded = all ? /* @__PURE__ */ new Set() : /* @__PURE__ */ new Set([...context.owned.keys(), ...context.recovery.keys()]);
    for (const record of records.values()) {
      if (!record.pending || record.corrupt || record.cached.accountId !== context.accountId || excluded.has(record.key)) continue;
      const signature = JSON.stringify({ baseRevision: record.cached.baseRevision, state: record.cached.state });
      let group = groups.get(signature);
      if (!group) {
        group = {
          id: record.cached.draftId || "legacy",
          createdAt: record.cached.createdAt || null,
          baseRevision: record.cached.baseRevision,
          state: record.cached.state,
          entries: /* @__PURE__ */ new Map(),
          itemCount: Object.values(record.cached.state).reduce((n, value) => n + (Array.isArray(value) ? value.length : 0), 0)
        };
        groups.set(signature, group);
      }
      group.entries.set(record.key, record.raw);
    }
    return [...groups.values()].sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "") || a.id.localeCompare(b.id));
  }
  const publicDrafts = (groups) => groups.map(({ id, createdAt, baseRevision, itemCount, entries }) => ({ id, createdAt, baseRevision, itemCount, copies: entries.size }));
  const emit = (context, status, error = null) => {
    if (!isCurrent(context)) return;
    context.choices = draftGroups(context);
    if (context.localChoice && !context.choices.length && !localError) context.localChoice = false;
    context.invalidCache = [...records.values()].some((record) => record.corrupt && record.accountId === context.accountId);
    const currentSignature = JSON.stringify(context.state);
    const pendingStored = !context.pending || !localError && [...records.values()].some((record) => record.pending && !record.corrupt && record.cached.accountId === context.accountId && JSON.stringify(record.cached.state) === currentSignature);
    const warning = context.invalidCache ? { code: "INVALID_LOCAL_CACHE", message: messages.INVALID_LOCAL_CACHE } : context.storageError || localError ? { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE } : null;
    const choiceError = context.localChoice ? { code: "LOCAL_DRAFT_CONFLICT", message: messages.LOCAL_DRAFT_CONFLICT } : null;
    const notification = {
      status: choiceError ? "local-conflict" : !error && warning ? warning.code === "INVALID_LOCAL_CACHE" ? "error" : "storage-error" : status,
      revision: context.revision,
      accountId: context.accountId,
      pending: context.pending,
      pendingStored,
      localPersistenceError: !!(context.storageError || localError),
      localRecords: localSummary(),
      localDrafts: publicDrafts(context.choices),
      warning,
      error: error ? { code: error.code || "CARE_SYNC_FAILED", message: documentSyncErrorMessage(error), ...typeof error.assetId === "string" && UUID.test(error.assetId) ? { assetId: error.assetId } : {} } : choiceError || warning
    };
    context.lastNotification = notification;
    onStatus(notification);
  };
  function removeEntries(context, entries) {
    let ok = true;
    for (const [key, raw] of entries) try {
      erase(key, raw);
      context.owned.delete(key);
      context.recovery.delete(key);
    } catch {
      context.storageError = true;
      ok = false;
    }
    return ok;
  }
  function detachDraft(context) {
    context.owned = /* @__PURE__ */ new Map();
    context.recovery = /* @__PURE__ */ new Map();
    context.currentDraft = null;
  }
  function persist(context) {
    if (!isCurrent(context)) return false;
    try {
      if (context.pending) {
        if (!storage?.setItem) throw failure("LOCAL_STORAGE_UNAVAILABLE");
        const signature = JSON.stringify({ baseRevision: context.baseRevision, state: context.state });
        if (context.currentDraft?.signature === signature && storage.getItem(context.currentDraft.key) === context.currentDraft.raw) {
          if (!removeEntries(context, new Map([...context.owned].filter(([key2]) => key2 !== context.currentDraft.key)))) return false;
          context.storageError = false;
          return true;
        }
        const draftId = globalThis.crypto.randomUUID(), key = context.key + ":draft:" + draftId;
        const raw = JSON.stringify({
          version: 1,
          accountId: context.accountId,
          draftId,
          createdAt: (/* @__PURE__ */ new Date()).toISOString(),
          baseRevision: context.baseRevision,
          state: context.state,
          pending: true
        });
        storage.setItem(key, raw);
        const previous = new Map(context.owned);
        context.owned.set(key, raw);
        context.currentDraft = { key, raw, signature };
        knownKeys.add(key);
        records.set(key, { ...cacheRecord(key, raw), key, raw });
        if (!removeEntries(context, previous)) return false;
      } else if (!removeEntries(context, new Map([...context.recovery, ...context.owned]))) return false;
      if (context.storageError && localError?.code === "LOCAL_STORAGE_UNAVAILABLE") localError = null;
      context.storageError = false;
      return true;
    } catch {
      context.storageError = true;
      return false;
    }
  }
  function stopTimer(context) {
    if (context?.timer) clearTimeout(context.timer);
    if (context) context.timer = null;
  }
  function schedule(context) {
    stopTimer(context);
    if (!isCurrent(context) || context.conflict || context.localChoice || context.deleting) return;
    context.timer = setTimeout(() => {
      context.timer = null;
      void flush();
    }, 400);
    context.timer.unref?.();
  }
  function reportFailure(context, error) {
    if (!isCurrent(context)) return false;
    if (["REVISION_CONFLICT", "LOCAL_CHANGED_DURING_REFRESH"].includes(error?.code)) {
      context.conflict = true;
      if (validRevision(error.revision)) context.revision = error.revision;
      persist(context);
      emit(context, "conflict", error);
    } else {
      const hard = ["AUTH_REQUIRED", "SESSION_REVOKED", "ACCOUNT_UNAVAILABLE", "PRODUCT_FORBIDDEN", "CARE_ACCOUNT_MISMATCH", "INVALID_CARE_RESPONSE", "INVALID_CARE_STATE", "CARE_CLIENT_UPDATE_REQUIRED", "PAYLOAD_TOO_LARGE", "INVALID_PERSONAL_STATE", "PERSONAL_DATA_TOO_LARGE", "REVISION_CAPACITY", "ASSET_NOT_FOUND", "ASSET_NOT_CONFIRMED", "MEDIA_QUOTA_EXCEEDED"].includes(error?.code);
      emit(context, hard ? "error" : "offline", error);
    }
    return false;
  }
  function enqueue(context, operation) {
    if (!context || !isCurrent(context)) return Promise.resolve(false);
    context.busy++;
    const result = context.chain.catch(() => {
    }).then(async () => {
      try {
        return isCurrent(context) ? await operation() : false;
      } catch (error) {
        return reportFailure(context, error);
      } finally {
        context.busy--;
      }
    });
    context.chain = result;
    return result;
  }
  async function request(context, action, body) {
    const reply = await transport(action, body);
    if (!isCurrent(context)) throw failure("CARE_SESSION_ENDED");
    if (reply?.ok === false) throw Object.assign(failure(reply.error?.code || reply.code || "CARE_SYNC_FAILED", reply.revision), typeof reply.error?.assetId === "string" && UUID.test(reply.error.assetId) ? { assetId: reply.error.assetId } : {});
    if (!reply || reply.ok !== true || reply.scope !== scope || resource && reply.resource !== resource || !validRevision(reply.revision) || !Object.hasOwn(reply, "state")) throw failure("INVALID_CARE_RESPONSE");
    if (reply.accountId !== context.accountId) throw failure("CARE_ACCOUNT_MISMATCH");
    let state2;
    try {
      state2 = reply.state === null ? emptyState() : clone2(reply.state);
    } catch {
      throw failure("INVALID_CARE_RESPONSE");
    }
    return { ...reply, state: state2, empty: reply.state === null };
  }
  async function load(context, mode = "refresh") {
    const before = context.sequence;
    emit(context, "loading");
    const remote = await request(context, operations.load);
    if (mode === "remote" && before !== context.sequence) {
      context.conflict = true;
      persist(context);
      emit(context, "conflict", failure("LOCAL_CHANGED_DURING_REFRESH"));
      return false;
    }
    if (mode === "remote" && context.pending && !persist(context)) {
      emit(context, "storage-error", failure("LOCAL_STORAGE_UNAVAILABLE"));
      return false;
    }
    context.known = true;
    context.revision = remote.revision;
    if (context.localChoice && mode !== "remote") {
      context.state = remote.state;
      context.baseRevision = remote.revision;
      emitState(context);
      emit(context, "local-conflict");
      return false;
    }
    if (mode === "local") {
      context.baseRevision = remote.revision;
      context.pending = true;
      context.conflict = false;
      persist(context);
      return true;
    }
    if (mode !== "remote" && context.pending) {
      if (context.baseRevision === null && remote.empty && remote.revision === 0) context.baseRevision = 0;
      const conflictCode = context.baseRevision !== remote.revision ? "REVISION_CONFLICT" : requiresConflictReview(context.state, remote.state) ? "CARE_LIBRARY_RECOVERY_REVIEW" : null;
      if (conflictCode) {
        context.conflict = true;
        persist(context);
        emit(context, "conflict", failure(conflictCode, remote.revision));
        return false;
      }
      context.conflict = false;
      persist(context);
      emit(context, "idle");
      return true;
    }
    const changed = JSON.stringify(context.state) !== JSON.stringify(remote.state);
    if (mode === "remote") {
      detachDraft(context);
      context.localChoice = false;
    }
    context.state = remote.state;
    context.baseRevision = remote.revision;
    context.pending = false;
    context.conflict = false;
    persist(context);
    if (changed || mode === "remote") emitState(context);
    emit(context, "synced");
    return true;
  }
  async function drain(context) {
    if (context.localChoice) {
      emit(context, "local-conflict");
      if (!context.localChoice) return load(context);
    }
    if (context.localChoice) {
      emit(context, "local-conflict");
      return false;
    }
    if (!context.known && !await load(context)) return false;
    if (!isCurrent(context) || context.conflict || context.deleting) return false;
    while (context.pending && isCurrent(context) && !context.conflict && !context.deleting) {
      const sequence = context.sequence, sent = clone2(context.state), expected = context.baseRevision;
      const acknowledged = new Map([...context.recovery, ...context.owned]);
      emit(context, "saving");
      const remote = await request(context, operations.save, { expected_revision: expected, state: sent });
      if (remote.revision !== expected + 1 || remote.empty) throw failure("INVALID_CARE_RESPONSE");
      onSaved(clone2(remote.state));
      context.revision = remote.revision;
      context.baseRevision = remote.revision;
      if (context.sequence === sequence) {
        context.state = remote.state;
        context.pending = false;
      }
      removeEntries(context, acknowledged);
      if (!context.pending) context.currentDraft = null;
      persist(context);
      emit(context, context.pending ? "idle" : "synced");
    }
    return !context.pending;
  }
  function close() {
    if (active?.storageListener) globalThis.removeEventListener?.("storage", active.storageListener);
    stopTimer(active);
    if (active && !active.pending) persist(active);
    const cleanupError = active?.storageError;
    generation += 1;
    active = null;
    localRecords();
    if (cleanupError) localError = { code: "LOCAL_STORAGE_UNAVAILABLE", message: messages.LOCAL_STORAGE_UNAVAILABLE };
    onState(emptyState());
    emitClosed();
  }
  async function open(accountId) {
    if (typeof accountId !== "string" || !accountId || accountId.length > 120 || /[\x00-\x20]/.test(accountId)) throw failure("INVALID_ACCOUNT_ID");
    close();
    const context = {
      accountId,
      key: PREFIX + encodeURIComponent(accountId),
      generation,
      chain: Promise.resolve(),
      state: emptyState(),
      revision: null,
      baseRevision: null,
      pending: false,
      known: false,
      conflict: false,
      deleting: false,
      sequence: 0,
      storageError: false,
      invalidCache: false,
      timer: null,
      busy: 0
    };
    Object.assign(context, { owned: /* @__PURE__ */ new Map(), recovery: /* @__PURE__ */ new Map(), currentDraft: null, choices: [], localChoice: false });
    active = context;
    knownKeys.add(context.key);
    try {
      const choices = draftGroups(context, true);
      context.invalidCache = [...records.values()].some((record) => record.corrupt && record.accountId === accountId);
      if (choices.length && !preferRemoteOnOpen) context.localChoice = true;
    } catch {
      context.storageError = true;
      emit(context, "storage-error");
    }
    emitState(context);
    context.storageListener = (event) => {
      if (!isCurrent(context) || event.key !== null && !(event.key === context.key || event.key?.startsWith(context.key + ":draft:"))) return;
      const choosing = context.localChoice, previous = context.lastNotification;
      emit(context, choosing ? "synced" : previous?.status || (context.pending ? "idle" : "synced"), choosing ? null : previous?.error);
      if (choosing && !context.localChoice && !context.pending) void refresh();
    };
    globalThis.addEventListener?.("storage", context.storageListener);
    return enqueue(context, async () => {
      const loaded = await load(context);
      if (loaded && context.pending) schedule(context);
      return loaded;
    });
  }
  function change(state2) {
    const context = active;
    if (!context) throw failure("CARE_ACCOUNT_REQUIRED");
    if (context.deleting) throw failure("CARE_DELETE_IN_PROGRESS");
    if (context.localChoice) {
      emit(context, "local-conflict");
      if (context.localChoice) throw failure("LOCAL_DRAFT_CONFLICT");
    }
    const normalized = clone2(state2);
    if (JSON.stringify(normalized) === JSON.stringify(context.state)) return false;
    context.state = normalized;
    context.pending = true;
    context.sequence += 1;
    persist(context);
    emit(context, context.conflict ? "conflict" : "idle");
    schedule(context);
    return true;
  }
  function flush() {
    const context = active;
    stopTimer(context);
    return enqueue(context, () => drain(context));
  }
  function refresh() {
    const context = active;
    stopTimer(context);
    return enqueue(context, async () => {
      const loaded = await load(context);
      if (loaded && context.pending) schedule(context);
      return loaded;
    });
  }
  function resolveRemote() {
    const context = active;
    stopTimer(context);
    return enqueue(context, () => {
      if (context.pending && !persist(context)) {
        emit(context, "storage-error", failure("LOCAL_STORAGE_UNAVAILABLE"));
        return false;
      }
      return load(context, "remote");
    });
  }
  function resolveLocal() {
    const context = active;
    stopTimer(context);
    return enqueue(context, async () => {
      if (!await load(context, "local")) return false;
      return drain(context);
    });
  }
  function selectLocalDraft(id) {
    const context = active;
    stopTimer(context);
    return enqueue(context, async () => {
      if (context.pending && !persist(context)) {
        emit(context, "storage-error");
        return false;
      }
      const selected = draftGroups(context).find((group) => group.id === id);
      if (!selected) {
        emit(context, "synced");
        if (!context.localChoice && !context.pending) await load(context);
        return false;
      }
      detachDraft(context);
      context.recovery = new Map(selected.entries);
      context.state = clone2(selected.state);
      context.baseRevision = selected.baseRevision;
      context.pending = true;
      context.known = false;
      context.conflict = false;
      context.localChoice = false;
      context.sequence++;
      emitState(context);
      try {
        const loaded = await load(context);
        if (loaded && context.pending) schedule(context);
      } catch (error) {
        reportFailure(context, error);
      }
      return true;
    });
  }
  function remove() {
    const context = active;
    stopTimer(context);
    if (!context) return Promise.resolve(false);
    context.deleting = true;
    return enqueue(context, async () => {
      try {
        if (!context.known && !await load(context)) return false;
        if (context.conflict) {
          emit(context, "conflict", failure("REVISION_CONFLICT", context.revision));
          return false;
        }
        emit(context, "saving");
        const expected = context.baseRevision;
        const remote = await request(context, operations.delete, { expected_revision: expected });
        if (remote.revision !== expected + 1 || !remote.empty) throw failure("INVALID_CARE_RESPONSE");
        onRemoved();
        context.state = emptyState();
        context.revision = remote.revision;
        context.baseRevision = remote.revision;
        context.pending = false;
        context.conflict = false;
        context.localChoice = false;
        context.sequence += 1;
        removeEntries(context, new Map([...context.recovery, ...context.owned]));
        context.currentDraft = null;
        persist(context);
        emitState(context);
        emit(context, "synced");
        return true;
      } finally {
        context.deleting = false;
      }
    });
  }
  return { open, change, flush, refresh, resolveRemote, resolveLocal, selectLocalDraft, remove, close, localRecords, exportLocalRecords, clearLocalRecords };
}

// experiences/path-app/state.mjs
var SCHEMA_VERSION = 1;
var SESSION_KEY = "synk-path-app-session-v1";
var GOAL_IDS = Object.freeze(["study", "student", "job"]);
var LOCATION_IDS = Object.freeze(["unknown", "korea", "abroad"]);
var LANG_IDS = Object.freeze(["ko", "en"]);
var MAX_TASKS = 50;
var MAX_BODY = 6e3;
var MAX_INTERESTS = 20;
var ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
var SOURCE_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;
var isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var isGoal = (v) => GOAL_IDS.includes(v);
var isIsoString = (v) => typeof v === "string" && v.length <= 40 && !Number.isNaN(Date.parse(v));
var toIso = (now) => {
  const d = now instanceof Date ? now : new Date(now === void 0 ? Date.now() : now);
  return Number.isNaN(d.getTime()) ? (/* @__PURE__ */ new Date()).toISOString() : d.toISOString();
};
var capBody = (s) => typeof s === "string" ? s.slice(0, MAX_BODY) : "";
function isValidSourceId(v) {
  return typeof v === "string" && SOURCE_RE.test(v);
}
function createTaskId(goal, sourceId2) {
  if (!isGoal(goal) || !isValidSourceId(sourceId2)) throw new Error("Invalid goal or source");
  return goal + "-" + sourceId2;
}
function createInitialState(lang = "ko") {
  return {
    schemaVersion: SCHEMA_VERSION,
    revision: 0,
    savedAt: null,
    lang: lang === "en" ? "en" : "ko",
    onboarded: false,
    primaryGoal: null,
    secondaryGoals: [],
    location: "unknown",
    interests: [],
    tasks: []
  };
}
function cleanGoals(list, primary) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const g of list) if (isGoal(g) && g !== primary && !out.includes(g)) out.push(g);
  return out;
}
function cleanInterests(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const i of list) {
    if (typeof i === "string" && SOURCE_RE.test(i) && !out.includes(i)) out.push(i);
    if (out.length >= MAX_INTERESTS) break;
  }
  return out;
}
function cleanTask(t2) {
  if (!isObj(t2)) return null;
  if (typeof t2.id !== "string" || !ID_RE.test(t2.id)) return null;
  if (!isGoal(t2.goal) || !isValidSourceId(t2.sourceId) || typeof t2.body !== "string") return null;
  if (t2.body.length > MAX_BODY) return null;
  const body = t2.body;
  if (!isIsoString(t2.updatedAt)) return null;
  const updatedAt = t2.updatedAt;
  let confirmedAt = null;
  if (t2.confirmedAt !== null && t2.confirmedAt !== void 0) {
    if (!isIsoString(t2.confirmedAt) || !body.trim()) return null;
    confirmedAt = t2.confirmedAt;
  }
  return { id: t2.id, goal: t2.goal, sourceId: t2.sourceId, body, confirmedAt, updatedAt };
}
function normalizeState(raw) {
  try {
    if (!isObj(raw)) return null;
    if (raw.schemaVersion !== SCHEMA_VERSION) return null;
    if (raw.tasks !== void 0 && !Array.isArray(raw.tasks)) return null;
    const rawTasks = Array.isArray(raw.tasks) ? raw.tasks : [];
    if (rawTasks.length > MAX_TASKS) return null;
    const primaryGoal = isGoal(raw.primaryGoal) ? raw.primaryGoal : null;
    const tasks = [];
    const seen = /* @__PURE__ */ new Set();
    for (const t2 of rawTasks) {
      const c = cleanTask(t2);
      if (!c || seen.has(c.id)) return null;
      seen.add(c.id);
      tasks.push(c);
    }
    if (!Number.isSafeInteger(raw.revision) || raw.revision < 0) return null;
    const rev = raw.revision;
    return {
      schemaVersion: SCHEMA_VERSION,
      revision: rev,
      savedAt: isIsoString(raw.savedAt) ? raw.savedAt : null,
      lang: raw.lang === "en" ? "en" : "ko",
      onboarded: raw.onboarded === true,
      primaryGoal,
      secondaryGoals: cleanGoals(raw.secondaryGoals, primaryGoal),
      location: LOCATION_IDS.includes(raw.location) ? raw.location : "unknown",
      interests: cleanInterests(raw.interests),
      tasks
    };
  } catch {
    return null;
  }
}
function requireState(state2) {
  const s = normalizeState(state2);
  if (!s) throw new Error("Invalid state");
  return s;
}
function bump(s, now) {
  s.revision += 1;
  s.savedAt = toIso(now);
  return s;
}
var PROFILE_FIELDS = ["lang", "onboarded", "primaryGoal", "secondaryGoals", "location", "interests"];
function updateProfile(state2, patch, now) {
  const s = requireState(state2);
  if (!isObj(patch)) throw new Error("Invalid profile patch");
  for (const key of PROFILE_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
    const v = patch[key];
    if (key === "lang") {
      if (!LANG_IDS.includes(v)) throw new Error("Invalid language");
      s.lang = v;
    } else if (key === "onboarded") {
      if (typeof v !== "boolean") throw new Error("Invalid onboarded flag");
      s.onboarded = v;
    } else if (key === "primaryGoal") {
      if (v !== null && !isGoal(v)) throw new Error("Invalid goal");
      s.primaryGoal = v;
    } else if (key === "secondaryGoals") {
      if (!Array.isArray(v)) throw new Error("Invalid secondary goals");
      s.secondaryGoals = cleanGoals(v, null);
    } else if (key === "location") {
      if (!LOCATION_IDS.includes(v)) throw new Error("Invalid location");
      s.location = v;
    } else if (key === "interests") {
      if (!Array.isArray(v)) throw new Error("Invalid interests");
      s.interests = cleanInterests(v);
    }
  }
  s.secondaryGoals = s.secondaryGoals.filter((g) => g !== s.primaryGoal);
  return bump(s, now);
}
function upsertTask(state2, input, now) {
  const s = requireState(state2);
  if (!isObj(input)) throw new Error("Invalid task");
  const { goal, sourceId: sourceId2 } = input;
  if (!isGoal(goal) || !isValidSourceId(sourceId2)) throw new Error("Invalid task goal or source");
  const id = input.id === void 0 ? createTaskId(goal, sourceId2) : input.id;
  if (typeof id !== "string" || !ID_RE.test(id)) throw new Error("Invalid task id");
  if (input.body !== void 0 && typeof input.body !== "string") throw new Error("Invalid task body");
  if (typeof input.body === "string" && input.body.length > MAX_BODY) throw new Error("Task body too long");
  const iso2 = toIso(now);
  const idx = s.tasks.findIndex((t2) => t2.id === id);
  if (idx >= 0) {
    const prev = s.tasks[idx];
    const body = input.body === void 0 ? prev.body : input.body;
    const same2 = body === prev.body && goal === prev.goal && sourceId2 === prev.sourceId;
    s.tasks[idx] = {
      id,
      goal,
      sourceId: sourceId2,
      body,
      confirmedAt: same2 ? prev.confirmedAt : null,
      updatedAt: same2 ? prev.updatedAt : iso2
    };
  } else {
    if (s.tasks.length >= MAX_TASKS) throw new Error("Task limit reached");
    s.tasks.push({ id, goal, sourceId: sourceId2, body: capBody(input.body || ""), confirmedAt: null, updatedAt: iso2 });
  }
  return bump(s, now);
}
function confirmTask(state2, id, now) {
  const s = requireState(state2);
  const task = s.tasks.find((t2) => t2.id === id);
  if (!task) throw new Error("Task not found");
  if (!task.body.trim()) throw new Error("Task body is empty");
  task.confirmedAt = toIso(now);
  return bump(s, now);
}
function getNextTask(state2) {
  const s = normalizeState(state2);
  if (!s || !s.primaryGoal) return null;
  const t2 = s.tasks.find((x) => x.goal === s.primaryGoal && !x.confirmedAt);
  return t2 ? { ...t2 } : null;
}

// experiences/path-app/document.mjs
var PATH_DOCUMENT_SCHEMA = "synk.path-app";
var PATH_DOCUMENT_VERSION = 1;
var MAX_DOCUMENT_BYTES = 2 * 1024 * 1024;
var MAX_SAVED_JOBS = 100;
var BOARDS = ["moloco", "coupang"];
var DEMOS = Object.freeze(Object.fromEntries(GOAL_IDS.flatMap((goal) => ["a", "b"].map((n) => [`demo-${goal}-${n}`, goal]))));
var fail = (code = "INVALID_PATH_DOCUMENT") => {
  throw Object.assign(new TypeError(code), { code });
};
var object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
var exact = (value, keys) => object(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
var wellFormed = (value) => {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 55296 && code <= 56319) {
      const next = value.charCodeAt(++i);
      if (!(next >= 56320 && next <= 57343)) return false;
    } else if (code >= 56320 && code <= 57343) return false;
  }
  return true;
};
var text = (value, max, empty = false) => typeof value === "string" && value.length <= max && (empty || value.trim().length > 0) && wellFormed(value) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);
var iso = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
var revision = (value) => Number.isSafeInteger(value) && value >= 0;
var sourceId = (value) => typeof value === "string" && /^[a-z0-9][a-z0-9-]{0,63}$/.test(value);
var uniqueList = (value, max, valid) => Array.isArray(value) && value.length <= max && new Set(value).size === value.length && value.every(valid);
function jobSourceId(board, jobId) {
  if (!BOARDS.includes(board) || typeof jobId !== "string" || !/^[1-9][0-9]{0,19}$/.test(jobId)) fail();
  return `greenhouse-${board}-${jobId}`;
}
function isSafeJobUrl(value, board, jobId) {
  try {
    jobSourceId(board, jobId);
    if (!text(value, 2048) || /[\s\\\u0000-\u001f]/.test(value)) return false;
    const url = new URL(value);
    if (url.protocol !== "https:" || url.username || url.password || url.hash || url.port) return false;
    if (["boards.greenhouse.io", "job-boards.greenhouse.io"].includes(url.hostname))
      return [`/${board}/jobs/${jobId}`, `/${board}/jobs/${jobId}/`].includes(url.pathname) && !url.search;
    if (board !== "coupang" || url.hostname !== "www.coupang.jobs") return false;
    const jobPath = url.pathname === "/en/jobs/" || new RegExp(`^/en/jobs/${jobId}/[a-zA-Z0-9%_-]+/$`).test(url.pathname);
    return jobPath && url.search === `?gh_jid=${jobId}`;
  } catch {
    return false;
  }
}
function validateSavedJob(raw) {
  if (!exact(raw, ["id", "provider", "board", "jobId", "snapshot", "savedAt"]) || raw.provider !== "greenhouse" || raw.id !== jobSourceId(raw.board, raw.jobId) || !iso(raw.savedAt)) fail();
  const s = raw.snapshot;
  if (!exact(s, ["company", "title", "location", "employmentType", "url", "observedAt"]) || !text(s.company, 120) || !text(s.title, 300) || !text(s.location, 240) || !(s.employmentType === null || text(s.employmentType, 200)) || !iso(s.observedAt) || !isSafeJobUrl(s.url, raw.board, raw.jobId)) fail();
  return {
    id: raw.id,
    provider: "greenhouse",
    board: raw.board,
    jobId: raw.jobId,
    snapshot: { company: s.company, title: s.title, location: s.location, employmentType: s.employmentType, url: s.url, observedAt: s.observedAt },
    savedAt: raw.savedAt
  };
}
function validatePathState(raw, savedJobs = []) {
  if (!exact(raw, ["schemaVersion", "revision", "savedAt", "lang", "onboarded", "primaryGoal", "secondaryGoals", "location", "interests", "tasks"]) || raw.schemaVersion !== 1 || !revision(raw.revision) || !(raw.savedAt === null || iso(raw.savedAt)) || !LANG_IDS.includes(raw.lang) || typeof raw.onboarded !== "boolean" || !(raw.primaryGoal === null || GOAL_IDS.includes(raw.primaryGoal)) || !LOCATION_IDS.includes(raw.location) || !uniqueList(raw.secondaryGoals, 3, (goal) => GOAL_IDS.includes(goal) && goal !== raw.primaryGoal) || !uniqueList(raw.interests, 20, sourceId) || !Array.isArray(raw.tasks) || raw.tasks.length > 50) fail();
  const known = new Set(savedJobs.map((job) => job.id)), seen = /* @__PURE__ */ new Set();
  const tasks = raw.tasks.map((task) => {
    if (!exact(task, ["id", "goal", "sourceId", "body", "confirmedAt", "updatedAt"]) || typeof task.id !== "string" || !/^[A-Za-z0-9_-]{1,80}$/.test(task.id) || seen.has(task.id) || !GOAL_IDS.includes(task.goal) || !sourceId(task.sourceId) || !text(task.body, 6e3, true) || !iso(task.updatedAt) || !(task.confirmedAt === null || iso(task.confirmedAt) && task.body.trim())) fail();
    if (Object.hasOwn(DEMOS, task.sourceId) ? DEMOS[task.sourceId] !== task.goal : task.goal !== "job" || !known.has(task.sourceId)) fail();
    seen.add(task.id);
    return { id: task.id, goal: task.goal, sourceId: task.sourceId, body: task.body, confirmedAt: task.confirmedAt, updatedAt: task.updatedAt };
  });
  return {
    schemaVersion: 1,
    revision: raw.revision,
    savedAt: raw.savedAt,
    lang: raw.lang,
    onboarded: raw.onboarded,
    primaryGoal: raw.primaryGoal,
    secondaryGoals: [...raw.secondaryGoals],
    location: raw.location,
    interests: [...raw.interests],
    tasks
  };
}
function validatePathDocument(raw) {
  let bytes;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(raw)).byteLength;
  } catch {
    fail();
  }
  if (bytes > MAX_DOCUMENT_BYTES) fail("PATH_DOCUMENT_TOO_LARGE");
  if (!exact(raw, ["schema", "version", "state", "savedJobs"]) || raw.schema !== PATH_DOCUMENT_SCHEMA || raw.version !== PATH_DOCUMENT_VERSION || !Array.isArray(raw.savedJobs) || raw.savedJobs.length > MAX_SAVED_JOBS) fail();
  const savedJobs = raw.savedJobs.map(validateSavedJob);
  if (new Set(savedJobs.map((job) => job.id)).size !== savedJobs.length) fail();
  return { schema: PATH_DOCUMENT_SCHEMA, version: PATH_DOCUMENT_VERSION, state: validatePathState(raw.state, savedJobs), savedJobs };
}
function createPathDocument(lang = "ko") {
  return { schema: PATH_DOCUMENT_SCHEMA, version: PATH_DOCUMENT_VERSION, state: createInitialState(lang), savedJobs: [] };
}
function removeSavedJob(raw, id) {
  const doc = validatePathDocument(raw);
  if (doc.state.tasks.some((task) => task.sourceId === id)) fail("JOB_IN_USE");
  doc.savedJobs = doc.savedJobs.filter((job) => job.id !== id);
  return doc;
}

// experiences/path-app/account.mjs
var GUEST_KEY = "synk-path-guest-document-v1";
var LEGACY_KEY = SESSION_KEY || "synk-path-app-session-v1";
var ACCOUNT_CACHE_PREFIX = "synk-path-app-account:";
var MAX_SAVED_JOBS2 = 100;
var OPERATIONS = Object.freeze({ load: "pathLoad", save: "pathSave", delete: "pathDelete" });
var fault2 = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
var clone = (value) => value === null || value === void 0 ? null : JSON.parse(JSON.stringify(value));
var same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
var publicError2 = (error) => error ? {
  code: typeof error.code === "string" ? error.code : "PATH_SESSION_ERROR",
  message: typeof error.message === "string" ? error.message : "",
  retryable: error.retryable === true
} : null;
function browserLang() {
  try {
    const l = String(globalThis.navigator?.language || "").toLowerCase();
    return l.startsWith("ko") ? "ko" : l ? "en" : "ko";
  } catch {
    return "ko";
  }
}
function validateDoc(raw) {
  const doc = validatePathDocument(raw);
  return clone(doc);
}
function tryValidate(raw) {
  try {
    return validateDoc(raw);
  } catch {
    return null;
  }
}
function emptyDocFor(lang) {
  return validateDoc(createPathDocument(lang));
}
function createPathSession(options = {}) {
  const {
    storage = globalThis.sessionStorage,
    fetcher = globalThis.fetch,
    onDocument = () => {
    },
    onStatus = () => {
    },
    configUrl = "./config.json",
    now = () => /* @__PURE__ */ new Date(),
    accountFactory = createProductAccount,
    syncFactory = createDocumentSync,
    accountOptions = {}
  } = options;
  const lang = options.lang === "en" || options.lang === "ko" ? options.lang : browserLang();
  const guest = {
    doc: null,
    // validated in-memory guest document (may be unsaved draft)
    raw: null,
    // raw bytes observed in storage (preserved for export)
    blocked: false,
    // invalid/future stored data: never overwrite
    writeFailed: false,
    // last persist failed: block further writes until retry succeeds
    needsPersist: false,
    error: null
  };
  function readStorage(key) {
    try {
      return { ok: true, value: storage ? storage.getItem(key) : null };
    } catch (error) {
      return { ok: false, error };
    }
  }
  function writeGuest(doc) {
    if (guest.blocked) return false;
    try {
      if (!storage) throw fault2("LOCAL_STORAGE_UNAVAILABLE", "storage unavailable");
      const raw = JSON.stringify(doc);
      storage.setItem(GUEST_KEY, raw);
      if (storage.getItem(GUEST_KEY) !== raw) throw fault2("LOCAL_STORAGE_UNAVAILABLE", "storage verify failed");
      guest.raw = raw;
      guest.writeFailed = false;
      guest.needsPersist = false;
      guest.error = null;
      return true;
    } catch (error) {
      guest.writeFailed = true;
      guest.needsPersist = true;
      guest.error = { code: "LOCAL_STORAGE_UNAVAILABLE", message: "이 기기에 저장하지 못했어요.", retryable: true };
      void error;
      return false;
    }
  }
  (function loadGuest() {
    const current = readStorage(GUEST_KEY);
    if (!current.ok) {
      guest.doc = emptyDocFor(lang);
      guest.writeFailed = true;
      guest.needsPersist = true;
      guest.error = { code: "LOCAL_STORAGE_UNAVAILABLE", message: "이 기기의 저장소를 읽지 못했어요.", retryable: true };
      return;
    }
    if (current.value !== null) {
      guest.raw = current.value;
      let parsed;
      try {
        parsed = JSON.parse(current.value);
      } catch {
        parsed = void 0;
      }
      const doc = parsed === void 0 ? null : tryValidate(parsed);
      if (doc) {
        guest.doc = doc;
        return;
      }
      guest.blocked = true;
      guest.doc = emptyDocFor(lang);
      guest.error = {
        code: parsed && parsed.version > 1 ? "PATH_DOCUMENT_FUTURE_VERSION" : "INVALID_PATH_DOCUMENT",
        message: "저장된 PATH 데이터를 읽을 수 없어 덮어쓰지 않았어요. 내보내기로 원본을 보관할 수 있어요.",
        retryable: false
      };
      return;
    }
    const legacy = readStorage(LEGACY_KEY);
    if (!legacy.ok) {
      guest.doc = emptyDocFor(lang);
      guest.blocked = true;
      guest.error = { code: "LOCAL_STORAGE_UNAVAILABLE", message: "이전 데이터를 확인하지 못해 저장을 멈췄어요.", retryable: true };
      return;
    }
    if (legacy.value === null) {
      guest.doc = emptyDocFor(lang);
      return;
    }
    guest.raw = legacy.value;
    let state2 = null;
    try {
      state2 = normalizeState(JSON.parse(legacy.value));
    } catch {
      state2 = null;
    }
    const migrated = state2 ? tryValidate({ ...createPathDocument(state2.lang || lang), state: state2 }) : null;
    if (!migrated) {
      guest.blocked = true;
      guest.doc = emptyDocFor(lang);
      guest.error = { code: "INVALID_PATH_DOCUMENT", message: "이전 PATH 데이터를 읽을 수 없어 덮어쓰지 않았어요. 내보내기로 원본을 보관할 수 있어요.", retryable: false };
      return;
    }
    guest.doc = migrated;
    if (!writeGuest(migrated)) guest.raw = legacy.value;
  })();
  let initialized = false, disposed = false;
  let account = null, sync = null, accountReady = null;
  let accountSnapshot = { configured: false, signedIn: false, accountId: null, status: "unconfigured", error: null };
  let mode = "guest";
  let openEpoch = 0;
  let openedAccountId = null;
  let accountDoc = null;
  let accountLoaded = false;
  let remoteKnownEmpty = false;
  let observedRevision = null;
  let syncStatus = { status: "idle", revision: null, pending: false, pendingStored: true, localDrafts: [], error: null };
  let sessionError = null;
  let importing = false;
  let docGeneration = 0;
  let issuedBackup = null;
  let backupAck = null;
  let tokenSeq = 0;
  function bumpDoc() {
    docGeneration++;
    issuedBackup = null;
    backupAck = null;
  }
  function newToken() {
    tokenSeq++;
    try {
      if (globalThis.crypto?.randomUUID) return `pb-${globalThis.crypto.randomUUID()}-${tokenSeq}`;
    } catch {
    }
    return `pb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${tokenSeq}`;
  }
  function bindingCurrent(rec) {
    return !!rec && mode === "account" && accountLoaded && !!accountDoc && rec.epoch === openEpoch && rec.generation === docGeneration && rec.accountId === openedAccountId && rec.accountId === (accountSnapshot.signedIn ? accountSnapshot.accountId : null);
  }
  function backupAcknowledged() {
    return bindingCurrent(backupAck) && bindingCurrent(issuedBackup) && backupAck.token === issuedBackup.token && same(issuedBackup.doc, accountDoc);
  }
  function snapshot() {
    const signedIn = accountSnapshot.signedIn === true;
    const canEdit = mode === "guest" ? !guest.blocked && !guest.writeFailed : accountLoaded && !importing && !["local-conflict", "conflict", "storage-error"].includes(syncStatus.status);
    const guestHasContent = !!guest.doc && !same(guest.doc, emptyDocFor(guest.doc.state?.lang || lang));
    return Object.freeze({
      mode,
      signedIn,
      configured: accountSnapshot.configured === true,
      accountId: signedIn ? accountSnapshot.accountId || null : null,
      accountStatus: accountSnapshot.status || "unconfigured",
      loaded: mode === "guest" ? true : accountLoaded,
      canEdit,
      syncStatus: mode === "guest" ? guest.writeFailed ? "storage-error" : guest.blocked ? "blocked" : "local" : syncStatus.status,
      pending: mode === "guest" ? guest.needsPersist : syncStatus.pending === true,
      error: publicError2(sessionError || (mode === "guest" ? guest.error : syncStatus.error) || accountSnapshot.error),
      guestAvailable: guestHasContent || guest.blocked && guest.raw !== null,
      accountEmpty: mode === "account" && accountLoaded && remoteKnownEmpty,
      guestBlocked: guest.blocked,
      canImportGuest: mode === "account" && accountLoaded && remoteKnownEmpty && !syncStatus.pending && !!guest.doc && !guest.blocked && guestHasContent && !importing,
      localDrafts: Array.isArray(syncStatus.localDrafts) ? clone(syncStatus.localDrafts) : [],
      canConfirmBackup: bindingCurrent(issuedBackup) && !backupAcknowledged(),
      backupConfirmed: backupAcknowledged()
    });
  }
  function currentDoc() {
    return mode === "guest" ? guest.doc : accountLoaded ? accountDoc : null;
  }
  function emitStatus() {
    if (initialized && !disposed) {
      try {
        onStatus(snapshot());
      } catch {
      }
    }
  }
  function emitDocument() {
    if (initialized && !disposed) {
      try {
        onDocument(clone(currentDoc()));
      } catch {
      }
    }
  }
  function emitAll() {
    emitDocument();
    emitStatus();
  }
  function hideAccount() {
    openEpoch++;
    accountDoc = null;
    accountLoaded = false;
    remoteKnownEmpty = false;
    observedRevision = null;
    openedAccountId = null;
    bumpDoc();
    syncStatus = { status: "idle", revision: null, pending: false, pendingStored: true, localDrafts: [], error: null };
  }
  function ensureSync() {
    if (sync) return sync;
    sync = syncFactory({
      transport: async (operation, values) => {
        const epoch = openEpoch;
        const reply = await account.request(operation, values || {});
        if (epoch === openEpoch && operation === OPERATIONS.load && reply && reply.ok === true) {
          observedRevision = Number.isSafeInteger(reply.revision) ? reply.revision : null;
          remoteKnownEmpty = reply.state === null || reply.state === void 0;
        } else if (epoch === openEpoch && operation === OPERATIONS.save && reply && reply.ok === true) {
          remoteKnownEmpty = false;
          observedRevision = Number.isSafeInteger(reply.revision) ? reply.revision : observedRevision;
        }
        return reply;
      },
      storage,
      onState: (state2) => {
        if (mode !== "account" || disposed) return;
        const doc = state2 == null ? null : tryValidate(state2);
        if (!doc) return;
        if (!accountDoc || !same(doc, accountDoc)) bumpDoc();
        accountDoc = doc;
        emitDocument();
      },
      onStatus: (status) => {
        if (disposed || !status) return;
        if (mode !== "account" || openedAccountId && status.accountId && status.accountId !== openedAccountId) return;
        syncStatus = {
          status: typeof status.status === "string" ? status.status : "idle",
          revision: Number.isSafeInteger(status.revision) ? status.revision : null,
          pending: status.pending === true,
          pendingStored: status.pendingStored !== false,
          localDrafts: Array.isArray(status.localDrafts) ? status.localDrafts : [],
          error: status.error ? publicError2(status.error) : null
        };
        emitStatus();
      },
      onSaved: () => {
      },
      onRemoved: () => {
      },
      validateState: (raw) => validateDoc(raw),
      emptyState: () => createPathDocument(guest.doc?.state?.lang || lang),
      scope: "synk-path",
      resource: "path-app",
      cachePrefix: ACCOUNT_CACHE_PREFIX,
      operations: OPERATIONS
    });
    return sync;
  }
  async function openAccount(accountId) {
    const epoch = ++openEpoch;
    openedAccountId = accountId;
    accountLoaded = false;
    accountDoc = null;
    remoteKnownEmpty = false;
    observedRevision = null;
    bumpDoc();
    sessionError = null;
    emitAll();
    try {
      const loaded = await ensureSync().open(accountId);
      if (epoch !== openEpoch || disposed) return false;
      if (loaded) {
        if (!accountDoc) bumpDoc();
        if (!accountDoc) accountDoc = emptyDocFor(guest.doc?.state?.lang || lang);
        accountLoaded = true;
        sessionError = null;
      } else if (syncStatus.error || syncStatus.status === "local-conflict") {
        sessionError = null;
      } else {
        sessionError = { code: "ACCOUNT_LOAD_FAILED", message: "계정 데이터를 불러오지 못해 편집을 잠시 막았어요.", retryable: true };
      }
    } catch (error) {
      if (epoch !== openEpoch) return false;
      sessionError = publicError2(error) || { code: "ACCOUNT_LOAD_FAILED", retryable: true };
    }
    emitAll();
    return accountLoaded;
  }
  function handleAccountStatus(next) {
    if (disposed || !next) return;
    const prevId = accountSnapshot.signedIn ? accountSnapshot.accountId : null;
    accountSnapshot = {
      configured: next.configured === true,
      signedIn: next.signedIn === true,
      accountId: next.signedIn === true && typeof next.accountId === "string" ? next.accountId : null,
      status: typeof next.status === "string" ? next.status : next.signedIn ? "signed-in" : "signed-out",
      error: next.error ? publicError2(next.error) : null
    };
    const nextId = accountSnapshot.accountId;
    if (nextId === prevId && mode === "account" === !!nextId) {
      emitStatus();
      return;
    }
    try {
      sync?.close();
    } catch {
    }
    hideAccount();
    sessionError = null;
    if (nextId) {
      mode = "account";
      emitAll();
      void openAccount(nextId);
    } else {
      mode = "guest";
      emitAll();
    }
  }
  function startAccount() {
    if (accountReady) return accountReady;
    accountReady = (async () => {
      if (disposed) return null;
      account = accountFactory({
        clientKey: "path-app",
        endpoint: "synk-path",
        scope: "synk-path",
        resource: "path-app",
        operations: OPERATIONS,
        validateState: (raw) => raw == null ? null : validateDoc(raw),
        onStatus: handleAccountStatus,
        fetcher,
        storage,
        configUrl,
        ...accountOptions
      });
      const status = await account.start();
      handleAccountStatus(status || account.status());
      return account;
    })().catch((error) => {
      accountSnapshot = { ...accountSnapshot, error: publicError2(error) };
      accountReady = null;
      emitStatus();
      return null;
    });
    return accountReady;
  }
  async function init() {
    if (disposed) throw fault2("PATH_SESSION_DISPOSED", "disposed");
    if (!initialized) {
      initialized = true;
      emitAll();
    }
    await startAccount();
    return snapshot();
  }
  async function signIn() {
    if (disposed) return false;
    if (mode === "guest" && guest.needsPersist && !guest.blocked) {
      if (!writeGuest(guest.doc)) {
        sessionError = { code: "GUEST_SAVE_REQUIRED", message: "이 기기에 먼저 저장하지 못해 로그인을 멈췄어요. 내보내기 후 다시 시도해 주세요.", retryable: true };
        emitStatus();
        return false;
      }
    }
    const acc = await startAccount();
    if (!acc) return false;
    await acc.signIn();
    return true;
  }
  async function signOut() {
    if (!account) return false;
    if (mode === "account" && syncStatus.pending && !syncStatus.pendingStored && !backupAcknowledged()) {
      sessionError = { code: "UNSAVED_ACCOUNT_DRAFT", message: "저장되지 않은 변경이 있어 로그아웃을 멈췄어요. 내보내기 또는 다시 시도 후 로그아웃해 주세요.", retryable: true };
      emitStatus();
      return false;
    }
    try {
      sync?.close();
    } catch {
    }
    hideAccount();
    mode = "guest";
    emitAll();
    await account.signOut();
    const stored = readStorage(GUEST_KEY);
    if (stored.ok && stored.value !== null && !guest.needsPersist) {
      let parsed;
      try {
        parsed = JSON.parse(stored.value);
      } catch {
        parsed = void 0;
      }
      const doc = parsed === void 0 ? null : tryValidate(parsed);
      if (doc) {
        guest.doc = doc;
        guest.raw = stored.value;
      }
    }
    emitAll();
    return true;
  }
  function requireEditable() {
    if (disposed) throw fault2("PATH_SESSION_DISPOSED", "disposed");
    if (mode === "guest") {
      if (guest.blocked) throw fault2("GUEST_WRITE_BLOCKED", "저장된 데이터를 보호하기 위해 변경을 막았어요.");
      if (guest.writeFailed) throw fault2("LOCAL_STORAGE_UNAVAILABLE", "이 기기에 저장하지 못했어요. 다시 시도해 주세요.");
      return;
    }
    if (!accountLoaded) throw fault2("ACCOUNT_NOT_LOADED", "계정 데이터를 불러온 뒤 편집할 수 있어요.");
    if (importing) throw fault2("ACCOUNT_BUSY", "가져오는 중이에요.");
  }
  function commit2(nextDoc) {
    const doc = validateDoc(nextDoc);
    if (same(doc, currentDoc())) return false;
    if (mode === "guest") {
      guest.doc = doc;
      writeGuest(doc);
      emitAll();
      if (guest.writeFailed) throw fault2("LOCAL_STORAGE_UNAVAILABLE", "변경은 화면에만 남아 있고 이 기기에 저장되지 않았어요.", { retryable: true });
      return true;
    }
    const changed = sync.change(doc);
    if (changed) {
      bumpDoc();
      accountDoc = doc;
      emitDocument();
    }
    emitStatus();
    return changed;
  }
  function updateState(nextState) {
    requireEditable();
    const base = currentDoc();
    return commit2({ ...base, state: nextState });
  }
  function canonicalSavedJob(job, at) {
    if (!job || typeof job !== "object") throw fault2("INVALID_SAVED_JOB", "공고 정보가 올바르지 않아요.");
    if (job.snapshot && job.id) return validateSavedJob(job);
    const board = job.board, jobId = String(job.jobId ?? job.id ?? "");
    return validateSavedJob({
      id: jobSourceId(board, jobId),
      provider: "greenhouse",
      board,
      jobId,
      snapshot: {
        company: job.company,
        title: job.title,
        location: job.location,
        employmentType: job.employmentType ?? null,
        url: job.url,
        observedAt: job.observedAt
      },
      savedAt: at
    });
  }
  function saveJob(job) {
    requireEditable();
    const base = currentDoc();
    const saved = clone(canonicalSavedJob(job, now().toISOString()));
    const list = Array.isArray(base.savedJobs) ? base.savedJobs : [];
    if (list.some((entry) => entry.id === saved.id)) return false;
    if (list.length >= MAX_SAVED_JOBS2) throw fault2("SAVED_JOB_LIMIT", `공고는 최대 ${MAX_SAVED_JOBS2}개까지 저장할 수 있어요.`);
    return commit2({ ...base, savedJobs: [...list, saved] });
  }
  function removeJob(id) {
    requireEditable();
    let next;
    try {
      next = removeSavedJob(clone(currentDoc()), id);
    } catch (error) {
      if (error?.code === "JOB_IN_USE") throw fault2("JOB_IN_USE", "이 공고로 준비 중인 항목이 있어 삭제할 수 없어요.");
      throw error;
    }
    return commit2(next);
  }
  async function importGuest() {
    if (mode !== "account" || !accountLoaded || importing) return false;
    if (!remoteKnownEmpty || syncStatus.pending || observedRevision === null) return false;
    if (!guest.doc || guest.blocked) return false;
    const epoch = openEpoch;
    importing = true;
    emitStatus();
    try {
      const doc = validateDoc(guest.doc);
      const changed = sync.change(doc);
      if (!changed || epoch !== openEpoch) return false;
      bumpDoc();
      accountDoc = doc;
      emitDocument();
      const ok = await sync.flush();
      if (epoch !== openEpoch || mode !== "account") return false;
      if (ok && !syncStatus.pending) {
        remoteKnownEmpty = false;
        emitDocument();
        return true;
      }
      return false;
    } catch (error) {
      if (epoch === openEpoch) sessionError = publicError2(error);
      return false;
    } finally {
      importing = false;
      emitStatus();
    }
  }
  function exportGuest() {
    return { kind: "guest", raw: guest.raw, document: clone(guest.doc), valid: !guest.blocked };
  }
  function exportCurrent() {
    const s = snapshot();
    let backupToken = null;
    if (mode === "account" && accountLoaded && accountDoc && openedAccountId && s.accountId === openedAccountId) {
      if (!bindingCurrent(issuedBackup) || !same(issuedBackup.doc, accountDoc)) {
        issuedBackup = { token: newToken(), accountId: openedAccountId, epoch: openEpoch, generation: docGeneration, doc: clone(accountDoc) };
        backupAck = null;
      }
      backupToken = issuedBackup.token;
    }
    const out = { kind: mode, accountId: s.accountId, document: clone(currentDoc()), syncStatus: s.syncStatus, pending: s.pending, backupToken };
    emitStatus();
    return out;
  }
  function confirmBackup(exportedSnapshot) {
    if (disposed || !exportedSnapshot || typeof exportedSnapshot !== "object") return false;
    const rec = issuedBackup;
    if (!bindingCurrent(rec)) return false;
    if (typeof exportedSnapshot.backupToken !== "string" || exportedSnapshot.backupToken !== rec.token) return false;
    if (exportedSnapshot.kind !== "account" || exportedSnapshot.accountId !== rec.accountId) return false;
    if (!same(rec.doc, accountDoc) || !same(exportedSnapshot.document, accountDoc)) return false;
    backupAck = { token: rec.token, accountId: rec.accountId, epoch: rec.epoch, generation: rec.generation };
    emitStatus();
    return true;
  }
  async function exportRemote() {
    if (!account || mode !== "account" || !openedAccountId) throw fault2("AUTH_REQUIRED", "로그인이 필요해요.");
    const owner = openedAccountId;
    const reply = await account.request(OPERATIONS.load, {});
    if (!reply || reply.ok !== true || reply.accountId !== owner) throw fault2("ACCOUNT_CHANGED", "계정이 바뀌어 내보내지 않았어요.");
    const state2 = reply.state == null ? null : validateDoc(reply.state);
    return { kind: "remote", accountId: owner, revision: reply.revision, updatedAt: reply.updatedAt ?? null, state: state2 };
  }
  function exportRecovery() {
    if (!sync) return [];
    try {
      return clone(sync.exportLocalRecords()) || [];
    } catch (error) {
      throw fault2("LOCAL_STORAGE_UNAVAILABLE", "복구 기록을 읽지 못했어요.", { cause: error });
    }
  }
  async function retry() {
    sessionError = null;
    if (mode === "guest") {
      if (guest.blocked) {
        emitStatus();
        return false;
      }
      const ok = guest.needsPersist ? writeGuest(guest.doc) : true;
      emitAll();
      if (!account) await startAccount();
      return ok;
    }
    if (!accountLoaded) return openedAccountId ? openAccount(openedAccountId) : false;
    try {
      const ok = syncStatus.pending ? await sync.flush() : await sync.refresh();
      emitStatus();
      return !!ok;
    } catch (error) {
      sessionError = publicError2(error);
      emitStatus();
      return false;
    }
  }
  async function useRemote() {
    if (mode !== "account" || !sync) return false;
    const epoch = openEpoch, owner = openedAccountId;
    try {
      const ok = await sync.resolveRemote();
      if (epoch !== openEpoch || mode !== "account" || openedAccountId !== owner) return false;
      if (ok && accountDoc) {
        accountLoaded = true;
        sessionError = null;
      }
      emitAll();
      return !!ok;
    } catch (error) {
      if (epoch === openEpoch) {
        sessionError = publicError2(error);
        emitStatus();
      }
      return false;
    }
  }
  async function chooseRecovery(id) {
    if (mode !== "account" || !sync) return false;
    const epoch = openEpoch, owner = openedAccountId;
    try {
      const ok = await sync.selectLocalDraft(id);
      if (epoch !== openEpoch || mode !== "account" || openedAccountId !== owner) return false;
      if (ok && accountDoc) {
        accountLoaded = true;
        sessionError = null;
      }
      emitAll();
      return !!ok;
    } catch (error) {
      if (epoch === openEpoch) {
        sessionError = publicError2(error);
        emitStatus();
      }
      return false;
    }
  }
  function clearGuest() {
    const empty = emptyDocFor(lang);
    const raw = JSON.stringify(empty);
    try {
      if (!storage) throw fault2("LOCAL_STORAGE_UNAVAILABLE", "storage unavailable");
      storage.setItem(GUEST_KEY, raw);
      const back = storage.getItem(GUEST_KEY);
      if (back !== raw || !tryValidate(JSON.parse(back))) throw fault2("LOCAL_STORAGE_UNAVAILABLE", "storage verify failed");
    } catch {
      guest.error = { code: "LOCAL_STORAGE_UNAVAILABLE", message: "지우지 못했어요.", retryable: true };
      emitStatus();
      return false;
    }
    guest.doc = empty;
    guest.raw = raw;
    guest.blocked = false;
    guest.writeFailed = false;
    guest.needsPersist = false;
    guest.error = null;
    if (sessionError && sessionError.code === "GUEST_SAVE_REQUIRED") sessionError = null;
    emitAll();
    return true;
  }
  function dispose() {
    disposed = true;
    openEpoch++;
    try {
      sync?.close();
    } catch {
    }
    try {
      account?.dispose();
    } catch {
    }
  }
  return Object.freeze({
    document: () => clone(currentDoc()),
    status: snapshot,
    init,
    signIn,
    signOut,
    updateState,
    saveJob,
    removeJob,
    importGuest,
    exportGuest,
    exportCurrent,
    confirmBackup,
    exportRemote,
    exportRecovery,
    retry,
    useRemote,
    chooseRecovery,
    clearGuest,
    dispose
  });
}

// experiences/path-app/account-ui.mjs
var esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var L = (lang) => lang === "en" ? "en" : "ko";
var TEXT = {
  ko: {
    title: "SYNK ID",
    intro: "SYNK ID는 중앙 계정으로 가입하고 로그인합니다. 이메일 또는 Google 계정을 사용할 수 있습니다.",
    recovery: "비밀번호 분실이나 계정 복구는 SYNK ID 중앙 로그인 화면에서 진행합니다.",
    signIn: "SYNK ID로 로그인",
    signOut: "로그아웃",
    retry: "다시 시도",
    notConfigured: "계정 기능이 아직 준비되지 않았습니다.",
    guestMode: "로그인하지 않은 상태입니다. 자료는 이 탭에만 저장되며 탭을 닫으면 사라질 수 있습니다.",
    loading: "계정 자료를 불러오는 중입니다…",
    saved: "계정 저장됨",
    pending: "동기화 대기 중",
    failed: "동기화에 실패했습니다.",
    conflict: "다른 곳에서 변경된 내용과 충돌합니다.",
    unknown: "상태를 확인하는 중입니다.",
    readOnly: "현재 이 자료는 편집할 수 없습니다.",
    empty: "계정에 저장된 자료가 없습니다.",
    importGuest: "로그인 전 자료를 계정으로 가져오기",
    remoteExists: "계정에 이미 자료가 있어 로그인 전 자료를 가져오지 않습니다. 필요하면 내보내기로 보관하세요.",
    guestBlocked: "로그인 전 자료를 지금은 사용할 수 없습니다.",
    exportTitle: "내보내기",
    exportCurrent: "현재 화면 내보내기",
    exportRemote: "계정 서버 자료 내보내기",
    exportGuest: "로그인 전 자료 내보내기",
    exportRecovery: "계정 임시 자료 내보내기",
    conflictHelp: "자동으로 덮어쓰지 않습니다. 양쪽 자료를 내보내 보관한 뒤 선택하세요.",
    useRemote: "계정 서버 자료 사용",
    draftsTitle: "복구 가능한 임시 자료",
    recover: "복구",
    createdAt: "생성",
    clearGuest: "로그인 전 임시 자료 초기화",
    noDelete: "이 화면에서는 계정을 삭제할 수 없습니다."
  },
  en: {
    title: "SYNK ID",
    intro: "SYNK ID uses a central account for sign-up and sign-in. You can use email or Google.",
    recovery: "Password resets and account recovery are handled on the SYNK ID central sign-in page.",
    signIn: "Sign in with SYNK ID",
    signOut: "Sign out",
    retry: "Retry",
    notConfigured: "Account features are not ready yet.",
    guestMode: "You are not signed in. Data is saved in this tab only and may be lost when the tab closes.",
    loading: "Loading account data…",
    saved: "Saved to account",
    pending: "Waiting to sync",
    failed: "Sync failed.",
    conflict: "Conflicts with changes made elsewhere.",
    unknown: "Checking status.",
    readOnly: "This data cannot be edited right now.",
    empty: "No data is stored in your account.",
    importGuest: "Import pre-sign-in data to account",
    remoteExists: "Your account already has data, so pre-sign-in data will not be imported. Export it to keep a copy.",
    guestBlocked: "Pre-sign-in data is not available right now.",
    exportTitle: "Export",
    exportCurrent: "Export current view",
    exportRemote: "Export account server data",
    exportGuest: "Export pre-sign-in data",
    exportRecovery: "Export account recovery data",
    conflictHelp: "Nothing is overwritten automatically. Export both versions, then choose.",
    useRemote: "Use account server data",
    draftsTitle: "Recoverable drafts",
    recover: "Recover",
    createdAt: "Created",
    clearGuest: "Clear pre-sign-in drafts",
    noDelete: "Accounts cannot be deleted from this screen."
  }
};
var ERRORS = {
  ko: {
    JOB_IN_USE: "이 공고를 사용하는 지원 준비 항목이 있어 삭제할 수 없습니다. 먼저 해당 준비 항목을 삭제하세요.",
    PATH_DOCUMENT_FUTURE_VERSION: "더 새로운 버전에서 저장된 자료라 이 화면에서 읽거나 덮어쓰지 않습니다. 내보내기로 원본을 보관하거나 앱을 업데이트하세요.",
    GUEST_SAVE_REQUIRED: "로그인 전 자료를 이 탭에 저장하지 못해 로그인을 멈췄습니다. 자료를 내보낸 뒤 다시 시도하세요.",
    GUEST_WRITE_BLOCKED: "저장된 로그인 전 자료를 보호하기 위해 편집과 가져오기를 막았습니다. 내보내기로 보관하거나 초기화하세요.",
    SAVED_JOB_LIMIT: "저장할 수 있는 공고 수(100개)를 초과했습니다. 기존 공고를 삭제한 뒤 저장하세요.",
    ACCOUNT_CHANGED: "계정이 바뀌어 작업을 중단했습니다. 현재 계정을 확인하세요.",
    LOCAL_DRAFT_CONFLICT: "이 기기에 저장되지 않은 계정 임시 자료가 있습니다. 내보낸 뒤 복구할 자료나 계정 서버 자료를 선택하세요.",
    CARE_CLIENT_UPDATE_REQUIRED: "앱을 업데이트해야 계정 자료를 사용할 수 있습니다. 페이지를 새로고침하세요.",
    INVALID_CARE_STATE: "계정 자료 형식을 확인할 수 없어 편집을 막았습니다. 내보내기로 보관하세요.",
    UNSAVED_ACCOUNT_DRAFT: "계정에 저장되지 않은 임시 자료가 있습니다. 먼저 내보내거나 복구하세요.",
    LOCAL_STORAGE_UNAVAILABLE: "이 탭에 저장하지 못했어요. 작성 내용은 화면에 남아 있어요.",
    INVALID_PATH_DOCUMENT: "자료 형식이 올바르지 않습니다.",
    ACCOUNT_LOAD_FAILED: "계정 자료를 불러오지 못했습니다.",
    REVISION_CONFLICT: "다른 곳에서 변경된 내용과 충돌합니다.",
    AUTH_REQUIRED: "다시 로그인해야 합니다.",
    GENERIC: "문제가 발생했습니다. 잠시 후 다시 시도하세요."
  },
  en: {
    JOB_IN_USE: "A preparation item uses this saved job, so it cannot be removed. Remove that preparation item first.",
    PATH_DOCUMENT_FUTURE_VERSION: "This data was saved by a newer version, so it is not read or overwritten here. Export the original or update the app.",
    GUEST_SAVE_REQUIRED: "Sign-in stopped because pre-sign-in data could not be saved in this tab. Export it, then try again.",
    GUEST_WRITE_BLOCKED: "Editing and import are blocked to protect stored pre-sign-in data. Export it or clear it.",
    SAVED_JOB_LIMIT: "You reached the saved job limit (100). Remove a saved job first.",
    ACCOUNT_CHANGED: "The account changed, so the action was stopped. Check the current account.",
    LOCAL_DRAFT_CONFLICT: "An unsynced account draft exists on this device. Export it, then choose the draft or the account server data.",
    CARE_CLIENT_UPDATE_REQUIRED: "Update the app to use account data. Please reload the page.",
    INVALID_CARE_STATE: "Account data could not be verified, so editing is blocked. Export it to keep a copy.",
    UNSAVED_ACCOUNT_DRAFT: "There is an unsaved account draft. Export or recover it first.",
    LOCAL_STORAGE_UNAVAILABLE: "Could not save in this tab. Your text stays on screen.",
    INVALID_PATH_DOCUMENT: "The data format is invalid.",
    ACCOUNT_LOAD_FAILED: "Could not load account data.",
    REVISION_CONFLICT: "Conflicts with changes made elsewhere.",
    AUTH_REQUIRED: "Please sign in again.",
    GENERIC: "Something went wrong. Please try again later."
  }
};
function getAccountErrorMessage(error, lang = "ko") {
  const m = ERRORS[L(lang)];
  const code = error && typeof error === "object" ? error.code : void 0;
  return Object.prototype.hasOwnProperty.call(m, code) && code !== "GENERIC" ? m[code] : m.GENERIC;
}
var btn = (action, label, cls = "secondary", id) => `<button type="button" class="${cls}" data-action="${esc(action)}"${id != null ? ` data-id="${esc(id)}"` : ""}>${esc(label)}</button>`;
var isConflict = (s) => s.syncStatus === "conflict" || s.syncStatus === "local-conflict";
var NO_RETRY_CODES = /* @__PURE__ */ new Set([
  "PATH_DOCUMENT_FUTURE_VERSION",
  "INVALID_PATH_DOCUMENT",
  "CARE_CLIENT_UPDATE_REQUIRED",
  "INVALID_CARE_STATE",
  "UNSUPPORTED_SCHEMA_VERSION",
  "UNSUPPORTED_DOCUMENT_VERSION",
  "CLIENT_UPDATE_REQUIRED",
  "INVALID_DOCUMENT",
  "MALFORMED_DOCUMENT"
]);
var RETRY_STATUSES = /* @__PURE__ */ new Set(["offline", "storage-error"]);
var RETRY_CODES = /* @__PURE__ */ new Set(["NETWORK_UNAVAILABLE", "ACCOUNT_LOAD_FAILED", "LOCAL_STORAGE_UNAVAILABLE", "STORAGE_UNAVAILABLE", "STORAGE_ERROR"]);
var canRetry = (s) => {
  if (isConflict(s)) return false;
  const code = s.error && typeof s.error === "object" ? s.error.code : void 0;
  if (code && NO_RETRY_CODES.has(code)) return false;
  if (!s.error || s.error.retryable === true) return true;
  return RETRY_STATUSES.has(s.syncStatus) || RETRY_CODES.has(code);
};
function stateOf(s) {
  if (!s.configured) return "notConfigured";
  if (!s.signedIn) return "guestMode";
  if (isConflict(s)) return "conflict";
  if (s.error || s.syncStatus === "failed" || s.syncStatus === "error" || RETRY_STATUSES.has(s.syncStatus)) return "failed";
  if (!s.loaded) return "loading";
  if (s.pending || s.syncStatus === "pending") return "pending";
  if (s.syncStatus === "synced") return "saved";
  return "unknown";
}
function renderAccountNotice(status = {}, lang = "ko") {
  const t2 = TEXT[L(lang)];
  const s = status || {};
  const base = stateOf(s);
  const st = base === "guestMode" && (s.error || RETRY_STATUSES.has(s.syncStatus)) ? "failed" : base;
  let html = `<div class="notice" role="status" data-state="${esc(st)}"><span>${esc(t2[st])}</span>`;
  if (!s.signedIn && s.error?.code === "LOCAL_STORAGE_UNAVAILABLE") html = `<div class="notice" role="status" data-state="failed">`;
  if (s.error) html += ` <span class="meta">${esc(getAccountErrorMessage(s.error, lang))}</span>`;
  if (st === "failed" && canRetry(s) || st === "notConfigured") html += ` ${btn("accountRetry", t2.retry, "text-button")}`;
  return html + "</div>";
}
function renderAccountPanel(status = {}, lang = "ko", opts = {}) {
  const t2 = TEXT[L(lang)];
  const s = status || {};
  const st = stateOf(s);
  const out = [`<section class="settings-group account-panel"><h2>${esc(t2.title)}</h2>`];
  if (!s.configured) {
    out.push(`<p class="notice">${esc(t2.notConfigured)}</p>`);
    if (s.error) out.push(`<p class="meta">${esc(getAccountErrorMessage(s.error, lang))}</p>`);
    out.push(`<div class="actions">${btn("accountRetry", t2.retry, "primary")}</div>`);
  } else if (!s.signedIn) {
    out.push(`<p>${esc(t2.intro)}</p><p class="meta">${esc(t2.recovery)}</p>`);
    out.push(`<p class="notice">${esc(t2.guestMode)}</p>`);
    if (s.error) out.push(`<p class="notice">${esc(getAccountErrorMessage(s.error, lang))}</p>`);
    const gr = (s.error || RETRY_STATUSES.has(s.syncStatus)) && canRetry(s) ? btn("accountRetry", t2.retry) : "";
    out.push(`<div class="actions">${btn("accountSignIn", t2.signIn, "primary")}${gr}</div>`);
  } else {
    out.push(renderAccountNotice(s, lang));
    if (s.loaded && s.canEdit === false) out.push(`<p class="meta">${esc(t2.readOnly)}</p>`);
    if (st === "failed" && canRetry(s)) out.push(`<div class="actions">${btn("accountRetry", t2.retry, "primary")}</div>`);
    if (s.loaded && !isConflict(s)) {
      if (s.accountEmpty === true || s.canImportGuest) {
        out.push(`<p class="meta">${esc(t2.empty)}</p>`);
        if (s.canImportGuest && !s.guestBlocked) out.push(`<div class="actions">${btn("accountImport", t2.importGuest, "primary")}</div>`);
      } else if (s.guestAvailable && !s.guestBlocked) {
        out.push(`<p class="meta">${esc(t2.remoteExists)}</p>`);
      }
    }
    if (isConflict(s)) {
      out.push(`<div class="notice"><p>${esc(t2.conflict)}</p><p class="meta">${esc(t2.conflictHelp)}</p>`);
      out.push(`<div class="actions">${btn("accountExport", t2.exportCurrent)}${btn("accountExportRemote", t2.exportRemote)}${btn("accountUseRemote", t2.useRemote, "primary")}</div></div>`);
    }
  }
  if (s.guestBlocked) out.push(`<p class="meta">${esc(t2.guestBlocked)}</p>`);
  if (opts && opts.pendingBackup) {
    const en = L(lang) === "en";
    const info = en ? "The browser cannot confirm whether the download finished. Check the backup file yourself before confirming." : "브라우저는 다운로드 완료 여부를 확인할 수 없어요. 백업 파일을 직접 확인한 뒤 눌러 주세요.";
    const label = opts.useRemote ? en ? "I checked that the backup file is saved · load account version" : "백업 파일이 저장된 것을 확인했어요 · 계정 자료 불러오기" : en ? "I checked that the backup file is saved" : "백업 파일이 저장된 것을 확인했어요";
    out.push(`<div class="notice"><p class="meta">${esc(info)}</p><div class="actions">${btn("accountConfirmBackup", label, "primary")}</div></div>`);
  }
  const ex = [btn("accountExport", t2.exportCurrent)];
  if (s.signedIn && s.loaded) ex.push(btn("accountExportRemote", t2.exportRemote));
  if (s.guestAvailable) ex.push(btn("accountExportGuest", t2.exportGuest));
  const drafts = Array.isArray(s.localDrafts) ? s.localDrafts : [];
  if (s.signedIn && (drafts.length || isConflict(s))) ex.push(btn("accountExportRecovery", t2.exportRecovery));
  out.push(`<div class="settings-group"><h3>${esc(t2.exportTitle)}</h3><div class="actions">${ex.join("")}</div></div>`);
  if (drafts.length) {
    out.push(`<div class="settings-group"><h3>${esc(t2.draftsTitle)}</h3><ul>`);
    for (const d of drafts) {
      if (!d || d.id == null) continue;
      out.push(`<li><span class="meta">${esc(t2.createdAt)}: ${esc(d.createdAt)}</span> ${btn("accountRecover", t2.recover, "text-button", d.id)}</li>`);
    }
    out.push("</ul></div>");
  }
  const foot = [];
  if (s.guestAvailable || s.guestBlocked) foot.push(btn("clearGuest", t2.clearGuest, "text-button"));
  if (s.signedIn) foot.push(btn("accountSignOut", t2.signOut));
  if (foot.length) out.push(`<div class="actions">${foot.join("")}</div>`);
  if (s.signedIn) out.push(`<p class="meta">${esc(t2.noDelete)}</p>`);
  out.push("</section>");
  return out.join("");
}

// experiences/path-app/jobs-ui.mjs
init_core();
var MAX_BYTES = 2 * 1024 * 1024;
var TIMEOUT_MS = 12e3;
var PAGE_SIZE = 12;
var BOARDS2 = ["moloco", "coupang"];
var SOURCE_STATUS = ["fresh", "stale", "error"];
var ID_RE2 = /^greenhouse-(moloco|coupang)-(\d{1,20})$/;
var fail2 = (code) => Object.assign(new Error(code), { code });
async function boundedFetch(fetcher, url, init, signal) {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  if (signal) signal.aborted ? ctl.abort() : signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ctl.abort(fail2("timeout")), TIMEOUT_MS);
  try {
    const res = await fetcher(url, { ...init, credentials: "omit", redirect: "error", signal: ctl.signal });
    if (!res || !res.ok) throw fail2("http");
    const len = Number(res.headers?.get?.("content-length"));
    if (Number.isFinite(len) && len > MAX_BYTES) throw fail2("too_large");
    let text2 = "";
    if (res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let total = 0;
      for (; ; ) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.byteLength;
        if (total > MAX_BYTES) {
          try {
            await reader.cancel();
          } catch {
          }
          throw fail2("too_large");
        }
        text2 += dec.decode(value, { stream: true });
      }
      text2 += dec.decode();
    } else {
      text2 = await res.text();
      if (new TextEncoder().encode(text2).byteLength > MAX_BYTES) throw fail2("too_large");
    }
    try {
      return JSON.parse(text2);
    } catch {
      throw fail2("invalid");
    }
  } catch (e) {
    if (signal?.aborted) throw fail2("aborted");
    if (ctl.signal.aborted) throw fail2("timeout");
    throw e?.code ? e : fail2("network");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener?.("abort", onAbort);
  }
}
var str = (v, max = 2e3) => typeof v === "string" && v.length <= max;
var optStr = (v, max) => v === null || str(v, max);
var isDate = (v) => str(v, 64) && !Number.isNaN(Date.parse(v));
var optDate = (v) => v === null || isDate(v);
function normalizeJob(j) {
  if (!j || typeof j !== "object") throw fail2("invalid");
  const m = ID_RE2.exec(j.id);
  if (!m || j.provider !== "greenhouse" || j.board !== m[1] || j.jobId !== m[2]) throw fail2("invalid");
  if (![j.company, j.title, j.location, j.url].every((s) => str(s)) || !optStr(j.employmentType, 200) || !isDate(j.observedAt)) throw fail2("invalid");
  if (j.updatedAt !== void 0 && !optDate(j.updatedAt)) throw fail2("invalid");
  const saved = validateSavedJob({
    id: j.id,
    provider: j.provider,
    board: j.board,
    jobId: j.jobId,
    snapshot: { company: j.company, title: j.title, location: j.location, employmentType: j.employmentType, url: j.url, observedAt: j.observedAt },
    savedAt: j.observedAt
  });
  return saved;
}
var ERROR_CODE_RE = /^[a-z0-9_.-]{1,64}$/i;
function sourceError(e) {
  if (e === null || e === void 0) return null;
  if (typeof e === "string") {
    if (e.length > 200) throw fail2("invalid");
    return ERROR_CODE_RE.test(e) ? e : "unknown";
  }
  if (typeof e === "object" && !Array.isArray(e)) {
    const hs = e.httpStatus;
    if (hs !== void 0 && hs !== null && !(Number.isInteger(hs) && hs >= 100 && hs <= 599)) throw fail2("invalid");
    return typeof e.code === "string" && ERROR_CODE_RE.test(e.code) ? e.code : "unknown";
  }
  throw fail2("invalid");
}
function normalizeSource(s) {
  if (!s || typeof s !== "object" || s.provider !== "greenhouse" || !BOARDS2.includes(s.board)) throw fail2("invalid");
  if (!str(s.company, 200) || !SOURCE_STATUS.includes(s.status) || typeof s.complete !== "boolean") throw fail2("invalid");
  if (!optDate(s.observedAt) || !optDate(s.attemptedAt) || !optDate(s.retryAfter)) throw fail2("invalid");
  const error = sourceError(s.error);
  const ev = s.evidence;
  if (!ev || !str(ev.careerUrl) || !str(ev.documentationUrl) || !isDate(ev.verifiedAt)) throw fail2("invalid");
  const safeUrl = (u) => {
    try {
      const x = new URL(u);
      return x.protocol === "https:" ? x.href : null;
    } catch {
      return null;
    }
  };
  return {
    provider: s.provider,
    board: s.board,
    company: s.company,
    status: s.status,
    complete: s.complete,
    observedAt: s.observedAt,
    attemptedAt: s.attemptedAt,
    retryAfter: s.retryAfter,
    error,
    evidence: { careerUrl: safeUrl(ev.careerUrl), documentationUrl: safeUrl(ev.documentationUrl), verifiedAt: ev.verifiedAt }
  };
}
function parsePayload(p) {
  if (!p || p.ok !== true || p.scope !== "synk-path-jobs" || !Array.isArray(p.jobs) || !Array.isArray(p.sources)) throw fail2("invalid");
  if (p.availability !== void 0 && p.availability !== "disabled") throw fail2("invalid");
  if (p.availability === "disabled") {
    if (p.jobs.length || p.sources.length) throw fail2("invalid");
    return { disabled: true, jobs: [], sources: [] };
  }
  if (p.jobs.length > 3e3 || p.sources.length > 2) throw fail2("invalid");
  const sources = p.sources.map(normalizeSource);
  if (new Set(sources.map((s) => s.board)).size !== sources.length) throw fail2("invalid");
  const jobs = p.jobs.map(normalizeJob);
  if (new Set(jobs.map((j) => j.id)).size !== jobs.length) throw fail2("invalid");
  return { jobs, sources };
}
function createJobsFeed({ fetcher = fetch, configUrl = "./config.json", onChange = () => {
}, getUrl = () => location.href } = {}) {
  let state2 = { status: "idle", jobs: [], sources: [], error: null };
  let inflight = null;
  let disposed = false;
  const ctl = new AbortController();
  const snapshot = () => ({ ...state2, jobs: state2.jobs.slice(), sources: state2.sources.slice() });
  const set = (next) => {
    if (disposed) return;
    state2 = next;
    try {
      onChange(snapshot());
    } catch {
    }
  };
  async function run() {
    let config;
    try {
      const raw = await boundedFetch(fetcher, new URL(configUrl, getUrl()).href, { method: "GET" }, ctl.signal);
      config = readConfig(raw, getUrl());
    } catch (e) {
      if (e?.code === "aborted") return;
      if (e?.code === "http" || e?.code === "invalid" || !e?.code) config = null;
      else return set({ ...state2, status: "error", error: e.code, stale: state2.jobs.length > 0 });
    }
    if (!config || !config.accountApiUrl || !config.supabasePublishableKey) {
      return set({ status: "unconfigured", jobs: [], sources: [], error: null });
    }
    try {
      const url = new URL("functions/v1/synk-path", String(config.accountApiUrl).replace(/\/?$/, "/"));
      url.searchParams.set("action", "jobs");
      const data = parsePayload(await boundedFetch(fetcher, url.href, {
        method: "GET",
        headers: { apikey: config.supabasePublishableKey }
      }, ctl.signal));
      if (data.disabled) return set({ status: "disabled", jobs: [], sources: [], error: null, stale: false });
      set({ status: "ready", jobs: data.jobs, sources: data.sources, error: null, stale: false });
    } catch (e) {
      if (e?.code === "aborted") return;
      set({ ...state2, status: "error", error: e?.code || "unknown", stale: state2.jobs.length > 0 });
    }
  }
  return {
    load() {
      if (disposed) return Promise.resolve(snapshot());
      if (!inflight) {
        inflight = run().finally(() => {
          inflight = null;
        });
        set({ ...state2, status: "loading" });
      }
      return inflight.then(snapshot);
    },
    snapshot,
    dispose() {
      disposed = true;
      ctl.abort();
    }
  };
}
var esc2 = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var T = {
  ko: {
    h: "한국근무공고",
    refresh: "새로고침",
    loading: "불러오는 중…",
    search: "검색",
    query: "공고 검색",
    all: "전체 회사",
    company: "회사",
    saved: "저장한 공고만",
    note: "회사 채용 페이지에서 직접 가져온 공고입니다. 외국인 지원 가능 여부나 비자 지원을 보장하지 않습니다. 마감일은 제공되지 않습니다.",
    fetched: "가져온 시각",
    updated: "공고 수정일",
    prepare: "지원 준비",
    save: "저장",
    remove: "저장 해제",
    open: "원문 공고",
    fresh: "최신",
    stale: "캐시됨",
    errorS: "실패",
    unconfigured: "공고 서버가 설정되지 않았습니다.",
    err: "공고를 불러오지 못했습니다.",
    staleNote: "이전에 불러온 공고를 표시 중이며 최신이 아닐 수 있습니다.",
    noMatch: "검색 조건에 맞는 공고가 없습니다.",
    zero: "현재 게시된 공고가 없습니다.",
    noSaved: "저장한 공고가 없습니다.",
    gone: "현재 목록에 없음",
    unconfirmed: "현재 게시 여부 확인 불가",
    unavailable: "출처를 사용할 수 없음",
    inUse: "작업에서 사용 중이면 해제할 수 없습니다.",
    page: "페이지",
    prev: "이전",
    next: "다음",
    readonly: "현재는 자료를 바꿀 수 없어요. 내 정보에서 저장 상태를 확인해 주세요.",
    count: (n) => `${n}개 공고`,
    partial: "일부 출처가 최신이 아니거나 실패했습니다.",
    unknownEmpty: "일부 출처를 확인하지 못해 현재 게시된 공고가 없는지 확인할 수 없습니다.",
    disabled: "채용 공고 연결을 준비하고 있어요. 현재 공고는 아래 공식 사이트에서 확인해 주세요.",
    savedH: "저장한 공고"
  },
  en: {
    h: "Jobs in Korea",
    refresh: "Refresh",
    loading: "Loading…",
    search: "Search",
    query: "Search jobs",
    all: "All companies",
    company: "Company",
    saved: "Saved only",
    note: "Listings come directly from company career feeds. They do not guarantee foreigner eligibility or visa sponsorship. No deadlines are provided.",
    fetched: "Fetched",
    updated: "Posting updated",
    prepare: "Prepare application",
    save: "Save",
    remove: "Remove",
    open: "Original posting",
    fresh: "Latest",
    stale: "Cached",
    errorS: "Failed",
    unconfigured: "The jobs service is not configured.",
    err: "Could not load jobs.",
    staleNote: "Showing previously loaded jobs; they may be out of date.",
    noMatch: "No jobs match your filters.",
    zero: "No jobs are currently posted.",
    noSaved: "No saved jobs.",
    gone: "No longer listed",
    unconfirmed: "Cannot confirm current listing",
    unavailable: "Source unavailable",
    inUse: "Cannot be removed while used by a task.",
    page: "Page",
    prev: "Previous",
    next: "Next",
    readonly: "You can't change data right now. Please check the save status in Profile.",
    count: (n) => `${n} jobs`,
    partial: "Some sources are stale or failed.",
    unknownEmpty: "Some sources could not be checked, so we cannot confirm whether any jobs are currently posted.",
    disabled: "We are preparing to connect job listings. For current openings, please check the official sites below.",
    savedH: "Saved jobs"
  }
};
var OFFICIAL = [["Moloco", "https://www.moloco.com/careers"], ["Coupang", "https://www.coupang.jobs/kr/"]];
var fmt = (iso2, lang) => {
  const d = new Date(iso2);
  return Number.isNaN(+d) ? "" : d.toLocaleString(lang === "ko" ? "ko-KR" : "en-US");
};
function card(job, t2, lang, { saved, live, freshness, canEdit }) {
  const s = job.snapshot, dis = canEdit ? "" : " disabled";
  const id = esc2(job.id);
  return `<li class="opportunity jobs-card" data-id="${id}"><h3>${esc2(s.title)}</h3>
<p class="meta">${esc2(s.company)} · ${esc2(s.location)}${s.employmentType ? ` · ${esc2(s.employmentType)}` : ""}</p>
<p class="meta">${esc2(t2.fetched)}: <time datetime="${esc2(s.observedAt)}">${esc2(fmt(s.observedAt, lang))}</time>${live?.updatedAt ? ` · ${esc2(t2.updated)}: <time datetime="${esc2(live.updatedAt)}">${esc2(fmt(live.updatedAt, lang))}</time>` : ""}</p>
${freshness ? `<p class="chip jobs-freshness">${esc2(freshness)}</p>` : ""}
<div class="actions"><button type="button" class="primary" data-action="prepareJob" data-id="${id}"${dis}>${esc2(t2.prepare)}</button>
${saved ? `<button type="button" class="secondary" data-action="removeJob" data-id="${id}" title="${esc2(t2.inUse)}"${dis}>${esc2(t2.remove)}</button>` : `<button type="button" class="secondary" data-action="saveJob" data-id="${id}"${dis}>${esc2(t2.save)}</button>`}
<a class="secondary" href="${esc2(s.url)}" target="_blank" rel="noopener noreferrer">${esc2(t2.open)}</a></div></li>`;
}
function renderJobs({ feed, lang = "ko", savedJobs = [], query = "", board = "all", onlySaved = false, page = 0, canEdit = true } = {}) {
  const t2 = T[lang] || T.ko;
  const st = feed || { status: "idle", jobs: [], sources: [], error: null };
  const boardSel = board === "all" || BOARDS2.includes(board) ? board : "all";
  const savedMap = /* @__PURE__ */ new Map();
  for (const j of savedJobs) {
    try {
      const v = validateSavedJob(j);
      savedMap.set(v.id, v);
    } catch {
    }
  }
  if (st.status === "disabled") {
    const savedItems = [...savedMap.values()].map((j) => card(j, t2, lang, { saved: true, live: null, freshness: null, canEdit })).join("");
    const links = OFFICIAL.map(([n, u]) => `<li><a class="secondary" href="${esc2(u)}" target="_blank" rel="noopener noreferrer">${esc2(n)}</a></li>`).join("");
    return `<section class="jobs" aria-labelledby="jobs-heading">
<div class="section-heading"><h2 id="jobs-heading">${esc2(t2.h)}</h2></div>
<p class="notice">${esc2(t2.disabled)}</p>
<ul class="jobs-official">${links}</ul>
${savedItems ? `<h3>${esc2(t2.savedH)}</h3>${canEdit ? "" : `<p class="notice">${esc2(t2.readonly)}</p>`}<ul class="opportunity-list">${savedItems}</ul>` : ""}</section>`;
  }
  const liveMap = new Map(st.jobs.map((j) => [j.id, j]));
  const srcMap = new Map(st.sources.map((s) => [s.board, s]));
  const busy = st.status === "loading";
  const q = String(query).trim().toLowerCase();
  const base = onlySaved ? [...savedMap.values()] : st.jobs;
  const byBoard = base.filter((j) => boardSel === "all" || j.board === boardSel);
  const list = byBoard.filter((j) => !q || [j.snapshot.title, j.snapshot.company, j.snapshot.location].some((x) => String(x).toLowerCase().includes(q)));
  const pages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const p = Math.min(Math.max(0, Math.floor(Number(page) || 0)), pages - 1);
  const freshnessOf = (j) => {
    if (liveMap.has(j.id)) return null;
    if (st.status === "error" || st.stale || busy || st.status === "idle") return t2.unconfirmed;
    const src = srcMap.get(j.board);
    if (!src) return t2.unavailable;
    return src.status === "fresh" && src.complete ? t2.gone : t2.unconfirmed;
  };
  const sources = st.sources.map((s) => {
    const label = s.status === "fresh" ? t2.fresh : s.status === "stale" ? t2.stale : t2.errorS;
    const when = s.observedAt ? ` · ${esc2(t2.fetched)} ${esc2(fmt(s.observedAt, lang))}` : "";
    return `<li class="chip jobs-source jobs-${esc2(s.status)}">${esc2(s.company)}: ${esc2(label)}${when}</li>`;
  }).join("");
  const notices2 = [];
  if (st.status === "unconfigured") notices2.push(t2.unconfigured);
  if (st.status === "error") notices2.push(st.stale ? `${t2.err} ${t2.staleNote}` : t2.err);
  if (st.sources.some((s) => s.status !== "fresh" || !s.complete)) notices2.push(t2.partial);
  if (!canEdit) notices2.push(t2.readonly);
  let empty = "";
  if (!list.length && !busy && st.status !== "unconfigured" && !(st.status === "error" && !st.jobs.length && !onlySaved)) {
    const filtered = base.length > 0 || boardSel !== "all" || !!q;
    empty = onlySaved && !savedMap.size ? t2.noSaved : filtered ? t2.noMatch : st.status === "ready" && st.sources.length && st.sources.every((s) => s.status === "fresh" && s.complete) ? t2.zero : t2.unknownEmpty;
  }
  const items = list.slice(p * PAGE_SIZE, (p + 1) * PAGE_SIZE).map((j) => card(j, t2, lang, { saved: savedMap.has(j.id), live: liveMap.get(j.id), freshness: onlySaved ? freshnessOf(j) : null, canEdit })).join("");
  const opt = (v, l) => `<option value="${v}"${boardSel === v ? " selected" : ""}>${esc2(l)}</option>`;
  const companyName = (b) => srcMap.get(b)?.company || (b === "moloco" ? "Moloco" : "Coupang");
  const pager = pages > 1 ? `<nav class="jobs-pager" aria-label="${esc2(t2.page)}">
<button type="button" class="secondary" data-action="jobPage" data-page="${p - 1}"${p === 0 ? " disabled" : ""}>${esc2(t2.prev)}</button>
<span class="meta">${p + 1} / ${pages}</span>
<button type="button" class="secondary" data-action="jobPage" data-page="${p + 1}"${p >= pages - 1 ? " disabled" : ""}>${esc2(t2.next)}</button></nav>` : "";
  return `<section class="jobs" aria-labelledby="jobs-heading" aria-busy="${busy}">
<div class="section-heading"><h2 id="jobs-heading">${esc2(t2.h)}</h2>
<button type="button" class="secondary" data-action="refreshJobs"${busy ? " disabled" : ""}>${esc2(busy ? t2.loading : t2.refresh)}</button></div>
<p class="notice">${esc2(t2.note)}</p>
${sources ? `<ul class="jobs-sources" aria-label="${esc2(t2.company)}">${sources}</ul>` : ""}
<div role="status" aria-live="polite" class="jobs-status">${busy ? `<p class="meta">${esc2(t2.loading)}</p>` : ""}${notices2.map((n) => `<p class="notice">${esc2(n)}</p>`).join("")}</div>
<form class="jobs-filters" role="search">
<label for="job-query">${esc2(t2.query)}</label>
<input id="job-query" type="search" data-action="jobQuery" value="${esc2(query)}">
<button type="button" class="primary" data-action="searchJobs">${esc2(t2.search)}</button>
<label for="job-board">${esc2(t2.company)}</label>
<select id="job-board" data-action="jobBoard">${opt("all", t2.all)}${BOARDS2.map((b) => opt(b, companyName(b))).join("")}</select>
<label class="jobs-toggle"><input type="checkbox" data-action="savedJobs"${onlySaved ? " checked" : ""}> ${esc2(t2.saved)}</label>
</form>
${list.length ? `<p class="meta">${esc2(t2.count(list.length))}</p>` : ""}
${empty ? `<p class="notice">${esc2(empty)}</p>` : ""}
<ul class="opportunity-list">${items}</ul>${pager}</section>`;
}
function jobOpportunity(savedJob) {
  const j = validateSavedJob(savedJob);
  const s = j.snapshot;
  const where = `${s.company} · ${s.location}`;
  return {
    id: j.id,
    goal: "job",
    source: "live",
    title: { ko: s.title, en: s.title },
    summary: { ko: `${where}. 세부 요건은 원문 공고에서 확인하세요.`, en: `${where}. Check the original posting for details.` },
    requirements: [
      { ko: "원문 공고의 자격 요건을 직접 확인하기", en: "Review the qualifications in the original posting yourself" },
      { ko: "근무 자격과 비자 조건을 회사에 확인하기", en: "Confirm work eligibility and visa terms with the company" }
    ],
    prompt: {
      ko: `${s.company}의 "${s.title}" (${s.location}) 지원을 위해 관련 경험과 성과를 사실대로 정리하세요.`,
      en: `List your relevant experience and results, factually, for "${s.title}" at ${s.company} (${s.location}).`
    },
    url: s.url
  };
}

// experiences/path-app/app.mjs
var root = document.getElementById("app");
var announcer = document.getElementById("announcer");
var DICT = {
  preview: ["베타", "Beta"],
  langLabel: ["언어", "Language"],
  navLabel: ["주요 메뉴", "Main menu"],
  today: ["오늘", "Today"],
  explore: ["탐색", "Explore"],
  prepare: ["준비", "Prepare"],
  help: ["도움", "Help"],
  profile: ["내 정보", "Profile"],
  step1: ["1 / 2 단계", "Step 1 of 2"],
  step2: ["2 / 2 단계 · 선택", "Step 2 of 2 · Optional"],
  q1: ["지금, 어떤 준비를 하고 있나요?", "What are you preparing for right now?"],
  q1lead: ["하나를 고르면 맞는 첫 화면을 보여 드려요. 나중에 바꿀 수 있어요.", "Pick one and we will tailor your first screen. You can change it later."],
  next: ["다음", "Next"],
  skip: ["건너뛰기", "Skip"],
  back: ["이전", "Back"],
  cancel: ["취소", "Cancel"],
  start: ["시작하기", "Start"],
  save: ["저장", "Save"],
  q2: ["조금 더 알려 주세요", "Tell us a little more"],
  q2lead: ["모두 선택 사항이에요. 비워 두어도 괜찮아요.", "Everything here is optional."],
  interests: ["관심 있는 것", "Interests"],
  secondary: ["함께 보고 싶은 목표", "Other goals to follow"],
  location: ["지금 있는 곳", "Where you are now"],
  locHint: ["목표에 맞춰 미리 골라 두었어요. 바꿀 수 있어요.", "Pre-selected from your goal. You can change it."],
  abroad: ["해외", "Abroad"],
  korea: ["한국", "Korea"],
  unknown: ["정하지 않음", "Not decided"],
  todayEyebrow: ["오늘 할 일", "Today"],
  todayTitle: ["다음 한 걸음", "Your next step"],
  neutralTitle: ["어디서부터 시작할까요?", "Where would you like to start?"],
  resume: ["이어서 작성하기", "Continue writing"],
  resumeNote: ["아직 확인하지 않은 준비가 있어요", "You have an unconfirmed draft"],
  demoNote: ["미리보기용 예시예요. 실제 기관이나 공고가 아니니, 실제 정보는 공식 안내에서 확인하세요.", "Preview examples only, not real institutions or postings. Check official sources for real details."],
  tools: ["기존 SYNK 도구", "Existing SYNK tools"],
  official: ["공식 링크", "Official links"],
  officialBadge: ["공식", "Official"],
  demo: ["예시", "Example"],
  checked: ["확인일", "Checked"],
  openNew: ["새 창에서 열기", "opens in new tab"],
  exploreTitle: ["기회 둘러보기", "Explore opportunities"],
  all: ["전체", "All"],
  filter: ["목표로 거르기", "Filter by goal"],
  details: ["자세히", "Details"],
  compareAdd: ["비교에 담기", "Add to compare"],
  compareOn: ["비교 중", "Comparing"],
  compareTitle: ["비교", "Comparison"],
  compareMax: ["최대 3개까지 비교할 수 있어요.", "You can compare up to 3."],
  clearCompare: ["비교 비우기", "Clear comparison"],
  requirements: ["준비할 내용", "What to prepare"],
  prepareThis: ["이 목표 준비하기", "Prepare for this"],
  backList: ["목록으로", "Back to list"],
  prepareTitle: ["내 준비", "My preparation"],
  noTasks: ["아직 시작한 준비가 없어요. 탐색에서 하나를 골라 보세요.", "No preparation yet. Pick one in Explore."],
  open: ["열기", "Open"],
  draft: ["작성 중", "Drafting"],
  done: ["준비 완료 · 미제출", "Ready · Not submitted"],
  source: ["출처", "Source"],
  prompt: ["작성 안내", "Prompt"],
  body: ["내 답변", "Your answer"],
  maxlen: ["최대 6000자 · 저장 상태는 계정 안내에서 확인하세요", "Up to 6000 characters · check save status in the account notice"],
  confirmCheck: ["내용을 직접 확인했고 실제 제출은 공식 경로로 한다는 것을 이해했어요", "I reviewed this myself and understand real submission happens through official channels"],
  confirm: ["준비 완료로 표시", "Mark as ready"],
  needBody: ["내용을 먼저 적어 주세요.", "Please write something first."],
  needCheck: ["확인 항목에 체크해 주세요.", "Please tick the confirmation box."],
  confirmed: ["준비 완료로 표시했어요. 아무 곳에도 제출되지 않았어요.", "Marked as ready. Nothing was submitted anywhere."],
  nextAction: ["다음 준비로", "Go to next task"],
  exploreMore: ["다른 기회 보기", "See other opportunities"],
  editInvalid: ["내용이 바뀌어 다시 확인이 필요해요.", "Content changed; please confirm again."],
  result: ["정리된 내용", "Your summary"],
  missing: ["찾을 수 없는 항목이에요.", "Item not found."],
  helpTitle: ["도움 받기", "Get help"],
  helpLead: ["공식 기관에 물어볼 질문을 정리해요. 답을 대신 판단하지 않아요.", "Draft a question for official sources. PATH does not judge answers."],
  topic: ["주제", "Topic"],
  general: ["일반 체류 안내", "General stay info"],
  template: ["질문 템플릿", "Question template"],
  copy: ["복사하기", "Copy"],
  copied: ["복사했어요.", "Copied."],
  copyFail: ["복사하지 못했어요. 아래 글을 직접 선택해 복사하세요.", "Copy failed. Select the text below and copy it manually."],
  profileTitle: ["내 정보", "Profile"],
  goal: ["목표", "Goal"],
  none: ["선택 안 함", "Not selected"],
  lang: ["언어", "Language"],
  changeGoal: ["목표 바꾸기", "Change goal"],
  storage: ["저장 방식", "Storage"],
  storageText: ["로그인하지 않으면 작성 내용은 이 탭에만 저장돼요. 로그인하면 이 탭의 자료를 계정으로 가져올지, 계정에 저장된 자료를 쓸지 고를 수 있어요. 공용 기기라면 사용 후 데이터를 지워 주세요.", "Without signing in, drafts are saved only in this tab. When you sign in, you can choose to import this tab’s data into your account or use the data saved in your account. On a shared device, clear the data when you are done."],
  deleteFail: ["저장된 데이터를 지우지 못했어요. 지금 상태는 그대로 두었어요.", "Could not delete saved data. Your current state was kept as is."],
  clear: ["이 탭의 PATH 데이터 지우기", "Clear PATH data in this tab"],
  clearAsk: ["이 탭에 저장된 PATH 데이터를 지울까요?", "Clear PATH data saved in this tab?"],
  cleared: ["지웠어요.", "Cleared."],
  blocked: ["저장된 데이터를 읽을 수 없어 저장을 멈췄어요. 원본은 그대로 두었고 지금 화면은 메모리로만 동작해요.", "Saved data could not be read, so saving is paused. The original is untouched; this screen runs in memory only."],
  reset: ["저장 데이터 초기화", "Reset saved data"],
  resetAsk: ["읽을 수 없는 저장 데이터를 지우고 새로 시작할까요?", "Delete unreadable saved data and start fresh?"],
  storeFail: ["이 탭에 저장하지 못했어요. 작성 내용은 화면에 남아 있어요.", "Could not save in this tab. Your text stays on screen."],
  pageAnn: ["페이지", "page"],
  artKicker: ["PATH · 한국 여정", "PATH · Korea journey"],
  artTitle: ["한국에서의 다음 장.", "Your next chapter in Korea."],
  artPrep: ["준비", "Prepare"],
  artPrepD: ["목표를 정하고 서류와 질문 정리", "Set a goal, gather documents and questions"],
  artArrive: ["도착", "Arrive"],
  artArriveD: ["학교와 생활에 자리 잡기", "Settle into school and daily life"],
  artOpp: ["기회", "Opportunities"],
  artOppD: ["공고를 비교하고 지원 준비", "Compare postings and get ready to apply"],
  journeyTitle: ["준비의 세 걸음", "Three steps forward"],
  j1: ["기회 찾기", "Find opportunities"],
  j1d: ["실제 채용 공고와 연습용 예시를 구분해서 둘러보고 비교해요.", "Browse real job postings and practice examples, clearly labeled, and compare them."],
  j1go: ["둘러보기", "Explore"],
  j2: ["자료 준비", "Prepare materials"],
  j2d: ["내 말로 답변 초안을 적어 두어요.", "Draft your answers in your own words."],
  j2go: ["내 준비 보기", "View my preparation"],
  j3: ["직접 확인", "Check it yourself"],
  j3d: ["내용을 직접 확인하고, 실제 제출은 공식 경로로 해요.", "Review it yourself, then submit through official channels."],
  j3go: ["확인하러 가기", "Go review"],
  homeOpps: ["이 목표의 예시 기회", "Example opportunities for this goal"],
  seeAll: ["모두 보기", "See all"],
  neutralLead: ["목표 하나를 고르면 맞는 예시와 준비 흐름을 보여 드려요.", "Pick a goal to see matching examples and a preparation flow."],
  toolsLead: ["공식 안내와 별개인 SYNK 페이지예요. 새 창에서 열리고 PATH 저장 내용과 분리돼요.", "Separate SYNK pages, not official sources. They open in a new tab, apart from PATH data."]
};
var t = (k) => (DICT[k] || [k, k])[state.lang === "en" ? 1 : 0];
var pick = (o) => o ? o[state.lang] ?? o.ko : "";
var esc3 = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var goalById = (id) => GOALS.find((g) => g.id === id);
var oppById = (id) => {
  const demo = OPPORTUNITIES.find((o) => o.id === id);
  if (demo) return demo;
  const saved = (session.document()?.savedJobs || []).find((j) => j.id === id);
  return saved ? jobOpportunity(saved) : void 0;
};
var say = (m) => {
  announcer.textContent = "";
  setTimeout(() => {
    announcer.textContent = m;
  }, 30);
};
var state;
var blocked = false;
var storageError = false;
var localMutation = false;
var hadDoc = false;
var activeOwner = null;
var wasOnboarded = false;
var composingEl = null;
var composingOwner = null;
var deferredRender = false;
var deferredFocus = false;
var compTimer = null;
var pendingBackup = null;
function cancelComposition() {
  composingEl = null;
  composingOwner = null;
  deferredRender = false;
  deferredFocus = false;
  if (compTimer) {
    clearTimeout(compTimer);
    compTimer = null;
  }
}
var ownerKey = () => {
  const st = session.status();
  return `${st.mode ?? ""}:${st.accountId ?? ""}`;
};
function resetForDoc(doc) {
  cancelComposition();
  pendingBackup = null;
  S.taskId = null;
  S.oppId = null;
  S.compare = [];
  S.step = 1;
  S.error = null;
  S.draft = newDraft();
  S.filter = state.primaryGoal || "all";
  S.help = state.primaryGoal || "study";
  if (!doc?.state) S.page = "profile";
  else if (!state.onboarded) S.page = session.status().canImportGuest ? "profile" : "onboard";
  else S.page = "today";
}
var session = createPathSession({
  configUrl: "./config.json",
  onDocument(doc) {
    state = doc?.state || createInitialState(state?.lang || "ko");
    const owner = ownerKey(), ready = !!doc?.state, onb = !!state.onboarded;
    const changed = activeOwner !== null && (owner !== activeOwner || ready && !hadDoc || wasOnboarded && !onb);
    activeOwner = owner;
    hadDoc = ready;
    wasOnboarded = onb;
    if (changed) resetForDoc(doc);
    if (!localMutation) render(false);
  },
  onStatus() {
    if (!localMutation) render(false);
  }
});
state = session.document()?.state || createInitialState("ko");
hadDoc = !!session.document()?.state;
var S = { page: state.onboarded ? "today" : "onboard", step: 1, draft: null, filter: state.primaryGoal || "all", compare: [], oppId: null, taskId: null, help: state.primaryGoal || "study", flash: null, copyMsg: null, error: null };
activeOwner = ownerKey();
wasOnboarded = !!state.onboarded;
function commit(next) {
  if (!next) return false;
  if (!session.status().canEdit) {
    const err = session.status().error;
    const m = err ? getAccountErrorMessage(err, state.lang) : state.lang === "en" ? "You can't change data right now. Please check the save status in Profile." : "현재는 자료를 바꿀 수 없어요. 내 정보에서 저장 상태를 확인해 주세요.";
    S.flash = esc3(m);
    say(m);
    return false;
  }
  localMutation = true;
  try {
    session.updateState(next);
    state = session.document().state;
    return true;
  } catch (e) {
    state = session.document()?.state || state;
    const m = getAccountErrorMessage(e, state.lang);
    S.flash = esc3(m);
    say(m);
    return false;
  } finally {
    localMutation = false;
  }
}
function newDraft() {
  return { primaryGoal: state.primaryGoal, interests: [...state.interests || []], secondaryGoals: [...state.secondaryGoals || []], location: state.location || "unknown" };
}
var TABS = ["today", "explore", "prepare", "help", "profile"];
function shell(main) {
  const nav = state.onboarded && S.page !== "onboard";
  const acctSt = session.status();
  const acct = acctSt.signedIn ? `<button type="button" class="secondary account-btn" data-action="nav" data-page="profile"${S.page === "profile" ? ' aria-current="page"' : ""}>${state.lang === "en" ? "My account" : "내 계정"}</button>` : `<button type="button" class="secondary account-btn" data-action="accountSignIn">${state.lang === "en" ? "Sign in" : "가입·로그인"}</button>`;
  const btns = TABS.map((p) => `<button type="button" data-action="nav" data-page="${p}"${navActive(p) ? ' aria-current="page" class="active"' : ""}>${t(p)}</button>`).join("");
  return `<div class="app-shell${nav ? " has-nav" : ""}"><header class="topbar">
<button type="button" class="brand" data-action="${nav ? "nav" : "noop"}" data-page="today" aria-label="PATH">PATH</button><span class="preview-label">${t("preview")}</span>
${nav ? `<nav class="main-nav" aria-label="${t("navLabel")}">${btns}</nav>` : ""}
${acct}<label class="sr-only" for="lang">${t("langLabel")}</label><select id="lang" class="lang-select" data-action="lang"><option value="ko"${state.lang === "ko" ? " selected" : ""}>한국어</option><option value="en"${state.lang === "en" ? " selected" : ""}>English</option></select></header>
${main}${nav ? `<nav class="mobile-nav" aria-label="${t("navLabel")}">${btns}</nav>` : ""}</div>`;
}
function navActive(p) {
  return S.page === p || p === "explore" && S.page === "detail" || p === "prepare" && S.page === "editor";
}
function notices() {
  const accSt = session.status();
  blocked = !!accSt.guestBlocked;
  storageError = accSt.error?.code === "LOCAL_STORAGE_UNAVAILABLE";
  const guestStore = storageError && !accSt.signedIn;
  let h = guestStore ? "" : renderAccountNotice(accSt, state.lang) || "";
  if (blocked) h += `<div class="notice error" role="alert"><p>${t("blocked")}</p><div class="actions"><button type="button" class="secondary" data-action="reset">${t("reset")}</button></div></div>`;
  h += `<div id="store-note" class="notice error" role="status"${storageError ? "" : " hidden"}><span>${t("storeFail")}</span>${guestStore ? ` <button type="button" class="text-button" data-action="accountRetry">${accL("다시 시도", "Retry")}</button>` : ""}</div>`;
  if (S.flash) h += `<div id="flash" class="notice" role="status">${S.flash}</div>`;
  return h;
}
var head = (title, eyebrow, lead) => `<header class="page-header">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}<h1 class="page-title" tabindex="-1">${title}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</header>`;
var ext = (url, label) => `<a href="${esc3(url)}" target="_blank" rel="noopener noreferrer">${esc3(label)}<span class="sr-only"> (${t("openNew")})</span></a>`;
function demoBadge(o) {
  if (o?.source === "live") return `<span class="badge">${state.lang === "en" ? "Official job posting" : "공식 채용 공고"}</span>`;
  return `<span class="badge">${t("demo")}</span>`;
}
var liveLink = (o) => o?.source === "live" && o.url ? `<p><a href="${esc3(o.url)}" target="_blank" rel="noopener noreferrer">${state.lang === "en" ? "View original posting (opens in new tab)" : "원문 공고 보기 (새 탭)"}</a></p>` : "";
var findJobEntry = (id) => (jobsFeed.snapshot().jobs || []).find((j) => j.id === id) || (session.document()?.savedJobs || []).find((j) => j.id === id);
function onboard() {
  const d = S.draft;
  if (S.step === 1) {
    const items = GOALS.map((g2, gi) => `<li role="none"><button type="button" class="goal-choice" role="radio" aria-checked="${d.primaryGoal === g2.id}" tabindex="${d.primaryGoal === g2.id || !d.primaryGoal && g2 === GOALS[0] ? 0 : -1}" data-action="pickGoal" data-id="${g2.id}"><span class="choice-icon" aria-hidden="true">${goalIcon(g2.id)}</span><span class="choice-copy"><span class="choice-num" aria-hidden="true">0${gi + 1}</span><span class="choice-title">${esc3(pick(g2.label))}</span><span class="choice-desc">${esc3(pick(g2.description))}</span></span><span class="choice-mark" aria-hidden="true"></span></button></li>`).join("");
    return `<p class="step-label">${t("step1")}</p><h1 class="page-title" id="q1" tabindex="-1">${t("q1")}</h1><p class="lead">${t("q1lead")}</p>
<ul class="choice-list" role="radiogroup" aria-labelledby="q1">${items}</ul>
<div class="actions"><button type="button" class="primary" data-action="step2"${d.primaryGoal ? "" : " disabled"}>${t("next")}</button><button type="button" class="text-button" data-action="skip">${t("skip")}</button>${state.onboarded ? `<button type="button" class="text-button" data-action="cancelOnboard">${t("cancel")}</button>` : ""}</div>`;
  }
  const g = goalById(d.primaryGoal);
  const chips = (list, key) => list.map((x) => `<button type="button" class="chip" aria-pressed="${d[key].includes(x.id)}" data-action="toggle" data-key="${key}" data-id="${x.id}">${esc3(pick(x.label))}</button>`).join("");
  const locs = ["abroad", "korea", "unknown"].map((l) => `<option value="${l}"${d.location === l ? " selected" : ""}>${t(l)}</option>`).join("");
  return `<p class="step-label">${t("step2")}</p><h1 class="page-title" tabindex="-1">${t("q2")}</h1><p class="lead">${t("q2lead")}</p>
<fieldset class="field"><legend>${t("interests")}</legend><div class="chips">${chips(g.interests, "interests")}</div></fieldset>
<fieldset class="field"><legend>${t("secondary")}</legend><div class="chips">${chips(GOALS.filter((x) => x.id !== g.id), "secondaryGoals")}</div></fieldset>
<div class="field"><label for="loc">${t("location")}</label><span class="hint" id="loc-hint">${t("locHint")}</span><select id="loc" class="lang-select" aria-describedby="loc-hint" data-action="loc">${locs}</select></div>
<div class="actions"><button type="button" class="primary" data-action="finish">${t("start")}</button><button type="button" class="secondary" data-action="step1">${t("back")}</button><button type="button" class="text-button" data-action="cancelOnboard">${t("cancel")}</button></div>`;
}
var svgIcon = (p) => `<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${p}</svg>`;
var ICONS = {
  study: svgIcon('<path d="M4 26h24"/><path d="M7 20.5 25 11a2.6 2.6 0 0 1 2.3 4.6L10 24l-4.5-2.2 2-1.3"/><path d="m14 15.5-3.5-6 3-1 7.5 4"/>'),
  student: svgIcon('<path d="M16 9.5V26"/><path d="M16 9.5C12.8 7.6 8.8 7 5 7.4v16c3.8-.4 7.8.2 11 2.1 3.2-1.9 7.2-2.5 11-2.1v-16c-3.8-.4-7.8.2-11 2.1z"/>'),
  job: svgIcon('<rect x="5" y="10" width="22" height="15" rx="2.5"/><path d="M12 10V7.5A1.5 1.5 0 0 1 13.5 6h5A1.5 1.5 0 0 1 20 7.5V10"/><path d="M5 16.5h22"/><path d="M14.5 15v3h3v-3"/>'),
  arrive: svgIcon('<path d="M16 27s-8-7.2-8-13a8 8 0 0 1 16 0c0 5.8-8 13-8 13z"/><circle cx="16" cy="14" r="3"/>'),
  open: svgIcon('<path d="M16 4v6M16 22v6M4 16h6M22 16h6"/><circle cx="16" cy="16" r="5"/>')
};
var goalIcon = (id) => ICONS[id] || "";
function onboardArt() {
  const order = state.lang === "en" ? [1, 0] : [0, 1];
  const ms = [["artPrep", "artPrepD", "study"], ["artArrive", "artArriveD", "arrive"], ["artOpp", "artOppD", "open"]];
  return `<div class="onboard-art" aria-hidden="true"><div><p class="art-kicker">${t("artKicker")}</p><p class="art-title">${DICT.artTitle[order[0]]}</p><p class="art-sub">${DICT.artTitle[order[1]]}</p></div><ol class="art-journey">${ms.map(([a, b, ic], i) => `<li><span class="art-node">${ICONS[ic]}</span><span class="art-text"><span class="art-num">0${i + 1}</span><strong>${t(a)}</strong><span>${t(b)}</span></span></li>`).join("")}</ol></div>`;
}
var heroArt = () => `<div class="hero-art" aria-hidden="true"><svg viewBox="0 0 320 200" fill="none" focusable="false"><path d="M20 176C86 176 82 104 150 104S220 32 298 28"/><circle cx="20" cy="176" r="7"/><circle cx="150" cy="104" r="7"/><circle class="end" cx="298" cy="28" r="10"/></svg><ol class="hero-marks"><li>${t("artPrep")}</li><li>${t("artArrive")}</li><li>${t("artOpp")}</li></ol></div>`;
function journey(exploreId, task) {
  const link = (attrs, label) => `<button type="button" class="step-link" ${attrs}>${label}<span aria-hidden="true">&nbsp;→</span></button>`;
  const step = (n, a, b, btn2) => `<li class="journey-step"><span class="journey-num" aria-hidden="true">0${n}</span><h3>${t(a)}</h3><p>${t(b)}</p>${btn2}</li>`;
  return `<section class="home-section"><h2 class="home-h2">${t("journeyTitle")}</h2><ol class="journey">${step(1, "j1", "j1d", link(`data-action="exploreGoal" data-id="${exploreId}"`, t("j1go")))}${step(2, "j2", "j2d", task ? link(`data-action="openTask" data-id="${esc3(task.id)}"`, t("resume")) : link('data-action="nav" data-page="prepare"', t("j2go")))}${step(3, "j3", "j3d", link('data-action="nav" data-page="prepare"', t("j3go")))}</ol></section>`;
}
function today() {
  const g = goalById(state.primaryGoal);
  if (!g) {
    return `<section class="home-hero"><div class="hero-copy"><p class="eyebrow">${t("todayEyebrow")}</p><h1 class="page-title" tabindex="-1">${t("neutralTitle")}</h1><p class="hero-title">${t("neutralLead")}</p></div>${heroArt()}</section><ul class="goal-entrances">${GOALS.map((x, i) => `<li><span class="choice-icon" aria-hidden="true">${goalIcon(x.id)}</span><span class="journey-num" aria-hidden="true">0${i + 1}</span><h2>${esc3(pick(x.label))}</h2><p>${esc3(pick(x.homeTitle))}</p><button type="button" class="secondary" data-action="exploreGoal" data-id="${x.id}">${esc3(pick(x.homeAction))}</button></li>`).join("")}</ul>${journey("all", null)}`;
  }
  const nt = getNextTask(state);
  const task = nt && nt.goal === g.id && !nt.confirmedAt ? nt : null;
  const opps = OPPORTUNITIES.filter((o) => o.goal === g.id).slice(0, 2);
  const cta = task ? `<button type="button" class="primary" data-action="openTask" data-id="${esc3(task.id)}">${t("resume")}</button>` : `<button type="button" class="primary" data-action="exploreGoal" data-id="${g.id}">${esc3(pick(g.homeAction))}</button>`;
  let h = `<section class="home-hero"><div class="hero-copy"><p class="eyebrow">${t("todayEyebrow")} · ${esc3(pick(g.description))}</p><h1 class="page-title" tabindex="-1">${t("todayTitle")}</h1><p class="hero-goal"><span class="goal-pill"><span aria-hidden="true">${goalIcon(g.id)}</span><span>${esc3(pick(g.label))}</span></span></p><p class="hero-title">${esc3(pick(g.homeTitle))}</p>${task ? `<p class="hero-note">${t("resumeNote")} · ${esc3(pick(oppById(task.sourceId).title))}</p>` : ""}<div class="actions">${cta}</div></div>${heroArt()}</section>`;
  h += journey(g.id, task);
  h += `<section class="home-section"><div class="home-h2-row"><h2 class="home-h2">${t("homeOpps")}</h2><button type="button" class="step-link" data-action="exploreGoal" data-id="${g.id}">${t("seeAll")}<span aria-hidden="true">&nbsp;→</span></button></div><p class="proto-note">${t("demoNote")}</p><ul class="home-opps">${opps.map((o) => `<li><div>${demoBadge()}<h3>${esc3(pick(o.title))}</h3><p>${esc3(pick(o.summary))}</p></div><button type="button" class="secondary" data-action="detail" data-id="${o.id}">${t("details")}</button></li>`).join("")}</ul></section>`;
  return h;
}
function officialList(goal) {
  const list = OFFICIAL_LINKS.filter((l) => goal === "all" || l.goal === goal || l.goal === null);
  return `<ul class="link-list">${list.map((l) => `<li><div><span class="badge official">${t("officialBadge")}</span>${ext(l.url, pick(l.title))}<p>${esc3(pick(l.summary))}</p><p class="meta">${t("checked")} ${esc3(l.checkedAt)}</p></div></li>`).join("")}</ul>`;
}
function explore() {
  const f = S.filter;
  const filt = ["all", ...GOALS.map((g) => g.id)].map((id) => `<button type="button" class="chip" aria-pressed="${f === id}" data-action="filter" data-id="${id}">${id === "all" ? t("all") : esc3(pick(goalById(id).description))}</button>`).join("");
  const list = OPPORTUNITIES.filter((o) => f === "all" || o.goal === f);
  const full = S.compare.length >= 3;
  let h = head(t("exploreTitle"), t("explore"));
  h += `<div role="group" aria-label="${t("filter")}" class="chips">${filt}</div>`;
  if (["all", "job", "student"].includes(f)) h += renderJobs({ feed: jobsFeed.snapshot(), lang: state.lang, savedJobs: session.document()?.savedJobs || [], query: S.jobQueryText ?? S.jobQuery ?? "", board: S.jobBoard || "all", onlySaved: !!S.onlySaved, page: S.jobPage || 0, canEdit: session.status().canEdit });
  h += `<details class="practice"><summary>${state.lang === "en" ? "Practice examples" : "연습용 예시"}</summary><p class="meta">${t("demoNote")}</p>`;
  h += `<div class="section-heading"><h2>${t("demo")}</h2></div><ul class="opportunity-list">${list.map((o) => {
    const on = S.compare.includes(o.id);
    return `<li class="opportunity"><div>${demoBadge(o)}<h3>${esc3(pick(o.title))}</h3><p>${esc3(pick(o.summary))}</p></div><div class="actions"><button type="button" class="secondary" data-action="detail" data-id="${o.id}">${t("details")}</button><button type="button" class="chip" aria-pressed="${on}" data-action="compare" data-id="${o.id}"${full && !on ? " disabled" : ""}>${on ? t("compareOn") : t("compareAdd")}</button></div></li>`;
  }).join("")}</ul>`;
  if (full) h += `<p class="meta">${t("compareMax")}</p>`;
  if (S.compare.length) {
    h += `<div class="section-heading"><h2>${t("compareTitle")} (${S.compare.length}/3)</h2><button type="button" class="text-button" data-action="clearCompare">${t("clearCompare")}</button></div><div class="compare-grid">${S.compare.map(oppById).map((o) => `<div class="compare-item">${demoBadge(o)}<h3>${esc3(pick(o.title))}</h3><ul>${o.requirements.map((r) => `<li>${esc3(pick(r))}</li>`).join("")}</ul></div>`).join("")}</div>`;
  }
  h += "</details>";
  h += `<div class="section-heading"><h2>${t("official")}</h2></div>${officialList(f)}`;
  return h;
}
function detail() {
  const o = oppById(S.oppId);
  if (!o) return head(t("missing")) + `<button type="button" class="secondary" data-action="nav" data-page="explore">${t("backList")}</button>`;
  return `<article class="detail">${demoBadge(o)}<h1 class="page-title" tabindex="-1">${esc3(pick(o.title))}</h1><p class="meta">${esc3(pick(goalById(o.goal).label))}</p><p>${esc3(pick(o.summary))}</p>${liveLink(o)}
<h2 class="section-heading">${t("requirements")}</h2><ol class="requirements">${o.requirements.map((r) => `<li>${esc3(pick(r))}</li>`).join("")}</ol>
<div class="actions"><button type="button" class="primary" data-action="${o.source === "live" ? "prepareJob" : "prepareThis"}" data-id="${esc3(o.id)}">${t("prepareThis")}</button><button type="button" class="secondary" data-action="nav" data-page="explore">${t("backList")}</button></div></article>
<div class="section-heading"><h2>${t("official")}</h2></div>${officialList(o.goal)}`;
}
var statusHtml = (task) => `<span class="status" data-state="${task.confirmedAt ? "done" : "draft"}">${task.confirmedAt ? t("done") : t("draft")}</span>`;
function prepare() {
  let h = head(t("prepareTitle"), t("prepare"));
  if (!state.tasks.length) return h + `<p class="empty">${t("noTasks")}</p><div class="actions"><button type="button" class="primary" data-action="nav" data-page="explore">${t("explore")}</button></div>`;
  for (const g of GOALS) {
    const ts = state.tasks.filter((x) => x.goal === g.id);
    if (!ts.length) continue;
    h += `<div class="section-heading"><h2>${esc3(pick(g.label))}</h2></div><ul class="task-list">${ts.map((x) => {
      const so = oppById(x.sourceId);
      return `<li class="task-row"><div>${demoBadge(so)}<h3>${so ? esc3(pick(so.title)) : t("missing")}</h3><p>${statusHtml(x)}</p></div><button type="button" class="secondary" data-action="openTask" data-id="${esc3(x.id)}">${t("open")}</button></li>`;
    }).join("")}</ul>`;
  }
  return h;
}
function editor() {
  const task = state.tasks.find((x) => x.id === S.taskId);
  const o = task && oppById(task.sourceId);
  if (!o) return head(t("missing")) + `<button type="button" class="secondary" data-action="nav" data-page="prepare">${t("prepare")}</button>`;
  let h = `<article class="detail">${demoBadge(o)}<h1 class="page-title" tabindex="-1">${esc3(pick(o.title))}</h1>
<p class="meta"><span>${t("source")}: ${demoBadge(o)}<button type="button" class="text-button" data-action="detail" data-id="${esc3(o.id)}">${esc3(pick(o.title))}</button></span></p>${liveLink(o)}
<p><strong>${t("prompt")}:</strong> ${esc3(pick(o.prompt))}</p>
<section class="editor"><div class="field"><label for="body">${t("body")}</label><span class="hint" id="body-hint">${t("maxlen")}</span>
<textarea id="body" maxlength="6000" aria-describedby="body-hint edit-err" data-action="body"${S.error === "needBody" ? ' aria-invalid="true"' : ""}>${esc3(task.body)}</textarea></div>
<p id="task-status">${statusHtml(task)}</p>
<label class="check-row"><input type="checkbox" id="ack"${task.confirmedAt ? " checked" : ""}> <span>${t("confirmCheck")}</span></label>
<p id="edit-err" class="meta" role="alert">${S.error ? t(S.error) : ""}</p>
<div class="actions"><button type="button" class="primary" data-action="confirm">${t("confirm")}</button><button type="button" class="secondary" data-action="nav" data-page="prepare">${t("prepare")}</button></div></section>`;
  if (task.confirmedAt) {
    const nx = getNextTask(state);
    h += `<div id="confirmed-result"><div class="section-heading"><h2>${demoBadge(o)}${t("result")}</h2></div><div class="result-body">${esc3(task.body)}</div>
<div class="actions">${nx && nx.id !== task.id && !nx.confirmedAt ? `<button type="button" class="primary" data-action="openTask" data-id="${esc3(nx.id)}">${t("nextAction")}</button>` : ""}<button type="button" class="secondary" data-action="exploreGoal" data-id="${task.goal}">${t("exploreMore")}</button></div></div>`;
  }
  return h + "</article>";
}
function helpTemplate(topic) {
  const g = goalById(topic);
  const subj = g ? pick(g.label) : t("general");
  return state.lang === "en" ? `Hello,
I am contacting you about: ${subj}.
My current location: ${t(state.location || "unknown")}.

1. What official requirements apply to my situation?
2. Which documents should I prepare, and where can I find the official list?
3. Is there an official page or contact I should check first?

Thank you.` : `안녕하세요.
다음 주제로 문의드립니다: ${subj}
현재 있는 곳: ${t(state.location || "unknown")}

1. 제 상황에 적용되는 공식 요건은 무엇인가요?
2. 준비해야 할 서류와 공식 목록은 어디에서 확인할 수 있나요?
3. 먼저 확인해야 할 공식 페이지나 문의처가 있을까요?

감사합니다.`;
}
function help() {
  const opts = [...GOALS.map((g) => [g.id, pick(g.label)]), ["general", t("general")]].map(([id, l]) => `<option value="${id}"${S.help === id ? " selected" : ""}>${esc3(l)}</option>`).join("");
  return head(t("helpTitle"), t("help"), t("helpLead")) + `<div class="field"><label for="topic">${t("topic")}</label><select id="topic" class="lang-select" data-action="topic">${opts}</select></div>
<div class="section-heading"><h2>${t("template")}</h2><button type="button" class="secondary" data-action="copy">${t("copy")}</button></div>
${S.copyMsg ? `<p class="notice${S.copyMsg === "copyFail" ? " error" : ""}" role="status">${t(S.copyMsg)}</p>` : ""}<pre class="result-body" id="tpl">${esc3(helpTemplate(S.help))}</pre>
<div class="section-heading"><h2>${t("official")}</h2></div>${officialList(S.help === "general" ? "none" : S.help)}
<div class="section-heading"><h2>${t("tools")}</h2></div><p class="proto-note">${t("toolsLead")}</p><ul class="link-list tools">${EXISTING_TOOLS.map((x) => `<li><div>${ext(x.url, pick(x.title))}<p>${esc3(pick(x.summary))}</p></div></li>`).join("")}</ul>`;
}
function profile() {
  const g = goalById(state.primaryGoal);
  const accSt = session.status();
  return head(t("profileTitle"), t("profile")) + renderAccountPanel(accSt, state.lang, { pendingBackup: !!pendingBackup && !!accSt.canConfirmBackup && pendingBackup.owner === ownerKey(), useRemote: !!pendingBackup?.useRemote }) + `<section class="settings-group"><h2>${t("goal")}</h2><p>${g ? esc3(pick(g.label)) : t("none")}</p><button type="button" class="secondary" data-action="changeGoal">${t("changeGoal")}</button></section>
<section class="settings-group"><h2>${t("location")}</h2><p>${t(state.location || "unknown")}</p></section>
<section class="settings-group"><h2>${t("lang")}</h2><p>${state.lang === "en" ? "English" : "한국어"}</p></section>
<section class="settings-group"><h2>${t("storage")}</h2>${accSt.signedIn ? `<p>${state.lang === "en" ? "Syncs to your account. Please check the save status above." : "계정에 동기화합니다. 위의 저장 상태를 확인해 주세요."}</p>` : `<p>${t("storageText")}</p><button type="button" class="secondary" data-action="clear">${t("clear")}</button>`}</section>`;
}
var PAGES = { today, explore, detail, prepare, editor, help, profile };
var LOCKED_ACTIONS = ["pickGoal", "step2", "toggle", "finish", "skip", "prepareThis", "confirm", "body", "loc", "lang", "changeGoal", "prepareJob", "saveJob", "removeJob"];
function render(focus = true) {
  if (composingEl && root.contains(composingEl) && document.activeElement === composingEl) {
    deferredRender = true;
    deferredFocus = deferredFocus || focus;
    return;
  }
  composingEl = null;
  const accSt = session.status();
  const ae = document.activeElement;
  const keepId = !focus && ae && root.contains(ae) ? ae.id : "";
  let selS = null, selE = null;
  if (keepId) {
    try {
      selS = ae.selectionStart;
      selE = ae.selectionEnd;
    } catch {
      selS = selE = null;
    }
  }
  if (accSt.signedIn && !session.document()?.state) {
    S.page = "profile";
    S.draft = null;
  }
  if (!S.draft) S.draft = newDraft();
  document.documentElement.lang = state.lang;
  const main = S.page === "onboard" ? `<main class="onboard-layout">${onboardArt()}<div class="onboard-main">${notices()}${onboard()}</div></main>` : `<main class="content">${notices()}${PAGES[S.page]()}</main>`;
  root.innerHTML = shell(main);
  if (!accSt.canEdit) {
    root.querySelectorAll("[data-action]").forEach((c) => {
      if (LOCKED_ACTIONS.includes(c.dataset.action) && "disabled" in c) c.disabled = true;
    });
    const ackLock = root.querySelector("#ack");
    if (ackLock) ackLock.disabled = true;
  }
  if (keepId) {
    const n = document.getElementById(keepId);
    if (n && !n.disabled) {
      n.focus();
      if (selS != null && typeof n.setSelectionRange === "function") {
        try {
          n.setSelectionRange(selS, selE ?? selS);
        } catch {
        }
      }
    }
  }
  const h1 = root.querySelector("h1");
  document.title = `${h1 ? h1.textContent : ""} · PATH`;
  if (focus && h1) {
    h1.focus();
    say(h1.textContent);
  }
}
function go(page) {
  S.page = page;
  S.flash = null;
  S.error = null;
  S.copyMsg = null;
  render();
}
function ensureTask(oppId) {
  const o = oppById(oppId);
  if (!o || !session.status().canEdit) return null;
  const id = o.goal + "-" + o.id;
  if (!state.tasks.some((x) => x.id === id) && !commit(upsertTask(state, { id, goal: o.goal, sourceId: o.id, body: "" }))) return null;
  return id;
}
var jobsFeed = createJobsFeed({ configUrl: "./config.json", onChange: () => render(false) });
var ACT = {
  noop() {
  },
  async refreshJobs() {
    await jobsFeed.load();
  },
  searchJobs() {
    const v = root.querySelector("#job-query")?.value ?? S.jobQueryText ?? "";
    S.jobQueryText = v;
    S.jobQuery = v;
    S.jobPage = 0;
    render(false);
    root.querySelector("#job-query")?.focus();
  },
  jobPage(el) {
    const n = Number(el.dataset.value ?? el.dataset.page);
    if (!Number.isInteger(n) || n < 0) return;
    S.jobPage = n;
    render(false);
  },
  saveJob(el) {
    const entry = findJobEntry(el.dataset.id);
    if (!entry || !session.status().canEdit) return;
    localMutation = true;
    try {
      session.saveJob(entry);
      state = session.document().state;
    } finally {
      localMutation = false;
    }
    render(false);
  },
  removeJob(el) {
    if (!session.status().canEdit) return;
    localMutation = true;
    try {
      session.removeJob(el.dataset.id);
      state = session.document().state;
    } finally {
      localMutation = false;
    }
    render(false);
  },
  prepareJob(el) {
    const entry = findJobEntry(el.dataset.id);
    if (!entry || !session.status().canEdit) return;
    localMutation = true;
    try {
      session.saveJob(entry);
      state = session.document().state;
    } finally {
      localMutation = false;
    }
    const id = ensureTask(entry.id);
    if (id == null) {
      render(false);
      return;
    }
    S.taskId = id;
    go("editor");
  },
  nav: (el) => go(el.dataset.page),
  pickGoal(el) {
    if (!session.status().canEdit) return;
    const g = goalById(el.dataset.id);
    S.draft.primaryGoal = g.id;
    S.draft.location = g.defaultLocation;
    S.draft.interests = S.draft.interests.filter((i) => g.interests.some((x) => x.id === i));
    S.draft.secondaryGoals = S.draft.secondaryGoals.filter((x) => x !== g.id);
    render(false);
    root.querySelector(`[data-id="${g.id}"]`)?.focus();
    say(pick(g.label));
  },
  step2() {
    if (S.draft.primaryGoal) {
      S.step = 2;
      render();
    }
  },
  step1() {
    S.step = 1;
    render();
  },
  skip() {
    if (!session.status().canEdit) return;
    if (!commit(updateProfile(state, { onboarded: true, primaryGoal: null }))) {
      render(false);
      return;
    }
    S.filter = "all";
    go("today");
  },
  cancelOnboard() {
    S.draft = newDraft();
    if (state.onboarded) go("profile");
    else {
      S.step = 1;
      render();
    }
  },
  toggle(el) {
    if (!session.status().canEdit) return;
    const arr = S.draft[el.dataset.key], id = el.dataset.id, i = arr.indexOf(id);
    if (i < 0) arr.push(id);
    else arr.splice(i, 1);
    el.setAttribute("aria-pressed", String(i < 0));
  },
  finish() {
    if (!session.status().canEdit) return;
    if (!commit(updateProfile(state, { ...S.draft, onboarded: true }))) {
      render(false);
      return;
    }
    S.filter = state.primaryGoal || "all";
    S.help = state.primaryGoal || "study";
    go("today");
  },
  exploreGoal(el) {
    S.filter = el.dataset.id;
    go("explore");
  },
  filter(el) {
    S.filter = el.dataset.id;
    render(false);
    root.querySelector(`[data-action="filter"][data-id="${el.dataset.id}"]`)?.focus();
  },
  compare(el) {
    const id = el.dataset.id, i = S.compare.indexOf(id);
    if (i >= 0) S.compare.splice(i, 1);
    else if (S.compare.length < 3) S.compare.push(id);
    else return say(t("compareMax"));
    render(false);
    root.querySelector(`[data-action="compare"][data-id="${id}"]`)?.focus();
    say(`${t("compareTitle")} ${S.compare.length}/3`);
  },
  clearCompare() {
    S.compare = [];
    render(false);
    say(t("clearCompare"));
  },
  detail(el) {
    S.oppId = el.dataset.id;
    go("detail");
  },
  prepareThis(el) {
    const id = ensureTask(el.dataset.id);
    if (id == null) {
      render(false);
      return;
    }
    S.taskId = id;
    go("editor");
  },
  openTask(el) {
    S.taskId = el.dataset.id;
    go("editor");
  },
  confirm() {
    const body = root.querySelector("#body").value, ack = root.querySelector("#ack").checked;
    const err = !body.trim() ? "needBody" : !ack ? "needCheck" : null;
    if (err) {
      S.error = err;
      render(false);
      root.querySelector(err === "needBody" ? "#body" : "#ack").focus();
      return;
    }
    if (!session.status().canEdit) return;
    if (!saveBody(body)) {
      render(false);
      return;
    }
    const next = confirmTask(state, S.taskId);
    if (!next) return;
    if (!commit(next)) {
      render(false);
      return;
    }
    S.error = null;
    S.flash = t("confirmed");
    render();
    say(t("confirmed"));
  },
  copy() {
    const txt = helpTemplate(S.help);
    const done = (m) => {
      S.copyMsg = m;
      render(false);
      say(t(m));
    };
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(txt).then(() => done("copied"), () => done("copyFail"));
    else done("copyFail");
  },
  changeGoal() {
    if (!session.status().canEdit) return;
    S.draft = newDraft();
    S.step = 1;
    go("onboard");
  },
  clear() {
    return ACT.clearGuest();
  },
  reset() {
    return ACT.clearGuest();
  }
};
function saveBody(body) {
  const task = state.tasks.find((x) => x.id === S.taskId);
  if (!task) return false;
  if (task.body === body) return true;
  if (!session.status().canEdit) return false;
  let next = upsertTask(state, { id: task.id, goal: task.goal, sourceId: task.sourceId, body });
  if (!next) return false;
  if (task.confirmedAt) next = { ...next, tasks: next.tasks.map((x) => x.id === task.id ? { ...x, confirmedAt: null } : x) };
  if (!commit(next)) return false;
  const ackEl = root.querySelector("#ack");
  if (ackEl) ackEl.checked = false;
  if (task.confirmedAt) {
    const st = root.querySelector("#task-status");
    if (st) st.innerHTML = statusHtml({ confirmedAt: null });
    S.flash = null;
    root.querySelector("#flash")?.remove();
    root.querySelector("#confirmed-result")?.remove();
    say(t("editInvalid"));
  }
  return true;
}
function downloadPath(data, filename) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  let a = null;
  try {
    a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
  } finally {
    a?.remove();
    setTimeout(() => URL.revokeObjectURL(url), 6e4);
  }
}
function requestCurrentBackup(useRemote, name) {
  pendingBackup = null;
  const snap = session.exportCurrent();
  downloadPath(snap, name);
  if (snap && snap.backupToken) pendingBackup = { snap, useRemote, owner: ownerKey() };
  return !!pendingBackup;
}
var accL = (ko, en) => state.lang === "en" ? en : ko;
var accOk = (r) => r !== false && r?.ok !== false;
var accStamp = () => (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
Object.assign(ACT, {
  accountSignIn: async () => {
    await session.signIn();
  },
  accountSignOut: async () => {
    const r = await session.signOut();
    if (!accOk(r)) {
      render(false);
      return;
    }
    S.flash = accL("로그아웃했습니다.", "Signed out.");
    render(false);
    say(S.flash);
  },
  accountRetry: async () => {
    await session.retry();
    render(false);
  },
  accountImport: async () => {
    const r = await session.importGuest();
    if (accOk(r)) {
      S.flash = accL("이 탭의 경로를 계정으로 가져왔습니다.", "Imported this tab's path into your account.");
      say(S.flash);
    }
    render(false);
  },
  accountUseRemote: async () => {
    const st0 = session.status();
    if (st0.signedIn && !st0.loaded && st0.syncStatus === "local-conflict") {
      pendingBackup = null;
      const owner0 = ownerKey();
      const acct0 = st0.accountId;
      const draft0 = S.draft;
      const ok = confirm(accL("이 기기에 보존된 로컬 복구 자료는 지우지 않고 그대로 남아 있어요. 계정에 저장된 자료를 불러올까요?", "The preserved local recovery data on this device is kept and stays available. Load the version saved in your account?"));
      if (!ok) {
        render(false);
        return;
      }
      const st1 = session.status();
      if (S.draft !== draft0 || ownerKey() !== owner0 || st1.accountId !== acct0 || !(st1.signedIn && !st1.loaded && st1.syncStatus === "local-conflict")) {
        S.flash = accL("계정 상태가 바뀌었어요. 내 정보에서 계정 상태를 확인한 뒤 다시 시도해 주세요.", "Your account status changed. Check your account status in Profile and try again.");
        say(S.flash);
        render(false);
        return;
      }
      let r;
      try {
        r = await session.useRemote();
      } catch (e) {
        r = false;
      }
      if (ownerKey() !== owner0 || session.status().accountId !== acct0) {
        S.flash = accL("계정이 바뀌어 작업을 마치지 않았어요. 계정 상태를 확인한 뒤 다시 시도해 주세요.", "The account changed, so the action was not completed. Check your account status and try again.");
      } else if (accOk(r) && session.status().loaded) {
        S.flash = accL("계정 자료를 불러왔어요. 로컬 복구 자료는 이 기기에 그대로 남아 있어요.", "Loaded the account version. The local recovery data is still kept on this device.");
      } else {
        S.flash = accL("계정 자료를 불러오지 못했어요. 연결과 계정 상태를 확인한 뒤 다시 시도해 주세요.", "Could not load the account version. Check your connection and account status, then try again.");
      }
      say(S.flash);
      render(false);
      return;
    }
    if (requestCurrentBackup(true, `path-backup-${accStamp()}.json`)) {
      S.flash = accL("백업 파일 저장을 요청했어요. 파일이 저장된 것을 직접 확인한 뒤 내 정보의 확인 버튼을 누르면 계정 자료를 불러와요.", "A backup file download was requested. After you check the file is saved, use the confirmation button in Profile to load the account version.");
      say(S.flash);
    } else {
      S.flash = accL("아직 계정 자료를 불러올 준비가 되지 않았어요. 잠시 후 다시 시도하거나 계정 상태를 확인해 주세요.", "Not ready to load the account version yet. Try again shortly or check your account status.");
      say(S.flash);
    }
    render(false);
  },
  accountConfirmBackup: async () => {
    const p = pendingBackup;
    if (!p || p.owner !== ownerKey() || !session.status().canConfirmBackup) {
      pendingBackup = null;
      render(false);
      return;
    }
    if (p.useRemote && !confirm(accL("백업 파일이 저장된 것을 확인했다고 표시하고, 계정에 저장된 경로를 불러올까요? 현재 화면의 자료는 바뀝니다.", "Mark that you checked the backup file is saved, and load the path saved in your account? The current view will be replaced."))) {
      render(false);
      return;
    }
    if (!session.confirmBackup(p.snap)) {
      pendingBackup = null;
      S.flash = accL("자료가 바뀌어 이 백업 확인은 더 이상 유효하지 않아요. 다시 내보내 주세요.", "Your data changed, so this backup confirmation is no longer valid. Please export again.");
      render(false);
      say(S.flash);
      return;
    }
    pendingBackup = null;
    if (p.useRemote) {
      const r = await session.useRemote();
      if (accOk(r)) {
        S.flash = accL("계정에 저장된 경로를 불러왔습니다.", "Loaded the path saved in your account.");
        say(S.flash);
      }
    } else {
      S.flash = accL("백업 파일을 확인했다고 표시했어요.", "Marked that you checked the backup file.");
      say(S.flash);
    }
    render(false);
  },
  accountRecover: async (el) => {
    const r = await session.chooseRecovery(el.dataset.id);
    if (accOk(r)) {
      S.flash = accL("선택한 경로로 복구했습니다.", "Restored the selected path.");
      say(S.flash);
    }
    render(false);
  },
  accountExport: () => {
    if (requestCurrentBackup(false, `path-${accStamp()}.json`)) {
      S.flash = accL("백업 파일 저장을 요청했어요. 파일이 저장된 것을 직접 확인했다면 내 정보에서 확인 버튼을 눌러 주세요.", "A backup file download was requested. If you checked the file is saved, use the confirmation button in Profile.");
      say(S.flash);
    }
    render(false);
  },
  accountExportGuest: () => {
    downloadPath(session.exportGuest(), `path-device-${accStamp()}.json`);
    render(false);
  },
  accountExportRemote: async () => {
    downloadPath(await session.exportRemote(), `path-account-${accStamp()}.json`);
    render(false);
  },
  accountExportRecovery: () => {
    downloadPath(session.exportRecovery(), `path-recovery-${accStamp()}.json`);
    render(false);
  },
  clearGuest: () => {
    if (!confirm(accL("이 탭에 저장된 게스트 자료를 지울까요? 계정에 저장된 자료에는 영향이 없습니다.", "Clear the guest data saved in this tab? Data saved in your account is not affected."))) return;
    const r = session.clearGuest();
    if (accOk(r)) {
      S.flash = accL("이 탭의 게스트 자료를 지웠습니다.", "Cleared guest data in this tab.");
      say(S.flash);
    }
    render(false);
  }
});
root.addEventListener("click", (e) => {
  const el = e.target.closest("button[data-action]");
  if (!el || el.disabled || !ACT[el.dataset.action]) return;
  const fail3 = (err) => {
    const m = getAccountErrorMessage(err, state.lang);
    S.flash = esc3(m);
    render(false);
    say(m);
  };
  try {
    Promise.resolve(ACT[el.dataset.action](el)).catch(fail3);
  } catch (err) {
    fail3(err);
  }
});
root.addEventListener("compositionstart", (e) => {
  if (!root.contains(e.target)) return;
  if (compTimer) {
    clearTimeout(compTimer);
    compTimer = null;
  }
  composingEl = e.target;
  composingOwner = ownerKey();
});
root.addEventListener("compositionend", (e) => {
  const el = e.target;
  if (el !== composingEl) return;
  if (compTimer) clearTimeout(compTimer);
  compTimer = setTimeout(() => {
    compTimer = null;
    if (composingEl !== el) return;
    composingEl = null;
    composingOwner = null;
    if (deferredRender) {
      const f = deferredFocus;
      deferredRender = false;
      deferredFocus = false;
      render(f);
    }
  }, 0);
});
root.addEventListener("input", (e) => {
  if (!root.contains(e.target)) return;
  if (e.isComposing) {
    if (composingEl !== e.target) {
      composingEl = e.target;
      composingOwner = ownerKey();
    }
  }
  if (composingEl === e.target && composingOwner !== ownerKey()) return;
  if (e.target.dataset.action === "jobQuery") {
    S.jobQueryText = e.target.value;
    return;
  }
  if (e.target.dataset.action === "body") {
    const v = e.target.value, ss = e.target.selectionStart, se = e.target.selectionEnd;
    if (!saveBody(v)) {
      render(false);
      const b = root.querySelector("#body");
      if (b && b.value !== v) {
        b.value = v;
        if (document.activeElement === b) {
          try {
            b.setSelectionRange(ss, se);
          } catch {
          }
        }
      }
      return;
    }
    if (S.error === "needBody" && e.target.value.trim()) {
      S.error = null;
      e.target.removeAttribute("aria-invalid");
      const err = root.querySelector("#edit-err");
      if (err) err.textContent = "";
    }
  }
});
root.addEventListener("change", (e) => {
  const a = e.target.dataset.action;
  if (a === "lang") {
    if (!session.status().canEdit) {
      render(false);
      return;
    }
    const ok = commit(updateProfile(state, { lang: e.target.value === "en" ? "en" : "ko" }));
    if (ok) S.flash = null;
    render(false);
    root.querySelector("#lang")?.focus();
    if (ok) say(t("langLabel"));
  } else if (a === "loc") {
    if (session.status().canEdit) S.draft.location = e.target.value;
  } else if (a === "jobBoard") {
    S.jobBoard = e.target.value || "all";
    S.jobPage = 0;
    render(false);
    root.querySelector('[data-action="jobBoard"]')?.focus();
  } else if (a === "savedJobs") {
    S.onlySaved = !!e.target.checked;
    S.jobPage = 0;
    render(false);
    root.querySelector('[data-action="savedJobs"]')?.focus();
  } else if (a === "topic") {
    S.help = e.target.value;
    S.copyMsg = null;
    render(false);
    root.querySelector("#topic")?.focus();
  }
});
root.addEventListener("submit", (e) => {
  if (!e.target.classList?.contains("jobs-filters")) return;
  e.preventDefault();
  ACT.searchJobs();
});
root.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.id === "job-query") {
    e.preventDefault();
    ACT.searchJobs();
    return;
  }
  const el = e.target.closest?.(".goal-choice");
  if (!el || !["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)) return;
  e.preventDefault();
  const all = [...root.querySelectorAll(".goal-choice")], i = all.indexOf(el);
  const n = all[(i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
  ACT.pickGoal(n);
});
S.draft = newDraft();
render(false);
void session.init().catch((err) => {
  const m = getAccountErrorMessage(err, state.lang);
  S.flash = esc3(m);
  render(false);
  say(m);
});
void jobsFeed.load();
