/** Shared, bounded Cloud Code Assist inference transport for Claude and Gemini. */
import { calculateCost, createAssistantMessageEventStream } from '@earendil-works/pi-ai'
import type { AssistantMessageEventStream, AssistantMessage, Context, Model, ProviderStreams, SimpleStreamOptions, StreamOptions, TextContent, ThinkingContent, ToolCall } from '@earendil-works/pi-ai'
import { convertMessages, convertTools, isThinkingPart, mapStopReasonString, retainThoughtSignature } from '@earendil-works/pi-ai/api/google-shared'
import { getCurrentSystemPrompt, getCurrentTools, normalizeContext } from '@earendil-works/pi-ai/utils/transcript'
import { MAX_TIMER_DELAY_MS } from '@deepseek-ai/dsh-timeout'
import { antiGravityHeaders } from './auth.ts'
import { ENDPOINTS } from './models.ts'
import type { AntiGravityApi } from './models.ts'
import { AntiGravityFailure, parseAntiGravityFailure } from './failure.ts'
import type { AntiGravityTerminalReason } from './failure.ts'
import { captureFailureReporter } from './failure-bridge.ts'

export const MAX_SSE_EVENT_BYTES = 1024 * 1024
export const MAX_INFERENCE_STREAM_BYTES = 16 * 1024 * 1024
export const MAX_INFERENCE_BLOCKS = 4096
export const MAX_ERROR_BODY_BYTES = 64 * 1024
export const DEFAULT_INFERENCE_TIMEOUT_MS = 600_000
interface AntiGravityAuth { token: string; projectId: string }
function record(value: unknown): Record<string, unknown> | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
function protocol(): AntiGravityFailure { return new AntiGravityFailure('PI_AI_ERROR', 'protocol', { phase: 'sse' }) }
function aborted(caller?: AbortSignal, timedOut = false): AntiGravityFailure {
  return new AntiGravityFailure(caller?.aborted || !timedOut ? 'ABORTED' : 'TIMEOUT', caller?.aborted || !timedOut ? 'aborted' : 'timeout', { phase: caller?.aborted || !timedOut ? 'cancelled' : 'timeout' })
}
function checkAbort(signal: AbortSignal): void { if (signal.aborted) throw aborted() }
/** Race even hooks/transports that ignore cancellation, handling late rejections. */
function abortable<T>(operation: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) { void operation.catch(() => {}); return Promise.reject(aborted()) }
  return new Promise((resolve, reject) => {
    const abort = (): void => { signal.removeEventListener('abort', abort); reject(aborted()) }
    signal.addEventListener('abort', abort, { once: true })
    operation.then(value => { signal.removeEventListener('abort', abort); resolve(value) }, error => { signal.removeEventListener('abort', abort); reject(error) })
  })
}
async function hook<T>(callback: () => T | Promise<T>, signal: AbortSignal, phase: 'payload-hook' | 'response-hook'): Promise<T> {
  try { return await abortable(Promise.resolve().then(callback), signal) } catch (error) {
    if (signal.aborted) throw error
    // Business callback exceptions are not retryable transport failures.
    throw new AntiGravityFailure('INVALID_REQUEST', 'policy', { phase })
  }
}
function parseAuth(value: string | undefined): AntiGravityAuth {
  let parsed: unknown
  try { parsed = value === undefined ? undefined : JSON.parse(value) } catch { throw new AntiGravityFailure('AUTH', 'auth') }
  const auth = record(parsed)
  if (typeof auth?.token !== 'string' || !auth.token || typeof auth.projectId !== 'string' || !auth.projectId) throw new AntiGravityFailure('AUTH', 'auth')
  return { token: auth.token, projectId: auth.projectId }
}
function defaultThinkingConfig(id: string): Record<string, unknown> | undefined {
  if (id.startsWith('gemini-4-argon-') || id.startsWith('claude-opus-5-5-') || id.startsWith('claude-sonnet-5-5-')) {
    const level = /-(low|medium|high)$/.exec(id)?.[1]?.toUpperCase()
    if (level) return { includeThoughts: true, thinkingLevel: level }
  }
  if (id === 'gemini-3.8-flash-low') return { includeThoughts: true, thinkingBudget: 1000 }
  if (id === 'gemini-3.8-flash-medium') return { includeThoughts: true, thinkingBudget: 4000 }
  if (id === 'gemini-3.8-flash-high') return { includeThoughts: true, thinkingBudget: -1 }
  return undefined
}
function cleanToolId(id: string): string {
  if (/^[a-zA-Z0-9_-]{1,64}$/.test(id)) return id
  return id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
}

