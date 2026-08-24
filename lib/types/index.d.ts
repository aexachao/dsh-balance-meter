/**
 * ds-budget-meter host half: 预算配置 + 真实 DeepSeek 账户余额端点。
 *
 * 原版（token 用量估算）的预算配置字段原样保留，另加余额查询：
 * 读取 `~/.dsh/.credentials.yaml`（DEEPSEEK_API_KEY）并调用官方余额
 * 接口；client 胶囊展示真实余额，同时保留原版的本周期花费统计。
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { IncomingMessage, ServerResponse } from 'node:http';
export declare const name = "ds-budget-meter";
export interface Config {
    /** 本日花费达到该金额（元）时提醒；stopOnOver 时同时取消当前回合。 */
    warnYuan: number;
    /** 达到提醒阈值时自动取消当前回合（每周期一次）。 */
    stopOnOver: boolean;
    /** Comma-separated HH:MM-HH:MM peak windows, interpreted in `pricingTimezone`. */
    peakWindows: string;
    /** IANA time zone the peak windows refer to (official pricing is Beijing time). */
    pricingTimezone: string;
}
export declare const Config: z<Config>;
/** Balance row from the DeepSeek API. */
export interface BalanceInfo {
    currency: string;
    totalBalance: string;
    grantedBalance: string;
    toppedUpBalance: string;
}
export interface BalanceView {
    ok: boolean;
    error?: string;
    isAvailable?: boolean;
    balanceInfos?: BalanceInfo[];
}
/** DeepSeek 凭证文本（`KEY: value` 行）→ API key；找不到返回 null。 */
export declare function parseApiKey(text: string): string | null;
/** 仅允许本机回环地址访问余额端点。 */
export declare function isLoopbackAddress(addr: string): boolean;
/** DeepSeek API 响应（snake_case）→ BalanceView（camelCase）。 */
export declare function mapBalanceResponse(data: unknown): BalanceView;
/** 余额端点的外部依赖（默认实现见 apply；测试时注入 mock）。 */
export interface BalanceDeps {
    readKey: () => string | null;
    fetchUpstream: (key: string) => Promise<Response>;
}
/** 构造 /budget/balance 处理器；依赖可注入以便单元测试完整 HTTP 契约。 */
export declare function createBalanceHandler(deps: BalanceDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void>;
export declare const inject: string[];
export declare function apply(ctx: Context, _config: Config): void;
