// -----------------------------------------------------------------------------
import AsyncStorage from '@react-native-async-storage/async-storage';
import { isValidAttempt } from '@/src/domain/contrast/pairProgressProjection';
import {
  assertPlanStillValid,
  writeVerifiedBackup,
  type RecoveryPlan,
} from '@/src/storage/recoveryBackup';
import { writeWithRetry } from '@/src/storage/writeRetry';

export const PAIR_PROGRESS_STORAGE_KEY = '@pairProgress_v2'; // bump key to avoid legacy format clashes
// Every storage operation — reads included — runs through this one queue, so
// results arrive in the order the operations were issued.
let storageQueue: Promise<unknown> = Promise.resolve();
// Attempts not yet durably written. Every write carries all of them, so an
// attempt whose write failed is saved by the next successful one.
//
// They are held in memory only: retried while the app runs, but lost if the
// app is terminated before a write succeeds.
let unsavedAttempts: { pairId: string; attempt: PairAttempt }[] = [];
// Bumped by a reset, so a write that was in flight across it does not treat
// attempts recorded after the reset as its own.
let resetEpoch = 0;
// A reset storage has not acknowledged. It is applied before any later write,
// so history from before the reset is never merged back in.
let resetPending = false;
// A write storage rejected: the exact value it tried to store and how many
// unsaved attempts that value included. A rejected write may still have been
// committed, and only the stored bytes can tell.
let uncertainWrite: { serialized: string; attemptCount: number } | null = null;
// The last write was rejected by storage and is awaiting retry.
let writeFailing = false;
// The stored history could not be read, or holds data that is not understood.
let unreadable = false;

/**
 * Whether attempt history is durable, derived from this module's state rather
 * than from any single write's outcome. `saved`: storage has acknowledged
 * every attempt. `pending`: some attempt is unacknowledged (in flight, or
 * failed and awaiting retry). `blocked`: stored history is unreadable or
 * malformed and is not written over. `needsAttention` is true when blocked or
 * when a write has failed; an ordinary write in flight needs none.
 */
export function getProgressPersistence(): {
  persistence: 'saved' | 'pending' | 'blocked';
  needsAttention: boolean;
} {
  return {
    persistence: unreadable
      ? 'blocked'
      : unsavedAttempts.length > 0 || resetPending
        ? 'pending'
        : 'saved',
    needsAttention: unreadable || writeFailing,
  };
}

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

function malformedProgressError(): Error {
  const error = new Error('Stored pair progress is malformed');
  error.name = MALFORMED_PROGRESS_ERROR;
  return error;
}

/**
 * Sets an entry as an own property whatever its key. Plain assignment would
 * drop a stored pair ID such as `__proto__` instead of keeping it.
 */
