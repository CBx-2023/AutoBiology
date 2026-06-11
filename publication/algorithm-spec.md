# AutoBiology 算法规范

## 1. 符号约定

| 符号 | 含义 |
| --- | --- |
| `S` | 输入 SOP 文本 |
| `O = {op_i}` | 原子操作集合 |
| `V` | 超图节点集合 |
| `E = {e_i}` | 操作超边集合 |
| `G = (V, E)` | SOP 知识超图 |
| `R` | 需求集合 |
| `C` | 待澄清集合 |
| `T = {R1, ..., R10}` | 需求类型集合 |

## 2. Algorithm 1: SOP 原子化

输入：SOP 文本 `S`  
输出：操作集合 `O`

```text
NormalizeSOP(S):
  1. split S by line break
  2. remove Markdown heading marks and ordered-list prefixes
  3. drop empty lines and generic title lines
  4. join remaining lines with sentence separator

Atomize(S):
  1. S' = NormalizeSOP(S)
  2. sentences = split S' by Chinese or ASCII semicolon and period
  3. O = empty list
  4. for each sentence s:
       if s matches "更换X":
           append "吸去旧X" as an aspiration operation
           append "加入新鲜X" as an addition operation
       else if s matches "X 洗涤 n 次":
           append "加入X", "X洗涤/混匀", "吸去X"
       else:
           split s by comma, "并", "随后"
           append each fragment as an operation
  5. standardize each operation action by dictionary matching
  6. return O
```

原理：SOP 文本中的一句话可能包含多个可独立控制的实验动作。原子化算法通过显式文本规则将复合句拆分为控制粒度更细的操作单元，为后续装备功能、参数和风险需求生成提供稳定输入。

## 3. Algorithm 2: 字段抽取与专家规则补充

输入：操作 `op_i`  
输出：带字段的操作记录

```text
ExtractFields(op_i):
  1. action = dictionary_match(op_i.sourceText)
  2. parameters = regex_extract(temperature, force, time, volume)
  3. inputs = infer by action and biological entity keywords
  4. target = infer by entity keywords
  5. containers = match known container names
  6. location = infer from action and explicit location words
  7. tools = lookup tools by action
  8. outputState = infer from action and target
  9. conditions = infer from environmental words and parameter values
 10. humanJudgment = infer from judgment/observation words
 11. risks = infer from action, low-temperature context, and judgment requirement
 12. return structured op_i
```

关键实现原则：

- 数值参数必须保留 `name`、`value`、`unit`、`rawText` 和 `status`。
- 模糊词如“适量、少许、快速、缓慢”不被当作确定参数，而是标记为 `ambiguous`。
- 专家规则补充的工具、风险或位置在超图中标记为 `expert` 或 `inferred`。

## 4. Algorithm 3: 知识超图构建

输入：操作集合 `O`  
输出：知识超图 `G = (V, E)`

```text
BuildHypergraph(O):
  1. V = empty node set
  2. E = empty hyperedge set
  3. for each op_i in O:
       nodeRoles = empty role map
       for each non-empty field f in op_i:
           nodeType = role_of(f)
           normalizedName = normalize(field value)
           key = nodeType + ":" + normalizedName
           if key exists in node index:
               reuse existing node and append op_i to sourceOps
           else:
               create node v_j with typed prefix and source metadata
           connect v_j to nodeRoles[nodeType]
       missingInfo = detect missing precondition, input, target, or parameter
       expertSupplement = nodes whose source is not "sop"
       create hyperedge e_i = (sourceOp, connectedNodes, nodeRoles, missingInfo)
       append e_i to E
  4. return (V, E)
```

节点复用键：

```text
node_key = nodeType + ":" + normalizedName
```

该算法的核心是多元关系建模。一个操作不是二元关系，而是由多个语义角色共同构成的约束集合，因此用超边表示比普通边更适合。

## 5. Algorithm 4: R1-R10 直接映射

输入：知识超图 `G`  
输出：需求集合 `R` 和待澄清集合 `C`

| 需求类型 | 触发字段 | 生成原则 |
| --- | --- | --- |
| R1 操作功能 | `Action` | 设备应能够执行指定操作。 |
| R2 物料/容器兼容 | `Input`, `Target`, `Container` | 设备应兼容相关样本、试剂、耗材或容器。 |
| R3 参数控制 | `Parameter` | 设备或模块应支持关键工艺参数控制。 |
| R4 环境/约束 | `Condition`, `Risk` | 操作应满足环境或约束要求。 |
| R5 流程控制 | `ParentStep`, `Precondition` | 设备应保持 SOP 流程顺序和状态约束。 |
| R6 感知与判断 | `HumanJudgment` | 设备应替代或支持人工观察、判断和确认。 |
| R7 风险控制 | `Risk` | 设备应降低指定实验风险。 |
| R8 异常处理 | `Risk`, `Handling` | 异常发生时设备应支持对应处理。 |
| R9 数据与追溯 | `OP`, `Parameter`, `Risk`, `Judgment` | 设备应记录关键过程、参数、判断和异常。 |
| R10 验证与验收 | `Requirement`, `Parameter`, `Risk`, `OutputState` | 应定义测试或验收方式证明需求满足。 |

