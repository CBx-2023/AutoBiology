export type BlenderAssetFormat = "blend" | "glb";

export interface BlenderAssetSpec {
  id: string;
  sourcePath: string;
  targetName: string;
  format?: BlenderAssetFormat;
  objectName?: string;
}

export interface BlenderDimensions {
  x?: number;
  y?: number;
  z?: number;
}

export interface NormalizeAssetOptions {
  objectName: string;
  targetName?: string;
  targetDimensions?: BlenderDimensions;
}

export interface ParentChildRigOptions {
  parentName: string;
  childName: string;
  keepWorldTransform?: boolean;
}

export interface TimelineCounterOptions {
  startFrame?: number;
}

export interface TimelineAdvance {
  startFrame: number;
  endFrame: number;
  durationFrames: number;
}

export interface TimelineCounter {
  readonly currentFrame: number;
  advance(durationFrames: number): TimelineAdvance;
  reset(nextFrame?: number): void;
}

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface SafetyZLiftMoveOptions {
  objectName: string;
  startLocation: Vector3;
  targetLocation: Vector3;
  safeZ: number;
  durationFrames: number;
}

export interface SafetyZLiftKeyframe {
  label: "start" | "lift" | "translate" | "lower";
  frame: number;
  location: Vector3;
}

export interface SafetyZLiftMovePlan {
  objectName: string;
  range: TimelineAdvance;
  keyframes: SafetyZLiftKeyframe[];
}

export interface LiquidScaleOptions {
  objectName: string;
  startScaleZ: number;
  endScaleZ: number;
  durationFrames: number;
}

export interface LiquidScaleKeyframe {
  label: "start" | "end";
  frame: number;
  scaleZ: number;
}

export interface LiquidScalePlan {
  objectName: string;
  range: TimelineAdvance;
  keyframes: LiquidScaleKeyframe[];
}

export interface SimulationRequirement {
  requirementId: string;
  type: string;
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
  priority: string;
  status: string;
  inferenceRule: string;
  confidence: number;
  fingerprint: string;
}

export interface SimulationRequirementTable {
  requirements: SimulationRequirement[];
  clarifications: unknown[];
}

export interface LayoutOptions {
  spacing?: number;
  columns?: number;
}

export interface LayoutAsset {
  assetId: string;
  location: Vector3;
}

export interface InitialLayout {
  assets: LayoutAsset[];
  spacing: number;
  columns: number;
}

export interface SimulationOptions {
  layout?: LayoutOptions;
  startFrame?: number;
  safeZ?: number;
  moveDurationFrames?: number;
  liquidDurationFrames?: number;
}

export interface SimulationPlan {
  layout: InitialLayout;
  moves: SafetyZLiftMovePlan[];
  liquidScales: LiquidScalePlan[];
  endFrame: number;
}

export interface BlenderSimulationComponentLayout {
  assetSpec: "BlenderAssetSpec";
  assetManager: "components/blender-simulation/src/assets";
  moduleEntry: "components/blender-simulation/src/index";
}

export interface FetchResponseLike {
  ok: boolean;
  status: number;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type FetchLike = (url: string) => Promise<FetchResponseLike>;

export interface ResolveAssetPathOptions {
  cacheDir: string;
  fetchImpl?: FetchLike;
}
