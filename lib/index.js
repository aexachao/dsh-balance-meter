/**
 * ds-budget-meter host half: 预算配置 + 真实 DeepSeek 账户余额端点。
 *
 * 原版（token 用量估算）的预算配置字段原样保留，另加余额查询：
 * 读取 `~/.dsh/.credentials.yaml`（DEEPSEEK_API_KEY）并调用官方余额
 * 接口；client 胶囊展示真实余额，同时保留原版的本周期花费统计。
 */
import z from '@deepseek-ai/schemastery';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export const name = 'ds-budget-meter';
export const Config = z.object({
    warnYuan: z.number().min(0.01).default(20),
    stopOnOver: z.boolean().default(true),
    peakWindows: z.string().default('09:00-12:00,14:00-18:00'),
    pricingTimezone: z.string().default('Asia/Shanghai'),
});
const BALANCE_ENDPOINT = 'https://api.deepseek.com/user/balance';
/** DeepSeek 凭证文本（`KEY: value` 行）→ API key；找不到返回 null。 */
export function parseApiKey(text) {
    for (const line of text.split(/\r?\n/)) {
        const m = /^DEEPSEEK_API_KEY\s*:\s*(\S+)/.exec(line.trim());
        if (m)
            return m[1] ?? null;
    }
    return null;
}
/** Read the API key from the dsh credentials file (structure: `KEY: value`). */
function readApiKey() {
    try {
        const credPath = path.join(os.homedir(), '.dsh', '.credentials.yaml');
        return parseApiKey(fs.readFileSync(credPath, 'utf8'));
    }
    catch {
        return null;
    }
}
/** 仅允许本机回环地址访问余额端点。 */
export function isLoopbackAddress(addr) {
    return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';
}
function isLoopback(req) {
    return isLoopbackAddress(req.socket.remoteAddress ?? '');
}
/** DeepSeek API 响应（snake_case）→ BalanceView（camelCase）。 */
export function mapBalanceResponse(data) {
    if (typeof data !== 'object' || data === null) {
        return { ok: false, error: 'invalid response shape' };
    }
    const raw = data;
    if (!Array.isArray(raw.balance_infos)) {
        return { ok: false, error: 'invalid response shape' };
    }
    return {
        ok: true,
        isAvailable: raw.is_available ?? false,
        balanceInfos: raw.balance_infos.map((b) => ({
            currency: b.currency,
            totalBalance: b.total_balance,
            grantedBalance: b.granted_balance,
            toppedUpBalance: b.topped_up_balance,
        })),
    };
}
function writeJson(res, status, body) {
    const text = JSON.stringify(body);
    res.writeHead(status, {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
    });
    res.end(text);
}
/** 构造 /budget/balance 处理器；依赖可注入以便单元测试完整 HTTP 契约。 */
export function createBalanceHandler(deps) {
    return async (req, res) => {
        if (req.method !== 'GET') {
            res.writeHead(405);
            res.end();
            return;
        }
        if (!isLoopback(req)) {
            writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' });
            return;
        }
        const key = deps.readKey();
        if (!key) {
            writeJson(res, 500, {
                ok: false,
                error: '未找到 DEEPSEEK_API_KEY（~/.dsh/.credentials.yaml）',
            });
            return;
        }
        try {
            const r = await deps.fetchUpstream(key);
            if (!r.ok) {
                writeJson(res, 502, { ok: false, error: `DeepSeek API ${r.status}` });
                return;
            }
            const view = mapBalanceResponse(await r.json());
            writeJson(res, view.ok ? 200 : 502, view);
        }
        catch (error) {
            writeJson(res, 502, {
                ok: false,
                error: `余额查询失败: ${String(error)}`,
            });
        }
    };
}
export const inject = ['webServer'];
export function apply(ctx, _config) {
    const handler = createBalanceHandler({
        readKey: readApiKey,
        fetchUpstream: (key) => fetch(BALANCE_ENDPOINT, {
            headers: { Authorization: `Bearer ${key}` },
            signal: AbortSignal.timeout(10_000),
        }),
    });
    const dispose = ctx.webServer.register({
        kind: 'exact',
        path: '/budget/balance',
        handler,
    });
    ctx.effect(() => dispose, 'ds-budget-meter: balance route');
}
