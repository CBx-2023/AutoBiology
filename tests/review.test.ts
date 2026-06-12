import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { atomizeSop } from "../src/pipeline/atomizer/index.js";
import { buildHypergraph } from "../src/pipeline/hypergraph/index.js";
import { generateRequirements } from "../src/pipeline/requirements/index.js";
import {
  applyInteractiveReviewDecision,
  reviewCandidatesInteractively,
  reviewRequirements,
  writeReviewOutputs
} from "../src/pipeline/review/index.js";
import type { HyperedgeTable, NodeType, RequirementTable, RequirementType } from "../src/pipeline/types.js";

describe("review coverage and Mermaid artifacts", () => {
  it("creates a coverage matrix and five nonblank Mermaid diagrams", async () => {
    const { requirementTable, hyperedges } = await buildPipelineTables();

    const artifacts = reviewRequirements(requirementTable, { hyperedges });

    expect(artifacts.coverage.rows.map((row) => row.hyperedgeId)).toEqual(["H-OP-001", "H-OP-002", "H-OP-003", "H-OP-004"]);
    expect(artifacts.coverage.rows.find((row) => row.hyperedgeId === "H-OP-002")?.coverage.R3).toBe("covered");
    expect(artifacts.coverage.summary.coverageRate).toBeGreaterThan(0);
    expect(artifacts.verification.overallAssessment).toMatch(/^(pass|warn|fail)$/);
    expect(artifacts.verification.qualityScores.length).toBe(requirementTable.requirements.length);
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
      const verification = JSON.parse(await readFile(join(outputDir, "06-verification.json"), "utf8"));
      const report = await readFile(join(outputDir, "report.md"), "utf8");
      const traceDiagram = await readFile(join(outputDir, "diagrams", "requirement-trace.mmd"), "utf8");

      expect(coverage.rows).toHaveLength(4);
      expect(verification).toEqual(
        expect.objectContaining({
          overallAssessment: expect.stringMatching(/^(pass|warn|fail)$/),
          averageQuality: expect.any(Number),
          dedupResult: expect.any(Object),
          riskCoverage: expect.any(Object),
          traceability: expect.any(Object)
        })
      );
      expect(report).toContain("AutoBiology Requirement Review");
      expect(report).toContain("## Verification Report");
      expect(report).toContain("Quality Distribution");
      expect(report).toContain("Duplicate summary");
      expect(report).toContain("Risk coverage gaps");
      expect(report).toContain("Traceability gaps");
      expect(traceDiagram).toContain("flowchart LR");
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  it("emits concrete role coverage warnings when required mappings are missing", () => {
    const artifacts = reviewRequirements(
      {
        requirements: [],
        clarifications: []
      },
      {
        hyperedges: makeHyperedgeTable({
          Action: ["ACT-001"],
          Parameter: ["PAR-001"],
          Risk: ["RSK-001"],
          Handling: ["HDL-001"]
        })
      }
    );

    expect(artifacts.report).toContain("H-OP-001 has Action nodes but no R1 coverage");
    expect(artifacts.report).toContain("H-OP-001 has Parameter nodes but no R3 coverage");
    expect(artifacts.report).toContain("H-OP-001 has Risk nodes but no R7 coverage");
    expect(artifacts.report).toContain("H-OP-001 has Handling nodes but no R8 coverage");
  });

  it("omits role coverage warnings when required mappings are covered", () => {
    const table: RequirementTable = {
      requirements: [
        makeRequirement("REQ-R1", "confirmed", "R1"),
        makeRequirement("REQ-R3", "confirmed", "R3"),
        makeRequirement("REQ-R7", "confirmed", "R7"),
        makeRequirement("REQ-R8", "confirmed", "R8")
      ],
      clarifications: []
    };

    const artifacts = reviewRequirements(table, {
      hyperedges: makeHyperedgeTable({
        Action: ["ACT-001"],
        Parameter: ["PAR-001"],
        Risk: ["RSK-001"],
        Handling: ["HDL-001"]
      })
    });

    expect(artifacts.report).not.toContain("no R1 coverage");
    expect(artifacts.report).not.toContain("no R3 coverage");
    expect(artifacts.report).not.toContain("no R7 coverage");
    expect(artifacts.report).not.toContain("no R8 coverage");
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

  it("applies explicit candidate decisions one by one", async () => {
    const table: RequirementTable = {
      requirements: [
        makeRequirement("REQ-001", "candidate"),
        makeRequirement("REQ-002", "candidate"),
        makeRequirement("REQ-003", "candidate"),
        makeRequirement("REQ-004", "confirmed")
      ],
      clarifications: []
    };

    const reviewed = await reviewCandidatesInteractively(table, { answers: ["c", "r", "q"] });

    expect(reviewed.requirements.map((requirement) => requirement.status)).toEqual([
      "confirmed",
      "rejected",
      "clarification",
      "confirmed"
    ]);
  });

  it("does not auto-confirm candidates when interactive review is requested without a TTY", async () => {
    const table: RequirementTable = {
      requirements: [makeRequirement("REQ-001", "candidate")],
      clarifications: []
    };

    const reviewed = await reviewCandidatesInteractively(table, { isTTY: false });

    expect(reviewed.requirements[0].status).toBe("candidate");
    expect(reviewed.clarifications.at(-1)?.question).toContain("non-TTY");
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

function makeRequirement(requirementId: string, status: "candidate" | "confirmed", type: RequirementType = "R1") {
  return {
    requirementId,
    type,
    description: "设备应执行测试操作。",
    sourceOps: ["OP-001"],
    sourceHyperedges: ["H-OP-001"],
    sourceFields: [sourceFieldForType(type)],
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

function makeHyperedgeTable(nodeRoles: Partial<Record<NodeType, string[]>>): HyperedgeTable {
  return {
    hyperedges: [
      {
        hyperedgeId: "H-OP-001",
        hyperedgeType: "OperationHyperedge",
        sourceOp: "OP-001",
        sourceSop: "SOP-001",
        sourceText: "测试操作",
        parentStep: "",
        connectedNodes: Object.values(nodeRoles).flat(),
        nodeRoles: {
          Action: [],
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
          Handling: [],
          ...nodeRoles
        },
        missingInfo: [],
        expertSupplement: [],
        attributes: {
          operationName: "测试操作",
          isManualJudgmentRequired: false,
          automationRelevance: "high"
        },
        notes: ""
      }
    ]
  };
}

function sourceFieldForType(type: RequirementType): string {
  if (type === "R3") return "Parameter";
  if (type === "R7") return "Risk";
  if (type === "R8") return "Handling";
  return "Action";
}
