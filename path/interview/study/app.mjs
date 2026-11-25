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
  const state = base64url(cryptoAPI.getRandomValues(new Uint8Array(32)));
  const challenge = base64url(new Uint8Array(await cryptoAPI.subtle.digest("SHA-256", new TextEncoder().encode(verifier))));
  return { verifier, state, challenge };
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
  const abort = new AbortController(), timer2 = setTimeout(() => abort.abort(), 12e3);
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
    clearTimeout(timer2);
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

// experiences/path-vr/interview/study/app.mjs
import { chooseFilmSources, resolveFilmClipUrl } from "../film-player.mjs";
import { createVoiceInput, voiceError } from "../voice.mjs";
import { WhisperModel } from "../whisper-model.mjs";
import { createStrictVR } from "../film/strict-vr.mjs";
import { createSpeechTurn } from "../film/speech-turn.mjs";
import { transcriptReviewPages } from "../film/rehearsal-session.mjs";

// experiences/path-app/interview-shape.mjs
var INTERVIEW_CONSENT_VERSION = 1;
var INTERVIEW_LANGS = Object.freeze(["ko", "en", "mn"]);
var INTERVIEW_STATUSES = Object.freeze(["done", "refused", "limit", "busy", "unavailable", "done_before"]);
var MAX_ANSWER_CHARS = 600;
var MAX_FOLLOWUP_CHARS = 70;
var MAX_REVIEW_CHARS = 120;
var INTERVIEW_PROGRAMS = Object.freeze({ "jbnu-ug": "전북대학교", "wku-ug": "원광대학교", "jj-ug": "전주대학교" });
var track = (id, name, main, followups, about) => Object.freeze({ id, name, main, followups: Object.freeze(followups), about });
var TRACKS = Object.freeze([
  track(
    "motive",
    "지원한 이유",
    "우리 학교에 지원한 이유를 말씀해 주세요.",
    ["그렇게 생각하게 된 계기를 한 가지 이야기해 주세요.", "다른 나라가 아니라 한국을 고른 이유는 무엇입니까?"],
    "why the applicant wants to study at this Korean university"
  ),
  track(
    "study",
    "공부할 계획",
    "입학하면 무엇을 어떻게 공부하고 싶습니까?",
    ["그 공부를 위해 지금 준비하고 있는 것은 무엇입니까?", "수업을 듣다가 모르는 것이 있으면 어떻게 하겠습니까?"],
    "what the applicant wants to study after admission and how"
  ),
  track(
    "life",
    "한국 생활",
    "한국에서 혼자 생활할 때 가장 신경 쓸 것은 무엇입니까?",
    ["그 일을 위해 어떤 준비를 하겠습니까?", "힘든 일이 생기면 누구와 어떻게 이야기하겠습니까?"],
    "how the applicant will manage daily life and adapt in Korea"
  )
]);
var TRACK_IDS = Object.freeze(TRACKS.map((t) => t.id));
var trackOf = (id) => TRACKS.find((t) => t.id === id) || null;
var fixedFollowup = (id, seed = 0) => {
  const t = trackOf(id);
  return t.followups[Math.abs(Math.trunc(seed)) % t.followups.length];
};
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
var HIDDEN_RE = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2060-\u2069\uFEFF]/;
var fault = (code) => Object.assign(new Error(code), { code });
var plain = (v) => {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return false;
  const p = Object.getPrototypeOf(v);
  return p === null || Object.getPrototypeOf(p) === null;
};
var exactKeys = (v, keys) => plain(v) && Object.keys(v).length === keys.length && keys.every((k) => Object.hasOwn(v, k));
var chars = (s) => [...s].length;
var hangulShare = (s) => {
  const letters = s.match(/\p{L}/gu) || [];
  return letters.length ? (s.match(/[가-힣]/gu) || []).length / letters.length : 0;
};
function cleanAnswer(text2) {
  const s = String(text2 ?? "").normalize("NFC").replace(new RegExp(HIDDEN_RE.source, "g"), " ").replace(/\s+/g, " ").trim();
  return [...s].slice(0, MAX_ANSWER_CHARS).join("").trim();
}
function answerOk(a) {
  return typeof a === "string" && a !== "" && a === a.trim() && a === a.normalize("NFC") && chars(a) <= MAX_ANSWER_CHARS && !HIDDEN_RE.test(a) && !/\s{2,}/.test(a);
}
function consentOk(c) {
  return exactKeys(c, ["v", "age", "lang"]) && c.v === INTERVIEW_CONSENT_VERSION && c.age === "adult" && INTERVIEW_LANGS.includes(c.lang);
}
function headOk(body, action2, keys) {
  return exactKeys(body, ["action", "request_id", "session_id", "program", "topik", "consent", ...keys]) && body.action === action2 && typeof body.request_id === "string" && UUID_RE.test(body.request_id) && typeof body.session_id === "string" && UUID_RE.test(body.session_id) && typeof body.program === "string" && Object.hasOwn(INTERVIEW_PROGRAMS, body.program) && Number.isInteger(body.topik) && body.topik >= 0 && body.topik <= 6 && consentOk(body.consent);
}
var headCopy = (body) => ({
  action: body.action,
  request_id: body.request_id.toLowerCase(),
  session_id: body.session_id.toLowerCase(),
  program: body.program,
  topik: body.topik,
  consent: { v: body.consent.v, age: body.consent.age, lang: body.consent.lang }
});
function validateTurnRequest(body) {
  if (!headOk(body, "interview_turn", ["track", "answer"]) || !TRACK_IDS.includes(body.track) || !answerOk(body.answer)) throw fault("INVALID_INTERVIEW_REQUEST");
  return { ...headCopy(body), track: body.track, answer: body.answer };
}
function validateReviewRequest(body) {
  if (!headOk(body, "interview_review", ["answers"])) throw fault("INVALID_INTERVIEW_REQUEST");
  const a = body.answers;
  if (!Array.isArray(a) || a.length !== TRACKS.length) throw fault("INVALID_INTERVIEW_REQUEST");
  const answers = a.map((row, i) => {
    if (!exactKeys(row, ["track", "main", "follow", "asked"]) || row.track !== TRACK_IDS[i] || !answerOk(row.main) || !answerOk(row.follow) || !followupOk(row.asked)) throw fault("INVALID_INTERVIEW_REQUEST");
    return { track: row.track, main: row.main, follow: row.follow, asked: row.asked };
  });
  return { ...headCopy(body), answers };
}
var BLOCKED = /(합격|점수|(?<![가-힣])만점|(?<![가-힣])비자)/u;
function followupOk(q) {
  return typeof q === "string" && q === q.trim() && q !== "" && chars(q) <= MAX_FOLLOWUP_CHARS && !HIDDEN_RE.test(q) && !/\s{2,}/.test(q) && hangulShare(q) >= 0.8 && /[?.]$/.test(q) && !/[?.!。！？].*[?.!。！？]/.test(q) && !BLOCKED.test(q) && !/[<>{}[\]"“”]/.test(q);
}
function reviewOk(s) {
  return typeof s === "string" && s === s.trim() && s !== "" && chars(s) <= MAX_REVIEW_CHARS && !HIDDEN_RE.test(s) && hangulShare(s) >= 0.6 && /^[^.!?。！？]+[.!?]$/.test(s) && !BLOCKED.test(s) && !/[<>{}[\]]/.test(s);
}
function replyHead(data, action2) {
  if (!plain(data) || data.ok !== true || data.scope !== "synk-path" || data.action !== action2 || typeof data.prompt !== "string" || !INTERVIEW_STATUSES.includes(data.status) || !(data.remaining === null || Number.isSafeInteger(data.remaining) && data.remaining >= 0)) throw fault("INVALID_INTERVIEW_REPLY");
}
function validateTurnReply(data) {
  replyHead(data, "interview_turn");
  if (data.status === "done" ? !followupOk(data.question) : data.question !== null) throw fault("INVALID_INTERVIEW_REPLY");
  return { status: data.status, remaining: data.remaining, question: data.question };
}
function validateReviewReply(data) {
  replyHead(data, "interview_review");
  if (data.status === "done" ? !(reviewOk(data.good) && reviewOk(data.next)) : data.good !== null || data.next !== null) throw fault("INVALID_INTERVIEW_REPLY");
  return { status: data.status, remaining: data.remaining, good: data.good, next: data.next };
}

// experiences/path-vr/interview/study/session.mjs
var STEPS = TRACKS.length * 2;
var ANSWER_LIMIT_MS = 6e4;
function createStudyInterview({ seed = 0 } = {}) {
  let state = fresh();
  function fresh() {
    return { phase: "idle", step: 0, question: "", answers: [], asked: [], sources: [], draft: "", remainingMs: ANSWER_LIMIT_MS, paused: false, note: "", review: null, reviewState: "none" };
  }
  const trackIndex = () => Math.floor(state.step / 2);
  const isFollow = () => state.step % 2 === 1;
  const snapshot = () => ({
    ...state,
    answers: [...state.answers],
    asked: [...state.asked],
    sources: [...state.sources],
    review: state.review ? { ...state.review } : null,
    track: TRACKS[Math.min(trackIndex(), TRACKS.length - 1)].id,
    trackName: TRACKS[Math.min(trackIndex(), TRACKS.length - 1)].name,
    follow: isFollow(),
    turn: Math.min(state.step + 1, STEPS),
    total: STEPS,
    remainingSeconds: Math.ceil(state.remainingMs / 1e3)
  });
  function ask(question, source) {
    state.question = question;
    state.asked[state.step] = question;
    state.sources[state.step] = source;
    state.phase = isFollow() ? "followup" : "question";
    state.draft = "";
    state.note = "";
    state.remainingMs = ANSWER_LIMIT_MS;
  }
  function advance(answer) {
    state.answers[state.step] = answer;
    state.draft = "";
    const done = state.step === STEPS - 1;
    if (!isFollow() || done) {
      state.phase = "reviewing";
      state.reviewState = done ? "waiting" : "none";
      return;
    }
    state.step++;
    ask(TRACKS[trackIndex()].main, "fixed");
  }
  return {
    snapshot,
    start() {
      state = fresh();
      ask(TRACKS[0].main, "fixed");
      return snapshot();
    },
    /** 질문을 다 읽었다(들었다). 답을 받는다. */
    listen() {
      if (["question", "followup"].includes(state.phase)) {
        state.phase = "listening";
        state.remainingMs = ANSWER_LIMIT_MS;
      }
      return snapshot();
    },
    tick(ms) {
      if (state.phase === "listening" && !state.paused) state.remainingMs = Math.max(0, state.remainingMs - Math.max(0, ms));
      return snapshot();
    },
    /** 답 하나. spoken이면 「들린 말」을 먼저 확인한다. 빈 답은 받지 않고 알린다. */
    submit(text2, { spoken = false } = {}) {
      if (!["listening", "confirming"].includes(state.phase)) return snapshot();
      const answer = cleanAnswer(text2);
      if (!answer && state.phase === "confirming") {
        state.note = "empty";
        return snapshot();
      }
      if (!answer) {
        state.phase = "listening";
        state.note = spoken ? "not-heard" : "empty";
        state.draft = "";
        state.remainingMs = ANSWER_LIMIT_MS;
        return snapshot();
      }
      state.note = "";
      if (spoken && state.phase === "listening") {
        state.phase = "confirming";
        state.draft = answer;
        return snapshot();
      }
      advance(answer);
      return snapshot();
    },
    /** 들린 말이 틀렸다. 같은 질문에 다시 말한다. */
    retry() {
      if (state.phase === "confirming") {
        state.phase = "listening";
        state.draft = "";
        state.note = "";
        state.remainingMs = ANSWER_LIMIT_MS;
      }
      return snapshot();
    },
    repeat() {
      if (["listening", "confirming"].includes(state.phase)) {
        state.phase = isFollow() ? "followup" : "question";
        state.draft = "";
        state.note = "";
      }
      return snapshot();
    },
    /** 꼬리 질문을 받는다. AI 질문이 없거나 꼴이 어긋나면 정해 둔 꼬리 질문을 쓴다. */
    followup(question) {
      if (state.phase !== "reviewing" || state.reviewState !== "none") return snapshot();
      const id = TRACKS[trackIndex()].id, ai = followupOk(question);
      state.step++;
      ask(ai ? question : fixedFollowup(id, seed), ai ? "ai" : "fixed");
      return snapshot();
    },
    /** 끝 평가를 받는다(없으면 null). */
    complete(review) {
      if (state.phase !== "reviewing" || state.reviewState !== "waiting") return snapshot();
      state.phase = "complete";
      state.review = review ? { good: review.good, next: review.next } : null;
      state.reviewState = review ? "done" : "none";
      return snapshot();
    },
    /** 답을 쓰기 시작하면 앞의 알림을 거둔다. */
    clearNote() {
      state.note = "";
      return snapshot();
    },
    pause() {
      if (!["idle", "complete"].includes(state.phase)) state.paused = true;
      return snapshot();
    },
    resume() {
      state.paused = false;
      return snapshot();
    },
    reset() {
      state = fresh();
      return snapshot();
    },
    /** 평가 요청에 실을 답. 갈래마다 { track, main, follow, asked }다. */
    reviewAnswers() {
      return TRACKS.map((t, i) => ({ track: t.id, main: state.answers[i * 2], follow: state.answers[i * 2 + 1], asked: state.asked[i * 2 + 1] }));
    }
  };
}

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
    const values = params.getAll(PARAM), next2 = values.length === 1 && validId(values[0]) ? { version: 1, accountId: values[0], attempted: false } : { version: 1, invalid: true };
    try {
      storage = typeof value === "function" ? value() : value;
      storage.setItem(key, JSON.stringify(next2));
    } catch {
      throw Object.assign(new Error("브라우저가 저장을 막아 플랫폼의 로그인을 이어받지 못했어요. 사이트 데이터 저장을 허용한 뒤 다시 열어 주세요."), { code: "PLATFORM_ENTRY_STORAGE", retryable: true });
    }
    intent = next2;
    invalid = next2.invalid === true;
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
var PATH_AI_WAIT_MS = Object.freeze({ translate: 125e3, check: 125e3, doc_check: 6e4, interview_turn: 3e4, interview_review: 3e4 });
var fault2 = (code, message, extra = {}) => Object.assign(new Error(message), { code, ...extra });
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
  const SESSION_KEY = `synk.oauth.session.${clientKey}`;
  const OPERATIONS = new Set(Object.values(operations));
  const bridgeRequest = bridge?.accountRequest || bridge?.request;
  const native = typeof bridgeRequest === "function" && typeof bridge?.authStatus === "function";
  const platformEntry = native ? null : createPlatformEntry({ clientKey, getUrl, replaceUrl });
  let automaticNavigations = 0;
  let snapshot = { configured: false, signedIn: false, status: "unconfigured", accountId: null, account: null, sessionGeneration: 0, error: null };
  let config, core, session2 = null, pendingExchange = null, epoch2 = 0, loginIntent = 0, disposed2 = false, starting, started = false, refreshing, unsubscribe, nativeIdentity = null, nativeLoad = null, nativeGeneration = -1;
  const controllers = /* @__PURE__ */ new Set();
  const status = () => ({ ...snapshot, account: snapshot.account ? { ...snapshot.account } : null, error: snapshot.error ? { ...snapshot.error } : null });
  const emit = (patch) => {
    snapshot = { ...snapshot, ...patch, sessionGeneration: epoch2 };
    if (!disposed2) onStatus(status());
    return status();
  };
  const guard = (expected) => {
    if (disposed2 || expected !== epoch2) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
  };
  const binding = () => [config.supabaseUrl, config.accountApiUrl, config.clients[clientKey].clientId, config.clients[clientKey].redirectUri].join("|");
  function stopRequests() {
    for (const controller of controllers) controller.abort();
  }
  function clearSession(error, nextStatus = "signed-out") {
    epoch2++;
    session2 = null;
    pendingExchange = null;
    nativeIdentity = null;
    nativeLoad = null;
    stopRequests();
    if (!native) {
      try {
        storage?.removeItem(SESSION_KEY);
      } catch {
        error ||= fault2("STORAGE", "화면의 로그인은 종료했지만 저장을 지우지 못했어요. 이 창을 닫아 주세요.");
      }
    }
    return emit({ signedIn: false, status: snapshot.configured ? nextStatus : "unconfigured", accountId: null, account: null, error: error ? publicError(error) : null });
  }
  function saveSession(next2) {
    session2 = next2;
    try {
      storage.setItem(SESSION_KEY, JSON.stringify({ ...next2, configKey: binding() }));
    } catch {
      throw fault2("STORAGE", "이 탭에 로그인을 보관하지 못했어요. 브라우저 저장 설정을 확인해 주세요.");
    }
  }
  async function responseJson(response) {
    if (!response.body?.getReader) {
      const text3 = await response.text();
      if (new TextEncoder().encode(text3).byteLength > LIMIT) throw fault2("INVALID_RESPONSE", "계정 자료의 크기를 확인하지 못했어요.");
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
          throw fault2("INVALID_RESPONSE", "계정 자료의 크기를 확인하지 못했어요.");
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
  async function send(url, token, body, { logout = false, timeoutMs = 12e3 } = {}) {
    const abort = new AbortController(), timer2 = setTimeout(() => abort.abort(), timeoutMs);
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
      throw fault2("NETWORK", "계정 서버에 연결하지 못했어요. 현재 자료를 유지하고 다시 시도해 주세요.", { retryable: true });
    } finally {
      clearTimeout(timer2);
      controllers.delete(abort);
    }
  }
  async function refresh(expected) {
    if (refreshing) return refreshing;
    const old = session2;
    if (!old?.refresh_token) throw fault2("AUTH_REQUIRED", "SYNK ID로 다시 로그인해 주세요.");
    const promise = (async () => {
      const next2 = await core.tokenRequest(config, { grant_type: "refresh_token", client_id: config.clients[clientKey].clientId, refresh_token: old.refresh_token }, fetcher);
      guard(expected);
      saveSession({ ...next2, refresh_token: next2.refresh_token || old.refresh_token });
      return session2.access_token;
    })();
    refreshing = promise;
    try {
      return await promise;
    } finally {
      if (refreshing === promise) refreshing = null;
    }
  }
  function requestBody(operation, values = {}, validate = validateState) {
    if (!OPERATIONS.has(operation) || !values || typeof values !== "object" || Array.isArray(values)) throw fault2("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    const careLibrarySave = clientKey === "care" && endpoint === "synk-care" && resource === null && operation === operations.save;
    const allowed = operation === operations.load ? [] : operation === operations.save ? ["expected_revision", "state", ...careLibrarySave ? ["messageLibraryVersion", "checkinPreferenceVersion"] : []] : ["expected_revision"];
    if (Object.keys(values).some((key) => !allowed.includes(key))) throw fault2("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    if (Object.hasOwn(values, "messageLibraryVersion") && (!careLibrarySave || values.messageLibraryVersion !== 1)) throw fault2("INVALID_REQUEST", "문구 보관함 자료 형식이 맞지 않아요.");
    if (Object.hasOwn(values, "checkinPreferenceVersion") && (!careLibrarySave || values.checkinPreferenceVersion !== 1)) throw fault2("INVALID_REQUEST", "안부 설정 자료 형식이 맞지 않아요.");
    if (operation === operations.load) return void 0;
    if (!Number.isSafeInteger(values.expected_revision) || values.expected_revision < 0) throw fault2("INVALID_REQUEST", "저장할 자료의 버전을 확인해 주세요.");
    return { action: operation === operations.save ? "save" : "delete", expected_revision: values.expected_revision, ...operation === operations.save ? { state: validate(values.state) } : {}, ...Object.hasOwn(values, "messageLibraryVersion") ? { messageLibraryVersion: 1 } : {}, ...Object.hasOwn(values, "checkinPreferenceVersion") ? { checkinPreferenceVersion: 1 } : {} };
  }
  function validateResponse(data, ownerId, res = resource, validate = validateState) {
    if (data?.ok !== true) throw fault2(data?.error?.code || "ACCOUNT_UNAVAILABLE", data?.error?.message || "계정 자료를 확인하지 못했어요.", { retryable: data?.error?.retryable === true, status: data?.error?.status, revision: data?.revision, ...missingAsset(data?.error) });
    if (data.scope !== scope || res && data.resource !== res || typeof data.accountId !== "string" || !data.accountId || data.accountId.length > 100 || !Number.isSafeInteger(data.revision) || data.revision < 0 || !Object.hasOwn(data, "state")) throw fault2("INVALID_RESPONSE", "계정 자료의 형식을 확인하지 못했어요. 현재 자료를 유지해 주세요.");
    if (ownerId && data.accountId !== ownerId) throw fault2("ACCOUNT_CHANGED", "다른 계정의 응답이 도착해 자료를 적용하지 않았어요.");
    return { ok: true, scope, ...res ? { resource: res } : {}, accountId: data.accountId, revision: data.revision, updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null, state: data.state === null ? null : validate(data.state) };
  }
  async function dispatch(operation, values, expected, ownerId, res = resource) {
    const validate = validatorFor(res);
    if (!validate) throw fault2("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    const body = requestBody(operation, values, validate);
    guard(expected);
    let data;
    if (native && res !== resource) throw fault2("INVALID_REQUEST", "이 자료는 웹에서만 열 수 있어요.");
    if (native) {
      const params = operation === operations.load ? {} : operation === operations.save ? { expected_revision: body.expected_revision, state: body.state, ...Object.hasOwn(body, "messageLibraryVersion") ? { messageLibraryVersion: body.messageLibraryVersion } : {}, ...Object.hasOwn(body, "checkinPreferenceVersion") ? { checkinPreferenceVersion: body.checkinPreferenceVersion } : {} } : { expected_revision: body.expected_revision };
      data = await bridgeRequest.call(bridge, operation, params);
      guard(expected);
    } else {
      if (!session2?.access_token) throw fault2("AUTH_REQUIRED", "SYNK ID로 로그인해 주세요.");
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
        throw fault2(code, code === "REVISION_CONFLICT" ? "다른 기기에서 자료가 바뀌었어요. 계정 자료를 다시 불러와 주세요." : "계정 요청을 마치지 못했어요. 지금 화면의 자료는 그대로예요.", { status: result.response.status, revision: result.data?.revision, retryable: result.response.status === 429 || result.response.status >= 500, ...missingAsset(result.data?.error) });
      }
      data = result.data;
    }
    guard(expected);
    return validateResponse(data, ownerId, res, validate);
  }
  async function nativeStatus(source) {
    if (disposed2) return status();
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
    epoch2++;
    nativeIdentity = key;
    const expected = epoch2;
    emit({ configured: true, signedIn: false, status: "restoring", accountId: null, account: null, error: null });
    const promise = (async () => {
      try {
        const data = await dispatch(operations.load, {}, expected, identity);
        guard(expected);
        return emit({ configured: true, signedIn: true, status: "signed-in", accountId: data.accountId, account: { synk_user_id: data.accountId, display_name: source.account.display_name || "" }, error: null });
      } catch (error) {
        if (expected === epoch2 && !disposed2) return clearSession(error, "error");
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
    const expected = epoch2;
    platformEntry?.capture(storage);
    if (native) {
      const environment = await bridge.getEnvironment();
      guard(expected);
      if (environment?.clientId !== clientKey) throw fault2("INVALID_BRIDGE", "제품 앱의 로그인 연결을 확인해 주세요.");
      if (disposed2) return status();
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
      throw fault2("NETWORK", "로그인 설정을 못 불러왔어요. 인터넷이 연결되면 다시 시도해 주세요.", { retryable: true });
    }
    guard(expected);
    let raw;
    const configEndpoint = new URL(configUrl, getUrl());
    if (configEndpoint.origin !== new URL(getUrl()).origin || configEndpoint.username || configEndpoint.password || configEndpoint.hash) throw fault2("AUTH_CONFIG", "이 앱의 계정 설정 주소를 확인해 주세요.");
    const abort = new AbortController(), timer2 = setTimeout(() => abort.abort(), 8e3);
    controllers.add(abort);
    try {
      const response = await fetcher(configEndpoint.href, { cache: "no-store", credentials: "omit", signal: abort.signal, redirect: "error" });
      if (response.ok) raw = await response.json();
      else if (response.status !== 404) throw fault2("AUTH_CONFIG", "로그인 설정을 못 불러왔어요. 잠시 뒤 다시 시도해 주세요.", { status: response.status, retryable: response.status === 429 || response.status >= 500 });
    } catch (error) {
      if (error.code) throw error;
      throw fault2("NETWORK", "로그인 설정을 못 불러왔어요. 인터넷이 연결되면 다시 시도해 주세요.", { retryable: true });
    } finally {
      clearTimeout(timer2);
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
      if (pendingExchange.configKey !== binding()) throw fault2("AUTH_REQUIRED", "로그인 연결 설정이 바뀌었어요. SYNK ID로 다시 로그인해 주세요.");
      const next2 = await core.tokenRequest(config, pendingExchange.fields, fetcher);
      guard(expected);
      pendingExchange = null;
      saveSession(next2);
    } else {
      try {
        const text2 = storage.getItem(SESSION_KEY);
        if (text2 && text2.length > 65536) throw Error("INVALID_SESSION");
        const value = JSON.parse(text2 || "null");
        if (value) {
          if (value.configKey !== binding() || typeof value.access_token !== "string" || !value.access_token || value.access_token.length > 16384 || value.refresh_token !== null && typeof value.refresh_token !== "string" || !Number.isFinite(value.expires_at)) throw Error("INVALID_SESSION");
          session2 = { access_token: value.access_token, refresh_token: value.refresh_token, expires_at: value.expires_at };
        }
      } catch {
        storage.removeItem(SESSION_KEY);
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
      storage.removeItem(SESSION_KEY);
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
  async function start2() {
    if (disposed2) throw fault2("ACCOUNT_CHANGED", "계정 연결이 종료됐어요.");
    if (starting) return starting;
    if (started && !snapshot.error?.retryable) return status();
    started = true;
    const expected = epoch2;
    emit({ status: "restoring", error: null });
    const operation = begin().catch((error) => {
      if (disposed2 || expected !== epoch2) return status();
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
    await start2();
    if (disposed2 || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
    if (snapshot.signedIn || automaticNavigations !== before) return status();
    if (native && snapshot.error?.retryable) {
      let result;
      try {
        result = await bridgeRequest.call(bridge, "load", {});
      } catch {
        result = { ok: false, error: { code: "NETWORK", message: "계정을 다시 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.", retryable: true } };
      }
      if (disposed2 || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      const source = await bridge.authStatus();
      if (disposed2 || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      await nativeStatus(source);
      if (disposed2 || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      if (snapshot.signedIn) return status();
      const error = snapshot.error || result?.error || { code: "AUTH_REQUIRED", message: "저장된 로그인을 확인하지 못했어요. SYNK ID로 다시 로그인해 주세요.", retryable: false };
      if (!snapshot.error) emit({ signedIn: false, accountId: null, account: null, status: "error", error: publicError(error) });
      throw Object.assign(new Error(error.message), error);
    }
    if (snapshot.error?.retryable) throw Object.assign(new Error(snapshot.error.message), snapshot.error);
    if (!snapshot.configured) throw fault2("AUTH_CONFIG", "SYNK ID 로그인 설정이 아직 없어요. 지금은 이 기기의 수첩을 쓸 수 있어요.");
    if (native) {
      const result = await bridge.authSignIn();
      if (disposed2 || intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
      if (result?.ok === false) throw Object.assign(new Error(result.error?.message), result.error);
      return nativeStatus(result);
    }
    const expected = epoch2;
    platformEntry.resume();
    const url = await core.beginOAuth({ config, product: clientKey, storage, now: now(), cryptoAPI });
    guard(expected);
    if (intent !== loginIntent) throw fault2("ACCOUNT_CHANGED", "계정 연결이 바뀌었어요.");
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
    if (!snapshot.signedIn || !snapshot.accountId) throw fault2("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 계정 자료를 확인해 주세요.");
    if (!validatorFor(res)) throw fault2("INVALID_REQUEST", "제품 계정 요청을 확인해 주세요.");
    const expected = epoch2, ownerId = snapshot.accountId;
    try {
      return await dispatch(operation, values, expected, ownerId, res);
    } catch (error) {
      if (expected === epoch2 && (AUTH_ERRORS.has(error.code) || error.code === "ACCOUNT_CHANGED")) clearSession(error);
      throw error;
    }
  }
  async function requestPush(action2, values = {}) {
    if (clientKey !== "care" || endpoint !== "synk-care" || native) throw fault2("PUSH_UNSUPPORTED", "예약 알림은 플레저 웹에서 설정해 주세요.");
    if (!snapshot.signedIn || !snapshot.accountId) throw fault2("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 알림을 설정해 주세요.");
    const allowed = { status: ["endpoint"], subscribe: ["subscription", "hour", "minute"], update: ["endpoint", "hour", "minute"], unsubscribe: ["endpoint"] };
    if (!Object.hasOwn(allowed, action2) || !values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).some((key) => !allowed[action2].includes(key))) throw fault2("INVALID_REQUEST", "알림 설정 형식이 맞지 않아요.");
    if (["subscribe", "update"].includes(action2) && (!Number.isInteger(values.hour) || values.hour < 0 || values.hour > 23 || !Number.isInteger(values.minute) || values.minute < 0 || values.minute > 59)) throw fault2("INVALID_REQUEST", "알림 시간이 맞지 않아요. 다시 골라 주세요.");
    if ((action2 === "update" || action2 === "unsubscribe" || Object.hasOwn(values, "endpoint")) && (typeof values.endpoint !== "string" || values.endpoint.length > 2048 || !values.endpoint.startsWith("https://"))) throw fault2("INVALID_REQUEST", "이 기기의 알림 연결이 끊겼어요. 알림을 다시 켜 주세요.");
    if (action2 === "subscribe" && (!values.subscription || typeof values.subscription !== "object" || Array.isArray(values.subscription))) throw fault2("INVALID_REQUEST", "이 기기의 알림 연결이 끊겼어요. 알림을 다시 켜 주세요.");
    const body = { action: action2, ...values };
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 8192) throw fault2("INVALID_REQUEST", "알림 설정이 너무 커서 저장할 수 없어요.");
    const expected = epoch2, ownerId = snapshot.accountId;
    try {
      guard(expected);
      let token = session2?.access_token;
      if (!token) throw fault2("AUTH_REQUIRED", "SYNK ID로 다시 로그인해 주세요.");
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
      if (!result.response.ok || data?.ok !== true) throw fault2(data?.error?.code || (result.response.status === 401 ? "AUTH_REQUIRED" : "PUSH_UNAVAILABLE"), "예약 알림을 설정하지 못했어요. 잠시 뒤 다시 시도해 주세요.", { status: result.response.status, retryable: result.response.status === 429 || result.response.status >= 500 });
      if (data.accountId !== ownerId) throw fault2("ACCOUNT_CHANGED", "계정이 바뀌어 알림 설정을 적용하지 않았어요.");
      if (data.scope !== "synk-care-push" || typeof data.enabled !== "boolean" || data.timeZone !== "Asia/Seoul" || !Number.isInteger(data.hour) || data.hour < 0 || data.hour > 23 || !Number.isInteger(data.minute) || data.minute < 0 || data.minute > 59 || typeof data.publicKey !== "string" || !/^[A-Za-z0-9_-]{87}$/.test(data.publicKey)) throw fault2("INVALID_RESPONSE", "알림 서버의 응답을 받지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      return { ok: true, scope: data.scope, accountId: ownerId, enabled: data.enabled, hour: data.hour, minute: data.minute, timeZone: data.timeZone, publicKey: data.publicKey, ...typeof data.deviceId === "string" ? { deviceId: data.deviceId } : {} };
    } catch (error) {
      if (expected === epoch2 && (AUTH_ERRORS.has(error.code) || error.code === "ACCOUNT_CHANGED")) clearSession(error);
      throw error;
    }
  }
  async function requestTranslate(body) {
    if (!pathApp || native) throw fault2("TRANSLATE_UNSUPPORTED", "이 기능은 PATH 웹에서만 쓸 수 있어요.");
    if (!snapshot.signedIn || !snapshot.accountId) throw fault2("AUTH_REQUIRED", "SYNK ID로 로그인한 뒤 다시 눌러 주세요.");
    if (!body || typeof body !== "object" || Array.isArray(body) || !Object.hasOwn(PATH_AI_WAIT_MS, body.action)) throw fault2("INVALID_REQUEST", "요청 형식이 맞지 않아요.");
    if (new TextEncoder().encode(JSON.stringify(body)).byteLength > 65536) throw fault2("INVALID_REQUEST", "보낼 글이 너무 길어요.");
    const expected = epoch2, ownerId = snapshot.accountId, wait2 = { timeoutMs: PATH_AI_WAIT_MS[body.action] };
    try {
      guard(expected);
      let token = session2?.access_token;
      if (!token) throw fault2("AUTH_REQUIRED", "SYNK ID로 다시 로그인해 주세요.");
      if (session2.expires_at <= now() + 3e4) token = await refresh(expected);
      guard(expected);
      const url = `${config.accountApiUrl.replace(/\/$/, "")}/functions/v1/synk-path`;
      let result = await send(url, token, body, wait2);
      guard(expected);
      if (result.response.status === 401 && session2?.refresh_token) {
        token = session2.access_token !== token ? session2.access_token : await refresh(expected);
        guard(expected);
        result = await send(url, token, body, wait2);
        guard(expected);
      }
      const data = result.data;
      if (!result.response.ok || data?.ok !== true) throw fault2(data?.error?.code || (result.response.status === 401 ? "AUTH_REQUIRED" : "TRANSLATE_UNAVAILABLE"), "요청을 처리하지 못했어요.", { status: result.response.status, retryable: false });
      if (data.accountId !== ownerId) throw fault2("ACCOUNT_CHANGED", "계정이 바뀌어 결과를 보이지 않았어요.");
      if (data.scope !== "synk-path" || data.action !== body.action) throw fault2("INVALID_RESPONSE", "결과의 형식을 확인하지 못했어요.");
      return data;
    } catch (error) {
      if (expected === epoch2 && (AUTH_ERRORS.has(error.code) || error.code === "ACCOUNT_CHANGED")) clearSession(error);
      throw error;
    }
  }
  function dispose() {
    disposed2 = true;
    epoch2++;
    loginIntent++;
    session2 = null;
    pendingExchange = null;
    nativeIdentity = null;
    unsubscribe?.();
    stopRequests();
  }
  return Object.freeze({ start: start2, status, signIn, signOut, request, requestPush, requestTranslate, dispose });
}

// experiences/path-app/state.mjs
var GOAL_IDS = Object.freeze(["study", "student", "job"]);
var LOCATION_IDS = Object.freeze(["unknown", "korea", "abroad"]);
var LANG_IDS = Object.freeze(["ko", "en"]);

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
      const next2 = value.charCodeAt(++i);
      if (!(next2 >= 56320 && next2 <= 57343)) return false;
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

// experiences/path-vr/interview/study/account.mjs
var CONFIG_URL = "/path/app/config.json";
function createInterviewAccount({ accountFactory = createProductAccount, uuid = () => globalThis.crypto.randomUUID(), onChange = () => {
}, options = {} } = {}) {
  let account2 = null, starting = null, owner = null;
  const watch = (s) => {
    const id = s?.signedIn && s.accountId ? s.accountId : null, before = owner;
    owner = id;
    if (before && before !== id) onChange();
  };
  const signedIn = () => {
    const s = account2?.status?.();
    return !!(s?.signedIn && s.accountId);
  };
  async function start2() {
    if (!starting) starting = (async () => {
      account2 = accountFactory({
        clientKey: "path-app",
        endpoint: "synk-path",
        scope: "synk-path",
        resource: "path-app",
        validateState: (raw) => raw == null ? null : validatePathDocument(raw),
        operations: { load: "pathLoad", save: "pathSave", delete: "pathDelete" },
        configUrl: CONFIG_URL,
        onStatus: watch,
        ...options
      });
      await account2.start();
      return signedIn();
    })().catch((error) => {
      starting = null;
      throw error;
    });
    return starting;
  }
  async function send(body) {
    if (!signedIn()) throw Object.assign(new Error("AUTH_REQUIRED"), { code: "AUTH_REQUIRED" });
    return account2.requestTranslate(body);
  }
  const head = ({ sessionId, program, topik, lang }) => ({ request_id: uuid(), session_id: sessionId, program, topik, consent: { v: INTERVIEW_CONSENT_VERSION, age: "adult", lang } });
  return {
    start: start2,
    signedIn,
    async turn(meta2, { track: track2, answer }) {
      return validateTurnReply(await send(validateTurnRequest({ action: "interview_turn", ...head(meta2), track: track2, answer })));
    },
    async review(meta2, answers) {
      return validateReviewReply(await send(validateReviewRequest({ action: "interview_review", ...head(meta2), answers })));
    },
    dispose() {
      try {
        account2?.dispose?.();
      } catch {
      }
    }
  };
}

// experiences/path-vr/interview/study/consent-mn.mjs
var CONSENT_KO = Object.freeze([
  ["보내는 것", "내가 한 답의 글, 면접 질문, 고른 대학, TOPIK 급수예요. 목소리는 보내지 않아요."],
  ["받는 곳", "Anthropic(미국)의 Claude가 꼬리 질문과 평가를 만들어요. 글은 SYNK 서버(Supabase, 싱가포르)를 거쳐 가요. 정보가 몽골 밖으로 옮겨져요."],
  ["저장", "SYNK는 답과 질문을 저장하지 않아요. Anthropic은 악용을 막으려고 정한 기간 동안 보관할 수 있고, AI 학습에는 쓰지 않아요. SYNK에는 요청한 시각, 결과 상태, 이 동의만 남아요."],
  ["거부", "보내지 않아도 돼요. 「정해 둔 질문으로」를 고르면 AI 없이 연습해요."]
]);
var CONSENT_MN = Object.freeze([
  "Илгээх зүйл: таны хариултын бичвэр, ярилцлагын асуулт, сонгосон их сургууль, TOPIK-ийн түвшин. Дуу хоолойг илгээхгүй.",
  "Хүлээн авах газар: Anthropic (АНУ)-ийн Claude нэмэлт асуулт, үнэлгээг гаргана. Бичвэр SYNK-ийн серверээр (Supabase, Сингапур) дамжина. Мэдээллийг Монголоос гадагш дамжуулна.",
  "Хадгалалт: SYNK нь таны хариулт, асуултыг хадгалахгүй. Anthropic нь үйлчилгээг зүй бусаар ашиглахаас сэргийлэх зорилгоор өөрийн тогтоосон хугацаанд хадгалж болох боловч хиймэл оюуныг сургахад ашиглахгүй. SYNK-д хүсэлт илгээсэн цаг, үр дүнгийн төлөв, энэ зөвшөөрөл л үлдэнэ.",
  "Татгалзах: илгээхгүй байж болно. «정해 둔 질문으로» (урьдчилан бэлдсэн асуулт) гэдгийг сонговол хиймэл оюунгүйгээр дадлага хийнэ.",
  "Асуулт, үнэлгээг хүн биш, хиймэл оюун гаргадаг. Нэр, хаяг, эрүүл мэнд, гэр бүлийн тухай бүү яриарай.",
  "Хиймэл оюун асуулт тавих горимыг зөвхөн 18 ба түүнээс дээш настай хүн ашиглана."
]);

// experiences/path-vr/interview/study/app.mjs
var $ = (id) => document.getElementById(id);
var ids = [
  "film",
  "reference",
  "phase-label",
  "timer",
  "pause-overlay",
  "complete-overlay",
  "question-caption",
  "setup",
  "program",
  "ai-box",
  "ai-signin",
  "ai-consent",
  "consent-mn",
  "topik",
  "adult",
  "agree",
  "status",
  "turn-label",
  "voice-prepare",
  "microphone-check",
  "voice-status",
  "mic-meter",
  "mic-check-result",
  "answer-area",
  "answer-label",
  "answer",
  "partial",
  "start",
  "listen",
  "submit",
  "confirm",
  "retry",
  "repeat",
  "pause",
  "stop",
  "room-preview",
  "vr",
  "vr-status",
  "speech-note",
  "hero",
  "result",
  "result-title",
  "review",
  "review-good",
  "review-next",
  "review-none",
  "transcript",
  "vr-stage"
];
var ui = Object.fromEntries(ids.map((id) => [id, $(id)]));
var interview = createStudyInterview({ seed: Math.floor(Math.random() * 2) });
var account = createInterviewAccount({ onChange: () => accountChanged() });
var speechTurn = createSpeechTurn();
var mode = "text";
var kind = "fixed";
var disposed = false;
var busy = false;
var epoch = 0;
var lastTick = performance.now();
var voice = null;
var preparingVoice = false;
var checkingMic = false;
var microphoneReady = false;
var micActive = false;
var micLevel = 0;
var micPeak = 0;
var partial = "";
var calibration = "";
var micStopping = null;
var vrSupported = false;
var reviewPage = 0;
var session = null;
var aiNote = "";
var reviewNote = "";
var notice = "";
var micError = "";
var filmReady = false;
var filmLoading = null;
var speechToken = 0;
var ACTIVE = ["question", "followup", "listening", "confirming", "reviewing"];
var report = (error) => {
  if (error?.name !== "AbortError" && !disposed) ui.status.textContent = error?.message || "문제가 생겼어요. 다시 눌러 주세요.";
};
var aiAllowed = () => kind === "ai" && account.signedIn() && ui.adult.checked && ui.agree.checked;
function localVoice() {
  try {
    return globalThis.speechSynthesis?.getVoices?.().find((v) => v.localService === true && /^ko\b|^ko[-_]/i.test(v.lang)) || null;
  } catch {
    return null;
  }
}
function renderSpeechNote() {
  ui["speech-note"].textContent = localVoice() ? "질문은 이 기기에 있는 한국어 목소리로도 읽어요." : "이 기기에는 기기 안의 한국어 목소리가 없어 질문을 글로만 보여요.";
}
function stopSpeaking() {
  speechToken++;
  try {
    globalThis.speechSynthesis?.cancel?.();
  } catch {
  }
}
function speak(text2) {
  stopSpeaking();
  const token = speechToken, voiceLocal = localVoice();
  if (!voiceLocal) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      if (token === speechToken) resolve();
    };
    try {
      const u = new SpeechSynthesisUtterance(text2);
      u.voice = voiceLocal;
      u.lang = voiceLocal.lang;
      u.rate = 0.92;
      u.onend = done;
      u.onerror = done;
      globalThis.speechSynthesis.speak(u);
      setTimeout(done, 15e3);
    } catch {
      resolve();
    }
  });
}
function getState() {
  const s = interview.snapshot(), voiceReady = !!voice?.ready && microphoneReady && !preparingVoice && !checkingMic;
  return {
    ...s,
    mode,
    voiceReady,
    micLevel,
    micActive,
    automaticEnd: mode === "voice",
    settling: false,
    transcript: s.phase === "confirming" ? s.draft : partial,
    reviewPages: transcriptReviewPages(s.draft),
    reviewPage,
    reviewPrompt: "들린 말이 맞으면 첫째 단추를, 다르면 「다시 말하기」를 누르세요.",
    partialReview: false,
    branch: null,
    repair: null,
    clarificationPrompt: s.phase === "listening" && micError && !micActive ? "마이크를 켜지 못했어요. 「답변 완료」를 누르면 다시 켜 봐요. 안 되면 「나가기」를 누르세요." : null,
    canStart: !busy && (s.phase === "idle" || s.phase === "complete") && (kind === "fixed" || aiAllowed()) && (mode !== "voice" || voiceReady),
    canSubmit: !busy && !s.paused && s.phase === "listening",
    canConfirm: !busy && !s.paused && s.phase === "confirming"
  };
}
var PHASE = { idle: "면접 시작 전", question: "질문", followup: "꼬리 질문", listening: "답변 중", confirming: "들린 말 확인", reviewing: "답을 듣는 중", complete: "면접 완료" };
function render() {
  if (disposed) return;
  const s = getState(), active = ACTIVE.includes(s.phase);
  document.body.classList.toggle("in-session", active || s.phase === "complete");
  Object.assign(document.body.dataset, { phase: s.paused ? "paused" : s.phase, mode, mic: micActive ? "on" : "off", urgent: mode === "voice" && s.phase === "listening" && !s.paused && s.remainingSeconds <= 10 ? "on" : "off" });
  ui["phase-label"].textContent = s.paused ? "일시 정지" : PHASE[s.phase] || "";
  ui["turn-label"].textContent = active ? `${s.turn} / ${s.total}` : "";
  ui.timer.textContent = mode === "voice" && s.phase === "listening" && !s.paused ? `${s.remainingSeconds}초` : "";
  ui.film.hidden = !filmReady || !active;
  ui.reference.hidden = filmReady && active;
  ui["pause-overlay"].hidden = !s.paused;
  ui["complete-overlay"].hidden = s.phase !== "complete";
  ui["question-caption"].textContent = active && s.phase !== "reviewing" && !s.paused ? s.question : "";
  const waiting = s.phase === "idle" || s.phase === "complete";
  ui.hero.hidden = active || s.phase === "complete";
  ui["ai-box"].hidden = kind !== "ai";
  ui["ai-signin"].hidden = kind !== "ai" || account.signedIn();
  ui["ai-consent"].hidden = kind !== "ai" || !account.signedIn();
  for (const input of document.querySelectorAll('input[name="kind"]')) input.disabled = !waiting;
  ui.program.disabled = ui.topik.disabled = ui.adult.disabled = ui.agree.disabled = !waiting;
  ui["answer-area"].hidden = !["listening", "confirming"].includes(s.phase);
  ui.answer.disabled = s.paused || busy || mode === "voice" && s.phase === "listening";
  ui["answer-label"].textContent = s.phase === "confirming" ? "들린 말(틀리면 고쳐 쓰세요)" : `질문 · ${s.question}`;
  ui.answer.placeholder = mode === "voice" ? "말한 내용은 아래에 글로 나와요." : "질문에 답을 써 주세요.";
  ui.partial.textContent = s.phase === "listening" && mode === "voice" ? partial : "";
  ui.partial.hidden = !ui.partial.textContent;
  ui.start.hidden = active;
  ui.start.disabled = !s.canStart;
  ui.start.textContent = s.phase === "complete" ? "처음부터 다시" : "면접 시작";
  ui.listen.hidden = !["question", "followup"].includes(s.phase) || s.paused;
  ui.listen.disabled = busy;
  ui.submit.hidden = s.phase !== "listening";
  ui.submit.disabled = !s.canSubmit;
  ui.confirm.hidden = s.phase !== "confirming";
  ui.confirm.disabled = !s.canConfirm;
  ui.retry.hidden = s.phase !== "confirming";
  ui.retry.disabled = busy || s.paused;
  ui.repeat.hidden = !["listening", "confirming"].includes(s.phase) || mode === "text" && s.phase === "listening";
  ui.repeat.disabled = busy || s.paused;
  ui.pause.hidden = !active;
  ui.pause.textContent = s.paused ? "이어서 진행" : "일시 정지";
  ui.pause.disabled = s.phase === "reviewing" && !s.paused;
  ui.stop.hidden = !active && s.phase !== "complete";
  ui.stop.textContent = s.phase === "complete" ? "처음 화면으로" : "종료";
  ui["voice-prepare"].hidden = mode !== "voice" || !!voice?.ready;
  ui["voice-prepare"].disabled = preparingVoice;
  ui["voice-prepare"].textContent = preparingVoice ? "한국어 음성 준비 중…" : "1. 한국어 음성 준비";
  ui["microphone-check"].hidden = mode !== "voice" || !voice?.ready || active;
  ui["microphone-check"].textContent = checkingMic ? "마이크 확인 취소" : microphoneReady ? "마이크 다시 확인" : "2. 마이크 확인";
  ui["mic-meter"].hidden = !checkingMic && !micActive;
  ui["mic-meter"].value = micLevel;
  ui["mic-check-result"].hidden = mode !== "voice" || active || !ui["mic-check-result"].textContent;
  for (const input of document.querySelectorAll('input[name="mode"]')) input.disabled = busy || preparingVoice || checkingMic || !!vr?.active || s.paused || active && s.phase !== "listening" || active && input.value === "voice" && !s.voiceReady;
  ui["room-preview"].disabled = busy || preparingVoice || checkingMic || !!vr?.active;
  ui.vr.disabled = !vrSupported || !s.voiceReady || mode !== "voice" || busy || !!vr?.active || !s.canStart && !active;
  ui.vr.textContent = "Quest 면접실 입장";
  const note = s.note === "empty" ? "답을 한 줄 써 주세요." : s.note === "not-heard" ? "말이 들리지 않았어요. 다시 말하거나 「직접 입력」으로 답해 주세요." : "";
  const micNote = mode === "voice" && !micActive && micError ? `${micError} 「질문 다시 보기」로 다시 하거나 「직접 입력」으로 답해 주세요.` : "";
  const status = {
    idle: notice ? notice : kind === "ai" && !account.signedIn() ? "AI 질문을 쓰려면 먼저 PATH 앱에서 로그인해 주세요." : kind === "ai" && !aiAllowed() ? "나이와 동의를 확인하면 시작할 수 있어요." : mode === "voice" && !s.voiceReady ? "「한국어 음성 준비」와 「마이크 확인」을 마치면 시작할 수 있어요. 글로 답하려면 「직접 입력」을 고르세요." : "준비되면 「면접 시작」을 누르세요.",
    question: "질문을 읽거나 들은 뒤 「답하기」를 누르세요.",
    followup: "내 답을 들은 면접관이 이어서 물어요. 「답하기」를 누르세요.",
    listening: micNote || note || (mode === "voice" ? micActive ? "말해 주세요. 다 말하면 「답변 완료」를 누르거나 잠깐 기다리세요." : "마이크를 켜고 있어요." : "답을 쓰고 「답변 완료」를 누르세요."),
    confirming: note || "들린 말이 맞는지 봐 주세요.",
    reviewing: s.reviewState === "waiting" ? "답을 모아 보고 있어요." : "면접관이 답을 듣고 있어요.",
    complete: aiNote || reviewNote || "면접을 마쳤어요. 다른 답으로 다시 해 볼 수 있어요."
  };
  ui.status.textContent = s.paused ? "잠시 멈췄어요. 「이어서 진행」을 누르면 이어져요." : status[s.phase] || "";
  renderResult(s);
}
function renderResult(s) {
  ui.result.hidden = s.phase !== "complete";
  if (s.phase !== "complete") {
    if (s.phase === "idle") {
      ui.transcript.replaceChildren();
      delete ui.transcript.dataset.key;
      ui["review-good"].textContent = ui["review-next"].textContent = "";
    }
    return;
  }
  ui.review.hidden = !s.review;
  ui["review-good"].textContent = s.review?.good || "";
  ui["review-next"].textContent = s.review?.next || "";
  ui["review-none"].hidden = !!s.review;
  ui["review-none"].textContent = kind === "ai" ? "이번에는 AI 평가를 받지 못했어요. 아래 답을 소리 내어 다시 읽어 보세요." : "아래 답을 소리 내어 다시 읽어 보세요. 짧은 답에는 까닭이나 예를 하나 더해 보세요.";
  const key = JSON.stringify([s.asked, s.answers, s.sources]);
  if (ui.transcript.dataset.key === key) return;
  ui.transcript.dataset.key = key;
  ui.transcript.replaceChildren(...s.asked.map((q, i) => {
    const li = document.createElement("li"), qp = document.createElement("p"), ap = document.createElement("p");
    qp.className = "q";
    qp.append(q);
    if (s.sources[i] === "ai") {
      const mark = document.createElement("small");
      mark.textContent = "AI 질문";
      qp.append(mark);
    }
    ap.className = "a";
    ap.textContent = s.answers[i] || "";
    li.append(qp, ap);
    return li;
  }));
}
function prepareFilm() {
  if (filmReady || globalThis.navigator?.connection?.saveData === true) return Promise.resolve();
  return filmLoading ||= loadFilm().finally(() => {
    filmLoading = null;
  });
}
async function loadFilm() {
  const url = new URL("../film/strict-manifest.json", import.meta.url);
  const response = await fetch(url.href, { cache: "no-store", signal: globalThis.AbortSignal?.timeout?.(15e3) });
  if (!response.ok) return;
  const manifest = await chooseFilmSources(await response.json());
  const clip = manifest.clips?.find((c) => c.id === "strict-listening"), src = resolveFilmClipUrl(clip?.variants?.["720p"]?.src || clip?.src || "", { moduleUrl: new URL("../film-player.mjs", import.meta.url).href });
  if (!src) return;
  ui.film.src = src;
  ui.film.load();
  await new Promise((resolve, reject) => {
    ui.film.addEventListener("canplay", resolve, { once: true });
    ui.film.addEventListener("error", () => reject(new Error("film")), { once: true });
    setTimeout(() => reject(new Error("film")), 2e4);
  });
  await ui.film.play();
  filmReady = true;
}
var playFilm = () => {
  if (filmReady) void ui.film.play().catch(() => {
  });
};
function getVoice() {
  if (!voice) voice = createVoiceInput({
    modelFactory: () => new WhisperModel(),
    modelNotice: "한국어 음성 모델을 준비해요. 처음 한 번 103MB쯤 내려받고, 다음부터는 받아 둔 것을 써요.",
    finalTimeoutMs: 45e3,
    onPartial({ text: text2 }) {
      if (checkingMic) calibration = text2 || calibration;
      else if (interview.snapshot().phase === "listening") {
        partial = text2 || partial;
        if (micActive) speechTurn.transcript(partial);
      }
      render();
    },
    onResult({ text: text2 }) {
      if (checkingMic) calibration = text2 || calibration;
      else if (interview.snapshot().phase === "listening") {
        partial = text2 || partial;
        if (micActive) speechTurn.transcript(partial);
      }
      render();
    },
    onLevel(value) {
      micLevel = value;
      if (checkingMic) micPeak = Math.max(micPeak, value);
      if (micActive) speechTurn.level(value);
      ui["mic-meter"].value = value;
    },
    onStatus(event) {
      ui["voice-status"].textContent = event.state === "loading" ? event.progress ? `음성 모델 준비 ${Math.round(event.progress * 100)}%` : "음성 모델을 이 기기에 준비하고 있어요." : event.state === "ready" ? "음성 입력을 준비했어요." : event.state === "error" ? voiceError(event.error || event).message : "";
      if (event.state === "error" && micActive) {
        micActive = false;
        micError = voiceError(event.error || event).message;
      }
      render();
    }
  });
  return voice;
}
async function prepareVoice() {
  if (preparingVoice || voice?.ready) return;
  preparingVoice = true;
  render();
  try {
    await getVoice().prepare();
  } catch (error) {
    if (error?.name !== "AbortError") ui["voice-status"].textContent = voiceError(error).message;
  } finally {
    preparingVoice = false;
    render();
  }
  if (voice?.ready && [document.body, ui["voice-prepare"]].includes(document.activeElement)) ui["microphone-check"].focus({ preventScroll: true });
}
var wait = (ms, token) => new Promise((resolve, reject) => setTimeout(() => token === epoch && !disposed ? resolve() : reject(new DOMException("취소", "AbortError")), ms));
async function checkMicrophone() {
  if (checkingMic) {
    epoch++;
    checkingMic = false;
    micStopping = voice?.stop();
    void micStopping?.catch(() => {
    });
    ui["mic-check-result"].textContent = "마이크 확인을 취소했어요.";
    render();
    return;
  }
  if (!voice?.ready || ACTIVE.includes(interview.snapshot().phase)) return;
  const token = epoch;
  checkingMic = true;
  microphoneReady = false;
  micPeak = 0;
  calibration = "";
  ui["mic-check-result"].textContent = "마이크 권한을 물으면 허용하고, “면접 연습을 시작하겠습니다”라고 말해 보세요.";
  render();
  try {
    await micStopping?.catch(() => {
    });
    await getVoice().start();
    if (token !== epoch) {
      void voice.stop().catch(() => {
      });
      return;
    }
    await wait(6500, token);
    const result = await (micStopping = getVoice().stop());
    if (token !== epoch) return;
    const heard = String(result.text || calibration || "").replace(/[([（【][^)\]）】]*[)\]）】]/gu, "").trim();
    microphoneReady = micPeak > 0.015 && !!heard;
    ui["mic-check-result"].textContent = microphoneReady ? `마이크 확인을 마쳤어요. 들린 말: “${heard}”` : micPeak <= 0.015 ? "목소리가 들리지 않았어요. 마이크가 음소거돼 있지 않은지 보고 다시 눌러 주세요." : "말을 또렷하게 듣지 못했어요. 조금 더 크게 다시 말해 주세요.";
  } catch (error) {
    if (token === epoch) ui["mic-check-result"].textContent = voiceError(error).message;
  } finally {
    if (token === epoch) {
      checkingMic = false;
      render();
    }
  }
}
async function startMicrophone(token) {
  if (mode !== "voice") return;
  partial = "";
  micError = "";
  try {
    await micStopping?.catch(() => {
    });
    if (token !== epoch) return;
    speechTurn.reset();
    speechTurn.start();
    await getVoice().start();
    if (token !== epoch) {
      void voice.stop().catch(() => {
      });
      return;
    }
    micActive = true;
  } catch (error) {
    if (token !== epoch) return;
    micActive = false;
    micError = voiceError(error).message;
    ui["voice-status"].textContent = micError;
  }
  render();
}
async function stopMicrophone() {
  micActive = false;
  speechTurn.reset();
  if (!voice || mode !== "voice") return "";
  const result = await (micStopping = voice.stop()).catch(() => null);
  return result?.text || partial || "";
}
var meta = () => ({ sessionId: session, program: ui.program.value, topik: Number(ui.topik.value), lang: "ko" });
async function start() {
  if (!getState().canStart) return;
  epoch++;
  stopSpeaking();
  aiNote = reviewNote = notice = micError = "";
  session = crypto.randomUUID();
  ui.answer.value = "";
  partial = "";
  reviewPage = 0;
  interview.start();
  render();
  void prepareFilm().then(() => {
    if (disposed) return;
    const s = interview.snapshot();
    if (s.paused || !ACTIVE.includes(s.phase)) ui.film.pause();
    render();
  }, () => {
    filmReady = false;
  });
  if (vr.active || vr.previewing) void vr.prepareRoom?.({ onlyIfStarted: true })?.catch?.(() => {
  });
  await present();
}
async function present() {
  const token = epoch;
  playFilm();
  render();
  const s = interview.snapshot();
  const spoken = speak(s.question);
  if (!vr.active) {
    ui.listen.focus({ preventScroll: true });
    return;
  }
  await Promise.all([spoken, wait(2500 + s.question.length * 120, token).catch(() => {
  })]);
  if (token === epoch && vr.active && !interview.snapshot().paused) await listen();
}
async function listen() {
  if (busy || !["question", "followup"].includes(interview.snapshot().phase)) return;
  stopSpeaking();
  interview.listen();
  ui.answer.value = "";
  partial = "";
  lastTick = performance.now();
  render();
  if (mode !== "voice") {
    ui.answer.focus({ preventScroll: true });
    return;
  }
  if (!vr.active) ui.submit.focus({ preventScroll: true });
  await startMicrophone(epoch);
}
async function submit() {
  if (!getState().canSubmit) return;
  const token = epoch;
  busy = true;
  render();
  const spoken = mode === "voice", text2 = spoken ? await stopMicrophone() : ui.answer.value;
  if (token !== epoch) return;
  busy = false;
  const s = interview.submit(text2, { spoken });
  if (s.phase === "confirming") {
    reviewPage = 0;
    ui.answer.value = s.draft;
    render();
    ui.confirm.focus({ preventScroll: true });
    return;
  }
  if (s.phase === "listening") {
    partial = "";
    render();
    if (!spoken) {
      ui.answer.focus({ preventScroll: true });
      return;
    }
    if (!vr.active) ui.submit.focus({ preventScroll: true });
    await startMicrophone(token);
    return;
  }
  await next(s);
}
async function confirm() {
  if (!getState().canConfirm) return;
  const s = interview.submit(vr.active ? interview.snapshot().draft : ui.answer.value);
  if (s.phase === "confirming") {
    render();
    ui.answer.focus({ preventScroll: true });
    return;
  }
  await next(s);
}
async function next(s) {
  ui.answer.value = "";
  partial = "";
  if (s.phase === "reviewing") return s.reviewState === "waiting" ? finish() : follow();
  await present();
}
async function follow() {
  const token = epoch, s = interview.snapshot();
  busy = true;
  render();
  let question = null;
  if (aiAllowed()) {
    try {
      const r = await account.turn(meta(), { track: s.track, answer: s.answers[s.step] });
      question = r.question;
      aiNote = noteOf(r.status) || aiNote;
    } catch {
      aiNote = "AI 질문을 받지 못해 정해 둔 질문으로 이어 갔어요.";
    }
  }
  if (token !== epoch) return;
  busy = false;
  interview.followup(question);
  await present();
}
async function finish() {
  const token = epoch;
  busy = true;
  render();
  let review = null;
  if (aiAllowed()) {
    try {
      const r = await account.review(meta(), interview.reviewAnswers());
      review = r.status === "done" ? { good: r.good, next: r.next } : null;
      reviewNote = r.status === "limit" ? "오늘 쓸 수 있는 AI 면접을 다 써서 평가는 받지 못했어요. 울란바토르 시각 08:00(서울 09:00)에 다시 채워져요." : "";
    } catch {
    }
  }
  if (token !== epoch) return;
  busy = false;
  ui.film.pause();
  interview.complete(review);
  render();
  if (!vr.active) {
    ui["result-title"].focus({ preventScroll: false });
  }
}
var noteOf = (status) => ({ limit: "오늘 쓸 수 있는 AI 면접을 다 썼어요. 정해 둔 질문으로 이어 갔어요. 울란바토르 시각 08:00(서울 09:00)에 다시 채워져요.", unavailable: "AI 질문이 잠시 쉬어요. 정해 둔 질문으로 이어 갔어요.", busy: "AI 질문이 늦어져 정해 둔 질문으로 이어 갔어요.", refused: "", done: "", done_before: "" })[status] ?? "";
function wipe() {
  interview.reset();
  ui.answer.value = "";
  ui.transcript.replaceChildren();
  for (const id of ["review-good", "review-next", "partial", "question-caption"]) ui[id].textContent = "";
  ui.adult.checked = ui.agree.checked = false;
}
function accountChanged() {
  ui.adult.checked = ui.agree.checked = false;
  if (interview.snapshot().phase === "idle") {
    render();
    return;
  }
  void stop().catch(report);
  notice = "로그인이 끝났거나 계정이 바뀌어 답을 지웠어요. AI 질문을 쓰려면 PATH 앱에서 다시 로그인해 주세요.";
  render();
}
function changeMode(next2) {
  if (next2 === mode) return;
  const listening = interview.snapshot().phase === "listening";
  if (listening && mode === "voice") {
    epoch++;
    void stopMicrophone();
  }
  mode = next2;
  partial = "";
  micError = "";
  interview.clearNote();
  lastTick = performance.now();
  render();
  if (listening && mode === "voice") void startMicrophone(epoch).catch(report);
}
async function retry() {
  if (interview.snapshot().phase !== "confirming" || busy) return;
  interview.retry();
  ui.answer.value = "";
  partial = "";
  lastTick = performance.now();
  render();
  if (mode !== "voice") return;
  if (!vr.active) ui.submit.focus({ preventScroll: true });
  await startMicrophone(epoch);
}
async function repeat() {
  if (busy) return;
  const token = ++epoch;
  await stopMicrophone();
  if (token !== epoch) return;
  interview.repeat();
  ui.answer.value = "";
  partial = "";
  render();
  await present();
}
async function pause() {
  const s = interview.snapshot();
  if (s.paused || !ACTIVE.includes(s.phase) || s.phase === "reviewing") return;
  epoch++;
  stopSpeaking();
  ui.film.pause();
  interview.pause();
  busy = false;
  render();
  await stopMicrophone();
  render();
}
async function resume() {
  if (!interview.snapshot().paused) return;
  epoch++;
  interview.resume();
  playFilm();
  lastTick = performance.now();
  render();
  const s = interview.snapshot();
  if (s.phase === "listening") await startMicrophone(epoch);
  else if (["question", "followup"].includes(s.phase)) await present();
}
async function stop() {
  epoch++;
  stopSpeaking();
  busy = checkingMic = false;
  aiNote = reviewNote = notice = micError = "";
  ui.film.pause();
  interview.reset();
  ui.answer.value = "";
  partial = "";
  render();
  await stopMicrophone();
  $("room-title").focus();
}
async function action(name) {
  const operations = {
    start,
    submit,
    confirm,
    retry,
    repeat,
    pause,
    resume,
    stop,
    reviewNext: () => {
      const pages = transcriptReviewPages(interview.snapshot().draft);
      reviewPage = (reviewPage + 1) % pages.length;
      render();
    }
  };
  try {
    return await operations[name]?.();
  } catch (error) {
    report(error);
  }
}
var vr = createStrictVR({ mount: ui["vr-stage"], getFrameState: () => filmReady && ACTIVE.includes(interview.snapshot().phase) ? [{ video: ui.film, opacity: 1 }] : [], getState, onAction: action, onExit: () => void pause(), onStatus(event) {
  ui["vr-status"].textContent = event.message;
} });
for (const [id, name] of Object.entries(INTERVIEW_PROGRAMS)) {
  const o = document.createElement("option");
  o.value = id;
  o.textContent = `${name} 학부`;
  ui.program.append(o);
}
try {
  const v = JSON.parse(sessionStorage.getItem("synk-path-interview") || "null");
  if (v && Object.hasOwn(INTERVIEW_PROGRAMS, v.program)) ui.program.value = v.program;
  if (v && Number.isInteger(v.topik) && v.topik >= 0 && v.topik <= 6) ui.topik.value = String(v.topik);
} catch {
}
$("consent-ask").before(...CONSENT_KO.map(([k, v]) => {
  const row = document.createElement("div"), dt = document.createElement("dt"), dd = document.createElement("dd");
  dt.textContent = k;
  dd.textContent = v;
  row.append(dt, dd);
  return row;
}));
ui["consent-mn"].replaceChildren(...CONSENT_MN.map((text2) => {
  const p = document.createElement("p");
  p.textContent = text2;
  return p;
}));
ui.answer.maxLength = MAX_ANSWER_CHARS;
for (const name of ["start", "submit", "confirm", "retry", "repeat", "stop"]) ui[name].addEventListener("click", () => void action(name));
ui.listen.addEventListener("click", () => void listen().catch(report));
ui.pause.addEventListener("click", () => void action(interview.snapshot().paused ? "resume" : "pause"));
ui["voice-prepare"].addEventListener("click", () => void prepareVoice());
ui["microphone-check"].addEventListener("click", () => void checkMicrophone());
ui["room-preview"].addEventListener("click", () => {
  void (async () => {
    if (ACTIVE.includes(interview.snapshot().phase)) await pause();
    await vr.preview();
  })().catch(report);
});
ui.vr.addEventListener("click", () => {
  void (async () => {
    const s = await vr.enter() ? interview.snapshot() : null;
    if (s && !s.paused && ["question", "followup"].includes(s.phase)) await present();
  })().catch(report);
});
for (const input of document.querySelectorAll('input[name="kind"]')) input.addEventListener("change", () => {
  if (input.checked) {
    kind = input.value;
    notice = "";
    if (kind === "ai") void account.start().then(render, render);
    render();
  }
});
for (const input of document.querySelectorAll('input[name="mode"]')) input.addEventListener("change", () => {
  if (input.checked) changeMode(input.value);
});
for (const el of [ui.adult, ui.agree, ui.topik, ui.program]) el.addEventListener("change", render);
ui.answer.addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    void action(interview.snapshot().phase === "confirming" ? "confirm" : "submit");
  }
});
ui.answer.addEventListener("input", () => {
  if (interview.snapshot().note) {
    interview.clearNote();
    render();
  }
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden && !vr.active && !vr.pending) void pause();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !event.repeat && vr.previewing) {
    event.preventDefault();
    vr.closePreview();
  }
});
try {
  globalThis.speechSynthesis?.addEventListener?.("voiceschanged", renderSpeechNote);
} catch {
}
var timer = setInterval(() => {
  const now = performance.now(), delta = now - lastTick;
  lastTick = now;
  const s = interview.snapshot();
  if (mode !== "voice" || !micActive || busy || s.paused || s.phase !== "listening") return;
  interview.tick(Math.min(delta, 500));
  render();
  if (interview.snapshot().remainingMs === 0 || speechTurn.poll().submit) void submit().catch(report);
}, 200);
window.addEventListener("pageshow", (event) => {
  if (event.persisted) location.reload();
});
window.addEventListener("pagehide", () => {
  wipe();
  disposed = true;
  epoch++;
  clearInterval(timer);
  stopSpeaking();
  account.dispose();
  void voice?.dispose();
  void vr.dispose();
}, { once: true });
wipe();
for (const input of document.querySelectorAll('input[name="kind"], input[name="mode"]')) input.checked = input.value === (input.name === "kind" ? kind : mode);
renderSpeechNote();
render();
void vr.check().then((supported) => {
  vrSupported = supported;
  if (supported && interview.snapshot().phase === "idle") {
    mode = "voice";
    document.querySelector('input[name="mode"][value="voice"]').checked = true;
  }
  render();
}).catch(() => {
});
