import {
  getDomainPattern,
  getParameterConstraint,
  getRisksForAction,
  loadKnowledgeBase,
  normalizeKnowledgeTerm,
  type KnowledgeBase
} from "../../knowledge/loader.js";
import type { Op, OpTable, ParameterEntry, RiskEntry } from "../types.js";
import { splitSopIntoOperationChunks } from "./rules.js";

export interface AtomizeOptions {
  sopId: string;
  sopName: string;
  knowledgeBase?: KnowledgeBase;
  extractFields?: (input: FieldExtractionInput) => Promise<Partial<Op>>;
}

export interface FieldExtractionInput {
  opId: string;
  sourceText: string;
  parentStep: string;
  action: string;
  prompt: string;
}

export { splitSopIntoOperationChunks };
export type { OperationChunk } from "./rules.js";

export async function atomizeSop(sopText: string, options: AtomizeOptions): Promise<OpTable> {
  const chunks = splitSopIntoOperationChunks(sopText);
  const knowledge = options.knowledgeBase ?? loadKnowledgeBase();
  const ops: Op[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const opId = `OP-${String(index + 1).padStart(3, "0")}`;
    const prompt = buildExtractOpPrompt(chunk.sourceText, opId);
    const baseOp = buildRuleBasedOp(
      {
        opId,
        sourceText: chunk.sourceText,
        parentStep: chunk.parentStep,
        action: chunk.action,
        prompt
      },
      knowledge
    );
    const extracted = options.extractFields
      ? await options.extractFields({ opId, sourceText: chunk.sourceText, parentStep: chunk.parentStep, action: chunk.action, prompt })
      : {};
    ops.push({ ...baseOp, ...extracted, opId });
  }

  return {
    sopId: options.sopId,
    sopName: options.sopName,
    ops
  };
}

export function buildExtractOpPrompt(sourceText: string, opId: string): string {
  return [
    "You extract one minimal biological SOP operation into the AutoBiology Op JSON contract.",
    "Return only JSON with these fields:",
    "opId, sourceText, parentStep, operationName, action, precondition, inputs, target, container, location, tools, outputState, parameters, conditions, humanJudgment, risks.",
    "parameters items: { name, value, unit, rawText, status }.",
    "humanJudgment: { required, content, basis }.",
    "risks items: { name, source, handling }.",
    `opId: ${opId}`,
    `sourceText: ${sourceText}`
  ].join("\n");
}

function buildRuleBasedOp(input: FieldExtractionInput, knowledge: KnowledgeBase): Op {
  const parameters = extractParameters(input.sourceText, knowledge);
  const humanJudgment = inferHumanJudgment(input.sourceText, input.action);

  return {
    opId: input.opId,
    sourceText: input.sourceText,
    parentStep: input.parentStep,
    operationName: input.sourceText,
    action: input.action,
    precondition: "未说明",
    inputs: inferInputs(input.sourceText, input.action, knowledge),
    target: inferTarget(input.sourceText, input.action, knowledge),
    container: inferContainers(input.sourceText, knowledge),
    location: inferLocation(input.sourceText, input.action, knowledge),
    tools: inferTools(input.sourceText, input.action, knowledge),
    outputState: inferOutputState(input.sourceText, input.action, knowledge),
    parameters,
    conditions: inferConditions(input.sourceText, parameters, knowledge),
    humanJudgment,
    risks: inferRisks(input.action, humanJudgment.required, knowledge)
  };
}

function extractParameters(text: string, knowledge: KnowledgeBase): ParameterEntry[] {
  const normalizedText = normalizeTextWithKnowledge(text, knowledge);
  const parameters: ParameterEntry[] = [];
  const temperature = normalizedText.match(/(-?\d+(?:\.\d+)?)\s*°\s*C/i);
  if (temperature) {
    parameters.push({
      name: "温度",
      value: Number(temperature[1]),
      unit: "°C",
      rawText: `${temperature[1]}°C`,
      status: "specified"
    });
  }

  const force = normalizedText.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (force) {
    parameters.push({
      name: "离心力",
      value: Number(force[1]),
      unit: "g",
      rawText: `${force[1]}g`,
      status: "specified"
    });
  }

  const time = normalizedText.match(/(\d+(?:\.\d+)?)\s*(min|h)\b/i);
  if (time) {
    parameters.push({
      name: "时间",
      value: Number(time[1]),
      unit: time[2],
      rawText: `${time[1]} ${time[2]}`,
      status: "specified"
    });
  }

  const volume = normalizedText.match(/(\d+(?:\.\d+)?)\s*(mL|ml|μL|uL|µL)\b/);
  if (volume) {
    parameters.push({
      name: "体积",
      value: Number(volume[1]),
      unit: volume[2],
      rawText: `${volume[1]} ${volume[2]}`,
      status: "specified"
    });
  }

  if (parameters.length === 0 && /适量|少许|轻轻|充分|快速|缓慢|短暂|未说明/.test(text)) {
    parameters.push({ name: "未说明参数", value: null, unit: "", rawText: text, status: "ambiguous" });
  }

  return parameters;
}

