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

// src/index.ts
import { createProvider, defaultProviderAuthContext, InMemoryCredentialStore } from "@earendil-works/pi-ai";
import z from "@deepseek-ai/schemastery";
import { credentialRef } from "@deepseek-ai/dsh-credentials";
import { resolveRetryPolicy } from "@deepseek-ai/dsh-llm";
import { PiAiAdapter } from "@deepseek-ai/dsh-llm-pi-ai";
import { MAX_TIMER_DELAY_MS } from "@deepseek-ai/dsh-timeout";

// src/api.ts
import {
  calculateCost,
  createAssistantMessageEventStream
} from "@earendil-works/pi-ai";
import {
  convertMessages,
  convertTools,
  isThinkingPart,
  mapStopReasonString,
  retainThoughtSignature
} from "@earendil-works/pi-ai/api/google-shared";

// src/auth.ts
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

// src/api.ts
import { getCurrentSystemPrompt, getCurrentTools, normalizeContext } from "@earendil-works/pi-ai/utils/transcript";

// src/models.ts
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

// src/api.ts
function parseAuth(value) {
  if (value === void 0) throw new Error("Anti Gravity requires OAuth authentication");
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Anti Gravity OAuth request credential is invalid");
  }
  if (typeof parsed !== "object" || parsed === null || typeof parsed.token !== "string" || typeof parsed.projectId !== "string") {
    throw new Error("Anti Gravity OAuth request credential is incomplete");
  }
  return parsed;
}
function requestBody(model, context, options, projectId) {
  const googleModel = model;
  const transcript = normalizeContext(context);
  const systemPrompt = getCurrentSystemPrompt(transcript.messages);
  const tools = getCurrentTools(transcript.messages);
  const request = {
    contents: convertMessages(googleModel, transcript),
    ...options.sessionId === void 0 ? {} : { sessionId: options.sessionId }
  };
  if (systemPrompt.length > 0) {
    request.systemInstruction = { role: "user", parts: [{ text: systemPrompt }] };
  }
  const generationConfig = {};
  if (options.temperature !== void 0) generationConfig.temperature = options.temperature;
  if (options.maxTokens !== void 0) generationConfig.maxOutputTokens = options.maxTokens;
  if (Object.keys(generationConfig).length > 0) request.generationConfig = generationConfig;
  if (tools.length > 0) {
    request.tools = convertTools(tools, model.id.startsWith("claude-"));
  }
  return {
    project: projectId,
    model: model.id,
    request,
    requestType: "agent",
    userAgent: "antigravity",
    requestId: `agent-${crypto.randomUUID()}`
  };
}
async function openResponse(model, context, options, auth) {
  let payload = requestBody(model, context, options, auth.projectId);
  const replacement = await options.onPayload?.(payload, model);
  if (replacement !== void 0) payload = replacement;
  const body = JSON.stringify(payload);
  let lastStatus;
  for (const endpoint of ENDPOINTS) {
    const headers = {
      ...Object.fromEntries(Object.entries(options.headers ?? {}).filter((entry) => entry[1] !== null)),
      ...antiGravityHeaders(auth.token),
      accept: "text/event-stream",
      ...model.id.startsWith("claude-") ? { "anthropic-beta": "interleaved-thinking-2025-05-14" } : {}
    };
    const response = await fetch(`${endpoint}/v1internal:streamGenerateContent?alt=sse`, {
      method: "POST",
      headers,
      body,
      ...options.signal === void 0 ? {} : { signal: options.signal }
    });
    await options.onResponse?.({ status: response.status, headers: Object.fromEntries(response.headers) }, model);
    if (response.ok) return response;
    lastStatus = response.status;
    if (![403, 404, 429, 500, 502, 503, 504].includes(response.status)) break;
  }
  throw new Error(`Anti Gravity inference failed with HTTP ${lastStatus ?? "unknown"}`);
}
function streamAntiGravity(model, context, options = {}) {
  const stream = createAssistantMessageEventStream();
  const output = {
    role: "assistant",
    content: [],
    api: model.api,
    provider: model.provider,
    model: model.id,
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
    },
    stopReason: "stop",
    timestamp: Date.now()
  };
  void (async () => {
    try {
      const auth = parseAuth(options.apiKey);
      const response = await openResponse(model, context, options, auth);
      if (response.body === null) throw new Error("Anti Gravity returned no response stream");
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let started = false;
      let current;
      const ensureStarted = () => {
        if (started) return;
        started = true;
        stream.push({ type: "start", partial: output });
      };
      const closeCurrent = () => {
        if (current === void 0) return;
        const index = output.content.length - 1;
        if (current.type === "text") stream.push({ type: "text_end", contentIndex: index, content: current.text, partial: output });
        else stream.push({ type: "thinking_end", contentIndex: index, content: current.thinking, partial: output });
        current = void 0;
      };
      const consume = (chunk) => {
        const data = chunk.response;
        if (data === void 0) return;
        if (output.responseId === void 0 && data.responseId !== void 0) output.responseId = data.responseId;
        const candidate = data.candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
          if (part.text !== void 0) {
            const thinking = isThinkingPart(part);
            let active = current;
            if (current === void 0 || thinking && current.type !== "thinking" || !thinking && current.type !== "text") {
              closeCurrent();
              const created = thinking ? {
                type: "thinking",
                thinking: "",
                ...part.thoughtSignature === void 0 ? {} : { thinkingSignature: part.thoughtSignature }
              } : { type: "text", text: "" };
              current = created;
              active = created;
              output.content.push(created);
              ensureStarted();
              const index2 = output.content.length - 1;
              stream.push(thinking ? { type: "thinking_start", contentIndex: index2, partial: output } : { type: "text_start", contentIndex: index2, partial: output });
            }
            const index = output.content.length - 1;
            if (active === void 0) throw new Error("Anti Gravity stream block was not initialized");
            if (active.type === "thinking") {
              active.thinking += part.text;
              const signature = retainThoughtSignature(active.thinkingSignature, part.thoughtSignature);
              if (signature !== void 0) active.thinkingSignature = signature;
              stream.push({ type: "thinking_delta", contentIndex: index, delta: part.text, partial: output });
            } else {
              active.text += part.text;
              stream.push({ type: "text_delta", contentIndex: index, delta: part.text, partial: output });
            }
          }
          if (part.functionCall !== void 0) {
            closeCurrent();
            const toolCall = {
              type: "toolCall",
              id: part.functionCall.id ?? `${part.functionCall.name ?? "tool"}_${crypto.randomUUID()}`,
              name: part.functionCall.name ?? "",
              arguments: part.functionCall.args ?? {},
              ...part.thoughtSignature === void 0 ? {} : { thoughtSignature: part.thoughtSignature }
            };
            output.content.push(toolCall);
            ensureStarted();
            const index = output.content.length - 1;
            stream.push({ type: "toolcall_start", contentIndex: index, partial: output });
            stream.push({ type: "toolcall_delta", contentIndex: index, delta: JSON.stringify(toolCall.arguments), partial: output });
            stream.push({ type: "toolcall_end", contentIndex: index, toolCall, partial: output });
          }
        }
        if (candidate?.finishReason !== void 0) {
          output.rawStopReason = candidate.finishReason;
          output.stopReason = mapStopReasonString(candidate.finishReason);
          if (output.stopReason === "error") {
            output.errorMessage = `Anti Gravity finishReason: ${candidate.finishReason}${candidate.finishMessage ? `; ${candidate.finishMessage}` : ""}`;
          }
        }
        if (output.stopReason === "stop" && output.content.some((block) => block.type === "toolCall")) {
          output.stopReason = "toolUse";
        }
        const usage = data.usageMetadata;
        if (usage !== void 0) {
          const cacheRead = usage.cachedContentTokenCount ?? 0;
          output.usage = {
            input: Math.max(0, (usage.promptTokenCount ?? 0) - cacheRead),
            output: (usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0),
            reasoning: usage.thoughtsTokenCount ?? 0,
            cacheRead,
            cacheWrite: 0,
            totalTokens: usage.totalTokenCount ?? 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
          };
          calculateCost(model, output.usage);
        }
      };
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const text = line.slice(5).trim();
          if (text.length === 0) continue;
          consume(JSON.parse(text));
        }
      }
      closeCurrent();
      if (output.stopReason === "error") throw new Error(output.errorMessage ?? "Anti Gravity provider error");
      if (!output.content.some((block) => block.type === "toolCall" || block.type === "text" && block.text.trim().length > 0)) {
        throw new Error(`Anti Gravity returned no actionable response (finishReason: ${output.rawStopReason ?? "missing"})`);
      }
      const reason = output.stopReason === "toolUse" || output.stopReason === "length" ? output.stopReason : "stop";
      stream.push({ type: "done", reason, message: output });
      stream.end();
    } catch (error) {
      output.stopReason = options.signal?.aborted ? "aborted" : "error";
      output.errorMessage = error instanceof Error ? error.message : String(error);
      stream.push({ type: "error", reason: output.stopReason, error: output });
      stream.end();
    }
  })();
  return stream;
}
var streamSimple = (model, context, options) => streamAntiGravity(model, context, options);
var antiGravityApi = {
  stream: (model, context, options) => streamAntiGravity(model, context, options),
  streamSimple: (model, context, options) => streamSimple(model, context, options)
};

