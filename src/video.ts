/** Native video reading tool (`read_video`) and Gemini inlineData injector for Anti Gravity. */

import { spawn } from 'node:child_process'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { basename, extname, join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import type { AttachmentId, AttachmentStore, FileAttachmentRef } from '@deepseek-ai/dsh-attachment'
import { PROVIDER } from './models.ts'

export const READ_VIDEO_TOOL_NAME = 'read_video'
/** Raw byte cap for inline video payloads (~15 MiB raw ≈ 20 MiB base64 JSON). */
export const DEFAULT_MAX_REQUEST_VIDEO_BYTES = 15 * 1024 * 1024
/** Raw byte cap for source videos accepted for local ffmpeg transcoding. */
export const MAX_TRANSCODE_INPUT_BYTES = 50 * 1024 * 1024
const TRANSCODE_TIMEOUT_MS = 60_000

export type NativeVideoMediaType = 'video/mp4' | 'video/webm'
type SupportedInputMediaType = NativeVideoMediaType | 'image/gif' | 'video/quicktime' | 'video/x-matroska' | 'video/x-msvideo'

const EXTENSION_MEDIA_TYPES: Record<string, SupportedInputMediaType> = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.gif': 'image/gif',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
}

export interface VideoAttachmentReader {
  readFileStream(ref: FileAttachmentRef, signal?: AbortSignal): AsyncIterable<Uint8Array>
}

export interface VideoAttachmentMarker {
  readonly attachmentId: AttachmentId
  readonly mediaType: NativeVideoMediaType
  readonly bytes: number
  readonly name: string
}

export interface VideoReadValue {
  readonly path: string
  readonly video: {
    readonly attachmentId: string
    readonly mediaType: NativeVideoMediaType
    readonly bytes: number
    readonly name: string
    readonly transcoded?: boolean
  }
}

/** True for Cloud Code Assist Gemini models that accept video inlineData. */
export function isVideoCapableGeminiModel(modelId: string): boolean {
  const lower = modelId.toLowerCase()
  return lower.startsWith('gemini-') && lower !== 'gemini-3.1-flash-image'
}

function matchesAscii(data: Uint8Array, offset: number, value: string): boolean {
  if (data.byteLength < offset + value.length) return false
  for (let i = 0; i < value.length; i++) {
    if (data[offset + i] !== value.charCodeAt(i)) return false
  }
  return true
}

/** Identify supported video/GIF containers from file header bytes. */
export function sniffVideoMediaType(data: Uint8Array): SupportedInputMediaType | undefined {
  if (matchesAscii(data, 4, 'ftyp')) {
    return matchesAscii(data, 8, 'qt  ') ? 'video/quicktime' : 'video/mp4'
  }
  if (data.byteLength >= 4 && data[0] === 0x1a && data[1] === 0x45 && data[2] === 0xdf && data[3] === 0xa3) {
    const header = new TextDecoder('latin1').decode(data.subarray(0, Math.min(64, data.byteLength)))
    return header.includes('webm') ? 'video/webm' : 'video/x-matroska'
  }
  if (matchesAscii(data, 0, 'GIF87a') || matchesAscii(data, 0, 'GIF89a')) return 'image/gif'
  if (matchesAscii(data, 0, 'RIFF') && matchesAscii(data, 8, 'AVI ')) return 'video/x-msvideo'
  return undefined
}

function sanitizeAttrName(name: string): string {
  const cleaned = name.replace(/["<>\\/\r\n\t\u0000-\u001f\u007f]/g, '_').trim()
  return cleaned.length > 0 ? cleaned.slice(0, 120) : 'video.mp4'
}

export function formatVideoReadOutput(value: VideoReadValue): string {
  const { attachmentId, mediaType, bytes, name, transcoded } = value.video
  const note = transcoded ? ' (transcoded to MP4 for Gemini)' : ''
  return `<path>${value.path}</path>
<type>video</type>
<video_attachment id="${attachmentId}" mediaType="${mediaType}" bytes="${bytes}" name="${sanitizeAttrName(name)}" />
<content>
${mediaType} video, ${bytes} bytes${note}
</content>`
}

const MARKER_RE = /<video_attachment id="(sha256:[a-f0-9]{64})" mediaType="(video\/mp4|video\/webm)" bytes="(\d+)" name="([^"]+)" \/>/

