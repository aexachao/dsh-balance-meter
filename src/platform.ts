/**
 * DeepSeek 平台官方用量（累计消费）与余额差值计量。
 *
 * 官方累计消费没有公开 API：需要 platform.deepseek.com 网页登录态的
 * `userToken`（存为 `~/.dsh/.credentials.yaml` 的 `DEEPSEEK_PLATFORM_TOKEN`），
 * 调 `platform.deepseek.com/api/v0/usage/cost?month=&year=`（与官网用量页
 * 同源数据）。无 token 时退化为余额差值估算（当天零点余额 − 当前余额）。
 *
 * 纯函数集中在顶部，便于单元测试；fetch 与文件 IO 在底部并保持可注入。
 */

/** 凭证文本（`NAME: value` 行）→ 值；找不到返回 null。 */
export function parseCredential(text: string, name: string): string | null {
  const re = new RegExp(`^${name}\\s*:\\s*(\\S+)`)
  for (const line of text.split(/\r?\n/)) {
    const m = re.exec(line.trim())
    if (m) return m[1] ?? null
  }
  return null
}

/** 本地日历日 `YYYY-MM-DD`（dashboard 行按日期键控）。 */
export function localDate(d = new Date()): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 金额向下截断到分（两位小数），避免金额显示时被四舍五入。 */
function truncateToCents(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.trunc(value * 100) / 100
}

/** Coerce a possibly-string number to a finite number, or NaN. */
function toFinite(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value)
    return Number.isFinite(n) ? n : NaN
  }
  return NaN
}

/** 平台 usage/cost 的一日费用行。 */
export interface PlatformDay {
  date: string
  cost: number
}

/**
 * 平台 usage/cost 响应 → 按日费用列表。
 * 响应信封：`{ code: 0, data: { biz_code: 0, biz_data: { days: [
 *   { date: "YYYY-MM-DD", data: [ { usage: [ { type, amount } ] } ] }
 * ] } } }`。usage 项的 `type` 只是计费维度标签（`PROMPT_TOKEN` /
 * `PROMPT_CACHE_HIT_TOKEN` / `PROMPT_CACHE_MISS_TOKEN` / `RESPONSE_TOKEN` /
 * `REQUEST`），`amount` 一律是金额（元），官方接口不提供 token 数量——
 * token 数只能来自 harness 会话统计。解析防御字段改名；无数据或形状
 * 不符返回 null。
 */
export function parsePlatformDays(body: unknown): PlatformDay[] | null {
  if (typeof body !== 'object' || body === null) return null
  const data = (body as { data?: unknown }).data
  if (typeof data !== 'object' || data === null) return null
  const { biz_code: bizCode, biz_data: bizData } = data as { biz_code?: number; biz_data?: unknown }
  if (bizCode !== 0) return null
  const container = Array.isArray(bizData) ? bizData[0] : bizData
  const days = container && typeof container === 'object' ? (container as { days?: unknown }).days : undefined
  if (!Array.isArray(days)) return null

  const out: PlatformDay[] = []
  for (const entry of days) {
    if (typeof entry !== 'object' || entry === null) continue
    const { date, data: entryData } = entry as { date?: unknown; data?: unknown }
    if (typeof date !== 'string' || !Array.isArray(entryData)) continue
    let total = 0
    for (const modelEntry of entryData) {
      if (typeof modelEntry !== 'object' || modelEntry === null) continue
      const usage = (modelEntry as { usage?: unknown }).usage
      if (!Array.isArray(usage)) continue
      for (const u of usage) {
        if (typeof u !== 'object' || u === null) continue
        const value = toFinite((u as { cost?: unknown; amount?: unknown }).cost ?? (u as { amount?: unknown }).amount)
        if (Number.isFinite(value)) total += value
      }
    }
    out.push({ date, cost: truncateToCents(total) })
  }
  return out.length > 0 ? out : null
}

/** 从平台某月费用列表取某天的费用；无该天返回 null。 */
export function dayCost(days: PlatformDay[], date: string): number | null {
  const entry = days.find((d) => d.date === date)
  return entry === undefined ? null : entry.cost
}

/**
 * 聚合全历史官方消费：从当前月往前逐月拉取（空月/失败即停，上限
 * maxMonths），返回累计总额与今日费用。任何月份都没有数据时返回 null。
 */
export async function aggregatePlatformConsumption(
  fetchMonth: (month: number, year: number) => Promise<PlatformDay[] | null>,
  now = new Date(),
  maxMonths = 36,
): Promise<{ total: number; today: number } | null> {
  const today = localDate(now)
  let total = 0
  let todayValue: number | null = null
  let seenAny = false
  for (let i = 0; i < maxMonths; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const days = await fetchMonth(d.getMonth() + 1, d.getFullYear())
    if (days === null || days.length === 0) break
    seenAny = true
    for (const day of days) {
      total += day.cost
      if (day.date === today) todayValue = day.cost
    }
  }
  if (!seenAny) return null
  return { total: truncateToCents(total), today: todayValue ?? 0 }
}

/** 日余额计量状态：当天零点余额与最近观察值。 */
export interface DayMeterState {
  date: string
  opening: number
  last: number
}

/**
 * 推进日计量：首日以当前余额为 opening（消费 0）；同日沿用 opening；
 * 跨天时以昨天的最后余额为新 opening（与 dsh-deepseek-quota 同款语义）。
 * 今日消费估算 = max(0, opening − 当前余额)。
 */
export function advanceDayMeter(
  state: DayMeterState | null,
  today: string,
  balance: number,
): { state: DayMeterState; consumed: number | null } {
  if (!Number.isFinite(balance)) {
    return { state: state ?? { date: today, opening: NaN, last: NaN }, consumed: null }
  }
  const opening = state === null ? balance : state.date === today ? state.opening : state.last
  const consumed = Math.max(0, truncateToCents(opening - balance))
  return { state: { date: today, opening, last: balance }, consumed }
}

// ── 传输与文件 IO（默认实现；handler 注入以便测试） ─────────────────────────

const PLATFORM_USAGE_URL = 'https://platform.deepseek.com/api/v0/usage/cost'
const TIMEOUT_MS = 15_000

/**
 * 平台 WAF 按浏览器 User-Agent 放行（实测：缺 UA 返回 Request Blocked，
 * 带浏览器 UA 即可通过，Cookie 非必需）。
 */
const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'

/** 拉取平台某月费用列表；信封错误/HTTP 失败抛错，空月返回 null。 */
export async function fetchPlatformMonth(token: string, month: number, year: number): Promise<PlatformDay[] | null> {
  const url = `${PLATFORM_USAGE_URL}?month=${month}&year=${year}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
      'x-app-version': '1.0.0',
      'User-Agent': BROWSER_UA,
      Origin: 'https://platform.deepseek.com',
      Referer: 'https://platform.deepseek.com/usage',
    },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`DeepSeek 平台用量接口返回 HTTP ${response.status}`)
  const body = await response.json() as { code?: number; data?: { biz_code?: number; biz_data?: unknown } }
  if (body.code !== 0 || body.data?.biz_code !== 0) {
    const code = body.code ?? body.data?.biz_code
    if (code === 40002 || code === 40003) {
      throw new Error('DEEPSEEK_PLATFORM_TOKEN 已过期：请重新登录 platform.deepseek.com 并更新 userToken')
    }
    throw new Error(`DeepSeek 平台用量接口错误 (code ${code ?? 'unknown'})`)
  }
  return parsePlatformDays(body)
}
