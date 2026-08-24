import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The floating budget capsule (shell.overlay entry).
 *
 * 原版（预算追踪）的改造：数据源从「会话 token 用量 × 峰谷价估算」换成
 * host /budget/balance 端点的真实 DeepSeek 账户余额。定位（右下角固定）、
 * 胶囊与卡片的视觉样式沿用原版：胶囊 = 状态标签 + 余额文本；点击展开
 * 卡片 = 总余额大字 + 赠送/充值分项 + 刷新按钮。查询失败时沿用原版
 * toast 横幅结构（常驻、可手动关闭）。
 */
import { useCallback, useEffect, useState } from 'react';
import css from './BudgetCapsule.module.css';
function formatYuan(value) {
    const n = Number(value);
    if (Number.isNaN(n))
        return value;
    if (n >= 100)
        return `¥${n.toFixed(0)}`;
    if (n >= 1)
        return `¥${n.toFixed(2)}`;
    if (n > 0)
        return `¥${n.toFixed(3)}`;
    return '¥0.00';
}
export function BudgetCapsule({ t }) {
    const [expanded, setExpanded] = useState(false);
    const [view, setView] = useState(null);
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState(false);
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
    // 首次挂载 + 每 60 秒自动刷新（沿用原版的分针 tick 节奏）。
    useEffect(() => {
        void refresh();
        const timer = setInterval(() => { void refresh(); }, 60_000);
        return () => clearInterval(timer);
    }, [refresh]);
    const primary = view?.ok && view.balanceInfos?.length ? view.balanceInfos[0] : null;
    const tone = view?.ok ? (primary ? 'ok' : 'empty') : 'error';
    const statusLabel = view?.ok ? (primary ? t('status.ok') : t('status.empty')) : t('status.error');
    return (_jsxs("div", { className: css.root, "data-tone": tone, children: [view && !view.ok && !dismissed && (_jsxs("div", { className: css.toast, "data-level": "error", role: "alert", children: [_jsx("span", { className: css.toastText, children: view.error ?? t('card.error') }), _jsx("button", { type: "button", className: css.iconButton, "aria-label": t('toast.close'), onClick: () => { setDismissed(true); }, children: "\u2715" })] })), expanded && (_jsxs("div", { className: css.card, children: [_jsxs("div", { className: css.cardHead, children: [_jsx("span", { className: css.cardTitle, children: t('card.title') }), _jsx("span", { className: css.band, "data-tone": tone, children: statusLabel }), _jsx("button", { type: "button", className: css.iconButton, "aria-label": t('card.close'), onClick: () => setExpanded(false), children: "\u2715" })] }), primary != null && (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.balanceTotal, children: [_jsx("span", { className: css.balanceTotalLabel, children: t('card.totalBalance') }), _jsx("span", { className: css.balanceTotalValue, children: formatYuan(primary.totalBalance) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.grantedBalance') }), _jsx("span", { children: formatYuan(primary.grantedBalance) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.toppedUpBalance') }), _jsx("span", { children: formatYuan(primary.toppedUpBalance) })] }), _jsxs("div", { className: css.row, children: [_jsx("span", { children: t('card.currency') }), _jsx("span", { children: primary.currency })] })] })), view?.ok && primary === null && (_jsx("div", { className: css.empty, children: t('card.empty') })), _jsx("button", { type: "button", className: css.resetButton, disabled: loading, onClick: () => { void refresh(); }, children: loading ? t('card.loading') : t('card.refresh') })] })), _jsxs("button", { type: "button", className: css.capsule, title: t('capsule.title'), "aria-label": t('capsule.label'), "aria-expanded": expanded, onClick: () => setExpanded((value) => !value), children: [_jsx("span", { className: css.bandTag, "data-tone": tone, children: statusLabel }), loading && _jsx("span", { className: css.spin }), _jsx("span", { className: css.text, children: primary ? formatYuan(primary.totalBalance) : '—' })] })] }));
}
