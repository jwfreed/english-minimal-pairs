export type MasteryMap = Record<string, number>;

const MASTERY_STORAGE_KEY_PREFIX = '@mastery_';
const MIN_MASTERY_TIER = 1;
const MAX_MASTERY_TIER = 6;

/** Legacy global placement key — kept for one-time migration reads only. */
export const PLACEMENT_DONE_KEY = '@placementDone';

/**
 * Written once during migration to signal that the legacy @placementDone key
 * has already seeded the current category. After this sentinel exists, the
 * legacy key has no further effect on any category placement check.
 */
export const PLACEMENT_LEGACY_MIGRATION_KEY = '@placementDoneLegacyMigrated';

/**
 * Per-category placement key. Follows the same pattern as mastery storage.
 * Example: buildPlacementStorageKey('日本語') → '@placementDone_日本語'
 */
export function buildPlacementStorageKey(categoryKey: string): string {
  return `@placementDone_${categoryKey}`;
}

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

/**
 * Returns true when placement should be shown for a category.
 * Depends only on the per-category key — the legacy global key is handled
 * separately by the one-time migration in the Practice screen.
 */
export function shouldShowPlacementTestForCategory(
  categoryRaw: string | null
): boolean {
  return !parsePlacementDone(categoryRaw);
}

export interface PlacementMigrationDecision {
  /** Whether the placement test should be shown to the user. */
  shouldShowPlacement: boolean;
  /** Whether to write @placementDone_${category} from the legacy key (one-time only). */
  shouldSeedCurrentCategoryFromLegacy: boolean;
  /** Whether to write the migration sentinel key. */
  shouldWriteLegacyMigrationSentinel: boolean;
}

/**
 * Pure decision function for the Practice screen's placement-loading effect.
 * Takes the three raw AsyncStorage values and returns what actions to take and
 * whether to show placement — with no side effects.
 *
 * Rules (in priority order):
 * 1. Per-category key present → placed, no migration needed.
 * 2. Per-category key absent + legacy key present + sentinel absent
 *    → first-open migration: seed this category and write sentinel.
 * 3. Per-category key absent + sentinel present → post-migration category,
 *    show placement (legacy key must not help here).
 * 4. All absent → fresh install, show placement.
 */
export function resolvePlacementStateForCategory(input: {
  categoryRaw: string | null;
  legacyRaw: string | null;
  sentinelRaw: string | null;
}): PlacementMigrationDecision {
  const { categoryRaw, legacyRaw, sentinelRaw } = input;

  if (parsePlacementDone(categoryRaw)) {
    return {
      shouldShowPlacement: false,
      shouldSeedCurrentCategoryFromLegacy: false,
      shouldWriteLegacyMigrationSentinel: false,
    };
  }

  if (parsePlacementDone(legacyRaw) && !parsePlacementDone(sentinelRaw)) {
    return {
      shouldShowPlacement: false,
      shouldSeedCurrentCategoryFromLegacy: true,
      shouldWriteLegacyMigrationSentinel: true,
    };
  }

  return {
    shouldShowPlacement: true,
    shouldSeedCurrentCategoryFromLegacy: false,
    shouldWriteLegacyMigrationSentinel: false,
  };
}
