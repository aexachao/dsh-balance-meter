/** `ds-budget-meter` namespace dictionaries: capsule, card, settings, toasts. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'capsule.label': '余额',
  'capsule.title': '打开余额与用量面板',
  'card.title': '用量与余额',
  'card.spent': '今日已花费',
  'card.totalAll': '累计（含往期）',
  'card.peakNow': '当前时段',
  'card.peak': '高峰',
  'card.off': '空闲',
  'card.tokens.title': '今日 tokens',
  'card.tokens.inputCached': '输入（缓存命中）',
  'card.tokens.inputUncached': '输入（缓存未命中）',
  'card.tokens.output': '输出',
  'card.byModel': '按模型',
  'card.totalBalance': '总余额',
  'card.grantedBalance': '赠送余额',
  'card.toppedUpBalance': '充值余额',
  'card.topUp': '去充值',
  'card.topUpTitle': '打开 DeepSeek 充值页面',
  'card.balanceError': '余额查询失败',
  'settings.title': '设置',
  'settings.warn': '花费提醒阈值（元）',
  'settings.stopOnOver': '达到阈值自动停止回合',
  'toast.warn': '今日已花费 {spent}，达到提醒阈值 {warn}',
  'toast.close': '关闭',
} satisfies Record<string, string>

/** The ds-budget-meter namespace key union. */
export type BudgetKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'capsule.label': 'Balance',
  'capsule.title': 'Open balance & usage panel',
  'card.title': 'Usage & balance',
  'card.spent': 'Spent today',
  'card.totalAll': 'Total (all time)',
  'card.peakNow': 'Current band',
  'card.peak': 'Peak',
  'card.off': 'Off-peak',
  'card.tokens.title': 'Tokens today',
  'card.tokens.inputCached': 'Input (cache hit)',
  'card.tokens.inputUncached': 'Input (cache miss)',
  'card.tokens.output': 'Output',
  'card.byModel': 'By model',
  'card.totalBalance': 'Total balance',
  'card.grantedBalance': 'Granted',
  'card.toppedUpBalance': 'Topped up',
  'card.topUp': 'Top up',
  'card.topUpTitle': 'Open the DeepSeek top-up page',
  'card.balanceError': 'Balance query failed',
  'settings.title': 'Settings',
  'settings.warn': 'Spend alert threshold (CNY)',
  'settings.stopOnOver': 'Auto-stop turn at threshold',
  'toast.warn': 'Spent {spent} today — alert threshold {warn} reached',
  'toast.close': 'Dismiss',
} satisfies Record<BudgetKey, string>
