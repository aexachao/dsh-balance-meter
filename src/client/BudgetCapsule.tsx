/**
 * 余额胶囊（conversation.session.header.utilities 条目，session log 按钮
 * 左侧）。
 *
 * 原版预算追踪的融合改造：保留高峰/空闲时段标签、本日 token 分项、按模型
 * 花费、按金额的花费提醒阈值与超额自动停止；删除原版的「额度 / 周期 /
 * 百分比阈值 / 进度条」（预算上限概念由真实余额取代）。叠加真实 DeepSeek
 * 账户余额（host /budget/balance）：胶囊主显余额，卡片顶部为余额分项与
 * 充值快捷跳转。
 */

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { aggregateSince, periodStartMs } from './ledger.ts'
import { isPeak, parsePeakWindows } from './pricing.ts'
import {
  getSettings, ledger, markNotified, subscribeSettings, updateSettings, wasNotified,
} from './store.ts'
import css from './BudgetCapsule.module.css'

type BudgetCapsuleProps = PropsRuntime<'conversation.session.header.utilities'> & PropsLocale<'ds-budget-meter'>

/** 充值快捷跳转目标（外链，由桌面端桥接在系统浏览器打开）。 */
const TOP_UP_URL = 'https://platform.deepseek.com/top_up'

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
  /** 今日已消费（元）：官方平台源或余额差值估算。 */
  todayConsumed?: number
  todayConsumedSource?: 'official' | 'estimate'
  /** 累计消费（元，全部历史；仅官方平台源可用）。 */
  totalConsumed?: number
  totalConsumedSource?: 'official'
}

function formatYuan(value: number): string {
  if (value >= 100) return `¥${value.toFixed(0)}`
  if (value >= 1) return `¥${value.toFixed(2)}`
  if (value > 0) return `¥${value.toFixed(3)}`
  return '¥0.00'
}

/** 余额接口返回的是字符串金额，格式化同 formatYuan。 */
function formatYuanText(value: string): string {
  const n = Number(value)
  if (Number.isNaN(n)) return value
  return formatYuan(n)
}

