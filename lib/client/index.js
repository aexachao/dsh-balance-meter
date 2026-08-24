/**
 * ds-budget-meter client half: registers a floating balance capsule into the
 * layout's `shell.overlay` list slot.  The capsule shows the real DeepSeek
 * account balance fetched from the host /budget/balance endpoint.
 */
import { en, zh } from "./locales.js";
import { BudgetCapsule } from "./BudgetCapsule.js";
/** Dictionary namespace owned by this plugin. */
const NS = 'ds-budget-meter';
/** Services required by the plugin. */
export const inject = ['slots', 'locale'];
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ds-budget-meter: dictionaries');
    ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
        name: 'shell.overlay',
        id: 'ds-budget-meter',
        locale: NS,
    }, BudgetCapsule)), 'ds-budget-meter: balance capsule');
}
