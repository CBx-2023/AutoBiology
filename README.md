# AutoBiology CLI

AutoBiology turns biological SOP text into structured automation requirements. The CLI parses procedure text, builds operation hypergraphs, generates deterministic R1-R10 requirements, optionally adds LLM-assisted candidates, and writes coverage reports with Mermaid diagrams.

## Quick Start

```bash
npm install -g autobiology-cli
autob init
autob run your-sop.txt -o out
```

Open `out/report.md` first, then inspect the JSON files for structured data.

## Documentation

- Hosted docs: https://cbx-2023.github.io/AutoBiology/
- 中文文档: https://cbx-2023.github.io/AutoBiology/zh/
- [Getting Started](docs/getting-started.md)
- [Blender Simulation](docs/blender-simulation.md)
- [Configuration](docs/configuration.md)
- [Pipeline Guide](docs/pipeline-guide.md)
- [CLI Reference](docs/cli-reference.md)

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
