/**
 * ds-budget-meter client half: registers a floating budget capsule into the
 * layout's `shell.overlay` list slot (the framework's designated seat for
 * badges / status pills / toast stacks) and starts the usage tracker that
 * converts the current session's token usage into CNY.
 */
import { en, zh } from "./locales.js";
import { BudgetCapsule } from "./BudgetCapsule.js";
import { initTracker } from "./tracker.js";
import { seedSettingsFromConfig } from "./store.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'ds-budget-meter';
/** Services required by the plugin. */
export const inject = ['slots', 'sessions', 'locale'];
export function apply(ctx, config) {
    // Row config (when the loader passes one) seeds the defaults; the user can
    // still override everything from the capsule card, persisted locally.
    seedSettingsFromConfig(config);
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ds-budget-meter: dictionaries');
    ctx.effect(() => initTracker(ctx), 'ds-budget-meter: usage tracker');
    // shell.overlay is declared by the layout frame at boot; wait for the
    // declaration, then register the capsule (disposal cascades on unload).
    ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'ds-budget-meter',
        locale: NS,
    }, BudgetCapsule)), 'ds-budget-meter: overlay capsule');
}
