# AutoBiology CLI 自动更新机制设计规格

## 1. 背景

AutoBiology CLI 已发布至 npm（包名 `autobiology-cli`），但缺少版本更新提醒机制。用户无法感知新版本的存在，知识库和 prompt 模板的改进也无法及时到达用户。

## 2. 设计决策

- **分发策略：** 知识库（JSON）和 prompt 模板（Markdown）全部打包在 npm 包内，随 CLI 版本一起发布，通过 `npm update` 统一升级。不引入独立的数据分发渠道。
- **检查时机：** 每次运行 `autob` 时后台异步检查 npm registry，有新版则在管道输出末尾提示，不阻塞正常执行。
- **检查频率：** 每次运行都触发检查，但使用 24h 本地缓存避免重复网络请求。
- **依赖：** 零新依赖，使用 Node.js 内置 `fetch`（Node 18+）。

## 3. 版本检查模块

### 3.1 新增 `src/update-checker.ts`

**接口：**

```typescript
interface UpdateCheckResult {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  fromCache: boolean;
}

interface UpdateCheckCache {
  latestVersion: string;
  lastChecked: string; // ISO 8601
}
```

**核心函数：**

- `checkForUpdate(): Promise<UpdateCheckResult | undefined>` — 非阻塞检查，网络失败返回 `undefined`
- `printUpdateNotice(checkPromise: Promise<UpdateCheckResult | undefined>): Promise<void>` — await 检查结果，有更新则输出提示框
- `runSelfUpdate(): Promise<void>` — 执行 `npm install -g autobiology-cli@latest`

### 3.2 检查流程

1. 读取 `~/.autob/update-check.json`
2. 若 `lastChecked` 在 24h 内 → 使用缓存的 `latestVersion`，标记 `fromCache: true`
3. 否则 → `fetch('https://registry.npmjs.org/autobiology-cli/latest', { signal: AbortSignal.timeout(3000) })`
4. 从响应 JSON 提取 `version` 字段
5. 写入 `~/.autob/update-check.json` 更新缓存
6. semver 比较：`latestVersion > currentVersion` → `updateAvailable = true`

### 3.3 缓存文件

位置：`~/.autob/update-check.json`

```jsonc
{
  "latestVersion": "0.2.0",
  "lastChecked": "2026-06-12T14:00:00Z"
}
```

缓存 TTL：24 小时。缓存文件不存在或格式错误时视为过期，重新检查。

### 3.4 提示输出

在管道执行完成后输出（不阻塞管道本身）：

```
╭────────────────────────────────────────────╮
│  AutoBiology 新版本可用: 0.1.5 → 0.2.0    │
│  运行 npm install -g autobiology-cli 升级  │
╰────────────────────────────────────────────╯
```

### 3.5 错误处理

- 网络超时（3s）：静默忽略，不输出任何内容
- fetch 失败（DNS/连接错误）：静默忽略
- 缓存文件读写失败：静默忽略，每次重新检查
- semver 解析失败：静默忽略
- 无网络环境下工具完全正常工作

## 4. CLI 集成

### 4.1 主入口注入

```typescript
// src/cli.ts 末尾
if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  const checkPromise = checkForUpdate();
  await createProgram().parseAsync(process.argv);
  await printUpdateNotice(checkPromise);
}
```

检查在管道启动时并发发起，管道完成后 await 结果并输出。

### 4.2 新增 `autob update` 子命令

```bash
autob update          # 检查并安装最新版本
autob update --check  # 仅检查，不安装
```

行为：
- 先调用 `checkForUpdate()`（强制跳过缓存）
- 显示 `当前版本: 0.1.5 → 最新版本: 0.2.0`
- 若有更新且无 `--check`，执行 `npm install -g autobiology-cli@latest`（通过 `child_process.execFile`）
- 若已是最新，输出 `✓ 已是最新版本 (0.1.5)`

## 5. 文件变更

### 5.1 新增文件

| 文件 | 用途 |
|------|------|
| `src/update-checker.ts` | 版本检查、缓存、提示渲染、自更新执行 |
| `tests/update-checker.test.ts` | 检查/缓存/失败/semver 测试 |

### 5.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/cli.ts` | 主入口注入 checkForUpdate + 添加 update 子命令 |
| `tests/cli.test.ts` | 验证 update 命令注册 |

## 6. 测试

`tests/update-checker.test.ts`：
- mock `fetch` 测试正常检查流程（返回更高版本号）
- 测试 24h 缓存命中（不发起 fetch）
- 测试缓存过期（重新 fetch）
- 测试网络失败静默处理（返回 undefined）
- 测试 semver 比较（patch/minor/major/相等/低于）
- 测试缓存文件读写（使用临时目录）
- 测试提示框渲染（有更新/无更新/检查失败三种情况）
- 测试 `runSelfUpdate` 调用 npm install

`tests/cli.test.ts` 更新：
- 验证 `update` 命令已注册
- 验证 `update --check` 不触发安装
