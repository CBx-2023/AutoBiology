---
layout: default
title: Getting Started
lang: en
---

# Getting Started

This guide gets AutoBiology running locally in about five minutes.

## Install

```bash
npm install -g autobiology-cli
autob update --check
```

For source checkout development:

```bash
npm install
npm run build
npm link
```

For local development you can also run the TypeScript source with `npx tsx src/cli.ts`. After installing or linking the package, use the `autob` executable.

Use `autob update` to install the latest published CLI later. Automatic update checks are cached for 24 hours; set `AUTOB_DISABLE_UPDATE_CHECK=1` when running in CI or offline shells.

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

## What The Built-In Knowledge Base Does

The npm package includes the curated `data/` files used by the deterministic pipeline. They normalize SOP aliases such as PBS buffer, Falcon tubes, biosafety cabinets, and common unit spellings; add action-specific default tools, risks, and output states; and create missing-parameter clarifications from domain patterns.

No LLM configuration is required for this behavior. LLM providers are only used for optional candidate requirement inference.

To confirm whether LLM inference is active, run `autob config show` and inspect `out/run-meta.json` plus `out/06-clarifications.json` after a pipeline run. See [LLM And Artifacts](llm-and-artifacts.html) for details.

## Repository Reference Artifacts

When working from the GitHub repository, `publication/` provides paper-style method notes, reproducibility instructions, sample run outputs, Mermaid diagrams, and a draw.io-compatible algorithm diagram. `graphify-out/` provides the generated code knowledge graph and architecture report for codebase review.

## Useful Next Commands

```bash
autob config show
autob update --check
autob run your-sop.txt -o out --interactive
autob review out/04-requirements.json -o out --interactive
```
