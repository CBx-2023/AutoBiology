---
layout: default
title: 流水线指南
lang: zh-CN
---

# 流水线指南

`autob run` 会按顺序执行五个阶段，并把中间产物写入输出目录。

确定性阶段会使用内置知识库。npm 包包含 `data/synonyms.json`、`data/domain-patterns.json`、`data/parameter-constraints.json` 和 `data/risk-catalog.json`；完整运行会加载一次，并在 atomize、hypergraph 和 requirements 阶段复用。

## 阶段 1：Atomize

```bash
autob atomize <sop-file> -o <output-dir>
```

输出：`01-ops.json`

这一阶段把 SOP 文本拆成操作记录，提取 action、inputs、target、tools、parameters、risks、human judgment 和 output state。

## 阶段 2：Hypergraph

```bash
autob hypergraph <output-dir>/01-ops.json -o <output-dir>
```

输出：`02-nodes.json`、`03-hyperedges.json`

这一阶段把操作字段规范化为可复用节点，并为每个 SOP 操作创建一个 operation hyperedge。

## 阶段 3：Requirements

```bash
autob requirements <output-dir>/02-nodes.json <output-dir>/03-hyperedges.json -o <output-dir>
```

输出：`04-requirements.json`

生成器会把超图证据映射成确定性的 R1-R10 需求，并按 fingerprint 去重。

## 阶段 4：Infer

```bash
autob infer <output-dir>/04-requirements.json -o <output-dir>
```

输出：更新后的 `04-requirements.json`

当 JSON 配置里有完整 LLM 设置时，这一阶段会调用 OpenAI-compatible provider 生成候选需求。没有配置时，它会保留确定性需求并记录 clarification。

## 阶段 5：Review

```bash
autob review <output-dir>/04-requirements.json -o <output-dir>
```

输出：`05-coverage.json`、`report.md`、`diagrams/*.mmd`

Review 阶段会生成覆盖率矩阵、验证警告、图表和可选的候选需求交互审阅。在完整 `autob run` 中，流水线也会在 review 前写出 `06-clarifications.json`。

## 调试建议

- 某个输出缺失时，直接从上一个阶段产物重新运行对应阶段命令。
- LLM 候选需求缺失时，运行 `autob config show`，确认 `apiKey`、`baseUrl` 和 `model` 都已设置。
- 如需确认 Stage 4 是否调用过 LLM，可检查 `run-meta.json`、`06-clarifications.json`，以及 `04-requirements.json` 中的 `LLM-Candidate` 记录。
- 覆盖率偏低时，把 `03-hyperedges.json` 和 `04-requirements.json` 放在一起看。
- 论文或复现工作可参考仓库中的 `publication/` 样例产物和图示。
- 代码结构导航可查看 `graphify-out/GRAPH_REPORT.md`，或打开 `graphify-out/graph.html`。
