import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { atomizeSop } from "./atomizer/index.js";
import { buildHypergraph } from "./hypergraph/index.js";
import { inferRequirements } from "./inference/index.js";
import { generateRequirements } from "./requirements/index.js";
import { applyInteractiveReviewDecision, reviewRequirements, writeReviewOutputs } from "./review/index.js";
import type { RunMeta } from "./types.js";
import type { LlmClient } from "../llm/client.js";

export interface RunPipelineOptions {
  interactive?: boolean;
  llmClient?: LlmClient;
  llmModel?: string;
}

export async function runPipeline(sopFile: string, outputDir: string, options: RunPipelineOptions = {}): Promise<RunMeta> {
  await mkdir(outputDir, { recursive: true });
  const stageDurations: Record<string, number> = {};
  const sopText = await readFile(sopFile, "utf8");

  const opTable = await timed(stageDurations, "atomize", () =>
    atomizeSop(sopText, {
      sopId: deriveSopId(sopFile),
      sopName: deriveSopName(sopFile)
    })
  );
  await writeJson(outputDir, "01-ops.json", opTable);

  const hypergraph = await timed(stageDurations, "hypergraph", () => Promise.resolve(buildHypergraph(opTable)));
  await writeJson(outputDir, "02-nodes.json", hypergraph.nodes);
  await writeJson(outputDir, "03-hyperedges.json", hypergraph.edges);

  const generatedRequirements = await timed(stageDurations, "requirements", () => Promise.resolve(generateRequirements(hypergraph)));
  const inferredRequirements = await timed(stageDurations, "infer", () =>
    inferRequirements(generatedRequirements, { client: options.llmClient })
  );
  const reviewedRequirements = options.interactive
    ? applyInteractiveReviewDecision(inferredRequirements, "confirm-all")
    : inferredRequirements;
  await writeJson(outputDir, "04-requirements.json", reviewedRequirements);
  await writeJson(outputDir, "06-clarifications.json", reviewedRequirements.clarifications);

  const reviewArtifacts = await timed(stageDurations, "review", () =>
    Promise.resolve(reviewRequirements(reviewedRequirements, { hyperedges: hypergraph.edges }))
  );
  await writeReviewOutputs(outputDir, reviewArtifacts);

  const runMeta: RunMeta = {
    version: "0.1.0",
    timestamp: new Date().toISOString(),
    sopFile,
    config: {
      llmModel: options.llmModel ?? (options.llmClient ? "configured" : "not-configured"),
      interactive: Boolean(options.interactive)
    },
    stageDurations,
    stats: {
      opCount: opTable.ops.length,
      nodeCount: hypergraph.nodes.nodes.length,
      hyperedgeCount: hypergraph.edges.hyperedges.length,
      requirementCount: reviewedRequirements.requirements.length,
      clarificationCount: reviewedRequirements.clarifications.length,
      coverageRate: reviewArtifacts.coverage.summary.coverageRate
    }
  };
  await writeJson(outputDir, "run-meta.json", runMeta);
  return runMeta;
}

async function timed<T>(stageDurations: Record<string, number>, stage: string, run: () => Promise<T>): Promise<T> {
  const start = performance.now();
  const result = await run();
  stageDurations[stage] = Math.round(performance.now() - start);
  return result;
}

async function writeJson(outputDir: string, fileName: string, data: unknown): Promise<void> {
  await writeFile(join(outputDir, fileName), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

function deriveSopId(sopFile: string): string {
  return `SOP-${deriveSopName(sopFile).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Input"}`;
}

function deriveSopName(sopFile: string): string {
  const fileName = sopFile.split(/[\\/]/).pop() ?? sopFile;
  return fileName.replace(/\.[^.]+$/, "");
}
