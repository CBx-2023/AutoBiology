import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "../src/knowledge/loader.js";
import { verifyTraceability } from "../src/pipeline/review/traceability.js";
import type { Hyperedge, Requirement, RequirementTable, RequirementType } from "../src/pipeline/types.js";

describe("review traceability verifier", () => {
  it("reports OPs without requirements and domain-pattern type gaps", () => {
    const report = verifyTraceability(
      makeTable([
        makeRequirement({ requirementId: "REQ-R1", type: "R1", sourceOps: ["OP-001"], sourceHyperedges: ["H-OP-001"] }),
        makeRequirement({ requirementId: "REQ-R3", type: "R3", sourceOps: ["OP-001"], sourceHyperedges: ["H-OP-001"] })
      ]),
      {
        hyperedges: [
          makeHyperedge({ hyperedgeId: "H-OP-001", sourceOp: "OP-001", operationName: "加液", sourceText: "加液 1 mL。" }),
          makeHyperedge({ hyperedgeId: "H-OP-002", sourceOp: "OP-002", operationName: "离心", sourceText: "离心 5 min。" })
        ]
      },
      loadKnowledgeBase()
    );

    const h1Coverage = report.hyperedgeCoverage.find((row) => row.hyperedgeId === "H-OP-001");

    expect(report.opsWithoutRequirements).toEqual(["OP-002"]);
    expect(h1Coverage?.expectedTypes).toEqual(["R1", "R2", "R3", "R7", "R9"]);
    expect(h1Coverage?.actualTypes).toEqual(["R1", "R3"]);
    expect(h1Coverage?.gaps).toEqual(["R2", "R7", "R9"]);
    expect(report.forwardCoverage).toBe(0.5);
  });

  it("reports requirements without any valid OP or hyperedge source", () => {
    const report = verifyTraceability(
      makeTable([
        makeRequirement({ requirementId: "REQ-VALID", sourceOps: ["OP-001"], sourceHyperedges: ["H-OP-001"] }),
        makeRequirement({ requirementId: "REQ-BAD", sourceOps: ["OP-999"], sourceHyperedges: ["H-OP-999"] })
      ]),
      {
        hyperedges: [makeHyperedge({ hyperedgeId: "H-OP-001", sourceOp: "OP-001", operationName: "加液" })]
      },
      loadKnowledgeBase()
    );

    expect(report.requirementsWithoutOps).toEqual(["REQ-BAD"]);
    expect(report.backwardCoverage).toBe(0.5);
  });

  it("uses empty expectations for unknown actions without adding false gaps", () => {
    const report = verifyTraceability(
      makeTable([makeRequirement({ requirementId: "REQ-UNKNOWN", type: "R1", sourceOps: ["OP-001"], sourceHyperedges: ["H-OP-001"] })]),
      {
        hyperedges: [makeHyperedge({ hyperedgeId: "H-OP-001", sourceOp: "OP-001", operationName: "未知动作" })]
      },
      loadKnowledgeBase()
    );

    expect(report.hyperedgeCoverage).toEqual([
      {
        hyperedgeId: "H-OP-001",
        expectedTypes: [],
        actualTypes: ["R1"],
        gaps: []
      }
    ]);
    expect(report.forwardCoverage).toBe(1);
    expect(report.backwardCoverage).toBe(1);
  });
});

function makeTable(requirements: Requirement[]): RequirementTable {
  return { requirements, clarifications: [] };
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
  hyperedgeId: string;
  sourceOp: string;
  operationName: string;
  sourceText?: string;
}): Hyperedge {
  return {
    hyperedgeId: overrides.hyperedgeId,
    hyperedgeType: "OperationHyperedge",
    sourceOp: overrides.sourceOp,
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
