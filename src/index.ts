/**
 * ds-budget-meter host half: 预算配置 + 真实 DeepSeek 账户余额端点。
 *
 * 原版（token 用量估算）的预算配置字段原样保留，另加余额查询：
 * 读取 `~/.dsh/.credentials.yaml`（DEEPSEEK_API_KEY）并调用官方余额
 * 接口；client 胶囊展示真实余额，同时保留原版的本周期花费统计。
 */

import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
// Type-only: merge the webServer service declaration into cordis Context.
import type {} from '@deepseek-ai/dsh-host-webserver'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'ds-budget-meter'

export interface Config {
  /** 本日花费达到该金额（元）时提醒；stopOnOver 时同时取消当前回合。 */
  warnYuan: number
  /** 达到提醒阈值时自动取消当前回合（每周期一次）。 */
  stopOnOver: boolean
  /** Comma-separated HH:MM-HH:MM peak windows, interpreted in `pricingTimezone`. */
  peakWindows: string
  /** IANA time zone the peak windows refer to (official pricing is Beijing time). */
  pricingTimezone: string
}

export const Config: z<Config> = z.object({
  warnYuan: z.number().min(0.01).default(20),
  stopOnOver: z.boolean().default(true),
  peakWindows: z.string().default('09:00-12:00,14:00-18:00'),
  pricingTimezone: z.string().default('Asia/Shanghai'),
})

const BALANCE_ENDPOINT = 'https://api.deepseek.com/user/balance'

/** Balance row from the DeepSeek API. */
export interface BalanceInfo {
  currency: string
  totalBalance: string
  grantedBalance: string
  toppedUpBalance: string
}

export interface BalanceView {
  ok: boolean
  error?: string
  isAvailable?: boolean
  balanceInfos?: BalanceInfo[]
}

/** DeepSeek 凭证文本（`KEY: value` 行）→ API key；找不到返回 null。 */
export function parseApiKey(text: string): string | null {
  for (const line of text.split(/\r?\n/)) {
    const m = /^DEEPSEEK_API_KEY\s*:\s*(\S+)/.exec(line.trim())
    if (m) return m[1] ?? null
  }
  return null
}

/** Read the API key from the dsh credentials file (structure: `KEY: value`). */
function readApiKey(): string | null {
  try {
    const credPath = path.join(os.homedir(), '.dsh', '.credentials.yaml')
    return parseApiKey(fs.readFileSync(credPath, 'utf8'))
  } catch {
    return null
  }
}

/** 仅允许本机回环地址访问余额端点。 */
export function isLoopbackAddress(addr: string): boolean {
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

function isLoopback(req: IncomingMessage): boolean {
  return isLoopbackAddress(req.socket.remoteAddress ?? '')
}

/** DeepSeek API 响应（snake_case）→ BalanceView（camelCase）。 */
export function mapBalanceResponse(data: unknown): BalanceView {
  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: 'invalid response shape' }
  }
  const raw = data as {
    is_available?: boolean
    balance_infos?: { currency: string; total_balance: string; granted_balance: string; topped_up_balance: string }[]
  }
  if (!Array.isArray(raw.balance_infos)) {
    return { ok: false, error: 'invalid response shape' }
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
  }
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(text)
}

/** 余额端点的外部依赖（默认实现见 apply；测试时注入 mock）。 */
export interface BalanceDeps {
  readKey: () => string | null
  fetchUpstream: (key: string) => Promise<Response>
}

/** 构造 /budget/balance 处理器；依赖可注入以便单元测试完整 HTTP 契约。 */
export function createBalanceHandler(deps: BalanceDeps) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') {
      res.writeHead(405); res.end(); return
    }
    if (!isLoopback(req)) {
      writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' } as BalanceView)
      return
    }

    const key = deps.readKey()
    if (!key) {
      writeJson(res, 500, {
        ok: false,
        error: '未找到 DEEPSEEK_API_KEY（~/.dsh/.credentials.yaml）',
      } as BalanceView)
      return
    }

    try {
      const r = await deps.fetchUpstream(key)
      if (!r.ok) {
        writeJson(res, 502, { ok: false, error: `DeepSeek API ${r.status}` } as BalanceView)
        return
      }
      const view = mapBalanceResponse(await r.json())
      writeJson(res, view.ok ? 200 : 502, view)
    } catch (error) {
      writeJson(res, 502, {
        ok: false,
        error: `余额查询失败: ${String(error)}`,
      } as BalanceView)
    }
  }
}

export const inject = ['webServer']

export function apply(ctx: Context, _config: Config): void {
  const handler = createBalanceHandler({
    readKey: readApiKey,
    fetchUpstream: (key) => fetch(BALANCE_ENDPOINT, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    }),
  })

  const dispose = ctx.webServer.register({
    kind: 'exact',
    path: '/budget/balance',
    handler,
  })
  ctx.effect(() => dispose, 'ds-budget-meter: balance route')
}
