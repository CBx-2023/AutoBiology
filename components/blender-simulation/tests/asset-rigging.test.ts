import { describe, expect, it } from "vitest";
import { buildParentChildRigScript } from "../src/index.js";

describe("Blender asset parent-child rigging logic", () => {
  it("builds Blender Python that parents a child while preserving its world transform", () => {
    const script = buildParentChildRigScript({
      parentName: "pipette_body",
      childName: "pipette_tip"
    });

    expect(script).toContain("parent = bpy.data.objects.get(parent_name)");
    expect(script).toContain("child = bpy.data.objects.get(child_name)");
    expect(script).toContain("child.parent = parent");
    expect(script).toContain("child.matrix_parent_inverse = parent.matrix_world.inverted()");
    expect(script).toContain("RIGGED_ASSET:pipette_body->pipette_tip");
  });

  it("can optionally allow the child to inherit the parent transform immediately", () => {
    const script = buildParentChildRigScript({
      parentName: "tool_head",
      childName: "attached_tip",
      keepWorldTransform: false
    });

    expect(script).toContain("child.matrix_parent_inverse.identity()");
    expect(script).toContain("RIGGED_ASSET:tool_head->attached_tip");
  });
});