function sanitizeClaudeContents(contents: Array<{ role: string, parts?: Array<Record<string, unknown>> }>): Array<{ role: string, parts?: Array<Record<string, unknown>> }> {
  const sanitizedEntries: Array<{ role: string, parts: Array<Record<string, unknown>> }> = []
  for (const entry of contents) {
    if (!Array.isArray(entry.parts) || entry.parts.length === 0) continue
    const parts: Array<Record<string, unknown>> = []
    for (const part of entry.parts) {
      if (part.functionCall !== undefined) {
        const fc = part.functionCall as Record<string, unknown>
        const id = typeof fc.id === 'string' ? cleanToolId(fc.id) : fc.id
        parts.push({ ...part, functionCall: { ...fc, ...id === undefined ? {} : { id } } })
      } else if (part.functionResponse !== undefined) {
        const fr = part.functionResponse as Record<string, unknown>
        const id = typeof fr.id === 'string' ? cleanToolId(fr.id) : fr.id
        parts.push({ ...part, functionResponse: { ...fr, ...id === undefined ? {} : { id } } })
      } else if (part.thought === true) {
        if (typeof part.thoughtSignature === 'string' && part.thoughtSignature.length > 0) {
          parts.push(part)
        } else if (typeof part.text === 'string' && part.text.trim().length > 0) {
          parts.push({ text: part.text })
        }
      } else if (typeof part.text === 'string' && part.text.trim().length > 0) {
        parts.push(part)
      } else if (part.inlineData !== undefined) {
        parts.push(part)
      }
    }
    if (parts.length === 0) continue
    const prev = sanitizedEntries[sanitizedEntries.length - 1]
    if (prev && prev.role === entry.role) {
      prev.parts.push(...parts)
    } else {
      sanitizedEntries.push({ role: entry.role, parts })
    }
  }

  // Claude does not support assistant message prefill: the conversation must end with a user turn
  while (sanitizedEntries.length > 0 && sanitizedEntries[sanitizedEntries.length - 1].role === 'model') {
    sanitizedEntries.pop()
  }

  return sanitizedEntries.length === 0 ? [{ role: 'user', parts: [{ text: 'continue' }] }] : sanitizedEntries
}

