/**
 * Browser-side singletons: the persisted settings (localStorage overrides the
 * Config defaults seeded at apply time), the persisted ledger, and the
 * per-period notification flags. Everything is observable through
 * useSyncExternalStore-friendly subscribe/getSnapshot pairs.
 */
import { LedgerStore, parseLedgerPayload } from "./ledger.js";
/** Built-in defaults (mirror the host Config schema defaults). */
export const DEFAULT_SETTINGS = {
    budgetYuan: 100,
    period: 'daily',
    warnPercent: 80,
    stopOnOver: true,
    peakWindows: '09:00-12:00,14:00-18:00',
    pricingTimezone: 'Asia/Shanghai',
};
const SETTINGS_KEY = 'ds-budget-meter/v1/settings';
const LEDGER_KEY = 'ds-budget-meter/v1/ledger';
const NOTIFIED_KEY = 'ds-budget-meter/v1/notified';
function readJson(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw === null ? null : JSON.parse(raw);
    }
    catch {
        return null;
    }
}
function writeJson(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    }
    catch { /* best effort */ }
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function loadSettings() {
    const settings = { ...DEFAULT_SETTINGS };
    const stored = readJson(SETTINGS_KEY);
    if (isRecord(stored))
        mergeSettings(settings, stored);
    return settings;
}
function mergeSettings(settings, source) {
    if (typeof source.budgetYuan === 'number' && Number.isFinite(source.budgetYuan) && source.budgetYuan > 0) {
        settings.budgetYuan = source.budgetYuan;
    }
    if (source.period === 'daily' || source.period === 'monthly' || source.period === 'total') {
        settings.period = source.period;
    }
    if (typeof source.warnPercent === 'number' && source.warnPercent >= 1 && source.warnPercent <= 100) {
        settings.warnPercent = source.warnPercent;
    }
    if (typeof source.stopOnOver === 'boolean')
        settings.stopOnOver = source.stopOnOver;
    if (typeof source.peakWindows === 'string' && source.peakWindows !== '')
        settings.peakWindows = source.peakWindows;
    if (typeof source.pricingTimezone === 'string' && source.pricingTimezone !== '') {
        settings.pricingTimezone = source.pricingTimezone;
    }
}
let settings = loadSettings();
const settingsListeners = new Set();
/** Seed defaults from the row config (when the loader passes one). */
export function seedSettingsFromConfig(config) {
    if (!isRecord(config))
        return;
    const next = { ...settings };
    mergeSettings(next, config);
    settings = next;
    notifySettings();
}
export function getSettings() {
    return settings;
}
export function subscribeSettings(listener) {
    settingsListeners.add(listener);
    return () => { settingsListeners.delete(listener); };
}
export function updateSettings(patch) {
    // Replace (not mutate) the snapshot object so useSyncExternalStore's
    // Object.is snapshot comparison sees the change and re-renders.
    const next = { ...settings };
    mergeSettings(next, patch);
    settings = next;
    writeJson(SETTINGS_KEY, settings);
    notifySettings();
}
function notifySettings() {
    for (const listener of [...settingsListeners])
        listener();
}
// ── ledger singleton ────────────────────────────────────────────────────────
export const ledger = new LedgerStore(() => parseLedgerPayload(readJson(LEDGER_KEY)), (records) => writeJson(LEDGER_KEY, records));
function readNotified() {
    const stored = readJson(NOTIFIED_KEY);
    return isRecord(stored) ? stored : {};
}
export function wasNotified(periodKey, level) {
    return readNotified()[periodKey]?.[level] === true;
}
export function markNotified(periodKey, level) {
    const map = readNotified();
    const entry = map[periodKey] ?? {};
    entry[level] = true;
    // Crossing `over` implies `warn` was consumed too.
    if (level === 'over')
        entry.warn = true;
    map[periodKey] = entry;
    writeJson(NOTIFIED_KEY, map);
}
export function clearNotified(periodKey) {
    const map = readNotified();
    delete map[periodKey];
    writeJson(NOTIFIED_KEY, map);
}
/** Whether the user dismissed the persistent over-budget banner this period. */
export function wasDismissed(periodKey) {
    return readNotified()[periodKey]?.dismissed === true;
}
export function markDismissed(periodKey) {
    const map = readNotified();
    const entry = map[periodKey] ?? {};
    entry.dismissed = true;
    map[periodKey] = entry;
    writeJson(NOTIFIED_KEY, map);
}
