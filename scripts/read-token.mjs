#!/usr/bin/env node
/**
 * 自动探测 DeepSeek 平台登录态（userToken），写入 `~/.dsh/.credentials.yaml`。
 *
 * platform.deepseek.com 的登录态只存在于浏览器 Local Storage（明文 LevelDB），
 * 没有官方获取渠道。本脚本扫描本机常见浏览器的 Local Storage leveldb 文件，
 * 提取 `userToken` 并写入凭证文件，免去手动打开开发者工具复制。
 *
 * 安全边界：只在本机读取 `platform.deepseek.com` 命名空间下的 userToken 条目，
 * 不读取任何其他站点数据；token 只写入本机凭证文件，不打印、不上传。
 */

import { readFileSync, readdirSync, writeFileSync, renameSync, mkdirSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join, basename } from 'node:path'
import { existsSync } from 'node:fs'

/** 浏览器配置目录（macOS）→ 该浏览器 Local Storage 根目录。 */
const BROWSERS = [
  { name: 'Chrome', lsRoot: join('Library', 'Application Support', 'Google', 'Chrome') },
  { name: 'Chrome Canary', lsRoot: join('Library', 'Application Support', 'Google', 'Chrome Canary') },
  { name: 'Edge', lsRoot: join('Library', 'Application Support', 'Microsoft Edge') },
  { name: 'Brave', lsRoot: join('Library', 'Application Support', 'BraveSoftware', 'Brave-Browser') },
  { name: 'Arc', lsRoot: join('Library', 'Application Support', 'Arc', 'User Data') },
  { name: 'Chromium', lsRoot: join('Library', 'Application Support', 'Chromium') },
  { name: 'Vivaldi', lsRoot: join('Library', 'Application Support', 'Vivaldi') },
]

const CREDENTIALS_PATH = join(homedir(), '.dsh', '.credentials.yaml')
const TOKEN_KEY = 'DEEPSEEK_PLATFORM_TOKEN'
const SITE_MARKER = 'platform.deepseek.com'
const KEY_MARKER = 'userToken'

/** 从 LevelDB 日志/数据文件的二进制内容中提取 userToken 值；找不到返回 null。 */
export function extractUserToken(buffer) {
  const text = buffer.toString('latin1')
  const keyIdx = text.indexOf(KEY_MARKER)
  if (keyIdx === -1) return null
  // 值通常紧跟 key 名，形如 `userToken\x00\x01"<token>"` 或 `"<token>"`；
  // 向后扫描第一个双引号包裹的连续 token 字符。
  const after = text.slice(keyIdx + KEY_MARKER.length, keyIdx + KEY_MARKER.length + 4096)
  const m = /"([A-Za-z0-9._~-]{24,})"/.exec(after)
  return m ? m[1] : null
}

/** 一个浏览器安装的所有 profile Local Storage leveldb 目录。 */
function leveldbDirs(lsRoot) {
  const dirs = []
  const walk = (dir) => {
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue
      const full = join(dir, entry.name)
      if (entry.isDirectory() && entry.name === 'leveldb') dirs.push(full)
      else if (entry.isDirectory()) walk(full)
    }
  }
  walk(join(homedir(), lsRoot, 'Default', 'Local Storage'))
  walk(join(homedir(), lsRoot, 'Local Storage'))
  return dirs
}

/** 扫描全部浏览器，返回第一个命中的 token（及来源浏览器名）。 */
export function scanForPlatformToken() {
  for (const browser of BROWSERS) {
    for (const dir of leveldbDirs(browser.lsRoot)) {
      let files
      try { files = readdirSync(dir) } catch { continue }
      for (const file of files) {
        if (!file.endsWith('.log') && !file.endsWith('.ldb')) continue
        let buffer
        try { buffer = readFileSync(join(dir, file)) } catch { continue }
        if (buffer.indexOf(SITE_MARKER) === -1 || buffer.indexOf(KEY_MARKER) === -1) continue
        const token = extractUserToken(buffer)
        if (token !== null) return { token, source: `${browser.name}/${basename(dir)}/${file}` }
      }
    }
  }
  return null
}

/** 更新凭证文件中的 DEEPSEEK_PLATFORM_TOKEN 行（保留其它行与注释）。 */
export function upsertCredential(text, key, value) {
  const line = `${key}: ${value}`
  const re = new RegExp(`^${key}\\s*:.*$`, 'm')
  if (re.test(text)) return text.replace(re, line)
  const base = text.replace(/\n*$/, '')
  return base === '' ? `${line}\n` : `${base}\n${line}\n`
}

function main() {
  const found = scanForPlatformToken()
  if (found === null) {
    console.log('✗ 未在浏览器中找到 platform.deepseek.com 的 userToken。')
    console.log('  请先登录 https://platform.deepseek.com，然后重试；')
    console.log('  或手动配置：浏览器开发者工具 → Application → Local Storage → 复制 userToken 值。')
    process.exit(1)
  }
  let text = ''
  try { text = readFileSync(CREDENTIALS_PATH, 'utf8') } catch { text = '' }
  const next = upsertCredential(text, TOKEN_KEY, found.token)
  try {
    mkdirSync(join(homedir(), '.dsh'), { recursive: true })
    const tmp = `${CREDENTIALS_PATH}.tmp`
    writeFileSync(tmp, next, 'utf8')
    renameSync(tmp, CREDENTIALS_PATH)
  } catch (error) {
    console.error(`✗ 写入凭证文件失败: ${error.message}`)
    process.exit(1)
  }
  console.log(`✔ 已从 ${found.source} 探测到登录态，写入 ${CREDENTIALS_PATH}`)
  console.log('  重启 dsh 后，「今日已花费 / 累计（含往期）」将显示官方数据。')
}

// 直接执行时运行主流程（被测试 import 时不触发）。
if (process.argv[1] && basename(process.argv[1]) === 'read-token.mjs') {
  main()
}
