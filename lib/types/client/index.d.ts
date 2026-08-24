/**
 * ds-budget-meter client half: registers a floating balance capsule into the
 * layout's `shell.overlay` list slot.  The capsule shows the real DeepSeek
 * account balance fetched from the host /budget/balance endpoint.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type BudgetKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'ds-budget-meter': BudgetKey;
    }
}
/** Services required by the plugin. */
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
