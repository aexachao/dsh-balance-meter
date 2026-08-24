/**
 * Platform module tests: credential parsing, usage/cost response parsing,
 * all-history aggregation, and the balance-delta daily meter.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  parseCredential, localDate, parsePlatformDays, aggregatePlatformConsumption, advanceDayMeter,
  fetchPlatformMonth,
} from '../lib/platform.js'

// ── parseCredential ─────────────────────────────────────────────────────────
test('parseCredential extracts the named key', () => {
  assert.equal(parseCredential('DEEPSEEK_API_KEY: sk-abc\nOTHER: x', 'DEEPSEEK_API_KEY'), 'sk-abc')
  assert.equal(parseCredential('OTHER: x', 'DEEPSEEK_API_KEY'), null)
  assert.equal(parseCredential('', 'DEEPSEEK_API_KEY'), null)
})

// ── parsePlatformDays ───────────────────────────────────────────────────────
const sampleEnvelope = {
  code: 0,
  data: {
    biz_code: 0,
    biz_data: {
      days: [
        {
          date: '2026-08-20',
          data: [
            { usage: [{ cost: '1.25' }] },
            { usage: [{ cost: 0.5 }, { amount: 0.25 }] },
          ],
        },
        {
          date: '2026-08-21',
          data: [{ usage: [{ cost: '3.00' }] }],
        },
      ],
    },
  },
}

test('parsePlatformDays sums per-day usage costs', () => {
  const days = parsePlatformDays(sampleEnvelope)
  assert.deepEqual(days, [
    { date: '2026-08-20', cost: 2 },
    { date: '2026-08-21', cost: 3 },
  ])
})

test('parsePlatformDays tolerates wrapper arrays and missing rows', () => {
  const wrapped = { code: 0, data: { biz_code: 0, biz_data: [sampleEnvelope.data.biz_data] } }
  assert.equal(parsePlatformDays(wrapped)?.[0].date, '2026-08-20')
  const empty = { code: 0, data: { biz_code: 0, biz_data: { days: [] } } }
  assert.equal(parsePlatformDays(empty), null)
  assert.equal(parsePlatformDays(null), null)
  assert.equal(parsePlatformDays('oops'), null)
})

test('parsePlatformDays rejects non-zero envelope codes', () => {
  const bad = { code: 0, data: { biz_code: 40002, biz_data: { days: [] } } }
  assert.equal(parsePlatformDays(bad), null)
})

// ── fetchPlatformMonth (transport + envelope + parse, mocked fetch) ─────────
test('fetchPlatformMonth parses a real envelope end-to-end', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify(sampleEnvelope), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
  try {
    const days = await fetchPlatformMonth('tk', 8, 2026)
    assert.deepEqual(days, [
      { date: '2026-08-20', cost: 2 },
      { date: '2026-08-21', cost: 3 },
    ])
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('fetchPlatformMonth throws on session-expired envelope codes', async () => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: null,
    data: { biz_code: 40002, biz_data: {} },
  }), { status: 200 })
  try {
    await assert.rejects(fetchPlatformMonth('tk', 8, 2026), /已过期/)
  } finally {
    globalThis.fetch = originalFetch
  }
})

// ── aggregatePlatformConsumption ────────────────────────────────────────────
test('aggregate walks months back to the first empty one and sums everything', async () => {
  const now = new Date(2026, 7, 21) // 2026-08-21
  const calls = []
  const fetchMonth = async (month, year) => {
    calls.push(`${year}-${month}`)
    if (month === 6) return null // 2026-06 empty → stop
    return [{ date: '2026-08-21', cost: 3 }, { date: '2026-08-20', cost: 2 }]
  }
  const agg = await aggregatePlatformConsumption(fetchMonth, now)
  assert.equal(agg.total, 10) // aug(5) + jul(5), jun empty stops the walk
  assert.equal(agg.today, 3)
  assert.deepEqual(calls, ['2026-8', '2026-7', '2026-6'])
})

test('aggregate returns null when no month has data', async () => {
  const agg = await aggregatePlatformConsumption(async () => null, new Date(2026, 7, 21))
  assert.equal(agg, null)
})

test('aggregate today falls back to 0 when today has no row', async () => {
  const fetchMonth = async (month) => (month === 8 ? [{ date: '2026-08-20', cost: 2 }] : null)
  const agg = await aggregatePlatformConsumption(fetchMonth, new Date(2026, 7, 21))
  assert.equal(agg.today, 0)
  assert.equal(agg.total, 2)
})

// ── advanceDayMeter (balance-delta estimate) ────────────────────────────────
test('first observation seeds the opening and reports zero consumption', () => {
  const { state, consumed } = advanceDayMeter(null, '2026-08-21', 100)
  assert.deepEqual(state, { date: '2026-08-21', opening: 100, last: 100 })
  assert.equal(consumed, 0)
})

test('later drops report the delta since opening', () => {
  let { state } = advanceDayMeter(null, '2026-08-21', 100)
  ;({ state } = advanceDayMeter(state, '2026-08-21', 95.5))
  const { consumed } = advanceDayMeter(state, '2026-08-21', 92)
  assert.equal(consumed, 8)
})

test('a new day rolls the last balance into the opening', () => {
  let { state } = advanceDayMeter(null, '2026-08-21', 100)
  ;({ state } = advanceDayMeter(state, '2026-08-21', 92))
  const { state: next, consumed } = advanceDayMeter(state, '2026-08-22', 90)
  assert.equal(next.opening, 92)
  assert.equal(consumed, 2)
})

test('top-ups are clamped at zero (no negative consumption)', () => {
  let { state } = advanceDayMeter(null, '2026-08-21', 100)
  const { consumed } = advanceDayMeter(state, '2026-08-21', 150)
  assert.equal(consumed, 0)
})

test('unusable balances yield no consumption and keep the meter', () => {
  const { state, consumed } = advanceDayMeter(null, '2026-08-21', Number.NaN)
  assert.equal(consumed, null)
  assert.equal(state.date, '2026-08-21')
})

test('localDate formats the local calendar day', () => {
  assert.equal(localDate(new Date(2026, 7, 3)), '2026-08-03')
})
