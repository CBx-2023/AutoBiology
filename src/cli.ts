#!/usr/bin/env node

import { Command } from "commander";
import { realpathSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createLlmClientFromConfig, loadConfig, renderConfigShow, resolveLlmConfigFromConfig } from "./config.js";
import { runInitWizard } from "./cli/wizard.js";
import { atomizeSop } from "./pipeline/atomizer/index.js";
import { buildHypergraph } from "./pipeline/hypergraph/index.js";
import { inferRequirements } from "./pipeline/inference/index.js";
import { generateRequirements } from "./pipeline/requirements/index.js";
import { reviewCandidatesInteractively, reviewRequirements, writeReviewOutputs } from "./pipeline/review/index.js";
import { runPipeline } from "./pipeline/runner.js";
import type { HyperedgeTable, NodeTable, OpTable, RequirementTable } from "./pipeline/types.js";

export interface CreateProgramOptions {
  initWizard?: () => Promise<void>;
  configShow?: () => Promise<string>;
  output?: NodeJS.WritableStream;
}

export function createProgram(options: CreateProgramOptions = {}): Command {
  const program = new Command();

  program
    .name("autob")
    .description(
      "Extract engineering requirements from biological SOPs through an atomize -> hypergraph -> requirements -> infer -> review pipeline."
    )
    .version("0.1.2");

  program
    .command("init")
    .description("Create or update the global AutoBiology configuration.")
    .action(async () => {
      await (options.initWizard ?? (() => runInitWizard()))();
    });

  const config = program.command("config").description("Manage AutoBiology configuration.");
  config
    .command("show")
    .description("Show merged AutoBiology configuration.")
    .action(async () => {
      const rendered = await (options.configShow ?? (() => renderConfigShow()))();
      (options.output ?? process.stdout).write(rendered);
    });

  program
    .command("run")
    .description("Run the full 5-stage pipeline for an SOP file.")
    .argument("<sop-file>", "Markdown or text SOP file")
    .requiredOption("-o, --output <dir>", "Output directory")
    .option("--interactive", "Enable interactive expert review", false)
    .action(async (sopFile: string, options: { output: string; interactive: boolean }) => {
      const config = await loadConfig();
      const llmConfig = resolveLlmConfigFromConfig(config);
      await runPipeline(sopFile, options.output, {
        interactive: options.interactive,
        interactiveReview: {
          input: process.stdin,
          output: process.stdout,
          isTTY: Boolean(process.stdin.isTTY)
        },
        llmClient: createLlmClientFromConfig(config),
        llmModel: llmConfig?.model
      });
    });

  program
    .command("atomize")
    .description("Stage 1: parse a raw SOP into an operation table.")
    .argument("<sop-file>", "Markdown or text SOP file")
    .requiredOption("-o, --output <dir>", "Output directory")
    .action(async (sopFile: string, options: { output: string }) => {
      const sopText = await readFile(sopFile, "utf8");
      await mkdir(options.output, { recursive: true });
      const table = await atomizeSop(sopText, {
        sopId: deriveSopId(sopFile),
        sopName: deriveSopName(sopFile)
      });
      await writeFile(join(options.output, "01-ops.json"), `${JSON.stringify(table, null, 2)}\n`, "utf8");
    });

  program
    .command("hypergraph")
    .description("Stage 2: convert an operation table into hypergraph nodes and hyperedges.")
    .argument("<op-table>", "Path to 01-ops.json")
    .requiredOption("-o, --output <dir>", "Output directory")
    .action(async (opTableFile: string, options: { output: string }) => {
      const opTable = JSON.parse(await readFile(opTableFile, "utf8")) as OpTable;
      await mkdir(options.output, { recursive: true });
      const hypergraph = buildHypergraph(opTable);
      await writeFile(join(options.output, "02-nodes.json"), `${JSON.stringify(hypergraph.nodes, null, 2)}\n`, "utf8");
      await writeFile(join(options.output, "03-hyperedges.json"), `${JSON.stringify(hypergraph.edges, null, 2)}\n`, "utf8");
    });

  program
    .command("requirements")
    .description("Stage 3: generate deterministic requirements from hypergraph nodes and hyperedges.")
    .argument("<nodes-file>", "Path to 02-nodes.json")
    .argument("<hyperedges-file>", "Path to 03-hyperedges.json")
    .requiredOption("-o, --output <dir>", "Output directory")
    .action(async (nodesFile: string, hyperedgesFile: string, options: { output: string }) => {
      const nodes = JSON.parse(await readFile(nodesFile, "utf8")) as NodeTable;
      const edges = JSON.parse(await readFile(hyperedgesFile, "utf8")) as HyperedgeTable;
      await mkdir(options.output, { recursive: true });
      const requirements = generateRequirements({ nodes, edges });
      await writeFile(join(options.output, "04-requirements.json"), `${JSON.stringify(requirements, null, 2)}\n`, "utf8");
    });

  program
    .command("infer")
    .description("Stage 4: infer implicit candidate requirements using an LLM when configured.")
    .argument("<requirements-file>", "Path to 04-requirements.json")
    .requiredOption("-o, --output <dir>", "Output directory")
    .action(async (requirementsFile: string, options: { output: string }) => {
      const table = JSON.parse(await readFile(requirementsFile, "utf8")) as RequirementTable;
      await mkdir(options.output, { recursive: true });
      const inferred = await inferRequirements(table, { client: createLlmClientFromConfig(await loadConfig()) });
      await writeFile(join(options.output, "04-requirements.json"), `${JSON.stringify(inferred, null, 2)}\n`, "utf8");
    });

  program
    .command("review")
    .description("Stage 5: generate coverage artifacts and optionally review candidate requirements.")
    .argument("<requirements-file>", "Path to 04-requirements.json")
    .requiredOption("-o, --output <dir>", "Output directory")
    .option("--interactive", "Enable interactive expert review", false)
    .action(async (requirementsFile: string, options: { output: string; interactive: boolean }) => {
      const table = JSON.parse(await readFile(requirementsFile, "utf8")) as RequirementTable;
      const reviewedTable = options.interactive
        ? await reviewCandidatesInteractively(table, {
            input: process.stdin,
            output: process.stdout,
            isTTY: Boolean(process.stdin.isTTY)
          })
        : table;
      const hyperedges = await readSiblingHyperedges(requirementsFile);
      await mkdir(options.output, { recursive: true });
      await writeReviewOutputs(options.output, reviewRequirements(reviewedTable, { hyperedges }));
    });

  return program;
}

function deriveSopId(sopFile: string): string {
  return `SOP-${deriveSopName(sopFile).replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "Input"}`;
}

function deriveSopName(sopFile: string): string {
  const fileName = sopFile.split(/[\\/]/).pop() ?? sopFile;
  return fileName.replace(/\.[^.]+$/, "");
}

async function readSiblingHyperedges(requirementsFile: string): Promise<HyperedgeTable | undefined> {
  try {
    return JSON.parse(await readFile(join(dirname(requirementsFile), "03-hyperedges.json"), "utf8")) as HyperedgeTable;
  } catch {
    return undefined;
  }
}

function isCliEntrypoint(moduleUrl: string, argvPath: string | undefined): boolean {
  if (!argvPath) return false;
  try {
    return realpathSync(fileURLToPath(moduleUrl)) === realpathSync(argvPath);
  } catch {
    return fileURLToPath(moduleUrl) === argvPath;
  }
}

if (isCliEntrypoint(import.meta.url, process.argv[1])) {
  createProgram().parse(process.argv);
}
