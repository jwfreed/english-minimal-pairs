import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pair } from '@/src/constants/minimalPairs';
import {
  FEATURE_FLAGS,
  isContrastMasteryAuthoritative,
  isContrastMasteryShadowEnabled,
} from '@/src/config/featureFlags';
import {
  buildMasteryForAllGroups,
  selectVisiblePairsByMastery,
} from '@/src/domain/practiceSession';
import {
  buildMasteryStorageKey,
  parseStoredMastery,
  serializeMastery,
  type MasteryMap,
} from '@/src/domain/masteryPersistence';
import { historicalIdentityMapping } from '@/src/domain/compatibility/historicalIdentityMapping';
import {
  compareMasteryInShadow,
  readCompatibleMastery,
  writeCompatibleMastery,
} from '@/src/storage/masteryCompatibility';

/**
 * Mastery is always attributed to the storage key it was hydrated from. It may
 * be persisted only when that key hydrated successfully and a learner action
 * (not a read) produced it: a failed read is not "no saved mastery".
 */
interface MasteryState {
  key: string;
  hydration: 'loading' | 'ready' | 'failed';
  // map group → highest tier mastered (start at 1)
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
  const stableWriteQueue = useRef<Promise<void>>(Promise.resolve());
  // Bumped by reset so reads issued before it cannot resurrect cleared mastery.
  const readGeneration = useRef(0);

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
            settle(hydrated(storageKey, 'ready', parseStoredMastery(raw)));
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
          if (result.status !== 'complete') setPersistenceError(result);
        })
        .catch(setPersistenceError);
      return;
    }
    AsyncStorage.setItem(storageKey, serializeMastery(nextMastery)).catch(
      setPersistenceError
    );
  }, [
    categoryKey,
    languageId,
    rolloutState,
    stablePathEnabled,
    state,
    storageKey,
  ]);

  const visible = useMemo(() => {
    return selectVisiblePairsByMastery(pairs, mastery);
  }, [pairs, mastery]);

  const promote = useCallback(
    (group: string) => {
      setState((current) => ({
        ...current,
        mastery: {
          ...current.mastery,
          [group]: Math.min((current.mastery[group] ?? 1) + 1, 6),
        },
        mutation: 'practice',
      }));
    },
    []
  );

  /** Set every group to the given tier (clamped 1-6). Used by the placement test. */
  const setAllGroupsToTier = useCallback(
    (tier: number) => {
      setState((current) => ({
        ...current,
        mastery: buildMasteryForAllGroups(pairs, tier),
        mutation: 'placement',
      }));
    },
    [pairs]
  );

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
      applyRead((current) => parseStoredMastery(raw, current));
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
    setAllGroupsToTier,
    refresh,
    isLoading,
    persistenceError,
  };
};