function setEntry(
  progress: Record<string, PairStats>,
  pairId: string,
  stats: PairStats
): void {
  Object.defineProperty(progress, pairId, {
    value: stats,
    enumerable: true,
    writable: true,
    configurable: true,
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Parses stored history under the integrity policy shared with mastery
 * (`readStoredMastery`): a missing value is an empty history; an entry is
 * valid when it is an object with an `attempts` array. `intact` is false when
 * the value is not a JSON object or any entry is not valid — such a value
 * must not be normalized and saved back. Valid entries are returned either
 * way so they stay readable; individual attempts and unknown fields inside a
 * valid entry are carried verbatim, never repaired or dropped.
 */
export function inspectStoredProgress(raw: string | null): {
  progress: Record<string, PairStats>;
  intact: boolean;
  /** Pair IDs whose stored entry is not valid (read as empty in `progress`). */
  invalidPairIds: string[];
} {
  const invalidPairIds: string[] = [];
  if (!raw) return { progress: getDefaultProgress(), intact: true, invalidPairIds };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = undefined;
  }
  if (!isRecord(parsed)) {
    return { progress: getDefaultProgress(), intact: false, invalidPairIds };
  }

  let intact = true;
  const progress: Record<string, PairStats> = {};
  for (const [pairId, stats] of Object.entries(parsed)) {
    if (isRecord(stats) && Array.isArray(stats.attempts)) {
      setEntry(progress, pairId, {
        ...stats,
        attempts: pruneAttemptHistory(stats.attempts),
      });
    } else {
      intact = false;
      invalidPairIds.push(pairId);
      setEntry(progress, pairId, { attempts: [] });
    }
  }
  return { progress, intact, invalidPairIds };
}

/** Strict read used before a write: throws unless the stored history is intact. */
export function readStoredProgress(raw: string | null): Record<string, PairStats> {
  const { progress, intact } = inspectStoredProgress(raw);
  if (!intact) throw malformedProgressError();
  return progress;
}

/** Tolerant parse for read-only use: whatever is valid, empty otherwise. */
export function parseStoredProgress(raw: string | null): Record<string, PairStats> {
  return inspectStoredProgress(raw).progress;
}

export function serializeProgress(progress: Record<string, PairStats>): string {
  return JSON.stringify(progress);
}

const inspectStorage = async () => {
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(PAIR_PROGRESS_STORAGE_KEY);
  } catch (error) {
    unreadable = true;
    throw error;
  }
  const inspected = inspectStoredProgress(raw);
  unreadable = !inspected.intact;
  return { raw, ...inspected };
};

const enqueue = <T>(operation: () => Promise<T>): Promise<T> => {
  const result = storageQueue.catch(() => undefined).then(operation);
  storageQueue = result;
  return result;
};

/**
 * One write pass, retried as a whole: apply a pending reset, then save every
 * unsaved attempt in one write.
 */
async function writePending(): Promise<void> {
  const epoch = resetEpoch;
  try {
    if (resetPending) {
      await AsyncStorage.removeItem(PAIR_PROGRESS_STORAGE_KEY);
      if (epoch === resetEpoch) resetPending = false;
      unreadable = false;
    }
    if (unsavedAttempts.length > 0) {
      const { raw, progress, intact } = await inspectStorage();
      // Malformed history is never normalized and replaced.
      if (!intact) throw malformedProgressError();
      // Exactly-once across a rejected write: if storage now holds precisely
      // what that write tried to store, it was committed after all, and its
      // attempts must not be appended again. Attempts are never compared by
      // value, so two identical legitimate attempts are both kept.
      if (uncertainWrite && epoch === resetEpoch && raw === uncertainWrite.serialized) {
        unsavedAttempts = unsavedAttempts.slice(uncertainWrite.attemptCount);
      }
      uncertainWrite = null;
      const batch = unsavedAttempts.slice();
      if (batch.length > 0) {
        for (const { pairId, attempt } of batch) {
          setEntry(progress, pairId, {
            ...progress[pairId],
            attempts: appendAttempt(progress[pairId]?.attempts ?? [], attempt),
          });
        }
        const serialized = serializeProgress(progress);
        try {
          await AsyncStorage.setItem(PAIR_PROGRESS_STORAGE_KEY, serialized);
        } catch (error) {
          if (epoch === resetEpoch) {
            uncertainWrite = { serialized, attemptCount: batch.length };
          }
          throw error;
        }
        // A reset during the write discarded this batch already; attempts
        // recorded during the write were appended after it.
        if (epoch === resetEpoch) {
          unsavedAttempts = unsavedAttempts.slice(batch.length);
        }
      }
    }
    writeFailing = false;
  } catch (error) {
    if (!isMalformedProgressError(error)) writeFailing = true;
    throw error;
  }
}

const enqueueWritePending = (): Promise<void> =>
  enqueue(() =>
    writeWithRetry(writePending, (error) => !isMalformedProgressError(error))
  );

/* ─── public API ──────────────────────────────────────────────────────────── */
/**
 * Everything readable in stored history. Malformed parts read as empty here
 * (and mark the history blocked for writing); only a storage error rejects.
 */
export async function getProgress(): Promise<Record<string, PairStats>> {
  return (await enqueue(inspectStorage)).progress;
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
  await enqueueWritePending();
}

/**
 * Clears stored history. Unsaved attempts from before the call are discarded.
 * The removal is queued behind any write already in flight, so that write
 * cannot restore what was cleared; if storage rejects the removal it stays
 * pending and is applied before the next write.
 */
export async function clearProgress() {
  resetEpoch += 1;
  unsavedAttempts = [];
  uncertainWrite = null;
  resetPending = true;
  await enqueueWritePending();
}

/* ─── recovery of blocked history (see recoveryBackup.ts) ────────────────── */

/** The stored history without its invalid entries. */
function recoverableProgress(raw: string): Record<string, PairStats> {
  const { progress, invalidPairIds } = inspectStoredProgress(raw);
  for (const pairId of invalidPairIds) delete progress[pairId];
  return progress;
}

/**
 * Step 1: backs up malformed stored history and reports what recovery would
 * keep. Resolves null when the stored history is not malformed. Changes
 * nothing but the backup key. Runs in the storage queue, after any write
 * already issued.
 */
export function prepareProgressRecovery(): Promise<RecoveryPlan | null> {
  return enqueue(async () => {
    const { raw, intact } = await inspectStorage();
    if (raw === null || intact) return null;
    const backupKey = await writeVerifiedBackup(
      AsyncStorage,
      PAIR_PROGRESS_STORAGE_KEY,
      raw
    );
    return {
      raw,
      backupKey,
      keptCount: Object.keys(recoverableProgress(raw)).length,
    };
  });
}

/**
 * Step 2, after the learner confirmed: replaces the malformed history with
 * its valid entries. Rejects, changing nothing, unless storage still holds
 * exactly what was backed up. Attempts recorded while history was blocked are
 * then saved by the normal writer, once each.
 */
export async function applyProgressRecovery(plan: RecoveryPlan): Promise<void> {
  try {
    await enqueue(async () => {
      await assertPlanStillValid(AsyncStorage, PAIR_PROGRESS_STORAGE_KEY, plan);
      const replacement = recoverableProgress(plan.raw);
      if (Object.keys(replacement).length === 0) {
        await AsyncStorage.removeItem(PAIR_PROGRESS_STORAGE_KEY);
      } else {
        await AsyncStorage.setItem(
          PAIR_PROGRESS_STORAGE_KEY,
          serializeProgress(replacement)
        );
      }
    });
  } finally {
    // Whatever happened — including a replacement that landed but was
    // reported as failed — learn what storage holds now, then let the normal
    // writer save pending attempts if it is valid. A failure here leaves the
    // attempts pending and the state accurate.
    await enqueue(inspectStorage).catch(() => undefined);
    await enqueueWritePending().catch(() => undefined);
  }
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
