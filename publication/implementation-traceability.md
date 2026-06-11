# 实现溯源说明

本文件记录论文方法描述与当前源码实现之间的对应关系。论文材料应以本表为实现依据，避免引用尚未实现的理想化设计。

## 1. 方法组件到源码的映射

| 方法组件 | 当前实现位置 | 说明 |
| --- | --- | --- |
| 流水线编排 | `src/pipeline/runner.ts` | 依次执行 atomize、hypergraph、requirements、infer、review，并写出阶段产物。 |
| SOP 切分 | `src/pipeline/atomizer/rules.ts` | 规范化文本、按标点和连接词切分，并处理“更换”“洗涤 n 次”等复合规则。 |
| 动作词典 | `src/pipeline/atomizer/action-dict.ts` | 将动作别名映射为标准动作，按别名长度降序匹配。 |
| 字段抽取与风险推断 | `src/pipeline/atomizer/index.ts` | 通过正则、关键词和专家规则抽取参数、实体、环境条件、人工判断和风险。 |
| 知识超图构建 | `src/pipeline/hypergraph/index.ts` | 节点归一化、节点复用、操作超边构建、缺失信息和专家补充标记。 |
| 数据契约 | `src/pipeline/types.ts` | 定义 Op、HyperNode、Hyperedge、Requirement、CoverageMatrix 等结构。 |
| R1-R10 直接映射 | `src/pipeline/requirements/index.ts` | 根据超边角色字段生成 R1-R10 需求。 |
| 领域模式 | `src/pipeline/requirements/index.ts` | 当前实现包含离心操作参数完整性检查。 |
| 需求指纹去重 | `src/pipeline/requirements/index.ts` | 使用 SHA1 指纹合并重复需求。 |
| LLM 候选推理 | `src/pipeline/inference/index.ts` | 生成 LLM 候选、改写、精确去重和语义去重。 |
| LLM 客户端 | `src/llm/client.ts` | OpenAI-compatible chat completions 接口，低温度设置和重试封装。 |
| LLM 提示词 | `src/llm/prompts.ts` | 规定 JSON 输出、来源超边约束、改写和语义去重任务。 |
| 覆盖率和报告 | `src/pipeline/review/index.ts` | 构建覆盖率矩阵、角色缺失警告、Mermaid 图和 Markdown 报告。 |
| CLI 配置边界 | `src/config.ts`, `src/cli.ts` | `apiKey`、`baseUrl`、`model` 完整时才创建 LLM client。 |

## 2. 测试证据

| 行为 | 测试位置 | 覆盖内容 |
| --- | --- | --- |
| 完整流水线产物 | `tests/e2e.test.ts` | 验证 `run` 命令写出 JSON、报告和 metadata。 |
| 配置后 LLM 调用 | `tests/e2e.test.ts` | 使用本地 mock server 验证配置会传入 run/infer。 |
| R1-R10 需求映射 | `tests/requirements.test.ts` | 验证样例超图产生 R1-R10、来源超边和指纹。 |
| 指纹去重 | `tests/requirements.test.ts` | 验证重复加液需求会合并来源超边。 |
| 离心领域规则 | `tests/requirements.test.ts` | 验证离心缺少关键参数时生成 clarification。 |
| LLM 候选约束 | `tests/inference.test.ts` | 验证 LLM 候选有来源超边、状态为 candidate。 |
| LLM 降级 | `tests/inference.test.ts` | 验证调用失败时保留确定性需求并记录降级说明。 |
| 覆盖率矩阵 | `tests/review.test.ts` | 验证覆盖率、图示、角色缺失 warning。 |
| 交互审阅 | `tests/review.test.ts` | 验证候选需求可确认、拒绝或标记待澄清。 |

## 3. 与早期设计说明的差异

`docs/superpowers/specs/2026-06-09-autobiocli-design.md` 是早期设计文档，其中提到 Atomizer 可使用 LLM 辅助抽取字段。当前实现中，CLI 默认路径的 Atomizer 主要依赖规则、正则和专家规则；LLM 仅接入第 4 阶段 `infer`。因此，论文材料采用当前源码边界：

```text
确定性层：SOP 原子化、字段抽取、超图构建、R1-R10 映射、去重、覆盖检查
LLM 层：候选需求生成、候选改写、语义去重
```

## 4. 论文表述时应避免的过度声明

当前实现不应被描述为：

- 已训练监督学习模型。
- 已使用 NLI 模型进行冲突检测。
- 已建立大规模领域知识库。
- 已在真实多中心实验 SOP 数据集上完成统计学评估。
- LLM 自动确认或覆盖规则生成需求。

可严谨表述为：

- 一个规则和超图驱动的 SOP-to-requirements 原型系统。
- 一个可追溯、可解释、阶段产物可检查的需求挖掘流水线。
- 一个将 LLM 限定为候选补充和语义去重辅助的混合推理框架。

