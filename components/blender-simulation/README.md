# Blender Simulation Component

This component is intentionally separate from the AutoBiology SOP conversion pipeline. It provides the Blender MCP-facing surface for future scene assets, normalization, rigging, and animation work without coupling Blender behavior into the CLI converter.

## Structure

- `src/index.ts` exports the public component boundary.
- `src/assets.ts` contains asset-management contracts and layout metadata.
- `src/types.ts` contains component-owned TypeScript contracts.
- `tests/` contains component-level verification.
