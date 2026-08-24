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
export declare function parseCredential(text: string, name: string): string | null;
/** 本地日历日 `YYYY-MM-DD`（dashboard 行按日期键控）。 */
export declare function localDate(d?: Date): string;
/** 平台 usage/cost 的一日费用行。 */
export interface PlatformDay {
    date: string;
    cost: number;
}
/**
 * 平台 usage/cost 响应 → 按日费用列表。
 * 响应信封：`{ code: 0, data: { biz_code: 0, biz_data: { days: [
 *   { date: "YYYY-MM-DD", data: [ { usage: [ { cost|amount, ... } ] } ] }
 * ] } } }`。解析防御字段改名；无数据或形状不符返回 null。
 */
export declare function parsePlatformDays(body: unknown): PlatformDay[] | null;
/** 从平台某月费用列表取某天的费用；无该天返回 null。 */
export declare function dayCost(days: PlatformDay[], date: string): number | null;
/**
 * 聚合全历史官方消费：从当前月往前逐月拉取（空月/失败即停，上限
 * maxMonths），返回累计总额与今日费用。任何月份都没有数据时返回 null。
 */
export declare function aggregatePlatformConsumption(fetchMonth: (month: number, year: number) => Promise<PlatformDay[] | null>, now?: Date, maxMonths?: number): Promise<{
    total: number;
    today: number;
} | null>;
/** 日余额计量状态：当天零点余额与最近观察值。 */
export interface DayMeterState {
    date: string;
    opening: number;
    last: number;
}
/**
 * 推进日计量：首日以当前余额为 opening（消费 0）；同日沿用 opening；
 * 跨天时以昨天的最后余额为新 opening（与 dsh-deepseek-quota 同款语义）。
 * 今日消费估算 = max(0, opening − 当前余额)。
 */
export declare function advanceDayMeter(state: DayMeterState | null, today: string, balance: number): {
    state: DayMeterState;
    consumed: number | null;
};
/** 拉取平台某月费用列表；信封错误/HTTP 失败抛错，空月返回 null。 */
export declare function fetchPlatformMonth(token: string, month: number, year: number): Promise<PlatformDay[] | null>;
