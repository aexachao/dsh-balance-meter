/**
 * Defensive parser for the provider `usage` object carried by finalized
 * assistant messages (`AssistantMessageNode.usage` is typed `unknown` by the
 * runtime).
 *
 * The harness's normalized wire shape is
 * `{ inputTokens, outputTokens, cacheReadTokens, reasoningTokens }` where
 * `inputTokens` is the UNCACHED fresh input and `cacheReadTokens` the
 * cache-hit input — the two are disjoint, total input = their sum (verified
 * against the raw session log). Legacy OpenAI-style shapes instead carry the
 * prompt TOTAL including cached tokens, so cached is subtracted out of it.
 * Output tokens bill as-is (DeepSeek counts reasoning inside completion).
 * When no cached count exists, zero cache hits are assumed so every input
 * token bills at the (higher) uncached rate — a conservative overestimate.
 *
 * Pure module: asserted offline in scripts/verify.mjs.
 */
export interface TokenUsage {
    cachedIn: number;
    uncachedIn: number;
    out: number;
}
/**
 * Extract the billable token triple from a raw usage object.
 * @returns the triple, or null when the shape is unusable (not an object,
 * or missing a finite prompt/completion count).
 */
export declare function parseUsage(raw: unknown): TokenUsage | null;
