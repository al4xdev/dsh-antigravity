/** Provider-owned, sanitized failures; no backend text or payload crosses this boundary. */
export type AntiGravityFailureReason = 'rate-limit' | 'quota' | 'auth' | 'billing' | 'policy' | 'server' | 'transport' | 'timeout' | 'aborted' | 'empty' | 'protocol'
export type AntiGravityFailureCode = 'RATE_LIMIT' | 'QUOTA_EXCEEDED' | 'AUTH' | 'INVALID_REQUEST' | 'SERVER' | 'TRANSPORT' | 'TIMEOUT' | 'ABORTED' | 'EMPTY_RESPONSE' | 'PI_AI_ERROR'
export type AntiGravityFailurePhase = 'auth' | 'payload-hook' | 'payload-guard' | 'response-hook' | 'fetch' | 'http-error' | 'sse-error' | 'sse-terminal' | 'sse' | 'timeout' | 'cancelled'
export type AntiGravityTerminalCategory = 'blocked' | 'other' | 'malformed-function-call' | 'unknown'
export type AntiGravityTerminalReason = 'SAFETY' | 'RECITATION' | 'LANGUAGE' | 'BLOCKLIST' | 'PROHIBITED_CONTENT' | 'SPII'
export interface AntiGravityFailureData {
  readonly code: AntiGravityFailureCode
  readonly message: string
  readonly status?: number
  readonly providerRetryAfterMs?: number
  readonly reason: AntiGravityFailureReason
  readonly quotaWindow: 'unknown'
  readonly partial: boolean
  readonly phase?: AntiGravityFailurePhase
  readonly terminalCategory?: AntiGravityTerminalCategory
  readonly terminalReason?: AntiGravityTerminalReason
}
const phases = new Set<AntiGravityFailurePhase>(['auth', 'payload-hook', 'payload-guard', 'response-hook', 'fetch', 'http-error', 'sse-error', 'sse-terminal', 'sse', 'timeout', 'cancelled'])
const terminalCategories = new Set<AntiGravityTerminalCategory>(['blocked', 'other', 'malformed-function-call', 'unknown'])
const terminalReasons = new Set<AntiGravityTerminalReason>(['SAFETY', 'RECITATION', 'LANGUAGE', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'])
const messages: Record<AntiGravityFailureReason, string> = {
  'rate-limit': 'Anti Gravity request was rate limited.', quota: 'Anti Gravity reported exhausted quota; the quota window is unknown.',
  auth: 'Anti Gravity authorization is unavailable.', billing: 'Anti Gravity billing or credits prevented this request.',
  policy: 'Anti Gravity rejected this request by policy.', server: 'Anti Gravity service is unavailable.',
  transport: 'Anti Gravity response transport was incomplete.', timeout: 'Anti Gravity request timed out.',
  aborted: 'Anti Gravity request was cancelled.', empty: 'Anti Gravity returned no actionable response.',
  protocol: 'Anti Gravity returned an invalid response.',
}
export class AntiGravityFailure extends Error {
  readonly failure: AntiGravityFailureData
  readonly code: AntiGravityFailureCode
  constructor(code: AntiGravityFailureCode, reason: AntiGravityFailureReason, options: {
    status?: number, providerRetryAfterMs?: number, partial?: boolean,
    phase?: AntiGravityFailurePhase, terminalCategory?: AntiGravityTerminalCategory, terminalReason?: AntiGravityTerminalReason,
  } = {}) {
    const phase = options.phase !== undefined && phases.has(options.phase) ? options.phase : undefined
    const terminalCategory = options.terminalCategory !== undefined && terminalCategories.has(options.terminalCategory) ? options.terminalCategory : undefined
    const terminalReason = options.terminalReason !== undefined && terminalReasons.has(options.terminalReason) ? options.terminalReason : undefined
    // These suffixes are allowlisted categories, never backend strings. The host
    // already preserves message, so diagnostics need no new global observer seam.
    const message = messages[reason] + (phase === undefined ? '' : ` [stage=${phase}${terminalCategory === undefined ? '' : `; terminal=${terminalCategory}`}]`)
      + (terminalReason === undefined ? '' : ` [native-stop=${terminalReason}]`)
    super(message)
    this.name = 'AntiGravityFailure'
    this.code = code
    const status = Number.isInteger(options.status) && options.status! >= 100 && options.status! <= 599 ? options.status : undefined
    const delay = positiveDelay(options.providerRetryAfterMs)
    this.failure = Object.freeze({ code, message, reason, quotaWindow: 'unknown', partial: options.partial === true,
      ...status === undefined ? {} : { status }, ...delay === undefined ? {} : { providerRetryAfterMs: delay },
      ...phase === undefined ? {} : { phase }, ...terminalCategory === undefined ? {} : { terminalCategory },
      ...terminalReason === undefined ? {} : { terminalReason } })
  }
}
function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
function positiveDelay(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value <= Number.MAX_SAFE_INTEGER ? Math.ceil(value) : undefined
}
function httpDate(value: string | null | undefined): number | undefined {
  if (!value || value.length > 128 || !/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(value)) return undefined
  const result = Date.parse(value)
  return Number.isFinite(result) ? result : undefined
}
/** HTTP delay-seconds are seconds, not milliseconds. Dates use the server clock when supplied. */
export function parseRetryAfterMs(value: string | null | undefined, dateHeader?: string | null, nowMs = Date.now()): number | undefined {
  if (!value || value.length > 128) return undefined
  const trimmed = value.trim()
  if (/^\d+$/.test(trimmed)) return positiveDelay(Number(trimmed) * 1000)
  const deadline = httpDate(trimmed)
  if (deadline === undefined || !Number.isFinite(nowMs)) return undefined
  return positiveDelay(deadline - (httpDate(dateHeader) ?? nowMs))
}
function durationMs(value: unknown): number | undefined {
  if (typeof value === 'string' && value.length <= 64) {
    const match = /^(\d+)(?:\.(\d{1,9}))?s$/.exec(value)
    if (!match) return undefined
    return positiveDelay((Number(match[1]) + Number(`0.${match[2] ?? '0'}`)) * 1000)
  }
  const item = record(value)
  if (!item) return undefined
  const seconds = typeof item.seconds === 'string' && /^\d+$/.test(item.seconds) ? Number(item.seconds) : item.seconds ?? 0
  const nanos = item.nanos ?? 0
  if (typeof seconds !== 'number' || !Number.isSafeInteger(seconds) || seconds < 0
    || typeof nanos !== 'number' || !Number.isInteger(nanos) || nanos < 0 || nanos >= 1_000_000_000) return undefined
  return positiveDelay(seconds * 1000 + nanos / 1_000_000)
}
function errorRecord(payload: unknown): Record<string, unknown> | undefined {
  const envelope = record(payload)
  return record(envelope?.error) ?? record(record(envelope?.response)?.error) ?? envelope
}
function details(payload: unknown): Record<string, unknown>[] {
  const list = errorRecord(payload)?.details
  return Array.isArray(list) ? list.slice(0, 64).flatMap(item => record(item) ? [record(item)!] : []) : []
}
export function parseRetryInfoDelayMs(payload: unknown): number | undefined {
  const hints = details(payload).filter(item => item['@type'] === 'type.googleapis.com/google.rpc.RetryInfo')
    .flatMap(item => { const delay = durationMs(item.retryDelay); return delay === undefined ? [] : [delay] })
  return hints.length ? Math.max(...hints) : undefined
}
/** Known structured reasons only; an English quota message or long delay is not quota evidence. */
export function parseAntiGravityFailure(status: number | undefined, payload: unknown, headers?: Pick<Headers, 'get'>, partial = false): AntiGravityFailure {
  const error = errorRecord(payload)
  if (status === undefined) {
    const rpc: Record<string, number> = { UNAUTHENTICATED: 401, PERMISSION_DENIED: 403, RESOURCE_EXHAUSTED: 429, UNAVAILABLE: 503, INTERNAL: 500, INVALID_ARGUMENT: 400, DEADLINE_EXCEEDED: 504 }
    const numeric = error?.code
    status = typeof numeric === 'number' && numeric >= 100 && numeric <= 599 ? numeric
      : typeof error?.status === 'string' ? rpc[error.status] : undefined
  }
  const info = details(payload)
  const reasons = info.filter(item => item['@type'] === 'type.googleapis.com/google.rpc.ErrorInfo')
    .map(item => item.reason).filter((reason): reason is string => typeof reason === 'string')
  const retryAfter = parseRetryAfterMs(headers?.get('retry-after'), headers?.get('date'))
  const retryInfo = parseRetryInfoDelayMs(payload)
  const providerRetryAfterMs = Math.max(retryAfter ?? 0, retryInfo ?? 0) || undefined
  const options = { status, providerRetryAfterMs, partial, phase: 'http-error' as const }
  if (status === 401 || status === 403) return new AntiGravityFailure('AUTH', 'auth', options)
  if (status === 402 || reasons.some(reason => ['BILLING_DISABLED', 'BILLING_NOT_ENABLED', 'CREDITS_EXHAUSTED'].includes(reason))) return new AntiGravityFailure('INVALID_REQUEST', 'billing', options)
  if (reasons.some(reason => ['POLICY_VIOLATION', 'TOS_NOT_ACCEPTED', 'ACCESS_DENIED'].includes(reason))) return new AntiGravityFailure('INVALID_REQUEST', 'policy', options)
  // QuotaFailure also represents RPM/TPM limits; it does not prove account exhaustion.
  if (reasons.includes('RATE_LIMIT_EXCEEDED')) return new AntiGravityFailure('RATE_LIMIT', 'rate-limit', options)
  if (reasons.some(reason => ['QUOTA_EXCEEDED', 'ACCOUNT_QUOTA_EXCEEDED', 'ACCOUNT_LIMIT_EXCEEDED'].includes(reason))) {
    return new AntiGravityFailure('QUOTA_EXCEEDED', 'quota', options)
  }
  if (status === 429 || reasons.includes('RATE_LIMIT_EXCEEDED') || error?.status === 'RESOURCE_EXHAUSTED') return new AntiGravityFailure('RATE_LIMIT', 'rate-limit', options)
  if (status !== undefined && status >= 500) return new AntiGravityFailure('SERVER', 'server', options)
  if (status !== undefined && status >= 400) return new AntiGravityFailure('INVALID_REQUEST', 'protocol', options)
  return new AntiGravityFailure('PI_AI_ERROR', 'protocol', options)
}
