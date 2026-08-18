/**
 * ds-budget-meter client half: registers a floating budget capsule into the
 * layout's `shell.overlay` list slot (the framework's designated seat for
 * badges / status pills / toast stacks) and starts the usage tracker that
 * converts the current session's token usage into CNY.
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
export declare function apply(ctx: ClientContext, config?: unknown): void;
