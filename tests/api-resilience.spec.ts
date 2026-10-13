import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AssistantMessageEvent, StreamOptions, Model } from '@earendil-works/pi-ai'
import { stream as streamGoogle } from '@earendil-works/pi-ai/api/google-generative-ai'
import { convertMessages } from '@earendil-works/pi-ai/api/google-shared'
import { streamAntiGravity, MAX_SSE_EVENT_BYTES, MAX_INFERENCE_STREAM_BYTES, MAX_INFERENCE_BLOCKS, MAX_ERROR_BODY_BYTES } from '../src/api.ts'
import { parseAvailableModels } from '../src/models.ts'
import type { AntiGravityFailureData } from '../src/failure.ts'
const observed = vi.hoisted(() => ({ failures: [] as AntiGravityFailureData[] }))
vi.mock('../src/failure-bridge.ts', () => ({ captureFailureReporter: () => (failure: AntiGravityFailureData) => observed.failures.push(failure) }))
const ids = ['claude-opus-5-5-high', 'gemini-3.8-flash-low']
const models = parseAvailableModels({ models: Object.fromEntries(ids.map(id => [id, { displayName: id }])) })
const context = { messages: [{ role: 'user' as const, content: 'offline fixture', timestamp: 1 }] }
const options: StreamOptions = { apiKey: JSON.stringify({ token: 'fixture-private-token', projectId: 'fixture-private-project' }), maxRetries: 0 }
const event = (parts: unknown[], finishReason?: string, usageMetadata?: unknown) => ({ response: { candidates: [{ content: { parts }, ...finishReason === undefined ? {} : { finishReason } }], ...usageMetadata === undefined ? {} : { usageMetadata } } })
const sse = (value: unknown) => `data: ${JSON.stringify(value)}\n\n`
function response(text: string) { return new Response(text, { headers: { 'content-type': 'text/event-stream' } }) }
function splitResponse(text: string, mode = 'bytes') {
  const bytes = new TextEncoder().encode(text)
  return new Response(new ReadableStream<Uint8Array>({ start(controller) {
    if (mode === 'bytes') for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
    else controller.enqueue(bytes)
    controller.close()
  } }))
}
async function run(model: typeof models[number], text: string, extra: StreamOptions = {}) {
  vi.stubGlobal('fetch', vi.fn(async () => response(text)))
  const events: AssistantMessageEvent[] = []
  const stream = streamAntiGravity(model, context, { ...options, ...extra })
  for await (const item of stream) events.push(item)
  return { events, result: await stream.result() }
}
function failure(code: string, partial?: boolean) {
  expect(observed.failures).toHaveLength(1)
  expect(observed.failures[0].code).toBe(code)
  expect(Object.isFrozen(observed.failures[0])).toBe(true)
  expect(observed.failures[0].quotaWindow).toBe('unknown')
  if (partial !== undefined) expect(observed.failures[0].partial).toBe(partial)
  expect(JSON.stringify(observed.failures)).not.toContain('private')
}
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); observed.failures.length = 0 })

