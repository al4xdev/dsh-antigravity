import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { LlmError, resolveRetryPolicy } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, PreparedAdapterCall, StreamChunk } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { ResolvedPiAiProviderProfile } from '@deepseek-ai/dsh-llm-pi-ai'
import { createAssistantMessageEventStream, createProvider, defaultProviderAuthContext, InMemoryCredentialStore } from '@earendil-works/pi-ai'
import type { Model, Api, AssistantMessage, StreamOptions } from '@earendil-works/pi-ai'
import { parseAvailableModels } from '../src/models.ts'
import { AntiGravityAdapter, captureFailureReporter } from '../src/failure-bridge.ts'
import type { AntiGravityFailureData } from '../src/failure.ts'
import { Config, apply } from '../src/index.ts'

const options: GenerateOptions = { provider: 'google-antigravity', model: 'claude-opus-5-5-high', messages: [] }
const done: StreamChunk = { type: 'finish', reason: { kind: 'stop' } }
const quota = Object.freeze({ code: 'RATE_LIMIT', message: 'Anti Gravity rate limit', status: 429,
  providerRetryAfterMs: 15000, reason: 'rate-limit', quotaWindow: 'unknown', partial: false }) as AntiGravityFailureData
const adapter = () => new AntiGravityAdapter({ profiles: () => new Map(), resolveApiKey: async () => undefined,
  auth: { credentials: { read: async () => undefined, list: async () => [], modify: async () => undefined, delete: async () => {} },
    authContext: { env: async () => undefined, fileExists: async () => false } } })
