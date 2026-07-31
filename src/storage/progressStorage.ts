// -----------------------------------------------------------------------------
import AsyncStorage from '@react-native-async-storage/async-storage';

export const PAIR_PROGRESS_STORAGE_KEY = '@pairProgress_v2'; // bump key to avoid legacy format clashes
let writeQueue: Promise<void> = Promise.resolve();

// Raw attempt history is capped per pair to prevent unbounded AsyncStorage growth.
export const MAX_ATTEMPTS_PER_PAIR = 100;

/* ─── types ──────────────────────────────────────────────────────────────── */
export interface PairAttempt {
  isCorrect: boolean;
  timestamp: number; // epoch ms – MUST be present for charting
  durationMin: number; // minutes spent on this attempt (0‑based ok)
}

export interface PairStats {
  attempts: PairAttempt[];
}

/* ─── helpers ─────────────────────────────────────────────────────────────── */
export function getDefaultProgress(): Record<string, PairStats> {
  return {};
}

/**
 * Caps a raw attempts value to the most recent MAX_ATTEMPTS_PER_PAIR entries.
 * Accepts any value — returns [] for non-arrays so callers never crash on bad data.
 *
 * This normalization intentionally cannot preserve the raw
 * `invalid-attempt-container` diagnostic reason. Once parsed, a non-array
 * container is indistinguishable from an empty history. That is known
 * diagnostic information loss, not a progress-semantics mismatch: neither
 * input contains a valid attempt array to project.
 */
export function pruneAttemptHistory(attempts: unknown): PairAttempt[] {
  if (!Array.isArray(attempts)) return [];
  if (attempts.length <= MAX_ATTEMPTS_PER_PAIR) return attempts as PairAttempt[];
  return (attempts as PairAttempt[]).slice(-MAX_ATTEMPTS_PER_PAIR);
}

export function parseStoredProgress(raw: string | null): Record<string, PairStats> {
  if (!raw) return getDefaultProgress();
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const result: Record<string, PairStats> = {};
    for (const [pairId, stats] of Object.entries(parsed)) {
      const rawAttempts =
        stats !== null && typeof stats === 'object' ? (stats as Record<string, unknown>).attempts : undefined;
      result[pairId] = { attempts: pruneAttemptHistory(rawAttempts) };
    }
    return result;
  } catch {
    return getDefaultProgress();
  }
}

export function serializeProgress(progress: Record<string, PairStats>): string {
  return JSON.stringify(progress);
}

const readProgress = async (): Promise<Record<string, PairStats>> => {
  const raw = await AsyncStorage.getItem(PAIR_PROGRESS_STORAGE_KEY);
  return parseStoredProgress(raw);
};

const enqueueWrite = (write: () => Promise<void>): Promise<void> => {
  writeQueue = writeQueue.catch(() => undefined).then(write);
  return writeQueue;
};

/* ─── public API ──────────────────────────────────────────────────────────── */
export async function getProgress(): Promise<Record<string, PairStats>> {
  await writeQueue.catch(() => undefined);
  return readProgress();
}

export async function saveAttempt(
  pairId: string,
  isCorrect: boolean,
  durationMin = 0
) {
  const attempt: PairAttempt = {
    isCorrect,
    timestamp: Date.now(),
    durationMin,
  };

  await enqueueWrite(async () => {
    const progress = await readProgress();
    const stats = progress[pairId] ?? { attempts: [] };

    progress[pairId] = {
      attempts: pruneAttemptHistory([...stats.attempts, attempt]),
    };

    await AsyncStorage.setItem(PAIR_PROGRESS_STORAGE_KEY, serializeProgress(progress));
  });
}

export async function clearProgress() {
  await enqueueWrite(async () => {
    await AsyncStorage.removeItem(PAIR_PROGRESS_STORAGE_KEY);
  });
}

/* ─── analytics helpers used across the UI ────────────────────────────────── */

/**
 * Weighted accuracy based on the most recent N attempts.
 * Shows user's recent performance (last 20 attempts or all if fewer).
 */
export function getWeightedAccuracy(attempts: PairAttempt[]): number {
  if (attempts.length === 0) return 0;
  
  // Use last 20 attempts, or all attempts if fewer than 20
  const RECENT_ATTEMPT_COUNT = 20;
  const recentAttempts = attempts.slice(-RECENT_ATTEMPT_COUNT);
  
  const correctCount = recentAttempts.filter(a => a.isCorrect).length;
  return correctCount / recentAttempts.length;
}

/**
 * Cumulative running accuracy over time – for spark‑line charting.
 * Returns values in **0‑1 range** (the chart multiplies by 100).
 */
export function getAccuracyAndTimeOverTime(
  attempts: PairAttempt[]
): { accuracy: number; timestamp: number }[] {
  if (attempts.length === 0) return [];

  const sorted = [...attempts].sort((a, b) => a.timestamp - b.timestamp);
  let correctSoFar = 0;

  return sorted.map((a, idx) => {
    if (a.isCorrect) correctSoFar += 1;
    return {
      accuracy: correctSoFar / (idx + 1),
      timestamp: a.timestamp,
    };
  });
}

/**
 * Sum of all attempt durations in **milliseconds** (UI divides by 60 000).
 */
export function estimateActivePracticeTime(attempts: PairAttempt[]): number {
  return attempts.reduce((sum, a) => sum + a.durationMin * 60000, 0);
}
