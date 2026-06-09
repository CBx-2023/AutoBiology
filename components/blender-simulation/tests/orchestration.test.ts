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
    expect(plan.moves[0].keyframes.map((keyframe) => keyframe.frame)).toEqual([1, 4, 7, 10]);
    expect(plan.liquidScales[0].keyframes.map((keyframe) => keyframe.frame)).toEqual([10, 22]);
    expect(plan.endFrame).toBe(22);
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
