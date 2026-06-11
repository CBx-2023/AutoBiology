import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { RequirementType } from "../pipeline/types.js";

export interface DomainPattern {
  requiredParameters: string[];
  optionalParameters: string[];
  typicalRisks: string[];
  relatedRequirements: RequirementType[];
  engineeringHints: string;
}

export interface ParameterConstraint {
  unit: string;
  typicalRange: [number, number];
  criticalThresholds?: number[];
  tolerance: string;
  notes: string;
}

export interface RiskCatalogEntry {
  category: string;
  severity: "low" | "medium" | "high";
  triggerActions: string[];
  standardHandling: string;
  verificationMethod: string;
}

export interface KnowledgeBase {
  synonyms: Record<string, string>;
  domainPatterns: Record<string, DomainPattern>;
  parameterConstraints: Record<string, ParameterConstraint>;
  riskCatalog: Record<string, RiskCatalogEntry>;
}

export interface NamedRiskCatalogEntry extends RiskCatalogEntry {
  name: string;
}

const DEFAULT_DATA_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "../../data");
const REQUIREMENT_TYPES = new Set(["R1", "R2", "R3", "R4", "R5", "R6", "R7", "R8", "R9", "R10"]);
const RISK_SEVERITIES = new Set(["low", "medium", "high"]);

export function loadKnowledgeBase(dataDir = DEFAULT_DATA_DIR): KnowledgeBase {
  const root = resolve(dataDir);
  const synonyms = readKnowledgeJson(root, "synonyms.json");
  assertStringRecord("synonyms.json", synonyms);
  const domainPatterns = readKnowledgeJson(root, "domain-patterns.json");
  assertDomainPatterns("domain-patterns.json", domainPatterns);
  const parameterConstraints = readKnowledgeJson(root, "parameter-constraints.json");
  assertParameterConstraints("parameter-constraints.json", parameterConstraints);
  const riskCatalog = readKnowledgeJson(root, "risk-catalog.json");
  assertRiskCatalog("risk-catalog.json", riskCatalog);

  return {
    synonyms,
    domainPatterns,
    parameterConstraints,
    riskCatalog
  };
}

export function normalizeKnowledgeTerm(value: string, knowledge: KnowledgeBase): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return knowledge.synonyms[normalized] ?? knowledge.synonyms[normalized.toLowerCase()] ?? normalized;
}

export function getDomainPattern(action: string, knowledge: KnowledgeBase): DomainPattern | undefined {
  return knowledge.domainPatterns[action];
}

export function getParameterConstraint(parameter: string, knowledge: KnowledgeBase): ParameterConstraint | undefined {
  return knowledge.parameterConstraints[parameter];
}

export function getRisksForAction(action: string, knowledge: KnowledgeBase): NamedRiskCatalogEntry[] {
  return Object.entries(knowledge.riskCatalog)
    .filter(([, risk]) => risk.triggerActions.includes(action))
    .map(([name, risk]) => ({ name, ...risk }));
}

function readKnowledgeJson(dataDir: string, fileName: string): unknown {
  const filePath = resolve(dataDir, fileName);
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as unknown;
  } catch (error) {
    const detail = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Invalid knowledge file ${fileName}: ${detail}`);
  }
}

function assertObject(fileName: string, value: unknown): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid knowledge file ${fileName}: expected JSON object`);
  }
}

function assertStringRecord(fileName: string, value: unknown): asserts value is Record<string, string> {
  assertObject(fileName, value);
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== "string" || item.trim() === "") {
      throw new Error(`Invalid knowledge file ${fileName}: ${key} must map to a non-empty string`);
    }
  }
}

