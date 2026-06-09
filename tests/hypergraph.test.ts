import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { atomizeSop } from "../src/pipeline/atomizer/index.js";
import { buildHypergraph, normalizeNodeName } from "../src/pipeline/hypergraph/index.js";
import type { OpTable } from "../src/pipeline/types.js";

describe("hypergraph node normalization and reuse", () => {
  it("normalizes known synonyms and reuses nodes across operations", () => {
    const opTable: OpTable = {
      sopId: "SOP-Synonyms",
      sopName: "Synonyms",
      ops: [
        makeOp("OP-001", "加入 PBS 缓冲液", "加液", ["PBS 缓冲液"], "细胞"),
        makeOp("OP-002", "吸去磷酸盐缓冲液", "吸液", ["磷酸盐缓冲液"], "细胞")
      ]
    };

    const hypergraph = buildHypergraph(opTable);
    const pbsNodes = hypergraph.nodes.nodes.filter((node) => node.nodeType === "Input" && node.normalizedName === "PBS");

    expect(normalizeNodeName("磷酸盐缓冲液")).toBe("PBS");
    expect(pbsNodes).toHaveLength(1);
    expect(pbsNodes[0].sourceOps).toEqual(["OP-001", "OP-002"]);
    expect(pbsNodes[0].synonyms).toContain("磷酸盐缓冲液");
  });
});

describe("hypergraph assembly", () => {
  it("builds valid node and hyperedge tables from the sample OpTable", async () => {
    const sop = await readFile("tests/fixtures/sample-sop-cell-collection.txt", "utf8");
    const opTable = await atomizeSop(sop, { sopId: "SOP-CellCollection-001", sopName: "Cell Collection" });

    const hypergraph = buildHypergraph(opTable);

    expect(hypergraph.edges.hyperedges.map((edge) => edge.hyperedgeId)).toEqual([
      "H-OP-001",
      "H-OP-002",
      "H-OP-003",
      "H-OP-004"
    ]);
    expect(hypergraph.edges.hyperedges[1].sourceOp).toBe("OP-002");
    expect(hypergraph.edges.hyperedges[1].nodeRoles.Action).toHaveLength(1);
    expect(hypergraph.edges.hyperedges[1].nodeRoles.Parameter).toHaveLength(3);
    expect(hypergraph.edges.hyperedges[1].connectedNodes).toEqual(
      expect.arrayContaining(hypergraph.edges.hyperedges[1].nodeRoles.Parameter)
    );
    expect(hypergraph.nodes.nodes.some((node) => node.nodeType === "Risk" && node.sourceOps.includes("OP-003"))).toBe(true);
  });
});

function makeOp(opId: string, sourceText: string, action: string, inputs: string[], target: string): OpTable["ops"][number] {
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
    parameters: [],
    conditions: [],
    humanJudgment: { required: false, content: "无", basis: "无" },
    risks: []
  };
}
