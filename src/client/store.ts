/**
 * Browser-side singletons: the persisted settings (localStorage overrides the
 * Config defaults seeded at apply time), the persisted ledger, and the
 * per-period notification flags. Everything is observable through
 * useSyncExternalStore-friendly subscribe/getSnapshot pairs.
 */

import { LedgerStore, parseLedgerPayload } from './ledger.ts'

export interface Settings {
  /** 本日花费达到该金额（元）时提醒；stopOnOver 时同时取消当前回合。 */
  warnYuan: number
  /** 达到提醒阈值时自动取消当前回合（每周期一次）。 */
  stopOnOver: boolean
  peakWindows: string
  pricingTimezone: string
}

/** Built-in defaults (mirror the host Config schema defaults). */
export const DEFAULT_SETTINGS: Settings = {
  warnYuan: 20,
  stopOnOver: true,
  peakWindows: '09:00-12:00,14:00-18:00',
  pricingTimezone: 'Asia/Shanghai',
}

const SETTINGS_KEY = 'ds-budget-meter/v1/settings'
const LEDGER_KEY = 'ds-budget-meter/v1/ledger'
const NOTIFIED_KEY = 'ds-budget-meter/v1/notified'

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* best effort */ }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function loadSettings(): Settings {
  const settings = { ...DEFAULT_SETTINGS }
  const stored = readJson(SETTINGS_KEY)
  if (isRecord(stored)) mergeSettings(settings, stored)
  return settings
}

function mergeSettings(settings: Settings, source: Record<string, unknown>): void {
  if (typeof source.warnYuan === 'number' && Number.isFinite(source.warnYuan) && source.warnYuan > 0) {
    settings.warnYuan = source.warnYuan
  }
  if (typeof source.stopOnOver === 'boolean') settings.stopOnOver = source.stopOnOver
  if (typeof source.peakWindows === 'string' && source.peakWindows !== '') settings.peakWindows = source.peakWindows
  if (typeof source.pricingTimezone === 'string' && source.pricingTimezone !== '') {
    settings.pricingTimezone = source.pricingTimezone
  }
}

let settings: Settings = loadSettings()
const settingsListeners = new Set<() => void>()

/** Seed defaults from the row config (when the loader passes one). */
export function seedSettingsFromConfig(config: unknown): void {
  if (!isRecord(config)) return
  const next = { ...settings }
  mergeSettings(next, config)
  settings = next
  notifySettings()
}

export function getSettings(): Settings {
  return settings
}

export function subscribeSettings(listener: () => void): () => void {
  settingsListeners.add(listener)
  return () => { settingsListeners.delete(listener) }
}

export function updateSettings(patch: Partial<Settings>): void {
  // Replace (not mutate) the snapshot object so useSyncExternalStore's
  // Object.is snapshot comparison sees the change and re-renders.
  const next = { ...settings }
  mergeSettings(next, patch)
  settings = next
  writeJson(SETTINGS_KEY, settings)
  notifySettings()
}

function notifySettings(): void {
  for (const listener of [...settingsListeners]) listener()
}

// ── ledger singleton ────────────────────────────────────────────────────────

export const ledger = new LedgerStore(
  () => parseLedgerPayload(readJson(LEDGER_KEY)),
  (records) => writeJson(LEDGER_KEY, records),
)

// ── per-period notification flags ───────────────────────────────────────────

export type NotifyLevel = 'warn' | 'over' | 'stopped'

interface NotifiedMap {
  [periodKey: string]: { warn?: boolean; over?: boolean; stopped?: boolean; dismissed?: boolean }
}

function readNotified(): NotifiedMap {
  const stored = readJson(NOTIFIED_KEY)
  return isRecord(stored) ? stored as NotifiedMap : {}
}

export function wasNotified(periodKey: string, level: NotifyLevel): boolean {
  return readNotified()[periodKey]?.[level] === true
}

export function markNotified(periodKey: string, level: NotifyLevel): void {
  const map = readNotified()
  const entry = map[periodKey] ?? {}
  entry[level] = true
  // Crossing `over` implies `warn` was consumed too.
  if (level === 'over') entry.warn = true
  map[periodKey] = entry
  writeJson(NOTIFIED_KEY, map)
}

export function clearNotified(periodKey: string): void {
  const map = readNotified()
  delete map[periodKey]
  writeJson(NOTIFIED_KEY, map)
}

/** Whether the user dismissed the persistent over-budget banner this period. */
export function wasDismissed(periodKey: string): boolean {
  return readNotified()[periodKey]?.dismissed === true
}

export function markDismissed(periodKey: string): void {
  const map = readNotified()
  const entry = map[periodKey] ?? {}
  entry.dismissed = true
  map[periodKey] = entry
  writeJson(NOTIFIED_KEY, map)
}
