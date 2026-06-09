import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { atomizeSop } from "../src/pipeline/atomizer/index.js";
import { buildHypergraph } from "../src/pipeline/hypergraph/index.js";
import { inferRequirements } from "../src/pipeline/inference/index.js";
import { generateRequirements } from "../src/pipeline/requirements/index.js";
import {
  buildCandidateGenerationPrompt,
  buildRequirementRewritePrompt,
  buildSemanticDedupPrompt
} from "../src/llm/prompts.js";
import type { LlmClient } from "../src/llm/client.js";

describe("LLM inference", () => {
  it("generates rewritten candidate requirements with source hyperedge references", async () => {
    const baseTable = await buildBaseRequirementTable();
    const client = new ScriptedClient([
      JSON.stringify({
        requirements: [
          {
            type: "R4",
            description: "维持低温",
            source_hyperedge: "H-OP-002",
            source_ops: ["OP-002"],
            applicable_to: "细胞悬液",
            confidence: 0.72
          }
        ]
      }),
      JSON.stringify({ description: "设备应在离心过程中维持低温条件以降低样本降解风险。" }),
      JSON.stringify({ is_duplicate: false })
    ]);

    const inferred = await inferRequirements(baseTable, { client });
    const llmRequirement = inferred.requirements.find((requirement) => requirement.inferenceRule === "LLM-Candidate");

    expect(llmRequirement?.status).toBe("candidate");
    expect(llmRequirement?.description).toBe("设备应在离心过程中维持低温条件以降低样本降解风险。");
    expect(llmRequirement?.sourceHyperedges).toEqual(["H-OP-002"]);
    expect(client.calls).toHaveLength(3);
  });

  it("retries transient LLM failures before falling back to a successful response", async () => {
    const baseTable = await buildBaseRequirementTable();
    const client = new ScriptedClient([
      new Error("rate limit"),
      JSON.stringify({ requirements: [] })
    ]);

    const inferred = await inferRequirements(baseTable, { client, retries: 1 });

    expect(inferred.requirements).toHaveLength(baseTable.requirements.length);
    expect(client.calls).toHaveLength(2);
  });

  it("degrades gracefully and records a clarification when every LLM attempt fails", async () => {
    const baseTable = await buildBaseRequirementTable();
    const client = new ScriptedClient([new Error("timeout"), new Error("timeout")]);

    const inferred = await inferRequirements(baseTable, { client, retries: 1 });

    expect(inferred.requirements).toHaveLength(baseTable.requirements.length);
    expect(inferred.clarifications.at(-1)?.question).toContain("LLM 辅助层未启用");
  });
});

describe("LLM prompts", () => {
  it("names the required source_hyperedge contract in all inference prompts", async () => {
    const table = await buildBaseRequirementTable();
    const candidatePrompt = buildCandidateGenerationPrompt(table);
    const rewritePrompt = buildRequirementRewritePrompt("维持低温", "H-OP-002");
    const dedupPrompt = buildSemanticDedupPrompt(table.requirements, {
      type: "R4",
      description: "设备应维持低温。",
      sourceHyperedges: ["H-OP-002"]
    });

    expect(candidatePrompt).toContain("source_hyperedge");
    expect(rewritePrompt).toContain("source_hyperedge");
    expect(dedupPrompt).toContain("source_hyperedge");
  });
});

async function buildBaseRequirementTable() {
  const sop = await readFile("tests/fixtures/sample-sop-cell-collection.txt", "utf8");
  const opTable = await atomizeSop(sop, { sopId: "SOP-CellCollection-001", sopName: "Cell Collection" });
  return generateRequirements(buildHypergraph(opTable));
}

class ScriptedClient implements LlmClient {
  calls: string[] = [];
  private index = 0;

  constructor(private readonly script: Array<string | Error>) {}

  async complete(prompt: string): Promise<string> {
    this.calls.push(prompt);
    const next = this.script[this.index++] ?? this.script.at(-1);
    if (next instanceof Error) throw next;
    return next ?? "";
  }
}
