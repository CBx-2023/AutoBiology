import { describe, expect, it } from "vitest";
import { loadKnowledgeBase, type KnowledgeBase } from "../src/knowledge/loader.js";
import { verifyRiskCoverage } from "../src/pipeline/review/risk-coverage.js";
import type { Hyperedge, Requirement, RequirementTable } from "../src/pipeline/types.js";

describe("review risk coverage verifier", () => {
  it("reports covered and uncovered risk catalog entries for an action", () => {
    const knowledge = loadKnowledgeBase();
    const hyperedge = makeHyperedge({ sourceText: "向样本中加液 1 mL。", operationName: "加液" });
    const table = makeTable([
      makeRequirement({
        requirementId: "REQ-R7-POLLUTION",
        type: "R7",
        sourceHyperedges: ["H-OP-001"],
        relatedRisks: ["污染"],
        description: "设备应在加液过程中控制污染风险。"
      })
    ]);

    const report = verifyRiskCoverage(table, { hyperedges: [hyperedge] }, knowledge);

    expect(report.coveredRisks).toContainEqual({ risk: "污染", coveredBy: ["REQ-R7-POLLUTION"] });
    expect(report.uncoveredRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ risk: "交叉污染", expectedForActions: ["加液"], severity: "high" }),
        expect.objectContaining({ risk: "体积误差", expectedForActions: ["加液"], severity: "high" })
      ])
    );
    expect(report.coverageRate).toBeGreaterThan(0);
    expect(report.coverageRate).toBeLessThan(1);
    expect(report.warnings).toEqual(expect.arrayContaining([expect.stringContaining('高严重度风险 "交叉污染" 未被任何 R7/R8 需求覆盖')]));
  });

  it("allows R8 descriptions to cover a risk without relatedRisks metadata", () => {
    const knowledge = loadKnowledgeBase();
    const hyperedge = makeHyperedge({ sourceText: "弃液并保护细胞沉淀。", operationName: "弃液" });
    const table = makeTable([
      makeRequirement({
        requirementId: "REQ-R8-PELLET",
        type: "R8",
        sourceHyperedges: ["H-OP-001"],
        relatedRisks: [],
        description: "设备应在弃液异常时执行沉淀丢失恢复流程。"
      })
    ]);

    const report = verifyRiskCoverage(table, { hyperedges: [hyperedge] }, knowledge);

    expect(report.coveredRisks).toContainEqual({ risk: "沉淀丢失", coveredBy: ["REQ-R8-PELLET"] });
  });

  it("returns full coverage when no risk catalog entry is expected", () => {
    const knowledge: KnowledgeBase = { ...loadKnowledgeBase(), riskCatalog: {} };
    const report = verifyRiskCoverage(makeTable([]), { hyperedges: [makeHyperedge({ operationName: "未知动作" })] }, knowledge);

    expect(report.coveredRisks).toEqual([]);
    expect(report.uncoveredRisks).toEqual([]);
    expect(report.coverageRate).toBe(1);
    expect(report.warnings).toEqual([]);
  });
});

function makeTable(requirements: Requirement[]): RequirementTable {
  return { requirements, clarifications: [] };
}

function makeRequirement(overrides: Partial<Requirement>): Requirement {
  return {
    requirementId: "REQ-001",
    type: "R7",
    description: "设备应控制测试风险。",
    sourceOps: ["OP-001"],
    sourceHyperedges: ["H-OP-001"],
    sourceFields: ["Risk"],
    applicableTo: "样本",
    keyMetrics: [],
    constraints: [],
    relatedRisks: [],
    responsibleModule: "test",
    verificationMethod: "风险控制验证",
    priority: "high",
    status: "confirmed",
    inferenceRule: "test",
    confidence: 1,
    fingerprint: "fp",
    ...overrides
  };
}

function makeHyperedge(overrides: { sourceText?: string; operationName?: string }): Hyperedge {
  return {
    hyperedgeId: "H-OP-001",
    hyperedgeType: "OperationHyperedge",
    sourceOp: "OP-001",
    sourceSop: "SOP-001",
    sourceText: overrides.sourceText ?? "执行测试动作。",
    parentStep: "1",
    connectedNodes: [],
    nodeRoles: {
      Action: [],
      Precondition: [],
      Input: [],
      Target: [],
      Container: [],
      Location: [],
      Tool: [],
      OutputState: [],
      Parameter: [],
      Condition: [],
      HumanJudgment: [],
      Risk: [],
      Handling: []
    },
    missingInfo: [],
    expertSupplement: [],
    attributes: {
      operationName: overrides.operationName ?? "测试动作",
      isManualJudgmentRequired: false,
      automationRelevance: "high"
    },
    notes: ""
  };
}
