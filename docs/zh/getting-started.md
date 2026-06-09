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

## 常用下一步

```bash
autob config show
autob run your-sop.txt -o out --interactive
autob review out/04-requirements.json -o out --interactive
```
