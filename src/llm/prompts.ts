import { loadKnowledgeBase, type KnowledgeBase } from "../knowledge/loader.js";
import type { Requirement, RequirementTable } from "../pipeline/types.js";
import { buildKnowledgeContext } from "./context-builder.js";
import { loadPromptTemplate, renderPrompt } from "./prompt-loader.js";

export function buildCandidateGenerationPrompt(table: RequirementTable, knowledge: KnowledgeBase = loadKnowledgeBase()): string {
  const existingRequirements = table.requirements.map((requirement) => ({
    requirementId: requirement.requirementId,
    type: requirement.type,
    description: requirement.description,
    source_hyperedge: requirement.sourceHyperedges[0],
    source_hyperedges: requirement.sourceHyperedges,
    source_ops: requirement.sourceOps,
    applicable_to: requirement.applicableTo,
    status: requirement.status
  }));
  const clarifications = table.clarifications.map((clarification) => ({
    id: clarification.id,
    question: clarification.question,
    source_hyperedges: clarification.sourceHyperedges,
    related_requirements: clarification.relatedRequirements,
    priority: clarification.priority
  }));

  return renderPrompt(loadPromptTemplate("generate-candidates"), {
    existing_requirements: JSON.stringify(existingRequirements, null, 2),
    clarifications: JSON.stringify(clarifications, null, 2),
    coverage_summary: JSON.stringify(buildCoverageSummary(table), null, 2),
    knowledge_context: buildKnowledgeContexts(JSON.stringify({ existingRequirements, clarifications }), knowledge)
  });
}

export function buildRequirementRewritePrompt(
  description: string,
  sourceHyperedge: string,
  knowledge: KnowledgeBase = loadKnowledgeBase(),
  action?: string
): string {
  return renderPrompt(loadPromptTemplate("rewrite-requirement"), {
    source_hyperedge: sourceHyperedge,
    description,
    knowledge_context: buildKnowledgeContexts(description, knowledge, action)
  });
}

export function buildSemanticDedupPrompt(
  existing: Requirement[],
  candidate: Pick<Requirement, "type" | "description" | "sourceHyperedges">,
  knowledge: KnowledgeBase = loadKnowledgeBase()
): string {
  const existingRequirements = existing.map((requirement) => ({
    requirementId: requirement.requirementId,
    type: requirement.type,
    description: requirement.description,
    source_hyperedge: requirement.sourceHyperedges[0],
    source_hyperedges: requirement.sourceHyperedges,
    applicable_to: requirement.applicableTo,
    status: requirement.status
  }));
  const candidatePayload = {
    type: candidate.type,
    description: candidate.description,
    source_hyperedge: candidate.sourceHyperedges[0],
    source_hyperedges: candidate.sourceHyperedges
  };

  return renderPrompt(loadPromptTemplate("semantic-dedup"), {
    source_hyperedge: candidate.sourceHyperedges[0] ?? "missing",
    candidate: JSON.stringify(candidatePayload, null, 2),
    existing_requirements: JSON.stringify(existingRequirements, null, 2),
    knowledge_context: buildKnowledgeContexts(JSON.stringify({ candidatePayload, existingRequirements }), knowledge)
  });
}

function buildCoverageSummary(table: RequirementTable): Record<string, unknown> {
  const byType = table.requirements.reduce<Record<string, number>>((counts, requirement) => {
    counts[requirement.type] = (counts[requirement.type] ?? 0) + 1;
    return counts;
  }, {});

  return {
    totalRequirements: table.requirements.length,
    candidateCount: table.requirements.filter((requirement) => requirement.status === "candidate").length,
    confirmedCount: table.requirements.filter((requirement) => requirement.status === "confirmed").length,
    clarificationCount: table.clarifications.length,
    coverageByType: byType
  };
}

function buildKnowledgeContexts(text: string, knowledge: KnowledgeBase, preferredAction?: string): string {
  const actions = preferredAction
    ? [preferredAction]
    : Object.keys(knowledge.domainPatterns)
        .filter((action) => text.includes(action))
        .slice(0, 5);
  const selectedActions = actions.length > 0 ? actions : ["未说明"];
  return selectedActions.map((action) => buildKnowledgeContext(action, knowledge)).join("\n\n");
}