function assertDomainPatterns(fileName: string, value: unknown): asserts value is Record<string, DomainPattern> {
  assertObject(fileName, value);
  for (const [action, item] of Object.entries(value)) {
    const pattern = assertRecord(fileName, action, item);
    assertStringArray(fileName, `${action}.requiredParameters`, pattern.requiredParameters);
    assertStringArray(fileName, `${action}.optionalParameters`, pattern.optionalParameters);
    assertStringArray(fileName, `${action}.typicalRisks`, pattern.typicalRisks, { nonEmpty: true });
    assertStringArray(fileName, `${action}.relatedRequirements`, pattern.relatedRequirements, { nonEmpty: true });
    for (const requirementType of pattern.relatedRequirements as string[]) {
      if (!REQUIREMENT_TYPES.has(requirementType)) {
        throw new Error(`Invalid knowledge file ${fileName}: ${action}.relatedRequirements contains ${requirementType}`);
      }
    }
    assertNonEmptyString(fileName, `${action}.engineeringHints`, pattern.engineeringHints);
  }
}

function assertParameterConstraints(fileName: string, value: unknown): asserts value is Record<string, ParameterConstraint> {
  assertObject(fileName, value);
  for (const [parameter, item] of Object.entries(value)) {
    const constraint = assertRecord(fileName, parameter, item);
    assertNonEmptyString(fileName, `${parameter}.unit`, constraint.unit);
    assertNumberPair(fileName, `${parameter}.typicalRange`, constraint.typicalRange);
    if (constraint.criticalThresholds !== undefined) {
      assertNumberArray(fileName, `${parameter}.criticalThresholds`, constraint.criticalThresholds);
    }
    assertNonEmptyString(fileName, `${parameter}.tolerance`, constraint.tolerance);
    assertNonEmptyString(fileName, `${parameter}.notes`, constraint.notes);
  }
}

function assertRiskCatalog(fileName: string, value: unknown): asserts value is Record<string, RiskCatalogEntry> {
  assertObject(fileName, value);
  for (const [riskName, item] of Object.entries(value)) {
    const risk = assertRecord(fileName, riskName, item);
    assertNonEmptyString(fileName, `${riskName}.category`, risk.category);
    assertNonEmptyString(fileName, `${riskName}.severity`, risk.severity);
    if (!RISK_SEVERITIES.has(risk.severity as string)) {
      throw new Error(`Invalid knowledge file ${fileName}: ${riskName}.severity must be low, medium, or high`);
    }
    assertStringArray(fileName, `${riskName}.triggerActions`, risk.triggerActions, { nonEmpty: true });
    assertNonEmptyString(fileName, `${riskName}.standardHandling`, risk.standardHandling);
    assertNonEmptyString(fileName, `${riskName}.verificationMethod`, risk.verificationMethod);
  }
}

function assertRecord(fileName: string, field: string, value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Invalid knowledge file ${fileName}: ${field} must be an object`);
  }
  return value as Record<string, unknown>;
}

function assertStringArray(fileName: string, field: string, value: unknown, options: { nonEmpty?: boolean } = {}): void {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string" && item.trim() !== "")) {
    throw new Error(`Invalid knowledge file ${fileName}: ${field} must be an array of non-empty strings`);
  }
  if (options.nonEmpty && value.length === 0) {
    throw new Error(`Invalid knowledge file ${fileName}: ${field} must not be empty`);
  }
}

function assertNumberArray(fileName: string, field: string, value: unknown): void {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "number" && Number.isFinite(item))) {
    throw new Error(`Invalid knowledge file ${fileName}: ${field} must be an array of finite numbers`);
  }
}

function assertNumberPair(fileName: string, field: string, value: unknown): void {
  if (!Array.isArray(value) || value.length !== 2 || !value.every((item) => typeof item === "number" && Number.isFinite(item))) {
    throw new Error(`Invalid knowledge file ${fileName}: ${field} must be a numeric [min, max] pair`);
  }
  if (value[0] > value[1]) {
    throw new Error(`Invalid knowledge file ${fileName}: ${field} min must be <= max`);
  }
}

function assertNonEmptyString(fileName: string, field: string, value: unknown): void {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Invalid knowledge file ${fileName}: ${field} must be a non-empty string`);
  }
}
