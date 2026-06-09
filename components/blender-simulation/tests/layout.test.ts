import { describe, expect, it } from "vitest";
import { computeInitialLayout, parseRequirementTable } from "../src/index.js";

describe("Blender simulation layout setup", () => {
  it("computes distinct XY coordinates for assets required by requirements", () => {
    const table = parseRequirementTable({
      requirements: [
        makeRequirement("REQ-001", "plate_96", "liquid-handling"),
        makeRequirement("REQ-002", "tube_rack", "temperature-control"),
        makeRequirement("REQ-003", "pipette", "liquid-handling")
      ],
      clarifications: []
    });

    const layout = computeInitialLayout(table, { spacing: 2, columns: 2 });

    expect(layout.assets.map((asset) => asset.assetId)).toEqual([
      "plate_96",
      "tube_rack",
      "pipette",
      "liquid-handling",
      "temperature-control"
    ]);
    expect(new Set(layout.assets.map((asset) => `${asset.location.x},${asset.location.y}`)).size).toBe(
      layout.assets.length
    );
    expect(layout.assets[0].location).toEqual({ x: 0, y: 0, z: 0 });
    expect(layout.assets[1].location).toEqual({ x: 2, y: 0, z: 0 });
    expect(layout.assets[2].location).toEqual({ x: 0, y: 2, z: 0 });
  });

  it("deduplicates assets while preserving first-seen order", () => {
    const table = parseRequirementTable({
      requirements: [
        makeRequirement("REQ-001", "plate_96", "liquid-handling"),
        makeRequirement("REQ-002", "plate_96", "liquid-handling")
      ],
      clarifications: []
    });

    expect(computeInitialLayout(table).assets.map((asset) => asset.assetId)).toEqual([
      "plate_96",
      "liquid-handling"
    ]);
  });
});

function makeRequirement(requirementId: string, applicableTo: string, responsibleModule: string) {
  return {
    requirementId,
    type: "R1",
    description: "layout asset",
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
