import { Service } from '@deepseek-ai/cordis'
import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type { AntiGravityCredentialManager } from './credential.ts'
import { antiGravityHeaders } from './auth.ts'
import { ENDPOINTS } from './models.ts'
import { formatUsageSnapshot, parseModelQuotaSnapshot, QuotaPayloadError } from './quota.ts'
import type { AntiGravityUsageSnapshot, UsageErrorCode } from './quota.ts'

export const USAGE_TTL_MS = 60_000
export const USAGE_DEADLINE_MS = 10_000
export const MAX_USAGE_BODY_BYTES = 1024 * 1024

interface Flight {
  readonly controller: AbortController
  readonly generation: number
  readonly promise: Promise<AntiGravityUsageSnapshot>
  waiters: number
}

export interface UsageRequest {
  readonly refresh?: boolean
  readonly signal?: AbortSignal
}

declare module '@deepseek-ai/cordis' {
  interface Context { antiGravityUsage: AntiGravityUsageService }
}

function unavailable(error: UsageErrorCode): AntiGravityUsageSnapshot {
  return Object.freeze({
    source: 'fetchAvailableModels', observedAtMs: Date.now(), stale: false,
    status: 'unavailable', rows: Object.freeze([]), truncated: false, error,
  })
}

function cancelled(): Error {
  // Caller abort reasons may contain private data; never reuse their text.
  return new Error('Anti Gravity usage request cancelled')
}

function boundedAwait<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    // A shared OAuth refresh may still reject after we stop waiting for it.
    void operation.catch(() => {})
    return Promise.reject(cancelled())
  }
  return new Promise((resolve, reject) => {
    const abort = (): void => { signal.removeEventListener('abort', abort); reject(cancelled()) }
    signal.addEventListener('abort', abort, { once: true })
    operation.then(value => {
      signal.removeEventListener('abort', abort)
      resolve(value)
    }, (error: unknown) => {
      signal.removeEventListener('abort', abort)
      // The service boundary below maps errors to an allowlisted code, never text.
      reject(error)
    })
  })
}

async function readBody(response: Response, signal: AbortSignal): Promise<unknown> {
  const length = response.headers.get('content-length')
  if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_USAGE_BODY_BYTES) {
    void response.body?.cancel().catch(() => {})
    throw new QuotaPayloadError()
  }
  if (response.body === null) throw new QuotaPayloadError()
  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8', { fatal: true })
  let bytes = 0
  let text = ''
  try {
    while (true) {
      const chunk = await boundedAwait(reader.read(), signal)
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_USAGE_BODY_BYTES) throw new QuotaPayloadError()
      try { text += decoder.decode(chunk.value, { stream: true }) } catch { throw new QuotaPayloadError() }
    }
    try { text += decoder.decode() } catch { throw new QuotaPayloadError() }
    try { return JSON.parse(text) as unknown } catch { throw new QuotaPayloadError() }
  } finally {
    // Do not await an uncooperative stream's cancellation past the total deadline.
    void reader.cancel().catch(() => {})
  }
}

/** On-demand metadata only: no inference, polling, billing or retry policy changes. */
export class AntiGravityUsageService extends Service {
  private cache: AntiGravityUsageSnapshot | undefined
  private flight: Flight | undefined
  private generation = 0
  private disposed = false
  private readonly pending = new Set<Promise<AntiGravityUsageSnapshot>>()

  constructor(ctx: Context, private readonly credentials: Pick<AntiGravityCredentialManager, 'resolveCredential'>) {
    super(ctx, 'antiGravityUsage')
    ctx.effect(() => async () => {
      this.disposed = true
      this.invalidate()
      await Promise.allSettled([...this.pending])
    }, 'llm-pi-ai-antigravity: usage lifecycle')
  }

  /** Invalidate both cached and pending observations when the account reference changes. */
  invalidate(): void {
    this.generation++
    this.cache = undefined
    this.flight?.controller.abort()
    this.flight = undefined
  }

