---
layout: default
title: LLM And Artifacts
lang: en
---

# LLM And Artifacts

This page explains when AutoBiology uses an LLM, what remains deterministic, and how to use the repository artifacts published on GitHub.

## Check Whether LLM Is Enabled

Run:

```bash
autob config show
```

LLM inference can run only when all of these fields are set:

- `apiKey`: shown as redacted instead of `unset`
- `baseUrl`: not `unset`
- `model`: not `unset`

After a pipeline run, check:

- `run-meta.json`: `config.llmModel` is the configured model name, or `not-configured` when no LLM client was created.
- `06-clarifications.json`: contains an `LLM 辅助层未启用` clarification when the LLM layer was unavailable or failed.
- `04-requirements.json`: LLM-added requirements use `inferenceRule: "LLM-Candidate"` and `status: "candidate"`.

## Default Behavior

By default, AutoBiology does not call an LLM unless the JSON config resolves to a complete OpenAI-compatible client. The deterministic pipeline still runs without LLM configuration.

Use `autob init` to write the global config at `~/.autob/config.json`. Project-level `.autob.json` can override non-sensitive fields such as `baseUrl`, `model`, and `timeoutMs`, but it must not contain `apiKey`.

## Responsibility Boundary

The deterministic engine is responsible for:

- SOP normalization and operation atomization
- field extraction, alias normalization, and knowledge-base enrichment
- operation hypergraph construction
- R1-R10 requirement generation from hypergraph evidence
- fingerprint-based deduplication
- coverage matrix, warnings, Mermaid diagrams, and reports

The LLM layer is responsible only for optional Stage 4 assistance:

- proposing implicit candidate requirements from the existing requirement table
- rewriting candidate text into a concise engineering requirement sentence
- checking likely semantic duplicates before adding a candidate

LLM output is source-bounded. A candidate must cite a source hyperedge, remains `candidate` by default, and does not replace deterministic `confirmed` requirements. If the LLM fails, AutoBiology keeps the deterministic output and records a clarification.

## GitHub Artifacts

The GitHub repository includes two generated reference directories:

- `publication/`: paper-oriented methods text, reproducibility notes, sample outputs, Mermaid diagrams, and a draw.io-compatible algorithm figure.
- `graphify-out/`: generated code knowledge graph, architecture report, and interactive graph HTML.

These directories are source repository artifacts. They are useful for review, reproducibility, and paper writing; the npm package focuses on the CLI runtime, docs, and bundled `data/` knowledge base.

## Useful Commands

```bash
autob config show
autob run your-sop.txt -o out
autob infer out/04-requirements.json -o out
```

Open `out/report.md` for a readable summary, then inspect `out/04-requirements.json`, `out/06-clarifications.json`, and `out/run-meta.json` for LLM-specific evidence.