function requestBody(model: Model<AntiGravityApi>, context: Context, options: StreamOptions, projectId: string): unknown {
  const transcript = normalizeContext(context)
  const system = getCurrentSystemPrompt(transcript.messages)
  const tools = getCurrentTools(transcript.messages)
  const rawContents = convertMessages(model as unknown as Model<'google-generative-ai'>, transcript)
  const contents = model.id.startsWith('claude-') ? sanitizeClaudeContents(rawContents) : rawContents
  const request: Record<string, unknown> = { contents, ...options.sessionId === undefined ? {} : { sessionId: options.sessionId } }
  if (system) request.systemInstruction = { role: 'user', parts: [{ text: system }] }
  const generationConfig: Record<string, unknown> = {}
  if (options.temperature !== undefined) generationConfig.temperature = options.temperature
  if (options.maxTokens !== undefined) generationConfig.maxOutputTokens = options.maxTokens
  const thinkingConfig = defaultThinkingConfig(model.id)
  if (thinkingConfig !== undefined) generationConfig.thinkingConfig = thinkingConfig
  if (tools.length) {
    const isLegacyClaude = model.id.startsWith('claude-sonnet-4-') || model.id.startsWith('claude-opus-4-')
    request.tools = convertTools(tools, isLegacyClaude)
  }
  return { project: projectId, model: model.id, request, requestType: 'agent', userAgent: 'antigravity', requestId: `agent-${crypto.randomUUID()}`, enabledCreditTypes: [] }
}
/** Guard after hooks: no credit opt-in, account substitution or route substitution. */
function guardedPayload(payload: unknown, requestedModelId: string, projectId: string, options: StreamOptions): unknown {
  const body = record(payload), request = record(body?.request)
  if (!body || !request || body.model !== requestedModelId || body.project !== projectId || body.requestType !== 'agent' || body.userAgent !== 'antigravity') throw new AntiGravityFailure('INVALID_REQUEST', 'policy')
  if (body.enabledCreditTypes !== undefined && (!Array.isArray(body.enabledCreditTypes) || body.enabledCreditTypes.length)) throw new AntiGravityFailure('INVALID_REQUEST', 'billing')
  // Inspect transport knobs, not model-visible messages/tool-schema property names.
  for (const object of [body, request, record(request.generationConfig), options as unknown as Record<string, unknown>]) {
    if (object) for (const key of Object.keys(object)) {
      if (/credit|overage/i.test(key) && !(object === body && key === 'enabledCreditTypes')) throw new AntiGravityFailure('INVALID_REQUEST', 'billing')
    }
  }
  return { ...body, enabledCreditTypes: [] }
}
async function errorPayload(response: Response, signal: AbortSignal): Promise<unknown> {
  if (response.body === null) return undefined
  const reader = response.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true })
  let text = '', bytes = 0
  try {
    const length = response.headers.get('content-length')
    if (length !== null && /^\d+$/.test(length) && Number(length) > MAX_ERROR_BODY_BYTES) return undefined
    while (true) {
      const chunk = await abortable(reader.read(), signal)
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_ERROR_BODY_BYTES) return undefined
      text += decoder.decode(chunk.value, { stream: true })
    }
    text += decoder.decode()
    try { return JSON.parse(text) as unknown } catch { return undefined }
  } catch (error) { if (signal.aborted) throw error; return undefined } finally {
    void reader.cancel().catch(() => {})
    try { reader.releaseLock() } catch {}
  }
}
async function openResponse(model: Model<AntiGravityApi>, context: Context, options: StreamOptions, auth: AntiGravityAuth, signal: AbortSignal): Promise<Response> {
  checkAbort(signal)
  const requestedModelId = model.id
  let payload = requestBody(model, context, options, auth.projectId)
  const replacement = await hook(() => options.onPayload?.(payload, model), signal, 'payload-hook')
  checkAbort(signal)
  if (replacement !== undefined) payload = replacement
  // Canonicalize hook objects and revalidate serialized values: getters/toJSON
  // must not opt into credits or replace the route after the first guard.
  const canonical: unknown = JSON.parse(JSON.stringify(guardedPayload(payload, requestedModelId, auth.projectId, options)))
  const body = JSON.stringify(guardedPayload(canonical, requestedModelId, auth.projectId, options))
  for (let index = 0; index < ENDPOINTS.length; index++) {
    checkAbort(signal)
    const headers = { ...Object.fromEntries(Object.entries(options.headers ?? {}).filter((entry): entry is [string, string] => entry[1] !== null)), ...antiGravityHeaders(auth.token), accept: 'text/event-stream', ...requestedModelId.startsWith('claude-') ? { 'anthropic-beta': 'interleaved-thinking-2025-05-14' } : {} }
    let response: Response
    try {
      response = await abortable(fetch(`${ENDPOINTS[index]}/v1internal:streamGenerateContent?alt=sse`, { method: 'POST', headers, body, signal, redirect: 'error' }).then(value => {
        if (signal.aborted) void value.body?.cancel().catch(() => {})
        return value
      }), signal)
    } catch (error) { if (signal.aborted) throw error; throw new AntiGravityFailure('TRANSPORT', 'transport') }
    try {
      checkAbort(signal)
      await hook(() => options.onResponse?.({ status: response.status, headers: Object.fromEntries(response.headers) }, model), signal, 'response-hook')
      checkAbort(signal)
      if (response.ok) return response
      const payload = await errorPayload(response, signal)
      checkAbort(signal)
      if (response.status === 404 && index + 1 < ENDPOINTS.length) continue
      throw parseAntiGravityFailure(response.status, payload, response.headers)
    } catch (error) { void response.body?.cancel().catch(() => {}); throw error }
  }
  throw new AntiGravityFailure('SERVER', 'server')
}

