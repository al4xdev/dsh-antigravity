/** Maintained and live-reconciled Anti Gravity model descriptors. */

import type { Credential, Model, RefreshModelsContext } from '@earendil-works/pi-ai'
import { antiGravityHeaders } from './auth.ts'

/** Private pi-ai API identity owned by this provider plugin. */
export type AntiGravityApi = 'google-antigravity'
/** Stable route and provider identity registered with the generic adapter. */
export const PROVIDER = 'google-antigravity'
/** Cloud Code Assist endpoints in provider-preferred fallback order. */
export const ENDPOINTS = [
  'https://daily-cloudcode-pa.googleapis.com',
  'https://cloudcode-pa.googleapis.com',
] as const

const NO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

function descriptor(
  id: string,
  name: string,
  family: 'gemini' | 'claude' | 'gpt',
  level: 'low' | 'medium' | 'high',
): Model<AntiGravityApi> {
  const contextWindow = family === 'gemini' ? 1_048_576 : family === 'claude' ? 200_000 : 131_072
  return {
    id,
    name,
    api: 'google-antigravity',
    provider: PROVIDER,
    baseUrl: ENDPOINTS[0],
    reasoning: true,
    thinkingLevelMap: {
      off: null,
      minimal: null,
      low: level === 'low' ? 'low' : null,
      medium: level === 'medium' ? 'medium' : null,
      high: level === 'high' ? 'high' : null,
      xhigh: null,
      max: null,
    },
    input: ['text', 'image'],
    cost: NO_COST,
    contextWindow,
    maxTokens: 65_536,
  }
}

/** Provider family guessed from a live model id when no reviewed entry exists. */
function familyOfId(id: string): 'gemini' | 'claude' | 'gpt' | undefined {
  const lower = id.toLowerCase()
  if (lower.startsWith('gemini')) return 'gemini'
  if (lower.startsWith('claude')) return 'claude'
  if (lower.startsWith('gpt')) return 'gpt'
  return undefined
}

/** Effort tier encoded in the id suffix, e.g. `gemini-4.0-flash-high`. */
function levelOfId(id: string): 'low' | 'medium' | 'high' | undefined {
  const match = /-(low|medium|high)$/.exec(id)
  if (match === null) return undefined
  return match[1] as 'low' | 'medium' | 'high'
}