const chunks = async (stream: AsyncIterable<StreamChunk>) => { const result: StreamChunk[] = []; for await (const chunk of stream) result.push(chunk); return result }
const terminal = (result: StreamChunk[]) => result.at(-1) as Extract<StreamChunk, { type: 'finish' }>
const iterable = (run: () => AsyncGenerator<StreamChunk>) => ({ [Symbol.asyncIterator]: run })

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('provider-owned request failure bridge', () => {
  it('runs factory and next in ALS; updates only terminal reason, detached and frozen', async () => {
    const delta: StreamChunk = { type: 'text-delta', index: 3, text: 'partial' }
    const usage: StreamChunk = { type: 'usage', usage: { inputTokens: 2, outputTokens: 1 } }
    let factoryReporter: ReturnType<typeof captureFailureReporter> | undefined
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(request => {
      expect(request.messages).toBe(options.messages)
      factoryReporter = captureFailureReporter()
      return iterable(async function* () {
        yield delta
        factoryReporter!({ ...quota, partial: true })
        yield usage
        yield done
      })
    })
    const result = await chunks(adapter().stream(options))
    expect(result[0]).toBe(delta)
    expect(result[1]).toBe(usage)
    const finish = terminal(result)
    expect(finish.reason).toEqual({ kind: 'error', failure: {
      code: 'RATE_LIMIT', message: quota.message, status: 429, providerRetryAfterMs: 15000,
    } })
    if (finish.reason.kind !== 'error') throw new Error('Missing failure')
    expect(Object.isFrozen(finish.reason.failure)).toBe(true)
    expect(JSON.stringify(finish)).not.toContain('quotaWindow')
    expect(options.signal).toBeUndefined()
  })

  it('preserves successful finish identity and non-replay metadata when a terminal failure replaces success', async () => {
    const metadata = Object.freeze({ fixture: 'unchanged' })
    const success = { ...done, fixtureMetadata: metadata,
      replayState: {} as NonNullable<Extract<StreamChunk, { type: 'finish' }>['replayState']> }
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(() => iterable(async function* () { yield success }))
    expect(terminal(await chunks(adapter().stream(options)))).toBe(success)
    vi.mocked(PiAiAdapter.prototype.stream).mockImplementation(() => iterable(async function* () {
      captureFailureReporter()(quota)
      yield success
    }))
    const replaced = terminal(await chunks(adapter().stream(options))) as typeof success
    expect(replaced.reason.kind).toBe('error')
    expect(replaced.fixtureMetadata).toBe(metadata)
    expect(replaced.replayState).toBeUndefined()
  })

  it('wraps prepared dispatcher without calling live stream or changing model identity', async () => {
    const model = Object.freeze({ name: 'old generation' }) as unknown as PreparedAdapterCall['model']
    const dispatch = vi.fn(() => iterable(async function* () { captureFailureReporter()(quota); yield done }))
    vi.spyOn(PiAiAdapter.prototype, 'prepareCall').mockResolvedValue({ model, stream: dispatch })
    const direct = vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(() => { throw new Error('Wrong new generation') })
    const prepared = await adapter().prepareCall(options.provider, options.model)
    expect(prepared.model).toBe(model)
    expect(terminal(await chunks(prepared.stream(options))).reason.kind).toBe('error')
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(direct).not.toHaveBeenCalled()
  })

  it('keeps the real pi-ai prepared snapshot when the profile map is replaced', async () => {
    const models = parseAvailableModels({ models: { [options.model]: { displayName: 'Claude fixture' } } })
    const invoked: string[] = []
    function profiles(generation: string): ReadonlyMap<string, ResolvedPiAiProviderProfile> {
      const produce = (model: Model<Api>, _context: unknown, _options?: StreamOptions) => {
        invoked.push(generation)
        const stream = createAssistantMessageEventStream()
        const report = captureFailureReporter()
        report(quota)
        const message: AssistantMessage = { role: 'assistant', content: [], api: model.api, provider: model.provider,
          model: model.id, usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } },
          stopReason: 'error', timestamp: 0, errorMessage: 'SDK generic error' }
        stream.push({ type: 'error', reason: 'error', error: message })
        stream.end()
        return stream
      }
      const piProvider = createProvider({ id: options.provider, name: generation, models,
        auth: { apiKey: { name: 'fixture', resolve: async () => ({ auth: { apiKey: 'fixture' }, source: 'fixture' }) } },
        api: { stream: produce, streamSimple: produce } })
      return new Map([[options.provider, { provider: options.provider, displayName: generation, piProvider,
        retryPolicy: resolveRetryPolicy(undefined, 'fixture'), streamIdleTimeoutMs: 300000,
        maxRequestImageBytes: 20 * 1024 * 1024, requestImagePixelBudget: 2048 * 2048,
        requestImageMaxBytes: 1024 * 1024, configuredMaxTokens: new Map(), modelErrors: new Map() }]])
    }
    let current = profiles('old')
    const bridge = new AntiGravityAdapter({ profiles: () => current, resolveApiKey: async () => 'fixture',
      auth: { credentials: new InMemoryCredentialStore(), authContext: defaultProviderAuthContext() } })
    const prepared = await bridge.prepareCall(options.provider, options.model)
    const descriptor = prepared.model
    current = profiles('new')
    const oldFinish = terminal(await chunks(prepared.stream(options)))
    expect(oldFinish.reason.kind).toBe('error')
    if (oldFinish.reason.kind !== 'error') throw new Error('Missing failure')
    expect(oldFinish.reason.failure.code).toBe('RATE_LIMIT')
    expect(oldFinish.reason.failure.status).toBe(429)
    expect(prepared.model).toBe(descriptor)
    await chunks(bridge.stream(options))
    expect(invoked).toEqual(['old', 'new'])
  })

  it('isolates concurrent Claude/Gemini streams and rejects reporters from completed requests', async () => {
    let oldReporter: ReturnType<typeof captureFailureReporter> | undefined
    const release = Promise.withResolvers<void>()
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(request => iterable(async function* () {
      const report = captureFailureReporter()
      if (request.model.startsWith('claude')) { oldReporter = report; await release.promise; report(quota) }
      else { oldReporter?.(quota); release.resolve() }
      yield done
    }))
    const bridge = adapter()
    const [claude, gemini] = await Promise.all([
      chunks(bridge.stream(options)), chunks(bridge.stream({ ...options, model: 'gemini-3.8-flash-low' })),
    ])
    expect(terminal(claude).reason.kind).toBe('error')
    expect(terminal(gemini)).toBe(done)
    oldReporter?.(quota)
    captureFailureReporter()(quota)
    vi.mocked(PiAiAdapter.prototype.stream).mockImplementation(() => iterable(async function* () { yield done }))
    expect(terminal(await chunks(bridge.stream(options)))).toBe(done)
  })

  it.each(['ABORTED', 'TIMEOUT'])('keeps official %s failure above an earlier provider report', async code => {
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(() => iterable(async function* () {
      captureFailureReporter()(quota)
      throw new LlmError('Official lifecycle failure', code)
    }))
    await expect(chunks(adapter().stream(options))).rejects.toMatchObject({ code, message: 'Official lifecycle failure' })
  })

  it('preserves typed thrown provider facts without raw cause or text classification', async () => {
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(() => iterable(async function* () {
      captureFailureReporter()(quota)
      throw new Error('raw-secret-body')
    }))
    await expect(chunks(adapter().stream(options))).rejects.toMatchObject({ code: 'RATE_LIMIT', failure: {
      status: 429, providerRetryAfterMs: 15000,
    } })
    vi.mocked(PiAiAdapter.prototype.stream).mockImplementation(() => iterable(async function* () { throw new Error('429 RATE_LIMIT fake prefix') }))
    await expect(chunks(adapter().stream(options))).rejects.toThrow('429 RATE_LIMIT fake prefix')
  })

  it('does not let malformed reporting prevent stream settlement', async () => {
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(() => iterable(async function* () {
      expect(() => captureFailureReporter()({ ...quota, status: NaN })).not.toThrow()
      yield done
    }))
    expect(terminal(await chunks(adapter().stream(options)))).toBe(done)
  })

  it('caller abort wins and return aborts a pending next; late callback cannot contaminate a new request', async () => {
    const entered = Promise.withResolvers<void>()
    let report: ReturnType<typeof captureFailureReporter> | undefined
    let cancelled = false
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(request => iterable(async function* () {
      report = captureFailureReporter()
      try {
        await new Promise<void>(resolve => {
          request.signal!.addEventListener('abort', () => { cancelled = true; resolve() }, { once: true })
          entered.resolve()
        })
        report(quota)
        yield done
      } finally { report(quota) }
    }))
    const iterator = adapter().stream(options)[Symbol.asyncIterator]()
    const pending = iterator.next()
    await entered.promise
    const returned = iterator.return!()
    await pending
    await returned
    expect(cancelled).toBe(true)
    report?.(quota)
    vi.mocked(PiAiAdapter.prototype.stream).mockImplementation(() => iterable(async function* () { yield done }))
    expect(terminal(await chunks(adapter().stream(options)))).toBe(done)
  })

  it('pre-abort dispatches nothing and caller abort takes precedence over a concurrent timeout finish', async () => {
    const caller = new AbortController()
    caller.abort()
    const dispatch = vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(() => iterable(async function* () { yield done }))
    await expect(chunks(adapter().stream({ ...options, signal: caller.signal }))).rejects.toMatchObject({ code: 'ABORTED' })
    expect(dispatch).not.toHaveBeenCalled()
    const current = new AbortController()
    dispatch.mockImplementation(() => iterable(async function* () {
      captureFailureReporter()(quota)
      current.abort()
      yield { type: 'finish', reason: { kind: 'error', failure: new LlmError('Watchdog', 'TIMEOUT').failure } }
    }))
    const finish = terminal(await chunks(adapter().stream({ ...options, signal: current.signal })))
    expect(finish.reason.kind).toBe('aborted')
  })

  it('does not reclassify teardown errors as retryable failures', async () => {
    vi.spyOn(PiAiAdapter.prototype, 'stream').mockImplementation(() => iterable(async function* () {
      try { yield { type: 'text-delta', index: 0, text: 'partial' } }
      finally { captureFailureReporter()(quota); throw new Error('Cleanup defect') }
    }))
    const iterator = adapter().stream(options)[Symbol.asyncIterator]()
    await iterator.next()
    await expect(iterator.return!()).rejects.toThrow('Cleanup defect')
  })

  it('accepts official optional policy schema, rejects unknown fields at resolution, preserves default codes', async () => {
    const defaults = Config({})
    expect(resolveRetryPolicy(defaults.retryPolicy, 'fixture')).toEqual(resolveRetryPolicy(undefined, 'fixture'))
    const configured = Config({ retryPolicy: { mode: 'normal', maxRetries: 9,
      backoff: { initialDelayMs: 5000, maxDelayMs: 1200000, jitterRatio: 0.1 } } })
    const policy = resolveRetryPolicy(configured.retryPolicy, 'fixture')
    expect(policy).toMatchObject({ mode: 'normal', maxRetries: 9, initialDelayMs: 5000, maxDelayMs: 1200000 })
    expect(policy.mode === 'normal' && policy.retryableCodes.some(code => code === 'QUOTA' || code === 'QUOTA_EXCEEDED')).toBe(false)
    const ctx = new Context()
    try {
      expect(() => apply(ctx, { retryPolicy: { mode: 'normal', unknown: true } } as never)).toThrow('unknown key')
    } finally { await ctx.fiber.dispose() }
  })
})
