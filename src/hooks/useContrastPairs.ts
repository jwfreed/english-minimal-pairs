import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pair } from '@/src/constants/minimalPairs';
import {
  FEATURE_FLAGS,
  isContrastMasteryAuthoritative,
  isContrastMasteryShadowEnabled,
} from '@/src/config/featureFlags';
import { selectVisiblePairsByMastery } from '@/src/domain/practiceSession';
import {
  buildMasteryStorageKey,
  readStoredMastery,
  serializeMastery,
  type MasteryMap,
} from '@/src/domain/masteryPersistence';
import { historicalIdentityMapping } from '@/src/domain/compatibility/historicalIdentityMapping';
import {
  nextMasteryLevel,
  practiceTierMap,
  practiceTierOf,
} from '@/src/domain/masteryLevel';
import {
  compareMasteryInShadow,
  readCompatibleMastery,
  writeCompatibleMastery,
} from '@/src/storage/masteryCompatibility';
import { writeWithRetry } from '@/src/storage/writeRetry';

/**
 * Whether learner mastery is durable. `saved`: every mutation has been
 * acknowledged by storage. `pending`: at least one category has a mutation
 * (or reset) that storage has not acknowledged — in flight, or failed and
 * awaiting retry. `blocked`: this category's stored mastery could not be read
 * or is malformed, so nothing is written over it.
 *
 * Pending mutations are held in memory only. They are retried while the app
 * runs, but are lost if the app is terminated before a retry succeeds.
 */
export type MasteryPersistence = 'saved' | 'pending' | 'blocked';

const MALFORMED_MASTERY_ERROR = 'Stored mastery is malformed';

/**
 * Mastery is always attributed to the storage key it was hydrated from. It may
 * be persisted only when that key hydrated successfully and a learner action
 * (not a read) produced it: a failed read is not "no saved mastery".
 */
interface MasteryState {
  key: string;
  hydration: 'loading' | 'ready' | 'failed';
  // map group → mastery level (1–7, start at 1); see masteryLevel.ts
  mastery: MasteryMap;
  mutation: 'practice' | 'placement' | null;
}

const hydrated = (
  key: string,
  hydration: MasteryState['hydration'],
  mastery: MasteryMap = {}
): MasteryState => ({ key, hydration, mastery, mutation: null });

