/**
 * ds-budget-meter host half: real DeepSeek account balance.
 *
 * Reads the API key from `~/.dsh/.credentials.yaml` (DEEPSEEK_API_KEY) and
 * queries the official balance endpoint.  The client capsule shows the real
 * account balance instead of estimated spending — no manual budget caps or
 * periods.
 */
import z from '@deepseek-ai/schemastery';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
export const name = 'ds-budget-meter';
export const Config = z.object({
    refreshSeconds: z.number().min(0).max(3600).default(0),
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
export const inject = ['webServer'];
export function apply(ctx, _config) {
    const handler = async (req, res) => {
        if (req.method !== 'GET') {
            res.writeHead(405);
            res.end();
            return;
        }
        if (!isLoopback(req)) {
            writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' });
            return;
        }
        const key = readApiKey();
        if (!key) {
            writeJson(res, 500, {
                ok: false,
                error: '未找到 DEEPSEEK_API_KEY（~/.dsh/.credentials.yaml）',
            });
            return;
        }
        try {
            const r = await fetch(BALANCE_ENDPOINT, {
                headers: { Authorization: `Bearer ${key}` },
                signal: AbortSignal.timeout(10_000),
            });
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
    const dispose = ctx.webServer.register({
        kind: 'exact',
        path: '/budget/balance',
        handler,
    });
    ctx.effect(() => dispose, 'ds-budget-meter: balance route');
}
