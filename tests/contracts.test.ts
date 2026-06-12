import { describe, expect, it } from "vitest";
import type {
  DedupResult,
  Hyperedge,
  Op,
  QualityScore,
  Requirement,
  RiskCoverageReport,
  TraceabilityReport,
  VerificationReport
} from "../src/pipeline/types.js";

describe("pipeline contracts", () => {
  it("allows the operation, hyperedge, and requirement contracts from the design spec", () => {
    const op: Op = {
      opId: "OP-001",
      sourceText: "加入 1 mL PBS",
      parentStep: "sample prep",
      operationName: "加入 PBS",
      action: "加液",
      precondition: "未说明",
      inputs: ["PBS"],
      target: "样本",
      container: ["离心管"],
      location: "超净台",
      tools: ["移液枪"],
      outputState: "完成加液",
      parameters: [{ name: "体积", value: 1, unit: "mL", rawText: "1 mL", status: "specified" }],
      conditions: ["无菌"],
      humanJudgment: { required: false, content: "无", basis: "无" },
      risks: [{ name: "污染", source: "expert", handling: "无菌操作" }]
    };

    const hyperedge: Hyperedge = {
      hyperedgeId: "H-OP-001",
      hyperedgeType: "OperationHyperedge",
      sourceOp: op.opId,
      sourceSop: "SOP-001",
      sourceText: op.sourceText,
      parentStep: op.parentStep,
      connectedNodes: ["ACT-001"],
      nodeRoles: {
        Action: ["ACT-001"],
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
        operationName: op.operationName,
        isManualJudgmentRequired: false,
        automationRelevance: "high"
      },
      notes: ""
    };

    const requirement: Requirement = {
      requirementId: "REQ-001",
      type: "R1",
      description: "设备应能够执行加液操作。",
      sourceOps: [op.opId],
      sourceHyperedges: [hyperedge.hyperedgeId],
      sourceFields: ["Action"],
      applicableTo: "样本",
      keyMetrics: [],
      constraints: [],
      relatedRisks: [],
      responsibleModule: "liquid-handling",
      verificationMethod: "加液功能测试",
      priority: "high",
      status: "candidate",
      inferenceRule: "DM-R1",
      confidence: 1,
      reasoning: "基于 H-OP-001 的 Action 字段生成。",
      fingerprint: "R1|加液|样本"
    };

    expect(requirement.sourceHyperedges).toEqual(["H-OP-001"]);
    expect(requirement.reasoning).toContain("H-OP-001");
  });

  it("allows the verification report contracts from the intelligence spec", () => {
    const quality: QualityScore = {
      requirementId: "REQ-001",
      dimensions: {
        testability: 1,
        specificity: 0.8,
        traceability: 1,
        engineeringSemantic: 0.75
      },
      overall: 0.8875,
      issues: []
    };
    const dedupResult: DedupResult = {
      duplicatePairs: [
        {
          reqA: "REQ-001",
          reqB: "REQ-002",
          method: "jaccard",
          similarity: 0.85,
          reasoning: "normalized descriptions overlap"
        }
      ],
      mergedCount: 1
    };
    const riskCoverage: RiskCoverageReport = {
      coveredRisks: [{ risk: "污染", coveredBy: ["REQ-003"] }],
      uncoveredRisks: [{ risk: "配平失败", expectedForActions: ["离心"], severity: "high" }],
      coverageRate: 0.5,
      warnings: ["高严重度风险 配平失败 未被任何 R7/R8 需求覆盖"]
    };
    const traceability: TraceabilityReport = {
      opsWithoutRequirements: ["OP-009"],
      requirementsWithoutOps: ["REQ-010"],
      hyperedgeCoverage: [
        {
          hyperedgeId: "H-OP-001",
          expectedTypes: ["R1", "R7"],
          actualTypes: ["R1"],
          gaps: ["R7"]
        }
      ],
      forwardCoverage: 0.9,
      backwardCoverage: 0.95
    };
    const report: VerificationReport = {
      qualityScores: [quality],
      averageQuality: quality.overall,
      dedupResult,
      riskCoverage,
      traceability,
      overallAssessment: "warn",
      summary: "Quality is acceptable with traceability warnings."
    };

    expect(report.dedupResult.duplicatePairs[0].method).toBe("jaccard");
    expect(report.overallAssessment).toBe("warn");
  });
});
