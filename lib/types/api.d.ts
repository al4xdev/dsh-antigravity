import type { AssistantMessageEventStream, Context, Model, ProviderStreams, StreamOptions } from '@earendil-works/pi-ai';
import type { AntiGravityApi } from './models.ts';
export declare const MAX_SSE_EVENT_BYTES: number;
export declare const MAX_INFERENCE_STREAM_BYTES: number;
export declare const MAX_INFERENCE_BLOCKS = 4096;
export declare const MAX_ERROR_BODY_BYTES: number;
export declare const DEFAULT_INFERENCE_TIMEOUT_MS = 600000;
/** Native event stream; iterator early-return also cancels its producer and settles result(). */
export declare function streamAntiGravity(model: Model<AntiGravityApi>, context: Context, options?: StreamOptions): AssistantMessageEventStream;
export declare const antiGravityApi: ProviderStreams;
