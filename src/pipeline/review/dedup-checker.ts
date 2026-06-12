import { completeWithRetry, type LlmClient } from "../../llm/client.js";
import { buildSemanticDedupPrompt } from "../../llm/prompts.js";
import type { DedupResult, Requirement } from "../types.js";

export interface DedupCheckOptions {
  client?: LlmClient;
  retries?: number;
  jaccardThreshold?: number;
}

const DEFAULT_JACCARD_THRESHOLD = 0.8;

export async function checkRequirementDeduplication(
  requirements: Requirement[],
  options: DedupCheckOptions = {}
): Promise<DedupResult> {
  const duplicatePairs: DedupResult["duplicatePairs"] = [];
  const threshold = options.jaccardThreshold ?? DEFAULT_JACCARD_THRESHOLD;

  for (let i = 0; i < requirements.length; i += 1) {
    for (let j = i + 1; j < requirements.length; j += 1) {
      const reqA = requirements[i];
      const reqB = requirements[j];
      if (!reqA || !reqB) continue;

      if (reqA.fingerprint && reqA.fingerprint === reqB.fingerprint) {
        duplicatePairs.push({ reqA: reqA.requirementId, reqB: reqB.requirementId, method: "fingerprint", similarity: 1 });
        continue;
      }

      const similarity = normalizedJaccardSimilarity(reqA.description, reqB.description);
      if (similarity >= threshold) {
        duplicatePairs.push({
          reqA: reqA.requirementId,
          reqB: reqB.requirementId,
          method: "jaccard",
          similarity: roundSimilarity(similarity)
        });
        continue;
      }

      const semanticPair = await maybeCheckSemanticDuplicate(reqA, reqB, requirements, options);
      if (semanticPair) duplicatePairs.push(semanticPair);
    }
  }

  return {
    duplicatePairs,
    mergedCount: duplicatePairs.length
  };
}

export function normalizedJaccardSimilarity(a: string, b: string): number {
  const left = tokenize(a);
  const right = tokenize(b);
  if (left.size === 0 && right.size === 0) return 1;
  if (left.size === 0 || right.size === 0) return 0;

  let intersection = 0;
  for (const token of left) {
    if (right.has(token)) intersection += 1;
  }
  return intersection / (left.size + right.size - intersection);
}

async function maybeCheckSemanticDuplicate(
  reqA: Requirement,
  reqB: Requirement,
  allRequirements: Requirement[],
  options: DedupCheckOptions
): Promise<DedupResult["duplicatePairs"][number] | undefined> {
  if (!options.client) return undefined;

  try {
    const response = await completeWithRetry(
      options.client,
      buildSemanticDedupPrompt(
        allRequirements.filter((requirement) => requirement.requirementId !== reqB.requirementId),
        reqB
      ),
      { retries: options.retries }
    );
    const parsed = parseSemanticDedupResponse(response);
    if (!parsed.isDuplicate) return undefined;
    return {
      reqA: reqA.requirementId,
      reqB: reqB.requirementId,
      method: "semantic",
      similarity: 1,
      ...(parsed.reasoning ? { reasoning: parsed.reasoning } : {})
    };
  } catch {
    return undefined;
  }
}

function parseSemanticDedupResponse(response: string): { isDuplicate: boolean; reasoning?: string } {
  const parsed = parseJsonObject(response);
  if (!parsed || typeof parsed !== "object") return { isDuplicate: false };
  const record = parsed as Record<string, unknown>;
  return {
    isDuplicate:
      record.is_duplicate === true ||
      record.isDuplicate === true ||
      typeof record.duplicateOf === "string" ||
      typeof record.duplicate_of === "string",
    reasoning: typeof record.reasoning === "string" ? record.reasoning : undefined
  };
}

function parseJsonObject(response: string): unknown {
  try {
    return JSON.parse(response);
  } catch {
    const match = response.match(/\{[\s\S]*\}/);
    if (!match) return undefined;
    try {
      return JSON.parse(match[0]);
    } catch {
      return undefined;
    }
  }
}

function tokenize(text: string): Set<string> {
  const normalized = text.toLowerCase().replace(/[，。；、,.!?;:：()（）[\]{}"'“”‘’]/g, " ");
  const tokens = normalized.match(/[a-z0-9]+|[\u4e00-\u9fff]/g) ?? [];
  return new Set(tokens.filter((token) => token.trim().length > 0));
}

function roundSimilarity(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 10000) / 10000;
}
