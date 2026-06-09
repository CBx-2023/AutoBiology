import { createHash } from "node:crypto";
import type {
  Clarification,
  Hyperedge,
  Hypergraph,
  HyperNode,
  NodeType,
  Requirement,
  RequirementTable,
  RequirementType
} from "../types.js";

export function generateRequirements(hypergraph: Hypergraph): RequirementTable {
  const generator = new RequirementGenerator(hypergraph);
  return generator.generate();
}

export function createRequirementFingerprint(
  requirement: Pick<Requirement, "type" | "description" | "sourceFields" | "applicableTo">
): string {
  const seed = [
    requirement.type,
    normalizeText(requirement.description),
    [...requirement.sourceFields].sort().join("+"),
    normalizeText(requirement.applicableTo)
  ].join("|");
  return createHash("sha1").update(seed).digest("hex");
}

type RequirementDraft = Omit<Requirement, "requirementId" | "fingerprint">;

class RequirementGenerator {
  private readonly nodesById: Map<string, HyperNode>;
  private readonly drafts = new Map<string, RequirementDraft>();
  private readonly clarifications: Clarification[] = [];

  constructor(private readonly hypergraph: Hypergraph) {
    this.nodesById = new Map(hypergraph.nodes.nodes.map((node) => [node.nodeId, node]));
  }

  generate(): RequirementTable {
    for (const edge of this.hypergraph.edges.hyperedges) {
      this.generateForEdge(edge);
      this.applyDomainPatterns(edge);
    }

    const requirements = [...this.drafts.values()].map((draft, index) => {
      const requirement: Requirement = {
        requirementId: `REQ-${String(index + 1).padStart(3, "0")}`,
        ...draft,
        fingerprint: ""
      };
      requirement.fingerprint = createRequirementFingerprint(requirement);
      return requirement;
    });

    return {
      requirements,
      clarifications: this.clarifications
    };
  }

