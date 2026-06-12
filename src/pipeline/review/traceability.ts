import { getDomainPattern, loadKnowledgeBase, type KnowledgeBase } from "../../knowledge/loader.js";
import type { Hyperedge, HyperedgeTable, RequirementTable, RequirementType, TraceabilityReport } from "../types.js";

export function verifyTraceability(
  table: RequirementTable,
  hyperedges: HyperedgeTable,
  knowledge: KnowledgeBase = loadKnowledgeBase()
): TraceabilityReport {
  const validOps = new Set(hyperedges.hyperedges.map((hyperedge) => hyperedge.sourceOp));
  const validHyperedges = new Set(hyperedges.hyperedges.map((hyperedge) => hyperedge.hyperedgeId));

  const opsWithoutRequirements = hyperedges.hyperedges
    .filter(
      (hyperedge) =>
        !table.requirements.some(
          (requirement) =>
            requirement.sourceHyperedges.includes(hyperedge.hyperedgeId) || requirement.sourceOps.includes(hyperedge.sourceOp)
        )
    )
    .map((hyperedge) => hyperedge.sourceOp)
    .sort();

  const requirementsWithoutOps = table.requirements
    .filter(
      (requirement) =>
        !requirement.sourceOps.some((sourceOp) => validOps.has(sourceOp)) &&
        !requirement.sourceHyperedges.some((sourceHyperedge) => validHyperedges.has(sourceHyperedge))
    )
    .map((requirement) => requirement.requirementId)
    .sort();

  const hyperedgeCoverage = hyperedges.hyperedges.map((hyperedge) => {
    const expectedTypes = expectedRequirementTypes(hyperedge, knowledge);
    const actualTypes = uniqueRequirementTypes(
      table.requirements
        .filter((requirement) => requirement.sourceHyperedges.includes(hyperedge.hyperedgeId))
        .map((requirement) => requirement.type)
    );

    return {
      hyperedgeId: hyperedge.hyperedgeId,
      expectedTypes,
      actualTypes,
      gaps: expectedTypes.filter((type) => !actualTypes.includes(type))
    };
  });

  return {
    opsWithoutRequirements,
    requirementsWithoutOps,
    hyperedgeCoverage,
    forwardCoverage: boundedCoverage(hyperedges.hyperedges.length - opsWithoutRequirements.length, hyperedges.hyperedges.length),
    backwardCoverage: boundedCoverage(table.requirements.length - requirementsWithoutOps.length, table.requirements.length)
  };
}

function expectedRequirementTypes(hyperedge: Hyperedge, knowledge: KnowledgeBase): RequirementType[] {
  const action = inferAction(hyperedge, knowledge);
  return action ? [...(getDomainPattern(action, knowledge)?.relatedRequirements ?? [])] : [];
}

function inferAction(hyperedge: Hyperedge, knowledge: KnowledgeBase): string | undefined {
  const operationName = hyperedge.attributes.operationName.trim();
  if (getDomainPattern(operationName, knowledge)) return operationName;
  return Object.keys(knowledge.domainPatterns).find((action) => hyperedge.sourceText.includes(action) || operationName.includes(action));
}

function uniqueRequirementTypes(types: RequirementType[]): RequirementType[] {
  const order: RequirementType[] = ["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"];
  const present = new Set(types);
  return order.filter((type) => present.has(type));
}

function boundedCoverage(covered: number, total: number): number {
  if (total === 0) return 1;
  return Math.max(0, Math.min(1, covered / total));
}
