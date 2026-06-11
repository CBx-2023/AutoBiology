# 复现说明

## 1. 环境

当前项目要求：

- Node.js 20 或以上。
- npm。
- 不配置 LLM 时也可运行完整确定性流水线。
- 若需要 LLM 候选推理，需要在 `~/.autob/config.json` 中配置 `apiKey`、`baseUrl` 和 `model`。

安装依赖：

```bash
npm install
```

构建：

```bash
npm run build
```

测试：

```bash
npm test
```

## 2. 确定性复现实验

以下命令使用项目内样例 SOP，并将输出写入本目录内部：

```bash
npx tsx src/cli.ts run tests/fixtures/sample-sop-cell-collection.txt -o publication/artifacts/sample-cell-collection
```

运行后应产生：

```text
publication/artifacts/sample-cell-collection/
├── 01-ops.json
├── 02-nodes.json
├── 03-hyperedges.json
├── 04-requirements.json
├── 05-coverage.json
├── 06-clarifications.json
├── diagrams/
├── report.md
└── run-meta.json
```

检查是否未使用 LLM：

```bash
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('publication/artifacts/sample-cell-collection/run-meta.json','utf8')); console.log(m.config.llmModel)"
```

若输出为 `not-configured`，说明该结果只使用确定性算法层。

检查规则生成需求：

```bash
rg -n '"inferenceRule": "DM-' publication/artifacts/sample-cell-collection/04-requirements.json
```

检查 LLM 候选需求：

```bash
rg -n '"inferenceRule": "LLM-Candidate"' publication/artifacts/sample-cell-collection/04-requirements.json
```

未配置 LLM 时，该命令通常没有匹配结果。

## 3. LLM 复现实验

配置完整后，`autob run` 和 `autob infer` 会自动尝试 LLM 候选推理：

```bash
autob config show
```

确认以下三项均不是 `unset`：

```text
baseUrl
model
apiKey
```

然后运行：

```bash
autob run tests/fixtures/sample-sop-cell-collection.txt -o publication/artifacts/sample-cell-collection-llm
```

检查本次运行使用的模型：

```bash
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('publication/artifacts/sample-cell-collection-llm/run-meta.json','utf8')); console.log(m.config.llmModel)"
```

检查是否产生 LLM 候选：

```bash
rg -n '"LLM-Candidate"' publication/artifacts/sample-cell-collection-llm/04-requirements.json
```

## 4. 结果解释

关键输出解释：

- `01-ops.json`：SOP 原子操作表。
- `02-nodes.json`：知识超图节点。
- `03-hyperedges.json`：操作超边。
- `04-requirements.json`：R1-R10 需求表，包含确定性需求和可选 LLM 候选。
- `05-coverage.json`：超边-需求类型覆盖矩阵。
- `06-clarifications.json`：待澄清问题和 LLM 降级说明。
- `report.md`：人可读审阅报告。
- `run-meta.json`：运行元数据、阶段耗时和统计量。

判断需求来源：

```text
DM-R*          确定性直接映射规则
LLM-Candidate LLM 候选推理
```

判断需求状态：

```text
confirmed     规则层直接确认的需求
candidate     需要专家审阅的候选需求
clarification 待澄清或需补充证据
rejected      已拒绝
frozen        已冻结
```

## 5. 复现注意事项

- LLM 输出具有模型和服务端版本依赖，论文实验应报告模型名、base URL 提供商、调用日期和温度设置。
- 确定性层不依赖网络或 API key，适合作为论文主实验的可复现基线。
- 若需要比较 LLM 前后差异，建议分别保存 `publication/artifacts/sample-cell-collection` 和 `publication/artifacts/sample-cell-collection-llm`。
- 不应将 API key 写入项目目录或论文材料目录。

