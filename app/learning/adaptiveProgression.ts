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

interface AdaptiveProgressionInput {
  correct: boolean;
  responseTimeMs: number;
  currentSpeed: SpeedTier;
  fastStreak: number;
  longStreak: number;
  currentMasteryTier: number;
}

interface AdaptiveProgressionResult {
  nextSpeed: SpeedTier;
  nextFastStreak: number;
  nextLongStreak: number;
  promoteSpeed: boolean;
  promoteMastery: boolean;
  nextMasteryTier: number;
}

export function getNextAdaptiveProgression({
  correct,
  responseTimeMs,
  currentSpeed,
  fastStreak,
  longStreak,
  currentMasteryTier,
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
      nextMasteryTier: currentMasteryTier,
    };
  }

  return {
    nextSpeed: 0,
    nextFastStreak: 0,
    nextLongStreak: 0,
    promoteSpeed: false,
    promoteMastery: true,
    nextMasteryTier: Math.min(currentMasteryTier + 1, 6),
  };
}
