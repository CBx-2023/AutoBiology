---
layout: default
title: 快速开始
lang: zh-CN
---

# 快速开始

这份指南帮助你在几分钟内完成安装、配置和第一次 SOP 解析。

## 安装 CLI

如果你只是使用命令行工具，直接全局安装：

```bash
npm install -g autobiology-cli
autob --help
autob update --check
```

如果你在本仓库源码中开发：

```bash
npm install
npm run build
npm link
```

源码调试时也可以使用：

```bash
npx tsx src/cli.ts --help
```

以后需要升级已安装的 CLI 时，运行 `autob update`。自动更新检查会缓存 24 小时；在 CI 或离线环境中可以设置 `AUTOB_DISABLE_UPDATE_CHECK=1` 跳过自动检查。

## 初始化配置

运行配置向导：

```bash
autob init
```

向导会写入 `~/.autob/config.json`，并询问 LLM provider、API key、模型、超时时间和是否进行连通性检查。

> 没有配置 LLM 时，流水线仍然可以运行。AutoBiology 会使用确定性规则生成 R1-R10 需求，并记录一条 LLM fallback clarification。

## 运行第一条 SOP

```bash
autob run your-sop.txt -o out
```

输出目录会包含：

```text
01-ops.json
02-nodes.json
03-hyperedges.json
04-requirements.json
05-coverage.json
06-clarifications.json
diagrams/
report.md
run-meta.json
```

建议先看 `out/report.md`，再打开 `out/04-requirements.json` 查看结构化需求，或打开 `out/05-coverage.json` 查看覆盖率矩阵。

## 内置知识库的作用

npm 包内包含 `data/` 知识库，确定性流水线会直接使用它。它会归一化 PBS buffer、Falcon 管、生物安全柜、常见单位写法等 SOP 别名；补充动作默认工具、风险和输出状态；并根据领域动作模式生成缺失参数澄清。

这些能力不依赖 LLM。配置 LLM 后，LLM 只参与可选的候选需求推理。

如需确认 LLM 是否实际启用，先运行 `autob config show`，再在流水线运行后检查 `out/run-meta.json` 和 `out/06-clarifications.json`。详细说明见 [LLM 与研究产物](llm-and-artifacts.html)。

## 仓库参考产物

从 GitHub 仓库使用时，`publication/` 提供论文方法说明、复现步骤、样例输出、Mermaid 图和 draw.io 兼容算法图。`graphify-out/` 提供代码知识图谱和架构报告，便于审阅代码结构。

## 常用下一步

```bash
autob config show
autob update --check
autob run your-sop.txt -o out --interactive
autob review out/04-requirements.json -o out --interactive
```
