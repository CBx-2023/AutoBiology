import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { CoverageMatrix, CoverageRow, HyperedgeTable, Requirement, RequirementTable, RequirementType } from "../types.js";

export interface ReviewArtifacts {
  coverage: CoverageMatrix;
  diagrams: Record<string, string>;
  report: string;
}

export interface ReviewOptions {
  hyperedges?: HyperedgeTable;
}

export function reviewRequirements(table: RequirementTable, options: ReviewOptions = {}): ReviewArtifacts {
  const coverage = buildCoverageMatrix(table, options.hyperedges);
  const diagrams = renderDiagrams(table, options.hyperedges, coverage);

  return {
    coverage,
    diagrams,
    report: renderReport(table, coverage, diagrams)
  };
}

export async function writeReviewOutputs(outputDir: string, artifacts: ReviewArtifacts): Promise<void> {
  const diagramsDir = join(outputDir, "diagrams");
  await mkdir(diagramsDir, { recursive: true });
  await writeFile(join(outputDir, "05-coverage.json"), `${JSON.stringify(artifacts.coverage, null, 2)}\n`, "utf8");
  await Promise.all(
    Object.entries(artifacts.diagrams).map(([fileName, content]) => writeFile(join(diagramsDir, fileName), `${content.trim()}\n`, "utf8"))
  );
  await writeFile(join(outputDir, "report.md"), `${artifacts.report.trim()}\n`, "utf8");
}

export function applyInteractiveReviewDecision(
  table: RequirementTable,
  decision: "confirm-all" | "reject-all" | "clarify-all"
): RequirementTable {
  const statusByDecision = {
    "confirm-all": "confirmed",
    "reject-all": "rejected",
    "clarify-all": "clarification"
  } as const;
  return {
    requirements: table.requirements.map((requirement) =>
      requirement.status === "candidate" ? { ...requirement, status: statusByDecision[decision] } : { ...requirement }
    ),
    clarifications: table.clarifications.map((clarification) => ({ ...clarification }))
  };
}

const REQUIREMENT_TYPES: RequirementType[] = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"];

function buildCoverageMatrix(table: RequirementTable, hyperedges?: HyperedgeTable): CoverageMatrix {
  const hyperedgeIds = hyperedges?.hyperedges.map((edge) => edge.hyperedgeId) ?? sourceHyperedgeIds(table);
  const rows: CoverageRow[] = hyperedgeIds.map((hyperedgeId) => {
    const coverage = emptyCoverageRow();
    for (const type of REQUIREMENT_TYPES) {
      if (table.requirements.some((requirement) => requirement.type === type && requirement.sourceHyperedges.includes(hyperedgeId))) {
        coverage[type] = "covered";
      } else if (table.clarifications.some((clarification) => clarification.sourceHyperedges.includes(hyperedgeId))) {
        coverage[type] = "clarification";
      }
    }
    return { hyperedgeId, coverage };
  });

  const coveredTypes = emptyCounts();
  const missingTypes = emptyCounts();
  for (const row of rows) {
    for (const type of REQUIREMENT_TYPES) {
      if (row.coverage[type] === "covered") coveredTypes[type] += 1;
      if (row.coverage[type] === "missing") missingTypes[type] += 1;
    }
  }
  const totalCells = Math.max(1, rows.length * REQUIREMENT_TYPES.length);
  const coveredCells = Object.values(coveredTypes).reduce((sum, value) => sum + value, 0);

  return {
    rows,
    summary: {
      totalHyperedges: rows.length,
      coveredTypes,
      missingTypes,
      coverageRate: coveredCells / totalCells
    }
  };
}

function renderDiagrams(table: RequirementTable, hyperedges: HyperedgeTable | undefined, coverage: CoverageMatrix): Record<string, string> {
  return {
    "sop-flow.mmd": renderSopFlow(hyperedges, table),
    "hypergraph.mmd": renderHypergraph(hyperedges, table),
    "requirement-trace.mmd": renderRequirementTrace(table),
    "risk-network.mmd": renderRiskNetwork(table),
    "coverage-matrix.mmd": renderCoverageMatrix(coverage)
  };
}

function renderSopFlow(hyperedges: HyperedgeTable | undefined, table: RequirementTable): string {
  const ids = hyperedges?.hyperedges.map((edge) => edge.hyperedgeId) ?? sourceHyperedgeIds(table);
  const lines = ["flowchart TD"];
  ids.forEach((id, index) => {
    lines.push(`  ${safeId(id)}[${id}]`);
    if (index > 0) lines.push(`  ${safeId(ids[index - 1])} --> ${safeId(id)}`);
  });
  return lines.join("\n");
}

