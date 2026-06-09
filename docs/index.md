---
layout: default
title: AutoBiology CLI
---

# AutoBiology CLI

AutoBiology turns biological SOP text into structured automation requirements. The CLI parses procedure text, builds operation hypergraphs, generates deterministic R1-R10 requirements, optionally adds LLM-assisted candidates, and writes coverage reports with Mermaid diagrams.

## Install

```bash
npm install -g autobiology-cli
autob --help
```

## Documentation

- [Getting Started](getting-started.html)
- [Configuration](configuration.html)
- [Pipeline Guide](pipeline-guide.html)
- [CLI Reference](cli-reference.html)

## Quick Run

```bash
autob init
autob run your-sop.txt -o out
```

Open `out/report.md` first, then inspect the JSON files for structured data.
