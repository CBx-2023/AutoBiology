# AutoBiology 智能增强设计规格

## 1. 背景与动机

专家审核指出当前 AutoBiology 管道的四个核心缺陷：

1. **抽取智能偏浅** — 参数抽取全靠正则（`/(\d+)°C/`），动作识别靠 `text.includes(alias)` 子串匹配，领域知识库（synonyms.json、domain-patterns.json）在原始设计规格中规划了但未实现。
2. **需求生成模板化** — R1-R10 全部用 `` `设备应能够执行${action}操作` `` 式字符串拼接，没有工程语义精度。
3. **缺乏验证方法** — 覆盖矩阵只看"有/无"，去重仅靠 SHA1 hash，没有双向追溯验证和完整性评分。
4. **核心推理方法缺失** — LLM 调用只有 3 个简短 prompt（总共 55 行），没有 few-shot、Chain-of-Thought，没有知识库作为推理基础。

## 2. 改进策略

**渐进增强，保持管道结构不变。** 分三阶段推进：

1. **阶段 A — 领域知识库构建**：为管道各阶段提供结构化领域知识支撑
2. **阶段 B — LLM Prompt 强化**：升级为带 few-shot/CoT 的工程级 prompt 体系
3. **阶段 C — 验证层增强**：建立多维验证体系（质量评分、语义去重、风险覆盖、双向追溯）

依赖关系：阶段 A 是 B 和 C 的基础（prompt 需要注入知识库上下文，验证需要知识库作为参照标准）。

## 3. 阶段 A — 领域知识库

### 3.1 知识库文件结构

```
data/
├── action-dictionary.json       # 已有，需扩充
├── synonyms.json                # 新建：实体归一化映射
├── domain-patterns.json         # 新建：操作-参数-风险关联模式
├── parameter-constraints.json   # 新建：各参数的工程约束
└── risk-catalog.json            # 新建：标准风险分类与处理建议
```

### 3.2 synonyms.json — 实体归一化映射

用途：将 SOP 中多种叫法归一到标准术语，供超图节点去重和 LLM 上下文使用。

```jsonc
{
  "PBS缓冲液": "PBS", "磷酸盐缓冲液": "PBS", "PBS buffer": "PBS",
  "离心瓶": "离心容器", "离心管": "离心容器", "Falcon管": "离心容器",
  "超净台": "洁净工作台", "安全柜": "洁净工作台", "BSC": "洁净工作台",
  "培养箱": "CO2培养箱", "细胞培养箱": "CO2培养箱",
  "移液枪": "移液器", "移液管": "移液器", "吸管": "移液器"
  // 目标：50+ 条生物实验核心术语
}
```

### 3.3 domain-patterns.json — 操作-参数-风险关联

用途：每个标准动作应配套哪些参数、典型风险、对应需求类型。管道中用于 (1) 原子化阶段的参数完整性校验 (2) 需求生成阶段的覆盖检查 (3) 验证阶段的风险覆盖验证。

```jsonc
{
  "离心": {
    "requiredParameters": ["温度", "离心力", "时间"],
    "optionalParameters": ["加速度", "减速模式"],
    "typicalRisks": ["配平失败", "温升导致样本降解", "管壁残留"],
    "relatedRequirements": ["R1", "R3", "R4", "R7"],
    "engineeringHints": "离心模块应支持转速/RCF双模式设定"
  },
  "培养": {
    "requiredParameters": ["温度", "时间", "CO2浓度"],
    "optionalParameters": ["湿度", "O2浓度"],
    "typicalRisks": ["污染", "温度偏移", "CO2浓度波动"],
    "relatedRequirements": ["R1", "R3", "R4", "R7", "R9"],
    "engineeringHints": "培养模块应支持多气体混合控制"
  },
  "加液": {
    "requiredParameters": ["体积", "流速"],
    "optionalParameters": ["温度"],
    "typicalRisks": ["污染", "体积误差", "交叉污染"],
    "relatedRequirements": ["R1", "R2", "R3", "R7"],
    "engineeringHints": "液体处理模块应支持多通道分液"
  }
  // 覆盖全部 22 个动作类别
}
```

### 3.4 parameter-constraints.json — 参数工程约束

用途：提供参数的单位、典型范围和关键阈值，供需求生成时写入量化指标。

```jsonc
{
  "温度": {
    "unit": "°C",
    "typicalRange": [2, 37],
    "criticalThresholds": [4, 37],
    "tolerance": "±1°C",
    "notes": "4°C 为冷藏标准，37°C 为细胞培养标准"
  },
  "离心力": {
    "unit": "g",
    "typicalRange": [100, 12000],
    "tolerance": "±5%",
    "notes": "常见 300g(细胞沉淀)、12000g(DNA提取)"
  },
  "时间": {
    "unit": "min",
    "typicalRange": [1, 60],
    "tolerance": "±5s",
    "notes": "短时操作常见 5min，长时培养可达数小时"
  },
  "体积": {
    "unit": "mL",
    "typicalRange": [0.001, 1000],
    "tolerance": "±2%",
    "notes": "微量操作 μL 级，大体积 mL-L 级"
  },
  "CO2浓度": {
    "unit": "%",
    "typicalRange": [5, 5],
    "tolerance": "±0.1%",
    "notes": "标准细胞培养条件"
  }
}
```

