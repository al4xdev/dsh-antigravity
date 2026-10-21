# Local Installation in DSH TUI

Upstream revision: `1cb9010`, version `0.1.0-rc.5`.
Profile: `~/.dsh/profiles/dsh-tui`.

The package is linked to the local checkout, with runtime dependencies shared with
the DSH installation. Manifest `workspace:` references were adjusted to installed versions;
development dependencies were stripped.

`tui-login.mjs` adds two local commands:

- `/antigravity-client <file.json>` imports `clientId` and `clientSecret` into DSH credential
  store without printing these values.
- `/antigravity-login` uses plugin OAuth and opens the browser.

On Linux, upstream does not automatically import OAuth client configuration. It must be
provided prior to login. No token or client configuration was extracted from other apps in
this installation.

Verified: module import, profile composition, actual TUI boot, and command execution with
correct diagnostics when OAuth configuration is missing. During initial installation, Google
login and authenticated inference were not tested. Authenticated search validation below
reuses existing OAuth without fresh login.

## Opt-in Google Search

Local code provides `webSearch` (default `false`) and `searchModel` (default `gemini-3.8-flash-low`).
Enabling `webSearch: true` in the plugin registers `google-antigravity` search when `web` service
is available, reusing OAuth. If other providers exist, explicitly select
`searchProvider: google-antigravity` in the web service and explicitly retain
`fetchProvider: http` when replacing loader configuration blocks. None of these configurations
is modified automatically by the plugin.

Search requires native grounding and `STOP` finishReason; does not switch models or extract
sources from text URLs. Preserves HTTP(S) grounding URLs, including Google redirects.
Limits: 60 seconds, 2 MiB SSE, 128 Ki response characters, and 64 sources. Response/source
truncation is signaled in results.

Mocked validation without network: `npm run test:search`.
Isolated local host build: `npm run bundle:host`.
Default build `pnpm run bundle` still references upstream monorepo tooling. Implementation
under `src` only reaches runtime post-build, without editing `lib` manually.

### Validation and Activation — 2026-10-12

- Real search with `gemini-3.8-flash-low` and OAuth: HTTP 200, STOP finishReason, Google queries,
  and four sources in Node.js test (15.3 seconds).
- Compiled provider mounted via Cordis/`ctx.web`: Qwen 3.8-27B search returned answer and eight
  sources (23.9 seconds); unloading plugin removed provider.
- Dates/codename Node.js and primary Qwen features verified against official pages. Grounding
  proves search occurred, not truth of every summary assertion.
- 30-test host suite passed; sources passed standalone typecheck.
- Profile `dsh-tui`: Google search enabled, DeepSeek search disabled, `web_fetch` remains HTTP.
  Offline composition of the three bundles passed with zero warnings.
- Local reports reside in `.dumps/antigravity-search-{probe,live}.json` and
  `.dumps/antigravity-profile-check.json` of parent repo (not versioned).

Existing primary model remains selected. Plugin appears upon fresh TUI launch. Updating checkout
must preserve local adaptations.

## Gemini 4 Argon (`gemini-4-argon-*`) and Quota Isolation — 2026-10-16

- **User-Agent Gating**: The endpoint `daily-cloudcode-pa.googleapis.com` hides and rejects (`HTTP 404`)
  models `gemini-4-argon-low`, `gemini-4-argon-medium`, and `gemini-4-argon-high` if the `User-Agent`
  header does not match CLI 1.4.0+ format (`antigravity/cli/1.4.0 (aidev_client; os_type=linux; arch=amd64; cl=1000494485; auth_method=consumer)`).
- **Three independent quota groups**:
  1. **Flash Family (`gemini-3.8-flash-*`, `gemini-3.5-flash-*`)**: short window (~5h).
  2. **Gemini 4 Argon Family (`gemini-4-argon-*`)**: responds on server with
     `modelVersion: "gemini-4-argon-trial"` (internal enums `M419`/`M418`/`M417`) and possesses an
     exclusive weekly quota bucket isolated from other models.
  3. **3P Models (`claude-opus-5-5-*`, `claude-sonnet-5-5-*`, `gpt-oss-120b-medium`)**: shared weekly
     (`3p-weekly`) and 5-hour (`3p-5h`) quota.
- **Note on future transition (`gemini-4-pro`)**:
  In enterprise Vertex AI, the identifier `gemini-4-pro` already exists. Since Argon in Cloud Code
  Assist currently runs as `gemini-4-argon-trial` with isolated weekly quota for production testing,
  it is probable that when `gemini-4-pro` is officially released into the general catalog, nomenclature
  and routing will migrate from `argon` to the `pro` line (or Argon will consolidate as an intermediate tier
  within weekly quota). The command `/antigravity-usage` dynamically reads `quotaInfo` for each model
  returned by `fetchAvailableModels`, automatically tracking window changes.
