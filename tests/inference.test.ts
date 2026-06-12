import { readFile } from "node:fs/promises";
import { afterEach, describe, expect, it, vi } from "vitest";
import { atomizeSop } from "../src/pipeline/atomizer/index.js";
import { buildHypergraph } from "../src/pipeline/hypergraph/index.js";
import { inferRequirements } from "../src/pipeline/inference/index.js";
import { generateRequirements } from "../src/pipeline/requirements/index.js";
import {
  buildCandidateGenerationPrompt,
  buildRequirementRewritePrompt,
  buildSemanticDedupPrompt
} from "../src/llm/prompts.js";
import { OpenAiCompatibleLlmClient, type LlmClient } from "../src/llm/client.js";
import { loadKnowledgeBase } from "../src/knowledge/loader.js";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("LLM inference", () => {
  it("generates rewritten candidate requirements with source hyperedge references", async () => {
    const baseTable = await buildBaseRequirementTable();
    const knowledge = loadKnowledgeBase();
    knowledge.domainPatterns["离心"] = {
      ...knowledge.domainPatterns["离心"],
      engineeringHints: "LLM-9-CUSTOM-CENTRIFUGE-CONTEXT"
    };
    const client = new ScriptedClient([
      JSON.stringify({
        requirements: [
          {
            type: "R4",
            description: "维持低温",
            source_hyperedge: "H-OP-002",
            source_ops: ["OP-002"],
            applicable_to: "细胞悬液",
            confidence: 0.72,
            reasoning: "候选基于 H-OP-002 的低温离心证据。"
          }
        ]
      }),
      JSON.stringify({
        description: "设备应在离心过程中维持低温条件以降低样本降解风险。",
        reasoning: "改写保留 H-OP-002 的低温离心证据。"
      }),
      JSON.stringify({ is_duplicate: false })
    ]);

    const inferred = await inferRequirements(baseTable, { client, knowledgeBase: knowledge });
    const llmRequirement = inferred.requirements.find((requirement) => requirement.inferenceRule === "LLM-Candidate");

    expect(llmRequirement?.status).toBe("candidate");
    expect(llmRequirement?.description).toBe("设备应在离心过程中维持低温条件以降低样本降解风险。");
    expect(llmRequirement?.sourceHyperedges).toEqual(["H-OP-002"]);
    expect(llmRequirement?.reasoning).toBe("改写保留 H-OP-002 的低温离心证据。");
    expect(client.calls).toHaveLength(3);
    expect(client.calls[0]).toContain("LLM-9-CUSTOM-CENTRIFUGE-CONTEXT");
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

  it("keeps candidate reasoning when rewrite returns only a description", async () => {
    const baseTable = await buildBaseRequirementTable();
    const client = new ScriptedClient([
      JSON.stringify({
        requirements: [
          {
            type: "R8",
            description: "异常暂停",
            source_hyperedge: "H-OP-003",
            source_ops: ["OP-003"],
            reasoning: "候选基于 H-OP-003 的沉淀保留人工判断证据。"
          }
        ]
      }),
      JSON.stringify({ description: "设备应在弃液异常时暂停吸液并提示复核。" }),
      JSON.stringify({ is_duplicate: false })
    ]);

    const inferred = await inferRequirements(baseTable, { client });
    const llmRequirement = inferred.requirements.find((requirement) => requirement.inferenceRule === "LLM-Candidate");

    expect(llmRequirement?.reasoning).toBe("候选基于 H-OP-003 的沉淀保留人工判断证据。");
    expect(client.calls[0]).toContain("source_hyperedge");
    expect(client.calls[0]).toContain("Knowledge Context");
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
    const knowledge = loadKnowledgeBase();
    const candidatePrompt = buildCandidateGenerationPrompt(table, knowledge);
    const rewritePrompt = buildRequirementRewritePrompt("维持低温", "H-OP-002", knowledge, "离心");
    const dedupPrompt = buildSemanticDedupPrompt(table.requirements, {
      type: "R4",
      description: "设备应维持低温。",
      sourceHyperedges: ["H-OP-002"]
    }, knowledge);

    expect(candidatePrompt).toContain("source_hyperedge");
    expect(rewritePrompt).toContain("source_hyperedge");
    expect(dedupPrompt).toContain("source_hyperedge");
    expect(candidatePrompt).toContain("AutoBiology Implicit Requirement Discovery");
    expect(candidatePrompt).toContain("Knowledge Context");
    expect(candidatePrompt).toContain("Action: 离心");
    expect(candidatePrompt).toContain("转子配平检测");
    expect(candidatePrompt).toContain("coverage");
    expect(rewritePrompt).toContain("AutoBiology Requirement Rewrite");
    expect(rewritePrompt).toContain("Action: 离心");
    expect(rewritePrompt).toContain("转子配平检测");
    expect(dedupPrompt).toContain("AutoBiology Semantic Duplicate Judgment");
    expect(dedupPrompt).toContain("Action: 离心");
    expect(dedupPrompt).toContain("转子配平检测");
    expect(candidatePrompt).not.toMatch(/{{\\s*[A-Za-z0-9_]+\\s*}}/);
    expect(rewritePrompt).not.toMatch(/{{\\s*[A-Za-z0-9_]+\\s*}}/);
    expect(dedupPrompt).not.toMatch(/{{\\s*[A-Za-z0-9_]+\\s*}}/);
  });
});

describe("OpenAI-compatible LLM client", () => {
  it("sends the API key only as an authorization header and returns message content", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 }));
    globalThis.fetch = fetchMock as typeof fetch;
    const client = new OpenAiCompatibleLlmClient({
      baseUrl: "https://llm.example/v1",
      apiKey: "secret-test-key",
      model: "model-x"
    });

    await expect(client.complete("prompt")).resolves.toBe("ok");
    const request = fetchMock.mock.calls[0][1] as RequestInit;
    expect((request.headers as Record<string, string>).authorization).toBe("Bearer secret-test-key");
    expect(JSON.stringify(request.body)).not.toContain("secret-test-key");
  });

  it("does not include the API key in provider error messages", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 401, statusText: "Unauthorized" }));
    globalThis.fetch = fetchMock as typeof fetch;
    const client = new OpenAiCompatibleLlmClient({
      baseUrl: "https://llm.example/v1",
      apiKey: "secret-test-key",
      model: "model-x"
    });

    await expect(client.complete("prompt")).rejects.not.toThrow(/secret-test-key/);
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
