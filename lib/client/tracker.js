/**
 * Usage tracker: subscribes to the current session's conversation snapshot
 * and ingests every finalized assistant message's `usage` into the ledger.
 *
 * The framework exposes no cross-session usage aggregate, so only the staged
 * (current) session streams live; the persisted ledger keeps every ingested
 * message deduped by `${sessionId}:${messageId ?? seq}`, so reopening a
 * session or restarting the app never double-counts.
 */
import { costOf, isPeak, isDeepSeekProvider, deepseekProfile, parsePeakWindows } from "./pricing.js";
import { parseUsage } from "./usage.js";
import { aggregateSince, periodStartMs } from "./ledger.js";
import { ledger, getSettings, wasNotified, markNotified } from "./store.js";
/** Scan one conversation snapshot and upsert its billable messages. */
function ingest(face) {
    const snapshot = face.getSnapshot();
    const settings = getSettings();
    const windows = parsePeakWindows(settings.peakWindows);
    let changedAny = false;
    for (const node of snapshot.nodes) {
        if (node.kind !== 'assistant' || node.usage === undefined || node.usage === null)
            continue;
        // Provider gate: only DeepSeek requests are priced; the profile follows
        // each request's own model (users switch models freely).
        const provider = node.requestConfig?.provider ?? node.provenance?.provider;
        const model = node.requestConfig?.model ?? node.provenance?.model;
        if (!isDeepSeekProvider(provider, model))
            continue;
        const tokens = parseUsage(node.usage);
        if (tokens === null)
            continue;
        const profile = deepseekProfile(model);
        const peak = isPeak(node.time, windows, settings.pricingTimezone);
        if (ledger.upsert({
            key: `${snapshot.sessionId}:${node.messageId ?? node.seq}`,
            sessionId: snapshot.sessionId,
            model: profile,
            time: node.time,
            cachedIn: tokens.cachedIn,
            uncachedIn: tokens.uncachedIn,
            out: tokens.out,
            cost: costOf(tokens, profile, peak),
        }))
            changedAny = true;
    }
    if (changedAny)
        maybeStopOnOver(face);
}
/**
 * Hard-stop behavior: once the day's spent total reaches the warn threshold
 * (按金额), cancel the running turn (once per day) so further spend stops.
 * Configurable through `stopOnOver`; the capsule mirrors the same crossing
 * with a toast.
 */
function maybeStopOnOver(face) {
    const settings = getSettings();
    if (!settings.stopOnOver || settings.warnYuan <= 0)
        return;
    const start = periodStartMs('daily', Date.now());
    const periodKey = `daily:${start}`;
    if (wasNotified(periodKey, 'stopped'))
        return;
    if (aggregateSince(ledger.all(), start).cost < settings.warnYuan)
        return;
    markNotified(periodKey, 'stopped');
    void face.cancel().catch(() => { });
}
/**
 * Attach to the current session and keep the ledger fresh.
 *
 * Session faces materialize lazily: right after boot (or a connection reset)
 * `scope()/sessionOf()` can return undefined for the current session, and an
 * idle session's list never ticks again on its own — so a one-shot attach
 * would silently never subscribe. A guarded retry loop re-attempts until the
 * subscription is live, then goes quiet.
 *
 * @returns disposer removing every subscription and the retry timer.
 */
export function initTracker(ctx) {
    let sessionUnsub = null;
    /** Session id that currently has a live conversation subscription. */
    let subscribedId;
    /** Session id the latest list state wants us to track. */
    let wantedId;
    const tryAttach = () => {
        const current = ctx.sessions.list.getSnapshot().current;
        wantedId = current;
        if (current === subscribedId)
            return;
        if (sessionUnsub !== null) {
            sessionUnsub();
            sessionUnsub = null;
            subscribedId = undefined;
        }
        if (current === undefined)
            return;
        const scoped = ctx.sessions.scope(current);
        const face = scoped !== undefined ? ctx.sessions.sessionOf(scoped) : undefined;
        if (face === undefined)
            return; // not materialized yet; the retry loop re-attempts
        subscribedId = current;
        const scan = () => { ingest(face); };
        scan();
        sessionUnsub = face.subscribe(scan);
    };
    tryAttach();
    const listUnsub = ctx.sessions.list.subscribe(tryAttach);
    const retry = setInterval(() => {
        if (subscribedId !== wantedId)
            tryAttach();
    }, 3000);
    // Connection resets prune and re-mint session scopes; the old face's
    // subscription goes silent, so force a re-attach.
    const resetUnsub = ctx.on('connection/reset', () => { subscribedId = undefined; });
    return () => {
        clearInterval(retry);
        listUnsub();
        resetUnsub();
        if (sessionUnsub !== null)
            sessionUnsub();
    };
}
