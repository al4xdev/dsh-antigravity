import { afterEach, describe, expect, it, vi } from 'vitest'
import { LlmError } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { GenerateOptions, PreparedAdapterCall, StreamChunk } from '@deepseek-ai/dsh-llm'
import { AntiGravityAdapter, captureFailureReporter } from '../src/failure-bridge.ts'
import { MAX_QUOTA_WAIT_MS, quotaResetFailure, resolveQuotaResetRetry } from '../src/quota-retry.ts'
import type { AntiGravityUsageSnapshot } from '../src/quota.ts'
import type { AntiGravityFailureData } from '../src/failure.ts'

const now = Date.parse('2026-10-13T22:00:00Z')
const model = 'claude-opus-5-5-high'
const failure = new LlmError('Anti Gravity request was rate limited.', 'RATE_LIMIT', { status: 429 }).failure
const snapshot = (delay: number, id = model): AntiGravityUsageSnapshot => ({
  source: 'fetchAvailableModels', observedAtMs: now, stale: false, status: 'available', truncated: false,
  rows: [{ id, name: id, window: 'unknown', resetAtMs: now + delay }],
})
const decide = (delay: number) => quotaResetFailure(failure, model, snapshot(delay), now, now)
afterEach(() => vi.restoreAllMocks())

describe('exact-model quota reset decisions', () => {
  it.each([1000, 60_000, 3_600_000, MAX_QUOTA_WAIT_MS])('allows a future reset after %i ms', delay => {
    expect(decide(delay)).toMatchObject({ code: 'ANTIGRAVITY_QUOTA_RESET', providerRetryAfterMs: delay, status: 429 })
    expect(decide(delay).message).toContain(new Date(now + delay).toISOString())
  })
  it('reports dates and stops above24h', () => {
    expect(decide(MAX_QUOTA_WAIT_MS + 1)).toMatchObject({ code: 'ANTIGRAVITY_QUOTA_RESET_LIMIT' })
    expect(decide(MAX_QUOTA_WAIT_MS + 1).message).toContain('24h')
  })
  it.each([0, -1000, NaN, Infinity])('does not invent a reset for %s', delay => {
    expect(decide(delay)).toBe(failure)
  })
  it.each([undefined, 0, 0.5, 1])('does not require/coerce fraction %s', remainingFraction => {
    const value = snapshot(60_000)
    expect(quotaResetFailure(failure, model, { ...value, rows: [{ ...value.rows[0]!, remainingFraction }] }, now, now).code)
      .toBe('ANTIGRAVITY_QUOTA_RESET')
  })
  it('rejects stale, old, future-observed, duplicate, wrong-model or unavailable metadata', () => {
    const fresh = snapshot(60_000)
    for (const bad of [snapshot(60_000, 'claude-opus-5-5-low'), { ...fresh, stale: true },
      { ...fresh, observedAtMs: now - 1 }, { ...fresh, observedAtMs: now + 1 },
      { ...fresh, rows: [...fresh.rows, ...fresh.rows] }, { ...fresh, status: 'unavailable' as const },
      { ...fresh, rows: [{ ...fresh.rows[0]!, resetAtMs: undefined }] }]) {
      expect(quotaResetFailure(failure, model, bad, now, now)).toBe(failure)
    }
    expect(quotaResetFailure(failure, model, fresh, now, now + 10001)).toBe(failure)
  })
  it.each([NaN, Infinity, undefined])('rejects malformed observation timestamp %s', observedAtMs => {
    expect(quotaResetFailure(failure, model, { ...snapshot(60_000), observedAtMs } as AntiGravityUsageSnapshot, now, now)).toBe(failure)
  })
  it('respects the later server minimum, starting at failure observation', () => {
    const server = new LlmError('fixed', 'RATE_LIMIT', { providerRetryAfterMs: 120_000 }).failure
    expect(quotaResetFailure(server, model, snapshot(60_000), now, now + 5000)).toMatchObject({ providerRetryAfterMs: 115_000 })
    const long = new LlmError('fixed', 'RATE_LIMIT', { providerRetryAfterMs: MAX_QUOTA_WAIT_MS + 60_000 }).failure
    expect(quotaResetFailure(long, model, snapshot(60_000), now, now).code).toBe('ANTIGRAVITY_QUOTA_RESET_LIMIT')
  })
  it.each(['AUTH', 'SERVER', 'INVALID_REQUEST', 'PI_AI_ERROR', 'TIMEOUT', 'ABORTED'])('never schedules %s', code => {
    const original = new LlmError('safe', code).failure
    expect(quotaResetFailure(original, model, snapshot(60_000), now, now)).toBe(original)
  })
  it('allows explicitly typed quota with reset, not without it', () => {
    const original = new LlmError('safe', 'QUOTA_EXCEEDED').failure
    expect(quotaResetFailure(original, model, snapshot(60_000), now, now).code).toBe('ANTIGRAVITY_QUOTA_RESET')
    expect(quotaResetFailure(original, model, { ...snapshot(60_000), rows: [] }, now, now)).toBe(original)
  })
  it('validates bounded opt-in configuration', () => {
    expect(resolveQuotaResetRetry(undefined)).toEqual({ enabled: false, maxWaitMs: MAX_QUOTA_WAIT_MS })
    for (const maxWaitMs of [0, -1, NaN, Infinity, 1.5, MAX_QUOTA_WAIT_MS + 1]) expect(() => resolveQuotaResetRetry({ maxWaitMs })).toThrow()
    expect(() => resolveQuotaResetRetry({ extra: true } as never)).toThrow()
  })
})

