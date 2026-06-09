import type { TimelineAdvance, TimelineCounter, TimelineCounterOptions } from "./types.js";

export function createTimelineCounter(options: TimelineCounterOptions = {}): TimelineCounter {
  let currentFrame = options.startFrame ?? 1;

  if (!Number.isInteger(currentFrame) || currentFrame < 0) {
    throw new Error(`startFrame must be a non-negative integer, got ${currentFrame}`);
  }

  return {
    get currentFrame() {
      return currentFrame;
    },
    advance(durationFrames: number): TimelineAdvance {
      if (!Number.isInteger(durationFrames) || durationFrames <= 0) {
        throw new Error(`durationFrames must be positive integer, got ${durationFrames}`);
      }

      const startFrame = currentFrame;
      const endFrame = startFrame + durationFrames;
      currentFrame = endFrame;
      return { startFrame, endFrame, durationFrames };
    },
    reset(nextFrame = options.startFrame ?? 1): void {
      if (!Number.isInteger(nextFrame) || nextFrame < 0) {
        throw new Error(`nextFrame must be a non-negative integer, got ${nextFrame}`);
      }

      currentFrame = nextFrame;
    }
  };
}
