# ds-budget-meter

DeepSeek Harness（`dsh`）的 **真实余额监控插件**：从 host 的
`/budget/balance` 端点读取 DeepSeek 官方账户余额（而非按 token 估算），
在界面右下角显示悬浮余额胶囊；点击展开卡片查看余额构成与刷新。

![capsule](docs/screenshot-capsule.png)

![card](docs/screenshot-card.png)

## 功能

- **右下角悬浮胶囊**：状态点 + `余额 ¥xx.xx`，绿色（正常）/ 黄色（无余额数据）/
  红色（查询失败）三态；
- **展开卡片**：总余额、赠送余额、充值余额分项 + 币种 + 手动刷新按钮；
- **真实数据源**：host 端带 API key 调用 DeepSeek 官方
  `GET https://api.deepseek.com/user/balance`，与官网 / 开发后台看到的余额一致；
- **自动刷新**：首次挂载即查询，之后每 60 秒自动刷新（不占用额外配置）；
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

默认值（可通过 profile patch 的插件 `config` 覆盖）：

```yaml
refreshSeconds: 0    # 预留：后续版本支持自定义自动刷新间隔（秒）；
                     # 当前版本固定首次挂载 + 每 60 秒自动刷新
```

## 工作原理

- **数据源**：client 胶囊向 host 的 `GET /budget/balance` 发起请求；host 读取
  `~/.dsh/.credentials.yaml` 中的 `DEEPSEEK_API_KEY`，以
  `Authorization: Bearer <key>` 调用 DeepSeek 官方余额接口（10 秒超时），
  把响应里的 `balance_infos`（snake_case）映射为胶囊可用的 camelCase 结构；
- **安全**：余额路由用 `webServer.register` 注册为 exact 路径；非回环地址一律
  403；API key 不经过任何前端代码；错误信息不包含 key；
- **状态机**：`ok + 有余额` → 绿点；`ok + 无余额` → 黄点（卡片显示「暂无余额数据」）；
  `请求失败` → 红点（胶囊保持上一次值，卡片显示错误详情）；
- **client 注入**：`slots` + `locale` 两个服务；胶囊注册进布局的
  `shell.overlay` 列表槽位；卸载时随 effect 自动回收。

## 开发

```sh
pnpm typecheck   # 双 program（host + client）
pnpm build       # tsc host → tsc client → tsdown
pnpm verify      # 离线冒烟：key 解析 / 回环门禁 / 响应映射 / bundle 执行
```

## 边界与限制

- 展示的是 **DeepSeek 账户余额**（总 / 赠送 / 充值），不是会话消耗；
- 自动刷新间隔当前固定 60 秒，`refreshSeconds` 为预留配置项；
- 未配置 `DEEPSEEK_API_KEY`（`~/.dsh/.credentials.yaml`）时胶囊显示查询失败态，
  卡片给出缺失提示；
- 余额接口偶发限流/超时由 10 秒超时 + 下次轮询自然恢复，不打断使用。

## 许可

内部工具，按需自用。
