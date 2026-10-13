/** Independent Google Anti Gravity provider route and OAuth settings service. */

import { createProvider, defaultProviderAuthContext, InMemoryCredentialStore } from '@earendil-works/pi-ai'
import type { Api, ApiKeyAuth, Model, Provider } from '@earendil-works/pi-ai'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import type {} from '@deepseek-ai/dsh-attachment'
import { credentialRef } from '@deepseek-ai/dsh-credentials'
import { resolveRetryPolicy, RetryPolicySchema } from '@deepseek-ai/dsh-llm'
import type { ResolvedRetryPolicy, RetryPolicyConfig } from '@deepseek-ai/dsh-llm'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { antiGravityApi } from './api.ts'
import { createAntiGravityOAuth } from './auth.ts'
import { DEFAULT_OAUTH_CLIENT_CONFIG_REF, resolveOAuthClientConfig } from './client-config.ts'
import { AntiGravityCredentialManager } from './credential.ts'
import {
  ENDPOINTS,
  fetchAvailableModelsForCredential,
  maintainedModels,
  PROVIDER,
} from './models.ts'
import { AntiGravityAuthRemote } from './remote-service.ts'
import { AntiGravitySearchProvider, DEFAULT_SEARCH_MODEL } from './search.ts'
import { AntiGravityUsageService, registerUsageCommand } from './usage.ts'
import { AntiGravityAdapter } from './failure-bridge.ts'
import { MAX_QUOTA_WAIT_MS, QUOTA_RESET_RETRY_CODE, resolveQuotaResetRetry } from './quota-retry.ts'
import type { QuotaResetRetryConfig, ResolvedQuotaResetRetry } from './quota-retry.ts'

export { AntiGravityUsageService } from './usage.ts'
export { AntiGravityAdapter, captureFailureReporter } from './failure-bridge.ts'
export { AntiGravityFailure } from './failure.ts'
export type { AntiGravityFailureData, AntiGravityFailureCode, AntiGravityFailureReason } from './failure.ts'
export { formatUsageSnapshot, parseModelQuotaSnapshot, QuotaPayloadError } from './quota.ts'
export type { AntiGravityUsageRow, AntiGravityUsageSnapshot, UsageErrorCode } from './quota.ts'
export { MAX_QUOTA_WAIT_MS, QUOTA_RESET_RETRY_CODE, QUOTA_RESET_LIMIT_CODE, quotaResetFailure, resolveQuotaResetRetry } from './quota-retry.ts'
export type { QuotaResetRetryConfig, ResolvedQuotaResetRetry } from './quota-retry.ts'

export { createAntiGravityOAuth } from './auth.ts'
export { AntiGravitySearchProvider, DEFAULT_SEARCH_MODEL } from './search.ts'
export {
  DEFAULT_OAUTH_CLIENT_CONFIG_REF,
  extractOAuthClientConfig,
  importInstalledOAuthClientConfig,
  parseOAuthClientConfig,
  resolveOAuthClientConfig,
} from './client-config.ts'
export type { AntiGravityOAuthClientConfig } from './client-config.ts'
export {
  AntiGravityCredentialManager,
  parseAntiGravityCredential,
} from './credential.ts'
export {
  fetchAvailableModels,
  fetchAvailableModelsForCredential,
  maintainedModels,
  parseAvailableModels,
  PROVIDER,
} from './models.ts'
export { AntiGravityAuthRemote } from './remote-service.ts'
export type {
  AntiGravityAuthSnapshot,
  AntiGravityLoginId,
  AntiGravityLoginStart,
  AntiGravityLoginStatus,
} from './types.ts'

export const name = 'llm-pi-ai-antigravity'
export const inject = ['llm', 'credentials']