export function parseVideoAttachmentMarker(text: string): VideoAttachmentMarker | undefined {
  const match = MARKER_RE.exec(text)
  if (match === null) return undefined
  const bytes = Number(match[3])
  if (!Number.isSafeInteger(bytes) || bytes <= 0) return undefined
  return {
    attachmentId: match[1] as AttachmentId,
    mediaType: match[2] as NativeVideoMediaType,
    bytes,
    name: match[4],
  }
}

/** Transcode a GIF or non-MP4/oversized video to compact H.264 MP4 via local ffmpeg. */
export async function transcodeToMp4(
  input: Uint8Array,
  inputExt: string,
  maxOutputBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array> {
  signal?.throwIfAborted()
  const safeExt = /^\.[a-z0-9]{1,8}$/.test(inputExt) ? inputExt : '.bin'
  const workDir = await mkdtemp(join(tmpdir(), 'dsh-ag-video-'))
  const inPath = join(workDir, `input${safeExt}`)
  const outPath = join(workDir, 'output.mp4')
  try {
    await writeFile(inPath, input)
    await new Promise<void>((resolve, reject) => {
      const child = spawn('ffmpeg', [
        '-y',
        '-hide_banner',
        '-loglevel', 'error',
        '-i', inPath,
        '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2',
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '28',
        '-c:a', 'aac',
        '-b:a', '96k',
        '-movflags', '+faststart',
        outPath,
      ], { stdio: ['ignore', 'ignore', 'pipe'] })
      let stderr = ''
      let settled = false
      const done = (error?: Error): void => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        if (error) reject(error)
        else resolve()
      }
      const kill = (error: Error): void => {
        child.kill('SIGTERM')
        setTimeout(() => child.kill('SIGKILL'), 1000).unref()
        done(error)
      }
      const onAbort = (): void => kill(new Error('Video transcoding was cancelled'))
      const timer = setTimeout(() => kill(new Error(`Video transcoding timed out after ${TRANSCODE_TIMEOUT_MS}ms`)), TRANSCODE_TIMEOUT_MS)
      signal?.addEventListener('abort', onAbort, { once: true })
      child.stderr?.on('data', chunk => { stderr = (stderr + String(chunk)).slice(-1024) })
      child.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'ENOENT') done(new Error('ffmpeg was not found on PATH; provide an MP4 or WebM file within the byte limit or install ffmpeg'))
        else done(new Error(`ffmpeg failed to start: ${error.message}`))
      })
      child.on('exit', (code, sig) => {
        if (code === 0) done()
        else done(new Error(`ffmpeg exited with ${code === null ? `signal ${sig}` : `code ${code}`}${stderr.trim() ? `: ${stderr.trim()}` : ''}`))
      })
    })
    signal?.throwIfAborted()
    const output = new Uint8Array(await readFile(outPath))
    if (output.byteLength === 0) throw new Error('ffmpeg produced an empty MP4 file')
    if (output.byteLength > maxOutputBytes) {
      throw new Error(`transcoded MP4 is ${output.byteLength} bytes, which exceeds the ${maxOutputBytes}-byte limit; trim or downscale the video first`)
    }
    return output
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => {})
  }
}

async function readAttachmentBytes(
  attachments: VideoAttachmentReader,
  ref: FileAttachmentRef,
  maxBytes: number,
  signal?: AbortSignal,
): Promise<Uint8Array | undefined> {
  const chunks: Uint8Array[] = []
  let total = 0
  for await (const chunk of attachments.readFileStream(ref, signal)) {
    total += chunk.byteLength
    if (total > maxBytes) return undefined
    chunks.push(chunk)
  }
  const merged = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    merged.set(chunk, offset)
    offset += chunk.byteLength
  }
  return merged
}

/**
 * Inject `inlineData` video parts into `read_video` functionResponses for video-capable
 * Gemini models. Walks newest-to-oldest within `maxRequestVideoBytes` so long sessions
 * keep working instead of exceeding request payload caps.
 */