// src/client-config.ts
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

// src/credential.ts
import { assertUsableApiKey, LlmError } from "@deepseek-ai/dsh-llm";
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseAntiGravityCredential(raw, ref) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new LlmError(`llm-pi-ai-antigravity: OAuth credential ${ref} is not valid JSON`, "AUTH");
  }
  if (!isRecord(parsed) || parsed.type !== "oauth" || typeof parsed.access !== "string" || parsed.access.length === 0 || typeof parsed.refresh !== "string" || parsed.refresh.length === 0 || typeof parsed.expires !== "number" || !Number.isFinite(parsed.expires) || parsed.expires <= 0 || typeof parsed.projectId !== "string" || parsed.projectId.length === 0) {
    throw new LlmError(
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
      if (error instanceof LlmError) throw error;
      throw new LlmError("llm-pi-ai-antigravity: OAuth auth derivation failed", "AUTH", { cause: error });
    }
  }
  async read() {
    const hit = await this.credentials.resolve(this.ref);
    if (hit === void 0) {
      throw new LlmError(
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
      throw new LlmError("llm-pi-ai-antigravity: OAuth refresh failed", "AUTH", { cause: error });
    }
    const checked = parseAntiGravityCredential(JSON.stringify(refreshed), this.ref);
    await this.credentials.set(this.ref, JSON.stringify(checked));
    return checked;
  }
};