const DEFAULT_OAUTH_CREDENTIAL_REF = 'GOOGLE_ANTIGRAVITY_OAUTH_CREDENTIAL'
const DEFAULT_DISPLAY_NAME = 'Google Anti Gravity'
const DEFAULT_STREAM_IDLE_TIMEOUT_MS = 300_000
const DEFAULT_MAX_REQUEST_IMAGE_BYTES = 20 * 1024 * 1024
const DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET = 2048 * 2048
const DEFAULT_REQUEST_IMAGE_MAX_BYTES = 1024 * 1024

/** Deployment configuration contains references and paths, never OAuth values. */
export interface Config {
  /** Opt-in native Google Search registration; requires the optional web service. */
  webSearch?: boolean
  /** Exact native search model; no automatic fallback. */
  searchModel?: string
  /** Credential reference containing the OAuth token JSON document. */
  oauthCredentialEnv?: string
  /** Credential reference containing the private OAuth client JSON document. */
  oauthClientConfigRef?: string
  /** Optional nonstandard macOS application path; the Google signature is still required. */
  macosApplicationPath?: string
  /** Provider label shown in model selectors. */
  displayName?: string
  /** Maximum provider idle time while one stream read is outstanding. */
  streamIdleTimeoutMs?: number
  /** Provider-owned request retry policy; omission preserves official defaults. */
  retryPolicy?: RetryPolicyConfig
  /** Fresh usage resets may authorize a longer wait through the scoped retry-engine fork. */
  quotaResetRetry?: QuotaResetRetryConfig
  /**
   * Base64 image payload bound for one request. Older images become text
   * placeholders once a session's accumulated images exceed it, so a long
   * session keeps completing requests instead of being refused for size.
   */
  maxRequestImageBytes?: number
  /** Total-pixel budget for each deterministic inline request version. */
  requestImagePixelBudget?: number
  /** Raw encoded-byte cap for each deterministic inline request version. */
  requestImageMaxBytes?: number
}

/** Schemastery validator for the independent Anti Gravity route. */
export const Config: z<Config> = z.object({
  webSearch: z.boolean().default(false),
  searchModel: z.string().default(DEFAULT_SEARCH_MODEL),
  oauthCredentialEnv: z.string().role('credential-ref').default(DEFAULT_OAUTH_CREDENTIAL_REF),
  oauthClientConfigRef: z.string().role('credential-ref').default(DEFAULT_OAUTH_CLIENT_CONFIG_REF),
  macosApplicationPath: z.string(),
  displayName: z.string().default(DEFAULT_DISPLAY_NAME),
  streamIdleTimeoutMs: z.number().min(Number.MIN_VALUE).max(MAX_TIMER_DELAY_MS).default(DEFAULT_STREAM_IDLE_TIMEOUT_MS),
  retryPolicy: RetryPolicySchema,
  quotaResetRetry: z.object({
    enabled: z.boolean().default(false),
    maxWaitMs: z.number().step(1).min(1).max(MAX_QUOTA_WAIT_MS).default(MAX_QUOTA_WAIT_MS),
  }),
  maxRequestImageBytes: z.number().step(1).min(1).default(DEFAULT_MAX_REQUEST_IMAGE_BYTES),
  requestImagePixelBudget: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET),
  requestImageMaxBytes: z.number().step(1).min(1).default(DEFAULT_REQUEST_IMAGE_MAX_BYTES),
})

interface ResolvedConfig {
  readonly webSearch: boolean
  readonly searchModel: string
  readonly oauthCredentialEnv: ReturnType<typeof credentialRef>
  readonly oauthClientConfigRef: string
  readonly macosApplicationPath?: string
  readonly displayName: string
  readonly streamIdleTimeoutMs: number
  readonly retryPolicy: ResolvedRetryPolicy
  readonly quotaResetRetry: ResolvedQuotaResetRetry
  readonly maxRequestImageBytes: number
  readonly requestImagePixelBudget: number
  readonly requestImageMaxBytes: number
}

