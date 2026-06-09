---
layout: default
title: Configuration
---

# Configuration

AutoBiology uses JSON configuration files. Environment variables are not used for LLM configuration.

## Files

Global config:

```text
~/.autob/config.json
```

Project config:

```text
./.autob.json
```

Global config stores base settings, including the API key. Project config can override non-sensitive fields for a repository.

## Global Example

```json
{
  "llm": {
    "provider": "deepseek",
    "baseUrl": "https://api.deepseek.com/v1",
    "apiKey": "<your-api-key>",
    "model": "deepseek-chat",
    "timeoutMs": 30000
  }
}
```

## Project Example

```json
{
  "llm": {
    "provider": "custom",
    "baseUrl": "https://llm.example/v1",
    "model": "project-model",
    "timeoutMs": 12000
  }
}
```

Project config must not contain `llm.apiKey`. Store API keys only in `~/.autob/config.json`.

## Merge Rules

AutoBiology shallow-merges the `llm` object:

- Project `provider`, `baseUrl`, `model`, and `timeoutMs` override global values.
- Global `apiKey` is preserved.
- Missing files are treated as empty config.
- Invalid config fails fast with an actionable error.

## Inspect Configuration

```bash
autob config show
```

The output shows merged values with `Global`, `Project`, or `Unset` source annotations. API keys are redacted.
