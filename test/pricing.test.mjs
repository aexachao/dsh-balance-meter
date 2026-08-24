/**
 * Pricing module tests (restored from the original suite): official DeepSeek
 * V4 peak/off-peak price table, cost aggregation, peak window parsing and
 * boundary evaluation, provider gate, and model→profile mapping.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import {
  PRICING, costOf, isPeak, isDeepSeekProvider, deepseekProfile, parsePeakWindows,
} from '../lib/client/pricing.js'

const M = 1_000_000

function approx(a, b) {
  return Math.abs(a - b) < 1e-9
}

// ── pricing table (values from the official DeepSeek V4 price sheet) ───────
test('costOf prices flash at official rates', () => {
  assert.equal(approx(costOf({ cachedIn: M, uncachedIn: 0, out: 0 }, 'flash', false), 0.05), true)
  assert.equal(approx(costOf({ cachedIn: M, uncachedIn: 0, out: 0 }, 'flash', true), 0.1), true)
  assert.equal(approx(costOf({ cachedIn: 0, uncachedIn: M, out: 0 }, 'flash', false), 1.5), true)
  assert.equal(approx(costOf({ cachedIn: 0, uncachedIn: M, out: 0 }, 'flash', true), 3), true)
  assert.equal(approx(costOf({ cachedIn: 0, uncachedIn: 0, out: M }, 'flash', false), 4.5), true)
  assert.equal(approx(costOf({ cachedIn: 0, uncachedIn: 0, out: M }, 'flash', true), 9), true)
})

test('costOf prices pro at official rates', () => {
  assert.equal(approx(costOf({ cachedIn: M, uncachedIn: 0, out: 0 }, 'pro', false), 0.15), true)
  assert.equal(approx(costOf({ cachedIn: M, uncachedIn: 0, out: 0 }, 'pro', true), 0.3), true)
  assert.equal(approx(costOf({ cachedIn: 0, uncachedIn: M, out: 0 }, 'pro', false), 4.5), true)
  assert.equal(approx(costOf({ cachedIn: 0, uncachedIn: M, out: 0 }, 'pro', true), 9), true)
  assert.equal(approx(costOf({ cachedIn: 0, uncachedIn: 0, out: M }, 'pro', false), 13.5), true)
  assert.equal(approx(costOf({ cachedIn: 0, uncachedIn: 0, out: M }, 'pro', true), 27), true)
})

test('costOf sums mixed usage', () => {
  assert.equal(approx(costOf({ cachedIn: 2 * M, uncachedIn: M, out: 0.5 * M }, 'flash', true), 0.2 + 3 + 4.5), true)
})

test('pricing table shape', () => {
  assert.equal(PRICING.flash.off.cachedIn, 0.05)
  assert.equal(PRICING.pro.peak.out, 27)
})

// ── peak windows (official: 09:00–12:00, 14:00–18:00 Beijing time) ──────────
test('parsePeakWindows parses and drops malformed parts', () => {
  const windows = parsePeakWindows('09:00-12:00,14:00-18:00')
  assert.equal(windows.length, 2)
  assert.equal(windows[0].startMin, 540)
  assert.equal(windows[1].endMin, 1080)
  assert.equal(parsePeakWindows('09:00-12:00, bogus, 25:00-26:00, 12:00-09:00').length, 1)
})

test('isPeak evaluates Beijing-time boundaries (start-inclusive, end-exclusive)', () => {
  const windows = parsePeakWindows('09:00-12:00,14:00-18:00')
  // Beijing = UTC+8
  const bj = (hour, minute) => Date.UTC(2026, 7, 17, hour - 8, minute)
  assert.equal(isPeak(bj(8, 59), windows, 'Asia/Shanghai'), false)
  assert.equal(isPeak(bj(9, 0), windows, 'Asia/Shanghai'), true)
  assert.equal(isPeak(bj(11, 59), windows, 'Asia/Shanghai'), true)
  assert.equal(isPeak(bj(12, 0), windows, 'Asia/Shanghai'), false)
  assert.equal(isPeak(bj(14, 0), windows, 'Asia/Shanghai'), true)
  assert.equal(isPeak(bj(17, 59), windows, 'Asia/Shanghai'), true)
  assert.equal(isPeak(bj(18, 0), windows, 'Asia/Shanghai'), false)
  assert.equal(isPeak(bj(23, 0), windows, 'Asia/Shanghai'), false)
})

// ── provider gate + profile mapping ────────────────────────────────────────
test('isDeepSeekProvider qualifies by provider id or model name', () => {
  assert.equal(isDeepSeekProvider('deepseek-official', undefined), true)
  assert.equal(isDeepSeekProvider(undefined, 'DeepSeek-V4-Pro-0813'), true)
  assert.equal(isDeepSeekProvider('deepseek-official', 'deepseek-v4-flash'), true)
  assert.equal(isDeepSeekProvider('openai', 'gpt-4o'), false)
  assert.equal(isDeepSeekProvider(undefined, undefined), true) // history replay: deployment default
})

test('deepseekProfile maps model names to price profiles', () => {
  assert.equal(deepseekProfile('deepseek-v4-flash'), 'flash')
  assert.equal(deepseekProfile('DeepSeek-V4-Pro-0813'), 'pro')
  assert.equal(deepseekProfile('deepseek-v5-mystery'), 'flash') // unknown → deployment default
  assert.equal(deepseekProfile(undefined), 'flash')
})
