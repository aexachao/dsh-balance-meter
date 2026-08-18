/**
 * The floating budget capsule (shell.overlay entry): a pill with a mini
 * progress bar and spent/budget figures; clicking it expands a card with the
 * full progress bar, the period's token breakdown, per-model costs, and the
 * settings (budget / period / warn threshold / default model). Threshold
 * crossings raise a toast once per period per level.
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
type BudgetCapsuleProps = PropsRuntime<'shell.overlay'> & PropsLocale<'ds-budget-meter'>;
export declare function BudgetCapsule({ t }: BudgetCapsuleProps): import("react").JSX.Element;
export {};
