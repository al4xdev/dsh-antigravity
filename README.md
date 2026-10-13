# DSH Plugin: LLM Provider - Anti Gravity

[中文](README.zh.md) | English

Connects the **Google Anti Gravity** Coding Plan to [DeepSeek Harness](https://github.com/deepseek-ai/DeepSeek-Harness) for chat and coding with models exposed by your account. The current reviewed comparison pair is Claude Opus 5.5 High (`claude-opus-5-5-high`) and Gemini 3.8 Flash Low (`gemini-3.8-flash-low`); catalog availability and quota remain account-dependent.

## Target Audience and Use Cases

Designed for developers with Google Anti Gravity IDE installed or active Cloud Code Assist entitlements who want to access these high-performance models within the unified DeepSeek Harness workspace for coding, reasoning, and tool execution.

## Key Features

- **Lightweight Native Direct Connection**: Directly connects over HTTPS to Cloud Code Assist without spawning background `agy` subprocesses or IDE instances.
- **One-Click macOS Authorization**: Automatically validates and imports signed macOS Anti Gravity client configurations, opening the standard browser OAuth flow without manual Client ID/Secret copying.
- **Dynamic Model Discovery**: Queries the live `fetchAvailableModels` endpoint to surface reviewed Gemini, Claude, and GPT-OSS model variants.
- **Independent Provider Route**: The plugin registers its own `google-antigravity` adapter, owns its catalog, and resolves OAuth. It reuses the exported `PiAiAdapter` only for Harness message and stream conversion.
- **Built-in Login Page**: A package-owned Typert Remote provides login start, status polling, and logout; the browser half registers a dedicated Anti Gravity settings page.
- **Clean Native Experience**: Preserves thinking signatures, streaming output, and tool invocation contracts without injected provider system prompts, synthetic messages, or custom headers.

## Installation and Quick Start

Install a reviewed revision into a DeepSeek Harness profile. The repository provides a `dsh.bundle` patch and prebuilt runtime artifacts so no local build steps are required:

```sh
dsh plugin --profile <profile> add github:OpenSaozi/dsh-antigravity#<commit-sha>
```

The installed bundle contributes the following Cordis configuration:

```yaml
- id: llm-pi-ai-antigravity
  name: '@deepseek-ai/dsh-llm-pi-ai-antigravity'
  config:
    oauthCredentialEnv: GOOGLE_ANTIGRAVITY_OAUTH_CREDENTIAL
    oauthClientConfigRef: GOOGLE_ANTIGRAVITY_OAUTH_CLIENT_CONFIG
    displayName: Google Anti Gravity
```

Both `oauthCredentialEnv` and `oauthClientConfigRef` name credential references. The bundled local provider stores documents in `$DSH_HOME/.credentials.yaml`; deployments may use another credential backend.

## Optional Google Search

Native Google Search is disabled by default. To register the `google-antigravity`
search provider with the optional `ctx.web` service, add these plugin options:

```yaml
webSearch: true
searchModel: gemini-3.8-flash-low
```

When multiple search providers are installed, explicitly select
`searchProvider: google-antigravity` in the web service configuration, preserving
`fetchProvider: http` explicitly when replacing a loader config block. This plugin
never changes that selection or the fetch provider. Without `ctx.web`, inference
continues normally and search registration waits for the service.

Search reuses the plugin's OAuth credential manager and sends native
`tools: [{ googleSearch: {} }]` to Cloud Code Assist. The exact configured model is
used without fallback. A successful result requires `finishReason: STOP` and
search grounding (`webSearchQueries` or valid web grounding chunks). Sources come
only from HTTP(S) `groundingChunks.web.uri`, including Google's grounding redirect
URLs; URLs mentioned in answer text are never promoted to citations. Query-only
grounding may return no sources. Credentials are checked at execution, not by the
provider's cheap local availability check.

Requests have a 60-second deadline, 2 MiB stream limit, 128 Ki-character answer
limit and at most 64 sources (also bounded by `maxResults`). Answer/source clipping
sets `truncated`; transport overflow, missing grounding or incomplete generation
fails instead of returning an unverified partial answer. Errors never include
response bodies or OAuth tokens. Internal endpoint support depends on account
entitlements and the selected model.

For this standalone checkout, run `npm run test:search` (mocked tests, no network)
and `npm run bundle:host` (host-only build). The default `pnpm run bundle` still
expects upstream monorepo build tooling. No generated `lib` files are changed by
editing these sources.

## Reported quota usage (local fork)

Use `/antigravity-usage` or `/antigravity-usage --refresh` in a Harness UI with
its command registry mounted. This on-demand metadata command makes no inference
request and does not start a model turn. The host also exposes
`ctx.antiGravityUsage.snapshot({ refresh?, signal? })`; no web client or Remote
changes are required. Unknown arguments are rejected. Existing registry grants
still apply, and results are recorded as command output in the session.

The command reads `fetchAvailableModels` quota metadata, cached for 60 seconds,
with a 10-second total deadline and a 1 MiB response limit. Concurrent callers
share a request; cancelling one caller does not cancel other callers. Account
reference changes/logout invalidate cached and pending observations. If OAuth
refresh updates the reference during a query, that query fails closed: run the
command again explicitly. OAuth renewal may persist refreshed credentials.
No quota polling or new startup requests are added.

Reported fractions are approximate quota percentages, **not precise remaining
tokens, requests or money**. Zero and unknown differ; missing or invalid quota
stays unknown. The API does not identify the quota window here: neither a reset
nearby nor 0% proves five-hour versus weekly quota. Rows are not summed because
models may share quota. Errors contain safe categories only, never response
bodies, account identifiers or credential values. Usage errors do not disable
inference. The command itself does not start retries or change models, accounts,
credits or overage settings. Optional quota-reset recovery below reuses this metadata
after a failed inference request. TUI cancellation signals may not be wired to a
key; the command's own deadline remains bounded.

Local source changes require a reviewed generated host bundle; a published
upstream commit pin does not automatically include this local feature. Validate
an isolated candidate before replacing the active `lib/index.js`.

## Retry at the reported quota reset (local fork)

`quotaResetRetry: { enabled: true, maxWaitMs: 86400000 }` opts in (default off).
The dsh-tui profile must also disable native `llm-retry` and insert one local
`antigravity-quota-retry` entry pointing to `../antigravity-quota-retry/index.mjs`,
the reviewed minimal fork of the official executor. Patch `name` is a guard,
not a module-replacement operation. Enabling only the provider is insufficient for waits above20min.
The original normal9 policy,5s initial backoff and20min transient ceiling remain.
Quota and transient waits consume the same nine-retry budget and use one engine.

After typed RATE_LIMIT/QUOTA_EXCEEDED, the request-local bridge refreshes usage for
its exact captured native model id. A fresh future reset authorizes a wait until
that timestamp or a later server Retry-After/RetryInfo minimum. It reports ISO UTC
dates in the normal retry/failure detail. Up to24h is allowed; above24h it reports
the target and stops. Missing, stale, past or mismatched metadata cannot invent a
reset; ordinary transient recovery stays unchanged. Missing fraction remains
unknown, never0%; a reset is a provider forecast, not guaranteed quota recovery.
Explicit quota failure without a usable reset stays terminal.

The provider never sleeps or resends requests internally. The local executor
records `llm/retry` before its cancellable timer and `llm/retry-started` on wake;
CLIENT tools dispatch only after a successful attempt. No model/account/route/
credit rotation is added. The process/session must remain alive: no new restart,
persistent alarm or cold-resume mechanism is provided. Open a fresh TUI after
promotion; no automatic restart is performed. Offline scheduling tests do not
claim that Google quota will actually recover after the predicted reset.

## Shared inference resilience (local fork)

Claude and Gemini use the same bounded SSE lifecycle. UTF-8 fragments, CR/LF,
multiline events and final data without a newline are handled explicitly. `[DONE]`
or EOF is not proof of success: a valid STOP/MAX_TOKENS terminal and actionable
text/client tool call are required. Stream errors, malformed/truncated payloads,
policy stops and thought-only responses cannot become successful partial turns.
Opaque text/thought/tool signatures stay on their correct logical blocks.
Compatible same-type continuations across SSE events append within a run; an
explicit thought signature-only delta updates that run instead of producing a
separate empty signed thought. Distinct parts within one event, candidates,
types/tools and differing signatures are not blindly merged. A signature alone
cannot turn an empty/thought-only response into success.
Limits are 1 MiB per event, 16 MiB per stream, 4,096
blocks and 64 KiB for HTTP error metadata. `timeoutMs` defaults to 600 seconds;
caller cancellation, hook deadlines and consumer early-return clean up transport.
The separate Harness idle watchdog remains unchanged.

Requests explicitly serialize root `enabledCreditTypes: []`, after payload hooks
and serialization validation. Credit opt-ins and model/account substitutions are
rejected locally. This is an explicit baseline-only client intent, not a universal
server billing guarantee. No credit setting, account or model is switched. HTTP
fallback is limited to a missing endpoint (404); 429/auth/5xx are not retried by
the provider transport. Request-scoped sanitized failures preserve status and
validated Retry-After/RetryInfo hints for the official Harness recovery seam.
Generic 429/RESOURCE_EXHAUSTED/QuotaFailure may mean RPM/TPM, not account quota;
only known structured exhaustion reasons map to QUOTA_EXCEEDED, terminal unless
explicit quota-reset recovery finds an eligible fresh reset. The quota window
remains unknown: neither this classification nor the optional wait proves a
five-hour or weekly quota window. Partial-output metadata supports recovery diagnostics; actual
client-tool dispatch belongs to the Harness agent loop. Hosted tools/remote
effects have no exactly-once guarantee. Mock gates do not certify long-term
backend stability or real billing behavior.

## Official retry policy and validated local rollout

Optional `retryPolicy` uses the public Harness schema; omission preserves its
default. The reviewed local profile selects the following **Antigravity-only**
policy, preserving search/model configuration:

```yaml
retryPolicy:
  mode: normal
  maxRetries: 9
  backoff:
    initialDelayMs: 5000
    maxDelayMs: 1200000
    jitterRatio: 0.1
```

Nine retries allow ten attempts. Only the recovery executor (official, or the
scoped local fork for quota resets) owns waits, budgets and cancellation; there is
no provider-local retry loop. Generic provider hints above20min fail fast in
normal mode. Only a validated fresh quota reset uses the separate up-to24h limit
when opted in; no server minimum is shortened and no endless wait is added. Permanent auth/billing/policy failures
and ambiguous remote effects are not reopened. This is independent of any
whole-turn self-healing policy; an observed whole-turn budget issue is tracked
separately in Task43 and is not claimed fixed by this provider rollout.

Local Tasks36/42 validation (2026-10-13): **310 mocked package tests, 26 actual
Harness/official-retry native-loop cases**, strict TypeScript6.0.3 with 14 generated
declarations, full external-dependency host bundle and public type-consumer checks
passed. Separate root contracts76/76 plus grammar configuration and actual public
profile YAML/wiring checks also passed. Type checks retain the reviewed `skipLibCheck` setting; they do not prove
every dependency declaration. Tests ran on Node26.10.0; a Node22 build target is
not an all-LTS-runtime or long-term provider stability certification.

The installed V4 bundle fixes logical signature association. Offline comparison
uses fake base64 signatures and proves replay shape, not cryptography. Live testing
on the exact Claude model accepted five coding responses plus a short same-session
follow-up (six HTTP200 responses). That follow-up replayed one signed logical
thought plus one text part, with no unsigned thought or empty signed part. Four
of the five coding responses reached the 16,384-token probe cap: actionable output
and accepted replay **do not prove complete programs, execution or code correctness**.
Gemini's corresponding resilience/replay gates were offline, not a live quota burn.
The prior V3 HTTP400 body was not retained; its actual cause remains unknown.

The bounded sequence stopped at its first real HTTP429 (`RATE_LIMIT`). Its validated
hint was 373,203,889ms (about 4.32 days), above the normal 1,200,000ms cap, so **zero
retries** was the correct result. Total carried counters were 18 inference POSTs,
26 metadata requests and 2 OAuth refreshes, within 32/40/4 and a 45-minute active-work
budget (about 21 active minutes). No account/model/route/credit rotation occurred;
root `enabledCreditTypes: []` guards passed. This is observed client intent, not a
universal billing guarantee. Missing final quota fraction is **unknown, not0%**;
reset timestamps and this long hint do not identify a five-hour/weekly window.
Positive recovery after a real reset remains a separate future operational gate.

Only compiler-produced `lib/index.js` changed in V4; the four affected declaration
files, 21 other library outputs, package metadata and six protected TUI OAuth outputs
remained intact. Exclusive durable backup/receipt and before/after hash guards support
single-file rollback that refuses later edits. Rename is atomic for one file, not
an OS compare-and-swap against simultaneous foreign writers. Historical pins and
published artifacts were not replaced. Prefer a fresh TUI/worker for reproducible
SDK/module loading; observed plugin hot-mount does not invalidate an existing SDK
module cache, nor does process age alone prove which hooks are active. No automatic
restart was performed. Local detailed evidence is recorded in
`../../.dumps/antigravity-resilience-20261013/promotion-live-result-v4.md` (gitignored).

## Security and Credentials

- The plugin uses two credential references: `GOOGLE_ANTIGRAVITY_OAUTH_CLIENT_CONFIG` for private OAuth application details and `GOOGLE_ANTIGRAVITY_OAUTH_CREDENTIAL` for user tokens.
- Credentials remain inside the Harness host credential service and never leak into settings, model catalogs, logs, or frontend responses.
- For inference, the plugin calls the OAuth handler's `toAuth()` and passes the resulting JSON auth value to pi-ai as a per-request override; pi-ai's model collection holds no CredentialStore.

## Contributing

Issues and scoped pull requests are welcome. Please describe observed provider responses, omit secrets and account identifiers, update both README languages, and run package tests in a matching DeepSeek Harness workspace.

## License and Disclaimer

MIT License. This independent integration is not affiliated with or endorsed by Google, DeepMind, DeepSeek, or pi-ai maintainers. Google Anti Gravity and related model names are trademarks of their respective owners.

## Model Experience

### Anti Gravity Inference

#### What the model sees

The selected model receives the Harness system prompt as `systemInstruction`, along with normalized conversation messages and tool definitions. The plugin adds no vendor prompts or instructions. The transport retains native Cloud Code Assist envelopes: sending authorized JSON/SSE headers and official fields (`project`, `model`, `request`, `requestType`, `userAgent`, and `requestId`) without compatibility headers, identity messages, or synthetic turns.

#### Token effect

No additional model-visible tokens are added beyond the system prompt, history, and tools in the request. Cloud Code Assist reports prompt, candidate, thinking, and cached token counts; the adapter maps these fields directly without estimation.

#### KV Cache effect

Logical message order is preserved. Thinking signatures and tool call IDs persist across subsequent turns. Upstream cache reuse remains governed by Cloud Code Assist and may reset when earlier turns or models change.

## Known Limitations and Deferred Work

- Google delivers this subscription path over internal `v1internal` Cloud Code Assist endpoints rather than public Gemini APIs; endpoint changes may affect this plugin independently of public Gemini services.
- OAuth starts from the plugin-owned Anti Gravity settings page, and the account must hold active service entitlements.
- Automatic OAuth client import currently supports Google-signed macOS `Antigravity IDE.app` installations. Non-standard paths can be supplied via `macosApplicationPath`; other operating systems require credentials pre-provisioned via the credentials service.
- Catalog items describe provider capabilities and do not guarantee remaining quota. Depleted quotas return as provider errors during inference.
