---
layout: default
title: Getting Started
---

# Getting Started

This guide gets AutoBiology running locally in about five minutes.

## Install

```bash
npm install -g autobiology-cli
```

For source checkout development:

```bash
npm install
npm run build
npm link
```

For local development you can also run the TypeScript source with `npx tsx src/cli.ts`. After installing or linking the package, use the `autob` executable.

## Initialize Configuration

Run the setup wizard:

```bash
autob init
```

The wizard writes `~/.autob/config.json`. It asks for the LLM provider, API key, model, timeout, and optional connectivity check. The pipeline still works without a configured LLM; it will use deterministic requirement generation and record an LLM fallback clarification.

## Run The Pipeline

```bash
autob run tests/fixtures/sample-sop-cell-collection.txt -o out
```

The output directory contains:

```text
01-ops.json
02-nodes.json
03-hyperedges.json
04-requirements.json
05-coverage.json
06-clarifications.json
diagrams/
report.md
run-meta.json
```

Start with `out/report.md`. Use `out/04-requirements.json` for structured requirements and `out/05-coverage.json` for requirement coverage by hyperedge.

## Useful Next Commands

```bash
autob config show
autob run your-sop.txt -o out --interactive
autob review out/04-requirements.json -o out --interactive
```
