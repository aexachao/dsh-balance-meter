import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
/**
 * The floating balance capsule (shell.overlay entry): a pill showing the
 * real DeepSeek account balance; clicking it expands a card with the full
 * balance breakdown (total / granted / topped-up) and a refresh button.
 * Data comes from the host /budget/balance endpoint — no manual budgets.
 */
import { useCallback, useEffect, useState } from 'react';
import css from './BudgetCapsule.module.css';
function formatBalance(value) {
    const n = Number(value);
    if (Number.isNaN(n))
        return value;
    if (n >= 100)
        return n.toFixed(0);
    if (n >= 1)
        return n.toFixed(2);
    return n.toFixed(3);
}
export function BudgetCapsule({ t }) {
    const [expanded, setExpanded] = useState(false);
    const [view, setView] = useState(null);
    const [loading, setLoading] = useState(false);
    const [lastError, setLastError] = useState(null);
    const refresh = useCallback(async () => {
        setLoading(true);
        setLastError(null);
        try {
            const r = await fetch('/budget/balance', { cache: 'no-store' });
            const data = await r.json();
            setView(data);
            if (!data.ok)
                setLastError(data.error ?? '未知错误');
        }
        catch (error) {
            setLastError(String(error));
        }
        finally {
            setLoading(false);
        }
    }, []);
    // 首次挂载 + 每 60 秒自动刷新
    useEffect(() => {
        void refresh();
        const timer = setInterval(() => { void refresh(); }, 60_000);
        return () => clearInterval(timer);
    }, [refresh]);
    const primary = view?.ok && view.balanceInfos?.length
        ? view.balanceInfos[0]
        : null;
    const balanceText = primary ? `¥${formatBalance(primary.totalBalance)}` : '—';
    const tone = view?.ok ? (primary ? 'ok' : 'warn') : 'error';
    return (_jsxs("div", { className: css.wrap, children: [_jsxs("button", { type: "button", className: `${css.capsule} ${css[tone]}`, onClick: () => { setExpanded((open) => !open); }, "aria-expanded": expanded, "aria-label": t('capsule.label'), title: t('capsule.title'), children: [_jsx("span", { className: css.dot }), _jsx("span", { className: css.label, children: t('capsule.label') }), _jsx("span", { className: css.value, children: balanceText }), loading && _jsx("span", { className: css.spin })] }), expanded && (_jsxs(_Fragment, { children: [_jsx("div", { className: css.backdrop, onClick: () => { setExpanded(false); } }), _jsxs("div", { className: css.card, role: "dialog", "aria-label": t('card.title'), children: [_jsxs("div", { className: css.cardHead, children: [_jsx("span", { className: css.cardTitle, children: t('card.title') }), _jsx("button", { type: "button", className: css.close, onClick: () => { setExpanded(false); }, "aria-label": t('card.close'), children: "\u2715" })] }), lastError !== null && (_jsx("div", { className: css.error, children: lastError })), primary != null && (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.balanceRow, children: [_jsx("span", { className: css.balanceLabel, children: t('card.totalBalance') }), _jsxs("span", { className: css.balanceValue, children: ["\u00A5", formatBalance(primary.totalBalance)] })] }), _jsxs("div", { className: css.balanceRow, children: [_jsx("span", { className: css.balanceLabel, children: t('card.grantedBalance') }), _jsxs("span", { className: css.balanceValue, children: ["\u00A5", formatBalance(primary.grantedBalance)] })] }), _jsxs("div", { className: css.balanceRow, children: [_jsx("span", { className: css.balanceLabel, children: t('card.toppedUpBalance') }), _jsxs("span", { className: css.balanceValue, children: ["\u00A5", formatBalance(primary.toppedUpBalance)] })] }), _jsx("div", { className: css.currency, children: primary.currency })] })), view?.ok && primary === null && (_jsx("div", { className: css.empty, children: t('card.empty') })), _jsx("div", { className: css.footer, children: _jsx("button", { type: "button", className: css.refresh, onClick: () => { void refresh(); }, disabled: loading, children: loading ? t('card.loading') : t('card.refresh') }) })] })] }))] }));
}
