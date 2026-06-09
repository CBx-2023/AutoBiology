import { describe, expect, it } from "vitest";
import { createTimelineCounter } from "../src/index.js";

describe("Blender animation timeline counter", () => {
  it("starts at frame 1 by default", () => {
    const timeline = createTimelineCounter();

    expect(timeline.currentFrame).toBe(1);
  });

  it("advances currentFrame after an action completes", () => {
    const timeline = createTimelineCounter({ startFrame: 10 });

    const range = timeline.advance(24);

    expect(range).toEqual({ startFrame: 10, endFrame: 34, durationFrames: 24 });
    expect(timeline.currentFrame).toBe(34);
  });

  it("persists frame state across multiple macro calls", () => {
    const timeline = createTimelineCounter({ startFrame: 5 });

    const first = timeline.advance(10);
    const second = timeline.advance(15);

    expect(first).toEqual({ startFrame: 5, endFrame: 15, durationFrames: 10 });
    expect(second).toEqual({ startFrame: 15, endFrame: 30, durationFrames: 15 });
    expect(timeline.currentFrame).toBe(30);
  });

  it("rejects non-positive action durations", () => {
    const timeline = createTimelineCounter();

    expect(() => timeline.advance(0)).toThrow(/durationFrames must be positive/);
    expect(() => timeline.advance(-1)).toThrow(/durationFrames must be positive/);
  });
});
