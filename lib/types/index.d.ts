/**
 * ds-budget-meter host half: real DeepSeek account balance.
 *
 * Reads the API key from `~/.dsh/.credentials.yaml` (DEEPSEEK_API_KEY) and
 * queries the official balance endpoint.  The client capsule shows the real
 * account balance instead of estimated spending — no manual budget caps or
 * periods.
 */
import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
export declare const name = "ds-budget-meter";
export interface Config {
    /** Reserved for future use; the card refreshes on demand + every 60s. */
    refreshSeconds: number;
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
export declare const inject: string[];
export declare function apply(ctx: Context, _config: Config): void;
