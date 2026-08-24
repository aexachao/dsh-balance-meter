/** `ds-budget-meter` namespace dictionaries: capsule, card, errors. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'capsule.label': '余额',
  'capsule.title': '打开余额面板',
  'card.title': 'DeepSeek 余额',
  'card.totalBalance': '总余额',
  'card.grantedBalance': '赠送余额',
  'card.toppedUpBalance': '充值余额',
  'card.refresh': '刷新',
  'card.loading': '查询中…',
  'card.empty': '暂无余额数据',
  'card.close': '收起',
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
  'card.refresh': 'Refresh',
  'card.loading': 'Loading…',
  'card.empty': 'No balance data',
  'card.close': 'Collapse',
} satisfies Record<BudgetKey, string>