export async function injectInlineVideos(
  contents: Array<Record<string, unknown>>,
  modelId: string,
  attachments: VideoAttachmentReader | undefined,
  maxRequestVideoBytes: number,
  signal?: AbortSignal,
): Promise<void> {
  if (!isVideoCapableGeminiModel(modelId) || maxRequestVideoBytes <= 0) return

  interface CandidateResponse {
    fr: Record<string, unknown>
    response: Record<string, unknown>
    output: string
    marker: VideoAttachmentMarker
  }

  const candidates: CandidateResponse[] = []
  for (const entry of contents) {
    const parts = entry.parts
    if (!Array.isArray(parts)) continue
    for (const part of parts) {
      if (typeof part !== 'object' || part === null) continue
      const fr = (part as Record<string, unknown>).functionResponse
      if (typeof fr !== 'object' || fr === null) continue
      const frObj = fr as Record<string, unknown>
      if (frObj.name !== READ_VIDEO_TOOL_NAME) continue
      const response = frObj.response
      if (typeof response !== 'object' || response === null) continue
      const responseObj = response as Record<string, unknown>
      if (typeof responseObj.output !== 'string') continue
      const marker = parseVideoAttachmentMarker(responseObj.output)
      if (marker === undefined) continue
      candidates.push({ fr: frObj, response: responseObj, output: responseObj.output, marker })
    }
  }
  if (candidates.length === 0) return

  let usedBytes = 0
  for (let i = candidates.length - 1; i >= 0; i--) {
    signal?.throwIfAborted()
    const { fr, response, output, marker } = candidates[i]
    if (attachments === undefined) {
      response.output = `${output}\n[video omitted from this request: attachment service unavailable]`
      continue
    }
    if (usedBytes + marker.bytes > maxRequestVideoBytes) {
      response.output = `${output}\n[video omitted from this request to stay within the ${maxRequestVideoBytes}-byte video payload budget; call read_video again if needed]`
      continue
    }
    let bytes: Uint8Array | undefined
    try {
      bytes = await readAttachmentBytes(
        attachments,
        { attachmentId: marker.attachmentId, name: marker.name, bytes: marker.bytes },
        maxRequestVideoBytes - usedBytes,
        signal,
      )
    } catch (error) {
      if (signal?.aborted) throw error
      bytes = undefined
    }
    if (bytes === undefined || bytes.byteLength === 0) {
      response.output = `${output}\n[video omitted from this request: attachment could not be loaded]`
      continue
    }
    usedBytes += bytes.byteLength
    const existingParts = Array.isArray(fr.parts) ? fr.parts as unknown[] : []
    fr.parts = [
      ...existingParts,
      {
        inlineData: {
          mimeType: marker.mediaType,
          data: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64'),
        },
      },
    ]
  }
}

interface ToolRunExec {
  readonly signal?: AbortSignal
  readonly agent?: {
    readonly options?: { readonly provider?: string; readonly model?: string }
    readonly session?: {
      readonly header?: { readonly cwd?: string }
      requestHeader?(): { readonly config?: { readonly provider?: string; readonly model?: string } } | undefined
    }
  }
}

interface FsLike {
  resolve(path: string, opts?: { cwd?: string; signal?: AbortSignal }): Promise<{ readonly displayPath: string }>
  stat(target: unknown, signal?: AbortSignal): Promise<{ readonly type: string; readonly version?: unknown } | undefined>
  readBytes(target: unknown, signal: AbortSignal | undefined, maxBytes: number): Promise<Uint8Array>
}

interface ToolsLike {
  register(definition: Record<string, unknown>): () => void
}

function assertGeminiAntigravityRoute(exec: ToolRunExec, requestedPath: string): void {
  const routed = exec.agent?.session?.requestHeader?.()?.config
  const provider = routed?.provider ?? exec.agent?.options?.provider
  const model = routed?.model ?? exec.agent?.options?.model
  if (provider === undefined || model === undefined) {
    throw new Error(`cannot read "${requestedPath}" as a video: the current model route could not be resolved`)
  }
  if (provider !== PROVIDER || !isVideoCapableGeminiModel(model)) {
    throw new Error(
      `cannot read "${requestedPath}" as a video: read_video is only supported on Google Antigravity Gemini models (current route: ${provider}/${model})`,
    )
  }
}

/**
 * Register the `read_video` tool while `tools`, `fs`, and `attachments` are mounted.
 * Execution enforces the Google Antigravity Gemini route gate before reading files.
 */
