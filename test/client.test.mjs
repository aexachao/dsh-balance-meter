/**
 * Client half tests: the shipped bundle (lib/client.js) must be a closure
 * factory the harness module loader can materialize, expose apply/inject,
 * and request exactly the services the host offers.
 */

import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

test('client bundle is a closure factory with the plugin id', () => {
  const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(code, /window\.__ModuleLoader__\.load\(\{/)
  assert.match(code, /id: "dsh-balance-tracker"/)
})

test('client bundle reads from the host /budget/balance endpoint', () => {
  const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(code, /budget\/balance/)
})

test('client bundle registers into the session header utilities slot', () => {
  const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
  assert.match(code, /conversation\.session\.header\.utilities/)
  assert.doesNotMatch(code, /shell\.overlay/)
})

test('client bundle materializes apply/inject with the required services', () => {
  const require = createRequire(import.meta.url)
  const code = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')

  // Execute the verbatim build artifact by requiring a temp .cjs copy (the
  // package is type:module, so the shipped .js cannot be required directly).
  // The banner only touches `window` at evaluation time; the factory's own
  // `require` parameter is supplied by us at materialization.
  const dir = mkdtempSync(join(tmpdir(), 'dsbm-test-'))
  const bundlePath = join(dir, 'client.bundle.cjs')
  writeFileSync(bundlePath, code)

  let loaded
  const prevWindow = globalThis.window
  globalThis.window = { __ModuleLoader__: { load(entry) { loaded = entry } } }
  try {
    require(bundlePath)
    assert.equal(loaded?.id, 'dsh-balance-tracker')
    const exports = loaded.factory(require)
    assert.equal(typeof exports.apply, 'function')
    assert.deepEqual(exports.inject, ['slots', 'sessions', 'locale'])
  } finally {
    globalThis.window = prevWindow
    rmSync(dir, { recursive: true, force: true })
  }
})
