import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The floating budget capsule (shell.overlay entry): a pill with a mini
 * progress bar and spent/budget figures; clicking it expands a card with the
 * full progress bar, the period's token breakdown, per-model costs, and the
 * settings (budget / period / warn threshold / default model). Threshold
 * crossings raise a toast once per period per level.
 */
import { useEffect, useState, useSyncExternalStore } from 'react';
import { aggregateSince, periodStartMs } from "./ledger.js";
import { isPeak, parsePeakWindows } from "./pricing.js";
import { clearNotified, getSettings, ledger, markDismissed, markNotified, subscribeSettings, updateSettings, wasDismissed, wasNotified, } from "./store.js";
import css from './BudgetCapsule.module.css';
function formatYuan(value) {
    if (value >= 100)
        return `¥${value.toFixed(0)}`;
    if (value >= 1)
        return `¥${value.toFixed(2)}`;
    if (value > 0)
        return `¥${value.toFixed(3)}`;
    return '¥0.00';
}
function formatTokens(count) {
    if (count >= 1_000_000)
        return `${(count / 1_000_000).toFixed(1)}M`;
    if (count >= 1_000)
        return `${(count / 1_000).toFixed(1)}k`;
    return String(count);
}
export function BudgetCapsule({ t }) {
    useSyncExternalStore(ledger.subscribe, ledger.getSnapshotVersion);
    const settings = useSyncExternalStore(subscribeSettings, getSettings);
    const [expanded, setExpanded] = useState(false);
    const [toast, setToast] = useState(null);
    const [dismissed, setDismissed] = useState(false);
    const [, setTick] = useState(0);
    // Minute tick: keeps the peak/off-peak badge and the period rollover honest.
    useEffect(() => {
        const timer = setInterval(() => setTick((n) => n + 1), 60_000);
        return () => clearInterval(timer);
    }, []);
    const now = Date.now();
    const start = periodStartMs(settings.period, now);
    const totals = aggregateSince(ledger.all(), start);
    const totalAllCost = aggregateSince(ledger.all(), 0).cost;
    const percent = settings.budgetYuan > 0 ? (totals.cost / settings.budgetYuan) * 100 : 0;
    const tone = percent >= 100 ? 'over' : percent >= settings.warnPercent ? 'warn' : 'ok';
    const periodKey = `${settings.period}:${start}`;
    const periodLabel = settings.period === 'daily'
        ? t('settings.period.daily')
        : settings.period === 'monthly' ? t('settings.period.monthly') : t('settings.period.total');
    // Threshold crossings: warn fires a transient toast once per period; the
    // over-budget banner is persistent (manual dismiss) so it cannot be missed.
    useEffect(() => { setDismissed(wasDismissed(periodKey)); }, [periodKey]);
    useEffect(() => {
        if (percent >= settings.warnPercent && percent < 100 && !wasNotified(periodKey, 'warn')) {
            markNotified(periodKey, 'warn');
            setToast('warn');
        }
    }, [percent, settings.warnPercent, periodKey]);
    useEffect(() => {
        if (toast === null)
            return;
        const timer = setTimeout(() => setToast(null), 8000);
        return () => clearTimeout(timer);
    }, [toast]);
    const peakNow = isPeak(now, parsePeakWindows(settings.peakWindows), settings.pricingTimezone);
    const width = `${Math.min(100, percent)}%`;
    return (_jsxs("div", { className: css.root, "data-tone": tone, children: [percent >= 100 && !dismissed && (_jsxs("div", { className: css.toast, "data-level": "over", role: "alert", children: [_jsx("span", { className: css.toastText, children: t('toast.over', { spent: formatYuan(totals.cost), budget: formatYuan(settings.budgetYuan) }) }), _jsx("button", { type: "button", className: css.iconButton, "aria-label": t('toast.close'), onClick: () => { markDismissed(periodKey); setDismissed(true); }, children: "\u2715" })] })), toast === 'warn' && (_jsx("div", { className: css.toast, "data-level": "warn", role: "alert", children: _jsx("span", { className: css.toastText, children: t('toast.warn', { percent: String(Math.round(percent)), spent: formatYuan(totals.cost), budget: formatYuan(settings.budgetYuan) }) }) })), expanded && (_jsxs("div", { className: css.card, children: [_jsxs("div", { className: css.cardHead, children: [_jsx("span", { className: css.cardTitle, children: t('card.title') }), _jsx("span", { className: css.band, "data-peak": peakNow || undefined, children: `${t('card.peakNow')}: ${peakNow ? t('card.peak') : t('card.off')}` }), _jsx("button", { type: "button", className: css.iconButton, "aria-label": t('card.close'), onClick: () => setExpanded(false), children: "\u2715" })] }), _jsxs("div", { className: css.progressBar, children: [_jsx("span", { className: css.progressFill, style: { width } }), _jsx("span", { className: css.progressLabel, children: `${Math.round(percent)}%` })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.spent') }), _jsx("span", { children: formatYuan(totals.cost) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.budget') }), _jsx("span", { children: formatYuan(settings.budgetYuan) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.period') }), _jsx("span", { children: periodLabel })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.totalAll') }), _jsx("span", { children: formatYuan(totalAllCost) })] }), _jsx("div", { className: css.section, children: t('card.tokens.title') }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.tokens.inputCached') }), _jsx("span", { children: formatTokens(totals.cachedIn) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.tokens.inputUncached') }), _jsx("span", { children: formatTokens(totals.uncachedIn) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.tokens.output') }), _jsx("span", { children: formatTokens(totals.out) })] }), (totals.byModel.flash.cost > 0 || totals.byModel.pro.cost > 0) && (_jsxs(_Fragment, { children: [_jsx("div", { className: css.section, children: t('card.byModel') }), ['flash', 'pro'].map((model) => (totals.byModel[model].cost > 0 && (_jsxs("div", { className: css.row, children: [_jsx("span", { children: model }), _jsx("span", { children: formatYuan(totals.byModel[model].cost) })] }, model))))] })), _jsx("div", { className: css.section, children: t('settings.title') }), _jsxs("label", { className: css.field, children: [_jsx("span", { children: t('settings.budget') }), _jsx("input", { type: "number", min: 1, step: 10, defaultValue: settings.budgetYuan, onBlur: (event) => {
                                    const value = Number(event.target.value);
                                    if (Number.isFinite(value) && value > 0)
                                        updateSettings({ budgetYuan: value });
                                } }, `budget-${settings.budgetYuan}`)] }), _jsxs("label", { className: css.field, children: [_jsx("span", { children: t('settings.warn') }), _jsx("input", { type: "number", min: 1, max: 100, defaultValue: settings.warnPercent, onBlur: (event) => {
                                    const value = Number(event.target.value);
                                    if (Number.isFinite(value) && value >= 1 && value <= 100)
                                        updateSettings({ warnPercent: value });
                                } }, `warn-${settings.warnPercent}`)] }), _jsxs("label", { className: css.field, children: [_jsx("span", { children: t('settings.period') }), _jsxs("select", { value: settings.period, onChange: (event) => updateSettings({ period: event.target.value }), children: [_jsx("option", { value: "daily", children: t('settings.period.daily') }), _jsx("option", { value: "monthly", children: t('settings.period.monthly') }), _jsx("option", { value: "total", children: t('settings.period.total') })] })] }), _jsxs("label", { className: css.field, children: [_jsx("span", { children: t('settings.stopOnOver') }), _jsx("input", { type: "checkbox", checked: settings.stopOnOver, onChange: (event) => updateSettings({ stopOnOver: event.target.checked }) })] }), _jsx("button", { type: "button", className: css.resetButton, onClick: () => { ledger.resetSince(start); clearNotified(periodKey); }, children: t('card.reset') })] })), _jsxs("button", { type: "button", className: css.capsule, title: t('capsule.title'), "aria-label": t('capsule.label'), "aria-expanded": expanded, onClick: () => setExpanded((value) => !value), children: [_jsx("span", { className: css.bandTag, "data-peak": peakNow || undefined, children: peakNow ? t('card.peak') : t('card.off') }), _jsx("span", { className: css.bar, children: _jsx("span", { className: css.barFill, style: { width } }) }), _jsx("span", { className: css.text, children: `${formatYuan(totals.cost)} / ${formatYuan(settings.budgetYuan)}` })] })] }));
}