function formatTokens(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}k`
  return String(count)
}

export function BudgetCapsule({ t }: BudgetCapsuleProps) {
  // ── 账本 / 设置（固定按天统计） ──
  useSyncExternalStore(ledger.subscribe, ledger.getSnapshotVersion)
  const settings = useSyncExternalStore(subscribeSettings, getSettings)
  const [expanded, setExpanded] = useState(false)
  const [toast, setToast] = useState(false)
  const [, setTick] = useState(0)

  // ── 余额：host /budget/balance ──
  const [view, setView] = useState<BalanceView | null>(null)
  const [loading, setLoading] = useState(false)
  const [balanceDismissed, setBalanceDismissed] = useState(false)

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

  // 分钟 tick：让高峰/空闲标签与「今日」边界保持诚实（原版机制）。
  useEffect(() => {
    const timer = setInterval(() => setTick((n) => n + 1), 60_000)
    return () => clearInterval(timer)
  }, [])

  // 余额：首次挂载 + 每 60 秒自动刷新。
  useEffect(() => {
    void refresh()
    const timer = setInterval(() => { void refresh() }, 60_000)
    return () => clearInterval(timer)
  }, [refresh])

  const now = Date.now()
  const start = periodStartMs('daily', now)
  const totals = aggregateSince(ledger.all(), start)
  const periodKey = `daily:${start}`

  // 达到金额阈值：每周期弹一次 8 秒 toast（提醒 + 停止均由 toast 表述）。
  useEffect(() => {
    if (totals.cost >= settings.warnYuan && !wasNotified(periodKey, 'warn')) {
      markNotified(periodKey, 'warn')
      setToast(true)
    }
  }, [totals.cost, settings.warnYuan, periodKey])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(false), 8000)
    return () => clearTimeout(timer)
  }, [toast])

  const peakNow = isPeak(now, parsePeakWindows(settings.peakWindows), settings.pricingTimezone)
  const balance = view?.ok && view.balanceInfos?.length ? view.balanceInfos[0] : null

  return (
    <div className={css.root}>
      {toast && (
        <div className={css.toast} data-level="warn" role="alert">
          <span className={css.toastText}>
            {t('toast.warn', { spent: formatYuan(totals.cost), warn: formatYuan(settings.warnYuan) })}
          </span>
        </div>
      )}

      {/* 余额查询失败横幅：常驻、可手动关闭。 */}
      {view && !view.ok && !balanceDismissed && (
        <div className={css.toast} data-level="error" role="alert">
          <span className={css.toastText}>{view.error ?? t('card.balanceError')}</span>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('toast.close')}
            onClick={() => { setBalanceDismissed(true) }}
          >
            ✕
          </button>
        </div>
      )}

      {expanded && (
        <>
          {/* 点击空白处关闭卡片。 */}
          <div className={css.backdrop} onClick={() => setExpanded(false)} />
          <div className={css.card}>
          <div className={css.cardHead}>
            <span className={css.cardTitle}>{t('card.title')}</span>
            {/* 状态圆点跟随「高峰/空闲」字段，而非整行最左。 */}
            <span className={css.band}>
              {`${t('card.peakNow')}:`}
              <span className={css.bandLabel} data-peak={peakNow || undefined}>
                <span className={css.bandDot} data-peak={peakNow || undefined} />
                {peakNow ? t('card.peak') : t('card.off')}
              </span>
            </span>
          </div>

          {/* 余额区块：总余额大字 + 赠送/充值分项 + 充值快捷跳转。 */}
          {balance && (
            <div className={css.balanceSection}>
              <div className={css.balanceTotal}>
                <span className={css.balanceTotalLabel}>{t('card.totalBalance')}</span>
                <span className={css.balanceTotalValue}>{formatYuanText(balance.totalBalance)}</span>
                <a
                  className={css.topUp}
                  href={TOP_UP_URL}
                  target="_blank"
                  rel="noreferrer"
                  title={t('card.topUpTitle')}
                >
                  {t('card.topUp')}
                </a>
              </div>
              <div className={css.row}><span>{t('card.grantedBalance')}</span><span>{formatYuanText(balance.grantedBalance)}</span></div>
              <div className={css.row}><span>{t('card.toppedUpBalance')}</span><span>{formatYuanText(balance.toppedUpBalance)}</span></div>
            </div>
          )}

          {/* 消费统计：今日来自官方平台/余额差值估算，累计仅官方源有值。 */}
          <div className={css.row}>
            <span>{t('card.spent')}</span>
            <span>
              {view?.todayConsumed !== undefined
                ? `${view.todayConsumedSource === 'estimate' ? '≈' : ''}${formatYuan(view.todayConsumed)}`
                : '—'}
            </span>
          </div>
          {view?.totalConsumed !== undefined && (
            <div className={css.row}><span>{t('card.totalAll')}</span><span>{formatYuan(view.totalConsumed)}</span></div>
          )}

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

          {/* 设置区：与上方统计数据之间加分割线。 */}
          <div className={css.settingsBlock}>
          <div className={css.section}>{t('settings.title')}</div>
          <label className={css.field}>
            <span>{t('settings.warn')}</span>
            <input
              type="number"
              min={1}
              step={5}
              key={`warn-${settings.warnYuan}`}
              defaultValue={settings.warnYuan}
              onBlur={(event) => {
                const value = Number(event.target.value)
                if (Number.isFinite(value) && value > 0) updateSettings({ warnYuan: value })
              }}
            />
          </label>
          <label className={css.field}>
            <span>{t('settings.stopOnOver')}</span>
            <input
              type="checkbox"
              checked={settings.stopOnOver}
              onChange={(event) => updateSettings({ stopOnOver: event.target.checked })}
            />
          </label>
          </div>
          </div>
        </>
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
          <span className={css.bandDot} data-peak={peakNow || undefined} />
          {peakNow ? t('card.peak') : t('card.off')}
        </span>
        <span className={css.text}>{balance ? formatYuanText(balance.totalBalance) : '¥--'}</span>
      </button>
    </div>
  )
}
