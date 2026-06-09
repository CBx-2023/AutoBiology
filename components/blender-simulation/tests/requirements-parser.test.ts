import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadRequirementTable, parseRequirementTable } from "../src/index.js";

describe("Blender simulation requirements parser", () => {
  it("parses AutoBiology 04-requirements.json into component-owned requirement records", () => {
    const table = parseRequirementTable({
      requirements: [
        {
          requirementId: "REQ-001",
          type: "R1",
          description: "设备应执行加液动作",
          sourceOps: ["OP-001"],
          sourceHyperedges: ["H-OP-001"],
          sourceFields: ["Action"],
          applicableTo: "plate_96",
          keyMetrics: ["100 uL"],
          constraints: [],
          relatedRisks: [],
          responsibleModule: "liquid-handling",
          verificationMethod: "simulation",
          priority: "high",
          status: "confirmed",
          inferenceRule: "DM-R1",
          confidence: 1,
          fingerprint: "R1|加液|plate_96"
        }
      ],
      clarifications: []
    });

    expect(table.requirements).toHaveLength(1);
    expect(table.requirements[0]).toMatchObject({
      requirementId: "REQ-001",
      type: "R1",
      description: "设备应执行加液动作",
      sourceOps: ["OP-001"],
      sourceHyperedges: ["H-OP-001"],
      applicableTo: "plate_96"
    });
    expect(table.requirements[0].keyMetrics).toEqual(["100 uL"]);
  });

  it("loads a requirement table from disk", async () => {
    const dir = await mkdtemp(join(tmpdir(), "blender-requirements-"));
    const path = join(dir, "04-requirements.json");

    try {
      await writeFile(
        path,
        JSON.stringify({
          requirements: [
            {
              requirementId: "REQ-002",
              type: "R3",
              description: "维持 4 C",
              sourceOps: ["OP-002"],
              sourceHyperedges: ["H-OP-002"],
              sourceFields: ["Parameter"],
              applicableTo: "tube",
              keyMetrics: [],
              constraints: ["4 C"],
              relatedRisks: [],
              responsibleModule: "temperature-control",
              verificationMethod: "simulation",
              priority: "medium",
              status: "candidate",
              inferenceRule: "DM-R3",
              confidence: 0.8,
              fingerprint: "R3|temperature|tube"
            }
          ],
          clarifications: []
        }),
        "utf8"
      );

      const table = await loadRequirementTable(path);

      expect(table.requirements[0].requirementId).toBe("REQ-002");
      expect(table.requirements[0].constraints).toEqual(["4 C"]);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("rejects malformed requirement tables", () => {
    expect(() => parseRequirementTable({ requirements: [{ requirementId: "REQ-BAD" }] })).toThrow(
      /Invalid requirement/
    );
    expect(() => parseRequirementTable({ requirements: "not-array" })).toThrow(/requirements must be an array/);
  });
});