/** Native event stream; iterator early-return also cancels its producer and settles result(). */
export function streamAntiGravity(model: Model<AntiGravityApi>, context: Context, options: StreamOptions = {}): AssistantMessageEventStream {
  const stream = createAssistantMessageEventStream(), reporter = captureFailureReporter()
  const owned = new AbortController(), deadline = new AbortController()
  const signal = AbortSignal.any([owned.signal, deadline.signal, ...options.signal ? [options.signal] : []])
  let settled = false
  const originalIterator = stream[Symbol.asyncIterator].bind(stream)
  stream[Symbol.asyncIterator] = () => {
    const iterator = originalIterator()
    // Abort synchronously, before generator.return() can queue behind a stalled next().
    return {
      next: () => iterator.next(),
      return: async (value?: unknown) => {
        if (!settled) owned.abort()
        return iterator.return ? await iterator.return(value) : { value, done: true }
      },
      throw: async (error?: unknown) => {
        if (!settled) owned.abort()
        if (iterator.throw) return iterator.throw(error)
        throw error
      },
    }
  }
  const output: AssistantMessage = { role: 'assistant', content: [], api: model.api, provider: model.provider, model: model.id,
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, stopReason: 'stop', timestamp: Date.now() }
  void (async () => {
    let timer: ReturnType<typeof setTimeout> | undefined, reader: ReadableStreamDefaultReader<Uint8Array> | undefined
    let closePartial = (): void => {}
    try {
      checkAbort(signal)
      const timeoutMs = options.timeoutMs ?? DEFAULT_INFERENCE_TIMEOUT_MS
      if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || timeoutMs > MAX_TIMER_DELAY_MS) throw new AntiGravityFailure('INVALID_REQUEST', 'policy')
      timer = setTimeout(() => deadline.abort(), timeoutMs)
      const response = await openResponse(model, context, options, parseAuth(options.apiKey), signal)
      checkAbort(signal)
      if (response.body === null) throw new AntiGravityFailure('TRANSPORT', 'transport')
      reader = response.body.getReader()
      const decoder = new TextDecoder('utf-8', { fatal: true }), encoder = new TextEncoder()
      let bytes = 0, buffer = '', bufferBytes = 0, scanOffset = 0, eventData: string[] = [], eventBytes = 0, started = false, terminal: 'STOP' | 'MAX_TOKENS' | undefined, sawDone = false
      const toolIds = new Set<string>()
      let candidateIndex: number | undefined
      let run: { block: TextContent | ThinkingContent, index: number } | undefined
      const closeRun = (): void => {
        if (!run) return
        const { block, index } = run
        run = undefined
        if (block.type === 'thinking') stream.push({ type: 'thinking_end', contentIndex: index, content: block.thinking, partial: output })
        else stream.push({ type: 'text_end', contentIndex: index, content: block.text, partial: output })
      }
      closePartial = closeRun
      const addBlock = (block: TextContent | ThinkingContent | ToolCall): number => {
        if (output.content.length >= MAX_INFERENCE_BLOCKS) throw protocol()
        output.content.push(block)
        if (!started) { started = true; stream.push({ type: 'start', partial: output }) }
        return output.content.length - 1
      }
      const consumePart = (value: unknown, mayContinue: boolean): void => {
        const item = record(value)
        if (!item || (item.thought !== undefined && typeof item.thought !== 'boolean') || (item.thoughtSignature !== undefined && (typeof item.thoughtSignature !== 'string' || item.thoughtSignature.length > MAX_SSE_EVENT_BYTES))) throw protocol()
        const signature = typeof item.thoughtSignature === 'string' ? item.thoughtSignature : undefined
        if ((item.text !== undefined && typeof item.text !== 'string') || (item.text !== undefined && item.functionCall !== undefined)
          || (item.text === undefined && signature === undefined && item.functionCall === undefined)) throw protocol()
        if (typeof item.text === 'string' || (signature !== undefined && item.functionCall === undefined)) {
          const text = typeof item.text === 'string' ? item.text : ''
          const thinking = isThinkingPart(item as { thought?: boolean, thoughtSignature?: string })
          const kind = thinking ? 'thinking' : 'text'
          const existingSignature = run?.block.type === 'thinking' ? run.block.thinkingSignature : run?.block.textSignature
          // Same-type deltas across SSE events belong to the open logical run.
          // Within one parts array, distinct parts remain hard boundaries. A
          // different nonempty signature is another boundary, not a replacement.
          // Signature-only controls need an explicit type to bind to a run.
          const explicitType = item.text !== undefined || typeof item.thought === 'boolean'
          const continuation = mayContinue && explicitType && run?.block.type === kind
            && !(existingSignature && signature && existingSignature !== signature)
          if (!continuation) {
            closeRun()
            const block: TextContent | ThinkingContent = thinking
              ? { type: 'thinking', thinking: '', ...signature === undefined ? {} : { thinkingSignature: signature } }
              : { type: 'text', text: '', ...signature === undefined ? {} : { textSignature: signature } }
            const index = addBlock(block)
            run = { block, index }
            if (block.type === 'thinking') stream.push({ type: 'thinking_start', contentIndex: index, partial: output })
            else stream.push({ type: 'text_start', contentIndex: index, partial: output })
          }
          const { block, index } = run!
          const retain = (existing: string | undefined): string | undefined =>
            existing === undefined && signature === '' ? '' : retainThoughtSignature(existing, signature)
          if (block.type === 'thinking') {
            block.thinking += text
            block.thinkingSignature = retain(block.thinkingSignature)
            if (text) stream.push({ type: 'thinking_delta', contentIndex: index, delta: text, partial: output })
          } else {
            block.text += text
            block.textSignature = retain(block.textSignature)
            if (text) stream.push({ type: 'text_delta', contentIndex: index, delta: text, partial: output })
          }
        }
        if (item.functionCall !== undefined) {
          closeRun()
          const call = record(item.functionCall)
          if (!call || typeof call.name !== 'string' || !call.name || call.name.length > 256 || (call.id !== undefined && (typeof call.id !== 'string' || !call.id || call.id.length > 512)) || (call.args !== undefined && !record(call.args))) throw protocol()
          const id = typeof call.id === 'string' ? call.id : `${call.name}_${crypto.randomUUID()}`
          if (toolIds.has(id)) throw protocol()
          toolIds.add(id)
          const block: ToolCall = { type: 'toolCall', id, name: call.name, arguments: (call.args ?? {}) as ToolCall['arguments'], ...signature === undefined ? {} : { thoughtSignature: signature } }
          const index = addBlock(block)
          stream.push({ type: 'toolcall_start', contentIndex: index, partial: output })
          stream.push({ type: 'toolcall_delta', contentIndex: index, delta: JSON.stringify(block.arguments), partial: output })
          stream.push({ type: 'toolcall_end', contentIndex: index, toolCall: block, partial: output })
        }
      }
      const consume = (value: unknown): void => {
        const envelope = record(value)
        if (!envelope) throw protocol()
        if (envelope.error !== undefined || record(envelope.response)?.error !== undefined) {
          const error = parseAntiGravityFailure(undefined, envelope)
          throw new AntiGravityFailure(error.code, error.failure.reason, { ...error.failure, phase: 'sse-error' })
        }
        const data = record(envelope.response)
        if (!data) throw protocol()
        if (data.responseId !== undefined) {
          if (typeof data.responseId !== 'string' || !data.responseId || data.responseId.length > 512) throw protocol()
          if (output.responseId === undefined) output.responseId = data.responseId
          else if (output.responseId !== data.responseId) throw protocol()
        }
        if (data.candidates !== undefined) {
          if (!Array.isArray(data.candidates) || data.candidates.length > 1) throw protocol()
          const candidate = data.candidates[0] === undefined ? undefined : record(data.candidates[0])
          if (data.candidates[0] !== undefined && !candidate) throw protocol()
          if (candidate) {
            const index = candidate.index === undefined ? 0 : candidate.index
            if (typeof index !== 'number' || !Number.isSafeInteger(index) || index < 0
              || (candidateIndex !== undefined && candidateIndex !== index)) throw protocol()
            candidateIndex = index
          }
          const content = candidate?.content === undefined ? undefined : record(candidate.content)
          if (candidate?.content !== undefined && !content) throw protocol()
          if (content?.role !== undefined && content.role !== 'model') throw protocol()
          const parts = content?.parts
          if (parts !== undefined && !Array.isArray(parts)) throw protocol()
          if (Array.isArray(parts)) {
            if ((terminal !== undefined && parts.length > 0) || parts.length > MAX_INFERENCE_BLOCKS) throw protocol()
            for (let index = 0; index < parts.length; index++) consumePart(parts[index], index === 0)
          }
          // Google may serialize the default enum on intermediate chunks. It is
          // not a terminal and must not replace the required final STOP/MAX_TOKENS.
          if (candidate?.finishReason !== undefined && candidate.finishReason !== '' && candidate.finishReason !== 'FINISH_REASON_UNSPECIFIED') {
            const reason = candidate.finishReason
            if (reason !== 'STOP' && reason !== 'MAX_TOKENS') {
              const knownBlocked: readonly AntiGravityTerminalReason[] = ['SAFETY', 'RECITATION', 'LANGUAGE', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII']
              const terminalReason = typeof reason === 'string' && knownBlocked.includes(reason as AntiGravityTerminalReason) ? reason as AntiGravityTerminalReason : undefined
              const terminalCategory = reason === 'OTHER' ? 'other'
                : reason === 'MALFORMED_FUNCTION_CALL' || reason === 'UNEXPECTED_TOOL_CALL' ? 'malformed-function-call'
                : terminalReason !== undefined ? 'blocked' : 'unknown'
              throw new AntiGravityFailure('INVALID_REQUEST', 'policy', { phase: 'sse-terminal', terminalCategory, terminalReason })
            }
            if (terminal !== undefined && terminal !== reason) throw protocol()
            closeRun()
            terminal = reason; output.rawStopReason = reason; output.stopReason = mapStopReasonString(reason)
          }
        }
        if (data.usageMetadata !== undefined) {
          const usage = record(data.usageMetadata)
          if (!usage) throw protocol()
          const counter = (key: string): number => { const value = usage[key] === undefined ? 0 : usage[key]; if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw protocol(); return value }
          const prompt = counter('promptTokenCount'), cached = counter('cachedContentTokenCount'), candidates = counter('candidatesTokenCount'), thoughts = counter('thoughtsTokenCount'), total = counter('totalTokenCount')
          if (cached > prompt || !Number.isSafeInteger(candidates + thoughts)) throw protocol()
          output.usage = { input: prompt - cached, output: candidates + thoughts, reasoning: thoughts, cacheRead: cached, cacheWrite: 0, totalTokens: total, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }
          if (model.cost) calculateCost(model, output.usage)
        }
      }
      const dispatch = (): void => {
        if (eventData.length === 0) { eventBytes = 0; return }
        const text = eventData.join('\n'); eventData = []; eventBytes = 0
        if (!text) return
        if (text.trim() === '[DONE]') { sawDone = true; return }
        if (sawDone) throw protocol()
        let value: unknown
        try { value = JSON.parse(text) } catch { throw new AntiGravityFailure('TRANSPORT', 'transport') }
        consume(value)
      }
      const line = (value: string): void => {
        if (value === '') { dispatch(); return }
        if (value === 'data' || value.startsWith('data:')) {
          const data = value === 'data' ? '' : value.slice(5).replace(/^ /, '')
          eventBytes += encoder.encode(data).byteLength + 1
          if (eventBytes > MAX_SSE_EVENT_BYTES) throw protocol()
          eventData.push(data)
        }
      }
      const drain = (final: boolean): void => {
        let start = 0
        // Resume at the unscanned suffix: a fragmented long line must not cause quadratic rescans.
        for (let index = scanOffset; index < buffer.length; index++) {
          const char = buffer[index]
          if (char !== '\n' && char !== '\r') continue
          if (char === '\r' && index === buffer.length - 1 && !final) break
          line(buffer.slice(start, index))
          if (char === '\r' && buffer[index + 1] === '\n') index++
          start = index + 1
        }
        bufferBytes -= encoder.encode(buffer.slice(0, start)).byteLength
        buffer = buffer.slice(start)
        scanOffset = buffer.length - (!final && buffer.endsWith('\r') ? 1 : 0)
        if (bufferBytes > MAX_SSE_EVENT_BYTES) throw protocol()
        if (final) { if (buffer) line(buffer); buffer = ''; bufferBytes = 0; scanOffset = 0; dispatch() }
      }
      while (true) {
        checkAbort(signal)
        let chunk: ReadableStreamReadResult<Uint8Array>
        try { chunk = await abortable(reader.read(), signal) } catch (error) {
          if (signal.aborted) throw error
          throw new AntiGravityFailure('TRANSPORT', 'transport')
        }
        checkAbort(signal)
        if (chunk.done) break
        bytes += chunk.value.byteLength
        if (bytes > MAX_INFERENCE_STREAM_BYTES) throw protocol()
        try {
          const decoded = decoder.decode(chunk.value, { stream: true })
          buffer += decoded; bufferBytes += encoder.encode(decoded).byteLength
        } catch { throw protocol() }
        drain(false)
      }
      try { const decoded = decoder.decode(); buffer += decoded; bufferBytes += encoder.encode(decoded).byteLength } catch { throw protocol() }
      drain(true); checkAbort(signal)
      if (terminal === undefined) throw new AntiGravityFailure('TRANSPORT', 'transport')
      if (!output.content.some(block => block.type === 'toolCall' || (block.type === 'text' && block.text.trim()))) throw new AntiGravityFailure('EMPTY_RESPONSE', 'empty')
      if (terminal === 'STOP' && output.content.some(block => block.type === 'toolCall')) output.stopReason = 'toolUse'
      const reason = output.stopReason === 'toolUse' || output.stopReason === 'length' ? output.stopReason : 'stop'
      settled = true; stream.push({ type: 'done', reason, message: output }); stream.end()
    } catch (error) {
      // An error is still a terminal boundary for partial blocks. Closing them
      // preserves the native assembler's failure seam without admitting tools.
      closePartial()
      let failure = error instanceof AntiGravityFailure ? error : new AntiGravityFailure('PI_AI_ERROR', 'protocol')
      if (signal.aborted) failure = aborted(options.signal, deadline.signal.aborted)
      failure = new AntiGravityFailure(failure.code, failure.failure.reason, { ...failure.failure, partial: output.content.length > 0 })
      output.stopReason = failure.code === 'ABORTED' ? 'aborted' : 'error'; output.errorMessage = failure.message
      // Observer failure cannot mask the request's sanitized terminal failure.
      try { reporter(failure.failure) } catch {}
      settled = true; stream.push({ type: 'error', reason: output.stopReason, error: output }); stream.end()
    } finally {
      if (timer !== undefined) clearTimeout(timer)
      owned.abort()
      if (reader) { void reader.cancel().catch(() => {}); try { reader.releaseLock() } catch {} }
    }
  })()
  return stream
}
const streamSimple = (model: Model<AntiGravityApi>, context: Context, options?: SimpleStreamOptions) => streamAntiGravity(model, context, options)
export const antiGravityApi: ProviderStreams = {
  stream: (model, context, options) => streamAntiGravity(model as Model<AntiGravityApi>, context, options),
  streamSimple: (model, context, options) => streamSimple(model as Model<AntiGravityApi>, context, options),
}
