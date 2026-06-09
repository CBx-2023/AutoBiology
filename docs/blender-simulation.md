---
layout: default
title: Blender Simulation
lang: en
---

# Blender Simulation

The Blender simulation surface lives in `components/blender-simulation` and is intentionally separate from the SOP converter pipeline. The converter still writes JSON artifacts such as `04-requirements.json`; the Blender component consumes those artifacts only when a caller explicitly imports it.

## Native MP4 Render

Use the component from TypeScript to parse requirements, build a timeline, and append Blender-native FFmpeg render settings:

```ts
import {
  buildSimulationScript,
  createSimulationPlan,
  loadRequirementTable
} from "./components/blender-simulation/src/index.js";

const table = loadRequirementTable("out/04-requirements.json");
const plan = createSimulationPlan(table);
const script = buildSimulationScript(plan, {
  render: {
    outputPath: "out/e2e_blender_simulation.mp4",
    fps: 12,
    resolution: { x: 320, y: 240 }
  }
});
```

Run the generated Python in Blender. The script configures Blender's own video output, sets `image_settings.media_type = 'VIDEO'` before `image_settings.file_format = 'FFMPEG'`, configures `scene.render.ffmpeg`, and calls `bpy.ops.render.render(animation=True)`. The MP4 is written by Blender directly; no external system `ffmpeg` encode step is required for this path.

## Boundary

Do not import Blender code from `src/pipeline`. Keep Blender rendering, asset layout, animation macros, and native video output inside `components/blender-simulation` so the original CLI converter remains focused on SOP-to-requirements conversion.
