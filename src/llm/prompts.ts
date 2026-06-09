import type { Requirement, RequirementTable } from "../pipeline/types.js";

export function buildCandidateGenerationPrompt(table: RequirementTable): string {
  return [
    "Generate implicit AutoBiology design requirements from the existing requirement table.",
    "Return only JSON: {\"requirements\":[{\"type\":\"R1-R10\",\"description\":\"...\",\"source_hyperedge\":\"H-OP-001\",\"source_ops\":[\"OP-001\"],\"applicable_to\":\"...\",\"confidence\":0.0}]}",
    "Every candidate MUST include source_hyperedge. Reject any idea that cannot cite a source_hyperedge.",
    "Existing requirements:",
    JSON.stringify(
      table.requirements.map((requirement) => ({
        type: requirement.type,
        description: requirement.description,
        source_hyperedge: requirement.sourceHyperedges[0],
        source_hyperedges: requirement.sourceHyperedges
      })),
      null,
      2
    )
  ].join("\n");
}

export function buildRequirementRewritePrompt(description: string, sourceHyperedge: string): string {
  return [
    "Rewrite the candidate as one concise engineering requirement sentence beginning with 设备应.",
    "Return only JSON: {\"description\":\"设备应...\"}.",
    `source_hyperedge: ${sourceHyperedge}`,
    `candidate_description: ${description}`
  ].join("\n");
}

export function buildSemanticDedupPrompt(
  existing: Requirement[],
  candidate: Pick<Requirement, "type" | "description" | "sourceHyperedges">
): string {
  return [
    "Decide whether the candidate requirement is semantically duplicate of an existing requirement.",
    "Return only JSON: {\"is_duplicate\":false} or {\"is_duplicate\":true,\"duplicate_of\":\"REQ-001\"}.",
    `source_hyperedge: ${candidate.sourceHyperedges[0] ?? "missing"}`,
    "Candidate:",
    JSON.stringify(candidate, null, 2),
    "Existing:",
    JSON.stringify(
      existing.map((requirement) => ({
        requirementId: requirement.requirementId,
        type: requirement.type,
        description: requirement.description,
        source_hyperedge: requirement.sourceHyperedges[0],
        source_hyperedges: requirement.sourceHyperedges
      })),
      null,
      2
    )
  ].join("\n");
}
