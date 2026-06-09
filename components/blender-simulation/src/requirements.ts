import { readFile } from "node:fs/promises";
import type { SimulationRequirement, SimulationRequirementTable } from "./types.js";

const REQUIREMENT_TYPES = new Set(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]);
const REQUIREMENT_PRIORITIES = new Set(["high", "medium", "low", "unset"]);
const REQUIREMENT_STATUSES = new Set(["candidate", "confirmed", "clarification", "rejected", "frozen"]);

export async function loadRequirementTable(path: string): Promise<SimulationRequirementTable> {
  const content = await readFile(path, "utf8");
  return parseRequirementTable(JSON.parse(content));
}

export function parseRequirementTable(value: unknown): SimulationRequirementTable {
  if (!isRecord(value)) {
    throw new Error("Requirement table must be an object");
  }

  const requirements = value.requirements;
  if (!Array.isArray(requirements)) {
    throw new Error("requirements must be an array");
  }

  return {
    requirements: requirements.map(parseRequirement),
    clarifications: Array.isArray(value.clarifications) ? value.clarifications : []
  };
}

function parseRequirement(value: unknown, index: number): SimulationRequirement {
  if (!isRecord(value)) {
    throw new Error(`Invalid requirement at index ${index}: must be an object`);
  }

  const requirementId = requiredString(value.requirementId, "requirementId", index);
  const type = requiredString(value.type, "type", index);
  if (!REQUIREMENT_TYPES.has(type)) {
    throw new Error(`Invalid requirement ${requirementId}: unsupported type ${type}`);
  }

  return {
    requirementId,
    type,
    description: requiredString(value.description, "description", index),
    sourceOps: requiredStringArray(value.sourceOps, "sourceOps", index),
    sourceHyperedges: requiredStringArray(value.sourceHyperedges, "sourceHyperedges", index),
    sourceFields: requiredStringArray(value.sourceFields, "sourceFields", index),
    applicableTo: requiredString(value.applicableTo, "applicableTo", index),
    keyMetrics: requiredStringArray(value.keyMetrics, "keyMetrics", index),
    constraints: requiredStringArray(value.constraints, "constraints", index),
    relatedRisks: requiredStringArray(value.relatedRisks, "relatedRisks", index),
    responsibleModule: requiredString(value.responsibleModule, "responsibleModule", index),
    verificationMethod: requiredString(value.verificationMethod, "verificationMethod", index),
    priority: requiredEnum(value.priority, "priority", index, REQUIREMENT_PRIORITIES),
    status: requiredEnum(value.status, "status", index, REQUIREMENT_STATUSES),
    inferenceRule: requiredString(value.inferenceRule, "inferenceRule", index),
    confidence: requiredConfidence(value.confidence, index),
    fingerprint: requiredString(value.fingerprint, "fingerprint", index)
  };
}

function requiredString(value: unknown, field: string, index: number): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Invalid requirement at index ${index}: ${field} must be a non-empty string`);
  }

  return value;
}

function requiredNumber(value: unknown, field: string, index: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Invalid requirement at index ${index}: ${field} must be a finite number`);
  }

  return value;
}

function requiredConfidence(value: unknown, index: number): number {
  const confidence = requiredNumber(value, "confidence", index);

  if (confidence < 0 || confidence > 1) {
    throw new Error(`Invalid requirement at index ${index}: confidence must be between 0 and 1`);
  }

  return confidence;
}

function requiredEnum(value: unknown, field: string, index: number, allowedValues: Set<string>): string {
  const stringValue = requiredString(value, field, index);

  if (!allowedValues.has(stringValue)) {
    throw new Error(
      `Invalid requirement at index ${index}: ${field} must be one of ${[...allowedValues].join(", ")}`
    );
  }

  return stringValue;
}

function requiredStringArray(value: unknown, field: string, index: number): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new Error(`Invalid requirement at index ${index}: ${field} must be a string array`);
  }

  return [...value];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
