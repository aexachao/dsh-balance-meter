#!/usr/bin/env node
/**
 * 自动探测 DeepSeek 平台登录态（userToken），写入 `~/.dsh/.credentials.yaml`。
 *
 * platform.deepseek.com 的登录态只存在于浏览器（Local Storage 键
 * `userToken`，值形如 `{"value":"<token>","__version":"0"}`），没有官方
 * 获取渠道。本脚本按优先级探测：
 *
 * 1. **AppleScript 桥接（推荐）**：Chrome 开着且已开启「允许 Apple 事件中的
 *    JavaScript」时，自动导航到 platform.deepseek.com 并读取 userToken ——
 *    登录态在浏览器内存中，文件扫描拿不到，这是唯一可靠的方式；
 * 2. **LevelDB 文件扫描（回退）**：扫描常见浏览器 Local Storage 的
 *    leveldb 文件（登录态已刷盘时才可能命中）。
 *
 * 安全边界：只读取 platform.deepseek.com 命名空间下的 userToken 条目，
 * token 只写入本机凭证文件，不打印、不上传。
 */

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, renameSync, mkdirSync, chmodSync, readdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, basename, dirname } from 'node:path'

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
const PLATFORM_URL = 'https://platform.deepseek.com'
const SITE_MARKER = 'platform.deepseek.com'
const KEY_MARKER = 'userToken'

/**
 * 从浏览器存储片段中提取 userToken。
 * 实际格式为 JSON 包裹：`{"value":"<token>","__version":"0"}`；
 * 兼容裸引号形式：`userToken\x00\x01"<token>"`。
 */
export function extractUserToken(text) {
  // 优先 JSON 格式：{"value":"..."}
  const json = /"value"\s*:\s*"([A-Za-z0-9._~+/=]{24,})"/.exec(text)
  if (json) return json[1]
  const keyIdx = text.indexOf(KEY_MARKER)
  if (keyIdx === -1) return null
  const after = text.slice(keyIdx + KEY_MARKER.length, keyIdx + KEY_MARKER.length + 4096)
  const m = /"([A-Za-z0-9._~-]{24,})"/.exec(after)
  return m ? m[1] : null
}

/** 通过 AppleScript 从打开的 Chrome 读取 userToken；浏览器不可用返回 null。 */
export function readFromChrome() {
  try {
    const navigate = execFileSync('osascript', ['-e', `
      tell application "Google Chrome"
        if (count of windows) is 0 then error "no window"
        set URL of active tab of front window to "${PLATFORM_URL}"
      end tell
    `], { encoding: 'utf8', timeout: 10_000 })
    // 等页面加载（SPA 路由 + localStorage 就绪）
    let raw = ''
    for (let i = 0; i < 10; i++) {
      raw = execFileSync('osascript', ['-e', `
        tell application "Google Chrome"
          execute active tab of front window javascript "localStorage.getItem('userToken')"
        end tell
      `], { encoding: 'utf8', timeout: 10_000 }).trim()
      if (raw !== 'null' && raw !== '') break
      // 页面可能还在跳转（platform.deepseek.com 登录中转）
      setTimeout(() => {}, 1500)
    }
    if (raw === 'null' || raw === '') return null
    return { token: extractUserToken(raw) ?? raw.trim().replace(/^"|"$/g, ''), source: 'Chrome (AppleScript)' }
  } catch {
    return null
  }
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

/** 扫描浏览器 LevelDB 文件（回退路径），返回第一个命中的 token。 */
export function scanLevelDb() {
  for (const browser of BROWSERS) {
    for (const dir of leveldbDirs(browser.lsRoot)) {
      let files
      try { files = readdirSync(dir) } catch { continue }
      for (const file of files) {
        if (!file.endsWith('.log') && !file.endsWith('.ldb')) continue
        let buffer
        try { buffer = readFileSync(join(dir, file)) } catch { continue }
        const text = buffer.toString('latin1')
        if (text.indexOf(SITE_MARKER) === -1 || text.indexOf(KEY_MARKER) === -1) continue
        const token = extractUserToken(text)
        if (token !== null) return { token, source: `${browser.name}/leveldb/${file}` }
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
  console.log('探测 DeepSeek 平台登录态…')
  const found = readFromChrome() ?? scanLevelDb()
  if (found === null || found.token === null || found.token === '') {
    console.log('✗ 未找到 userToken。请确认：')
    console.log('  1. 已登录 https://platform.deepseek.com（本机任意浏览器）；')
    console.log('  2. Chrome 处于打开状态，且已开启「查看 → 开发者 → 允许 Apple 事件中的 JavaScript」；')
    console.log('  3. 或手动配置：浏览器开发者工具 → Application → Local Storage → 复制 userToken 值。')
    process.exit(1)
  }
  let text = ''
  try { text = readFileSync(CREDENTIALS_PATH, 'utf8') } catch { text = '' }
  const next = upsertCredential(text, TOKEN_KEY, found.token)
  try {
    mkdirSync(dirname(CREDENTIALS_PATH), { recursive: true })
    const tmp = `${CREDENTIALS_PATH}.tmp`
    // 凭证文件必须是 owner-only（600），否则 dsh 安全校验拒绝启动。
    writeFileSync(tmp, next, { encoding: 'utf8', mode: 0o600 })
    renameSync(tmp, CREDENTIALS_PATH)
    chmodSync(CREDENTIALS_PATH, 0o600)
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