  private generateForEdge(edge: Hyperedge): void {
    const action = firstLabel(edge, this.nodesById, "Action");
    const inputs = labels(edge, this.nodesById, "Input");
    const targets = labels(edge, this.nodesById, "Target");
    const containers = labels(edge, this.nodesById, "Container");
    const parameters = labels(edge, this.nodesById, "Parameter");
    const conditions = labels(edge, this.nodesById, "Condition");
    const judgments = labels(edge, this.nodesById, "HumanJudgment");
    const risks = labels(edge, this.nodesById, "Risk");
    const handlings = labels(edge, this.nodesById, "Handling");
    const outputs = labels(edge, this.nodesById, "OutputState");
    const applicableTo = firstNonEmpty([...targets, ...inputs, edge.attributes.operationName]);

    if (action) {
      this.add(edge, {
        type: "R1",
        description: `设备应能够执行${action}操作，适用对象为${applicableTo}。`,
        sourceFields: ["Action", "Input", "Target", "OutputState"],
        applicableTo,
        keyMetrics: [],
        constraints: outputs,
        relatedRisks: risks,
        responsibleModule: moduleFor("R1"),
        verificationMethod: `${action}功能测试`,
        priority: "high",
        status: "confirmed",
        inferenceRule: "DM-R1",
        confidence: 1
      });
    }

    if (inputs.length || targets.length || containers.length) {
      const compatibleItems = unique([...inputs, ...targets, ...containers]);
      this.add(edge, {
        type: "R2",
        description: `设备应兼容${compatibleItems.join("、")}的处理或承载。`,
        sourceFields: ["Input", "Target", "Container"],
        applicableTo: compatibleItems.join("、"),
        keyMetrics: [],
        constraints: containers,
        relatedRisks: risks,
        responsibleModule: moduleFor("R2"),
        verificationMethod: "物料和容器兼容性测试",
        priority: "high",
        status: "confirmed",
        inferenceRule: "DM-R2",
        confidence: 1
      });
    }

    if (parameters.length) {
      this.add(edge, {
        type: "R3",
        description: `设备或关联模块应支持${parameters.join("、")}的${action || edge.attributes.operationName}工艺参数控制。`,
        sourceFields: ["Parameter"],
        applicableTo,
        keyMetrics: parameters,
        constraints: [],
        relatedRisks: risks,
        responsibleModule: moduleFor("R3"),
        verificationMethod: "参数设定与记录准确性测试",
        priority: "high",
        status: "confirmed",
        inferenceRule: "DM-R3",
        confidence: 1
      });
    }

    if (conditions.length || risks.length) {
      const environment = unique([...conditions, ...risks]).join("、");
      this.add(edge, {
        type: "R4",
        description: `操作过程应满足${environment}相关环境或约束要求。`,
        sourceFields: ["Condition", "Risk"],
        applicableTo,
        keyMetrics: conditions,
        constraints: conditions,
        relatedRisks: risks,
        responsibleModule: moduleFor("R4"),
        verificationMethod: "环境约束与风险暴露测试",
        priority: "medium",
        status: "confirmed",
        inferenceRule: "DM-R4",
        confidence: 0.9
      });
    }

    this.add(edge, {
      type: "R5",
      description: `设备应按${edge.parentStep}流程执行${edge.attributes.operationName}，并保持与来源 SOP 的操作顺序一致。`,
      sourceFields: ["ParentStep", "Precondition"],
      applicableTo,
      keyMetrics: [],
      constraints: edge.missingInfo.filter((item) => item.includes("前置条件")),
      relatedRisks: risks,
      responsibleModule: moduleFor("R5"),
      verificationMethod: "流程顺序与状态转移测试",
      priority: "medium",
      status: "confirmed",
      inferenceRule: "DM-R5",
      confidence: 0.9
    });

    if (judgments.length) {
      this.add(edge, {
        type: "R6",
        description: `设备应能够替代或支持人工判断：${judgments.join("、")}。`,
        sourceFields: ["HumanJudgment", "JudgmentBasis"],
        applicableTo,
        keyMetrics: judgments,
        constraints: [],
        relatedRisks: risks,
        responsibleModule: moduleFor("R6"),
        verificationMethod: "感知判断一致性测试",
        priority: "high",
        status: "candidate",
        inferenceRule: "DM-R6",
        confidence: 0.9
      });
    }

    if (risks.length) {
      this.add(edge, {
        type: "R7",
        description: `设备应降低${risks.join("、")}风险。`,
        sourceFields: ["Risk"],
        applicableTo,
        keyMetrics: [],
        constraints: [],
        relatedRisks: risks,
        responsibleModule: moduleFor("R7"),
        verificationMethod: "风险控制验证测试",
        priority: "high",
        status: "confirmed",
        inferenceRule: "DM-R7",
        confidence: 1
      });
    }

    if (risks.length || handlings.length) {
      this.add(edge, {
        type: "R8",
        description: `当出现${risks.join("、") || "异常"}时，设备应支持${handlings.join("、") || "暂停并提示复核"}。`,
        sourceFields: ["Risk", "Handling"],
        applicableTo,
        keyMetrics: [],
        constraints: handlings,
        relatedRisks: risks,
        responsibleModule: moduleFor("R8"),
        verificationMethod: "异常触发与恢复流程测试",
        priority: "high",
        status: "candidate",
        inferenceRule: "DM-R8",
        confidence: 0.9
      });
    }

    if (parameters.length || risks.length || judgments.length || action) {
      this.add(edge, {
        type: "R9",
        description: `设备应记录${edge.attributes.operationName}的操作状态、关键参数、判断结果和异常风险。`,
        sourceFields: ["OP", "Parameter", "Risk", "Judgment"],
        applicableTo,
        keyMetrics: parameters,
        constraints: [],
        relatedRisks: risks,
        responsibleModule: moduleFor("R9"),
        verificationMethod: "数据记录和追溯字段完整性检查",
        priority: "medium",
        status: "confirmed",
        inferenceRule: "DM-R9",
        confidence: 0.85
      });
    }

    this.add(edge, {
      type: "R10",
      description: `应通过${edge.attributes.operationName}的功能、参数、输出状态和风险场景测试证明相关需求满足。`,
      sourceFields: ["Requirement", "Parameter", "Risk", "OutputState"],
      applicableTo,
      keyMetrics: parameters,
      constraints: outputs,
      relatedRisks: risks,
      responsibleModule: moduleFor("R10"),
      verificationMethod: `${edge.attributes.operationName}验收测试`,
      priority: "medium",
      status: "candidate",
      inferenceRule: "DM-R10",
      confidence: 0.85
    });
  }

