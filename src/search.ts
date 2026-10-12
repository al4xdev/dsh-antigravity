/** Opt-in native Google Search using the existing Cloud Code Assist OAuth route. */
import type { WebSearchProvider, WebSearchRequest, WebSearchResult, WebSearchSource } from '@deepseek-ai/dsh-web'
import { antiGravityHeaders } from './auth.ts'
import type { AntiGravityCredentialManager } from './credential.ts'
import { ENDPOINTS } from './models.ts'

export const DEFAULT_SEARCH_MODEL = 'gemini-3.8-flash-low'
const TIMEOUT_MS = 60_000
const MAX_STREAM_BYTES = 2 * 1024 * 1024
const MAX_CONTENT_CHARS = 128 * 1024
const MAX_SOURCES = 64

/** Only errors created here may cross the boundary without message sanitization. */
class SearchError extends Error {}

function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown> : undefined
}

// Race operations too: credential refresh and test/custom transports need not honor signals.
function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = (): void => reject(new SearchError('Anti Gravity search cancelled or timed out'))
    if (signal.aborted) { abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    operation.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** No model fallback: unsupported search models fail rather than silently changing routes. */
export class AntiGravitySearchProvider implements WebSearchProvider {
  readonly id = 'google-antigravity'

  constructor(
    private readonly credentials: Pick<AntiGravityCredentialManager, 'resolveCredential'>,
    private readonly model = DEFAULT_SEARCH_MODEL,
  ) {
    if (model.trim().length === 0) throw new Error('Anti Gravity searchModel must not be empty')
  }

  // Registration itself is opt-in. Credential validity is resolved asynchronously per request.
  available(): boolean { return true }

  async search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult> {
    if (request.query.trim().length === 0 || request.query.length > 8192) {
      throw new Error('Anti Gravity search query must contain 1 to 8192 characters')
    }
    if (request.maxResults !== undefined && (!Number.isSafeInteger(request.maxResults) || request.maxResults < 0)) {
      throw new Error('Anti Gravity search maxResults must be a nonnegative integer')
    }
    const controller = new AbortController()
    const abort = (): void => controller.abort()
    signal?.addEventListener('abort', abort, { once: true })
    if (signal?.aborted) abort()
    const timer = setTimeout(abort, TIMEOUT_MS)
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    try {
      controller.signal.throwIfAborted()
      const credential = await abortable(this.credentials.resolveCredential(), controller.signal)
      const response = await abortable(fetch(`${ENDPOINTS[0]}/v1internal:streamGenerateContent?alt=sse`, {
        method: 'POST',
        redirect: 'error',
        headers: { ...antiGravityHeaders(credential.access), accept: 'text/event-stream' },
        signal: controller.signal,
        body: JSON.stringify({
          project: credential.projectId,
          model: this.model,
          request: {
            contents: [{ role: 'user', parts: [{ text: `Search the web for the following query and answer using search grounding:\n${request.query}` }] }],
            tools: [{ googleSearch: {} }],
            generationConfig: { maxOutputTokens: 8192 },
          },
          requestType: 'agent',
          userAgent: 'antigravity',
          requestId: `agent-${crypto.randomUUID()}`,
        }),
      }), controller.signal)
      if (!response.ok) {
        void response.body?.cancel().catch(() => {})
        throw new SearchError(`Anti Gravity search failed with HTTP ${response.status}`)
      }
      if (response.body === null) throw new SearchError('Anti Gravity search returned no response stream')
      reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let eventData: string[] = []
      let bytes = 0
      let content = ''
      let grounded = false
      let finishReason: unknown
      let truncated = false
      const sources: WebSearchSource[] = []
      const seen = new Set<string>()
      const sourceLimit = Math.min(request.maxResults ?? MAX_SOURCES, MAX_SOURCES)
      const consume = (): void => {
        const data = eventData.join('\n')
        eventData = []
        if (!data || data === '[DONE]') return
        let parsed: unknown
        try { parsed = JSON.parse(data) } catch { throw new SearchError('Anti Gravity search returned invalid SSE JSON') }
        const envelope = record(parsed)
        if (envelope?.error !== undefined) throw new SearchError('Anti Gravity search returned a stream error')
        const payload = record(envelope?.response)
        if (payload?.error !== undefined) throw new SearchError('Anti Gravity search returned a stream error')
        const candidate = record(Array.isArray(payload?.candidates) ? payload.candidates[0] : undefined)
        if (!candidate) return
        const parts = record(candidate.content)?.parts
        if (Array.isArray(parts)) {
          for (const value of parts) {
            const part = record(value)
            if (typeof part?.text !== 'string' || part.thought === true) continue
            const remaining = MAX_CONTENT_CHARS - content.length
            content += part.text.slice(0, remaining)
            if (part.text.length > remaining) truncated = true
          }
        }
        if (candidate.finishReason !== undefined) finishReason = candidate.finishReason
        const metadata = record(candidate.groundingMetadata)
        const queries = metadata?.webSearchQueries
        if (Array.isArray(queries) && queries.some(query => typeof query === 'string' && query.trim().length > 0)) grounded = true
        const chunks = metadata?.groundingChunks
        if (!Array.isArray(chunks)) return
        for (const value of chunks) {
          const web = record(record(value)?.web)
          if (typeof web?.uri !== 'string' || web.uri.length > 8192) continue
          let url: URL
          try { url = new URL(web.uri) } catch { continue }
          if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) continue
          grounded = true
          if (seen.has(url.href)) continue
          seen.add(url.href)
          if (sources.length >= sourceLimit) { truncated = true; continue }
          sources.push({ url: url.href, ...typeof web.title === 'string' ? { title: web.title.slice(0, 2048) } : {} })
        }
      }
      const line = (value: string): void => {
        if (value === '') consume()
        else if (value === 'data' || value.startsWith('data:')) {
          const data = value === 'data' ? '' : value.slice(5)
          eventData.push(data.startsWith(' ') ? data.slice(1) : data)
        }
      }
      // Preserve a trailing CR until the next read, so split CRLF and bare CR both work.
      const drain = (final: boolean): void => {
        let start = 0
        for (let i = 0; i < buffer.length; i++) {
          const char = buffer[i]
          if (char !== '\n' && char !== '\r') continue
          if (char === '\r' && i === buffer.length - 1 && !final) break
          line(buffer.slice(start, i))
          if (char === '\r' && buffer[i + 1] === '\n') i++
          start = i + 1
        }
        buffer = buffer.slice(start)
        if (final) {
          if (buffer.length > 0) line(buffer)
          buffer = ''
          consume()
        }
      }
      for (;;) {
        const item = await abortable(reader.read(), controller.signal)
        if (item.done) break
        bytes += item.value.byteLength
        if (bytes > MAX_STREAM_BYTES) throw new SearchError('Anti Gravity search stream exceeded size limit')
        buffer += decoder.decode(item.value, { stream: true })
        drain(false)
      }
      buffer += decoder.decode()
      drain(true)
      controller.signal.throwIfAborted()
      if (finishReason !== 'STOP') throw new SearchError('Anti Gravity search did not finish with STOP')
      if (!grounded) throw new SearchError('Anti Gravity search returned no search grounding')
      return { content, sources, truncated }
    } catch (error) {
      // Never expose backend bodies, credential errors, or transport messages containing secrets.
      if (controller.signal.aborted) throw new Error('Anti Gravity search cancelled or timed out')
      if (error instanceof SearchError) throw error
      throw new Error('Anti Gravity search failed')
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
      controller.abort()
      if (reader) {
        void reader.cancel().catch(() => {})
        // A custom stream can reject lock release during a pending read; cleanup must not mask errors.
        try { reader.releaseLock() } catch {}
      }
    }
  }
}
