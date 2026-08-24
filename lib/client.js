window.__ModuleLoader__.load({
	id: "ds-budget-meter",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react_jsx_runtime = require("react/jsx-runtime");
		let react = require("react");
		//#region lib/client/locales.js
		/** `ds-budget-meter` namespace dictionaries: capsule, card, settings, toasts. */
		/** Simplified Chinese dictionary (the key-set source of truth). */
		const zh = {
			"capsule.label": "余额",
			"capsule.title": "打开余额与用量面板",
			"card.title": "用量与余额",
			"card.spent": "今日已花费",
			"card.totalAll": "累计（含往期）",
			"card.peakNow": "当前时段",
			"card.peak": "高峰",
			"card.off": "空闲",
			"card.tokens.title": "今日 tokens",
			"card.tokens.inputCached": "输入（缓存命中）",
			"card.tokens.inputUncached": "输入（缓存未命中）",
			"card.tokens.output": "输出",
			"card.byModel": "按模型",
			"card.totalBalance": "总余额",
			"card.grantedBalance": "赠送余额",
			"card.toppedUpBalance": "充值余额",
			"card.topUp": "去充值",
			"card.topUpTitle": "打开 DeepSeek 充值页面",
			"card.balanceError": "余额查询失败",
			"settings.title": "设置",
			"settings.warn": "花费提醒阈值（元）",
			"settings.stopOnOver": "达到阈值自动停止回合",
			"toast.warn": "今日已花费 {spent}，达到提醒阈值 {warn}",
			"toast.close": "关闭"
		};
		/** English dictionary, checked complete against the zh key set. */
		const en = {
			"capsule.label": "Balance",
			"capsule.title": "Open balance & usage panel",
			"card.title": "Usage & balance",
			"card.spent": "Spent today",
			"card.totalAll": "Total (all time)",
			"card.peakNow": "Current band",
			"card.peak": "Peak",
			"card.off": "Off-peak",
			"card.tokens.title": "Tokens today",
			"card.tokens.inputCached": "Input (cache hit)",
			"card.tokens.inputUncached": "Input (cache miss)",
			"card.tokens.output": "Output",
			"card.byModel": "By model",
			"card.totalBalance": "Total balance",
			"card.grantedBalance": "Granted",
			"card.toppedUpBalance": "Topped up",
			"card.topUp": "Top up",
			"card.topUpTitle": "Open the DeepSeek top-up page",
			"card.balanceError": "Balance query failed",
			"settings.title": "Settings",
			"settings.warn": "Spend alert threshold (CNY)",
			"settings.stopOnOver": "Auto-stop turn at threshold",
			"toast.warn": "Spent {spent} today — alert threshold {warn} reached",
			"toast.close": "Dismiss"
		};
		//#endregion
		//#region lib/client/ledger.js
		/**
		* Cost ledger: one record per finalized assistant message, deduped by a
		* stable key so re-scanning a conversation snapshot never double-counts.
		* The pure record operations are asserted offline in scripts/verify.mjs;
		* {@link LedgerStore} adds the observable/persistence wiring used in the
		* browser (storage callbacks are injected, so the class stays testable).
		*/
		function zeroModelTotals() {
			return {
				cost: 0,
				cachedIn: 0,
				uncachedIn: 0,
				out: 0
			};
		}
		function emptyTotals() {
			return {
				...zeroModelTotals(),
				byModel: {
					flash: zeroModelTotals(),
					pro: zeroModelTotals()
				}
			};
		}
		/** Insert or replace by key; reports whether anything changed. */
		function upsertRecord(records, rec) {
			const existing = records.find((r) => r.key === rec.key);
			if (existing !== void 0) {
				if (existing.sessionId === rec.sessionId && existing.model === rec.model && existing.time === rec.time && existing.cachedIn === rec.cachedIn && existing.uncachedIn === rec.uncachedIn && existing.out === rec.out && existing.cost === rec.cost) return {
					records: [...records],
					changed: false
				};
				return {
					records: records.map((r) => r.key === rec.key ? rec : r),
					changed: true
				};
			}
			return {
				records: [...records, rec],
				changed: true
			};
		}
		/** Drop records older than `cutoffMs`. */
		function pruneRecords(records, cutoffMs) {
			const next = records.filter((r) => r.time >= cutoffMs);
			return {
				records: next,
				changed: next.length !== records.length
			};
		}
		/** Drop records at or after `sinceMs` (period reset). */
		function resetRecordsSince(records, sinceMs) {
			const next = records.filter((r) => r.time < sinceMs);
			return {
				records: next,
				changed: next.length !== records.length
			};
		}
		/** Aggregate cost/tokens over records at or after `sinceMs` (0 = everything). */
		function aggregateSince(records, sinceMs) {
			const totals = emptyTotals();
			for (const r of records) {
				if (r.time < sinceMs) continue;
				totals.cost += r.cost;
				totals.cachedIn += r.cachedIn;
				totals.uncachedIn += r.uncachedIn;
				totals.out += r.out;
				const per = totals.byModel[r.model];
				per.cost += r.cost;
				per.cachedIn += r.cachedIn;
				per.uncachedIn += r.uncachedIn;
				per.out += r.out;
			}
			return totals;
		}
		/** Start of the current budget window in local time (0 for `total`). */
		function periodStartMs(period, now) {
			const date = new Date(now);
			if (period === "daily") return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
			if (period === "monthly") return new Date(date.getFullYear(), date.getMonth(), 1).getTime();
			return 0;
		}
		/** Observable ledger over an injected load/save pair. */
		var LedgerStore = class {
			records;
			version = 0;
			listeners = /* @__PURE__ */ new Set();
			save;
			constructor(load, save) {
				this.records = load();
				this.save = save;
			}
			getSnapshotVersion = () => this.version;
			subscribe = (listener) => {
				this.listeners.add(listener);
				return () => {
					this.listeners.delete(listener);
				};
			};
			all() {
				return this.records;
			}
			upsert(rec) {
				const { records, changed } = upsertRecord(this.records, rec);
				if (!changed) return false;
				this.records = records;
				this.persist();
				return true;
			}
			resetSince(sinceMs) {
				const { records, changed } = resetRecordsSince(this.records, sinceMs);
				if (!changed) return;
				this.records = records;
				this.persist();
			}
			prune(olderThanMs) {
				const { records, changed } = pruneRecords(this.records, olderThanMs);
				if (!changed) return;
				this.records = records;
				this.persist();
			}
			persist() {
				this.version += 1;
				try {
					this.save(this.records);
				} catch {}
				for (const listener of [...this.listeners]) listener();
			}
		};
		/** Validate a persisted payload back into records (drops malformed rows). */
		function parseLedgerPayload(raw) {
			if (!Array.isArray(raw)) return [];
			const out = [];
			for (const item of raw) {
				if (typeof item !== "object" || item === null) continue;
				const r = item;
				if (typeof r.key !== "string" || typeof r.sessionId !== "string" || r.model !== "flash" && r.model !== "pro" || typeof r.time !== "number" || typeof r.cost !== "number" || typeof r.cachedIn !== "number" || typeof r.uncachedIn !== "number" || typeof r.out !== "number") continue;
				out.push({
					key: r.key,
					sessionId: r.sessionId,
					model: r.model,
					time: r.time,
					cachedIn: r.cachedIn,
					uncachedIn: r.uncachedIn,
					out: r.out,
					cost: r.cost
				});
			}
			return out;
		}
		//#endregion
		//#region lib/client/pricing.js
		/**
		* DeepSeek V4 pricing (CNY per million tokens) and peak/off-peak helpers.
		* Pure module: asserted offline in scripts/verify.mjs.
		*
		* Official peak windows: 09:00–12:00 and 14:00–18:00 Beijing time; off-peak
		* prices are half of peak. Both the table and the windows are overridable
		* through the plugin Config.
		*/
		/** CNY per million tokens, per peak/off-peak band. */
		const PRICING = {
			flash: {
				off: {
					cachedIn: .05,
					uncachedIn: 1.5,
					out: 4.5
				},
				peak: {
					cachedIn: .1,
					uncachedIn: 3,
					out: 9
				}
			},
			pro: {
				off: {
					cachedIn: .15,
					uncachedIn: 4.5,
					out: 13.5
				},
				peak: {
					cachedIn: .3,
					uncachedIn: 9,
					out: 27
				}
			}
		};
		/** Parse `HH:MM-HH:MM,HH:MM-HH:MM` into windows; malformed parts are dropped. */
		function parsePeakWindows(spec) {
			const windows = [];
			for (const part of spec.split(",")) {
				const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(part.trim());
				if (match === null) continue;
				const startMin = Number(match[1]) * 60 + Number(match[2]);
				const endMin = Number(match[3]) * 60 + Number(match[4]);
				if (startMin >= 1440 || endMin > 1440 || startMin >= endMin) continue;
				windows.push({
					startMin,
					endMin
				});
			}
			return windows;
		}
		/** Minutes-of-day in `timeZone` for one epoch-ms instant. */
		function minutesOfDay(timeMs, timeZone) {
			const parts = new Intl.DateTimeFormat("en-GB", {
				timeZone,
				hour: "2-digit",
				minute: "2-digit",
				hour12: false
			}).formatToParts(timeMs);
			let hour = 0;
			let minute = 0;
			for (const part of parts) {
				if (part.type === "hour") hour = Number(part.value) % 24;
				if (part.type === "minute") minute = Number(part.value);
			}
			return hour * 60 + minute;
		}
		/** Whether `timeMs` falls inside a peak window (start inclusive, end exclusive). */
		function isPeak(timeMs, windows, timeZone) {
			const minute = minutesOfDay(timeMs, timeZone);
			return windows.some((w) => minute >= w.startMin && minute < w.endMin);
		}
		/**
		* Whether one request should be priced by this meter (DeepSeek-only pricing).
		* Excludes a request only when its provider/model identity is KNOWN and not
		* DeepSeek (wire values look like `deepseek-official` / `deepseek-v4-flash`).
		* Client nodes replayed from history carry no provider/model identity at all,
		* and this deployment composes DeepSeek providers only — absent identity is
		* therefore priced as DeepSeek rather than dropped.
		*/
		function isDeepSeekProvider(provider, model) {
			const p = provider?.toLowerCase();
			const m = model?.toLowerCase();
			if (p !== void 0 && p.includes("deepseek")) return true;
			if (m !== void 0 && m.includes("deepseek")) return true;
			if (p !== void 0 || m !== void 0) return false;
			return true;
		}
		/**
		* Map a DeepSeek request onto one of the two priced profiles. Flash names map
		* to flash, pro names to pro. When the model name is absent (history replay)
		* or unknown, fall back to flash — the deployment's default composition and
		* the cheaper table, so a missing identity warns late rather than 3x early;
		* switching between the two deployed models still prices each request by its
		* own name whenever the name is visible.
		*/
		function deepseekProfile(model) {
			const lower = model?.toLowerCase();
			if (lower === void 0) return "flash";
			if (lower.includes("pro")) return "pro";
			return "flash";
		}
		/** Cost in CNY for one request's token triple at one band. */
		function costOf(tokens, profile, peak) {
			const price = peak ? PRICING[profile].peak : PRICING[profile].off;
			const perMillion = 1 / 1e6;
			return tokens.cachedIn * price.cachedIn * perMillion + tokens.uncachedIn * price.uncachedIn * perMillion + tokens.out * price.out * perMillion;
		}
		//#endregion
		//#region lib/client/store.js
		/**
		* Browser-side singletons: the persisted settings (localStorage overrides the
		* Config defaults seeded at apply time), the persisted ledger, and the
		* per-period notification flags. Everything is observable through
		* useSyncExternalStore-friendly subscribe/getSnapshot pairs.
		*/
		/** Built-in defaults (mirror the host Config schema defaults). */
		const DEFAULT_SETTINGS = {
			warnYuan: 20,
			stopOnOver: true,
			peakWindows: "09:00-12:00,14:00-18:00",
			pricingTimezone: "Asia/Shanghai"
		};
		const SETTINGS_KEY = "ds-budget-meter/v1/settings";
		const LEDGER_KEY = "ds-budget-meter/v1/ledger";
		const NOTIFIED_KEY = "ds-budget-meter/v1/notified";
		function readJson(key) {
			try {
				const raw = localStorage.getItem(key);
				return raw === null ? null : JSON.parse(raw);
			} catch {
				return null;
			}
		}
		function writeJson(key, value) {
			try {
				localStorage.setItem(key, JSON.stringify(value));
			} catch {}
		}
		function isRecord(value) {
			return typeof value === "object" && value !== null;
		}
		function loadSettings() {
			const settings = { ...DEFAULT_SETTINGS };
			const stored = readJson(SETTINGS_KEY);
			if (isRecord(stored)) mergeSettings(settings, stored);
			return settings;
		}
		function mergeSettings(settings, source) {
			if (typeof source.warnYuan === "number" && Number.isFinite(source.warnYuan) && source.warnYuan > 0) settings.warnYuan = source.warnYuan;
			if (typeof source.stopOnOver === "boolean") settings.stopOnOver = source.stopOnOver;
			if (typeof source.peakWindows === "string" && source.peakWindows !== "") settings.peakWindows = source.peakWindows;
			if (typeof source.pricingTimezone === "string" && source.pricingTimezone !== "") settings.pricingTimezone = source.pricingTimezone;
		}
		let settings = loadSettings();
		const settingsListeners = /* @__PURE__ */ new Set();
		/** Seed defaults from the row config (when the loader passes one). */
		function seedSettingsFromConfig(config) {
			if (!isRecord(config)) return;
			const next = { ...settings };
			mergeSettings(next, config);
			settings = next;
			notifySettings();
		}
		function getSettings() {
			return settings;
		}
		function subscribeSettings(listener) {
			settingsListeners.add(listener);
			return () => {
				settingsListeners.delete(listener);
			};
		}
		function updateSettings(patch) {
			const next = { ...settings };
			mergeSettings(next, patch);
			settings = next;
			writeJson(SETTINGS_KEY, settings);
			notifySettings();
		}
		function notifySettings() {
			for (const listener of [...settingsListeners]) listener();
		}
		const ledger = new LedgerStore(() => parseLedgerPayload(readJson(LEDGER_KEY)), (records) => writeJson(LEDGER_KEY, records));
		function readNotified() {
			const stored = readJson(NOTIFIED_KEY);
			return isRecord(stored) ? stored : {};
		}
		function wasNotified(periodKey, level) {
			return readNotified()[periodKey]?.[level] === true;
		}
		function markNotified(periodKey, level) {
			const map = readNotified();
			const entry = map[periodKey] ?? {};
			entry[level] = true;
			if (level === "over") entry.warn = true;
			map[periodKey] = entry;
			writeJson(NOTIFIED_KEY, map);
		}
		//#endregion
		//#region \0dsh-css:/Users/chrisli/Documents/dev/dsh-budget-meter/src/client/BudgetCapsule.module.css.mjs
		const css = "._5iDdYG_root{height:32px;color:var(--dsw-alias-label-primary,#e5e7eb);order:-1;align-self:center;align-items:center;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,PingFang SC,Microsoft YaHei,sans-serif;font-size:12px;line-height:1.5;display:flex;position:relative}._5iDdYG_capsule{border:1px solid var(--dsw-alias-border-l2);height:32px;color:var(--dsw-alias-label-primary);font-family:var(--dsw-font-family);cursor:pointer;background:0 0;border-radius:18px;justify-content:center;align-items:center;gap:8px;padding:6px 12px;font-size:13px;font-weight:400;line-height:20px;display:inline-flex}._5iDdYG_capsule:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}._5iDdYG_bandTag{color:var(--dsw-alias-label-secondary);flex:none;align-items:center;gap:4px;font-size:12px;line-height:20px;display:inline-flex}._5iDdYG_bandTag[data-peak]{color:#f59e0b}._5iDdYG_bandDot{background:var(--dsw-alias-state-success-primary,#34d399);border-radius:50%;flex:none;width:6px;height:6px}._5iDdYG_bandDot[data-peak]{background:#f59e0b}._5iDdYG_text{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary);white-space:nowrap;flex:none;font-size:12px;font-weight:500}._5iDdYG_backdrop{z-index:90;position:fixed;inset:0}._5iDdYG_card{z-index:100;background:var(--dsw-alias-bg-layer-1,#171a21);border:1px solid var(--dsw-alias-border-l1,#27272a);border-radius:12px;flex-direction:column;gap:6px;width:268px;padding:12px;display:flex;position:absolute;top:calc(100% + 6px);right:0;box-shadow:0 8px 24px #00000059}._5iDdYG_cardHead{align-items:center;gap:8px;display:flex}._5iDdYG_cardTitle{flex:1;font-size:13px;font-weight:600}._5iDdYG_band{color:var(--dsw-alias-label-secondary,#a1a1aa);align-items:center;gap:8px;font-size:11px;display:inline-flex}._5iDdYG_bandLabel{color:inherit;align-items:center;gap:4px;display:inline-flex}._5iDdYG_bandLabel[data-peak]{color:#f59e0b}._5iDdYG_iconButton{color:var(--dsw-alias-label-secondary,#a1a1aa);cursor:pointer;background:0 0;border:0;flex:none;padding:2px 4px;font-size:12px}._5iDdYG_balanceSection{border-bottom:1px solid var(--dsw-alias-border-l1,#27272a);flex-direction:column;gap:5px;margin:2px 0 4px;padding-bottom:8px;display:flex}._5iDdYG_balanceTotal{align-items:flex-end;gap:8px;display:flex}._5iDdYG_balanceTotalLabel{color:var(--dsw-alias-label-secondary,#a1a1aa);font-size:11px}._5iDdYG_balanceTotalValue{font-variant-numeric:tabular-nums;color:var(--dsw-alias-label-primary,#e5e7eb);flex:1;font-size:24px;font-weight:700;line-height:1.2}._5iDdYG_topUp{border:1px solid var(--dsw-alias-border-l2,#3f3f46);background:var(--dsw-alias-bg-layer-2,#262b36);color:var(--dsw-alias-brand-primary,#4d6bfe);cursor:pointer;border-radius:6px;flex:none;padding:3px 10px;font-size:11px;text-decoration:none}._5iDdYG_topUp:hover{background:var(--dsw-alias-interactive-bg-hover,#33363e)}._5iDdYG_spendStats{border-bottom:1px solid var(--dsw-alias-border-l1,#27272a);flex-direction:column;gap:6px;padding-bottom:8px;display:flex}._5iDdYG_row{color:var(--dsw-alias-label-secondary,#a1a1aa);justify-content:space-between;gap:8px;display:flex}._5iDdYG_row>span:last-child{color:var(--dsw-alias-label-primary,#e5e7eb);font-variant-numeric:tabular-nums}._5iDdYG_section{text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-secondary,#a1a1aa);margin-top:6px;font-size:11px}._5iDdYG_settingsBlock{border-top:1px solid var(--dsw-alias-border-l1,#27272a);margin-top:8px;padding-top:8px}._5iDdYG_field{color:var(--dsw-alias-label-secondary,#a1a1aa);justify-content:space-between;align-items:center;gap:8px;display:flex}._5iDdYG_field input[type=number],._5iDdYG_field select{border:1px solid var(--dsw-alias-border-l1,#27272a);background:var(--dsw-alias-bg-layer-2,#262b36);width:108px;color:var(--dsw-alias-label-primary,#e5e7eb);border-radius:6px;padding:3px 6px;font-size:12px}._5iDdYG_toast{background:var(--dsw-alias-bg-layer-1,#171a21);border:1px solid var(--dsw-alias-border-l1,#27272a);border-radius:10px;align-items:center;gap:8px;max-width:300px;padding:8px 12px;display:flex;position:absolute;bottom:calc(100% + 6px);right:0;box-shadow:0 8px 24px #00000059}._5iDdYG_toastText{flex:1}._5iDdYG_toast[data-level=warn]{border-color:#f59e0b}._5iDdYG_toast[data-level=error]{border-color:var(--dsw-alias-state-error-primary,#f87171)}";
		const tagId = "ds-budget-meter/BudgetCapsule.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "ds-budget-meter";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var BudgetCapsule_module_css_default = {
			"text": "_5iDdYG_text",
			"backdrop": "_5iDdYG_backdrop",
			"root": "_5iDdYG_root",
			"settingsBlock": "_5iDdYG_settingsBlock",
			"field": "_5iDdYG_field",
			"row": "_5iDdYG_row",
			"card": "_5iDdYG_card",
			"iconButton": "_5iDdYG_iconButton",
			"balanceSection": "_5iDdYG_balanceSection",
			"toast": "_5iDdYG_toast",
			"capsule": "_5iDdYG_capsule",
			"cardHead": "_5iDdYG_cardHead",
			"cardTitle": "_5iDdYG_cardTitle",
			"section": "_5iDdYG_section",
			"toastText": "_5iDdYG_toastText",
			"balanceTotal": "_5iDdYG_balanceTotal",
			"balanceTotalValue": "_5iDdYG_balanceTotalValue",
			"topUp": "_5iDdYG_topUp",
			"bandLabel": "_5iDdYG_bandLabel",
			"spendStats": "_5iDdYG_spendStats",
			"bandDot": "_5iDdYG_bandDot",
			"balanceTotalLabel": "_5iDdYG_balanceTotalLabel",
			"bandTag": "_5iDdYG_bandTag",
			"band": "_5iDdYG_band"
		};
		//#endregion
		//#region lib/client/BudgetCapsule.js
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
		/** 充值快捷跳转目标（外链，由桌面端桥接在系统浏览器打开）。 */
		const TOP_UP_URL = "https://platform.deepseek.com/top_up";
		function formatYuan(value) {
			if (value >= 100) return `¥${value.toFixed(0)}`;
			if (value >= 1) return `¥${value.toFixed(2)}`;
			if (value > 0) return `¥${value.toFixed(3)}`;
			return "¥0.00";
		}
		/** 余额接口返回的是字符串金额，格式化同 formatYuan。 */
		function formatYuanText(value) {
			const n = Number(value);
			if (Number.isNaN(n)) return value;
			return formatYuan(n);
		}
		function formatTokens(count) {
			if (count >= 1e6) return `${(count / 1e6).toFixed(1)}M`;
			if (count >= 1e3) return `${(count / 1e3).toFixed(1)}k`;
			return String(count);
		}
		function BudgetCapsule({ t }) {
			(0, react.useSyncExternalStore)(ledger.subscribe, ledger.getSnapshotVersion);
			const settings = (0, react.useSyncExternalStore)(subscribeSettings, getSettings);
			const [expanded, setExpanded] = (0, react.useState)(false);
			const [toast, setToast] = (0, react.useState)(false);
			const [, setTick] = (0, react.useState)(0);
			const [view, setView] = (0, react.useState)(null);
			const [loading, setLoading] = (0, react.useState)(false);
			const [balanceDismissed, setBalanceDismissed] = (0, react.useState)(false);
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
				const timer = setInterval(() => setTick((n) => n + 1), 6e4);
				return () => clearInterval(timer);
			}, []);
			(0, react.useEffect)(() => {
				refresh();
				const timer = setInterval(() => {
					refresh();
				}, 6e4);
				return () => clearInterval(timer);
			}, [refresh]);
			const now = Date.now();
			const start = periodStartMs("daily", now);
			const totals = aggregateSince(ledger.all(), start);
			const periodKey = `daily:${start}`;
			(0, react.useEffect)(() => {
				if (totals.cost >= settings.warnYuan && !wasNotified(periodKey, "warn")) {
					markNotified(periodKey, "warn");
					setToast(true);
				}
			}, [
				totals.cost,
				settings.warnYuan,
				periodKey
			]);
			(0, react.useEffect)(() => {
				if (!toast) return;
				const timer = setTimeout(() => setToast(false), 8e3);
				return () => clearTimeout(timer);
			}, [toast]);
			const peakNow = isPeak(now, parsePeakWindows(settings.peakWindows), settings.pricingTimezone);
			const balance = view?.ok && view.balanceInfos?.length ? view.balanceInfos[0] : null;
			return (0, react_jsx_runtime.jsxs)("div", {
				className: BudgetCapsule_module_css_default.root,
				children: [
					toast && (0, react_jsx_runtime.jsx)("div", {
						className: BudgetCapsule_module_css_default.toast,
						"data-level": "warn",
						role: "alert",
						children: (0, react_jsx_runtime.jsx)("span", {
							className: BudgetCapsule_module_css_default.toastText,
							children: t("toast.warn", {
								spent: formatYuan(totals.cost),
								warn: formatYuan(settings.warnYuan)
							})
						})
					}),
					view && !view.ok && !balanceDismissed && (0, react_jsx_runtime.jsxs)("div", {
						className: BudgetCapsule_module_css_default.toast,
						"data-level": "error",
						role: "alert",
						children: [(0, react_jsx_runtime.jsx)("span", {
							className: BudgetCapsule_module_css_default.toastText,
							children: view.error ?? t("card.balanceError")
						}), (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: BudgetCapsule_module_css_default.iconButton,
							"aria-label": t("toast.close"),
							onClick: () => {
								setBalanceDismissed(true);
							},
							children: "✕"
						})]
					}),
					expanded && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("div", {
						className: BudgetCapsule_module_css_default.backdrop,
						onClick: () => setExpanded(false)
					}), (0, react_jsx_runtime.jsxs)("div", {
						className: BudgetCapsule_module_css_default.card,
						children: [
							(0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.cardHead,
								children: [(0, react_jsx_runtime.jsx)("span", {
									className: BudgetCapsule_module_css_default.cardTitle,
									children: t("card.title")
								}), (0, react_jsx_runtime.jsxs)("span", {
									className: BudgetCapsule_module_css_default.band,
									children: [`${t("card.peakNow")}:`, (0, react_jsx_runtime.jsxs)("span", {
										className: BudgetCapsule_module_css_default.bandLabel,
										"data-peak": peakNow || void 0,
										children: [(0, react_jsx_runtime.jsx)("span", {
											className: BudgetCapsule_module_css_default.bandDot,
											"data-peak": peakNow || void 0
										}), peakNow ? t("card.peak") : t("card.off")]
									})]
								})]
							}),
							balance && (0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.balanceSection,
								children: [
									(0, react_jsx_runtime.jsxs)("div", {
										className: BudgetCapsule_module_css_default.balanceTotal,
										children: [
											(0, react_jsx_runtime.jsx)("span", {
												className: BudgetCapsule_module_css_default.balanceTotalLabel,
												children: t("card.totalBalance")
											}),
											(0, react_jsx_runtime.jsx)("span", {
												className: BudgetCapsule_module_css_default.balanceTotalValue,
												children: formatYuanText(balance.totalBalance)
											}),
											(0, react_jsx_runtime.jsx)("a", {
												className: BudgetCapsule_module_css_default.topUp,
												href: TOP_UP_URL,
												target: "_blank",
												rel: "noreferrer",
												title: t("card.topUpTitle"),
												children: t("card.topUp")
											})
										]
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: BudgetCapsule_module_css_default.row,
										children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.grantedBalance") }), (0, react_jsx_runtime.jsx)("span", { children: formatYuanText(balance.grantedBalance) })]
									}),
									(0, react_jsx_runtime.jsxs)("div", {
										className: BudgetCapsule_module_css_default.row,
										children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.toppedUpBalance") }), (0, react_jsx_runtime.jsx)("span", { children: formatYuanText(balance.toppedUpBalance) })]
									})
								]
							}),
							(view?.todayConsumed !== void 0 || view?.totalConsumed !== void 0) && (0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.spendStats,
								children: [(0, react_jsx_runtime.jsxs)("div", {
									className: BudgetCapsule_module_css_default.row,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.spent") }), (0, react_jsx_runtime.jsx)("span", { children: view?.todayConsumed !== void 0 ? `${view.todayConsumedSource === "estimate" ? "≈" : ""}${formatYuan(view.todayConsumed)}` : "—" })]
								}), view?.totalConsumed !== void 0 && (0, react_jsx_runtime.jsxs)("div", {
									className: BudgetCapsule_module_css_default.row,
									children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.totalAll") }), (0, react_jsx_runtime.jsx)("span", { children: formatYuan(view.totalConsumed) })]
								})]
							}),
							(0, react_jsx_runtime.jsx)("div", {
								className: BudgetCapsule_module_css_default.section,
								children: t("card.tokens.title")
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.tokens.inputCached") }), (0, react_jsx_runtime.jsx)("span", { children: formatTokens(totals.cachedIn) })]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.tokens.inputUncached") }), (0, react_jsx_runtime.jsx)("span", { children: formatTokens(totals.uncachedIn) })]
							}),
							(0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", { children: t("card.tokens.output") }), (0, react_jsx_runtime.jsx)("span", { children: formatTokens(totals.out) })]
							}),
							(totals.byModel.flash.cost > 0 || totals.byModel.pro.cost > 0) && (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [(0, react_jsx_runtime.jsx)("div", {
								className: BudgetCapsule_module_css_default.section,
								children: t("card.byModel")
							}), ["flash", "pro"].map((model) => totals.byModel[model].cost > 0 && (0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.row,
								children: [(0, react_jsx_runtime.jsx)("span", { children: model }), (0, react_jsx_runtime.jsx)("span", { children: formatYuan(totals.byModel[model].cost) })]
							}, model))] }),
							(0, react_jsx_runtime.jsxs)("div", {
								className: BudgetCapsule_module_css_default.settingsBlock,
								children: [
									(0, react_jsx_runtime.jsx)("div", {
										className: BudgetCapsule_module_css_default.section,
										children: t("settings.title")
									}),
									(0, react_jsx_runtime.jsxs)("label", {
										className: BudgetCapsule_module_css_default.field,
										children: [(0, react_jsx_runtime.jsx)("span", { children: t("settings.warn") }), (0, react_jsx_runtime.jsx)("input", {
											type: "number",
											min: 1,
											step: 5,
											defaultValue: settings.warnYuan,
											onBlur: (event) => {
												const value = Number(event.target.value);
												if (Number.isFinite(value) && value > 0) updateSettings({ warnYuan: value });
											}
										}, `warn-${settings.warnYuan}`)]
									}),
									(0, react_jsx_runtime.jsxs)("label", {
										className: BudgetCapsule_module_css_default.field,
										children: [(0, react_jsx_runtime.jsx)("span", { children: t("settings.stopOnOver") }), (0, react_jsx_runtime.jsx)("input", {
											type: "checkbox",
											checked: settings.stopOnOver,
											onChange: (event) => updateSettings({ stopOnOver: event.target.checked })
										})]
									})
								]
							})
						]
					})] }),
					(0, react_jsx_runtime.jsxs)("button", {
						type: "button",
						className: BudgetCapsule_module_css_default.capsule,
						title: t("capsule.title"),
						"aria-label": t("capsule.label"),
						"aria-expanded": expanded,
						onClick: () => setExpanded((value) => !value),
						children: [(0, react_jsx_runtime.jsxs)("span", {
							className: BudgetCapsule_module_css_default.bandTag,
							"data-peak": peakNow || void 0,
							children: [(0, react_jsx_runtime.jsx)("span", {
								className: BudgetCapsule_module_css_default.bandDot,
								"data-peak": peakNow || void 0
							}), peakNow ? t("card.peak") : t("card.off")]
						}), (0, react_jsx_runtime.jsx)("span", {
							className: BudgetCapsule_module_css_default.text,
							children: balance ? formatYuanText(balance.totalBalance) : "¥--"
						})]
					})
				]
			});
		}
		//#endregion
		//#region lib/client/usage.js
		/**
		* Defensive parser for the provider `usage` object carried by finalized
		* assistant messages (`AssistantMessageNode.usage` is typed `unknown` by the
		* runtime).
		*
		* The harness's normalized wire shape is
		* `{ inputTokens, outputTokens, cacheReadTokens, reasoningTokens }` where
		* `inputTokens` is the UNCACHED fresh input and `cacheReadTokens` the
		* cache-hit input — the two are disjoint, total input = their sum (verified
		* against the raw session log). Legacy OpenAI-style shapes instead carry the
		* prompt TOTAL including cached tokens, so cached is subtracted out of it.
		* Output tokens bill as-is (DeepSeek counts reasoning inside completion).
		* When no cached count exists, zero cache hits are assumed so every input
		* token bills at the (higher) uncached rate — a conservative overestimate.
		*
		* Pure module: asserted offline in scripts/verify.mjs.
		*/
		function asRecord(value) {
			return typeof value === "object" && value !== null ? value : null;
		}
		function asNumber(value) {
			return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
		}
		/**
		* Extract the billable token triple from a raw usage object.
		* @returns the triple, or null when the shape is unusable (not an object,
		* or missing a finite prompt/completion count).
		*/
		function parseUsage(raw) {
			const usage = asRecord(raw);
			if (usage === null) return null;
			if (usage.inputTokens !== void 0 || usage.cacheReadTokens !== void 0) {
				const uncached = asNumber(usage.inputTokens) ?? 0;
				const cached = asNumber(usage.cacheReadTokens) ?? 0;
				const out = asNumber(usage.outputTokens ?? usage.completionTokens);
				if (out === null || uncached === 0 && cached === 0) return null;
				return {
					cachedIn: cached,
					uncachedIn: uncached,
					out
				};
			}
			const prompt = asNumber(usage.promptTokens ?? usage.prompt_tokens);
			const completion = asNumber(usage.completionTokens ?? usage.completion_tokens);
			if (prompt === null || completion === null) return null;
			const details = asRecord(usage.promptTokensDetails ?? usage.prompt_tokens_details);
			const cachedRaw = (details !== null ? asNumber(details.cachedTokens ?? details.cached_tokens) : null) ?? asNumber(usage.cacheReadInputTokens ?? usage.cache_read_input_tokens);
			const cached = Math.min(cachedRaw ?? 0, prompt);
			return {
				cachedIn: cached,
				uncachedIn: prompt - cached,
				out: completion
			};
		}
		//#endregion
		//#region lib/client/tracker.js
		/**
		* Usage tracker: subscribes to the current session's conversation snapshot
		* and ingests every finalized assistant message's `usage` into the ledger.
		*
		* The framework exposes no cross-session usage aggregate, so only the staged
		* (current) session streams live; the persisted ledger keeps every ingested
		* message deduped by `${sessionId}:${messageId ?? seq}`, so reopening a
		* session or restarting the app never double-counts.
		*/
		/** Scan one conversation snapshot and upsert its billable messages. */
		function ingest(face) {
			const snapshot = face.getSnapshot();
			const settings = getSettings();
			const windows = parsePeakWindows(settings.peakWindows);
			let changedAny = false;
			for (const node of snapshot.nodes) {
				if (node.kind !== "assistant" || node.usage === void 0 || node.usage === null) continue;
				const provider = node.requestConfig?.provider ?? node.provenance?.provider;
				const model = node.requestConfig?.model ?? node.provenance?.model;
				if (!isDeepSeekProvider(provider, model)) continue;
				const tokens = parseUsage(node.usage);
				if (tokens === null) continue;
				const profile = deepseekProfile(model);
				const peak = isPeak(node.time, windows, settings.pricingTimezone);
				if (ledger.upsert({
					key: `${snapshot.sessionId}:${node.messageId ?? node.seq}`,
					sessionId: snapshot.sessionId,
					model: profile,
					time: node.time,
					cachedIn: tokens.cachedIn,
					uncachedIn: tokens.uncachedIn,
					out: tokens.out,
					cost: costOf(tokens, profile, peak)
				})) changedAny = true;
			}
			if (changedAny) maybeStopOnOver(face);
		}
		/**
		* Hard-stop behavior: once the day's spent total reaches the warn threshold
		* (按金额), cancel the running turn (once per day) so further spend stops.
		* Configurable through `stopOnOver`; the capsule mirrors the same crossing
		* with a toast.
		*/
		function maybeStopOnOver(face) {
			const settings = getSettings();
			if (!settings.stopOnOver || settings.warnYuan <= 0) return;
			const start = periodStartMs("daily", Date.now());
			const periodKey = `daily:${start}`;
			if (wasNotified(periodKey, "stopped")) return;
			if (aggregateSince(ledger.all(), start).cost < settings.warnYuan) return;
			markNotified(periodKey, "stopped");
			face.cancel().catch(() => {});
		}
		/**
		* Attach to the current session and keep the ledger fresh.
		*
		* Session faces materialize lazily: right after boot (or a connection reset)
		* `scope()/sessionOf()` can return undefined for the current session, and an
		* idle session's list never ticks again on its own — so a one-shot attach
		* would silently never subscribe. A guarded retry loop re-attempts until the
		* subscription is live, then goes quiet.
		*
		* @returns disposer removing every subscription and the retry timer.
		*/
		function initTracker(ctx) {
			let sessionUnsub = null;
			/** Session id that currently has a live conversation subscription. */
			let subscribedId;
			/** Session id the latest list state wants us to track. */
			let wantedId;
			const tryAttach = () => {
				const current = ctx.sessions.list.getSnapshot().current;
				wantedId = current;
				if (current === subscribedId) return;
				if (sessionUnsub !== null) {
					sessionUnsub();
					sessionUnsub = null;
					subscribedId = void 0;
				}
				if (current === void 0) return;
				const scoped = ctx.sessions.scope(current);
				const face = scoped !== void 0 ? ctx.sessions.sessionOf(scoped) : void 0;
				if (face === void 0) return;
				subscribedId = current;
				const scan = () => {
					ingest(face);
				};
				scan();
				sessionUnsub = face.subscribe(scan);
			};
			tryAttach();
			const listUnsub = ctx.sessions.list.subscribe(tryAttach);
			const retry = setInterval(() => {
				if (subscribedId !== wantedId) tryAttach();
			}, 3e3);
			const resetUnsub = ctx.on("connection/reset", () => {
				subscribedId = void 0;
			});
			return () => {
				clearInterval(retry);
				listUnsub();
				resetUnsub();
				if (sessionUnsub !== null) sessionUnsub();
			};
		}
		//#endregion
		//#region lib/client/index.js
		/**
		* ds-budget-meter client half: registers the budget capsule into the
		* conversation session header's `conversation.session.header.utilities`
		* list slot (the seat holding the session-log export button), rendered
		* before it via CSS order. Starts the usage tracker that converts the
		* current session's token usage into CNY. The capsule shows the real
		* DeepSeek account balance from the host /budget/balance endpoint.
		*/
		/** Dictionary namespace owned by this plugin. */
		const NS = "ds-budget-meter";
		/** 会话头部工具区槽位：与 session log 导出按钮同一排。 */
		const HEADER_UTILITIES = "conversation.session.header.utilities";
		/** Services required by the plugin. */
		const inject = [
			"slots",
			"sessions",
			"locale"
		];
		function apply(ctx, config) {
			seedSettingsFromConfig(config);
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ds-budget-meter: dictionaries");
			ctx.effect(() => initTracker(ctx), "ds-budget-meter: usage tracker");
			ctx.effect(() => ctx.slots.inject(HEADER_UTILITIES, () => ctx.slots.register({
				name: HEADER_UTILITIES,
				id: "ds-budget-meter",
				locale: NS
			}, BudgetCapsule)), "ds-budget-meter: header capsule");
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map