const opts: GenerateOptions = { provider: 'google-antigravity', model, messages: [] }
const report: AntiGravityFailureData = { code: 'RATE_LIMIT', message: failure.message, status: 429,
  reason: 'rate-limit', partial: false, quotaWindow: 'unknown' }
const finish: StreamChunk = { type: 'finish', reason: { kind: 'stop' } }
const fakeStream = () => ({ async *[Symbol.asyncIterator]() { captureFailureReporter()(report); yield finish } })
const create = () => new AntiGravityAdapter({ profiles: () => new Map(), resolveApiKey: async () => undefined,
  auth: { credentials: { read: async () => undefined, list: async () => [], modify: async () => undefined, delete: async () => {} },
    authContext: { env: async () => undefined, fileExists: async () => false } } })
const consume = async (stream: AsyncIterable<StreamChunk>) => { const values = []; for await (const v of stream) values.push(v); return values.at(-1) }
const freshNow = (id = model) => ({ ...snapshot(3_600_000, id), observedAtMs: Date.now(),
  rows: [{ id, name: id, window: 'unknown' as const, resetAtMs: Date.now() + 3_600_000 }] })

describe('quota enrichment bridge', () => {
  it('uses fresh metadata once without dispatching inference again', async () => {
    const dispatch = vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(fakeStream)
    const lookup = vi.fn(async () => freshNow())
    const adapter = create()
    adapter.configureQuotaRecovery({ observationGeneration: 0, snapshot: lookup }, resolveQuotaResetRetry({ enabled: true }))
    const terminal = await consume(adapter.stream(opts))
    expect(terminal).toMatchObject({ reason: { kind: 'error', failure: { code: 'ANTIGRAVITY_QUOTA_RESET' } } })
    expect(lookup).toHaveBeenCalledWith({ refresh: true, signal: expect.any(AbortSignal) })
    expect(dispatch).toHaveBeenCalledTimes(1)
  })
  it('binds prepared descriptor id rather than mutable stream options', async () => {
    vi.spyOn(PiAiAdapter.prototype, 'prepareCall').mockResolvedValue({ model: { id: model }, stream: fakeStream } as unknown as PreparedAdapterCall)
    const adapter = create()
    adapter.configureQuotaRecovery({ observationGeneration: 0, snapshot: async () => freshNow() }, resolveQuotaResetRetry({ enabled: true }))
    const prepared = await adapter.prepareCall(opts.provider, opts.model)
    expect(await consume(prepared.stream({ ...opts, model: 'other-model' }))).toMatchObject({ reason: { failure: { code: 'ANTIGRAVITY_QUOTA_RESET' } } })
  })
  it('fails closed on epoch invalidation or metadata error without raw diagnostics', async () => {
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(fakeStream)
    for (const invalidation of [true, false]) {
      const adapter = create()
      const usage = { observationGeneration: 0, snapshot: async () => {
        if (invalidation) { usage.observationGeneration++; return freshNow() }
        throw new Error('CANARY_SECRET')
      } }
      adapter.configureQuotaRecovery(usage, resolveQuotaResetRetry({ enabled: true }))
      const terminal = await consume(adapter.stream(opts))
      expect(terminal).toMatchObject({ reason: { failure: { code: 'RATE_LIMIT' } } })
      expect(JSON.stringify(terminal)).not.toContain('CANARY_SECRET')
    }
  })
  it('abort wins during metadata and keeps lifecycle failures untouched', async () => {
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(fakeStream)
    const caller = new AbortController()
    const adapter = create()
    adapter.configureQuotaRecovery({ observationGeneration: 0, snapshot: async () => { caller.abort(); return freshNow() } }, resolveQuotaResetRetry({ enabled: true }))
    expect(await consume(adapter.stream({ ...opts, signal: caller.signal }))).toMatchObject({ reason: { kind: 'aborted' } })
  })
  it('enriches typed thrown errors, but never lifecycle timeout', async () => {
    const dispatch = vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(() => ({ async *[Symbol.asyncIterator]() {
      captureFailureReporter()(report); throw new Error('CANARY_SECRET')
    } }))
    const lookup = vi.fn(async () => freshNow())
    const adapter = create()
    adapter.configureQuotaRecovery({ observationGeneration: 0, snapshot: lookup }, resolveQuotaResetRetry({ enabled: true }))
    await expect(consume(adapter.stream(opts))).rejects.toMatchObject({ code: 'ANTIGRAVITY_QUOTA_RESET' })
    lookup.mockClear()
    dispatch.mockImplementation(() => ({ async *[Symbol.asyncIterator]() { captureFailureReporter()(report); throw new LlmError('deadline', 'TIMEOUT') } }))
    await expect(consume(adapter.stream(opts))).rejects.toMatchObject({ code: 'TIMEOUT' })
    expect(lookup).not.toHaveBeenCalled()
  })
})
