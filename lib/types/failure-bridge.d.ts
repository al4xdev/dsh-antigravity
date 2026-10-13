import type { GenerateOptions, PreparedAdapterCall, StreamChunk } from '@deepseek-ai/dsh-llm';
import { PiAiAdapter } from '@deepseek-ai/dsh-llm-pi-ai';
import type { AntiGravityFailureData } from './failure.ts';
/**
 * Capture the request before starting the provider's asynchronous producer.
 * Late callbacks and calls outside this adapter cannot affect another request.
 */
export declare function captureFailureReporter(): (failure: Readonly<AntiGravityFailureData>) => void;
/** Provider-owned bridge; retries are exclusively the official host's job. */
export declare class AntiGravityAdapter extends PiAiAdapter {
    stream(options: GenerateOptions): AsyncIterable<StreamChunk>;
    prepareCall(provider: string, model: string, signal?: AbortSignal): Promise<PreparedAdapterCall>;
}
