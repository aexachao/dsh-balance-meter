window.__ModuleLoader__.load({
	id: "ds-budget-meter",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/client/locales.js
		/** `ds-budget-meter` namespace dictionaries: capsule, card, errors. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"capsule.label": "余额",
			"capsule.title": "打开余额面板",
			"card.title": "DeepSeek 余额",
			"card.totalBalance": "总余额",
			"card.grantedBalance": "赠送余额",
			"card.toppedUpBalance": "充值余额",
			"card.refresh": "刷新",
			"card.loading": "查询中…",
			"card.empty": "暂无余额数据",
			"card.close": "收起"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"capsule.label": "Balance",
			"capsule.title": "Open balance panel",
			"card.title": "DeepSeek Balance",
			"card.totalBalance": "Total balance",
			"card.grantedBalance": "Granted",
			"card.toppedUpBalance": "Topped up",
			"card.refresh": "Refresh",
			"card.loading": "Loading…",
			"card.empty": "No balance data",
			"card.close": "Collapse"
		};
		//#endregion
		//#region \0dsh-css:/private/tmp/budget-meter/src/client/BudgetCapsule.module.css.mjs
		const css = ".maG6Ya_wrap{display:inline-flex;position:relative}.maG6Ya_capsule{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);height:26px;color:var(--dsw-alias-label-secondary);cursor:pointer;border-radius:999px;align-items:center;gap:6px;padding:0 10px;font-size:12px;transition:background-color .12s,border-color .12s;display:inline-flex}.maG6Ya_capsule:hover{background:var(--dsw-alias-interactive-bg-hover)}.maG6Ya_capsule.maG6Ya_ok .maG6Ya_dot{background:var(--dsw-alias-state-success-primary)}.maG6Ya_capsule.maG6Ya_warn .maG6Ya_dot{background:var(--dsw-alias-state-warn-primary)}.maG6Ya_capsule.maG6Ya_error .maG6Ya_dot{background:var(--dsw-alias-state-error-primary)}.maG6Ya_dot{border-radius:50%;flex:none;width:7px;height:7px}.maG6Ya_label{color:var(--dsw-alias-label-secondary)}.maG6Ya_value{color:var(--dsw-alias-label-primary);font-variant-numeric:tabular-nums;font-weight:600}.maG6Ya_spin{border:2px solid var(--dsw-alias-border-l2);border-top-color:var(--dsw-alias-label-tertiary);border-radius:50%;width:10px;height:10px;animation:.8s linear infinite maG6Ya_budgetSpin}@keyframes maG6Ya_budgetSpin{to{transform:rotate(360deg)}}.maG6Ya_backdrop{z-index:90;position:fixed;inset:0}.maG6Ya_card{z-index:100;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-overlay);width:240px;box-shadow:var(--dsw-shadow-lv3);color:var(--dsw-alias-label-primary);border-radius:10px;padding:10px;position:absolute;top:calc(100% + 6px);right:0}.maG6Ya_cardHead{justify-content:space-between;align-items:center;margin-bottom:8px;display:flex}.maG6Ya_cardTitle{font-size:13px;font-weight:600}.maG6Ya_close{color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;border-radius:4px;padding:2px 4px;font-size:12px}.maG6Ya_close:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.maG6Ya_balanceRow{justify-content:space-between;align-items:center;padding:5px 0;display:flex}.maG6Ya_balanceLabel{color:var(--dsw-alias-label-secondary);font-size:12px}.maG6Ya_balanceValue{font-variant-numeric:tabular-nums;font-size:13px;font-weight:600}.maG6Ya_currency{color:var(--dsw-alias-label-tertiary);margin-top:2px;font-size:11px}.maG6Ya_error{background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent);color:var(--dsw-alias-state-error-primary);border-radius:6px;margin:4px 0;padding:6px 8px;font-size:12px;line-height:1.5}.maG6Ya_empty{text-align:center;color:var(--dsw-alias-label-tertiary);padding:14px 0;font-size:12px}.maG6Ya_footer{border-top:1px solid var(--dsw-alias-border-l1);justify-content:flex-end;margin-top:8px;padding-top:8px;display:flex}.maG6Ya_refresh{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);cursor:pointer;border:none;border-radius:6px;padding:4px 10px;font-size:12px}.maG6Ya_refresh:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}.maG6Ya_refresh:disabled{opacity:.6;cursor:default}";
		const tagId = "ds-budget-meter/BudgetCapsule.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "ds-budget-meter";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var BudgetCapsule_module_css_default = {
			"value": "maG6Ya_value",
			"dot": "maG6Ya_dot",
			"close": "maG6Ya_close",
			"cardHead": "maG6Ya_cardHead",
			"balanceRow": "maG6Ya_balanceRow",
			"cardTitle": "maG6Ya_cardTitle",
			"balanceValue": "maG6Ya_balanceValue",
			"warn": "maG6Ya_warn",
			"backdrop": "maG6Ya_backdrop",
			"refresh": "maG6Ya_refresh",
			"capsule": "maG6Ya_capsule",
			"empty": "maG6Ya_empty",
			"label": "maG6Ya_label",
			"spin": "maG6Ya_spin",
			"balanceLabel": "maG6Ya_balanceLabel",
			"currency": "maG6Ya_currency",
			"ok": "maG6Ya_ok",
			"wrap": "maG6Ya_wrap",
			"footer": "maG6Ya_footer",
			"card": "maG6Ya_card",
			"budgetSpin": "maG6Ya_budgetSpin",
			"error": "maG6Ya_error"
		};
		//#endregion
		//#region lib/client/BudgetCapsule.js
		/**
		* The floating balance capsule (shell.overlay entry): a pill showing the
		* real DeepSeek account balance; clicking it expands a card with the full
		* balance breakdown (total / granted / topped-up) and a refresh button.
		* Data comes from the host /budget/balance endpoint — no manual budgets.
		*/
		function formatBalance(value) {
			const n = Number(value);
			if (Number.isNaN(n)) return value;
			if (n >= 100) return n.toFixed(0);
			if (n >= 1) return n.toFixed(2);
			return n.toFixed(3);
		}
		function BudgetCapsule({ t }) {
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [view, setView] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [lastError, setLastError] = (0, react.useState)(null);
			const refresh = (0, react.useCallback)(async () => {
				setLoading(true);
				setLastError(null);
				try {
					const data = await (await fetch("/budget/balance", { cache: "no-store" })).json();
					setView(data);
					if (!data.ok) setLastError(data.error ?? "未知错误");
				} catch (error) {
					setLastError(String(error));
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
			const balanceText = primary ? `¥${formatBalance(primary.totalBalance)}` : "—";
			const tone = view?.ok ? primary ? "ok" : "warn" : "error";
			return (0, react_jsx_runtime.jsxs)("div", {
				className: BudgetCapsule_module_css_default.wrap,
				children: [(0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: `${BudgetCapsule_module_css_default.capsule} ${BudgetCapsule_module_css_default[tone]}`,
					onClick: () => {
						setExpanded((open) => !open);
					},
					"aria-expanded": expanded,
					"aria-label": t("capsule.label"),
					title: t("capsule.title"),
					children: [
						(0, react_jsx_runtime.jsx)("span", { className: BudgetCapsule_module_css_default.dot }),
						(0, react_jsx_runtime.jsx)("span", {
							className: BudgetCapsule_module_css_default.label,
							children: t("capsule.label")
						}),
						(0, react_jsx_runtime.jsx)("span", {
							className: BudgetCapsule_module_css_default.value,
							children: balanceText
						}),
						loading && (0, react_jsx_runtime.jsx)("span", { className: BudgetCapsule_module_css_default.spin })
					]
				}), expanded && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("div", {
					className: BudgetCapsule_module_css_default.backdrop,
					onClick: () => {
						setExpanded(false);
					}
				}), (0, react_jsx_runtime.jsxs)("div", {
					className: BudgetCapsule_module_css_default.card,
					role: "dialog",
					"aria-label": t("card.title"),
					children: [
						(0, react_jsx_runtime.jsxs)("div", {
							className: BudgetCapsule_module_css_default.cardHead,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: BudgetCapsule_module_css_default.cardTitle,
								children: t("card.title")
							}), (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: BudgetCapsule_module_css_default.close,
								onClick: () => {
									setExpanded(false);
								},
								"aria-label": t("card.close"),
								children: "✕"
							})]
						}),
						lastError !== null && (0, react_jsx_runtime.jsx)("div", {
							className: BudgetCapsule_module_css_default.error,
							children: lastError
						}),
						primary != null && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.balanceRow,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: BudgetCapsule_module_css_default.balanceLabel,
									children: t("card.totalBalance")
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: BudgetCapsule_module_css_default.balanceValue,
									children: ["¥", formatBalance(primary.totalBalance)]
								})]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.balanceRow,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: BudgetCapsule_module_css_default.balanceLabel,
									children: t("card.grantedBalance")
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: BudgetCapsule_module_css_default.balanceValue,
									children: ["¥", formatBalance(primary.grantedBalance)]
								})]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.balanceRow,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: BudgetCapsule_module_css_default.balanceLabel,
									children: t("card.toppedUpBalance")
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: BudgetCapsule_module_css_default.balanceValue,
									children: ["¥", formatBalance(primary.toppedUpBalance)]
								})]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: BudgetCapsule_module_css_default.currency,
								children: primary.currency
							})
						] }),
						view?.ok && primary === null && (0, react_jsx_runtime.jsx)("div", {
							className: BudgetCapsule_module_css_default.empty,
							children: t("card.empty")
						}),
						(0, react_jsx_runtime.jsx)("div", {
							className: BudgetCapsule_module_css_default.footer,
							children: (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: BudgetCapsule_module_css_default.refresh,
								onClick: () => {
									refresh();
								},
								disabled: loading,
								children: loading ? t("card.loading") : t("card.refresh")
							})
						})
					]
				})] })]
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