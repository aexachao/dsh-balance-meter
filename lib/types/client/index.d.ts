/**
 * dsh-balance-tracker client half: registers the budget capsule into the
 * conversation session header's `conversation.session.header.utilities`
 * list slot (the seat holding the session-log export button), rendered
 * before it via CSS order. Starts the usage tracker that converts the
 * current session's token usage into CNY. The capsule shows the real
 * DeepSeek account balance from the host /budget/balance endpoint.
 */
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client';
import { type BudgetKey } from './locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    interface LocaleNamespaceMap {
        'dsh-balance-tracker': BudgetKey;
    }
}
/** Services required by the plugin. */
export declare const inject: string[];
export declare function apply(ctx: ClientContext, config?: unknown): void;
