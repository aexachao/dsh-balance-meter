/**
 * ds-budget-meter host half: a no-op plugin row. All behavior lives in the
 * client bundle (the meter reads token usage from session snapshots in the
 * browser); the host row only occupies its composition-tree seat so the
 * bundle layer can contribute the client roster entry and patch.
 */
import z from '@deepseek-ai/schemastery';
export const name = 'ds-budget-meter';
export const Config = z.object({
    budgetYuan: z.number().min(0.01).default(100),
    period: z.union([z.const('daily'), z.const('monthly'), z.const('total')]).default('daily'),
    warnPercent: z.number().min(1).max(100).default(80),
    stopOnOver: z.boolean().default(true),
    peakWindows: z.string().default('09:00-12:00,14:00-18:00'),
    pricingTimezone: z.string().default('Asia/Shanghai'),
});
export function apply(_ctx, _config) {
    // Client-only plugin; nothing to register on the host.
}
