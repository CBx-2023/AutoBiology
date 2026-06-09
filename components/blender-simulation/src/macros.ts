import type {
  SafetyZLiftKeyframe,
  SafetyZLiftMoveOptions,
  SafetyZLiftMovePlan,
  TimelineCounter
} from "./types.js";

export function createSafetyZLiftMovePlan(
  timeline: TimelineCounter,
  options: SafetyZLiftMoveOptions
): SafetyZLiftMovePlan {
  if (options.safeZ < Math.max(options.startLocation.z, options.targetLocation.z)) {
    throw new Error("safeZ must be greater than or equal to both start and target Z");
  }

  const range = timeline.advance(options.durationFrames);
  const stepFrames = splitIntoThreeSteps(range.startFrame, range.endFrame);
  const keyframes: SafetyZLiftKeyframe[] = [
    { label: "start", frame: range.startFrame, location: options.startLocation },
    {
      label: "lift",
      frame: stepFrames[0],
      location: { x: options.startLocation.x, y: options.startLocation.y, z: options.safeZ }
    },
    {
      label: "translate",
      frame: stepFrames[1],
      location: { x: options.targetLocation.x, y: options.targetLocation.y, z: options.safeZ }
    },
    { label: "lower", frame: range.endFrame, location: options.targetLocation }
  ];

  return {
    objectName: options.objectName,
    range,
    keyframes
  };
}

export function buildSafetyZLiftMoveScript(plan: SafetyZLiftMovePlan): string {
  return [
    "import bpy",
    `object_name = ${pythonString(plan.objectName)}`,
    "obj = bpy.data.objects.get(object_name)",
    "if obj is None:",
    "    raise RuntimeError(f\"Object not found for Safety Z-Lift: {object_name}\")",
    ...plan.keyframes.flatMap((keyframe) => [
      `# ${keyframe.label}`,
      `obj.location = ${pythonVector(keyframe.location)}`,
      `obj.keyframe_insert(data_path="location", frame=${keyframe.frame})`
    ]),
    `print(${pythonString(`SAFETY_Z_LIFT:${plan.objectName}:${plan.range.startFrame}-${plan.range.endFrame}`)})`
  ].join("\n");
}

function splitIntoThreeSteps(startFrame: number, endFrame: number): [number, number] {
  const duration = endFrame - startFrame;
  const first = startFrame + Math.round(duration / 3);
  const second = startFrame + Math.round((duration * 2) / 3);
  return [first, second];
}

function pythonString(value: string): string {
  return JSON.stringify(value);
}

function pythonVector(value: { x: number; y: number; z: number }): string {
  return `(${formatNumber(value.x)}, ${formatNumber(value.y)}, ${formatNumber(value.z)})`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Location values must be finite numbers, got ${value}`);
  }

  return Number.isInteger(value) ? value.toString() : value.toString();
}
