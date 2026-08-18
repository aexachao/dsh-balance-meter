/**
 * ds-budget-meter host half: a no-op plugin row. All behavior lives in the
 * client bundle (the meter reads token usage from session snapshots in the
 * browser); the host row only occupies its composition-tree seat so the
 * bundle layer can contribute the client roster entry and patch.
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

export const name = 'ds-budget-meter'

export interface Config {
  /** Budget cap for one period, in CNY. */
  budgetYuan: number
  /** How the budget window resets: natural day, natural month, or never. */
  period: 'daily' | 'monthly' | 'total'
  /** Percentage of the budget at which the first warning fires (1-100). */
  warnPercent: number
  /** Cancel the running turn once when the period budget is exceeded. */
  stopOnOver: boolean
  /** Comma-separated HH:MM-HH:MM peak windows, interpreted in `pricingTimezone`. */
  peakWindows: string
  /** IANA time zone the peak windows refer to (official pricing is Beijing time). */
  pricingTimezone: string
}

export const Config: z<Config> = z.object({
  budgetYuan: z.number().min(0.01).default(100),
  period: z.union([z.const('daily'), z.const('monthly'), z.const('total')]).default('daily'),
  warnPercent: z.number().min(1).max(100).default(80),
  stopOnOver: z.boolean().default(true),
  peakWindows: z.string().default('09:00-12:00,14:00-18:00'),
  pricingTimezone: z.string().default('Asia/Shanghai'),
})

export function apply(_ctx: Context, _config: Config): void {
  // Client-only plugin; nothing to register on the host.
}
