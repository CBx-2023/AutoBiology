import { describe, expect, it } from "vitest";
import { loadKnowledgeBase, type KnowledgeBase } from "../src/knowledge/loader.js";
import { verifyRequirements } from "../src/pipeline/review/verification.js";
import type { Hyperedge, Requirement, RequirementTable } from "../src/pipeline/types.js";

describe("review unified verification report", () => {
  it("passes when quality, risk coverage, and forward traceability meet thresholds", async () => {
    const knowledge: KnowledgeBase = { ...loadKnowledgeBase(), riskCatalog: {} };
    const report = await verifyRequirements(makeTable([goodRequirement("REQ-GOOD")]), {
      hyperedges: { hyperedges: [makeHyperedge({ operationName: "未知动作" })] },
      knowledge
    });

    expect(report.averageQuality).toBeGreaterThanOrEqual(0.7);
    expect(report.dedupResult.duplicatePairs).toEqual([]);
    expect(report.riskCoverage.uncoveredRisks).toEqual([]);
    expect(report.traceability.forwardCoverage).toBe(1);
    expect(report.overallAssessment).toBe("pass");
    expect(report.summary).toContain("pass");
  });

  it("warns when quality is acceptable but forward traceability is below pass threshold", async () => {
    const knowledge: KnowledgeBase = { ...loadKnowledgeBase(), riskCatalog: {} };
    const report = await verifyRequirements(makeTable([goodRequirement("REQ-GOOD")]), {
      hyperedges: {
        hyperedges: [
          makeHyperedge({ hyperedgeId: "H-OP-001", sourceOp: "OP-001", operationName: "未知动作" }),
          makeHyperedge({ hyperedgeId: "H-OP-002", sourceOp: "OP-002", operationName: "未知动作" })
        ]
      },
      knowledge
    });

    expect(report.averageQuality).toBeGreaterThanOrEqual(0.7);
    expect(report.traceability.forwardCoverage).toBe(0.5);
    expect(report.overallAssessment).toBe("warn");
  });

  it("fails when quality is low or high-severity uncovered risks reach the fail threshold", async () => {
    const lowQuality = await verifyRequirements(makeTable([badRequirement("REQ-BAD")]), {
      hyperedges: { hyperedges: [makeHyperedge({ operationName: "未知动作" })] },
      knowledge: { ...loadKnowledgeBase(), riskCatalog: {} }
    });
    const highRisk = await verifyRequirements(makeTable([]), {
      hyperedges: { hyperedges: [makeHyperedge({ operationName: "加液", sourceText: "加液 1 mL。" })] },
      knowledge: loadKnowledgeBase()
    });

    expect(lowQuality.averageQuality).toBeLessThan(0.4);
    expect(lowQuality.overallAssessment).toBe("fail");
    expect(highRisk.riskCoverage.uncoveredRisks.filter((risk) => risk.severity === "high").length).toBeGreaterThanOrEqual(3);
    expect(highRisk.overallAssessment).toBe("fail");
  });
});

function makeTable(requirements: Requirement[]): RequirementTable {
  return { requirements, clarifications: [] };
}

function goodRequirement(requirementId: string): Requirement {
  return makeRequirement({
    requirementId,
    description: "设备应在加液过程中控制体积为 1 mL，精度±2%，并通过重量法验证。",
    keyMetrics: ["1 mL", "±2%"],
    constraints: ["闭环体积控制"],
    verificationMethod: "重量法验证"
  });
}

function badRequirement(requirementId: string): Requirement {
  return makeRequirement({
    requirementId,
    description: "设备应处理未说明内容。",
    sourceOps: [],
    sourceHyperedges: [],
    sourceFields: [],
    keyMetrics: [],
    constraints: [],
    verificationMethod: "未说明"
  });
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

function makeHyperedge(overrides: {
  hyperedgeId?: string;
  sourceOp?: string;
  operationName: string;
  sourceText?: string;
}): Hyperedge {
  return {
    hyperedgeId: overrides.hyperedgeId ?? "H-OP-001",
    hyperedgeType: "OperationHyperedge",
    sourceOp: overrides.sourceOp ?? "OP-001",
    sourceSop: "SOP-001",
    sourceText: overrides.sourceText ?? overrides.operationName,
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
      operationName: overrides.operationName,
      isManualJudgmentRequired: false,
      automationRelevance: "high"
    },
    notes: ""
  };
}
