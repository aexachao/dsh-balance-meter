/**
 * The floating budget capsule (shell.overlay entry): a pill with a mini
 * progress bar and spent/budget figures; clicking it expands a card with the
 * full progress bar, the period's token breakdown, per-model costs, and the
 * settings (budget / period / warn threshold / default model). Threshold
 * crossings raise a toast once per period per level.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { aggregateSince, periodStartMs, type PeriodKind } from './ledger.ts'
import { isPeak, parsePeakWindows } from './pricing.ts'
import {
  clearNotified, getSettings, ledger, markDismissed, markNotified, subscribeSettings, updateSettings,
  wasDismissed, wasNotified, type NotifyLevel,
} from './store.ts'
import css from './BudgetCapsule.module.css'

type BudgetCapsuleProps = PropsRuntime<'shell.overlay'> & PropsLocale<'ds-budget-meter'>

function formatYuan(value: number): string {
  if (value >= 100) return `¥${value.toFixed(0)}`
  if (value >= 1) return `¥${value.toFixed(2)}`
  if (value > 0) return `¥${value.toFixed(3)}`
  return '¥0.00'
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

export function BudgetCapsule({ t }: BudgetCapsuleProps) {
  useSyncExternalStore(ledger.subscribe, ledger.getSnapshotVersion)
  const settings = useSyncExternalStore(subscribeSettings, getSettings)
  const [expanded, setExpanded] = useState(false)
  const [toast, setToast] = useState<NotifyLevel | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [, setTick] = useState(0)

  // Minute tick: keeps the peak/off-peak badge and the period rollover honest.
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  const now = Date.now()
  const start = periodStartMs(settings.period, now)
  const totals = aggregateSince(ledger.all(), start)
  const totalAllCost = aggregateSince(ledger.all(), 0).cost
  const percent = settings.budgetYuan > 0 ? (totals.cost / settings.budgetYuan) * 100 : 0
  const tone = percent >= 100 ? 'over' : percent >= settings.warnPercent ? 'warn' : 'ok'
  const periodKey = `${settings.period}:${start}`
  const periodLabel = settings.period === 'daily'
    ? t('settings.period.daily')
    : settings.period === 'monthly' ? t('settings.period.monthly') : t('settings.period.total')

  // Threshold crossings: warn fires a transient toast once per period; the
  // over-budget banner is persistent (manual dismiss) so it cannot be missed.
  useEffect(() => { setDismissed(wasDismissed(periodKey)) }, [periodKey])
  useEffect(() => {
    if (percent >= settings.warnPercent && percent < 100 && !wasNotified(periodKey, 'warn')) {
      markNotified(periodKey, 'warn')
      setToast('warn')
    }
  }, [percent, settings.warnPercent, periodKey])

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), 8000)
    return () => clearTimeout(timer)
  }, [toast])

  const peakNow = isPeak(now, parsePeakWindows(settings.peakWindows), settings.pricingTimezone)
  const width = `${Math.min(100, percent)}%`

  return (
    <div className={css.root} data-tone={tone}>
      {percent >= 100 && !dismissed && (
        <div className={css.toast} data-level="over" role="alert">
          <span className={css.toastText}>
            {t('toast.over', { spent: formatYuan(totals.cost), budget: formatYuan(settings.budgetYuan) })}
          </span>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('toast.close')}
            onClick={() => { markDismissed(periodKey); setDismissed(true) }}
          >
            ✕
          </button>
        </div>
      )}
      {toast === 'warn' && (
        <div className={css.toast} data-level="warn" role="alert">
          <span className={css.toastText}>
            {t('toast.warn', { percent: String(Math.round(percent)), spent: formatYuan(totals.cost), budget: formatYuan(settings.budgetYuan) })}
          </span>
        </div>
      )}

      {expanded && (
        <div className={css.card}>
          <div className={css.cardHead}>
            <span className={css.cardTitle}>{t('card.title')}</span>
            <span className={css.band} data-peak={peakNow || undefined}>
              {`${t('card.peakNow')}: ${peakNow ? t('card.peak') : t('card.off')}`}
            </span>
            <button type="button" className={css.iconButton} aria-label={t('card.close')} onClick={() => setExpanded(false)}>
              ✕
            </button>
          </div>

          <div className={css.progressBar}>
            <span className={css.progressFill} style={{ width }} />
            <span className={css.progressLabel}>{`${Math.round(percent)}%`}</span>
          </div>
          <div className={css.row}><span>{t('card.spent')}</span><span>{formatYuan(totals.cost)}</span></div>
          <div className={css.row}><span>{t('card.budget')}</span><span>{formatYuan(settings.budgetYuan)}</span></div>
          <div className={css.row}><span>{t('card.period')}</span><span>{periodLabel}</span></div>
          <div className={css.row}><span>{t('card.totalAll')}</span><span>{formatYuan(totalAllCost)}</span></div>

          <div className={css.section}>{t('card.tokens.title')}</div>
          <div className={css.row}><span>{t('card.tokens.inputCached')}</span><span>{formatTokens(totals.cachedIn)}</span></div>
          <div className={css.row}><span>{t('card.tokens.inputUncached')}</span><span>{formatTokens(totals.uncachedIn)}</span></div>
          <div className={css.row}><span>{t('card.tokens.output')}</span><span>{formatTokens(totals.out)}</span></div>

          {(totals.byModel.flash.cost > 0 || totals.byModel.pro.cost > 0) && (
            <>
              <div className={css.section}>{t('card.byModel')}</div>
              {(['flash', 'pro'] as const).map((model) => (
                totals.byModel[model].cost > 0 && (
                  <div className={css.row} key={model}>
                    <span>{model}</span>
                    <span>{formatYuan(totals.byModel[model].cost)}</span>
                  </div>
                )
              ))}
            </>
          )}

          <div className={css.section}>{t('settings.title')}</div>
          <label className={css.field}>
            <span>{t('settings.budget')}</span>
            <input
              type="number"
              min={1}
              step={10}
              key={`budget-${settings.budgetYuan}`}
              defaultValue={settings.budgetYuan}
              onBlur={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value > 0) updateSettings({ budgetYuan: value })
              }}
            />
          </label>
          <label className={css.field}>
            <span>{t('settings.warn')}</span>
            <input
              type="number"
              min={1}
              max={100}
              key={`warn-${settings.warnPercent}`}
              defaultValue={settings.warnPercent}
              onBlur={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value >= 1 && value <= 100) updateSettings({ warnPercent: value })
              }}
            />
          </label>
          <label className={css.field}>
            <span>{t('settings.period')}</span>
            <select value={settings.period} onChange={(event) => updateSettings({ period: event.target.value as PeriodKind })}>
              <option value="daily">{t('settings.period.daily')}</option>
              <option value="monthly">{t('settings.period.monthly')}</option>
              <option value="total">{t('settings.period.total')}</option>
            </select>
          </label>
          <label className={css.field}>
            <span>{t('settings.stopOnOver')}</span>
            <input
              type="checkbox"
              checked={settings.stopOnOver}
              onChange={(event) => updateSettings({ stopOnOver: event.target.checked })}
            />
          </label>
          <button
            type="button"
            className={css.resetButton}
            onClick={() => { ledger.resetSince(start); clearNotified(periodKey) }}
          >
            {t('card.reset')}
          </button>
        </div>
      )}

      <button
        type="button"
        className={css.capsule}
        title={t('capsule.title')}
        aria-label={t('capsule.label')}
        aria-expanded={expanded}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className={css.bandTag} data-peak={peakNow || undefined}>
          {peakNow ? t('card.peak') : t('card.off')}
        </span>
        <span className={css.bar}><span className={css.barFill} style={{ width }} /></span>
        <span className={css.text}>{`${formatYuan(totals.cost)} / ${formatYuan(settings.budgetYuan)}`}</span>
      </button>
    </div>
  )
}
