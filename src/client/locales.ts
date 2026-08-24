/** `ds-budget-meter` namespace dictionaries: capsule, card, statuses, errors. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'capsule.label': '余额',
  'capsule.title': '打开余额面板',
  'card.title': 'DeepSeek 余额',
  'card.totalBalance': '总余额',
  'card.grantedBalance': '赠送余额',
  'card.toppedUpBalance': '充值余额',
  'card.currency': '币种',
  'card.refresh': '刷新',
  'card.loading': '查询中…',
  'card.empty': '暂无余额数据',
  'card.error': '余额查询失败',
  'card.close': '收起',
  'status.ok': '正常',
  'status.empty': '无数据',
  'status.error': '查询失败',
  'toast.close': '关闭',
} satisfies Record<string, string>

/** The ds-budget-meter namespace key union. */
export type BudgetKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'capsule.label': 'Balance',
  'capsule.title': 'Open balance panel',
  'card.title': 'DeepSeek Balance',
  'card.totalBalance': 'Total balance',
  'card.grantedBalance': 'Granted',
  'card.toppedUpBalance': 'Topped up',
  'card.currency': 'Currency',
  'card.refresh': 'Refresh',
  'card.loading': 'Loading…',
  'card.empty': 'No balance data',
  'card.error': 'Balance query failed',
  'card.close': 'Collapse',
  'status.ok': 'OK',
  'status.empty': 'Empty',
  'status.error': 'Error',
  'toast.close': 'Dismiss',
} satisfies Record<BudgetKey, string>
