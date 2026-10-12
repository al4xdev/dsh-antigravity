/** Opt-in native Google Search using the existing Cloud Code Assist OAuth route. */
import type { WebSearchProvider, WebSearchRequest, WebSearchResult } from '@deepseek-ai/dsh-web';
import type { AntiGravityCredentialManager } from './credential.ts';
export declare const DEFAULT_SEARCH_MODEL = "gemini-3.8-flash-low";
export declare class AntiGravitySearchProvider implements WebSearchProvider {
    private readonly credentials;
    private readonly model;
    readonly id = "google-antigravity";
    constructor(credentials: Pick<AntiGravityCredentialManager, 'resolveCredential'>, model?: string);
    available(): boolean;
    search(request: WebSearchRequest, signal?: AbortSignal): Promise<WebSearchResult>;
}