/** Fallback display name for an id the response left without a `displayName`. */
function titleOfId(id: string): string {
  return id
    .split(/[-_/]/)
    .filter(part => part.length > 0)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Build a descriptor for an account-visible id the reviewed list does not cover.
 * An unknown family keeps the conservative 131k window, and an id without a tier
 * suffix exposes every effort instead of hiding a model we simply do not know.
 * @param id - live model id from `fetchAvailableModels`.
 * @param entry - live catalog entry carrying the optional display name.
 * @returns descriptor using only facts inferable without a review pass.
 */
function discoveredModel(id: string, entry: { displayName?: unknown }): Model<AntiGravityApi> {
  const family = familyOfId(id)
  const level = levelOfId(id)
  const name = typeof entry.displayName === 'string' && entry.displayName.length > 0 ? entry.displayName : titleOfId(id)
  const contextWindow = family === 'gemini' ? 1_048_576 : family === 'claude' ? 200_000 : 131_072
  return {
    id,
    name,
    api: 'google-antigravity',
    provider: PROVIDER,
    baseUrl: ENDPOINTS[0],
    reasoning: true,
    thinkingLevelMap: {
      off: null,
      minimal: null,
      low: level === undefined || level === 'low' ? 'low' : null,
      medium: level === undefined || level === 'medium' ? 'medium' : null,
      high: level === undefined || level === 'high' ? 'high' : null,
      xhigh: null,
      max: null,
    },
    input: ['text', 'image'],
    cost: NO_COST,
    contextWindow,
    maxTokens: 65_536,
  }
}

/** Reviewed descriptors; the account-visible catalog is always reconciled online before display. */
export const maintainedModels: readonly Model<AntiGravityApi>[] = [
  descriptor('gemini-3.8-flash-high', 'Gemini 3.8 Flash (High)', 'gemini', 'high'),
  descriptor('gemini-3.8-flash-medium', 'Gemini 3.8 Flash (Medium)', 'gemini', 'medium'),
  descriptor('gemini-3.8-flash-low', 'Gemini 3.8 Flash (Low)', 'gemini', 'low'),
  descriptor('gemini-3.7-flash-high', 'Gemini 3.7 Flash (High)', 'gemini', 'high'),
  descriptor('gemini-3.7-flash-medium', 'Gemini 3.7 Flash (Medium)', 'gemini', 'medium'),
  descriptor('gemini-3.7-flash-low', 'Gemini 3.7 Flash (Low)', 'gemini', 'low'),
  descriptor('gemini-3.6-flash-high', 'Gemini 3.6 Flash (High)', 'gemini', 'high'),
  descriptor('gemini-3.6-flash-medium', 'Gemini 3.6 Flash (Medium)', 'gemini', 'medium'),
  descriptor('gemini-3.6-flash-low', 'Gemini 3.6 Flash (Low)', 'gemini', 'low'),
  descriptor('gemini-3.5-flash-high', 'Gemini 3.5 Flash (High)', 'gemini', 'high'),
  descriptor('gemini-3.5-flash-medium', 'Gemini 3.5 Flash (Medium)', 'gemini', 'medium'),
  descriptor('gemini-3.5-flash-low', 'Gemini 3.5 Flash (Low)', 'gemini', 'low'),
  descriptor('gemini-3.1-pro-high', 'Gemini 3.1 Pro (High)', 'gemini', 'high'),
  descriptor('gemini-3.1-pro-low', 'Gemini 3.1 Pro (Low)', 'gemini', 'low'),
  descriptor('claude-sonnet-4-6', 'Claude Sonnet 4.6 (Thinking)', 'claude', 'high'),
  descriptor('claude-opus-4-6-thinking', 'Claude Opus 4.6 (Thinking)', 'claude', 'high'),
  descriptor('gpt-oss-120b-medium', 'GPT-OSS 120B (Medium)', 'gpt', 'medium'),
]

interface AvailableModelsResponse {
  models?: Record<string, { displayName?: unknown }>
}

/**
 * Union the maintained descriptors with one official `fetchAvailableModels` response.
 * A missing reviewed entry no longer hides a live model; it only costs the review
 * metadata, which `discoveredModel` reconstructs from the id.
 * @param payload - decoded Cloud Code Assist response body.
 * @returns reviewed descriptors plus every live id they do not cover.
 */
export function parseAvailableModels(payload: unknown): readonly Model<AntiGravityApi>[] {
  if (typeof payload !== 'object' || payload === null || typeof (payload as AvailableModelsResponse).models !== 'object') {
    throw new Error('Anti Gravity model response must contain a models object')
  }
  const live = (payload as Required<AvailableModelsResponse>).models
  const reviewed = new Set(maintainedModels.map(model => model.id))
  const maintained = maintainedModels.flatMap((model) => {
    const entry = live[model.id]
    if (entry === undefined) return []
    const name = typeof entry.displayName === 'string' && entry.displayName.length > 0 ? entry.displayName : model.name
    return [{ ...model, name }]
  })
  const discovered = Object.entries(live)
    // The response also lists internal ids (`chat_*`, `tab_*`, `*-tiered`) that are
    // not selectable products; every real model carries a display name and they do not.
    .filter(([id, entry]) => !reviewed.has(id) && typeof entry.displayName === 'string' && entry.displayName.length > 0)
    .map(([id, entry]) => discoveredModel(id, entry))
  return [...maintained, ...discovered]
}

/**
 * Fetch the account-authorized model list, retaining no quota or account fields.
 * @param context - pi-ai refresh context containing the OAuth credential and cancellation signal.
 * @returns reviewed account-visible Anti Gravity descriptors.
 */
export async function fetchAvailableModels(context: RefreshModelsContext): Promise<readonly Model<AntiGravityApi>[]> {
  const credential = context.credential
  return fetchAvailableModelsForCredential(credential, context.signal)
}

/**
 * Fetch the account-authorized model list from an explicitly resolved OAuth credential.
 * @param credential - current credential resolved by this plugin.
 * @param signal - optional cancellation signal.
 * @returns reviewed account-visible Anti Gravity descriptors.
 */
export async function fetchAvailableModelsForCredential(
  credential: Credential | undefined,
  signal?: AbortSignal,
): Promise<readonly Model<AntiGravityApi>[]> {
  if (credential?.type !== 'oauth'
    || typeof credential.projectId !== 'string'
    || credential.projectId.length === 0) {
    throw new Error('Anti Gravity model discovery requires an OAuth credential with a project id')
  }
  let lastStatus: number | undefined
  for (const endpoint of ENDPOINTS) {
    const response = await fetch(`${endpoint}/v1internal:fetchAvailableModels`, {
      method: 'POST',
      headers: antiGravityHeaders(credential.access),
      body: JSON.stringify({ project: credential.projectId }),
      ...signal === undefined ? {} : { signal },
    })
    if (response.ok) {
      const models = parseAvailableModels(await response.json())
      if (models.length === 0) throw new Error('Anti Gravity returned no maintained models')
      return models
    }
    lastStatus = response.status
    if (![403, 404, 429, 500, 502, 503, 504].includes(response.status)) break
  }
  throw new Error(`Anti Gravity model discovery failed with HTTP ${lastStatus ?? 'unknown'}`)
}
