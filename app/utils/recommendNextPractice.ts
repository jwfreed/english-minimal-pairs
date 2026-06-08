// app/utils/recommendNextPractice.ts
import type { Pair } from '@/app/constants/minimalPairs';
import type { PairAttempt, PairStats } from '@/app/storage/progressStorage';

export interface PracticeNextRecommendation {
  groupId: string;
  label: string;       // e.g. "/r/ vs /l/"
  recentAccuracy: number; // 0–1
  /**
   * Why this pair is being recommended:
   *   'lowAccuracy' — a practiced group whose recent accuracy is comparatively low
   *   'newPair'     — a pair the user has not begun practicing yet
   */
  reason: 'lowAccuracy' | 'newPair';
}

// A group needs at least this many total attempts before it is considered.
// Prevents a single unlucky first attempt from dominating.
const MIN_GROUP_ATTEMPTS = 3;

// Number of most-recent attempts used to compute group accuracy,
// consistent with getWeightedAccuracy in progressStorage.ts.
const RECENT_ATTEMPT_COUNT = 20;

// Recent accuracy at or above this counts as "strong" — strong groups don't
// need more practice, so we steer the user toward new pairs instead.
const STRONG_ACCURACY = 0.9;

/**
 * Recommends the next pair to practice within the currently selected category:
 *   1. The eligible group (≥ MIN_GROUP_ATTEMPTS) with the lowest recent
 *      accuracy, when one is below STRONG_ACCURACY → reason 'lowAccuracy'.
 *   2. Otherwise (no eligible groups, or all eligible groups are strong) the
 *      first pair with no recorded attempts → reason 'newPair'.
 *   3. Otherwise, if eligible groups exist (all strong, nothing new left), the
 *      lowest-accuracy eligible group → reason 'lowAccuracy'.
 *   4. Otherwise null.
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

  // ── 3. Prefer the lowest-accuracy eligible group when one needs work ──────
  // Deterministic alphabetical tie-break.
  eligible.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return a.groupId.localeCompare(b.groupId);
  });

  const weakest = eligible[0];
  if (weakest && weakest.accuracy < STRONG_ACCURACY) {
    return {
      groupId: weakest.groupId,
      label: `/${weakest.cp1}/ vs /${weakest.cp2}/`,
      recentAccuracy: weakest.accuracy,
      reason: 'lowAccuracy',
    };
  }

  // ── 4. Nothing weak: steer toward the first unpracticed pair ─────────────
  const fresh = pairs.find((pair) => {
    const id = `${category}__${pair.group}__${pair.word1}_${pair.word2}`;
    return !progress[id]?.attempts?.length;
  });
  if (fresh) {
    return {
      groupId: fresh.group,
      label: `/${fresh.contrastPhoneme1}/ vs /${fresh.contrastPhoneme2}/`,
      recentAccuracy: 0,
      reason: 'newPair',
    };
  }

  // ── 5. All groups strong and nothing new left: fall back to the weakest ──
  if (weakest) {
    return {
      groupId: weakest.groupId,
      label: `/${weakest.cp1}/ vs /${weakest.cp2}/`,
      recentAccuracy: weakest.accuracy,
      reason: 'lowAccuracy',
    };
  }

  return null;
}
