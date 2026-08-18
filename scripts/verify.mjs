#!/usr/bin/env node
/**
 * Offline smoke verification for ds-budget-meter, run against the built
 * `lib` artifacts (`pnpm build` first). Never touches a running harness
 * instance: pricing/usage/ledger are asserted as pure modules, and the
 * client bundle is executed under a simulated module loader.
 */

import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  PRICING, costOf, isPeak, isDeepSeekProvider, deepseekProfile, parsePeakWindows,
} from '../lib/client/pricing.js'
import { parseUsage } from '../lib/client/usage.js'
import {
  LedgerStore, aggregateSince, parseLedgerPayload, periodStartMs, pruneRecords,
  resetRecordsSince, upsertRecord,
} from '../lib/client/ledger.js'

let failures = 0

function check(label, condition, detail = '') {
  if (condition) {
    console.log(`  ok  ${label}`)
  } else {
    failures += 1
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n== ${title} ==`)
}

function approx(a, b) {
  return Math.abs(a - b) < 1e-9
}

// ── pricing table (values from the official DeepSeek V4 price sheet) ───────
section('pricing')
const M = 1_000_000
check('flash off cached', approx(costOf({ cachedIn: M, uncachedIn: 0, out: 0 }, 'flash', false), 0.05))
check('flash peak cached', approx(costOf({ cachedIn: M, uncachedIn: 0, out: 0 }, 'flash', true), 0.1))
check('flash off uncached', approx(costOf({ cachedIn: 0, uncachedIn: M, out: 0 }, 'flash', false), 1.5))
check('flash peak uncached', approx(costOf({ cachedIn: 0, uncachedIn: M, out: 0 }, 'flash', true), 3))
check('flash off output', approx(costOf({ cachedIn: 0, uncachedIn: 0, out: M }, 'flash', false), 4.5))
check('flash peak output', approx(costOf({ cachedIn: 0, uncachedIn: 0, out: M }, 'flash', true), 9))
check('pro off cached', approx(costOf({ cachedIn: M, uncachedIn: 0, out: 0 }, 'pro', false), 0.15))
check('pro peak cached', approx(costOf({ cachedIn: M, uncachedIn: 0, out: 0 }, 'pro', true), 0.3))
check('pro off uncached', approx(costOf({ cachedIn: 0, uncachedIn: M, out: 0 }, 'pro', false), 4.5))
check('pro peak uncached', approx(costOf({ cachedIn: 0, uncachedIn: M, out: 0 }, 'pro', true), 9))
check('pro off output', approx(costOf({ cachedIn: 0, uncachedIn: 0, out: M }, 'pro', false), 13.5))
check('pro peak output', approx(costOf({ cachedIn: 0, uncachedIn: 0, out: M }, 'pro', true), 27))
check(
  'mixed triple flash peak',
  approx(costOf({ cachedIn: 2 * M, uncachedIn: M, out: 0.5 * M }, 'flash', true), 0.2 + 3 + 4.5),
)
check('pricing table shape', PRICING.flash.off.cachedIn === 0.05 && PRICING.pro.peak.out === 27)

// ── peak windows (official: 09:00–12:00, 14:00–18:00 Beijing time) ──────────
section('peak windows')
{
  const windows = parsePeakWindows('09:00-12:00,14:00-18:00')
  check('parses two windows', windows.length === 2 && windows[0].startMin === 540 && windows[1].endMin === 1080)
  check('malformed parts dropped', parsePeakWindows('09:00-12:00, bogus, 25:00-26:00, 12:00-09:00').length === 1)

  // Beijing = UTC+8; boundaries are start-inclusive, end-exclusive.
  const bj = (hour, minute) => Date.UTC(2026, 7, 17, hour - 8, minute)
  check('08:59 BJ off-peak', isPeak(bj(8, 59), windows, 'Asia/Shanghai') === false)
  check('09:00 BJ peak', isPeak(bj(9, 0), windows, 'Asia/Shanghai') === true)
  check('11:59 BJ peak', isPeak(bj(11, 59), windows, 'Asia/Shanghai') === true)
  check('12:00 BJ off-peak', isPeak(bj(12, 0), windows, 'Asia/Shanghai') === false)
  check('14:00 BJ peak', isPeak(bj(14, 0), windows, 'Asia/Shanghai') === true)
  check('17:59 BJ peak', isPeak(bj(17, 59), windows, 'Asia/Shanghai') === true)
  check('18:00 BJ off-peak', isPeak(bj(18, 0), windows, 'Asia/Shanghai') === false)
  check('23:00 BJ off-peak', isPeak(bj(23, 0), windows, 'Asia/Shanghai') === false)
}

// ── provider gate + profile mapping ────────────────────────────────────────
section('provider gate')
check('provider id qualifies', isDeepSeekProvider('deepseek-official', undefined) === true)
check('model name qualifies', isDeepSeekProvider(undefined, 'DeepSeek-V4-Pro-0813') === true)
check('both qualify', isDeepSeekProvider('deepseek-official', 'deepseek-v4-flash') === true)
check('other provider excluded', isDeepSeekProvider('openai', 'gpt-4o') === false)
check('absent identity priced (history replay)', isDeepSeekProvider(undefined, undefined) === true)
check('flash name → flash', deepseekProfile('deepseek-v4-flash') === 'flash')
check('pro name → pro', deepseekProfile('DeepSeek-V4-Pro-0813') === 'pro')
check('unknown model → flash (deployment default)', deepseekProfile('deepseek-v5-mystery') === 'flash')
check('missing model → flash', deepseekProfile(undefined) === 'flash')

// ── usage parser ────────────────────────────────────────────────────────────
section('parseUsage')
{
  const camel = parseUsage({ promptTokens: 1000, completionTokens: 200, promptTokensDetails: { cachedTokens: 300 } })
  check('camelCase shape', camel !== null && camel.cachedIn === 300 && camel.uncachedIn === 700 && camel.out === 200)

  const wire = parseUsage({ inputTokens: 19615, outputTokens: 236, cacheReadTokens: 6016, reasoningTokens: 204 })
  check('harness wire shape (disjoint counts)', wire !== null && wire.cachedIn === 6016 && wire.uncachedIn === 19615 && wire.out === 236)
  const wireAllCached = parseUsage({ inputTokens: 292, outputTokens: 500, cacheReadTokens: 25600 })
  check('harness wire shape mostly-cached', wireAllCached !== null && wireAllCached.cachedIn === 25600 && wireAllCached.uncachedIn === 292)

  const snake = parseUsage({ prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 300 } })
  check('snake_case shape', snake !== null && snake.cachedIn === 300 && snake.uncachedIn === 700 && snake.out === 200)

  const noCache = parseUsage({ promptTokens: 1000, completionTokens: 200 })
  check('missing cache counts as uncached', noCache !== null && noCache.cachedIn === 0 && noCache.uncachedIn === 1000)

  const anthropic = parseUsage({ prompt_tokens: 1000, completion_tokens: 50, cache_read_input_tokens: 400 })
  check('anthropic cache field', anthropic !== null && anthropic.cachedIn === 400 && anthropic.uncachedIn === 600)

  const clamped = parseUsage({ promptTokens: 100, completionTokens: 10, promptTokensDetails: { cachedTokens: 500 } })
  check('cached clamped to prompt', clamped !== null && clamped.cachedIn === 100 && clamped.uncachedIn === 0)

  check('missing completion rejected', parseUsage({ promptTokens: 10 }) === null)
  check('non-object rejected', parseUsage('nope') === null)
  check('null rejected', parseUsage(null) === null)
  check('negative rejected', parseUsage({ promptTokens: -5, completionTokens: 1 }) === null)
}

// ── ledger pure operations ──────────────────────────────────────────────────
section('ledger')
{
  const rec = (key, time, cost) => ({
    key, sessionId: 's1', model: 'flash', time, cachedIn: 1, uncachedIn: 1, out: 1, cost,
  })
  let step = upsertRecord([], rec('a', 1000, 0.5))
  check('first upsert inserts', step.changed === true && step.records.length === 1)
  step = upsertRecord(step.records, rec('a', 1000, 0.5))
  check('identical upsert dedupes', step.changed === false && step.records.length === 1)
  step = upsertRecord(step.records, rec('b', 2000, 1.5))
  check('second key inserts', step.records.length === 2)

  const totals = aggregateSince(step.records, 1500)
  check('aggregate filters by time', approx(totals.cost, 1.5) && totals.byModel.flash.cost === 1.5)
  const all = aggregateSince(step.records, 0)
  check('aggregate all', approx(all.cost, 2))

  const reset = resetRecordsSince(step.records, 1500)
  check('reset drops newer', reset.changed === true && reset.records.length === 1 && reset.records[0].key === 'a')
  const pruned = pruneRecords(step.records, 1500)
  check('prune drops older', pruned.records.length === 1 && pruned.records[0].key === 'b')

  const now = new Date(2026, 7, 17, 10, 30).getTime()
  check('daily period start', periodStartMs('daily', now) === new Date(2026, 7, 17).getTime())
  check('monthly period start', periodStartMs('monthly', now) === new Date(2026, 7, 1).getTime())
  check('total period start is 0', periodStartMs('total', now) === 0)

  const parsed = parseLedgerPayload([rec('ok', 5, 0.1), { key: 1 }, 'junk', null])
  check('payload validation drops malformed', parsed.length === 1 && parsed[0].key === 'ok')
}

// ── LedgerStore observable/persistence ──────────────────────────────────────
section('LedgerStore')
{
  let saved = null
  const store = new LedgerStore(() => [], (records) => { saved = records })
  let notified = 0
  const unsub = store.subscribe(() => { notified += 1 })
  store.upsert({ key: 'x', sessionId: 's', model: 'pro', time: 1, cachedIn: 0, uncachedIn: 0, out: 0, cost: 0.25 })
  check('upsert persists', Array.isArray(saved) && saved.length === 1)
  check('upsert notifies', notified === 1)
  store.upsert({ key: 'x', sessionId: 's', model: 'pro', time: 1, cachedIn: 0, uncachedIn: 0, out: 0, cost: 0.25 })
  check('duplicate upsert silent', notified === 1)
  check('version snapshot', typeof store.getSnapshotVersion() === 'number' && store.getSnapshotVersion() === 1)
  unsub()
  store.resetSince(0)
  check('reset notifies after unsub removed listener', notified === 1 && store.all().length === 0)
}

// ── client bundle executes under a simulated loader ─────────────────────────
section('client bundle')
{
  const require = createRequire(import.meta.url)
  const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  check('bundle is a closure factory', code.includes('window.__ModuleLoader__.load({') && code.includes('id: "ds-budget-meter"'))

  // Execute the verbatim build artifact by requiring a temp .cjs copy (the
  // package is type:module, so the shipped .js cannot be required directly).
  // The banner only touches `window` at evaluation time; the factory's own
  // `require` parameter is supplied by us at materialization.
  const dir = mkdtempSync(join(tmpdir(), 'dsbm-verify-'))
  const bundlePath = join(dir, 'client.bundle.cjs')
  writeFileSync(bundlePath, code)
  let loaded
  globalThis.window = {
    __ModuleLoader__: {
      load(entry) { loaded = entry },
    },
  }
  try {
    require(bundlePath)
    check('loader registered the plugin', loaded !== undefined && loaded.id === 'ds-budget-meter')
    const exports = loaded.factory(require)
    check('bundle materializes apply/inject', typeof exports.apply === 'function' && Array.isArray(exports.inject))
    check(
      'bundle injects required services',
      JSON.stringify(exports.inject) === JSON.stringify(['slots', 'sessions', 'locale']),
    )
  } catch (error) {
    failures += 1
    console.error(`FAIL  client bundle execution — ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    delete globalThis.window
    rmSync(dir, { recursive: true, force: true })
  }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`)
process.exit(failures === 0 ? 0 : 1)
