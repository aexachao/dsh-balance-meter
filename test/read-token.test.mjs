/**
 * Platform-token auto-detection helpers: extracting userToken from browser
 * LevelDB buffers and upserting the credential line.
 */

import test from 'node:test'
import assert from 'node:assert/strict'

import { extractUserToken, upsertCredential } from '../scripts/read-token.mjs'

test('extractUserToken finds a quoted token after the key marker', () => {
  const buf = Buffer.from(
    'prefix_https://platform.deepseek.com\x00\x01userToken\x00\x01"sk-plat-abcdefghijklmnopqrstuvwxyz123456"tail',
    'latin1',
  )
  assert.equal(extractUserToken(buf), 'sk-plat-abcdefghijklmnopqrstuvwxyz123456')
})

test('extractUserToken parses the real JSON-wrapped value form', () => {
  const raw = '{"value":"x6yRr2pGwU0PFtSpdtoOuEri6GPmn5I+5YlvtKKXTHeD/FPbCzJ9PqYqmhC0QbO/","__version":"0"}'
  assert.equal(extractUserToken(raw), 'x6yRr2pGwU0PFtSpdtoOuEri6GPmn5I+5YlvtKKXTHeD/FPbCzJ9PqYqmhC0QbO/')
})

test('extractUserToken handles the JSON-escaped value form', () => {
  const buf = Buffer.from('userToken":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.xYZ1234567890abcdefghijklmnopqrstuvwxyz"', 'latin1')
  assert.equal(extractUserToken(buf), 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.xYZ1234567890abcdefghijklmnopqrstuvwxyz')
})

test('extractUserToken returns null without the key marker', () => {
  assert.equal(extractUserToken(Buffer.from('platform.deepseek.com no token here', 'latin1')), null)
})

test('extractUserToken rejects tokens shorter than 24 chars', () => {
  assert.equal(extractUserToken(Buffer.from('userToken"short-token"', 'latin1')), null)
})

test('upsertCredential replaces an existing line', () => {
  const out = upsertCredential('DEEPSEEK_API_KEY: sk-a\nDEEPSEEK_PLATFORM_TOKEN: old-value\n', 'DEEPSEEK_PLATFORM_TOKEN', 'new-value')
  assert.equal(out, 'DEEPSEEK_API_KEY: sk-a\nDEEPSEEK_PLATFORM_TOKEN: new-value\n')
})

test('upsertCredential appends when absent, preserving comments', () => {
  const out = upsertCredential('# my credentials\nDEEPSEEK_API_KEY: sk-a\n', 'DEEPSEEK_PLATFORM_TOKEN', 'tk-123')
  assert.equal(out, '# my credentials\nDEEPSEEK_API_KEY: sk-a\nDEEPSEEK_PLATFORM_TOKEN: tk-123\n')
})

test('upsertCredential works on an empty file', () => {
  assert.equal(upsertCredential('', 'DEEPSEEK_PLATFORM_TOKEN', 'tk-1'), 'DEEPSEEK_PLATFORM_TOKEN: tk-1\n')
})
