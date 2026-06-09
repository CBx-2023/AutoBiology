# Blender Simulation Component

This component is intentionally separate from the AutoBiology SOP conversion pipeline. It provides the Blender MCP-facing surface for future scene assets, normalization, rigging, and animation work without coupling Blender behavior into the CLI converter.

## Structure

- `src/index.ts` exports the public component boundary.
- `src/assets.ts` contains asset-management contracts and layout metadata.
- `src/types.ts` contains component-owned TypeScript contracts.
- `src/orchestration.ts` converts parsed requirements into a timeline and can append Blender-native FFmpeg MP4 render settings.
- `tests/` contains component-level verification.

## Native MP4 Rendering

Use `buildSimulationScript(plan, { render })` to append Blender-native MP4 rendering to the generated Python. Blender 5.x requires `image_settings.media_type = 'VIDEO'` before `image_settings.file_format = 'FFMPEG'`; the generated script applies that order, configures `scene.render.ffmpeg`, and calls `bpy.ops.render.render(animation=True)` so the MP4 is written by Blender rather than an external `ffmpeg` fallback.
