# ds-budget-meter

DeepSeek Harness（`dsh`）的 **余额监控 + 用量追踪插件**（原版预算追踪插件的
自维护 fork 改造）：

- **真实余额**：host 端调用 DeepSeek 官方余额接口，右下角悬浮胶囊主显
  `余额 ¥xx.xx`，展开卡片查看总余额 / 赠送 / 充值分项，附**充值快捷跳转**
  （一键打开 DeepSeek 充值页）；
- **用量追踪**（保留原版）：按官方峰谷定价把会话 token 消耗折算成人民币，
  统计**今日花费与累计**、本日 token 分项、按模型花费；
- **高峰 / 空闲标签**（保留原版）：胶囊与卡片显示当前时段（默认北京
  09:00–12:00、14:00–18:00 为高峰）；
- **按金额的花费提醒**：今日花费达到设置阈值（元）时弹 8 秒 toast；
  开启「达到阈值自动停止回合」后同时取消当前回合（每周期一次）。

![capsule](docs/screenshot-capsule.png)

![card](docs/screenshot-card.png)

## 功能

- **右下角悬浮胶囊**：高峰/空闲时段标签 + `余额 ¥xx.xx`，查询中显示加载
  旋转；点击展开卡片；
- **展开卡片**：余额分项（总余额大字 / 赠送 / 充值）+ 充值跳转、今日已花费
  与累计（含往期）、今日 tokens（输入缓存命中/未命中、输出）、按模型花费、
  设置区（花费提醒阈值（元）、达到阈值自动停止回合、重置今日）；
- **真实数据源**：host 端带 API key 调用 DeepSeek 官方
  `GET https://api.deepseek.com/user/balance`，与官网 / 开发后台看到的余额一致；
