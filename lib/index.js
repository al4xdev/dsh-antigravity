var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __knownSymbol = (name2, symbol) => (symbol = Symbol[name2]) ? symbol : /* @__PURE__ */ Symbol.for("Symbol." + name2);
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });
var __decoratorStart = (base) => [, , , __create(base?.[__knownSymbol("metadata")] ?? null)];
var __decoratorStrings = ["class", "method", "getter", "setter", "accessor", "field", "value", "get", "set"];
var __expectFn = (fn) => fn !== void 0 && typeof fn !== "function" ? __typeError("Function expected") : fn;
var __decoratorContext = (kind, name2, done, metadata, fns) => ({ kind: __decoratorStrings[kind], name: name2, metadata, addInitializer: (fn) => done._ ? __typeError("Already initialized") : fns.push(__expectFn(fn || null)) });
var __decoratorMetadata = (array, target) => __defNormalProp(target, __knownSymbol("metadata"), array[3]);
var __runInitializers = (array, flags, self, value) => {
  for (var i = 0, fns = array[flags >> 1], n = fns && fns.length; i < n; i++) flags & 1 ? fns[i].call(self) : value = fns[i].call(self, value);
  return value;
};
var __decorateElement = (array, flags, name2, decorators, target, extra) => {
  var fn, it, done, ctx, access, k = flags & 7, s = !!(flags & 8), p = !!(flags & 16);
  var j = k > 3 ? array.length + 1 : k ? s ? 1 : 2 : 0, key = __decoratorStrings[k + 5];
  var initializers = k > 3 && (array[j - 1] = []), extraInitializers = array[j] || (array[j] = []);
  var desc = k && (!p && !s && (target = target.prototype), k < 5 && (k > 3 || !p) && __getOwnPropDesc(k < 4 ? target : { get [name2]() {
    return __privateGet(this, extra);
  }, set [name2](x) {
    return __privateSet(this, extra, x);
  } }, name2));
  k ? p && k < 4 && __name(extra, (k > 2 ? "set " : k > 1 ? "get " : "") + name2) : __name(target, name2);
  for (var i = decorators.length - 1; i >= 0; i--) {
    ctx = __decoratorContext(k, name2, done = {}, array[3], extraInitializers);
    if (k) {
      ctx.static = s, ctx.private = p, access = ctx.access = { has: p ? (x) => __privateIn(target, x) : (x) => name2 in x };
      if (k ^ 3) access.get = p ? (x) => (k ^ 1 ? __privateGet : __privateMethod)(x, target, k ^ 4 ? extra : desc.get) : (x) => x[name2];
      if (k > 2) access.set = p ? (x, y) => __privateSet(x, target, y, k ^ 4 ? extra : desc.set) : (x, y) => x[name2] = y;
    }
    it = (0, decorators[i])(k ? k < 4 ? p ? extra : desc[key] : k > 4 ? void 0 : { get: desc.get, set: desc.set } : target, ctx), done._ = 1;
    if (k ^ 4 || it === void 0) __expectFn(it) && (k > 4 ? initializers.unshift(it) : k ? p ? extra = it : desc[key] = it : target = it);
    else if (typeof it !== "object" || it === null) __typeError("Object expected");
    else __expectFn(fn = it.get) && (desc.get = fn), __expectFn(fn = it.set) && (desc.set = fn), __expectFn(fn = it.init) && initializers.unshift(fn);
  }
  return k || __decoratorMetadata(array, target), desc && __defProp(target, name2, desc), p ? k ^ 4 ? extra : desc : target;
};
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateIn = (member, obj) => Object(obj) !== obj ? __typeError('Cannot use the "in" operator on this value') : member.has(obj);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);

// .dumps/antigravity-quota-retry-20261013/final/source/src/index.ts
import { createProvider, defaultProviderAuthContext, InMemoryCredentialStore } from "@earendil-works/pi-ai";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { resolveRetryPolicy, RetryPolicySchema } from "@deepseek-ai/dsh-llm";
import { MAX_TIMER_DELAY_MS as MAX_TIMER_DELAY_MS2 } from "@deepseek-ai/dsh-timeout";

// .dumps/antigravity-quota-retry-20261013/final/source/src/api.ts
import { calculateCost, createAssistantMessageEventStream } from "@earendil-works/pi-ai";
import { convertMessages, convertTools, isThinkingPart, mapStopReasonString, retainThoughtSignature } from "@earendil-works/pi-ai/api/google-shared";
import { getCurrentSystemPrompt, getCurrentTools, normalizeContext } from "@earendil-works/pi-ai/utils/transcript";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";

