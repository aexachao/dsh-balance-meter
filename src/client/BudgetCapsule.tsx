/**
 * The floating balance capsule (shell.overlay entry): a pill showing the
 * real DeepSeek account balance; clicking it expands a card with the full
 * balance breakdown (total / granted / topped-up) and a refresh button.
 * Data comes from the host /budget/balance endpoint — no manual budgets.
 */

import { useCallback, useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import css from './BudgetCapsule.module.css'

type BudgetCapsuleProps = PropsRuntime<'shell.overlay'> & PropsLocale<'ds-budget-meter'>

interface BalanceInfo {
  currency: string
  totalBalance: string
  grantedBalance: string
  toppedUpBalance: string
}

interface BalanceView {
  ok: boolean
  error?: string
  isAvailable?: boolean
  balanceInfos?: BalanceInfo[]
}

function formatBalance(value: string): string {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  if (n >= 100) return n.toFixed(0)
  if (n >= 1) return n.toFixed(2)
  return n.toFixed(3)
}

export function BudgetCapsule({ t }: BudgetCapsuleProps) {
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<BalanceView | null>(null)
  const [loading, setLoading] = useState(false)
  const [lastError, setLastError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setLastError(null)
    try {
      const r = await fetch('/budget/balance', { cache: 'no-store' })
      const data = await r.json() as BalanceView
      setView(data)
      if (!data.ok) setLastError(data.error ?? '未知错误')
    } catch (error) {
      setLastError(String(error))
    } finally {
      setLoading(false)
    }
  }, [])

  // 首次挂载 + 每 60 秒自动刷新
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh() }, 60_000)
    return () => clearInterval(timer)
  }, [refresh])

  const primary = view?.ok && view.balanceInfos?.length
    ? view.balanceInfos[0]
    : null
  const balanceText = primary ? `¥${formatBalance(primary.totalBalance)}` : '—'
  const tone = view?.ok ? (primary ? 'ok' : 'warn') : 'error'

  return (
    <div className={css.wrap}>
      <button
        type="button"
        className={`${css.capsule} ${css[tone]}`}
        onClick={() => { setExpanded((open) => !open) }}
        aria-expanded={expanded}
        aria-label={t('capsule.label')}
        title={t('capsule.title')}
      >
        <span className={css.dot} />
        <span className={css.label}>{t('capsule.label')}</span>
        <span className={css.value}>{balanceText}</span>
        {loading && <span className={css.spin} />}
      </button>

      {expanded && (
        <>
          <div className={css.backdrop} onClick={() => { setExpanded(false) }} />
          <div className={css.card} role="dialog" aria-label={t('card.title')}>
            <div className={css.cardHead}>
              <span className={css.cardTitle}>{t('card.title')}</span>
              <button type="button" className={css.close} onClick={() => { setExpanded(false) }} aria-label={t('card.close')}>✕</button>
            </div>

            {lastError !== null && (
              <div className={css.error}>{lastError}</div>
            )}

            {primary != null && (
              <>
                <div className={css.balanceRow}>
                  <span className={css.balanceLabel}>{t('card.totalBalance')}</span>
                  <span className={css.balanceValue}>¥{formatBalance(primary.totalBalance)}</span>
                </div>
                <div className={css.balanceRow}>
                  <span className={css.balanceLabel}>{t('card.grantedBalance')}</span>
                  <span className={css.balanceValue}>¥{formatBalance(primary.grantedBalance)}</span>
                </div>
                <div className={css.balanceRow}>
                  <span className={css.balanceLabel}>{t('card.toppedUpBalance')}</span>
                  <span className={css.balanceValue}>¥{formatBalance(primary.toppedUpBalance)}</span>
                </div>
                <div className={css.currency}>{primary.currency}</div>
              </>
            )}

            {view?.ok && primary === null && (
              <div className={css.empty}>{t('card.empty')}</div>
            )}

            <div className={css.footer}>
              <button
                type="button"
                className={css.refresh}
                onClick={() => { void refresh() }}
                disabled={loading}
              >
                {loading ? t('card.loading') : t('card.refresh')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
