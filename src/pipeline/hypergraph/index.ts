import type { Hyperedge, Hypergraph, HyperNode, NodeType, Op, OpTable, ParameterEntry, RiskEntry } from "../types.js";

export function normalizeNodeName(name: string): string {
  const normalized = name.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  return SYNONYMS[normalized] ?? SYNONYMS[lower] ?? normalized;
}

export function buildHypergraph(opTable: OpTable): Hypergraph {
  const builder = new HypergraphBuilder(opTable.sopId);
  const hyperedges = opTable.ops.map((op) => builder.addOperation(op));

  return {
    nodes: { nodes: builder.nodes },
    edges: { hyperedges }
  };
}

const NODE_TYPES: NodeType[] = [
  "Action",
  "Precondition",
  "Input",
  "Target",
  "Container",
  "Location",
  "Tool",
  "OutputState",
  "Parameter",
  "Condition",
  "HumanJudgment",
  "Risk",
  "Handling"
];

const NODE_PREFIX: Record<NodeType, string> = {
  Action: "ACT",
  Precondition: "PRE",
  Input: "MAT",
  Target: "TAR",
  Container: "CON",
  Location: "LOC",
  Tool: "TOO",
  OutputState: "OUT",
  Parameter: "PAR",
  Condition: "CND",
  HumanJudgment: "JDG",
  Risk: "RSK",
  Handling: "HDL"
};

const SYNONYMS: Record<string, string> = {
  "PBS 缓冲液": "PBS",
  PBS缓冲液: "PBS",
  "磷酸盐缓冲液": "PBS",
  pbs: "PBS",
  "4摄氏度": "4°C",
  supernatant: "上清",
  pellet: "细胞沉淀"
};

class HypergraphBuilder {
  readonly nodes: HyperNode[] = [];
  private readonly nodeIndex = new Map<string, HyperNode>();
  private readonly counters = new Map<NodeType, number>();

  constructor(private readonly sopId: string) {}

  addOperation(op: Op): Hyperedge {
    const nodeRoles = emptyNodeRoles();
    const missingInfo = collectMissingInfo(op);
    const expertSupplement: string[] = [];

    const connect = (node: HyperNode) => {
      nodeRoles[node.nodeType].push(node.nodeId);
      if (!expertSupplement.includes(node.nodeId) && node.source !== "sop") {
        expertSupplement.push(node.nodeId);
      }
    };

    connect(this.upsertNode("Action", op.action, op.opId, "sop", { operationName: op.operationName }));
    addIfPresent(op.precondition, (value) => connect(this.upsertNode("Precondition", value, op.opId, "sop")));
    op.inputs.forEach((input) => addIfPresent(input, (value) => connect(this.upsertNode("Input", value, op.opId, "sop"))));
    addIfPresent(op.target, (value) => connect(this.upsertNode("Target", value, op.opId, "sop")));
    op.container.forEach((container) => addIfPresent(container, (value) => connect(this.upsertNode("Container", value, op.opId, "sop"))));
    addIfPresent(op.location, (value) => connect(this.upsertNode("Location", value, op.opId, inferSource(value))));
    op.tools.forEach((tool) => addIfPresent(tool, (value) => connect(this.upsertNode("Tool", value, op.opId, "expert"))));
    addIfPresent(op.outputState, (value) => connect(this.upsertNode("OutputState", value, op.opId, "sop")));
    op.parameters.forEach((parameter) => connect(this.upsertParameter(parameter, op.opId)));
    op.conditions.forEach((condition) => addIfPresent(condition, (value) => connect(this.upsertNode("Condition", value, op.opId, "sop"))));
    if (op.humanJudgment.required) {
      connect(
        this.upsertNode("HumanJudgment", op.humanJudgment.content, op.opId, "sop", {
          basis: op.humanJudgment.basis
        })
      );
    }
    op.risks.forEach((risk) => {
      connect(this.upsertRisk(risk, op.opId));
      addIfPresent(risk.handling, (value) => connect(this.upsertNode("Handling", value, op.opId, risk.source)));
    });

    const connectedNodes = unique(NODE_TYPES.flatMap((type) => nodeRoles[type]));

    return {
      hyperedgeId: `H-${op.opId}`,
      hyperedgeType: "OperationHyperedge",
      sourceOp: op.opId,
      sourceSop: this.sopId,
      sourceText: op.sourceText,
      parentStep: op.parentStep,
      connectedNodes,
      nodeRoles,
      missingInfo,
      expertSupplement,
      attributes: {
        operationName: op.operationName,
        isManualJudgmentRequired: op.humanJudgment.required,
        automationRelevance: inferAutomationRelevance(op)
      },
      notes: ""
    };
  }

