import { describe, expect, it } from 'vitest'
import { AntiGravityFailure, parseAntiGravityFailure, parseRetryAfterMs, parseRetryInfoDelayMs } from '../src/failure.ts'
const info = (reason: string) => ({ error: { message: 'private-project-token', details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }] } })
const retry = (delay: unknown) => ({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: delay }] } })
describe('sanitized provider failure', () => {
  it.each([[429, 'RATE_LIMIT'], [401, 'AUTH'], [403, 'AUTH'], [402, 'INVALID_REQUEST'], [500, 'SERVER'], [400, 'INVALID_REQUEST']])('classifies HTTP %s without backend-text heuristics', (status, code) => {
    const error = parseAntiGravityFailure(status as number, { error: { message: 'quota exhausted five hour token private' } })
    expect(error.code).toBe(code)
    expect(error.failure.quotaWindow).toBe('unknown')
    expect(error.failure.status).toBe(status)
    expect(Object.isFrozen(error.failure)).toBe(true)
    expect(JSON.stringify(error.failure)).not.toContain('private')
  })
  it.each(['QUOTA_EXCEEDED', 'ACCOUNT_QUOTA_EXCEEDED', 'ACCOUNT_LIMIT_EXCEEDED'])('recognizes structured %s, never infers window', reason => {
    expect(parseAntiGravityFailure(429, info(reason)).failure).toMatchObject({ code: 'QUOTA_EXCEEDED', reason: 'quota', quotaWindow: 'unknown' })
  })
  it('does not infer quota from RESOURCE_EXHAUSTED or RATE_LIMIT_EXCEEDED alone', () => {
    expect(parseAntiGravityFailure(undefined, { error: { status: 'RESOURCE_EXHAUSTED' } }).code).toBe('RATE_LIMIT')
    expect(parseAntiGravityFailure(429, info('RATE_LIMIT_EXCEEDED')).code).toBe('RATE_LIMIT')
    expect(parseAntiGravityFailure(429, { error: { reason: 'QUOTA_EXCEEDED' } }).code).toBe('RATE_LIMIT')
  })
  it('treats generic QuotaFailure as an unknown transient limit, including nested errors', () => {
    const quota = { response: { error: { code: 429, details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ subject: 'private-token-minute' }] }, { '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'RATE_LIMIT_EXCEEDED' }, { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '2s' }] } } }
    expect(parseAntiGravityFailure(undefined, quota, undefined, true).failure).toMatchObject({ code: 'RATE_LIMIT', partial: true, providerRetryAfterMs: 2000, quotaWindow: 'unknown' })
    expect(parseAntiGravityFailure(429, { error: { details: [{ '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [{ subject: 'private' }] }] } }).code).toBe('RATE_LIMIT')
  })
  it('auth, policy and billing take precedence over quota', () => {
    expect(parseAntiGravityFailure(403, info('QUOTA_EXCEEDED')).code).toBe('AUTH')
    expect(parseAntiGravityFailure(429, info('BILLING_DISABLED')).failure.reason).toBe('billing')
    expect(parseAntiGravityFailure(429, info('POLICY_VIOLATION')).failure.reason).toBe('policy')
  })
  it('only exposes allowlisted diagnostic categories, never arbitrary suffix text', () => {
    const good = new AntiGravityFailure('INVALID_REQUEST', 'policy', { phase: 'sse-terminal', terminalCategory: 'other' })
    expect(good.failure).toMatchObject({ phase: 'sse-terminal', terminalCategory: 'other' })
    expect(good.message).toContain('[stage=sse-terminal; terminal=other]')
    const malformed = new AntiGravityFailure('INVALID_REQUEST', 'policy', { phase: 'private-stage' as never, terminalCategory: 'private-reason' as never, terminalReason: 'private-native-reason' as never })
    expect(malformed.failure).not.toHaveProperty('phase')
    expect(malformed.failure).not.toHaveProperty('terminalCategory')
    expect(malformed.failure).not.toHaveProperty('terminalReason')
    expect(JSON.stringify(malformed.failure)).not.toContain('private')
  })
  it('preserves the greatest valid minimum delay without creating a quota claim', () => {
    const error = parseAntiGravityFailure(429, retry('120.000000001s'), new Headers({ 'retry-after': '90' }))
    expect(error.failure.providerRetryAfterMs).toBe(120001)
    expect(error.code).toBe('RATE_LIMIT')
    expect(new AntiGravityFailure('SERVER', 'server', { status: 999, providerRetryAfterMs: Infinity }).failure).not.toHaveProperty('status')
  })
})
describe('retry hints units and skew', () => {
  it.each([['120', 120000], [' 5 ', 5000], ['0', undefined], ['-1', undefined], ['0.5', undefined], ['NaN', undefined], ['Infinity', undefined], ['99999999999999999', undefined]])('parses HTTP delay %s', (value, expected) => expect(parseRetryAfterMs(value as string)).toBe(expected))
  it('uses server Date for an absolute hint under local clock skew', () => {
    expect(parseRetryAfterMs('Tue, 13 Oct 2026 12:02:00 GMT', 'Tue, 13 Oct 2026 12:00:00 GMT', 1)).toBe(120000)
    expect(parseRetryAfterMs('Tue, 13 Oct 2026 11:59:00 GMT', 'Tue, 13 Oct 2026 12:00:00 GMT')).toBeUndefined()
    expect(parseRetryAfterMs('2026-10-13T12:02:00Z')).toBeUndefined()
  })
  it.each([['1.000000001s', 1001], [{ seconds: '12', nanos: 1 }, 12001], [{ seconds: 0, nanos: 1 }, 1], ['0s', undefined], ['-1s', undefined], ['1.0000000001s', undefined], [{ seconds: 1, nanos: -1 }, undefined], [{ seconds: 1, nanos: 1e9 }, undefined], [{ seconds: 1.5 }, undefined]])('parses Google duration %j', (value, expected) => expect(parseRetryInfoDelayMs(retry(value))).toBe(expected))
})
