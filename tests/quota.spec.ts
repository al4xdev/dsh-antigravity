import { describe, expect, it } from 'vitest'
import { formatUsageSnapshot, MAX_QUOTA_ROWS, parseModelQuotaSnapshot, parseQuotaReset, QuotaPayloadError } from '../src/quota.ts'

const now = Date.parse('2026-10-13T12:00:00Z')
const parse = (quotaInfo?: unknown, extra: Record<string, unknown> = {}) => parseModelQuotaSnapshot({
  models: { 'claude-opus-4-6-thinking': { displayName: 'Claude Opus', ...extra, ...(quotaInfo === undefined ? {} : { quotaInfo }) } },
}, now)

describe('safe reported Antigravity quota metadata', () => {
  it('distinguishes zero from missing, full and positive tiny balances', () => {
    expect(parse({ remainingFraction: 0 }).rows[0].remainingFraction).toBe(0)
    expect(formatUsageSnapshot(parse({ remainingFraction: 0 }), now)).toContain(': 0%;')
    expect(formatUsageSnapshot(parse({ remainingFraction: 1 }), now)).toContain(': 100%;')
    expect(formatUsageSnapshot(parse({ remainingFraction: 0.00001 }), now)).toContain(': <1%;')
    expect(formatUsageSnapshot(parse({ remainingFraction: 0.99999 }), now)).toContain(': <100%;')
    expect(formatUsageSnapshot(parse({ remainingFraction: 0.234 }), now)).toContain(': 23.4%;')
    expect(formatUsageSnapshot(parse(), now)).toContain(': desconhecida;')
  })
  it('never coerces missing, invalid or out-of-range quota to zero', () => {
    for (const fraction of [undefined, null, false, '0', NaN, Infinity, -0.01, 1.01, {}, []]) {
      const snapshot = parse({ remainingFraction: fraction })
      expect(snapshot.rows[0].remainingFraction).toBeUndefined()
      expect(formatUsageSnapshot(snapshot, now)).toContain(': desconhecida;')
    }
    for (const quota of [false, null, [], '0']) expect(parse(quota).rows[0].remainingFraction).toBeUndefined()
  })
  it('retains only allowlisted public model fields, not account, project, secrets or quota raw fields', () => {
    const snapshot = parseModelQuotaSnapshot({
      access: 'private-access', project: 'private-project', email: 'private-email',
      models: { 'gemini-3.8-flash-low': { displayName: 'Gemini', account: 'private-account',
        quotaInfo: { remainingFraction: 0.25, resetTime: '2026-10-13T15:00:00Z', token: 'private-token', window: 'five-hour' } } },
    }, now)
    expect(Object.keys(snapshot).sort()).toEqual(['observedAtMs', 'rows', 'source', 'stale', 'status', 'truncated'])
    expect(Object.keys(snapshot.rows[0]).sort()).toEqual(['id', 'name', 'remainingFraction', 'resetAtMs', 'window'])
    expect(snapshot.rows[0].window).toBe('unknown')
    expect(JSON.stringify(snapshot) + formatUsageSnapshot(snapshot, now)).not.toContain('private-')
  })
  it('does not infer a five-hour or weekly window from a reset timestamp', () => {
    for (const resetTime of ['2026-10-13T12:01:00Z', '2026-10-13T17:00:00Z', '2026-10-20T12:00:00Z']) {
      const snapshot = parse({ remainingFraction: 0, resetTime })
      expect(snapshot.rows[0].window).toBe('unknown')
      expect(formatUsageSnapshot(snapshot, now)).toContain('não distingue limite de 5h e semanal')
    }
  })
  it('accepts only representable RFC3339 reset timestamps with an explicit timezone and valid calendar', () => {
    expect(parseQuotaReset('2026-10-13T09:00:00-03:00')).toBe(now)
    expect(parseQuotaReset('2026-10-13T12:00:00.123456Z')).toBe(now + 123)
    expect(parseQuotaReset('2024-02-29T00:00:00Z')).toBe(Date.parse('2024-02-29T00:00:00Z'))
    for (const invalid of [now, '1791880000', '2026-10-13T12:00:00', '2026-10-13', '2026-02-30T00:00:00Z',
      '2025-02-29T00:00:00Z', '2026-13-01T00:00:00Z', '2026-10-13T24:00:00Z',
      '2026-10-13T12:00:60Z', '2026-10-13T12:00:00+24:00', '2026-10-13T12:00:00+01:60',
      ' 2026-10-13T12:00:00Z', null]) expect(parseQuotaReset(invalid)).toBeUndefined()
  })
  it('marks old resets rather than inventing a new five-hour deadline', () => {
    const output = formatUsageSnapshot(parse({ remainingFraction: 0, resetTime: '2026-10-13T11:59:00Z' }), now)
    expect(output).toContain('(passado; atualize a leitura)')
    expect(output).not.toContain('2026-10-13T17:00:00')
  })
  it('bounds labels and sanitizes ANSI, newline and bidi controls in persisted command output', () => {
    const snapshot = parse({ remainingFraction: 0.5 }, { displayName: '\u001b[31mClaude\n\u202e' + 'X'.repeat(200) })
    expect(snapshot.rows[0].name.length).toBeLessThanOrEqual(120)
    expect(snapshot.rows[0].name).not.toMatch(/[\u001b\n\u202e]/)
    const output = formatUsageSnapshot(snapshot, now)
    expect(output).not.toMatch(/[\u001b\u202e]/)
    expect(output).not.toContain('[31m')
  })
  it('rejects malformed root schemas and unsupported timestamps without raw payload in errors', () => {
    for (const bad of [null, [], false, { private: 'hidden' }, { models: [] }, { models: null }, { models: 'secret' }]) {
      expect(() => parseModelQuotaSnapshot(bad, now)).toThrow(QuotaPayloadError)
    }
    for (const time of [NaN, Infinity, 1e30]) expect(() => parseModelQuotaSnapshot({ models: {} }, time)).toThrow(QuotaPayloadError)
    expect(new QuotaPayloadError().message).not.toContain('hidden')
  })
  it('does not interpret no rows or no quota metadata as an exhausted account', () => {
    const snapshot = parseModelQuotaSnapshot({ models: {} }, now)
    expect(snapshot.rows).toEqual([])
    expect(formatUsageSnapshot(snapshot, now)).toContain('Nenhum modelo')
    expect(formatUsageSnapshot(snapshot, now)).not.toContain(': 0%')
    expect(formatUsageSnapshot(parse(), now)).toContain('desconhecida')
  })
  it('ignores non-model, invalid IDs and malformed entries', () => {
    const snapshot = parseModelQuotaSnapshot({ models: {
      'claude-opus-4-6-thinking': { displayName: 'Claude' },
      chat_hidden: { displayName: 'hidden' }, tab_hidden: { displayName: 'hidden' }, 'gemini-tiered': { displayName: 'hidden' },
      'id\nsecret': { displayName: 'hidden' }, empty: null, primitive: 3, no_fields: {},
    } }, now)
    expect(snapshot.rows.map(row => row.id)).toEqual(['claude-opus-4-6-thinking'])
  })
  it('bounds rows and marks truncation instead of silently claiming an exhaustive account total', () => {
    const models = Object.fromEntries(Array.from({ length: MAX_QUOTA_ROWS + 10 }, (_, i) => [`gemini-fixture-${i}`, { displayName: 'Gemini', quotaInfo: { remainingFraction: 1 } }]))
    const snapshot = parseModelQuotaSnapshot({ models }, now)
    expect(snapshot.rows.length).toBe(MAX_QUOTA_ROWS)
    expect(snapshot.truncated).toBe(true)
    expect(formatUsageSnapshot(snapshot, now)).toContain('Lista truncada')
  })
  it('returns detached immutable DTOs and keeps cache staleness explicit', () => {
    const payload = { models: { 'gemini-3.8-flash-low': { displayName: 'Gemini', quotaInfo: { remainingFraction: 0.5 } } } }
    const snapshot = parseModelQuotaSnapshot(payload, now)
    payload.models['gemini-3.8-flash-low'].quotaInfo.remainingFraction = 0
    expect(snapshot.rows[0].remainingFraction).toBe(0.5)
    expect(Object.isFrozen(snapshot)).toBe(true)
    expect(Object.isFrozen(snapshot.rows)).toBe(true)
    expect(Object.isFrozen(snapshot.rows[0])).toBe(true)
    expect(formatUsageSnapshot({ ...snapshot, stale: true }, now + 61_000)).toContain('idade 61s — DESATUALIZADA')
    expect(formatUsageSnapshot(snapshot, now - 1000)).toContain('idade 0s')
  })
  it('renders sanitized unavailable reasons without suggesting that a429 means zero quota', () => {
    const unavailable = { ...parse(), status: 'unavailable' as const, rows: [], error: 'rate-limit' as const }
    const output = formatUsageSnapshot(unavailable, now)
    expect(output).toContain('429')
    expect(output).toContain('não identifica a janela nem confirma cota zero')
    expect(formatUsageSnapshot({ ...unavailable, error: 'timeout' }, now)).toContain('limite de tempo')
  })
})
