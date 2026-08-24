/**
 * Cost ledger: one record per finalized assistant message, deduped by a
 * stable key so re-scanning a conversation snapshot never double-counts.
 * The pure record operations are asserted offline in scripts/verify.mjs;
 * {@link LedgerStore} adds the observable/persistence wiring used in the
 * browser (storage callbacks are injected, so the class stays testable).
 */

import type { ModelProfile } from './pricing.ts'

export type PeriodKind = 'daily' | 'monthly' | 'total'

export interface LedgerRecord {
  /** `${sessionId}:${messageId ?? seq}` — the dedup identity. */
  key: string
  sessionId: string
  model: ModelProfile
  /** Unix epoch ms of the assistant message. */
  time: number
  cachedIn: number
  uncachedIn: number
  out: number
  /** Precomputed cost in CNY at ingest time. */
  cost: number
}

/** Cost/token sums for one slice of the ledger. */
export interface ModelTotals {
  cost: number
  cachedIn: number
  uncachedIn: number
  out: number
}

export interface Totals extends ModelTotals {
  byModel: Record<ModelProfile, ModelTotals>
}

function zeroModelTotals(): ModelTotals {
  return { cost: 0, cachedIn: 0, uncachedIn: 0, out: 0 }
}

function emptyTotals(): Totals {
  return { ...zeroModelTotals(), byModel: { flash: zeroModelTotals(), pro: zeroModelTotals() } }
}

/** Insert or replace by key; reports whether anything changed. */
export function upsertRecord(records: readonly LedgerRecord[], rec: LedgerRecord): { records: LedgerRecord[]; changed: boolean } {
  const existing = records.find((r) => r.key === rec.key)
  if (existing !== undefined) {
    if (
      existing.sessionId === rec.sessionId && existing.model === rec.model && existing.time === rec.time
      && existing.cachedIn === rec.cachedIn && existing.uncachedIn === rec.uncachedIn
      && existing.out === rec.out && existing.cost === rec.cost
    ) {
      return { records: [...records], changed: false }
    }
    return { records: records.map((r) => (r.key === rec.key ? rec : r)), changed: true }
  }
  return { records: [...records, rec], changed: true }
}

/** Drop records older than `cutoffMs`. */
export function pruneRecords(records: readonly LedgerRecord[], cutoffMs: number): { records: LedgerRecord[]; changed: boolean } {
  const next = records.filter((r) => r.time >= cutoffMs)
  return { records: next, changed: next.length !== records.length }
}

/** Drop records at or after `sinceMs` (period reset). */
export function resetRecordsSince(records: readonly LedgerRecord[], sinceMs: number): { records: LedgerRecord[]; changed: boolean } {
  const next = records.filter((r) => r.time < sinceMs)
  return { records: next, changed: next.length !== records.length }
}

/** Aggregate cost/tokens over records at or after `sinceMs` (0 = everything). */
export function aggregateSince(records: readonly LedgerRecord[], sinceMs: number): Totals {
  const totals = emptyTotals()
  for (const r of records) {
    if (r.time < sinceMs) continue
    totals.cost += r.cost
    totals.cachedIn += r.cachedIn
    totals.uncachedIn += r.uncachedIn
    totals.out += r.out
    const per = totals.byModel[r.model]
    per.cost += r.cost
    per.cachedIn += r.cachedIn
    per.uncachedIn += r.uncachedIn
    per.out += r.out
  }
  return totals
}

/** Start of the current budget window in local time (0 for `total`). */
export function periodStartMs(period: PeriodKind, now: number): number {
  const date = new Date(now)
  if (period === 'daily') return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  if (period === 'monthly') return new Date(date.getFullYear(), date.getMonth(), 1).getTime()
  return 0
}

/** Observable ledger over an injected load/save pair. */
export class LedgerStore {
  private records: LedgerRecord[]
  private version = 0
  private readonly listeners = new Set<() => void>()
  private readonly save: (records: readonly LedgerRecord[]) => void

  constructor(load: () => LedgerRecord[], save: (records: readonly LedgerRecord[]) => void) {
    this.records = load()
    this.save = save
  }

  getSnapshotVersion = (): number => this.version

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  all(): readonly LedgerRecord[] {
    return this.records
  }

  upsert(rec: LedgerRecord): boolean {
    const { records, changed } = upsertRecord(this.records, rec)
    if (!changed) return false
    this.records = records
    this.persist()
    return true
  }

  resetSince(sinceMs: number): void {
    const { records, changed } = resetRecordsSince(this.records, sinceMs)
    if (!changed) return
    this.records = records
    this.persist()
  }

  prune(olderThanMs: number): void {
    const { records, changed } = pruneRecords(this.records, olderThanMs)
    if (!changed) return
    this.records = records
    this.persist()
  }

  private persist(): void {
    this.version += 1
    try { this.save(this.records) } catch { /* storage full/unavailable: keep in-memory */ }
    for (const listener of [...this.listeners]) listener()
  }
}

/** Validate a persisted payload back into records (drops malformed rows). */
export function parseLedgerPayload(raw: unknown): LedgerRecord[] {
  if (!Array.isArray(raw)) return []
  const out: LedgerRecord[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const r = item as Record<string, unknown>
    if (
      typeof r.key !== 'string' || typeof r.sessionId !== 'string'
      || (r.model !== 'flash' && r.model !== 'pro')
      || typeof r.time !== 'number' || typeof r.cost !== 'number'
      || typeof r.cachedIn !== 'number' || typeof r.uncachedIn !== 'number' || typeof r.out !== 'number'
    ) continue
    out.push({
      key: r.key, sessionId: r.sessionId, model: r.model, time: r.time,
      cachedIn: r.cachedIn, uncachedIn: r.uncachedIn, out: r.out, cost: r.cost,
    })
  }
  return out
}
