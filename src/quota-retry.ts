import { LlmError } from '@deepseek-ai/dsh-llm'
import type { LlmFailure } from '@deepseek-ai/dsh-llm'
import type { AntiGravityUsageSnapshot } from './quota.ts'

export const MAX_QUOTA_WAIT_MS = 86_400_000
export const QUOTA_RESET_RETRY_CODE = 'ANTIGRAVITY_QUOTA_RESET'
export const QUOTA_RESET_LIMIT_CODE = 'ANTIGRAVITY_QUOTA_RESET_LIMIT'
export interface QuotaResetRetryConfig { enabled?: boolean; maxWaitMs?: number }
export interface ResolvedQuotaResetRetry { readonly enabled: boolean; readonly maxWaitMs: number }

export function resolveQuotaResetRetry(config: QuotaResetRetryConfig | undefined): ResolvedQuotaResetRetry {
  if (config !== undefined && Object.keys(config).some(key => key !== 'enabled' && key !== 'maxWaitMs')) {
    throw new Error('llm-pi-ai-antigravity: unknown quotaResetRetry key')
  }
  if (config?.enabled !== undefined && typeof config.enabled !== 'boolean') throw new Error('Invalid quotaResetRetry.enabled')
  const maxWaitMs = config?.maxWaitMs ?? MAX_QUOTA_WAIT_MS
  if (!Number.isSafeInteger(maxWaitMs) || maxWaitMs <= 0 || maxWaitMs > MAX_QUOTA_WAIT_MS) {
    throw new Error('quotaResetRetry.maxWaitMs must be a positive integer no greater than 86400000')
  }
  return Object.freeze({ enabled: config?.enabled ?? false, maxWaitMs })
}

/** Only a fresh exact-model reset authorizes a quota wait; missing fraction is not zero. */
export function quotaResetFailure(
  failure: Readonly<LlmFailure>, model: string, snapshot: AntiGravityUsageSnapshot,
  failedAtMs: number, nowMs: number, maxWaitMs = MAX_QUOTA_WAIT_MS,
): Readonly<LlmFailure> {
  if (!['RATE_LIMIT', 'QUOTA_EXCEEDED'].includes(failure.code)
    || snapshot.status !== 'available' || snapshot.stale
    || !Number.isSafeInteger(failedAtMs) || !Number.isSafeInteger(nowMs) || nowMs < failedAtMs
    || !Number.isSafeInteger(snapshot.observedAtMs)
    || snapshot.observedAtMs < failedAtMs || snapshot.observedAtMs > nowMs
    || nowMs - snapshot.observedAtMs > 10_000
    || !Number.isSafeInteger(maxWaitMs) || maxWaitMs <= 0 || maxWaitMs > MAX_QUOTA_WAIT_MS) return failure
  const matching = snapshot.rows.filter(row => row.id === model)
  if (matching.length !== 1) return failure
  const resetAtMs = matching[0]!.resetAtMs
  if (resetAtMs === undefined || !Number.isSafeInteger(resetAtMs) || resetAtMs <= nowMs
    || resetAtMs > 8_640_000_000_000_000) return failure
  const hint = failure.providerRetryAfterMs
  if (hint !== undefined && (!Number.isFinite(hint) || hint <= 0)) return failure
  // Server minimum starts at failure observation, not after the metadata fetch.
  const retryAtMs = Math.max(resetAtMs, failedAtMs + (hint ?? 0))
  if (!Number.isSafeInteger(retryAtMs) || retryAtMs > 8_640_000_000_000_000) return failure
  const delayMs = Math.ceil(retryAtMs - nowMs)
  const dates = `reset reportado ${new Date(resetAtMs).toISOString()}; tentativa não antes de ${new Date(retryAtMs).toISOString()}`
  const overLimit = delayMs > maxWaitMs
  return new LlmError(`Anti Gravity ${failure.code}: ${dates}. ${overLimit
    ? `Espera acima do limite de ${maxWaitMs / 3_600_000}h; retry encerrado.`
    : 'Aguardando o horário reportado; retorno da cota não é garantido.'}`,
  overLimit ? QUOTA_RESET_LIMIT_CODE : QUOTA_RESET_RETRY_CODE, {
    ...(failure.status === undefined ? {} : { status: failure.status }),
    providerRetryAfterMs: delayMs,
  }).failure
}
