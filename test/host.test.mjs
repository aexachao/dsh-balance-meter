/**
 * Host half unit tests: api key parsing, loopback gate, response mapping,
 * and the full /budget/balance HTTP contract (via the injectable handler
 * factory). Run against the built lib (`pnpm build` first).
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'

import {
  parseApiKey, isLoopbackAddress, mapBalanceResponse, createBalanceHandler,
} from '../lib/index.js'
import { localDate } from '../lib/platform.js'

// ── parseApiKey: credentials text (`KEY: value` lines) → key ───────────────
test('parseApiKey extracts a plain key line', () => {
  assert.equal(parseApiKey('DEEPSEEK_API_KEY: sk-abc123'), 'sk-abc123')
})

test('parseApiKey tolerates spaces around the colon', () => {
  assert.equal(parseApiKey('DEEPSEEK_API_KEY   :   sk-x '), 'sk-x')
})

test('parseApiKey handles CRLF line endings', () => {
  assert.equal(parseApiKey('OTHER: 1\r\nDEEPSEEK_API_KEY: sk-y\r\n'), 'sk-y')
})

test('parseApiKey takes the first match', () => {
  assert.equal(parseApiKey('DEEPSEEK_API_KEY: sk-first\nDEEPSEEK_API_KEY: sk-second'), 'sk-first')
})

test('parseApiKey returns null for an empty value', () => {
  assert.equal(parseApiKey('DEEPSEEK_API_KEY:'), null)
})

test('parseApiKey ignores other keys', () => {
  assert.equal(parseApiKey('ANTHROPIC_API_KEY: sk-ant\nOPENAI_KEY: sk-openai'), null)
})

test('parseApiKey returns null for empty or comment-only text', () => {
  assert.equal(parseApiKey(''), null)
  assert.equal(parseApiKey('# just a comment\n\n'), null)
})

// ── isLoopbackAddress: security gate ───────────────────────────────────────
test('isLoopbackAddress accepts loopback forms', () => {
  assert.equal(isLoopbackAddress('127.0.0.1'), true)
  assert.equal(isLoopbackAddress('::1'), true)
  assert.equal(isLoopbackAddress('::ffff:127.0.0.1'), true)
})

test('isLoopbackAddress rejects non-loopback addresses', () => {
  assert.equal(isLoopbackAddress('192.168.1.5'), false)
  assert.equal(isLoopbackAddress('8.8.8.8'), false)
  assert.equal(isLoopbackAddress(''), false)
})

// ── mapBalanceResponse: DeepSeek snake_case → BalanceView ──────────────────
test('mapBalanceResponse maps balance rows and availability', () => {
  const view = mapBalanceResponse({
    is_available: true,
    balance_infos: [
      { currency: 'CNY', total_balance: '12.3456', granted_balance: '2.2', topped_up_balance: '10.1456' },
      { currency: 'USD', total_balance: '0.50', granted_balance: '0.5', topped_up_balance: '0' },
    ],
  })
  assert.equal(view.ok, true)
  assert.equal(view.isAvailable, true)
  assert.deepEqual(view.balanceInfos, [
    { currency: 'CNY', totalBalance: '12.3456', grantedBalance: '2.2', toppedUpBalance: '10.1456' },
    { currency: 'USD', totalBalance: '0.50', grantedBalance: '0.5', toppedUpBalance: '0' },
  ])
})

test('mapBalanceResponse defaults isAvailable when absent', () => {
  assert.equal(mapBalanceResponse({ balance_infos: [] }).isAvailable, false)
})

test('mapBalanceResponse rejects invalid bodies', () => {
  assert.equal(mapBalanceResponse({ is_available: true }).ok, false)
  assert.equal(mapBalanceResponse(null).ok, false)
  assert.equal(mapBalanceResponse('oops').ok, false)
  assert.equal(mapBalanceResponse(undefined).ok, false)
})

test('mapBalanceResponse passes through malformed rows (undefined fields)', () => {
  const view = mapBalanceResponse({ balance_infos: [{ currency: 'CNY' }] })
  assert.equal(view.ok, true)
  assert.equal(view.balanceInfos[0].totalBalance, undefined)
})

// ── createBalanceHandler: full HTTP contract with fake req/res ─────────────
function fakeReq(method, remoteAddress) {
  return { method, socket: { remoteAddress } }
}

function fakeRes() {
  let status = 0
  let body = ''
  const headers = {}
  return {
    _status() { return status },
    _body() { return body },
    _headers() { return headers },
    writeHead(code, h) { status = code; Object.assign(headers, h) },
    end(text) { body = text ?? '' },
  }
}

function deps({ key = 'sk-test', upstream, platformToken = null, monthDays = null, cache = null, meter = null } = {}) {
  const calls = []
  let savedCache = cache
  let savedMeter = meter
  return {
    calls,
    readKey: () => key,
    readPlatformToken: () => platformToken,
    fetchUpstream: async (usedKey) => {
      calls.push(usedKey)
      if (upstream === 'throw') throw new Error('ECONNRESET')
      if (upstream && upstream.status !== 200) {
        return new Response('', { status: upstream.status })
      }
      return new Response(JSON.stringify({
        is_available: true,
        balance_infos: [
          { currency: 'CNY', total_balance: '9.90', granted_balance: '1.1', topped_up_balance: '8.80' },
        ],
      }), { status: 200, headers: { 'content-type': 'application/json' } })
    },
    // 平台用量按当前月返回数据，其它月份为空 → 累计遍历在当月即停。
    fetchMonth: async (month) => (month === new Date().getMonth() + 1 ? monthDays : null),
    loadConsumedCache: () => savedCache,
    saveConsumedCache: (value) => { savedCache = value },
    loadDayMeter: () => savedMeter,
    saveDayMeter: (value) => { savedMeter = value },
  }
}

async function call(handler, req) {
  const res = fakeRes()
  await handler(req, res)
  return res
}

test('handler rejects non-GET with 405', async () => {
  const res = await call(createBalanceHandler(deps()), fakeReq('POST', '127.0.0.1'))
  assert.equal(res._status(), 405)
})

test('handler rejects non-loopback clients with 403 and never reads the key', async () => {
  const d = deps()
  const res = await call(createBalanceHandler(d), fakeReq('GET', '192.168.1.5'))
  assert.equal(res._status(), 403)
  const body = JSON.parse(res._body())
  assert.equal(body.ok, false)
  assert.match(body.error, /forbidden/)
  assert.equal(d.calls.length, 0)
})

test('handler returns 500 when no API key is configured', async () => {
  const res = await call(createBalanceHandler(deps({ key: null })), fakeReq('GET', '127.0.0.1'))
  assert.equal(res._status(), 500)
  const body = JSON.parse(res._body())
  assert.equal(body.ok, false)
  assert.match(body.error, /DEEPSEEK_API_KEY/)
})

test('handler proxies a successful upstream response with the bearer key', async () => {
  const d = deps()
  const res = await call(createBalanceHandler(d), fakeReq('GET', '127.0.0.1'))
  assert.equal(res._status(), 200)
  assert.deepEqual(d.calls, ['sk-test'])
  const body = JSON.parse(res._body())
  assert.equal(body.ok, true)
  assert.deepEqual(body.balanceInfos, [
    { currency: 'CNY', totalBalance: '9.90', grantedBalance: '1.1', toppedUpBalance: '8.80' },
  ])
  // 无 platform token → 余额差值估算今日消费（首日 0）
  assert.equal(body.todayConsumed, 0)
  assert.equal(body.todayConsumedSource, 'estimate')
  assert.equal(body.totalConsumed, undefined)
  assert.equal(res._headers()['content-type'], 'application/json; charset=utf-8')
  assert.equal(res._headers()['cache-control'], 'no-store')
})

test('handler attaches official consumption from the platform token', async () => {
  const today = localDate()
  const d = deps({
    platformToken: 'tk',
    monthDays: [
      { date: today, cost: 3 },
      { date: '2026-07-01', cost: 2 },
    ],
  })
  const res = await call(createBalanceHandler(d), fakeReq('GET', '127.0.0.1'))
  assert.equal(res._status(), 200)
  const body = JSON.parse(res._body())
  assert.equal(body.todayConsumed, 3)
  assert.equal(body.todayConsumedSource, 'official')
  assert.equal(body.totalConsumed, 5)
  assert.equal(body.totalConsumedSource, 'official')
})

test('handler reuses the official consumption cache within the same day', async () => {
  const today = new Date().toISOString().slice(0, 10)
  const d = deps({ platformToken: 'tk', cache: { date: today, todayConsumed: 1, totalConsumed: 9 } })
  const res = await call(createBalanceHandler(d), fakeReq('GET', '127.0.0.1'))
  const body = JSON.parse(res._body())
  assert.equal(body.todayConsumed, 1)
  assert.equal(body.totalConsumed, 9)
})

test('platform failures do not block the balance response', async () => {
  const d = deps({ platformToken: 'expired', monthDays: null })
  d.fetchMonth = async () => { throw new Error('DEEPSEEK_PLATFORM_TOKEN 已过期') }
  const res = await call(createBalanceHandler(d), fakeReq('GET', '127.0.0.1'))
  assert.equal(res._status(), 200)
  const body = JSON.parse(res._body())
  assert.equal(body.ok, true)
  assert.equal(body.todayConsumed, undefined)
  assert.equal(body.totalConsumed, undefined)
})

test('handler maps upstream error statuses to 502', async () => {
  for (const status of [401, 429, 500]) {
    const d = deps({ upstream: { status } })
    const res = await call(createBalanceHandler(d), fakeReq('GET', '127.0.0.1'))
    assert.equal(res._status(), 502)
    assert.match(JSON.parse(res._body()).error, new RegExp(`DeepSeek API ${status}`))
  }
})

test('handler returns 502 on invalid upstream body shape', async () => {
  const d = deps()
  d.fetchUpstream = async () => new Response('{"is_available":true}', { status: 200 })
  const res = await call(createBalanceHandler(d), fakeReq('GET', '127.0.0.1'))
  assert.equal(res._status(), 502)
  assert.match(JSON.parse(res._body()).error, /invalid response shape/)
})

test('handler returns 502 on upstream network error and never leaks the key', async () => {
  const d = deps({ upstream: 'throw' })
  const res = await call(createBalanceHandler(d), fakeReq('GET', '127.0.0.1'))
  assert.equal(res._status(), 502)
  const body = JSON.parse(res._body())
  assert.equal(body.ok, false)
  assert.match(body.error, /余额查询失败/)
  assert.equal(JSON.stringify(body).includes('sk-test'), false)
})

// ── integration: real http server + real fetch round-trip ──────────────────
test('integration: real server round-trip returns the mapped balance', async (t) => {
  const server = createServer(createBalanceHandler({
    readKey: () => 'sk-integration',
    readPlatformToken: () => null,
    fetchUpstream: async (key) => {
      assert.equal(key, 'sk-integration')
      return new Response(JSON.stringify({
        is_available: true,
        balance_infos: [{ currency: 'CNY', total_balance: '1.00', granted_balance: '0', topped_up_balance: '1.00' }],
      }), { status: 200 })
    },
    fetchMonth: async () => null,
    loadConsumedCache: () => null,
    saveConsumedCache: () => {},
    loadDayMeter: () => null,
    saveDayMeter: () => {},
  }))
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  t.after(() => server.close())
  const { port } = server.address()

  const r = await fetch(`http://127.0.0.1:${port}/budget/balance`, { headers: { 'cache-control': 'no-cache' } })
  assert.equal(r.status, 200)
  assert.equal(r.headers.get('content-type'), 'application/json; charset=utf-8')
  assert.equal(r.headers.get('cache-control'), 'no-store')
  const body = await r.json()
  assert.equal(body.ok, true)
  assert.deepEqual(body.balanceInfos, [{ currency: 'CNY', totalBalance: '1.00', grantedBalance: '0', toppedUpBalance: '1.00' }])
  assert.equal(body.todayConsumed, 0) // 无 platform token → 首日余额差值估算 0
  assert.equal(body.todayConsumedSource, 'estimate')

  const post = await fetch(`http://127.0.0.1:${port}/budget/balance`, { method: 'POST' })
  assert.equal(post.status, 405)
})
