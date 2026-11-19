import { createHash } from 'node:crypto'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { AttachmentId, FileAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { CredentialProvider, credentialRef } from '@deepseek-ai/dsh-credentials'
import type {
  CredentialInfo,
  CredentialKey,
  CredentialRecord,
  CredentialRecordEntry,
  CredentialRecordInfo,
  CredentialRef,
  ResolvedCredential,
} from '@deepseek-ai/dsh-credentials'
import LlmRuntime, { createAssistantMessage, createToolResultMessage, createUserMessage, ToolCallId } from '@deepseek-ai/dsh-llm'
import * as AntiGravity from '../src/index.ts'
import {
  formatVideoReadOutput,
  injectInlineVideos,
  isVideoCapableGeminiModel,
  parseVideoAttachmentMarker,
  READ_VIDEO_TOOL_NAME,
  registerReadVideoTool,
  sniffVideoMediaType,
} from '../src/video.ts'
import type { VideoAttachmentReader, VideoReadValue } from '../src/video.ts'

const FAKE_MP4 = new Uint8Array([
  0x00, 0x00, 0x00, 0x18,
  0x66, 0x74, 0x79, 0x70, // ftyp
  0x69, 0x73, 0x6f, 0x6d, // isom
  0x00, 0x00, 0x02, 0x00,
])

const FAKE_WEBM = new Uint8Array([
  0x1a, 0x45, 0xdf, 0xa3, 0x9f, 0x42, 0x82, 0x84,
  0x77, 0x65, 0x62, 0x6d, // webm
])

const FAKE_GIF = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00])

