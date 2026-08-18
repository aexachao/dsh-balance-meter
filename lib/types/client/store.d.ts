/**
 * Browser-side singletons: the persisted settings (localStorage overrides the
 * Config defaults seeded at apply time), the persisted ledger, and the
 * per-period notification flags. Everything is observable through
 * useSyncExternalStore-friendly subscribe/getSnapshot pairs.
 */
import { LedgerStore, type PeriodKind } from './ledger.ts';
export interface Settings {
    budgetYuan: number;
    period: PeriodKind;
    warnPercent: number;
    /** Cancel the running turn once when the period budget is exceeded. */
    stopOnOver: boolean;
    peakWindows: string;
    pricingTimezone: string;
}
/** Built-in defaults (mirror the host Config schema defaults). */
export declare const DEFAULT_SETTINGS: Settings;
/** Seed defaults from the row config (when the loader passes one). */
export declare function seedSettingsFromConfig(config: unknown): void;
export declare function getSettings(): Settings;
export declare function subscribeSettings(listener: () => void): () => void;
export declare function updateSettings(patch: Partial<Settings>): void;
export declare const ledger: LedgerStore;
export type NotifyLevel = 'warn' | 'over' | 'stopped';
export declare function wasNotified(periodKey: string, level: NotifyLevel): boolean;
export declare function markNotified(periodKey: string, level: NotifyLevel): void;
export declare function clearNotified(periodKey: string): void;
/** Whether the user dismissed the persistent over-budget banner this period. */
export declare function wasDismissed(periodKey: string): boolean;
export declare function markDismissed(periodKey: string): void;
