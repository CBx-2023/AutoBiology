import { describe, expect, it } from "vitest";
import {
  blenderSimulationComponentLayout,
  type BlenderAssetSpec
} from "../src/index.js";

describe("Blender simulation component structure", () => {
  it("exposes a typed asset-management boundary outside the converter pipeline", () => {
    const asset: BlenderAssetSpec = {
      id: "plate_96_A1",
      sourcePath: "fixtures/plate.glb",
      targetName: "plate_96_A1"
    };

    expect(asset.targetName).toBe(asset.id);
    expect(blenderSimulationComponentLayout).toEqual({
      assetSpec: "BlenderAssetSpec",
      assetManager: "components/blender-simulation/src/assets",
      moduleEntry: "components/blender-simulation/src/index"
    });
  });
});
