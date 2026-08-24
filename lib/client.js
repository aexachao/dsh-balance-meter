window.__ModuleLoader__.load({
	id: "ds-budget-meter",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/client/locales.js
		/** `ds-budget-meter` namespace dictionaries: capsule, card, statuses, errors. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"capsule.label": "余额",
			"capsule.title": "打开余额面板",
			"card.title": "DeepSeek 余额",
			"card.totalBalance": "总余额",
			"card.grantedBalance": "赠送余额",
			"card.toppedUpBalance": "充值余额",
			"card.currency": "币种",
			"card.refresh": "刷新",
			"card.loading": "查询中…",
			"card.empty": "暂无余额数据",
			"card.error": "余额查询失败",
			"card.close": "收起",
			"status.ok": "正常",
			"status.empty": "无数据",
			"status.error": "查询失败",
			"toast.close": "关闭"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"capsule.label": "Balance",
			"capsule.title": "Open balance panel",
			"card.title": "DeepSeek Balance",
			"card.totalBalance": "Total balance",
			"card.grantedBalance": "Granted",
			"card.toppedUpBalance": "Topped up",
			"card.currency": "Currency",
			"card.refresh": "Refresh",
			"card.loading": "Loading…",
			"card.empty": "No balance data",
			"card.error": "Balance query failed",
			"card.close": "Collapse",
			"status.ok": "OK",
			"status.empty": "Empty",
			"status.error": "Error",
			"toast.close": "Dismiss"
		};
		//#endregion
		//#region \0dsh-css:/Users/chrisli/Documents/dev/dsh-budget-meter/src/client/BudgetCapsule.module.css.mjs
		const css = "[class*=overlayLayer]{z-index:60}._5iDdYG_root{z-index:80;pointer-events:auto;color:var(--dsw-alias-label-primary,#e5e7eb);flex-direction:column;align-items:stretch;gap:8px;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;font-size:12px;line-height:1.5;display:flex;position:fixed;bottom:16px;right:16px}._5iDdYG_capsule{background:var(--dsw-alias-bg-layer-1,#171a21);border:1px solid var(--dsw-alias-border-l1,#27272a);color:inherit;cursor:pointer;border-radius:999px;align-items:center;gap:8px;padding:6px 12px;display:flex;box-shadow:0 4px 16px #0000004d}._5iDdYG_bandTag{color:var(--dsw-alias-label-secondary,#a1a1aa);background:var(--dsw-alias-bg-layer-2,#262b36);border-radius:4px;flex:none;padding:1px 6px;font-size:10px;line-height:1.4}._5iDdYG_bandTag[data-tone=ok]{color:var(--dsw-alias-state-success-primary,#34d399)}._5iDdYG_bandTag[data-tone=empty]{color:#f59e0b}._5iDdYG_bandTag[data-tone=error]{color:var(--dsw-alias-state-error-primary,#f87171)}._5iDdYG_text{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-secondary,#a1a1aa);text-align:right;min-width:44px}._5iDdYG_spin{border:2px solid var(--dsw-alias-border-l2,#3f3f46);border-top-color:var(--dsw-alias-label-tertiary,#71717a);border-radius:50%;flex:none;width:10px;height:10px;animation:.8s linear infinite _5iDdYG_budgetSpin}@keyframes _5iDdYG_budgetSpin{to{transform:rotate(360deg)}}._5iDdYG_card{background:var(--dsw-alias-bg-layer-1,#171a21);border:1px solid var(--dsw-alias-border-l1,#27272a);border-radius:12px;flex-direction:column;gap:6px;width:268px;padding:12px;display:flex;box-shadow:0 8px 24px #00000059}._5iDdYG_cardHead{align-items:center;gap:8px;display:flex}._5iDdYG_cardTitle{flex:1;font-size:13px;font-weight:600}._5iDdYG_band{color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:11px}._5iDdYG_band[data-tone=ok]{color:var(--dsw-alias-state-success-primary,#34d399)}._5iDdYG_band[data-tone=empty]{color:#f59e0b}._5iDdYG_band[data-tone=error]{color:var(--dsw-alias-state-error-primary,#f87171)}._5iDdYG_iconButton{color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer;background:0 0;border:0;flex:none;padding:2px 4px;font-size:12px}._5iDdYG_balanceTotal{flex-direction:column;gap:2px;margin:4px 0;display:flex}._5iDdYG_balanceTotalValue{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#e5e7eb);font-size:24px;font-weight:700;line-height:1.2}._5iDdYG_balanceTotalLabel{color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:11px}._5iDdYG_row{color:var(--dsw-alias-label-secondary,#a1a1aa);justify-content:space-between;gap:8px;display:flex}._5iDdYG_row>span:last-child{color:var(--dsw-alias-label-primary,#e5e7eb);font-variant-numeric:tabular-nums}._5iDdYG_empty{text-align:center;color:var(--dsw-alias-label-tertiary,#71717a);padding:14px 0}._5iDdYG_resetButton{border:1px solid var(--dsw-alias-border-l1,#27272a);background:var(--dsw-alias-bg-layer-2,#262b36);color:var(--dsw-alias-label-primary,#e5e7eb);cursor:pointer;border-radius:8px;margin-top:4px;padding:5px 8px}._5iDdYG_resetButton:disabled{opacity:.6;cursor:default}._5iDdYG_toast{background:var(--dsw-alias-bg-layer-1,#171a21);border:1px solid var(--dsw-alias-border-l1,#27272a);border-radius:10px;align-items:center;gap:8px;max-width:300px;padding:8px 12px;display:flex;box-shadow:0 8px 24px #00000059}._5iDdYG_toastText{flex:1}._5iDdYG_toast[data-level=error]{border-color:var(--dsw-alias-state-error-primary,#f87171)}";
		const tagId = "ds-budget-meter/BudgetCapsule.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "ds-budget-meter";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var BudgetCapsule_module_css_default = {
			"toast": "_5iDdYG_toast",
			"resetButton": "_5iDdYG_resetButton",
			"band": "_5iDdYG_band",
			"cardHead": "_5iDdYG_cardHead",
			"empty": "_5iDdYG_empty",
			"balanceTotalLabel": "_5iDdYG_balanceTotalLabel",
			"card": "_5iDdYG_card",
			"toastText": "_5iDdYG_toastText",
			"balanceTotalValue": "_5iDdYG_balanceTotalValue",
			"balanceTotal": "_5iDdYG_balanceTotal",
			"text": "_5iDdYG_text",
			"row": "_5iDdYG_row",
			"root": "_5iDdYG_root",
			"budgetSpin": "_5iDdYG_budgetSpin",
			"cardTitle": "_5iDdYG_cardTitle",
			"bandTag": "_5iDdYG_bandTag",
			"capsule": "_5iDdYG_capsule",
			"spin": "_5iDdYG_spin",
			"iconButton": "_5iDdYG_iconButton"
		};
		//#endregion
		//#region lib/client/BudgetCapsule.js
		/**
		* The floating budget capsule (shell.overlay entry).
		*
		* 原版（预算追踪）的改造：数据源从「会话 token 用量 × 峰谷价估算」换成
		* host /budget/balance 端点的真实 DeepSeek 账户余额。定位（右下角固定）、
		* 胶囊与卡片的视觉样式沿用原版：胶囊 = 状态标签 + 余额文本；点击展开
		* 卡片 = 总余额大字 + 赠送/充值分项 + 刷新按钮。查询失败时沿用原版
		* toast 横幅结构（常驻、可手动关闭）。
		*/
		function formatYuan(value) {
			const n = Number(value);
			if (Number.isNaN(n)) return value;
			if (n >= 100) return `¥${n.toFixed(0)}`;
			if (n >= 1) return `¥${n.toFixed(2)}`;
			if (n > 0) return `¥${n.toFixed(3)}`;
			return "¥0.00";
		}
		function BudgetCapsule({ t }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [view, setView] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [dismissed, setDismissed] = (0, react.useState)(false);
			const refresh = (0, react.useCallback)(async () => {
				setLoading(true);
				try {
					const r = await fetch("/budget/balance", { cache: "no-store" });
					setView(await r.json());
				} catch (error) {
					setView({
						ok: false,
						error: String(error)
					});
				} finally {
					setLoading(false);
				}
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				const timer = setInterval(() => {
					refresh();
				}, 6e4);
				return () => clearInterval(timer);
			}, [refresh]);
			const primary = view?.ok && view.balanceInfos?.length ? view.balanceInfos[0] : null;
			const tone = view?.ok ? primary ? "ok" : "empty" : "error";
			const statusLabel = view?.ok ? primary ? t("status.ok") : t("status.empty") : t("status.error");
			return (0, react_jsx_runtime.jsxs)("div", {
				className: BudgetCapsule_module_css_default.root,
				"data-tone": tone,
				children: [
					view && !view.ok && !dismissed && (0, react_jsx_runtime.jsxs)("div", {
						className: BudgetCapsule_module_css_default.toast,
						"data-level": "error",
						role: "alert",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: BudgetCapsule_module_css_default.toastText,
							children: view.error ?? t("card.error")
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: BudgetCapsule_module_css_default.iconButton,
							"aria-label": t("toast.close"),
							onClick: () => {
								setDismissed(true);
							},
							children: "✕"
						})]
					}),
					expanded && (0, react_jsx_runtime.jsxs)("div", {
						className: BudgetCapsule_module_css_default.card,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.cardHead,
								children: [
									(0, react_jsx_runtime.jsx)("span", {
										className: BudgetCapsule_module_css_default.cardTitle,
										children: t("card.title")
									}),
									(0, react_jsx_runtime.jsx)("span", {
										className: BudgetCapsule_module_css_default.band,
										"data-tone": tone,
										children: statusLabel
									}),
									(0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: BudgetCapsule_module_css_default.iconButton,
										"aria-label": t("card.close"),
										onClick: () => setExpanded(false),
										children: "✕"
									})
								]
							}),
							primary != null && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								(0, react_jsx_runtime.jsxs)("div", {
									className: BudgetCapsule_module_css_default.balanceTotal,
									children: [(0, react_jsx_runtime.jsx)("span", {
										className: BudgetCapsule_module_css_default.balanceTotalLabel,
										children: t("card.totalBalance")
									}), (0, react_jsx_runtime.jsx)("span", {
										className: BudgetCapsule_module_css_default.balanceTotalValue,
										children: formatYuan(primary.totalBalance)
									})]
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: BudgetCapsule_module_css_default.row,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.grantedBalance") }), (0, react_jsx_runtime.jsx)("span", { children: formatYuan(primary.grantedBalance) })]
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: BudgetCapsule_module_css_default.row,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.toppedUpBalance") }), (0, react_jsx_runtime.jsx)("span", { children: formatYuan(primary.toppedUpBalance) })]
								}),
								(0, react_jsx_runtime.jsxs)("div", {
									className: BudgetCapsule_module_css_default.row,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.currency") }), (0, react_jsx_runtime.jsx)("span", { children: primary.currency })]
								})
							] }),
							view?.ok && primary === null && (0, react_jsx_runtime.jsx)("div", {
								className: BudgetCapsule_module_css_default.empty,
								children: t("card.empty")
							}),
							(0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: BudgetCapsule_module_css_default.resetButton,
								disabled: loading,
								onClick: () => {
									refresh();
								},
								children: loading ? t("card.loading") : t("card.refresh")
							})
						]
					}),
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: BudgetCapsule_module_css_default.capsule,
						title: t("capsule.title"),
						"aria-label": t("capsule.label"),
						"aria-expanded": expanded,
						onClick: () => setExpanded((value) => !value),
						children: [
							(0, react_jsx_runtime.jsx)("span", {
								className: BudgetCapsule_module_css_default.bandTag,
								"data-tone": tone,
								children: statusLabel
							}),
							loading && (0, react_jsx_runtime.jsx)("span", { className: BudgetCapsule_module_css_default.spin }),
							(0, react_jsx_runtime.jsx)("span", {
								className: BudgetCapsule_module_css_default.text,
								children: primary ? formatYuan(primary.totalBalance) : "—"
							})
						]
					})
				]
			});
		}
		//#endregion
		//#region lib/client/index.js
		/**
		* ds-budget-meter client half: registers a floating balance capsule into the
		* layout's `shell.overlay` list slot.  The capsule shows the real DeepSeek
		* account balance fetched from the host /budget/balance endpoint.
		*/
		/** Dictionary namespace owned by this plugin. */
		const NS = "ds-budget-meter";
		/** Services required by the plugin. */
		const inject = ["slots", "locale"];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ds-budget-meter: dictionaries");
			ctx.effect(() => ctx.slots.inject("shell.overlay", () => ctx.slots.register({
				name: "shell.overlay",
				id: "ds-budget-meter",
				locale: NS
			}, BudgetCapsule)), "ds-budget-meter: balance capsule");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map