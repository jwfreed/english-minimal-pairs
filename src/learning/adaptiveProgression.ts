export type SpeedTier = 0 | 1 | 2;

export const SPEED_TABLE: Record<SpeedTier, number> = {
  0: 0.85,
  1: 1.0,
  2: 1.15,
};

export const MAX_SPEED: SpeedTier = 2;

/** Response-time ceiling for a "fast" answer. */
export const FAST_THRESHOLD_MS = 5000;
export const FAST_STREAK_NEEDED = 3;
export const LONG_STREAK_NEEDED = 6;

/** Highest mastery tier; practice state stays independent of persistence. */
const FINAL_MASTERY_TIER = 6;

interface AdaptiveProgressionInput {
  correct: boolean;
  responseTimeMs: number;
  currentSpeed: SpeedTier;
  fastStreak: number;
  longStreak: number;
  /** Practice tier (1–6); never a stored mastery level. */
  currentMasteryTier: number;
  /** Whether the final tier's criteria were already satisfied. */
  finalTierCompleted?: boolean;
}

interface AdaptiveProgressionResult {
  nextSpeed: SpeedTier;
  nextFastStreak: number;
  nextLongStreak: number;
  promoteSpeed: boolean;
  promoteMastery: boolean;
  /** The final tier's criteria were satisfied for the first time. */
  completesFinalTier: boolean;
  nextMasteryTier: number;
}

export function getNextAdaptiveProgression({
  correct,
  responseTimeMs,
  currentSpeed,
  fastStreak,
  longStreak,
  currentMasteryTier,
  finalTierCompleted = false,
}: AdaptiveProgressionInput): AdaptiveProgressionResult {
  const nextLongStreak = correct ? longStreak + 1 : 0;
  const nextFastStreak =
    correct && responseTimeMs < FAST_THRESHOLD_MS ? fastStreak + 1 : 0;

  const promoteNeeded =
    (correct &&
      responseTimeMs < FAST_THRESHOLD_MS &&
      nextFastStreak >= FAST_STREAK_NEEDED) ||
    nextLongStreak >= LONG_STREAK_NEEDED;

  if (!promoteNeeded) {
    return {
      nextSpeed: currentSpeed,
      nextFastStreak,
      nextLongStreak,
      promoteSpeed: false,
      promoteMastery: false,
      completesFinalTier: false,
      nextMasteryTier: currentMasteryTier,
    };
  }

  if (currentSpeed < MAX_SPEED) {
    return {
      nextSpeed: (currentSpeed + 1) as SpeedTier,
      nextFastStreak: 0,
      nextLongStreak: 0,
      promoteSpeed: true,
      promoteMastery: false,
      completesFinalTier: false,
      nextMasteryTier: currentMasteryTier,
    };
  }

  // At the final tier there is no next tier: meeting the criteria completes
  // it once, and afterwards changes nothing. Speed restarts either way.
  const atFinalTier = currentMasteryTier >= FINAL_MASTERY_TIER;
  return {
    nextSpeed: 0,
    nextFastStreak: 0,
    nextLongStreak: 0,
    promoteSpeed: false,
    promoteMastery: !atFinalTier,
    completesFinalTier: atFinalTier && !finalTierCompleted,
    nextMasteryTier: atFinalTier ? currentMasteryTier : currentMasteryTier + 1,
  };
}
