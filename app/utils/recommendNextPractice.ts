// app/utils/recommendNextPractice.ts
import type { Pair } from '@/app/constants/minimalPairs';
import type { PairAttempt, PairStats } from '@/app/storage/progressStorage';

export interface PracticeNextRecommendation {
  groupId: string;
  label: string;       // e.g. "/r/ vs /l/"
  recentAccuracy: number; // 0–1
}

// A group needs at least this many total attempts before it is considered.
// Prevents a single unlucky first attempt from dominating.
const MIN_GROUP_ATTEMPTS = 3;

// Number of most-recent attempts used to compute group accuracy,
// consistent with getWeightedAccuracy in progressStorage.ts.
const RECENT_ATTEMPT_COUNT = 20;

/**
 * Returns the contrast group with the lowest recent accuracy, or null when
 * there is not enough data. Scope is limited to the currently selected category.
 *
 * Pair ID format mirrors buildPairId in idHelpers.ts:
 *   `${category}__${group}__${word1}_${word2}`
 */
export function computePracticeNextRecommendation(
  progress: Record<string, PairStats>,
  pairs: Pair[],
  category: string
): PracticeNextRecommendation | null {
  // ── 1. Aggregate attempts by group for the current category ──────────────
  type GroupData = {
    attempts: PairAttempt[];
    cp1: string;
    cp2: string;
  };
  const byGroup = new Map<string, GroupData>();

  for (const pair of pairs) {
    // Must match buildPairId in idHelpers.ts exactly.
    const id = `${category}__${pair.group}__${pair.word1}_${pair.word2}`;
    const stats = progress[id];
    if (!stats?.attempts?.length) continue;

    const existing = byGroup.get(pair.group);
    if (existing) {
      existing.attempts.push(...stats.attempts);
    } else {
      byGroup.set(pair.group, {
        attempts: [...stats.attempts],
        cp1: pair.contrastPhoneme1,
        cp2: pair.contrastPhoneme2,
      });
    }
  }

  // ── 2. Filter groups below the minimum attempt threshold ─────────────────
  const eligible: { groupId: string; accuracy: number; cp1: string; cp2: string }[] = [];

  for (const [groupId, data] of byGroup) {
    if (data.attempts.length < MIN_GROUP_ATTEMPTS) continue;

    // Sort by timestamp descending and take the most recent N attempts.
    const sorted = [...data.attempts].sort((a, b) => b.timestamp - a.timestamp);
    const recent = sorted.slice(0, RECENT_ATTEMPT_COUNT);
    const correct = recent.filter((a) => a.isCorrect).length;
    const accuracy = correct / recent.length;

    eligible.push({ groupId, accuracy, cp1: data.cp1, cp2: data.cp2 });
  }

  if (eligible.length === 0) return null;

  // ── 3. Find lowest accuracy; deterministic alphabetical tie-break ─────────
  eligible.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return a.groupId.localeCompare(b.groupId);
  });

  const { groupId, accuracy, cp1, cp2 } = eligible[0];
  return {
    groupId,
    label: `/${cp1}/ vs /${cp2}/`,
    recentAccuracy: accuracy,
  };
}
