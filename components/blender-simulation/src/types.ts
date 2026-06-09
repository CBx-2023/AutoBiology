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
