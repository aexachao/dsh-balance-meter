/**
 * Cost ledger: one record per finalized assistant message, deduped by a
 * stable key so re-scanning a conversation snapshot never double-counts.
 * The pure record operations are asserted offline in scripts/verify.mjs;
 * {@link LedgerStore} adds the observable/persistence wiring used in the
 * browser (storage callbacks are injected, so the class stays testable).
 */
function zeroModelTotals() {
    return { cost: 0, cachedIn: 0, uncachedIn: 0, out: 0 };
}
function emptyTotals() {
    return { ...zeroModelTotals(), byModel: { flash: zeroModelTotals(), pro: zeroModelTotals() } };
}
/** Insert or replace by key; reports whether anything changed. */
export function upsertRecord(records, rec) {
    const existing = records.find((r) => r.key === rec.key);
    if (existing !== undefined) {
        if (existing.sessionId === rec.sessionId && existing.model === rec.model && existing.time === rec.time
            && existing.cachedIn === rec.cachedIn && existing.uncachedIn === rec.uncachedIn
            && existing.out === rec.out && existing.cost === rec.cost) {
            return { records: [...records], changed: false };
        }
        return { records: records.map((r) => (r.key === rec.key ? rec : r)), changed: true };
    }
    return { records: [...records, rec], changed: true };
}
/** Drop records older than `cutoffMs`. */
export function pruneRecords(records, cutoffMs) {
    const next = records.filter((r) => r.time >= cutoffMs);
    return { records: next, changed: next.length !== records.length };
}
/** Drop records at or after `sinceMs` (period reset). */
export function resetRecordsSince(records, sinceMs) {
    const next = records.filter((r) => r.time < sinceMs);
    return { records: next, changed: next.length !== records.length };
}
/** Aggregate cost/tokens over records at or after `sinceMs` (0 = everything). */
export function aggregateSince(records, sinceMs) {
    const totals = emptyTotals();
    for (const r of records) {
        if (r.time < sinceMs)
            continue;
        totals.cost += r.cost;
        totals.cachedIn += r.cachedIn;
        totals.uncachedIn += r.uncachedIn;
        totals.out += r.out;
        const per = totals.byModel[r.model];
        per.cost += r.cost;
        per.cachedIn += r.cachedIn;
        per.uncachedIn += r.uncachedIn;
        per.out += r.out;
    }
    return totals;
}
/** Start of the current budget window in local time (0 for `total`). */
export function periodStartMs(period, now) {
    const date = new Date(now);
    if (period === 'daily')
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    if (period === 'monthly')
        return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    return 0;
}
/** Observable ledger over an injected load/save pair. */
export class LedgerStore {
    records;
    version = 0;
    listeners = new Set();
    save;
    constructor(load, save) {
        this.records = load();
        this.save = save;
    }
    getSnapshotVersion = () => this.version;
    subscribe = (listener) => {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    };
    all() {
        return this.records;
    }
    upsert(rec) {
        const { records, changed } = upsertRecord(this.records, rec);
        if (!changed)
            return false;
        this.records = records;
        this.persist();
        return true;
    }
    resetSince(sinceMs) {
        const { records, changed } = resetRecordsSince(this.records, sinceMs);
        if (!changed)
            return;
        this.records = records;
        this.persist();
    }
    prune(olderThanMs) {
        const { records, changed } = pruneRecords(this.records, olderThanMs);
        if (!changed)
            return;
        this.records = records;
        this.persist();
    }
    persist() {
        this.version += 1;
        try {
            this.save(this.records);
        }
        catch { /* storage full/unavailable: keep in-memory */ }
        for (const listener of [...this.listeners])
            listener();
    }
}
/** Validate a persisted payload back into records (drops malformed rows). */
export function parseLedgerPayload(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const item of raw) {
        if (typeof item !== 'object' || item === null)
            continue;
        const r = item;
        if (typeof r.key !== 'string' || typeof r.sessionId !== 'string'
            || (r.model !== 'flash' && r.model !== 'pro')
            || typeof r.time !== 'number' || typeof r.cost !== 'number'
            || typeof r.cachedIn !== 'number' || typeof r.uncachedIn !== 'number' || typeof r.out !== 'number')
            continue;
        out.push({
            key: r.key, sessionId: r.sessionId, model: r.model, time: r.time,
            cachedIn: r.cachedIn, uncachedIn: r.uncachedIn, out: r.out, cost: r.cost,
        });
    }
    return out;
}
