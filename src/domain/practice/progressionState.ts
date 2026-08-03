import type { PracticeAnswerResult } from '@/src/domain/practiceSession';
import type { SpeedTier } from '@/src/learning/adaptiveProgression';

export interface GroupProgression {
  readonly speedTier: SpeedTier;
  readonly fastStreak: number;
  readonly longStreak: number;
}

export type ProgressionState = Readonly<Record<string, GroupProgression>>;

const INITIAL_GROUP_PROGRESSION: GroupProgression = {
  speedTier: 0,
  fastStreak: 0,
  longStreak: 0,
};

export function initialProgressionState(): ProgressionState {
  return {};
}

export function getGroupProgression(
  state: ProgressionState,
  group: string
): GroupProgression {
  return state[group] ?? INITIAL_GROUP_PROGRESSION;
}

export function applyProgressionAnswer(
  state: ProgressionState,
  result: Pick<
    PracticeAnswerResult,
    'group' | 'nextSpeed' | 'nextFastStreak' | 'nextLongStreak'
  >
): ProgressionState {
  return {
    ...state,
    [result.group]: {
      speedTier: result.nextSpeed,
      fastStreak: result.nextFastStreak,
      longStreak: result.nextLongStreak,
    },
  };
}
