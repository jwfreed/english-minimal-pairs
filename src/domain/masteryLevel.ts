/**
 * The single interpretation of a contrast's persisted mastery value
 * (Decision 020).
 *
 * The value is a mastery level: 1 + the number of completed practice tiers.
 * Levels 1–6 mean "currently practicing that tier" and keep their historical
 * meaning. Level 7 means the final tier (6) has been completed: the contrast
 * is mastered and practice continues on tier-6 material. Level 7 is never a
 * practice tier.
 */
export type MasteryLevelMap = Record<string, number>;

export const FINAL_PRACTICE_TIER = 6;
export const MASTERED_LEVEL = 7;
const MIN_MASTERY_LEVEL = 1;

export function isMasteryLevel(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= MIN_MASTERY_LEVEL &&
    value <= MASTERED_LEVEL
  );
}

/** Tier whose material is eligible for practice; an absent level is 1. */
export function practiceTierOf(level: number | undefined): number {
  return Math.min(level ?? MIN_MASTERY_LEVEL, FINAL_PRACTICE_TIER);
}

/** Number of tiers whose promotion criteria have been satisfied (0–6). */
export function completedTiersOf(level: number | undefined): number {
  return Math.min((level ?? MIN_MASTERY_LEVEL) - 1, FINAL_PRACTICE_TIER);
}

export function isMasteredLevel(level: number | undefined): boolean {
  return (level ?? MIN_MASTERY_LEVEL) >= MASTERED_LEVEL;
}

/** Level after the current tier's criteria are satisfied. */
export function nextMasteryLevel(level: number | undefined): number {
  return Math.min((level ?? MIN_MASTERY_LEVEL) + 1, MASTERED_LEVEL);
}

/** Practice tiers for code that selects material by tier. */
export function practiceTierMap(mastery: MasteryLevelMap): MasteryLevelMap {
  const tiers: MasteryLevelMap = {};
  for (const [group, level] of Object.entries(mastery)) {
    tiers[group] = practiceTierOf(level);
  }
  return tiers;
}
