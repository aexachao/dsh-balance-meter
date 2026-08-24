/**
 * The floating balance capsule (shell.overlay entry): a pill showing the
 * real DeepSeek account balance; clicking it expands a card with the full
 * balance breakdown (total / granted / topped-up) and a refresh button.
 * Data comes from the host /budget/balance endpoint — no manual budgets.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
type BudgetCapsuleProps = PropsRuntime<'shell.overlay'> & PropsLocale<'ds-budget-meter'>;
export declare function BudgetCapsule({ t }: BudgetCapsuleProps): import("react").JSX.Element;
export {};
