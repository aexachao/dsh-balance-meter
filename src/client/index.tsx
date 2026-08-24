/**
 * ds-budget-meter client half: registers a floating balance capsule into the
 * layout's `shell.overlay` list slot.  The capsule shows the real DeepSeek
 * account balance fetched from the host /budget/balance endpoint.
 */

import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: load the ctx.locale merge and the SlotMap merge for
// 'shell.overlay'.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { en, zh, type BudgetKey } from './locales.ts'
import { BudgetCapsule } from './BudgetCapsule.tsx'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    'ds-budget-meter': BudgetKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'ds-budget-meter'

/** Services required by the plugin. */
export const inject = ['slots', 'locale']

export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ds-budget-meter: dictionaries')

  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'ds-budget-meter',
    locale: NS,
  }, BudgetCapsule)), 'ds-budget-meter: balance capsule')
}
