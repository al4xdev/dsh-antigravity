import { afterEach, describe, expect, it, vi } from 'vitest'
import { AntiGravitySearchProvider, DEFAULT_SEARCH_MODEL } from '../src/search.ts'
import { ENDPOINTS } from '../src/models.ts'

const credential = { type: 'oauth' as const, access: 'test-access', refresh: 'test-refresh', expires: 9999999999999, projectId: 'test-project' }
const manager = () => ({ resolveCredential: vi.fn().mockResolvedValue(credential) })
const candidate = (fields: Record<string, unknown>) => ({ response: { candidates: [fields] } })
const grounding = { webSearchQueries: ['node release'], groundingChunks: [
  { web: { uri: 'https://vertexaisearch.cloud.google.com/grounding-api-redirect/test', title: 'nodejs.org' } },
] }
const success = () => candidate({ content: { parts: [{ text: 'Grounded answer' }] }, groundingMetadata: grounding, finishReason: 'STOP' })
function mockEvents(events: unknown[], separator = '\n', fragmented = false): ReturnType<typeof vi.fn> {
  const text = events.map(event => `data: ${JSON.stringify(event)}${separator}${separator}`).join('')
  const bytes = new TextEncoder().encode(text)
  const fetchMock = vi.fn().mockResolvedValue(new Response(new ReadableStream({
    start(controller) {
      if (fragmented) for (const byte of bytes) controller.enqueue(Uint8Array.of(byte))
      else controller.enqueue(bytes)
      controller.close()
    },
  })))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

describe('Anti Gravity native Google Search', () => {
  it('uses existing OAuth, exact model and native tool envelope', async () => {
    const credentials = manager()
    const fetchMock = mockEvents([success()])
    const provider = new AntiGravitySearchProvider(credentials)
    expect(provider.id).toBe('google-antigravity')
    expect(provider.available()).toBe(true)
    expect(credentials.resolveCredential).not.toHaveBeenCalled()
    await provider.search({ query: 'node release' })
    expect(credentials.resolveCredential).toHaveBeenCalledOnce()
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe(`${ENDPOINTS[0]}/v1internal:streamGenerateContent?alt=sse`)
    expect(init.method).toBe('POST')
    expect(init.redirect).toBe('error')
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer test-access')
    expect(JSON.parse(init.body)).toMatchObject({
      project: 'test-project', model: DEFAULT_SEARCH_MODEL, requestType: 'agent', userAgent: 'antigravity',
      request: { contents: [{ role: 'user', parts: [{ text: 'Search the web for the following query and answer using search grounding:\nnode release' }] }], tools: [{ googleSearch: {} }] },
    })
  })

  it('parses byte-fragmented CRLF SSE and final metadata, ignoring thought text', async () => {
    mockEvents([
      candidate({ content: { parts: [{ text: 'secret reasoning', thought: true }, { text: 'Olá ' }] } }),
      candidate({ content: { parts: [{ text: 'world' }] }, groundingMetadata: grounding, finishReason: 'STOP' }),
    ], '\r\n', true)
    expect(await new AntiGravitySearchProvider(manager()).search({ query: 'q' })).toEqual({
      content: 'Olá world', sources: [{ url: grounding.groundingChunks[0].web.uri, title: 'nodejs.org' }], truncated: false,
    })
  })

  it('accepts multiline SSE, comments and an unterminated final event', async () => {
    const data = JSON.stringify(success(), null, 2).split('\n').map(line => `data: ${line}`).join('\r')
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(`: heartbeat\rid: x\r${data}`)))
    expect((await new AntiGravitySearchProvider(manager()).search({ query: 'q' })).content).toBe('Grounded answer')
  })

  it('only cites deduplicated HTTP(S) grounding URLs, never URLs in text', async () => {
    mockEvents([candidate({
      content: { parts: [{ text: 'See https://invented.example/' }] }, finishReason: 'STOP',
      groundingMetadata: { groundingChunks: [
        { web: { uri: 'https://real.example', title: 'Real' } },
        { web: { uri: 'https://real.example/' } },
        { web: { uri: 'javascript:alert(1)' } }, { web: { uri: 'file:///private' } },
        { web: { uri: 'not a url' } }, { web: { uri: 'https://user:password@example.org' } },
      ] },
    })])
    expect((await new AntiGravitySearchProvider(manager()).search({ query: 'q' })).sources).toEqual([
      { url: 'https://real.example/', title: 'Real' },
    ])
  })

  it('caps sources and content but waits for grounding and STOP', async () => {
    mockEvents([candidate({
      content: { parts: [{ text: 'x'.repeat(140000) }] }, finishReason: 'STOP',
      groundingMetadata: { groundingChunks: [
        { web: { uri: 'https://one.example/' } }, { web: { uri: 'https://two.example/' } },
      ] },
    })])
    const result = await new AntiGravitySearchProvider(manager()).search({ query: 'q', maxResults: 1 })
    expect(result.content?.length).toBe(128 * 1024)
    expect(result.sources).toHaveLength(1)
    expect(result.truncated).toBe(true)
  })

  it('accepts genuine search queries without inventing missing sources', async () => {
    mockEvents([candidate({ groundingMetadata: { webSearchQueries: ['q'] }, finishReason: 'STOP' })])
    expect(await new AntiGravitySearchProvider(manager()).search({ query: 'q' })).toEqual({ content: '', sources: [], truncated: false })
  })

  it.each([
    [candidate({ content: { parts: [{ text: 'memory answer' }] }, finishReason: 'STOP' }), /no search grounding/],
    [candidate({ groundingMetadata: grounding, finishReason: 'MAX_TOKENS' }), /STOP/],
    [candidate({ groundingMetadata: grounding }), /STOP/],
    [candidate({ groundingMetadata: { webSearchQueries: [''], groundingChunks: [{}] }, finishReason: 'STOP' }), /grounding/],
  ])('rejects ungrounded or incomplete outcomes', async (event, error) => {
    mockEvents([event])
    await expect(new AntiGravitySearchProvider(manager()).search({ query: 'q' })).rejects.toThrow(error)
  })

  it('reports only HTTP status, does not retry or change the configured model', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('private body test-access', { status: 403 }))
    vi.stubGlobal('fetch', fetchMock)
    await expect(new AntiGravitySearchProvider(manager(), 'exact-model').search({ query: 'q' })).rejects.toThrow('Anti Gravity search failed with HTTP 403')
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe('exact-model')
  })

  it('rejects invalid JSON without leaking its body', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('data: private test-access\n\n')))
    await expect(new AntiGravitySearchProvider(manager()).search({ query: 'q' })).rejects.toThrow('invalid SSE JSON')
  })

  it('enforces the transport size bound', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('x'.repeat(2 * 1024 * 1024 + 1))))
    await expect(new AntiGravitySearchProvider(manager()).search({ query: 'q' })).rejects.toThrow('size limit')
  })

  it('sanitizes credential and transport error messages', async () => {
    const credentials = { resolveCredential: vi.fn().mockRejectedValue(new Error('Anti Gravity search private test-access')) }
    await expect(new AntiGravitySearchProvider(credentials).search({ query: 'q' })).rejects.toThrow('Anti Gravity search failed')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('test-access private response')))
    await expect(new AntiGravitySearchProvider(manager()).search({ query: 'q' })).rejects.toThrow('Anti Gravity search failed')
  })

  it('rejects SSE error envelopes without exposing backend details', async () => {
    mockEvents([{ error: { message: 'private test-access' } }])
    await expect(new AntiGravitySearchProvider(manager()).search({ query: 'q' })).rejects.toThrow('Anti Gravity search returned a stream error')
  })

  it('does not start credential or network operations for a cancelled request', async () => {
    const credentials = manager()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const controller = new AbortController()
    controller.abort()
    await expect(new AntiGravitySearchProvider(credentials).search({ query: 'q' }, controller.signal)).rejects.toThrow(/cancelled/)
    expect(credentials.resolveCredential).not.toHaveBeenCalled()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('cancels and closes a stalled response stream', async () => {
    const cancel = vi.fn()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(new ReadableStream({ cancel }))))
    const controller = new AbortController()
    const result = new AntiGravitySearchProvider(manager()).search({ query: 'q' }, controller.signal)
    await vi.waitFor(() => expect(vi.mocked(fetch)).toHaveBeenCalledOnce())
    controller.abort()
    await expect(result).rejects.toThrow(/cancelled/)
    expect(cancel).toHaveBeenCalledOnce()
  })

  it('times out even when a credential resolver ignores cancellation', async () => {
    vi.useFakeTimers()
    const result = new AntiGravitySearchProvider({ resolveCredential: () => new Promise(() => {}) }).search({ query: 'q' })
    const assertion = expect(result).rejects.toThrow(/timed out/)
    await vi.advanceTimersByTimeAsync(60_000)
    await assertion
  })
})
