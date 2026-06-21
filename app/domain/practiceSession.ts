import type { Pair } from '@/app/constants/minimalPairs';
import {
  type SpeedTier,
  getNextAdaptiveProgression,
} from '@/app/learning/adaptiveProgression';
import { buildPairId } from '@/app/utils/idHelpers';

export type PracticeFeedback = 'correct' | 'incorrect';
export type PlayedIndex = 0 | 1;

export interface PlaybackDecision {
  playedIdx: PlayedIndex;
  startsNewRound: boolean;
}

export interface PracticeAnswerInput {
  selectedPair: Pair | undefined;
  category: string;
  answerIdx: PlayedIndex;
  playedIdx: PlayedIndex | null;
  startTime: number | null;
  nowMs: number;
  currentSpeed: SpeedTier;
  fastStreak: number;
  longStreak: number;
  currentMasteryTier: number;
}

export interface PracticeAnswerResult {
  correct: boolean;
  feedback: PracticeFeedback;
  responseTimeMs: number;
  durationMin: number;
  pairId: string;
  group: string;
  nextSpeed: SpeedTier;
  nextFastStreak: number;
  nextLongStreak: number;
  promoteSpeed: boolean;
  promoteMastery: boolean;
  promotedTier: number | null;
  resetPairIndex: boolean;
}

export interface SelectNextTrialPairInput {
  eligiblePairs: Pair[];
  activeGroup: string;
  lastPairId?: string | null;
  seenThisCycle?: readonly string[] | ReadonlySet<string> | null;
  random?: () => number;
}

export function recommendPlacementTier(correctCount: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 1;

  const accuracy = correctCount / totalQuestions;
  if (accuracy >= 0.9) return 4;
  if (accuracy >= 0.7) return 3;
  if (accuracy >= 0.5) return 2;
  return 1;
}

export function selectVisiblePairsByMastery(
  pairs: Pair[],
  mastery: Record<string, number>
): Pair[] {
  const byGroup: Record<string, Pair[]> = {};
  pairs.forEach((pair) => (byGroup[pair.group] ??= []).push(pair));

  return Object.values(byGroup).flatMap((groupPairs) => {
    const tier = mastery[groupPairs[0].group] ?? 1;
    const tierPairs = groupPairs.filter((pair) => pair.difficulty === tier);
    return tierPairs.length > 0 ? tierPairs : [groupPairs[0]];
  });
}

export function buildMasteryForAllGroups(
  pairs: Pair[],
  tier: number
): Record<string, number> {
  const clamped = Math.max(1, Math.min(tier, 6));
  const next: Record<string, number> = {};
  for (const pair of pairs) {
    next[pair.group] = clamped;
  }
  return next;
}

export function buildTrialPairId(pair: Pair): string {
  return `${pair.group}:${pair.word1.toLowerCase()}:${pair.word2.toLowerCase()}`;
}

function chooseFromPairs(pairs: Pair[], random: () => number): Pair {
  const randomValue = random();
  const boundedRandom = Math.min(Math.max(randomValue, 0), 0.999999999999);
  return pairs[Math.floor(boundedRandom * pairs.length)];
}

export function selectNextTrialPair({
  eligiblePairs,
  activeGroup,
  lastPairId = null,
  seenThisCycle = null,
  random = Math.random,
}: SelectNextTrialPairInput): Pair | null {
  const activePairs = eligiblePairs.filter((pair) => pair.group === activeGroup);
  if (activePairs.length === 0) return null;
  if (activePairs.length === 1) return activePairs[0];

  const nonRepeatingPairs = lastPairId
    ? activePairs.filter((pair) => buildTrialPairId(pair) !== lastPairId)
    : activePairs;
  const repeatSafePairs = nonRepeatingPairs.length > 0 ? nonRepeatingPairs : activePairs;
  const seenIds = new Set(seenThisCycle ?? []);
  const unseenPairs = repeatSafePairs.filter((pair) => !seenIds.has(buildTrialPairId(pair)));
  const candidatePairs = unseenPairs.length > 0 ? unseenPairs : repeatSafePairs;

  return chooseFromPairs(candidatePairs, random);
}

export function choosePlaybackForRound({
  playedIdx,
  feedback,
  randomValue,
}: {
  playedIdx: PlayedIndex | null;
  feedback: PracticeFeedback | null;
  randomValue: number;
}): PlaybackDecision {
  if (playedIdx !== null && feedback === null) {
    return { playedIdx, startsNewRound: false };
  }

  return {
    playedIdx: randomValue < 0.5 ? 0 : 1,
    startsNewRound: true,
  };
}

export function applyPracticeAnswer({
  selectedPair,
  category,
  answerIdx,
  playedIdx,
  startTime,
  nowMs,
  currentSpeed,
  fastStreak,
  longStreak,
  currentMasteryTier,
}: PracticeAnswerInput): PracticeAnswerResult | null {
  if (playedIdx === null || !selectedPair) return null;

  const responseTimeMs = startTime !== null ? nowMs - startTime : 0;
  const correct = answerIdx === playedIdx;
  const progression = getNextAdaptiveProgression({
    correct,
    responseTimeMs,
    currentSpeed,
    fastStreak,
    longStreak,
    currentMasteryTier,
  });

  return {
    correct,
    feedback: correct ? 'correct' : 'incorrect',
    responseTimeMs,
    durationMin: responseTimeMs / 60000,
    pairId: buildPairId(selectedPair, category),
    group: selectedPair.group,
    nextSpeed: progression.nextSpeed,
    nextFastStreak: progression.nextFastStreak,
    nextLongStreak: progression.nextLongStreak,
    promoteSpeed: progression.promoteSpeed,
    promoteMastery: progression.promoteMastery,
    promotedTier: progression.promoteMastery ? progression.nextMasteryTier : null,
    resetPairIndex: progression.promoteMastery,
  };
}
