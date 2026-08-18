/**
 * ds-budget-meter host half: a no-op plugin row. All behavior lives in the
 * client bundle (the meter reads token usage from session snapshots in the
 * browser); the host row only occupies its composition-tree seat so the
 * bundle layer can contribute the client roster entry and patch.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "ds-budget-meter";
export interface Config {
    /** Budget cap for one period, in CNY. */
    budgetYuan: number;
    /** How the budget window resets: natural day, natural month, or never. */
    period: 'daily' | 'monthly' | 'total';
    /** Percentage of the budget at which the first warning fires (1-100). */
    warnPercent: number;
    /** Cancel the running turn once when the period budget is exceeded. */
    stopOnOver: boolean;
    /** Comma-separated HH:MM-HH:MM peak windows, interpreted in `pricingTimezone`. */
    peakWindows: string;
    /** IANA time zone the peak windows refer to (official pricing is Beijing time). */
    pricingTimezone: string;
}
export declare const Config: z<Config>;
export declare function apply(_ctx: Context, _config: Config): void;
