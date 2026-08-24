/**
 * ds-budget-meter host half: real DeepSeek account balance.
 *
 * Reads the API key from `~/.dsh/.credentials.yaml` (DEEPSEEK_API_KEY) and
 * queries the official balance endpoint.  The client capsule shows the real
 * account balance instead of estimated spending — no manual budget caps or
 * periods.
 */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const name = 'ds-budget-meter'

export interface Config {
  /** Manual refresh only (the card has a refresh button). */
  refreshSeconds: number
}

export const Config = {
  refreshSeconds: 0,
}

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

/** Read the API key from the dsh credentials file (structure: `KEY: value`). */
function readApiKey(): string | null {
  try {
    const credPath = path.join(os.homedir(), '.dsh', '.credentials.yaml')
    const text = fs.readFileSync(credPath, 'utf8')
    for (const line of text.split(/\r?\n/)) {
      const m = /^DEEPSEEK_API_KEY\s*:\s*(\S+)/.exec(line.trim())
      if (m) return m[1]
    }
    return null
  } catch {
    return null
  }
}

function isLoopback(req: IncomingMessage): boolean {
  const addr = req.socket.remoteAddress ?? ''
  return addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1'
}

function writeJson(res: ServerResponse, status: number, body: unknown): void {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  res.end(text)
}

export const inject = ['webServer']

export function apply(ctx: Context, _config: Config): void {
  const handler = async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (req.method !== 'GET') {
      res.writeHead(405); res.end(); return
    }
    if (!isLoopback(req)) {
      writeJson(res, 403, { ok: false, error: 'forbidden: loopback-only' } as BalanceView)
      return
    }

    const key = readApiKey()
    if (!key) {
      writeJson(res, 500, {
        ok: false,
        error: '未找到 DEEPSEEK_API_KEY（~/.dsh/.credentials.yaml）',
      } as BalanceView)
      return
    }

    try {
      const r = await fetch(BALANCE_ENDPOINT, {
        headers: { Authorization: `Bearer ${key}` },
        signal: AbortSignal.timeout(10_000),
      })
      if (!r.ok) {
        writeJson(res, 502, { ok: false, error: `DeepSeek API ${r.status}` } as BalanceView)
        return
      }
      const data = await r.json() as {
        is_available?: boolean
        balance_infos?: { currency: string; total_balance: string; granted_balance: string; topped_up_balance: string }[]
      }
      writeJson(res, 200, {
        ok: true,
        isAvailable: data.is_available ?? false,
        balanceInfos: (data.balance_infos ?? []).map((b) => ({
          currency: b.currency,
          totalBalance: b.total_balance,
          grantedBalance: b.granted_balance,
          toppedUpBalance: b.topped_up_balance,
        })),
      } as BalanceView)
    } catch (error) {
      writeJson(res, 502, {
        ok: false,
        error: `余额查询失败: ${String(error)}`,
      } as BalanceView)
    }
  }

  const dispose = ctx.webServer.register({
    kind: 'exact',
    path: '/budget/balance',
    handler,
  })
  ctx.on('dispose', dispose)
}
