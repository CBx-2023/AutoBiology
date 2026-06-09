import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { atomizeSop } from "../src/pipeline/atomizer/index.js";
import { buildHypergraph } from "../src/pipeline/hypergraph/index.js";
import { generateRequirements } from "../src/pipeline/requirements/index.js";
import {
  applyInteractiveReviewDecision,
  reviewRequirements,
  writeReviewOutputs
} from "../src/pipeline/review/index.js";
import type { RequirementTable } from "../src/pipeline/types.js";

describe("review coverage and Mermaid artifacts", () => {
  it("creates a coverage matrix and five nonblank Mermaid diagrams", async () => {
    const { requirementTable, hyperedges } = await buildPipelineTables();

    const artifacts = reviewRequirements(requirementTable, { hyperedges });

    expect(artifacts.coverage.rows.map((row) => row.hyperedgeId)).toEqual(["H-OP-001", "H-OP-002", "H-OP-003", "H-OP-004"]);
    expect(artifacts.coverage.rows.find((row) => row.hyperedgeId === "H-OP-002")?.coverage.R3).toBe("covered");
    expect(artifacts.coverage.summary.coverageRate).toBeGreaterThan(0);
    expect(Object.keys(artifacts.diagrams)).toEqual([
      "sop-flow.mmd",
      "hypergraph.mmd",
      "requirement-trace.mmd",
      "risk-network.mmd",
      "coverage-matrix.mmd"
    ]);
    expect(artifacts.diagrams["sop-flow.mmd"]).toContain("flowchart TD");
    expect(artifacts.diagrams["hypergraph.mmd"]).toContain("flowchart LR");
    expect(artifacts.diagrams["coverage-matrix.mmd"]).toContain("pie");
    expect(artifacts.report).toContain("```mermaid");
  });

  it("writes coverage.json, report.md, and diagram files", async () => {
    const { requirementTable, hyperedges } = await buildPipelineTables();
    const outputDir = await mkdtemp(join(tmpdir(), "autobio-review-"));

    try {
      await writeReviewOutputs(outputDir, reviewRequirements(requirementTable, { hyperedges }));

      const coverage = JSON.parse(await readFile(join(outputDir, "05-coverage.json"), "utf8"));
      const report = await readFile(join(outputDir, "report.md"), "utf8");
      const traceDiagram = await readFile(join(outputDir, "diagrams", "requirement-trace.mmd"), "utf8");

      expect(coverage.rows).toHaveLength(4);
      expect(report).toContain("AutoBiology Requirement Review");
      expect(traceDiagram).toContain("flowchart LR");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});

describe("interactive review decisions", () => {
  it("can confirm all candidate requirements without changing confirmed requirements", () => {
    const table: RequirementTable = {
      requirements: [
        makeRequirement("REQ-001", "candidate"),
        makeRequirement("REQ-002", "confirmed")
      ],
      clarifications: []
    };

    const reviewed = applyInteractiveReviewDecision(table, "confirm-all");

    expect(reviewed.requirements.map((requirement) => requirement.status)).toEqual(["confirmed", "confirmed"]);
  });
});

async function buildPipelineTables() {
  const sop = await readFile("tests/fixtures/sample-sop-cell-collection.txt", "utf8");
  const opTable = await atomizeSop(sop, { sopId: "SOP-CellCollection-001", sopName: "Cell Collection" });
  const hypergraph = buildHypergraph(opTable);
  return {
    requirementTable: generateRequirements(hypergraph),
    hyperedges: hypergraph.edges
  };
}

function makeRequirement(requirementId: string, status: "candidate" | "confirmed") {
  return {
    requirementId,
    type: "R1" as const,
    description: "设备应执行测试操作。",
    sourceOps: ["OP-001"],
    sourceHyperedges: ["H-OP-001"],
    sourceFields: ["Action"],
    applicableTo: "样本",
    keyMetrics: [],
    constraints: [],
    relatedRisks: [],
    responsibleModule: "test",
    verificationMethod: "测试",
    priority: "medium" as const,
    status,
    inferenceRule: "test",
    confidence: 1,
    fingerprint: requirementId
  };
}
