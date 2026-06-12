import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadKnowledgeBase, type KnowledgeBase } from "../knowledge/loader.js";
import type { LlmClient } from "../llm/client.js";
import { atomizeSop } from "./atomizer/index.js";
import { buildHypergraph } from "./hypergraph/index.js";
import { inferRequirements } from "./inference/index.js";
import { generateRequirements } from "./requirements/index.js";
import { reviewCandidatesInteractively, reviewRequirements, writeReviewOutputs, type InteractiveReviewOptions } from "./review/index.js";
import type { RunMeta } from "./types.js";
import { VERSION } from "../version.js";

export interface RunPipelineOptions {
  interactive?: boolean;
  interactiveReview?: InteractiveReviewOptions;
  knowledgeBase?: KnowledgeBase;
  llmClient?: LlmClient;
  llmModel?: string;
}

export async function runPipeline(sopFile: string, outputDir: string, options: RunPipelineOptions = {}): Promise<RunMeta> {
  await mkdir(outputDir, { recursive: true });
  const stageDurations: Record<string, number> = {};
  const sopText = await readFile(sopFile, "utf8");
  const knowledge = options.knowledgeBase ?? loadKnowledgeBase();

  const opTable = await timed(stageDurations, "atomize", () =>
    atomizeSop(sopText, {
      sopId: deriveSopId(sopFile),
      sopName: deriveSopName(sopFile),
      knowledgeBase: knowledge
    })
  );
  await writeJson(outputDir, "01-ops.json", opTable);

  const hypergraph = await timed(stageDurations, "hypergraph", () => Promise.resolve(buildHypergraph(opTable, knowledge)));
  await writeJson(outputDir, "02-nodes.json", hypergraph.nodes);
  await writeJson(outputDir, "03-hyperedges.json", hypergraph.edges);

  const generatedRequirements = await timed(stageDurations, "requirements", () =>
    Promise.resolve(generateRequirements(hypergraph, knowledge))
  );
  const inferredRequirements = await timed(stageDurations, "infer", () =>
    inferRequirements(generatedRequirements, { client: options.llmClient, knowledgeBase: knowledge })
  );
  const reviewedRequirements = options.interactive
    ? await reviewCandidatesInteractively(inferredRequirements, options.interactiveReview ?? { isTTY: false })
    : inferredRequirements;
  await writeJson(outputDir, "04-requirements.json", reviewedRequirements);
  await writeJson(outputDir, "06-clarifications.json", reviewedRequirements.clarifications);

  const reviewArtifacts = await timed(stageDurations, "review", () =>
    Promise.resolve(reviewRequirements(reviewedRequirements, { hyperedges: hypergraph.edges }))
  );
  await writeReviewOutputs(outputDir, reviewArtifacts);

  const runMeta: RunMeta = {
    version: VERSION,
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