function resolveConfig(config: Config): ResolvedConfig {
  const searchModel = config.searchModel ?? DEFAULT_SEARCH_MODEL
  if (searchModel.trim().length === 0) throw new Error('llm-pi-ai-antigravity: searchModel must not be empty')
  const displayName = config.displayName ?? DEFAULT_DISPLAY_NAME
  const streamIdleTimeoutMs = config.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS
  const maxRequestImageBytes = config.maxRequestImageBytes ?? DEFAULT_MAX_REQUEST_IMAGE_BYTES
  const requestImagePixelBudget = config.requestImagePixelBudget ?? DEFAULT_REQUEST_IMAGE_PIXEL_BUDGET
  const requestImageMaxBytes = config.requestImageMaxBytes ?? DEFAULT_REQUEST_IMAGE_MAX_BYTES
  if (displayName.length === 0) throw new Error('llm-pi-ai-antigravity: displayName must not be empty')
  if (!Number.isFinite(streamIdleTimeoutMs)
    || streamIdleTimeoutMs <= 0
    || streamIdleTimeoutMs > MAX_TIMER_DELAY_MS) {
    throw new Error(
      `llm-pi-ai-antigravity: streamIdleTimeoutMs must be a positive finite number no greater than ${MAX_TIMER_DELAY_MS}`,
    )
  }
  if (!Number.isInteger(maxRequestImageBytes) || maxRequestImageBytes <= 0) {
    throw new Error('llm-pi-ai-antigravity: maxRequestImageBytes must be a positive integer')
  }
  if (!Number.isSafeInteger(requestImagePixelBudget) || requestImagePixelBudget <= 0) {
    throw new Error('llm-pi-ai-antigravity: requestImagePixelBudget must be a positive safe integer')
  }
  if (!Number.isSafeInteger(requestImageMaxBytes) || requestImageMaxBytes <= 0) {
    throw new Error('llm-pi-ai-antigravity: requestImageMaxBytes must be a positive safe integer')
  }
  const quotaResetRetry = resolveQuotaResetRetry(config.quotaResetRetry)
  const basePolicy = resolveRetryPolicy(config.retryPolicy, 'llm-pi-ai-antigravity: retryPolicy')
  if (quotaResetRetry.enabled && basePolicy.mode !== 'normal') {
    throw new Error('quotaResetRetry requires normal retry mode')
  }
  // Register one stable identity: quota and transient waits consume the same budget.
  const retryPolicy: ResolvedRetryPolicy = quotaResetRetry.enabled && basePolicy.mode === 'normal'
    ? Object.freeze({ ...basePolicy, retryableCodes: Object.freeze([...new Set([...basePolicy.retryableCodes, QUOTA_RESET_RETRY_CODE])]) })
    : basePolicy
  return {
    webSearch: config.webSearch ?? false,
    searchModel,
    oauthCredentialEnv: credentialRef(config.oauthCredentialEnv ?? DEFAULT_OAUTH_CREDENTIAL_REF),
    oauthClientConfigRef: config.oauthClientConfigRef ?? DEFAULT_OAUTH_CLIENT_CONFIG_REF,
    ...config.macosApplicationPath === undefined ? {} : { macosApplicationPath: config.macosApplicationPath },
    displayName,
    streamIdleTimeoutMs,
    retryPolicy,
    quotaResetRetry,
    maxRequestImageBytes,
    requestImagePixelBudget,
    requestImageMaxBytes,
  }
}

/** Auth handler that accepts only a request-level OAuth-derived override. */
const requestOverrideAuth: ApiKeyAuth = {
  name: 'Google Anti Gravity OAuth request override',
  resolve: ({ credential }) => Promise.resolve(
    credential?.key === undefined || credential.key.length === 0
      ? undefined
      : { auth: { apiKey: credential.key }, source: 'OAuth' },
  ),
}

function providerFor(
  config: ResolvedConfig,
  models: readonly Model<Api>[],
  oauth: ReturnType<typeof createAntiGravityOAuth>,
): Provider {
  const resolvedModels = models.map(model => ({
    ...model,
    provider: PROVIDER,
    baseUrl: ENDPOINTS[0],
  }))
  return createProvider({
    id: PROVIDER,
    name: config.displayName,
    baseUrl: ENDPOINTS[0],
    auth: { apiKey: requestOverrideAuth, oauth },
    models: resolvedModels,
    api: antiGravityApi,
  })
}

