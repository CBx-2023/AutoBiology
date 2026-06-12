import { getRisksForAction, loadKnowledgeBase, type KnowledgeBase, type NamedRiskCatalogEntry } from "../../knowledge/loader.js";
import type { Hyperedge, HyperedgeTable, Requirement, RequirementTable, RiskCoverageReport } from "../types.js";

export function verifyRiskCoverage(
  table: RequirementTable,
  hyperedges: HyperedgeTable,
  knowledge: KnowledgeBase = loadKnowledgeBase()
): RiskCoverageReport {
  const coveredByRisk = new Map<string, Set<string>>();
  const expectedByRisk = new Map<string, { actions: Set<string>; severity: string; total: number; covered: number }>();

  for (const hyperedge of hyperedges.hyperedges) {
    const action = inferAction(hyperedge, knowledge);
    if (!action) continue;

    for (const risk of getRisksForAction(action, knowledge)) {
      const entry = expectedByRisk.get(risk.name) ?? { actions: new Set<string>(), severity: risk.severity, total: 0, covered: 0 };
      entry.actions.add(action);
      entry.total += 1;

      const coveringRequirements = findCoveringRequirements(table.requirements, hyperedge, risk);
      if (coveringRequirements.length > 0) {
        entry.covered += 1;
        const coveredBy = coveredByRisk.get(risk.name) ?? new Set<string>();
        for (const requirement of coveringRequirements) coveredBy.add(requirement.requirementId);
        coveredByRisk.set(risk.name, coveredBy);
      }

      expectedByRisk.set(risk.name, entry);
    }
  }

  const coveredRisks = [...coveredByRisk.entries()]
    .map(([risk, coveredBy]) => ({ risk, coveredBy: [...coveredBy].sort() }))
    .sort((a, b) => a.risk.localeCompare(b.risk, "zh-Hans-CN"));

  const uncoveredRisks = [...expectedByRisk.entries()]
    .filter(([, entry]) => entry.covered === 0)
    .map(([risk, entry]) => ({
      risk,
      expectedForActions: [...entry.actions].sort(),
      severity: entry.severity
    }))
    .sort((a, b) => a.risk.localeCompare(b.risk, "zh-Hans-CN"));

  const totalExpected = [...expectedByRisk.values()].reduce((sum, entry) => sum + entry.total, 0);
  const totalCovered = [...expectedByRisk.values()].reduce((sum, entry) => sum + entry.covered, 0);

  return {
    coveredRisks,
    uncoveredRisks,
    coverageRate: totalExpected === 0 ? 1 : totalCovered / totalExpected,
    warnings: uncoveredRisks
      .filter((risk) => risk.severity === "high")
      .map((risk) => `高严重度风险 "${risk.risk}" 未被任何 R7/R8 需求覆盖`)
  };
}

function inferAction(hyperedge: Hyperedge, knowledge: KnowledgeBase): string | undefined {
  const operationName = hyperedge.attributes.operationName.trim();
  if (getRisksForAction(operationName, knowledge).length > 0) return operationName;

  return Object.values(knowledge.riskCatalog)
    .flatMap((risk) => risk.triggerActions)
    .find((action) => hyperedge.sourceText.includes(action) || operationName.includes(action));
}

function findCoveringRequirements(requirements: Requirement[], hyperedge: Hyperedge, risk: NamedRiskCatalogEntry): Requirement[] {
  return requirements.filter((requirement) => {
    if (requirement.type !== "R7" && requirement.type !== "R8") return false;
    if (!requirement.sourceHyperedges.includes(hyperedge.hyperedgeId)) return false;
    return requirement.relatedRisks.includes(risk.name) || requirement.description.includes(risk.name);
  });
}
