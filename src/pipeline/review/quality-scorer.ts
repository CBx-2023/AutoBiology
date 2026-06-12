import type { QualityScore, Requirement, RequirementTable } from "../types.js";

const NUMERIC_EVIDENCE = /(\d+(?:\.\d+)?\s*(?:°C|g|rpm|min|s|mL|μL|uL|%|次|count|mL\/s)|±\s*\d+(?:\.\d+)?)/i;
const VERIFICATION_EVIDENCE = /验证|测试|记录|检测|校准|复核|acceptance|verify|test/i;
const ENGINEERING_PATTERN = /^设备应.+(在|将|对|支持|记录|控制|检测|执行).+/;
const UNDERSPECIFIED = /未说明|适量|尽快|合适|相关|若干|某些/;

export function scoreRequirementQuality(requirement: Requirement): QualityScore {
  const issues: string[] = [];
  const testability = scoreTestability(requirement, issues);
  const specificity = scoreSpecificity(requirement, issues);
  const traceability = scoreTraceability(requirement, issues);
  const engineeringSemantic = scoreEngineeringSemantic(requirement, issues);
  const overall = roundScore(0.3 * testability + 0.25 * specificity + 0.2 * traceability + 0.25 * engineeringSemantic);

  return {
    requirementId: requirement.requirementId,
    dimensions: {
      testability,
      specificity,
      traceability,
      engineeringSemantic
    },
    overall,
    issues: unique(issues)
  };
}

export function scoreRequirementTableQuality(table: RequirementTable): QualityScore[] {
  return table.requirements.map(scoreRequirementQuality);
}

function scoreTestability(requirement: Requirement, issues: string[]): number {
  const hasMetric = requirement.keyMetrics.length > 0 || NUMERIC_EVIDENCE.test(requirement.description);
  const hasVerification = Boolean(requirement.verificationMethod.trim()) && !UNDERSPECIFIED.test(requirement.verificationMethod);

  if (hasMetric && hasVerification) return 1;
  if (hasMetric || hasVerification || VERIFICATION_EVIDENCE.test(requirement.description)) {
    issues.push("missing verification method or measurable acceptance evidence");
    return 0.6;
  }

  issues.push("missing verification method or measurable acceptance evidence");
  return 0.2;
}

function scoreSpecificity(requirement: Requirement, issues: string[]): number {
  const hasScope = Boolean(requirement.applicableTo.trim()) && !UNDERSPECIFIED.test(requirement.applicableTo);
  const hasBoundary =
    requirement.keyMetrics.length > 0 ||
    requirement.constraints.length > 0 ||
    NUMERIC_EVIDENCE.test(requirement.description) ||
    /范围|精度|阈值|容差|低温|无菌/.test(requirement.description);

  if (hasScope && hasBoundary && !UNDERSPECIFIED.test(requirement.description)) return 1;
  if (hasScope || hasBoundary) {
    if (UNDERSPECIFIED.test(requirement.description)) issues.push("description contains underspecified placeholder text");
    else issues.push("missing explicit parameter range or boundary");
    return 0.55;
  }

  issues.push("description contains underspecified placeholder text");
  return 0.2;
}

function scoreTraceability(requirement: Requirement, issues: string[]): number {
  const missing = [
    requirement.sourceOps.length === 0 ? "sourceOps" : "",
    requirement.sourceHyperedges.length === 0 ? "sourceHyperedges" : "",
    requirement.sourceFields.length === 0 ? "sourceFields" : ""
  ].filter(Boolean);

  if (missing.length === 0) return 1;
  issues.push(`missing traceability fields: ${missing.join(", ")}`);
  if (missing.length === 1) return 0.65;
  if (missing.length === 2) return 0.35;
  return 0;
}

function scoreEngineeringSemantic(requirement: Requirement, issues: string[]): number {
  if (ENGINEERING_PATTERN.test(requirement.description) && NUMERIC_EVIDENCE.test(requirement.description)) return 1;
  if (ENGINEERING_PATTERN.test(requirement.description) || /^设备应/.test(requirement.description)) {
    issues.push("engineering requirement lacks measurable semantic structure");
    return 0.6;
  }

  issues.push("description does not follow engineering requirement wording");
  return 0.2;
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 10000) / 10000;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
