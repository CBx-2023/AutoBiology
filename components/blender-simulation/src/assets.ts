import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  BlenderAssetFormat,
  BlenderAssetSpec,
  BlenderSimulationComponentLayout,
  FetchLike,
  ResolveAssetPathOptions
} from "./types.js";

export const blenderSimulationComponentLayout: BlenderSimulationComponentLayout = {
  assetSpec: "BlenderAssetSpec",
  assetManager: "components/blender-simulation/src/assets",
  moduleEntry: "components/blender-simulation/src/index"
};

export function inferAssetFormat(sourcePath: string): BlenderAssetFormat {
  const pathname = parseSourcePathname(sourcePath);
  const extension = extname(pathname).toLowerCase();

  if (extension === ".blend") {
    return "blend";
  }

  if (extension === ".glb") {
    return "glb";
  }

  throw new Error(`Unsupported Blender asset format for source path: ${sourcePath}`);
}

export async function resolveAssetPath(
  asset: BlenderAssetSpec,
  options: ResolveAssetPathOptions
): Promise<string> {
  if (isHttpUrl(asset.sourcePath)) {
    const fetchImpl = options.fetchImpl ?? defaultFetch;
    const response = await fetchImpl(asset.sourcePath);

    if (!response.ok) {
      throw new Error(`Failed to download Blender asset ${asset.sourcePath}: HTTP ${response.status}`);
    }

    await mkdir(options.cacheDir, { recursive: true });
    const outputPath = join(options.cacheDir, buildCachedAssetName(asset));
    await writeFile(outputPath, Buffer.from(await response.arrayBuffer()));
    return outputPath;
  }

  if (asset.sourcePath.startsWith("file://")) {
    return fileURLToPath(asset.sourcePath);
  }

  return asset.sourcePath;
}

export function buildAppendAssetScript(asset: BlenderAssetSpec): string {
  const format = asset.format ?? inferAssetFormat(asset.sourcePath);

  if (format === "blend") {
    return buildBlendAppendScript(asset);
  }

  return buildGlbImportScript(asset);
}

function buildBlendAppendScript(asset: BlenderAssetSpec): string {
  const objectName = asset.objectName ?? asset.targetName;

  return [
    "import bpy",
    "from pathlib import Path",
    `asset_path = ${pythonString(toBlenderPath(asset.sourcePath))}`,
    `object_name = ${pythonString(objectName)}`,
    `target_name = ${pythonString(asset.targetName)}`,
    "before_names = set(bpy.data.objects.keys())",
    "directory = str(Path(asset_path) / \"Object\") + \"/\"",
    "filepath = directory + object_name",
    "bpy.ops.wm.append(filepath=filepath, directory=directory, filename=object_name)",
    "obj = bpy.data.objects.get(object_name)",
    "if obj is None:",
    "    created_names = sorted(set(bpy.data.objects.keys()) - before_names)",
    "    if not created_names:",
    "        raise RuntimeError(f\"No object was appended from {asset_path}\")",
    "    obj = bpy.data.objects[created_names[0]]",
    "obj.name = target_name",
    "if getattr(obj, \"data\", None) is not None:",
    "    obj.data.name = f\"{target_name}_mesh\"",
    `print(${pythonString(`APPENDED_ASSET:${asset.targetName}`)})`
  ].join("\n");
}

function buildGlbImportScript(asset: BlenderAssetSpec): string {
  return [
    "import bpy",
    `asset_path = ${pythonString(toBlenderPath(asset.sourcePath))}`,
    `target_name = ${pythonString(asset.targetName)}`,
    "before_names = set(bpy.data.objects.keys())",
    "bpy.ops.import_scene.gltf(filepath=asset_path)",
    "new_objects = [obj for obj in bpy.context.scene.objects if obj.name not in before_names]",
    "if not new_objects:",
    "    raise RuntimeError(f\"No object was imported from {asset_path}\")",
    "for index, obj in enumerate(new_objects):",
    "    obj.name = target_name if index == 0 else f\"{target_name}_{index + 1}\"",
    "    if getattr(obj, \"data\", None) is not None:",
    "        obj.data.name = f\"{obj.name}_mesh\"",
    `print(${pythonString(`APPENDED_ASSET:${asset.targetName}`)})`
  ].join("\n");
}

function buildCachedAssetName(asset: BlenderAssetSpec): string {
  const pathname = parseSourcePathname(asset.sourcePath);
  const extension = extname(pathname).toLowerCase();
  const fallbackName = basename(pathname, extension) || asset.id;
  const safeName = sanitizeFileStem(fallbackName);
  const digest = createHash("sha256").update(asset.sourcePath).digest("hex").slice(0, 16);
  return `${safeName}-${digest}${extension}`;
}

function parseSourcePathname(sourcePath: string): string {
  if (isHttpUrl(sourcePath) || sourcePath.startsWith("file://")) {
    return new URL(sourcePath).pathname;
  }

  return sourcePath;
}

function isHttpUrl(sourcePath: string): boolean {
  return sourcePath.startsWith("https://") || sourcePath.startsWith("http://");
}

function sanitizeFileStem(value: string): string {
  const safeValue = value.toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "");
  return safeValue || "asset";
}

function pythonString(value: string): string {
  return JSON.stringify(value);
}

function toBlenderPath(sourcePath: string): string {
  return sourcePath.replace(/\\/g, "/");
}

async function defaultFetch(url: string): Promise<Awaited<ReturnType<FetchLike>>> {
  return fetch(url);
}
