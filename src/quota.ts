/** Safe reported quota metadata, separate from model capabilities and token usage. */
export const MAX_QUOTA_ROWS = 256
export type UsageErrorCode = 'not-connected' | 'auth' | 'rate-limit' | 'unavailable' | 'schema' | 'timeout'
export interface AntiGravityUsageRow {
  readonly id: string
  readonly name: string
  readonly remainingFraction?: number
  readonly resetAtMs?: number
  readonly window: 'unknown'
}
export interface AntiGravityUsageSnapshot {
  readonly source: 'fetchAvailableModels'
  readonly observedAtMs: number
  readonly stale: boolean
  readonly status: 'available' | 'unavailable'
  readonly rows: readonly AntiGravityUsageRow[]
  readonly truncated: boolean
  readonly error?: UsageErrorCode
}
export class QuotaPayloadError extends Error {
  readonly code = 'QUOTA_SCHEMA'
  constructor() { super('Anti Gravity quota metadata has an unsupported shape'); this.name = 'QuotaPayloadError' }
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function timestamp(value: number): boolean {
  return Number.isFinite(value) && Math.abs(value) <= 8_640_000_000_000_000
}
function label(value: string, max = 120): string {
  // Command output is persisted; strip controls, ANSI escapes and bidi overrides.
  return value.replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, '')
    .replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, max)
}
/** Only explicit, representable RFC3339 timestamps; never guess epoch units/window. */
export function parseQuotaReset(value: unknown): number | undefined {
  if (typeof value !== 'string') return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.exec(value)
  if (!match) return undefined
  const [, y, mo, day, h, mi, sec, zone] = match
  const year = Number(y), month = Number(mo), date = Number(day)
  if (month < 1 || month > 12 || date < 1 || Number(h) > 23 || Number(mi) > 59 || Number(sec) > 59) return undefined
  const calendar = new Date(0)
  calendar.setUTCFullYear(year, month - 1, date)
  if (calendar.getUTCFullYear() !== year || calendar.getUTCMonth() !== month - 1 || calendar.getUTCDate() !== date) return undefined
  if (zone !== 'Z' && (Number(zone.slice(1, 3)) > 23 || Number(zone.slice(4)) > 59)) return undefined
  const milliseconds = Date.parse(value)
  return Number.isFinite(milliseconds) ? milliseconds : undefined
}
/** Allowlisted DTO only: never return response bodies, project IDs or OAuth data. */
export function parseModelQuotaSnapshot(payload: unknown, observedAtMs: number): AntiGravityUsageSnapshot {
  if (!timestamp(observedAtMs) || !record(payload) || !record(payload.models)) throw new QuotaPayloadError()
  const rows: AntiGravityUsageRow[] = []
  let truncated = false
  for (const [id, entry] of Object.entries(payload.models)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/.test(id) || /^(chat_|tab_)|(?:-tiered)$/.test(id) || !record(entry)) continue
    const quota = record(entry.quotaInfo) ? entry.quotaInfo : undefined
    const displayName = typeof entry.displayName === 'string' ? label(entry.displayName) : ''
    if (!displayName && !quota) continue
    if (rows.length >= MAX_QUOTA_ROWS) { truncated = true; break }
    const fraction = quota?.remainingFraction
    const remainingFraction = typeof fraction === 'number' && Number.isFinite(fraction) && fraction >= 0 && fraction <= 1 ? fraction : undefined
    const resetAtMs = parseQuotaReset(quota?.resetTime)
    rows.push(Object.freeze({
      id, name: displayName || id, window: 'unknown',
      ...(remainingFraction === undefined ? {} : { remainingFraction }),
      ...(resetAtMs === undefined ? {} : { resetAtMs }),
    }))
  }
  return Object.freeze({ source: 'fetchAvailableModels', observedAtMs, stale: false,
    status: 'available', rows: Object.freeze(rows), truncated })
}
function percent(fraction: number | undefined): string {
  if (fraction === undefined || !Number.isFinite(fraction) || fraction < 0 || fraction > 1) return 'desconhecida'
  if (fraction === 0) return '0%'
  if (fraction === 1) return '100%'
  if (fraction < 0.01) return '<1%'
  if (fraction > 0.999) return '<100%'
  return `${(fraction * 100).toFixed(1).replace(/\.0$/, '')}%`
}
/** Human output avoids rounding a positive balance to zero or promising a 5h reset. */
export function formatUsageSnapshot(snapshot: AntiGravityUsageSnapshot, now = Date.now()): string {
  if (snapshot.status === 'unavailable') {
    const messages: Record<UsageErrorCode, string> = {
      'not-connected': 'Antigravity não está conectado.', auth: 'Não foi possível consultar a cota: autorização indisponível.',
      'rate-limit': 'Consulta de cota limitada (429). Isso não identifica a janela nem confirma cota zero.',
      unavailable: 'Consulta de cota indisponível.', schema: 'O serviço não forneceu metadados de cota reconhecíveis.',
      timeout: 'Consulta de cota excedeu o limite de tempo.',
    }
    return messages[snapshot.error ?? 'unavailable'] ?? messages.unavailable
  }
  const safeNow = timestamp(now) ? now : Date.now()
  const observed = timestamp(snapshot.observedAtMs) ? snapshot.observedAtMs : safeNow
  const age = Math.max(0, Math.floor((safeNow - observed) / 1000))
  const lines = ['Antigravity — cota restante reportada (não é saldo de tokens)',
    `Leitura: ${new Date(observed).toISOString()}; idade ${age}s${snapshot.stale ? ' — DESATUALIZADA' : ''}.`,
    'Janela: desconhecida; este endpoint não distingue limite de 5h e semanal.']
  if (!snapshot.rows.length) lines.push('Nenhum modelo com metadados de cota reconhecíveis.')
  for (const row of snapshot.rows.slice(0, MAX_QUOTA_ROWS)) {
    const reset = row.resetAtMs === undefined || !timestamp(row.resetAtMs) ? 'desconhecido'
      : `${new Date(row.resetAtMs).toISOString()}${row.resetAtMs <= safeNow ? ' (passado; atualize a leitura)' : ''}`
    lines.push(`${label(row.name)} [${label(row.id)}]: ${percent(row.remainingFraction)}; reset ${reset}.`)
  }
  if (snapshot.truncated) lines.push('Lista truncada; não representa todos os modelos.')
  lines.push('Modelos podem compartilhar cota; percentuais não são somados. Este comando não inicia retry nem controla créditos extras. Quando habilitada, a recuperação usa o reset reportado após falha do modelo, até 24h; não garante retorno da cota.')
  return lines.join('\n')
}
