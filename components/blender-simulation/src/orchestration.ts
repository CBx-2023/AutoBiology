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
  SimulationRequirement,
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
  const assetsById = new Map(layout.assets.map((asset) => [asset.assetId, asset]));
  const moves: SafetyZLiftMovePlan[] = [];
  const liquidScales: LiquidScalePlan[] = [];

  if (controller) {
    for (const requirement of table.requirements) {
      const target = assetsById.get(requirement.applicableTo) ?? controller;

      moves.push(
        createSafetyZLiftMovePlan(timeline, {
          objectName: controller.assetId,
          startLocation: moves.at(-1)?.keyframes.at(-1)?.location ?? controller.location,
          targetLocation: target.location,
          safeZ,
          durationFrames: moveDurationFrames
        })
      );

      if (isLiquidInteractionRequirement(requirement)) {
        liquidScales.push(
          createLiquidScalePlan(timeline, {
            objectName: requirement.applicableTo,
            startScaleZ: 0.2,
            endScaleZ: 0.85,
            durationFrames: liquidDurationFrames
          })
        );
      }
    }
  }

  if (moves.length === 0 && controller) {
    moves.push(
      createSafetyZLiftMovePlan(timeline, {
        objectName: controller.assetId,
        startLocation: controller.location,
        targetLocation: controller.location,
        safeZ,
        durationFrames: moveDurationFrames
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

function isLiquidInteractionRequirement(requirement: SimulationRequirement): boolean {
  const objectText = requirement.applicableTo.toLowerCase();

  if (/liquid|fluid|液|上清|悬液|培养基|缓冲液|pbs/.test(objectText)) {
    return true;
  }

  const actionText = requirement.description.toLowerCase();
  if (/混匀|重悬|加液|吸液|弃液|液体转移|transfer|mix|resuspend|aspirat|dispens/.test(actionText)) {
    return true;
  }

  return /(?:转移|加液|吸液|弃液|混匀|重悬)(?:操作|功能)/.test(requirement.verificationMethod);
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
    "    mesh.from_pydata([(-0.25, -0.25, 0), (0.25, -0.25, 0), (0.25, 0.25, 0), (-0.25, 0.25, 0), (-0.25, -0.25, 0.2), (0.25, -0.25, 0.2), (0.25, 0.25, 0.2), (-0.25, 0.25, 0.2)], [], [(0, 1, 2, 3), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)])",
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
