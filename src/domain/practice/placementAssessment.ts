import type { Pair } from '@/src/constants/minimalPairs';
import { FINAL_PRACTICE_TIER } from '@/src/domain/masteryLevel';
import { recommendPlacementTier } from '@/src/domain/practiceSession';

export { recommendPlacementTier } from '@/src/domain/practiceSession';

export const PLACEMENT_TOTAL_QUESTIONS = 10;
/** Every contrast is observed directly (Decision 021). */
export const PLACEMENT_QUESTIONS_PER_CONTRAST = 2;

interface BuildPlacementItemsInput {
  pairs: Pair[];
  random: () => number;
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pick<T>(items: T[], random: () => number): T | undefined {
  if (items.length === 0) return undefined;
  const bounded = Math.min(Math.max(random(), 0), 0.999999999999);
  return items[Math.floor(bounded * items.length)];
}

/**
 * Coverage-constrained placement (Decision 021): each contrast receives
 * exactly PLACEMENT_QUESTIONS_PER_CONTRAST questions on distinct tiers, and
 * every tier appears at least once. Beyond one question per tier, the extra
 * tiers keep the pair-weighted mix of the previous sampler, so the score keeps
 * the meaning its thresholds were written for.
 */
export function buildPlacementItems({
  pairs,
  random,
}: BuildPlacementItemsInput): Pair[] {
  const uniquePairs = [...new Set(pairs)];
  const groups = [...new Set(uniquePairs.map((pair) => pair.group))];
  const tiers = [...new Set(uniquePairs.map((pair) => pair.difficulty))].sort(
    (a, b) => a - b
  );
  const slotCount = groups.length * PLACEMENT_QUESTIONS_PER_CONTRAST;

  // One slot per tier, then pair-weighted extras. No tier may exceed one slot
  // per contrast, which keeps each contrast's two tiers distinct below.
  const tierSlots =
    tiers.length > slotCount
      ? shuffle(tiers, random).slice(0, slotCount)
      : [...tiers];
  const slotsPerTier = (tier: number) =>
    tierSlots.filter((slot) => slot === tier).length;
  // As before, extras are drawn from the pairs left after one per tier.
  const tierRepresentatives = new Set(
    tiers.map((tier) =>
      pick(uniquePairs.filter((pair) => pair.difficulty === tier), random)
    )
  );
  const extraCandidates = uniquePairs.filter(
    (pair) => !tierRepresentatives.has(pair)
  );
  for (const pair of shuffle(extraCandidates, random)) {
    if (tierSlots.length >= slotCount) break;
    if (slotsPerTier(pair.difficulty) < groups.length) {
      tierSlots.push(pair.difficulty);
    }
  }
  tierSlots.sort((a, b) => a - b);

  // Sorted slots i and i + groups.length always hold different tiers.
  const items: Pair[] = [];
  shuffle(groups, random).forEach((group, index) => {
    const wantedTiers = [
      tierSlots[index],
      tierSlots[index + groups.length],
    ].filter((tier): tier is Pair['difficulty'] => tier !== undefined);
    for (const tier of wantedTiers) {
      const unused = uniquePairs.filter(
        (pair) => pair.group === group && !items.includes(pair)
      );
      const choice = pick(
        unused.filter((pair) => pair.difficulty === tier).length > 0
          ? unused.filter((pair) => pair.difficulty === tier)
          : unused,
        random
      );
      if (choice) items.push(choice);
    }
  });

  return shuffle(items, random);
}

export interface PlacementAnswer {
  group: string;
  correct: boolean;
}

/**
 * Per-contrast starting levels (Decision 021). The global score maps to one
 * level through the existing thresholds; a contrast receives it only with at
 * least one correct placement answer. A contrast answered 0-for-n, or never
 * observed, starts at level 1. Placement sets an initial practice tier and
 * never grants final-tier completion (level 7).
 */
export function initializePlacementLevels({
  pairs,
  answers,
}: {
  pairs: Pair[];
  answers: readonly PlacementAnswer[];
}): Record<string, number> {
  const correctCount = answers.filter((answer) => answer.correct).length;
  const globalLevel = Math.min(
    recommendPlacementTier(correctCount, answers.length),
    FINAL_PRACTICE_TIER
  );
  const levels: Record<string, number> = {};
  for (const group of new Set(pairs.map((pair) => pair.group))) {
    const evidenced = answers.some(
      (answer) => answer.group === group && answer.correct
    );
    levels[group] = evidenced ? globalLevel : 1;
  }
  return levels;
}
