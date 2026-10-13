/** Safe reported quota metadata, separate from model capabilities and token usage. */
export declare const MAX_QUOTA_ROWS = 256;
export type UsageErrorCode = 'not-connected' | 'auth' | 'rate-limit' | 'unavailable' | 'schema' | 'timeout';
export interface AntiGravityUsageRow {
    readonly id: string;
    readonly name: string;
    readonly remainingFraction?: number;
    readonly resetAtMs?: number;
    readonly window: 'unknown';
}
export interface AntiGravityUsageSnapshot {
    readonly source: 'fetchAvailableModels';
    readonly observedAtMs: number;
    readonly stale: boolean;
    readonly status: 'available' | 'unavailable';
    readonly rows: readonly AntiGravityUsageRow[];
    readonly truncated: boolean;
    readonly error?: UsageErrorCode;
}
export declare class QuotaPayloadError extends Error {
    readonly code = "QUOTA_SCHEMA";
    constructor();
}
/** Only explicit, representable RFC3339 timestamps; never guess epoch units/window. */
export declare function parseQuotaReset(value: unknown): number | undefined;
/** Allowlisted DTO only: never return response bodies, project IDs or OAuth data. */
export declare function parseModelQuotaSnapshot(payload: unknown, observedAtMs: number): AntiGravityUsageSnapshot;
/** Human output avoids rounding a positive balance to zero or promising a 5h reset. */
export declare function formatUsageSnapshot(snapshot: AntiGravityUsageSnapshot, now?: number): string;
