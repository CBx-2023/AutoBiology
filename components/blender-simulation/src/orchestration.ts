import { computeInitialLayout } from "./layout.js";
import {
  buildLiquidScaleScript,
  buildSafetyZLiftMoveScript,
  createLiquidScalePlan,
  createSafetyZLiftMovePlan
} from "./macros.js";
import { createTimelineCounter } from "./timeline.js";
import type {
  InitialLayout,
  LiquidScalePlan,
  SafetyZLiftMovePlan,
  SimulationOptions,
  SimulationPlan,
  SimulationRequirementTable
} from "./types.js";

export function createSimulationPlan(
  table: SimulationRequirementTable,
  options: SimulationOptions = {}
): SimulationPlan {
  const layout = computeInitialLayout(table, options.layout);
  const timeline = createTimelineCounter({ startFrame: options.startFrame ?? 1 });
  const safeZ = options.safeZ ?? 10;
  const moveDurationFrames = options.moveDurationFrames ?? 9;
  const liquidDurationFrames = options.liquidDurationFrames ?? 12;
  const moduleIds = new Set(table.requirements.map((requirement) => requirement.responsibleModule));
  const controller = layout.assets.find((asset) => moduleIds.has(asset.assetId)) ?? layout.assets[0];
  const firstTarget = layout.assets.find((asset) => asset.assetId !== controller?.assetId) ?? controller;
  const moves: SafetyZLiftMovePlan[] = [];
  const liquidScales: LiquidScalePlan[] = [];

  if (controller && firstTarget) {
    moves.push(
      createSafetyZLiftMovePlan(timeline, {
        objectName: controller.assetId,
        startLocation: controller.location,
        targetLocation: firstTarget.location,
        safeZ,
        durationFrames: moveDurationFrames
      })
    );
  }

  const liquidIndicator = layout.assets.find((asset) => asset.assetId.toLowerCase().includes("liquid"));
  if (liquidIndicator) {
    liquidScales.push(
      createLiquidScalePlan(timeline, {
        objectName: liquidIndicator.assetId,
        startScaleZ: 0.2,
        endScaleZ: 0.85,
        durationFrames: liquidDurationFrames
      })
    );
  }

  return {
    layout,
    moves,
    liquidScales,
    endFrame: timeline.currentFrame
  };
}

export function buildSimulationScript(plan: SimulationPlan): string {
  const sections = [
    "import bpy",
    "bpy.ops.wm.read_homefile(use_empty=True)",
    buildLayoutScript(plan.layout),
    ...plan.moves.map(buildSafetyZLiftMoveScript),
    ...plan.liquidScales.map(buildLiquidScaleScript),
    `bpy.context.scene.frame_start = 1`,
    `bpy.context.scene.frame_end = ${plan.endFrame}`,
    `print(${pythonString(`SIMULATION_COMPLETE:${plan.endFrame}`)})`
  ];

  return sections.join("\n");
}

function buildLayoutScript(layout: InitialLayout): string {
  const lines = [
    "layout_assets = []",
    "def _create_layout_asset(name, x, y, z):",
    "    mesh = bpy.data.meshes.new(name + '_mesh')",
    "    mesh.from_pydata([(-0.25, -0.25, 0), (0.25, -0.25, 0), (0.25, 0.25, 0), (-0.25, 0.25, 0)], [], [(0, 1, 2, 3)])",
    "    mesh.update()",
    "    obj = bpy.data.objects.new(name, mesh)",
    "    obj.location = (x, y, z)",
    "    bpy.context.collection.objects.link(obj)",
    "    layout_assets.append(obj.name)",
    "    return obj"
  ];

  for (const asset of layout.assets) {
    lines.push(
      `_create_layout_asset(${pythonString(asset.assetId)}, ${formatNumber(asset.location.x)}, ${formatNumber(
        asset.location.y
      )}, ${formatNumber(asset.location.z)})`
    );
  }

  lines.push("print('SIMULATION_LAYOUT_ASSETS:' + ','.join(layout_assets))");
  return lines.join("\n");
}

function pythonString(value: string): string {
  return JSON.stringify(value);
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error(`Values must be finite numbers, got ${value}`);
  }

  return value.toString();
}
