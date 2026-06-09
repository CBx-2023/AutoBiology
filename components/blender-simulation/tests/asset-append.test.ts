import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildAppendAssetScript,
  inferAssetFormat,
  resolveAssetPath,
  type BlenderAssetSpec
} from "../src/index.js";

describe("Blender asset append logic", () => {
  it("infers supported model formats from source paths", () => {
    expect(inferAssetFormat("fixtures/plate.blend")).toBe("blend");
    expect(inferAssetFormat("fixtures/pipette.glb")).toBe("glb");
    expect(() => inferAssetFormat("fixtures/readme.txt")).toThrow(/Unsupported Blender asset format/);
  });

  it("downloads remote asset sources into a local cache path", async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), "blender-asset-cache-"));

    try {
      const resolvedPath = await resolveAssetPath(
        {
          id: "pipette",
          sourcePath: "https://assets.example/pipette.glb?version=1",
          targetName: "pipette_main"
        },
        {
          cacheDir,
          fetchImpl: async () => ({
            ok: true,
            status: 200,
            arrayBuffer: async () => new TextEncoder().encode("glb-bytes").buffer
          })
        }
      );

      expect(resolvedPath).toMatch(/pipette-[a-f0-9]{16}\.glb$/);
      await expect(readFile(resolvedPath, "utf8")).resolves.toBe("glb-bytes");
    } finally {
      await rm(cacheDir, { recursive: true, force: true });
    }
  });

  it("builds Blender Python that appends .blend objects by object name", () => {
    const asset: BlenderAssetSpec = {
      id: "plate_96_A1",
      sourcePath: "G:/assets/source-plate.blend",
      targetName: "plate_96_A1",
      objectName: "PlateObject"
    };

    const script = buildAppendAssetScript(asset);

    expect(script).toContain("bpy.ops.wm.append");
    expect(script).toContain("PlateObject");
    expect(script).toContain("plate_96_A1");
    expect(script).toContain("APPENDED_ASSET:plate_96_A1");
  });

  it("builds Blender Python that imports .glb assets when append is unavailable", () => {
    const script = buildAppendAssetScript({
      id: "pipette",
      sourcePath: "G:/assets/pipette.glb",
      targetName: "pipette_main"
    });

    expect(script).toContain("bpy.ops.import_scene.gltf");
    expect(script).toContain("pipette_main");
    expect(script).toContain("APPENDED_ASSET:pipette_main");
  });
});