### 3.5 risk-catalog.json — 标准风险分类

用途：提供标准风险条目及其严重度、触发动作、处理建议、验证方法，替代硬编码在 `inferRisks()` 中的 Map。

```jsonc
{
  "污染": {
    "category": "生物安全",
    "severity": "high",
    "triggerActions": ["转移", "加液", "吸液", "弃液", "收集", "采样"],
    "standardHandling": "保持无菌操作，减少暴露时间，使用层流洁净台",
    "verificationMethod": "无菌检测培养"
  },
  "样本损失": {
    "category": "工艺质量",
    "severity": "high",
    "triggerActions": ["转移", "收集", "弃液", "吸液"],
    "standardHandling": "缓慢操作，核对转移量，目视确认沉淀完整",
    "verificationMethod": "转移前后称重或体积核对"
  },
  "配平失败": {
    "category": "设备安全",
    "severity": "high",
    "triggerActions": ["离心"],
    "standardHandling": "设置并核对离心参数，确认离心瓶配平",
    "verificationMethod": "自动配平检测与报警"
  },
  "温升导致样本降解": {
    "category": "工艺质量",
    "severity": "medium",
    "triggerActions": ["离心", "转移", "孵育"],
    "standardHandling": "使用冷冻离心机或冰上操作",
    "verificationMethod": "温度传感器持续监控"
  },
  "人工判断偏差": {
    "category": "操作一致性",
    "severity": "medium",
    "triggerActions": ["判断", "观察", "检测"],
    "standardHandling": "提供视觉或传感确认依据，建立判断标准",
    "verificationMethod": "双人复核或传感器辅助判断"
  }
  // 目标：15-20 条标准风险
}
```

### 3.6 代码集成

**新增 `src/knowledge/loader.ts`：**
- `loadKnowledgeBase(dataDir: string): KnowledgeBase` — 统一加载并校验所有 JSON
- `KnowledgeBase` 接口包含 synonyms、domainPatterns、parameterConstraints、riskCatalog
- 加载失败时抛出明确错误（哪个文件、什么问题）

**现有代码改造：**
- `atomizer/index.ts` 中 `inferInputs`/`inferTarget`/`inferRisks` 等函数改为查知识库，不再硬编码
- `atomizer/rules.ts` 中 `standardizeAction` 继续用 action-dictionary（已有），但新增同义词归一化
- `hypergraph/index.ts` 节点去重使用 `synonyms.json`
- `requirements/index.ts` 中 `applyDomainPatterns` 改为遍历 `domain-patterns.json`，不再只处理"离心"
- `pipeline/runner.ts` 在管道启动时加载 KnowledgeBase 并传递给各阶段

## 4. 阶段 B — LLM Prompt 强化

### 4.1 Prompt 模板外置化

将 prompt 从 `src/llm/prompts.ts` 中的字符串拼接移到 `data/prompts/*.md` 模板文件：

```
data/prompts/
├── extract-op-fields.md         # Stage 1: OP 字段抽取（LLM 辅助模式）
├── generate-candidates.md       # Stage 4: 隐式需求发现
├── rewrite-requirement.md       # Stage 4: 工程语义改写
├── semantic-dedup.md            # Stage 4: 语义去重
└── verify-completeness.md       # Stage 5: 完整性校验（新增）
```

模板使用 `{{variable}}` 占位符，运行时替换。

### 4.2 新增代码模块

**`src/llm/prompt-loader.ts`：**
- `loadPromptTemplate(templateName: string): string` — 从 `data/prompts/` 读取模板
- `renderPrompt(template: string, variables: Record<string, string>): string` — 替换占位符

**`src/llm/context-builder.ts`：**
- `buildKnowledgeContext(action: string, knowledge: KnowledgeBase): string` — 从知识库提取与当前操作相关的参数约束、风险目录、工程提示，拼装为结构化上下文段落注入 prompt

### 4.3 Prompt 升级内容

#### generate-candidates.md（核心升级）

结构：
1. **角色定义**：你是生物工程领域的需求分析专家
2. **任务说明**：基于超边和知识库上下文，推理隐含需求
3. **思维链指导**：
   - 阅读操作描述和节点关系
   - 对照 domain-patterns 的必要参数和典型风险
   - 检查现有需求覆盖缺口
   - 对每个缺口生成工程需求
