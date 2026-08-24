/**
 * Cost ledger: one record per finalized assistant message, deduped by a
 * stable key so re-scanning a conversation snapshot never double-counts.
 * The pure record operations are asserted offline in scripts/verify.mjs;
 * {@link LedgerStore} adds the observable/persistence wiring used in the
 * browser (storage callbacks are injected, so the class stays testable).
 */
import type { ModelProfile } from './pricing.ts';
export type PeriodKind = 'daily' | 'monthly' | 'total';
export interface LedgerRecord {
    /** `${sessionId}:${messageId ?? seq}` — the dedup identity. */
    key: string;
    sessionId: string;
    model: ModelProfile;
    /** Unix epoch ms of the assistant message. */
    time: number;
    cachedIn: number;
    uncachedIn: number;
    out: number;
    /** Precomputed cost in CNY at ingest time. */
    cost: number;
}
/** Cost/token sums for one slice of the ledger. */
export interface ModelTotals {
    cost: number;
    cachedIn: number;
    uncachedIn: number;
    out: number;
}
export interface Totals extends ModelTotals {
    byModel: Record<ModelProfile, ModelTotals>;
}
/** Insert or replace by key; reports whether anything changed. */
export declare function upsertRecord(records: readonly LedgerRecord[], rec: LedgerRecord): {
    records: LedgerRecord[];
    changed: boolean;
};
/** Drop records older than `cutoffMs`. */
export declare function pruneRecords(records: readonly LedgerRecord[], cutoffMs: number): {
    records: LedgerRecord[];
    changed: boolean;
};
/** Drop records at or after `sinceMs` (period reset). */
export declare function resetRecordsSince(records: readonly LedgerRecord[], sinceMs: number): {
    records: LedgerRecord[];
    changed: boolean;
};
/** Aggregate cost/tokens over records at or after `sinceMs` (0 = everything). */
export declare function aggregateSince(records: readonly LedgerRecord[], sinceMs: number): Totals;
/** Start of the current budget window in local time (0 for `total`). */
export declare function periodStartMs(period: PeriodKind, now: number): number;
/** Observable ledger over an injected load/save pair. */
export declare class LedgerStore {
    private records;
    private version;
    private readonly listeners;
    private readonly save;
    constructor(load: () => LedgerRecord[], save: (records: readonly LedgerRecord[]) => void);
    getSnapshotVersion: () => number;
    subscribe: (listener: () => void) => (() => void);
    all(): readonly LedgerRecord[];
    upsert(rec: LedgerRecord): boolean;
    resetSince(sinceMs: number): void;
    prune(olderThanMs: number): void;
    private persist;
}
/** Validate a persisted payload back into records (drops malformed rows). */
export declare function parseLedgerPayload(raw: unknown): LedgerRecord[];
