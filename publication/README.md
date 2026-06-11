# AutoBiology Publication Package

本目录集中收录面向论文发表场景的 AutoBiology 方法材料。内容以当前源码实现为准，目标是支持论文中的“原理与方法”“算法流程”“复现性说明”和“实现溯源”部分，而不是替代用户手册。

## 目录内容

| 文件 | 用途 |
| --- | --- |
| `manuscript-methods.md` | 论文风格的方法与原理正文草稿，可作为 Methods 或 Technical Approach 的基础文本。 |
| `algorithm-spec.md` | 形式化算法定义、伪代码、R1-R10 映射规则、去重与覆盖率计算说明。 |
| `implementation-traceability.md` | 方法描述与源码、测试之间的溯源关系，说明哪些结论由当前实现支撑。 |
| `reproducibility.md` | 复现环境、运行命令、LLM 配置边界和验证方式。 |
| `results-summary.md` | 当前样例运行的统计摘要，用于论文材料中的基线结果说明。 |
| `figures/autobiology-algorithm.drawio` | draw.io/diagrams.net 可编辑多页算法图，适合论文排版前导出 SVG、PNG 或 PDF。 |
| `figures/*.mmd` | 可嵌入论文或技术附录的 Mermaid 图示。 |
| `artifacts/` | 复现实验运行后生成的样例输出，保持在本目录内部。 |

## 方法边界

AutoBiology 采用“确定性算法优先、LLM 候选补充”的架构。确定性部分负责 SOP 原子化、字段抽取、知识超图构建、R1-R10 需求映射、指纹去重和覆盖率校核；LLM 仅在配置完整时参与隐含候选需求生成、候选改写和语义去重判断。LLM 输出默认标记为 `candidate`，不覆盖确定性规则生成的 `confirmed` 需求。

## 推荐使用方式

论文写作时建议先阅读：

1. `manuscript-methods.md`
2. `algorithm-spec.md`
3. `implementation-traceability.md`
4. `reproducibility.md`

图示优先使用 `figures/autobiology-algorithm.drawio`，可用 draw.io/diagrams.net 打开后导出 SVG、PNG 或 PDF。`figures/*.mmd` 保留为轻量 Mermaid 源码版本，适合技术附录或支持 Mermaid 的文档系统。
