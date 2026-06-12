import { completeWithRetry, type LlmClient } from "../../llm/client.js";
import {
  buildCandidateGenerationPrompt,
  buildRequirementRewritePrompt,
  buildSemanticDedupPrompt
} from "../../llm/prompts.js";
import { loadKnowledgeBase, type KnowledgeBase } from "../../knowledge/loader.js";
import { createRequirementFingerprint } from "../requirements/index.js";
import type { Clarification, Requirement, RequirementTable, RequirementType } from "../types.js";

export interface InferRequirementsOptions {
  client?: LlmClient;
  retries?: number;
  knowledgeBase?: KnowledgeBase;
}

export async function inferRequirements(table: RequirementTable, options: InferRequirementsOptions = {}): Promise<RequirementTable> {
  const output = cloneRequirementTable(table);
  if (!options.client) {
    output.clarifications.push(llmDisabledClarification("未配置 LLM client"));
    return output;
  }
  const clientOptions: RequiredClientOptions = { ...options, client: options.client };
  const knowledge = options.knowledgeBase ?? loadKnowledgeBase();

  try {
    const candidateResponse = await completeWithRetry(clientOptions.client, buildCandidateGenerationPrompt(table, knowledge), {
      retries: clientOptions.retries
    });
    const candidates = parseCandidateResponse(candidateResponse);

    for (const candidate of candidates) {
      const sourceHyperedges = normalizeSourceHyperedges(candidate);
      if (sourceHyperedges.length === 0) {
        output.clarifications.push(llmDisabledClarification("LLM candidate missing source_hyperedge"));
        continue;
      }

      const rewritten = await rewriteCandidate(
        candidate.description ?? "",
        sourceHyperedges[0],
        clientOptions,
        knowledge,
        inferActionFromTable(output, sourceHyperedges[0], knowledge)
      );
      const requirement = toRequirement(candidate, rewritten, sourceHyperedges, output.requirements.length + 1);
      const duplicate =
        hasExactDuplicate(output.requirements, requirement) ||
        (await isSemanticDuplicate(output.requirements, requirement, clientOptions, knowledge));
      if (!duplicate) output.requirements.push(requirement);
    }
  } catch (error) {
    output.clarifications.push(llmDisabledClarification(error instanceof Error ? error.message : "unknown LLM failure"));
  }

  return output;
}

interface RawCandidate {
  type?: RequirementType;
  description?: string;
  source_hyperedge?: string;
  source_hyperedges?: string[];
  sourceHyperedges?: string[];
  source_ops?: string[];
  sourceOps?: string[];
  applicable_to?: string;
  applicableTo?: string;
  confidence?: number;
  priority?: Requirement["priority"];
  key_metrics?: string[];
  constraints?: string[];
  related_risks?: string[];
  verification_method?: string;
  reasoning?: string;
}

interface RewrittenCandidate {
  description: string;
  reasoning?: string;
}

async function rewriteCandidate(
  candidateDescription: string,
  sourceHyperedge: string,
  options: RequiredClientOptions,
  knowledge: KnowledgeBase,
  action?: string
): Promise<RewrittenCandidate> {
  try {
    const response = await completeWithRetry(options.client, buildRequirementRewritePrompt(candidateDescription, sourceHyperedge, knowledge, action), {
      retries: options.retries
    });
    const parsed = parseJson(response) as { description?: string; reasoning?: string };
    return {
      description: normalizeOptionalString(parsed.description) ?? candidateDescription,
      reasoning: normalizeOptionalString(parsed.reasoning)
    };
  } catch {
    return { description: candidateDescription };
  }
}

