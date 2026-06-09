# Blender Simulation Phase 2 Macro Review Log

## REVIEW-01 - 2026-06-09

Result: gaps_found

Reviewer: same-model sub-agent `019eaced-7d22-7a90-857a-dc50a7d515fe`

Inputs:
- Approved design spec: `docs/superpowers/specs/2026-06-09-blender-simulation-design.md`
- Task CSV: `issues/2026-06-09_22-15-00-blender-sim-phase2-macros.csv`
- Prior phase1 review log: `issues/2026-06-09_22-15-00-blender-sim-phase1-assets.review.md`
- Implementation commits: `b7b725d`, `1d0ddaf`, `944a35a`
- Current `components/blender-simulation/` source and tests
- Blender MCP evidence recorded in the CSV

Independent findings:

1. P1 Safety Z-Lift duration guard gap: `createSafetyZLiftMovePlan()` accepts durations that collapse required phases onto duplicate frames. For `durationFrames=1`, `start/lift` share frame 1 and `translate/lower` share frame 2. For `durationFrames=2`, `lift/translate` share frame 2. This weakens the strict "Z raised before XY changes" guarantee for short actions.
2. No blocking phase2 implementation gaps were found for timeline persistence, Z-lift normal-duration behavior, liquid scale keyframes, component isolation, CSV evidence alignment, or Graphify freshness.

Independent verification reported by reviewer:
- `graphify-out/GRAPH_REPORT.md` was read first and reported `Built from commit: 944a35ae`.
- Component tests passed: 7 files, 17 tests.
- `npx tsc -p components/blender-simulation/tsconfig.json` passed.
- `npx tsc -p tsconfig.json` passed.
- Root `npx vitest run` still had the known existing Windows `spawn npm/npx ENOENT` failures; this matches CSV limited-validation notes.
- No Blender simulation wiring was found in `src`, root `tests`, `package.json`, or `tsconfig.json`.

Follow-up rows appended:
- `SPEC-02-FU-01`
- `REVIEW-02`
