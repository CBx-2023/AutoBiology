---
layout: default
title: 命令参考
lang: zh-CN
---

# 命令参考

所有命令都使用 `autob` 可执行文件。

## `autob init`

创建或更新 `~/.autob/config.json`。

它会提示输入 provider、API key、必要时的 base URL、模型、超时时间和是否进行连通性检查。

退出码：成功时为 `0`；输入无效、文件写入失败或运行时异常时为非零。

## `autob config show`

显示全局配置和项目配置合并后的结果，并标注字段来源。API key 会被脱敏。

这个命令也可以用来确认 LLM 推理是否可运行。合并后的 `apiKey`、`baseUrl` 和 `model` 必须都已设置。

退出码：成功时为 `0`；JSON 无效或配置校验失败时为非零。

## `autob update [--check]`

检查或安装最新发布的 `autobiology-cli` 包。

选项：

- `--check`：只检查 npm 上是否有新版本，并打印更新提示，不执行安装。

不带 `--check` 时，该命令会通过 npm 执行 `npm install -g autobiology-cli@latest`，不会使用 shell 拼接命令。

AutoBiology 也会在普通 CLI 启动前后自动检查更新，并把结果缓存 24 小时到 `~/.autob/update-check.json`。在 CI 或离线环境中可以设置 `AUTOB_DISABLE_UPDATE_CHECK=1` 跳过自动检查。

## `autob run <sop-file> -o <output-dir>`

按顺序执行 atomize、hypergraph、requirements、infer 和 review。

选项：

- `-o, --output <dir>`：必填，输出目录。
- `--interactive`：在 TTY 环境中启用候选需求交互审阅。

退出码：成功时为 `0`；输入文件不可读、JSON 产物无效、输出写入失败或运行时异常时为非零。

## `autob atomize <sop-file> -o <output-dir>`

把 SOP 文本解析成 `01-ops.json`。

## `autob hypergraph <op-table> -o <output-dir>`

把 `01-ops.json` 转换成 `02-nodes.json` 和 `03-hyperedges.json`。

## `autob requirements <nodes-file> <hyperedges-file> -o <output-dir>`

把确定性需求生成到 `04-requirements.json`。

## `autob infer <requirements-file> -o <output-dir>`

当 JSON 配置完整时，添加 LLM-assisted candidate requirements。没有 LLM 配置时，该命令会记录 clarification 并保留已有需求。

## `autob review <requirements-file> -o <output-dir>`

生成覆盖率文件、报告、图表，并可选进行候选需求审阅。

选项：

- `-o, --output <dir>`：必填，输出目录。
- `--interactive`：在 TTY 环境中提示用户逐条处理候选需求。

## 帮助

```bash
autob --help
autob <command> --help
```