  /** One caller may cancel without cancelling other callers sharing the fetch. */
  async snapshot(request: UsageRequest = {}): Promise<AntiGravityUsageSnapshot> {
    if (request.signal?.aborted) throw cancelled()
    if (this.disposed) return unavailable('unavailable')
    const now = Date.now()
    if (request.refresh) this.cache = undefined
    if (!request.refresh && this.cache !== undefined
      && now >= this.cache.observedAtMs && now - this.cache.observedAtMs < USAGE_TTL_MS) return this.cache
    if (this.flight === undefined) {
      const controller = new AbortController()
      const generation = this.generation
      const flight: Flight = {
        controller, generation, waiters: 0,
        // Publish the flight before credential resolution can synchronously emit an update.
        promise: Promise.resolve().then(() => this.fetchSnapshot(controller.signal)).then(result => {
          // OAuth refresh itself may update the reference. Fail this observation
          // closed without auto-restarting: a later explicit request resolves it afresh.
          if (generation !== this.generation || this.disposed || controller.signal.aborted) return unavailable('unavailable')
          if (result.status === 'available') this.cache = result
          return result
        }).finally(() => {
          this.pending.delete(flight.promise)
          if (this.flight === flight) this.flight = undefined
        }),
      }
      this.flight = flight
      this.pending.add(flight.promise)
    }
    const flight = this.flight
    flight.waiters++
    try {
      return request.signal === undefined ? await flight.promise : await boundedAwait(flight.promise, request.signal)
    } finally {
      flight.waiters--
      if (flight.waiters === 0 && this.flight === flight) {
        this.flight = undefined
        flight.controller.abort()
      }
    }
  }

  private async fetchSnapshot(callerSignal: AbortSignal): Promise<AntiGravityUsageSnapshot> {
    const deadline = new AbortController()
    const timer = setTimeout(() => deadline.abort(), USAGE_DEADLINE_MS)
    const signal = AbortSignal.any([callerSignal, deadline.signal])
    try {
      if (signal.aborted) return unavailable('unavailable')
      let credential
      try {
        credential = await boundedAwait(this.credentials.resolveCredential(), signal)
      } catch (error) {
        if (signal.aborted) return unavailable(deadline.signal.aborted ? 'timeout' : 'unavailable')
        const code = typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
        return unavailable(code === 'AUTH' ? 'auth' : code === 'MISSING_CREDENTIAL' ? 'not-connected' : 'unavailable')
      }
      for (const endpoint of ENDPOINTS) {
        if (signal.aborted) return unavailable(deadline.signal.aborted ? 'timeout' : 'unavailable')
        const response = await boundedAwait(fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
          method: 'POST', headers: antiGravityHeaders(credential.access),
          body: JSON.stringify({ project: credential.projectId }), signal, redirect: 'error',
        }), signal)
        if (response.ok) return parseModelQuotaSnapshot(await readBody(response, signal), Date.now())
        void response.body?.cancel().catch(() => {})
        if (response.status === 401 || response.status === 403) return unavailable('auth')
        if (response.status === 429) return unavailable('rate-limit')
        // Fallback only for missing/unavailable endpoints, never to evade quota or permission.
        if (![404, 500, 502, 503, 504].includes(response.status)) return unavailable('unavailable')
      }
      return unavailable('unavailable')
    } catch (error) {
      if (deadline.signal.aborted) return unavailable('timeout')
      return unavailable(error instanceof QuotaPayloadError ? 'schema' : 'unavailable')
    } finally {
      clearTimeout(timer)
    }
  }
}

/** Reuse the official command registry; no provider-specific Remote/client build is needed. */
export function registerUsageCommand(ctx: Context, usage: AntiGravityUsageService): void {
  ctx.inject(['commands'], (commandContext) => {
    commandContext.commands.register({
      name: 'antigravity-usage', description: 'Show reported Anti Gravity model quota (no inference)',
      input: { hint: '[--refresh]' }, recordInput: false,
      handler: async ({ rawInput, signal }) => {
        const input = rawInput.trim()
        if (input !== '' && input !== '--refresh') {
          return { kind: 'error', text: 'Use /antigravity-usage [--refresh].' }
        }
        const result = await usage.snapshot({ refresh: input === '--refresh', signal })
        return { kind: result.status === 'available' ? 'success' : 'error', text: formatUsageSnapshot(result) }
      },
    })
  })
}
