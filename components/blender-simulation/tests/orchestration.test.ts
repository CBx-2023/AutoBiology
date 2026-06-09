import { describe, expect, it } from "vitest";
import { buildSimulationScript, createSimulationPlan, parseRequirementTable } from "../src/index.js";

describe("Blender simulation orchestration", () => {
  it("creates a complete simulation plan from parsed requirements", () => {
    const table = parseRequirementTable({
      requirements: [
        makeRequirement("REQ-001", "plate_96", "liquid-handling"),
        makeRequirement("REQ-002", "well_liquid", "liquid-handling")
      ],
      clarifications: []
    });

    const plan = createSimulationPlan(table, {
      layout: { spacing: 2, columns: 2 },
      safeZ: 10,
      moveDurationFrames: 9,
      liquidDurationFrames: 12
    });

    expect(plan.layout.assets.map((asset) => asset.assetId)).toEqual([
      "plate_96",
      "well_liquid",
      "liquid-handling"
    ]);
    expect(plan.moves.map((move) => move.keyframes.map((keyframe) => keyframe.frame))).toEqual([
      [1, 4, 7, 10],
      [10, 13, 16, 19]
    ]);
    expect(plan.liquidScales[0].keyframes.map((keyframe) => keyframe.frame)).toEqual([19, 31]);
    expect(plan.endFrame).toBe(31);
  });

  it("builds Blender Python for layout objects and macro keyframes", () => {
    const table = parseRequirementTable({
      requirements: [makeRequirement("REQ-001", "well_liquid", "liquid-handling")],
      clarifications: []
    });
    const script = buildSimulationScript(createSimulationPlan(table));

    expect(script).toContain("bpy.ops.wm.read_homefile(use_empty=True)");
    expect(script).toContain("well_liquid");
    expect(script).toContain("SIMULATION_LAYOUT_ASSETS:");
    expect(script).toContain("SAFETY_Z_LIFT:liquid-handling:");
    expect(script).toContain("LIQUID_SCALE:well_liquid:");
    expect(script).toContain("SIMULATION_COMPLETE:");
    expect(script).toContain("(-0.25, -0.25, 0.2)");
    expect(script).toContain("(4, 5, 6, 7)");
  });

  it("iterates every actionable requirement into deterministic timeline steps", () => {
    const table = parseRequirementTable({
      requirements: [
        makeRequirement("REQ-001", "plate_96", "liquid-handling"),
        makeRequirement("REQ-002", "tube_rack", "liquid-handling"),
        makeRequirement("REQ-003", "well_liquid", "liquid-handling"),
        makeRequirement("REQ-004", "waste_bin", "liquid-handling")
      ],
      clarifications: []
    });

    const plan = createSimulationPlan(table, {
      layout: { spacing: 2, columns: 3 },
      safeZ: 10,
      moveDurationFrames: 9,
      liquidDurationFrames: 12
    });

    expect(plan.moves).toHaveLength(4);
    expect(plan.moves.map((move) => move.range)).toEqual([
      { startFrame: 1, endFrame: 10, durationFrames: 9 },
      { startFrame: 10, endFrame: 19, durationFrames: 9 },
      { startFrame: 19, endFrame: 28, durationFrames: 9 },
      { startFrame: 40, endFrame: 49, durationFrames: 9 }
    ]);
    expect(plan.liquidScales).toHaveLength(1);
    expect(plan.liquidScales[0].range).toEqual({ startFrame: 28, endFrame: 40, durationFrames: 12 });
    expect(plan.endFrame).toBe(49);
  });

  it("maps Chinese liquid handling and mixing requirements into liquid scale macros", () => {
    const table = parseRequirementTable({
      requirements: [
        makeRequirement("REQ-001", "细胞悬液", "operation-execution", {
          description: "设备应能够执行转移操作，适用对象为细胞悬液。",
          verificationMethod: "转移功能测试"
        }),
        makeRequirement("REQ-002", "上清", "operation-execution", {
          description: "设备应能够执行弃液操作，适用对象为上清。",
          verificationMethod: "弃液功能测试"
        }),
        makeRequirement("REQ-003", "细胞沉淀", "operation-execution", {
          description: "设备应能够完成混匀或重悬操作。",
          verificationMethod: "混匀功能测试"
        })
      ],
      clarifications: []
    });

    const plan = createSimulationPlan(table, {
      layout: { spacing: 2, columns: 2 },
      safeZ: 10,
      moveDurationFrames: 3,
      liquidDurationFrames: 3
    });

    expect(plan.liquidScales.map((scale) => scale.objectName)).toEqual(["细胞悬液", "上清", "细胞沉淀"]);
  });

  it("does not treat generic state transition, placement, or centrifuge checks as liquid macros", () => {
    const table = parseRequirementTable({
      requirements: [
        makeRequirement("REQ-001", "离心管", "workflow-orchestration", {
          description: "设备应记录将离心管置于冷冻离心机中的状态变化。",
          verificationMethod: "状态转移测试"
        }),
        makeRequirement("REQ-002", "冷冻离心机", "parameter-control", {
          description: "设备应能够执行离心参数控制。",
          verificationMethod: "离心功能测试",
          constraints: ["形成细胞沉淀和上清"]
        }),
        makeRequirement("REQ-003", "离心管", "operation-execution", {
          description: "设备应能够完成放置操作。",
          verificationMethod: "放置功能测试"
        })
      ],
      clarifications: []
    });

    const plan = createSimulationPlan(table, {
      layout: { spacing: 2, columns: 2 },
      safeZ: 10,
      moveDurationFrames: 3,
      liquidDurationFrames: 3
    });

    expect(plan.liquidScales).toHaveLength(0);
  });
});

function makeRequirement(requirementId: string, applicableTo: string, responsibleModule: string, overrides: Record<string, unknown> = {}) {
  return {
    requirementId,
    type: "R1",
    description: "simulate action",
    sourceOps: ["OP-001"],
    sourceHyperedges: ["H-OP-001"],
    sourceFields: ["Action"],
    applicableTo,
    keyMetrics: [],
    constraints: [],
    relatedRisks: [],
    responsibleModule,
    verificationMethod: "simulation",
    priority: "high",
    status: "candidate",
    inferenceRule: "DM-R1",
    confidence: 1,
    fingerprint: requirementId,
    ...overrides
  };
}
