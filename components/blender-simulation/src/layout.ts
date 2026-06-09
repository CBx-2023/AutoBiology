import type {
  InitialLayout,
  LayoutAsset,
  LayoutOptions,
  SimulationRequirement,
  SimulationRequirementTable
} from "./types.js";

export function computeInitialLayout(
  table: SimulationRequirementTable,
  options: LayoutOptions = {}
): InitialLayout {
  const spacing = options.spacing ?? 1;
  const columns = options.columns ?? Math.ceil(Math.sqrt(Math.max(1, table.requirements.length * 2)));

  if (!Number.isFinite(spacing) || spacing <= 0) {
    throw new Error(`spacing must be positive, got ${spacing}`);
  }

  if (!Number.isInteger(columns) || columns <= 0) {
    throw new Error(`columns must be a positive integer, got ${columns}`);
  }

  const assetIds = collectAssetIds(table.requirements);
  const assets: LayoutAsset[] = assetIds.map((assetId, index) => ({
    assetId,
    location: {
      x: (index % columns) * spacing,
      y: Math.floor(index / columns) * spacing,
      z: 0
    }
  }));

  return { assets, spacing, columns };
}

function collectAssetIds(requirements: SimulationRequirement[]): string[] {
  const assetIds: string[] = [];
  const seen = new Set<string>();

  for (const requirement of requirements) {
    addAssetId(assetIds, seen, requirement.applicableTo);
  }

  for (const requirement of requirements) {
    addAssetId(assetIds, seen, requirement.responsibleModule);
  }

  return assetIds;
}

function addAssetId(assetIds: string[], seen: Set<string>, value: string): void {
  const assetId = value.trim();

  if (assetId.length === 0 || seen.has(assetId)) {
    return;
  }

  seen.add(assetId);
  assetIds.push(assetId);
}
