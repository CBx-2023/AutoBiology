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
  <a class="doc-card" href="pipeline-guide.html">
    <strong>流水线指南</strong>
    <span>了解五个阶段分别做什么，以及每个阶段产生哪些输出文件。</span>
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