for (const model of models) describe(`shared resilience ${model.id}`, () => {
  it('preserves text, thought, tool and signature-only native boundaries', async () => {
    const { result } = await run(model, sse(event([{ text: 'answer', thoughtSignature: 'YWJj' }, { text: 'reason', thought: true, thoughtSignature: 'ZGVm' }, { text: '', thoughtSignature: 'Z2hp' }, { thoughtSignature: 'amts' }, { functionCall: { id: 'tool-native', name: 'lookup', args: { q: 1 } }, thoughtSignature: 'bW5v' }], 'STOP')))
    expect(result.stopReason).toBe('toolUse')
    expect(result.content).toEqual([{ type: 'text', text: 'answer', textSignature: 'YWJj' }, { type: 'thinking', thinking: 'reason', thinkingSignature: 'ZGVm' }, { type: 'text', text: '', textSignature: 'Z2hp' }, { type: 'text', text: '', textSignature: 'amts' }, { type: 'toolCall', id: 'tool-native', name: 'lookup', arguments: { q: 1 }, thoughtSignature: 'bW5v' }])
    expect(observed.failures).toHaveLength(0)
  })
  it('preserves empty string signature markers without converting them to protocol errors', async () => {
    const { result } = await run(model, sse(event([{ text: 'answer' }, { thoughtSignature: '' }, { text: '', thought: true, thoughtSignature: '' }, { functionCall: { id: 'empty-sig-tool', name: 'tool', args: {} }, thoughtSignature: '' }], 'STOP')))
    expect(result.stopReason).toBe('toolUse')
    expect(result.content[1]).toEqual({ type: 'text', text: '', textSignature: '' })
    expect(result.content[2]).toEqual({ type: 'thinking', thinking: '', thinkingSignature: '' })
    expect(result.content[3]).toMatchObject({ type: 'toolCall', thoughtSignature: '' })
    expect(observed.failures).toHaveLength(0)
  })
  it('signature marker without actionable content fails as EMPTY_RESPONSE', async () => {
    await run(model, sse(event([{ thoughtSignature: '' }], 'STOP'))); failure('EMPTY_RESPONSE', true)
  })
  it('does not merge separately signed same-type parts', async () => {
    const { result } = await run(model, sse(event([{ text: 'a', thoughtSignature: 'YWJj' }, { text: 'b', thoughtSignature: 'ZGVm' }], 'MAX_TOKENS')))
    expect(result.content).toHaveLength(2)
    expect(result.stopReason).toBe('length')
  })
  it.each(['\n', '\r\n', '\r'])('handles fragmented UTF8 and line separator %j', async newline => {
    const text = (': keepalive\nid: ignored\nevent: message\n' + sse(event([{ text: 'Olá 😀' }], 'STOP')) + 'data: [DONE]\n\n').replace(/\n/g, newline)
    vi.stubGlobal('fetch', vi.fn(async () => splitResponse(text)))
    const result = await streamAntiGravity(model, context, options).result()
    expect(result.stopReason).toBe('stop')
    expect(result.content).toEqual([{ type: 'text', text: 'Olá 😀' }])
  })
  it('groups multiline data and flushes final event without newline', async () => {
    const pretty = JSON.stringify(event([{ text: 'final' }], 'STOP'), null, 2).split('\n').map(line => `data: ${line}`).join('\n')
    const { result } = await run(model, pretty)
    expect(result.stopReason).toBe('stop')
  })
  it.each(['FINISH_REASON_UNSPECIFIED', ''])('nonterminal sentinel %j does not reject an otherwise valid native stream', async sentinel => {
    const { result } = await run(model, sse(event([{ text: 'first' }], sentinel, { promptTokenCount: 134, candidatesTokenCount: 3, totalTokenCount: 137 })) + sse(event([{ text: 'second' }], 'STOP')))
    expect(result.stopReason).toBe('stop')
    expect(observed.failures).toHaveLength(0)
  })
  it.each(['FINISH_REASON_UNSPECIFIED', ''])('sentinel %j without a terminal still fails incomplete at EOF', async sentinel => {
    await run(model, sse(event([{ text: 'partial' }], sentinel))); failure('TRANSPORT', true)
  })
  it('retains valid cumulative usage after terminal, without moving token counts', async () => {
    const { result } = await run(model, sse(event([{ text: 'ok' }], 'STOP')) + sse({ response: { usageMetadata: { promptTokenCount: 10, candidatesTokenCount: 3, thoughtsTokenCount: 2, cachedContentTokenCount: 4, totalTokenCount: 15 } } }))
    expect(result.usage).toMatchObject({ input: 6, cacheRead: 4, output: 5, reasoning: 2, totalTokens: 15 })
  })
  it.each([sse(event([{ text: 'partial' }])), sse(event([{ text: 'partial' }])) + 'data: [DONE]\n\n', sse(event([{ text: 'partial' }])) + 'data: {"response":'])('fails incomplete streams, including [DONE] without terminal', async text => {
    const { result } = await run(model, text)
    expect(result.stopReason).toBe('error'); failure('TRANSPORT', true)
  })
  it.each(['STOP', 'MAX_TOKENS'])('rejects thought-only %s as EMPTY_RESPONSE', async reason => {
    await run(model, sse(event([{ text: 'reason', thought: true }], reason))); failure('EMPTY_RESPONSE', true)
  })
  it.each(['SAFETY', 'RECITATION', 'LANGUAGE', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'UNKNOWN', 'OTHER', 'MALFORMED_FUNCTION_CALL', 'private-server-finish-reason'])('never treats %s as success or exposes finishMessage', async reason => {
    await run(model, sse({ response: { candidates: [{ content: { parts: [{ functionCall: { id: 't', name: 'tool', args: {} } }] }, finishReason: reason, finishMessage: 'private-server-reason' }] } })); failure('INVALID_REQUEST', true)
    const blocked = ['SAFETY', 'RECITATION', 'LANGUAGE', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(reason)
    const category = reason === 'OTHER' ? 'other' : reason === 'MALFORMED_FUNCTION_CALL' ? 'malformed-function-call' : blocked ? 'blocked' : 'unknown'
    expect(observed.failures[0]).toMatchObject({ phase: 'sse-terminal', terminalCategory: category })
    expect(observed.failures[0].message).toContain(`[stage=sse-terminal; terminal=${category}]`)
    if (blocked) {
      expect(observed.failures[0].terminalReason).toBe(reason)
      expect(observed.failures[0].message).toContain(`[native-stop=${reason}]`)
    } else {
      expect(observed.failures[0]).not.toHaveProperty('terminalReason')
    }
  })
  it.each(['before', 'after-text', 'after-tool-stop', 'nested'])('rejects structured stream error %s', async variant => {
    const error = { error: { code: 503, message: 'private-backend-message' } }
    const text = variant === 'before' ? sse(error) : variant === 'nested' ? sse({ response: error })
      : (variant === 'after-text' ? sse(event([{ text: 'partial' }])) : sse(event([{ functionCall: { id: 'native', name: 'tool', args: {} } }], 'STOP'))) + sse(error)
    await run(model, text); failure('SERVER', variant.startsWith('after'))
  })
  it.each([[401, 'AUTH'], [403, 'AUTH'], [402, 'INVALID_REQUEST'], [429, 'RATE_LIMIT'], [503, 'SERVER']])('does not fall back HTTP %s and reports sanitized hint', async (status, code) => {
    const fetch = vi.fn(async () => new Response('{"error":{"message":"private-quota-exhausted"}}', { status: status as number, headers: { 'retry-after': '120' } }))
    vi.stubGlobal('fetch', fetch)
    await streamAntiGravity(model, context, options).result()
    expect(fetch).toHaveBeenCalledTimes(1); failure(code as string, false)
    expect(observed.failures[0].providerRetryAfterMs).toBe(120000)
  })
  it('falls back only 404 and keeps identical guarded payload', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(new Response('', { status: 404 })).mockResolvedValueOnce(response(sse(event([{ text: 'ok' }], 'STOP'))))
    vi.stubGlobal('fetch', fetch)
    expect((await streamAntiGravity(model, context, options).result()).stopReason).toBe('stop')
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[0][1].body).toBe(fetch.mock.calls[1][1].body)
  })
  it('HTTP structured quota is permanent and does not guess a 5h window', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'QUOTA_EXCEEDED' }] } }), { status: 429 })))
    await streamAntiGravity(model, context, options).result(); failure('QUOTA_EXCEEDED', false)
  })
  it('emits exact route, explicit no-credits and family header after a benign hook', async () => {
    const fetch = vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body)
      expect(body.model).toBe(model.id); expect(body.enabledCreditTypes).toEqual([])
      expect(init.redirect).toBe('error')
      expect(init.headers['anthropic-beta']).toBe(model.id.startsWith('claude') ? 'interleaved-thinking-2025-05-14' : undefined)
      return response(sse(event([{ text: 'ok' }], 'STOP')))
    })
    vi.stubGlobal('fetch', fetch)
    const result = await streamAntiGravity(model, context, { ...options, onPayload: payload => ({ ...payload as object, harmless: 'fixture' }) }).result()
    expect(result.stopReason).toBe('stop')
  })
  it.each([['enabledCreditTypes', ['PAID']], ['enabledCreditTypes', 'malformed'], ['model', 'different-model'], ['project', 'other-project'], ['useCredits', true]])('rejects post-hook override %s before HTTP', async (key, value) => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await streamAntiGravity(model, context, { ...options, onPayload: payload => ({ ...payload as object, [key]: value }) }).result()
    expect(fetch).not.toHaveBeenCalled(); failure(key === 'model' || key === 'project' ? 'INVALID_REQUEST' : 'INVALID_REQUEST', false)
  })
  it('does not let toJSON opt into credits after the guard', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await streamAntiGravity(model, context, { ...options, onPayload: payload => ({ ...payload as object, toJSON() { return { ...payload as object, enabledCreditTypes: ['PAID'] } } }) }).result()
    expect(fetch).not.toHaveBeenCalled(); failure('INVALID_REQUEST', false)
  })
  it('captures requested model before a hook mutates its descriptor', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const localModel = { ...model }
    await streamAntiGravity(localModel, context, { ...options, onPayload: (payload, descriptor) => { descriptor.id = 'different-model'; return { ...payload as object, model: descriptor.id } } }).result()
    expect(fetch).not.toHaveBeenCalled(); failure('INVALID_REQUEST', false)
  })
  it('pre-aborted requests perform zero HTTP and sanitize abort reason', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    const controller = new AbortController(); controller.abort('private-user-reason')
    const result = await streamAntiGravity(model, context, { ...options, signal: controller.signal }).result()
    expect(result.stopReason).toBe('aborted'); expect(fetch).not.toHaveBeenCalled(); failure('ABORTED', false)
  })
  it.each(['fetch', 'body', 'onPayload', 'onResponse'])('bounds stalled %s that ignores signal', async stage => {
    vi.useFakeTimers()
    let cancelled = false
    const hangingBody = new ReadableStream<Uint8Array>({ cancel() { cancelled = true } })
    const fetch = vi.fn(async () => stage === 'fetch' ? new Promise<Response>(() => {}) : new Response(hangingBody))
    vi.stubGlobal('fetch', fetch)
    const extra = stage === 'onPayload' ? { onPayload: () => new Promise<undefined>(() => {}) } : stage === 'onResponse' ? { onResponse: () => new Promise<void>(() => {}) } : {}
    const result = streamAntiGravity(model, context, { ...options, ...extra, timeoutMs: 25 }).result()
    await vi.advanceTimersByTimeAsync(25)
    expect((await result).stopReason).toBe('error'); failure('TIMEOUT', false)
    if (stage === 'body' || stage === 'onResponse') expect(cancelled).toBe(true)
  })
  it.each(['body', 'fetch', 'onPayload'])('return cancels pending next() during %s before delegation', async stage => {
    vi.useFakeTimers()
    let cancelled = false
    vi.stubGlobal('fetch', vi.fn(async () => stage === 'fetch' ? new Promise<Response>(() => {}) : new Response(new ReadableStream<Uint8Array>({ cancel() { cancelled = true } }))))
    const stream = streamAntiGravity(model, context, { ...options, ...stage === 'onPayload' ? { onPayload: () => new Promise<undefined>(() => {}) } : {} })
    const iterator = stream[Symbol.asyncIterator]()
    const pending = iterator.next()
    await vi.advanceTimersByTimeAsync(0)
    const returned = iterator.return!()
    expect((await pending).value?.type).toBe('error')
    expect((await returned).done).toBe(true)
    expect((await stream.result()).stopReason).toBe('aborted'); failure('ABORTED', false)
    if (stage === 'body') expect(cancelled).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('throw cancels pending next before forwarding the caller exception', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream<Uint8Array>())))
    const stream = streamAntiGravity(model, context, options), iterator = stream[Symbol.asyncIterator]()
    const pending = iterator.next()
    await vi.advanceTimersByTimeAsync(0)
    const thrown = iterator.throw!(new Error('private-caller-throw')).catch(error => error)
    expect((await pending).value?.type).toBe('error')
    expect((await thrown).message).toBe('private-caller-throw')
    expect((await stream.result()).stopReason).toBe('aborted'); failure('ABORTED', false)
  })
  it.each(['onPayload', 'onResponse'])('hook %s throws are permanent safe client errors', async stage => {
    const fetch = vi.fn(async () => response(sse(event([{ text: 'ok' }], 'STOP')))); vi.stubGlobal('fetch', fetch)
    const fail = () => { throw Object.assign(new Error('private-hook-error'), { code: 'TRANSPORT' }) }
    await streamAntiGravity(model, context, { ...options, ...stage === 'onPayload' ? { onPayload: fail } : { onResponse: fail } }).result()
    failure('INVALID_REQUEST', false)
    expect(fetch).toHaveBeenCalledTimes(stage === 'onPayload' ? 0 : 1)
  })
  it('read I/O errors are transport failures, not callback or schema failures', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.error(new Error('private-read-io')) } }))))
    await streamAntiGravity(model, context, options).result(); failure('TRANSPORT', false)
  })
  it('consumer early-return aborts the read and settles result without future tools', async () => {
    let cancelled = false
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream<Uint8Array>({ start(controller) { controller.enqueue(new TextEncoder().encode(sse(event([{ text: 'partial' }])))) }, cancel() { cancelled = true } }))))
    const stream = streamAntiGravity(model, context, options)
    for await (const item of stream) if (item.type === 'text_delta') break
    expect((await stream.result()).stopReason).toBe('aborted'); expect(cancelled).toBe(true); failure('ABORTED', true)
  })
  it.each([{}, { response: { candidates: 'wrong' } }, event([{}], 'STOP'), event([{ text: 'ok' }], 'STOP', { promptTokenCount: null }), event([{ text: 1 }], 'STOP'), event([{ functionCall: { name: '', args: {} } }], 'STOP'), event([{ functionCall: { id: 'repeat', name: 'tool', args: {} } }, { functionCall: { id: 'repeat', name: 'tool', args: {} } }], 'STOP'), event([{ text: 'ok' }], 'STOP', { promptTokenCount: -1 }), event([{ text: 'ok' }], 'STOP', { promptTokenCount: 1, cachedContentTokenCount: 2 })])('fails malformed payload %j without raw text', async data => {
    await run(model, sse(data)); failure('PI_AI_ERROR')
  })
  it('network errors do not trigger fallback or leak raw details', async () => {
    const fetch = vi.fn(async () => { throw new Error('private-network-message') }); vi.stubGlobal('fetch', fetch)
    await streamAntiGravity(model, context, options).result(); expect(fetch).toHaveBeenCalledTimes(1); failure('TRANSPORT', false)
  })
})