- **余额自动刷新**：首次挂载即查询，之后每 60 秒自动刷新；
- **用量按官方峰谷定价**（元/百万 tokens，与
  [DeepSeek 价目表](https://api-docs.deepseek.com/zh-cn/quick_start/pricing) 一致）：
  flash 输入 1.5/3.0、输出 4.5/9.0；pro 输入 4.5/9.0、输出 13.5/27.0
  （闲/峰；缓存命中另按低费率）；模型按请求自动识别 flash / pro 档；
- **安全边界**：余额端点仅接受本机回环地址访问（防局域网探取），
  API key 只在 host 进程内使用、绝不下发到浏览器；
- 中 / 英双语。

## 环境要求

- DeepSeek Harness **0.1.0-rc.6** 版本通道（`dsh` CLI 与运行时同通道）；
- Node.js ≥ 22、pnpm。

## 安装

### 方式一：npm 注册表按名字安装（推荐）

包发布到 npm 后（见下文「发布」），与 dsh-context 等插件同款一行安装：

```sh
dsh plugin --profile web add ds-budget-meter           # latest
dsh plugin --profile web add ds-budget-meter@0.1.0     # 指定版本
```

然后**重启** profile / 应用，浏览器 **Cmd+Shift+R 强刷**。

### 方式二：GitHub tag tarball 一行安装

`lib/` 构建产物随仓库提交，因此可以像 dsh-at-file 一样直接装 tag 归档（无需 clone / 构建）：

```sh
dsh plugin --profile web add \
  https://github.com/ai-suifeng/dsh-budget-meter/archive/refs/tags/v0.1.0.tar.gz
```

同样重启 + 强刷生效。

### 方式三：源码安装（开发时）

#### 1. 克隆并构建

```sh
git clone git@github.com:ai-suifeng/dsh-budget-meter.git
cd dsh-budget-meter
pnpm install
pnpm build        # 产出 lib/index.js（host）+ lib/client.js（client bundle）
```

#### 2. 安装到 profile

桌面应用默认 profile 为 `web`；`DSH_HOME` 默认为 `~/.dsh`
（桌面应用为 `~/Library/Application Support/deepseek-harness-desktop/harness-home`）。

```sh
# 标准方法（dsh CLI 与运行时须同版本通道 rc.6；pnpm 需在 PATH）
dsh plugin --profile web add "$(pwd)"
```

> **已知问题（重要）**：rc.6 的 `dsh plugin add` 在重写 profile manifest 时可能把
> 其它已有的 `link:` 插件从 `dependencies` / `dsh.profile.bundles` 中移除。
> 若发生，手工编辑 `~/.dsh/profiles/web/package.json` 补回后在 profile 目录执行
> `pnpm install` 即可（见下文「手工安装」）。

#### 3. 手工安装（不用 CLI 时的等价做法）

在 `~/.dsh/profiles/web/package.json` 中加入：

```jsonc
{
  "dependencies": {
    "ds-budget-meter": "link:/绝对路径/dsh-budget-meter"
    // ...其它依赖
  },
  "dsh": {
    "profile": {
      "bundles": [
        "@deepseek-ai/dsh-base",
        "@deepseek-ai/dsh-web-app",
        // ...其它 bundle
        "ds-budget-meter"
      ]
    }
  }
}
```

然后 `cd ~/.dsh/profiles/web && pnpm install`。

#### 4. 生效

- **重启** profile / 应用（host 组合树只在启动时加载）；
- 浏览器 **Cmd+Shift+R** 强刷页面（client 名册在页面加载时注入；已打开的旧页面
  不会自动拿到新 bundle）。

## 发布（维护者）

```sh
NPM_TOKEN=<npmjs token> ./scripts/publish.sh          # 已发布过则自动 bump patch
NPM_TOKEN=<token> ./scripts/publish.sh minor          # 强制 bump 类型
NPM_OTP=<6位码> NPM_TOKEN=<token> ./scripts/publish.sh  # 2FA 账号
```

脚本流程：构建 `lib/` → 版本已在注册表则自动 bump → `npm publish --access public`
→ `npm view` 验证上线。token 只从环境变量读取，不落盘。

发布后记得打 tag（方式二的 tarball 安装依赖 tag 归档）：

```sh
git add -A && git commit -m "release: v$(node -p "require('./package.json').version")"
git tag "v$(node -p "require('./package.json').version")"
git push && git push --tags
```

## 配置

默认值（可通过 profile patch 的插件 `config` 覆盖；卡片设置区可再覆盖并
持久化到 localStorage）：

```yaml
warnYuan: 20          # 今日花费提醒阈值（元），达到即弹 toast
stopOnOver: true      # 达到阈值时自动取消当前回合（每周期一次）
peakWindows: '09:00-12:00,14:00-18:00'   # 高峰窗口，北京时间，逗号分隔 HH:MM-HH:MM
pricingTimezone: Asia/Shanghai
```

## 工作原理

- **余额数据源**：client 胶囊向 host 的 `GET /budget/balance` 发起请求；host 读取
  `~/.dsh/.credentials.yaml` 中的 `DEEPSEEK_API_KEY`，以
  `Authorization: Bearer <key>` 调用 DeepSeek 官方余额接口（10 秒超时），
  把响应里的 `balance_infos`（snake_case）映射为胶囊可用的 camelCase 结构；
- **安全**：余额路由用 `webServer.register` 注册为 exact 路径；非回环地址一律
  403；API key 不经过任何前端代码；错误信息不包含 key；
- **用量数据源**：client 订阅当前会话的 conversation 快照，对每条 finalized
  assistant 消息的 `usage` 计费（wire 形状
  `{ inputTokens, outputTokens, cacheReadTokens, reasoningTokens }`，OpenAI 式
  形状作 fallback），按模型名与当前峰谷时段查价，账本按
  `sessionId:messageId|seq` 去重并持久化 localStorage——重开会话、重启应用
  不重复计费；统计固定按天（自然日零点归零），累计（含往期）始终可见；
- **提醒与停止**：今日花费 ≥ `warnYuan` 时弹 8 秒 toast（每周期一次）；
  `stopOnOver` 开启时同时取消当前回合，防止继续消耗；
- **充值跳转**：卡片「去充值」按钮为外链
  （`https://platform.deepseek.com/top_up`），由桌面端桥接在系统浏览器打开；
- **client 注入**：`slots` + `sessions` + `locale` 三个服务；胶囊注册进布局的
  `shell.overlay` 列表槽位（右下角固定）；卸载时随 effect 自动回收。

## 开发

```sh
pnpm typecheck   # 双 program（host + client）
pnpm build       # tsc host → tsc client → tsdown
pnpm test        # 构建后跑 node --test 单元测试（host 端点 / pricing / usage / ledger / client bundle）
```

## 边界与限制

- 余额展示的是 **DeepSeek 账户余额**（总 / 赠送 / 充值）；花费统计为**本客户端
  打开 / staged 过的会话**消耗（框架无跨会话 usage 聚合面），账本持久化保证
  打开过的会话不重不漏、重启不丢；
- 历史回放节点不带模型身份时按 flash 价计（宁晚提醒不早报）；中断未 finalize
  的请求没有 usage，不计费（保守少计）；缓存命中数缺失时按 0 命中、全部输入
  走未命中价（保守高估）；
- 未配置 `DEEPSEEK_API_KEY`（`~/.dsh/.credentials.yaml`）时胶囊显示查询失败态，
  卡片给出缺失提示；
- 余额接口偶发限流/超时由 10 秒超时 + 每 60 秒轮询自然恢复，不打断使用；
- 文本按 UTF-8 计费统计，与账单的微小舍入差异属正常。

## 许可

内部工具，按需自用。
