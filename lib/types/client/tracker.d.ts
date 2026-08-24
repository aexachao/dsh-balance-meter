/**
 * Usage tracker: subscribes to the current session's conversation snapshot
 * and ingests every finalized assistant message's `usage` into the ledger.
 *
 * The framework exposes no cross-session usage aggregate, so only the staged
 * (current) session streams live; the persisted ledger keeps every ingested
 * message deduped by `${sessionId}:${messageId ?? seq}`, so reopening a
 * session or restarting the app never double-counts.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
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
export declare function initTracker(ctx: ClientContext): () => void;