for (const model of models) describe(`logical replay ${model.id}`, () => {
  it('matches the actual official SDK factory and verifies the next request shape offline', async () => {
    const chunks = [event([{ text: 'offline-a', thought: true }]), event([{ text: 'offline-b', thought: true }]),
      event([{ text: '', thought: true, thoughtSignature: 'YWJj' }, { text: 'offline-answer' }], 'STOP')];
    const googleModel = { ...model, api: 'google-generative-ai' as const };
    const officialFetch = vi.fn(async () => response(chunks.map(chunk => sse(chunk.response)).join('')));
    vi.stubGlobal('fetch', officialFetch);
    const official = await streamGoogle(googleModel, context, { apiKey: 'offline-fixture-only', maxRetries: 0 }).result();
    expect(official.stopReason).toBe('stop'); expect(officialFetch).toHaveBeenCalledTimes(1);
    const reference = convertMessages(googleModel, { messages: [official] });
    const actual = await run(model, chunks.map(sse).join(''));
    expect(actual.result.content).toEqual(official.content);
    expect(actual.result).toMatchObject({ api: model.api, provider: model.provider, model: model.id });
    expect(actual.events.filter(item => item.type === 'thinking_start')).toHaveLength(1);
    expect(actual.events.filter(item => item.type === 'thinking_end')).toHaveLength(1);
    expect(convertMessages(model as unknown as Model<'google-generative-ai'>, { messages: [actual.result] })).toEqual(reference);
    const verifyReplay = vi.fn(async (_url: unknown, init: RequestInit) => {
      const body = JSON.parse(init.body as string);
      expect(body.request.contents.find((item: { role: string }) => item.role === 'model').parts).toEqual(reference[0].parts);
      expect(body.enabledCreditTypes).toEqual([]);
      return response(sse(event([{ text: 'offline-followup-answer' }], 'STOP')));
    });
    vi.stubGlobal('fetch', verifyReplay);
    const followup = await streamAntiGravity(model, { messages: [...context.messages, actual.result,
      { role: 'user', content: 'offline-followup', timestamp: 2 }] }, options).result();
    expect(followup.stopReason).toBe('stop'); expect(verifyReplay).toHaveBeenCalledTimes(1);
    expect(observed.failures).toEqual([]);
    // Fake base64 proves structural replay, not cryptographic backend acceptance.
  });
  it('binds explicit thinking signature-only controls without a text property', async () => {
    const { result } = await run(model, sse(event([{ text: 'offline-a', thought: true }]))
      + sse(event([{ thought: true, thoughtSignature: 'YWJj' }])) + sse(event([{ text: 'answer' }], 'STOP')));
    expect(result.content).toEqual([{ type: 'thinking', thinking: 'offline-a', thinkingSignature: 'YWJj' }, { type: 'text', text: 'answer' }]);
  });
  it('retains first-delta signatures and empty markers while extending a run', async () => {
    const { result } = await run(model, sse(event([{ text: 'a', thought: true, thoughtSignature: 'YWJj' }]))
      + sse(event([{ text: 'b', thought: true }])) + sse(event([{ text: '', thought: true, thoughtSignature: '' }]))
      + sse(event([{ text: 'answer' }], 'STOP')));
    expect(result.content[0]).toEqual({ type: 'thinking', thinking: 'ab', thinkingSignature: 'YWJj' });
  });
  it('never replaces a distinct nonempty signature across events', async () => {
    const { result } = await run(model, sse(event([{ text: 'a', thought: true, thoughtSignature: 'YWJj' }]))
      + sse(event([{ text: 'b', thought: true, thoughtSignature: 'ZGVm' }])) + sse(event([{ text: 'answer' }], 'STOP')));
    expect(result.content.slice(0, 2)).toEqual([{ type: 'thinking', thinking: 'a', thinkingSignature: 'YWJj' },
      { type: 'thinking', thinking: 'b', thinkingSignature: 'ZGVm' }]);
  });
  it('preserves distinct same-frame parts and signs only the last continuing run', async () => {
    const { result } = await run(model, sse(event([{ text: 'a', thought: true }, { text: 'b', thought: true }]))
      + sse(event([{ text: '', thought: true, thoughtSignature: 'YWJj' }])) + sse(event([{ text: 'answer' }], 'STOP')));
    expect(result.content).toEqual([{ type: 'thinking', thinking: 'a' }, { type: 'thinking', thinking: 'b', thinkingSignature: 'YWJj' }, { type: 'text', text: 'answer' }]);
  });
  it('does not move a same-frame signature-only part onto an earlier distinct part', async () => {
    const { result } = await run(model, sse(event([{ text: 'a', thought: true }, { text: '', thought: true, thoughtSignature: 'YWJj' }, { text: 'answer' }], 'STOP')));
    expect(result.content).toEqual([{ type: 'thinking', thinking: 'a' }, { type: 'thinking', thinking: '', thinkingSignature: 'YWJj' }, { type: 'text', text: 'answer' }]);
  });
  it('does not infer thinking or continuation from an untyped signature-only marker', async () => {
    const { result } = await run(model, sse(event([{ text: 'a', thought: true }]))
      + sse(event([{ thoughtSignature: 'YWJj' }, { text: 'answer' }], 'STOP')));
    expect(result.content).toEqual([{ type: 'thinking', thinking: 'a' }, { type: 'text', text: '', textSignature: 'YWJj' }, { type: 'text', text: 'answer' }]);
  });
  it('binds explicitly typed text signature-only controls to text, never thinking', async () => {
    const { result } = await run(model, sse(event([{ text: 'a' }])) + sse(event([{ text: 'b' }]))
      + sse(event([{ thought: false, thoughtSignature: 'YWJj' }], 'STOP')));
    expect(result.content).toEqual([{ type: 'text', text: 'ab', textSignature: 'YWJj' }]);
  });
  it('closes runs around tools and retains exact tool signatures and identities', async () => {
    const { result } = await run(model, sse(event([{ text: 'a', thought: true }]))
      + sse(event([{ functionCall: { id: 'offline-id', name: 'offline_tool', args: {} }, thoughtSignature: 'ZGVm' }]))
      + sse(event([{ text: 'b', thought: true }])) + sse(event([{ text: '', thought: true, thoughtSignature: 'YWJj' }, { text: 'answer' }], 'STOP')));
    expect(result.content).toEqual([{ type: 'thinking', thinking: 'a' }, { type: 'toolCall', id: 'offline-id', name: 'offline_tool', arguments: {}, thoughtSignature: 'ZGVm' },
      { type: 'thinking', thinking: 'b', thinkingSignature: 'YWJj' }, { type: 'text', text: 'answer' }]);
  });
  it('keeps a logical run through metadata-only events', async () => {
    const { result } = await run(model, sse(event([{ text: 'a', thought: true }]))
      + sse({ response: { usageMetadata: { promptTokenCount: 2, totalTokenCount: 3 } } })
      + sse(event([{ text: 'b', thought: true }])) + sse(event([{ text: '', thought: true, thoughtSignature: 'YWJj' }, { text: 'answer' }], 'STOP')));
    expect(result.content[0]).toEqual({ type: 'thinking', thinking: 'ab', thinkingSignature: 'YWJj' });
  });
  it.each([-1, 0.5, '0', null, 1])('rejects malformed or changed candidate index %s without mixing', async index => {
    const first = { response: { candidates: [{ index: 0, content: { role: 'model', parts: [{ text: 'a', thought: true }] } }] } };
    const second = { response: { candidates: [{ index, content: { role: 'model', parts: [{ text: 'answer' }] }, finishReason: 'STOP' }] } };
    const { events } = await run(model, sse(first) + sse(second));
    failure('PI_AI_ERROR', true);
    expect(events.filter(item => item.type === 'thinking_end')).toHaveLength(1);
    expect(events.filter(item => item.type === 'text_start')).toHaveLength(0);
  });
  it('rejects a foreign candidate role without mixing its content', async () => {
    await run(model, sse({ response: { candidates: [{ content: { role: 'user', parts: [{ text: 'answer' }] }, finishReason: 'STOP' }] } }));
    failure('PI_AI_ERROR', false);
  });
  it.each(['protocol', 'framing', 'blocked', 'incomplete'])('closes a partial logical block before a %s terminal error', async kind => {
    const tail = kind === 'protocol' ? sse({ response: { candidates: 'wrong' } })
      : kind === 'framing' ? 'data: {invalid\n\n' : kind === 'blocked' ? sse(event([], 'SAFETY')) : '';
    const { events } = await run(model, sse(event([{ text: 'a', thought: true }])) + tail);
    failure(kind === 'protocol' ? 'PI_AI_ERROR' : kind === 'blocked' ? 'INVALID_REQUEST' : 'TRANSPORT', true);
    expect(events.map(item => item.type)).toEqual(['start', 'thinking_start', 'thinking_delta', 'thinking_end', 'error']);
  });
  it('never promotes thinking-only completion with a signature to actionable success', async () => {
    await run(model, sse(event([{ text: 'a', thought: true }])) + sse(event([{ text: '', thought: true, thoughtSignature: 'YWJj' }], 'STOP')));
    failure('EMPTY_RESPONSE', true);
  });
  it('same-model replay retains a logical signature; cross-model/provider/API replay drops it', async () => {
    const { result } = await run(model, sse(event([{ text: 'a', thought: true }]))
      + sse(event([{ text: '', thought: true, thoughtSignature: 'YWJj' }, { text: 'answer' }], 'STOP')));
    const wire = (target: typeof model) => convertMessages(target as unknown as Model<'google-generative-ai'>, { messages: [result] });
    expect(wire(model)[0].parts?.some(part => part.thoughtSignature === 'YWJj')).toBe(true);
    for (const target of [{ ...model, id: model.id + '-foreign' }, { ...model, provider: 'foreign-provider' }, { ...model, api: 'foreign-api' }]) {
      expect(wire(target as typeof model)[0].parts?.some(part => part.thoughtSignature !== undefined)).toBe(false);
    }
  });
  it('bounds logical blocks, not the number of safe continuing SSE deltas', async () => {
    const { result } = await run(model, sse(event([{ text: 'a' }])).repeat(MAX_INFERENCE_BLOCKS + 1) + sse(event([{ text: 'b' }], 'STOP')));
    expect(result.content).toHaveLength(1); expect(result.stopReason).toBe('stop'); expect(observed.failures).toEqual([]);
  });
  it('still rejects too many distinct signed blocks across events', async () => {
    const text = Array.from({ length: MAX_INFERENCE_BLOCKS + 1 }, (_, index) => sse(event([{ text: 'a', thought: true, thoughtSignature: Buffer.from(String(index)).toString('base64') }]))).join('');
    const { result } = await run(model, text); failure('PI_AI_ERROR', true);
    expect(result.content).toHaveLength(MAX_INFERENCE_BLOCKS);
  });
});

