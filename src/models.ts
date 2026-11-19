/** Maintained and live-reconciled Anti Gravity model descriptors. */

import type { Credential, Model, RefreshModelsContext } from '@earendil-works/pi-ai'
import { antiGravityHeaders } from './auth.ts'

/** Private pi-ai API identity owned by this provider plugin. */
export type AntiGravityApi = 'google-antigravity'
/** Stable route and provider identity registered with the generic adapter. */
export const PROVIDER = 'google-antigravity'
/** Cloud Code Assist endpoints in provider-preferred fallback order. */
export const ENDPOINTS = [
  // ANTIGRAVITY_BASE_URL prepends a local recorder (tools/antigravity-proxy); the real
  // hosts stay behind it, so a proxy that is not running costs one failed connect and
  // the next endpoint answers. No other code path needs to know the proxy exists.
  process.env.ANTIGRAVITY_BASE_URL?.replace(/\/+$/, ''),
  'https://daily-cloudcode-pa.googleapis.com',
  'https://cloudcode-pa.googleapis.com',
].filter((endpoint): endpoint is string => typeof endpoint === 'string' && endpoint.length > 0)

const NO_COST = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 }

/** Effort tiers the provider can express through `thinkingConfig`; `all` exposes the
 * four Gemini families accept without pinning one. */
type EffortLevel = 'minimal' | 'low' | 'medium' | 'high' | 'xhigh'

function thinkingLevelMapFor(level: EffortLevel | 'all'): Record<string, string | null> {
  const levels: EffortLevel[] = ['minimal', 'low', 'medium', 'high', 'xhigh']
  const exposed = level === 'all' ? levels.slice(0, 4) : [level]
  return Object.fromEntries(levels.map(entry => [entry, exposed.includes(entry) ? entry : null]))
}

