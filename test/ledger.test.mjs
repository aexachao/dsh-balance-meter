/**
 * Ledger tests (restored from the original suite): dedup/aggregate/reset/
 * prune pure operations, period boundaries (daily anchoring), payload
 * validation, and the observable LedgerStore persistence contract.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  LedgerStore, aggregateSince, periodStartMs, parseLedgerPayload, pruneRecords,
  resetRecordsSince, upsertRecord,
} from '../lib/client/ledger.js'

function rec(key, time, cost) {
  return { key, sessionId: 's1', model: 'flash', time, cachedIn: 1, uncachedIn: 1, out: 1, cost }
}

function approx(a, b) {
  return Math.abs(a - b) < 1e-9
}

test('upsertRecord inserts new and dedupes identical', () => {
  let step = upsertRecord([], rec('a', 1000, 0.5))
  assert.equal(step.changed, true)
  assert.equal(step.records.length, 1)
  step = upsertRecord(step.records, rec('a', 1000, 0.5))
  assert.equal(step.changed, false)
  assert.equal(step.records.length, 1)
  step = upsertRecord(step.records, rec('b', 2000, 1.5))
  assert.equal(step.records.length, 2)
})

test('aggregateSince filters by time and groups by model', () => {
  const records = [rec('a', 1000, 0.5), rec('b', 2000, 1.5)]
  const totals = aggregateSince(records, 1500)
  assert.equal(approx(totals.cost, 1.5), true)
  assert.equal(totals.byModel.flash.cost, 1.5)
  const all = aggregateSince(records, 0)
  assert.equal(approx(all.cost, 2), true)
})

test('resetRecordsSince drops newer, pruneRecords drops older', () => {
  const records = [rec('a', 1000, 0.5), rec('b', 2000, 1.5)]
  const reset = resetRecordsSince(records, 1500)
  assert.equal(reset.changed, true)
  assert.equal(reset.records.length, 1)
  assert.equal(reset.records[0].key, 'a')
  const pruned = pruneRecords(records, 1500)
  assert.equal(pruned.records.length, 1)
  assert.equal(pruned.records[0].key, 'b')
})

test('periodStartMs anchors daily periods to local midnight', () => {
  const now = new Date(2026, 7, 17, 10, 30).getTime()
  assert.equal(periodStartMs('daily', now), new Date(2026, 7, 17).getTime())
  assert.equal(periodStartMs('monthly', now), new Date(2026, 7, 1).getTime())
  assert.equal(periodStartMs('total', now), 0)
})

test('parseLedgerPayload drops malformed rows', () => {
  const parsed = parseLedgerPayload([rec('ok', 5, 0.1), { key: 1 }, 'junk', null])
  assert.equal(parsed.length, 1)
  assert.equal(parsed[0].key, 'ok')
})

test('LedgerStore persists, notifies, and dedupes', () => {
  let saved = null
  const store = new LedgerStore(() => [], (records) => { saved = records })
  let notified = 0
  const unsub = store.subscribe(() => { notified += 1 })
  store.upsert(rec('x', 1, 0.25))
  assert.ok(Array.isArray(saved) && saved.length === 1)
  assert.equal(notified, 1)
  store.upsert(rec('x', 1, 0.25))
  assert.equal(notified, 1) // duplicate upsert is silent
  assert.equal(typeof store.getSnapshotVersion(), 'number')
  assert.equal(store.getSnapshotVersion(), 1)
  unsub()
  store.resetSince(0)
  assert.equal(notified, 1) // listener removed → no extra notification
  assert.equal(store.all().length, 0)
})