async function isSemanticDuplicate(
  existing: Requirement[],
  candidate: Requirement,
  options: RequiredClientOptions,
  knowledge: KnowledgeBase
): Promise<boolean> {
  try {
    const response = await completeWithRetry(options.client, buildSemanticDedupPrompt(existing, candidate, knowledge), {
      retries: options.retries
    });
    const parsed = parseJson(response) as { is_duplicate?: boolean; duplicateOf?: string; duplicate_of?: string };
    return Boolean(parsed.is_duplicate || parsed.duplicateOf || parsed.duplicate_of);
  } catch {
    return false;
  }
}

type RequiredClientOptions = InferRequirementsOptions & { client: LlmClient };

function parseCandidateResponse(response: string): RawCandidate[] {
  const parsed = parseJson(response) as { requirements?: RawCandidate[] };
  return (parsed.requirements ?? []).filter((candidate) => candidate.description);
}

function toRequirement(candidate: RawCandidate, rewritten: RewrittenCandidate, sourceHyperedges: string[], nextIndex: number): Requirement {
  const reasoning = normalizeOptionalString(rewritten.reasoning) ?? normalizeOptionalString(candidate.reasoning);
  const requirement: Requirement = {
    requirementId: `REQ-${String(nextIndex).padStart(3, "0")}`,
    type: candidate.type ?? "R10",
    description: rewritten.description,
    sourceOps: candidate.source_ops ?? candidate.sourceOps ?? [],
    sourceHyperedges,
    sourceFields: ["LLM"],
    applicableTo: candidate.applicable_to ?? candidate.applicableTo ?? "未说明",
    keyMetrics: candidate.key_metrics ?? [],
    constraints: candidate.constraints ?? [],
    relatedRisks: candidate.related_risks ?? [],
    responsibleModule: "llm-inference",
    verificationMethod: candidate.verification_method ?? "专家复核与场景测试",
    priority: candidate.priority ?? "medium",
    status: "candidate",
    inferenceRule: "LLM-Candidate",
    confidence: candidate.confidence ?? 0.6,
    ...(reasoning ? { reasoning } : {}),
    fingerprint: ""
  };
  requirement.fingerprint = createRequirementFingerprint(requirement);
  return requirement;
}

function normalizeSourceHyperedges(candidate: RawCandidate): string[] {
  return unique([
    ...(candidate.sourceHyperedges ?? []),
    ...(candidate.source_hyperedges ?? []),
    ...(candidate.source_hyperedge ? [candidate.source_hyperedge] : [])
  ]).filter(Boolean);
}

function hasExactDuplicate(existing: Requirement[], candidate: Requirement): boolean {
  return existing.some((requirement) => requirement.fingerprint === candidate.fingerprint);
}

function llmDisabledClarification(reason: string): Clarification {
  return {
    id: `CLR-LLM-${Date.now()}`,
    question: `LLM 辅助层未启用或已降级：${reason}`,
    sourceOps: [],
    sourceHyperedges: [],
    relatedRequirements: [],
    priority: "medium"
  };
}

function cloneRequirementTable(table: RequirementTable): RequirementTable {
  return {
    requirements: table.requirements.map((requirement) => ({ ...requirement, sourceOps: [...requirement.sourceOps], sourceHyperedges: [...requirement.sourceHyperedges] })),
    clarifications: table.clarifications.map((clarification) => ({
      ...clarification,
      sourceOps: [...clarification.sourceOps],
      sourceHyperedges: [...clarification.sourceHyperedges],
      relatedRequirements: [...clarification.relatedRequirements]
    }))
  };
}

function parseJson(response: string): unknown {
  const trimmed = response.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  return JSON.parse(trimmed);
}

function inferActionFromTable(table: RequirementTable, sourceHyperedge: string, knowledge: KnowledgeBase): string | undefined {
  const evidence = table.requirements
    .filter((requirement) => requirement.sourceHyperedges.includes(sourceHyperedge))
    .map((requirement) => `${requirement.description} ${requirement.applicableTo} ${requirement.relatedRisks.join(" ")}`)
    .join("\n");
  return Object.keys(knowledge.domainPatterns).find((action) => evidence.includes(action));
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
