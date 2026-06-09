export interface BlenderAssetSpec {
  id: string;
  sourcePath: string;
  targetName: string;
}

export interface BlenderSimulationComponentLayout {
  assetSpec: "BlenderAssetSpec";
  assetManager: "components/blender-simulation/src/assets";
  moduleEntry: "components/blender-simulation/src/index";
}
