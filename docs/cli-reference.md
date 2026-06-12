---
layout: default
title: CLI Reference
lang: en
---

# CLI Reference

All commands use the `autob` executable.

## `autob init`

Create or update `~/.autob/config.json`.

Prompts for provider, API key, base URL when needed, model, timeout, and optional connectivity check.

Exit code: `0` on success; non-zero for invalid input, file write errors, or unexpected runtime errors.

## `autob config show`

Show merged global/project configuration with source annotations and redacted API key.

Use this command to verify whether LLM inference can run. `apiKey`, `baseUrl`, and `model` must all be set after merging.

Exit code: `0` on success; non-zero for invalid JSON or validation errors.

## `autob run <sop-file> -o <output-dir>`

Run atomize, hypergraph, requirements, infer, and review in order.

Options:

- `-o, --output <dir>`: required output directory.
- `--interactive`: enable interactive candidate review in TTY sessions.

Exit code: `0` on success; non-zero for unreadable input, invalid JSON artifacts, output write errors, or unexpected runtime errors.

## `autob atomize <sop-file> -o <output-dir>`

Parse SOP text into `01-ops.json`.

## `autob hypergraph <op-table> -o <output-dir>`

Convert `01-ops.json` into `02-nodes.json` and `03-hyperedges.json`.

## `autob requirements <nodes-file> <hyperedges-file> -o <output-dir>`

Generate deterministic requirements into `04-requirements.json`.

## `autob infer <requirements-file> -o <output-dir>`

Add LLM-assisted candidate requirements when JSON config is complete. Without LLM config, this command records a clarification and preserves existing requirements.

## `autob review <requirements-file> -o <output-dir>`

Generate coverage artifacts, report, diagrams, and optional candidate review.

Options:

- `-o, --output <dir>`: required output directory.
- `--interactive`: prompt for candidate decisions in TTY sessions.

## Help

```bash
autob --help
autob <command> --help
```
