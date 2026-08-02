import type { Pair } from '@/src/constants/minimalPairs';
import {
  advanceTrialCycleSeenIds,
  buildTrialPairId,
  selectNextTrialPair,
  updateRecentMissState,
  type RecentMissState,
} from '@/src/domain/practiceSession';

export interface TrialSchedulingState {
  readonly lastPairId: string | null;
  readonly seenThisCycle: readonly string[];
  readonly recentMiss: RecentMissState;
  readonly manualOverrideArmed: boolean;
}

export interface PlanNextTrialInput {
  state: TrialSchedulingState;
  eligiblePairs: Pair[];
  activeGroup: string | null;
  selectedPair: Pair | undefined;
  random: () => number;
}

export type TrialSchedulingEvent =
  | { kind: 'session-reset' }
  | { kind: 'active-set-changed'; activeGroupPairs: Pair[] }
  | { kind: 'round-started' }
  | { kind: 'trial-presented'; pair: Pair; activeGroupPairs: Pair[] }
  | { kind: 'answer-recorded'; answeredPairId: string; wasCorrect: boolean }
  | { kind: 'manual-selection'; groupChanged: boolean };

export function initialTrialSchedulingState(): TrialSchedulingState {
  return {
    lastPairId: null,
    seenThisCycle: [],
    recentMiss: {
      recentlyMissedPairId: null,
      trialsSinceMiss: 0,
    },
    manualOverrideArmed: false,
  };
}

export function reduceTrialScheduling(
  state: TrialSchedulingState,
  event: TrialSchedulingEvent
): TrialSchedulingState {
  switch (event.kind) {
    case 'session-reset':
      return initialTrialSchedulingState();
    case 'active-set-changed':
      return {
        ...state,
        lastPairId:
          state.lastPairId &&
          event.activeGroupPairs.some(
            (pair) => buildTrialPairId(pair) === state.lastPairId
          )
            ? state.lastPairId
            : null,
        seenThisCycle: [],
        recentMiss: {
          recentlyMissedPairId: null,
          trialsSinceMiss: 0,
        },
      };
    case 'round-started':
      return { ...state, manualOverrideArmed: false };
    case 'trial-presented':
      return {
        ...state,
        lastPairId: buildTrialPairId(event.pair),
        seenThisCycle: advanceTrialCycleSeenIds({
          activeGroupPairs: event.activeGroupPairs,
          selectedPair: event.pair,
          seenThisCycle: state.seenThisCycle,
        }),
      };
    case 'answer-recorded':
      return {
        ...state,
        recentMiss: updateRecentMissState({
          state: state.recentMiss,
          answeredPairId: event.answeredPairId,
          wasCorrect: event.wasCorrect,
        }),
      };
    case 'manual-selection':
      return event.groupChanged
        ? { ...initialTrialSchedulingState(), manualOverrideArmed: true }
        : { ...state, manualOverrideArmed: true };
  }
}

export function planNextTrial({
  state,
  eligiblePairs,
  activeGroup,
  selectedPair,
  random,
}: PlanNextTrialInput): Pair | null {
  if (state.manualOverrideArmed && selectedPair) {
    return selectedPair;
  }

  return activeGroup
    ? selectNextTrialPair({
        eligiblePairs,
        activeGroup,
        lastPairId: state.lastPairId,
        seenThisCycle: state.seenThisCycle,
        recentlyMissedPairId: state.recentMiss.recentlyMissedPairId,
        random,
      })
    : (selectedPair ?? null);
}