  private upsertParameter(parameter: ParameterEntry, opId: string): HyperNode {
    return this.upsertNode("Parameter", parameter.rawText, opId, parameter.status === "specified" ? "sop" : "inferred", {
      name: parameter.name,
      value: parameter.value,
      unit: parameter.unit,
      rawText: parameter.rawText,
      status: parameter.status
    });
  }

  private upsertRisk(risk: RiskEntry, opId: string): HyperNode {
    return this.upsertNode("Risk", risk.name, opId, risk.source, { handling: risk.handling });
  }

  private upsertNode(
    nodeType: NodeType,
    nodeName: string,
    opId: string,
    source: HyperNode["source"],
    attributes: Record<string, unknown> = {}
  ): HyperNode {
    const normalizedName = normalizeNodeName(nodeName);
    const key = `${nodeType}:${normalizedName}`;
    const existing = this.nodeIndex.get(key);
    if (existing) {
      if (!existing.sourceOps.includes(opId)) existing.sourceOps.push(opId);
      if (nodeName !== existing.nodeName && !existing.synonyms.includes(nodeName)) existing.synonyms.push(nodeName);
      existing.attributes = { ...existing.attributes, ...attributes };
      return existing;
    }

    const node: HyperNode = {
      nodeId: this.nextNodeId(nodeType),
      nodeType,
      nodeName,
      normalizedName,
      source,
      sourceOps: [opId],
      sourceSop: this.sopId,
      attributes,
      synonyms: nodeName === normalizedName ? [] : [nodeName],
      notes: ""
    };
    this.nodeIndex.set(key, node);
    this.nodes.push(node);
    return node;
  }

  private nextNodeId(nodeType: NodeType): string {
    const next = (this.counters.get(nodeType) ?? 0) + 1;
    this.counters.set(nodeType, next);
    return `${NODE_PREFIX[nodeType]}-${String(next).padStart(3, "0")}`;
  }
}

function emptyNodeRoles(): Record<NodeType, string[]> {
  return {
    Action: [],
    Precondition: [],
    Input: [],
    Target: [],
    Container: [],
    Location: [],
    Tool: [],
    OutputState: [],
    Parameter: [],
    Condition: [],
    HumanJudgment: [],
    Risk: [],
    Handling: []
  };
}

function collectMissingInfo(op: Op): string[] {
  const missing: string[] = [];
  if (isMissing(op.precondition)) missing.push("前置条件未说明");
  if (op.inputs.length === 0 || op.inputs.every(isMissing)) missing.push("输入物未说明");
  if (isMissing(op.target)) missing.push("作用对象未说明");
  if (op.parameters.some((parameter) => parameter.status !== "specified")) missing.push("参数未充分说明");
  return missing;
}

function inferSource(value: string): HyperNode["source"] {
  return isMissing(value) ? "inferred" : "sop";
}

function inferAutomationRelevance(op: Op): "high" | "medium" | "low" {
  if (op.humanJudgment.required || op.risks.length > 0) return "high";
  if (["转移", "加液", "吸液", "弃液", "收集"].includes(op.action)) return "high";
  if (["离心", "培养", "孵育"].includes(op.action)) return "medium";
  return "low";
}

function addIfPresent(value: string, add: (value: string) => void): void {
  if (!isMissing(value)) add(value);
}

function isMissing(value: string): boolean {
  return value.trim() === "" || value === "无" || value === "未说明";
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
