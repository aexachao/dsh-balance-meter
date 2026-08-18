/**
 * DeepSeek V4 pricing (CNY per million tokens) and peak/off-peak helpers.
 * Pure module: asserted offline in scripts/verify.mjs.
 *
 * Official peak windows: 09:00–12:00 and 14:00–18:00 Beijing time; off-peak
 * prices are half of peak. Both the table and the windows are overridable
 * through the plugin Config.
 */

export type ModelProfile = 'flash' | 'pro'

/** CNY per million tokens for one billing dimension. */
export interface PriceTriple {
  cachedIn: number
  uncachedIn: number
  out: number
}

/** CNY per million tokens, per peak/off-peak band. */
export const PRICING: Record<ModelProfile, { off: PriceTriple; peak: PriceTriple }> = {
  flash: {
    off: { cachedIn: 0.05, uncachedIn: 1.5, out: 4.5 },
    peak: { cachedIn: 0.1, uncachedIn: 3, out: 9 },
  },
  pro: {
    off: { cachedIn: 0.15, uncachedIn: 4.5, out: 13.5 },
    peak: { cachedIn: 0.3, uncachedIn: 9, out: 27 },
  },
}

export interface PeakWindow {
  /** Inclusive start, minutes of day in the pricing time zone. */
  startMin: number
  /** Exclusive end, minutes of day in the pricing time zone. */
  endMin: number
}

/** Parse `HH:MM-HH:MM,HH:MM-HH:MM` into windows; malformed parts are dropped. */
export function parsePeakWindows(spec: string): PeakWindow[] {
  const windows: PeakWindow[] = []
  for (const part of spec.split(',')) {
    const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(part.trim())
    if (match === null) continue
    const startMin = Number(match[1]) * 60 + Number(match[2])
    const endMin = Number(match[3]) * 60 + Number(match[4])
    if (startMin >= 24 * 60 || endMin > 24 * 60 || startMin >= endMin) continue
    windows.push({ startMin, endMin })
  }
  return windows
}

/** Minutes-of-day in `timeZone` for one epoch-ms instant. */
function minutesOfDay(timeMs: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(timeMs)
  let hour = 0
  let minute = 0
  for (const part of parts) {
    if (part.type === 'hour') hour = Number(part.value) % 24
    if (part.type === 'minute') minute = Number(part.value)
  }
  return hour * 60 + minute
}

/** Whether `timeMs` falls inside a peak window (start inclusive, end exclusive). */
export function isPeak(timeMs: number, windows: readonly PeakWindow[], timeZone: string): boolean {
  const minute = minutesOfDay(timeMs, timeZone)
  return windows.some((w) => minute >= w.startMin && minute < w.endMin)
}

/**
 * Whether one request should be priced by this meter (DeepSeek-only pricing).
 * Excludes a request only when its provider/model identity is KNOWN and not
 * DeepSeek (wire values look like `deepseek-official` / `deepseek-v4-flash`).
 * Client nodes replayed from history carry no provider/model identity at all,
 * and this deployment composes DeepSeek providers only — absent identity is
 * therefore priced as DeepSeek rather than dropped.
 */
export function isDeepSeekProvider(provider: string | undefined, model: string | undefined): boolean {
  const p = provider?.toLowerCase()
  const m = model?.toLowerCase()
  if (p !== undefined && p.includes('deepseek')) return true
  if (m !== undefined && m.includes('deepseek')) return true
  if (p !== undefined || m !== undefined) return false // known non-DeepSeek identity
  return true // identity absent (history replay): assume the deployment's provider
}

/**
 * Map a DeepSeek request onto one of the two priced profiles. Flash names map
 * to flash, pro names to pro. When the model name is absent (history replay)
 * or unknown, fall back to flash — the deployment's default composition and
 * the cheaper table, so a missing identity warns late rather than 3x early;
 * switching between the two deployed models still prices each request by its
 * own name whenever the name is visible.
 */
export function deepseekProfile(model: string | undefined): ModelProfile {
  const lower = model?.toLowerCase()
  if (lower === undefined) return 'flash'
  if (lower.includes('pro')) return 'pro'
  return 'flash'
}
export interface TokenTriple {
  cachedIn: number
  uncachedIn: number
  out: number
}

/** Cost in CNY for one request's token triple at one band. */
export function costOf(tokens: TokenTriple, profile: ModelProfile, peak: boolean): number {
  const price = peak ? PRICING[profile].peak : PRICING[profile].off
  const perMillion = 1 / 1_000_000
  return tokens.cachedIn * price.cachedIn * perMillion
    + tokens.uncachedIn * price.uncachedIn * perMillion
    + tokens.out * price.out * perMillion
}
