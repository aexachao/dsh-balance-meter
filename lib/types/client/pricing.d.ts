/**
 * DeepSeek V4 pricing (CNY per million tokens) and peak/off-peak helpers.
 * Pure module: asserted offline in scripts/verify.mjs.
 *
 * Official peak windows: 09:00–12:00 and 14:00–18:00 Beijing time; off-peak
 * prices are half of peak. Both the table and the windows are overridable
 * through the plugin Config.
 */
export type ModelProfile = 'flash' | 'pro';
/** CNY per million tokens for one billing dimension. */
export interface PriceTriple {
    cachedIn: number;
    uncachedIn: number;
    out: number;
}
/** CNY per million tokens, per peak/off-peak band. */
export declare const PRICING: Record<ModelProfile, {
    off: PriceTriple;
    peak: PriceTriple;
}>;
export interface PeakWindow {
    /** Inclusive start, minutes of day in the pricing time zone. */
    startMin: number;
    /** Exclusive end, minutes of day in the pricing time zone. */
    endMin: number;
}
/** Parse `HH:MM-HH:MM,HH:MM-HH:MM` into windows; malformed parts are dropped. */
export declare function parsePeakWindows(spec: string): PeakWindow[];
/** 高峰窗口的补集（空闲时段）；窗口先按开始时间排序后取间隙与首尾。 */
export declare function offPeakWindows(windows: readonly PeakWindow[]): PeakWindow[];
/** `09:00-12:00、14:00-18:00` from windows (empty → `—`). */
export declare function formatWindows(windows: readonly PeakWindow[]): string;
/** Whether `timeMs` falls inside a peak window (start inclusive, end exclusive). */
export declare function isPeak(timeMs: number, windows: readonly PeakWindow[], timeZone: string): boolean;
/**
 * Whether one request should be priced by this meter (DeepSeek-only pricing).
 * Excludes a request only when its provider/model identity is KNOWN and not
 * DeepSeek (wire values look like `deepseek-official` / `deepseek-v4-flash`).
 * Client nodes replayed from history carry no provider/model identity at all,
 * and this deployment composes DeepSeek providers only — absent identity is
 * therefore priced as DeepSeek rather than dropped.
 */
export declare function isDeepSeekProvider(provider: string | undefined, model: string | undefined): boolean;
/**
 * Map a DeepSeek request onto one of the two priced profiles. Flash names map
 * to flash, pro names to pro. When the model name is absent (history replay)
 * or unknown, fall back to flash — the deployment's default composition and
 * the cheaper table, so a missing identity warns late rather than 3x early;
 * switching between the two deployed models still prices each request by its
 * own name whenever the name is visible.
 */
export declare function deepseekProfile(model: string | undefined): ModelProfile;
export interface TokenTriple {
    cachedIn: number;
    uncachedIn: number;
    out: number;
}
/** Cost in CNY for one request's token triple at one band. */
export declare function costOf(tokens: TokenTriple, profile: ModelProfile, peak: boolean): number;
