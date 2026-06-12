---
layout: default
title: AutoBiology CLI 中文文档
lang: zh-CN
---

# AutoBiology CLI 中文文档

AutoBiology 可以把生物实验 SOP 文本转换成结构化的自动化需求。CLI 会解析操作步骤，构建操作超图，生成确定性的 R1-R10 需求，也可以在配置 LLM 后补充候选需求，最后输出覆盖率报告和 Mermaid 图。

<div class="language-panel">
  <a href="../">English docs</a>
  <a href="getting-started.html">从快速开始进入</a>
</div>

## 安装

```bash
npm install -g autobiology-cli
autob --help
```

安装后的命令是 `autob`。npm 包包含 CLI 运行时、内置 `data/` 知识库和用户文档。

## 文档导航

<div class="doc-grid">
  <a class="doc-card" href="getting-started.html">
    <strong>快速开始</strong>
    <span>安装 CLI、初始化配置，并完成第一次 SOP 流水线运行。</span>
  </a>
  <a class="doc-card" href="configuration.html">
    <strong>配置说明</strong>
    <span>理解全局配置、项目配置、合并规则和 API key 的安全存放方式。</span>
  </a>
  <a class="doc-card" href="blender-simulation.html">
    <strong>Blender 仿真</strong>
    <span>使用独立 Blender 组件，把需求 JSON 渲染成 MP4 仿真视频。</span>
  </a>
  <a class="doc-card" href="pipeline-guide.html">
    <strong>流水线指南</strong>
    <span>了解五个阶段分别做什么，以及每个阶段产生哪些输出文件。</span>
  </a>
  <a class="doc-card" href="llm-and-artifacts.html">
    <strong>LLM 与研究产物</strong>
    <span>确认 LLM 是否启用，并理解算法边界和仓库研究产物。</span>
  </a>
  <a class="doc-card" href="cli-reference.html">
    <strong>命令参考</strong>
    <span>查询 autob 的命令、参数、选项和常见退出行为。</span>
  </a>
</div>

## 最短路径

```bash
autob init
autob run your-sop.txt -o out
```

优先打开 `out/report.md` 查看可读报告，再按需检查 JSON 文件。

如需确认本次运行是否使用了可选 LLM 层：

```bash
autob config show
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('out/run-meta.json','utf8')); console.log(m.config.llmModel)"
rg -n '"LLM-Candidate"' out/04-requirements.json
```

## 知识库与仓库产物

CLI 包内包含 `data/` 知识库：同义词、领域动作模式、参数约束和标准风险目录。`autob run` 会在流水线开始时加载一次，并在 atomize、hypergraph 和 requirements 阶段复用。

GitHub 仓库还包含 `publication/` 和 `graphify-out/`。前者用于论文方法、复现说明、图示和样例输出；后者用于代码知识图谱、架构报告和可视化浏览。

更多 LLM 启用判断、算法边界和仓库产物说明见 [LLM 与研究产物](llm-and-artifacts.html)。