export const useContrastPairs = (pairs: Pair[], categoryKey: string) => {
  const storageKey = buildMasteryStorageKey(categoryKey);
  const [state, setState] = useState<MasteryState>(
    hydrated(storageKey, 'loading')
  );
  const [persistenceError, setPersistenceError] = useState<unknown>(null);
  // Derived only from `pendingWrites`, never set by an individual write's
  // outcome, so an older success cannot report "saved" over newer unsaved work.
  const [unsaved, setUnsaved] = useState({ any: false, failing: false });
  const [stableSaveFailed, setStableSaveFailed] = useState(false);
  const stableWriteQueue = useRef<Promise<void>>(Promise.resolve());
  // Storage key → the latest intent storage has not acknowledged: a mastery
  // map to write, or null for a reset (remove the key). One entry per key, so
  // one category's unsaved progress is never replaced by another's.
  const pendingWrites = useRef(new Map<string, MasteryMap | null>());
  // Bumped whenever a key's intent is registered or acknowledged. A read whose
  // key changed revision while it was in flight observed storage from before
  // that write and must not be adopted.
  const keyRevisions = useRef(new Map<string, number>());
  const flushing = useRef<Promise<void> | null>(null);
  const flushAgain = useRef(false);
  const writeFailing = useRef(false);
  // Bumped by reset so reads issued before it cannot resurrect cleared mastery.
  const readGeneration = useRef(0);

  const bumpRevision = useCallback((key: string) => {
    keyRevisions.current.set(key, (keyRevisions.current.get(key) ?? 0) + 1);
  }, []);

  /** Reads a key, re-reading if a write to it was registered or landed meanwhile. */
  const readCurrent = useCallback(async (key: string) => {
    for (;;) {
      const revision = keyRevisions.current.get(key);
      const raw = await AsyncStorage.getItem(key);
      if (keyRevisions.current.get(key) === revision) return raw;
    }
  }, []);

  const syncUnsaved = useCallback(() => {
    const any = pendingWrites.current.size > 0;
    if (!any) writeFailing.current = false;
    const failing = writeFailing.current;
    setUnsaved((current) =>
      current.any === any && current.failing === failing
        ? current
        : { any, failing }
    );
  }, []);

  // The single writer for legacy mastery. One storage operation at a time, and
  // each attempt (including a retry) takes the key's latest intent, so:
  // an older snapshot never lands after a newer one; a reset issued while a
  // write is in flight or retrying is applied after it and wins; and a key
  // whose write keeps failing keeps its intent without holding up other keys.
  const flushPendingWrites = useCallback((): Promise<void> => {
    if (flushing.current) {
      // New intents may have arrived for keys this pass already gave up on.
      flushAgain.current = true;
      return flushing.current;
    }
    const pending = pendingWrites.current;
    flushing.current = (async () => {
      do {
        flushAgain.current = false;
        const attempted = new Set<string>();
        for (;;) {
          const key = [...pending.keys()].find((k) => !attempted.has(k));
          if (key === undefined) break;
          attempted.add(key);
          let written: MasteryMap | null | undefined;
          try {
            await writeWithRetry(() => {
              written = pending.get(key);
              if (written === undefined) return Promise.resolve();
              return (
                written === null
                  ? AsyncStorage.removeItem(key)
                  : AsyncStorage.setItem(key, serializeMastery(written))
              ).catch((error) => {
                writeFailing.current = true;
                syncUnsaved();
                throw error;
              });
            });
            if (pending.get(key) === written) {
              pending.delete(key);
              bumpRevision(key);
            } else {
              // A newer intent arrived during the write. It waits for the
              // next pass, so every other key gets its turn first.
              flushAgain.current = true;
            }
          } catch (error) {
            setPersistenceError(error);
          }
          syncUnsaved();
        }
      } while (flushAgain.current);
    })().finally(() => {
      flushing.current = null;
    });
    return flushing.current;
  }, [bumpRevision, syncUnsaved]);

  const { mastery } = state;
  const isLoading = state.key !== storageKey || state.hydration === 'loading';
  const languageId =
    historicalIdentityMapping.resolveCategoryLabel(categoryKey);
  const rolloutState = FEATURE_FLAGS.contrastMasteryRollout;
  const stablePathEnabled =
    isContrastMasteryAuthoritative(rolloutState) &&
    languageId !== undefined;
  const shadowPathEnabled =
    isContrastMasteryShadowEnabled(rolloutState) &&
    languageId !== undefined;

  // Load persisted mastery on mount / category change
  useEffect(() => {
    let cancelled = false;
    // Reset to loading state so the UI doesn't render stale data
    setState(hydrated(storageKey, 'loading'));
    // Only a state still awaiting this read may adopt it; a reset or a newer
    // refresh supersedes it.
    const settle = (next: MasteryState) =>
      setState((current) =>
        current.key === storageKey && current.hydration === 'loading'
          ? next
          : current
      );
    (async () => {
      try {
        if (stablePathEnabled && languageId) {
          const result = await readCompatibleMastery(
            AsyncStorage,
            languageId,
            categoryKey,
            rolloutState
          );
          if (!cancelled) {
            if (result.status === 'ready') {
              settle(hydrated(storageKey, 'ready', result.mastery));
            } else {
              // A blocked read must never be followed by an empty write that
              // could erase still-readable legacy progress.
              settle(hydrated(storageKey, 'failed'));
              setPersistenceError(result);
            }
          }
        } else {
          const raw = await readCurrent(storageKey);
          if (!cancelled) {
            // An intent still waiting to be written to this key (a mastery
            // map, or a reset) is newer than whatever storage holds.
            const unsavedIntent = pendingWrites.current.get(storageKey);
            if (unsavedIntent !== undefined) {
              settle(hydrated(storageKey, 'ready', unsavedIntent ?? {}));
              return;
            }
            const stored = readStoredMastery(raw);
            if (stored.status === 'malformed') {
              // Not "no saved mastery": hydrating it as writable would let
              // the next save destroy it. Its valid levels stay readable.
              settle(hydrated(storageKey, 'failed', stored.mastery));
              setPersistenceError(new Error(MALFORMED_MASTERY_ERROR));
              return;
            }
            settle(hydrated(storageKey, 'ready', stored.mastery));
            if (shadowPathEnabled && languageId) {
              void compareMasteryInShadow(
                AsyncStorage,
                languageId,
                categoryKey
              ).catch(() => {});
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          settle(hydrated(storageKey, 'failed'));
          setPersistenceError(error);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [
    categoryKey,
    languageId,
    readCurrent,
    rolloutState,
    shadowPathEnabled,
    stablePathEnabled,
    storageKey,
  ]);

  // Persist learner mutations of mastery hydrated from this exact key
  useEffect(() => {
    if (
      state.key !== storageKey ||
      state.hydration !== 'ready' ||
      !state.mutation
    ) {
      // Nothing to register (e.g. a mutation over a blocked read): make the
      // optimistic "unsaved" mark from the mutation match what is pending.
      syncUnsaved();
      return;
    }
    const { mastery: nextMastery, mutation: provenance } = state;
    if (stablePathEnabled && languageId) {
      stableWriteQueue.current = stableWriteQueue.current
        .then(async () => {
          const result = await writeCompatibleMastery(
            AsyncStorage,
            languageId,
            categoryKey,
            nextMastery,
            provenance,
            rolloutState
          );
          setStableSaveFailed(result.status !== 'complete');
          if (result.status !== 'complete') setPersistenceError(result);
        })
        .catch(setPersistenceError);
      return;
    }
    pendingWrites.current.set(storageKey, nextMastery);
    bumpRevision(storageKey);
    syncUnsaved();
    void flushPendingWrites();
  }, [
    bumpRevision,
    categoryKey,
    flushPendingWrites,
    syncUnsaved,
    languageId,
    rolloutState,
    stablePathEnabled,
    state,
    storageKey,
  ]);

  const visible = useMemo(() => {
    return selectVisiblePairsByMastery(pairs, practiceTierMap(mastery));
  }, [pairs, mastery]);

  // Batched with the mutation itself, so the render that first shows new
  // mastery already reports it unsaved; the persist effect then registers it.
  const markUnsaved = useCallback(() => {
    setUnsaved((current) => (current.any ? current : { ...current, any: true }));
  }, []);

  const promote = useCallback(
    (group: string) => {
      markUnsaved();
      setState((current) => ({
        ...current,
        mastery: {
          ...current.mastery,
          [group]: nextMasteryLevel(current.mastery[group]),
        },
        mutation: 'practice',
      }));
    },
    [markUnsaved]
  );

  /**
   * Applies per-contrast placement levels (Decision 021), replacing the
   * category's levels. Placement sets practice tiers only: every level is
   * clamped to 1–6 so placement can never record final-tier completion.
   */
  const setPlacementLevels = useCallback((levels: MasteryMap) => {
    const placed: MasteryMap = {};
    for (const [group, level] of Object.entries(levels)) {
      placed[group] = Math.max(1, practiceTierOf(level));
    }
    markUnsaved();
    setState((current) => ({
      ...current,
      mastery: placed,
      mutation: 'placement',
    }));
  }, [markUnsaved]);

  const resetMastery = useCallback(async () => {
    readGeneration.current += 1;
    // The reset itself establishes this key's contents: empty.
    setState((current) =>
      current.key === storageKey ? hydrated(storageKey, 'ready') : current
    );
    if (stablePathEnabled && languageId) {
      // Queue behind in-flight mutation writes so none can land after the reset.
      stableWriteQueue.current = stableWriteQueue.current
        .then(async () => {
          const result = await writeCompatibleMastery(
            AsyncStorage,
            languageId,
            categoryKey,
            {},
            'reset',
            rolloutState
          );
          if (result.status !== 'complete') setPersistenceError(result);
        })
        .catch(setPersistenceError);
      await stableWriteQueue.current;
      return;
    }
    // The reset replaces any unsaved mastery for this key and goes through
    // the same writer, so it is ordered after a write already in flight and
    // is itself retried if storage rejects it.
    pendingWrites.current.set(storageKey, null);
    bumpRevision(storageKey);
    syncUnsaved();
    await flushPendingWrites();
  }, [
    bumpRevision,
    categoryKey,
    flushPendingWrites,
    syncUnsaved,
    languageId,
    rolloutState,
    stablePathEnabled,
    storageKey,
  ]);

  /** Re-read mastery from AsyncStorage (e.g. when the tab gains focus). */
  const refresh = useCallback(async () => {
    // A refresh that resolves after a category change or a reset must not
    // rebind state. In-memory mastery is a fallback only once it is hydrated.
    const generation = readGeneration.current;
    const applyRead = (read: (current: MasteryMap) => MasteryMap) =>
      setState((current) =>
        current.key === storageKey && generation === readGeneration.current
          ? hydrated(
              storageKey,
              'ready',
              read(current.hydration === 'ready' ? current.mastery : {})
            )
          : current
      );
    try {
      if (stablePathEnabled && languageId) {
        const result = await readCompatibleMastery(
          AsyncStorage,
          languageId,
          categoryKey,
          rolloutState
        );
        if (result.status === 'ready') {
          applyRead(() => result.mastery);
        } else {
          setPersistenceError(result);
        }
        return;
      }
      const raw = await readCurrent(storageKey);
      const unsavedIntent = pendingWrites.current.get(storageKey);
      const stored = readStoredMastery(raw);
      if (unsavedIntent === undefined && stored.status === 'malformed') {
        setPersistenceError(new Error(MALFORMED_MASTERY_ERROR));
        return;
      }
      // As before, a missing key keeps the in-memory mastery.
      applyRead((current) =>
        unsavedIntent !== undefined
          ? unsavedIntent ?? {}
          : raw
            ? stored.mastery
            : current
      );
      if (shadowPathEnabled && languageId) {
        void compareMasteryInShadow(
          AsyncStorage,
          languageId,
          categoryKey
        ).catch(() => {});
      }
    } catch (error) {
      setPersistenceError(error);
    }
  }, [
    categoryKey,
    languageId,
    readCurrent,
    rolloutState,
    shadowPathEnabled,
    stablePathEnabled,
    storageKey,
  ]);

  // Learner progress over a failed read cannot be saved; retry the read. On
  // success stored mastery replaces the in-session state, whose baseline was
  // unknown, and later mutations persist normally.
  useEffect(() => {
    if (
      state.key === storageKey &&
      state.hydration === 'failed' &&
      state.mutation
    ) {
      void refresh();
    }
  }, [refresh, state, storageKey]);

  const persistence: MasteryPersistence =
    state.key === storageKey && state.hydration === 'failed'
      ? 'blocked'
      : unsaved.any || stableSaveFailed
        ? 'pending'
        : 'saved';

  return {
    visible,
    promote,
    mastery,
    resetMastery,
    setPlacementLevels,
    refresh,
    isLoading,
    persistenceError,
    persistence,
    /**
     * True when the learner should be told: progress is blocked, or a write
     * has failed and is awaiting retry. An ordinary write in flight is
     * `pending` but needs no attention.
     */
    saveNeedsAttention:
      persistence === 'blocked' || unsaved.failing || stableSaveFailed,
    retryPendingSave: flushPendingWrites,
  };
};
