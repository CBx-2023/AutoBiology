import { loadKnowledgeBase, type KnowledgeBase } from "../../knowledge/loader.js";
import type { HyperedgeTable, RequirementTable, VerificationReport } from "../types.js";
import { checkRequirementDeduplicationDeterministic } from "./dedup-checker.js";
import { scoreRequirementTableQuality } from "./quality-scorer.js";
import { verifyRiskCoverage } from "./risk-coverage.js";
import { verifyTraceability } from "./traceability.js";

export interface VerificationOptions {
  hyperedges?: HyperedgeTable;
  knowledge?: KnowledgeBase;
}

const EMPTY_HYPEREDGES: HyperedgeTable = { hyperedges: [] };

export function verifyRequirements(table: RequirementTable, options: VerificationOptions = {}): VerificationReport {
  const knowledge = options.knowledge ?? loadKnowledgeBase();
  const hyperedges = options.hyperedges ?? EMPTY_HYPEREDGES;
  const qualityScores = scoreRequirementTableQuality(table);
  const averageQuality =
    qualityScores.length === 0 ? 1 : qualityScores.reduce((sum, score) => sum + score.overall, 0) / qualityScores.length;
  const dedupResult = checkRequirementDeduplicationDeterministic(table.requirements);
  const riskCoverage = verifyRiskCoverage(table, hyperedges, knowledge);
  const traceability = verifyTraceability(table, hyperedges, knowledge);
  const highSeverityUncovered = riskCoverage.uncoveredRisks.filter((risk) => risk.severity === "high").length;
  const overallAssessment = assess(averageQuality, highSeverityUncovered, traceability.forwardCoverage);

  return {
    qualityScores,
    averageQuality: roundScore(averageQuality),
    dedupResult,
    riskCoverage,
    traceability,
    overallAssessment,
    summary: [
      `overall=${overallAssessment}`,
      `averageQuality=${roundScore(averageQuality).toFixed(3)}`,
      `highSeverityUncovered=${highSeverityUncovered}`,
      `forwardCoverage=${roundScore(traceability.forwardCoverage).toFixed(3)}`
    ].join("; ")
  };
}

function assess(averageQuality: number, highSeverityUncovered: number, forwardCoverage: number): VerificationReport["overallAssessment"] {
  if (averageQuality < 0.4 || highSeverityUncovered >= 3) return "fail";
  if (averageQuality >= 0.7 && highSeverityUncovered === 0 && forwardCoverage >= 0.9) return "pass";
  return "warn";
}

function roundScore(value: number): number {
  return Math.round(Math.max(0, Math.min(1, value)) * 10000) / 10000;
}
