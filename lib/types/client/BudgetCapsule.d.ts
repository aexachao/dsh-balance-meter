/**
 * The floating budget capsule (shell.overlay entry).
 *
 * 原版预算追踪的融合改造：保留高峰/空闲时段标签、本日 token 分项、按模型
 * 花费、按金额的花费提醒阈值与超额自动停止；删除原版的「额度 / 周期 /
 * 百分比阈值 / 进度条」（预算上限概念由真实余额取代）。叠加真实 DeepSeek
 * 账户余额（host /budget/balance）：胶囊主显余额，卡片顶部为余额分项与
 * 充值快捷跳转。
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
type BudgetCapsuleProps = PropsRuntime<'conversation.session.header.utilities'> & PropsLocale<'ds-budget-meter'>;
export declare function BudgetCapsule({ t }: BudgetCapsuleProps): import("react").JSX.Element;
export {};
