import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
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
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { aggregateSince, periodStartMs } from "./ledger.js";
import { isPeak, parsePeakWindows } from "./pricing.js";
import { getSettings, ledger, markNotified, subscribeSettings, updateSettings, wasNotified, } from "./store.js";
import css from './BudgetCapsule.module.css';
/** 充值快捷跳转目标（外链，由桌面端桥接在系统浏览器打开）。 */
const TOP_UP_URL = 'https://platform.deepseek.com/top_up';
function formatYuan(value) {
    if (value >= 100)
        return `¥${value.toFixed(0)}`;
    if (value >= 1)
        return `¥${value.toFixed(2)}`;
    if (value > 0)
        return `¥${value.toFixed(3)}`;
    return '¥0.00';
}
/** 余额接口返回的是字符串金额，格式化同 formatYuan。 */
function formatYuanText(value) {
    const n = Number(value);
    if (Number.isNaN(n))
        return value;
    return formatYuan(n);
}
function formatTokens(count) {
    if (count >= 1_000_000)
        return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000)
        return `${(count / 1_000).toFixed(1)}k`;
    return String(count);
}
export function BudgetCapsule({ t }) {
    // ── 账本 / 设置（固定按天统计） ──
    useSyncExternalStore(ledger.subscribe, ledger.getSnapshotVersion);
    const settings = useSyncExternalStore(subscribeSettings, getSettings);
    const [expanded, setExpanded] = useState(false);
    const [toast, setToast] = useState(false);
    const [, setTick] = useState(0);
    // ── 余额：host /budget/balance ──
    const [view, setView] = useState(null);
    const [loading, setLoading] = useState(false);
    const [balanceDismissed, setBalanceDismissed] = useState(false);
    const refresh = useCallback(async () => {
        setLoading(true);
        try {
            const r = await fetch('/budget/balance', { cache: 'no-store' });
            setView(await r.json());
        }
        catch (error) {
            setView({ ok: false, error: String(error) });
        }
        finally {
            setLoading(false);
        }
    }, []);
    // 分钟 tick：让高峰/空闲标签与「今日」边界保持诚实（原版机制）。
    useEffect(() => {
        const timer = setInterval(() => setTick((n) => n + 1), 60_000);
        return () => clearInterval(timer);
    }, []);
    // 余额：首次挂载 + 每 60 秒自动刷新。
    useEffect(() => {
        void refresh();
        const timer = setInterval(() => { void refresh(); }, 60_000);
        return () => clearInterval(timer);
    }, [refresh]);
    const now = Date.now();
    const start = periodStartMs('daily', now);
    const totals = aggregateSince(ledger.all(), start);
    const periodKey = `daily:${start}`;
    // 达到金额阈值：每周期弹一次 8 秒 toast（提醒 + 停止均由 toast 表述）。
    useEffect(() => {
        if (totals.cost >= settings.warnYuan && !wasNotified(periodKey, 'warn')) {
            markNotified(periodKey, 'warn');
            setToast(true);
        }
    }, [totals.cost, settings.warnYuan, periodKey]);
    useEffect(() => {
        if (!toast)
            return;
        const timer = setTimeout(() => setToast(false), 8000);
        return () => clearTimeout(timer);
    }, [toast]);
    const peakNow = isPeak(now, parsePeakWindows(settings.peakWindows), settings.pricingTimezone);
    const balance = view?.ok && view.balanceInfos?.length ? view.balanceInfos[0] : null;
    return (_jsxs("div", { className: css.root, children: [toast && (_jsx("div", { className: css.toast, "data-level": "warn", role: "alert", children: _jsx("span", { className: css.toastText, children: t('toast.warn', { spent: formatYuan(totals.cost), warn: formatYuan(settings.warnYuan) }) }) })), view && !view.ok && !balanceDismissed && (_jsxs("div", { className: css.toast, "data-level": "error", role: "alert", children: [_jsx("span", { className: css.toastText, children: view.error ?? t('card.balanceError') }), _jsx("button", { type: "button", className: css.iconButton, "aria-label": t('toast.close'), onClick: () => { setBalanceDismissed(true); }, children: "\u2715" })] })), expanded && (_jsxs(_Fragment, { children: [_jsx("div", { className: css.backdrop, onClick: () => setExpanded(false) }), _jsxs("div", { className: css.card, children: [_jsxs("div", { className: css.cardHead, children: [_jsx("span", { className: css.cardTitle, children: t('card.title') }), _jsxs("span", { className: css.band, children: [`${t('card.peakNow')}:`, _jsxs("span", { className: css.bandLabel, "data-peak": peakNow || undefined, children: [_jsx("span", { className: css.bandDot, "data-peak": peakNow || undefined }), peakNow ? t('card.peak') : t('card.off')] })] })] }), balance && (_jsxs("div", { className: css.balanceSection, children: [_jsxs("div", { className: css.balanceTotal, children: [_jsx("span", { className: css.balanceTotalLabel, children: t('card.totalBalance') }), _jsx("span", { className: css.balanceTotalValue, children: formatYuanText(balance.totalBalance) }), _jsx("a", { className: css.topUp, href: TOP_UP_URL, target: "_blank", rel: "noreferrer", title: t('card.topUpTitle'), children: t('card.topUp') })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.grantedBalance') }), _jsx("span", { children: formatYuanText(balance.grantedBalance) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.toppedUpBalance') }), _jsx("span", { children: formatYuanText(balance.toppedUpBalance) })] })] })), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.spent') }), _jsx("span", { children: view?.todayConsumed !== undefined
                                            ? `${view.todayConsumedSource === 'estimate' ? '≈' : ''}${formatYuan(view.todayConsumed)}`
                                            : '—' })] }), view?.totalConsumed !== undefined && (_jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.totalAll') }), _jsx("span", { children: formatYuan(view.totalConsumed) })] })), _jsx("div", { className: css.section, children: t('card.tokens.title') }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.tokens.inputCached') }), _jsx("span", { children: formatTokens(totals.cachedIn) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.tokens.inputUncached') }), _jsx("span", { children: formatTokens(totals.uncachedIn) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.tokens.output') }), _jsx("span", { children: formatTokens(totals.out) })] }), (totals.byModel.flash.cost > 0 || totals.byModel.pro.cost > 0) && (_jsxs(_Fragment, { children: [_jsx("div", { className: css.section, children: t('card.byModel') }), ['flash', 'pro'].map((model) => (totals.byModel[model].cost > 0 && (_jsxs("div", { className: css.row, children: [_jsx("span", { children: model }), _jsx("span", { children: formatYuan(totals.byModel[model].cost) })] }, model))))] })), _jsxs("div", { className: css.settingsBlock, children: [_jsx("div", { className: css.section, children: t('settings.title') }), _jsxs("label", { className: css.field, children: [_jsx("span", { children: t('settings.warn') }), _jsx("input", { type: "number", min: 1, step: 5, defaultValue: settings.warnYuan, onBlur: (event) => {
                                                    const value = Number(event.target.value);
                                                    if (Number.isFinite(value) && value > 0)
                                                        updateSettings({ warnYuan: value });
                                                } }, `warn-${settings.warnYuan}`)] }), _jsxs("label", { className: css.field, children: [_jsx("span", { children: t('settings.stopOnOver') }), _jsx("input", { type: "checkbox", checked: settings.stopOnOver, onChange: (event) => updateSettings({ stopOnOver: event.target.checked }) })] })] })] })] })), _jsxs("button", { type: "button", className: css.capsule, title: t('capsule.title'), "aria-label": t('capsule.label'), "aria-expanded": expanded, onClick: () => setExpanded((value) => !value), children: [_jsxs("span", { className: css.bandTag, "data-peak": peakNow || undefined, children: [_jsx("span", { className: css.bandDot, "data-peak": peakNow || undefined }), peakNow ? t('card.peak') : t('card.off')] }), _jsx("span", { className: css.text, children: balance ? formatYuanText(balance.totalBalance) : '¥--' })] })] }));
}
