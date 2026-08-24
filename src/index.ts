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
import {
  aggregatePlatformConsumption, advanceDayMeter, fetchPlatformMonth, localDate,
  parseCredential, type DayMeterState, type PlatformDay,
} from './platform.ts'

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
  /** 今日已消费（元）：官方平台源或余额差值估算。 */
  todayConsumed?: number
  todayConsumedSource?: 'official' | 'estimate'
  /** 累计消费（元，全部历史；仅官方平台源可用）。 */
  totalConsumed?: number
  totalConsumedSource?: 'official'
}

/** DeepSeek 凭证文本（`KEY: value` 行）→ API key；找不到返回 null。 */
export function parseApiKey(text: string): string | null {
  return parseCredential(text, 'DEEPSEEK_API_KEY')
}

/** 读取 `~/.dsh/.credentials.yaml` 中的 `NAME: value` 凭证；缺文件/缺行返回 null。 */
function readCredential(name: string): string | null {
  try {
    const credPath = path.join(os.homedir(), '.dsh', '.credentials.yaml')
    return parseCredential(fs.readFileSync(credPath, 'utf8'), name)
  } catch {
    return null
  }
}

const readApiKey = (): string | null => readCredential('DEEPSEEK_API_KEY')
const readPlatformToken = (): string | null => readCredential('DEEPSEEK_PLATFORM_TOKEN')

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

/** 官方消费当日缓存（存 storages，避免每天重复遍历历史月份）。 */
export interface ConsumedCache {
  date: string
  todayConsumed: number
  totalConsumed: number
}

/** 余额端点的外部依赖（默认实现见 apply；测试时注入 mock）。 */
export interface BalanceDeps {
  readKey: () => string | null
  readPlatformToken: () => string | null
  fetchUpstream: (key: string) => Promise<Response>
  fetchMonth: (month: number, year: number) => Promise<PlatformDay[] | null>
  loadConsumedCache: () => ConsumedCache | null
  saveConsumedCache: (cache: ConsumedCache) => void
  loadDayMeter: () => DayMeterState | null
  saveDayMeter: (state: DayMeterState) => void
}

/**
 * 给余额视图附加消费数据：有 DEEPSEEK_PLATFORM_TOKEN 时用官方平台
 * usage/cost（今日 + 全历史累计，当日缓存）；否则用余额差值估算今日
 * （无历史时首日消费为 0，次日开始有差值）。平台失败不阻塞余额展示。
 */
async function attachConsumption(view: BalanceView, deps: BalanceDeps): Promise<void> {
  const token = deps.readPlatformToken()
  const today = localDate()
  if (token) {
    const cache = deps.loadConsumedCache()
    if (cache !== null && cache.date === today) {
      view.todayConsumed = cache.todayConsumed
      view.totalConsumed = cache.totalConsumed
      view.todayConsumedSource = 'official'
      view.totalConsumedSource = 'official'
      return
    }
    try {
      const agg = await aggregatePlatformConsumption((month, year) => deps.fetchMonth(month, year))
      if (agg !== null) {
        view.todayConsumed = agg.today
        view.totalConsumed = agg.total
        view.todayConsumedSource = 'official'
        view.totalConsumedSource = 'official'
        deps.saveConsumedCache({ date: today, todayConsumed: agg.today, totalConsumed: agg.total })
      }
    } catch {
      // 平台接口失败（token 过期等）→ 消费字段留空，client 侧隐藏。
    }
    return
  }

  const primary = view.balanceInfos?.[0]
  if (primary !== undefined) {
    const balance = Number(primary.totalBalance)
    if (Number.isFinite(balance)) {
      const { state, consumed } = advanceDayMeter(deps.loadDayMeter(), today, balance)
      deps.saveDayMeter(state)
      if (consumed !== null) {
        view.todayConsumed = consumed
        view.todayConsumedSource = 'estimate'
      }
    }
  }
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
      if (view.ok) await attachConsumption(view, deps)
      writeJson(res, view.ok ? 200 : 502, view)
    } catch (error) {
      writeJson(res, 502, {
        ok: false,
        error: `余额查询失败: ${String(error)}`,
      } as BalanceView)
    }
  }
}

// ── storages 持久化（官方消费当日缓存 / 余额差值日计量） ─────────────────────

function storagePath(name: string): string {
  const dir = process.env.DSH_HOME
    ? path.join(process.env.DSH_HOME, 'storages')
    : path.join(os.homedir(), '.dsh', 'storages')
  return path.join(dir, name)
}

function readJsonFile<T>(file: string): T | null {
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as T
    return parsed
  } catch {
    return null
  }
}

function writeJsonFile(file: string, value: unknown): void {
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const tmp = `${file}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(value), 'utf8')
    fs.renameSync(tmp, file)
  } catch {
    // 持久化失败只影响缓存命中率，不阻塞余额展示。
  }
}

export const inject = ['webServer']

export function apply(ctx: Context, _config: Config): void {
  const consumedCacheFile = storagePath('ds-budget-meter-consumed.json')
  const dayMeterFile = storagePath('ds-budget-meter-day.json')

  const handler = createBalanceHandler({
    readKey: readApiKey,
    readPlatformToken,
    fetchUpstream: (key) => fetch(BALANCE_ENDPOINT, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    }),
    fetchMonth: (month, year) => fetchPlatformMonth(readPlatformToken() ?? '', month, year),
    loadConsumedCache: () => readJsonFile<ConsumedCache>(consumedCacheFile),
    saveConsumedCache: (cache) => { writeJsonFile(consumedCacheFile, cache) },
    loadDayMeter: () => readJsonFile<DayMeterState>(dayMeterFile),
    saveDayMeter: (state) => { writeJsonFile(dayMeterFile, state) },
  })

  const dispose = ctx.webServer.register({
    kind: 'exact',
    path: '/budget/balance',
    handler,
  })
  ctx.effect(() => dispose, 'ds-budget-meter: balance route')
}
