import { describe, expect, it } from "vitest";
import { scoreRequirementQuality, scoreRequirementTableQuality } from "../src/pipeline/review/quality-scorer.js";
import type { Requirement } from "../src/pipeline/types.js";

describe("review quality scorer", () => {
  it("scores specific, testable, traceable engineering requirements higher than vague requirements", () => {
    const good = makeRequirement({
      requirementId: "REQ-GOOD",
      description: "设备应在离心过程中将转子腔温度控制在 2-8°C 范围内，精度±1°C，并通过温度记录验证。",
      sourceOps: ["OP-001"],
      sourceHyperedges: ["H-OP-001"],
      sourceFields: ["Action", "Parameter", "Condition"],
      keyMetrics: ["2-8°C", "±1°C"],
      constraints: ["低温"],
      verificationMethod: "温度记录验证"
    });
    const vague = makeRequirement({
      requirementId: "REQ-BAD",
      description: "设备应处理未说明内容。",
      sourceOps: [],
      sourceHyperedges: [],
      sourceFields: [],
      keyMetrics: [],
      constraints: [],
      verificationMethod: "未说明"
    });

    const goodScore = scoreRequirementQuality(good);
    const vagueScore = scoreRequirementQuality(vague);

    expect(goodScore.overall).toBeGreaterThan(0.8);
    expect(vagueScore.overall).toBeLessThan(0.45);
    expect(goodScore.issues).toHaveLength(0);
    expect(vagueScore.issues).toEqual(
      expect.arrayContaining([
        "missing verification method or measurable acceptance evidence",
        "missing traceability fields: sourceOps, sourceHyperedges, sourceFields",
        "description contains underspecified placeholder text"
      ])
    );
  });

  it("uses the specified weighted overall formula", () => {
    const score = scoreRequirementQuality(
      makeRequirement({
        description: "设备应在加液过程中控制体积为 1 mL，精度±2%，并通过重量法验证。",
        sourceOps: ["OP-001"],
        sourceHyperedges: [],
        sourceFields: ["Parameter"],
        keyMetrics: ["1 mL", "±2%"],
        constraints: []
      })
    );
    const expected =
      0.3 * score.dimensions.testability +
      0.25 * score.dimensions.specificity +
      0.2 * score.dimensions.traceability +
      0.25 * score.dimensions.engineeringSemantic;

    expect(score.overall).toBeCloseTo(expected, 6);
    expect(score.dimensions.traceability).toBeGreaterThan(0);
    expect(score.dimensions.traceability).toBeLessThan(1);
  });

  it("scores a requirement table in order", () => {
    const requirements = [
      makeRequirement({ requirementId: "REQ-001", description: "设备应执行离心操作。" }),
      makeRequirement({ requirementId: "REQ-002", description: "设备应记录离心时间 10 min，并通过日志验证。" })
    ];

    expect(scoreRequirementTableQuality({ requirements, clarifications: [] }).map((score) => score.requirementId)).toEqual([
      "REQ-001",
      "REQ-002"
    ]);
  });
});

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
