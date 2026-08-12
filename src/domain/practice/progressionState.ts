import type { PracticeAnswerResult } from '@/src/domain/practiceSession';
import type { ContrastId } from '@/src/domain/identity';
import type { SpeedTier } from '@/src/learning/adaptiveProgression';

/**
 * The in-flight progression ladder for one contrast.
 *
 * This is not learner history and not persisted mastery. It is the transient
 * run toward the next promotion. `ContrastPairProgress`
 * (`@/src/domain/contrast/pairProgressProjection`) projects accumulated attempt
 * history; `ContrastMasteryRecord`
 * (`@/src/domain/contrastMasteryPersistence`) is the durable tier. This type is
 * neither, and owns no durability.
 */
export interface ContrastProgression {
  readonly speedTier: SpeedTier;
  readonly fastStreak: number;
  readonly longStreak: number;
}

export type ProgressionState = Readonly<
  Record<ContrastId, ContrastProgression>
>;

const INITIAL_CONTRAST_PROGRESSION: ContrastProgression = {
  speedTier: 0,
  fastStreak: 0,
  longStreak: 0,
};

export function initialProgressionState(): ProgressionState {
  return {};
}

export function getContrastProgression(
  state: ProgressionState,
  key: ContrastId
): ContrastProgression {
  return state[key] ?? INITIAL_CONTRAST_PROGRESSION;
}

/**
 * The key is passed separately rather than read from the result because
 * resolving it requires the historical identity mapping, which this module
 * must not depend on. Callers resolve identity at the boundary and hand in the
 * result.
 */
export function applyProgressionAnswer(
  state: ProgressionState,
  key: ContrastId,
  result: Pick<
    PracticeAnswerResult,
    'nextSpeed' | 'nextFastStreak' | 'nextLongStreak'
  >
): ProgressionState {
  return {
    ...state,
    [key]: {
      speedTier: result.nextSpeed,
      fastStreak: result.nextFastStreak,
      longStreak: result.nextLongStreak,
    },
  };
}
