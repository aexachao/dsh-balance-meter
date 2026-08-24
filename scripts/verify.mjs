#!/usr/bin/env node
/**
 * Offline smoke verification for ds-budget-meter, run against the built
 * `lib` artifacts (`pnpm build` first). Never touches a running harness
 * instance: the host's balance pipeline (api key parsing, loopback gate,
 * response mapping) is asserted as pure functions, and the client bundle is
 * executed under a simulated module loader.
 */

import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { parseApiKey, isLoopbackAddress, mapBalanceResponse } from '../lib/index.js'

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

// ── api key parsing (credentials text: `KEY: value` lines) ─────────────────
section('parseApiKey')
check('plain key line', parseApiKey('DEEPSEEK_API_KEY: sk-abc123') === 'sk-abc123')
check('spaces around colon', parseApiKey('DEEPSEEK_API_KEY   :   sk-x ') === 'sk-x')
check('crlf line endings', parseApiKey('OTHER: 1\r\nDEEPSEEK_API_KEY: sk-y\r\n') === 'sk-y')
check('first match wins', parseApiKey('DEEPSEEK_API_KEY: sk-first\nDEEPSEEK_API_KEY: sk-second') === 'sk-first')
check('empty value → null', parseApiKey('DEEPSEEK_API_KEY:') === null)
check('other keys ignored', parseApiKey('ANTHROPIC_API_KEY: sk-ant\nOPENAI_KEY: sk-openai') === null)
check('empty text → null', parseApiKey('') === null)
check('comment-only text → null', parseApiKey('# just a comment\n\n') === null)

// ── loopback gate ───────────────────────────────────────────────────────────
section('isLoopbackAddress')
check('ipv4 loopback', isLoopbackAddress('127.0.0.1') === true)
check('ipv6 loopback', isLoopbackAddress('::1') === true)
check('ipv4-mapped loopback', isLoopbackAddress('::ffff:127.0.0.1') === true)
check('lan address rejected', isLoopbackAddress('192.168.1.5') === false)
check('remote address rejected', isLoopbackAddress('8.8.8.8') === false)
check('empty address rejected', isLoopbackAddress('') === false)

// ── DeepSeek API response mapping (snake_case → BalanceView) ───────────────
section('mapBalanceResponse')
{
  const mapped = mapBalanceResponse({
    is_available: true,
    balance_infos: [
      { currency: 'CNY', total_balance: '12.3456', granted_balance: '2.2', topped_up_balance: '10.1456' },
      { currency: 'USD', total_balance: '0.50', granted_balance: '0.5', topped_up_balance: '0' },
    ],
  })
  check(
    'maps first row',
    mapped.ok === true
      && mapped.isAvailable === true
      && mapped.balanceInfos?.[0].totalBalance === '12.3456'
      && mapped.balanceInfos?.[0].grantedBalance === '2.2'
      && mapped.balanceInfos?.[0].toppedUpBalance === '10.1456',
  )
  check('maps all rows', mapped.balanceInfos?.length === 2 && mapped.balanceInfos[1].currency === 'USD')
  check('defaults isAvailable when absent', mapBalanceResponse({ balance_infos: [] }).isAvailable === false)
  check('missing balance_infos → error', mapBalanceResponse({ is_available: true }).ok === false)
  check('null body → error', mapBalanceResponse(null).ok === false)
  check('non-object body → error', mapBalanceResponse('oops').ok === false)
  check('malformed row tolerated (undefined fields)', mapBalanceResponse({
    balance_infos: [{ currency: 'CNY' }],
  }).balanceInfos?.[0].totalBalance === undefined)
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
      JSON.stringify(exports.inject) === JSON.stringify(['slots', 'locale']),
    )
  } catch (error) {
    check('bundle executed without throwing', false, String(error))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

console.log(failures === 0 ? '\n✔ all checks passed' : `\n✘ ${failures} check(s) failed`)
process.exit(failures === 0 ? 0 : 1)
