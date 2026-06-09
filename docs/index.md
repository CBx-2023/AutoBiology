---
layout: default
title: AutoBiology CLI
lang: en
---

# AutoBiology CLI

AutoBiology turns biological SOP text into structured automation requirements. The CLI parses procedure text, builds operation hypergraphs, generates deterministic R1-R10 requirements, optionally adds LLM-assisted candidates, and writes coverage reports with Mermaid diagrams.

<div class="language-panel">
  <a href="zh/">中文文档</a>
  <a href="getting-started.html">Start in English</a>
</div>

## Install

```bash
npm install -g autobiology-cli
autob --help
```

## Documentation

<div class="doc-grid">
  <a class="doc-card" href="getting-started.html">
    <strong>Getting Started</strong>
    <span>Install the CLI, initialize config, and run your first SOP.</span>
  </a>
  <a class="doc-card" href="configuration.html">
    <strong>Configuration</strong>
    <span>Set global and project JSON config without committing secrets.</span>
  </a>
  <a class="doc-card" href="blender-simulation.html">
    <strong>Blender Simulation</strong>
    <span>Use the standalone Blender component to render requirement-driven MP4 simulations.</span>
  </a>
  <a class="doc-card" href="pipeline-guide.html">
    <strong>Pipeline Guide</strong>
    <span>Understand each stage and the files written to the output directory.</span>
  </a>
  <a class="doc-card" href="cli-reference.html">
    <strong>CLI Reference</strong>
    <span>Look up commands, arguments, options, and expected behavior.</span>
  </a>
</div>

## Quick Run

```bash
autob init
autob run your-sop.txt -o out
```

Open `out/report.md` first, then inspect the JSON files for structured data.