function profileFor(
  config: ResolvedConfig,
  models: readonly Model<Api>[],
  oauth: ReturnType<typeof createAntiGravityOAuth>,
): ReadonlyMap<string, ResolvedPiAiProviderProfile> {
  return new Map([[PROVIDER, {
    provider: PROVIDER,
    displayName: config.displayName,
    streamIdleTimeoutMs: config.streamIdleTimeoutMs,
    maxRequestImageBytes: config.maxRequestImageBytes,
    requestImagePixelBudget: config.requestImagePixelBudget,
    requestImageMaxBytes: config.requestImageMaxBytes,
    retryPolicy: config.retryPolicy,
    configuredMaxTokens: new Map(),
    modelErrors: new Map(),
    piProvider: providerFor(config, models, oauth),
  }]])
}

/**
 * Register Anti Gravity inference, OAuth Remote methods, and the maintained/live catalog.
 * @param ctx - Cordis context providing LLM, credential, and optional attachment services.
 * @param rawConfig - validated plugin configuration.
 */
export function apply(ctx: Context, rawConfig: Config): void {
  const config = resolveConfig(rawConfig)
  const oauth = createAntiGravityOAuth(() => resolveOAuthClientConfig(
    ctx.credentials,
    config.oauthClientConfigRef,
    config.macosApplicationPath,
  ))
  const credentials = new AntiGravityCredentialManager(ctx.credentials, config.oauthCredentialEnv, oauth)
  new AntiGravityAuthRemote(ctx, ctx.credentials, config.oauthCredentialEnv, oauth)
  const usage = new AntiGravityUsageService(ctx, credentials)
  registerUsageCommand(ctx, usage)
  ctx.on('credentials/reference-updated', (ref) => {
    if (ref === config.oauthCredentialEnv) usage.invalidate()
  })
  if (config.webSearch) {
    // Keep inference independent of web, and re-register if that service is replaced.
    ctx.inject(['web'], (webContext) => {
      webContext.web.registerSearchProvider(new AntiGravitySearchProvider(credentials, config.searchModel))
    })
  }

  let profiles = profileFor(config, maintainedModels, oauth)
  const adapter = new AntiGravityAdapter({
    profiles: () => profiles,
    resolveApiKey: () => credentials.resolveApiKey(),
    auth: {
      credentials: new InMemoryCredentialStore(),
      authContext: defaultProviderAuthContext(),
    },
    resolveAttachments: () => ctx.get('attachments'),
  })
  adapter.configureQuotaRecovery(usage, config.quotaResetRetry)
  const registration = ctx.llm.registerAdapter([PROVIDER], adapter)

  const controller = new AbortController()
  let refreshing: Promise<void> | undefined
  const refresh = (): void => {
    refreshing ??= (async () => {
      try {
        const credential = await credentials.resolveCredential()
        const live = await fetchAvailableModelsForCredential(credential, controller.signal)
        profiles = profileFor(config, live, oauth)
        registration.replace([PROVIDER])
      } catch (error) {
        if (!controller.signal.aborted) {
          ctx.logger.info('llm-pi-ai-antigravity: live model refresh unavailable; keeping the maintained catalog')
          ctx.logger.debug(error)
        }
      } finally {
        refreshing = undefined
      }
    })()
  }
  ctx.effect(() => {
    const timers = [setTimeout(refresh, 0), setTimeout(refresh, 250)]
    return () => {
      for (const timer of timers) clearTimeout(timer)
      controller.abort()
    }
  }, 'llm-pi-ai-antigravity: live refresh')
  ctx.on('credentials/reference-updated', (ref) => {
    if (ref === config.oauthCredentialEnv) refresh()
  })
}
