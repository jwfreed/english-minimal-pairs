export type MasteryMap = Record<string, number>;

const MASTERY_STORAGE_KEY_PREFIX = '@mastery_';
const MIN_MASTERY_TIER = 1;
const MAX_MASTERY_TIER = 6;

export const PLACEMENT_DONE_KEY = '@placementDone';

export function buildMasteryStorageKey(categoryKey: string): string {
  return `${MASTERY_STORAGE_KEY_PREFIX}${categoryKey}`;
}

export function getDefaultMastery(): MasteryMap {
  return {};
}

export function serializeMastery(mastery: MasteryMap): string {
  return JSON.stringify(mastery);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function normalizeStoredMastery(
  value: unknown,
  fallback: MasteryMap = getDefaultMastery()
): MasteryMap {
  if (!isRecord(value)) return fallback;

  const normalized: MasteryMap = {};
  for (const [group, tier] of Object.entries(value)) {
    if (
      typeof tier === 'number' &&
      Number.isInteger(tier) &&
      tier >= MIN_MASTERY_TIER &&
      tier <= MAX_MASTERY_TIER
    ) {
      normalized[group] = tier;
    }
  }
  return normalized;
}

export function parseStoredMastery(
  raw: string | null,
  fallback: MasteryMap = getDefaultMastery()
): MasteryMap {
  if (!raw) return fallback;

  try {
    return normalizeStoredMastery(JSON.parse(raw), fallback);
  } catch {
    return fallback;
  }
}

export function serializePlacementDone(): string {
  return '1';
}

export function parsePlacementDone(raw: string | null): boolean {
  return raw !== null;
}

export function shouldShowPlacementTest(raw: string | null): boolean {
  return !parsePlacementDone(raw);
}