export function registerReadVideoTool(
  ctx: Context,
  options: { readonly maxVideoBytes?: number } = {},
): void {
  const maxVideoBytes = options.maxVideoBytes ?? DEFAULT_MAX_REQUEST_VIDEO_BYTES
  ctx.inject(['tools', 'fs', 'attachments'] as never, (scope) => {
    const tools = (scope as unknown as { tools: ToolsLike }).tools
    const fs = (scope as unknown as { fs: FsLike }).fs
    const attachments = (scope as unknown as { attachments: AttachmentStore }).attachments
    tools.register({
      name: READ_VIDEO_TOOL_NAME,
      description: 'Read a video or animated GIF file (MP4, WebM, MOV, MKV, AVI, GIF) and attach it natively for visual inspection. Supported only on Google Antigravity Gemini models; animated GIFs and non-MP4/WebM videos are transcoded to MP4 when ffmpeg is available.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          file_path: {
            type: 'string',
            description: 'Path to the video or animated GIF file, resolved by the filesystem backend.',
          },
        },
        required: ['file_path'],
      },
      output: {
        schema: {
          type: 'object',
          additionalProperties: false,
          properties: {
            path: { type: 'string' },
            video: {
              type: 'object',
              additionalProperties: false,
              properties: {
                attachmentId: { type: 'string' },
                mediaType: { type: 'string', enum: ['video/mp4', 'video/webm'] },
                bytes: { type: 'integer' },
                name: { type: 'string' },
                transcoded: { type: 'boolean' },
              },
              required: ['attachmentId', 'mediaType', 'bytes', 'name'],
            },
          },
          required: ['path', 'video'],
        },
        render: (_args: unknown, value: VideoReadValue) => [{ type: 'text', text: formatVideoReadOutput(value) }],
        presentationMeta: (_args: unknown, value: VideoReadValue) => ({ path: value.path }),
      },
      isConcurrencySafe: () => true,
      async execute(rawArgs: unknown, exec: ToolRunExec): Promise<VideoReadValue> {
        const filePath = typeof rawArgs === 'object' && rawArgs !== null && typeof (rawArgs as { file_path?: unknown }).file_path === 'string'
          ? (rawArgs as { file_path: string }).file_path
          : ''
        if (filePath.trim().length === 0) throw new Error('file_path must be a non-empty string')

        const extension = extname(filePath).toLowerCase()
        const declared = EXTENSION_MEDIA_TYPES[extension]
        if (declared === undefined && extension !== '') {
          throw new Error(`cannot read "${filePath}": the ${extension} extension does not declare a supported video format; read_video accepts MP4, WebM, MOV, MKV, AVI, and GIF files`)
        }
        assertGeminiAntigravityRoute(exec, filePath)

        const cwd = exec.agent?.session?.header?.cwd
        const target = await fs.resolve(filePath, { ...(cwd === undefined ? {} : { cwd }), signal: exec.signal })
        const info = await fs.stat(target, exec.signal)
        if (info === undefined) throw new Error(`cannot read "${target.displayPath}": not found`)
        if (info.type !== 'file') throw new Error(`cannot read "${target.displayPath}": not a regular file`)

        const rawBytes = await fs.readBytes(target, exec.signal, MAX_TRANSCODE_INPUT_BYTES)
        const sniffed = sniffVideoMediaType(rawBytes)
        const detected = sniffed ?? declared
        if (detected === undefined) {
          throw new Error(`cannot read "${target.displayPath}": file content is not a supported video or GIF container`)
        }

        let finalBytes: Uint8Array
        let finalMediaType: NativeVideoMediaType
        let transcoded = false
        if ((detected === 'video/mp4' || detected === 'video/webm') && rawBytes.byteLength <= maxVideoBytes) {
          finalBytes = rawBytes
          finalMediaType = detected
        } else {
          finalBytes = await transcodeToMp4(rawBytes, extension || '.mp4', maxVideoBytes, exec.signal)
          finalMediaType = 'video/mp4'
          transcoded = true
        }

        const base = basename(target.displayPath)
        const storedName = sanitizeAttrName(transcoded ? `${base.replace(/\.[^.]+$/, '')}.mp4` : base)
        const ref = await attachments.saveFile({ data: finalBytes, name: storedName })
        ;(scope as unknown as { emit(event: string, ...args: unknown[]): void }).emit(
          'fs/observed',
          target,
          { kind: 'present', version: info.version },
          exec,
        )
        return {
          path: target.displayPath,
          video: {
            attachmentId: ref.attachmentId,
            mediaType: finalMediaType,
            bytes: ref.bytes,
            name: ref.name,
            ...(transcoded ? { transcoded: true } : {}),
          },
        }
      },
      presentCall(rawArgs: unknown) {
        const filePath = typeof rawArgs === 'object' && rawArgs !== null && typeof (rawArgs as { file_path?: unknown }).file_path === 'string'
          ? (rawArgs as { file_path: string }).file_path
          : ''
        return { card: 'generic', summary: filePath }
      },
    })
  })
}
