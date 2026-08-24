/**
 * The floating budget capsule (shell.overlay entry).
 *
 * 原版（预算追踪）的改造：数据源从「会话 token 用量 × 峰谷价估算」换成
 * host /budget/balance 端点的真实 DeepSeek 账户余额。定位（右下角固定）、
 * 胶囊与卡片的视觉样式沿用原版：胶囊 = 状态标签 + 余额文本；点击展开
 * 卡片 = 总余额大字 + 赠送/充值分项 + 刷新按钮。查询失败时沿用原版
 * toast 横幅结构（常驻、可手动关闭）。
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

function formatYuan(value: string): string {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  if (n >= 100) return `¥${n.toFixed(0)}`
  if (n >= 1) return `¥${n.toFixed(2)}`
  if (n > 0) return `¥${n.toFixed(3)}`
  return '¥0.00'
}

/** 余额查询状态：ok=正常 / empty=无余额数据 / error=查询失败。 */
type Tone = 'ok' | 'empty' | 'error'

export function BudgetCapsule({ t }: BudgetCapsuleProps) {
  const [expanded, setExpanded] = useState(false)
  const [view, setView] = useState<BalanceView | null>(null)
  const [loading, setLoading] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/budget/balance', { cache: 'no-store' })
      setView(await r.json() as BalanceView)
    } catch (error) {
      setView({ ok: false, error: String(error) })
    } finally {
      setLoading(false)
    }
  }, [])

  // 首次挂载 + 每 60 秒自动刷新（沿用原版的分针 tick 节奏）。
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh() }, 60_000)
    return () => clearInterval(timer)
  }, [refresh])

  const primary = view?.ok && view.balanceInfos?.length ? view.balanceInfos[0] : null
  const tone: Tone = view?.ok ? (primary ? 'ok' : 'empty') : 'error'
  const statusLabel = view?.ok ? (primary ? t('status.ok') : t('status.empty')) : t('status.error')

  return (
    <div className={css.root} data-tone={tone}>
      {/* 查询失败横幅：常驻、可手动关闭（原版 toast 结构）。 */}
      {view && !view.ok && !dismissed && (
        <div className={css.toast} data-level="error" role="alert">
          <span className={css.toastText}>{view.error ?? t('card.error')}</span>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('toast.close')}
            onClick={() => { setDismissed(true) }}
          >
            ✕
          </button>
        </div>
      )}

      {expanded && (
        <div className={css.card}>
          <div className={css.cardHead}>
            <span className={css.cardTitle}>{t('card.title')}</span>
            <span className={css.band} data-tone={tone}>{statusLabel}</span>
            <button type="button" className={css.iconButton} aria-label={t('card.close')} onClick={() => setExpanded(false)}>
              ✕
            </button>
          </div>

          {primary != null && (
            <>
              <div className={css.balanceTotal}>
                <span className={css.balanceTotalLabel}>{t('card.totalBalance')}</span>
                <span className={css.balanceTotalValue}>{formatYuan(primary.totalBalance)}</span>
              </div>
              <div className={css.row}><span>{t('card.grantedBalance')}</span><span>{formatYuan(primary.grantedBalance)}</span></div>
              <div className={css.row}><span>{t('card.toppedUpBalance')}</span><span>{formatYuan(primary.toppedUpBalance)}</span></div>
              <div className={css.row}><span>{t('card.currency')}</span><span>{primary.currency}</span></div>
            </>
          )}
          {view?.ok && primary === null && (
            <div className={css.empty}>{t('card.empty')}</div>
          )}

          <button
            type="button"
            className={css.resetButton}
            disabled={loading}
            onClick={() => { void refresh() }}
          >
            {loading ? t('card.loading') : t('card.refresh')}
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
        <span className={css.bandTag} data-tone={tone}>{statusLabel}</span>
        {loading && <span className={css.spin} />}
        <span className={css.text}>{primary ? formatYuan(primary.totalBalance) : '—'}</span>
      </button>
    </div>
  )
}
