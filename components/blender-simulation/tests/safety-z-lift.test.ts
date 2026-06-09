import { describe, expect, it } from "vitest";
import {
  buildSafetyZLiftMoveScript,
  createSafetyZLiftMovePlan,
  createTimelineCounter
} from "../src/index.js";

describe("Blender Safety Z-Lift macro", () => {
  it("plans four keyframes where Z lifts before XY changes", () => {
    const timeline = createTimelineCounter({ startFrame: 100 });
    const plan = createSafetyZLiftMovePlan(timeline, {
      objectName: "pipette",
      startLocation: { x: 1, y: 2, z: 3 },
      targetLocation: { x: 8, y: 9, z: 4 },
      safeZ: 30,
      durationFrames: 30
    });

    expect(plan.keyframes).toEqual([
      { label: "start", frame: 100, location: { x: 1, y: 2, z: 3 } },
      { label: "lift", frame: 110, location: { x: 1, y: 2, z: 30 } },
      { label: "translate", frame: 120, location: { x: 8, y: 9, z: 30 } },
      { label: "lower", frame: 130, location: { x: 8, y: 9, z: 4 } }
    ]);
    expect(timeline.currentFrame).toBe(130);
  });

  it("builds Blender Python that inserts location keyframes for the plan", () => {
    const timeline = createTimelineCounter();
    const plan = createSafetyZLiftMovePlan(timeline, {
      objectName: "arm",
      startLocation: { x: 0, y: 0, z: 0 },
      targetLocation: { x: 2, y: 3, z: 1 },
      safeZ: 10,
      durationFrames: 9
    });

    const script = buildSafetyZLiftMoveScript(plan);

    expect(script).toContain("obj.keyframe_insert(data_path=\"location\", frame=1)");
    expect(script).toContain("obj.location = (0, 0, 10)");
    expect(script).toContain("obj.location = (2, 3, 10)");
    expect(script).toContain("obj.location = (2, 3, 1)");
    expect(script).toContain("SAFETY_Z_LIFT:arm:1-10");
  });
});
