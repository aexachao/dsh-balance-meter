/**
 * Usage parser tests (restored from the original suite): normalizes the
 * various token usage shapes (harness wire / OpenAI camel / snake / Anthropic
 * cache field) into { cachedIn, uncachedIn, out }.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { parseUsage } from '../lib/client/usage.js'

test('parseUsage handles camelCase shape', () => {
  const parsed = parseUsage({ promptTokens: 1000, completionTokens: 200, promptTokensDetails: { cachedTokens: 300 } })
  assert.deepEqual(parsed, { cachedIn: 300, uncachedIn: 700, out: 200 })
})

test('parseUsage handles harness wire shape (disjoint counts)', () => {
  const wire = parseUsage({ inputTokens: 19615, outputTokens: 236, cacheReadTokens: 6016, reasoningTokens: 204 })
  assert.deepEqual(wire, { cachedIn: 6016, uncachedIn: 19615, out: 236 })
  const mostlyCached = parseUsage({ inputTokens: 292, outputTokens: 500, cacheReadTokens: 25600 })
  assert.deepEqual(mostlyCached, { cachedIn: 25600, uncachedIn: 292, out: 500 })
})

test('parseUsage handles snake_case shape', () => {
  const parsed = parseUsage({ prompt_tokens: 1000, completion_tokens: 200, prompt_tokens_details: { cached_tokens: 300 } })
  assert.deepEqual(parsed, { cachedIn: 300, uncachedIn: 700, out: 200 })
})

test('parseUsage treats missing cache counts as uncached', () => {
  assert.deepEqual(parseUsage({ promptTokens: 1000, completionTokens: 200 }), { cachedIn: 0, uncachedIn: 1000, out: 200 })
})

test('parseUsage handles the anthropic cache field', () => {
  assert.deepEqual(parseUsage({ prompt_tokens: 1000, completion_tokens: 50, cache_read_input_tokens: 400 }), {
    cachedIn: 400, uncachedIn: 600, out: 50,
  })
})

test('parseUsage clamps cached tokens to the prompt total', () => {
  assert.deepEqual(parseUsage({ promptTokens: 100, completionTokens: 10, promptTokensDetails: { cachedTokens: 500 } }), {
    cachedIn: 100, uncachedIn: 0, out: 10,
  })
})

test('parseUsage rejects malformed input', () => {
  assert.equal(parseUsage({ promptTokens: 10 }), null) // missing completion
  assert.equal(parseUsage('nope'), null)
  assert.equal(parseUsage(null), null)
  assert.equal(parseUsage({ promptTokens: -5, completionTokens: 1 }), null) // negative
})
