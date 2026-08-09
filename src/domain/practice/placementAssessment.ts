import type { Pair } from '@/src/constants/minimalPairs';

export { recommendPlacementTier } from '@/src/domain/practiceSession';

export const PLACEMENT_TOTAL_QUESTIONS = 10;

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

export function buildPlacementItems({
  pairs,
  random,
}: BuildPlacementItemsInput): Pair[] {
  const byTier = new Map<number, Pair[]>();
  for (const p of pairs) {
    if (!byTier.has(p.difficulty)) byTier.set(p.difficulty, []);
    byTier.get(p.difficulty)!.push(p);
  }

  const sampled: Pair[] = [];
  const seen = new Set<Pair>();

  for (const [, tierPairs] of byTier) {
    const pick = tierPairs[Math.floor(random() * tierPairs.length)];
    sampled.push(pick);
    seen.add(pick);
  }

  const remaining = pairs.filter((p) => !seen.has(p));
  const extras = shuffle(remaining, random).slice(
    0,
    PLACEMENT_TOTAL_QUESTIONS - sampled.length
  );

  return shuffle([...sampled, ...extras], random).slice(
    0,
    PLACEMENT_TOTAL_QUESTIONS
  );
}