function descriptor(
  id: string,
  name: string,
  family: 'gemini' | 'claude' | 'gpt',
  level: EffortLevel | 'all',
): Model<AntiGravityApi> {
  const isClaude55 = id.startsWith('claude-opus-5-5-') || id.startsWith('claude-sonnet-5-5-')
  const isGemini4Neon = id.startsWith('gemini-4-neon-') || id === 'gemini-pro-orchestrator-neon'
  const contextWindow = family === 'gemini' ? 1_048_576 : isClaude55 ? 1_000_000 : family === 'claude' ? 200_000 : 131_072
  // Keep Hydrogen at 65_536 so Companion's AGY_OUTPUT_CAP (65536) guard remains satisfied;
  // Neon uses the 262_144 maxOutputTokens observed in fetchAvailableModels and agy wire payloads.
  const maxTokens = isGemini4Neon ? 262_144 : isClaude55 ? 128_000 : 65_536
  return {
    id,
    name,
    api: 'google-antigravity',
    provider: PROVIDER,
    baseUrl: ENDPOINTS[0],
    reasoning: true,
    thinkingLevelMap: { off: null, ...thinkingLevelMapFor(level), max: null },
    input: ['text', 'image'],
    cost: NO_COST,
    contextWindow,
    maxTokens,
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

/** Effort tier encoded in the id suffix, e.g. `gemini-4-neon-xhigh`. */
function levelOfId(id: string): EffortLevel | undefined {
  const match = /-(minimal|low|medium|high|xhigh)$/.exec(id)
  if (match === null) return undefined
  return match[1] as EffortLevel
}

function levelOfLiveEntry(value: unknown): EffortLevel | undefined {
  if (value === 1) return 'low'
  if (value === 2) return 'medium'
  if (value === 3) return 'high'
  if (value === 100) return 'xhigh'
  if (typeof value === 'string') {
    const lower = value.toLowerCase()
    if (lower === 'minimal' || lower === 'low' || lower === 'medium' || lower === 'high' || lower === 'xhigh') {
      return lower
    }
  }
  return undefined
}

function positiveInt(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 ? value : undefined
}

/** Fallback display name for an id the response left without a `displayName`. */
function titleOfId(id: string): string {
  return id
    .split(/[-_/]/)
    .filter(part => part.length > 0)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ')
}

interface LiveModelEntry {
  displayName?: unknown
  disabled?: unknown
  isInternal?: unknown
  maxTokens?: unknown
  maxOutputTokens?: unknown
  thinkingLevel?: unknown
}

/**
 * Build a descriptor for an account-visible id the reviewed list does not cover.
 * An unknown family keeps the conservative 131k window, and an id without a tier
 * suffix or live thinkingLevel exposes the four Gemini tiers instead of hiding a model.
 * @param id - live model id from `fetchAvailableModels`.
 * @param entry - live catalog entry carrying optional display name and limits.
 * @returns descriptor using only facts inferable without a review pass.
 */
function discoveredModel(id: string, entry: LiveModelEntry): Model<AntiGravityApi> {
  const family = familyOfId(id)
  const level = levelOfId(id) ?? levelOfLiveEntry(entry.thinkingLevel)
  const name = typeof entry.displayName === 'string' && entry.displayName.length > 0 ? entry.displayName : titleOfId(id)
  const isClaude55 = id.startsWith('claude-opus-5-5-') || id.startsWith('claude-sonnet-5-5-')
  const isGemini4Neon = id.startsWith('gemini-4-neon-') || id === 'gemini-pro-orchestrator-neon'
  const contextWindow = positiveInt(entry.maxTokens)
    ?? (family === 'gemini' ? 1_048_576 : isClaude55 ? 1_000_000 : family === 'claude' ? 200_000 : 131_072)
  const maxTokens = positiveInt(entry.maxOutputTokens)
    ?? (isGemini4Neon ? 262_144 : isClaude55 ? 128_000 : 65_536)
  return {
    id,
    name,
    api: 'google-antigravity',
    provider: PROVIDER,
    baseUrl: ENDPOINTS[0],
    reasoning: true,
    thinkingLevelMap: { off: null, ...thinkingLevelMapFor(level ?? 'all'), max: null },
    input: ['text', 'image'],
    cost: NO_COST,
    contextWindow,
    maxTokens,
  }
}

/** Reviewed descriptors; the account-visible catalog is always reconciled online before display. */
export const maintainedModels: readonly Model<AntiGravityApi>[] = [
  descriptor('gemini-4-neon-xhigh', 'Gemini 4 Neon (XHigh)', 'gemini', 'xhigh'),
  descriptor('gemini-4-neon-high', 'Gemini 4 Neon (High)', 'gemini', 'high'),
  descriptor('gemini-4-neon-medium', 'Gemini 4 Neon (Medium)', 'gemini', 'medium'),
  descriptor('gemini-4-neon-low', 'Gemini 4 Neon (Low)', 'gemini', 'low'),
  descriptor('gemini-4-argon-high', 'Gemini 4 Argon (High)', 'gemini', 'high'),
  descriptor('gemini-4-argon-medium', 'Gemini 4 Argon (Medium)', 'gemini', 'medium'),
  descriptor('gemini-4-argon-low', 'Gemini 4 Argon (Low)', 'gemini', 'low'),
  descriptor('gemini-4-hydrogen-xhigh', 'Gemini 4 Hydrogen (XHigh)', 'gemini', 'xhigh'),
  descriptor('gemini-4-hydrogen-high', 'Gemini 4 Hydrogen (High)', 'gemini', 'high'),
  descriptor('gemini-4-hydrogen-medium', 'Gemini 4 Hydrogen (Medium)', 'gemini', 'medium'),
  descriptor('gemini-4-hydrogen-low', 'Gemini 4 Hydrogen (Low)', 'gemini', 'low'),
  descriptor('gemini-pro-orchestrator-neon', 'Orchestrator (Neon)', 'gemini', 'xhigh'),
  descriptor('gemini-pro-orchestrator-g1-pro', 'Orchestrator (Argon)', 'gemini', 'high'),
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
  // The provider serves one id and accepts minimal/low/medium/high for it (pi-ai's
  // catalog agrees), but this adapter expresses effort through the id, so one level is
  // pinned here and `defaultThinkingConfig` sends exactly that one.
  descriptor('gemini-3.5-flash-lite', 'Gemini 3.5 Flash Lite', 'gemini', 'medium'),
  descriptor('gemini-3.1-pro-high', 'Gemini 3.1 Pro (High)', 'gemini', 'high'),
  descriptor('gemini-3.1-pro-low', 'Gemini 3.1 Pro (Low)', 'gemini', 'low'),
  descriptor('claude-opus-5-5-high', 'Claude Opus 5.5 (High)', 'claude', 'high'),
  descriptor('claude-opus-5-5-medium', 'Claude Opus 5.5 (Medium)', 'claude', 'medium'),
  descriptor('claude-opus-5-5-low', 'Claude Opus 5.5 (Low)', 'claude', 'low'),
  descriptor('claude-sonnet-5-5-high', 'Claude Sonnet 5.5 (High)', 'claude', 'high'),
  descriptor('claude-sonnet-5-5-medium', 'Claude Sonnet 5.5 (Medium)', 'claude', 'medium'),
  descriptor('claude-sonnet-5-5-low', 'Claude Sonnet 5.5 (Low)', 'claude', 'low'),
  descriptor('claude-sonnet-4-6', 'Claude Sonnet 4.6 (Thinking)', 'claude', 'high'),
  descriptor('claude-opus-4-6-thinking', 'Claude Opus 4.6 (Thinking)', 'claude', 'high'),
  descriptor('gpt-oss-120b-medium', 'GPT-OSS 120B (Medium)', 'gpt', 'medium'),
]

interface AvailableModelsResponse {
  models?: Record<string, LiveModelEntry>
}

function isSelectableEntry(entry: LiveModelEntry | undefined): entry is LiveModelEntry {
  return entry !== undefined && entry !== null && typeof entry === 'object'
    && entry.disabled !== true && entry.isInternal !== true
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
    if (!isSelectableEntry(entry)) return []
    const name = typeof entry.displayName === 'string' && entry.displayName.length > 0 ? entry.displayName : model.name
    return [{ ...model, name }]
  })
  const discovered = Object.entries(live)
    // The response also lists internal/disabled ids (`chat_*`, `tab_*`, `*-tiered`,
    // `*-disabled`) that are not selectable products.
    .filter(([id, entry]) => !reviewed.has(id) && isSelectableEntry(entry) && typeof entry.displayName === 'string' && entry.displayName.length > 0)
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