4. **Few-shot 示例**：2-3 个完整的输入→推理→输出示例
5. **输出格式**：JSON，增加 `reasoning` 字段
6. **知识库上下文**：`{{knowledge_context}}` 占位符

#### rewrite-requirement.md（语义升级）

引入工程语义改写规范：
- 必须包含**可量化指标**（范围、精度、容差）
- 必须指明**适用对象**和**模块归属**
- 遵循"设备[模块]应[动词][对象]，[量化条件]"句式
- 提供好/坏对比示例：
  - ❌ `设备应能够执行离心操作，适用对象为细胞悬液`
  - ✅ `设备离心模块应支持 100-12000g 离心力设定（精度±5%），运行时间 1-60min 可编程，转子腔温度 2-40°C 可控`

#### semantic-dedup.md（判断标准升级）

增加明确的判断标准：
- 相同操作 + 相同参数范围 + 相同适用对象 = 重复
- 相同操作但不同参数子集 = 非重复（可能需要合并）
- 不同操作但相同风险控制目标 = 非重复
- 要求输出 `reasoning` 字段解释判断依据

### 4.4 重写 prompts.ts

`src/llm/prompts.ts` 改为调用 `prompt-loader.ts` + `context-builder.ts`：

```typescript
export function buildCandidateGenerationPrompt(
  table: RequirementTable,
  knowledge: KnowledgeBase   // 新增参数
): string {
  const template = loadPromptTemplate('generate-candidates');
  const context = buildKnowledgeContext(/* 从 table 提取操作 */, knowledge);
  return renderPrompt(template, {
    existing_requirements: JSON.stringify(/*...*/),
    knowledge_context: context
  });
}
```

### 4.5 Requirement 类型扩展

`types.ts` 中 `Requirement` 增加可选字段：

```typescript
interface Requirement {
  // ...existing fields
  reasoning?: string;     // LLM 推理过程记录
}
```

此字段仅由 LLM 生成的候选需求携带，记录推理依据，方便专家审核。不参与 fingerprint 计算。

## 5. 阶段 C — 验证层增强

### 5.1 需求质量评分器

**新增 `src/pipeline/review/quality-scorer.ts`**

对每条需求按四个维度打分（0-1）：

| 维度 | 满分条件 | 中等 | 低分 |
|------|----------|------|------|
| 可测试性 testability | 包含数值范围/容差/验证方法 | 仅定性描述 | 纯模板拼接 |
| 具体性 specificity | 有明确参数范围和边界 | 有对象但无范围 | "未说明" |
| 追溯性 traceability | sourceOps + sourceHyperedges + sourceFields 三者齐全 | 缺少一项 | 缺少两项以上 |
| 工程语义 engineeringSemantic | 匹配"设备应…在…范围内/精度±…"模式 | 有主谓宾但无量化 | 无结构 |

```typescript
interface QualityScore {
  requirementId: string;
  dimensions: {
    testability: number;
    specificity: number;
    traceability: number;
    engineeringSemantic: number;
  };
  overall: number;    // 加权总分 (0.3*test + 0.25*spec + 0.2*trace + 0.25*eng)
  issues: string[];   // 具体扣分原因列表
}
```

实现为纯规则引擎，不依赖 LLM。

### 5.2 语义去重增强

**新增 `src/pipeline/review/dedup-checker.ts`**

三层去重：

| 层级 | 方法 | 阈值 | 用途 |
|------|------|------|------|
| L1 | Fingerprint hash（已有） | 精确匹配 | 完全相同的需求 |
| L2 | 归一化文本 Jaccard 相似度 | ≥ 0.8 | 近似重复（改了几个字） |
| L3 | LLM 语义判断（升级 prompt） | LLM 返回 is_duplicate | 语义等价但表述不同 |

```typescript
interface DedupResult {
  duplicatePairs: Array<{
    reqA: string;
    reqB: string;
    method: 'fingerprint' | 'jaccard' | 'semantic';
    similarity: number;
    reasoning?: string;
  }>;
  mergedCount: number;
}
```

L2 的 Jaccard 计算：对需求 description 做分词归一化后计算集合交并比。

### 5.3 风险覆盖验证

**新增 `src/pipeline/review/risk-coverage.ts`**

对照 `risk-catalog.json` 检查每个操作的风险是否被需求覆盖：

```typescript
interface RiskCoverageReport {
  coveredRisks: Array<{ risk: string; coveredBy: string[] }>;
  uncoveredRisks: Array<{
    risk: string;
    expectedForActions: string[];
    severity: string;    // 来自 risk-catalog
  }>;
  coverageRate: number;
  warnings: string[];    // 如：高严重度风险 "污染" 未被任何 R7 需求覆盖
}
```

