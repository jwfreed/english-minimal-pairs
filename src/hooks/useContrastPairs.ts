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
 * Whether learner progress is durable: `saved`; `pending` — the latest mastery
 * is held in memory because a write failed, and is retried; `blocked` — the
 * stored mastery could not be read (or is malformed), so nothing may be
 * written over it.
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
  const [saveState, setSaveState] = useState<'saved' | 'pending'>('saved');
  const stableWriteQueue = useRef<Promise<void>>(Promise.resolve());
  // The latest mastery not yet durably written, with the key it belongs to.
  const pendingWrite = useRef<{ key: string; mastery: MasteryMap } | null>(
    null
  );
  const isWriting = useRef(false);
  // Bumped by reset so reads issued before it cannot resurrect cleared mastery.
  const readGeneration = useRef(0);

  // One write at a time, always of the latest intent: an older snapshot can
  // never land after a newer one, and a failed write keeps its intent so the
  // next flush (a later mutation, or the learner's next round) retries it.
  const flushPendingWrite = useCallback(async () => {
    if (isWriting.current) return;
    isWriting.current = true;
    try {
      while (pendingWrite.current) {
        let written = pendingWrite.current;
        await writeWithRetry(() => {
          written = pendingWrite.current ?? written;
          return AsyncStorage.setItem(
            written.key,
            serializeMastery(written.mastery)
          ).catch((error) => {
            setSaveState('pending');
            throw error;
          });
        });
        if (pendingWrite.current === written) pendingWrite.current = null;
      }
      setSaveState('saved');
    } catch (error) {
      setPersistenceError(error);
    } finally {
      isWriting.current = false;
    }
  }, []);

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
          const raw = await AsyncStorage.getItem(storageKey);
          if (!cancelled) {
            const stored = readStoredMastery(raw);
            if (stored.status === 'malformed') {
              // Not "no saved mastery": hydrating it as empty would let the
              // next save overwrite it.
              settle(hydrated(storageKey, 'failed'));
              setPersistenceError(new Error(MALFORMED_MASTERY_ERROR));
              return;
            }
            // Mastery still waiting to be written to this key is newer than
            // what storage holds.
            const unsaved = pendingWrite.current;
            settle(
              hydrated(
                storageKey,
                'ready',
                unsaved?.key === storageKey ? unsaved.mastery : stored.mastery
              )
            );
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
          setSaveState(result.status === 'complete' ? 'saved' : 'pending');
          if (result.status !== 'complete') setPersistenceError(result);
        })
        .catch(setPersistenceError);
      return;
    }
    pendingWrite.current = { key: storageKey, mastery: nextMastery };
    void flushPendingWrite();
  }, [
    categoryKey,
    flushPendingWrite,
    languageId,
    rolloutState,
    stablePathEnabled,
    state,
    storageKey,
  ]);

  const visible = useMemo(() => {
    return selectVisiblePairsByMastery(pairs, practiceTierMap(mastery));
  }, [pairs, mastery]);

  const promote = useCallback(
    (group: string) => {
      setState((current) => ({
        ...current,
        mastery: {
          ...current.mastery,
          [group]: nextMasteryLevel(current.mastery[group]),
        },
        mutation: 'practice',
      }));
    },
    []
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
    setState((current) => ({
      ...current,
      mastery: placed,
      mutation: 'placement',
    }));
  }, []);

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
    if (pendingWrite.current?.key === storageKey) pendingWrite.current = null;
    await AsyncStorage.removeItem(storageKey).catch(setPersistenceError);
  }, [
    categoryKey,
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
      const raw = await AsyncStorage.getItem(storageKey);
      const stored = readStoredMastery(raw);
      if (stored.status === 'malformed') {
        setPersistenceError(new Error(MALFORMED_MASTERY_ERROR));
        return;
      }
      const unsaved = pendingWrite.current;
      // As before, a missing key keeps the in-memory mastery.
      applyRead((current) =>
        unsaved?.key === storageKey
          ? unsaved.mastery
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

  return {
    visible,
    promote,
    mastery,
    resetMastery,
    setPlacementLevels,
    refresh,
    isLoading,
    persistenceError,
    persistence: (state.key === storageKey && state.hydration === 'failed'
      ? 'blocked'
      : saveState) as MasteryPersistence,
    retryPendingSave: flushPendingWrite,
  };
};
