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

The installed command is `autob`. The npm package contains the CLI runtime, bundled `data/` knowledge base, and user documentation.

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
  <a class="doc-card" href="llm-and-artifacts.html">
    <strong>LLM And Artifacts</strong>
    <span>Check whether LLM inference is enabled and use the research artifacts.</span>
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

To check whether a run used the optional LLM layer:

```bash
autob config show
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('out/run-meta.json','utf8')); console.log(m.config.llmModel)"
rg -n '"LLM-Candidate"' out/04-requirements.json
```

## Knowledge Base And Artifacts

The CLI includes the curated `data/` knowledge base used by the deterministic stages: synonyms, domain action patterns, parameter constraints, and the standard risk catalog. `autob run` loads it once and passes it through atomize, hypergraph, and requirements generation.

The GitHub repository also includes `publication/` for paper-oriented methods, reproducibility notes, figures, and sample outputs, plus `graphify-out/` for the generated code knowledge graph and architecture report.

See [LLM And Artifacts](llm-and-artifacts.html) for the LLM enablement check, deterministic and LLM responsibility boundary, and artifact usage notes.
