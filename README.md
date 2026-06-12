# AutoBiology CLI

AutoBiology turns biological SOP text into structured automation requirements. The CLI parses procedure text, builds operation hypergraphs, generates deterministic R1-R10 requirements, optionally adds LLM-assisted candidates, and writes coverage reports with Mermaid diagrams.

## Quick Start

```bash
npm install -g autobiology-cli
autob --help
autob init
autob run your-sop.txt -o out
```

Open `out/report.md` first, then inspect the JSON files for structured data.
The installed command is `autob`.

## Knowledge-Aware Pipeline

The published CLI ships with the curated knowledge base in `data/`:

- `synonyms.json` normalizes biological materials, containers, tools, locations, and common units.
- `domain-patterns.json` defines required parameters, risks, requirement links, and inference hints by action.
- `parameter-constraints.json` records common units, ranges, thresholds, and tolerances.
- `risk-catalog.json` provides standard risk handling and verification methods.

`autob run` loads this knowledge base once and passes it through atomization, hypergraph construction, and deterministic requirement generation. LLM calls remain optional and are only used for candidate requirements when configured.

## Research Artifacts

- `publication/` contains manuscript-oriented method notes, reproducibility instructions, sample outputs, Mermaid diagrams, and a draw.io-compatible algorithm figure.
- `graphify-out/` contains the repository knowledge graph, architecture report, and navigable graph HTML for codebase review.

## Documentation

- Hosted docs: https://cbx-2023.github.io/AutoBiology/
- 中文文档: https://cbx-2023.github.io/AutoBiology/zh/
- [Getting Started](docs/getting-started.md)
- [Blender Simulation](docs/blender-simulation.md)
- [Configuration](docs/configuration.md)
- [Pipeline Guide](docs/pipeline-guide.md)
- [LLM And Artifacts](docs/llm-and-artifacts.md)
- [CLI Reference](docs/cli-reference.md)

To confirm whether LLM inference is enabled, run `autob config show`. After a run, inspect `run-meta.json`, `06-clarifications.json`, and any `LLM-Candidate` entries in `04-requirements.json`.

```bash
autob config show
node -e "const fs=require('fs'); const m=JSON.parse(fs.readFileSync('out/run-meta.json','utf8')); console.log(m.config.llmModel)"
rg -n '"LLM-Candidate"' out/04-requirements.json
```

`not-configured` and no `LLM-Candidate` matches means the run used the deterministic algorithm layer only.

## Blender Simulation

The Blender simulation code is a standalone component in `components/blender-simulation`. It consumes generated requirement JSON and can emit a Blender Python script that renders MP4 output through Blender's native FFmpeg runtime. It is intentionally not wired into the original SOP converter pipeline.

## Commands

```bash
autob --help
autob init
autob config show
autob run <sop-file> -o <output-dir>
autob atomize <sop-file> -o <output-dir>
autob hypergraph <op-table> -o <output-dir>
autob requirements <nodes-file> <hyperedges-file> -o <output-dir>
autob infer <requirements-file> -o <output-dir>
autob review <requirements-file> -o <output-dir>
```

## Development

```bash
npm test
npm run build
```

Node.js 20+ is required.
