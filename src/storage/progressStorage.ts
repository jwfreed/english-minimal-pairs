// -----------------------------------------------------------------------------
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidAttempt } from '@/src/domain/contrast/pairProgressProjection';
import { writeWithRetry } from '@/src/storage/writeRetry';

export const PAIR_PROGRESS_STORAGE_KEY = '@pairProgress_v2'; // bump key to avoid legacy format clashes
let writeQueue: Promise<void> = Promise.resolve();
// Attempts not yet durably written. Every write carries all of them, so an
// attempt whose write failed is saved by the next successful one.
let unsavedAttempts: { pairId: string; attempt: PairAttempt }[] = [];

const MALFORMED_PROGRESS_ERROR = 'MalformedProgressError';

/** Stored history that is not a JSON object; it is never written over. */
export function isMalformedProgressError(error: unknown): boolean {
  return error instanceof Error && error.name === MALFORMED_PROGRESS_ERROR;
}

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

/**
 * The single retention rule for live and persisted history: append, then keep
 * the most recent MAX_ATTEMPTS_PER_PAIR. A restart therefore cannot change
 * anything derived from attempts.
 */
export function appendAttempt(
  attempts: PairAttempt[],
  attempt: PairAttempt
): PairAttempt[] {
  return pruneAttemptHistory([...attempts, attempt]);
}

/**
 * Strict read used by storage: a missing value is an empty history, but a
 * value that is not a JSON object throws instead of reading as empty, so a
 * later save cannot replace it.
 */
export function readStoredProgress(raw: string | null): Record<string, PairStats> {
  if (!raw) return getDefaultProgress();
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    const error = new Error('Stored pair progress is malformed');
    error.name = MALFORMED_PROGRESS_ERROR;
    throw error;
  }
  const result: Record<string, PairStats> = {};
  for (const [pairId, stats] of Object.entries(parsed)) {
    const rawAttempts =
      stats !== null && typeof stats === 'object' ? (stats as Record<string, unknown>).attempts : undefined;
    result[pairId] = { attempts: pruneAttemptHistory(rawAttempts) };
  }
  return result;
}

/** Tolerant parse for read-only analysis: malformed input reads as empty. */
export function parseStoredProgress(raw: string | null): Record<string, PairStats> {
  try {
    return readStoredProgress(raw);
  } catch {
    return getDefaultProgress();
  }
}

export function serializeProgress(progress: Record<string, PairStats>): string {
  return JSON.stringify(progress);
}

const readProgress = async (): Promise<Record<string, PairStats>> => {
  const raw = await AsyncStorage.getItem(PAIR_PROGRESS_STORAGE_KEY);
  return readStoredProgress(raw);
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
  durationMin = 0,
  // Callers that also hold the attempt in memory pass its timestamp so both
  // copies are identical.
  timestamp = Date.now()
) {
  const attempt: PairAttempt = {
    isCorrect,
    timestamp,
    durationMin,
  };

  unsavedAttempts.push({ pairId, attempt });
  await enqueueWrite(() =>
    writeWithRetry(async () => {
      const batch = unsavedAttempts.slice();
      if (batch.length === 0) return;
      const progress = await readProgress();
      for (const unsaved of batch) {
        progress[unsaved.pairId] = {
          attempts: appendAttempt(
            progress[unsaved.pairId]?.attempts ?? [],
            unsaved.attempt
          ),
        };
      }
      await AsyncStorage.setItem(PAIR_PROGRESS_STORAGE_KEY, serializeProgress(progress));
      // Attempts recorded during the write were appended after this batch.
      unsavedAttempts = unsavedAttempts.slice(batch.length);
    }, (error) => !isMalformedProgressError(error))
  );
}

export async function clearProgress() {
  unsavedAttempts = [];
  await enqueueWrite(async () => {
    await AsyncStorage.removeItem(PAIR_PROGRESS_STORAGE_KEY);
  });
}

/* ─── analytics helpers used across the UI ────────────────────────────────── */

/**
 * The attempts Results may derive statistics from. Malformed stored entries
 * stay in the history (the pair-progress projection reports them) but are
 * never counted, so one bad entry cannot crash or distort Results.
 */
export function validPairAttempts(attempts: readonly unknown[] | undefined): PairAttempt[] {
  return (attempts ?? []).filter(isValidAttempt);
}

/**
 * Weighted accuracy based on the most recent N attempts.
 * Shows user's recent performance (last 20 attempts or all if fewer).
 */
export function getWeightedAccuracy(attempts: PairAttempt[]): number {
  const valid = validPairAttempts(attempts);
  if (valid.length === 0) return 0;
  
  // Use last 20 attempts, or all attempts if fewer than 20
  const RECENT_ATTEMPT_COUNT = 20;
  const recentAttempts = valid.slice(-RECENT_ATTEMPT_COUNT);
  
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
  const valid = validPairAttempts(attempts);
  if (valid.length === 0) return [];

  const sorted = [...valid].sort((a, b) => a.timestamp - b.timestamp);
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
  return validPairAttempts(attempts).reduce((sum, a) => sum + a.durationMin * 60000, 0);
}
