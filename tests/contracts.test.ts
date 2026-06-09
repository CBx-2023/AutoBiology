import { describe, expect, it } from "vitest";
import type { Hyperedge, Op, Requirement } from "../src/pipeline/types.js";

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
      fingerprint: "R1|加液|样本"
    };

    expect(requirement.sourceHyperedges).toEqual(["H-OP-001"]);
  });
});
