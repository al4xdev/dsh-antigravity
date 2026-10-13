import type { LlmFailure } from '@deepseek-ai/dsh-llm';
import type { AntiGravityUsageSnapshot } from './quota.ts';
export declare const MAX_QUOTA_WAIT_MS = 86400000;
export declare const QUOTA_RESET_RETRY_CODE = "ANTIGRAVITY_QUOTA_RESET";
export declare const QUOTA_RESET_LIMIT_CODE = "ANTIGRAVITY_QUOTA_RESET_LIMIT";
export interface QuotaResetRetryConfig {
    enabled?: boolean;
    maxWaitMs?: number;
}
export interface ResolvedQuotaResetRetry {
    readonly enabled: boolean;
    readonly maxWaitMs: number;
}
export declare function resolveQuotaResetRetry(config: QuotaResetRetryConfig | undefined): ResolvedQuotaResetRetry;
/** Only a fresh exact-model reset authorizes a quota wait; missing fraction is not zero. */
export declare function quotaResetFailure(failure: Readonly<LlmFailure>, model: string, snapshot: AntiGravityUsageSnapshot, failedAtMs: number, nowMs: number, maxWaitMs?: number): Readonly<LlmFailure>;