function renderHypergraph(hyperedges: HyperedgeTable | undefined, table: RequirementTable): string {
  const ids = hyperedges?.hyperedges.map((edge) => edge.hyperedgeId) ?? sourceHyperedgeIds(table);
  const lines = ["flowchart LR"];
  for (const id of ids) {
    const related = table.requirements.filter((requirement) => requirement.sourceHyperedges.includes(id));
    lines.push(`  ${safeId(id)}(( ${id} ))`);
    for (const requirement of related.slice(0, 5)) {
      lines.push(`  ${safeId(id)} --> ${safeId(requirement.requirementId)}[${requirement.type}]`);
    }
  }
  return lines.join("\n");
}

function renderRequirementTrace(table: RequirementTable): string {
  const lines = ["flowchart LR"];
  for (const requirement of table.requirements.slice(0, 80)) {
    const requirementId = safeId(requirement.requirementId);
    for (const hyperedgeId of requirement.sourceHyperedges) {
      lines.push(`  ${safeId(hyperedgeId)}[${hyperedgeId}] --> ${requirementId}[${requirement.requirementId} ${requirement.type}]`);
    }
  }
  return lines.join("\n");
}

function renderRiskNetwork(table: RequirementTable): string {
  const lines = ["flowchart TD"];
  const riskRequirements = table.requirements.filter((requirement) => requirement.type === "R7" || requirement.type === "R8");
  for (const requirement of riskRequirements.slice(0, 60)) {
    const riskLabel = requirement.relatedRisks.join("、") || requirement.description.slice(0, 18);
    lines.push(`  ${safeId(`risk-${requirement.requirementId}`)}[${escapeLabel(riskLabel)}] --> ${safeId(requirement.requirementId)}[${requirement.type}]`);
  }
  if (riskRequirements.length === 0) lines.push("  noRisk[No risk requirements]");
  return lines.join("\n");
}

function renderCoverageMatrix(coverage: CoverageMatrix): string {
  const covered = Object.values(coverage.summary.coveredTypes).reduce((sum, value) => sum + value, 0);
  const missing = Object.values(coverage.summary.missingTypes).reduce((sum, value) => sum + value, 0);
  return ["pie title Requirement Coverage", `  "covered" : ${covered}`, `  "missing" : ${missing}`].join("\n");
}

function renderReport(table: RequirementTable, coverage: CoverageMatrix, diagrams: Record<string, string>): string {
  const warningLines = verificationWarnings(table);
  return [
    "# AutoBiology Requirement Review",
    "",
    `Requirements: ${table.requirements.length}`,
    `Clarifications: ${table.clarifications.length}`,
    `Coverage rate: ${(coverage.summary.coverageRate * 100).toFixed(1)}%`,
    "",
    "## Coverage Matrix",
    "",
    ...coverage.rows.map((row) => `- ${row.hyperedgeId}: ${REQUIREMENT_TYPES.map((type) => `${type}=${row.coverage[type]}`).join(", ")}`),
    "",
    "## Verification Warnings",
    "",
    ...(warningLines.length ? warningLines.map((line) => `- ${line}`) : ["- None"]),
    "",
    ...Object.entries(diagrams).flatMap(([fileName, diagram]) => [
      `## ${fileName}`,
      "",
      "```mermaid",
      diagram,
      "```",
      ""
    ])
  ].join("\n");
}

function verificationWarnings(table: RequirementTable): string[] {
  const warnings: string[] = [];
  for (const requirement of table.requirements) {
    if (requirement.sourceHyperedges.length === 0) warnings.push(`${requirement.requirementId} has no source hyperedge`);
    if (/具体实现为|使用React|使用Vue|数据库表/.test(requirement.description)) {
      warnings.push(`${requirement.requirementId} may contain implementation-plan wording`);
    }
  }
  return warnings;
}

function sourceHyperedgeIds(table: RequirementTable): string[] {
  return [...new Set(table.requirements.flatMap((requirement) => requirement.sourceHyperedges))].sort();
}

function emptyCoverageRow(): CoverageRow["coverage"] {
  return {
    R1: "missing",
    R2: "missing",
    R3: "missing",
    R4: "missing",
    R5: "missing",
    R6: "missing",
    R7: "missing",
    R8: "missing",
    R9: "missing",
    R10: "missing"
  };
}

function emptyCounts(): Record<RequirementType, number> {
  return {
    R1: 0,
    R2: 0,
    R3: 0,
    R4: 0,
    R5: 0,
    R6: 0,
    R7: 0,
    R8: 0,
    R9: 0,
    R10: 0
  };
}

function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

function escapeLabel(label: string): string {
  return label.replace(/["\[\]]/g, "");
}
