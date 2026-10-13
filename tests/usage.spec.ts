import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { AntiGravityUsageService, MAX_USAGE_BODY_BYTES, registerUsageCommand, USAGE_DEADLINE_MS, USAGE_TTL_MS } from '../src/usage.ts'

const credential = { type: 'oauth' as const, access: 'fixture-access-private', refresh: 'fixture-refresh-private', expires: 9e12, projectId: 'fixture-project-private' }
const payload = { models: { 'claude-fixture': { displayName: 'Claude fixture', quotaInfo: { remainingFraction: 0, resetTime: '2026-10-14T00:00:00Z' } } } }
const contexts: Context[] = []
function setup(resolve = vi.fn(async () => credential)) {
  const ctx = new Context()
  contexts.push(ctx)
  return { ctx, resolve, service: new AntiGravityUsageService(ctx, { resolveCredential: resolve }) }
}
function response() { return new Response(JSON.stringify(payload)) }
function deferred<T>() { return Promise.withResolvers<T>() }

afterEach(async () => {
  for (const ctx of contexts.splice(0)) await ctx.fiber.dispose()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('on-demand Anti Gravity usage', () => {
  it('does nothing on registration; caches successful detached snapshots, force refreshes and expires TTL', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(init.redirect).toBe('error')
      return response()
    })
    vi.stubGlobal('fetch', fetch)
    const { service, resolve } = setup()
    expect(resolve).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
    const first = await service.snapshot()
    expect(first.rows[0].remainingFraction).toBe(0)
    expect(first.rows[0].window).toBe('unknown')
    expect(Object.isFrozen(first)).toBe(true)
    expect(await service.snapshot()).toBe(first)
    expect(fetch).toHaveBeenCalledTimes(1)
    await service.snapshot({ refresh: true })
    expect(fetch).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(USAGE_TTL_MS)
    await service.snapshot()
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(fetch.mock.calls.every(([url]) => String(url).endsWith(':fetchAvailableModels'))).toBe(true)
    expect(JSON.stringify(first)).not.toContain('private')
  })

  it('shares one flight; cancelling one waiter does not abort the other', async () => {
    const held = deferred<Response>()
    let transportSignal: AbortSignal | undefined
    const fetch = vi.fn((_url, init) => { transportSignal = init.signal; return held.promise })
    vi.stubGlobal('fetch', fetch)
    const { service } = setup()
    const a = new AbortController()
    const first = service.snapshot({ signal: a.signal })
    const second = service.snapshot({ refresh: true })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    a.abort('private-abort-reason')
    await expect(first).rejects.toThrow('usage request cancelled')
    expect(transportSignal?.aborted).toBe(false)
    held.resolve(response())
    expect((await second).status).toBe('available')
  })

  it('aborts transport after all waiters cancel; pre-abort resolves no credential', async () => {
    let transportSignal: AbortSignal | undefined
    const fetch = vi.fn((_url, init) => { transportSignal = init.signal; return new Promise<Response>(() => {}) })
    vi.stubGlobal('fetch', fetch)
    const { service, resolve } = setup()
    const a = new AbortController()
    a.abort()
    await expect(service.snapshot({ signal: a.signal })).rejects.toThrow('cancelled')
    expect(resolve).not.toHaveBeenCalled()
    const b = new AbortController()
    const request = service.snapshot({ signal: b.signal })
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    b.abort()
    await expect(request).rejects.toThrow('cancelled')
    expect(transportSignal?.aborted).toBe(true)
  })

  it.each(['credential', 'fetch', 'body'])('bounds hanging %s by the total deadline', async (stage) => {
    vi.useFakeTimers()
    const fetch = vi.fn(async () => stage === 'fetch' ? new Promise<Response>(() => {})
      : new Response(new ReadableStream({ start() {} })))
    vi.stubGlobal('fetch', fetch)
    const resolve = stage === 'credential' ? vi.fn(() => new Promise<typeof credential>(() => {})) : vi.fn(async () => credential)
    const { service } = setup(resolve)
    const request = service.snapshot()
    await vi.advanceTimersByTimeAsync(USAGE_DEADLINE_MS)
    expect((await request).error).toBe('timeout')
    if (stage === 'credential') expect(fetch).not.toHaveBeenCalled()
  })

  it('account invalidation prevents late cache publication and never automatically retries', async () => {
    const held = deferred<Response>()
    const fetch = vi.fn().mockImplementationOnce(() => held.promise).mockImplementation(async () => response())
    vi.stubGlobal('fetch', fetch)
    const { service } = setup()
    const request = service.snapshot()
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1))
    service.invalidate()
    held.resolve(response())
    expect((await request).status).toBe('unavailable')
    expect(fetch).toHaveBeenCalledTimes(1)
    expect((await service.snapshot()).status).toBe('available')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('own OAuth reference refresh fails closed once without an abort/retry loop', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response()))
    const { service, resolve } = setup()
    resolve.mockImplementationOnce(async () => { service.invalidate(); return credential })
    expect((await service.snapshot()).status).toBe('unavailable')
    expect(fetch).not.toHaveBeenCalled()
    expect((await service.snapshot()).status).toBe('available')
    expect(resolve).toHaveBeenCalledTimes(2)
  })

  it('disposal aborts pending calls and suppresses subsequent credential resolution', async () => {
    const { ctx, service, resolve } = setup(vi.fn(() => new Promise<typeof credential>(() => {})))
    const request = service.snapshot()
    await Promise.resolve()
    await ctx.fiber.dispose()
    expect((await request).status).toBe('unavailable')
    expect((await service.snapshot()).status).toBe('unavailable')
    expect(resolve).toHaveBeenCalledTimes(1)
  })

  it.each([[401, 'auth'], [403, 'auth'], [429, 'rate-limit'], [400, 'unavailable']])('sanitizes HTTP %s without quota/auth fallback', async (status, error) => {
    const fetch = vi.fn(async () => new Response('private-error-body', { status: status as number }))
    vi.stubGlobal('fetch', fetch)
    const { service } = setup()
    const result = await service.snapshot()
    expect(result.error).toBe(error)
    expect(JSON.stringify(result)).not.toContain('private')
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it('falls back only for unavailable endpoint, preserving bounds across endpoints', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockImplementation(async () => response())
    vi.stubGlobal('fetch', fetch)
    const { service } = setup()
    expect((await service.snapshot()).status).toBe('available')
    expect(fetch).toHaveBeenCalledTimes(2)
  })

  it('does not serve an older cached observation after an explicit refresh fails', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(response()).mockResolvedValueOnce(new Response('', { status: 429 })).mockImplementation(async () => response())
    vi.stubGlobal('fetch', fetch)
    const { service } = setup()
    await service.snapshot()
    expect((await service.snapshot({ refresh: true })).error).toBe('rate-limit')
    expect((await service.snapshot()).status).toBe('available')
    expect(fetch).toHaveBeenCalledTimes(3)
  })

  it('sanitizes thrown transport errors and malformed UTF-8', async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new Error('private-secret-error')).mockResolvedValueOnce(new Response(new Uint8Array([0xff])))
    vi.stubGlobal('fetch', fetch)
    const { service } = setup()
    const transport = await service.snapshot()
    expect(transport.error).toBe('unavailable')
    expect(JSON.stringify(transport)).not.toContain('private')
    expect((await service.snapshot()).error).toBe('schema')
  })

  it.each(['length', 'stream', 'json', 'schema'])('rejects bounded/invalid %s response without leaking body', async (kind) => {
    const fetch = vi.fn(async () => kind === 'length'
      ? new Response('private', { headers: { 'content-length': String(MAX_USAGE_BODY_BYTES + 1) } })
      : kind === 'stream' ? new Response('x'.repeat(MAX_USAGE_BODY_BYTES + 1))
      : new Response(kind === 'json' ? 'private-invalid-json' : '{}'))
    vi.stubGlobal('fetch', fetch)
    const { service } = setup()
    const result = await service.snapshot()
    expect(result.error).toBe('schema')
    expect(JSON.stringify(result)).not.toContain('private')
  })

  it.each([['AUTH', 'auth'], ['MISSING_CREDENTIAL', 'not-connected'], ['unexpected', 'unavailable']])('sanitizes credential %s failures', async (code, error) => {
    const fetch = vi.fn()
    vi.stubGlobal('fetch', fetch)
    const { service } = setup(vi.fn(async () => { throw Object.assign(new Error('private-secret'), { code }) }))
    const result = await service.snapshot()
    expect(result.error).toBe(error)
    expect(JSON.stringify(result)).not.toContain('private')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('official usage command registry', () => {
  it('optional commands can mount later; executes log-only and unregisters on provider disposal', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => response()))
    const ctx = new Context()
    contexts.push(ctx)
    const owner = await ctx.plugin((child: Context) => {
      const service = new AntiGravityUsageService(child, { resolveCredential: async () => credential })
      registerUsageCommand(child, service)
    })
    await ctx.plugin(CommandRuntime)
    const events: Array<{ type: string, data: unknown }> = []
    const agent = { session: { append: (type: string, data: unknown) => events.push({ type, data }) } } as unknown as Agent
    await vi.waitFor(() => expect(ctx.commands.find(agent, 'antigravity-usage')).toBeDefined())
    const invoke = (line: string) => ctx.commands.execute(agent, line, [], new AbortController().signal)
    expect((await invoke('/antigravity-usage --wrong'))?.result.kind).toBe('error')
    expect(fetch).not.toHaveBeenCalled()
    const result = await invoke('/antigravity-usage --refresh')
    expect(result?.result.kind).toBe('success')
    expect(result?.result.text).toContain('0%')
    expect(JSON.stringify(events)).not.toContain('private')
    expect(events).toHaveLength(4)
    expect(events.every(e => ['command/run', 'command/done'].includes(e.type))).toBe(true)
    await owner.dispose()
    expect(ctx.commands.find(agent, 'antigravity-usage')).toBeUndefined()
    expect(ctx.get('antiGravityUsage')).toBeUndefined()
  })
})