// .dumps/antigravity-quota-retry-20261013/final/source/src/auth.ts
import { createServer } from "node:http";
import { randomBytes, createHash } from "node:crypto";
var REDIRECT_URI = "http://localhost:51121/oauth-callback";
var TOKEN_URL = "https://oauth2.googleapis.com/token";
var SCOPES = [
  "https://www.googleapis.com/auth/cloud-platform",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
  "https://www.googleapis.com/auth/cclog",
  "https://www.googleapis.com/auth/experimentsandconfigs"
];
function base64Url(input) {
  return input.toString("base64url");
}
async function discoverProject(access, signal) {
  const endpoints = ["https://daily-cloudcode-pa.googleapis.com", "https://cloudcode-pa.googleapis.com"];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${endpoint}/v1internal:loadCodeAssist`, {
        method: "POST",
        headers: antiGravityHeaders(access),
        body: JSON.stringify({ metadata: { ideName: "antigravity", ideType: "ANTIGRAVITY", ideVersion: "2.5.2" } }),
        ...signal === void 0 ? {} : { signal }
      });
      if (!response.ok) continue;
      const body = await response.json();
      if (typeof body.cloudaicompanionProject === "string" && body.cloudaicompanionProject.length > 0) {
        return body.cloudaicompanionProject;
      }
      if (typeof body.cloudaicompanionProject === "object" && body.cloudaicompanionProject !== null && typeof body.cloudaicompanionProject.id === "string") {
        return body.cloudaicompanionProject.id;
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  throw new Error("Anti Gravity OAuth succeeded, but Cloud Code Assist returned no companion project");
}
function antiGravityHeaders(access) {
  return {
    authorization: `Bearer ${access}`,
    "content-type": "application/json",
    "user-agent": "antigravity/2.5.2 darwin/arm64"
  };
}
async function exchange(params, signal) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: params,
    ...signal === void 0 ? {} : { signal }
  });
  if (!response.ok) throw new Error(`Anti Gravity token exchange failed with HTTP ${response.status}`);
  return response.json();
}
async function login(interaction, clientConfig) {
  const verifier = base64Url(randomBytes(32));
  const challenge = base64Url(createHash("sha256").update(verifier).digest());
  const state = base64Url(randomBytes(24));
  const callback = new Promise((resolve, reject) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", REDIRECT_URI);
      if (url.pathname !== "/oauth-callback") {
        response.writeHead(404).end();
        return;
      }
      const code2 = url.searchParams.get("code");
      if (url.searchParams.get("state") !== state || code2 === null) {
        response.writeHead(400, { "content-type": "text/plain; charset=utf-8" }).end("Anti Gravity OAuth callback is invalid.");
        server.close();
        reject(new Error("Anti Gravity OAuth state or code is invalid"));
        return;
      }
      response.writeHead(200, { "content-type": "text/plain; charset=utf-8" }).end("Anti Gravity login completed. You may close this page.");
      server.close();
      resolve(code2);
    });
    server.on("error", reject);
    server.listen(51121, "127.0.0.1");
    interaction.signal?.addEventListener("abort", () => {
      server.close();
      reject(new Error("Anti Gravity OAuth was cancelled"));
    }, { once: true });
  });
  const auth = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  auth.search = new URLSearchParams({
    client_id: clientConfig.clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state,
    access_type: "offline",
    prompt: "consent"
  }).toString();
  interaction.notify({ type: "auth_url", url: auth.toString(), instructions: "\u5728\u6D4F\u89C8\u5668\u5B8C\u6210 Google Anti Gravity \u6388\u6743\u3002" });
  const code = await callback;
  const tokens = await exchange(new URLSearchParams({
    client_id: clientConfig.clientId,
    client_secret: clientConfig.clientSecret,
    code,
    grant_type: "authorization_code",
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier
  }), interaction.signal);
  if (tokens.refresh_token === void 0) throw new Error("Anti Gravity OAuth returned no refresh token");
  const projectId = await discoverProject(tokens.access_token, interaction.signal);
  return {
    type: "oauth",
    access: tokens.access_token,
    refresh: tokens.refresh_token,
    expires: Date.now() + tokens.expires_in * 1e3 - 3e5,
    projectId
  };
}
function createAntiGravityOAuth(resolveClientConfig) {
  return {
    name: "Google Anti Gravity",
    loginLabel: "\u4F7F\u7528 Google \u8D26\u53F7\u767B\u5F55 Anti Gravity",
    login: async (interaction) => login(interaction, await resolveClientConfig()),
    async refresh(credential, signal) {
      const current = credential;
      if (typeof current.projectId !== "string" || current.projectId.length === 0) {
        throw new Error("Anti Gravity credential has no Cloud Code Assist project id");
      }
      const clientConfig = await resolveClientConfig();
      const tokens = await exchange(new URLSearchParams({
        client_id: clientConfig.clientId,
        client_secret: clientConfig.clientSecret,
        refresh_token: credential.refresh,
        grant_type: "refresh_token"
      }), signal);
      return {
        ...credential,
        access: tokens.access_token,
        refresh: tokens.refresh_token ?? credential.refresh,
        expires: Date.now() + tokens.expires_in * 1e3 - 3e5
      };
    },
    toAuth: (credential) => {
      const current = credential;
      if (typeof current.projectId !== "string" || current.projectId.length === 0) {
        throw new Error("Anti Gravity credential has no Cloud Code Assist project id");
      }
      return Promise.resolve({ apiKey: JSON.stringify({ token: credential.access, projectId: current.projectId }) });
    }
  };
}

// .dumps/antigravity-quota-retry-20261013/final/source/src/models.ts
var PROVIDER = "google-antigravity";
var ENDPOINTS = [
  "https://daily-cloudcode-pa.googleapis.com",
  "https://cloudcode-pa.googleapis.com"
];
var NO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
function descriptor(id, name2, family, level) {
  const contextWindow = family === "gemini" ? 1048576 : family === "claude" ? 2e5 : 131072;
  return {
    id,
    name: name2,
    api: "google-antigravity",
    provider: PROVIDER,
    baseUrl: ENDPOINTS[0],
    reasoning: true,
    thinkingLevelMap: {
      off: null,
      minimal: null,
      low: level === "low" ? "low" : null,
      medium: level === "medium" ? "medium" : null,
      high: level === "high" ? "high" : null,
      xhigh: null,
      max: null
    },
    input: ["text", "image"],
    cost: NO_COST,
    contextWindow,
    maxTokens: 65536
  };
}
function familyOfId(id) {
  const lower = id.toLowerCase();
  if (lower.startsWith("gemini")) return "gemini";
  if (lower.startsWith("claude")) return "claude";
  if (lower.startsWith("gpt")) return "gpt";
  return void 0;
}
function levelOfId(id) {
  const match = /-(low|medium|high)$/.exec(id);
  if (match === null) return void 0;
  return match[1];
}
function titleOfId(id) {
  return id.split(/[-_/]/).filter((part) => part.length > 0).map((part) => part[0].toUpperCase() + part.slice(1)).join(" ");
}
function discoveredModel(id, entry) {
  const family = familyOfId(id);
  const level = levelOfId(id);
  const name2 = typeof entry.displayName === "string" && entry.displayName.length > 0 ? entry.displayName : titleOfId(id);
  const contextWindow = family === "gemini" ? 1048576 : family === "claude" ? 2e5 : 131072;
  return {
    id,
    name: name2,
    api: "google-antigravity",
    provider: PROVIDER,
    baseUrl: ENDPOINTS[0],
    reasoning: true,
    thinkingLevelMap: {
      off: null,
      minimal: null,
      low: level === void 0 || level === "low" ? "low" : null,
      medium: level === void 0 || level === "medium" ? "medium" : null,
      high: level === void 0 || level === "high" ? "high" : null,
      xhigh: null,
      max: null
    },
    input: ["text", "image"],
    cost: NO_COST,
    contextWindow,
    maxTokens: 65536
  };
}
var maintainedModels = [
  descriptor("gemini-3.8-flash-high", "Gemini 3.8 Flash (High)", "gemini", "high"),
  descriptor("gemini-3.8-flash-medium", "Gemini 3.8 Flash (Medium)", "gemini", "medium"),
  descriptor("gemini-3.8-flash-low", "Gemini 3.8 Flash (Low)", "gemini", "low"),
  descriptor("gemini-3.7-flash-high", "Gemini 3.7 Flash (High)", "gemini", "high"),
  descriptor("gemini-3.7-flash-medium", "Gemini 3.7 Flash (Medium)", "gemini", "medium"),
  descriptor("gemini-3.7-flash-low", "Gemini 3.7 Flash (Low)", "gemini", "low"),
  descriptor("gemini-3.6-flash-high", "Gemini 3.6 Flash (High)", "gemini", "high"),
  descriptor("gemini-3.6-flash-medium", "Gemini 3.6 Flash (Medium)", "gemini", "medium"),
  descriptor("gemini-3.6-flash-low", "Gemini 3.6 Flash (Low)", "gemini", "low"),
  descriptor("gemini-3.5-flash-high", "Gemini 3.5 Flash (High)", "gemini", "high"),
  descriptor("gemini-3.5-flash-medium", "Gemini 3.5 Flash (Medium)", "gemini", "medium"),
  descriptor("gemini-3.5-flash-low", "Gemini 3.5 Flash (Low)", "gemini", "low"),
  descriptor("gemini-3.1-pro-high", "Gemini 3.1 Pro (High)", "gemini", "high"),
  descriptor("gemini-3.1-pro-low", "Gemini 3.1 Pro (Low)", "gemini", "low"),
  descriptor("claude-sonnet-4-6", "Claude Sonnet 4.6 (Thinking)", "claude", "high"),
  descriptor("claude-opus-4-6-thinking", "Claude Opus 4.6 (Thinking)", "claude", "high"),
  descriptor("gpt-oss-120b-medium", "GPT-OSS 120B (Medium)", "gpt", "medium")
];
function parseAvailableModels(payload) {
  if (typeof payload !== "object" || payload === null || typeof payload.models !== "object") {
    throw new Error("Anti Gravity model response must contain a models object");
  }
  const live = payload.models;
  const reviewed = new Set(maintainedModels.map((model) => model.id));
  const maintained = maintainedModels.flatMap((model) => {
    const entry = live[model.id];
    if (entry === void 0) return [];
    const name2 = typeof entry.displayName === "string" && entry.displayName.length > 0 ? entry.displayName : model.name;
    return [{ ...model, name: name2 }];
  });
  const discovered = Object.entries(live).filter(([id, entry]) => !reviewed.has(id) && typeof entry.displayName === "string" && entry.displayName.length > 0).map(([id, entry]) => discoveredModel(id, entry));
  return [...maintained, ...discovered];
}
async function fetchAvailableModels(context) {
  const credential = context.credential;
  return fetchAvailableModelsForCredential(credential, context.signal);
}
async function fetchAvailableModelsForCredential(credential, signal) {
  if (credential?.type !== "oauth" || typeof credential.projectId !== "string" || credential.projectId.length === 0) {
    throw new Error("Anti Gravity model discovery requires an OAuth credential with a project id");
  }
  let lastStatus;
  for (const endpoint of ENDPOINTS) {
    const response = await fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
      method: "POST",
      headers: antiGravityHeaders(credential.access),
      body: JSON.stringify({ project: credential.projectId }),
      ...signal === void 0 ? {} : { signal }
    });
    if (response.ok) {
      const models = parseAvailableModels(await response.json());
      if (models.length === 0) throw new Error("Anti Gravity returned no maintained models");
      return models;
    }
    lastStatus = response.status;
    if (![403, 404, 429, 500, 502, 503, 504].includes(response.status)) break;
  }
  throw new Error(`Anti Gravity model discovery failed with HTTP ${lastStatus ?? "unknown"}`);
}

// .dumps/antigravity-quota-retry-20261013/final/source/src/failure.ts
var phases = /* @__PURE__ */ new Set(["auth", "payload-hook", "payload-guard", "response-hook", "fetch", "http-error", "sse-error", "sse-terminal", "sse", "timeout", "cancelled"]);
var terminalCategories = /* @__PURE__ */ new Set(["blocked", "other", "malformed-function-call", "unknown"]);
var terminalReasons = /* @__PURE__ */ new Set(["SAFETY", "RECITATION", "LANGUAGE", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"]);
var messages = {
  "rate-limit": "Anti Gravity request was rate limited.",
  quota: "Anti Gravity reported exhausted quota; the quota window is unknown.",
  auth: "Anti Gravity authorization is unavailable.",
  billing: "Anti Gravity billing or credits prevented this request.",
  policy: "Anti Gravity rejected this request by policy.",
  server: "Anti Gravity service is unavailable.",
  transport: "Anti Gravity response transport was incomplete.",
  timeout: "Anti Gravity request timed out.",
  aborted: "Anti Gravity request was cancelled.",
  empty: "Anti Gravity returned no actionable response.",
  protocol: "Anti Gravity returned an invalid response."
};
var AntiGravityFailure = class extends Error {
  failure;
  code;
  constructor(code, reason, options = {}) {
    const phase = options.phase !== void 0 && phases.has(options.phase) ? options.phase : void 0;
    const terminalCategory = options.terminalCategory !== void 0 && terminalCategories.has(options.terminalCategory) ? options.terminalCategory : void 0;
    const terminalReason = options.terminalReason !== void 0 && terminalReasons.has(options.terminalReason) ? options.terminalReason : void 0;
    const message = messages[reason] + (phase === void 0 ? "" : ` [stage=${phase}${terminalCategory === void 0 ? "" : `; terminal=${terminalCategory}`}]`) + (terminalReason === void 0 ? "" : ` [native-stop=${terminalReason}]`);
    super(message);
    this.name = "AntiGravityFailure";
    this.code = code;
    const status = Number.isInteger(options.status) && options.status >= 100 && options.status <= 599 ? options.status : void 0;
    const delay = positiveDelay(options.providerRetryAfterMs);
    this.failure = Object.freeze({
      code,
      message,
      reason,
      quotaWindow: "unknown",
      partial: options.partial === true,
      ...status === void 0 ? {} : { status },
      ...delay === void 0 ? {} : { providerRetryAfterMs: delay },
      ...phase === void 0 ? {} : { phase },
      ...terminalCategory === void 0 ? {} : { terminalCategory },
      ...terminalReason === void 0 ? {} : { terminalReason }
    });
  }
};
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function positiveDelay(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER ? Math.ceil(value) : void 0;
}
function httpDate(value) {
  if (!value || value.length > 128 || !/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return void 0;
  const result = Date.parse(value);
  return Number.isFinite(result) ? result : void 0;
}
function parseRetryAfterMs(value, dateHeader, nowMs = Date.now()) {
  if (!value || value.length > 128) return void 0;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed)) return positiveDelay(Number(trimmed) * 1e3);
  const deadline = httpDate(trimmed);
  if (deadline === void 0 || !Number.isFinite(nowMs)) return void 0;
  return positiveDelay(deadline - (httpDate(dateHeader) ?? nowMs));
}
function durationMs(value) {
  if (typeof value === "string" && value.length <= 64) {
    const match = /^(\d+)(?:\.(\d{1,9}))?s$/.exec(value);
    if (!match) return void 0;
    return positiveDelay((Number(match[1]) + Number(`0.${match[2] ?? "0"}`)) * 1e3);
  }
  const item = record(value);
  if (!item) return void 0;
  const seconds = typeof item.seconds === "string" && /^\d+$/.test(item.seconds) ? Number(item.seconds) : item.seconds ?? 0;
  const nanos = item.nanos ?? 0;
  if (typeof seconds !== "number" || !Number.isSafeInteger(seconds) || seconds < 0 || typeof nanos !== "number" || !Number.isInteger(nanos) || nanos < 0 || nanos >= 1e9) return void 0;
  return positiveDelay(seconds * 1e3 + nanos / 1e6);
}
function errorRecord(payload) {
  const envelope = record(payload);
  return record(envelope?.error) ?? record(record(envelope?.response)?.error) ?? envelope;
}
function details(payload) {
  const list = errorRecord(payload)?.details;
  return Array.isArray(list) ? list.slice(0, 64).flatMap((item) => record(item) ? [record(item)] : []) : [];
}
function parseRetryInfoDelayMs(payload) {
  const hints = details(payload).filter((item) => item["@type"] === "type.googleapis.com/google.rpc.RetryInfo").flatMap((item) => {
    const delay = durationMs(item.retryDelay);
    return delay === void 0 ? [] : [delay];
  });
  return hints.length ? Math.max(...hints) : void 0;
}
function parseAntiGravityFailure(status, payload, headers, partial = false) {
  const error = errorRecord(payload);
  if (status === void 0) {
    const rpc = { UNAUTHENTICATED: 401, PERMISSION_DENIED: 403, RESOURCE_EXHAUSTED: 429, UNAVAILABLE: 503, INTERNAL: 500, INVALID_ARGUMENT: 400, DEADLINE_EXCEEDED: 504 };
    const numeric = error?.code;
    status = typeof numeric === "number" && numeric >= 100 && numeric <= 599 ? numeric : typeof error?.status === "string" ? rpc[error.status] : void 0;
  }
  const info = details(payload);
  const reasons = info.filter((item) => item["@type"] === "type.googleapis.com/google.rpc.ErrorInfo").map((item) => item.reason).filter((reason) => typeof reason === "string");
  const retryAfter = parseRetryAfterMs(headers?.get("retry-after"), headers?.get("date"));
  const retryInfo = parseRetryInfoDelayMs(payload);
  const providerRetryAfterMs = Math.max(retryAfter ?? 0, retryInfo ?? 0) || void 0;
  const options = { status, providerRetryAfterMs, partial, phase: "http-error" };
  if (status === 401 || status === 403) return new AntiGravityFailure("AUTH", "auth", options);
  if (status === 402 || reasons.some((reason) => ["BILLING_DISABLED", "BILLING_NOT_ENABLED", "CREDITS_EXHAUSTED"].includes(reason))) return new AntiGravityFailure("INVALID_REQUEST", "billing", options);
  if (reasons.some((reason) => ["POLICY_VIOLATION", "TOS_NOT_ACCEPTED", "ACCESS_DENIED"].includes(reason))) return new AntiGravityFailure("INVALID_REQUEST", "policy", options);
  if (reasons.includes("RATE_LIMIT_EXCEEDED")) return new AntiGravityFailure("RATE_LIMIT", "rate-limit", options);
  if (reasons.some((reason) => ["QUOTA_EXCEEDED", "ACCOUNT_QUOTA_EXCEEDED", "ACCOUNT_LIMIT_EXCEEDED"].includes(reason))) {
    return new AntiGravityFailure("QUOTA_EXCEEDED", "quota", options);
  }
  if (status === 429 || reasons.includes("RATE_LIMIT_EXCEEDED") || error?.status === "RESOURCE_EXHAUSTED") return new AntiGravityFailure("RATE_LIMIT", "rate-limit", options);
  if (status !== void 0 && status >= 500) return new AntiGravityFailure("SERVER", "server", options);
  if (status !== void 0 && status >= 400) return new AntiGravityFailure("INVALID_REQUEST", "protocol", options);
  return new AntiGravityFailure("PI_AI_ERROR", "protocol", options);
}

// .dumps/antigravity-quota-retry-20261013/final/source/src/failure-bridge.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { LlmError as LlmError2 } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";

// .dumps/antigravity-quota-retry-20261013/final/source/src/quota-retry.ts
import { LlmError } from "@deepseek-ai/dsh-llm";
var MAX_QUOTA_WAIT_MS = 864e5;
var QUOTA_RESET_RETRY_CODE = "ANTIGRAVITY_QUOTA_RESET";
var QUOTA_RESET_LIMIT_CODE = "ANTIGRAVITY_QUOTA_RESET_LIMIT";
function resolveQuotaResetRetry(config) {
  if (config !== void 0 && Object.keys(config).some((key) => key !== "enabled" && key !== "maxWaitMs")) {
    throw new Error("llm-pi-ai-antigravity: unknown quotaResetRetry key");
  }
  if (config?.enabled !== void 0 && typeof config.enabled !== "boolean") throw new Error("Invalid quotaResetRetry.enabled");
  const maxWaitMs = config?.maxWaitMs ?? MAX_QUOTA_WAIT_MS;
  if (!Number.isSafeInteger(maxWaitMs) || maxWaitMs <= 0 || maxWaitMs > MAX_QUOTA_WAIT_MS) {
    throw new Error("quotaResetRetry.maxWaitMs must be a positive integer no greater than 86400000");
  }
  return Object.freeze({ enabled: config?.enabled ?? false, maxWaitMs });
}
function quotaResetFailure(failure, model, snapshot, failedAtMs, nowMs, maxWaitMs = MAX_QUOTA_WAIT_MS) {
  if (!["RATE_LIMIT", "QUOTA_EXCEEDED"].includes(failure.code) || snapshot.status !== "available" || snapshot.stale || !Number.isSafeInteger(failedAtMs) || !Number.isSafeInteger(nowMs) || nowMs < failedAtMs || !Number.isSafeInteger(snapshot.observedAtMs) || snapshot.observedAtMs < failedAtMs || snapshot.observedAtMs > nowMs || nowMs - snapshot.observedAtMs > 1e4 || !Number.isSafeInteger(maxWaitMs) || maxWaitMs <= 0 || maxWaitMs > MAX_QUOTA_WAIT_MS) return failure;
  const matching = snapshot.rows.filter((row) => row.id === model);
  if (matching.length !== 1) return failure;
  const resetAtMs = matching[0].resetAtMs;
  if (resetAtMs === void 0 || !Number.isSafeInteger(resetAtMs) || resetAtMs <= nowMs || resetAtMs > 864e13) return failure;
  const hint = failure.providerRetryAfterMs;
  if (hint !== void 0 && (!Number.isFinite(hint) || hint <= 0)) return failure;
  const retryAtMs = Math.max(resetAtMs, failedAtMs + (hint ?? 0));
  if (!Number.isSafeInteger(retryAtMs) || retryAtMs > 864e13) return failure;
  const delayMs = Math.ceil(retryAtMs - nowMs);
  const dates = `reset reportado ${new Date(resetAtMs).toISOString()}; tentativa n\xE3o antes de ${new Date(retryAtMs).toISOString()}`;
  const overLimit = delayMs > maxWaitMs;
  return new LlmError(
    `Anti Gravity ${failure.code}: ${dates}. ${overLimit ? `Espera acima do limite de ${maxWaitMs / 36e5}h; retry encerrado.` : "Aguardando o hor\xE1rio reportado; retorno da cota n\xE3o \xE9 garantido."}`,
    overLimit ? QUOTA_RESET_LIMIT_CODE : QUOTA_RESET_RETRY_CODE,
    {
      ...failure.status === void 0 ? {} : { status: failure.status },
      providerRetryAfterMs: delayMs
    }
  ).failure;
}

// .dumps/antigravity-quota-retry-20261013/final/source/src/failure-bridge.ts
var requestFailures = new AsyncLocalStorage();
function captureFailureReporter() {
  const context = requestFailures.getStore();
  return (failure) => {
    if (context === void 0 || !context.active || context.failure !== void 0) return;
    try {
      const error = new LlmError2(failure.message, failure.code, {
        ...failure.status === void 0 ? {} : { status: failure.status },
        ...failure.providerRetryAfterMs === void 0 ? {} : { providerRetryAfterMs: failure.providerRetryAfterMs }
      });
      context.failure = error.failure;
      context.failedAtMs = Date.now();
    } catch {
    }
  };
}
function cancellationOrTimeout(error) {
  return error instanceof LlmError2 && (error.code === "ABORTED" || error.code === "TIMEOUT");
}
function bridgedError(error, context, signal) {
  if (signal.aborted) return new LlmError2("Anti Gravity request cancelled", "ABORTED");
  if (cancellationOrTimeout(error) || context.failure === void 0) return error;
  return new LlmError2(context.failure.message, context.failure.code, {
    ...context.failure.status === void 0 ? {} : { status: context.failure.status },
    ...context.failure.providerRetryAfterMs === void 0 ? {} : { providerRetryAfterMs: context.failure.providerRetryAfterMs }
  });
}
function terminalChunk(chunk, context, signal) {
  if (chunk.type !== "finish") return chunk;
  const existing = chunk.reason;
  if (existing.kind === "aborted") return chunk;
  if (signal.aborted) {
    const { replayState: _successfulReplay2, ...terminal2 } = chunk;
    return { ...terminal2, reason: { kind: "aborted", failure: new LlmError2("Anti Gravity request cancelled", "ABORTED").failure } };
  }
  if (existing.kind === "error" && (existing.failure.code === "ABORTED" || existing.failure.code === "TIMEOUT")) return chunk;
  if (context.failure === void 0) return chunk;
  const { replayState: _successfulReplay, ...terminal } = chunk;
  return { ...terminal, reason: { kind: context.failure.code === "ABORTED" ? "aborted" : "error", failure: context.failure } };
}
function requestStream(options, dispatch, recovery) {
  return {
    [Symbol.asyncIterator]() {
      const context = { active: true };
      const consumer = new AbortController();
      const signal = options.signal === void 0 ? consumer.signal : AbortSignal.any([options.signal, consumer.signal]);
      const request = { ...options, signal };
      const generation = recovery?.usage.observationGeneration;
      let iterator;
      let exhausted = false;
      const run = (operation) => requestFailures.run(context, operation);
      const enrich = async () => {
        if (context.enriched || context.failure === void 0 || recovery === void 0 || !recovery.config.enabled || !["RATE_LIMIT", "QUOTA_EXCEEDED"].includes(context.failure.code)) return;
        context.enriched = true;
        if (signal.aborted || generation !== recovery.usage.observationGeneration) return;
        const failure = context.failure;
        try {
          const snapshot = await recovery.usage.snapshot({ refresh: true, signal });
          if (!context.active || signal.aborted || generation !== recovery.usage.observationGeneration) return;
          context.failure = quotaResetFailure(
            failure,
            recovery.model,
            snapshot,
            context.failedAtMs ?? Date.now(),
            Date.now(),
            recovery.config.maxWaitMs
          );
        } catch {
        }
      };
      const generator = (async function* () {
        try {
          if (signal.aborted) throw new LlmError2("Anti Gravity request cancelled", "ABORTED");
          try {
            iterator = run(() => dispatch(request)[Symbol.asyncIterator]());
          } catch (error) {
            if (!cancellationOrTimeout(error)) await enrich();
            throw bridgedError(error, context, signal);
          }
          while (true) {
            let result;
            try {
              result = await run(() => iterator.next());
            } catch (error) {
              if (!cancellationOrTimeout(error)) await enrich();
              throw bridgedError(error, context, signal);
            }
            if (result.done) {
              exhausted = true;
              await enrich();
              if (context.failure !== void 0) throw bridgedError(new Error("Anti Gravity stream failed"), context, signal);
              return;
            }
            if (result.value.type === "finish" && result.value.reason.kind !== "aborted" && !(result.value.reason.kind === "error" && ["ABORTED", "TIMEOUT"].includes(result.value.reason.failure.code))) await enrich();
            const chunk = terminalChunk(result.value, context, signal);
            if (chunk.type === "finish") {
              context.active = false;
              context.failure = void 0;
              yield chunk;
              return;
            }
            yield chunk;
          }
        } finally {
          context.active = false;
          context.failure = void 0;
          consumer.abort();
          if (!exhausted && iterator?.return !== void 0) await run(() => iterator.return());
        }
      })();
      return {
        next: () => generator.next(),
        return: async () => {
          context.active = false;
          context.failure = void 0;
          consumer.abort();
          return generator.return();
        },
        throw: async (error) => {
          context.active = false;
          context.failure = void 0;
          consumer.abort();
          return generator.throw(error);
        }
      };
    }
  };
}
var AntiGravityAdapter = class extends PiAiAdapter {
  quotaRecovery;
  configureQuotaRecovery(usage, config) {
    this.quotaRecovery = { usage, config };
  }
  stream(options) {
    return requestStream(
      options,
      (request) => super.stream(request),
      options.provider === "google-antigravity" && this.quotaRecovery !== void 0 ? { ...this.quotaRecovery, model: options.model } : void 0
    );
  }
  async prepareCall(provider, model, signal) {
    const prepared = await super.prepareCall(provider, model, signal);
    const recovery = provider === "google-antigravity" && this.quotaRecovery !== void 0 ? { ...this.quotaRecovery, model: prepared.model.id } : void 0;
    return { ...prepared, stream: (options) => requestStream(options, (request) => prepared.stream(request), recovery) };
  }
};

// .dumps/antigravity-quota-retry-20261013/final/source/src/api.ts
var MAX_SSE_EVENT_BYTES = 1024 * 1024;
var MAX_INFERENCE_STREAM_BYTES = 16 * 1024 * 1024;
var MAX_INFERENCE_BLOCKS = 4096;
var MAX_ERROR_BODY_BYTES = 64 * 1024;
var DEFAULT_INFERENCE_TIMEOUT_MS = 6e5;
function record2(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function protocol() {
  return new AntiGravityFailure("PI_AI_ERROR", "protocol", { phase: "sse" });
}
function aborted(caller, timedOut = false) {
  return new AntiGravityFailure(caller?.aborted || !timedOut ? "ABORTED" : "TIMEOUT", caller?.aborted || !timedOut ? "aborted" : "timeout", { phase: caller?.aborted || !timedOut ? "cancelled" : "timeout" });
}
function checkAbort(signal) {
  if (signal.aborted) throw aborted();
}
function abortable(operation, signal) {
  if (signal.aborted) {
    void operation.catch(() => {
    });
    return Promise.reject(aborted());
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(aborted());
    };
    signal.addEventListener("abort", abort, { once: true });
    operation.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}
async function hook(callback, signal, phase) {
  try {
    return await abortable(Promise.resolve().then(callback), signal);
  } catch (error) {
    if (signal.aborted) throw error;
    throw new AntiGravityFailure("INVALID_REQUEST", "policy", { phase });
  }
}
function parseAuth(value) {
  let parsed;
  try {
    parsed = value === void 0 ? void 0 : JSON.parse(value);
  } catch {
    throw new AntiGravityFailure("AUTH", "auth");
  }
  const auth = record2(parsed);
  if (typeof auth?.token !== "string" || !auth.token || typeof auth.projectId !== "string" || !auth.projectId) throw new AntiGravityFailure("AUTH", "auth");
  return { token: auth.token, projectId: auth.projectId };
}
function requestBody(model, context, options, projectId) {
  const transcript = normalizeContext(context);
  const system = getCurrentSystemPrompt(transcript.messages);
  const tools = getCurrentTools(transcript.messages);
  const request = { contents: convertMessages(model, transcript), ...options.sessionId === void 0 ? {} : { sessionId: options.sessionId } };
  if (system) request.systemInstruction = { role: "user", parts: [{ text: system }] };
  const generationConfig = {};
  if (options.temperature !== void 0) generationConfig.temperature = options.temperature;
  if (options.maxTokens !== void 0) generationConfig.maxOutputTokens = options.maxTokens;
  if (Object.keys(generationConfig).length) request.generationConfig = generationConfig;
  if (tools.length) request.tools = convertTools(tools, model.id.startsWith("claude-"));
  return { project: projectId, model: model.id, request, requestType: "agent", userAgent: "antigravity", requestId: `agent-${crypto.randomUUID()}`, enabledCreditTypes: [] };
}
function guardedPayload(payload, requestedModelId, projectId, options) {
  const body = record2(payload), request = record2(body?.request);
  if (!body || !request || body.model !== requestedModelId || body.project !== projectId || body.requestType !== "agent" || body.userAgent !== "antigravity") throw new AntiGravityFailure("INVALID_REQUEST", "policy");
  if (body.enabledCreditTypes !== void 0 && (!Array.isArray(body.enabledCreditTypes) || body.enabledCreditTypes.length)) throw new AntiGravityFailure("INVALID_REQUEST", "billing");
  for (const object of [body, request, record2(request.generationConfig), options]) {
    if (object) for (const key of Object.keys(object)) {
      if (/credit|overage/i.test(key) && !(object === body && key === "enabledCreditTypes")) throw new AntiGravityFailure("INVALID_REQUEST", "billing");
    }
  }
  return { ...body, enabledCreditTypes: [] };
}
async function errorPayload(response, signal) {
  if (response.body === null) return void 0;
  const reader = response.body.getReader(), decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "", bytes = 0;
  try {
    const length = response.headers.get("content-length");
    if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_ERROR_BODY_BYTES) return void 0;
    while (true) {
      const chunk = await abortable(reader.read(), signal);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_ERROR_BODY_BYTES) return void 0;
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    try {
      return JSON.parse(text);
    } catch {
      return void 0;
    }
  } catch (error) {
    if (signal.aborted) throw error;
    return void 0;
  } finally {
    void reader.cancel().catch(() => {
    });
    try {
      reader.releaseLock();
    } catch {
    }
  }
}
async function openResponse(model, context, options, auth, signal) {
  checkAbort(signal);
  const requestedModelId = model.id;
  let payload = requestBody(model, context, options, auth.projectId);
  const replacement = await hook(() => options.onPayload?.(payload, model), signal, "payload-hook");
  checkAbort(signal);
  if (replacement !== void 0) payload = replacement;
  const canonical = JSON.parse(JSON.stringify(guardedPayload(payload, requestedModelId, auth.projectId, options)));
  const body = JSON.stringify(guardedPayload(canonical, requestedModelId, auth.projectId, options));
  for (let index = 0; index < ENDPOINTS.length; index++) {
    checkAbort(signal);
    const headers = { ...Object.fromEntries(Object.entries(options.headers ?? {}).filter((entry) => entry[1] !== null)), ...antiGravityHeaders(auth.token), accept: "text/event-stream", ...requestedModelId.startsWith("claude-") ? { "anthropic-beta": "interleaved-thinking-2025-05-14" } : {} };
    let response;
    try {
      response = await abortable(fetch(`${ENDPOINTS[index]}/v1internal:streamGenerateContent?alt=sse`, { method: "POST", headers, body, signal, redirect: "error" }).then((value) => {
        if (signal.aborted) void value.body?.cancel().catch(() => {
        });
        return value;
      }), signal);
    } catch (error) {
      if (signal.aborted) throw error;
      throw new AntiGravityFailure("TRANSPORT", "transport");
    }
    try {
      checkAbort(signal);
      await hook(() => options.onResponse?.({ status: response.status, headers: Object.fromEntries(response.headers) }, model), signal, "response-hook");
      checkAbort(signal);
      if (response.ok) return response;
      const payload2 = await errorPayload(response, signal);
      checkAbort(signal);
      if (response.status === 404 && index + 1 < ENDPOINTS.length) continue;
      throw parseAntiGravityFailure(response.status, payload2, response.headers);
    } catch (error) {
      void response.body?.cancel().catch(() => {
      });
      throw error;
    }
  }
  throw new AntiGravityFailure("SERVER", "server");
}
function streamAntiGravity(model, context, options = {}) {
  const stream = createAssistantMessageEventStream(), reporter = captureFailureReporter();
  const owned = new AbortController(), deadline = new AbortController();
  const signal = AbortSignal.any([owned.signal, deadline.signal, ...options.signal ? [options.signal] : []]);
  let settled = false;
  const originalIterator = stream[Symbol.asyncIterator].bind(stream);
  stream[Symbol.asyncIterator] = () => {
    const iterator = originalIterator();
    return {
      next: () => iterator.next(),
      return: async (value) => {
        if (!settled) owned.abort();
        return iterator.return ? await iterator.return(value) : { value, done: true };
      },
      throw: async (error) => {
        if (!settled) owned.abort();
        if (iterator.throw) return iterator.throw(error);
        throw error;
      }
    };
  };
  const output = {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
    stopReason: "stop",
    timestamp: Date.now()
  };
  void (async () => {
    let timer, reader;
    let closePartial = () => {
    };
    try {
      checkAbort(signal);
      const timeoutMs = options.timeoutMs ?? DEFAULT_INFERENCE_TIMEOUT_MS;
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMER_DELAY_MS) throw new AntiGravityFailure("INVALID_REQUEST", "policy");
      timer = setTimeout(() => deadline.abort(), timeoutMs);
      const response = await openResponse(model, context, options, parseAuth(options.apiKey), signal);
      checkAbort(signal);
      if (response.body === null) throw new AntiGravityFailure("TRANSPORT", "transport");
      reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8", { fatal: true }), encoder = new TextEncoder();
      let bytes = 0, buffer = "", bufferBytes = 0, scanOffset = 0, eventData = [], eventBytes = 0, started = false, terminal, sawDone = false;
      const toolIds = /* @__PURE__ */ new Set();
      let candidateIndex;
      let run;
      const closeRun = () => {
        if (!run) return;
        const { block, index } = run;
        run = void 0;
        if (block.type === "thinking") stream.push({ type: "thinking_end", contentIndex: index, content: block.thinking, partial: output });
        else stream.push({ type: "text_end", contentIndex: index, content: block.text, partial: output });
      };
      closePartial = closeRun;
      const addBlock = (block) => {
        if (output.content.length >= MAX_INFERENCE_BLOCKS) throw protocol();
        output.content.push(block);
        if (!started) {
          started = true;
          stream.push({ type: "start", partial: output });
        }
        return output.content.length - 1;
      };
      const consumePart = (value, mayContinue) => {
        const item = record2(value);
        if (!item || item.thought !== void 0 && typeof item.thought !== "boolean" || item.thoughtSignature !== void 0 && (typeof item.thoughtSignature !== "string" || item.thoughtSignature.length > MAX_SSE_EVENT_BYTES)) throw protocol();
        const signature = typeof item.thoughtSignature === "string" ? item.thoughtSignature : void 0;
        if (item.text !== void 0 && typeof item.text !== "string" || item.text !== void 0 && item.functionCall !== void 0 || item.text === void 0 && signature === void 0 && item.functionCall === void 0) throw protocol();
        if (typeof item.text === "string" || signature !== void 0 && item.functionCall === void 0) {
          const text = typeof item.text === "string" ? item.text : "";
          const thinking = isThinkingPart(item);
          const kind = thinking ? "thinking" : "text";
          const existingSignature = run?.block.type === "thinking" ? run.block.thinkingSignature : run?.block.textSignature;
          const explicitType = item.text !== void 0 || typeof item.thought === "boolean";
          const continuation = mayContinue && explicitType && run?.block.type === kind && !(existingSignature && signature && existingSignature !== signature);
          if (!continuation) {
            closeRun();
            const block2 = thinking ? { type: "thinking", thinking: "", ...signature === void 0 ? {} : { thinkingSignature: signature } } : { type: "text", text: "", ...signature === void 0 ? {} : { textSignature: signature } };
            const index2 = addBlock(block2);
            run = { block: block2, index: index2 };
            if (block2.type === "thinking") stream.push({ type: "thinking_start", contentIndex: index2, partial: output });
            else stream.push({ type: "text_start", contentIndex: index2, partial: output });
          }
          const { block, index } = run;
          const retain = (existing) => existing === void 0 && signature === "" ? "" : retainThoughtSignature(existing, signature);
          if (block.type === "thinking") {
            block.thinking += text;
            block.thinkingSignature = retain(block.thinkingSignature);
            if (text) stream.push({ type: "thinking_delta", contentIndex: index, delta: text, partial: output });
          } else {
            block.text += text;
            block.textSignature = retain(block.textSignature);
            if (text) stream.push({ type: "text_delta", contentIndex: index, delta: text, partial: output });
          }
        }
        if (item.functionCall !== void 0) {
          closeRun();
          const call = record2(item.functionCall);
          if (!call || typeof call.name !== "string" || !call.name || call.name.length > 256 || call.id !== void 0 && (typeof call.id !== "string" || !call.id || call.id.length > 512) || call.args !== void 0 && !record2(call.args)) throw protocol();
          const id = typeof call.id === "string" ? call.id : `${call.name}_${crypto.randomUUID()}`;
          if (toolIds.has(id)) throw protocol();
          toolIds.add(id);
          const block = { type: "toolCall", id, name: call.name, arguments: call.args ?? {}, ...signature === void 0 ? {} : { thoughtSignature: signature } };
          const index = addBlock(block);
          stream.push({ type: "toolcall_start", contentIndex: index, partial: output });
          stream.push({ type: "toolcall_delta", contentIndex: index, delta: JSON.stringify(block.arguments), partial: output });
          stream.push({ type: "toolcall_end", contentIndex: index, toolCall: block, partial: output });
        }
      };
      const consume = (value) => {
        const envelope = record2(value);
        if (!envelope) throw protocol();
        if (envelope.error !== void 0 || record2(envelope.response)?.error !== void 0) {
          const error = parseAntiGravityFailure(void 0, envelope);
          throw new AntiGravityFailure(error.code, error.failure.reason, { ...error.failure, phase: "sse-error" });
        }
        const data = record2(envelope.response);
        if (!data) throw protocol();
        if (data.responseId !== void 0) {
          if (typeof data.responseId !== "string" || !data.responseId || data.responseId.length > 512) throw protocol();
          if (output.responseId === void 0) output.responseId = data.responseId;
          else if (output.responseId !== data.responseId) throw protocol();
        }
        if (data.candidates !== void 0) {
          if (!Array.isArray(data.candidates) || data.candidates.length > 1) throw protocol();
          const candidate = data.candidates[0] === void 0 ? void 0 : record2(data.candidates[0]);
          if (data.candidates[0] !== void 0 && !candidate) throw protocol();
          if (candidate) {
            const index = candidate.index === void 0 ? 0 : candidate.index;
            if (typeof index !== "number" || !Number.isSafeInteger(index) || index < 0 || candidateIndex !== void 0 && candidateIndex !== index) throw protocol();
            candidateIndex = index;
          }
          const content = candidate?.content === void 0 ? void 0 : record2(candidate.content);
          if (candidate?.content !== void 0 && !content) throw protocol();
          if (content?.role !== void 0 && content.role !== "model") throw protocol();
          const parts = content?.parts;
          if (parts !== void 0 && !Array.isArray(parts)) throw protocol();
          if (Array.isArray(parts)) {
            if (terminal !== void 0 && parts.length > 0 || parts.length > MAX_INFERENCE_BLOCKS) throw protocol();
            for (let index = 0; index < parts.length; index++) consumePart(parts[index], index === 0);
          }
          if (candidate?.finishReason !== void 0 && candidate.finishReason !== "" && candidate.finishReason !== "FINISH_REASON_UNSPECIFIED") {
            const reason2 = candidate.finishReason;
            if (reason2 !== "STOP" && reason2 !== "MAX_TOKENS") {
              const knownBlocked = ["SAFETY", "RECITATION", "LANGUAGE", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII"];
              const terminalReason = typeof reason2 === "string" && knownBlocked.includes(reason2) ? reason2 : void 0;
              const terminalCategory = reason2 === "OTHER" ? "other" : reason2 === "MALFORMED_FUNCTION_CALL" || reason2 === "UNEXPECTED_TOOL_CALL" ? "malformed-function-call" : terminalReason !== void 0 ? "blocked" : "unknown";
              throw new AntiGravityFailure("INVALID_REQUEST", "policy", { phase: "sse-terminal", terminalCategory, terminalReason });
            }
            if (terminal !== void 0 && terminal !== reason2) throw protocol();
            closeRun();
            terminal = reason2;
            output.rawStopReason = reason2;
            output.stopReason = mapStopReasonString(reason2);
          }
        }
        if (data.usageMetadata !== void 0) {
          const usage = record2(data.usageMetadata);
          if (!usage) throw protocol();
          const counter = (key) => {
            const value2 = usage[key] === void 0 ? 0 : usage[key];
            if (typeof value2 !== "number" || !Number.isSafeInteger(value2) || value2 < 0) throw protocol();
            return value2;
          };
          const prompt = counter("promptTokenCount"), cached = counter("cachedContentTokenCount"), candidates = counter("candidatesTokenCount"), thoughts = counter("thoughtsTokenCount"), total = counter("totalTokenCount");
          if (cached > prompt || !Number.isSafeInteger(candidates + thoughts)) throw protocol();
          output.usage = { input: prompt - cached, output: candidates + thoughts, reasoning: thoughts, cacheRead: cached, cacheWrite: 0, totalTokens: total, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } };
          calculateCost(model, output.usage);
        }
      };
      const dispatch = () => {
        if (eventData.length === 0) {
          eventBytes = 0;
          return;
        }
        const text = eventData.join("\n");
        eventData = [];
        eventBytes = 0;
        if (!text) return;
        if (text.trim() === "[DONE]") {
          sawDone = true;
          return;
        }
        if (sawDone) throw protocol();
        let value;
        try {
          value = JSON.parse(text);
        } catch {
          throw new AntiGravityFailure("TRANSPORT", "transport");
        }
        consume(value);
      };
      const line = (value) => {
        if (value === "") {
          dispatch();
          return;
        }
        if (value === "data" || value.startsWith("data:")) {
          const data = value === "data" ? "" : value.slice(5).replace(/^ /, "");
          eventBytes += encoder.encode(data).byteLength + 1;
          if (eventBytes > MAX_SSE_EVENT_BYTES) throw protocol();
          eventData.push(data);
        }
      };
      const drain = (final) => {
        let start = 0;
        for (let index = scanOffset; index < buffer.length; index++) {
          const char = buffer[index];
          if (char !== "\n" && char !== "\r") continue;
          if (char === "\r" && index === buffer.length - 1 && !final) break;
          line(buffer.slice(start, index));
          if (char === "\r" && buffer[index + 1] === "\n") index++;
          start = index + 1;
        }
        bufferBytes -= encoder.encode(buffer.slice(0, start)).byteLength;
        buffer = buffer.slice(start);
        scanOffset = buffer.length - (!final && buffer.endsWith("\r") ? 1 : 0);
        if (bufferBytes > MAX_SSE_EVENT_BYTES) throw protocol();
        if (final) {
          if (buffer) line(buffer);
          buffer = "";
          bufferBytes = 0;
          scanOffset = 0;
          dispatch();
        }
      };
      while (true) {
        checkAbort(signal);
        let chunk;
        try {
          chunk = await abortable(reader.read(), signal);
        } catch (error) {
          if (signal.aborted) throw error;
          throw new AntiGravityFailure("TRANSPORT", "transport");
        }
        checkAbort(signal);
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > MAX_INFERENCE_STREAM_BYTES) throw protocol();
        try {
          const decoded = decoder.decode(chunk.value, { stream: true });
          buffer += decoded;
          bufferBytes += encoder.encode(decoded).byteLength;
        } catch {
          throw protocol();
        }
        drain(false);
      }
      try {
        const decoded = decoder.decode();
        buffer += decoded;
        bufferBytes += encoder.encode(decoded).byteLength;
      } catch {
        throw protocol();
      }
      drain(true);
      checkAbort(signal);
      if (terminal === void 0) throw new AntiGravityFailure("TRANSPORT", "transport");
      if (!output.content.some((block) => block.type === "toolCall" || block.type === "text" && block.text.trim())) throw new AntiGravityFailure("EMPTY_RESPONSE", "empty");
      if (terminal === "STOP" && output.content.some((block) => block.type === "toolCall")) output.stopReason = "toolUse";
      const reason = output.stopReason === "toolUse" || output.stopReason === "length" ? output.stopReason : "stop";
      settled = true;
      stream.push({ type: "done", reason, message: output });
      stream.end();
    } catch (error) {
      closePartial();
      let failure = error instanceof AntiGravityFailure ? error : new AntiGravityFailure("PI_AI_ERROR", "protocol");
      if (signal.aborted) failure = aborted(options.signal, deadline.signal.aborted);
      failure = new AntiGravityFailure(failure.code, failure.failure.reason, { ...failure.failure, partial: output.content.length > 0 });
      output.stopReason = failure.code === "ABORTED" ? "aborted" : "error";
      output.errorMessage = failure.message;
      try {
        reporter(failure.failure);
      } catch {
      }
      settled = true;
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    } finally {
      if (timer !== void 0) clearTimeout(timer);
      owned.abort();
      if (reader) {
        void reader.cancel().catch(() => {
        });
        try {
          reader.releaseLock();
        } catch {
        }
      }
    }
  })();
  return stream;
}
var streamSimple = (model, context, options) => streamAntiGravity(model, context, options);
var antiGravityApi = {
  stream: (model, context, options) => streamAntiGravity(model, context, options),
  streamSimple: (model, context, options) => streamSimple(model, context, options)
};

// .dumps/antigravity-quota-retry-20261013/final/source/src/client-config.ts
import { execFile } from "node:child_process";
import { readFile, realpath, stat } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
var execFileAsync = promisify(execFile);
var EXPECTED_BUNDLE_ID = "com.google.antigravity-ide";
var EXPECTED_TEAM_ID = "EQHXZ8M8AV";
var OAUTH_MODULE_MARKER = "out-build/vs/platform/cloudCode/common/oauthClient.js";
var MAX_MAIN_BYTES = 32 * 1024 * 1024;
var CLIENT_ID_PATTERN = /^[0-9]{6,}-[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/;
var CLIENT_SECRET_PATTERN = /^GOCSPX-[A-Za-z0-9_-]+$/;
var CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
var OAUTH_ASSIGNMENT_PATTERN = new RegExp([
  '[A-Za-z_$][A-Za-z0-9_$]*="',
  '([0-9]{6,}-[A-Za-z0-9_-]+\\.apps\\.googleusercontent\\.com)",',
  '[A-Za-z_$][A-Za-z0-9_$]*="(GOCSPX-[A-Za-z0-9_-]+)"'
].join(""));
var DEFAULT_OAUTH_CLIENT_CONFIG_REF = "GOOGLE_ANTIGRAVITY_OAUTH_CLIENT_CONFIG";
function validateClientConfig(value) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Anti Gravity OAuth client configuration must be a JSON object");
  }
  const { clientId, clientSecret } = value;
  if (typeof clientId !== "string" || !CLIENT_ID_PATTERN.test(clientId)) {
    throw new Error("Anti Gravity OAuth client configuration has an invalid clientId");
  }
  if (typeof clientSecret !== "string" || !CLIENT_SECRET_PATTERN.test(clientSecret)) {
    throw new Error("Anti Gravity OAuth client configuration has an invalid clientSecret");
  }
  return { clientId, clientSecret };
}
function parseOAuthClientConfig(value) {
  try {
    return validateClientConfig(JSON.parse(value));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error("Anti Gravity OAuth client configuration is not valid JSON");
    }
    throw error;
  }
}
function extractOAuthClientConfig(source) {
  const marker = source.indexOf(OAUTH_MODULE_MARKER);
  if (marker < 0) throw new Error("Official Anti Gravity OAuth module was not found");
  const moduleSource = source.slice(marker, marker + 4096);
  if (!moduleSource.includes("https://www.googleapis.com/auth/cclog")) {
    throw new Error("Official Anti Gravity OAuth scopes were not found");
  }
  const assignment = OAUTH_ASSIGNMENT_PATTERN.exec(moduleSource);
  if (assignment === null) throw new Error("Official Anti Gravity OAuth client pair was not found");
  return validateClientConfig({ clientId: assignment[1], clientSecret: assignment[2] });
}
function defaultMacApplications() {
  return [
    "/Applications/Antigravity IDE.app",
    join(homedir(), "Applications", "Antigravity IDE.app")
  ];
}
async function verifyOfficialMacApplication(applicationPath) {
  const canonical = await realpath(applicationPath);
  await execFileAsync("/usr/bin/codesign", ["--verify", "--deep", "--strict", canonical], {
    maxBuffer: 1024 * 1024
  });
  const inspected = await execFileAsync("/usr/bin/codesign", ["-dv", "--verbose=4", canonical], {
    maxBuffer: 1024 * 1024
  });
  const facts = `${inspected.stdout}
${inspected.stderr}`;
  if (!facts.split("\n").includes(`Identifier=${EXPECTED_BUNDLE_ID}`) || !facts.split("\n").includes(`TeamIdentifier=${EXPECTED_TEAM_ID}`)) {
    throw new Error("Installed Anti Gravity application is not signed by the expected Google team");
  }
  return canonical;
}
async function verifyMacApplicationContents(applicationPath) {
  await execFileAsync("/usr/bin/codesign", ["--verify", "--deep", "--strict", applicationPath], {
    maxBuffer: 1024 * 1024
  });
}
async function importInstalledOAuthClientConfig(applicationPath) {
  if (process.platform !== "darwin") {
    throw new Error("Automatic Anti Gravity OAuth client import currently requires macOS");
  }
  const candidates = applicationPath === void 0 ? defaultMacApplications() : [applicationPath];
  const failures = [];
  for (const candidate of candidates) {
    try {
      const canonical = await verifyOfficialMacApplication(candidate);
      const mainPath = join(canonical, "Contents", "Resources", "app", "out", "main.js");
      const canonicalMain = await realpath(mainPath);
      if (!canonicalMain.startsWith(`${canonical}/Contents/`)) {
        throw new Error("Official Anti Gravity main bundle resolves outside the signed application");
      }
      const info = await stat(canonicalMain);
      if (!info.isFile() || info.size <= 0 || info.size > MAX_MAIN_BYTES) {
        throw new Error("Official Anti Gravity main bundle has an invalid size");
      }
      const source = await readFile(canonicalMain, "utf8");
      await verifyMacApplicationContents(canonical);
      return extractOAuthClientConfig(source);
    } catch (error) {
      failures.push(error);
    }
  }
  throw new AggregateError(failures, "No supported, Google-signed Anti Gravity IDE installation was found");
}
async function resolveOAuthClientConfig(credentials, refValue = DEFAULT_OAUTH_CLIENT_CONFIG_REF, applicationPath, importer = importInstalledOAuthClientConfig) {
  if (!CREDENTIAL_REF_PATTERN.test(refValue)) {
    throw new Error("Anti Gravity OAuth client credential reference must be a POSIX identifier");
  }
  const ref = refValue;
  const existing = await credentials.resolve(ref);
  if (existing !== void 0) return parseOAuthClientConfig(existing.value);
  const imported = await importer(applicationPath);
  await credentials.set(ref, JSON.stringify(imported));
  return imported;
}

// .dumps/antigravity-quota-retry-20261013/final/source/src/credential.ts
import { assertUsableApiKey, LlmError as LlmError3 } from "@deepseek-ai/dsh-llm";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseAntiGravityCredential(raw, ref) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LlmError3(`llm-pi-ai-antigravity: OAuth credential ${ref} is not valid JSON`, "AUTH");
  }
  if (!isRecord(parsed) || parsed.type !== "oauth" || typeof parsed.access !== "string" || parsed.access.length === 0 || typeof parsed.refresh !== "string" || parsed.refresh.length === 0 || typeof parsed.expires !== "number" || !Number.isFinite(parsed.expires) || parsed.expires <= 0 || typeof parsed.projectId !== "string" || parsed.projectId.length === 0) {
    throw new LlmError3(
      `llm-pi-ai-antigravity: OAuth credential ${ref} must contain type "oauth", non-empty access and refresh tokens, a positive finite expires timestamp, and a non-empty projectId`,
      "AUTH"
    );
  }
  return parsed;
}
var AntiGravityCredentialManager = class {
  /**
   * @param credentials - Harness credential service.
   * @param ref - opaque JSON credential reference.
   * @param oauth - provider-native Anti Gravity OAuth handler.
   */
  constructor(credentials, ref, oauth) {
    this.credentials = credentials;
    this.ref = ref;
    this.oauth = oauth;
  }
  credentials;
  ref;
  oauth;
  refreshing;
  /**
   * Resolve a valid canonical credential, refreshing it once across concurrent callers.
   * @returns current or newly persisted OAuth credential.
   */
  async resolveCredential() {
    let credential = await this.read();
    if (Date.now() >= credential.expires) {
      this.refreshing ??= this.refreshExpired().finally(() => {
        this.refreshing = void 0;
      });
      credential = await this.refreshing;
    }
    return credential;
  }
  /**
   * Derive pi-ai's request-level API-key override from the provider OAuth handler.
   * @returns JSON request credential consumed by the Anti Gravity protocol.
   */
  async resolveApiKey() {
    const credential = await this.resolveCredential();
    try {
      const auth = await this.oauth.toAuth(credential);
      if (auth.apiKey === void 0) throw new Error("Anti Gravity OAuth handler returned no request API key");
      return assertUsableApiKey(auth.apiKey, "llm-pi-ai-antigravity", this.ref);
    } catch (error) {
      if (error instanceof LlmError3) throw error;
      throw new LlmError3("llm-pi-ai-antigravity: OAuth auth derivation failed", "AUTH", { cause: error });
    }
  }
  async read() {
    const hit = await this.credentials.resolve(this.ref);
    if (hit === void 0) {
      throw new LlmError3(
        `llm-pi-ai-antigravity: no OAuth credential at ${this.ref}`,
        "MISSING_CREDENTIAL"
      );
    }
    return parseAntiGravityCredential(hit.value, this.ref);
  }
  async refreshExpired() {
    const current = await this.read();
    if (Date.now() < current.expires) return current;
    let refreshed;
    try {
      refreshed = await this.oauth.refresh(current, AbortSignal.timeout(6e4));
    } catch (error) {
      throw new LlmError3("llm-pi-ai-antigravity: OAuth refresh failed", "AUTH", { cause: error });
    }
    const checked = parseAntiGravityCredential(JSON.stringify(refreshed), this.ref);
    await this.credentials.set(this.ref, JSON.stringify(checked));
    return checked;
  }
};

// .dumps/antigravity-quota-retry-20261013/final/source/src/remote-service.ts
import { randomUUID } from "node:crypto";
import { Remote, TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
function loginId() {
  return randomUUID();
}
function failureMessage(error) {
  return error instanceof Error && error.message.length > 0 ? error.message : "Anti Gravity OAuth failed";
}
var _logout_dec, _poll_dec, _start_dec, _describe_dec, _a, _init;
var AntiGravityAuthRemote = class extends (_a = TypertRemoteService, _describe_dec = [Remote("describe")], _start_dec = [Remote("start")], _poll_dec = [Remote("poll")], _logout_dec = [Remote("logout")], _a) {
  /**
   * @param ctx - Host context carrying the credential service.
   * @param credentials - credential storage used for login and logout.
   * @param ref - OAuth JSON credential reference.
   * @param oauth - provider-native login handler.
   */
  constructor(ctx, credentials, ref, oauth) {
    super(ctx, "antiGravityAuth");
    this.credentials = credentials;
    this.ref = ref;
    this.oauth = oauth;
    __runInitializers(_init, 5, this);
    __publicField(this, "attempt");
    ctx.effect(() => () => {
      this.attempt?.controller.abort("Anti Gravity auth service disposed");
      this.attempt = void 0;
    }, "llm-pi-ai-antigravity: cancel login");
  }
  credentials;
  ref;
  oauth;
  describe() {
    return this.credentials.describe(this.ref).then((info) => ({
      configured: info.configured,
      ...info.source === void 0 ? {} : { source: info.source }
    }));
  }
  async start() {
    this.attempt?.controller.abort("A newer Anti Gravity login started");
    const attempt = {
      id: loginId(),
      controller: new AbortController(),
      status: { kind: "pending" }
    };
    this.attempt = attempt;
    const url = Promise.withResolvers();
    const notify = (event) => {
      if (event.type === "auth_url") url.resolve(event.url);
    };
    const prompt = (_prompt) => Promise.reject(new Error("Anti Gravity OAuth does not support interactive text prompts"));
    void this.oauth.login({ signal: attempt.controller.signal, notify, prompt }).then(async (credential) => {
      if (this.attempt !== attempt || attempt.controller.signal.aborted) return;
      await this.credentials.set(this.ref, JSON.stringify(credential));
      attempt.status = { kind: "succeeded" };
    }).catch((error) => {
      if (attempt.controller.signal.aborted) {
        attempt.status = { kind: "cancelled" };
        url.reject(new Error("Anti Gravity OAuth was cancelled"));
        return;
      }
      const message = failureMessage(error);
      attempt.status = { kind: "failed", message };
      url.reject(new Error(message));
    });
    return { loginId: attempt.id, authorizationUrl: await url.promise };
  }
  poll(id) {
    if (this.attempt?.id !== id) {
      return { kind: "failed", message: "Anti Gravity login attempt is no longer active" };
    }
    return this.attempt.status;
  }
  async logout() {
    this.attempt?.controller.abort("Anti Gravity logout");
    this.attempt = void 0;
    await this.credentials.unset(this.ref);
  }
};
_init = __decoratorStart(_a);
__decorateElement(_init, 1, "describe", _describe_dec, AntiGravityAuthRemote);
__decorateElement(_init, 1, "start", _start_dec, AntiGravityAuthRemote);
__decorateElement(_init, 1, "poll", _poll_dec, AntiGravityAuthRemote);
__decorateElement(_init, 1, "logout", _logout_dec, AntiGravityAuthRemote);
__decoratorMetadata(_init, AntiGravityAuthRemote);

// .dumps/antigravity-quota-retry-20261013/final/source/src/search.ts
var DEFAULT_SEARCH_MODEL = "gemini-3.8-flash-low";
var TIMEOUT_MS = 6e4;
var MAX_STREAM_BYTES = 2 * 1024 * 1024;
var MAX_CONTENT_CHARS = 128 * 1024;
var MAX_SOURCES = 64;
var SearchError = class extends Error {
};
function record3(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function abortable2(operation, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(new SearchError("Anti Gravity search cancelled or timed out"));
    if (signal.aborted) {
      abort();
      return;
    }
    signal.addEventListener("abort", abort, { once: true });
    operation.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}
var AntiGravitySearchProvider = class {
  constructor(credentials, model = DEFAULT_SEARCH_MODEL) {
    this.credentials = credentials;
    this.model = model;
    if (model.trim().length === 0) throw new Error("Anti Gravity searchModel must not be empty");
  }
  credentials;
  model;
  id = "google-antigravity";
  // Registration itself is opt-in. Credential validity is resolved asynchronously per request.
  available() {
    return true;
  }
  async search(request, signal) {
    if (request.query.trim().length === 0 || request.query.length > 8192) {
      throw new Error("Anti Gravity search query must contain 1 to 8192 characters");
    }
    if (request.maxResults !== void 0 && (!Number.isSafeInteger(request.maxResults) || request.maxResults < 0)) {
      throw new Error("Anti Gravity search maxResults must be a nonnegative integer");
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
    const timer = setTimeout(abort, TIMEOUT_MS);
    let reader;
    try {
      controller.signal.throwIfAborted();
      const credential = await abortable2(this.credentials.resolveCredential(), controller.signal);
      const response = await abortable2(fetch(`${ENDPOINTS[0]}/v1internal:streamGenerateContent?alt=sse`, {
        method: "POST",
        redirect: "error",
        headers: { ...antiGravityHeaders(credential.access), accept: "text/event-stream" },
        signal: controller.signal,
        body: JSON.stringify({
          project: credential.projectId,
          model: this.model,
          request: {
            contents: [{ role: "user", parts: [{ text: `Search the web for the following query and answer using search grounding:
${request.query}` }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { maxOutputTokens: 8192 }
          },
          requestType: "agent",
          userAgent: "antigravity",
          requestId: `agent-${crypto.randomUUID()}`
        })
      }), controller.signal);
      if (!response.ok) {
        void response.body?.cancel().catch(() => {
        });
        throw new SearchError(`Anti Gravity search failed with HTTP ${response.status}`);
      }
      if (response.body === null) throw new SearchError("Anti Gravity search returned no response stream");
      reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let eventData = [];
      let bytes = 0;
      let content = "";
      let grounded = false;
      let finishReason;
      let truncated = false;
      const sources = [];
      const seen = /* @__PURE__ */ new Set();
      const sourceLimit = Math.min(request.maxResults ?? MAX_SOURCES, MAX_SOURCES);
      const consume = () => {
        const data = eventData.join("\n");
        eventData = [];
        if (!data || data === "[DONE]") return;
        let parsed;
        try {
          parsed = JSON.parse(data);
        } catch {
          throw new SearchError("Anti Gravity search returned invalid SSE JSON");
        }
        const envelope = record3(parsed);
        if (envelope?.error !== void 0) throw new SearchError("Anti Gravity search returned a stream error");
        const payload = record3(envelope?.response);
        if (payload?.error !== void 0) throw new SearchError("Anti Gravity search returned a stream error");
        const candidate = record3(Array.isArray(payload?.candidates) ? payload.candidates[0] : void 0);
        if (!candidate) return;
        const parts = record3(candidate.content)?.parts;
        if (Array.isArray(parts)) {
          for (const value of parts) {
            const part = record3(value);
            if (typeof part?.text !== "string" || part.thought === true) continue;
            const remaining = MAX_CONTENT_CHARS - content.length;
            content += part.text.slice(0, remaining);
            if (part.text.length > remaining) truncated = true;
          }
        }
        if (candidate.finishReason !== void 0) finishReason = candidate.finishReason;
        const metadata = record3(candidate.groundingMetadata);
        const queries = metadata?.webSearchQueries;
        if (Array.isArray(queries) && queries.some((query) => typeof query === "string" && query.trim().length > 0)) grounded = true;
        const chunks = metadata?.groundingChunks;
        if (!Array.isArray(chunks)) return;
        for (const value of chunks) {
          const web = record3(record3(value)?.web);
          if (typeof web?.uri !== "string" || web.uri.length > 8192) continue;
          let url;
          try {
            url = new URL(web.uri);
          } catch {
            continue;
          }
          if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) continue;
          grounded = true;
          if (seen.has(url.href)) continue;
          seen.add(url.href);
          if (sources.length >= sourceLimit) {
            truncated = true;
            continue;
          }
          sources.push({ url: url.href, ...typeof web.title === "string" ? { title: web.title.slice(0, 2048) } : {} });
        }
      };
      const line = (value) => {
        if (value === "") consume();
        else if (value === "data" || value.startsWith("data:")) {
          const data = value === "data" ? "" : value.slice(5);
          eventData.push(data.startsWith(" ") ? data.slice(1) : data);
        }
      };
      const drain = (final) => {
        let start = 0;
        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i];
          if (char !== "\n" && char !== "\r") continue;
          if (char === "\r" && i === buffer.length - 1 && !final) break;
          line(buffer.slice(start, i));
          if (char === "\r" && buffer[i + 1] === "\n") i++;
          start = i + 1;
        }
        buffer = buffer.slice(start);
        if (final) {
          if (buffer.length > 0) line(buffer);
          buffer = "";
          consume();
        }
      };
      for (; ; ) {
        const item = await abortable2(reader.read(), controller.signal);
        if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > MAX_STREAM_BYTES) throw new SearchError("Anti Gravity search stream exceeded size limit");
        buffer += decoder.decode(item.value, { stream: true });
        drain(false);
      }
      buffer += decoder.decode();
      drain(true);
      controller.signal.throwIfAborted();
      if (finishReason !== "STOP") throw new SearchError("Anti Gravity search did not finish with STOP");
      if (!grounded) throw new SearchError("Anti Gravity search returned no search grounding");
      return { content, sources, truncated };
    } catch (error) {
      if (controller.signal.aborted) throw new Error("Anti Gravity search cancelled or timed out");
      if (error instanceof SearchError) throw error;
      throw new Error("Anti Gravity search failed");
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      controller.abort();
      if (reader) {
        void reader.cancel().catch(() => {
        });
        try {
          reader.releaseLock();
        } catch {
        }
      }
    }
  }
};

// .dumps/antigravity-quota-retry-20261013/final/source/src/usage.ts
import { Service } from "@deepseek-ai/cordis";

// .dumps/antigravity-quota-retry-20261013/final/source/src/quota.ts
var MAX_QUOTA_ROWS = 256;
var QuotaPayloadError = class extends Error {
  code = "QUOTA_SCHEMA";
  constructor() {
    super("Anti Gravity quota metadata has an unsupported shape");
    this.name = "QuotaPayloadError";
  }
};
function record4(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function timestamp(value) {
  return Number.isFinite(value) && Math.abs(value) <= 864e13;
}
function label(value, max = 120) {
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, "").trim().slice(0, max);
}
function parseQuotaReset(value) {
  if (typeof value !== "string") return void 0;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value);
  if (!match) return void 0;
  const [, y, mo, day, h, mi, sec, zone] = match;
  const year = Number(y), month = Number(mo), date = Number(day);
  if (month < 1 || month > 12 || date < 1 || Number(h) > 23 || Number(mi) > 59 || Number(sec) > 59) return void 0;
  const calendar = /* @__PURE__ */ new Date(0);
  calendar.setUTCFullYear(year, month - 1, date);
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== date) return void 0;
  if (zone !== "Z" && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return void 0;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : void 0;
}
function parseModelQuotaSnapshot(payload, observedAtMs) {
  if (!timestamp(observedAtMs) || !record4(payload) || !record4(payload.models)) throw new QuotaPayloadError();
  const rows = [];
  let truncated = false;
  for (const [id, entry] of Object.entries(payload.models)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(id) || /^(chat_|tab_)|(?:-tiered)$/.test(id) || !record4(entry)) continue;
    const quota = record4(entry.quotaInfo) ? entry.quotaInfo : void 0;
    const displayName = typeof entry.displayName === "string" ? label(entry.displayName) : "";
    if (!displayName && !quota) continue;
    if (rows.length >= MAX_QUOTA_ROWS) {
      truncated = true;
      break;
    }
    const fraction = quota?.remainingFraction;
    const remainingFraction = typeof fraction === "number" && Number.isFinite(fraction) && fraction >= 0 && fraction <= 1 ? fraction : void 0;
    const resetAtMs = parseQuotaReset(quota?.resetTime);
    rows.push(Object.freeze({
      id,
      name: displayName || id,
      window: "unknown",
      ...remainingFraction === void 0 ? {} : { remainingFraction },
      ...resetAtMs === void 0 ? {} : { resetAtMs }
    }));
  }
  return Object.freeze({
    source: "fetchAvailableModels",
    observedAtMs,
    stale: false,
    status: "available",
    rows: Object.freeze(rows),
    truncated
  });
}
function percent(fraction) {
  if (fraction === void 0 || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) return "desconhecida";
  if (fraction === 0) return "0%";
  if (fraction === 1) return "100%";
  if (fraction < 0.01) return "<1%";
  if (fraction > 0.999) return "<100%";
  return `${(fraction * 100).toFixed(1).replace(/\.0$/, "")}%`;
}
function formatUsageSnapshot(snapshot, now = Date.now()) {
  if (snapshot.status === "unavailable") {
    const messages2 = {
      "not-connected": "Antigravity n\xE3o est\xE1 conectado.",
      auth: "N\xE3o foi poss\xEDvel consultar a cota: autoriza\xE7\xE3o indispon\xEDvel.",
      "rate-limit": "Consulta de cota limitada (429). Isso n\xE3o identifica a janela nem confirma cota zero.",
      unavailable: "Consulta de cota indispon\xEDvel.",
      schema: "O servi\xE7o n\xE3o forneceu metadados de cota reconhec\xEDveis.",
      timeout: "Consulta de cota excedeu o limite de tempo."
    };
    return messages2[snapshot.error ?? "unavailable"] ?? messages2.unavailable;
  }
  const safeNow = timestamp(now) ? now : Date.now();
  const observed = timestamp(snapshot.observedAtMs) ? snapshot.observedAtMs : safeNow;
  const age = Math.max(0, Math.floor((safeNow - observed) / 1e3));
  const lines = [
    "Antigravity \u2014 cota restante reportada (n\xE3o \xE9 saldo de tokens)",
    `Leitura: ${new Date(observed).toISOString()}; idade ${age}s${snapshot.stale ? " \u2014 DESATUALIZADA" : ""}.`,
    "Janela: desconhecida; este endpoint n\xE3o distingue limite de 5h e semanal."
  ];
  if (!snapshot.rows.length) lines.push("Nenhum modelo com metadados de cota reconhec\xEDveis.");
  for (const row of snapshot.rows.slice(0, MAX_QUOTA_ROWS)) {
    const reset = row.resetAtMs === void 0 || !timestamp(row.resetAtMs) ? "desconhecido" : `${new Date(row.resetAtMs).toISOString()}${row.resetAtMs <= safeNow ? " (passado; atualize a leitura)" : ""}`;
    lines.push(`${label(row.name)} [${label(row.id)}]: ${percent(row.remainingFraction)}; reset ${reset}.`);
  }
  if (snapshot.truncated) lines.push("Lista truncada; n\xE3o representa todos os modelos.");
  lines.push("Modelos podem compartilhar cota; percentuais n\xE3o s\xE3o somados. Este comando n\xE3o inicia retry nem controla cr\xE9ditos extras. Quando habilitada, a recupera\xE7\xE3o usa o reset reportado ap\xF3s falha do modelo, at\xE9 24h; n\xE3o garante retorno da cota.");
  return lines.join("\n");
}

// .dumps/antigravity-quota-retry-20261013/final/source/src/usage.ts
var USAGE_TTL_MS = 6e4;
var USAGE_DEADLINE_MS = 1e4;
var MAX_USAGE_BODY_BYTES = 1024 * 1024;
function unavailable(error) {
  return Object.freeze({
    source: "fetchAvailableModels",
    observedAtMs: Date.now(),
    stale: false,
    status: "unavailable",
    rows: Object.freeze([]),
    truncated: false,
    error
  });
}
function cancelled() {
  return new Error("Anti Gravity usage request cancelled");
}
function boundedAwait(operation, signal) {
  if (signal.aborted) {
    void operation.catch(() => {
    });
    return Promise.reject(cancelled());
  }
  return new Promise((resolve, reject) => {
    const abort = () => {
      signal.removeEventListener("abort", abort);
      reject(cancelled());
    };
    signal.addEventListener("abort", abort, { once: true });
    operation.then((value) => {
      signal.removeEventListener("abort", abort);
      resolve(value);
    }, (error) => {
      signal.removeEventListener("abort", abort);
      reject(error);
    });
  });
}
async function readBody(response, signal) {
  const length = response.headers.get("content-length");
  if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_USAGE_BODY_BYTES) {
    void response.body?.cancel().catch(() => {
    });
    throw new QuotaPayloadError();
  }
  if (response.body === null) throw new QuotaPayloadError();
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const chunk = await boundedAwait(reader.read(), signal);
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > MAX_USAGE_BODY_BYTES) throw new QuotaPayloadError();
      try {
        text += decoder.decode(chunk.value, { stream: true });
      } catch {
        throw new QuotaPayloadError();
      }
    }
    try {
      text += decoder.decode();
    } catch {
      throw new QuotaPayloadError();
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new QuotaPayloadError();
    }
  } finally {
    void reader.cancel().catch(() => {
    });
  }
}
var AntiGravityUsageService = class extends Service {
  constructor(ctx, credentials) {
    super(ctx, "antiGravityUsage");
    this.credentials = credentials;
    ctx.effect(() => async () => {
      this.disposed = true;
      this.invalidate();
      await Promise.allSettled([...this.pending]);
    }, "llm-pi-ai-antigravity: usage lifecycle");
  }
  credentials;
  cache;
  flight;
  generation = 0;
  disposed = false;
  pending = /* @__PURE__ */ new Set();
  /** Request-local recovery uses this epoch to reject observations after account changes. */
  get observationGeneration() {
    return this.generation;
  }
  /** Invalidate both cached and pending observations when the account reference changes. */
  invalidate() {
    this.generation++;
    this.cache = void 0;
    this.flight?.controller.abort();
    this.flight = void 0;
  }
  /** One caller may cancel without cancelling other callers sharing the fetch. */
  async snapshot(request = {}) {
    if (request.signal?.aborted) throw cancelled();
    if (this.disposed) return unavailable("unavailable");
    const now = Date.now();
    if (request.refresh) this.cache = void 0;
    if (!request.refresh && this.cache !== void 0 && now >= this.cache.observedAtMs && now - this.cache.observedAtMs < USAGE_TTL_MS) return this.cache;
    if (this.flight === void 0) {
      const controller = new AbortController();
      const generation = this.generation;
      const flight2 = {
        controller,
        generation,
        waiters: 0,
        // Publish the flight before credential resolution can synchronously emit an update.
        promise: Promise.resolve().then(() => this.fetchSnapshot(controller.signal)).then((result) => {
          if (generation !== this.generation || this.disposed || controller.signal.aborted) return unavailable("unavailable");
          if (result.status === "available") this.cache = result;
          return result;
        }).finally(() => {
          this.pending.delete(flight2.promise);
          if (this.flight === flight2) this.flight = void 0;
        })
      };
      this.flight = flight2;
      this.pending.add(flight2.promise);
    }
    const flight = this.flight;
    flight.waiters++;
    try {
      return request.signal === void 0 ? await flight.promise : await boundedAwait(flight.promise, request.signal);
    } finally {
      flight.waiters--;
      if (flight.waiters === 0 && this.flight === flight) {
        this.flight = void 0;
        flight.controller.abort();
      }
    }
  }
  async fetchSnapshot(callerSignal) {
    const deadline = new AbortController();
    const timer = setTimeout(() => deadline.abort(), USAGE_DEADLINE_MS);
    const signal = AbortSignal.any([callerSignal, deadline.signal]);
    try {
      if (signal.aborted) return unavailable("unavailable");
      let credential;
      try {
        credential = await boundedAwait(this.credentials.resolveCredential(), signal);
      } catch (error) {
        if (signal.aborted) return unavailable(deadline.signal.aborted ? "timeout" : "unavailable");
        const code = typeof error === "object" && error !== null && "code" in error ? error.code : void 0;
        return unavailable(code === "AUTH" ? "auth" : code === "MISSING_CREDENTIAL" ? "not-connected" : "unavailable");
      }
      for (const endpoint of ENDPOINTS) {
        if (signal.aborted) return unavailable(deadline.signal.aborted ? "timeout" : "unavailable");
        const response = await boundedAwait(fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
          method: "POST",
          headers: antiGravityHeaders(credential.access),
          body: JSON.stringify({ project: credential.projectId }),
          signal,
          redirect: "error"
        }), signal);
        if (response.ok) return parseModelQuotaSnapshot(await readBody(response, signal), Date.now());
        void response.body?.cancel().catch(() => {
        });
        if (response.status === 401 || response.status === 403) return unavailable("auth");
        if (response.status === 429) return unavailable("rate-limit");
        if (![404, 500, 502, 503, 504].includes(response.status)) return unavailable("unavailable");
      }
      return unavailable("unavailable");
    } catch (error) {
      if (deadline.signal.aborted) return unavailable("timeout");
      return unavailable(error instanceof QuotaPayloadError ? "schema" : "unavailable");
    } finally {
      clearTimeout(timer);
    }
  }
};
function registerUsageCommand(ctx, usage) {
  ctx.inject(["commands"], (commandContext) => {
    commandContext.commands.register({
      name: "antigravity-usage",
      description: "Show reported Anti Gravity model quota (no inference)",
      input: { hint: "[--refresh]" },
      recordInput: false,
      handler: async ({ rawInput, signal }) => {
        const input = rawInput.trim();
        if (input !== "" && input !== "--refresh") {
          return { kind: "error", text: "Use /antigravity-usage [--refresh]." };
        }
        const result = await usage.snapshot({ refresh: input === "--refresh", signal });
        return { kind: result.status === "available" ? "success" : "error", text: formatUsageSnapshot(result) };
      }
    });
  });
}

// .dumps/antigravity-quota-retry-20261013/final/source/src/index.ts
var name = "llm-pi-ai-antigravity";
var inject = ["llm", "credentials"];
var DEFAULT_OAUTH_CREDENTIAL_REF = "GOOGLE_ANTIGRAVITY_OAUTH_CREDENTIAL";
var DEFAULT_DISPLAY_NAME = "Google Anti Gravity";
var DEFAULT_STREAM_IDLE_TIMEOUT_MS = 3e5;
var DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024;
var DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048;
var DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024;
var Config = z.object({
  webSearch: z.boolean().default(false),
  searchModel: z.string().default(DEFAULT_SEARCH_MODEL),
  oauthCredentialEnv: z.string().role("credential-ref").default(DEFAULT_OAUTH_CREDENTIAL_REF),
  oauthClientConfigRef: z.string().role("credential-ref").default(DEFAULT_OAUTH_CLIENT_CONFIG_REF),
  macosApplicationPath: z.string(),
  displayName: z.string().default(DEFAULT_DISPLAY_NAME),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS2).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  retryPolicy: RetryPolicySchema,
  quotaResetRetry: z.object({
    enabled: z.boolean().default(false),
    maxWaitMs: z.number().step(1).min(1).max(MAX_QUOTA_WAIT_MS).default(MAX_QUOTA_WAIT_MS)
  }),
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES)
});
function resolveConfig(config) {
  const searchModel = config.searchModel ?? DEFAULT_SEARCH_MODEL;
  if (searchModel.trim().length === 0) throw new Error("llm-pi-ai-antigravity: searchModel must not be empty");
  const displayName = config.displayName ?? DEFAULT_DISPLAY_NAME;
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
  const maxRequestImageBytes = config.maxRequestImageBytes ?? DEFAULT_MAX_REQUEST_IMAGE_BYTES;
  const requestImagePixelBudget = config.requestImagePixelBudget ?? DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET;
  const requestImageMaxBytes = config.requestImageMaxBytes ?? DEFAULT_REQUEST_IMAGE_MAX_BYTES;
  if (displayName.length === 0) throw new Error("llm-pi-ai-antigravity: displayName must not be empty");
  if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS2) {
    throw new Error(
      `llm-pi-ai-antigravity: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS2}`
    );
  }
  if (!Number.isInteger(maxRequestImageBytes) || maxRequestImageBytes <= 0) {
    throw new Error("llm-pi-ai-antigravity: maxRequestImageBytes must be a positive integer");
  }
  if (!Number.isSafeInteger(requestImagePixelBudget) || requestImagePixelBudget <= 0) {
    throw new Error("llm-pi-ai-antigravity: requestImagePixelBudget must be a positive safe integer");
  }
  if (!Number.isSafeInteger(requestImageMaxBytes) || requestImageMaxBytes <= 0) {
    throw new Error("llm-pi-ai-antigravity: requestImageMaxBytes must be a positive safe integer");
  }
  const quotaResetRetry = resolveQuotaResetRetry(config.quotaResetRetry);
  const basePolicy = resolveRetryPolicy(config.retryPolicy, "llm-pi-ai-antigravity: retryPolicy");
  if (quotaResetRetry.enabled && basePolicy.mode !== "normal") {
    throw new Error("quotaResetRetry requires normal retry mode");
  }
  const retryPolicy = quotaResetRetry.enabled && basePolicy.mode === "normal" ? Object.freeze({ ...basePolicy, retryableCodes: Object.freeze([.../* @__PURE__ */ new Set([...basePolicy.retryableCodes, QUOTA_RESET_RETRY_CODE])]) }) : basePolicy;
  return {
    webSearch: config.webSearch ?? false,
    searchModel,
    oauthCredentialEnv: credentialRef(config.oauthCredentialEnv ?? DEFAULT_OAUTH_CREDENTIAL_REF),
    oauthClientConfigRef: config.oauthClientConfigRef ?? DEFAULT_OAUTH_CLIENT_CONFIG_REF,
    ...config.macosApplicationPath === void 0 ? {} : { macosApplicationPath: config.macosApplicationPath },
    displayName,
    streamIdleTimeoutMs,
    retryPolicy,
    quotaResetRetry,
    maxRequestImageBytes,
    requestImagePixelBudget,
    requestImageMaxBytes
  };
}
var requestOverrideAuth = {
  name: "Google Anti Gravity OAuth request override",
  resolve: ({ credential }) => Promise.resolve(
    credential?.key === void 0 || credential.key.length === 0 ? void 0 : { auth: { apiKey: credential.key }, source: "OAuth" }
  )
};
function providerFor(config, models, oauth) {
  const resolvedModels = models.map((model) => ({
    ...model,
    provider: PROVIDER,
    baseUrl: ENDPOINTS[0]
  }));
  return createProvider({
    id: PROVIDER,
    name: config.displayName,
    baseUrl: ENDPOINTS[0],
    auth: { apiKey: requestOverrideAuth, oauth },
    models: resolvedModels,
    api: antiGravityApi
  });
}
function profileFor(config, models, oauth) {
  return /* @__PURE__ */ new Map([[PROVIDER, {
    provider: PROVIDER,
    displayName: config.displayName,
    streamIdleTimeoutMs: config.streamIdleTimeoutMs,
    maxRequestImageBytes: config.maxRequestImageBytes,
    requestImagePixelBudget: config.requestImagePixelBudget,
    requestImageMaxBytes: config.requestImageMaxBytes,
    retryPolicy: config.retryPolicy,
    configuredMaxTokens: /* @__PURE__ */ new Map(),
    modelErrors: /* @__PURE__ */ new Map(),
    piProvider: providerFor(config, models, oauth)
  }]]);
}
function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig);
  const oauth = createAntiGravityOAuth(() => resolveOAuthClientConfig(
    ctx.credentials,
    config.oauthClientConfigRef,
    config.macosApplicationPath
  ));
  const credentials = new AntiGravityCredentialManager(ctx.credentials, config.oauthCredentialEnv, oauth);
  new AntiGravityAuthRemote(ctx, ctx.credentials, config.oauthCredentialEnv, oauth);
  const usage = new AntiGravityUsageService(ctx, credentials);
  registerUsageCommand(ctx, usage);
  ctx.on("credentials/reference-updated", (ref) => {
    if (ref === config.oauthCredentialEnv) usage.invalidate();
  });
  if (config.webSearch) {
    ctx.inject(["web"], (webContext) => {
      webContext.web.registerSearchProvider(new AntiGravitySearchProvider(credentials, config.searchModel));
    });
  }
  let profiles = profileFor(config, maintainedModels, oauth);
  const adapter = new AntiGravityAdapter({
    profiles: () => profiles,
    resolveApiKey: () => credentials.resolveApiKey(),
    auth: {
      credentials: new InMemoryCredentialStore(),
      authContext: defaultProviderAuthContext()
    },
    resolveAttachments: () => ctx.get("attachments")
  });
  adapter.configureQuotaRecovery(usage, config.quotaResetRetry);
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter);
  const controller = new AbortController();
  let refreshing;
  const refresh = () => {
    refreshing ??= (async () => {
      try {
        const credential = await credentials.resolveCredential();
        const live = await fetchAvailableModelsForCredential(credential, controller.signal);
        profiles = profileFor(config, live, oauth);
        registration.replace([PROVIDER]);
      } catch (error) {
        if (!controller.signal.aborted) {
          ctx.logger.info("llm-pi-ai-antigravity: live model refresh unavailable; keeping the maintained catalog");
          ctx.logger.debug(error);
        }
      } finally {
        refreshing = void 0;
      }
    })();
  };
  ctx.effect(() => {
    const timers = [setTimeout(refresh, 0), setTimeout(refresh, 250)];
    return () => {
      for (const timer of timers) clearTimeout(timer);
      controller.abort();
    };
  }, "llm-pi-ai-antigravity: live refresh");
  ctx.on("credentials/reference-updated", (ref) => {
    if (ref === config.oauthCredentialEnv) refresh();
  });
}
export {
  AntiGravityAdapter,
  AntiGravityAuthRemote,
  AntiGravityCredentialManager,
  AntiGravityFailure,
  AntiGravitySearchProvider,
  AntiGravityUsageService,
  Config,
  DEFAULT_OAUTH_CLIENT_CONFIG_REF,
  DEFAULT_SEARCH_MODEL,
  MAX_QUOTA_WAIT_MS,
  PROVIDER,
  QUOTA_RESET_LIMIT_CODE,
  QUOTA_RESET_RETRY_CODE,
  QuotaPayloadError,
  apply,
  captureFailureReporter,
  createAntiGravityOAuth,
  extractOAuthClientConfig,
  fetchAvailableModels,
  fetchAvailableModelsForCredential,
  formatUsageSnapshot,
  importInstalledOAuthClientConfig,
  inject,
  maintainedModels,
  name,
  parseAntiGravityCredential,
  parseAvailableModels,
  parseModelQuotaSnapshot,
  parseOAuthClientConfig,
  quotaResetFailure,
  resolveOAuthClientConfig,
  resolveQuotaResetRetry
};
