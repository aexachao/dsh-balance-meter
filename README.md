<div align="center">
  <img src="assets/readme/hero.svg" width="100%" alt="dsh-balance-tracker: 顶部余额胶囊与展开卡片示意" />
</div>

**dsh-balance-tracker** 是一个 [DeepSeek Harness](https://github.com/deepseek-ai/dsh)（`dsh`）插件：在会话头部**实时显示 DeepSeek 账户余额与今日花费**，按金额设置提醒阈值，一键跳转充值。由 [ai-suifeng/dsh-budget-meter](https://github.com/ai-suifeng/dsh-budget-meter) fork 而来（MIT，见[下方声明](#-开源与许可)）。

## 特性

- **真实余额**：host 端读取 `~/.dsh/.credentials.yaml` 的 `DEEPSEEK_API_KEY`，调用 DeepSeek 官方余额接口；胶囊显示总余额，展开卡片查看赠送 / 充值分项
- **官方消费统计**：配置 `DEEPSEEK_PLATFORM_TOKEN` 后，从平台用量接口拉取**今日消费与累计消费**（与官网用量页同源）；未配置时以余额差值估算（前缀 `≈`）
- **用量追踪**：按 DeepSeek 官方峰谷定价把会话 token 消耗折算成人民币，展示今日 tokens 分项与按模型花费
- **高峰 / 空闲标签**：胶囊与卡片显示当前时段（默认北京 09:00–12:00、14:00–18:00 为高峰），带状态圆点；卡片设置区同步展示当前高峰时段（其余时间即为空闲）
- **按金额提醒**：今日花费达到阈值（元）弹 toast；可开启「达到阈值自动停止当前回合」
- **充值快捷跳转**：卡片「去充值」在系统浏览器打开 DeepSeek 充值页
- **设计一致**：胶囊采用 Harness `secondaryButton` 设计规范，与 session log 按钮同排同款
- 中 / 英双语；74 个单元测试

## 工作原理

```
浏览器端胶囊 ──GET /budget/balance──▶ host 插件
                                        │
                                        ├─ DEEPSEEK_API_KEY ──▶ api.deepseek.com/user/balance（真实余额）
                                        │
                                        └─ DEEPSEEK_PLATFORM_TOKEN ──▶ platform.deepseek.com/api/v0/usage/cost
                                           （官方今日/累计消费，当月缓存；token 过期不阻塞余额展示）
```

- **余额**：仅允许本机回环访问；API key 只在 host 进程内使用，绝不下发到浏览器
- **消费**：官方源优先；无 platform token 时按「当天零点余额 − 当前余额」估算，持久化于 `~/.dsh/storages/`
- **用量**：client 订阅当前会话快照，按 `sessionId:messageId|seq` 去重计费并持久化到 localStorage——重开会话、重启应用不重复计费；统计固定按自然日

## 快速开始

### 1. 安装到 profile

在 `~/.dsh/profiles/web/package.json` 中加入并安装（或使用 `dsh plugin --profile web add <path>`）：

```jsonc
{
  "dependencies": {
    "dsh-balance-tracker": "link:/绝对路径/dsh-balance-tracker"
    // ...其它依赖
  },
  "dsh": {
    "profile": {
      "bundles": [ /* ...其它 bundle */, "dsh-balance-tracker" ]
    }
  }
}
```

```sh
cd ~/.dsh/profiles/web && pnpm install
```

### 2. 配置凭证

在 `~/.dsh/.credentials.yaml` 中：

```yaml
DEEPSEEK_API_KEY: sk-xxx            # 必需：余额查询
DEEPSEEK_PLATFORM_TOKEN: xxx        # 可选：官方累计/今日消费
```

`DEEPSEEK_PLATFORM_TOKEN`（platform.deepseek.com 登录态的 `userToken`）两种获取方式：

**自动探测（推荐）**——登录 platform.deepseek.com 后，运行：

```sh
pnpm read-token     # 扫描本机 Chrome / Edge / Brave / Arc 等的 Local Storage，
                    # 提取 userToken 并写入凭证文件（不打印、不上传）
```

**手动**——浏览器开发者工具 → Application → Local Storage → 复制 `userToken` 值。

不配置时「今日已花费」为余额差值估算（≈），「累计（含往期）」隐藏。

### 3. 生效

重启 profile / 应用，浏览器 **Cmd+Shift+R** 强刷。顶部 session log 按钮左侧出现余额胶囊。

## 配置

默认值可通过 profile patch 的插件 `config` 覆盖；卡片设置区可再覆盖并持久化到 localStorage：

```yaml
warnYuan: 20          # 今日花费提醒阈值（元），达到即弹 toast
stopOnOver: true      # 达到阈值时自动取消当前回合（每周期一次）
peakWindows: '09:00-12:00,14:00-18:00'   # 高峰窗口，北京时间，逗号分隔 HH:MM-HH:MM
pricingTimezone: Asia/Shanghai
```

## 开发

```sh
pnpm install
pnpm typecheck   # 双 program（host + client）
pnpm build       # tsc host → tsc client → tsdown
pnpm test        # 构建后跑 node --test（74 用例：端点契约 / platform 聚合 / pricing / usage / ledger / client bundle）
```

## 边界与限制

- 余额与消费统计为 **DeepSeek 账户官方数据**；「今日 tokens」「按模型」为**本客户端打开过的会话**消耗（框架无跨会话聚合面）
- 无 platform token 时「今日已花费」为余额差值估算，不反映官网账单精确值；token 过期需重新登录复制
- 历史回放节点不带模型身份时按 flash 价计（宁晚提醒不早报）；中断未 finalize 的请求不计费（保守少计）
- 余额接口偶发限流/超时由 10 秒超时 + 每 60 秒轮询自然恢复

## 开源与许可

本项目为 [ai-suifeng/dsh-budget-meter](https://github.com/ai-suifeng/dsh-budget-meter) 的自维护 fork，基于上游 **MIT License** 修改：

- 上游版权与许可声明见仓库 [LICENSE](LICENSE)（`Copyright (c) 2026 ai-suifeng`），fork 修改保留该声明
- fork 在保留原版「用量追踪」功能（高峰/空闲、tokens 统计、按金额阈值提醒、超额自动停止）的基础上，新增真实余额、官方消费统计与充值跳转
- 修改部分同样以 MIT 许可发布；再次分发时请保留上游版权与许可文本
