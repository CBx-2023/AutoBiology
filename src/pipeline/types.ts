export interface OpTable {
  sopId: string;
  sopName: string;
  ops: Op[];
}

export interface Op {
  opId: string;
  sourceText: string;
  parentStep: string;
  operationName: string;
  action: string;
  precondition: string;
  inputs: string[];
  target: string;
  container: string[];
  location: string;
  tools: string[];
  outputState: string;
  parameters: ParameterEntry[];
  conditions: string[];
  humanJudgment: {
    required: boolean;
    content: string;
    basis: string;
  };
  risks: RiskEntry[];
}

export interface ParameterEntry {
  name: string;
  value: number | null;
  unit: string;
  rawText: string;
  status: "specified" | "ambiguous" | "missing";
}

export interface RiskEntry {
  name: string;
  source: "sop" | "expert" | "inferred";
  handling: string;
}

export type NodeType =
  | "Action"
  | "Precondition"
  | "Input"
  | "Target"
  | "Container"
  | "Location"
  | "Tool"
  | "OutputState"
  | "Parameter"
  | "Condition"
  | "HumanJudgment"
  | "Risk"
  | "Handling";

export interface NodeTable {
  nodes: HyperNode[];
}

export interface HyperNode {
  nodeId: string;
  nodeType: NodeType;
  nodeName: string;
  normalizedName: string;
  source: "sop" | "expert" | "inferred";
  sourceOps: string[];
  sourceSop: string;
  attributes: Record<string, unknown>;
  synonyms: string[];
  notes: string;
}

export interface HyperedgeTable {
  hyperedges: Hyperedge[];
}

export interface Hyperedge {
  hyperedgeId: string;
  hyperedgeType: "OperationHyperedge";
  sourceOp: string;
  sourceSop: string;
  sourceText: string;
  parentStep: string;
  connectedNodes: string[];
  nodeRoles: Record<NodeType, string[]>;
  missingInfo: string[];
  expertSupplement: string[];
  attributes: {
    operationName: string;
    isManualJudgmentRequired: boolean;
    automationRelevance: "high" | "medium" | "low";
  };
  notes: string;
}

export interface Hypergraph {
  nodes: NodeTable;
  edges: HyperedgeTable;
}

export type RequirementType =
  | "R1"
  | "R2"
  | "R3"
  | "R4"
  | "R5"
  | "R6"
  | "R7"
  | "R8"
  | "R9"
  | "R10";

export type RequirementStatus =
  | "candidate"
  | "confirmed"
  | "clarification"
  | "rejected"
  | "frozen";

export interface RequirementTable {
  requirements: Requirement[];
  clarifications: Clarification[];
}

export interface Requirement {
  requirementId: string;
  type: RequirementType;
  description: string;
  sourceOps: string[];
  sourceHyperedges: string[];
  sourceFields: string[];
  applicableTo: string;
  keyMetrics: string[];
  constraints: string[];
  relatedRisks: string[];
  responsibleModule: string;
  verificationMethod: string;
  priority: "high" | "medium" | "low" | "unset";
  status: RequirementStatus;
  inferenceRule: string;
  confidence: number;
  reasoning?: string;
  fingerprint: string;
}

export interface Clarification {
  id: string;
  question: string;
  sourceOps: string[];
  sourceHyperedges: string[];
  relatedRequirements: string[];
  priority: "high" | "medium" | "low";
}

export interface CoverageMatrix {
  rows: CoverageRow[];
  summary: {
    totalHyperedges: number;
    coveredTypes: Record<RequirementType, number>;
    missingTypes: Record<RequirementType, number>;
    coverageRate: number;
  };
}

export interface CoverageRow {
  hyperedgeId: string;
  coverage: Record<RequirementType, "covered" | "missing" | "clarification">;
}

export interface RunMeta {
  version: string;
  timestamp: string;
  sopFile: string;
  config: {
    llmModel: string;
    interactive: boolean;
  };
  stageDurations: Record<string, number>;
  stats: {
    opCount: number;
    nodeCount: number;
    hyperedgeCount: number;
    requirementCount: number;
    clarificationCount: number;
    coverageRate: number;
  };
}
