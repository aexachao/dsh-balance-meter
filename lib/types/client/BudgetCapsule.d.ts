/**
 * The floating budget capsule (shell.overlay entry).
 *
 * 原版（预算追踪）的改造：数据源从「会话 token 用量 × 峰谷价估算」换成
 * host /budget/balance 端点的真实 DeepSeek 账户余额。定位（右下角固定）、
 * 胶囊与卡片的视觉样式沿用原版：胶囊 = 状态标签 + 余额文本；点击展开
 * 卡片 = 总余额大字 + 赠送/充值分项 + 刷新按钮。查询失败时沿用原版
 * toast 横幅结构（常驻、可手动关闭）。
 */
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
type BudgetCapsuleProps = PropsRuntime<'shell.overlay'> & PropsLocale<'ds-budget-meter'>;
export declare function BudgetCapsule({ t }: BudgetCapsuleProps): import("react").JSX.Element;
export {};
