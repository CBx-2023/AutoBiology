import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import type { Readable, Writable } from "node:stream";
import type {
  CoverageMatrix,
  CoverageRow,
  HyperedgeTable,
  NodeType,
  Requirement,
  RequirementTable,
  RequirementType,
  VerificationReport
} from "../types.js";
import { verifyRequirements } from "./verification.js";

export interface ReviewArtifacts {
  coverage: CoverageMatrix;
  verification: VerificationReport;
  diagrams: Record<string, string>;
  report: string;
}

export interface ReviewOptions {
  hyperedges?: HyperedgeTable;
}

export function reviewRequirements(table: RequirementTable, options: ReviewOptions = {}): ReviewArtifacts {
  const coverage = buildCoverageMatrix(table, options.hyperedges);
  const verification = verifyRequirements(table, { hyperedges: options.hyperedges });
  const diagrams = renderDiagrams(table, options.hyperedges, coverage);

  return {
    coverage,
    verification,
    diagrams,
    report: renderReport(table, coverage, verification, diagrams, options.hyperedges)
  };
}

export async function writeReviewOutputs(outputDir: string, artifacts: ReviewArtifacts): Promise<void> {
  const diagramsDir = join(outputDir, "diagrams");
  await mkdir(diagramsDir, { recursive: true });
  await writeFile(join(outputDir, "05-coverage.json"), `${JSON.stringify(artifacts.coverage, null, 2)}\n`, "utf8");
  await writeFile(join(outputDir, "06-verification.json"), `${JSON.stringify(artifacts.verification, null, 2)}\n`, "utf8");
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

export interface InteractiveReviewOptions {
  answers?: string[];
  input?: Readable;
  output?: Writable;
  isTTY?: boolean;
}

export async function reviewCandidatesInteractively(
  table: RequirementTable,
  options: InteractiveReviewOptions = {}
): Promise<RequirementTable> {
  const reviewed: RequirementTable = {
    requirements: table.requirements.map((requirement) => ({ ...requirement })),
    clarifications: table.clarifications.map((clarification) => ({ ...clarification }))
  };
  const candidates = reviewed.requirements.filter((requirement) => requirement.status === "candidate");
  if (candidates.length === 0) return reviewed;

  if (!options.answers && !options.isTTY) {
    reviewed.clarifications.push({
      id: `CLR-INTERACTIVE-${Date.now()}`,
      question: "Interactive review requested in non-TTY mode; candidate requirements were left unchanged.",
      sourceOps: [],
      sourceHyperedges: [],
      relatedRequirements: candidates.map((candidate) => candidate.requirementId),
      priority: "medium"
    });
    return reviewed;
  }

  const scriptedAnswers = [...(options.answers ?? [])];
  const readline =
    !options.answers && options.input && options.output
      ? createInterface({ input: options.input, output: options.output })
      : undefined;

  try {
    for (const candidate of candidates) {
      const answer = await nextReviewAnswer(candidate, scriptedAnswers, readline);
      if (answer === "a") {
        for (const remaining of candidates.slice(candidates.indexOf(candidate))) {
          remaining.status = "confirmed";
        }
        break;
      }
      if (answer === "c") candidate.status = "confirmed";
      if (answer === "r") candidate.status = "rejected";
      if (answer === "q") candidate.status = "clarification";
    }
  } finally {
    readline?.close();
  }

  return reviewed;
}

const REQUIREMENT_TYPES: RequirementType[] = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"];
const ROLE_COVERAGE_REQUIREMENTS: Array<{ role: NodeType; requirementType: RequirementType }> = [
  { role: "Action", requirementType: "R1" },
  { role: "Parameter", requirementType: "R3" },
  { role: "Condition", requirementType: "R4" },
  { role: "HumanJudgment", requirementType: "R6" },
  { role: "Risk", requirementType: "R7" },
  { role: "Handling", requirementType: "R8" }
];

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

function renderReport(
  table: RequirementTable,
  coverage: CoverageMatrix,
  verification: VerificationReport,
  diagrams: Record<string, string>,
  hyperedges?: HyperedgeTable
): string {
  const warningLines = verificationWarnings(table, coverage, hyperedges);
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
    ...renderVerificationSection(verification),
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

function renderVerificationSection(verification: VerificationReport): string[] {
  return [
    "## Verification Report",
    "",
    `Overall assessment: ${verification.overallAssessment}`,
    `Average quality: ${(verification.averageQuality * 100).toFixed(1)}%`,
    `Risk coverage: ${(verification.riskCoverage.coverageRate * 100).toFixed(1)}%`,
    `Forward traceability: ${(verification.traceability.forwardCoverage * 100).toFixed(1)}%`,
    "",
    "### Quality Distribution",
    "",
    "```mermaid",
    renderQualityDistribution(verification),
    "```",
    "",
    "### Duplicate summary",
    "",
    `- Duplicate pairs: ${verification.dedupResult.duplicatePairs.length}`,
    ...verification.dedupResult.duplicatePairs
      .slice(0, 10)
      .map((pair) => `- ${pair.reqA} / ${pair.reqB}: ${pair.method} (${pair.similarity.toFixed(2)})`),
    ...(verification.dedupResult.duplicatePairs.length === 0 ? ["- None"] : []),
    "",
    "### Risk coverage gaps",
    "",
    ...(verification.riskCoverage.uncoveredRisks.length
      ? verification.riskCoverage.uncoveredRisks.map(
          (risk) => `- ${risk.risk} (${risk.severity}) expected for ${risk.expectedForActions.join(", ")}`
        )
      : ["- None"]),
    "",
    "### Traceability gaps",
    "",
    ...renderTraceabilityGaps(verification)
  ];
}

function renderQualityDistribution(verification: VerificationReport): string {
  const high = verification.qualityScores.filter((score) => score.overall >= 0.7).length;
  const medium = verification.qualityScores.filter((score) => score.overall >= 0.4 && score.overall < 0.7).length;
  const low = verification.qualityScores.filter((score) => score.overall < 0.4).length;
  const max = Math.max(1, high, medium, low);
  return ["xychart-beta", "  title \"Quality Distribution\"", "  x-axis [\"low\", \"medium\", \"high\"]", `  y-axis \"count\" 0 --> ${max}`, `  bar [${low}, ${medium}, ${high}]`].join("\n");
}

function renderTraceabilityGaps(verification: VerificationReport): string[] {
  const lines: string[] = [];
  for (const opId of verification.traceability.opsWithoutRequirements) lines.push(`- OP without requirements: ${opId}`);
  for (const requirementId of verification.traceability.requirementsWithoutOps) lines.push(`- Requirement without valid OP: ${requirementId}`);
  for (const row of verification.traceability.hyperedgeCoverage) {
    if (row.gaps.length > 0) lines.push(`- ${row.hyperedgeId} missing ${row.gaps.join(", ")}`);
  }
  return lines.length ? lines : ["- None"];
}

function verificationWarnings(table: RequirementTable, coverage?: CoverageMatrix, hyperedges?: HyperedgeTable): string[] {
  const warnings: string[] = [];
  for (const requirement of table.requirements) {
    if (requirement.sourceHyperedges.length === 0) warnings.push(`${requirement.requirementId} has no source hyperedge`);
    if (/具体实现为|使用React|使用Vue|数据库表/.test(requirement.description)) {
      warnings.push(`${requirement.requirementId} may contain implementation-plan wording`);
    }
  }
  warnings.push(...roleCoverageWarnings(coverage, hyperedges));
  return warnings;
}

function roleCoverageWarnings(coverage: CoverageMatrix | undefined, hyperedges: HyperedgeTable | undefined): string[] {
  if (!coverage || !hyperedges) return [];
  const rowsByHyperedge = new Map(coverage.rows.map((row) => [row.hyperedgeId, row]));
  const warnings: string[] = [];

  for (const hyperedge of hyperedges.hyperedges) {
    const row = rowsByHyperedge.get(hyperedge.hyperedgeId);
    if (!row) continue;

    for (const rule of ROLE_COVERAGE_REQUIREMENTS) {
      const roleNodes = hyperedge.nodeRoles[rule.role] ?? [];
      if (roleNodes.length > 0 && row.coverage[rule.requirementType] === "missing") {
        warnings.push(`${hyperedge.hyperedgeId} has ${rule.role} nodes but no ${rule.requirementType} coverage`);
      }
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

async function nextReviewAnswer(
  requirement: Requirement,
  scriptedAnswers: string[],
  readline: ReturnType<typeof createInterface> | undefined
): Promise<string> {
  const scripted = scriptedAnswers.shift();
  if (scripted) return normalizeReviewAnswer(scripted);
  if (!readline) return "s";
  const answer = await readline.question(
    `Requirement ${requirement.requirementId} ${requirement.type}: ${requirement.description}\n[c] confirm [r] reject [q] clarify [s] skip [a] confirm all > `
  );
  return normalizeReviewAnswer(answer);
}

function normalizeReviewAnswer(answer: string): string {
  const normalized = answer.trim().toLowerCase();
  return ["c", "r", "q", "s", "a"].includes(normalized) ? normalized : "s";
}

function safeId(id: string): string {
  return id.replace(/[^A-Za-z0-9_]/g, "_");
}

function escapeLabel(label: string): string {
  return label.replace(/["\[\]]/g, "");
}
