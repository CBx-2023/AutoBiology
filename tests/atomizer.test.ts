import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import {
  atomizeSop,
  buildExtractOpPrompt,
  splitSopIntoOperationChunks
} from "../src/pipeline/atomizer/index.js";

describe("atomizer rules engine", () => {
  it("splits consecutive actions and standardizes action verbs", () => {
    const chunks = splitSopIntoOperationChunks("吸去上清，加入 PBS，吹打重悬细胞。");

    expect(chunks.map((chunk) => chunk.action)).toEqual(["吸液", "加液", "重悬"]);
    expect(chunks.map((chunk) => chunk.sourceText)).toEqual(["吸去上清", "加入 PBS", "吹打重悬细胞"]);
  });

  it("expands common composite SOP verbs into automation-relevant operations", () => {
    const chunks = splitSopIntoOperationChunks("更换培养基。PBS 洗涤 3 次。");

    expect(chunks.map((chunk) => chunk.action)).toEqual(["吸液", "加液", "加液", "混匀", "吸液"]);
    expect(chunks[2].parentStep).toContain("循环 3 次");
  });
});

describe("atomizer OpTable generation", () => {
  it("converts a sample SOP into a valid OpTable with extracted parameters", async () => {
    const sop = await readFile("tests/fixtures/sample-sop-cell-collection.txt", "utf8");

    const opTable = await atomizeSop(sop, { sopId: "SOP-CellCollection-001", sopName: "Cell Collection" });

    expect(opTable.sopId).toBe("SOP-CellCollection-001");
    expect(opTable.ops.map((op) => op.opId)).toEqual(["OP-001", "OP-002", "OP-003", "OP-004"]);
    expect(opTable.ops.map((op) => op.action)).toEqual(["转移", "离心", "弃液", "收集"]);
    expect(opTable.ops[1].parameters).toEqual([
      { name: "温度", value: 4, unit: "°C", rawText: "4°C", status: "specified" },
      { name: "离心力", value: 5000, unit: "g", rawText: "5000g", status: "specified" },
      { name: "时间", value: 10, unit: "min", rawText: "10 min", status: "specified" }
    ]);
    expect(opTable.ops[2].humanJudgment.required).toBe(true);
  });

  it("builds a field-extraction prompt containing the required Op contract fields", () => {
    const prompt = buildExtractOpPrompt("弃去上清", "OP-003");

    expect(prompt).toContain("OP-003");
    expect(prompt).toContain("sourceText");
    expect(prompt).toContain("humanJudgment");
    expect(prompt).toContain("risks");
    expect(prompt).toContain("弃去上清");
  });
});