describe('bounded inference frames', () => {
  const model = models[0]
  it.each(['event', 'line', 'blocks', 'total', 'utf8'])('fails %s overflow/malformed data, never truncating tools/signatures', async kind => {
    let text = kind === 'blocks' ? sse(event(Array.from({ length: MAX_INFERENCE_BLOCKS + 1 }, () => ({ text: 'x' })), 'STOP'))
      : kind === 'total' ? ': keepalive\n'.repeat(Math.ceil(MAX_INFERENCE_STREAM_BYTES / 12) + 10)
      : kind === 'line' ? 'data: ' + 'x'.repeat(MAX_SSE_EVENT_BYTES + 1)
      : sse(event([{ text: 'x'.repeat(MAX_SSE_EVENT_BYTES + 1) }], 'STOP'))
    vi.stubGlobal('fetch', vi.fn(async () => kind === 'utf8' ? new Response(new Uint8Array([0xff])) : response(text)))
    await streamAntiGravity(model, context, options).result(); failure('PI_AI_ERROR')
  })
  it('caps HTTP error bodies while preserving status and header hint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('private'.repeat(MAX_ERROR_BODY_BYTES), { status: 429, headers: { 'retry-after': '60' } })))
    await streamAntiGravity(model, context, options).result(); failure('RATE_LIMIT', false)
    expect(observed.failures[0].providerRetryAfterMs).toBe(60000)
  })
  it.each([0, -1, Infinity, 2147483648])('rejects invalid request timeout %s before HTTP', async timeoutMs => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch)
    await streamAntiGravity(model, context, { ...options, timeoutMs }).result(); failure('INVALID_REQUEST', false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
