import { describe, expect, it } from "vitest";
import { buildNormalizeAssetScript } from "../src/index.js";

describe("Blender asset normalization logic", () => {
  it("builds Blender Python that renames, applies scale, and moves origin to bottom center", () => {
    const script = buildNormalizeAssetScript({
      objectName: "ImportedPlate",
      targetName: "plate_96_A1"
    });

    expect(script).toContain("obj.name = target_name");
    expect(script).toContain("bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)");
    expect(script).toContain("bpy.ops.object.origin_set(type='ORIGIN_CURSOR', center='MEDIAN')");
    expect(script).toContain("obj.location.z = 0");
    expect(script).toContain("NORMALIZED_ASSET:plate_96_A1");
  });

  it("can scale an object toward a target height before applying scale", () => {
    const script = buildNormalizeAssetScript({
      objectName: "ImportedTube",
      targetName: "tube_15ml_A",
      targetDimensions: { z: 0.12 }
    });

    expect(script).toContain("target_dimensions = {\"z\":0.12}");
    expect(script).toContain("scale_factor = target_value / current_value");
    expect(script).toContain("setattr(obj.scale, axis, getattr(obj.scale, axis) * scale_factor)");
    expect(script).toContain("NORMALIZED_ASSET:tube_15ml_A");
  });
});
