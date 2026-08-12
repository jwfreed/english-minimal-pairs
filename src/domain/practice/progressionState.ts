import type { PracticeAnswerResult } from '@/src/domain/practiceSession';
import type { ContrastId } from '@/src/domain/identity';
import type { SpeedTier } from '@/src/learning/adaptiveProgression';

/**
 * Session-scoped practice mechanics for one contrast.
 *
 * This state exists only while practice is mounted and is discarded with that
 * session. It is not learner history or durable mastery. `ContrastPairProgress`
 * (`@/src/domain/contrast/pairProgressProjection`) projects accumulated attempt
 * history; `ContrastMasteryRecord`
 * (`@/src/domain/contrastMasteryPersistence`) is the durable tier. This type is
 * neither. A future richer mastery model remains a separate domain concept.
 */
export interface ContrastPracticeState {
  readonly speedTier: SpeedTier;
  readonly fastStreak: number;
  readonly longStreak: number;
}

export type PracticeStateByContrast = Readonly<
  Record<ContrastId, ContrastPracticeState>
>;

const INITIAL_CONTRAST_PRACTICE_STATE: ContrastPracticeState = {
  speedTier: 0,
  fastStreak: 0,
  longStreak: 0,
};

/**
 * Creates state for one practice-session lifetime. Persistence and mastery
 * ownership deliberately remain outside this module.
 */
export function initialProgressionState(): PracticeStateByContrast {
  return {};
}

export function getContrastProgression(
  state: PracticeStateByContrast,
  key: ContrastId
): ContrastPracticeState {
  return state[key] ?? INITIAL_CONTRAST_PRACTICE_STATE;
}

/**
 * The key is passed separately rather than read from the result because
 * resolving it requires the historical identity mapping, which this module
 * must not depend on. Callers resolve identity at the boundary and hand in the
 * result.
 */
export function applyProgressionAnswer(
  state: PracticeStateByContrast,
  key: ContrastId,
  result: Pick<
    PracticeAnswerResult,
    'nextSpeed' | 'nextFastStreak' | 'nextLongStreak'
  >
): PracticeStateByContrast {
  return {
    ...state,
    [key]: {
      speedTier: result.nextSpeed,
      fastStreak: result.nextFastStreak,
      longStreak: result.nextLongStreak,
    },
  };
}
