/**
 * dsh-balance-tracker client half: registers the budget capsule into the
 * conversation session header's `conversation.session.header.utilities`
 * list slot (the seat holding the session-log export button), rendered
 * before it via CSS order. Starts the usage tracker that converts the
 * current session's token usage into CNY. The capsule shows the real
 * DeepSeek account balance from the host /budget/balance endpoint.
 */
import { en, zh } from "./locales.js";
import { BudgetCapsule } from "./BudgetCapsule.js";
import { initTracker } from "./tracker.js";
import { seedSettingsFromConfig } from "./store.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'dsh-balance-tracker';
/** 会话头部工具区槽位：与 session log 导出按钮同一排。 */
const HEADER_UTILITIES = 'conversation.session.header.utilities';
/** Services required by the plugin. */
export const inject = ['slots', 'sessions', 'locale'];
export function apply(ctx, config) {
    // Row config (when the loader passes one) seeds the defaults; the user can
    // still override everything from the capsule card, persisted locally.
    seedSettingsFromConfig(config);
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-balance-tracker: dictionaries');
    ctx.effect(() => initTracker(ctx), 'dsh-balance-tracker: usage tracker');
    // 注册到会话头部工具区（session log 按钮左侧，靠 CSS order: -1 排最前）。
    ctx.effect(() => ctx.slots.inject(HEADER_UTILITIES, () => ctx.slots.register({
        name: HEADER_UTILITIES,
        id: 'dsh-balance-tracker',
        locale: NS,
    }, BudgetCapsule)), 'dsh-balance-tracker: header capsule');
}
