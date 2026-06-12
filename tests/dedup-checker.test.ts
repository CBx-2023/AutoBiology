import { describe, expect, it } from "vitest";
import type { LlmClient } from "../src/llm/client.js";
import { checkRequirementDeduplication, normalizedJaccardSimilarity } from "../src/pipeline/review/dedup-checker.js";
import type { Requirement } from "../src/pipeline/types.js";

describe("review dedup checker", () => {
  it("detects exact duplicates by fingerprint before text similarity", async () => {
    const result = await checkRequirementDeduplication([
      makeRequirement({ requirementId: "REQ-A", fingerprint: "same-fp", description: "设备应执行加液操作。" }),
      makeRequirement({ requirementId: "REQ-B", fingerprint: "same-fp", description: "完全不同的描述也应被 fingerprint 捕获。" })
    ]);

    expect(result.duplicatePairs).toEqual([
      {
        reqA: "REQ-A",
        reqB: "REQ-B",
        method: "fingerprint",
        similarity: 1
      }
    ]);
    expect(result.mergedCount).toBe(1);
  });

  it("detects near duplicates by normalized Jaccard similarity", async () => {
    const similarity = normalizedJaccardSimilarity("设备应在加液过程中控制体积 1 mL。", "设备应在加液过程中控制体积为 1 mL。");

    const result = await checkRequirementDeduplication([
      makeRequirement({ requirementId: "REQ-A", fingerprint: "fp-a", description: "设备应在加液过程中控制体积 1 mL。" }),
      makeRequirement({ requirementId: "REQ-B", fingerprint: "fp-b", description: "设备应在加液过程中控制体积为 1 mL。" })
    ]);

    expect(similarity).toBeGreaterThanOrEqual(0.8);
    expect(result.duplicatePairs).toEqual([
      expect.objectContaining({
        reqA: "REQ-A",
        reqB: "REQ-B",
        method: "jaccard"
      })
    ]);
    expect(result.duplicatePairs[0]?.similarity).toBeGreaterThanOrEqual(0.8);
  });

  it("uses an optional LLM semantic layer for low-text-similarity duplicates", async () => {
    const client = new ScriptedClient([JSON.stringify({ is_duplicate: true, reasoning: "same controlled cooling intent" })]);

    const result = await checkRequirementDeduplication(
      [
        makeRequirement({
          requirementId: "REQ-A",
          type: "R4",
          fingerprint: "fp-a",
          description: "设备应维持转子腔 2-8°C 低温环境。",
          sourceHyperedges: ["H-OP-001"]
        }),
        makeRequirement({
          requirementId: "REQ-B",
          type: "R4",
          fingerprint: "fp-b",
          description: "离心模块需保证样本处于冷链条件。",
          sourceHyperedges: ["H-OP-001"]
        })
      ],
      { client }
    );

    expect(result.duplicatePairs).toEqual([
      {
        reqA: "REQ-A",
        reqB: "REQ-B",
        method: "semantic",
        similarity: 1,
        reasoning: "same controlled cooling intent"
      }
    ]);
    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]).toContain("source_hyperedge");
  });

  it("treats semantic provider output as optional untrusted input", async () => {
    const client = new ScriptedClient([new Error("provider unavailable")]);

    const result = await checkRequirementDeduplication(
      [
        makeRequirement({ requirementId: "REQ-A", fingerprint: "fp-a", description: "设备应控制温度。" }),
        makeRequirement({ requirementId: "REQ-B", fingerprint: "fp-b", description: "系统需要具备记录能力。" })
      ],
      { client, retries: 0 }
    );

    expect(result.duplicatePairs).toEqual([]);
    expect(result.mergedCount).toBe(0);
  });
});

class ScriptedClient implements LlmClient {
  readonly calls: string[] = [];

  constructor(private readonly responses: Array<string | Error>) {}

  async complete(prompt: string): Promise<string> {
    this.calls.push(prompt);
    const response = this.responses.shift();
    if (response instanceof Error) throw response;
    return response ?? JSON.stringify({ is_duplicate: false });
  }
}

function makeRequirement(overrides: Partial<Requirement>): Requirement {
  return {
    requirementId: "REQ-001",
    type: "R1",
    description: "设备应执行测试操作。",
    sourceOps: ["OP-001"],
    sourceHyperedges: ["H-OP-001"],
    sourceFields: ["Action"],
    applicableTo: "样本",
    keyMetrics: [],
    constraints: [],
    relatedRisks: [],
    responsibleModule: "test",
    verificationMethod: "功能测试",
    priority: "medium",
    status: "confirmed",
    inferenceRule: "test",
    confidence: 1,
    fingerprint: "fp",
    ...overrides
  };
}
