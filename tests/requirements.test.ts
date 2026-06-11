import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { loadKnowledgeBase } from "../src/knowledge/loader.js";
import { atomizeSop } from "../src/pipeline/atomizer/index.js";
import { buildHypergraph } from "../src/pipeline/hypergraph/index.js";
import {
  createRequirementFingerprint,
  generateRequirements
} from "../src/pipeline/requirements/index.js";
import type { OpTable, RequirementType } from "../src/pipeline/types.js";

describe("requirement direct mappings", () => {
  it("generates traceable R1-R10 requirements from the sample hypergraph", async () => {
    const sop = await readFile("tests/fixtures/sample-sop-cell-collection.txt", "utf8");
    const opTable = await atomizeSop(sop, { sopId: "SOP-CellCollection-001", sopName: "Cell Collection" });
    const hypergraph = buildHypergraph(opTable);

    const table = generateRequirements(hypergraph);
    const generatedTypes = new Set(table.requirements.map((requirement) => requirement.type));

    expect([...generatedTypes]).toEqual(expect.arrayContaining<RequirementType>(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]));
    expect(table.requirements.every((requirement) => requirement.sourceHyperedges.length > 0)).toBe(true);
    expect(table.requirements.every((requirement) => requirement.fingerprint === createRequirementFingerprint(requirement))).toBe(true);
    expect(
      table.requirements.some(
        (requirement) =>
          requirement.type === "R3" &&
          requirement.description.includes("4°C") &&
          requirement.description.includes("5000g") &&
          requirement.description.includes("10 min") &&
          requirement.sourceHyperedges.includes("H-OP-002")
      )
    ).toBe(true);
  });
});

describe("requirement fingerprint deduplication", () => {
  it("merges duplicate direct mappings and preserves every source hyperedge", () => {
    const opTable: OpTable = {
      sopId: "SOP-Dedup",
      sopName: "Dedup",
      ops: [
        makeOp("OP-001", "加入 PBS", "加液", ["PBS"], "细胞"),
        makeOp("OP-002", "加入 PBS", "加液", ["PBS"], "细胞")
      ]
    };

    const table = generateRequirements(buildHypergraph(opTable));
    const addLiquidRequirements = table.requirements.filter(
      (requirement) => requirement.type === "R1" && requirement.description.includes("加液")
    );

    expect(addLiquidRequirements).toHaveLength(1);
    expect(addLiquidRequirements[0].sourceHyperedges).toEqual(["H-OP-001", "H-OP-002"]);
  });
});

describe("requirement domain patterns", () => {
  it("creates clarifications when centrifuge operations omit required domain parameters", () => {
    const opTable: OpTable = {
      sopId: "SOP-Centrifuge-Missing",
      sopName: "Centrifuge Missing",
      ops: [makeOp("OP-001", "离心细胞悬液", "离心", ["细胞悬液"], "细胞悬液")]
    };

    const table = generateRequirements(buildHypergraph(opTable));

    expect(table.clarifications.map((item) => item.question).join("\n")).toContain("离心力");
    expect(table.clarifications[0].sourceHyperedges).toEqual(["H-OP-001"]);
  });

  it("applies required parameters to non-centrifuge actions and skips complete operations", () => {
    const knowledge = loadKnowledgeBase();
    const opTable: OpTable = {
      sopId: "SOP-Add-Liquid-Parameters",
      sopName: "Add Liquid Parameters",
      ops: [
        makeOp("OP-001", "加入 1 mL PBS", "加液", ["PBS"], "细胞", [
          { name: "体积", value: 1, unit: "mL", rawText: "1 mL", status: "specified" }
        ]),
        makeOp("OP-002", "以 2 mL/s 加入 1 mL PBS", "加液", ["PBS"], "细胞", [
          { name: "体积", value: 1, unit: "mL", rawText: "1 mL", status: "specified" },
          { name: "流速", value: 2, unit: "mL/s", rawText: "2 mL/s", status: "specified" }
        ])
      ]
    };

    const table = generateRequirements(buildHypergraph(opTable, knowledge), knowledge);

    expect(table.clarifications).toHaveLength(1);
    expect(table.clarifications[0].question).toContain("加液操作缺少流速参数");
    expect(table.clarifications[0].sourceHyperedges).toEqual(["H-OP-001"]);
  });
});

function makeOp(
  opId: string,
  sourceText: string,
  action: string,
  inputs: string[],
  target: string,
  parameters: OpTable["ops"][number]["parameters"] = []
): OpTable["ops"][number] {
  return {
    opId,
    sourceText,
    parentStep: "步骤 1",
    operationName: sourceText,
    action,
    precondition: "未说明",
    inputs,
    target,
    container: [],
    location: "超净台",
    tools: [],
    outputState: "完成操作",
    parameters,
    conditions: [],
    humanJudgment: { required: false, content: "无", basis: "无" },
    risks: []
  };
}
