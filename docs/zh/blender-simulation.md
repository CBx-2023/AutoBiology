---
layout: default
title: Blender 仿真
lang: zh-CN
---

# Blender 仿真

Blender 仿真能力位于 `components/blender-simulation`，并且刻意独立于 SOP 转换器流水线。转换器仍然只负责写出 `04-requirements.json` 等 JSON 产物；只有调用方显式导入 Blender 组件时，仿真代码才会消费这些产物。

## 原生 MP4 渲染

在 TypeScript 中使用组件解析需求、生成时间线，并追加 Blender 原生 FFmpeg 渲染设置：

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

把生成的 Python 放到 Blender 中运行即可。脚本会配置 Blender 自带的视频输出，先设置 `image_settings.media_type = 'VIDEO'`，再设置 `image_settings.file_format = 'FFMPEG'`，随后配置 `scene.render.ffmpeg` 并调用 `bpy.ops.render.render(animation=True)`。这个路径会由 Blender 直接写出 MP4，不再依赖外部系统 `ffmpeg` 编码步骤。

## 边界

不要从 `src/pipeline` 导入 Blender 代码。Blender 渲染、资产布局、动画宏和原生视频输出都应保留在 `components/blender-simulation` 内，原 CLI 转换器继续专注于 SOP 到结构化需求的转换。
