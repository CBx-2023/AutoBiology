import {
  getDomainPattern,
  getParameterConstraint,
  getRisksForAction,
  type KnowledgeBase
} from "../knowledge/loader.js";

export function buildKnowledgeContext(action: string, knowledge: KnowledgeBase): string {
  const pattern = getDomainPattern(action, knowledge);
  if (!pattern) {
    return [`# Knowledge Context`, `Action: ${action}`, `No domain pattern found for this action.`].join("\n");
  }

  return [
    "# Knowledge Context",
    `Action: ${action}`,
    section("Required Parameters", pattern.requiredParameters.map((parameter) => formatParameter(parameter, knowledge))),
    section("Optional Parameters", pattern.optionalParameters.map((parameter) => formatParameter(parameter, knowledge))),
    section(
      "Triggered Risks",
      getRisksForAction(action, knowledge).map(
        (risk) => `${risk.name} [${risk.severity}/${risk.category}]: ${risk.standardHandling}; verify by ${risk.verificationMethod}`
      )
    ),
    section("Typical Risks", pattern.typicalRisks),
    section("Related Requirements", pattern.relatedRequirements),
    "Engineering Hints:",
    pattern.engineeringHints
  ].join("\n");
}

function formatParameter(parameter: string, knowledge: KnowledgeBase): string {
  const constraint = getParameterConstraint(parameter, knowledge);
  if (!constraint) return `${parameter}: no constraint available`;

  const threshold = constraint.criticalThresholds?.length ? `; critical thresholds ${constraint.criticalThresholds.join(", ")}` : "";
  return `${parameter}: unit ${constraint.unit}; typical range ${constraint.typicalRange[0]}-${constraint.typicalRange[1]}; tolerance ${constraint.tolerance}${threshold}; ${constraint.notes}`;
}

function section(title: string, items: string[]): string {
  const body = items.length > 0 ? items.map((item) => `- ${item}`).join("\n") : "- none";
  return `${title}:\n${body}`;
}