  private applyDomainPatterns(edge: Hyperedge): void {
    const action = firstLabel(edge, this.nodesById, "Action");
    if (action !== "离心") return;

    const parameterNames = nodes(edge, this.nodesById, "Parameter").map((node) => String(node.attributes.name ?? node.normalizedName));
    const missing = ["温度", "离心力", "时间"].filter((required) => !parameterNames.includes(required));
    if (missing.length === 0) return;

    this.clarifications.push({
      id: `CLR-${String(this.clarifications.length + 1).padStart(3, "0")}`,
      question: `离心操作缺少${missing.join("、")}参数，请补充后再冻结参数控制需求。`,
      sourceOps: [edge.sourceOp],
      sourceHyperedges: [edge.hyperedgeId],
      relatedRequirements: [],
      priority: "high"
    });
  }

  private add(edge: Hyperedge, draft: Omit<RequirementDraft, "sourceOps" | "sourceHyperedges">): void {
    const candidate: RequirementDraft = {
      ...draft,
      sourceOps: [edge.sourceOp],
      sourceHyperedges: [edge.hyperedgeId]
    };
    const key = createRequirementFingerprint(candidate);
    const existing = this.drafts.get(key);
    if (!existing) {
      this.drafts.set(key, candidate);
      return;
    }
    existing.sourceOps = unique([...existing.sourceOps, edge.sourceOp]);
    existing.sourceHyperedges = unique([...existing.sourceHyperedges, edge.hyperedgeId]);
    existing.sourceFields = unique([...existing.sourceFields, ...candidate.sourceFields]);
    existing.keyMetrics = unique([...existing.keyMetrics, ...candidate.keyMetrics]);
    existing.constraints = unique([...existing.constraints, ...candidate.constraints]);
    existing.relatedRisks = unique([...existing.relatedRisks, ...candidate.relatedRisks]);
    existing.confidence = Math.max(existing.confidence, candidate.confidence);
  }
}

function labels(edge: Hyperedge, nodesById: Map<string, HyperNode>, type: NodeType): string[] {
  return nodes(edge, nodesById, type).map((node) => node.normalizedName);
}

function firstLabel(edge: Hyperedge, nodesById: Map<string, HyperNode>, type: NodeType): string {
  return labels(edge, nodesById, type)[0] ?? "";
}

function nodes(edge: Hyperedge, nodesById: Map<string, HyperNode>, type: NodeType): HyperNode[] {
  return edge.nodeRoles[type].flatMap((nodeId) => {
    const node = nodesById.get(nodeId);
    return node ? [node] : [];
  });
}

function firstNonEmpty(values: string[]): string {
  return values.find((value) => value.trim()) ?? "未说明";
}

function moduleFor(type: RequirementType): string {
  const modules: Record<RequirementType, string> = {
    R1: "operation-execution",
    R2: "material-container-compatibility",
    R3: "parameter-control",
    R4: "environment-control",
    R5: "workflow-orchestration",
    R6: "sensing-and-judgment",
    R7: "risk-control",
    R8: "exception-handling",
    R9: "data-traceability",
    R10: "verification"
  };
  return modules[type];
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, "").toLowerCase();
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}