伪代码：

```text
GenerateRequirements(G):
  1. R = empty map keyed by requirement fingerprint
  2. C = empty list
  3. for each hyperedge e in G.E:
       collect labels by node role
       apply R1-R10 mapping rules
       for each generated draft requirement r:
           key = fingerprint(r)
           if key not in R:
               R[key] = r
           else:
               merge sourceOps, sourceHyperedges, fields, metrics, constraints, risks
       apply domain patterns, e.g. centrifuge parameter completeness
  4. return ordered R and C
```

## 6. Algorithm 5: 需求指纹去重

指纹定义：

```text
seed(r) =
  r.type
  + "|" + normalize(r.description)
  + "|" + join(sort(r.sourceFields), "+")
  + "|" + normalize(r.applicableTo)

fingerprint(r) = SHA1(seed(r))
```

归一化函数去除空白并统一大小写。若两个需求具有相同指纹，则视为同类需求并合并来源和属性。

该算法解决两个问题：

- 多个操作产生相同需求时避免重复展示。
- 合并后仍保留所有 `sourceOps` 和 `sourceHyperedges`，不牺牲可追溯性。

## 7. Algorithm 6: LLM 候选推理

输入：确定性需求表 `R_det`、可选 LLM client  
输出：增强后的需求表 `R_all`

```text
InferWithLLM(R_det, client):
  1. if client is absent:
       append clarification "LLM auxiliary layer disabled"
       return R_det
  2. prompt LLM to generate candidate requirements from R_det
  3. parse JSON response
  4. for each candidate c:
       if c.source_hyperedge is missing:
           reject c and append clarification
           continue
       rewrite c into normalized requirement sentence
       convert c to requirement with status = candidate
       if exact_fingerprint_duplicate(c, R_det):
           skip c
       else if LLM_semantic_duplicate(c, R_det):
           skip c
       else:
           append c
  5. return enhanced requirement table
```

安全边界：

- LLM 输入是结构化需求表，不是直接接管全部 SOP 解析。
- LLM 输出必须引用来源超边。
- LLM 输出默认 `candidate`，不自动成为 `confirmed`。
- LLM 失败时保留确定性结果并记录降级信息。

## 8. Algorithm 7: 覆盖率矩阵与警告生成

输入：需求表 `R`、超边集合 `E`  
输出：覆盖率矩阵 `M` 和警告集合 `W`

```text
BuildCoverage(R, E):
  1. for each hyperedge e in E:
       for each requirement type t in R1...R10:
           if exists r in R where r.type = t and e.id in r.sourceHyperedges:
               M[e, t] = covered
           else if exists clarification c where e.id in c.sourceHyperedges:
               M[e, t] = clarification
           else:
               M[e, t] = missing
  2. coverageRate = count(covered cells) / total cells
  3. emit role warnings:
       Action without R1
       Parameter without R3
       Condition without R4
       HumanJudgment without R6
       Risk without R7
       Handling without R8
  4. return M, coverageRate, W
```

该算法用于论文实验中的质量评价：它不是评估需求“正确性”的充分条件，但可以评估需求是否覆盖了结构化证据中应触发的需求类型。

## 9. 复杂度分析

设：

- `n` 为原子操作数。
- `k` 为每个操作平均字段数。
- `m` 为生成需求数。
- `t = 10` 为需求类型数。

主要确定性阶段复杂度如下：

| 阶段 | 时间复杂度 | 说明 |
| --- | --- | --- |
| SOP 原子化 | `O(|S|)` | 线性扫描和规则切分。 |
| 字段抽取 | `O(n * k)` | 每个操作执行有限数量正则和关键词匹配。 |
| 超图构建 | `O(n * k)` | 节点索引使用哈希表，节点复用近似常数时间。 |
| 需求生成 | `O(n * t + m)` | 每条超边执行固定 R1-R10 规则。 |
| 指纹去重 | `O(m)` | 哈希表插入和合并。 |
| 覆盖率矩阵 | `O(|E| * t * m)` 当前实现 | 可通过索引优化为 `O(|E| * t + m)`。 |

LLM 阶段复杂度主要由外部模型调用决定，与提供商、模型和提示词长度有关，因此不作为确定性算法复杂度的一部分。

