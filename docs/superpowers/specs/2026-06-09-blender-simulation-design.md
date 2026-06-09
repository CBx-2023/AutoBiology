# AutoBiology to Blender Simulation Design Spec

## 1. Overview
This spec outlines the architecture and execution plan for translating `04-requirements.json` (produced by the AutoBiology CLI) into a 3D visual simulation in Blender. 
The execution is handled entirely by a Codex agent utilizing the `blender-mcp` toolset, effectively treating the LLM agent as the orchestration layer between the structured biology requirements and the Blender Python API.

## 2. Architecture & Execution Flow
- **Input:** The structured `04-requirements.json` containing sequential biological standard operating procedures.
- **Executor:** Codex Agent via `blender-mcp`.
- **Workflow:**
  1. **Scene Initialization:** The agent clears the default Blender scene and loads required 3D assets (e.g., lab benches, plates, pipettes) via MCP.
  2. **Layout Setup:** The agent calculates the spatial grid for the experiment and positions the assets into their starting coordinates.
  3. **Animation Translation:** The agent iterates through the requirements. For each action, it calculates precise keyframes (Time/Frame and XYZ Coordinates) and uses MCP to insert keyframes into the Blender timeline.

## 3. Asset Management & Standardization
To enable the reuse of online open-source models (e.g., Opentrons models, Sketchfab labware), the agent will enforce a strict normalization protocol upon import:
- **Renaming:** Assets are renamed to match the JSON IDs exactly (e.g., `plate_96_A1`).
- **Scale Normalization:** The agent applies scale transformations to ensure the imported models match real-world physical dimensions (preventing collision and logic errors).
- **Origin Alignment:** The origin of all static vessels is set to the **Bottom-Center**. This allows placing objects flush against the `Z=0` tabletop plane simply by setting their Z coordinate to 0.
- **Parent-Child Rigging:** Moving components (e.g., pipette tips attaching to pipettes) are dynamically parented upon import so animating the parent automatically moves the children.

## 4. Data Mapping & Animation Macros
The agent will manage the timeline and execute movements using predefined heuristic macros rather than raw coordinate plotting:
- **Global Timeline Counter:** A `current_frame` variable is maintained. Every macro call advances this counter based on the logical duration of the action.
- **Safety Z-Lift Macro:** Since no physics collision engine is used, a heuristic approach is strictly enforced. Any horizontal movement must be preceded by a vertical lift to a `Z_safe_height` (e.g., Z=30cm). The trajectory is: `Lift (Z) -> Translate (X, Y) -> Lower (Z)`.
- **Liquid Interaction Macro:** Liquid transfers are visualized by dynamically scaling a semi-transparent colored cylinder inside the pipette/tube to simulate volume changes.
- **Keyframe Interpolation:** The agent will rely on Blender's default Bezier interpolation for inserted keyframes to provide natural ease-in and ease-out robotic movements.
