/** Request-local safe failures across the pi-ai event and Harness stream seams. */
import { AsyncLocalStorage } from 'node:async_hooks'
import { LlmError } from '@deepseek-ai/dsh-llm'
import type { GenerateOptions, LlmFailure, PreparedAdapterCall, StreamChunk } from '@deepseek-ai/dsh-llm'
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai'
import type { AntiGravityFailureData } from './failure.ts'

interface FailureContext {
  active: boolean
  failure?: Readonly<LlmFailure>
}
const requestFailures = new AsyncLocalStorage<FailureContext>()

/**
 * Capture the request before starting the provider's asynchronous producer.
 * Late callbacks and calls outside this adapter cannot affect another request.
 */
export function captureFailureReporter(): (failure: Readonly<AntiGravityFailureData>) => void {
  const context = requestFailures.getStore()
  return failure => {
    if (context === undefined || !context.active || context.failure !== undefined) return
    // Select only Harness failure facts. Provider-only diagnostics such as
    // partial/reason/window never become a retry policy or a raw error carrier.
    try {
      const error = new LlmError(failure.message, failure.code, {
        ...failure.status === undefined ? {} : { status: failure.status },
        ...failure.providerRetryAfterMs === undefined ? {} : { providerRetryAfterMs: failure.providerRetryAfterMs },
      })
      context.failure = error.failure
    } catch {
      // A malformed observer payload must not prevent the producer from settling
      // its own error event. Leave the original error to the official host.
    }
  }
}

function cancellationOrTimeout(error: unknown): boolean {
  return error instanceof LlmError && (error.code === 'ABORTED' || error.code === 'TIMEOUT')
}

function bridgedError(error: unknown, context: FailureContext, signal: AbortSignal): unknown {
  if (signal.aborted) return new LlmError('Anti Gravity request cancelled', 'ABORTED')
  if (cancellationOrTimeout(error) || context.failure === undefined) return error
  return new LlmError(context.failure.message, context.failure.code, {
    ...context.failure.status === undefined ? {} : { status: context.failure.status },
    ...context.failure.providerRetryAfterMs === undefined ? {} : { providerRetryAfterMs: context.failure.providerRetryAfterMs },
  })
}

function terminalChunk(chunk: StreamChunk, context: FailureContext, signal: AbortSignal): StreamChunk {
  if (chunk.type !== 'finish') return chunk
  const existing = chunk.reason
  if (existing.kind === 'aborted') return chunk
  if (signal.aborted) {
    const { replayState: _successfulReplay, ...terminal } = chunk
    return { ...terminal, reason: { kind: 'aborted', failure: new LlmError('Anti Gravity request cancelled', 'ABORTED').failure } }
  }
  if (existing.kind === 'error' && (existing.failure.code === 'ABORTED' || existing.failure.code === 'TIMEOUT')) return chunk
  if (context.failure === undefined) return chunk
  // A failed response must not carry a successful replay envelope. All other
  // chunks (including partial tool ids, signatures and usage) pass unchanged.
  const { replayState: _successfulReplay, ...terminal } = chunk
  return { ...terminal, reason: { kind: context.failure.code === 'ABORTED' ? 'aborted' : 'error', failure: context.failure } }
}

/**
 * Wrap one dispatch, not an adapter generation. The iterator methods must run
 * inside ALS: constructing a lazy async generator inside run alone does not
 * execute its body. An owned abort also interrupts a pending next on return.
 */
function requestStream(
  options: GenerateOptions,
  dispatch: (options: GenerateOptions) => AsyncIterable<StreamChunk>,
): AsyncIterable<StreamChunk> {
  return {
    [Symbol.asyncIterator]() {
      const context: FailureContext = { active: true }
      const consumer = new AbortController()
      const signal = options.signal === undefined ? consumer.signal : AbortSignal.any([options.signal, consumer.signal])
      const request = { ...options, signal }
      let iterator: AsyncIterator<StreamChunk> | undefined
      let exhausted = false
      const run = <T>(operation: () => T): T => requestFailures.run(context, operation)
      const generator = (async function* () {
        try {
          if (signal.aborted) throw new LlmError('Anti Gravity request cancelled', 'ABORTED')
          try {
            iterator = run(() => dispatch(request)[Symbol.asyncIterator]())
          } catch (error) {
            throw bridgedError(error, context, signal)
          }
          while (true) {
            let result: IteratorResult<StreamChunk>
            try {
              result = await run(() => iterator!.next())
            } catch (error) {
              throw bridgedError(error, context, signal)
            }
            if (result.done) {
              exhausted = true
              if (context.failure !== undefined) throw bridgedError(new Error('Anti Gravity stream failed'), context, signal)
              return
            }
            const chunk = terminalChunk(result.value, context, signal)
            if (chunk.type === 'finish') {
              context.active = false
              context.failure = undefined
              yield chunk
              return
            }
            yield chunk
          }
        } finally {
          context.active = false
          context.failure = undefined
          consumer.abort()
          // Do not convert teardown/consumer errors into provider retry failures.
          if (!exhausted && iterator?.return !== undefined) await run(() => iterator!.return!())
        }
      })()
      return {
        next: () => generator.next(),
        return: async () => {
          context.active = false
          context.failure = undefined
          consumer.abort()
          return generator.return()
        },
        throw: async error => {
          context.active = false
          context.failure = undefined
          consumer.abort()
          return generator.throw(error)
        },
      }
    },
  }
}

/** Provider-owned bridge; retries are exclusively the official host's job. */
export class AntiGravityAdapter extends PiAiAdapter {
  override stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    return requestStream(options, request => super.stream(request))
  }

  override async prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall> {
    const prepared = await super.prepareCall(provider, model, signal)
    // Calling this.stream here would re-read profiles and break the generation
    // freeze. Keep the exact model descriptor and captured prepared dispatcher.
    return { ...prepared, stream: options => requestStream(options, request => prepared.stream(request)) }
  }
}