逻辑：遍历所有超边 → 取该超边的 action → 查 `risk-catalog.json` 中该 action 应触发哪些风险 → 检查是否有 R7/R8 需求覆盖该风险。高严重度未覆盖项生成 warning。

### 5.4 双向追溯验证

**新增 `src/pipeline/review/traceability.ts`**

```typescript
interface TraceabilityReport {
  // 正向：每个 OP 是否产出了至少一条需求
  opsWithoutRequirements: string[];
  // 反向：每条需求是否能追溯到有效 OP
  requirementsWithoutOps: string[];
  // 超边级：每个超边的需求类型覆盖完整度
  hyperedgeCoverage: Array<{
    hyperedgeId: string;
    expectedTypes: RequirementType[];   // 基于 domain-patterns 推断应有的类型
    actualTypes: RequirementType[];
    gaps: RequirementType[];
  }>;
  // 统计
  forwardCoverage: number;   // 有需求的 OP 占比
  backwardCoverage: number;  // 有有效 OP 来源的需求占比
}
```

`expectedTypes` 的推断逻辑：查 `domain-patterns.json` 中该操作的 `relatedRequirements` 字段。

### 5.5 综合验证报告

**新增 `src/pipeline/review/verification.ts`** — 整合四项为统一报告：

```typescript
interface VerificationReport {
  qualityScores: QualityScore[];
  averageQuality: number;
  dedupResult: DedupResult;
  riskCoverage: RiskCoverageReport;
  traceability: TraceabilityReport;
  overallAssessment: 'pass' | 'warn' | 'fail';
  summary: string;
}
```

评估标准：
- **pass**：averageQuality ≥ 0.7 且无高严重度未覆盖风险 且 forwardCoverage ≥ 0.9
- **fail**：averageQuality < 0.4 或有 ≥3 个高严重度未覆盖风险
- **warn**：其余情况

### 5.6 输出集成

- 新增输出文件 `06-verification.json`
- `report.md` 增加验证章节：
  - 需求质量分布（Mermaid bar chart）
  - 去重结果摘要
  - 风险覆盖缺口清单
  - 追溯性缺口清单
  - 综合评估结论

## 6. 影响范围

### 6.1 新增文件

| 文件 | 用途 |
|------|------|
| `data/synonyms.json` | 实体归一化映射 |
| `data/domain-patterns.json` | 操作-参数-风险关联 |
| `data/parameter-constraints.json` | 参数工程约束 |
| `data/risk-catalog.json` | 标准风险分类 |
| `data/prompts/extract-op-fields.md` | Prompt 模板 |
| `data/prompts/generate-candidates.md` | Prompt 模板 |
| `data/prompts/rewrite-requirement.md` | Prompt 模板 |
| `data/prompts/semantic-dedup.md` | Prompt 模板 |
| `data/prompts/verify-completeness.md` | Prompt 模板 |
| `src/knowledge/loader.ts` | 知识库加载与校验 |
| `src/llm/prompt-loader.ts` | Prompt 模板加载与渲染 |
| `src/llm/context-builder.ts` | 知识库上下文注入 |
| `src/pipeline/review/quality-scorer.ts` | 需求质量评分 |
| `src/pipeline/review/dedup-checker.ts` | 三层去重 |
| `src/pipeline/review/risk-coverage.ts` | 风险覆盖验证 |
| `src/pipeline/review/traceability.ts` | 双向追溯验证 |
| `src/pipeline/review/verification.ts` | 综合验证报告 |

### 6.2 修改文件

| 文件 | 改动 |
|------|------|
| `src/pipeline/types.ts` | Requirement 增加 reasoning 字段；新增 VerificationReport 等接口 |
| `src/pipeline/atomizer/index.ts` | inferRisks/inferInputs 等改为查知识库 |
| `src/pipeline/hypergraph/index.ts` | 节点去重使用 synonyms |
| `src/pipeline/requirements/index.ts` | applyDomainPatterns 改为遍历 domain-patterns.json |
| `src/pipeline/inference/index.ts` | 传入知识库上下文 |
| `src/llm/prompts.ts` | 重写为调用 prompt-loader + context-builder |
| `src/pipeline/review/index.ts` | 集成验证流程 |
| `src/pipeline/runner.ts` | 启动时加载知识库，输出 06-verification.json |

### 6.3 测试

- 新增 `tests/knowledge.test.ts` — 知识库加载、校验、查询
- 新增 `tests/quality-scorer.test.ts` — 评分规则覆盖
- 新增 `tests/dedup-checker.test.ts` — 三层去重
- 新增 `tests/risk-coverage.test.ts` — 风险覆盖验证
- 新增 `tests/traceability.test.ts` — 追溯验证
- 更新 `tests/requirements.test.ts` — 适配知识库注入
- 更新 `tests/inference.test.ts` — 适配新 prompt 格式
- 更新 `tests/e2e.test.ts` — 验证 06-verification.json 输出