function inferInputs(text: string, action: string, knowledge: KnowledgeBase): string[] {
  const materials = findKnowledgeTerms(text, knowledge).filter((term) => isMaterialTerm(term));
  if (materials.length > 0) return materials;
  return action === "加液" ? ["未说明"] : [];
}

function inferTarget(text: string, _action: string, knowledge: KnowledgeBase): string {
  return findKnowledgeTerms(text, knowledge).find((term) => /细胞|上清|沉淀|悬液|样本/.test(term)) ?? "未说明";
}

function inferContainers(text: string, knowledge: KnowledgeBase): string[] {
  return findKnowledgeTerms(text, knowledge).filter(isContainerTerm);
}

function inferLocation(text: string, action: string, knowledge: KnowledgeBase): string {
  const explicit = findKnowledgeTerms(text, knowledge).find(isLocationTerm);
  return explicit ?? getDomainPattern(action, knowledge)?.inference?.defaultLocation ?? "未说明";
}

function inferTools(text: string, action: string, knowledge: KnowledgeBase): string[] {
  const explicit = findKnowledgeTerms(text, knowledge).filter(isToolTerm);
  return unique([...explicit, ...(getDomainPattern(action, knowledge)?.inference?.defaultTools ?? [])]);
}

function inferOutputState(text: string, action: string, knowledge: KnowledgeBase): string {
  const output = getDomainPattern(action, knowledge)?.inference?.outputState;
  if (!output) return "未说明";
  return output.replace("{target}", inferTarget(text, action, knowledge));
}

function inferConditions(text: string, parameters: ParameterEntry[], knowledge: KnowledgeBase): string[] {
  const conditions = new Set<string>();
  for (const term of findKnowledgeTerms(text, knowledge)) {
    if (["无菌", "避光", "CO2", "低温环境"].includes(term)) conditions.add(term);
  }
  const coldThreshold = getParameterConstraint("温度", knowledge)?.criticalThresholds?.[0] ?? 4;
  if (parameters.some((parameter) => parameter.name === "温度" && (parameter.value ?? Number.POSITIVE_INFINITY) <= coldThreshold)) {
    conditions.add("低温");
  }
  return [...conditions];
}

function inferHumanJudgment(text: string, action: string): Op["humanJudgment"] {
  if (action === "判断" || /观察|确认|检查|是否|待|直至/.test(text)) {
    return { required: true, content: text, basis: "观察或检测结果" };
  }
  if (action === "弃液" && text.includes("上清")) {
    return { required: true, content: "是否完整保留细胞沉淀", basis: "肉眼观察沉淀位置和完整性" };
  }
  if (action === "收集" && text.includes("细胞沉淀")) {
    return { required: true, content: "细胞沉淀是否收集完整", basis: "肉眼观察残留沉淀" };
  }
  return { required: false, content: "无", basis: "无" };
}

function inferRisks(action: string, manualJudgmentRequired: boolean, knowledge: KnowledgeBase): RiskEntry[] {
  const catalogRisks = getRisksForAction(action, knowledge);
  if (manualJudgmentRequired && !catalogRisks.some((risk) => risk.name === "人工判断偏差")) {
    const judgmentRisk = knowledge.riskCatalog["人工判断偏差"];
    if (judgmentRisk) catalogRisks.push({ name: "人工判断偏差", ...judgmentRisk });
  }
  return catalogRisks.map((risk) => ({ name: risk.name, source: "expert", handling: risk.standardHandling }));
}

function findKnowledgeTerms(text: string, knowledge: KnowledgeBase): string[] {
  const matches = Object.keys(knowledge.synonyms)
    .sort((left, right) => right.length - left.length)
    .filter((alias) => createAliasRegExp(alias).test(text))
    .map((alias) => normalizeKnowledgeTerm(alias, knowledge));
  return unique(matches);
}

function normalizeTextWithKnowledge(text: string, knowledge: KnowledgeBase): string {
  return Object.entries(knowledge.synonyms)
    .sort(([left], [right]) => right.length - left.length)
    .reduce(
      (normalized, [alias, canonical]) => normalized.replace(createAliasRegExp(alias, true), canonical),
      text
    );
}

function createAliasRegExp(alias: string, global = false): RegExp {
  const prefix = /^[A-Za-z0-9]/.test(alias) ? "(?<![A-Za-z0-9])" : "";
  const suffix = /[A-Za-z0-9]$/.test(alias) ? "(?![A-Za-z0-9])" : "";
  return new RegExp(`${prefix}${escapeRegExp(alias)}${suffix}`, global ? "gi" : "i");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isContainerTerm(term: string): boolean {
  return /容器|离心管|多孔板|培养瓶|培养皿|孔板|管$|瓶$|皿$|板$/.test(term);
}

function isLocationTerm(term: string): boolean {
  return /工作台|培养箱|低温环境|转子位/.test(term);
}

function isToolTerm(term: string): boolean {
  return /移液器|吸头|离心机|转子|工作台/.test(term);
}

function isMaterialTerm(term: string): boolean {
  return (
    !isContainerTerm(term) &&
    !isLocationTerm(term) &&
    !isToolTerm(term) &&
    !/^(?:mL|µL|min|h|°C|g)$|^\d+°C$|室温|无菌|避光|CO2/.test(term)
  );
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