// src/remote-service.ts
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

// src/search.ts
var DEFAULT_SEARCH_MODEL = "gemini-3.8-flash-low";
var TIMEOUT_MS = 6e4;
var MAX_STREAM_BYTES = 2 * 1024 * 1024;
var MAX_CONTENT_CHARS = 128 * 1024;
var MAX_SOURCES = 64;
var SearchError = class extends Error {
};
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : void 0;
}
function abortable(operation, signal) {
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
      const credential = await abortable(this.credentials.resolveCredential(), controller.signal);
      const response = await abortable(fetch(`${ENDPOINTS[0]}/v1internal:streamGenerateContent?alt=sse`, {
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
        const envelope = record(parsed);
        if (envelope?.error !== void 0) throw new SearchError("Anti Gravity search returned a stream error");
        const payload = record(envelope?.response);
        if (payload?.error !== void 0) throw new SearchError("Anti Gravity search returned a stream error");
        const candidate = record(Array.isArray(payload?.candidates) ? payload.candidates[0] : void 0);
        if (!candidate) return;
        const parts = record(candidate.content)?.parts;
        if (Array.isArray(parts)) {
          for (const value of parts) {
            const part = record(value);
            if (typeof part?.text !== "string" || part.thought === true) continue;
            const remaining = MAX_CONTENT_CHARS - content.length;
            content += part.text.slice(0, remaining);
            if (part.text.length > remaining) truncated = true;
          }
        }
        if (candidate.finishReason !== void 0) finishReason = candidate.finishReason;
        const metadata = record(candidate.groundingMetadata);
        const queries = metadata?.webSearchQueries;
        if (Array.isArray(queries) && queries.some((query) => typeof query === "string" && query.trim().length > 0)) grounded = true;
        const chunks = metadata?.groundingChunks;
        if (!Array.isArray(chunks)) return;
        for (const value of chunks) {
          const web = record(record(value)?.web);
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
        const item = await abortable(reader.read(), controller.signal);
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

// src/index.ts
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
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
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
  if (!Number.isFinite(streamIdleTimeoutMs) || streamIdleTimeoutMs <= 0 || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `llm-pi-ai-antigravity: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`
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
  return {
    webSearch: config.webSearch ?? false,
    searchModel,
    oauthCredentialEnv: credentialRef(config.oauthCredentialEnv ?? DEFAULT_OAUTH_CREDENTIAL_REF),
    oauthClientConfigRef: config.oauthClientConfigRef ?? DEFAULT_OAUTH_CLIENT_CONFIG_REF,
    ...config.macosApplicationPath === void 0 ? {} : { macosApplicationPath: config.macosApplicationPath },
    displayName,
    streamIdleTimeoutMs,
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
    retryPolicy: resolveRetryPolicy(void 0, "llm-pi-ai-antigravity: retryPolicy"),
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
  if (config.webSearch) {
    ctx.inject(["web"], (webContext) => {
      webContext.web.registerSearchProvider(new AntiGravitySearchProvider(credentials, config.searchModel));
    });
  }
  let profiles = profileFor(config, maintainedModels, oauth);
  const adapter = new PiAiAdapter({
    profiles: () => profiles,
    resolveApiKey: () => credentials.resolveApiKey(),
    auth: {
      credentials: new InMemoryCredentialStore(),
      authContext: defaultProviderAuthContext()
    },
    resolveAttachments: () => ctx.get("attachments")
  });
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
  AntiGravityAuthRemote,
  AntiGravityCredentialManager,
  AntiGravitySearchProvider,
  Config,
  DEFAULT_OAUTH_CLIENT_CONFIG_REF,
  DEFAULT_SEARCH_MODEL,
  PROVIDER,
  apply,
  createAntiGravityOAuth,
  extractOAuthClientConfig,
  fetchAvailableModels,
  fetchAvailableModelsForCredential,
  importInstalledOAuthClientConfig,
  inject,
  maintainedModels,
  name,
  parseAntiGravityCredential,
  parseAvailableModels,
  parseOAuthClientConfig,
  resolveOAuthClientConfig
};
