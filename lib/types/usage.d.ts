import { Service } from '@deepseek-ai/cordis';
import type { Context } from '@deepseek-ai/cordis';
import type { AntiGravityCredentialManager } from './credential.ts';
import type { AntiGravityUsageSnapshot } from './quota.ts';
export declare const USAGE_TTL_MS = 60000;
export declare const USAGE_DEADLINE_MS = 10000;
export declare const MAX_USAGE_BODY_BYTES: number;
export interface UsageRequest {
    readonly refresh?: boolean;
    readonly signal?: AbortSignal;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        antiGravityUsage: AntiGravityUsageService;
    }
}
/** On-demand metadata only: no inference, polling, billing or retry policy changes. */
export declare class AntiGravityUsageService extends Service {
    private readonly credentials;
    private cache;
    private flight;
    private generation;
    private disposed;
    private readonly pending;
    constructor(ctx: Context, credentials: Pick<AntiGravityCredentialManager, 'resolveCredential'>);
    /** Request-local recovery uses this epoch to reject observations after account changes. */
    get observationGeneration(): number;
    /** Invalidate both cached and pending observations when the account reference changes. */
    invalidate(): void;
    /** One caller may cancel without cancelling other callers sharing the fetch. */
    snapshot(request?: UsageRequest): Promise<AntiGravityUsageSnapshot>;
    private fetchSnapshot;
}
/** Reuse the official command registry; no provider-specific Remote/client build is needed. */
export declare function registerUsageCommand(ctx: Context, usage: AntiGravityUsageService): void;
