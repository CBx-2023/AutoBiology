# 样例运行结果摘要

本文件总结 `publication/artifacts/sample-cell-collection` 中的确定性基线运行结果。该样例由以下命令生成：

```bash
npx tsx src/cli.ts run tests/fixtures/sample-sop-cell-collection.txt -o publication/artifacts/sample-cell-collection
```

## 1. 运行配置

| 项目 | 值 |
| --- | --- |
| 输入 SOP | `tests/fixtures/sample-sop-cell-collection.txt` |
| 输出目录 | `publication/artifacts/sample-cell-collection` |
| LLM 状态 | `not-configured` |
| 运行模式 | 确定性规则基线 |

`run-meta.json` 中的 `config.llmModel` 为 `not-configured`，且 `06-clarifications.json` 记录了“LLM 辅助层未启用或已降级：未配置 LLM client”。因此该样例不依赖外部模型或 API。

## 2. 规模统计

| 指标 | 数值 |
| --- | ---: |
| 原子操作数 | 4 |
| 超图节点数 | 41 |
| 操作超边数 | 4 |
| 需求数 | 34 |
| 待澄清数 | 1 |
| 覆盖率 | 0.85 |

## 3. 需求来源计数

| 推理规则 | 数量 |
| --- | ---: |
| `DM-R1` | 4 |
| `DM-R2` | 3 |
| `DM-R3` | 1 |
| `DM-R4` | 4 |
| `DM-R5` | 4 |
| `DM-R6` | 2 |
| `DM-R7` | 4 |
| `DM-R8` | 4 |
| `DM-R9` | 4 |
| `DM-R10` | 4 |
| `LLM-Candidate` | 0 |

该分布说明样例需求均由确定性映射规则产生，可作为论文中“无 LLM 基线”的示例结果。

## 4. 可引用观察

- 样例 SOP 被原子化为 4 个操作超边。
- 规则层生成了覆盖 R1-R10 的 34 条需求。
- 离心相关参数产生 R3 参数控制需求。
- 没有配置 LLM 时，系统仍完成全流程并保留降级说明。
- 需求表中没有 `LLM-Candidate`，适合作为确定性算法效果展示。

