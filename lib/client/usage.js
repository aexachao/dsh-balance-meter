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
function asRecord(value) {
    return typeof value === 'object' && value !== null ? value : null;
}
function asNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
/**
 * Extract the billable token triple from a raw usage object.
 * @returns the triple, or null when the shape is unusable (not an object,
 * or missing a finite prompt/completion count).
 */
export function parseUsage(raw) {
    const usage = asRecord(raw);
    if (usage === null)
        return null;
    // Harness normalized shape: inputTokens (uncached) and cacheReadTokens
    // (cache-hit) are disjoint counts.
    if (usage.inputTokens !== undefined || usage.cacheReadTokens !== undefined) {
        const uncached = asNumber(usage.inputTokens) ?? 0;
        const cached = asNumber(usage.cacheReadTokens) ?? 0;
        const out = asNumber(usage.outputTokens ?? usage.completionTokens);
        if (out === null || (uncached === 0 && cached === 0))
            return null;
        return { cachedIn: cached, uncachedIn: uncached, out };
    }
    // OpenAI-style shapes: the prompt count is the TOTAL input, cached included.
    const prompt = asNumber(usage.promptTokens ?? usage.prompt_tokens);
    const completion = asNumber(usage.completionTokens ?? usage.completion_tokens);
    if (prompt === null || completion === null)
        return null;
    const details = asRecord(usage.promptTokensDetails ?? usage.prompt_tokens_details);
    const cachedRaw = (details !== null ? asNumber(details.cachedTokens ?? details.cached_tokens) : null)
        ?? asNumber(usage.cacheReadInputTokens ?? usage.cache_read_input_tokens);
    const cached = Math.min(cachedRaw ?? 0, prompt);
    return { cachedIn: cached, uncachedIn: prompt - cached, out: completion };
}
