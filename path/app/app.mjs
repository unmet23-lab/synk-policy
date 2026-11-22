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
    homeTitle: { ko: "과정을 비교하고 지원 자료를 준비해요", en: "Compare programs and prepare your application" },
    note: { ko: "학교와 과정을 비교하고, 지원 서류와 물어볼 질문을 정리하는 화면으로 시작해요.", en: "Start by comparing schools and programs, then organize documents and questions." },
    steps: [
      { ko: "학교 · 과정 예시를 둘러보고 비교해요.", en: "Browse and compare school and program examples." },
      { ko: "지원 이유와 학업 경험을 내 말로 적어 두어요.", en: "Write your reasons and study background in your own words." },
      { ko: "내가 확인하고, 실제 지원은 학교의 공식 창구로 해요.", en: "Review it yourself; apply through the school’s official channel." }
    ],
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
    note: { ko: "학교생활과 졸업 이후를 함께 준비하는 화면으로 시작해요.", en: "Start with campus life and what comes after graduation." },
    steps: [
      { ko: "학교생활 · 졸업 준비 예시를 둘러봐요.", en: "Browse campus life and graduation examples." },
      { ko: "남은 학기 계획과 물어볼 질문을 적어 두어요.", en: "Write your remaining-term plan and questions." },
      { ko: "내가 확인하고, 실제 요건은 학교에 직접 확인해요.", en: "Review it yourself and confirm requirements with your school." }
    ],
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
    note: { ko: "공고와 연습 예시를 비교하고, 지원 자료를 내 말로 준비하는 화면으로 시작해요.", en: "Start by comparing postings and practice examples, then prepare your materials in your own words." },
    steps: [
      { ko: "공고와 연습 예시를 구분해 둘러보고 비교해요.", en: "Browse real postings and practice examples, clearly labeled." },
      { ko: "내 말로 답변 초안을 적어 두어요.", en: "Draft your answers in your own words." },
      { ko: "내가 확인하고, 실제 제출은 공식 경로로 해요.", en: "Review it yourself; submit only through official channels." }
    ],
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
  // PATH 앱만: 같은 로그인 세션으로 여는 둘째 자원(유학 준비 문서 path-study)과 그 검사기. 요청마다 request(op, values, { resource })로 고른다.
  extraResources = null,
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
  const EXTRA = extraResources === null ? {} : extraResources;
  if (extraResources !== null && (!pathApp || typeof extraResources !== "object" || Array.isArray(extraResources) || Object.keys(EXTRA).join(",") !== "path-study" || typeof EXTRA["path-study"] !== "function")) throw new TypeError("PATH 둘째 자원은 path-study 하나만 받아요.");
  const validatorFor = (name) => name === resource ? validateState : Object.hasOwn(EXTRA, name) ? EXTRA[name] : null;
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
    const promise3 = (async () => {
      const next = await core.tokenRequest(config, { grant_type: "refresh_token", client_id: config.clients[clientKey].clientId, refresh_token: old.refresh_token }, fetcher);
      guard(expected);
      saveSession({ ...next, refresh_token: next.refresh_token || old.refresh_token });
      return session2.access_token;
    })();
    refreshing = promise3;
    try {
      return await promise3;
    } finally {
      if (refreshing === promise3) refreshing = null;
    }
  }
  function requestBody(operation, values = {}, validate = validateState) {
    if (!OPERATIONS2.has(operation) || !values || typeof values !== "object" || Array.isArray(values)) throw fault("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    const careLibrarySave = clientKey === "care" && endpoint === "synk-care" && resource === null && operation === operations.save;
    const allowed = operation === operations.load ? [] : operation === operations.save ? ["expected_revision", "state", ...careLibrarySave ? ["messageLibraryVersion", "checkinPreferenceVersion"] : []] : ["expected_revision"];
    if (Object.keys(values).some((key) => !allowed.includes(key))) throw fault("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    if (Object.hasOwn(values, "messageLibraryVersion") && (!careLibrarySave || values.messageLibraryVersion !== 1)) throw fault("INVALID_REQUEST", "문구 보관함 자료 형식이 맞지 않아요.");
    if (Object.hasOwn(values, "checkinPreferenceVersion") && (!careLibrarySave || values.checkinPreferenceVersion !== 1)) throw fault("INVALID_REQUEST", "안부 설정 자료 형식이 맞지 않아요.");
    if (operation === operations.load) return void 0;
    if (!Number.isSafeInteger(values.expected_revision) || values.expected_revision < 0) throw fault("INVALID_REQUEST", "저장할 자료의 버전을 확인해 주세요.");
    return { action: operation === operations.save ? "save" : "delete", expected_revision: values.expected_revision, ...operation === operations.save ? { state: validate(values.state) } : {}, ...Object.hasOwn(values, "messageLibraryVersion") ? { messageLibraryVersion: 1 } : {}, ...Object.hasOwn(values, "checkinPreferenceVersion") ? { checkinPreferenceVersion: 1 } : {} };
  }
  function validateResponse(data, ownerId, res = resource, validate = validateState) {
    if (data?.ok !== true) throw fault(data?.error?.code || "ACCOUNT_UNAVAILABLE", data?.error?.message || "계정 자료를 확인하지 못했어요.", { retryable: data?.error?.retryable === true, status: data?.error?.status, revision: data?.revision, ...missingAsset(data?.error) });
    if (data.scope !== scope || res && data.resource !== res || typeof data.accountId !== "string" || !data.accountId || data.accountId.length > 100 || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Object.hasOwn(data, "state")) throw fault("INVALID_RESPONSE", "계정 자료의 형식을 확인하지 못했어요. 현재 자료를 유지해 주세요.");
    if (ownerId && data.accountId !== ownerId) throw fault("ACCOUNT_CHANGED", "다른 계정의 응답이 도착해 자료를 적용하지 않았어요.");
    return { ok: true, scope, ...res ? { resource: res } : {}, accountId: data.accountId, revision: data.revision, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null, state: data.state === null ? null : validate(data.state) };
  }
  async function dispatch(operation, values, expected, ownerId, res = resource) {
    const validate = validatorFor(res);
    if (!validate) throw fault("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    const body = requestBody(operation, values, validate);
    guard(expected);
    let data;
    if (native && res !== resource) throw fault("INVALID_REQUEST", "이 자료는 웹에서만 열 수 있어요.");
    if (native) {
      const params = operation === operations.load ? {} : operation === operations.save ? { expected_revision: body.expected_revision, state: body.state, ...Object.hasOwn(body, "messageLibraryVersion") ? { messageLibraryVersion: body.messageLibraryVersion } : {}, ...Object.hasOwn(body, "checkinPreferenceVersion") ? { checkinPreferenceVersion: body.checkinPreferenceVersion } : {} } : { expected_revision: body.expected_revision };
      data = await bridgeRequest.call(bridge, operation, params);
      guard(expected);
    } else {
      if (!session2?.access_token) throw fault("AUTH_REQUIRED", "SYNK ID로 로그인해 주세요.");
      let token = session2.access_token;
      if (session2.expires_at <= now() + 3e4) token = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/${endpoint}${res && body === void 0 ? `?resource=${encodeURIComponent(res)}` : ""}`;
      let result = await send(url, token, body === void 0 || !res ? body : { ...body, resource: res });
      guard(expected);
      if (result.response.status === 401 && session2?.refresh_token) {
        token = session2.access_token !== token ? session2.access_token : await refresh(expected);
        guard(expected);
        result = await send(url, token, body === void 0 || !res ? body : { ...body, resource: res });
        guard(expected);
      }
      if (!result.response.ok || result.data?.ok !== true) {
        const code = result.data?.error?.code || (result.response.status === 401 ? "AUTH_REQUIRED" : "ACCOUNT_UNAVAILABLE");
        throw fault(code, code === "REVISION_CONFLICT" ? "다른 기기에서 자료가 바뀌었어요. 계정 자료를 다시 불러와 주세요." : "계정 요청을 마치지 못했어요. 지금 화면의 자료는 그대로예요.", { status: result.response.status, revision: result.data?.revision, retryable: result.response.status === 429 || result.response.status >= 500, ...missingAsset(result.data?.error) });
      }
      data = result.data;
    }
    guard(expected);
    return validateResponse(data, ownerId, res, validate);
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
    const promise3 = (async () => {
      try {
        const data = await dispatch(operations.load, {}, expected, identity);
        guard(expected);
        return emit({ configured: true, signedIn: true, status: "signed-in", accountId: data.accountId, account: { synk_user_id: data.accountId, display_name: source.account.display_name || "" }, error: null });
      } catch (error) {
        if (expected === epoch && !disposed) return clearSession(error, "error");
        return status();
      }
    })();
    nativeLoad = promise3;
    try {
      return await promise3;
    } finally {
      if (nativeLoad === promise3) nativeLoad = null;
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
  async function request(operation, values = {}, { resource: res = resource } = {}) {
    if (!snapshot.signedIn || !snapshot.accountId) throw fault("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 계정 자료를 확인해 주세요.");
    if (!validatorFor(res)) throw fault("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    const expected = epoch, ownerId = snapshot.accountId;
    try {
      return await dispatch(operation, values, expected, ownerId, res);
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
  const clone3 = (value) => validateState(value);
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
      const state2 = clone3(cached.state);
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
    if (isCurrent(context)) onState(clone3(context.state));
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
      state2 = reply.state === null ? emptyState() : clone3(reply.state);
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
      const sequence = context.sequence, sent = clone3(context.state), expected = context.baseRevision;
      const acknowledged = new Map([...context.recovery, ...context.owned]);
      emit(context, "saving");
      const remote = await request(context, operations.save, { expected_revision: expected, state: sent });
      if (remote.revision !== expected + 1 || remote.empty) throw failure("INVALID_CARE_RESPONSE");
      onSaved(clone3(remote.state));
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
    const normalized = clone3(state2);
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
      context.state = clone3(selected.state);
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
  const doc2 = validatePathDocument(raw);
  if (doc2.state.tasks.some((task) => task.sourceId === id)) fail("JOB_IN_USE");
  doc2.savedJobs = doc2.savedJobs.filter((job) => job.id !== id);
  return doc2;
}

// experiences/path-app/study-shape.mjs
var MAX_TOPIK = 6;
var EDUCATION_IDS = Object.freeze(["graduated", "expected", "none"]);
var MAX_FUNDS_WON = 2e8;
var MAX_COMPARE = 3;
var MAX_DATES = 30;
var MAX_CHANNELS_OFF = 10;
var MAX_DOCS = 60;
var ID_RE2 = /^[a-z0-9][a-z0-9-]{0,63}$/;
var DATE_ID_RE = /^[a-z0-9][a-z0-9-]{0,79}$/;
var STUDY_SCHEMA = "synk.path-study";
var STUDY_DOCUMENT_VERSION = 1;
var STUDY_RESOURCE = "path-study";
var CONSENT_VERSION = 1;
var MIN_CONSENT_VERSION = 1;
var CONSENT_LANGS = Object.freeze(["ko", "en", "mn"]);
var MAX_STUDY_DOCUMENT_BYTES = 64 * 1024;
var isObj2 = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var exact2 = (v, keys) => isObj2(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
var intIn = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
var isDay = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z")) && (/* @__PURE__ */ new Date(v + "T00:00:00Z")).toISOString().slice(0, 10) === v;
var isStamp = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?Z$/.test(v) && isDay(v.slice(0, 10)) && Number.isFinite(Date.parse(v));
var fail2 = (code = "INVALID_PATH_STUDY") => {
  throw Object.assign(new TypeError(code), { code });
};
var PROFILE_KEYS = ["topik", "gradePct", "fundsWon", "education", "compare", "dates", "channelsOff", "target", "docs"];
var uniqueBy = (list, max, valid, key = (x) => x) => Array.isArray(list) && list.length <= max && list.every(valid) && new Set(list.map(key)).size === list.length;
function emptyStudyDocument() {
  return {
    schema: STUDY_SCHEMA,
    version: STUDY_DOCUMENT_VERSION,
    consent: null,
    profile: { topik: null, gradePct: null, fundsWon: null, education: null, compare: [], dates: [], channelsOff: [], target: null, docs: [] }
  };
}
function validateStudyDocument(raw, { allowEmpty = false } = {}) {
  let bytes;
  try {
    bytes = new TextEncoder().encode(JSON.stringify(raw)).byteLength;
  } catch {
    fail2();
  }
  if (bytes > MAX_STUDY_DOCUMENT_BYTES) fail2("PATH_STUDY_TOO_LARGE");
  if (!exact2(raw, ["schema", "version", "consent", "profile"]) || raw.schema !== STUDY_SCHEMA || raw.version !== STUDY_DOCUMENT_VERSION) fail2();
  const c = raw.consent, p = raw.profile;
  if (c === null) {
    if (!allowEmpty || JSON.stringify(p) !== JSON.stringify(emptyStudyDocument().profile)) fail2();
    return emptyStudyDocument();
  }
  if (!exact2(c, ["v", "at", "minor", "guardian", "lang", "base"]) || !intIn(c.v, MIN_CONSENT_VERSION, CONSENT_VERSION) || !isStamp(c.at) || typeof c.minor !== "boolean" || c.guardian !== c.minor || !CONSENT_LANGS.includes(c.lang) || !intIn(c.base, 0, 2147483647)) fail2();
  if (!exact2(p, PROFILE_KEYS)) fail2();
  const nullOr = (v, ok) => v === null || ok(v);
  if (!nullOr(p.topik, (v) => intIn(v, 0, MAX_TOPIK)) || !nullOr(p.gradePct, (v) => intIn(v, 0, 100)) || !nullOr(p.fundsWon, (v) => intIn(v, 0, MAX_FUNDS_WON)) || !nullOr(p.education, (v) => EDUCATION_IDS.includes(v)) || !nullOr(p.target, (v) => typeof v === "string" && ID_RE2.test(v))) fail2();
  const isId = (v) => typeof v === "string" && ID_RE2.test(v);
  if (!uniqueBy(p.compare, MAX_COMPARE, isId) || !uniqueBy(p.channelsOff, MAX_CHANNELS_OFF, isId)) fail2();
  const okDate = (d) => exact2(d, ["id", "start", "end"]) && typeof d.id === "string" && DATE_ID_RE.test(d.id) && isDay(d.start) && isDay(d.end) && d.end >= d.start;
  if (!uniqueBy(p.dates, MAX_DATES, okDate, (d) => d.id)) fail2();
  const okDoc = (d) => exact2(d, ["id", "doneAt"]) && isId(d.id) && isStamp(d.doneAt);
  if (!uniqueBy(p.docs, MAX_DOCS, okDoc, (d) => d.id)) fail2();
  return {
    schema: STUDY_SCHEMA,
    version: STUDY_DOCUMENT_VERSION,
    consent: { v: c.v, at: c.at, minor: c.minor, guardian: c.guardian, lang: c.lang, base: c.base },
    profile: {
      topik: p.topik,
      gradePct: p.gradePct,
      fundsWon: p.fundsWon,
      education: p.education,
      compare: [...p.compare],
      dates: p.dates.map((d) => ({ id: d.id, start: d.start, end: d.end })),
      channelsOff: [...p.channelsOff],
      target: p.target,
      docs: p.docs.map((d) => ({ id: d.id, doneAt: d.doneAt }))
    }
  };
}
function createStudyDocument(profile2, consent) {
  const p = isObj2(profile2) ? profile2 : {};
  return validateStudyDocument({
    schema: STUDY_SCHEMA,
    version: STUDY_DOCUMENT_VERSION,
    consent: { v: consent?.v, at: consent?.at, minor: consent?.minor, guardian: consent?.guardian, lang: consent?.lang, base: consent?.base },
    profile: Object.fromEntries(PROFILE_KEYS.map((k) => [k, p[k]]))
  });
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
  const doc2 = validatePathDocument(raw);
  return clone(doc2);
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
  function writeGuest(doc2) {
    if (guest.blocked) return false;
    try {
      if (!storage) throw fault2("LOCAL_STORAGE_UNAVAILABLE", "storage unavailable");
      const raw = JSON.stringify(doc2);
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
      const doc2 = parsed === void 0 ? null : tryValidate(parsed);
      if (doc2) {
        guest.doc = doc2;
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
        const doc2 = state2 == null ? null : tryValidate(state2);
        if (!doc2) return;
        if (!accountDoc || !same(doc2, accountDoc)) bumpDoc();
        accountDoc = doc2;
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
        // 같은 로그인 세션으로 여는 유학 준비 문서. 앱 검사기는 동기화 엔진의 빈 상태(동의 없음)도 받는다.
        extraResources: { [STUDY_RESOURCE]: (raw) => raw == null ? null : validateStudyDocument(raw, { allowEmpty: true }) },
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
      const doc2 = parsed === void 0 ? null : tryValidate(parsed);
      if (doc2) {
        guest.doc = doc2;
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
    const doc2 = validateDoc(nextDoc);
    if (same(doc2, currentDoc())) return false;
    if (mode === "guest") {
      guest.doc = doc2;
      writeGuest(doc2);
      emitAll();
      if (guest.writeFailed) throw fault2("LOCAL_STORAGE_UNAVAILABLE", "변경은 화면에만 남아 있고 이 기기에 저장되지 않았어요.", { retryable: true });
      return true;
    }
    const changed = sync.change(doc2);
    if (changed) {
      bumpDoc();
      accountDoc = doc2;
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
      const doc2 = validateDoc(guest.doc);
      const changed = sync.change(doc2);
      if (!changed || epoch !== openEpoch) return false;
      bumpDoc();
      accountDoc = doc2;
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
  async function studyRequest(operation, values = {}) {
    if (disposed) throw fault2("PATH_SESSION_DISPOSED", "disposed");
    const acc = account || await startAccount();
    if (!acc) throw fault2("ACCOUNT_UNAVAILABLE", "계정 연결을 확인하지 못했어요.");
    return acc.request(operation, values, { resource: STUDY_RESOURCE });
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
    studyRequest,
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
var ID_RE3 = /^greenhouse-(moloco|coupang)-(\d{1,20})$/;
var fail3 = (code) => Object.assign(new Error(code), { code });
async function boundedFetch(fetcher, url, init, signal) {
  const ctl = new AbortController();
  const onAbort = () => ctl.abort();
  if (signal) signal.aborted ? ctl.abort() : signal.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ctl.abort(fail3("timeout")), TIMEOUT_MS);
  try {
    const res = await fetcher(url, { ...init, credentials: "omit", redirect: "error", signal: ctl.signal });
    if (!res || !res.ok) throw fail3("http");
    const len = Number(res.headers?.get?.("content-length"));
    if (Number.isFinite(len) && len > MAX_BYTES) throw fail3("too_large");
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
          throw fail3("too_large");
        }
        text2 += dec.decode(value, { stream: true });
      }
      text2 += dec.decode();
    } else {
      text2 = await res.text();
      if (new TextEncoder().encode(text2).byteLength > MAX_BYTES) throw fail3("too_large");
    }
    try {
      return JSON.parse(text2);
    } catch {
      throw fail3("invalid");
    }
  } catch (e) {
    if (signal?.aborted) throw fail3("aborted");
    if (ctl.signal.aborted) throw fail3("timeout");
    throw e?.code ? e : fail3("network");
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
  if (!j || typeof j !== "object") throw fail3("invalid");
  const m = ID_RE3.exec(j.id);
  if (!m || j.provider !== "greenhouse" || j.board !== m[1] || j.jobId !== m[2]) throw fail3("invalid");
  if (![j.company, j.title, j.location, j.url].every((s) => str(s)) || !optStr(j.employmentType, 200) || !isDate(j.observedAt)) throw fail3("invalid");
  if (j.updatedAt !== void 0 && !optDate(j.updatedAt)) throw fail3("invalid");
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
    if (e.length > 200) throw fail3("invalid");
    return ERROR_CODE_RE.test(e) ? e : "unknown";
  }
  if (typeof e === "object" && !Array.isArray(e)) {
    const hs = e.httpStatus;
    if (hs !== void 0 && hs !== null && !(Number.isInteger(hs) && hs >= 100 && hs <= 599)) throw fail3("invalid");
    return typeof e.code === "string" && ERROR_CODE_RE.test(e.code) ? e.code : "unknown";
  }
  throw fail3("invalid");
}
function normalizeSource(s) {
  if (!s || typeof s !== "object" || s.provider !== "greenhouse" || !BOARDS2.includes(s.board)) throw fail3("invalid");
  if (!str(s.company, 200) || !SOURCE_STATUS.includes(s.status) || typeof s.complete !== "boolean") throw fail3("invalid");
  if (!optDate(s.observedAt) || !optDate(s.attemptedAt) || !optDate(s.retryAfter)) throw fail3("invalid");
  const error = sourceError(s.error);
  const ev = s.evidence;
  if (!ev || !str(ev.careerUrl) || !str(ev.documentationUrl) || !isDate(ev.verifiedAt)) throw fail3("invalid");
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
  if (!p || p.ok !== true || p.scope !== "synk-path-jobs" || !Array.isArray(p.jobs) || !Array.isArray(p.sources)) throw fail3("invalid");
  if (p.availability !== void 0 && p.availability !== "disabled") throw fail3("invalid");
  if (p.availability === "disabled") {
    if (p.jobs.length || p.sources.length) throw fail3("invalid");
    return { disabled: true, jobs: [], sources: [] };
  }
  if (p.jobs.length > 3e3 || p.sources.length > 2) throw fail3("invalid");
  const sources = p.sources.map(normalizeSource);
  if (new Set(sources.map((s) => s.board)).size !== sources.length) throw fail3("invalid");
  const jobs = p.jobs.map(normalizeJob);
  if (new Set(jobs.map((j) => j.id)).size !== jobs.length) throw fail3("invalid");
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
    h: "한국 근무 공고",
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

// experiences/path-app/study-data.mjs
var RULE_STATUS = Object.freeze(["in-force", "announced"]);
var LEVELS = Object.freeze(["language", "undergraduate"]);
var REGIONS = Object.freeze(["local", "metro"]);
var VISAS = Object.freeze(["D-2", "D-4"]);
var IMAGE_IDS = Object.freeze(["univ-a", "univ-b", "univ-c"]);
var TONES = Object.freeze(["lapis", "meadow", "ink", "coral"]);
var MOJ_2026 = Object.freeze({
  title: Object.freeze({ ko: "법무부 2026-10-07 보도자료", en: "Ministry of Justice press release, 2026-10-07" }),
  url: "https://www.moj.go.kr/bbs/moj/182/611170/artclView.do"
});
var KVAC_D2 = Object.freeze({
  title: Object.freeze({ ko: "주몽골대사관 비자신청센터 유학(D-2) 안내", en: "Korea Visa Application Center in Mongolia, Study (D-2) guide" }),
  url: "https://www.visaforkorea.mn/ko/study-visa-d-2-1d-2-4"
});
var KVAC_D4 = Object.freeze({
  title: Object.freeze({ ko: "주몽골대사관 비자신청센터 어학연수(D-4-1) 안내", en: "Korea Visa Application Center in Mongolia, Language trainee (D-4-1) guide" }),
  url: "https://www.visaforkorea.mn/ko/korean-language-trainee-d-4-1"
});
var RULES = Object.freeze([
  { id: "finance-d2-local", kind: "finance", visa: "D-2", region: "local", won: 16e6, status: "in-force", basis: "2023-07-03", inCurrentGuide: true, source: MOJ_2026, checkedAt: "2026-11-21" },
  { id: "finance-d2-metro", kind: "finance", visa: "D-2", region: "metro", won: 2e7, status: "in-force", basis: "2023-07-03", inCurrentGuide: true, source: MOJ_2026, checkedAt: "2026-11-21" },
  { id: "finance-d4-local", kind: "finance", visa: "D-4", region: "local", won: 8e6, status: "in-force", basis: "2023-07-03", inCurrentGuide: true, source: KVAC_D4, checkedAt: "2026-11-21" },
  { id: "finance-d4-metro", kind: "finance", visa: "D-4", region: "metro", won: 1e7, status: "in-force", basis: "2023-07-03", inCurrentGuide: true, source: KVAC_D4, checkedAt: "2026-11-21" },
  // 몽골에서 신청할 때 잔고 증명서를 내는 방법. 대조에는 쓰지 않고 재정 칸 아래 안내로 보인다.
  { id: "finance-proof-mn-d2", kind: "finance-proof", visa: "D-2", issuedWithinDays: 14, heldDays: 30, status: "in-force", basis: "2026-11-21", source: KVAC_D2, checkedAt: "2026-11-21" },
  { id: "finance-proof-mn-d4", kind: "finance-proof", visa: "D-4", issuedWithinDays: 14, heldDays: 30, status: "in-force", basis: "2026-11-21", source: KVAC_D4, checkedAt: "2026-11-21" },
  // 계획 발표: 대조에는 쓰지 않고 안내 글로만 보인다. 시행일이 정해지면 in-force 규칙으로 바꾼다.
  { id: "finance-topik4-waiver", kind: "finance-waiver", topik: 4, status: "announced", basis: "2026-10-07", source: MOJ_2026, checkedAt: "2026-11-21" }
].map(Object.freeze));
var L2 = (ko, en) => Object.freeze({ ko, en });
var PROGRAMS = Object.freeze([
  {
    id: "example-a-ug",
    example: true,
    name: L2("예시대학 A", "Example University A"),
    place: L2("전북 전주", "Jeonju, Jeonbuk"),
    region: "local",
    level: "undergraduate",
    visa: "D-2",
    majors: L2("경영 · 컴퓨터 · 간호", "Business · Computing · Nursing"),
    image: "univ-a",
    requires: { education: "highschool", gradePct: 70, topik: 3 },
    costs: { tuition: 64e5, dorm: 18e5, living: 6e6 },
    scholarship: [{ topik: 3, tuitionRate: 0.3 }, { topik: 4, tuitionRate: 0.5 }],
    applyOpens: "2027-01-21",
    certified: false,
    source: null,
    checkedAt: null
  },
  {
    id: "example-b-lang",
    example: true,
    name: L2("예시대학 B 한국어교육원", "Example University B Korean Language Institute"),
    place: L2("전북 익산", "Iksan, Jeonbuk"),
    region: "local",
    level: "language",
    visa: "D-4",
    majors: L2("한국어 과정 1년", "One-year Korean language program"),
    image: "univ-b",
    requires: { education: "highschool", gradePct: 60, topik: 0 },
    costs: { tuition: 52e5, dorm: 16e5, living: 54e5 },
    scholarship: [],
    applyOpens: "2026-12-31",
    certified: false,
    source: null,
    checkedAt: null
  },
  {
    id: "example-c-ug",
    example: true,
    name: L2("예시대학 C", "Example University C"),
    place: L2("충남 천안", "Cheonan, Chungnam"),
    region: "local",
    level: "undergraduate",
    visa: "D-2",
    majors: L2("기계 · 호텔 · 디자인", "Mechanical · Hospitality · Design"),
    image: "univ-c",
    requires: { education: "highschool", gradePct: 75, topik: 4 },
    costs: { tuition: 68e5, dorm: 2e6, living: 66e5 },
    scholarship: [{ topik: 4, tuitionRate: 0.4 }, { topik: 5, tuitionRate: 0.6 }],
    applyOpens: "2027-02-04",
    certified: false,
    source: null,
    checkedAt: null
  },
  // ── 대학이 공개한 모집 요강에서 옮긴 실제 과정(2026-11-21 확인). 협약 대학이 아니다(partner: false). ──
  // 금액 · 일정 · 조건은 요강 원문에서 직접 읽은 값이다. 원문에 없는 값(생활비 등)은 null로 둔다.
  {
    id: "jbnu-ug",
    example: false,
    partner: false,
    name: L2("전북대학교", "Jeonbuk National University"),
    place: L2("전북 전주", "Jeonju, Jeonbuk"),
    region: "local",
    level: "undergraduate",
    visa: "D-2",
    majors: L2("신입학 · 외국인 전형", "Freshman · international admission"),
    term: L2("2027년 3월 입학", "March 2027 intake"),
    image: null,
    tone: "lapis",
    requires: { education: "highschool", gradePct: 0, topik: 2 },
    requiresNote: L2(
      "TOPIK 2급으로 입학하면 입학 직후 전북대 한국어연수과정 2개 학기를 꼭 들어야 해요. 국내 한국어학당 4급반 수료나 전북대 자체시험 2급으로도 지원할 수 있어요. 고교 성적의 최저 기준은 없고 서류와 면접 총점 60점 이상이 합격 기준이에요. 검정고시는 인정하지 않아요. 졸업하려면 TOPIK 4급이 필요해요.",
      "If you enter with TOPIK level 2, you must complete two terms of the university’s Korean language program right after admission. Completing level 4 at a Korean language institute in Korea, or level 2 on the university’s own test, also qualifies. There is no minimum school grade; you need 60 points or more across document review and interview. School-leaving equivalency exams are not accepted. TOPIK level 4 is required to graduate."
    ),
    costs: { tuition: 4032e3, dorm: 2809260, living: null },
    dormLabel: L2("두 학기 · 3인실 · 평일 세 끼 포함", "Two semesters · triple room · weekday meals included"),
    costsNote: L2(
      "등록금은 인문 · 사회과학 · 경상대학 기준이에요(한 학기 2,016,000원). 공과대학은 한 학기 2,704,000원, 예술대학은 2,779,000원이에요. 기숙사는 참빛관 3인실, 평일 세 끼 포함 한 학기 1,404,630원 기준이고 방학은 들어 있지 않아요. 남학생은 식사 없는 대동관(한 학기 580,000원)도 신청할 수 있어요. 모두 2026학년도 2학기 금액이라 2027년에는 달라질 수 있어요.",
      "Tuition is for humanities, social sciences and commerce (₩2,016,000 per semester). Engineering is ₩2,704,000 and arts ₩2,779,000 per semester. The dormitory figure is Chambit Hall, triple room with three weekday meals, ₩1,404,630 per semester, excluding vacations. Male students can also apply for Daedong Hall without meals (₩580,000 per semester). All amounts are for the second semester of 2026 and may change in 2027."
    ),
    scholarship: [{ topik: 5, won: 820500 }, { topik: 6, won: 2016e3 }],
    scholarshipNote: L2(
      "신입생 장학금은 첫 학기에만 줘요. TOPIK 5급은 수업료2의 50%(인문 계열 820,500원), 6급은 첫 학기 등록금 전액이에요. 그 밖의 급수는 예산 범위 안에서 수업료1(375,000원)을 면제받을 수 있어요. 3월 입학은 2026-12-23까지 성적표를 내야 해요.",
      "Freshman scholarships apply to the first semester only. TOPIK level 5 waives 50% of Tuition 2 (₩820,500 for humanities); level 6 waives the full first-semester tuition. Other levels may have Tuition 1 (₩375,000) waived within the budget. For March entry, the score report is due by 2026-12-23."
    ),
    applyOpens: null,
    applyRounds: [["2026-09-21", "2026-10-02"], ["2026-11-09", "2026-11-20"]],
    applyNote: L2("2027년 3월 입학 접수는 2026-11-20에 끝났어요. 9월 입학 요강은 아직 나오지 않았어요.", "Applications for March 2027 closed on 2026-11-20. The guide for September entry has not been published yet."),
    certified: false,
    checkedAt: "2026-11-21",
    source: { title: L2("전북대학교 2027학년도 전기 학부 외국인특별전형 모집요강", "Jeonbuk National University, Spring 2027 undergraduate international admissions guide"), url: "https://ioffice.jbnu.ac.kr/bbs/ioffice/5310/401304/artclView.do" }
  },
  {
    id: "jbnu-lang",
    example: false,
    partner: false,
    name: L2("전북대학교 한국어학당", "Jeonbuk National University Korean Language Institute"),
    place: L2("전북 전주", "Jeonju, Jeonbuk"),
    region: "local",
    level: "language",
    visa: "D-4",
    majors: L2("한 학기 10주", "10 weeks per term"),
    term: L2("2027년 봄학기", "Spring term 2027"),
    image: null,
    tone: "lapis",
    requires: { education: "highschool", gradePct: 0, topik: 0 },
    requiresNote: L2(
      "한국어를 전혀 몰라도 지원할 수 있고 배치시험으로 반을 정해요. 고등학교 졸업(예정) 이상이면 돼요. 2개 학기 이상 등록하면 어학연수(D-4) 비자를 신청할 수 있어요.",
      "You can apply with no Korean at all; a placement test decides your class. A high school diploma (or expected graduation) is enough. Registering for two or more terms lets you apply for the language training (D-4) visa."
    ),
    costs: { tuition: 56e5, dorm: null, living: null },
    costsNote: L2(
      "수업료는 한 학기 1,400,000원이고 한 해 네 학기예요(2027년 봄학기부터 오른 금액). 전형료는 70,000원이에요. 기숙사비는 2인실, 평일 세 끼 포함 「1학기 약 100만 원」이라고만 안내해 한 해 금액을 알 수 없어서 합계에 넣지 않았어요.",
      "Tuition is ₩1,400,000 per term, four terms a year (raised from spring 2027). The application fee is ₩70,000. The institute only says the dormitory is “about ₩1,000,000 per term” for a double room with three weekday meals, so the yearly cost is unknown and not included in the total."
    ),
    scholarship: [],
    applyOpens: null,
    applyRounds: [["2026-11-30", "2026-12-11"], ["2026-12-12", "2026-12-25"]],
    applyNote: L2("봄학기 접수는 2026-11-30부터예요. 1차 마감은 12-11, 2차 마감은 12-25예요. 수업은 2027-03-02에 시작해요. 일정은 바뀔 수 있어요.", "Spring term applications open on 2026-11-30. The first deadline is 12-11 and the second is 12-25. Classes start on 2027-03-02. Dates may change."),
    certified: false,
    checkedAt: "2026-11-21",
    source: { title: L2("전북대학교 한국어학당 한국어 연수과정 안내", "Jeonbuk National University Korean Language Institute program guide"), url: "https://wz3.jbnu.ac.kr/lec_korean/10877/subview.do" }
  },
  {
    id: "wku-ug",
    example: false,
    partner: false,
    name: L2("원광대학교", "Wonkwang University"),
    place: L2("전북 익산", "Iksan, Jeonbuk"),
    region: "local",
    level: "undergraduate",
    visa: "D-2",
    majors: L2("신입학 · 외국인 전형", "Freshman · international admission"),
    term: L2("2027년 3월 입학", "March 2027 intake"),
    image: null,
    tone: "meadow",
    requires: { education: "highschool", gradePct: 0, topik: 0 },
    requiresNote: L2(
      "입학할 때 TOPIK은 필수가 아니에요(성적이 있는 사람만 내요). 졸업하려면 TOPIK 4급(예체능 3급) 이상이나 그에 맞는 조건 하나를 채워야 해요. 고교 성적의 최저 기준은 없고 서류와 면접 총점 60점 이상이 합격 기준이에요.",
      "TOPIK is not required for admission (submit a score only if you have one). To graduate you need TOPIK level 4 (level 3 for arts and sports) or one equivalent condition. There is no minimum school grade; you need 60 points or more across document review and interview."
    ),
    costs: { tuition: 6379e3, dorm: 1618e3, living: null },
    dormLabel: L2("두 학기 · 2인실 · 식비 별도", "Two semesters · double room · meals extra"),
    costsNote: L2(
      "등록금은 인문 · 사회 계열 기준이에요(첫 학기 3,248,000원, 다음 학기 3,131,000원). 공학 · 예능 계열은 첫 학기 4,375,000원이에요. 기숙사는 학생생활관 2인실 관리비 한 학기 809,000원 기준이고 식비는 따로예요(하루 세 끼 한 학기 1,075,000원). 모두 2026학년도 금액이라 2027년에는 오를 수 있어요.",
      "Tuition is for humanities and social sciences (₩3,248,000 for the first semester, ₩3,131,000 after). Engineering and arts are ₩4,375,000 for the first semester. The dormitory figure is the residence hall double room fee, ₩809,000 per semester; meals are extra (₩1,075,000 per semester for three meals a day). All amounts are for 2026 and may rise in 2027."
    ),
    scholarship: [{ topik: 3, won: 1624e3 }, { topik: 4, won: 1948800 }, { topik: 5, won: 3248e3 }],
    scholarshipNote: L2(
      "4년제 신입학 기준이에요. TOPIK 3급 이상은 등록금의 50%, 4급 이상은 60%, 5급 이상은 100%를 깎아 줘요. 요강에 기간이 적혀 있지 않아 첫 학기 등록금으로만 계산했어요. 재학생 장학금은 직전 학기 성적과 TOPIK 기준이 따로 있어요.",
      "For four-year freshman admission. TOPIK level 3 or higher waives 50% of tuition, level 4 or higher 60%, level 5 or higher 100%. The guide does not state the period, so this is calculated on the first semester only. Scholarships for continuing students have separate grade and TOPIK criteria."
    ),
    applyOpens: null,
    applyRounds: [["2026-11-23", "2026-11-27"], ["2026-12-28", "2026-12-31"]],
    applyNote: L2(
      "1차 접수는 2026-11-23부터 11-27까지, 2차는 12-28부터 12-31까지예요. 방문이나 우편으로 접수해요. 요강 파일 이름에 「(안)」이 붙어 있어 일정이 바뀔 수 있어요.",
      "Round 1 runs 2026-11-23 to 11-27 and round 2 runs 12-28 to 12-31. Apply in person or by post. The guide file is marked as a draft, so dates may change."
    ),
    certified: false,
    checkedAt: "2026-11-21",
    source: { title: L2("원광대학교 2027학년도 1학기(3월) 외국인 학부 신(편)입학 모집요강", "Wonkwang University, Spring 2027 undergraduate international admissions guide"), url: "https://ipsi.wku.ac.kr/detail.do?menuurl=qBExJT7yxTZkr1QAFxkj1g%3D%3D&board_seq=9786" }
  },
  {
    id: "wku-lang",
    example: false,
    partner: false,
    name: L2("원광대학교 한국문화교육센터", "Wonkwang University Korean Culture Education Center"),
    place: L2("전북 익산", "Iksan, Jeonbuk"),
    region: "local",
    level: "language",
    visa: "D-4",
    majors: L2("한 학기 10주", "10 weeks per term"),
    term: L2("2027년 봄학기", "Spring term 2027"),
    image: null,
    tone: "meadow",
    requires: { education: "highschool", gradePct: 0, topik: 0 },
    requiresNote: L2(
      "고등학교 졸업 이상이면 지원할 수 있고 한국어 조건은 없어요. 어학연수(D-4-1) 비자를 받으려면 두 학기 이상 등록해야 해요.",
      "A high school diploma is enough and there is no Korean requirement. To get the language training (D-4-1) visa you must register for at least two terms."
    ),
    costs: { tuition: 44e5, dorm: null, living: null },
    costsNote: L2(
      "수강료는 한 학기 1,100,000원이고 한 해 네 학기예요. 처음 한 번 전형료 · 교재비 100,000원과 보험료 100,000원을 더 내요(요강의 한 해 합계 4,600,000원). 기숙사 2인실 관리비는 대학 정규 학기(방학 제외) 한 학기에 809,000원이고 식비는 따로예요. 연수는 방학에도 이어져 한 해 기숙사비를 알 수 없어서 합계에 넣지 않았어요.",
      "Tuition is ₩1,100,000 per term, four terms a year. You also pay a one-time ₩100,000 for application and textbooks and ₩100,000 for insurance (the guide’s yearly total is ₩4,600,000). The double-room dormitory fee is ₩809,000 per regular university semester (excluding vacations), with meals extra. Language terms continue through vacations, so the yearly dormitory cost is unknown and not included in the total."
    ),
    scholarship: [],
    scholarshipNote: L2(
      "연수 과정 자체의 장학금은 요강에 없어요. 두 학기 이상 수료하고 원광대 학부에 들어가면 첫 학기 등록금을 100% 깎아 줘요.",
      "The guide lists no scholarship for the language program itself. If you complete two or more terms and enter Wonkwang University as an undergraduate, the first semester’s tuition is fully waived."
    ),
    applyOpens: null,
    applyRounds: [["2026-12-01", "2026-12-24"]],
    applyNote: L2("봄학기 서류 접수는 2026-12-01부터 12-24까지예요. 수업은 2027-03-02에 시작해요. 일정은 바뀔 수 있어요.", "Documents for the spring term are accepted from 2026-12-01 to 12-24. Classes start on 2027-03-02. Dates may change."),
    certified: false,
    checkedAt: "2026-11-21",
    source: { title: L2("2026 원광대학교 한국문화교육센터 모집요강", "Wonkwang University Korean Culture Education Center admissions guide, 2026"), url: "https://ipsi.wku.ac.kr/detail.do?menuurl=8pYtphfeWm2Bb85hdKCTcQ%3D%3D&board_seq=7060" }
  },
  {
    id: "jj-ug",
    example: false,
    partner: false,
    name: L2("전주대학교", "Jeonju University"),
    place: L2("전북 전주", "Jeonju, Jeonbuk"),
    region: "local",
    level: "undergraduate",
    visa: "D-2",
    majors: L2("신입학 · 외국인 전형", "Freshman · international admission"),
    term: L2("2027년 3월 입학", "March 2027 intake"),
    image: null,
    tone: "ink",
    requires: { education: "highschool", gradePct: 0, topik: 2 },
    requiresNote: L2(
      "TOPIK 2급이 없어도 세종학당 초급2 이상, 사회통합프로그램 2단계, 전주대 한국어학당 3급 이상 수료, 대학 자체 시험(JJ-TOPIK) 합격 같은 조건 가운데 하나로 지원할 수 있어요. TOPIK 2급 이하로 입학하면 두 학기, 3급이면 한 학기 동안 한국어 집중교육을 꼭 들어야 해요. 고교 성적의 최저 기준은 없고 서류평가 60점 이상이 합격 기준이에요. 졸업하려면 TOPIK 4급이 필요해요.",
      "Without TOPIK level 2 you can still apply through one of several alternatives, such as King Sejong Institute Beginner 2 or higher, KIIP level 2, completing level 3 at the university’s Korean language institute, or passing the university’s own test (JJ-TOPIK). Entering with TOPIK level 2 or lower requires two semesters of intensive Korean; level 3 requires one. There is no minimum school grade; you need 60 points or more in document review. TOPIK level 4 is required to graduate."
    ),
    costs: { tuition: 733e4, dorm: 1738e3, living: null },
    dormLabel: L2("두 학기 · 2인실 · 식비 별도", "Two semesters · double room · meals extra"),
    costsNote: L2(
      "등록금은 인문 · 사회과학 · 경영 계열 기준이에요(한 학기 3,665,000원). 관광 · 의과학 · 체육 계열은 한 학기 4,302,000원, 공학 · 디자인 · 소프트웨어 계열은 4,788,000원이에요. 보험료와 기타경비는 들어 있지 않아요. 기숙사는 스타빌 2인실 한 학기(16주) 869,000원 기준이고 식비는 들어 있지 않아요. 모두 2026학년도 금액이라 달라질 수 있어요.",
      "Tuition is for humanities, social sciences and business (₩3,665,000 per semester). Tourism, medical sciences and sports are ₩4,302,000 and engineering, design and software ₩4,788,000 per semester. Insurance and other fees are not included. The dormitory figure is a Star Ville double room, ₩869,000 per 16-week semester, without meals. All amounts are for 2026 and may change."
    ),
    scholarship: [{ topik: 0, won: 1466e3 }, { topik: 3, won: 1832500 }, { topik: 4, won: 2565500 }, { topik: 5, won: 3665e3 }],
    scholarshipNote: L2(
      "입학하는 학기에만 주는 장학금이에요. 신입생은 모두 등록금의 40%를 깎아 주고, TOPIK 3급은 50%, 4급은 70%, 5급 이상은 100%예요. 다음 학기부터는 TOPIK 급수와 직전 학기 성적으로 25%에서 100%까지 정해요.",
      "These apply to the entry semester only. Every freshman gets 40% off tuition; TOPIK level 3 gets 50%, level 4 gets 70%, and level 5 or higher gets 100%. From the next semester, 25% to 100% is decided by TOPIK level and the previous semester’s grades."
    ),
    applyOpens: null,
    applyRounds: [["2026-10-12", "2026-10-21"], ["2026-12-01", "2026-12-11"], ["2027-01-04", "2027-01-13"]],
    applyNote: L2("1차 접수는 끝났어요. 2차는 2026-12-01부터 12-11까지, 3차는 2027-01-04부터 01-13까지예요. 서류는 기한까지 국제처에 도착해야 해요.", "Round 1 has closed. Round 2 runs 2026-12-01 to 12-11 and round 3 runs 2027-01-04 to 01-13. Documents must arrive at the international office by the deadline."),
    certified: false,
    checkedAt: "2026-11-21",
    source: { title: L2("2027학년도 전주대학교 전기 외국인 신 · 편입학 특별전형 모집요강", "Jeonju University, Spring 2027 international admissions guide"), url: "https://www.jj.ac.kr/global/admission/guidelines.do" }
  }
].map((p) => Object.freeze({ ...p, requires: Object.freeze(p.requires), costs: Object.freeze(p.costs), scholarship: Object.freeze(p.scholarship.map(Object.freeze)) })));
var isObj3 = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var isDate2 = (v) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v + "T00:00:00Z"));
var isText = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 200;
var isPair = (v) => isObj3(v) && isText(v.ko) && isText(v.en);
var isLong = (v) => typeof v === "string" && v.trim().length > 0 && v.length <= 600;
var isNote = (v) => isObj3(v) && isLong(v.ko) && isLong(v.en);
var isWon = (v) => Number.isSafeInteger(v) && v >= 0 && v <= 1e9;
var isLevel = (v) => Number.isInteger(v) && v >= 0 && v <= MAX_TOPIK;
var isHttps = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === "https:" && !u.username && !u.password;
  } catch {
    return false;
  }
};
var isSource = (v) => isObj3(v) && isPair(v.title) && isHttps(v.url);
var fail4 = (m) => {
  throw new TypeError("Invalid study data: " + m);
};
function financeRule(rules, visa, region) {
  return rules.find((r) => r.kind === "finance" && r.status === "in-force" && r.visa === visa && r.region === region) || null;
}
function announcedRules(rules, kind) {
  return rules.filter((r) => r.status === "announced" && r.kind === kind);
}
function scholarshipAmount(program, step) {
  if (Number.isInteger(step.won)) return step.won;
  return Math.round(program.costs.tuition * step.tuitionRate * (program.scholarshipTerms === 1 ? 0.5 : 1));
}
function proofRule(rules, visa) {
  return rules.find((r) => r.kind === "finance-proof" && r.status === "in-force" && !r.stale && r.visa === visa) || null;
}
function programById(programs, id) {
  return programs.find((p) => p.id === id) || null;
}
function validateStudyData(rules, programs) {
  if (!Array.isArray(rules) || !Array.isArray(programs)) fail4("lists");
  const ruleIds = /* @__PURE__ */ new Set();
  for (const r of rules) {
    if (!isObj3(r) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(r.id) || ruleIds.has(r.id)) fail4("rule id");
    ruleIds.add(r.id);
    if (!RULE_STATUS.includes(r.status) || !isDate2(r.basis) || !isDate2(r.checkedAt) || !isSource(r.source)) fail4("rule source " + r.id);
    if (r.kind === "finance") {
      if (!VISAS.includes(r.visa) || !REGIONS.includes(r.region) || !isWon(r.won) || typeof r.inCurrentGuide !== "boolean") fail4("finance rule " + r.id);
    } else if (r.kind === "finance-waiver") {
      if (!isLevel(r.topik)) fail4("waiver rule " + r.id);
    } else if (r.kind === "finance-proof") {
      if (!VISAS.includes(r.visa) || ![r.issuedWithinDays, r.heldDays].every((d) => Number.isInteger(d) && d > 0 && d <= 366)) fail4("proof rule " + r.id);
    } else fail4("rule kind " + r.id);
  }
  const seenFinance = /* @__PURE__ */ new Set();
  for (const r of rules) if (r.kind === "finance" && r.status === "in-force") {
    const key = r.visa + "/" + r.region;
    if (seenFinance.has(key)) fail4("duplicate finance rule " + key);
    seenFinance.add(key);
  }
  const ids = /* @__PURE__ */ new Set();
  for (const p of programs) {
    if (!isObj3(p) || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(p.id) || ids.has(p.id)) fail4("program id");
    ids.add(p.id);
    if (typeof p.example !== "boolean" || !isPair(p.name) || !isPair(p.place) || !isPair(p.majors)) fail4("program text " + p.id);
    if (!REGIONS.includes(p.region) || !LEVELS.includes(p.level) || !VISAS.includes(p.visa)) fail4("program kind " + p.id);
    if (p.example ? !IMAGE_IDS.includes(p.image) : !(p.image === null || IMAGE_IDS.includes(p.image))) fail4("program image " + p.id);
    if (!(p.tone === void 0 || TONES.includes(p.tone))) fail4("program tone " + p.id);
    for (const key of ["term", "requiresNote", "costsNote", "scholarshipNote", "applyNote", "dormLabel"]) if (!(p[key] === void 0 || p[key] === null || isNote(p[key]))) fail4("program " + key + " " + p.id);
    if (!(p.partner === void 0 || typeof p.partner === "boolean") || p.example && p.partner) fail4("program partner " + p.id);
    if (!(p.scholarshipTerms === void 0 || p.scholarshipTerms === 1 || p.scholarshipTerms === 2)) fail4("program scholarship terms " + p.id);
    if (p.level === "language" !== (p.visa === "D-4")) fail4("program visa " + p.id);
    const q = p.requires;
    if (!isObj3(q) || q.education !== "highschool" || !Number.isInteger(q.gradePct) || q.gradePct < 0 || q.gradePct > 100 || !isLevel(q.topik)) fail4("program requires " + p.id);
    const c = p.costs;
    const known = (v) => isWon(v) || !p.example && v === null;
    if (!isObj3(c) || !isWon(c.tuition) || !known(c.dorm) || !known(c.living)) fail4("program costs " + p.id);
    if (!Array.isArray(p.scholarship)) fail4("program scholarship " + p.id);
    let last = -1, lastAmount = 0;
    for (const s of p.scholarship) {
      const byRate = typeof s.tuitionRate === "number" && s.tuitionRate > 0 && s.tuitionRate <= 1 && s.won === void 0;
      const byWon = isWon(s.won) && s.won > 0 && s.won <= c.tuition && s.tuitionRate === void 0;
      if (!isObj3(s) || !isLevel(s.topik) || s.topik <= last || s.topik !== 0 && s.topik < q.topik || !(byRate || byWon)) fail4("scholarship steps " + p.id);
      const amount = scholarshipAmount(p, s);
      if (!(amount > lastAmount)) fail4("scholarship steps " + p.id);
      last = s.topik;
      lastAmount = amount;
    }
    if (!(p.applyOpens === null || isDate2(p.applyOpens)) || typeof p.certified !== "boolean") fail4("program dates " + p.id);
    if (!(p.applyCloses === void 0 || p.applyCloses === null || isDate2(p.applyCloses) && (!p.applyOpens || p.applyCloses >= p.applyOpens))) fail4("program close date " + p.id);
    if (p.applyRounds !== void 0) {
      let prev = "";
      if (!Array.isArray(p.applyRounds) || !p.applyRounds.length || p.applyOpens !== null) fail4("program rounds " + p.id);
      for (const r of p.applyRounds) {
        if (!Array.isArray(r) || r.length !== 2 || !isDate2(r[0]) || !isDate2(r[1]) || r[1] < r[0] || r[0] <= prev) fail4("program rounds " + p.id);
        prev = r[1];
      }
    }
    if (p.example) {
      if (p.certified) fail4("example cannot be certified " + p.id);
    } else if (!isSource(p.source) || !isDate2(p.checkedAt)) fail4("real program needs a source " + p.id);
    if (!seenFinance.has(p.visa + "/" + p.region)) fail4("no finance rule for " + p.id);
  }
  return true;
}
function staleItems(rules, programs, now = /* @__PURE__ */ new Date(), days = 90) {
  const t2 = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const old = (d) => (t2 - Date.parse(d + "T00:00:00Z")) / 864e5 > days;
  return [
    ...rules.filter((r) => old(r.checkedAt)).map((r) => ({ type: "rule", id: r.id, checkedAt: r.checkedAt })),
    ...programs.filter((p) => !p.example && old(p.checkedAt)).map((p) => ({ type: "program", id: p.id, checkedAt: p.checkedAt }))
  ];
}
function rulesAt(rules, now = /* @__PURE__ */ new Date(), days = 90) {
  const old = new Set(staleItems(rules, [], now, days).map((x) => x.id));
  return rules.map((r) => old.has(r.id) ? { ...r, stale: true } : r);
}
function programsFor(programs, publicWeb) {
  const real = programs.filter((p) => !p.example);
  return real.length ? real : publicWeb ? [] : [...programs];
}
function applyWindow(program, now = /* @__PURE__ */ new Date()) {
  const rounds = Array.isArray(program.applyRounds) ? program.applyRounds : [[program.applyOpens ?? null, program.applyCloses ?? null]];
  const at = (w, i) => rounds.length > 1 ? { ...w, round: i + 1, nextOpens: isDate2(rounds[i + 1]?.[0]) ? rounds[i + 1][0] : null } : w;
  let sawClose = false;
  for (const [i, [opens2, closes]] of rounds.entries()) {
    const toOpen = daysUntil(opens2, now);
    if (toOpen !== null && toOpen > 0) return at({ state: "before", days: toOpen }, i);
    const toClose = daysUntil(closes, now);
    if (toClose !== null) return at({ state: "open", days: toClose }, i);
    if (toOpen === 0) return at({ state: "open", days: null }, i);
    if (isDate2(closes)) sawClose = true;
  }
  return { state: sawClose ? "closed" : "unknown", days: null };
}
function daysUntil(dateText, now = /* @__PURE__ */ new Date()) {
  if (!isDate2(dateText)) return null;
  const t2 = now instanceof Date ? now.getTime() : new Date(now).getTime();
  const todayKst = Math.floor((t2 + 9 * 36e5) / 864e5);
  const d = Date.parse(dateText + "T00:00:00Z") / 864e5 - todayKst;
  return d >= 0 ? d : null;
}
validateStudyData(RULES, PROGRAMS);

// experiences/path-app/study-profile.mjs
var STUDY_KEY = "synk-path-study-v1";
var STUDY_VERSION = 1;
var isObj4 = (v) => v !== null && typeof v === "object" && !Array.isArray(v);
var intIn2 = (v, min, max) => Number.isInteger(v) && v >= min && v <= max;
var cleanDoc = (d) => isObj4(d) && typeof d.id === "string" && ID_RE2.test(d.id) && isStamp(d.doneAt) ? { id: d.id, doneAt: d.doneAt } : null;
var cleanDate = (d) => isObj4(d) && typeof d.id === "string" && DATE_ID_RE.test(d.id) && isDay(d.start) && isDay(d.end) && d.end >= d.start ? { id: d.id, start: d.start, end: d.end } : null;
var GUEST_OWNER = "guest";
var OWNER_RE = /^[A-Za-z0-9][A-Za-z0-9_.:@-]{0,127}$/;
var ownerOf = (v) => typeof v === "string" && OWNER_RE.test(v) ? v : null;
function createProfile() {
  return { v: STUDY_VERSION, topik: null, gradePct: null, fundsWon: null, education: null, compare: [], dates: [], channelsOff: [], target: null, docs: [] };
}
function normalizeProfile(raw) {
  const out = createProfile();
  if (!isObj4(raw) || raw.v !== STUDY_VERSION) return out;
  if (intIn2(raw.topik, 0, MAX_TOPIK)) out.topik = raw.topik;
  if (intIn2(raw.gradePct, 0, 100)) out.gradePct = raw.gradePct;
  if (intIn2(raw.fundsWon, 0, MAX_FUNDS_WON)) out.fundsWon = raw.fundsWon;
  if (EDUCATION_IDS.includes(raw.education)) out.education = raw.education;
  if (Array.isArray(raw.compare)) for (const id of raw.compare) {
    if (typeof id === "string" && ID_RE2.test(id) && !out.compare.includes(id) && out.compare.length < MAX_COMPARE) out.compare.push(id);
  }
  if (Array.isArray(raw.dates)) for (const d of raw.dates) {
    const c = cleanDate(d);
    if (c && !out.dates.some((x) => x.id === c.id) && out.dates.length < MAX_DATES) out.dates.push(c);
  }
  if (Array.isArray(raw.channelsOff)) for (const id of raw.channelsOff) {
    if (typeof id === "string" && ID_RE2.test(id) && !out.channelsOff.includes(id) && out.channelsOff.length < MAX_CHANNELS_OFF) out.channelsOff.push(id);
  }
  if (typeof raw.target === "string" && ID_RE2.test(raw.target)) out.target = raw.target;
  if (Array.isArray(raw.docs)) for (const d of raw.docs) {
    const c = cleanDoc(d);
    if (c && !out.docs.some((x) => x.id === c.id) && out.docs.length < MAX_DOCS) out.docs.push(c);
  }
  return out;
}
function setField(profile2, key, value) {
  const p = normalizeProfile(profile2);
  if (key === "topik") {
    if (!(value === null || intIn2(value, 0, MAX_TOPIK))) throw new RangeError("topik");
    p.topik = value;
  } else if (key === "gradePct") {
    if (!(value === null || intIn2(value, 0, 100))) throw new RangeError("gradePct");
    p.gradePct = value;
  } else if (key === "fundsWon") {
    if (!(value === null || intIn2(value, 0, MAX_FUNDS_WON))) throw new RangeError("fundsWon");
    p.fundsWon = value;
  } else if (key === "education") {
    if (!(value === null || EDUCATION_IDS.includes(value))) throw new RangeError("education");
    p.education = value;
  } else throw new RangeError("field");
  return p;
}
function toggleCompare(profile2, id, knownIds) {
  const p = normalizeProfile(profile2);
  if (typeof id !== "string" || !ID_RE2.test(id) || knownIds && !knownIds.includes(id)) return p;
  const i = p.compare.indexOf(id);
  if (i >= 0) p.compare.splice(i, 1);
  else if (p.compare.length < MAX_COMPARE) p.compare.push(id);
  return p;
}
function addDate(profile2, entry) {
  const p = normalizeProfile(profile2), c = cleanDate(entry);
  if (!c) throw new RangeError("date");
  if (p.dates.some((x) => x.id === c.id)) return { profile: p, added: false, full: false };
  if (p.dates.length >= MAX_DATES) return { profile: p, added: false, full: true };
  p.dates.push(c);
  return { profile: p, added: true, full: false };
}
function removeDate(profile2, id) {
  const p = normalizeProfile(profile2);
  p.dates = p.dates.filter((x) => x.id !== id);
  return p;
}
function confirmDate(profile2, entry) {
  const p = normalizeProfile(profile2), c = cleanDate(entry);
  if (!c) throw new RangeError("date");
  p.dates = p.dates.map((x) => x.id === c.id ? c : x);
  return p;
}
function keepDates(profile2, keep) {
  const p = normalizeProfile(profile2);
  p.dates = p.dates.filter((x) => keep.includes(x.id));
  return p;
}
function toggleChannel(profile2, id) {
  const p = normalizeProfile(profile2);
  if (typeof id !== "string" || !ID_RE2.test(id)) return p;
  if (p.channelsOff.includes(id)) p.channelsOff = p.channelsOff.filter((x) => x !== id);
  else if (p.channelsOff.length < MAX_CHANNELS_OFF) p.channelsOff.push(id);
  return p;
}
function setTarget(profile2, id, keep = null) {
  const p = normalizeProfile(profile2);
  if (id === null) {
    p.target = null;
    return { profile: p, dropped: 0 };
  }
  if (typeof id !== "string" || !ID_RE2.test(id)) throw new RangeError("target");
  let dropped = 0;
  if (p.target !== id && Array.isArray(keep)) {
    const before = p.docs.length;
    p.docs = p.docs.filter((d) => keep.includes(d.id));
    dropped = before - p.docs.length;
  }
  p.target = id;
  return { profile: p, dropped };
}
function toggleDoc(profile2, id, now = /* @__PURE__ */ new Date()) {
  const p = normalizeProfile(profile2);
  if (typeof id !== "string" || !ID_RE2.test(id)) throw new RangeError("doc");
  if (p.docs.some((d) => d.id === id)) {
    p.docs = p.docs.filter((d) => d.id !== id);
    return { profile: p, on: false, full: false };
  }
  if (p.docs.length >= MAX_DOCS) return { profile: p, on: false, full: true };
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  p.docs.push({ id, doneAt: at });
  return { profile: p, on: true, full: false };
}
function isEmptyProfile(profile2) {
  const p = normalizeProfile(profile2);
  return p.topik === null && p.gradePct === null && p.fundsWon === null && p.education === null;
}
function parseWhole(text2, min, max) {
  const s = String(text2 ?? "").replace(/[\s,]/g, "");
  if (s === "") return null;
  if (!/^\d{1,12}$/.test(s)) return void 0;
  const n = Number(s);
  return n >= min && n <= max ? n : void 0;
}
function createProfileStore(storage) {
  let profile2 = createProfile(), persisted = true, owner = GUEST_OWNER;
  try {
    const raw = storage.getItem(STUDY_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      profile2 = normalizeProfile(saved);
      const o = saved && typeof saved === "object" ? ownerOf(saved.owner) : null;
      if (o) owner = o;
      else profile2 = createProfile();
    }
  } catch {
    persisted = false;
  }
  const hasData = () => !isEmptyProfile(profile2) || profile2.compare.length > 0 || profile2.dates.length > 0 || profile2.channelsOff.length > 0 || profile2.target !== null || profile2.docs.length > 0;
  const write = () => {
    try {
      const raw = JSON.stringify({ ...profile2, owner });
      storage.setItem(STUDY_KEY, raw);
      persisted = storage.getItem(STUDY_KEY) === raw;
    } catch {
      persisted = false;
    }
    return persisted;
  };
  return {
    get: () => normalizeProfile(profile2),
    persisted: () => persisted,
    owner: () => owner,
    set(next) {
      profile2 = normalizeProfile(next);
      write();
      return profile2;
    },
    /** 주인을 바꾼다(손님이 넣은 조건을 로그인한 계정이 이어받을 때). 넣은 것이 없으면 저장소를 건드리지 않는다. */
    setOwner(next) {
      const o = ownerOf(next);
      if (!o || o === owner) return;
      owner = o;
      if (hasData()) write();
    },
    clear() {
      profile2 = createProfile();
      owner = GUEST_OWNER;
      try {
        storage.removeItem(STUDY_KEY);
        persisted = storage.getItem(STUDY_KEY) === null;
      } catch {
        persisted = false;
      }
      return persisted;
    }
  };
}

// experiences/path-app/study-account.mjs
var STUDY_OPERATIONS = Object.freeze({ load: "pathLoad", save: "pathSave", delete: "pathDelete" });
var STUDY_CACHE_PREFIX = "synk-path-study-account:";
var PAUSE_CODES = /* @__PURE__ */ new Set(["PATH_STUDY_UNAVAILABLE", "INVALID_ACTION", "INVALID_QUERY", "NETWORK", "ACCOUNT_UNAVAILABLE", "OFFLINE"]);
var clone2 = (v) => v == null ? null : JSON.parse(JSON.stringify(v));
var stamp = (d) => (d instanceof Date ? d : new Date(d)).toISOString();
function createStudyAccount({ request, storage = globalThis.sessionStorage, onChange = () => {
}, syncFactory = createDocumentSync, now = () => /* @__PURE__ */ new Date() } = {}) {
  if (typeof request !== "function") throw new TypeError("PATH study request required");
  let sync = null, accountId = null, epoch = 0;
  let doc2 = null, phase = "closed", status = { status: "closed", pending: false, error: null, localDrafts: [] };
  let lastOp = null, deletedElsewhere = false, reapplying = false, preferLocal = false, cleanAfterSave = false, sendFailed = false;
  let orphan = null;
  const SELF_HEALING = /* @__PURE__ */ new Set(["REVISION_CONFLICT", "PATH_STUDY_CONSENT_STALE"]);
  const emit = () => {
    try {
      onChange(snapshot());
    } catch {
    }
  };
  function snapshot() {
    return Object.freeze({
      phase,
      profile: phase === "consented" && doc2?.consent ? clone2(doc2.profile) : null,
      consent: doc2?.consent ? clone2(doc2.consent) : null,
      pending: status.pending === true,
      error: status.error ? { code: status.error.code || "PATH_STUDY_ERROR" } : null,
      localDrafts: Array.isArray(status.localDrafts) ? clone2(status.localDrafts) : [],
      deletedElsewhere,
      // 한 번 보내지 못했으면 그 변경이 계정에 닿을 때까지 켜 둔다(끊긴 채 이어 눌러도 알림이 깜빡이지 않게).
      sendFailed: sendFailed && status.pending === true
    });
  }
  const phaseFor = () => {
    const st = status.status, code = status.error?.code;
    if (!accountId) return "closed";
    if (st === "local-conflict") return "choose";
    if (doc2?.consent) return "consented";
    if (code && PAUSE_CODES.has(code)) return "paused";
    if (["error", "storage-error"].includes(st) || code && !Number.isSafeInteger(status.revision)) return "error";
    if (!Number.isSafeInteger(status.revision)) return "loading";
    return "none";
  };
  const transport = (operation, values) => request(operation, values || {});
  function wipe(id) {
    if (!id || !storage) return;
    const head2 = STUDY_CACHE_PREFIX + encodeURIComponent(id), keys = [];
    try {
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k === head2 || typeof k === "string" && k.startsWith(head2 + ":")) keys.push(k);
      }
      for (const k of keys) storage.removeItem(k);
    } catch {
    }
  }
  function ensureSync() {
    if (sync) return sync;
    sync = syncFactory({
      transport,
      storage,
      onState: (state2) => {
        doc2 = state2 ? clone2(state2) : null;
        phase = phaseFor();
        emit();
      },
      onStatus: (next) => {
        if (!next) return;
        status = { status: next.status || "idle", revision: Number.isSafeInteger(next.revision) ? next.revision : null, pending: next.pending === true, error: next.error || null, localDrafts: next.localDrafts || [] };
        const code = next.error?.code;
        if (next.pending !== true) sendFailed = false;
        else if (code && !SELF_HEALING.has(code)) sendFailed = true;
        if (next.status === "synced" && next.pending !== true && !reapplying) lastOp = null;
        if (cleanAfterSave && next.status === "synced" && next.pending !== true) {
          cleanAfterSave = false;
          const my = epoch;
          setTimeout(() => {
            if (my === epoch && !status.pending) {
              try {
                sync.clearLocalRecords?.();
              } catch {
              }
            }
          }, 0);
        }
        if (next.status === "conflict" && !reapplying) void recoverConflict();
        else if (code === "PATH_STUDY_CONSENT_STALE") void recoverStale();
        phase = phaseFor();
        emit();
      },
      onSaved: () => {
      },
      onRemoved: () => {
      },
      validateState: (raw) => validateStudyDocument(raw, { allowEmpty: true }),
      emptyState: () => emptyStudyDocument(),
      scope: "synk-path",
      resource: STUDY_RESOURCE,
      cachePrefix: STUDY_CACHE_PREFIX,
      operations: STUDY_OPERATIONS
    });
    return sync;
  }
  async function recoverConflict() {
    const my = epoch;
    reapplying = true;
    try {
      if (preferLocal) {
        preferLocal = false;
        if (await sync.resolveLocal()) cleanAfterSave = true;
        return;
      }
      if (!await sync.resolveRemote() || my !== epoch) return;
      if (!doc2?.consent) {
        deletedElsewhere = true;
        orphan = lastOp;
        lastOp = null;
        preferLocal = false;
        try {
          sync.clearLocalRecords?.();
        } catch {
        }
        phase = phaseFor();
        emit();
        return;
      }
      if (lastOp) {
        const op = lastOp;
        lastOp = null;
        const next = createStudyDocument(op(clone2(doc2.profile)), doc2.consent);
        if (sync.change(next)) {
          doc2 = next;
          cleanAfterSave = true;
          emit();
        }
      }
    } catch {
    } finally {
      reapplying = false;
    }
  }
  async function recoverStale() {
    const my = epoch;
    try {
      if (!await sync.resolveRemote() || my !== epoch) return;
      if (!doc2?.consent) {
        deletedElsewhere = true;
        orphan = lastOp;
        lastOp = null;
        try {
          sync.clearLocalRecords?.();
        } catch {
        }
      }
      phase = phaseFor();
      emit();
    } catch {
    }
  }
  async function open(id) {
    close();
    accountId = id;
    epoch++;
    deletedElsewhere = false;
    lastOp = null;
    orphan = null;
    doc2 = null;
    phase = "loading";
    emit();
    const my = epoch;
    try {
      await ensureSync().open(id);
      if (my !== epoch) return false;
      const drafts = status.localDrafts || [];
      if (status.status === "local-conflict" && drafts.length === 1 && drafts[0]?.baseRevision != null && drafts[0].baseRevision === status.revision) await sync.selectLocalDraft(drafts[0].id);
    } catch (error) {
      if (my === epoch) {
        status = { ...status, error: { code: error?.code || "NETWORK" } };
      }
    }
    if (my === epoch) {
      phase = phaseFor();
      emit();
    }
    return phase === "consented" || phase === "none";
  }
  function close() {
    epoch++;
    try {
      sync?.close();
    } catch {
    }
    accountId = null;
    doc2 = null;
    lastOp = null;
    orphan = null;
    preferLocal = false;
    cleanAfterSave = false;
    sendFailed = false;
    phase = "closed";
    status = { status: "closed", revision: null, pending: false, error: null, localDrafts: [] };
  }
  function write(nextProfile, op = null) {
    if (phase !== "consented" || !sync) throw Object.assign(new Error("PATH_STUDY_NOT_CONSENTED"), { code: "PATH_STUDY_NOT_CONSENTED" });
    const next = createStudyDocument(nextProfile, doc2.consent);
    const prev = lastOp;
    lastOp = typeof op === "function" ? prev && status.pending ? (p) => op(prev(p)) : op : null;
    const changed = sync.change(next);
    if (changed) {
      doc2 = next;
      emit();
    }
    return changed;
  }
  async function give({ profile: profile2, minor, lang }) {
    if (!sync || !accountId) return false;
    if (phase !== "none" || !Number.isSafeInteger(status.revision)) {
      try {
        await sync.refresh();
      } catch {
      }
      phase = phaseFor();
      emit();
      if (phase === "consented") return "exists";
      if (phase !== "none" || !Number.isSafeInteger(status.revision)) return false;
    }
    const consent = { v: CONSENT_VERSION, at: stamp(now()), minor: minor === true, guardian: minor === true, lang, base: status.revision };
    const next = createStudyDocument(profile2, consent);
    deletedElsewhere = false;
    orphan = null;
    const id = accountId, my = epoch;
    sync.change(next);
    doc2 = next;
    phase = phaseFor();
    emit();
    let ok = false;
    try {
      ok = await sync.flush() === true && !status.pending;
    } catch {
      ok = false;
    }
    if (my !== epoch) return false;
    if (!ok) {
      close();
      wipe(id);
      await open(id);
      return accountId === id && phase === "consented" ? "exists" : false;
    }
    phase = phaseFor();
    emit();
    return true;
  }
  async function remove() {
    if (!sync || !accountId) return false;
    const my = epoch, id = accountId, same2 = () => my === epoch && accountId === id;
    let ok = false;
    try {
      ok = await sync.remove();
    } catch {
      ok = false;
    }
    if (!same2()) return false;
    if (!ok) {
      try {
        ok = await sync.resolveRemote() === true && same2() && Number.isSafeInteger(status.revision) && !doc2?.consent;
      } catch {
        ok = false;
      }
    }
    if (!same2()) return false;
    if (ok) {
      lastOp = null;
      try {
        sync.clearLocalRecords?.();
      } catch {
      }
    }
    phase = phaseFor();
    emit();
    return ok;
  }
  const pickDraft = async (id) => {
    if (!sync) return false;
    preferLocal = true;
    const ok = await sync.selectLocalDraft(id);
    if (!ok) preferLocal = false;
    return ok;
  };
  const useAccount = async () => {
    preferLocal = false;
    if (!sync) return false;
    const my = epoch, ok = await sync.resolveRemote();
    if (ok === true && my === epoch) setTimeout(() => {
      if (my === epoch && !status.pending) {
        try {
          sync.clearLocalRecords?.();
        } catch {
        }
      }
    }, 0);
    return ok;
  };
  const retry = () => sync && accountId ? status.pending ? sync.flush() : sync.refresh() : Promise.resolve(false);
  const clearNotice = () => {
    deletedElsewhere = false;
    emit();
  };
  const takeOrphan = () => {
    const op = orphan;
    orphan = null;
    return op;
  };
  const discardLocal = (id = accountId) => {
    if (!id) return;
    if (accountId === id) close();
    wipe(id);
    emit();
  };
  return Object.freeze({ open, close, snapshot, write, give, remove, pickDraft, useAccount, retry, clearNotice, discardLocal, takeOrphan });
}

// experiences/path-app/consent-ui.mjs
var esc3 = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var svg = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
var ON = svg('<path d="m5 10.4 3.2 3.1L15 6.6"/>');
var BACK = svg('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
var PRIVACY_URL = "https://synk.im/privacy/#synk-id";
var ITEMS = [
  [
    "what",
    "저장하는 것",
    "What is saved",
    "Хадгалах зүйл",
    "한국어 급수, 고등학교 성적(백분위), 준비한 돈, 학력, 비교에 담은 과정, 내 길에 넣은 날, 끈 채널, 고른 과정, 「준비했어요」 표시",
    "Korean level, high school grades (percentile), money you have prepared, education, programs in compare, dates added to My path, channels you turned off, the program you picked, and your “Ready” marks",
    "Солонгос хэлний түвшин, ахлах сургуулийн дүн (хувиар), бэлтгэсэн мөнгө, боловсрол, харьцуулахаар нэмсэн хөтөлбөр, «Миний зам»-д нэмсэн өдрүүд, унтраасан суваг, сонгосон хөтөлбөр, «Бэлэн болсон» тэмдэг"
  ],
  [
    "why",
    "쓰는 곳",
    "What it is for",
    "Хэрэглэх зорилго",
    "내 길과 대학 맞춤을 다른 기기에서도 이어서 보여 줘요. 나만 봐요. 지금은 담당자가 보지 않아요.",
    "To show My path and school matches on your other devices too. Only you can see it. No staff member sees it for now.",
    "«Миний зам» болон их сургуулийн тохируулгыг өөр төхөөрөмж дээр ч үргэлжлүүлэн харуулна. Зөвхөн та харна. Одоогоор ажилтан харахгүй."
  ],
  [
    "where",
    "저장하는 곳",
    "Where it is stored",
    "Хадгалах газар",
    "SYNK 계정 데이터베이스(Supabase, Inc.)의 싱가포르 서버예요. 정보가 몽골 밖으로 옮겨져요. 바꿀 때마다 암호화된 연결로 보내요.",
    "Servers in Singapore for the SYNK account database (Supabase, Inc.). Your information leaves Mongolia. Each change is sent over an encrypted connection.",
    "SYNK бүртгэлийн мэдээллийн сангийн (Supabase, Inc.) Сингапур дахь сервер. Мэдээллийг Монголоос гадагш дамжуулна. Өөрчлөх бүрд шифрлэгдсэн холболтоор илгээнэ."
  ],
  [
    "keep",
    "보관",
    "How long",
    "Хадгалах хугацаа",
    "내가 지우거나 계정을 삭제할 때까지 보관해요. 내 정보에서 언제든 지울 수 있고, 지우면 동의를 거두는 것이에요.",
    "Until you delete it or delete your account. You can delete it at any time on the Profile page, and deleting it withdraws your consent.",
    "Та өөрөө устгах эсвэл бүртгэлээ устгах хүртэл хадгална. «Миний мэдээлэл» хэсгээс хүссэн үедээ устгаж болно. Устгавал зөвшөөрлөө цуцалсан гэсэн үг."
  ],
  [
    "no",
    "거부",
    "Saying no",
    "Татгалзах",
    "저장하지 않아도 돼요. 그러면 지금처럼 이 탭에만 두고, 탭을 닫으면 사라져요.",
    "You do not have to save it. Then it stays in this tab only, as now, and disappears when you close the tab.",
    "Хадгалахгүй байж болно. Тэгвэл одоогийнх шиг зөвхөн энэ табд үлдэж, табыг хаахад устна."
  ],
  ["ask", "문의", "Questions", "Холбоо барих", "SYNK · hello@synk.im", "SYNK · hello@synk.im", "SYNK · hello@synk.im"]
];
var MINOR_NOTE = [
  "만 18세 미만이면 보호자가 이 내용을 함께 읽고 동의해야 해요. SYNK는 보호자를 따로 확인하지 않아요.",
  "If you are under 18, a parent or guardian must read this with you and agree. SYNK does not check this separately.",
  "Хэрэв 18 нас хүрээгүй бол асран хамгаалагч тань энэ мэдээллийг хамт уншиж, зөвшөөрөх ёстой. SYNK асран хамгаалагчийг тусад нь шалгахгүй."
];
function renderStudyConsent(view) {
  const en = view.lang === "en", L5 = (ko, e) => en ? e : ko;
  const minor = view.minor === true || view.minor === false ? view.minor : null, guardian = view.guardian === true;
  const ready = minor === false || minor === true && guardian;
  const rows = ITEMS.map(([id, hk, he, , tk, te]) => `<div class="sx-consent-row"><dt>${esc3(en ? he : hk)}</dt><dd>${esc3(en ? te : tk)}${id === "ask" ? ` · <a href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">${L5("개인정보처리방침", "Privacy policy")}<span class="sr-only"> (${L5("새 탭에서 열림", "opens in new tab")})</span></a>` : ""}</dd></div>`).join("");
  const mn = `<details class="sx-past sx-consent-mn" lang="mn" data-fold="consent-mn"><summary>Монгол хэлээр унших</summary><h2 class="sx-h">Миний нөхцөлийг бүртгэлдээ хадгалах уу?</h2><dl class="sx-consent">${ITEMS.map(([, , , hm, , , tm]) => `<div class="sx-consent-row"><dt>${esc3(hm)}</dt><dd>${esc3(tm)}</dd></div>`).join("")}</dl><p class="sx-fine">${esc3(MINOR_NOTE[2])}</p></details>`;
  const age = (id, ko, e, mnText) => `<button type="button" class="sx-btn2 sx-consent-age" aria-pressed="${id === "minor" === minor && minor !== null}" data-action="consentAge" data-id="${id}"><span class="sx-consent-main"><span class="sx-on">${ON}</span>${esc3(L5(ko, e))}</span><small lang="mn">${esc3(mnText)}</small></button>`;
  const guardianBox = minor === true ? `<button type="button" class="sx-consent-guardian" role="checkbox" aria-checked="${guardian}" data-action="consentGuardian"><span class="sx-consent-box">${ON}</span><span class="sx-consent-text"><span>${esc3(L5("보호자가 이 내용을 함께 읽고 동의했어요", "A parent or guardian read this with me and agreed"))}</span><small lang="mn">Асран хамгаалагч маань энэ мэдээллийг хамт уншиж, зөвшөөрсөн</small></span></button>` : "";
  const error = view.error ? `<p class="sx-store is-warn" role="alert">${esc3(view.error)}</p>` : "";
  const why = minor === null ? [L5("나이를 고르면 저장할 수 있어요.", "Choose your age to save."), "Насаа сонговол хадгалах боломжтой."] : minor === true && !guardian ? [L5("보호자 확인을 누르면 저장할 수 있어요.", "Tick the guardian check to save."), "Асран хамгаалагчийн зөвшөөрлийн нүдийг чагталбал хадгалах боломжтой."] : null;
  const whyLine = why ? `<p class="sx-fine sx-consent-why" id="sx-consent-why">${esc3(why[0])} <span lang="mn">${esc3(why[1])}</span></p>` : "";
  return `<div class="sx">
<button type="button" class="sx-back" data-action="consentRefuse">${BACK}${L5("돌아가기", "Back")}</button>
<header class="sx-head"><p class="sx-kicker">${L5("계정에 저장", "Save to account")}</p><h1 class="sx-title page-title" tabindex="-1">${L5("내 조건을 계정에 저장할까요?", "Save your conditions to your account?")}</h1></header>
<dl class="sx-consent">${rows}</dl>
${mn}
<fieldset class="sx-consent-ages"><legend class="sx-h">${L5("나이", "Age")}</legend><p class="sx-fine">${esc3(L5(MINOR_NOTE[0], MINOR_NOTE[1]))}</p><div class="sx-row2">${age("adult", "만 18세 이상이에요", "I am 18 or older", "Би 18 нас хүрсэн")}${age("minor", "만 18세 미만이에요", "I am under 18", "Би 18 нас хүрээгүй")}</div>${guardianBox}</fieldset>
${error}
${whyLine}
<div class="sx-row2 sx-consent-actions"><button type="button" class="sx-cta" data-action="consentSave"${why ? ' aria-describedby="sx-consent-why"' : ""}${ready && !view.busy ? "" : ' disabled aria-disabled="true"'}><span class="sx-consent-main">${view.busy ? L5("저장하는 중…", "Saving…") : L5("계정에 저장", "Save to account")}</span><small lang="mn">Бүртгэлдээ хадгалах</small></button><button type="button" class="sx-btn2 line" data-action="consentRefuse"><span class="sx-consent-main">${L5("이 탭에만 두기", "Keep in this tab only")}</span><small lang="mn">Зөвхөн энэ табд үлдээх</small></button></div>
</div>`;
}
function renderStudyNotices(view) {
  const en = view.lang === "en", L5 = (ko, e) => en ? e : ko;
  const out = [];
  if (view.blocked) out.push(`<div class="notice error" role="alert"><p>${L5("계정에 저장한 조건을 지금 불러오지 못했어요. 연결을 확인하고 「다시 시도」를 눌러 주세요. 그동안은 조건을 고칠 수 없어요.", "Your saved conditions could not be loaded right now. Check your connection and press Retry. Until then, conditions cannot be changed.")}</p><div class="actions"><button type="button" class="secondary" data-action="studyAccountRetry">${L5("다시 시도", "Retry")}</button></div></div>`);
  if (view.drafts) out.push(`<div class="notice" role="status"><p>${L5("이 탭에 계정에 올라가지 않은 조건 변경이 남아 있는데, 그사이 계정 쪽도 바뀌었어요. 어느 쪽을 쓸까요?", "This tab has condition changes that never reached your account, and your account changed in the meantime. Which should we use?")}</p><div class="actions"><button type="button" class="secondary" data-action="studyDraftAccount">${L5("계정 것 쓰기", "Use the account")}</button><button type="button" class="secondary" data-action="studyDraftPick">${L5("남은 변경 쓰기", "Use the unsent changes")}</button></div></div>`);
  if (view.choice) out.push(`<div class="notice" role="status"><p>${L5("이 탭에서 넣은 조건이 계정에 저장된 것과 달라요. 어느 쪽을 쓸까요?", "The conditions in this tab differ from the ones saved to your account. Which should we use?")}</p><div class="actions"><button type="button" class="secondary" data-action="studyUseAccount">${L5("계정 것 쓰기", "Use the account")}</button><button type="button" class="secondary" data-action="studyUseTab">${L5("이 탭 것으로 바꾸기", "Replace with this tab")}</button></div></div>`);
  if (view.deleted) out.push(`<div class="notice" role="status"><p>${L5("계정의 유학 준비 자료가 다른 곳에서 지워졌어요. 이제 넣는 조건은 이 탭에만 남아요.", "Your study data was deleted from your account elsewhere. Conditions you add now stay in this tab only.")}</p><div class="actions"><button type="button" class="secondary" data-action="studyNoticeClose">${L5("알겠어요", "OK")}</button></div></div>`);
  if (view.ask) out.push(`<div class="notice" role="status"><p>${L5("이 조건을 계정에 저장하면 다른 기기에서도 이어서 볼 수 있어요. 저장하기 전에 무엇을 어디에 두는지 읽어 주세요.", "If you save these conditions to your account, you can continue on other devices. Before saving, please read what is stored and where.")}</p><div class="actions"><button type="button" class="secondary" data-action="studyConsentOpen">${L5("읽고 정하기", "Read and decide")}</button><button type="button" class="secondary" data-action="consentRefuse">${L5("이 탭에만 두기", "Keep in this tab only")}</button></div></div>`);
  if (view.pending) out.push(`<div class="notice" role="status"><p>${L5("아직 계정에 올라가지 않은 변경이 있어요. 연결이 돌아오면 다시 보내요.", "Some changes are not in your account yet. They are sent again when your connection is back.")}</p><div class="actions"><button type="button" class="secondary" data-action="studyAccountRetry">${L5("지금 다시 보내기", "Send again now")}</button></div></div>`);
  return out.join("");
}
var NETWORK_CODES = /* @__PURE__ */ new Set(["NETWORK", "OFFLINE", "ACCOUNT_UNAVAILABLE"]);
function renderStudyAccountSettings(view) {
  const en = view.lang === "en", L5 = (ko, e) => en ? e : ko;
  const box = (body) => `<section class="settings-group"><h2>${L5("유학 준비 자료", "Study data")}</h2>${body}</section>`;
  const retry = `<button type="button" class="btn-line" data-action="studyAccountRetry">${L5("다시 시도", "Retry")}</button>`;
  if (view.phase === "consented") {
    const when = view.consent?.at ? new Date(view.consent.at) : null;
    const at = when && !Number.isNaN(when.getTime()) ? `${when.getFullYear()}-${String(when.getMonth() + 1).padStart(2, "0")}-${String(when.getDate()).padStart(2, "0")}` : "";
    return box(`<p>${L5(`「내 조건」 · 「다가오는 날」 · 고른 과정 · 서류 표시를 계정에 저장하고 있어요(동의 ${esc3(at)}). 다른 기기에서도 보여요.`, `Your conditions, upcoming dates, the program you picked and your marks are saved to your account (consent ${esc3(at)}). They show on your other devices too.`)}</p><button type="button" class="btn-line danger" data-action="studyAccountDelete">${L5("계정의 유학 준비 자료 지우기", "Delete study data from account")}</button>`);
  }
  if (view.phase === "choose") return box(`<p>${L5("이 탭에 계정에 올라가지 않은 조건 변경이 남아 있어요. 고르기 전에는 조건을 고칠 수 없어요.", "This tab has condition changes that never reached your account. You cannot change conditions until you choose.")}</p><div class="actions"><button type="button" class="btn-line" data-action="studyDraftAccount">${L5("계정 것 쓰기", "Use the account")}</button><button type="button" class="btn-line" data-action="studyDraftPick">${L5("남은 변경 쓰기", "Use the unsent changes")}</button></div>`);
  if (view.store === "wait") return box(`<p class="meta">${L5("계정에 저장한 조건을 불러오는 중이에요.", "Loading the conditions saved to your account.")}</p>`);
  if (view.store === "blocked") return box(`<p>${L5("계정에 저장한 조건을 지금 불러오지 못했어요. 그동안은 조건을 고칠 수 없어요.", "Your saved conditions could not be loaded right now. Until then, conditions cannot be changed.")}</p>${retry}`);
  if (view.phase === "none") return box(`<p>${L5("계정에 저장하면 다른 기기에서도 이어서 볼 수 있어요.", "Save them to your account to continue on other devices.")}</p><button type="button" class="btn-line" data-action="studyConsentOpen">${L5("계정에 저장하기", "Save to account")}</button>`);
  if (view.phase === "paused" && NETWORK_CODES.has(view.errorCode)) return box(`<p>${L5("계정에 연결하지 못했어요. 연결을 확인하고 다시 시도해 주세요.", "Could not reach your account. Check your connection and try again.")}</p>${retry}`);
  if (view.phase === "paused") return "";
  if (view.phase === "error") return box(`<p>${L5("계정 상태를 확인하지 못했어요.", "Could not check your account.")}</p>${retry}`);
  return "";
}

// experiences/path-app/docs-data.mjs
var L3 = (ko, en) => Object.freeze({ ko, en });
var freeze = (o) => Object.freeze(o);
var DOC_STAGES = Object.freeze(["apply", "admitted", "visa"]);
var KVAC_D22 = freeze({ title: L3("KVAC 몽골 「유학(D-2-1~D-2-4)」 서류 목록", "KVAC Mongolia student visa (D-2) document list"), url: "https://www.visaforkorea.mn/ko/study-visa-d-2-1d-2-4" });
var KVAC_D42 = freeze({ title: L3("KVAC 몽골 「한국어연수(D-4-1)」 서류 목록", "KVAC Mongolia language trainee visa (D-4-1) document list"), url: "https://www.visaforkorea.mn/ko/korean-language-trainee-d-4-1" });
var doc = (id, stage, name, extra = {}) => freeze({ id, stage, name, from: null, when: null, note: null, unclear: null, only: null, ...extra });
var only = (ko, en) => freeze({ cond: L3(ko, en) });
var JBNU_UG = freeze({
  source: freeze({ title: L3("전북대학교 2027학년도 전기 학부 외국인특별전형 모집요강", "Jeonbuk National University, Spring 2027 undergraduate international admissions guide"), url: "https://ioffice.jbnu.ac.kr/bbs/ioffice/5310/401304/artclView.do" }),
  id: "docs-jbnu-ug",
  checkedAt: "2026-11-22",
  term: L3("2027학년도 전기 요강 기준", "Based on the Spring 2027 guide"),
  ask: L3("전북대 국제협력과(admissionu@jbnu.ac.kr, 요강 10쪽)", "JBNU Office of International Affairs (admissionu@jbnu.ac.kr, guide p. 10)"),
  // 공개허용: 대학이 공개 요강에 적은 입학 업무 연락처
  how: L3("UWAY에서 온라인으로 접수하고(성적증명서와 사진 파일을 올려요), 서류는 우편이나 방문으로 국제협력과에 내요. 전형료는 80,000원이에요.", "Apply online on UWAY (you upload your transcript and photo), then send the documents to the Office of International Affairs by post or in person. The application fee is ₩80,000."),
  rules: [
    L3("원본을 내는 것이 원칙이에요. 원본을 다시 받을 수 없으면 발급기관의 원본대조필 사본이나 공증본 원본을 내요.", "Originals are the rule. If you cannot get another original, submit a copy certified by the issuing office or a notarized copy."),
    L3("한국어 · 영어가 아닌 서류는 번역본이 꼭 필요해요. 공증받지 않은 번역본에는 번역자확인서와 번역자 졸업증을 더 내요.", "Documents not in Korean or English need a translation. An unnotarized translation also needs the translator confirmation form and the translator’s diploma.")
  ],
  unclear: [L3("번역 형식이 요강의 두 곳에서 달라요. 앞쪽은 공증 없는 번역에 번역자확인서를 붙이면 된다고 하고, 서류 표는 「번역회사의 번역본」을 말해요. 개인 번역을 받아 주는지 대학에 먼저 물어보세요.", "The guide describes translations in two ways: one part accepts an unnotarized translation with the translator form, the document table asks for a translation by a translation company. Ask the university whether a personal translation is accepted.")],
  docs: [
    doc("jbnu-ug-forms", "apply", L3("입학지원서 · 유학경비부담서약서 · 개인정보이용동의서", "Application form, financial guarantee pledge, privacy consent"), { note: L3("온라인 접수에서 작성한 뒤 출력해 서명해요.", "Fill them in during online application, then print and sign.") }),
    doc("jbnu-ug-grad", "apply", L3("고등학교 졸업(예정)증명서", "High school (expected) graduation certificate"), {
      note: L3("원본이 원칙이에요. 졸업예정자는 졸업예정증명서를 먼저 내고, 졸업증명서는 2027-02-19까지 내요.", "Original as a rule. If you are about to graduate, submit the expected-graduation certificate first and the graduation certificate by 2027-02-19."),
      unclear: L3("비고의 「아포스티유 확인서 혹은 영사확인 서류로 대체」가 졸업증명서에 아포스티유를 받으라는 뜻인지, 아래 학력인증서와 같은 서류라는 뜻인지 요강에서 갈리지 않아요.", "The note “replace with an apostille or consular confirmation” could mean the certificate itself needs an apostille, or that it is the same document as the diploma verification below. The guide does not say which.")
    }),
    doc("jbnu-ug-transcript", "apply", L3("고등학교 전 과정 성적증명서", "High school transcript (all years)"), {
      note: L3("원본과 번역회사 번역본, 또는 공증받은 사본이에요. 온라인 접수 때 파일로도 올려요. 졸업예정자는 지금까지의 성적표를 내고 졸업 뒤 최종본을 더 내요.", "The original with a translation company’s translation, or a notarized copy. Also upload it during online application. If you are about to graduate, submit your current transcript and the final one after graduation."),
      unclear: L3("성적증명서에 아포스티유가 필요한지 요강의 두 곳이 달라요. 서류 표에는 없고, 학력인증 안내는 「졸업 및 성적증명서에 대한 아포스티유」를 말해요.", "The guide differs on whether the transcript needs an apostille: the document table does not say so, but the verification section mentions an apostille for the graduation certificate and transcript.")
    }),
    doc("jbnu-ug-verify", "apply", L3("고등학교 졸업 학력인증서(아포스티유)", "High school diploma verification (apostille)"), {
      note: L3("원본을 내요. 몽골은 아포스티유 협약국이라 아포스티유 확인서를 받아요. 졸업예정자는 2027-02-19까지 내요.", "Submit the original. Mongolia is an apostille country, so you get an apostille certificate. If you are about to graduate, submit it by 2027-02-19.")
    }),
    doc("jbnu-ug-family", "apply", L3("가족관계증명서와 부모 여권 사본", "Family relation certificate and parents’ passport copies"), { note: L3("증명서는 원본과 번역회사 번역본, 또는 공증받은 사본이에요. 부모 두 사람의 여권 사본(여권이 없으면 신분증 사본)을 내고, 본인과 부모의 이름 · 국적이 보여야 해요.", "The certificate as an original with a translation company’s translation, or a notarized copy. Add copies of both parents’ passports (or ID cards if they have no passport); names and nationalities must be visible.") }),
    doc("jbnu-ug-language", "apply", L3("어학능력 증빙(TOPIK 성적표나 한국어학당 수료증)", "Language proof (TOPIK score report or language institute certificate)"), {
      when: L3("원서 접수일 기준 최근 2년 안에 발급된 것", "Issued within the last two years as of the application date"),
      note: L3("한국어 트랙은 TOPIK 2급 이상 같은 조건이 있어요. 시험에 접수만 했으면 접수증을 먼저 내요. 장학금은 2026-12-23까지 낸 성적만 반영해요.", "The Korean track needs TOPIK level 2 or similar. If you have only registered for the test, submit the registration slip first. Scholarships count only scores submitted by 2026-12-23.")
    }),
    doc("jbnu-ug-bank", "apply", L3("은행잔고증명서", "Bank balance certificate"), {
      when: L3("제출일 기준 30일 안에 발급된 것", "Issued within 30 days of submission"),
      note: L3("원본이에요. 본인이나 부모 계좌로 1,600만 원(약 13,000달러) 이상이에요. 원서를 낼 때나 합격 뒤에 내도 되고, 늦어도 비자 신청 전에 내요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.", "Original, from your own or a parent’s account, ₩16,000,000 (about USD 13,000) or more. You may submit it with the application or after admission, but before the visa application at the latest. Owner, validity and copies can differ from the visa deposit certificate.")
    }),
    doc("jbnu-ug-passport", "apply", L3("여권 사본", "Passport copy")),
    doc("jbnu-ug-arc", "apply", L3("외국인등록증 사본", "Alien registration card copy"), { only: only("한국에 살고 있는 사람만", "Only if you live in Korea") }),
    doc("jbnu-ug-portfolio", "apply", L3("작품성과집(포트폴리오, USB 등)", "Portfolio (USB etc.)"), { only: only("예술대학 지원자만", "Only for College of Arts applicants") })
  ],
  // 서류 기한은 그 차수(시작 날)에 매단다: 날짜가 바뀌어도 id가 그대로라 넣어 둔 학생은 「날짜가 바뀌었어요」를 본다.
  deadlines: [
    freeze({ round: "2026-11-09", key: "docs", start: "2026-11-27", label: L3("2차 서류 제출 마감(2차 원서를 낸 사람만)", "Round 2 document deadline (only if you applied in round 2)") }),
    freeze({ round: "2026-11-09", key: "originals", start: "2027-02-19", label: L3("원본 · 졸업 서류 제출(사본을 냈거나 졸업예정자)", "Originals and graduation documents (if you sent copies or were about to graduate)") })
  ]
});
var JBNU_LANG = freeze({
  source: freeze({ title: L3("전북대학교 한국어학당 입학신청 · 제출서류", "Jeonbuk National University Korean Language Institute: application and documents"), url: "https://wz3.jbnu.ac.kr/lec_korean/10899/subview.do" }),
  id: "docs-jbnu-lang",
  checkedAt: "2026-11-22",
  term: L3("2027 봄학기 접수 기준(학당 누리집)", "Based on the spring 2027 intake (institute pages)"),
  how: L3("온라인으로 접수하고 서류는 스캔해서 올려요. 전형료는 70,000원이에요(2027년 봄학기부터 오른 금액). 낸 서류와 전형료는 돌려주지 않아요.", "Apply online and upload scanned documents. The application fee is ₩70,000 (raised from spring 2027). Documents and the fee are not returned."),
  rules: [L3("모든 서류에 국문이나 영문 번역본, 또는 공증본을 붙여요. 번역본이면 번역자 확인서를 더 내요.", "Attach a Korean or English translation, or a notarized copy, to every document. With a translation, add the translator confirmation form.")],
  unclear: [],
  docs: [
    doc("jbnu-lang-photo", "apply", L3("사진(3.5 × 4.5cm 컬러)", "Photo (3.5 × 4.5 cm, colour)")),
    doc("jbnu-lang-passport", "apply", L3("여권 사본", "Passport copy")),
    doc("jbnu-lang-grad", "apply", L3("최종학력 학교 졸업증명서", "Graduation certificate from your last school"), {
      note: L3("원본을 스캔해 올려요.", "Upload a scan of the original."),
      unclear: L3("한국어 안내에는 이 줄에 「(중국)」 표기가 붙어 있고, 영어 안내에는 없이 모든 지원자 서류로 적혀 있어요. 졸업예정자가 무엇을 내는지도 학당 누리집에 없어요.", "The Korean page marks this line “(China)”, while the English page lists it for all applicants. The page also does not say what students who have not yet graduated submit.")
    }),
    doc("jbnu-lang-transcript", "apply", L3("최종학력 학교 성적증명서", "Transcript from your last school"), { note: L3("원본을 스캔해 올려요.", "Upload a scan of the original.") }),
    doc("jbnu-lang-verify", "apply", L3("최종학력 인증서류(아포스티유)", "Diploma verification (apostille)"), { note: L3("원본이에요. 아포스티유나, 한국 영사관 · 주한 자국 공관의 영사인증을 받아요.", "Original, with an apostille or consular confirmation.") }),
    doc("jbnu-lang-bank", "apply", L3("은행잔고증명서", "Bank balance certificate"), { when: L3("신청일 기준 30일 안에 발급된 것", "Issued within 30 days of applying"), note: L3("본인이나 부모 명의로 800만 원 이상이에요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.", "In your own or a parent’s name, ₩8,000,000 or more. Owner, validity and copies can differ from the visa deposit certificate.") }),
    doc("jbnu-lang-family", "apply", L3("가족관계증명서", "Family relation certificate"), { note: L3("가족 구성원이 모두 나와야 해요.", "All family members must be listed.") })
  ],
  deadlines: []
});
var WKU_UG = freeze({
  source: freeze({ title: L3("원광대학교 2027학년도 1학기(3월) 외국인 학부 신(편)입학 모집요강(안)", "Wonkwang University, Spring 2027 undergraduate international admissions guide (draft)"), url: "https://ipsi.wku.ac.kr/detail.do?menuurl=qBExJT7yxTZkr1QAFxkj1g%3D%3D&board_seq=9786" }),
  id: "docs-wku-ug",
  checkedAt: "2026-11-22",
  term: L3("2027학년도 1학기 요강 기준", "Based on the Spring 2027 guide"),
  ask: L3("원광대 국제교류과(063-850-5843, 요강 문의처)", "Wonkwang University Office of International Affairs (+82-63-850-5843, from the guide)"),
  how: L3("방문이나 우편으로 국제교류과에 내요. 온라인 접수는 없어요. 전형료는 100,000원이고 돌려주지 않아요.", "Submit in person or by post to the Office of International Affairs. There is no online application. The fee is ₩100,000 and is not refunded."),
  status: L3("요강 파일 이름에 「(안)」이 붙어 있어 바뀔 수 있어요.", "The guide file is marked as a draft, so it may change."),
  rules: [L3("서류는 한국어나 영어만 받아요. 다른 언어면 번역본에 번역자 확인서와 번역자 신분증 사본을 붙여요. 번역 공증은 요구하지 않아요.", "Only Korean or English documents are accepted. Other languages need a translation with the translator confirmation form and a copy of the translator’s ID. Notarization is not required.")],
  unclear: [],
  docs: [
    doc("wku-ug-forms", "apply", L3("입학원서 · 개인정보 수집 및 이용 동의서(대학 서식)", "Application form and privacy consent (university forms)")),
    doc("wku-ug-grad", "apply", L3("고등학교 졸업(예정)증명서", "High school (expected) graduation certificate"), {
      note: L3("원본이에요. 졸업예정자는 졸업예정증명서를 낼 수 있고, 졸업 뒤 졸업증명서와 학력인증 서류를 입학 전까지 내요.", "Original. If you are about to graduate you may submit the expected-graduation certificate, then the graduation certificate and verification before entry."),
      unclear: L3("「졸업 후 1년이 넘었으면 표준입학허가서 발행 전에 졸업증명서를 낸다」는 문장이 졸업예정자에게도 해당하는지 요강에서 갈리지 않아요.", "The guide does not make clear whether the rule “if more than a year has passed since graduation, submit the certificate before the admission letter is issued” applies to students about to graduate.")
    }),
    doc("wku-ug-transcript", "apply", L3("고등학교 전체 성적증명서", "High school transcript (all years)"), { note: L3("사본이에요.", "A copy.") }),
    doc("wku-ug-verify", "apply", L3("고교 학력인증(아포스티유)", "High school diploma verification (apostille)"), {
      when: L3("3개월 안에 발급된 것이 원칙이에요. 비자 발급 때(2월) 6개월 안이면 인정될 수 있어요.", "Issued within 3 months as a rule; within 6 months at visa time (February) may be accepted."),
      note: L3("원본이에요.", "Original."),
      unclear: L3("아포스티유가 졸업증명서에만 필요한지 성적증명서까지 필요한지 적혀 있지 않아요.", "The guide does not say whether the apostille is needed only for the graduation certificate or also for the transcript.")
    }),
    doc("wku-ug-passport", "apply", L3("여권 사본", "Passport copy"), { when: L3("여권이 6개월 이상 남아 있어야 해요.", "At least 6 months of passport validity.") }),
    doc("wku-ug-family", "apply", L3("가족관계증명서", "Family relation certificate"), { note: L3("사본이에요.", "A copy.") }),
    doc("wku-ug-parents-id", "apply", L3("부 · 모 신분증 사본", "Copies of parents’ ID cards")),
    doc("wku-ug-translator", "apply", L3("번역자 확인서와 번역자 신분증 사본", "Translator confirmation form and translator’s ID copy"), { only: only("번역본을 내는 사람만", "Only if you submit translations") }),
    doc("wku-ug-arc", "apply", L3("외국인등록증 사본", "Alien registration card copy"), { only: only("한국에 살고 있는 사람만", "Only if you live in Korea") }),
    doc("wku-ug-language", "apply", L3("어학(한국어 · 영어) 입증 서류", "Language proof (Korean or English)"), { only: only("한국어나 영어 성적이 있는 사람만", "Only if you have a Korean or English score"), note: L3("입학할 때는 필수가 아니에요.", "It is not required for admission.") }),
    doc("wku-ug-bank", "admitted", L3("재정능력 입증서류", "Proof of funds"), {
      when: L3("발급일부터 1개월 안. 합격 통보 뒤 등록 기간 안에 발급받아요.", "Within 1 month of issue; get it after the admission notice, during registration."),
      note: L3("원본 2부(출입국 · 재외공관용과 대학용)예요. 본인 명의로 1,600만 원 이상이고, 통장 앞뒤 사본과 은행 연락처가 있는 서식이 필요해요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.", "Two originals (one for immigration, one for the university), in your own name, ₩16,000,000 or more, with copies of both sides of the bankbook and a bank form showing the bank’s contact. Owner, validity and copies can differ from the visa deposit certificate.")
    })
  ],
  deadlines: []
});
var WKU_LANG = freeze({
  source: freeze({ title: L3("2026 원광대학교 한국문화교육센터 모집요강", "Wonkwang University Korean Culture Education Center admissions guide, 2026"), url: "https://ipsi.wku.ac.kr/detail.do?menuurl=8pYtphfeWm2Bb85hdKCTcQ%3D%3D&board_seq=7060" }),
  id: "docs-wku-lang",
  checkedAt: "2026-11-22",
  term: L3("2026학년도 요강의 2027 봄학기 일정", "Spring 2027 dates from the 2026 guide"),
  ask: L3("원광대 한국문화교육센터(063-850-5504, 요강 문의처)", "Wonkwang University Korean Culture Education Center (+82-63-850-5504, from the guide)"),
  how: L3("원본과 사본을 나눠 우편이나 방문으로 내요. 전형료 · 교재비는 100,000원이고 처음 입학할 때 한 번 내요.", "Submit originals and copies by post or in person. The application and textbook fee of ₩100,000 is paid once, at first entry."),
  status: L3("2026학년도 요강이에요. 2027 봄학기 일정은 이 요강의 일정표에서 읽었어요.", "This is the 2026 guide; the spring 2027 dates come from its schedule table."),
  rules: [L3("한국어 · 영어가 아닌 서류는 한국어나 영어 번역본을 함께 내요.", "Documents not in Korean or English need a Korean or English translation.")],
  unclear: [],
  docs: [
    doc("wku-lang-form", "apply", L3("입학지원서(사진 3.5 × 4.5cm)", "Application form (photo 3.5 × 4.5 cm)")),
    doc("wku-lang-essay", "apply", L3("자기소개서(학업계획 포함)", "Self-introduction (with study plan)")),
    doc("wku-lang-passport", "apply", L3("여권 사본", "Passport copy"), { when: L3("여권이 6개월 이상 남아 있어야 해요.", "At least 6 months of passport validity.") }),
    doc("wku-lang-family", "apply", L3("가족관계증명서", "Family relation certificate"), { note: L3("원본과 사본이에요. 지원자와 부모(또는 배우자)가 모두 나오지 않으면 공증을 붙여요.", "Original and copy. If you and your parents (or spouse) are not all listed, attach a notarization.") }),
    doc("wku-lang-parents-id", "apply", L3("부 · 모 신분증 사본", "Copies of parents’ ID cards")),
    doc("wku-lang-grad", "apply", L3("최종학력 졸업증명서(고등학교 졸업 이상)", "Graduation certificate (high school or higher)"), { note: L3("원본과 사본이에요.", "Original and copy.") }),
    doc("wku-lang-transcript", "apply", L3("최종학력 성적증명서", "Transcript from your last school"), { note: L3("원본과 사본이에요.", "Original and copy.") }),
    doc("wku-lang-verify", "apply", L3("학력인증보고서(아포스티유)", "Diploma verification report (apostille)"), { when: L3("비자 신청일부터 3개월 안에 발급된 것", "Issued within 3 months of the visa application"), note: L3("아포스티유 원본이에요.", "Original apostille.") }),
    doc("wku-lang-translator", "apply", L3("번역자 확인서(출입국 서식)", "Translator confirmation form (immigration form)"), { only: only("번역본을 내는 사람만", "Only if you submit translations") }),
    doc("wku-lang-bank", "admitted", L3("은행잔고증명서", "Bank balance certificate"), { when: L3("비자 신청일 기준 30일 안에 발급된 것", "Issued within 30 days of the visa application"), note: L3("원본이에요. 본인 명의로 800만 원(6,500달러) 이상이에요. 합격한 뒤에 내요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.", "Original, in your own name, ₩8,000,000 (USD 6,500) or more. Submit after admission. Owner, validity and copies can differ from the visa deposit certificate.") })
  ],
  deadlines: []
});
var JJ_UG = freeze({
  source: freeze({ title: L3("2027학년도 전주대학교 전기 외국인 신 · 편입학 특별전형 모집요강", "Jeonju University, Spring 2027 international admissions guide"), url: "https://www.jj.ac.kr/global/admission/guidelines.do" }),
  id: "docs-jj-ug",
  checkedAt: "2026-11-22",
  term: L3("2027학년도 전기 요강 기준", "Based on the Spring 2027 guide"),
  how: L3("oia.jj.ac.kr에서 온라인 원서를 내고 서류와 면접 동영상을 올린 뒤, 서류는 방문 · 택배 · 우편으로 기한까지 국제교육관에 도착하게 보내요. 이메일로는 받지 않아요. 전형료는 120,000원이에요.", "Apply online at oia.jj.ac.kr and upload the documents and interview video, then send the documents in person, by courier or by post so they arrive at the International Education Center by the deadline. Email is not accepted. The fee is ₩120,000."),
  rules: [
    L3("입학원서를 포함한 모든 서류는 원본, 또는 번역공증과 영사인증 · 아포스티유를 받은 것으로 내요.", "All documents, including the application form, must be originals or translated, notarized and apostilled (or consular-confirmed)."),
    L3("원서 사진은 최근 3개월 안에 찍은 3 × 4cm 컬러사진을 스캔해 올려요.", "For the photo, upload a scan of a 3 × 4 cm colour photo taken within the last 3 months.")
  ],
  unclear: [],
  docs: [
    doc("jj-ug-form", "apply", L3("입학원서", "Application form"), { note: L3("인터넷 접수 뒤 출력해 원본 1부를 내요.", "Print after online application and submit one original.") }),
    doc("jj-ug-passports", "apply", L3("지원자와 부모 여권 사본", "Passport copies for you and your parents"), { when: L3("입학 예정일에 유효한 여권", "Valid on the planned entry date") }),
    doc("jj-ug-family", "apply", L3("가족관계 증명서류", "Family relation documents"), {
      note: L3("원본 1부예요. 부모가 이혼하거나 돌아가셨으면 정부 발행 증명서를 더 내요.", "One original. If your parents are divorced or deceased, add the government certificate."),
      unclear: L3("가족관계증명서 원본에 번역 · 공증이 필요한지 이 줄에는 없어요(대체 서류에만 공증이 적혀 있어요).", "This line does not say whether the original needs a translation or notarization (only substitute documents mention notarization).")
    }),
    doc("jj-ug-grad", "apply", L3("고등학교 졸업(예정)증명서(아포스티유 또는 영사확인)", "High school (expected) graduation certificate (apostille or consular confirmation)"), {
      note: L3("원본 1부예요. 졸업예정자는 입학 전에 졸업하지 못하면 입학 허가가 취소돼요. 졸업 뒤 아포스티유를 받은 졸업증명서와 최종 성적증명서를 내요.", "One original. If you do not graduate before entry, admission is cancelled. After graduating, submit the apostilled graduation certificate and the final transcript."),
      unclear: L3("몽골어 증명서에 번역공증이 필요한지 이 줄에는 없고, 요강 앞쪽의 일반 규칙으로만 알 수 있어요.", "This line does not say whether a Mongolian certificate needs a notarized translation; only the general rule at the front of the guide does.")
    }),
    doc("jj-ug-transcript", "apply", L3("고등학교 성적증명서(아포스티유 또는 영사확인, 번역공증)", "High school transcript (apostille or consular confirmation, notarized translation)"), { note: L3("원본 1부예요.", "One original.") }),
    doc("jj-ug-language", "apply", L3("어학능력 입증서류", "Language proof"), { when: L3("원서 접수 시작일에 유효한 것", "Valid on the first day of applications"), note: L3("한국어 트랙은 TOPIK 2급 이상, 세종학당 초급2 이상(온라인 세종학당은 안 됨), 사회통합프로그램 2단계 같은 조건이에요.", "The Korean track needs TOPIK level 2 or higher, King Sejong Institute Beginner 2 or higher (not online), Social Integration Program level 2 or similar.") }),
    doc("jj-ug-arc", "apply", L3("외국인등록증 사본(앞 · 뒷면)", "Alien registration card copy (front and back)"), { only: only("해당하는 사람만(한국에 살고 있는 사람)", "Only if it applies to you (living in Korea)") }),
    doc("jj-ug-video", "apply", L3("면접 동영상", "Interview video"), { note: L3("3분 안, 100MB 이하로 원서 접수 기간에 올려요. 한국어 트랙은 한국어로 답해요.", "Up to 3 minutes and 100 MB, uploaded during the application period. Korean-track applicants answer in Korean.") }),
    doc("jj-ug-bank", "admitted", L3("재정능력 입증서류", "Proof of funds"), { when: L3("원서 접수 뒤에 발급된 것만", "Issued after you applied"), note: L3("원본 1부예요. 최종 합격자만 내요. 본인이나 부모 명의로 1,600만 원(13,000달러) 이상이에요. 기한은 대학이 따로 알려요. 비자 묶음의 예치증명서와는 명의 · 기한 · 부수가 다를 수 있어요.", "One original, final admits only, in your own or a parent’s name, ₩16,000,000 (USD 13,000) or more. The university sets the deadline separately. Owner, validity and copies can differ from the visa deposit certificate.") })
  ],
  deadlines: [
    freeze({ round: "2026-12-01", key: "docs", start: "2026-12-18", label: L3("2차 서류 도착 기한(2차 원서를 낸 사람만 · 대학 도착 기준)", "Round 2 documents must arrive (round 2 applicants only, arrival at the university)") }),
    freeze({ round: "2027-01-04", key: "docs", start: "2027-01-15", label: L3("3차 서류 도착 기한(3차 원서를 낸 사람만 · 대학 도착 기준)", "Round 3 documents must arrive (round 3 applicants only, arrival at the university)") })
  ]
});
var PROGRAM_DOCS = freeze({ "jbnu-ug": JBNU_UG, "jbnu-lang": JBNU_LANG, "wku-ug": WKU_UG, "wku-lang": WKU_LANG, "jj-ug": JJ_UG });
var SPONSOR_CHECK = L3("KVAC 누리집에 「우수 인증 대학은 해당되지 않음」이라고 적혀 있어요. 97만 원이 한 달 소득인지 다른 기준인지도 문장만으로는 확실하지 않아요. 둘 다 KVAC에 물어보세요.", "KVAC says this does not apply to top-certified universities. The text also does not make clear whether ₩970,000 is a monthly income or another measure. Ask KVAC about both.");
var EXEMPT = L3("KVAC 누리집에 「우수 인증 대학은 해당되지 않음」이라고 적혀 있어요. 내 대학이 해당되는지는 KVAC에 물어보세요.", "KVAC says this does not apply to top-certified universities. Ask KVAC whether your university counts.");
var visaCommon = (p, src) => [
  doc(`${p}-form`, "visa", L3("사증발급신청서(비자 신청서)", "Visa application form")),
  doc(`${p}-photo`, "visa", L3("컬러사진(3.5 × 4.5cm)", "Colour photo (3.5 × 4.5 cm)"), { when: L3("최근 6개월 안에 찍은 것", "Taken within the last 6 months"), note: L3("흰색이나 황백색 배경, 정면, 선글라스 · 모자 없이 눈과 귀가 보여야 해요.", "White or off-white background, facing forward, no sunglasses or hat, eyes and ears visible.") }),
  doc(`${p}-passport`, "visa", L3("여권과 여권 사본 1매", "Passport and one copy"), { when: L3("접수일부터 6개월 이상 남아 있어야 해요.", "At least 6 months of validity from the application date.") }),
  doc(`${p}-essay`, "visa", L3("자기소개서(KVAC 서식, 본인 서명)", "Self-introduction (KVAC form, signed by you)"), { unclear: L3("KVAC 누리집에 「전액 장학생 및 우수 인증 대학은 해당되지 않음」이라고 적혀 있어요. 내가 해당되는지는 KVAC에 물어보세요.", "KVAC says this does not apply to full scholarship holders and top-certified universities. Ask KVAC whether that includes you.") }),
  doc(`${p}-admission`, "visa", L3("표준입학허가서", "Standard certificate of admission"), { from: L3("합격한 대학이 보내 줘요.", "Sent by the university after admission."), when: L3("유효기간 3개월", "Valid for 3 months") }),
  doc(`${p}-bizreg`, "visa", L3("교육기관 사업자등록증 사본", "Copy of the school’s business registration"), { from: L3("대학에서 받아요.", "From the university."), when: L3("최근 6개월 안에 발급된 것", "Issued within the last 6 months") })
];
var visaTail = (p) => [
  doc(`${p}-sponsor`, "visa", L3("유학경비 부담능력 입증자료", "Proof that your sponsor can pay"), { note: L3("기본은 부모가 입증해요(부모가 없을 때만 형제자매). 유학경비 지원확인서, 신분증과 관계 증명, 사업자는 납세증명서(etax.mta.mn 영문)와 법인상세조회서(E-Mongolia), 직장인은 사회보험료 납부확인서와 재직증명서 원본, 그 밖에는 최근 3개월 은행거래내역서예요. KVAC 누리집에는 「재정능력 총액이 97만 원(250만 투그릭) 이상」이고 최근 6개월 사회보험료 납부내역으로 월평균 소득을 계산한다고 적혀 있어요. 입증하는 사람의 소득 조건으로 읽혀요. KVAC 누리집에서 예치증명서가 아니라 이 서류에 적힌 조건이에요.", "Usually your parents (siblings only if there are no parents): a support confirmation, IDs and proof of relationship; business owners add a tax certificate (English, etax.mta.mn) and a company record (E-Mongolia); employees add social insurance records and an original employment certificate; otherwise 3 months of bank statements. KVAC says the “total financial ability” must be at least ₩970,000 (MNT 2,500,000), with average monthly income taken from 6 months of social insurance. This reads as the sponsor’s income. It is listed separately from the deposit."), unclear: SPONSOR_CHECK }),
  doc(`${p}-civil`, "visa", L3("혼인관계증명서(만 19세 미만은 출생등록증명서)", "Marriage record (under 19: birth registration certificate)"), { from: L3("E-Mongolia에서 외국어로 발급해요.", "Issued in a foreign language from E-Mongolia.") }),
  doc(`${p}-birth`, "visa", L3("출생증명서", "Birth certificate")),
  doc(`${p}-crime`, "visa", L3("범죄경력증명서", "Criminal record certificate"), { from: L3("E-Mongolia에서 외국어로 발급해요.", "Issued in a foreign language from E-Mongolia."), only: only("만 18세 이상이고 처음 신청하는 사람만", "Only if you are 18 or older and applying for the first time") }),
  doc(`${p}-tb`, "visa", L3("결핵진단서", "Tuberculosis test certificate"), { note: L3("KVAC가 지정한 기관에서 받아요. 지정기관 목록 링크는 KVAC 누리집에서 열리지 않아 KVAC에 물어보세요.", "From a KVAC-designated clinic. The list link on the KVAC page does not open, so ask KVAC.") }),
  doc(`${p}-school`, "visa", L3("최종학교 졸업 · 성적증명서 원본(아포스티유)", "Original graduation certificate and transcript (apostille)"), { note: L3("아포스티유를 받은 학력 서류, 또는 영사확인을 받은 서류예요.", "Apostilled education documents, or documents with consular confirmation.") }),
  doc(`${p}-language`, "visa", L3("어학능력 입증서류", "Language proof"), { only: only("어학능력 요건이 있는 대학에 가는 사람만", "Only if your university has a language requirement") })
];
var VISA_DOCS = freeze({
  "D-2": freeze({
    id: "docs-visa-d2",
    name: L3("유학(D-2)", "Student (D-2)"),
    source: KVAC_D22,
    checkedAt: "2026-11-22",
    rules: [L3("몽골어 서류는 번역본 원본에 번역자 신분증 사본과 번역자 확인서를 붙여요. 신청은 비자신청센터(KVAC)나 공인대행법인에 본인이 직접 가는 것이 원칙이에요.", "Mongolian documents need an original translation with the translator’s ID copy and the translator confirmation form. You apply in person at the visa center (KVAC) or an authorized agency as a rule.")],
    docs: [
      ...visaCommon("visa-d2"),
      doc("visa-d2-deposit", "visa", L3("예치증명서와 몽골 계좌 거래내역서", "Deposit certificate and Mongolian bank statement"), { when: L3("비자 신청일 기준 14일 안에 발급, 같은 금액을 30일 이상 유지", "Issued within 14 days of the visa application; keep the amount for at least 30 days"), note: L3("수도권 대학 2,000만 원, 비수도권 대학 1,600만 원 이상이에요. 본인이나 부모의 몽골 은행 계좌 거래내역서를 함께 내요. 대학에 내는 잔고 증명과는 명의 · 기한 · 부수가 다를 수 있어요.", "₩20,000,000 for Seoul-area universities, ₩16,000,000 elsewhere, plus the statement of your own or a parent’s Mongolian bank account. Owner, validity and copies can differ from the bank certificate the university asks for."), unclear: EXEMPT }),
      ...visaTail("visa-d2")
    ]
  }),
  "D-4-1": freeze({
    id: "docs-visa-d4-1",
    name: L3("어학연수(D-4-1)", "Language trainee (D-4-1)"),
    source: KVAC_D42,
    checkedAt: "2026-11-22",
    rules: [L3("몽골어 서류는 번역본 원본에 번역자 신분증 사본과 번역자 확인서를 붙여요. 신청은 비자신청센터(KVAC)나 공인대행법인에 본인이 직접 가는 것이 원칙이에요.", "Mongolian documents need an original translation with the translator’s ID copy and the translator confirmation form. You apply in person at the visa center (KVAC) or an authorized agency as a rule.")],
    docs: [
      ...visaCommon("visa-d4"),
      doc("visa-d4-plan", "visa", L3("연수계획서와 연수과정 운영 현황", "Training plan and program overview"), { from: L3("대학이 준비해요.", "Prepared by the university.") }),
      doc("visa-d4-deposit", "visa", L3("예치증명서와 몽골 은행잔고증명서", "Deposit certificate and Mongolian bank balance certificate"), { when: L3("비자 신청일 기준 2주 안에 발급, 같은 금액을 30일 이상 유지", "Issued within 2 weeks of the visa application; keep the amount for at least 30 days"), note: L3("수도권 대학 1,000만 원, 비수도권 대학 800만 원 이상이에요. KVAC 누리집의 문장이 「800만원 이상(비」에서 끊겨 있어요. 대학에 내는 잔고 증명과는 명의 · 기한 · 부수가 다를 수 있어요.", "₩10,000,000 for Seoul-area universities, ₩8,000,000 elsewhere. The KVAC sentence is cut off after “₩8,000,000 or more (non-”. Owner, validity and copies can differ from the bank certificate the university asks for."), unclear: EXEMPT }),
      ...visaTail("visa-d4")
    ]
  })
});
var visaFor = (program) => program && program.level === "language" ? "D-4-1" : "D-2";
function docsFor(program) {
  const pd = program && PROGRAM_DOCS[program.id];
  if (!pd) return null;
  const visa = VISA_DOCS[visaFor(program)];
  const fits = (d) => !d.only;
  const all = [...pd.docs, ...visa.docs];
  return { program: pd, visa, all, mine: all.filter(fits), notMine: all.filter((d) => !fits(d)) };
}
function deadlineDates(programId) {
  const pd = PROGRAM_DOCS[programId];
  if (!pd) return [];
  return pd.deadlines.map((x) => freeze({ id: `univ-${programId}-${x.round}-${x.key}`, kind: "deadline", start: x.start, label: x.label, docsDue: true }));
}

// experiences/path-app/channel-data.mjs
var L4 = (ko, en) => Object.freeze({ ko, en });
var DATE_KINDS = Object.freeze(["apply", "exam", "result", "deadline"]);
var FOR_YOU = Object.freeze(["topikExam", "finance", "gksGrade", "program"]);
var POST_STATUS = Object.freeze(["official", "announced"]);
var CHANNEL_TONES = Object.freeze(["lapis", "meadow", "ink", "coral"]);
var STALE_DAYS = 90;
var NEW_DAYS = 14;
var CHANNELS = Object.freeze([
  { id: "topik", tone: "lapis", name: L4("TOPIK", "TOPIK"), sub: L4("시험 일정, 접수, 성적 쓰는 법", "Test dates, registration and using your score") },
  { id: "visa", tone: "ink", name: L4("비자와 서류", "Visas and documents"), sub: L4("유학 비자, 잔고 증명, 서류 확인", "Student visas, proof of funds and document checks") },
  { id: "scholarship", tone: "meadow", name: L4("장학금", "Scholarships"), sub: L4("정부 장학금, 대학 장학금, 모집 시기", "Government and university scholarships and when they open") },
  { id: "scam", tone: "coral", name: L4("사기 주의", "Scam alerts"), sub: L4("가짜 유학원 가리는 법, 공식 창구", "Spotting fake agencies and finding the official desks") },
  { id: "univ", tone: "lapis", name: L4("대학 소식", "University news"), sub: L4("공개 모집 요강의 접수 일정", "Application dates from published admissions guides") }
].map(Object.freeze));
var COLLECTING = Object.freeze([L4("한국 생활", "Life in Korea"), L4("취업", "Jobs"), L4("선배 이야기", "Stories from seniors"), L4("부모님 방", "For parents")]);
var freezePost = (p) => Object.freeze({ ...p, points: Object.freeze([...p.points]), dates: Object.freeze((p.dates || []).map(Object.freeze)) });
var KVAC_D23 = "https://www.visaforkorea.mn/ko/study-visa-d-2-1d-2-4";
var POSTS = Object.freeze([
  {
    id: "topik-mn-2026-results",
    channel: "topik",
    status: "official",
    title: L4("몽골에서 본 하반기 TOPIK 성적은 12월에 나와요", "Scores from the autumn TOPIK tests in Mongolia come out in December"),
    points: [
      L4("PBT 제108회(10월 18일 시험) 성적은 12월 10일, 제109회(11월 15일 시험) 성적은 12월 22일에 나와요.", "PBT round 108 (tested Oct 18) results come out on Dec 10, and round 109 (tested Nov 15) on Dec 22."),
      L4("IBT 제16회는 11월 28일 몽골국립대학교에서 치르고 성적은 12월 18일에 나와요. 이 회차 접수는 끝났어요.", "IBT round 16 is held at the National University of Mongolia on Nov 28, with results on Dec 18. Registration for it has closed."),
      L4("TOPIK 성적은 성적 발표일로부터 2년 동안 유효해요.", "TOPIK scores are valid for two years from the results date.")
    ],
    source: { title: L4("TOPIK 누리집 시험 일정", "TOPIK official test schedule"), url: "https://www.topik.go.kr/TWGUID/TWGUID0020.do?searchGubun=ALL" },
    checkedAt: "2026-11-21",
    postedAt: "2026-11-21",
    dates: [
      { id: "topik-ibt16-exam-mn", kind: "exam", start: "2026-11-28", label: L4("IBT 제16회 시험(몽골)", "IBT round 16 test (Mongolia)"), url: "https://topik.mn/ibt/Home/Content/3" },
      { id: "topik-pbt108-result", kind: "result", start: "2026-12-10", label: L4("PBT 제108회 성적 발표", "PBT round 108 results") },
      { id: "topik-ibt16-result", kind: "result", start: "2026-12-18", label: L4("IBT 제16회 성적 발표", "IBT round 16 results") },
      { id: "topik-pbt109-result", kind: "result", start: "2026-12-22", label: L4("PBT 제109회 성적 발표", "PBT round 109 results") }
    ],
    forYou: "topikExam",
    action: { label: L4("TOPIK 누리집 열기", "Open the TOPIK site"), url: "https://www.topik.go.kr/" }
  },
  {
    id: "topik-2027-plan",
    channel: "topik",
    status: "official",
    title: L4("2027년 TOPIK 일정이 나왔어요. 몽골 회차는 1월에 공지돼요", "2027 TOPIK dates are out. Mongolia rounds will be announced in January"),
    points: [
      L4("2027년에는 PBT가 제110회부터 제115회까지 여섯 번, IBT가 제17회부터 제22회까지 여섯 번 열려요(교육부 공고 제2026-419호).", "In 2027 there are six PBT rounds (110–115) and six IBT rounds (17–22), under Ministry of Education notice 2026-419."),
      L4("몽골에서 어느 회차를 여는지와 몽골 접수 기간은 아직 공지되지 않았어요. 국외 PBT 시행 국가와 접수처는 2027년 1월 중 TOPIK 누리집에 올라와요.", "Which rounds run in Mongolia, and when registration opens there, has not been announced. Overseas PBT countries and registration offices will be posted on the TOPIK site in January 2027."),
      L4("몽골 접수 기간은 한국 국내와 달라요. 2026년 제109회는 몽골 접수가 8월 17~21일, 국내 접수가 9월 1~7일이었어요. 몽골에서는 topik.mn에서 접수해요.", "Registration in Mongolia runs on different dates from Korea. For round 109 in 2026, Mongolia took registrations Aug 17–21 while Korea took them Sep 1–7. In Mongolia you register at topik.mn.")
    ],
    source: { title: L4("TOPIK 누리집 「2027년 한국어능력시험 시행계획 공고」", "TOPIK site: 2027 TOPIK administration plan"), url: "https://www.topik.go.kr/TWINFO/TWINFO0011.do?bbsId=BBSMSTR00076&nttId=140003" },
    checkedAt: "2026-11-21",
    postedAt: "2026-11-21",
    dates: [],
    forYou: null,
    action: { label: L4("몽골 TOPIK 접수처(topik.mn)", "TOPIK registration in Mongolia (topik.mn)"), url: "https://topik.mn/" }
  },
  {
    id: "visa-funds-proof",
    channel: "visa",
    status: "official",
    title: L4("유학 비자 잔고 증명, 얼마를 얼마 동안", "Proof of funds for a student visa: how much, and for how long"),
    points: [
      L4("유학(D-2)과 어학연수(D-4) 비자를 신청할 때 은행 잔고 증명이 필요해요. 금액은 비자 종류와 대학이 수도권인지에 따라 달라요.", "Student (D-2) and language training (D-4) visas need proof of funds. The amount depends on the visa and on whether the school is in the Seoul area."),
      L4("몽골에서 신청할 때는 예치(잔고) 증명서와 본인이나 부모의 몽골 은행 계좌 거래내역서를 내요. 언제 발급받는지와 얼마 동안 유지하는지에도 조건이 있어요.", "In Mongolia you submit a deposit (balance) certificate and the statement of your own or a parent’s Mongolian bank account. There are rules on when it is issued and how long the money is kept."),
      L4("법무부가 TOPIK 4급이 있으면 이 증명을 면제하는 계획을 발표했지만 시행일은 정해지지 않았어요. 지금은 증명이 필요해요.", "The Ministry of Justice has announced a plan to waive this proof for TOPIK level 4, but no start date has been set. For now the proof is required.")
    ],
    // KVAC에서 읽은 사실은 출처 줄(법무부)과 따로 날짜와 함께 적는다.
    note: L4("KVAC 몽골 유학(D-2) 서류 목록 7번 칸(2026-11-22 확인): 예치증명서와 본인 또는 부모의 몽골 은행 계좌 거래내역서. 같은 칸에 「우수 인증 대학은 해당되지 않음」이라고 적혀 있어요. 내 학교가 해당되는지는 아래 KVAC 서류 목록에서 확인하세요.", "KVAC Mongolia student visa (D-2) list, item 7 (checked 2026-11-22): a deposit certificate and the transaction statement of your own or a parent’s Mongolian bank account. The same item says it does not apply to top-certified universities. Check whether your school counts in the KVAC list below."),
    source: { title: L4("법무부 2026-10-07 보도자료(별첨의 현행 기준)", "Ministry of Justice press release, 2026-10-07 (current rules in the annex)"), url: "https://www.moj.go.kr/bbs/moj/182/611170/artclView.do" },
    checkedAt: "2026-11-21",
    postedAt: "2026-11-21",
    dates: [],
    forYou: "finance",
    action: { label: L4("KVAC 유학 비자 서류 목록", "KVAC student visa document list"), url: KVAC_D23 }
  },
  {
    id: "visa-docs-mn",
    channel: "visa",
    status: "official",
    title: L4("몽골에서 유학 비자를 낼 때 챙길 서류", "Documents for a student visa applied for in Mongolia"),
    points: [
      L4("KVAC 서류 목록에는 학력 서류를 「아포스티유 확인을 받은 서류」로 내라고 적혀 있어요. 몽골 학교 졸업자는 원본으로 되는지 문구가 분명하지 않으니 KVAC에 먼저 물어보세요.", "The KVAC list asks for academic documents “with an Apostille”. The wording on whether graduates of Mongolian schools may submit originals is unclear, so ask KVAC first."),
      L4("결핵진단서가 필요해요. 대사관이 지정한 울란바토르 병원 아홉 곳에서 받을 수 있고, 병원 목록은 KVAC 누리집에 있어요.", "A tuberculosis certificate is required. You can get it at nine Ulaanbaatar hospitals designated by the embassy; the list is on the KVAC site."),
      L4("몽골어 서류에는 번역본과 번역자 신분증 사본, 「번역자 확인서」를 함께 내요. 심사는 20일 걸리고, KVAC에 본인이 직접 접수할 수 있어요.", "Mongolian-language documents need a translation, a copy of the translator’s ID and a translator’s confirmation form. Review takes 20 days, and you can apply at KVAC yourself.")
    ],
    source: { title: L4("KVAC 몽골 「유학(D-2-1~D-2-4)」 서류 목록", "KVAC Mongolia: Study visa (D-2-1 to D-2-4) documents"), url: KVAC_D23 },
    checkedAt: "2026-11-21",
    postedAt: "2026-11-21",
    dates: [],
    forYou: null,
    action: { label: L4("KVAC 유학 비자 서류 목록", "KVAC student visa document list"), url: KVAC_D23 }
  },
  {
    id: "gks-2027-u",
    channel: "scholarship",
    status: "official",
    title: L4("2027 정부초청장학생(GKS) 학부: 대사관 접수는 끝났고 1월 7일 발표", "2027 GKS undergraduate: embassy applications have closed, results on Jan 7"),
    points: [
      L4("2027 학부 장학생 대사관 전형은 몽골에서 4명을 뽑아요. 일반 전형 2명, 지방 대학에만 지원하는 R-GKS 전형 2명이에요. 접수는 2026년 9월 15~30일에 끝났어요.", "The 2027 undergraduate embassy track selects 4 students from Mongolia: 2 in the general track and 2 in R-GKS, which applies to regional universities only. Applications ran Sep 15–30, 2026 and have closed."),
      L4("지원 조건은 만 25세 미만(2002년 3월 1일 이후 출생), 고등학교 졸업 또는 졸업 예정, 본인과 부모 모두 외국 국적이에요. TOPIK 3급 이상이면 가산점이 있어요.", "You must be under 25 (born on or after Mar 1, 2002), have finished or be finishing high school, and you and both parents must hold non-Korean nationality. TOPIK level 3 or higher earns extra points."),
      L4("장학생은 한국어연수 1년과 학위 과정 동안 등록금(학기당 500만 원 한도), 왕복 항공료, 학업장려금(학위 기간 한 해 1,440만 원)을 받아요. 최종 합격 발표는 2027년 1월 7일 예정이에요.", "Scholars get one year of Korean training plus the degree, with tuition (up to ₩5,000,000 a semester), round-trip airfare and a stipend (₩14,400,000 a year during the degree). Final results are planned for Jan 7, 2027.")
    ],
    source: { title: L4("주몽골 한국대사관 「2027 정부초청 외국인(몽골국적) 학부 장학생 모집」", "Korean Embassy in Mongolia: 2027 GKS undergraduate call"), url: "https://overseas.mofa.go.kr/mn-ko/brd/m_373/view.do?seq=1339551" },
    checkedAt: "2026-11-21",
    postedAt: "2026-11-21",
    dates: [{ id: "gks-2027-u-final", kind: "result", start: "2027-01-07", label: L4("GKS 학부 최종 합격 발표(예정)", "GKS undergraduate final results (planned)") }],
    forYou: "gksGrade",
    criteria: { gradePct: 80, of: L4("고등학교 전 학년 성적", "all high school years"), other: L4("또는 석차 상위 20% 안, 또는 CGPA 2.64/4.0 이상", "or the top 20% of your class, or a CGPA of 2.64/4.0 or higher") },
    action: null
  },
  {
    id: "gks-2027-g",
    channel: "scholarship",
    status: "official",
    title: L4("2027 GKS 대학원 장학생은 아직 공고 전이에요", "2027 GKS graduate scholarships have not been announced yet"),
    points: [
      L4("2027 대학원 장학생 요강은 2026년 11월 21일 현재 Study in Korea에 올라오지 않았어요. 2026년에는 2월 2일에 요강이 올라왔어요.", "As of Nov 21, 2026 the 2027 graduate guidelines are not on Study in Korea. In 2026 they were posted on Feb 2."),
      L4("2026년 몽골 대사관 전형은 2월 12~25일에 접수했고 일반과정 13명을 뽑았어요.", "In 2026 the Mongolia embassy track took applications Feb 12–25 and selected 13 students for the general program."),
      L4("2026년 기준 지원 조건은 40세 미만, 학사 또는 석사 졸업, 직전 과정 평균 80% 이상이에요. 2027년 요강이 나오면 다시 확인하세요.", "The 2026 requirements were: under 40, a bachelor’s or master’s degree, and an average of 80% or higher in your last program. Check again when the 2027 guidelines come out.")
    ],
    source: { title: L4("Study in Korea 「정부초청 장학금」 안내", "Study in Korea: Government scholarships"), url: "https://www.studyinkorea.go.kr/ko/plan/scholarship.do" },
    checkedAt: "2026-11-21",
    postedAt: "2026-11-21",
    dates: [],
    forYou: null,
    action: null
  },
  {
    id: "scam-visa-guarantee",
    channel: "scam",
    status: "official",
    title: L4("「비자를 받아 준다」는 말은 믿지 마세요", "Do not trust anyone who promises you a visa"),
    points: [
      L4("비자는 대사관이 심사해서 내줘요. KVAC는 어떤 개인이나 제3자도 비자 발급을 보장할 수 없다고 공지했어요(2026-01-23).", "Visas are reviewed and issued by the embassy. KVAC has announced that no individual or third party can guarantee a visa (2026-01-23)."),
      L4("KVAC 예약은 무료이고 이메일과 전화로만 받아요. 비자 수수료와 서비스 수수료는 신청할 때 KVAC에서 내고 영수증을 받아요.", "KVAC appointments are free and taken only by email and phone. Visa and service fees are paid at KVAC when you apply, and you get a receipt."),
      L4("대사관은 정해진 수수료보다 많은 돈을 요구하면 사기라고 경고했어요(2026-02-06 취업비자 안내). 의심스러우면 대사관이나 KVAC에 알리세요.", "The embassy has warned that asking for more than the set fee is a scam (2026-02-06, work visa notice). If something seems wrong, tell the embassy or KVAC.")
    ],
    source: { title: L4("KVAC 몽골 「Important Notices」", "KVAC Mongolia: Important Notices"), url: "https://www.visaforkorea.mn/important-notices" },
    checkedAt: "2026-11-21",
    postedAt: "2026-11-21",
    dates: [],
    forYou: null,
    action: { label: L4("KVAC 공식 누리집", "KVAC official site"), url: "https://www.visaforkorea.mn/" }
  },
  {
    id: "scam-check-university",
    channel: "scam",
    status: "official",
    title: L4("지원하기 전에 인증 대학인지 확인하세요", "Check that the university is certified before you apply"),
    points: [
      L4("교육부와 법무부가 교육국제화역량을 인증한 대학은 학위과정 181곳, 어학연수과정 123곳이에요. 인증 기간은 2026년 3월부터 2030년 2월까지지만, 해마다 점검해 기준에 못 미치면 인증이 취소되니 지원할 때 명단을 다시 확인하세요.", "The Ministry of Education and the Ministry of Justice have certified 181 universities for degree programs and 123 for language programs, from Mar 2026 to Feb 2030. Certification is checked every year and can be withdrawn, so check the list again when you apply."),
      L4("2026년 2학기부터 1년 동안 비자 발급이 제한되는 대학이 학위과정 16곳, 어학연수과정 4곳 있어요. 같은 대학도 과정마다 따로 정해지니 내가 갈 과정으로 확인하세요.", "For one year from the second semester of 2026, visas are restricted at 16 universities for degree programs and 4 for language programs. Degree and language tracks are judged separately, so check the track you plan to join."),
      L4("KVAC도 학생비자를 신청하기 전에 Study in Korea의 인증 대학 명단에서 학교를 확인하라고 안내해요.", "KVAC also tells students to check the school against the certified list on Study in Korea before applying for a student visa.")
    ],
    source: { title: L4("법무부 · 교육부 「2025년 교육국제화역량 인증 결과」 보도자료(2026-02-12)", "Ministries of Justice and Education: 2025 certification results (2026-02-12)"), url: "https://www.moj.go.kr/bbs/moj/182/603491/artclView.do" },
    checkedAt: "2026-11-21",
    postedAt: "2026-11-21",
    dates: [],
    forYou: null,
    action: { label: L4("Study in Korea 인증 대학 명단", "Study in Korea certified list"), url: "https://www.studyinkorea.go.kr/ko/plan/certifiedUniversity.do" }
  },
  {
    id: "scam-agency-registration",
    channel: "scam",
    status: "announced",
    title: L4("해외 유학원 등록제는 아직 계획이에요", "Registration of overseas study agencies is still only a plan"),
    points: [
      L4("법무부는 2026-10-07에 재외공관과 함께 요건을 갖춘 현지 유학원을 골라 공개하고 관리하는 「해외 유학원 등록제」 계획을 발표했어요.", "On 2026-10-07 the Ministry of Justice announced a plan to select, publish and manage qualified local study agencies together with embassies."),
      L4("추진 일정은 「2027년 하반기까지」로 적혀 있고 시행일은 정해지지 않았어요. 시범 운영할 공관도 공개되지 않았어요.", "The plan says “by the second half of 2027”; no start date has been set, and the pilot embassies have not been named."),
      L4("법무부는 도입 이유로 유학원의 과도한 수수료, 부정확한 정보, 허위 서류 작성을 들었어요. 시행 전인 지금은 대학 요강과 KVAC 안내를 직접 확인하세요.", "The ministry cited excessive agency fees, inaccurate information and false documents. Until it starts, check university guides and KVAC notices yourself.")
    ],
    source: { title: L4("법무부 2026-10-07 보도자료", "Ministry of Justice press release, 2026-10-07"), url: "https://www.moj.go.kr/bbs/moj/182/611170/artclView.do" },
    checkedAt: "2026-11-21",
    postedAt: "2026-11-21",
    dates: [],
    forYou: null,
    action: null
  }
].map((p) => freezePost(p)));
var MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function monthDay(d, en, baseYear) {
  const [y, m, day] = d.split("-").map(Number), yr = baseYear !== void 0 && y !== baseYear;
  return en ? `${MON[m - 1]} ${day}${yr ? `, ${y}` : ""}` : `${yr ? `${y}년 ` : ""}${m}월 ${day}일`;
}
function univPosts(programs) {
  return programs.filter((p) => !p.example && Array.isArray(p.applyRounds) && p.applyRounds.length).map((p) => {
    const rounds = p.applyRounds, many = rounds.length > 1, base = Number(rounds[0][0].slice(0, 4));
    const span = (r, en) => `${monthDay(r[0], en, base)} – ${monthDay(r[1], en, base)}`;
    const roundsText = L4(
      `접수 기간(${base}년): ${rounds.map((r, i) => `${many ? `${i + 1}차 ` : ""}${span(r, false)}`).join(", ")}.`,
      `Application periods (${base}): ${rounds.map((r, i) => `${many ? `round ${i + 1} ` : ""}${span(r, true)}`).join(", ")}.`
    );
    const who = L4(`${p.name.ko}${p.level !== "language" ? " 학부" : ""}`, `${p.name.en}${p.level !== "language" ? " undergraduate" : ""}`);
    const korean = p.requires.topik ? L4(`TOPIK ${p.requires.topik}급 이상이 필요해요. 다른 길도 있는지 요강에서 확인하세요.`, `TOPIK level ${p.requires.topik} or higher is required. Check the guide for other ways to qualify.`) : L4("한국어 성적이 없어도 지원할 수 있어요.", "You can apply without a Korean test score.");
    const ug = p.level !== "language";
    return freezePost({
      id: "univ-" + p.id,
      channel: "univ",
      status: "official",
      title: L4(`${p.name.ko}${ug ? " 학부" : ""}${p.term ? ` ${p.term.ko}` : ""} 원서 접수`, `${p.name.en}${ug ? " undergraduate" : ""}${p.term ? `, ${p.term.en}` : ""}: applications`),
      points: [roundsText, korean, L4("대학이 공개한 모집 요강에서 옮겼어요. SYNK와 협약한 대학은 아니에요.", "Taken from the university’s published admissions guide. Not a SYNK partner university.")],
      source: p.source,
      checkedAt: p.checkedAt,
      postedAt: p.checkedAt,
      // 원서 차수에 서류 기한(3단계 docs-data)을 더해 날짜순으로 둔다. 서류 기한의 id는 그 차수에 매달려 있다.
      dates: [
        ...rounds.map((r, i) => ({ id: `univ-${p.id}-${r[0]}`, kind: "apply", start: r[0], end: r[1], label: many ? L4(`${i + 1}차 원서 접수`, `Round ${i + 1} applications`) : L4("원서 접수", "Applications"), who })),
        ...deadlineDates(p.id).map((d) => ({ ...d, who }))
      ].sort((a, b) => a.start < b.start ? -1 : a.start > b.start ? 1 : 0),
      // 과정 자료에는 요강 주소만 있고 접수처 주소가 없다(원광대 학부는 방문 · 우편 접수). 접수처 단추를 걸지 않는다.
      forYou: "program",
      programId: p.id,
      action: null
    });
  });
}
function allPosts(programs, posts = POSTS) {
  return [...posts, ...univPosts(programs)];
}
var dueDay = (d) => d.kind === "apply" ? d.end : d.start;
var endDay = (d) => d.kind === "apply" ? d.end : d.start;
function dateStatus(d, now = /* @__PURE__ */ new Date()) {
  if (d.cancelled) return { state: "cancelled", days: null };
  if (d.kind === "apply") {
    const toStart = daysUntil(d.start, now);
    if (toStart !== null && toStart > 0) return { state: "before", days: toStart };
    const toEnd = daysUntil(d.end, now);
    return toEnd === null ? { state: "past", days: null } : { state: "open", days: toEnd };
  }
  const days = daysUntil(d.start, now);
  return days === null ? { state: "past", days: null } : { state: "soon", days };
}
function findDate(posts, id) {
  for (const post2 of posts) for (const date of post2.dates) if (date.id === id) return { post: post2, date };
  return null;
}
function upcomingDates(posts, saved, now = /* @__PURE__ */ new Date()) {
  const rows = [];
  let missing = 0;
  for (const s of saved) {
    const hit = findDate(posts, s.id);
    if (!hit) {
      missing++;
      continue;
    }
    const d = hit.date, end = endDay(d);
    const changed = s.start !== d.start || s.end !== end ? { start: s.start, end: s.end } : null;
    const status = dateStatus(d, now);
    rows.push({ ...hit, due: status.state === "before" ? d.start : dueDay(d), status, changed });
  }
  const byDue = (a, b) => a.due < b.due ? -1 : a.due > b.due ? 1 : 0;
  const gone = (r) => r.status.state === "past" || r.status.state === "cancelled";
  return { upcoming: rows.filter((r) => !gone(r)).sort(byDue), past: rows.filter(gone).sort(byDue).reverse(), missing };
}
function daysSince(dateText, now) {
  const t2 = now instanceof Date ? now.getTime() : new Date(now).getTime();
  return Math.floor((t2 + 9 * 36e5) / 864e5) - Date.parse(dateText + "T00:00:00Z") / 864e5;
}
function isStalePost(post2, now = /* @__PURE__ */ new Date(), days = STALE_DAYS) {
  return daysSince(post2.checkedAt, now) > days;
}
function isNewPost(post2, now = /* @__PURE__ */ new Date(), days = NEW_DAYS) {
  return daysSince(post2.postedAt, now) < days;
}
function nextDate(post2, now = /* @__PURE__ */ new Date(), { skipDocs = false } = {}) {
  let best = null;
  for (const d of post2.dates) {
    if (skipDocs && d.docsDue) continue;
    const st = dateStatus(d, now);
    if (st.state === "past" || st.state === "cancelled") continue;
    const due = st.state === "before" ? d.start : dueDay(d);
    if (!best || due < best.due) best = { date: d, status: st, due };
  }
  return best;
}
var newest = (a, b) => a.postedAt < b.postedAt ? 1 : a.postedAt > b.postedAt ? -1 : 0;
function featuredPost(posts, now = /* @__PURE__ */ new Date()) {
  let best = null;
  for (const p of posts) {
    const n = nextDate(p, now, { skipDocs: true });
    if (n && (!best || n.due < best.due)) best = { post: p, due: n.due };
  }
  return best ? best.post : [...posts].sort(newest)[0] || null;
}
function latestPosts(posts, channelsOff = [], n = 2) {
  return posts.filter((p) => !channelsOff.includes(p.channel)).sort(newest).slice(0, n);
}
function postById(posts, id) {
  return posts.find((p) => p.id === id) || null;
}

// experiences/path-app/match.mjs
var MATCH_KEYS = Object.freeze(["education", "grade", "topik", "finance"]);
var num = (v, min, max) => typeof v === "number" && Number.isFinite(v) && v >= min && v <= max ? v : null;
function countNeeds(programs) {
  return ["gradePct", "topik"].filter((k) => !Array.isArray(programs) || programs.some((p) => p.requires[k] > 0));
}
function readyToCount(profile2, programs) {
  return countNeeds(programs).every((k) => Number.isInteger(profile2?.[k]));
}
function matchProgram(profile2, program, rules) {
  const p = profile2 || {};
  const need = program.requires;
  const items = [];
  const edu = p.education === "graduated" || p.education === "expected" ? "ok" : p.education === "none" ? "lack" : "check";
  items.push({ key: "education", status: edu, need: need.education, mine: p.education ?? null, gap: null, rule: null });
  const grade = num(p.gradePct, 0, 100);
  items.push({ key: "grade", status: need.gradePct === 0 ? "ok" : grade === null ? "check" : grade >= need.gradePct ? "ok" : "lack", need: need.gradePct, mine: grade, gap: grade === null ? null : Math.max(0, need.gradePct - grade), rule: null });
  const topik = Number.isInteger(p.topik) ? num(p.topik, 0, MAX_TOPIK) : null;
  const topikStatus = need.topik === 0 ? "ok" : topik === null ? "check" : topik >= need.topik ? "ok" : "lack";
  items.push({ key: "topik", status: topikStatus, need: need.topik, mine: topik, gap: topik === null ? null : Math.max(0, need.topik - topik), rule: null });
  const rule = financeRule(rules, program.visa, program.region);
  const funds = num(p.fundsWon, 0, Number.MAX_SAFE_INTEGER);
  const firm = !!rule && rule.inCurrentGuide === true && !rule.stale;
  const fin = !firm || funds === null ? "check" : funds >= rule.won ? "ok" : "lack";
  items.push({ key: "finance", status: fin, need: rule ? rule.won : null, mine: funds, gap: rule && funds !== null ? Math.max(0, rule.won - funds) : null, rule, firm });
  const okCount = items.filter((i) => i.status === "ok").length;
  const canApplyAcademically = items[1].status === "ok" && items[2].status === "ok";
  const fits = canApplyAcademically && items.every((i) => i.status !== "lack");
  return { items, okCount, canApplyAcademically, fits };
}
function programCost(profile2, program) {
  const topik = Number.isInteger(profile2?.topik) ? profile2.topik : null;
  const level = topik ?? 0;
  const { tuition, dorm, living } = program.costs;
  let step = null;
  for (const s of program.scholarship) if (level >= s.topik) step = s;
  const scholarship = step ? scholarshipAmount(program, step) : 0;
  const rate = !step ? 0 : typeof step.tuitionRate === "number" ? step.tuitionRate : null;
  const known = tuition + (dorm ?? 0) + (living ?? 0);
  const missing = ["dorm", "living"].filter((k) => program.costs[k] === null);
  const total = known - scholarship;
  const next = program.scholarship.find((s) => s.topik > level && scholarshipAmount(program, s) > scholarship) || null;
  const nextLevel = next ? { topik: next.topik, total: known - scholarshipAmount(program, next) } : null;
  return { tuition, dorm, living, scholarship, rate, stepTopik: step ? step.topik : null, total, nextLevel, missing };
}
function countFit(profile2, programs, rules, topik) {
  const p = topik === void 0 ? profile2 : { ...profile2 || {}, topik };
  if (!readyToCount(p, programs)) return null;
  return programs.filter((x) => matchProgram(p, x, rules).fits).length;
}
function routes(profile2, programs, rules, now = /* @__PURE__ */ new Date()) {
  const ready = readyToCount(profile2, programs);
  const topik = Number.isInteger(profile2?.topik) ? profile2.topik : null;
  const of = (level) => programs.filter((x) => x.level === level);
  const summarize = (list) => {
    const needs = list.map((x) => x.requires.topik).filter((n) => n > 0);
    const lowest = needs.length ? Math.min(...needs) : 0;
    const topikGap = topik === null ? null : Math.max(0, lowest - topik);
    if (!list.length) return { status: "none", count: 0, academic: 0, open: 0, total: 0, lowestTopik: lowest, topikGap };
    const matched = list.map((x) => [x, matchProgram(profile2, x, rules)]);
    const fit = matched.filter(([, m]) => m.fits);
    const academic = matched.filter(([, m]) => m.canApplyAcademically).length;
    const open = fit.filter(([x]) => ["open", "before"].includes(applyWindow(x, now).state)).length;
    const status = !ready ? "check" : fit.length ? "ok" : "lack";
    return { status, count: fit.length, academic, open, total: list.length, lowestTopik: lowest, topikGap };
  };
  return { languageFirst: summarize(of("language")), direct: summarize(of("undergraduate")) };
}

// experiences/path-app/channel-ui.mjs
var esc4 = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var svg2 = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
var GO = svg2('<path d="M4 10h11.5M11 5.5 15.5 10 11 14.5"/>');
var BACK2 = svg2('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
var NEXT = svg2('<path d="M7.5 4.5 13 10l-5.5 5.5"/>');
var ICON = {
  topik: svg2('<path d="M4 15.5 13.5 6l1.5 1.5L5.5 17H4z"/><path d="M12 7.5 13.5 9"/>'),
  visa: svg2('<path d="M6 3h6l3 3v11H6z"/><path d="M12 3v3h3M8.5 10h4M8.5 13h4"/>'),
  scholarship: svg2('<path d="M10 3.5l1.9 4 4.3.5-3.2 2.9.9 4.3L10 13.1l-3.9 2.1.9-4.3L3.8 8l4.3-.5z"/>'),
  scam: svg2('<path d="M10 3.5 17 16H3z"/><path d="M10 8.5v3.5M10 14.2v.1"/>'),
  univ: svg2('<path d="M2.5 8 10 4.5 17.5 8 10 11.5z"/><path d="M5.5 9.5v4c1.2 1.2 2.7 1.8 4.5 1.8s3.3-.6 4.5-1.8v-4"/>')
};
var ON2 = svg2('<path d="m5 10.4 3.2 3.1L15 6.6"/>');
var CAL = svg2('<rect x="3.5" y="4.5" width="13" height="12" rx="2"/><path d="M3.5 8.5h13M7 3v3M13 3v3"/>');
function ctx(view) {
  const now = view.now || /* @__PURE__ */ new Date();
  const en = view.lang === "en";
  const L5 = (ko, e) => en ? e : ko;
  const pick2 = (o) => o ? en ? o.en : o.ko : "";
  const won = (n) => en ? `₩${n.toLocaleString("en-US")}` : n < 1e4 ? `${n.toLocaleString("ko-KR")}원` : n % 1e4 === 0 ? `${(n / 1e4).toLocaleString("ko-KR")}만 원` : `${Math.floor(n / 1e4).toLocaleString("ko-KR")}만 ${(n % 1e4).toLocaleString("ko-KR")}원`;
  const thisYear = Number(new Date((now instanceof Date ? now.getTime() : new Date(now).getTime()) + 9 * 36e5).toISOString().slice(0, 4));
  const md = (d) => monthDay(d, en, thisYear);
  return { now, en, L: L5, pick: pick2, won, md, posts: view.posts || [], programs: view.programs || [], rules: view.rules || [], profile: view.profile, lang: en ? "en" : "ko", condOn: view.condOn !== false, store: ["account", "blocked", "wait"].includes(view.store) ? view.store : "tab", storeNote: String(view.storeNote || ""), persisted: view.persisted !== false, note: typeof view.note === "string" ? view.note : "" };
}
var channelOf = (id) => CHANNELS.find((c) => c.id === id) || null;
var newTab = (T2) => `<span class="sr-only"> (${T2.L("새 탭에서 열림", "opens in new tab")})</span>`;
var promise = (T2) => `<p class="sx-fine">${T2.L("이 결과는 입학이나 비자, 장학금 선발을 약속하지 않아요. 마지막 판단은 대학과 출입국, 장학 기관이 해요.", "This does not promise admission, a visa or a scholarship. The university, the immigration office and the scholarship body make the final decision.")}</p>`;
var storeLine = (T2) => (T2.store === "blocked" || T2.store === "wait") && T2.storeNote ? `<p class="sx-fine sx-store-line">${esc4(T2.storeNote)}</p>` : T2.store === "account" ? `<p class="sx-fine sx-store-line">${T2.L("넣은 날은 계정에 저장돼요. 달력에도 넣어 두면 잊지 않아요.", "Dates you add are saved to your account. Add them to your calendar too.")}</p>` : T2.persisted ? `<p class="sx-fine sx-store-line">${T2.L("넣은 날은 이 탭에만 있어요. 탭을 닫거나 로그아웃하면 사라지니 달력에도 넣어 두세요.", "Dates you add stay in this tab only. They disappear when you close the tab or sign out, so add them to your calendar too.")}</p>` : `<p class="sx-store is-warn sx-store-line">${T2.L("이 브라우저에서는 저장할 수 없어서 넣은 날을 지금 화면에서만 기억해요. 새로 고치면 사라지니 달력에 넣어 두세요.", "This browser cannot store dates, so they are remembered on this screen only and are lost on reload. Add them to your calendar.")}</p>`;
function leftText(status, T2) {
  const n = status.days, days = (k) => T2.L(`${k}일`, `${k} day${k === 1 ? "" : "s"}`);
  switch (status.state) {
    case "before":
      return { shown: T2.L(`시작 D-${n}`, `Opens in ${days(n)}`), said: T2.L(`${n}일 뒤 접수 시작`, `Opens in ${days(n)}`) };
    case "open":
      return n === 0 ? { shown: T2.L("오늘 마감", "Closes today"), said: T2.L("오늘 마감", "Closes today") } : { shown: T2.L(`마감 D-${n}`, `${days(n)} left`), said: T2.L(`마감까지 ${n}일 남음`, `${days(n)} left to apply`) };
    case "soon":
      return n === 0 ? { shown: T2.L("오늘", "Today"), said: T2.L("오늘", "Today") } : { shown: T2.L(`D-${n}`, `${days(n)} left`), said: T2.L(`${n}일 남음`, `${days(n)} left`) };
    case "cancelled":
      return { shown: T2.L("취소됨", "Cancelled"), said: T2.L("취소됨", "Cancelled") };
    default:
      return { shown: T2.L("지남", "Past"), said: T2.L("지난 날", "Past") };
  }
}
function spanText(d, T2) {
  if (d.kind !== "apply") return T2.md(d.start);
  const [sy, sm] = d.start.split("-"), [ey, em, ed] = d.end.split("-");
  if (!T2.en && sy === ey && sm === em) return `${T2.md(d.start)}~${Number(ed)}일`;
  return `${T2.md(d.start)} – ${T2.md(d.end)}`;
}
var near = (st) => (st.state === "open" || st.state === "soon") && st.days !== null && st.days <= 14;
function dayBox(d, st, T2) {
  const day = st.state === "before" ? d.start : dueDay(d);
  const [, m, dd] = day.split("-").map(Number);
  return `<span class="sx-day${near(st) ? " is-near" : ""}" aria-hidden="true"><small>${T2.en ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1] : `${m}월`}</small><b>${dd}</b></span>`;
}
function forYouLines(post2, view) {
  const T2 = view.T || ctx(view), p = T2.profile || {};
  const enter = (what) => ({ text: T2.L(`${what.ko}을 넣으면 나란히 보여 줘요.`, `Enter ${what.en} to see it side by side.`), cond: true });
  if (post2.forYou === "program") {
    const prog = programById(T2.programs, post2.programId);
    if (!prog) return [];
    if (isEmptyProfile(p)) return [{ text: T2.L("내 조건(한국어, 성적, 학력, 준비한 돈)을 넣으면 이 과정과 맞춰 봐요.", "Enter your conditions (Korean, grades, education, funds) to compare them with this program."), cond: true }];
    const m = matchProgram(p, prog, T2.rules);
    return [{ text: T2.L(`내 조건 4개 중 ${m.okCount}개 맞음. 「확인 필요」는 맞음으로 세지 않아요.`, `${m.okCount} of 4 conditions met. “To check” is not counted as met.`) }];
  }
  if (post2.forYou === "finance") {
    const lines = [];
    for (const [visa, name] of [["D-4", T2.L("어학연수(D-4)", "Language training (D-4)")], ["D-2", T2.L("유학(D-2)", "Study (D-2)")]]) {
      const parts = [["local", T2.L("지방 대학", "outside Seoul area")], ["metro", T2.L("수도권 대학", "Seoul area")]].map(([region, label]) => {
        const r = financeRule(T2.rules, visa, region);
        if (!r) return null;
        const firm = r.inCurrentGuide === true && !r.stale;
        return firm ? `${label} ${T2.won(r.won)}` : `${label} ${T2.L("금액 확인 중(비교하지 않음)", "amount being confirmed (not compared)")}`;
      }).filter(Boolean);
      if (parts.length) lines.push({ text: `${name}: ${parts.join(", ")}` });
    }
    lines.push(p.fundsWon === null || p.fundsWon === void 0 ? enter({ ko: "준비한 돈", en: "your funds" }) : { text: T2.L(`내 값: ${T2.won(p.fundsWon)}`, `Yours: ${T2.won(p.fundsWon)}`) });
    const proof = proofRule(T2.rules, "D-2");
    if (proof) lines.push({ text: T2.L(`잔고 증명서는 비자 신청일 기준 ${proof.issuedWithinDays}일 안에 발급받고, 그 금액을 ${proof.heldDays}일 이상 유지해야 해요.`, `The balance certificate must be issued within ${proof.issuedWithinDays} days of the visa application, and the amount kept for at least ${proof.heldDays} days.`) });
    const waiver = announcedRules(T2.rules, "finance-waiver")[0];
    if (waiver) lines.push({ text: T2.L(`계획 발표: TOPIK ${waiver.topik}급이 있으면 이 증명을 면제하는 계획이 ${waiver.basis}에 발표됐어요. 시행일은 정해지지 않아 대조에 쓰지 않았어요.`, `Announced plan: waiving this proof for TOPIK level ${waiver.topik} was announced on ${waiver.basis}. No start date has been set, so it is not used here.`), plan: true });
    return lines;
  }
  if (post2.forYou === "gksGrade") {
    const c = post2.criteria;
    const rule = { text: T2.L(`기준: ${c.of ? `${c.of.ko} ` : ""}평균 ${c.gradePct}% 이상${c.other ? ` (${c.other.ko})` : ""}`, `Requirement: ${c.of ? `${c.of.en}, ` : ""}average of ${c.gradePct}% or higher${c.other ? ` (${c.other.en})` : ""}`) };
    return [rule, p.gradePct === null || p.gradePct === void 0 ? enter({ ko: "성적 평균", en: "your grade average" }) : { text: T2.L(`내 값: 평균 ${p.gradePct}%`, `Yours: ${p.gradePct}% average`) }];
  }
  if (post2.forYou === "topikExam") {
    const results = post2.dates.filter((d) => d.kind === "result" && !d.cancelled);
    const exam = (d) => T2.pick(d.label).replace(/ 성적 발표$| results$/, "");
    const rows = [];
    for (const prog of T2.programs) {
      if (prog.example || !Array.isArray(prog.applyRounds)) continue;
      prog.applyRounds.forEach((round, i) => {
        if (dateStatus({ kind: "apply", start: round[0], end: round[1] }, T2.now).state === "past") return;
        const before = results.filter((r) => round[1] > r.start);
        if (!before.length) return;
        const name = `${T2.pick(prog.name)}${prog.level === "language" ? "" : T2.L(" 학부", " undergraduate")}${prog.applyRounds.length > 1 ? T2.L(` ${i + 1}차`, ` round ${i + 1}`) : ""}`;
        rows.push({ end: round[1], text: T2.L(`${name}(${T2.md(round[1])} 마감): ${before.map(exam).join(", ")}`, `${name} (closes ${T2.md(round[1])}): ${before.map(exam).join(", ")}`) });
      });
    }
    rows.sort((x, y) => x.end < y.end ? -1 : x.end > y.end ? 1 : 0);
    const lines = rows.length ? [{ text: T2.L("지금 목록의 접수 가운데 마감 전에 성적이 나오는 곳이에요.", "Listed applications that close after these results come out:"), lead: true }, ...rows.map((r) => ({ text: r.text }))] : [{ text: T2.L("지금 목록에는 이 성적 발표 뒤에 마감하는 접수가 없어요.", "No listed application closes after these results.") }];
    lines.push({ text: T2.L("성적표를 언제까지 내야 하는지는 과정마다 달라요. 요강에서 확인하세요.", "Each program sets its own deadline for score reports. Check the guide.") });
    return lines;
  }
  return [];
}
function forYouCard(post2, T2) {
  const lines = forYouLines(post2, { T: T2 }).filter((l) => T2.condOn || !l.cond);
  if (!lines.length) return "";
  const cond2 = T2.condOn && lines.some((l) => l.cond) ? `<button type="button" class="sx-link" data-action="nav" data-page="cond">${T2.L("내 조건 넣기", "Enter my conditions")}${NEXT}</button>` : "";
  return `<section class="sx-card butter sx-foryou"><p class="sx-k">${T2.L("내게 해당되나요?", "Does this apply to me?")}</p>${lines.filter((l) => l.lead).map((l) => `<p class="sx-fy-lead">${esc4(l.text)}</p>`).join("")}<ul>${lines.filter((l) => !l.lead).map((l) => `<li${l.plan ? ' class="is-plan"' : ""}>${esc4(l.text)}</li>`).join("")}</ul>${cond2}${post2.programId ? `<button type="button" class="sx-link" data-action="univOpen" data-id="${esc4(post2.programId)}">${T2.L("과정 자세히 보기", "See program details")}${NEXT}</button>` : ""}${promise(T2)}</section>`;
}
function dateRow(post2, d, T2, saved) {
  const st = dateStatus(d, T2.now), left = leftText(st, T2), on = saved.some((s) => s.id === d.id);
  const gone = st.state === "past" || st.state === "cancelled";
  const name = T2.pick(d.label);
  const add = gone && !on ? "" : `<button type="button" class="sx-btn2 sm" aria-pressed="${on}" data-action="dateToggle" data-id="${esc4(d.id)}"><span class="sx-on">${ON2}</span>${T2.L("내 길에 넣기", "Add to my path")}<span class="sr-only"> ${esc4(name)}</span></button>`;
  const cal = gone ? "" : `<button type="button" class="sx-btn2 sm line" data-action="dateIcs" data-id="${esc4(d.id)}">${CAL}${T2.L("달력에 넣기", "Add to calendar")}<span class="sr-only"> ${esc4(name)}</span></button>`;
  return `<li class="sx-dayrow${gone ? " is-gone" : ""}">${dayBox(d, st, T2)}<span class="sx-day-main"><b>${esc4(name)}</b><small>${esc4(spanText(d, T2))}</small>${d.url ? `<a class="sx-src-a" href="${esc4(d.url)}" target="_blank" rel="noopener noreferrer">${T2.L("원문", "Source")}${newTab(T2)}</a>` : ""}</span><span class="sx-dleft${near(st) ? " is-near" : ""}"><span aria-hidden="true">${esc4(left.shown)}</span><span class="sr-only">${esc4(left.said)}</span></span>${add || cal ? `<span class="sx-day-acts">${add}${cal}</span>` : ""}</li>`;
}
function cover(channel, T2) {
  return `<span class="sx-cover is-${esc4(channel.tone)}" aria-hidden="true"><span>${esc4(channel.name.en.toUpperCase())}</span></span>`;
}
function postTag(post2, T2) {
  const n = nextDate(post2, T2.now);
  if (!n) return "";
  return `${T2.pick(n.date.label)} · ${leftText(n.status, T2).shown}`;
}
function renderChannels(view) {
  const T2 = ctx(view), profile2 = T2.profile || {}, off = profile2.channelsOff || [];
  const one = view.channelId ? channelOf(view.channelId) : null;
  if (one) {
    const list = T2.posts.filter((p) => p.channel === one.id);
    const rows2 = list.map((p) => {
      const n = nextDate(p, T2.now), fresh = isNewPost(p, T2.now);
      return `<li><button type="button" class="sx-postrow" data-action="postOpen" data-id="${esc4(p.id)}"><span class="sx-postrow-main"><b>${fresh ? `<span class="sx-tag is-ok">${T2.L("새 글", "New")}</span> ` : ""}${p.status === "announced" ? `<span class="sx-tag is-check">${T2.L("계획 발표", "Announced plan")}</span> ` : ""}${esc4(T2.pick(p.title))}</b><small>${T2.L("확인", "Checked")} ${esc4(p.checkedAt)}${n ? ` · ${esc4(T2.pick(n.date.label))} ${esc4(leftText(n.status, T2).shown)}` : ""}</small></span><span class="sx-go-s" aria-hidden="true">${NEXT}</span></button></li>`;
    }).join("");
    return `<div class="sx"><button type="button" class="sx-back" data-action="channelOpen" data-id="">${BACK2}${T2.L("채널", "News")}</button>
<header class="sx-head"><p class="sx-kicker"><span class="sx-ic is-${esc4(one.tone)}">${ICON[one.id]}</span>${esc4(T2.pick(one.sub))}</p><h1 class="sx-title page-title" tabindex="-1">${esc4(T2.pick(one.name))}</h1></header>
${showButton(one, off, T2)}
${list.length ? `<ul class="sx-postlist">${rows2}</ul>` : `<p class="sx-note">${T2.L("이 채널에는 아직 글이 없어요.", "No posts in this channel yet.")}</p>`}${promise(T2)}</div>`;
  }
  const feat = featuredPost(T2.posts, T2.now);
  const featCh = feat && channelOf(feat.channel);
  const hero = feat && featCh ? `<button type="button" class="sx-photo sx-feature" data-action="postOpen" data-id="${esc4(feat.id)}">${cover(featCh, T2)}<span class="sx-photo-body"><span class="sx-tag white">${esc4(T2.pick(featCh.name))}${postTag(feat, T2) ? ` · ${esc4(postTag(feat, T2))}` : ""}</span><b>${esc4(T2.pick(feat.title))}</b><small>${esc4(T2.pick(feat.points[0]))}</small></span></button>` : "";
  const rows = CHANNELS.map((c) => {
    const list = T2.posts.filter((p) => p.channel === c.id);
    if (!list.length) return "";
    const fresh = list.filter((p) => isNewPost(p, T2.now)).length;
    return `<li class="sx-chrow"><button type="button" class="sx-ch" data-action="channelOpen" data-id="${esc4(c.id)}"><span class="sx-ic is-${esc4(c.tone)}">${ICON[c.id]}</span><span class="sx-ch-main"><b>${esc4(T2.pick(c.name))}</b><small>${esc4(T2.pick(c.sub))} · ${T2.L(`글 ${list.length}개`, `${list.length} post${list.length === 1 ? "" : "s"}`)}${fresh ? T2.L(` · 새 글 ${fresh}`, ` · ${fresh} new`) : ""}</small></span></button>${showButton(c, off, T2)}</li>`;
  }).join("");
  return `<div class="sx sx-wide"><header class="sx-head"><h1 class="sx-title page-title" tabindex="-1">${T2.L("채널", "News")}</h1><p class="sx-lead">${T2.L("한국 유학 소식을 주제별로 모았어요. 모든 글에 공식 출처와 확인한 날이 붙어 있어요.", "Study-in-Korea news by topic. Every post shows its official source and the date we checked it.")}</p></header>
${hero}
<h2 class="sx-h">${T2.L("채널", "Channels")}</h2><ul class="sx-chlist">${rows}</ul>
<p class="sx-fine">${T2.L("글을 모으는 중:", "Collecting posts:")} ${COLLECTING.map((x) => esc4(T2.pick(x))).join(", ")}</p></div>`;
}
function showButton(c, off, T2) {
  const on = !off.includes(c.id);
  return `<button type="button" class="sx-btn2 sm sx-show" aria-pressed="${on}" data-action="channelShow" data-id="${esc4(c.id)}"><span class="sx-on">${ON2}</span>${T2.L("오늘 화면에 보이기", "Show on Today")}<span class="sr-only"> ${esc4(T2.pick(c.name))}</span></button>`;
}
function datesBlock(p, T2, saved, title) {
  if (!p.dates.length) return "";
  const live = p.dates.some((d) => {
    const st = dateStatus(d, T2.now).state;
    return st !== "past" && st !== "cancelled";
  });
  return `<h2 class="sx-h" id="sx-dates-h" tabindex="-1">${title || T2.L("날짜", "Dates")}</h2>${T2.note ? `<p class="sx-store is-warn sx-date-note">${esc4(T2.note)}</p>` : ""}${live ? storeLine(T2) : ""}<ul class="sx-days">${p.dates.map((d) => dateRow(p, d, T2, saved)).join("")}</ul>`;
}
function renderDates(view, post2, title) {
  const T2 = ctx(view);
  return post2 ? datesBlock(post2, T2, T2.profile && T2.profile.dates || [], title) : "";
}
function renderPost(view) {
  const T2 = ctx(view), profile2 = T2.profile || {}, p = postById(T2.posts, view.postId);
  const back = (c2) => `<button type="button" class="sx-back" data-action="channelOpen" data-id="${c2 ? esc4(c2.id) : ""}">${BACK2}${c2 ? esc4(T2.pick(c2.name)) : T2.L("채널", "News")}</button>`;
  if (!p) return `<div class="sx">${back(null)}<h1 class="sx-title page-title" tabindex="-1">${T2.L("글을 찾지 못했어요.", "Post not found.")}</h1></div>`;
  const c = channelOf(p.channel), saved = profile2.dates || [];
  const stale = isStalePost(p, T2.now) ? `<p class="sx-note is-box">${T2.L("확인한 지 90일이 지났어요. 날짜는 공식 안내에서 다시 확인하세요.", "This was checked more than 90 days ago. Check the dates in the official notice.")}</p>` : "";
  const dates = datesBlock(p, T2, saved);
  const action = p.action ? `<a class="sx-cta" href="${esc4(p.action.url)}" target="_blank" rel="noopener noreferrer">${esc4(T2.pick(p.action.label))}${newTab(T2)} ${GO}</a><p class="sx-fine">${T2.L("공식 쪽으로 연결해요. 접수와 신청은 본인이 직접 해요.", "This opens the official site. You apply yourself.")}</p>` : "";
  const tag2 = postTag(p, T2);
  return `<div class="sx">${back(c)}
<div class="sx-photo is-hero sx-post-hero">${cover(c, T2)}${tag2 ? `<span class="sx-photo-body"><span class="sx-tag white">${esc4(tag2)}</span></span>` : ""}</div>
<p class="sx-kicker">${esc4(T2.pick(c.name))} · ${T2.L("올린 날", "Posted")} ${esc4(p.postedAt)}${p.status === "announced" ? ` <span class="sx-tag is-check">${T2.L("계획 발표 · 시행일 미정", "Announced plan · no start date")}</span>` : ""}</p>
<h1 class="sx-title page-title" tabindex="-1">${esc4(T2.pick(p.title))}</h1>${stale}
<ol class="sx-points">${p.points.map((x) => `<li>${esc4(T2.pick(x))}</li>`).join("")}</ol>
${p.note ? `<p class="sx-note is-box">${esc4(T2.pick(p.note))}</p>` : ""}
<p class="sx-src"><b>${T2.L("출처", "Source")}</b> <a href="${esc4(p.source.url)}" target="_blank" rel="noopener noreferrer">${esc4(T2.pick(p.source.title))}${newTab(T2)}</a> · ${T2.L("확인", "checked")} ${esc4(p.checkedAt)}</p>
${forYouCard(p, T2)}${dates}${action}</div>`;
}
function renderUpcoming(view) {
  const T2 = ctx(view), saved = T2.profile && T2.profile.dates || [];
  if (!saved.length) return "";
  const { upcoming, past, missing } = upcomingDates(T2.posts, saved, T2.now);
  const row = (r) => {
    const left = leftText(r.status, T2);
    const changed = r.changed ? `<span class="sx-changed">${T2.L(`날짜가 바뀌었어요(전에 본 날 ${spanText({ kind: r.date.kind, start: r.changed.start, end: r.changed.end }, T2)})`, `Date changed (you saw ${spanText({ kind: r.date.kind, start: r.changed.start, end: r.changed.end }, T2)})`)} <button type="button" class="sx-link sm" data-action="dateConfirm" data-id="${esc4(r.date.id)}">${T2.L("확인했어요", "Got it")}<span class="sr-only"> ${esc4(T2.pick(r.date.label))}</span></button></span>` : "";
    return `<li class="sx-dayrow${r.status.state === "past" || r.status.state === "cancelled" ? " is-gone" : ""}"><button type="button" class="sx-dayrow-btn" data-action="postOpen" data-id="${esc4(r.post.id)}" data-date="${esc4(r.date.id)}">${dayBox(r.date, r.status, T2)}<span class="sx-day-main"><b>${esc4(T2.pick(r.date.label))}</b><small>${esc4(spanText(r.date, T2))} · ${esc4(T2.pick(r.post.title))}</small></span><span class="sx-dleft${near(r.status) ? " is-near" : ""}"><span aria-hidden="true">${esc4(left.shown)}</span><span class="sr-only">${esc4(left.said)}</span></span></button>${changed}</li>`;
  };
  const gone = missing ? `<p class="sx-note">${T2.L(`글에서 빠지거나 바뀐 날이 ${missing}개 있어요.`, `${missing} saved date${missing === 1 ? " was" : "s were"} removed or changed in the posts.`)} <button type="button" class="sx-link sm" data-action="datesClean">${T2.L("목록에서 지우기", "Remove from list")}</button></p>` : "";
  const pastList = past.length ? `<details class="sx-past"><summary>${T2.L(`지난 날 ${past.length}개`, `${past.length} past date${past.length === 1 ? "" : "s"}`)}</summary><ul class="sx-days">${past.map(row).join("")}</ul></details>` : "";
  return `<section class="sx sx-today" aria-labelledby="sx-up-h"><h2 class="sx-h" id="sx-up-h" tabindex="-1">${T2.L("다가오는 날", "Coming up")}</h2>${storeLine(T2)}
${upcoming.length ? `<ul class="sx-days">${upcoming.map(row).join("")}</ul>` : `<p class="sx-note">${T2.L("다가오는 날이 없어요.", "Nothing coming up.")}</p>`}${gone}${pastList}</section>`;
}
function renderNews(view) {
  const T2 = ctx(view), off = T2.profile && T2.profile.channelsOff || [];
  const list = latestPosts(T2.posts, off, 2);
  if (!list.length) return "";
  return `<section class="sx sx-today" aria-labelledby="sx-news-h"><div class="sx-h-row"><h2 class="sx-h" id="sx-news-h">${T2.L("새 소식", "Latest news")}</h2><button type="button" class="sx-link" data-action="nav" data-page="channels">${T2.L("채널 모두 보기", "All news")}${NEXT}</button></div>
<div class="sx-news">${list.map((p) => {
    const c = channelOf(p.channel);
    return `<button type="button" class="sx-newsbtn" data-action="postOpen" data-id="${esc4(p.id)}"><span class="sx-ic is-${esc4(c.tone)}">${ICON[c.id]}</span><small>${esc4(T2.pick(c.name))}</small><b>${esc4(T2.pick(p.title))}</b></button>`;
  }).join("")}</div></section>`;
}
var icsEscape = (s) => String(s).replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
function fold(line) {
  const enc = new TextEncoder(), out = [];
  let cur = "", bytes = 0;
  for (const ch of line) {
    const b = enc.encode(ch).length, limit = out.length ? 74 : 75;
    if (bytes + b > limit) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}
var nextDay = (d) => new Date(Date.parse(d + "T00:00:00Z") + 864e5).toISOString().slice(0, 10);
function icsText(post2, date, lang, stamp2 = /* @__PURE__ */ new Date()) {
  const en = lang === "en", pick2 = (o) => en ? o.en : o.ko;
  const day = endDay(date), compact = (d) => d.replace(/-/g, "");
  const dt = (stamp2 instanceof Date ? stamp2 : new Date(stamp2)).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const name = date.who ? en ? `${pick2(date.label)} (${pick2(date.who)})` : `${pick2(date.who)} ${pick2(date.label)}` : pick2(date.label);
  const what = date.kind === "apply" ? en ? `Deadline: ${name}` : `${name} 마감` : name;
  const desc = `${pick2(post2.title)}
${en ? "Source" : "출처"}: ${post2.source.url}
${en ? "Check the official notice before you act." : "움직이기 전에 공식 안내를 다시 확인하세요."}`;
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//SYNK//PATH study//" + (en ? "EN" : "KO"),
    "CALSCALE:GREGORIAN",
    "BEGIN:VEVENT",
    `UID:${date.id}@path.synk.im`,
    `DTSTAMP:${dt}`,
    `DTSTART;VALUE=DATE:${compact(day)}`,
    `DTEND;VALUE=DATE:${compact(nextDay(day))}`,
    `SUMMARY:${icsEscape(what)}`,
    `DESCRIPTION:${icsEscape(desc)}`,
    `URL:${post2.source.url}`,
    "END:VEVENT",
    "END:VCALENDAR"
  ].map(fold).join("\r\n") + "\r\n";
}

// experiences/path-app/study-ui.mjs
var STUDY_FILTERS = Object.freeze(["all", "fit", "language", "undergraduate"]);
var GRADE_MAX = 100;
var FUNDS_MAX_MAN = 2e4;
var esc5 = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var svg3 = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
var GO2 = svg3('<path d="M4 10h11.5M11 5.5 15.5 10 11 14.5"/>');
var BACK3 = svg3('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
var NEXT2 = svg3('<path d="M7.5 4.5 13 10l-5.5 5.5"/>');
var STATUS = { ok: ["맞음", "Met"], lack: ["부족", "Short"], check: ["확인 필요", "To check"] };
var KEY_NAME = { education: ["학력", "Education"], grade: ["성적", "Grades"], topik: ["한국어", "Korean"], finance: ["재정", "Funds"] };
var EDU = { graduated: ["고등학교 졸업", "Finished high school"], expected: ["졸업 예정", "Graduating soon"], none: ["아직 아님", "Not yet"] };
var LEVEL = { language: ["어학 과정", "Language program"], undergraduate: ["학부", "Undergraduate"] };
function ctx2(view) {
  const now = view.now || /* @__PURE__ */ new Date();
  const en = view.lang === "en";
  const L5 = (ko, e) => en ? e : ko;
  const pick2 = (o) => o ? en ? o.en : o.ko : "";
  const pair = (a) => en ? a[1] : a[0];
  const won = (n) => en ? `₩${n.toLocaleString("en-US")}` : n < 1e4 ? `${n.toLocaleString("ko-KR")}원` : n % 1e4 === 0 ? `${(n / 1e4).toLocaleString("ko-KR")}만 원` : `${Math.floor(n / 1e4).toLocaleString("ko-KR")}만 ${(n % 1e4).toLocaleString("ko-KR")}원`;
  const topik = (n) => n === null || n === void 0 ? L5("아직 안 넣음", "Not entered") : n === 0 ? L5("성적 없음", "No score yet") : L5(`TOPIK ${n}급`, `TOPIK level ${n}`);
  const programs = view.programs || PROGRAMS;
  const rules = view.rules || rulesAt(RULES, now);
  const profile2 = view.profile;
  const allExample = programs.length > 0 && programs.every((p) => p.example);
  const anyPartner = programs.some((p) => p.partner === true);
  const fitText = (n) => allExample ? L5(`개의 예시 과정이 지금 조건에 맞아요 (예시 ${programs.length}개 중)`, `of ${programs.length} example programs fit your conditions`) : L5("개 과정이 지금 조건에 맞아요", n === 1 ? "program fits your conditions" : "programs fit your conditions");
  const needs = countNeeds(programs);
  const needWord = needs.length === 2 ? L5("성적과 한국어를", "your grades and Korean level") : needs[0] === "gradePct" ? L5("성적을", "your grades") : L5("한국어 급수를", "your Korean level");
  const MON2 = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const md = (d) => {
    const [, m, day] = d.split("-").map(Number);
    return L5(`${m}월 ${day}일`, `${MON2[m - 1]} ${day}`);
  };
  return { now, en, L: L5, pick: pick2, pair, won, topik, programs, rules, profile: profile2, allExample, anyPartner, fitText, needs, needWord, md };
}
var tag = (status, T2) => `<span class="sx-tag is-${status}">${T2.pair(STATUS[status])}</span>`;
var meter = (match, T2) => `<span class="sx-meter" role="img" aria-label="${esc5(match.items.map((i) => `${T2.pair(KEY_NAME[i.key])} ${T2.pair(STATUS[i.status])}`).join(", "))}">${match.items.map((i) => `<i class="is-${i.status}"></i>`).join("")}</span>`;
var exampleTag = (p, T2) => p.example ? `<span class="sx-tag wait">${T2.L("예시", "Example")}</span>` : "";
var programImage = (p) => image(p);
var image = (p) => p.image ? `<img class="sx-img" src="./assets/${esc5(p.image)}.webp" alt="" width="960" height="640">` : `<span class="sx-cover is-${esc5(p.tone || "lapis")}" aria-hidden="true"><span>${esc5(p.place.en.split(",")[0].toUpperCase())}</span></span>`;
var newTab2 = (T2) => `<span class="sr-only"> (${T2.L("새 탭에서 열림", "opens in new tab")})</span>`;
var sourceLine = (rule, T2) => `<p class="sx-src"><b>${T2.L("출처", "Source")}</b> <a href="${esc5(rule.source.url)}" target="_blank" rel="noopener noreferrer">${esc5(T2.pick(rule.source.title))}${newTab2(T2)}</a> · ${T2.L(`${rule.basis} 시행 · 확인 ${rule.checkedAt}`, `in force from ${rule.basis} · checked ${rule.checkedAt}`)}</p>`;
var promise2 = (T2) => `<p class="sx-fine">${T2.L("이 결과는 입학이나 비자를 약속하지 않아요. 마지막 판단은 대학과 출입국이 해요.", "This comparison does not promise admission or a visa. The university and immigration office make the final decision.")}</p>`;
var inRound = (w, T2) => (ko, en) => w.round ? T2.L(`${w.round}차 ${ko}`, `Round ${w.round} ${en[0].toLowerCase()}${en.slice(1)}`) : T2.L(ko, en);
var opens = (p, T2) => {
  const w = applyWindow(p, T2.now), R = inRound(w, T2);
  if (w.state === "before") return R(`시작 D-${w.days}`, `Opens in ${w.days}d`);
  if (w.state === "open") return w.days === null ? R("접수 중", "Open now") : w.days === 0 ? R("오늘 마감", "Closes today") : R(`마감 D-${w.days}`, `Closes in ${w.days}d`);
  if (w.state === "closed") return T2.L("접수 끝남", "Closed");
  return T2.L("일정 확인 필요", "Check dates");
};
var opensLong = (p, T2) => {
  const w = applyWindow(p, T2.now), R = inRound(w, T2);
  const E = (long, short) => w.round ? short : long;
  const next = w.state === "open" && w.nextOpens ? T2.L(` · ${w.round + 1}차 ${T2.md(w.nextOpens)}부터`, ` · round ${w.round + 1} from ${T2.md(w.nextOpens)}`) : "";
  if (w.state === "before") return R(`접수 시작 D-${w.days}`, E(`Applications open in ${w.days}d`, `Opens in ${w.days}d`));
  if (w.state === "open") return (w.days === null ? R("지금 접수 중", E("Applications open now", "Open now")) : w.days === 0 ? R("오늘 접수 마감", E("Applications close today", "Closes today")) : R(`접수 마감 D-${w.days}`, E(`Applications close in ${w.days}d`, `Closes in ${w.days}d`))) + next;
  if (w.state === "closed") return T2.L("이번 접수 끝남", "Applications closed");
  return T2.L("접수 일정 확인 필요", "Check application dates");
};
var costLabel = (c, T2) => c.missing.length ? T2.L("확인된 비용의 합", "Confirmed costs") : T2.L("내가 낼 돈", "What you pay");
var needKorean = (p, T2) => p.requires.topik ? T2.L(`${p.requires.topik}급`, `Level ${p.requires.topik}`) : T2.L("없어도 됨", "None");
function needText(item, T2) {
  if (item.key === "education") return T2.L("고등학교 졸업", "High school graduation");
  if (item.key === "grade") return item.need === 0 ? T2.L("조건 없음", "No requirement") : T2.L(`평균 ${item.need}% 이상`, `Average ${item.need}% or higher`);
  if (item.key === "topik") return item.need === 0 ? T2.L("없어도 됨", "Not required") : T2.L(`TOPIK ${item.need}급 이상`, `TOPIK level ${item.need} or higher`);
  return item.need === null ? T2.L("기준 확인 필요", "Requirement to be checked") : T2.L(`은행 잔고 ${T2.won(item.need)}`, `Bank balance of ${T2.won(item.need)}`);
}
function mineText(item, T2) {
  const none = T2.L("아직 안 넣음", "Not entered");
  if (item.key === "education") return item.mine ? T2.pair(EDU[item.mine]) : none;
  if (item.key === "grade") return item.mine === null ? none : `${item.mine}%`;
  if (item.key === "topik") return T2.topik(item.mine);
  return item.mine === null ? none : T2.won(item.mine);
}
function uncheckedNote(T2) {
  const fit = T2.programs.map((p) => matchProgram(T2.profile, p, T2.rules)).filter((m) => m.fits);
  const keys = ["education", "finance"].filter((k) => fit.some((m) => m.items.find((i) => i.key === k).status === "check"));
  if (!keys.length) return "";
  const blank = keys.every((k) => (k === "education" ? T2.profile.education : T2.profile.fundsWon) == null);
  const ko = keys.length === 2 ? "학력과 준비한 돈은" : keys[0] === "education" ? "학력은" : "준비한 돈은";
  const many = keys.length === 2 || keys[0] === "finance";
  const en = keys.length === 2 ? "Your education and funds" : keys[0] === "education" ? "Your education" : "Your funds";
  return blank ? T2.L(`${ko} 아직 넣지 않아서 빼지 않고 셌어요.`, `${en} ${many ? "are" : "is"} not entered yet, so no program was ruled out by ${many ? "them" : "it"}.`) : T2.L(`${ko} 아직 맞춰 보지 못해 빼지 않고 셌어요.`, `${en} could not be checked yet, so no program was ruled out by ${many ? "them" : "it"}.`);
}
function filterPrograms(profile2, filter, programs = PROGRAMS, rules = RULES) {
  if (filter === "fit") return readyToCount(profile2, programs) ? programs.filter((p) => matchProgram(profile2, p, rules).fits) : [];
  return programs.filter((p) => filter === "all" || p.level === filter);
}
function studyCountSay(view) {
  const T2 = ctx2(view), n = countFit(T2.profile, T2.programs, T2.rules);
  return n === null ? T2.L(`${T2.needWord} 넣으면 맞는 과정을 세어 줘요.`, `Enter ${T2.needWord} to count the programs that fit.`) : T2.L(`지금 조건에 맞는 과정 ${n}개`, `${n} program${n === 1 ? " fits" : "s fit"} your conditions`);
}
function renderStudyEntry(view) {
  const T2 = ctx2(view), empty = isEmptyProfile(T2.profile), n = countFit(T2.profile, T2.programs, T2.rules);
  const title = T2.allExample ? T2.L("예시 과정으로 내 조건 맞춰 보기", "Try your conditions on example programs") : n === null ? T2.L("내 조건으로 갈 수 있는 대학을 알아봐요", "See which schools fit your conditions") : T2.L(`지금 조건에 맞는 과정 ${n}개`, `${n} program${n === 1 ? " fits" : "s fit"} your conditions`);
  const sub = T2.allExample ? T2.L("협력 대학은 준비 중이에요. 한국어, 성적, 준비한 돈을 넣어 미리 맞춰 볼 수 있어요.", "Partner universities are being prepared. Enter your Korean level, grades and funds to try it in advance.") : n === null ? T2.L("한국어, 성적, 준비한 돈을 넣으면 맞는 과정과 모자란 것을 알려 줘요.", "Enter your Korean level, grades and funds to see what fits and what is missing.") : uncheckedNote(T2) || T2.L("조건을 바꾸면 바로 다시 계산해요.", "Change a condition and it recalculates right away.");
  return `<section class="sx sx-entry" aria-label="${T2.L("대학", "Schools")}"><button type="button" class="sx-entry-btn" data-action="nav" data-page="${empty ? "cond" : "univ"}"><span><b>${esc5(title)}</b><small>${esc5(sub)}</small></span><span class="sx-go" aria-hidden="true">${GO2}</span></button></section>`;
}
function countCard(T2) {
  const n = countFit(T2.profile, T2.programs, T2.rules);
  if (n === null) {
    return `<section class="sx-card lapis"><h2>${T2.L(`${T2.needWord} 넣으면 맞는 과정을 세어 줘요.`, `Enter ${T2.needWord} to count the programs that fit.`)}</h2><p>${T2.L("학력과 준비한 돈도 넣으면 그 조건이 모자란 과정은 빼고 세요.", "If you also enter your education and funds, programs where those fall short are left out.")}</p><button type="button" class="sx-cta" data-action="nav" data-page="cond">${T2.L("내 조건 넣기", "Enter my conditions")} ${GO2}</button></section>`;
  }
  return `<section class="sx-card lapis"><p class="sx-k">${T2.L("지금 조건으로", "With your conditions now")}</p><p class="sx-big"><b>${n}</b><span>${esc5(T2.fitText(n))}</span></p><p>${T2.L("넣은 조건 가운데 모자란 것이 없는 과정을 셌어요.", "Counted programs where none of the conditions you entered fall short.")}${uncheckedNote(T2) ? ` ${esc5(uncheckedNote(T2))}` : ""}</p><button type="button" class="sx-btn2" data-action="nav" data-page="cond">${T2.L("내 조건 바꿔 보기", "Change my conditions")}</button></section>`;
}
function renderUniv(view) {
  const T2 = ctx2(view), profile2 = T2.profile, empty = isEmptyProfile(profile2);
  const f = STUDY_FILTERS.includes(view.filter) ? view.filter : "all";
  const rank = { open: 0, before: 1, unknown: 2, closed: 3 };
  const list = filterPrograms(profile2, f, T2.programs, T2.rules).map((p, i) => [rank[applyWindow(p, T2.now).state], i, p]).sort((x, y) => x[0] - y[0] || x[1] - y[1]).map((x) => x[2]);
  const chip = (id, label) => `<button type="button" class="sx-chip" aria-pressed="${f === id}" data-action="studyFilter" data-id="${id}">${esc5(label)}</button>`;
  const openGuide = !T2.allExample && !T2.anyPartner && T2.programs.length > 0;
  const kicker = openGuide ? `${T2.L("대학 공개 모집 요강", "Published admissions guides")} <span class="sx-tag wait">${T2.L("협력 대학 준비 중", "Partners coming soon")}</span>` : T2.anyPartner ? T2.L("협력 대학", "Partner universities") : `${T2.L("협력 대학", "Partner universities")} <span class="sx-tag wait">${T2.L("준비 중", "Coming soon")}</span>`;
  const leadText = T2.allExample ? T2.L("협력 대학은 준비 중이에요. 지금 보이는 과정은 화면을 미리 보이려고 넣은 예시이고, 실제 대학이 아니에요.", "Partner universities are being prepared. The programs below are examples to preview the screen, not real universities.") : openGuide ? T2.L("대학이 공개한 모집 요강에서 옮긴 정보예요. SYNK와 협약한 대학은 아직 없어요. 지원하기 전에 대학 원문을 꼭 확인하세요.", "This information is taken from each university’s published admissions guide. SYNK has no partner universities yet. Always check the university’s original guide before applying.") : "";
  const head2 = `<header class="sx-head"><p class="sx-kicker">${kicker}</p><h1 class="sx-title page-title" tabindex="-1">${T2.L("내 조건으로 갈 수 있는 대학", "Schools that fit your conditions")}</h1>${leadText ? `<p class="sx-lead">${leadText}</p>` : ""}</header>`;
  if (!T2.programs.length) return `<div class="sx sx-wide">${head2}<section class="sx-card"><h2>${T2.L("협력 대학을 준비하고 있어요.", "Partner universities are being prepared.")}</h2><p>${T2.L("준비되면 여기에서 조건과 비용을 맞춰 볼 수 있어요.", "Once ready, you can compare conditions and costs here.")}</p></section></div>`;
  const cards = list.map((p) => {
    const m = matchProgram(profile2, p, T2.rules), on = profile2.compare.includes(p.id), full = profile2.compare.length >= MAX_COMPARE && !on;
    return `<li class="sx-ucard"><div class="sx-ucard-top"><button type="button" class="sx-photo" data-action="univOpen" data-id="${esc5(p.id)}">${image(p)}<span class="sx-photo-body"><small>${esc5(T2.pick(p.place))} · ${T2.pair(LEVEL[p.level])}${p.term ? ` · ${esc5(T2.pick(p.term))}` : ""}</small><b>${esc5(T2.pick(p.name))}</b></span></button><button type="button" class="sx-pick" aria-pressed="${on}" data-action="studyCompare" data-id="${esc5(p.id)}"${full ? " disabled" : ""}>${on ? T2.L("비교에 담음", "In compare") : T2.L("비교", "Compare")}<span class="sr-only"> ${esc5(T2.pick(p.name))}</span></button></div>
<dl class="sx-facts"><div><dt>${p.level === "language" ? T2.L("한 해 수업료", "Tuition per year") : T2.L("한 해 등록금", "Tuition per year")}</dt><dd>${T2.won(p.costs.tuition)}</dd></div><div><dt>${T2.L("필요한 한국어", "Korean needed")}</dt><dd>${needKorean(p, T2)}</dd></div><div><dt>${T2.L("원서 접수", "Applications")}</dt><dd>${esc5(opens(p, T2))}</dd></div></dl>
<p class="sx-fitline"><span>${exampleTag(p, T2)} ${empty ? T2.L("내 조건을 넣으면 맞춰 봐요", "Enter your conditions to compare") : T2.L(`내 조건 4개 중 ${m.okCount}개 맞음`, `${m.okCount} of 4 conditions met`)}</span>${empty ? "" : meter(m, T2)}</p></li>`;
  }).join("");
  const none = list.length ? "" : `<section class="sx-card"><h2>${f === "fit" && !readyToCount(profile2, T2.programs) ? T2.L(`${T2.needWord} 넣으면 맞는 과정만 골라 볼 수 있어요.`, `Enter ${T2.needWord} to filter by fit.`) : f === "fit" ? T2.L("지금 조건에 맞는 과정이 아직 없어요.", "Nothing fits your conditions yet.") : T2.L("이 갈래의 과정은 아직 없어요.", "No programs in this category yet.")}</h2><p>${T2.L("전체 목록에서 과정을 열면 무엇이 모자란지 볼 수 있어요.", "Open a program in the full list to see what is missing.")}</p><div class="sx-row2"><button type="button" class="sx-btn2" data-action="nav" data-page="cond">${T2.L("내 조건 보기", "My conditions")}</button><button type="button" class="sx-btn2" data-action="studyFilter" data-id="all">${T2.L("전체 보기", "Show all")}</button></div></section>`;
  const bar = profile2.compare.length >= 2 ? `<div class="sx-cmpbar"><button type="button" class="sx-cta butter" data-action="nav" data-page="univCompare">${T2.L(`${profile2.compare.length}곳 나란히 보기`, `Compare ${profile2.compare.length} side by side`)} ${GO2}</button></div>` : profile2.compare.length === 1 ? `<p class="sx-fine">${T2.L("한 곳을 더 담으면 나란히 볼 수 있어요.", "Add one more to compare side by side.")}</p>` : "";
  return `<div class="sx sx-wide">${head2}
${countCard(T2)}
<div class="sx-chips" role="group" aria-label="${T2.L("거르기", "Filter")}">${chip("all", T2.L(`전체 ${T2.programs.length}`, `All ${T2.programs.length}`))}${chip("fit", T2.L("조건이 맞는 과정", "Fits me"))}${chip("language", T2.pair(LEVEL.language))}${chip("undergraduate", T2.pair(LEVEL.undergraduate))}</div>
${list.length ? `<ul class="sx-ulist">${cards}</ul>` : none}${bar}${promise2(T2)}</div>`;
}
function financeMore(i, T2, visa) {
  const waiver = announcedRules(T2.rules, "finance-waiver")[0];
  const enter = i.mine === null ? `<button type="button" class="sx-link" data-action="nav" data-page="cond">${T2.L("준비한 돈 넣기", "Enter my funds")}${NEXT2}</button>` : "";
  let note = "";
  if (i.rule && !i.firm) {
    note = `<p class="sx-note">${i.rule.stale ? T2.L("이 금액을 확인한 지 오래돼 다시 확인하고 있어요. 그래서 맞는지 판정하지 않았어요.", "This amount was checked a while ago and is being re-checked, so it is not judged here.") : T2.L(`이 금액은 ${i.rule.basis}에 시행된 기준이에요. 지금 쓰는 안내에서도 같은지 확인하고 있어서 맞는지 판정하지 않았어요.`, `This amount took effect on ${i.rule.basis}. We are confirming it against the current guide, so it is not judged here.`)}${i.mine !== null && i.gap > 0 ? ` ${T2.L(`이 기준으로는 ${T2.won(i.gap)}이 더 필요해요.`, `By this figure, ${T2.won(i.gap)} more would be needed.`)}` : ""}</p>`;
  } else if (i.status === "lack") note = `<p class="sx-note">${T2.L(`${T2.won(i.gap)}이 더 필요해요.`, `${T2.won(i.gap)} more is needed.`)}</p>`;
  const plan = waiver ? `<p class="sx-note plan"><b>${T2.L("계획 발표", "Announced plan")}</b> ${T2.L(`TOPIK ${waiver.topik}급이 있으면 이 증명을 면제하는 계획이 ${waiver.basis}에 발표됐어요. 시작하는 날은 아직 정해지지 않았어요.`, `A plan to waive this proof for TOPIK level ${waiver.topik} was announced on ${waiver.basis}. No start date has been set.`)} <a href="${esc5(waiver.source.url)}" target="_blank" rel="noopener noreferrer">${esc5(T2.pick(waiver.source.title))}${newTab2(T2)}</a></p>` : "";
  const proof = proofRule(T2.rules, visa);
  const how = proof ? `<p class="sx-note">${T2.L(`몽골에서 신청할 때는 본인이나 부모의 몽골 은행 잔고 증명서를 비자 신청일 기준 ${proof.issuedWithinDays}일 안에 발급받아 내고, 이 금액을 ${proof.heldDays}일 이상 유지해야 해요.`, `When applying in Mongolia, submit a balance certificate from your own or a parent’s Mongolian bank account issued within ${proof.issuedWithinDays} days of the visa application, and keep this amount for at least ${proof.heldDays} days.`)} <a href="${esc5(proof.source.url)}" target="_blank" rel="noopener noreferrer">${esc5(T2.pick(proof.source.title))}${newTab2(T2)}</a></p>` : "";
  return enter + note + (i.rule ? sourceLine(i.rule, T2) : "") + how + plan;
}
function renderUnivDetail(view) {
  const T2 = ctx2(view), profile2 = T2.profile, p = programById(T2.programs, view.programId);
  const back = `<button type="button" class="sx-back" data-action="nav" data-page="univ">${BACK3}${T2.L("대학", "Schools")}</button>`;
  if (!p) return `<div class="sx">${back}<h1 class="sx-title page-title" tabindex="-1">${T2.L("과정을 찾지 못했어요.", "Program not found.")}</h1></div>`;
  const m = matchProgram(profile2, p, T2.rules), c = programCost(profile2, p), on = profile2.compare.includes(p.id), full = profile2.compare.length >= MAX_COMPARE && !on;
  const items = m.items.map((i) => {
    let more = "";
    if (i.key === "finance") more = financeMore(i, T2, p.visa);
    else if (i.status === "check") more = `<button type="button" class="sx-link" data-action="nav" data-page="cond">${T2.L("내 조건에 넣기", "Enter it in my conditions")}${NEXT2}</button>`;
    else if (i.key === "topik" && i.status === "lack") more = `<p class="sx-note">${T2.L(`${i.gap}급을 더 올리면 맞아요.`, `${i.gap} more level${i.gap === 1 ? "" : "s"} to meet this.`)}</p>`;
    else if (i.key === "grade" && i.status === "lack") more = `<p class="sx-note">${T2.L(`${i.gap}%가 모자라요.`, `${i.gap}% short.`)}</p>`;
    return `<li><div class="sx-match-top"><b>${T2.pair(KEY_NAME[i.key])}</b>${tag(i.status, T2)}</div><dl class="sx-match-grid"><div><dt>${T2.L("필요한 것", "Needed")}</dt><dd>${esc5(needText(i, T2))}</dd></div><div><dt>${T2.L("내 것", "Mine")}</dt><dd>${esc5(mineText(i, T2))}</dd></div></dl>${more}</li>`;
  }).join("");
  const pct = Math.round(c.rate * 100);
  const schNote = c.scholarship ? c.stepTopik === 0 ? T2.L(`신입생 모두에게 주는 장학금 ${T2.won(c.scholarship)}을 뺀 값이에요.`, `After the ${T2.won(c.scholarship)} scholarship every freshman receives.`) : c.rate === null ? T2.L(`한국어 ${c.stepTopik}급 장학금 ${T2.won(c.scholarship)}을 뺀 값이에요.`, `After the ${T2.won(c.scholarship)} scholarship for TOPIK level ${c.stepTopik}.`) : T2.L(`한국어 ${c.stepTopik}급 장학금 ${pct}%를 뺀 값이에요.`, `After the ${pct}% scholarship for TOPIK level ${c.stepTopik}.`) : !p.scholarship.length ? T2.L("이 과정은 한국어 급수 장학금이 없어요.", "This program has no Korean-level scholarship.") : profile2.topik === null ? T2.L("한국어 급수를 넣으면 장학금을 빼서 보여 줘요.", "Enter your Korean level to subtract the scholarship.") : p.scholarshipNote ? T2.L("지금 급수로 정해진 장학금은 없어요. 아래 장학금 안내를 확인하세요.", "No fixed scholarship at your current level. See the scholarship note below.") : T2.L("지금 급수로는 장학금이 없어요.", "No scholarship at your current level.");
  const next = c.nextLevel ? `<section class="sx-card meadow"><p class="sx-k">${T2.L("급수를 올리면", "If you raise your level")}</p><h2>${T2.L(`${c.nextLevel.topik}급이면 ${c.missing.length ? "확인된 비용의 합이" : "내가 낼 돈이"} ${T2.won(c.nextLevel.total)}으로 줄어요.`, `At level ${c.nextLevel.topik}, ${c.missing.length ? "the confirmed costs drop" : "what you pay drops"} to ${T2.won(c.nextLevel.total)}.`)}</h2></section>` : "";
  const unknownCost = (key) => key === "dorm" ? T2.L("합계에 없음 · 아래 안내", "Not in total · see note") : T2.L("대학이 안내하지 않음", "Not stated by the university");
  const note = (o) => o ? `<p class="sx-note">${esc5(T2.pick(o))}</p>` : "";
  const small = (o) => o ? `<p class="sx-note is-small">${esc5(T2.pick(o))}</p>` : "";
  const missingNote = c.missing.length ? `<p class="sx-note">${T2.L(`합계에는 ${c.missing.length === 2 ? "기숙사비와 생활비가" : c.missing[0] === "dorm" ? "기숙사비가" : "생활비가"} 빠져 있어요.`, `The total does not include ${c.missing.map((k) => k === "dorm" ? "dormitory fees" : "living costs").join(" or ")}.`)}</p>` : "";
  const realSource = !p.example && p.source ? `<p class="sx-src"><b>${T2.L("출처", "Source")}</b> <a href="${esc5(p.source.url)}" target="_blank" rel="noopener noreferrer">${esc5(T2.pick(p.source.title))}${newTab2(T2)}</a> · ${T2.L("확인", "checked")} ${esc5(p.checkedAt)}</p>` : "";
  return `<div class="sx">${back}
<div class="sx-photo is-hero">${image(p)}<span class="sx-photo-top">${exampleTag(p, T2)}<span class="sx-tag white">${esc5(opensLong(p, T2))}</span></span><span class="sx-photo-body"><small>${esc5(T2.pick(p.place))} · ${T2.pair(LEVEL[p.level])} · ${esc5(T2.pick(p.majors))}${p.term ? ` · ${esc5(T2.pick(p.term))}` : ""}</small></span></div>
<h1 class="sx-title page-title" tabindex="-1">${esc5(T2.pick(p.name))}</h1>
${p.example ? `<p class="sx-lead">${T2.L("화면을 미리 보이려고 넣은 예시 과정이에요. 금액, 일정, 입학 조건은 실제 대학의 것이 아니에요.", "An example program to preview the screen. The amounts, dates and admission conditions are not from a real university.")}</p>` : `${p.partner ? "" : `<p class="sx-lead">${T2.L("대학이 공개한 모집 요강에서 옮긴 정보예요. SYNK와 협약한 대학은 아니에요. 지원하기 전에 원문을 꼭 확인하세요.", "Taken from the university’s published admissions guide. This is not a SYNK partner university. Check the original before applying.")}</p>`}${realSource}`}
${p.applyNote ? `<p class="sx-note is-box"><b>${T2.L("원서 접수", "Applications")}</b> ${esc5(T2.pick(p.applyNote))}</p>` : ""}${view.pathPick || ""}
<h2 class="sx-h">${T2.L("내 조건과 맞춰 보기", "Compare with my conditions")} ${meter(m, T2)}</h2><ul class="sx-match">${items}</ul>${note(p.requiresNote)}
<h2 class="sx-h">${T2.L("한 해에 드는 돈", "Cost for one year")} ${exampleTag(p, T2)}</h2>
<div class="sx-hero-num"><small>${costLabel(c, T2)}</small><b>${T2.won(c.total)}</b><small>${esc5(schNote)}</small></div>
<ul class="sx-money"><li><span>${p.level === "language" ? T2.L("수업료", "Tuition") : T2.L("등록금", "Tuition")}</span><span>${T2.won(c.tuition)}</span></li><li${c.dorm === null ? ' class="is-unknown"' : ""}><span>${T2.L("기숙사", "Dormitory")}${p.dormLabel && c.dorm !== null ? `<small>${esc5(T2.pick(p.dormLabel))}</small>` : ""}</span><span>${c.dorm === null ? unknownCost("dorm") : T2.won(c.dorm)}</span></li><li${c.living === null ? ' class="is-unknown"' : ""}><span>${T2.L("생활비", "Living costs")}</span><span>${c.living === null ? unknownCost("living") : T2.won(c.living)}</span></li>${c.scholarship ? `<li class="minus"><span>${T2.L("장학금", "Scholarship")}</span><span>− ${T2.won(c.scholarship)}</span></li>` : ""}</ul>${missingNote}${small(p.costsNote)}${small(p.scholarshipNote)}${next}
<div class="sx-row2"><button type="button" class="sx-btn2" data-action="nav" data-page="cond">${T2.L("내 조건 바꿔 보기", "Change my conditions")}</button><button type="button" class="sx-btn2" aria-pressed="${on}" data-action="studyCompare" data-id="${esc5(p.id)}"${full ? " disabled" : ""}>${on ? T2.L("비교에 담음", "In compare") : T2.L("비교에 담기", "Add to compare")}</button></div>
${profile2.compare.length >= 2 ? `<button type="button" class="sx-cta butter" data-action="nav" data-page="univCompare">${T2.L(`${profile2.compare.length}곳 나란히 보기`, `Compare ${profile2.compare.length} side by side`)} ${GO2}</button>` : ""}${promise2(T2)}</div>`;
}
function renderUnivCompare(view) {
  const T2 = ctx2(view), profile2 = T2.profile, list = profile2.compare.map((id) => programById(T2.programs, id)).filter(Boolean);
  const back = `<button type="button" class="sx-back" data-action="nav" data-page="univ">${BACK3}${T2.L("대학", "Schools")}</button>`;
  const title = `<h1 class="sx-title page-title" tabindex="-1">${T2.L("나란히 보기", "Side by side")}</h1>`;
  if (list.length < 2) return `<div class="sx">${back}${title}<section class="sx-card"><h2>${T2.L("두 곳 이상 담으면 나란히 볼 수 있어요.", "Add at least two programs to compare.")}</h2><button type="button" class="sx-cta" data-action="nav" data-page="univ">${T2.L("대학 보기", "Browse schools")} ${GO2}</button></section></div>`;
  const row = (h, fn) => `<tr><th scope="row">${h}</th>${list.map((p) => `<td>${fn(p)}</td>`).join("")}</tr>`;
  const anyMissing = list.some((p) => programCost(profile2, p).missing.length);
  const costsWord = anyMissing ? T2.L("확인된 비용의 합", "Confirmed costs") : T2.L("내가 낼 돈", "What you pay");
  return `<div class="sx sx-wide">${back}${title}
<div class="sx-cmp-wrap" role="region" tabindex="0" aria-label="${T2.L("나란히 보기 표", "Comparison table")}"><table class="sx-cmp" data-cols="${list.length}"><thead><tr><td></td>${list.map((p) => `<th scope="col"><button type="button" class="sx-cmp-head" data-action="univOpen" data-id="${esc5(p.id)}">${image(p)}<span>${esc5(T2.pick(p.name))}</span></button></th>`).join("")}</tr></thead><tbody>
${row(T2.L("지역", "Region"), (p) => esc5(T2.pick(p.place)))}${row(T2.L("과정", "Program"), (p) => T2.pair(LEVEL[p.level]))}${row(T2.L("한 해 등록금 · 수업료", "Tuition per year"), (p) => T2.won(p.costs.tuition))}
${row(T2.L("한 해 기숙사", "Dormitory per year"), (p) => p.costs.dorm === null ? `<span class="sx-cmp-miss">${T2.L("합계에 없음", "Not in total")}</span>` : `${T2.won(p.costs.dorm)}${p.dormLabel ? `<small>${esc5(T2.pick(p.dormLabel))}</small>` : ""}`)}
${row(T2.L("지금 급수 장학금", "Scholarship at your level"), (p) => {
    const c = programCost(profile2, p);
    return c.scholarship ? `− ${T2.won(c.scholarship)}` : T2.L("없음", "None");
  })}
${row(costsWord, (p) => {
    const c = programCost(profile2, p);
    return `<b>${T2.won(c.total)}</b>${c.missing.length ? `<small>${esc5(T2.L(`${c.missing.length === 2 ? "기숙사 · 생활비" : c.missing[0] === "dorm" ? "기숙사비" : "생활비"} 빠짐`, `excludes ${c.missing.map((k) => k === "dorm" ? "dormitory" : "living costs").join(" and ")}`))}</small>` : ""}`;
  })}${row(T2.L("필요한 한국어", "Korean needed"), (p) => needKorean(p, T2))}
${row(T2.L("필요한 성적", "Grades needed"), (p) => p.requires.gradePct ? `${p.requires.gradePct}%` : T2.L("조건 없음", "None"))}${row(T2.L("잔고 증명", "Proof of funds"), (p) => {
    const i = matchProgram(profile2, p, T2.rules).items[3];
    return i.need === null ? T2.L("확인 필요", "To check") : T2.won(i.need);
  })}
${row(T2.L("원서 접수", "Applications"), (p) => esc5(opens(p, T2)))}${row(T2.L("내 조건", "My conditions"), (p) => {
    const m = matchProgram(profile2, p, T2.rules);
    return `${m.okCount} / 4${meter(m, T2)}`;
  })}
${row(`<span class="sr-only">${T2.L("비교에서 빼기", "Remove from compare")}</span>`, (p) => `<button type="button" class="sx-link" data-action="studyCompare" data-id="${esc5(p.id)}">${T2.L("빼기", "Remove")}<span class="sr-only"> ${esc5(T2.pick(p.name))}</span></button>`)}</tbody></table></div>
<p class="sx-fine">${anyMissing ? T2.L("「확인된 비용의 합」은 한 해 금액을 알 수 있는 비용만 더하고 지금 급수의 장학금을 뺀 값이에요. 빠진 비용이 과정마다 달라서, 합계만 보지 말고 칸마다 견주어 보세요.", "“Confirmed costs” adds only the yearly costs that are known and subtracts the scholarship at your current level. Missing costs differ by program, so compare row by row rather than by the total alone.") : T2.L("「내가 낼 돈」은 지금 내 한국어 급수의 장학금을 뺀 값이에요.", "“What you pay” subtracts the scholarship for your current Korean level.")}${list.some((p) => p.example) ? ` ${T2.L("예시 과정의 금액은 실제 대학의 것이 아니에요.", "Amounts for example programs are not from a real university.")}` : ""}</p>${promise2(T2)}</div>`;
}
function condHint(lang, key, error) {
  const en = lang === "en", max = key === "gradePct" ? GRADE_MAX : FUNDS_MAX_MAN;
  if (error) return en ? `Enter a whole number from 0 to ${max.toLocaleString("en-US")}.` : `0부터 ${max.toLocaleString("ko-KR")}까지 소수점 없는 숫자로 적어 주세요.`;
  if (key === "gradePct") return en ? "Your average on a 100-point scale, rounded. Example: 82" : "100점 만점으로 바꾼 평균을 반올림해 적어요. 예: 82";
  return en ? "Money you can show as a bank balance, in units of ₩10,000. Example: 1600" : "잔고 증명에 쓸 수 있는 돈을 만 원 단위로 적어요. 예: 1600";
}
function renderCondResult(view) {
  const T2 = ctx2(view), profile2 = T2.profile;
  const n = countFit(profile2, T2.programs, T2.rules), r = routes(profile2, T2.programs, T2.rules, T2.now);
  let up = null;
  if (n !== null) for (let t2 = profile2.topik + 1; t2 <= 6 && !up; t2++) {
    const k = countFit(profile2, T2.programs, T2.rules, t2);
    if (k > n) up = { t: t2, k };
  }
  const lead = n === null ? "" : up ? T2.allExample ? T2.L(`${up.t}급이면 예시 과정 ${up.k}개가 맞아요.`, `With level ${up.t}, ${up.k} example programs fit.`) : T2.L(`${up.t}급을 따면 ${up.k}개 과정으로 늘어요.`, `With level ${up.t} it becomes ${up.k} programs.`) : n === 0 ? T2.L("모자란 조건은 과정마다 달라요. 대학을 열어 무엇이 모자란지 확인하세요.", "What is missing differs by program. Open a school to see it.") : T2.L("과정을 열면 조건 넷을 하나씩 맞춰 볼 수 있어요.", "Open a program to check all four conditions one by one.");
  const top = n === null ? `<section class="sx-card lapis"><h2>${T2.L(`${T2.needWord} 넣으면 맞는 과정을 세어 줘요.`, `Enter ${T2.needWord} to count the programs that fit.`)}</h2>${T2.needs.length === 2 ? `<p>${T2.L("둘 중 하나라도 비어 있으면 세지 않아요.", "Nothing is counted while either one is empty.")}</p>` : ""}<button type="button" class="sx-cta" data-action="nav" data-page="univ">${T2.L("대학 보기", "Browse schools")} ${GO2}</button></section>` : `<section class="sx-card lapis"><p class="sx-k">${T2.L("지금 조건으로", "With your conditions now")}</p><p class="sx-big"><b>${n}</b><span>${esc5(T2.fitText(n))}</span></p>${uncheckedNote(T2) ? `<p>${esc5(uncheckedNote(T2))}</p>` : ""}<p>${esc5(lead)}</p><button type="button" class="sx-cta" data-action="nav" data-page="univ">${T2.L("대학 보기", "Browse schools")} ${GO2}</button></section>`;
  const route = (title, x, visa, body) => {
    const st = x.status === "none" ? "" : x.status === "ok" ? `<span class="sx-tag is-ok">${T2.L("조건 맞음", "Fits")}</span>` : tag(x.status, T2);
    return `<section class="sx-card line"><div class="sx-match-top"><h3>${esc5(title)}</h3>${st}</div><p>${esc5(body)}</p><p class="sx-src"><b>${T2.L("비자", "Visa")}</b> ${esc5(visa)}</p></section>`;
  };
  const unit = (c) => T2.allExample ? T2.L(`${c}개(예시)`, `${c} example program${c === 1 ? "" : "s"}`) : T2.L(`${c}개`, `${c} program${c === 1 ? "" : "s"}`);
  const none = T2.L("준비된 과정이 아직 없어요.", "No programs are ready yet.");
  const openText = (x) => x.open === x.count ? "" : x.open ? T2.L(` 그 가운데 지금 접수 중이거나 곧 접수가 열리는 곳은 ${x.open}개예요.`, ` ${x.open} of them ${x.open === 1 ? "is" : "are"} open now or opening soon.`) : T2.L(" 다만 지금은 모두 이번 접수가 끝났어요.", " However, applications for all of them have closed for now.");
  const lackText = (x, kind) => x.academic > 0 ? T2.L("성적과 한국어가 맞는 과정은 있지만 학력이나 준비한 돈이 모자라요. 과정을 열어 무엇이 모자란지 확인하세요.", "Some programs fit your grades and Korean, but your education or funds fall short. Open a program to see what is missing.") : x.topikGap ? T2.L(`가장 낮은 곳이 TOPIK ${x.lowestTopik}급을 요구해요. ${x.topikGap}급을 더 올리면 열려요.`, `The lowest requirement is TOPIK level ${x.lowestTopik}. ${x.topikGap} more level${x.topikGap === 1 ? "" : "s"} opens it.`) : kind === "language" ? T2.L("성적 조건이 맞는 어학 과정이 없어요.", "No language program matches your grades.") : T2.L("성적 조건이 맞는 학부 과정이 없어요.", "No undergraduate program matches your grades.");
  const checkText = T2.L(`${T2.needWord} 넣으면 맞는 과정을 알려 줘요.`, `Enter ${T2.needWord} to see which programs fit.`);
  const directBody = r.direct.status === "none" ? none : r.direct.status === "ok" ? T2.L(`조건이 맞는 학부 과정이 ${unit(r.direct.count)} 있어요.`, `${unit(r.direct.count)} for undergraduate study ${r.direct.count === 1 ? "fits" : "fit"} your conditions.`) + openText(r.direct) : r.direct.status === "check" ? checkText : lackText(r.direct, "undergraduate");
  const langBody = r.languageFirst.status === "none" ? none : r.languageFirst.status === "ok" ? T2.L(`한국에서 한국어를 먼저 배운 뒤 학부에 들어가요. 조건이 맞는 어학 과정이 ${unit(r.languageFirst.count)} 있어요.`, `Learn Korean in Korea first, then enter an undergraduate program. ${unit(r.languageFirst.count)} for language study ${r.languageFirst.count === 1 ? "fits" : "fit"} your conditions.`) + openText(r.languageFirst) : r.languageFirst.status === "check" ? T2.L(`한국어 성적이 없어도 지원할 수 있는 과정이 많아요. ${checkText}`, `Many programs accept you without a Korean score. ${checkText}`) : lackText(r.languageFirst, "language");
  return `${top}
<h2 class="sx-h">${T2.L("갈 수 있는 길", "Routes you can take")}</h2>
${route(T2.L("어학 과정 먼저, 그다음 학부", "Language program first, then undergraduate"), r.languageFirst, T2.L("어학연수(D-4) → 유학(D-2)", "Language training (D-4) → Study (D-2)"), langBody)}
${route(T2.L("바로 학부 입학", "Straight into undergraduate"), r.direct, T2.L("유학(D-2)", "Study (D-2)"), directBody)}
${isEmptyProfile(profile2) ? "" : `<p class="sx-fine"><button type="button" class="sx-link" data-action="studyClear">${T2.L("조건 모두 지우기", "Clear all conditions")}</button></p>`}`;
}
function renderCond(view) {
  const T2 = ctx2(view), profile2 = T2.profile, { persisted = true, text: text2 = {}, errors = {}, store = "tab", storeNote: storeNote2 = "" } = view;
  const seg = (key, options, label) => `<div class="sx-seg${options.length > 4 ? " is-many" : ""}" role="group" aria-label="${esc5(label)}">${options.map(([v, l]) => `<button type="button" aria-pressed="${profile2[key] === v}" data-action="studySet" data-key="${key}" data-id="${esc5(v)}">${esc5(l)}</button>`).join("")}</div>`;
  const field = (id, key, label, unit, value) => `<div class="sx-field"><label for="${id}">${esc5(label)}</label><div class="sx-input"><input id="${id}" type="text" inputmode="numeric" autocomplete="off" maxlength="7" data-action="studyInput" data-key="${key}" value="${esc5(value)}" aria-describedby="${id}-hint"${errors[key] ? ' aria-invalid="true"' : ""}><span aria-hidden="true">${esc5(unit)}</span></div><p class="sx-hint${errors[key] ? " is-error" : ""}" id="${id}-hint">${esc5(condHint(view.lang, key, !!errors[key]))}</p></div>`;
  const gradeText = text2.gradePct ?? (profile2.gradePct === null ? "" : String(profile2.gradePct));
  const fundsText = text2.fundsWon ?? (profile2.fundsWon === null ? "" : String(Math.round(profile2.fundsWon / 1e4)));
  return `<div class="sx"><button type="button" class="sx-back" data-action="nav" data-page="univ">${BACK3}${T2.L("대학", "Schools")}</button>
<header class="sx-head"><h1 class="sx-title page-title" tabindex="-1">${T2.L("내 조건", "My conditions")}</h1><p class="sx-lead">${T2.L("넣거나 바꾸면 갈 수 있는 길과 맞는 과정이 바로 따라 바뀌어요.", "Enter or change a value and the routes and matches update right away.")}</p></header>
${(store === "blocked" || store === "wait") && storeNote2 ? `<p class="sx-store is-warn" role="status">${esc5(storeNote2)}</p>` : store === "account" ? `<p class="sx-store" role="status">${T2.L("이 조건은 계정에 저장돼요. 다른 기기에서도 보이고, 내 정보에서 지울 수 있어요.", "These conditions are saved to your account. You can see them on other devices and delete them on the Profile page.")}</p>` : `<p class="sx-store${persisted ? "" : " is-warn"}" role="status">${persisted ? T2.L("이 조건은 이 탭에만 저장돼요. 계정에는 저장되지 않고, 탭을 닫거나 로그아웃하면 사라져요.", "These conditions are kept in this tab only. They are not saved to your account and disappear when you close the tab or sign out.") : T2.L("이 브라우저에서는 저장할 수 없어서 지금 화면에서만 기억해요. 새로 고치면 사라져요.", "This browser cannot store them, so they are remembered on this screen only and are lost on reload.")}</p>`}
<div class="sx-field"><span class="sx-label">${T2.L("한국어", "Korean")} <b>${esc5(T2.topik(profile2.topik))}</b></span>${seg("topik", [[0, T2.L("없음", "None")], ...[1, 2, 3, 4, 5, 6].map((v) => [v, T2.L(`${v}급`, `L${v}`)])], T2.L("한국어 급수(TOPIK)", "Korean level (TOPIK)"))}</div>
<div class="sx-field"><span class="sx-label">${T2.L("학력", "Education")} <b>${esc5(profile2.education ? T2.pair(EDU[profile2.education]) : T2.L("아직 안 넣음", "Not entered"))}</b></span>${seg("education", Object.keys(EDU).map((k) => [k, T2.pair(EDU[k])]), T2.L("학력", "Education"))}</div>
${field("sx-grade", "gradePct", T2.L("고등학교 성적 평균", "High school grade average"), "%", gradeText)}
${field("sx-funds", "fundsWon", T2.L("준비한 돈", "Funds prepared"), T2.L("만 원", "× ₩10,000"), fundsText)}
<p class="sx-fine">${T2.L("누른 칸을 한 번 더 누르면 「아직 안 넣음」으로 돌아가요.", "Press a selected option again to clear it.")}</p>
<div id="sx-cond-result">${renderCondResult(view)}</div>
${promise2(T2)}</div>`;
}

// experiences/path-app/path-ui.mjs
var esc6 = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
var svg4 = (p) => `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
var GO3 = svg4('<path d="M4 10h11.5M11 5.5 15.5 10 11 14.5"/>');
var BACK4 = svg4('<path d="M12.5 4.5 7 10l5.5 5.5"/>');
var ON3 = svg4('<path d="m5 10.4 3.2 3.1L15 6.6"/>');
function ctx3(view) {
  const now = view.now || /* @__PURE__ */ new Date();
  const en = view.lang === "en";
  const L5 = (ko, e) => en ? e : ko;
  const pick2 = (o) => o ? en ? o.en : o.ko : "";
  const thisYear = Number(new Date((now instanceof Date ? now.getTime() : new Date(now).getTime()) + 9 * 36e5).toISOString().slice(0, 4));
  return { now, en, L: L5, pick: pick2, md: (d) => monthDay(d, en, thisYear), profile: view.profile || {}, programs: view.programs || [], posts: view.posts || [], persisted: view.persisted !== false, store: ["account", "blocked", "wait"].includes(view.store) ? view.store : "tab", storeNote: String(view.storeNote || ""), note: typeof view.note === "string" ? view.note : "" };
}
var newTab3 = (T2) => `<span class="sr-only"> (${T2.L("새 탭에서 열림", "opens in new tab")})</span>`;
var STAGE = {
  apply: { ko: "원서와 함께", en: "With the application", who: { ko: "대학에 내요", en: "To the university" } },
  admitted: { ko: "합격 뒤", en: "After admission", who: { ko: "대학에 내요", en: "To the university" } },
  visa: { ko: "비자", en: "Visa", who: { ko: "비자신청센터(KVAC)에 내요", en: "To the visa center (KVAC)" } }
};
function nextInfo(post2, T2) {
  const apply = post2 ? nextDate(post2, T2.now, { skipDocs: true }) : null;
  if (apply) {
    const st = apply.status.state, md = T2.md(apply.due);
    const when = st === "before" ? T2.L(`${md} 시작`, `opens ${md}`) : st === "open" ? T2.L(`${md} 마감`, `closes ${md}`) : md;
    return { closed: false, text: `${T2.pick(apply.date.label)} · ${when}` };
  }
  const docs = post2 ? nextDate(post2, T2.now) : null;
  return { closed: true, docs: docs ? `${T2.pick(docs.date.label)} ${T2.md(docs.due)}` : "" };
}
function pathTarget(view) {
  const T2 = ctx3(view), id = T2.profile.target;
  const program = id ? programById(T2.programs, id) : null;
  const set = program && !program.example ? docsFor(program, T2.profile) : null;
  return set ? { program, set } : null;
}
var doneIds = (T2) => new Set((T2.profile.docs || []).map((d) => d.id));
function stageCounts(set, profile2) {
  const done = new Set((profile2.docs || []).map((d) => d.id));
  const out = {};
  for (const stage of ["apply", "admitted", "visa"]) {
    const list = set.mine.filter((d) => d.stage === stage);
    out[stage] = { n: list.filter((d) => done.has(d.id)).length, total: list.length };
  }
  return out;
}
function docRow(d, T2, done) {
  const on = done.has(d.id);
  const line = (label, o) => o ? `<p class="sx-doc-line"><b>${label}</b> ${esc6(T2.pick(o))}</p>` : "";
  const visa = d.stage === "visa";
  const unclear = !d.unclear ? "" : visa ? `<div class="sx-unclear"><p><b>${T2.L("KVAC에 확인할 것", "Check with KVAC")}</b> ${esc6(T2.pick(d.unclear))}</p></div>` : `<div class="sx-unclear"><p><b>${T2.L("요강에서 두 가지로 읽혀요", "The guide can be read two ways")}</b> ${esc6(T2.pick(d.unclear))}</p><p>${T2.L("대학에 먼저 물어보세요.", "Ask the university first.")}</p></div>`;
  return `<li class="sx-docrow"><div class="sx-doc-main"><b class="sx-doc-name">${esc6(T2.pick(d.name))}</b>${T2.en ? `<small class="sx-doc-ko" lang="ko">${esc6(d.name.ko)}</small>` : ""}${d.only ? `<p class="sx-doc-line"><b>${T2.L("해당자", "Who")}</b> ${esc6(T2.pick(d.only.cond))}</p>` : ""}${line(T2.L("구하는 곳", "Where to get it"), d.from)}${line(T2.L("날짜 조건", "Date rule"), d.when)}${d.note ? `<p class="sx-doc-note">${esc6(T2.pick(d.note))}</p>` : ""}${unclear}</div><button type="button" class="sx-btn2 sm sx-docbtn" aria-pressed="${on}" data-action="docToggle" data-id="${esc6(d.id)}"><span class="sx-on">${ON3}</span>${T2.L("준비했어요", "Ready")}<span class="sr-only"> ${esc6(T2.pick(d.name))}</span></button></li>`;
}
function stageBlock(stage, t2, T2, done, counts) {
  const docs = t2.set.mine.filter((d) => d.stage === stage), folds = t2.set.notMine.filter((d) => d.stage === stage);
  if (!docs.length && !folds.length) return "";
  const src = stage === "visa" ? t2.set.visa : t2.set.program;
  const c = counts[stage];
  const label = stage === "visa" ? `${T2.pick(STAGE.visa)} · ${T2.pick(t2.set.visa.name)}` : T2.pick(STAGE[stage]);
  const head2 = `<div class="sx-stage-head"><h2 class="sx-h" id="sx-stage-${stage}">${esc6(label)}</h2><span class="sx-stage-who">${T2.pick(STAGE[stage].who)}</span></div>`;
  const meta = `<p class="sx-src"><b>${T2.L("출처", "Source")}</b> <a href="${esc6(src.source.url)}" target="_blank" rel="noopener noreferrer">${esc6(T2.pick(src.source.title))}${newTab3(T2)}</a> · ${T2.L("확인", "checked")} ${esc6(src.checkedAt)}${stage !== "visa" && t2.set.program.term ? ` · ${esc6(T2.pick(t2.set.program.term))}` : ""}</p>`;
  const stale = isStalePost({ checkedAt: src.checkedAt }, T2.now) ? `<p class="sx-note is-box">${T2.L("확인한 지 90일이 지났어요. 서류는 원문에서 다시 확인하세요.", "This was checked more than 90 days ago. Check the documents in the original.")}</p>` : "";
  const rules = stage !== "admitted" && ((src.rules || []).length || (src.unclear || []).length) ? `<ul class="sx-rules">${(src.rules || []).map((r) => `<li>${esc6(T2.pick(r))}</li>`).join("")}${(src.unclear || []).map((r) => `<li class="is-unclear"><b>${T2.L("요강에서 두 가지로 읽혀요", "The guide can be read two ways")}</b> ${esc6(T2.pick(r))}</li>`).join("")}</ul>` : "";
  const progress = `<div class="sx-prog-row"><progress class="sx-prog" value="${c.n}" max="${c.total}" aria-labelledby="sx-stage-${stage} sx-prog-${stage}"></progress><span class="sx-prog-text" id="sx-prog-${stage}">${T2.L(`${c.n}/${c.total} 표시`, `${c.n} of ${c.total} marked`)}</span></div>`;
  let doneMsg = "";
  if (stage === "apply" && c.total > 0 && c.n === c.total) {
    const folded = folds.length, unclear = docs.filter((d) => d.unclear).length + (t2.set.program.unclear || []).length;
    const extra = [folded ? T2.L(`해당하는 사람만 내는 서류 ${folded}개`, `${folded} document${folded === 1 ? "" : "s"} only some applicants submit`) : "", unclear ? T2.L(`요강이 두 가지로 읽히는 곳 ${unclear}개`, `${unclear} place${unclear === 1 ? "" : "s"} where the guide reads two ways`) : ""].filter(Boolean);
    doneMsg = `<p class="sx-note is-box sx-done">${T2.L("원서 서류를 다 표시했어요.", "You have marked all application documents.")}${extra.length ? ` ${T2.L(`${extra.join(", ")}는 따로 확인하세요.`, `Check separately: ${extra.join("; ")}.`)}` : ""} ${T2.L("접수 방법은 요강에서 확인하세요.", "Check how to apply in the guide.")} <a href="${esc6(t2.set.program.source.url)}" target="_blank" rel="noopener noreferrer">${T2.L("요강 보기", "Open the guide")}${newTab3(T2)}</a></p>`;
  }
  const marked = folds.filter((d) => done.has(d.id)).length;
  const foldedList = folds.length ? `<details class="sx-past sx-folded" data-fold="docs-${stage}"><summary>${T2.L(`해당하는 사람만 내는 서류 ${folds.length}개`, `${folds.length} document${folds.length === 1 ? "" : "s"} only some applicants submit`)}${marked ? T2.L(` · ${marked}개 표시`, ` · ${marked} marked`) : ""}</summary><ul class="sx-docs">${folds.map((d) => docRow(d, T2, done)).join("")}</ul></details>` : "";
  return `<section class="sx-stage" aria-labelledby="sx-stage-${stage}">${head2}${meta}${stale}${docs.length ? progress : ""}${rules}${docs.length ? `<ul class="sx-docs">${docs.map((d) => docRow(d, T2, done)).join("")}</ul>` : ""}${foldedList}${doneMsg}</section>`;
}
function storeNote(T2) {
  if ((T2.store === "blocked" || T2.store === "wait") && T2.storeNote) return `<p class="sx-fine">${esc6(T2.storeNote)}</p>`;
  if (T2.store === "account") return `<p class="sx-fine">${T2.L("표시는 계정에 저장돼요. 내 정보에서 지울 수 있어요.", "Marks are saved to your account. You can delete them on the Profile page.")}</p>`;
  return T2.persisted ? `<p class="sx-fine">${T2.L("표시는 이 탭에만 있어요. 탭을 닫거나 로그아웃하면 사라져요.", "Marks stay in this tab only. They disappear when you close the tab or sign out.")}</p>` : `<p class="sx-store is-warn">${T2.L("이 브라우저에서는 저장할 수 없어서 표시를 지금 화면에서만 기억해요. 새로 고치면 사라져요.", "This browser cannot store marks, so they are remembered on this screen only and are lost on reload.")}</p>`;
}
function renderPath(view) {
  const T2 = ctx3(view), t2 = pathTarget(view);
  const back = `<button type="button" class="sx-back" data-action="nav" data-page="today">${BACK4}${T2.L("오늘", "Today")}</button>`;
  if (!t2) {
    return `<div class="sx">${back}<header class="sx-head"><p class="sx-kicker">${T2.L("내 길", "My path")}</p><h1 class="sx-title page-title" tabindex="-1">${T2.L("준비할 과정을 골라 주세요", "Pick a program to prepare for")}</h1><p class="sx-lead">${T2.L("대학 탭에서 과정을 열고 「이 과정으로 준비하기」를 누르면, 그 과정에 내는 서류와 기한을 여기에 모아 보여 줘요.", "Open a program in the Schools tab and press “Prepare for this program”. Its documents and deadlines will be gathered here.")}</p></header><button type="button" class="sx-cta" data-action="nav" data-page="univ">${T2.L("대학 보기", "Browse schools")} ${GO3}</button></div>`;
  }
  const { program, set } = t2, done = doneIds(T2), counts = stageCounts(set, T2.profile);
  const post2 = postById(T2.posts, "univ-" + program.id);
  const n = nextInfo(post2, T2);
  const tag2 = !n.closed ? n.text : T2.L("이번 원서 접수 끝남", "Applications closed");
  const closed = n.closed ? `<p class="sx-note is-box">${n.docs ? T2.L(`이번 원서 접수는 끝났어요. 이미 원서를 냈다면 남은 기한은 ${esc6(n.docs)}이에요. 아니면 다음 요강을 기다려요.`, `Applications for this intake have closed. If you already applied, your remaining deadline is ${esc6(n.docs)}. Otherwise, wait for the next guide.`) : T2.L("이번 원서 접수는 끝났어요. 다음 요강을 기다려요.", "Applications for this intake have closed. Wait for the next guide.")}</p>` : "";
  const status = set.program.status ? `<p class="sx-note is-box">${esc6(T2.pick(set.program.status))}</p>` : "";
  const ask = set.program.ask ? `<p class="sx-fine"><b>${T2.L("물을 곳", "Ask")}</b> ${esc6(T2.pick(set.program.ask))}</p>` : "";
  return `<div class="sx">${back}
<div class="sx-photo is-hero sx-post-hero">${programImage(program)}<span class="sx-photo-body"><span class="sx-tag white">${esc6(tag2)}</span></span></div>
<p class="sx-kicker">${T2.L("준비 중인 과정", "Preparing for")} · ${esc6(T2.pick(program.place))}</p>
<h1 class="sx-title page-title" tabindex="-1">${esc6(T2.pick(program.name))}${program.level !== "language" ? T2.L(" 학부", " undergraduate") : ""}</h1>
<p class="sx-lead">${esc6(T2.pick(set.program.how))}</p>${closed}${status}${ask}
<p class="sx-note">${T2.L("「준비했어요」는 내가 표시한 것이에요. 대학이나 비자신청센터(KVAC)가 확인한 것이 아니에요.", "“Ready” is your own mark. It is not a check by the university or the visa center (KVAC).")}</p>
${storeNote(T2)}${view.docFull ? `<p class="sx-store is-warn">${T2.L("표시가 예순 개라 더 넣을 수 없어요. 다른 과정의 표시를 뺀 뒤 넣어 주세요.", "You already have 60 marks. Remove some from another program first.")}</p>` : ""}
${renderDates(view, post2, T2.L("이 과정의 날짜", "Dates for this program"))}
${["apply", "admitted", "visa"].map((s) => stageBlock(s, t2, T2, done, counts)).join("")}
<div class="sx-row2"><button type="button" class="sx-btn2" data-action="univOpen" data-id="${esc6(program.id)}">${T2.L("과정 자세히 보기", "Program details")}</button><button type="button" class="sx-btn2 line" data-action="pathPick" data-id="${esc6(program.id)}">${T2.L("준비 그만하기", "Stop preparing")}</button></div>
<p class="sx-fine">${T2.L("이 목록은 입학이나 비자를 약속하지 않아요. 마지막 판단은 대학과 출입국이 해요.", "This list does not promise admission or a visa. The university and immigration office make the final decision.")}</p></div>`;
}
function renderPathCard(view) {
  const T2 = ctx3(view), t2 = pathTarget(view);
  if (!t2) return "";
  const c = stageCounts(t2.set, T2.profile).apply;
  const n = nextInfo(postById(T2.posts, "univ-" + t2.program.id), T2);
  const next = !n.closed ? T2.L(`다음: ${n.text}`, `Next: ${n.text}`) : n.docs ? T2.L(`이번 원서 접수는 끝났어요 · 이미 냈다면 ${n.docs}`, `Applications closed · if you applied: ${n.docs}`) : T2.L("이번 원서 접수는 끝났어요", "Applications closed");
  return `<section class="sx sx-today" aria-labelledby="sx-path-h"><h2 class="sx-h" id="sx-path-h">${T2.L("내 길", "My path")}</h2><button type="button" class="sx-pathcard" data-action="nav" data-page="path"><span class="sx-pathcard-main"><small>${T2.L("준비 중인 과정", "Preparing for")}</small><b>${esc6(T2.pick(t2.program.name))}${t2.program.level !== "language" ? T2.L(" 학부", " undergraduate") : ""}</b><span class="sx-prog-row"><progress class="sx-prog" value="${c.n}" max="${c.total}" aria-hidden="true"></progress><span>${T2.L(`원서 서류 ${c.n}/${c.total} 표시`, `Application documents ${c.n} of ${c.total} marked`)}</span></span><small>${esc6(next)}</small></span><span class="sx-go" aria-hidden="true">${GO3}</span></button></section>`;
}
function renderPathPick(view, program) {
  const T2 = ctx3(view);
  if (!program || program.example) return "";
  const set = docsFor(program, T2.profile);
  if (!set) return "";
  const on = T2.profile.target === program.id;
  const visa = visaFor(program) === "D-2" ? T2.L("유학(D-2)", "student (D-2)") : T2.L("어학연수(D-4-1)", "language trainee (D-4-1)");
  return `<section class="sx-card butter sx-pathpick"><p class="sx-k">${T2.L("내 길", "My path")}</p><h2>${T2.L(`이 과정의 원서 · 합격 뒤 서류와 ${visa} 비자 서류를 한곳에서 챙겨요.`, `Keep this program’s application and post-admission documents and the ${visa} visa documents in one place.`)}</h2><div class="sx-row2"><button type="button" class="sx-btn2" aria-pressed="${on}" data-action="pathPick" data-id="${esc6(program.id)}"><span class="sx-on">${ON3}</span>${T2.L("이 과정으로 준비하기", "Prepare for this program")}</button>${on ? `<button type="button" class="sx-link" data-action="nav" data-page="path">${T2.L("내 길 열기", "Open my path")}${GO3}</button>` : ""}</div></section>`;
}

// experiences/path-app/app.mjs
var root = document.getElementById("app");
var announcer = document.getElementById("announcer");
var DICT = {
  langLabel: ["언어", "Language"],
  navLabel: ["주요 메뉴", "Main menu"],
  today: ["오늘", "Today"],
  channels: ["채널", "News"],
  univ: ["대학", "Schools"],
  explore: ["찾기", "Explore"],
  prepare: ["준비", "Prepare"],
  help: ["도움", "Help"],
  profile: ["나", "Me"],
  signIn: ["가입 · 로그인", "Sign in"],
  myAccount: ["내 계정", "My account"],
  q1: ["지금, 어떤 준비를 하고 있나요?", "What are you preparing for right now?"],
  obT1: ["한국에서 쓸", "Pick the first card"],
  obT2: ["첫 카드를 고르세요.", "you’ll carry in Korea."],
  obLead: ["지금, 어떤 준비를 하고 있나요? 맞는 카드를 고르면 첫 화면이 그 준비에 맞춰져요.", "What are you preparing for right now? Pick a card and your first screen will match it."],
  startCard: ["이 카드로 시작", "Start with this card"],
  browse: ["둘러보기만 할게요", "Just browse for now"],
  obFine: ["고른 카드는 나중에 바꿀 수 있어요.", "You can change your card later."],
  fineTune: ["조금 더 맞추기", "Fine-tune"],
  obHint: ["카드를 누르면 앞으로 나와요.", "Tap a card to bring it forward."],
  picked: ["고른 카드", "Your card"],
  step2: ["선택 · 조금 더 맞추기", "Optional · Fine-tune"],
  next: ["다음", "Next"],
  skip: ["건너뛰기", "Skip"],
  back: ["이전", "Back"],
  cancel: ["취소", "Cancel"],
  start: ["이 카드로 시작", "Start with this card"],
  save: ["저장", "Save"],
  q2: ["조금 더 알려 주세요.", "Tell us a little more."],
  q2lead: ["모두 선택 사항이에요.", "Everything here is optional."],
  interests: ["관심 있는 것", "Interests"],
  secondary: ["함께 보고 싶은 목표", "Other goals to follow"],
  location: ["지금 있는 곳", "Where you are now"],
  locHint: ["카드에 맞춰 미리 골라 두었어요. 바꿀 수 있어요.", "Pre-selected from your card. You can change it."],
  abroad: ["해외", "Abroad"],
  korea: ["한국", "Korea"],
  unknown: ["정하지 않음", "Not decided"],
  myCard: ["내 카드", "Your card"],
  changeCard: ["카드 바꾸기", "Change card"],
  pickCard: ["카드 고르기", "Pick a card"],
  nextStep: ["다음 한 걸음", "Next step"],
  hNone1: ["오늘은 여기부터예요.", "Start here today."],
  hNone2: ["기회를 둘러보고 하나를 골라요.", "Browse and pick one to prepare."],
  hDraft1: ["첫 도장을 받았어요.", "You got your first stamp."],
  hDraft2: ["이제 자료를 준비할 차례예요.", "Now it’s time to prepare your materials."],
  hDone1: ["도장 세 개를 모두 받았어요.", "All three stamps collected."],
  hDone2: ["이제 공식 창구에 낼 차례예요.", "Now it’s time to submit through the official channel."],
  doneNext: ["다른 기회도 하나 더 준비해 볼까요?", "Prepare for one more opportunity?"],
  nT1: ["어디서부터 시작할까요?", "Where would you like to start?"],
  nT2: ["하나를 고르면 맞는 예시가 열려요.", "Pick one to open matching examples."],
  stampsLabel: ["준비의 세 칸", "Three steps"],
  sDone: ["마침", "Done"],
  sNow: ["지금", "Now"],
  sNext: ["다음", "Next"],
  j1: ["기회 찾기", "Find opportunities"],
  j2: ["자료 준비", "Prepare materials"],
  j3: ["직접 확인", "Check it yourself"],
  n1: ["실제 정보와 연습용 예시를 구분해 둘러봐요.", "Browse real information and practice examples, clearly labeled."],
  n2: ["내 말로 답변 초안을 적어 두어요.", "Draft your answers in your own words."],
  n3: ["내가 확인하고, 실제 제출은 공식 경로로 해요.", "Review it yourself; submit only through official channels."],
  resume: ["이어서 쓰기", "Continue writing"],
  resumeS: ["작성 중 · 아직 확인하지 않았어요", "Drafting · not reviewed yet"],
  viewPrep: ["내 준비 보기", "View my preparation"],
  homeOpps: ["연습 예시", "Practice examples"],
  demoSub: ["실제 기관이나 공고가 아니에요", "Not real institutions or postings"],
  offSub: ["새 탭에서 열려요", "Opens in a new tab"],
  jobsOff: ["채용 공고 연결을 준비하고 있어요. 지금 공고는 공식 사이트에서 확인해 주세요.", "We are preparing to connect job listings. For current openings, please check the official sites."],
  demoNote: ["연습용 예시예요. 실제 기관이나 공고가 아니니, 실제 정보는 공식 안내에서 확인하세요.", "Practice examples only, not real institutions or postings. Check official sources for real details."],
  tools: ["SYNK의 다른 체험", "Other SYNK experiences"],
  official: ["공식 안내", "Official links"],
  officialBadge: ["공식", "Official"],
  demo: ["예시", "Example"],
  checked: ["확인일", "Checked"],
  openNew: ["새 탭에서 열기", "opens in new tab"],
  exploreTitle: ["기회 둘러보기", "Explore opportunities"],
  exploreT2: ["공고와 연습 예시를 구분해서 봐요.", "Real postings and practice examples, kept apart."],
  all: ["전체", "All"],
  filter: ["목표로 거르기", "Filter by goal"],
  practice: ["연습 예시", "Practice examples"],
  details: ["자세히", "Details"],
  compareAdd: ["비교에 담기", "Add to compare"],
  compareOn: ["비교 중", "Comparing"],
  compareTitle: ["비교", "Comparison"],
  compareMax: ["최대 3개까지 비교할 수 있어요.", "You can compare up to 3."],
  clearCompare: ["비교 비우기", "Clear comparison"],
  requirements: ["준비할 내용", "What to prepare"],
  prepareThis: ["이것 준비하기", "Prepare for this"],
  backList: ["목록으로", "Back to list"],
  prepareTitle: ["내 준비", "My preparation"],
  prepareT2: ["쓰던 준비를 이어서 해요.", "Pick up where you left off."],
  noTasks: ["아직 시작한 준비가 없어요. 찾기에서 하나를 골라 보세요.", "No preparation yet. Pick one in Explore."],
  open: ["열기", "Open"],
  draft: ["작성 중", "Drafting"],
  done: ["준비 완료 · 미제출", "Ready · Not submitted"],
  source: ["출처", "Source"],
  srcK: ["지금 쓰는 준비", "Now writing"],
  srcNote: ["연습용 예시예요. 실제 기관이나 공고가 아니에요.", "A practice example, not a real institution or posting."],
  liveNote: ["공식 채용 공고에서 가져왔어요. 조건은 원문에서 확인하세요.", "From an official job posting. Check the original for conditions."],
  reopen: ["다시 보기", "View again"],
  edEyebrow: ["자료 준비", "Prepare"],
  backPrep: ["내 준비", "My preparation"],
  body: ["내 답변", "Your answer"],
  savedGuest: ["이 탭에만 저장돼요", "Stored only in this tab"],
  savedAccount: ["계정과 동기화돼요", "Syncs with your account"],
  sealSlot: ["확인", "Check"],
  confirmNote: ["준비 완료는 제출이 아니에요. 아무 곳에도 보내지 않아요.", "Ready is not a submission. Nothing is sent anywhere."],
  confirmCheck: ["내용을 직접 확인했고 실제 제출은 공식 경로로 한다는 것을 이해했어요", "I reviewed this myself and understand real submission happens through official channels"],
  confirm: ["준비 완료로 표시", "Mark as ready"],
  needBody: ["내용을 먼저 적어 주세요.", "Please write something first."],
  needCheck: ["확인 칸에 표시해 주세요.", "Please tick the confirmation box."],
  confirmed: ["준비 완료로 표시했어요. 아무 곳에도 제출되지 않았어요.", "Marked as ready. Nothing was submitted anywhere."],
  nextAction: ["다음 준비로", "Go to next task"],
  exploreMore: ["다른 기회 보기", "See other opportunities"],
  editInvalid: ["내용이 바뀌어 다시 확인이 필요해요.", "Content changed; please confirm again."],
  result: ["정리된 내용", "Your summary"],
  missing: ["찾을 수 없는 항목이에요.", "Item not found."],
  helpTitle: ["도움 받기", "Get help"],
  helpT2: ["물어볼 것을 정리해요.", "Draft what to ask."],
  helpLead: ["공식 기관에 물어볼 질문을 정리해요. 답을 대신 판단하지 않아요.", "Draft a question for official sources. PATH does not judge answers."],
  topic: ["주제", "Topic"],
  general: ["일반 체류 안내", "General stay info"],
  template: ["질문 틀", "Question template"],
  copy: ["복사하기", "Copy"],
  copied: ["복사했어요.", "Copied."],
  copyFail: ["복사하지 못했어요. 아래 글을 직접 선택해 복사하세요.", "Copy failed. Select the text below and copy it manually."],
  profileTitle: ["내 정보", "Profile"],
  profileT2: ["계정 · 카드 · 언어 · 저장", "Account, card, language and storage"],
  goal: ["내 카드", "Your card"],
  none: ["고르지 않음", "Not selected"],
  lang: ["언어", "Language"],
  changeGoal: ["카드 바꾸기", "Change card"],
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
  datesStore: ["「다가오는 날」은 계정에 저장되지 않고 이 탭에만 있어요. 탭을 닫거나 로그아웃하면 사라져요.", "“Coming up” dates are not saved to your account; they stay in this tab only and disappear when you close the tab or sign out."],
  studyStore: ["「내 조건」(한국어 · 성적 · 준비한 돈)과 「다가오는 날」은 계정에 저장되지 않고 이 탭에만 있어요. 탭을 닫거나 로그아웃하면 사라져요.", "“My conditions” (Korean level, grades, funds) and “Coming up” dates are not saved to your account; they stay in this tab only and disappear when you close the tab or sign out."],
  toolsLead: ["공식 안내와 별개인 SYNK 페이지예요. 새 탭에서 열리고 PATH 저장 내용과 분리돼요.", "Separate SYNK pages, not official sources. They open in a new tab, apart from PATH data."]
};
var t = (k) => (DICT[k] || [k, k])[state.lang === "en" ? 1 : 0];
var pick = (o) => o ? o[state.lang] ?? o.ko : "";
var esc7 = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
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
var RM = typeof matchMedia === "function" ? matchMedia("(prefers-reduced-motion: reduce)") : null;
var MOTION = typeof requestAnimationFrame === "function" && !(RM && RM.matches);
var bodies = /* @__PURE__ */ new Map();
var raf = 0;
var lastTs = 0;
function sway() {
  if (!MOTION) return;
  for (const el of [...bodies.keys()]) if (!root.contains(el)) bodies.delete(el);
  root.querySelectorAll(".hang").forEach((el) => {
    if (!bodies.has(el)) bodies.set(el, { a: (Math.random() - 0.5) * 4, v: 0, amp: 0.8, ph: Math.random() * 6.283 });
  });
  if (bodies.size && !raf) {
    lastTs = 0;
    raf = requestAnimationFrame(tick);
  }
}
function tick(ts) {
  const dt = Math.min(0.034, lastTs ? (ts - lastTs) / 1e3 : 0.016);
  lastTs = ts;
  for (const [el, b] of bodies) {
    const target = b.amp * Math.sin(ts / 1e3 * 1.3 + b.ph);
    b.v += (-36 * (b.a - target) - 2.4 * b.v) * dt;
    b.a += b.v * dt;
    el.style.setProperty("--a", `${b.a.toFixed(3)}deg`);
    el.style.setProperty("--shx", `${(12 + b.a * 1.8).toFixed(1)}px`);
  }
  raf = bodies.size ? requestAnimationFrame(tick) : 0;
}
var kick = (goal, v) => {
  if (MOTION) {
    for (const [el, b] of bodies) if (el.dataset.goal === goal) b.v += v;
  }
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
function resetForDoc(doc2) {
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
  if (!doc2?.state) S.page = "profile";
  else if (!state.onboarded) S.page = session.status().canImportGuest ? "profile" : "onboard";
  else S.page = "today";
}
var PUBLIC_WEB = (() => {
  try {
    return document.querySelector?.('meta[name="synk-path-runtime"]')?.getAttribute("content") === "public-web";
  } catch {
    return false;
  }
})();
var STUDY_PROGRAMS = programsFor(PROGRAMS, PUBLIC_WEB);
var STUDY_ON = STUDY_PROGRAMS.length > 0;
var STUDY_IDS = STUDY_PROGRAMS.map((p) => p.id);
var CHANNEL_POSTS = allPosts(STUDY_PROGRAMS);
var CHANNEL_ON = POSTS.length > 0;
var study = createProfileStore((() => {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
})());
var studySettled = false;
var studyOwnerNow = () => session.status().accountId || GUEST_OWNER;
function syncStudyOwner() {
  const now = studyOwnerNow(), saved = study.owner();
  if (saved === now) return false;
  if (saved === GUEST_OWNER) {
    study.setOwner(now);
    return false;
  }
  if (now === GUEST_OWNER && !studySettled) return false;
  study.clear();
  if (now !== GUEST_OWNER) study.setOwner(now);
  S.studyText = {};
  S.studyErrors = {};
  S.univId = null;
  S.univFilter = "all";
  return true;
}
var CONSENT_SEEN_KEY = "synk-path-study-consent-seen";
var tabStorage = () => {
  try {
    return sessionStorage;
  } catch {
    return null;
  }
};
var seenGet = () => {
  try {
    return tabStorage()?.getItem(CONSENT_SEEN_KEY) || null;
  } catch {
    return null;
  }
};
var seenSet = (id) => {
  try {
    if (id) tabStorage()?.setItem(CONSENT_SEEN_KEY, id);
    else tabStorage()?.removeItem(CONSENT_SEEN_KEY);
  } catch {
  }
};
var CONSENT_REFUSED_KEY = "synk-path-study-consent-refused";
var refusedGet = () => {
  try {
    return tabStorage()?.getItem(CONSENT_REFUSED_KEY) || null;
  } catch {
    return null;
  }
};
var refusedSet = (id) => {
  try {
    if (id) tabStorage()?.setItem(CONSENT_REFUSED_KEY, id);
    else tabStorage()?.removeItem(CONSENT_REFUSED_KEY);
  } catch {
  }
};
var studyAcctId = null;
var studyCompared = null;
var studyGone = false;
var studyAcct = createStudyAccount({ request: (op, v) => session.studyRequest(op, v), storage: tabStorage(), onChange: (sn) => {
  if (!studyAcctId) return;
  if (sn?.deletedElsewhere && !studyGone) {
    S.flash = null;
    S.consentAsk = false;
    S.consentRefused = true;
    refusedSet(studyAcctId);
    const op = studyAcct.takeOrphan();
    if (op && session.status().accountId === studyAcctId) {
      const base = tabStudyProfile();
      if (study.owner() !== studyAcctId) {
        study.clear();
        study.setOwner(studyAcctId);
      }
      try {
        study.set(op(base));
      } catch {
      }
    }
  }
  studyGone = !!sn?.deletedElsewhere;
  if (sn?.phase === "none") {
    if (seenGet() === studyAcctId) seenSet(null);
    studyCompared = null;
    S.studyChoice = false;
  }
  if (sn?.phase === "choose") seenSet(studyAcctId);
  if (sn?.phase === "consented" && studyCompared !== studyAcctId && !S.consentBusy) settleStudy(sn);
  render(false);
} });
function settleStudy(sn) {
  studyCompared = studyAcctId;
  seenSet(studyAcctId);
  const tabP = tabStudyProfile();
  if (hasStudyData(tabP)) {
    if (sameStudy(tabP, sn.profile)) {
      study.clear();
      study.setOwner(studyAcctId);
    } else S.studyChoice = true;
  }
}
try {
  globalThis.addEventListener?.("online", () => {
    if (studyAcctId && studyAcct.snapshot().pending) void studyAcct.retry();
  });
} catch {
}
var STUDY_SCALARS = ["topik", "gradePct", "fundsWon", "education", "target"];
var STUDY_LISTS = { compare: (x) => x, channelsOff: (x) => x, dates: (x) => x.id, docs: (x) => x.id };
var hasStudyData = (p) => STUDY_SCALARS.some((k) => p[k] !== null && p[k] !== void 0) || Object.keys(STUDY_LISTS).some((k) => (p[k] || []).length > 0);
var sameStudy = (a, b) => JSON.stringify(normalizeProfile({ ...a, v: 1 })) === JSON.stringify(normalizeProfile({ ...b, v: 1 }));
function studyDiff(before, after) {
  return (base) => {
    const out = { ...base };
    for (const k of STUDY_SCALARS) if (before[k] !== after[k]) out[k] = after[k];
    for (const [k, id] of Object.entries(STUDY_LISTS)) {
      const b = new Map((before[k] || []).map((x) => [id(x), x])), a = new Map((after[k] || []).map((x) => [id(x), x]));
      let list = (base[k] || []).filter((x) => !(b.has(id(x)) && !a.has(id(x))));
      for (const [key, v] of a) if (!b.has(key) || JSON.stringify(b.get(key)) !== JSON.stringify(v)) {
        const i = list.findIndex((y) => id(y) === key);
        if (i >= 0) list[i] = v;
        else list.push(v);
      }
      out[k] = list;
    }
    return normalizeProfile({ ...out, v: 1 });
  };
}
function tabStudyProfile() {
  const o = study.owner();
  return o === GUEST_OWNER || o === studyOwnerNow() ? study.get() : createProfile();
}
function studyStore() {
  if (!studyAcctId) return "tab";
  const phase = studyAcct.snapshot().phase;
  if (phase === "consented") return "account";
  if (phase === "choose") return "blocked";
  if (seenGet() === studyAcctId && phase === "loading") return "wait";
  if (seenGet() === studyAcctId && ["paused", "error"].includes(phase)) return "blocked";
  return "tab";
}
var studyLocked = () => ["blocked", "wait"].includes(studyStore());
var STUDY_WRITE_ACTS = /* @__PURE__ */ new Set(["channelShow", "dateToggle", "dateConfirm", "datesClean", "studySet", "studyClear", "pathPick", "docToggle", "studyCompare"]);
function studyStoreNote() {
  const where = studyStore();
  if (where === "wait") return accL("계정에 저장한 조건을 불러오는 중이에요.", "Loading the conditions saved to your account.");
  if (where === "blocked") return studyAcct.snapshot().phase === "choose" ? accL("계정에 올라가지 않은 변경이 남아 있어요. 위에서 어느 쪽을 쓸지 고르면 조건을 고칠 수 있어요.", "Some changes never reached your account. Choose which to use above, then you can change conditions.") : accL("계정에 저장한 조건을 지금 불러오지 못해 고칠 수 없어요. 위의 「다시 시도」를 눌러 주세요.", "Your saved conditions could not be loaded, so they cannot be changed right now. Press Retry above.");
  return "";
}
function syncStudyAccount() {
  const id = session.status().accountId || null;
  if (id === studyAcctId) return;
  studyAcctId = id;
  studyCompared = null;
  S.consentAsk = false;
  S.studyChoice = false;
  if (refusedGet() && refusedGet() !== id) refusedSet(null);
  S.consentRefused = !!id && refusedGet() === id;
  if (!id) {
    studyAcct.close();
    seenSet(null);
    refusedSet(null);
    return;
  }
  void studyAcct.open(id).then(() => {
    if (studyAcctId === id) render(false);
  });
}
function studyWrite(next) {
  const where = studyStore();
  if (where === "blocked" || where === "wait") return studyProfile();
  if (where === "account") {
    if (S.studyChoice) {
      study.clear();
      study.setOwner(studyAcctId);
      S.studyChoice = false;
    }
    const before = studyProfile(), after = normalizeProfile({ ...next, v: 1 });
    try {
      studyAcct.write(after, studyDiff(before, after));
    } catch {
    }
    return after;
  }
  if (study.owner() !== studyOwnerNow()) {
    study.clear();
    study.setOwner(studyOwnerNow());
  }
  const out = study.set(next);
  if (studyAcctId && studyAcct.snapshot().phase === "none" && !S.consentRefused && hasStudyData(out)) S.consentAsk = true;
  return out;
}
function studyProfile() {
  const where = studyStore();
  if (where === "blocked" || where === "wait") return createProfile();
  const p = where === "account" ? normalizeProfile({ ...studyAcct.snapshot().profile, v: 1 }) : study.owner() !== studyOwnerNow() ? null : study.get();
  if (!p) return createProfile();
  return { ...p, compare: p.compare.filter((id) => STUDY_IDS.includes(id)) };
}
var STUDY_PAGES = ["today", "path", "univ", "univDetail", "univCompare", "cond", "channels", "post"];
function studyNoticesHtml() {
  if (!STUDY_ON || !studyAcctId || !STUDY_PAGES.includes(S.page)) return "";
  const sn = studyAcct.snapshot();
  return renderStudyNotices({ lang: state.lang, ask: S.consentAsk && sn.phase === "none", choice: S.studyChoice && sn.phase === "consented", drafts: sn.phase === "choose", deleted: sn.deletedElsewhere, blocked: studyStore() === "blocked" && sn.phase !== "choose", pending: sn.phase === "consented" && sn.sendFailed });
}
var session = createPathSession({
  configUrl: "./config.json",
  onDocument(doc2) {
    state = doc2?.state || createInitialState(state?.lang || "ko");
    const owner = ownerKey(), ready = !!doc2?.state, onb = !!state.onboarded;
    const changed = activeOwner !== null && (owner !== activeOwner || ready && !hadDoc || wasOnboarded && !onb);
    activeOwner = owner;
    hadDoc = ready;
    wasOnboarded = onb;
    if (changed) resetForDoc(doc2);
    if (!localMutation) render(false);
  },
  onStatus() {
    if (!localMutation) render(false);
  }
});
state = session.document()?.state || createInitialState("ko");
hadDoc = !!session.document()?.state;
var S = { consentAsk: false, consentRefused: false, consentMinor: null, consentGuardian: false, consentBusy: false, consentError: "", consentReturn: null, studyChoice: false, page: state.onboarded ? "today" : "onboard", step: 1, draft: null, filter: state.primaryGoal || "all", compare: [], oppId: null, taskId: null, help: state.primaryGoal || "study", flash: null, copyMsg: null, error: null, drop: MOTION, practiceOpen: false, univId: null, univFilter: "all", studyText: {}, studyErrors: {}, channelId: null, postId: null, dateNote: null, docFull: false };
activeOwner = ownerKey();
wasOnboarded = !!state.onboarded;
function commit(next) {
  if (!next) return false;
  if (!session.status().canEdit) {
    const err = session.status().error;
    const m = err ? getAccountErrorMessage(err, state.lang) : state.lang === "en" ? "You can't change data right now. Please check the save status in Profile." : "현재는 자료를 바꿀 수 없어요. 내 정보에서 저장 상태를 확인해 주세요.";
    S.flash = esc7(m);
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
    S.flash = esc7(m);
    say(m);
    return false;
  } finally {
    localMutation = false;
  }
}
function newDraft() {
  return { primaryGoal: state.primaryGoal, interests: [...state.interests || []], secondaryGoals: [...state.secondaryGoals || []], location: state.location || "unknown" };
}
var svg5 = (box, sw, p) => `<svg viewBox="0 0 ${box} ${box}" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${p}</svg>`;
var ICON2 = {
  arrow: svg5(20, 1.7, '<path d="M4 10h11.5M11 5.5 15.5 10 11 14.5"/>'),
  back: svg5(20, 1.7, '<path d="M16 10H4.5M9 5.5 4.5 10 9 14.5"/>'),
  out: svg5(20, 1.7, '<path d="M6 14 14 6M7.5 6H14v6.5"/>'),
  check: svg5(20, 2.4, '<path d="m5 10.4 3.2 3.1L15 6.6"/>')
};
var TAB_ICON = {
  today: svg5(24, 1.6, '<rect x="4" y="5.5" width="16" height="14.5" rx="2.5"/><path d="M4 10.2h16M8.5 3.5v4M15.5 3.5v4"/><path d="M11.9 14.9h.2" stroke-width="2.6"/>'),
  explore: svg5(24, 1.6, '<circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5"/>'),
  prepare: svg5(24, 1.6, '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>'),
  channels: svg5(24, 1.6, '<rect x="4" y="5" width="13" height="14.5" rx="2"/><path d="M17 9h3v8.5a2 2 0 0 1-2 2H6"/><path d="M7.5 9h6M7.5 12.5h6M7.5 16h4"/>'),
  univ: svg5(24, 1.6, '<path d="M3.5 9.6 12 4.6l8.5 5"/><path d="M6 11v7.5M10 11v7.5M14 11v7.5M18 11v7.5M3.5 19.5h17"/>'),
  help: svg5(24, 1.6, '<path d="M4.5 5.5h15v10h-8l-4 3.5v-3.5h-3z"/><path d="M10.4 8.9a1.7 1.7 0 1 1 2.3 1.6c-.5.2-.7.6-.7 1.1M12 13.4v.1"/>'),
  profile: svg5(24, 1.6, '<circle cx="12" cy="8.5" r="3.6"/><path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4"/>')
};
var SYMBOL = {
  study: svg5(48, 1.6, '<rect x="11" y="3.5" width="26" height="41" rx="13"/><rect x="15.5" y="8" width="17" height="32" rx="8.5"/><path d="M15.6 16.8h16.8"/><path d="M24 16.8v2.6"/><path d="M16 32.4c4.6-3 11.2-4.6 16.2-2.9"/><circle cx="27.6" cy="24.2" r="1.7"/>'),
  student: svg5(48, 1.6, '<path d="M24 14.2c-4.7-3.3-11.1-4-17.2-2.7v24.4c6.1-1.3 12.5-.6 17.2 2.7 4.7-3.3 11.1-4 17.2-2.7V11.5c-6.1-1.3-12.5-.6-17.2 2.7z"/><path d="M24 14.2v24.4"/><path d="M11.2 18.6c3-.4 6.1 0 8.6 1M11.2 23.6c3-.4 6.1 0 8.6 1M28.2 19.6c2.5-1 5.6-1.4 8.6-1"/>'),
  job: svg5(48, 1.6, '<rect x="6.5" y="15.5" width="35" height="25" rx="3.6"/><path d="M18 15.5v-3.4a2.6 2.6 0 0 1 2.6-2.6h6.8a2.6 2.6 0 0 1 2.6 2.6v3.4"/><path d="M6.5 26.5h13.5M28 26.5h13.5"/><rect x="20" y="23.6" width="8" height="6" rx="1.4"/>')
};
var CARD_NO = { study: "01", student: "02", job: "03" };
var CLIP = '<svg class="clip" viewBox="0 0 22 38" aria-hidden="true" focusable="false"><path d="M5.5 0h11v6.6a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2z" fill="url(#metal)"/><path d="M7.4 2.2h7.2" stroke="rgba(0,0,0,.18)" stroke-width=".8"/><circle cx="11" cy="12.6" r="3.8" fill="none" stroke="url(#metal)" stroke-width="2"/><rect x="9" y="16.1" width="4" height="4.6" rx="1.2" fill="url(#metal)"/><path d="M11 20.6v6.1a4.6 4.6 0 1 0 4.6-4.6" fill="none" stroke="url(#metal)" stroke-width="2.2" stroke-linecap="round"/></svg>';
function seal(n = 0) {
  const txt = state.lang === "en" ? '<text x="60" y="69" text-anchor="middle" font-family="Inter Tight, SUIT Variable, sans-serif" font-weight="800" font-size="25" letter-spacing="1" fill="#c43a2b">DONE</text>' : '<text x="60" y="56" text-anchor="middle" font-family="SUIT Variable, sans-serif" font-weight="800" font-size="27" fill="#c43a2b">완</text><text x="60" y="86" text-anchor="middle" font-family="SUIT Variable, sans-serif" font-weight="800" font-size="27" fill="#c43a2b">료</text>';
  return `<svg class="seal" viewBox="0 0 120 120" aria-hidden="true" focusable="false"><g filter="url(#ink${n % 3 ? n % 3 + 1 : ""})"><circle cx="60" cy="60" r="52.5" fill="none" stroke="#c43a2b" stroke-width="5.6"/><circle cx="60" cy="60" r="45" fill="none" stroke="#c43a2b" stroke-width="1.4"/>${txt}</g></svg>`;
}
function hang(goal, { i = 0, slot = "mid", radio = false, on = false, action = "", kicker = "", name = "", desc = null, mode = "goal" } = {}) {
  const g = goalById(goal);
  const nm = name || pick(g.label), ds = desc ?? pick(g.description);
  const bottom = `${kicker ? `<span class="pass-kicker">${esc7(kicker)}</span>` : ""}<span class="pass-name">${esc7(nm)}</span>${ds ? `<span class="pass-desc">${esc7(ds)}</span>` : ""}`;
  const face = `<span class="pass-band" aria-hidden="true"></span><span class="pass-face" aria-hidden="true"><span class="pass-top"><span class="pass-brand">PATH</span><span class="pass-no">No.${CARD_NO[goal]}</span></span><span class="pass-symbol">${SYMBOL[goal]}</span><span class="pass-bottom">${bottom}</span></span><span class="pick-mark" aria-hidden="true">${ICON2.check}</span>`;
  const card2 = radio ? `<button type="button" class="pass goal-choice" role="radio" aria-checked="${on}" tabindex="${on || !S.draft?.primaryGoal && i === 0 ? 0 : -1}" data-action="pickGoal" data-id="${goal}" data-mode="${mode}" aria-label="${esc7(`${pick(g.label)} — ${pick(g.description)}`)}">${face}</button>` : action ? `<button type="button" class="pass" data-action="${action}" data-id="${goal}" data-mode="${mode}" aria-label="${esc7(ds ? `${nm} — ${ds}` : nm)}">${face}</button>` : `<div class="pass" data-mode="${mode}" role="img" aria-label="${esc7(ds ? `${nm} — ${ds}` : nm)}">${face}</div>`;
  return `<div class="hang${S.drop ? " is-drop" : ""}${on ? " is-on" : ""}" data-goal="${goal}" data-i="${i}" data-slot="${slot}"><div class="strap" aria-hidden="true"><span class="strap-print">PATH PATH PATH PATH PATH PATH PATH PATH</span></div>${CLIP}<div class="card-wrap"><span class="card-shadow" aria-hidden="true"></span>${card2}</div></div>`;
}
var sec = (title, sub, body, cls = "") => `<section class="sec${cls ? ` ${cls}` : ""}"><div class="sec-h"><h2>${title}</h2>${sub ? `<span>${sub}</span>` : ""}</div>${body}</section>`;
var head = (title, eyebrow, lead, title2) => `<header class="page-head">${eyebrow ? `<p class="eyebrow">${eyebrow}</p>` : ""}<h1 class="title page-title" tabindex="-1"><span>${title}</span>${title2 ? ` <span class="title-2">${title2}</span>` : ""}</h1>${lead ? `<p class="lead">${lead}</p>` : ""}</header>`;
function demoBadge(o) {
  if (o?.source === "live") return `<span class="badge">${state.lang === "en" ? "Official job posting" : "공식 채용 공고"}</span>`;
  return `<span class="badge">${t("demo")}</span>`;
}
var liveLink = (o) => o?.source === "live" && o.url ? `<p><a href="${esc7(o.url)}" target="_blank" rel="noopener noreferrer">${state.lang === "en" ? "View original posting (opens in new tab)" : "원문 공고 보기 (새 탭)"}</a></p>` : "";
var findJobEntry = (id) => (jobsFeed.snapshot().jobs || []).find((j) => j.id === id) || (session.document()?.savedJobs || []).find((j) => j.id === id);
var oppRow = (o) => `<li><button type="button" class="row" data-action="detail" data-id="${esc7(o.id)}"><span><b>${demoBadge(o)}${esc7(pick(o.title))}</b><small>${esc7(pick(o.summary))}</small></span><span class="row-go" aria-hidden="true">${ICON2.arrow}</span></button></li>`;
var TABS = ["today", "channels", "univ", "explore", "prepare", "help", "profile"].filter((p) => (p !== "univ" || STUDY_ON) && (p !== "channels" || CHANNEL_ON));
var UNIV_PAGES = ["cond", "univDetail", "univCompare"];
function shell(main) {
  const nav = state.onboarded && S.page !== "onboard";
  const acctSt = session.status();
  const acct = acctSt.signedIn ? `<button type="button" class="account" data-action="nav" data-page="profile"${S.page === "profile" ? ' aria-current="page"' : ""}>${t("myAccount")}</button>` : `<button type="button" class="account" data-action="accountSignIn">${t("signIn")}</button>`;
  const cur = (p) => navActive(p) ? ' aria-current="page"' : "";
  const tabs = TABS.map((p) => `<button type="button" data-action="nav" data-page="${p}"${cur(p)}>${t(p)}</button>`).join("");
  const bar = TABS.map((p) => `<button type="button" data-action="nav" data-page="${p}"${cur(p)}>${TAB_ICON[p]}<span>${t(p)}</span></button>`).join("");
  const lang = `<div class="lang" role="group" aria-label="${t("langLabel")}"><button type="button" data-action="setLang" data-id="ko" aria-pressed="${state.lang !== "en"}" lang="ko">한국어</button><span class="lang-sep" aria-hidden="true"></span><button type="button" data-action="setLang" data-id="en" aria-pressed="${state.lang === "en"}" lang="en">English</button></div>`;
  return `<div class="app-shell${nav ? " has-nav" : ""}" data-page="${S.page}"><header class="bar">
<button type="button" class="logo" data-action="${nav ? "nav" : "noop"}" data-page="today" aria-label="PATH"><span class="logo-mark" aria-hidden="true"></span>PATH</button>
${nav ? `<nav class="tabs" aria-label="${t("navLabel")}">${tabs}</nav>` : ""}<div class="bar-right">${lang}${acct}</div></header>
${main}${nav ? `<nav class="tabbar" aria-label="${t("navLabel")}">${bar}</nav>` : ""}</div>`;
}
function navActive(p) {
  return S.page === p || p === "explore" && S.page === "detail" || p === "prepare" && S.page === "editor" || p === "univ" && UNIV_PAGES.includes(S.page) || p === "channels" && S.page === "post" || p === "today" && S.page === "path";
}
function notices(quiet = false, noFlash = false) {
  const accSt = session.status();
  blocked = !!accSt.guestBlocked;
  storageError = accSt.error?.code === "LOCAL_STORAGE_UNAVAILABLE";
  const guestStore = storageError && !accSt.signedIn;
  const plainGuest = !accSt.signedIn && !accSt.error;
  let h = guestStore || quiet && plainGuest ? "" : renderAccountNotice(accSt, state.lang) || "";
  if (S.page === "studyConsent" && h.includes('data-state="saved"')) h = "";
  if (blocked) h += `<div class="notice error" role="alert"><p>${t("blocked")}</p><div class="actions"><button type="button" class="secondary" data-action="reset">${t("reset")}</button></div></div>`;
  h += `<div id="store-note" class="notice error" role="status"${storageError ? "" : " hidden"}><span>${t("storeFail")}</span>${guestStore ? ` <button type="button" class="text-button" data-action="accountRetry">${accL("다시 시도", "Retry")}</button>` : ""}</div>`;
  h += studyNoticesHtml();
  if (S.flash && !noFlash) h += `<div id="flash" class="notice" role="status">${S.flash}</div>`;
  return `<div class="notices">${h}</div>`;
}
function onboard() {
  const d = S.draft;
  if (S.step === 1) {
    const cards = GOALS.map((g3, i) => hang(g3.id, { i, slot: ["left", "mid", "right"][i], radio: true, on: d.primaryGoal === g3.id })).join("");
    const g2 = goalById(d.primaryGoal);
    return `<main class="ob" id="main"><div class="ob-title">${notices(true)}<h1 class="title page-title" id="q1" tabindex="-1"><span>${t("obT1")}</span> <span class="title-2">${t("obT2")}</span></h1></div>
<div class="ob-lead"><p class="lead" id="ob-lead" aria-live="polite">${g2 ? `<b class="lead-pick">${esc7(pick(g2.label))}</b>${esc7(pick(g2.note))}` : t("obLead")}</p></div>
<div class="stage ob-stage${d.primaryGoal ? " has-pick" : ""}" role="radiogroup" aria-label="${t("q1")}"><div class="rod" aria-hidden="true"></div>${cards}</div>
<div class="ob-actions"><button type="button" class="btn" data-action="finish"${d.primaryGoal ? "" : " disabled"}>${t("startCard")} ${ICON2.arrow}</button><button type="button" class="link" data-action="skip">${t("browse")}</button>${state.onboarded ? `<button type="button" class="link" data-action="cancelOnboard">${t("cancel")}</button>` : ""}</div>
<p class="fine ob-fine">${t("obFine")}${d.primaryGoal ? ` <button type="button" class="link link-sm" data-action="step2">${t("fineTune")}</button>` : ""}</p></main>`;
  }
  const g = goalById(d.primaryGoal);
  const chips = (list, key) => list.map((x) => `<button type="button" class="chip" aria-pressed="${d[key].includes(x.id)}" data-action="toggle" data-key="${key}" data-id="${x.id}">${esc7(pick(x.label))}</button>`).join("");
  const locs = ["abroad", "korea", "unknown"].map((l) => `<option value="${l}"${d.location === l ? " selected" : ""}>${t(l)}</option>`).join("");
  return `<main class="ob2" id="main"><div class="ob2-card">${hang(g.id, { slot: "mid" })}</div><div class="ob2-main">${notices(true)}<p class="eyebrow">${t("step2")}</p><h1 class="title page-title" tabindex="-1"><span>${t("q2")}</span> <span class="title-2">${t("q2lead")}</span></h1>
<fieldset class="field"><legend>${t("interests")}</legend><div class="chips">${chips(g.interests, "interests")}</div></fieldset>
<fieldset class="field"><legend>${t("secondary")}</legend><div class="chips">${chips(GOALS.filter((x) => x.id !== g.id), "secondaryGoals")}</div></fieldset>
<div class="field"><label for="loc">${t("location")}</label><span class="hint" id="loc-hint">${t("locHint")}</span><select id="loc" class="select" aria-describedby="loc-hint" data-action="loc">${locs}</select></div>
<div class="actions"><button type="button" class="btn" data-action="finish">${t("start")} ${ICON2.arrow}</button><button type="button" class="link" data-action="step1">${t("back")}</button>${state.onboarded ? `<button type="button" class="link" data-action="cancelOnboard">${t("cancel")}</button>` : ""}</div></div></main>`;
}
function stamps(states, descs) {
  const names = ["j1", "j2", "j3"];
  return `<ol class="stamps" aria-label="${t("stampsLabel")}">${states.map((s, i) => `<li class="stamp is-${s}"${s === "now" ? ' aria-current="step"' : ""}><span class="slot" aria-hidden="true">${s === "done" ? seal(i) : s === "now" ? t("sNow") : `<span class="slot-num">${i + 1}</span>`}</span><h3>${t(names[i])} <span class="stamp-state">${t(s === "done" ? "sDone" : s === "now" ? "sNow" : "sNext")}</span></h3><p>${esc7(descs[i])}</p></li>`).join("")}</ol>`;
}
function today() {
  const g = goalById(state.primaryGoal);
  if (!g) {
    const cards = GOALS.map((x, i) => hang(x.id, { i, slot: ["left", "mid", "right"][i], action: "exploreGoal" })).join("");
    return `<main class="home" id="main"><aside class="stage home-stage is-three" aria-label="${t("pickCard")}"><div class="rod" aria-hidden="true"></div>${cards}<div class="home-cap"><span></span><button type="button" class="link" data-action="changeGoal">${t("pickCard")}</button></div></aside>
<div class="home-main">${notices()}<p class="eyebrow">${t("today")}</p><h1 class="title page-title" tabindex="-1"><span>${t("nT1")}</span> <span class="title-2">${t("nT2")}</span></h1>
<ul class="goal-list">${GOALS.map((x) => `<li><button type="button" class="goal-row" data-action="exploreGoal" data-id="${x.id}"><span class="goal-sym" data-goal="${x.id}">${SYMBOL[x.id]}</span><span class="goal-txt"><b>${esc7(pick(x.label))}</b><small>${esc7(pick(x.description))}</small></span><span class="row-go" aria-hidden="true">${ICON2.arrow}</span></button></li>`).join("")}</ul>
${pathHtml()}${upcomingHtml()}${newsHtml()}<div class="home-grid">${sec(t("official"), t("offSub"), officialList("all"))}${sec(t("tools"), "", toolRows())}</div></div></main>`;
  }
  const mine = state.tasks.filter((x) => x.goal === g.id);
  const nt = getNextTask(state);
  const task = nt && nt.goal === g.id && !nt.confirmedAt ? nt : null;
  const allDone = !task && mine.length > 0 && mine.every((x) => x.confirmedAt);
  const st = task ? ["done", "now", "next"] : allDone ? ["done", "done", "done"] : ["now", "next", "next"];
  const [h1a, h1b] = task ? [t("hDraft1"), t("hDraft2")] : allDone ? [t("hDone1"), t("hDone2")] : [t("hNone1"), t("hNone2")];
  let card2;
  if (task) {
    const so = oppById(task.sourceId);
    card2 = `<section class="resume" aria-label="${t("resume")}"><div><span class="resume-k">${t("resume")}</span><span class="resume-t">${so ? `${demoBadge(so)}${esc7(pick(so.title))}` : t("missing")}</span><span class="resume-s"><i aria-hidden="true"></i>${t("resumeS")}</span></div><button type="button" class="btn" data-action="openTask" data-id="${esc7(task.id)}">${t("resume")} ${ICON2.arrow}</button></section>`;
  } else if (allDone) {
    card2 = `<section class="resume is-done"><div><span class="resume-k">${t("nextStep")}</span><span class="resume-t">${t("doneNext")}</span></div><div class="resume-acts"><button type="button" class="btn" data-action="exploreGoal" data-id="${g.id}">${t("exploreMore")} ${ICON2.arrow}</button><button type="button" class="link" data-action="nav" data-page="prepare">${t("viewPrep")}</button></div></section>`;
  } else {
    card2 = `<section class="resume is-start"><div><span class="resume-k">${t("nextStep")}</span><span class="resume-t">${esc7(pick(g.homeTitle))}</span><span class="resume-s">${esc7(pick(g.steps[0]))}</span></div><button type="button" class="btn" data-action="exploreGoal" data-id="${g.id}">${esc7(pick(g.homeAction))} ${ICON2.arrow}</button></section>`;
  }
  const opps = OPPORTUNITIES.filter((o) => o.goal === g.id).slice(0, 2);
  const off = g.id === "job" && jobsFeed.snapshot().status === "disabled" ? `<p class="off"><i aria-hidden="true"></i>${t("jobsOff")}</p>` : "";
  return `<main class="home" id="main"><aside class="stage home-stage" aria-label="${t("myCard")}"><div class="rod" aria-hidden="true"></div>${hang(g.id, { kicker: t("myCard"), mode: "next" })}<div class="home-cap"><span></span><button type="button" class="link" data-action="changeGoal">${t("changeCard")}</button></div></aside>
<div class="home-main">${notices()}<p class="eyebrow">${t("today")}</p><h1 class="title page-title" tabindex="-1"><span>${h1a}</span> <span class="title-2">${h1b}</span></h1>
${stamps(st, g.steps.map(pick))}${card2}${g.id === "study" && STUDY_ON ? renderStudyEntry(studyView()) : ""}${pathHtml()}${upcomingHtml()}${newsHtml()}
<div class="home-grid">${sec(t("homeOpps"), t("demoSub"), `<ul class="rows">${opps.map(oppRow).join("")}</ul>`)}${sec(t("official"), t("offSub"), officialList(g.id) + off)}</div></div></main>`;
}
function officialList(goal) {
  const list = OFFICIAL_LINKS.filter((l) => goal === "all" || l.goal === goal || l.goal === null);
  return `<ul class="rows">${list.map((l) => `<li><a class="row" href="${esc7(l.url)}" target="_blank" rel="noopener noreferrer"><span><b><span class="badge official">${t("officialBadge")}</span>${esc7(pick(l.title))}</b><small>${esc7(pick(l.summary))} · ${t("checked")} ${esc7(l.checkedAt)}</small></span><span class="row-go" aria-hidden="true">${ICON2.out}</span><span class="sr-only"> (${t("openNew")})</span></a></li>`).join("")}</ul>`;
}
var toolRows = () => `<ul class="rows">${EXISTING_TOOLS.map((x) => `<li><a class="row" href="${esc7(x.url)}" target="_blank" rel="noopener noreferrer"><span><b>${esc7(pick(x.title))}</b><small>${esc7(pick(x.summary))}</small></span><span class="row-go" aria-hidden="true">${ICON2.out}</span><span class="sr-only"> (${t("openNew")})</span></a></li>`).join("")}</ul>`;
function explore() {
  const f = S.filter;
  const filt = ["all", ...GOALS.map((g) => g.id)].map((id) => `<button type="button" class="chip" aria-pressed="${f === id}" data-action="filter" data-id="${id}">${id === "all" ? t("all") : esc7(pick(goalById(id).description))}</button>`).join("");
  const list = OPPORTUNITIES.filter((o) => f === "all" || o.goal === f);
  const full = S.compare.length >= 3;
  let h = head(t("exploreTitle"), t("explore"), "", t("exploreT2"));
  h += `<div role="group" aria-label="${t("filter")}" class="chips filters">${filt}</div>`;
  if (["all", "job", "student"].includes(f)) h += renderJobs({ feed: jobsFeed.snapshot(), lang: state.lang, savedJobs: session.document()?.savedJobs || [], query: S.jobQueryText ?? S.jobQuery ?? "", board: S.jobBoard || "all", onlySaved: !!S.onlySaved, page: S.jobPage || 0, canEdit: session.status().canEdit });
  h += `<details class="practice"${S.practiceOpen ? " open" : ""}><summary><span>${t("practice")}</span><small>${t("demoSub")}</small></summary><p class="meta">${t("demoNote")}</p>`;
  h += `<ul class="rows opp-rows">${list.map((o) => {
    const on = S.compare.includes(o.id);
    return `<li class="opp"><div class="opp-text"><b>${demoBadge(o)}${esc7(pick(o.title))}</b><small>${esc7(pick(o.summary))}</small></div><div class="opp-acts"><button type="button" class="btn-line" data-action="detail" data-id="${o.id}">${t("details")}</button><button type="button" class="chip" aria-pressed="${on}" data-action="compare" data-id="${o.id}"${full && !on ? " disabled" : ""}>${on ? t("compareOn") : t("compareAdd")}</button></div></li>`;
  }).join("")}</ul>`;
  if (full) h += `<p class="meta">${t("compareMax")}</p>`;
  if (S.compare.length) {
    h += `<div class="sec-h compare-h"><h2>${t("compareTitle")} (${S.compare.length}/3)</h2><button type="button" class="text-button" data-action="clearCompare">${t("clearCompare")}</button></div><div class="compare-grid">${S.compare.map(oppById).map((o) => `<div class="compare-item">${demoBadge(o)}<h3>${esc7(pick(o.title))}</h3><ol class="reqs">${o.requirements.map((r, i) => `<li><b>${i + 1}</b>${esc7(pick(r))}</li>`).join("")}</ol></div>`).join("")}</div>`;
  }
  h += "</details>";
  h += sec(t("official"), t("offSub"), officialList(f));
  return h;
}
function detail() {
  const o = oppById(S.oppId);
  if (!o) return head(t("missing")) + `<button type="button" class="btn-line" data-action="nav" data-page="explore">${t("backList")}</button>`;
  return `<article class="detail"><button type="button" class="back" data-action="nav" data-page="explore">${ICON2.back}${t("backList")}</button><p class="eyebrow">${demoBadge(o)} ${esc7(pick(goalById(o.goal)?.label))}</p><h1 class="title page-title" tabindex="-1"><span>${esc7(pick(o.title))}</span></h1><p class="lead">${esc7(pick(o.summary))}</p>${liveLink(o)}
<h2 class="h2">${t("requirements")}</h2><ol class="reqs">${o.requirements.map((r, i) => `<li><b>${i + 1}</b>${esc7(pick(r))}</li>`).join("")}</ol>
<div class="actions"><button type="button" class="btn" data-action="${o.source === "live" ? "prepareJob" : "prepareThis"}" data-id="${esc7(o.id)}">${t("prepareThis")} ${ICON2.arrow}</button></div></article>
${sec(t("official"), t("offSub"), officialList(o.goal))}`;
}
var statusHtml = (task) => `<span class="status" data-state="${task.confirmedAt ? "done" : "draft"}">${task.confirmedAt ? t("done") : t("draft")}</span>`;
function prepare() {
  let h = head(t("prepareTitle"), t("prepare"), "", t("prepareT2"));
  if (!state.tasks.length) return h + `<p class="empty">${t("noTasks")}</p><div class="actions"><button type="button" class="btn" data-action="nav" data-page="explore">${t("exploreTitle")} ${ICON2.arrow}</button></div>`;
  for (const g of GOALS) {
    const ts = state.tasks.filter((x) => x.goal === g.id);
    if (!ts.length) continue;
    h += sec(esc7(pick(g.label)), "", `<ul class="rows">${ts.map((x) => {
      const so = oppById(x.sourceId);
      return `<li><button type="button" class="row" data-action="openTask" data-id="${esc7(x.id)}"><span><b>${demoBadge(so)}${so ? esc7(pick(so.title)) : t("missing")}</b><small>${statusHtml(x)}</small></span><span class="row-go" aria-hidden="true">${ICON2.arrow}</span></button></li>`;
    }).join("")}</ul>`);
  }
  return h;
}
var countText = (v) => `${String(v || "").length.toLocaleString(state.lang === "en" ? "en-US" : "ko-KR")} / 6,000${state.lang === "en" ? "" : "자"}`;
function editor() {
  const task = state.tasks.find((x) => x.id === S.taskId);
  const o = task && oppById(task.sourceId);
  if (!o) return `<main class="content" id="main">${notices()}${head(t("missing"))}<button type="button" class="btn-line" data-action="nav" data-page="prepare">${t("prepare")}</button></main>`;
  const goal = goalById(task.goal) ? task.goal : "job";
  const st = session.status(), signed = st.signedIn;
  const savedOk = st.canEdit && !st.error;
  let h = `<main class="ed" id="main"><aside class="stage ed-stage" aria-label="${t("source")}"><div class="rod" aria-hidden="true"></div>${hang(goal, { kicker: t("srcK"), name: pick(o.title), desc: "", mode: "source" })}
<div class="ed-src"><b>${t("source")}</b><p>${demoBadge(o)}<span>${esc7(pick(o.title))}</span></p><small>${o.source === "live" ? t("liveNote") : t("srcNote")}</small>${liveLink(o)}<button type="button" class="link" data-action="detail" data-id="${esc7(o.id)}">${t("reopen")}</button></div></aside>
<div class="ed-main">${notices(false, true)}<button type="button" class="back" data-action="nav" data-page="prepare">${ICON2.back}${t("backPrep")}</button>
<p class="eyebrow">${t("edEyebrow")}</p><h1 class="title page-title" tabindex="-1"><span>${esc7(pick(o.prompt))}</span></h1>
<ol class="reqs" aria-label="${t("requirements")}">${o.requirements.map((r, i) => `<li><b>${i + 1}</b>${esc7(pick(r))}</li>`).join("")}</ol>
<section class="editor"><div class="field"><label for="body" class="field-label">${t("body")}</label>
<textarea id="body" maxlength="6000" aria-describedby="body-hint edit-err" data-action="body"${S.error === "needBody" ? ' aria-invalid="true"' : ""}>${esc7(task.body)}</textarea>
<div class="field-meta" id="body-hint"><span class="count" id="count">${countText(task.body)}</span>${savedOk ? `<span class="saved">${ICON2.check}${signed ? t("savedAccount") : t("savedGuest")}</span>` : ""}</div></div>
<p id="task-status" class="task-status">${statusHtml(task)}</p>
<label class="check"><input type="checkbox" id="ack"${task.confirmedAt ? " checked" : ""}><span class="box" aria-hidden="true">${ICON2.check}</span><span>${t("confirmCheck")}</span></label>
<p id="edit-err" class="err" role="alert">${S.error ? t(S.error) : ""}</p>
<div class="confirm-row"><button type="button" class="btn" data-action="confirm">${t("confirm")}</button><span class="slot slot-sm${task.confirmedAt ? " is-sealed" : ""}" id="seal-slot" aria-hidden="true">${task.confirmedAt ? seal() : t("sealSlot")}</span></div>
${S.flash ? `<div id="flash" class="notice flash-inline" role="status">${S.flash}</div>` : ""}<p class="fine">${t("confirmNote")}</p></section>`;
  if (task.confirmedAt) {
    const nx = getNextTask(state);
    h += `<div id="confirmed-result" class="result"><div class="sec-h"><h2>${t("result")}</h2>${demoBadge(o)}</div><div class="result-body">${esc7(task.body)}</div>
<div class="actions">${nx && nx.id !== task.id && !nx.confirmedAt ? `<button type="button" class="btn" data-action="openTask" data-id="${esc7(nx.id)}">${t("nextAction")} ${ICON2.arrow}</button>` : ""}<button type="button" class="btn-line" data-action="exploreGoal" data-id="${task.goal}">${t("exploreMore")}</button></div></div>`;
  }
  return h + "</div></main>";
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
  const opts = [...GOALS.map((g) => [g.id, pick(g.label)]), ["general", t("general")]].map(([id, l]) => `<option value="${id}"${S.help === id ? " selected" : ""}>${esc7(l)}</option>`).join("");
  return head(t("helpTitle"), t("help"), t("helpLead"), t("helpT2")) + `<div class="field field-inline"><label for="topic" class="field-label">${t("topic")}</label><select id="topic" class="select" data-action="topic">${opts}</select></div>
<section class="sec"><div class="sec-h"><h2>${t("template")}</h2><button type="button" class="btn-line" data-action="copy">${t("copy")}</button></div>
${S.copyMsg ? `<p class="notice${S.copyMsg === "copyFail" ? " error" : ""}" role="status">${t(S.copyMsg)}</p>` : ""}<pre class="result-body" id="tpl">${esc7(helpTemplate(S.help))}</pre></section>
${sec(t("official"), t("offSub"), officialList(S.help === "general" ? "none" : S.help))}
${sec(t("tools"), t("offSub"), `<p class="meta">${t("toolsLead")}</p>${toolRows()}`)}`;
}
function profile() {
  const g = goalById(state.primaryGoal);
  const accSt = session.status();
  return head(t("profileTitle"), t("profile"), "", t("profileT2")) + renderAccountPanel(accSt, state.lang, { pendingBackup: !!pendingBackup && !!accSt.canConfirmBackup && pendingBackup.owner === ownerKey(), useRemote: !!pendingBackup?.useRemote }) + `<div class="settings">
<section class="settings-group"><h2>${t("goal")}</h2><p>${g ? esc7(pick(g.label)) : t("none")}</p><button type="button" class="btn-line" data-action="changeGoal">${t("changeGoal")}</button></section>
<section class="settings-group"><h2>${t("location")}</h2><p>${t(state.location || "unknown")}</p></section>
<section class="settings-group"><h2>${t("lang")}</h2><p>${state.lang === "en" ? "English" : "한국어"}</p></section>
<section class="settings-group"><h2>${t("storage")}</h2>${accSt.signedIn ? `<p>${state.lang === "en" ? "Syncs to your account. Please check the save status above." : "계정에 동기화합니다. 위의 저장 상태를 확인해 주세요."}</p>` : `<p>${t("storageText")}</p><button type="button" class="btn-line danger" data-action="clear">${t("clear")}</button>`}${STUDY_ON ? studyStore() === "tab" ? `<p>${t("studyStore")}</p>` : "" : CHANNEL_ON ? `<p>${t("datesStore")}</p>` : ""}</section>${STUDY_ON && accSt.signedIn ? renderStudyAccountSettings({ lang: state.lang, phase: studyAcct.snapshot().phase, consent: studyAcct.snapshot().consent, store: studyStore(), errorCode: studyAcct.snapshot().error?.code || null }) : ""}</div>`;
}
var studyView = () => ({ lang: state.lang, profile: studyProfile(), programs: STUDY_PROGRAMS, rules: rulesAt(RULES, /* @__PURE__ */ new Date()), now: /* @__PURE__ */ new Date(), store: studyStore(), storeNote: studyStoreNote() });
var condView = () => ({ ...studyView(), persisted: study.persisted(), text: S.studyText, errors: S.studyErrors });
var DATE_NOTES = {
  full: ["다가오는 날이 서른 개라 더 넣을 수 없어요. 다가오는 날에서 하나를 뺀 뒤 넣어 주세요.", "Coming up already has 30 dates. Remove one first."],
  ics: ["이 브라우저에서는 달력 파일을 만들 수 없어요. 날짜를 직접 적어 두세요.", "This browser cannot create the calendar file. Please note the date yourself."]
};
var dateNoteText = () => DATE_NOTES[S.dateNote] ? accL(...DATE_NOTES[S.dateNote]) : "";
var channelView = () => ({ ...studyView(), posts: CHANNEL_POSTS, condOn: STUDY_ON, persisted: study.persisted(), note: dateNoteText() });
var channels = () => renderChannels({ ...channelView(), channelId: S.channelId });
var post = () => renderPost({ ...channelView(), postId: S.postId });
var upcomingHtml = () => CHANNEL_ON ? renderUpcoming(channelView()) : "";
var newsHtml = () => CHANNEL_ON ? renderNews(channelView()) : "";
var univ = () => renderUniv({ ...studyView(), filter: S.univFilter });
var univDetail = () => {
  const v = { ...channelView(), programId: S.univId };
  return renderUnivDetail({ ...v, pathPick: renderPathPick(v, STUDY_PROGRAMS.find((p) => p.id === S.univId)) });
};
var path = () => renderPath({ ...channelView(), docFull: S.docFull });
var pathHtml = () => STUDY_ON ? renderPathCard(channelView()) : "";
var univCompare = () => renderUnivCompare(studyView());
var cond = () => renderCond(condView());
var studyConsent = () => renderStudyConsent({ lang: state.lang, minor: S.consentMinor, guardian: S.consentGuardian, busy: S.consentBusy, error: S.consentError });
var PAGES = { today, path, channels, post, univ, univDetail, univCompare, cond, explore, detail, prepare, editor, help, profile, studyConsent };
var LOCKED_ACTIONS = ["pickGoal", "step2", "toggle", "finish", "skip", "prepareThis", "confirm", "body", "loc", "setLang", "changeGoal", "prepareJob", "saveJob", "removeJob"];
function render(focus = true) {
  if (composingEl && root.contains(composingEl) && document.activeElement === composingEl) {
    deferredRender = true;
    deferredFocus = deferredFocus || focus;
    return;
  }
  composingEl = null;
  syncStudyOwner();
  syncStudyAccount();
  if (!STUDY_ON && (S.page === "univ" || UNIV_PAGES.includes(S.page))) S.page = "today";
  if (!CHANNEL_ON && (S.page === "channels" || S.page === "post")) S.page = "today";
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
  const main = S.page === "onboard" ? onboard() : S.page === "today" ? today() : S.page === "editor" ? editor() : `<main class="content" id="main">${notices(S.page === "profile")}${PAGES[S.page]()}</main>`;
  const openFolds = focus ? [] : [...root.querySelectorAll("[data-fold]")].filter((d) => d.open).map((d) => d.getAttribute("data-fold"));
  root.innerHTML = shell(main);
  for (const f of openFolds) {
    const d = root.querySelector(`[data-fold="${f}"]`);
    if (d) d.open = true;
  }
  S.drop = false;
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
  const h1Text = h1 ? h1.textContent.replace(/\s+/g, " ").trim() : "";
  document.title = `${h1Text} · PATH`;
  if (focus && h1) {
    h1.focus();
    say(h1Text);
  }
  sway();
}
var toTop = () => {
  try {
    if (typeof scrollTo === "function") scrollTo(0, 0);
  } catch {
  }
};
function go(page) {
  S.drop = MOTION && page !== S.page && (page === "onboard" || page === "today");
  S.page = page;
  S.flash = null;
  S.dateNote = null;
  S.docFull = false;
  S.error = null;
  S.copyMsg = null;
  S.studyText = {};
  S.studyErrors = {};
  render();
  toTop();
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
  nav: (el) => {
    if (el.dataset.page === "channels") S.channelId = null;
    go(el.dataset.page);
  },
  univOpen(el) {
    S.univId = el.dataset.id;
    go("univDetail");
  },
  channelOpen(el) {
    S.channelId = el.dataset.id || null;
    go("channels");
  },
  postOpen(el) {
    S.postId = el.dataset.id;
    go("post");
  },
  channelShow(el) {
    const id = el.dataset.id, next = studyWrite(toggleChannel(studyProfile(), id));
    render(false);
    root.querySelector(`[data-action="channelShow"][data-id="${id}"]`)?.focus();
    say(next.channelsOff.includes(id) ? accL("오늘 화면의 새 소식에서 뺐어요.", "Removed from Latest news on Today.") : accL("오늘 화면의 새 소식에 보여요.", "Shown in Latest news on Today."));
  },
  dateToggle(el) {
    const id = el.dataset.id, hit = findDate(CHANNEL_POSTS, id);
    if (!hit) return;
    const cur = studyProfile(), now = /* @__PURE__ */ new Date();
    let msg;
    if (cur.dates.some((x) => x.id === id)) {
      studyWrite(removeDate(cur, id));
      S.dateNote = null;
      msg = accL("다가오는 날에서 뺐어요.", "Removed from Coming up.");
    } else {
      const st = dateStatus(hit.date, now).state;
      if (st === "past" || st === "cancelled") return;
      let base = cur;
      if (base.dates.length >= MAX_DATES) base = keepDates(base, base.dates.filter((x) => {
        const h = findDate(CHANNEL_POSTS, x.id);
        const s2 = h && dateStatus(h.date, now).state;
        return h && s2 !== "past" && s2 !== "cancelled";
      }).map((x) => x.id));
      const r = addDate(base, { id, start: hit.date.start, end: endDay(hit.date) });
      if (r.full) {
        S.dateNote = "full";
        msg = dateNoteText();
      } else {
        S.dateNote = null;
        studyWrite(r.profile);
        msg = studyStore() === "account" ? accL("다가오는 날에 넣었어요. 계정에 저장돼요.", "Added to Coming up. Saved to your account.") : study.persisted() ? accL("이 탭의 다가오는 날에 넣었어요.", "Added to Coming up in this tab.") : accL("이 브라우저에서는 저장할 수 없어 지금 화면에서만 기억해요.", "This browser cannot store it, so it is kept on this screen only.");
      }
    }
    render(false);
    (root.querySelector(`[data-action="dateToggle"][data-id="${id}"]`) || root.querySelector("#sx-dates-h") || root.querySelector(".page-title"))?.focus();
    say(msg);
  },
  dateConfirm(el) {
    const hit = findDate(CHANNEL_POSTS, el.dataset.id);
    if (!hit) return;
    studyWrite(confirmDate(studyProfile(), { id: hit.date.id, start: hit.date.start, end: endDay(hit.date) }));
    render(false);
    const row = root.querySelector(`.sx-dayrow-btn[data-date="${hit.date.id}"]`), fold2 = row && row.closest("details");
    if (fold2) fold2.open = true;
    (row || root.querySelector("#sx-up-h"))?.focus();
    say(accL("바뀐 날짜를 확인했어요.", "Changed date confirmed."));
  },
  datesClean() {
    const cur = studyProfile();
    studyWrite(keepDates(cur, cur.dates.filter((x) => findDate(CHANNEL_POSTS, x.id)).map((x) => x.id)));
    render(false);
    (root.querySelector("#sx-up-h") || root.querySelector(".page-title"))?.focus();
    say(accL("글에서 빠진 날을 목록에서 지웠어요.", "Removed dates that are no longer in the posts."));
  },
  dateIcs(el) {
    const hit = findDate(CHANNEL_POSTS, el.dataset.id);
    if (!hit) return;
    try {
      const url = URL.createObjectURL(new Blob([icsText(hit.post, hit.date, state.lang)], { type: "text/calendar;charset=utf-8" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${hit.date.id}.ics`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3e4);
      if (S.dateNote) {
        S.dateNote = null;
        render(false);
        root.querySelector(`[data-action="dateIcs"][data-id="${hit.date.id}"]`)?.focus();
      }
      say(accL("달력 파일을 내려받았어요. 파일을 열어 달력에 넣으세요.", "Calendar file downloaded. Open it to add the date to your calendar."));
    } catch {
      S.dateNote = "ics";
      render(false);
      root.querySelector(`[data-action="dateIcs"][data-id="${hit.date.id}"]`)?.focus();
      say(dateNoteText());
    }
  },
  studyFilter(el) {
    S.univFilter = STUDY_FILTERS.includes(el.dataset.id) ? el.dataset.id : "all";
    render(false);
    root.querySelector(`[data-action="studyFilter"][data-id="${S.univFilter}"]`)?.focus();
  },
  studySet(el) {
    const key = el.dataset.key, id = el.dataset.id;
    const value = key === "topik" ? Number(id) : id;
    const cur = studyProfile();
    studyWrite(setField(cur, key, cur[key] === value ? null : value));
    render(false);
    root.querySelector(`[data-action="studySet"][data-key="${key}"][data-id="${id}"]`)?.focus();
    sayStudyCount();
  },
  studyClear() {
    const cur = studyProfile();
    studyWrite({ ...createProfile(), compare: cur.compare, dates: cur.dates, channelsOff: cur.channelsOff, target: cur.target, docs: cur.docs });
    S.studyText = {};
    S.studyErrors = {};
    render(false);
    root.querySelector('[data-action="studySet"]')?.focus();
    say(accL("조건을 모두 지웠어요.", "All conditions cleared."));
  },
  pathPick(el) {
    const id = el.dataset.id, program = STUDY_PROGRAMS.find((p) => p.id === id), cur = studyProfile();
    if (!program) return;
    let msg;
    if (cur.target === id) {
      studyWrite(setTarget(cur, null).profile);
      msg = accL("이 과정 준비를 그만했어요. 서류 표시는 남겨 둬요.", "Stopped preparing for this program. Your marks are kept.");
    } else {
      const set = docsFor(program, cur), keep = set ? set.all.map((d) => d.id) : [];
      const drop = cur.docs.filter((d) => !keep.includes(d.id)).length;
      if (drop && !confirm(accL(`앞 과정에서 표시한 서류 ${drop}개를 지우고 이 과정으로 바꿀까요?`, `Remove ${drop} mark${drop === 1 ? "" : "s"} from the previous program and switch to this one?`))) return;
      studyWrite(setTarget(cur, id, keep).profile);
      msg = drop ? accL(`이 과정으로 준비해요. 앞 과정의 표시 ${drop}개를 지웠어요.`, `Now preparing for this program. Removed ${drop} earlier mark${drop === 1 ? "" : "s"}.`) : accL("이 과정으로 준비해요. 오늘 화면의 「내 길」에서 서류를 챙길 수 있어요.", "Now preparing for this program. Track the documents in “My path” on Today.");
    }
    render(false);
    (root.querySelector(`[data-action="pathPick"][data-id="${id}"]`) || root.querySelector(".page-title"))?.focus();
    say(msg);
  },
  docToggle(el) {
    const id = el.dataset.id, cur = studyProfile(), r = toggleDoc(cur, id, /* @__PURE__ */ new Date());
    if (r.full) {
      S.docFull = true;
      render(false);
      root.querySelector(`[data-action="docToggle"][data-id="${id}"]`)?.focus();
      say(accL("표시가 예순 개라 더 넣을 수 없어요. 다른 과정의 표시를 뺀 뒤 넣어 주세요.", "You already have 60 marks. Remove some from another program first."));
      return;
    }
    S.docFull = false;
    const next = studyWrite(r.profile), t2 = pathTarget({ ...channelView(), profile: next });
    render(false);
    const btn2 = root.querySelector(`[data-action="docToggle"][data-id="${id}"]`), fold2 = btn2 && btn2.closest("details");
    if (fold2) fold2.open = true;
    btn2?.focus();
    const doc2 = t2 && t2.set.mine.find((d) => d.id === id), c = doc2 ? stageCounts(t2.set, next)[doc2.stage] : null;
    const count = c ? accL(` 이 묶음 ${c.n}/${c.total}.`, ` ${c.n} of ${c.total} in this group.`) : "";
    say((r.on ? accL("준비했어요로 표시했어요.", "Marked as ready.") : accL("표시를 뺐어요.", "Mark removed.")) + count);
  },
  studyCompare(el) {
    const id = el.dataset.id, cur = studyProfile(), before = cur.compare.length;
    const next = studyWrite(toggleCompare(cur, id, STUDY_IDS));
    render(false);
    (root.querySelector(`[data-action="studyCompare"][data-id="${id}"]`) || root.querySelector("h1"))?.focus();
    const n = next.compare.length;
    say(n === before ? accL("세 곳까지 담을 수 있어요.", "You can compare up to 3.") : n < before ? accL(`비교에서 뺐어요. 지금 ${n}곳을 담았어요.`, `Removed from compare. ${n} in compare now.`) : accL(`비교에 담았어요. 지금 ${n}곳을 담았어요.`, `Added to compare. ${n} in compare now.`));
  },
  setLang(el) {
    const id = el.dataset.id === "en" ? "en" : "ko";
    const back = () => {
      const same2 = root.querySelector(`[data-action="setLang"][data-id="${id}"]`);
      (same2 && same2.offsetParent !== null ? same2 : root.querySelector('[data-action="setLang"][aria-pressed="false"]') || same2)?.focus();
    };
    if (!session.status().canEdit) {
      render(false);
      back();
      return;
    }
    const ok = commit(updateProfile(state, { lang: id }));
    if (ok) S.flash = null;
    render(false);
    back();
    if (ok) say(t("langLabel"));
  },
  pickGoal(el) {
    if (!session.status().canEdit) return;
    const g = goalById(el.dataset.id);
    S.draft.primaryGoal = g.id;
    S.draft.location = g.defaultLocation;
    S.draft.interests = S.draft.interests.filter((i) => g.interests.some((x) => x.id === i));
    S.draft.secondaryGoals = S.draft.secondaryGoals.filter((x) => x !== g.id);
    render(false);
    root.querySelector(`[data-action="pickGoal"][data-id="${g.id}"]`)?.focus();
    say(pick(g.label));
    kick(g.id, 70);
  },
  step2() {
    if (S.draft.primaryGoal) {
      S.step = 2;
      render();
      toTop();
    }
  },
  step1() {
    S.step = 1;
    render();
    toTop();
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
    if (!session.status().canEdit || !S.draft.primaryGoal) return;
    if (!commit(updateProfile(state, { ...S.draft, onboarded: true }))) {
      render(false);
      return;
    }
    S.step = 1;
    S.filter = state.primaryGoal || "all";
    S.help = state.primaryGoal || "study";
    go("today");
  },
  exploreGoal(el) {
    S.filter = el.dataset.id;
    S.practiceOpen = true;
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
    kick(state.tasks.find((x) => x.id === S.taskId)?.goal, 90);
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
function sayStudyCount() {
  say(studyCountSay(studyView()));
}
var studySayTimer = null;
function studyInput(el) {
  const key = el.dataset.key;
  if (key !== "gradePct" && key !== "fundsWon") return;
  const v = parseWhole(el.value, 0, key === "gradePct" ? GRADE_MAX : FUNDS_MAX_MAN);
  S.studyText = { ...S.studyText, [key]: el.value };
  if (v === void 0) S.studyErrors = { ...S.studyErrors, [key]: true };
  else {
    const { [key]: _gone, ...rest } = S.studyErrors;
    S.studyErrors = rest;
    if (!studyLocked()) studyWrite(setField(studyProfile(), key, v === null ? null : key === "fundsWon" ? v * 1e4 : v));
  }
  const bad = !!S.studyErrors[key];
  if (bad) el.setAttribute("aria-invalid", "true");
  else el.removeAttribute("aria-invalid");
  const hint = root.querySelector(`#${el.id}-hint`);
  if (hint) {
    hint.textContent = condHint(state.lang, key, bad);
    hint.setAttribute("class", bad ? "sx-hint is-error" : "sx-hint");
  }
  const result = root.querySelector("#sx-cond-result");
  if (result) result.innerHTML = renderCondResult(condView());
  const note = root.querySelector(".sx-store");
  if (note && !study.persisted() && !/is-warn/.test(note.getAttribute("class") || "")) {
    render(false);
    return;
  }
  if (studySayTimer) clearTimeout(studySayTimer);
  studySayTimer = setTimeout(() => {
    studySayTimer = null;
    if (S.page !== "cond") return;
    if (S.studyErrors[key]) say(condHint(state.lang, key, true));
    else sayStudyCount();
  }, 900);
}
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
    const sl = root.querySelector("#seal-slot");
    if (sl) {
      sl.textContent = t("sealSlot");
      sl.classList?.remove("is-sealed");
    }
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
  studyConsentOpen() {
    S.consentReturn = S.page === "studyConsent" ? S.consentReturn : S.page;
    S.consentMinor = null;
    S.consentGuardian = false;
    S.consentError = "";
    go("studyConsent");
  },
  consentAge(el) {
    if (S.consentBusy) return;
    S.consentMinor = el.dataset.id === "minor";
    if (!S.consentMinor) S.consentGuardian = false;
    S.consentError = "";
    render(false);
    root.querySelector(`[data-action="consentAge"][data-id="${el.dataset.id}"]`)?.focus();
  },
  consentGuardian() {
    if (S.consentBusy) return;
    S.consentGuardian = !S.consentGuardian;
    render(false);
    root.querySelector('[data-action="consentGuardian"]')?.focus();
  },
  async consentSave() {
    if (S.consentBusy || S.consentMinor === null || S.consentMinor && !S.consentGuardian) return;
    S.consentBusy = true;
    S.consentError = "";
    render(false);
    const id = studyAcctId, ok = await studyAcct.give({ profile: tabStudyProfile(), minor: S.consentMinor, lang: state.lang === "en" ? "en" : "ko" });
    S.consentBusy = false;
    if (ok === "exists" && id === studyAcctId) {
      S.consentAsk = false;
      studyCompared = null;
      settleStudy(studyAcct.snapshot());
      go(STUDY_PAGES.includes(S.consentReturn) || S.consentReturn === "profile" ? S.consentReturn : "today");
      S.flash = accL("이 계정에는 이미 계정에 저장한 조건이 있어요. 그 조건을 이어서 써요.", "This account already has saved conditions. Continuing with them.");
      render(false);
      say(S.flash);
      return;
    }
    if (ok !== true || id !== studyAcctId) {
      S.consentError = accL("계정에 저장하지 못했어요. 조건은 이 탭에 그대로 있어요. 잠시 뒤 다시 시도해 주세요.", "Could not save to your account. Your conditions are still in this tab. Please try again later.");
      render(false);
      say(S.consentError);
      return;
    }
    seenSet(id);
    refusedSet(null);
    S.consentRefused = false;
    studyCompared = id;
    study.clear();
    study.setOwner(id);
    S.consentAsk = false;
    S.studyChoice = false;
    const back = STUDY_PAGES.includes(S.consentReturn) || S.consentReturn === "profile" ? S.consentReturn : "today";
    go(back);
    S.flash = accL("계정에 저장했어요. 다른 기기에서도 이어서 볼 수 있어요.", "Saved to your account. You can continue on other devices.");
    render(false);
    say(S.flash);
  },
  consentRefuse() {
    if (S.consentBusy) return;
    S.consentRefused = true;
    refusedSet(studyAcctId);
    S.consentAsk = false;
    if (S.page === "studyConsent") go(STUDY_PAGES.includes(S.consentReturn) || S.consentReturn === "profile" ? S.consentReturn : "today");
    S.flash = accL("이 탭에만 둘게요. 내 정보에서 언제든 계정에 저장할 수 있어요.", "Kept in this tab only. You can save to your account any time on the Profile page.");
    render(false);
    say(S.flash);
  },
  async studyAccountDelete() {
    if (!confirm(accL("계정에 저장한 「내 조건」 · 「다가오는 날」 · 고른 과정 · 서류 표시를 지우고 동의를 거둬요. 지울까요?", "Delete the conditions, upcoming dates, program and marks saved to your account and withdraw your consent?"))) return;
    const ok = await studyAcct.remove();
    if (ok) {
      seenSet(null);
      S.consentRefused = true;
      refusedSet(studyAcctId);
      S.studyChoice = false;
      studyCompared = null;
      studyAcct.clearNotice();
    }
    S.flash = ok ? accL("계정의 유학 준비 자료를 지웠어요. 이제 넣는 조건은 이 탭에만 남아요.", "Deleted your study data from the account. Conditions you add now stay in this tab only.") : accL("지우지 못했어요. 잠시 뒤 다시 시도해 주세요.", "Could not delete. Please try again later.");
    render(false);
    say(S.flash);
  },
  async studyAccountRetry() {
    await studyAcct.retry();
    render(false);
  },
  studyUseAccount() {
    study.clear();
    if (studyAcctId) study.setOwner(studyAcctId);
    S.studyChoice = false;
    S.flash = accL("계정에 저장된 조건을 써요.", "Using the conditions saved to your account.");
    render(false);
    say(S.flash);
  },
  studyUseTab() {
    const tabP = tabStudyProfile();
    if (!hasStudyData(tabP)) {
      ACT.studyUseAccount();
      return;
    }
    const next = normalizeProfile({ ...tabP, v: 1 });
    try {
      studyAcct.write(next, () => next);
    } catch {
      return;
    }
    study.clear();
    if (studyAcctId) study.setOwner(studyAcctId);
    S.studyChoice = false;
    S.flash = accL("이 탭의 조건으로 계정을 바꿨어요.", "Replaced your account conditions with this tab.");
    render(false);
    say(S.flash);
  },
  studyNoticeClose() {
    studyAcct.clearNotice();
    render(false);
  },
  async studyDraftAccount() {
    await studyAcct.useAccount();
    S.flash = accL("계정에 저장된 조건을 써요.", "Using the conditions saved to your account.");
    render(false);
    say(S.flash);
  },
  async studyDraftPick() {
    const d = studyAcct.snapshot().localDrafts[0];
    if (!d) return;
    const ok = await studyAcct.pickDraft(d.id);
    S.flash = ok ? accL("남은 변경을 계정에 올려요.", "Sending the unsent changes to your account.") : accL("남은 변경을 찾지 못했어요. 계정 것을 써요.", "Could not find the unsent changes. Using the account.");
    render(false);
    say(S.flash);
  },
  accountSignIn: async () => {
    await session.signIn();
  },
  accountSignOut: async () => {
    if (studyAcct.snapshot().pending) {
      await studyAcct.retry();
      if (studyAcct.snapshot().pending) {
        if (!confirm(accL("계정에 아직 올라가지 않은 조건 변경이 있어요. 로그아웃하면 이 변경은 지워져요. 로그아웃할까요?", "Some condition changes are not in your account yet. Signing out deletes them. Sign out?"))) return;
      }
    }
    const studyId = studyAcctId;
    const r = await session.signOut();
    if (!accOk(r)) {
      render(false);
      return;
    }
    studyAcct.discardLocal(studyId);
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
      study.clear();
      S.studyText = {};
      S.studyErrors = {};
      S.flash = accL("이 탭의 게스트 자료를 지웠습니다.", "Cleared guest data in this tab.");
      say(S.flash);
    }
    render(false);
  }
});
root.addEventListener("click", (e) => {
  const el = e.target.closest("button[data-action]");
  if (!el || el.disabled || !ACT[el.dataset.action]) return;
  if (STUDY_WRITE_ACTS.has(el.dataset.action) && studyLocked()) {
    const m = studyStoreNote();
    S.flash = esc7(m);
    render(false);
    say(m);
    return;
  }
  const fail5 = (err) => {
    const m = getAccountErrorMessage(err, state.lang);
    S.flash = esc7(m);
    render(false);
    say(m);
  };
  try {
    Promise.resolve(ACT[el.dataset.action](el)).catch(fail5);
  } catch (err) {
    fail5(err);
  }
});
root.addEventListener("toggle", (e) => {
  if (e.target?.classList?.contains("practice")) S.practiceOpen = !!e.target.open;
}, true);
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
  if (e.target.dataset.action === "studyInput") {
    try {
      studyInput(e.target);
    } catch (err) {
      const m = getAccountErrorMessage(err, state.lang);
      S.flash = esc7(m);
      render(false);
      say(m);
    }
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
    const cnt = root.querySelector("#count");
    if (cnt) cnt.textContent = countText(v);
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
  if (a === "loc") {
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
root.addEventListener("pointerover", (e) => {
  if (!MOTION || e.pointerType !== "mouse") return;
  const h = e.target.closest?.(".hang"), b = h && bodies.get(h);
  if (b && !b.hot) {
    b.v += (e.movementX >= 0 ? -1 : 1) * 22;
    b.hot = true;
    setTimeout(() => {
      b.hot = false;
    }, 600);
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
  S.flash = esc7(m);
  render(false);
  say(m);
}).finally(() => {
  studySettled = true;
  if (syncStudyOwner()) render(false);
});
void jobsFeed.load();
