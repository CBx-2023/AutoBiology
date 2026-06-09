import type { Op, OpTable, ParameterEntry, RiskEntry } from "../types.js";
import { splitSopIntoOperationChunks } from "./rules.js";

export interface AtomizeOptions {
  sopId: string;
  sopName: string;
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
  const ops: Op[] = [];

  for (const [index, chunk] of chunks.entries()) {
    const opId = `OP-${String(index + 1).padStart(3, "0")}`;
    const prompt = buildExtractOpPrompt(chunk.sourceText, opId);
    const baseOp = buildRuleBasedOp({
      opId,
      sourceText: chunk.sourceText,
      parentStep: chunk.parentStep,
      action: chunk.action,
      prompt
    });
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

function buildRuleBasedOp(input: FieldExtractionInput): Op {
  const parameters = extractParameters(input.sourceText);
  const humanJudgment = inferHumanJudgment(input.sourceText, input.action);

  return {
    opId: input.opId,
    sourceText: input.sourceText,
    parentStep: input.parentStep,
    operationName: input.sourceText,
    action: input.action,
    precondition: "未说明",
    inputs: inferInputs(input.sourceText, input.action),
    target: inferTarget(input.sourceText, input.action),
    container: inferContainers(input.sourceText),
    location: inferLocation(input.sourceText, input.action),
    tools: inferTools(input.action),
    outputState: inferOutputState(input.sourceText, input.action),
    parameters,
    conditions: inferConditions(input.sourceText, parameters),
    humanJudgment,
    risks: inferRisks(input.sourceText, input.action, humanJudgment.required)
  };
}

function extractParameters(text: string): ParameterEntry[] {
  const parameters: ParameterEntry[] = [];
  const temperature = text.match(/(-?\d+(?:\.\d+)?)\s*°\s*C/i);
  if (temperature) {
    parameters.push({
      name: "温度",
      value: Number(temperature[1]),
      unit: "°C",
      rawText: `${temperature[1]}°C`,
      status: "specified"
    });
  }

  const force = text.match(/(\d+(?:\.\d+)?)\s*g\b/i);
  if (force) {
    parameters.push({
      name: "离心力",
      value: Number(force[1]),
      unit: "g",
      rawText: `${force[1]}g`,
      status: "specified"
    });
  }

  const time = text.match(/(\d+(?:\.\d+)?)\s*(min|分钟|h|小时)\b/i);
  if (time) {
    parameters.push({
      name: "时间",
      value: Number(time[1]),
      unit: normalizeTimeUnit(time[2]),
      rawText: `${time[1]} ${normalizeTimeUnit(time[2])}`,
      status: "specified"
    });
  }

  const volume = text.match(/(\d+(?:\.\d+)?)\s*(mL|ml|μL|uL|µL)\b/);
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

function normalizeTimeUnit(unit: string): string {
  if (unit === "分钟") return "min";
  if (unit === "小时") return "h";
  return unit;
}

function inferInputs(text: string, action: string): string[] {
  if (action === "加液") {
    const reagent = text.match(/(?:加入|添加|滴加|补液)\s*([A-Za-z0-9%°\u4e00-\u9fa5]+(?:\s*[A-Za-z0-9%°\u4e00-\u9fa5]+)?)/)?.[1];
    return reagent ? [cleanEntity(reagent)] : ["未说明"];
  }
  if (text.includes("细胞悬液")) return ["细胞悬液"];
  if (text.includes("细胞沉淀")) return ["细胞沉淀"];
  return [];
}

function inferTarget(text: string, action: string): string {
  if (text.includes("上清")) return "上清";
  if (text.includes("细胞沉淀")) return "细胞沉淀";
  if (text.includes("细胞悬液")) return "细胞悬液";
  if (text.includes("细胞")) return "细胞";
  if (action === "加液") return "未说明";
  return "未说明";
}

function inferContainers(text: string): string[] {
  const containers = ["离心瓶", "离心管", "孔板", "培养瓶", "培养容器"].filter((container) => text.includes(container));
  return containers;
}

function inferLocation(text: string, action: string): string {
  if (text.includes("培养箱")) return "培养箱";
  if (action === "离心") return "离心机转子位";
  if (["转移", "加液", "吸液", "弃液", "收集", "重悬", "混匀"].includes(action)) return "操作台/超净台";
  return "未说明";
}

function inferTools(action: string): string[] {
  const toolsByAction: Record<string, string[]> = {
    转移: ["移液管", "泵或倾倒工具"],
    加液: ["移液枪", "枪头"],
    吸液: ["吸液器", "移液枪"],
    弃液: ["倾倒工具", "吸液器或移液管"],
    重悬: ["移液枪"],
    混匀: ["移液枪或振荡器"],
    离心: ["冷冻离心机"],
    收集: ["刮刀", "移液器或称量工具"]
  };
  return toolsByAction[action] ?? [];
}

function inferOutputState(text: string, action: string): string {
  if (action === "离心") return "形成细胞沉淀和上清";
  if (action === "弃液" && text.includes("上清")) return "上清被去除，细胞沉淀保留";
  if (action === "收集" && text.includes("细胞沉淀")) return "获得细胞沉淀";
  if (action === "转移") return `${inferTarget(text, action)}进入目标容器`;
  if (action === "加液") return "完成加液";
  if (action === "吸液") return "液体被吸除";
  if (action === "重悬") return "目标被重悬";
  if (action === "混匀") return "体系混匀";
  return "未说明";
}

function inferConditions(text: string, parameters: ParameterEntry[]): string[] {
  const conditions = new Set<string>();
  if (/无菌|超净/.test(text)) conditions.add("无菌");
  if (/避光/.test(text)) conditions.add("避光");
  if (/低温/.test(text) || parameters.some((parameter) => parameter.name === "温度" && (parameter.value ?? 99) <= 10)) {
    conditions.add("低温");
  }
  if (/CO2|CO₂/.test(text)) conditions.add("CO2 培养环境");
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

function inferRisks(text: string, action: string, manualJudgmentRequired: boolean): RiskEntry[] {
  const risks = new Map<string, RiskEntry>();
  const add = (name: string, handling: string) => risks.set(name, { name, source: "expert", handling });

  if (["转移", "加液", "吸液", "弃液", "收集"].includes(action)) add("污染", "保持无菌操作并减少暴露时间");
  if (["转移", "收集"].includes(action)) add("样本损失", "缓慢操作并核对转移/收集量");
  if (action === "离心") {
    add("配平失败", "设置并核对离心参数，确认离心瓶配平");
    if (text.includes("4°C") || text.includes("低温")) add("温升导致样本降解", "使用冷冻离心机并维持低温");
  }
  if (action === "弃液") add("沉淀丢失", "缓慢倾倒或吸液并保留沉淀");
  if (manualJudgmentRequired) add("人工判断偏差", "提供视觉或传感确认依据");

  return [...risks.values()];
}

function cleanEntity(entity: string): string {
  return entity.replace(/[，。；;,.]$/g, "").trim();
}
