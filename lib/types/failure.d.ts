/** Provider-owned, sanitized failures; no backend text or payload crosses this boundary. */
export type AntiGravityFailureReason = 'rate-limit' | 'quota' | 'auth' | 'billing' | 'policy' | 'server' | 'transport' | 'timeout' | 'aborted' | 'empty' | 'protocol';
export type AntiGravityFailureCode = 'RATE_LIMIT' | 'QUOTA_EXCEEDED' | 'AUTH' | 'INVALID_REQUEST' | 'SERVER' | 'TRANSPORT' | 'TIMEOUT' | 'ABORTED' | 'EMPTY_RESPONSE' | 'PI_AI_ERROR';
export type AntiGravityFailurePhase = 'auth' | 'payload-hook' | 'payload-guard' | 'response-hook' | 'fetch' | 'http-error' | 'sse-error' | 'sse-terminal' | 'sse' | 'timeout' | 'cancelled';
export type AntiGravityTerminalCategory = 'blocked' | 'other' | 'malformed-function-call' | 'unknown';
export type AntiGravityTerminalReason = 'SAFETY' | 'RECITATION' | 'LANGUAGE' | 'BLOCKLIST' | 'PROHIBITED_CONTENT' | 'SPII';
export interface AntiGravityFailureData {
    readonly code: AntiGravityFailureCode;
    readonly message: string;
    readonly status?: number;
    readonly providerRetryAfterMs?: number;
    readonly reason: AntiGravityFailureReason;
    readonly quotaWindow: 'unknown';
    readonly partial: boolean;
    readonly phase?: AntiGravityFailurePhase;
    readonly terminalCategory?: AntiGravityTerminalCategory;
    readonly terminalReason?: AntiGravityTerminalReason;
}
export declare class AntiGravityFailure extends Error {
    readonly failure: AntiGravityFailureData;
    readonly code: AntiGravityFailureCode;
    constructor(code: AntiGravityFailureCode, reason: AntiGravityFailureReason, options?: {
        status?: number;
        providerRetryAfterMs?: number;
        partial?: boolean;
        phase?: AntiGravityFailurePhase;
        terminalCategory?: AntiGravityTerminalCategory;
        terminalReason?: AntiGravityTerminalReason;
    });
}
/** HTTP delay-seconds are seconds, not milliseconds. Dates use the server clock when supplied. */
export declare function parseRetryAfterMs(value: string | null | undefined, dateHeader?: string | null, nowMs?: number): number | undefined;
export declare function parseRetryInfoDelayMs(payload: unknown): number | undefined;
/** Known structured reasons only; an English quota message or long delay is not quota evidence. */
export declare function parseAntiGravityFailure(status: number | undefined, payload: unknown, headers?: Pick<Headers, 'get'>, partial?: boolean): AntiGravityFailure;
