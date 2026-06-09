import { describe, expect, it } from "vitest";
import {
  buildLiquidScaleScript,
  createLiquidScalePlan,
  createTimelineCounter
} from "../src/index.js";

describe("Blender liquid interaction macro", () => {
  it("plans Z-axis scale changes for a liquid indicator", () => {
    const timeline = createTimelineCounter({ startFrame: 20 });
    const plan = createLiquidScalePlan(timeline, {
      objectName: "liquid_indicator",
      startScaleZ: 0.2,
      endScaleZ: 0.85,
      durationFrames: 18
    });

    expect(plan.keyframes).toEqual([
      { label: "start", frame: 20, scaleZ: 0.2 },
      { label: "end", frame: 38, scaleZ: 0.85 }
    ]);
    expect(timeline.currentFrame).toBe(38);
  });

  it("builds Blender Python that keyframes scale on the Z axis", () => {
    const timeline = createTimelineCounter();
    const plan = createLiquidScalePlan(timeline, {
      objectName: "well_liquid",
      startScaleZ: 1,
      endScaleZ: 0.35,
      durationFrames: 12
    });

    const script = buildLiquidScaleScript(plan);

    expect(script).toContain("obj.scale.z = 1");
    expect(script).toContain("obj.keyframe_insert(data_path=\"scale\", frame=1)");
    expect(script).toContain("obj.scale.z = 0.35");
    expect(script).toContain("obj.keyframe_insert(data_path=\"scale\", frame=13)");
    expect(script).toContain("LIQUID_SCALE:well_liquid:1-13");
  });
});
