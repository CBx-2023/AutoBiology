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
});

function makeRequirement(requirementId: string, applicableTo: string, responsibleModule: string) {
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
    fingerprint: requirementId
  };
}
