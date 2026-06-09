# AutoBiology CLI

AutoBiology CLI (`autobio`) extracts engineering requirements from biological SOP text. It runs a transparent pipeline:

1. Atomize SOP text into operation records.
2. Build operation hypergraphs.
3. Generate deterministic R1-R10 requirements.
4. Optionally infer candidate requirements with an OpenAI-compatible LLM provider.
5. Generate coverage reports, clarification records, and Mermaid diagrams.

## Requirements

- Node.js 20+
- npm

## Install

```bash
npm install
npm run build
```

## Quick Start

Run the full pipeline on the sample SOP:

```bash
npx tsx src/cli.ts run tests/fixtures/sample-sop-cell-collection.txt -o out
```

Run from built JavaScript:

```bash
node dist/cli.js run tests/fixtures/sample-sop-cell-collection.txt -o out
```

After `npm pack` or package installation, the executable is `autobio`:

```bash
autobio run your-sop.txt -o out
```

## Output Files

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

Start with `report.md` for a readable summary, then inspect the JSON files for structured data.

## Commands

```bash
node dist/cli.js --help
node dist/cli.js run <sop-file> -o <output-dir>
node dist/cli.js atomize <sop-file> -o <output-dir>
node dist/cli.js hypergraph <output-dir>/01-ops.json -o <output-dir>
node dist/cli.js requirements <output-dir>/02-nodes.json <output-dir>/03-hyperedges.json -o <output-dir>
node dist/cli.js infer <output-dir>/04-requirements.json -o <output-dir>
node dist/cli.js review <output-dir>/04-requirements.json -o <output-dir>
```

Interactive candidate review:

```bash
node dist/cli.js run <sop-file> -o <output-dir> --interactive
```

In non-TTY environments, interactive mode leaves candidate requirements unchanged and records a clarification instead of silently confirming them.

## LLM Configuration

Without credentials, the CLI still runs using deterministic R1-R10 generation and records an LLM fallback clarification.

DeepSeek-compatible configuration:

```bash
export DEEPSEEK_API_KEY="your-key"
export DEEPSEEK_MODEL="deepseek-chat"
node dist/cli.js run your-sop.txt -o out
```

Generic OpenAI-compatible configuration:

```bash
export AUTOBIO_LLM_API_KEY="your-key"
export AUTOBIO_LLM_BASE_URL="https://api.example.com/v1"
export AUTOBIO_LLM_MODEL="model-name"
node dist/cli.js run your-sop.txt -o out
```

Do not commit `.env` files or API keys.

## Development

```bash
npm test
npm run build
```

Package-level smoke test coverage includes installing the packed tarball into a temporary prefix and running the installed `autobio` bin through npm's package symlink.

## Project Layout

```text
src/cli.ts                         CLI commands
src/config.ts                      LLM environment configuration
src/llm/                           OpenAI-compatible client and prompts
src/pipeline/atomizer/             SOP atomization
src/pipeline/hypergraph/           Hypergraph construction
src/pipeline/requirements/         Deterministic R1-R10 generation
src/pipeline/inference/            LLM candidate inference
src/pipeline/review/               Coverage, review, reports, diagrams
tests/                             Unit and integration tests
docs/superpowers/specs/            Design spec
issues/                            Mission CSV and review log
```

## Notes

- Real-provider LLM smoke checks are credential-dependent and are not required for the default test suite.
- Before publishing to npm, add an explicit package allowlist or `.npmignore` so local artifacts are not included in `npm pack`.
