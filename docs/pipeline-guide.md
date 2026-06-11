---
layout: default
title: Pipeline Guide
lang: en
---

# Pipeline Guide

`autob run` executes five stages and writes every intermediate artifact to the output directory.

The deterministic stages are knowledge-aware. The package includes `data/synonyms.json`, `data/domain-patterns.json`, `data/parameter-constraints.json`, and `data/risk-catalog.json`; a full run loads them once and reuses the same knowledge base across atomization, hypergraph construction, and requirements generation.

## Stage 1: Atomize

Command:

```bash
autob atomize <sop-file> -o <output-dir>
```

Output: `01-ops.json`

The atomizer splits SOP text into operation records with action, inputs, target, tools, parameters, risks, human judgment, and output state.

## Stage 2: Hypergraph

Command:

```bash
autob hypergraph <output-dir>/01-ops.json -o <output-dir>
```

Outputs: `02-nodes.json`, `03-hyperedges.json`

This stage normalizes operation fields into reusable nodes and creates one operation hyperedge per SOP operation.

## Stage 3: Requirements

Command:

```bash
autob requirements <output-dir>/02-nodes.json <output-dir>/03-hyperedges.json -o <output-dir>
```

Output: `04-requirements.json`

The generator maps hypergraph evidence into deterministic R1-R10 requirements and deduplicates by fingerprint.

## Stage 4: Infer

Command:

```bash
autob infer <output-dir>/04-requirements.json -o <output-dir>
```

Output: updated `04-requirements.json`

When JSON config contains a complete LLM setup, this stage asks an OpenAI-compatible provider for candidate requirements. Without config, it leaves deterministic requirements intact and records a clarification.

## Stage 5: Review

Command:

```bash
autob review <output-dir>/04-requirements.json -o <output-dir>
```

Outputs: `05-coverage.json`, `report.md`, `diagrams/*.mmd`

The review stage builds coverage matrices, warnings, diagrams, and an optional interactive candidate review flow. In a full `autob run`, the pipeline also writes `06-clarifications.json` before review artifacts.

## Debugging

- If output is missing, rerun the last stage command directly with the previous stage artifact.
- If LLM candidates are absent, run `autob config show` and verify `apiKey`, `baseUrl`, and `model` are set.
- If coverage is low, inspect `03-hyperedges.json` and `04-requirements.json` together.
- For paper or reproducibility work, use the checked-in `publication/` sample artifacts and diagrams as a known baseline.
- For codebase navigation, inspect `graphify-out/GRAPH_REPORT.md` or open `graphify-out/graph.html`.