function shaId(bytes: Uint8Array): AttachmentId {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}` as AttachmentId
}

let context: Context | undefined

class TestCredentials extends CredentialProvider {
  private readonly store = new Map<CredentialRef, string>()

  constructor(ctx: Context, seed: Record<string, string>) {
    super(ctx)
    for (const [ref, value] of Object.entries(seed)) this.store.set(credentialRef(ref), value)
  }

  override resolve(ref: CredentialRef): Promise<ResolvedCredential | undefined> {
    const value = this.store.get(ref)
    return Promise.resolve(value === undefined ? undefined : { value, source: 'test' })
  }

  override describe(ref: CredentialRef): Promise<CredentialInfo> {
    return Promise.resolve({ configured: this.store.has(ref), source: 'test', writable: true })
  }

  override set(ref: CredentialRef, value: string): Promise<void> {
    this.store.set(ref, value)
    this.ctx.emit('credentials/reference-updated', ref)
    return Promise.resolve()
  }

  override unset(ref: CredentialRef): Promise<void> {
    this.store.delete(ref)
    this.ctx.emit('credentials/reference-updated', ref)
    return Promise.resolve()
  }

  override readRecord(_key: CredentialKey): Promise<CredentialRecord | undefined> { return Promise.resolve(undefined) }
  override describeRecord(_key: CredentialKey): Promise<CredentialRecordInfo> { return Promise.resolve({ configured: false, writable: true }) }
  override listRecords(): Promise<readonly CredentialRecordEntry[]> { return Promise.resolve([]) }
  override modifyRecord(): Promise<CredentialRecord | undefined> { return Promise.reject(new Error('unused')) }
  override deleteRecord(): Promise<void> { return Promise.resolve() }
}

function createMemoryAttachments() {
  const files = new Map<string, Uint8Array>()
  return {
    async saveFile(input: { data: Uint8Array; name?: string }): Promise<FileAttachmentRef> {
      const attachmentId = shaId(input.data)
      files.set(attachmentId, new Uint8Array(input.data))
      return { attachmentId, name: input.name ?? 'video.mp4', bytes: input.data.byteLength }
    },
    async *readFileStream(ref: FileAttachmentRef): AsyncIterable<Uint8Array> {
      const bytes = files.get(ref.attachmentId)
      if (!bytes) throw new Error('not found')
      yield bytes
    },
  }
}

afterEach(async () => {
  await context?.fiber.dispose()
  context = undefined
  vi.unstubAllGlobals()
})

describe('Anti Gravity native video support', () => {
  it('identifies video-capable Gemini models and excludes Claude, GPT, and image-only models', () => {
    expect(isVideoCapableGeminiModel('gemini-4-neon-xhigh')).toBe(true)
    expect(isVideoCapableGeminiModel('gemini-4-neon-low')).toBe(true)
    expect(isVideoCapableGeminiModel('gemini-4-hydrogen-medium')).toBe(true)
    expect(isVideoCapableGeminiModel('gemini-4-argon-high')).toBe(true)
    expect(isVideoCapableGeminiModel('gemini-3.1-flash-image')).toBe(false)
    expect(isVideoCapableGeminiModel('claude-opus-5-5-high')).toBe(false)
    expect(isVideoCapableGeminiModel('gpt-oss-120b-medium')).toBe(false)
  })

  it('sniffs MP4, WebM, and GIF containers from header bytes', () => {
    expect(sniffVideoMediaType(FAKE_MP4)).toBe('video/mp4')
    expect(sniffVideoMediaType(FAKE_WEBM)).toBe('video/webm')
    expect(sniffVideoMediaType(FAKE_GIF)).toBe('image/gif')
    expect(sniffVideoMediaType(new Uint8Array([1, 2, 3, 4]))).toBeUndefined()
  })

  it('round-trips video attachment markers cleanly', () => {
    const id = shaId(FAKE_MP4)
    const value: VideoReadValue = {
      path: '/tmp/clip.mp4',
      video: { attachmentId: id, mediaType: 'video/mp4', bytes: FAKE_MP4.byteLength, name: 'clip.mp4' },
    }
    const text = formatVideoReadOutput(value)
    expect(parseVideoAttachmentMarker(text)).toEqual({
      attachmentId: id,
      mediaType: 'video/mp4',
      bytes: FAKE_MP4.byteLength,
      name: 'clip.mp4',
    })
  })

  it('injects inlineData newest-to-oldest within budget only for Gemini models', async () => {
    const attachments = createMemoryAttachments()
    const olderRef = await attachments.saveFile({ data: FAKE_WEBM, name: 'older.webm' })
    const newerRef = await attachments.saveFile({ data: FAKE_MP4, name: 'newer.mp4' })

    const makeContents = () => [
      {
        role: 'user',
        parts: [{
          functionResponse: {
            id: 'call_1',
            name: READ_VIDEO_TOOL_NAME,
            response: {
              output: formatVideoReadOutput({
                path: '/tmp/older.webm',
                video: { attachmentId: olderRef.attachmentId, mediaType: 'video/webm', bytes: olderRef.bytes, name: olderRef.name },
              }),
            },
          },
        }],
      },
      {
        role: 'user',
        parts: [{
          functionResponse: {
            id: 'call_2',
            name: READ_VIDEO_TOOL_NAME,
            response: {
              output: formatVideoReadOutput({
                path: '/tmp/newer.mp4',
                video: { attachmentId: newerRef.attachmentId, mediaType: 'video/mp4', bytes: newerRef.bytes, name: newerRef.name },
              }),
            },
          },
        }],
      },
    ]

    // Budget fits only the newer MP4 (16 bytes), not both (28 bytes)
    const geminiContents = makeContents()
    await injectInlineVideos(geminiContents, 'gemini-4-neon-low', attachments, FAKE_MP4.byteLength)
    const olderFr = geminiContents[0].parts[0].functionResponse as Record<string, unknown>
    const newerFr = geminiContents[1].parts[0].functionResponse as Record<string, unknown>
    expect(olderFr.parts).toBeUndefined()
    expect((olderFr.response as { output: string }).output).toContain('omitted from this request')
    expect(newerFr.parts).toEqual([{
      inlineData: {
        mimeType: 'video/mp4',
        data: Buffer.from(FAKE_MP4).toString('base64'),
      },
    }])

    // Non-Gemini model receives zero inlineData
    const claudeContents = makeContents()
    await injectInlineVideos(claudeContents, 'claude-opus-5-5-high', attachments, 1024)
    expect((claudeContents[0].parts[0].functionResponse as Record<string, unknown>).parts).toBeUndefined()
    expect((claudeContents[1].parts[0].functionResponse as Record<string, unknown>).parts).toBeUndefined()
  })

  it('enforces Gemini-only route gate in read_video and hides read_video from Claude tool declarations', async () => {
    const attachments = createMemoryAttachments()
    const registered: Array<Record<string, unknown>> = []
    const readBytesSpy = vi.fn(async () => FAKE_MP4)

    const fakeScope = {
      tools: { register: (def: Record<string, unknown>) => { registered.push(def); return () => {} } },
      fs: {
        resolve: async (filePath: string) => ({ displayPath: filePath }),
        stat: async () => ({ type: 'file', version: 'v1' }),
        readBytes: readBytesSpy,
      },
      attachments,
      emit: vi.fn(),
    }
    const fakeCtx = {
      inject: (_deps: unknown, cb: (scope: unknown) => void) => cb(fakeScope),
    } as unknown as Context

    registerReadVideoTool(fakeCtx, { maxVideoBytes: 1024 * 1024 })
    expect(registered).toHaveLength(1)
    const tool = registered[0] as {
      name: string
      execute(args: unknown, exec: unknown): Promise<VideoReadValue>
      output: { render(args: unknown, value: VideoReadValue): Array<{ type: string; text: string }> }
    }
    expect(tool.name).toBe(READ_VIDEO_TOOL_NAME)

    // Refuses non-Gemini Antigravity model and non-Antigravity provider before touching fs
    await expect(tool.execute({ file_path: 'demo.mp4' }, {
      agent: { options: { provider: 'google-antigravity', model: 'claude-sonnet-5-5-high' } },
    })).rejects.toThrow(/only supported on Google Antigravity Gemini models/)
    await expect(tool.execute({ file_path: 'demo.mp4' }, {
      agent: { options: { provider: 'openai-codex', model: 'gpt-6-sol' } },
    })).rejects.toThrow(/only supported on Google Antigravity Gemini models/)
    expect(readBytesSpy).not.toHaveBeenCalled()

    // Succeeds on Gemini 4 Neon
    const value = await tool.execute({ file_path: 'demo.mp4' }, {
      agent: { options: { provider: 'google-antigravity', model: 'gemini-4-neon-low' } },
    })
    expect(value.video.mediaType).toBe('video/mp4')
    expect(value.video.bytes).toBe(FAKE_MP4.byteLength)
    const rendered = tool.output.render({ file_path: 'demo.mp4' }, value)
    expect(rendered[0].text).toContain(`<video_attachment id="${value.video.attachmentId}"`)

    // End-to-end wire check through AntiGravity plugin: Gemini gets read_video tool + inlineData; Claude strips read_video tool
    const capturedBodies: Array<Record<string, unknown>> = []
    vi.stubGlobal('fetch', (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (url.endsWith('/v1internal:fetchAvailableModels')) {
        return Promise.resolve(new Response(JSON.stringify({
          models: {
            'gemini-4-neon-low': { displayName: 'Gemini 4 Neon (Low)' },
            'claude-sonnet-5-5-high': { displayName: 'Claude Sonnet 5.5 (High)' },
          },
        })))
      }
      capturedBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>)
      const event = {
        response: {
          candidates: [{ content: { parts: [{ text: 'OK' }] }, finishReason: 'STOP' }],
          usageMetadata: { promptTokenCount: 2, candidatesTokenCount: 1, totalTokenCount: 3 },
        },
      }
      return Promise.resolve(new Response(`data: ${JSON.stringify(event)}\n\n`, {
        headers: { 'content-type': 'text/event-stream' },
      }))
    })

    const credential = JSON.stringify({
      type: 'oauth',
      access: 'anti-access',
      refresh: 'anti-refresh',
      expires: Date.now() + 60_000,
      projectId: 'anti-project',
    })
    context = new Context()
    // Provide attachments service on context so adapter.configureVideoAttachments resolves it
    context.provide('attachments')
    ;(context as unknown as { set(name: string, value: VideoAttachmentReader): void }).set('attachments', attachments)
    await context.plugin(LlmRuntime)
    await context.plugin(TestCredentials, { GOOGLE_ANTIGRAVITY_OAUTH_CREDENTIAL: credential })
    await context.plugin(AntiGravity, {})

    const tools = [
      { name: READ_VIDEO_TOOL_NAME, description: 'Read video', parameters: { type: 'object', properties: { file_path: { type: 'string' } } } },
      { name: 'read', description: 'Read file', parameters: { type: 'object', properties: { file_path: { type: 'string' } } } },
    ]

    for (const model of ['gemini-4-neon-low', 'claude-sonnet-5-5-high']) {
      const callId = ToolCallId('call_v1')
      for await (const _chunk of context.llm.stream({
        provider: 'google-antigravity',
        model,
        tools,
        messages: [
          createUserMessage({ content: [{ type: 'text', text: 'check demo.mp4' }], source: { kind: 'plugin', plugin: 'test' } }),
          createAssistantMessage({
            provider: 'google-antigravity',
            model,
            content: [{ type: 'tool-call', id: callId, name: READ_VIDEO_TOOL_NAME, input: { file_path: 'demo.mp4' } }],
          } as never),
          createToolResultMessage({
            callId,
            isError: false,
            content: [{ type: 'text', text: rendered[0].text }],
          }),
        ],
      })) {}
    }

    const geminiReq = capturedBodies[0].request as {
      tools: Array<{ functionDeclarations: Array<{ name: string }> }>
      contents: Array<{ parts: Array<{ functionResponse?: { parts?: unknown[] } }> }>
    }
    const claudeReq = capturedBodies[1].request as {
      tools: Array<{ functionDeclarations: Array<{ name: string }> }>
      contents: Array<{ parts: Array<{ functionResponse?: { parts?: unknown[] } }> }>
    }

    expect(geminiReq.tools[0].functionDeclarations.map(d => d.name)).toEqual([READ_VIDEO_TOOL_NAME, 'read'])
    const geminiFr = geminiReq.contents.flatMap(c => c.parts).find(p => p.functionResponse)?.functionResponse
    expect(geminiFr?.parts).toEqual([{
      inlineData: { mimeType: 'video/mp4', data: Buffer.from(FAKE_MP4).toString('base64') },
    }])

    expect(claudeReq.tools[0].functionDeclarations.map(d => d.name)).toEqual(['read'])
    const claudeFr = claudeReq.contents.flatMap(c => c.parts).find(p => p.functionResponse)?.functionResponse
    expect(claudeFr?.parts).toBeUndefined()
  })
})
