---
layout: default
title: LLM 与研究产物
lang: zh-CN
---

# LLM 与研究产物

本页说明 AutoBiology 什么时候会调用 LLM、哪些能力由确定性算法负责，以及 GitHub 仓库中的研究产物如何使用。

## 如何确认 LLM 是否开启

运行：

```bash
autob config show
```

只有以下字段都已配置时，LLM 推理才会运行：

- `apiKey`：显示为脱敏值，而不是 `unset`
- `baseUrl`：不是 `unset`
- `model`：不是 `unset`

流水线运行后，可以继续检查：

- `run-meta.json`：`config.llmModel` 是实际模型名；如果没有创建 LLM client，则是 `not-configured`。
- `06-clarifications.json`：如果 LLM 未启用或调用失败，会出现包含 `LLM 辅助层未启用` 的澄清项。
- `04-requirements.json`：LLM 新增的需求会带有 `inferenceRule: "LLM-Candidate"` 和 `status: "candidate"`。

可直接复制的检查命令：

```bash
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('out/run-meta.json','utf8')); console.log(m.config.llmModel)"
rg -n '"LLM-Candidate"' out/04-requirements.json
rg -n 'LLM 辅助层未启用' out/06-clarifications.json
```

## 默认行为

默认情况下，AutoBiology 不会自动调用 LLM。只有 JSON 配置能解析出完整的 OpenAI-compatible client 时，Stage 4 才会调用 LLM。

没有 LLM 配置时，确定性流水线仍会完整运行。使用 `autob init` 可以写入全局配置 `~/.autob/config.json`。项目级 `.autob.json` 可以覆盖 `baseUrl`、`model`、`timeoutMs` 等非敏感字段，但不能包含 `apiKey`。

## 算法引擎和 LLM 的边界

确定性算法引擎负责：

- SOP 归一化和操作原子化
- 字段抽取、别名归一化和知识库补充
- 操作超图构建
- 基于超图证据生成 R1-R10 需求
- 基于 fingerprint 的去重
- 覆盖率矩阵、警告、Mermaid 图和报告

LLM 只负责可选的 Stage 4 辅助：

- 基于已有需求表提出隐含候选需求
- 将候选描述改写为简洁的工程需求句
- 在加入候选前判断是否可能与已有需求语义重复

LLM 输出有来源边界。候选需求必须引用 source hyperedge，默认保持 `candidate` 状态，不会覆盖确定性生成的 `confirmed` 需求。LLM 失败时，AutoBiology 会保留确定性结果并记录澄清项。

## GitHub 仓库产物

GitHub 仓库包含两个生成产物目录：

- `publication/`：论文方法说明、复现说明、样例输出、Mermaid 图和 draw.io 兼容算法图。
- `graphify-out/`：代码知识图谱、架构报告和可交互 HTML 图谱。

这些目录主要用于源码审阅、论文写作和复现说明。npm 包重点包含 CLI 运行时、使用文档和内置 `data/` 知识库。

## 常用命令

```bash
autob config show
autob run your-sop.txt -o out
autob infer out/04-requirements.json -o out
```

优先打开 `out/report.md` 查看可读摘要；如果要确认 LLM 情况，再检查 `out/04-requirements.json`、`out/06-clarifications.json` 和 `out/run-meta.json`。
