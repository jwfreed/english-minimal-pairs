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
} from '@/src/domain/masteryPersistence';
import { historicalIdentityMapping } from '@/src/domain/compatibility/historicalIdentityMapping';
import {
  compareMasteryInShadow,
  readCompatibleMastery,
  writeCompatibleMastery,
} from '@/src/storage/masteryCompatibility';

export const useContrastPairs = (pairs: Pair[], categoryKey: string) => {
  // map group → highest tier mastered (start at 1)
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [persistenceError, setPersistenceError] = useState<unknown>(null);
  const nextWriteProvenance = useRef<'practice' | 'placement'>('practice');
  const skipNextStableWrite = useRef(false);
  const stableWriteQueue = useRef<Promise<void>>(Promise.resolve());

  const storageKey = buildMasteryStorageKey(categoryKey);
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
    setIsLoading(true);
    setMastery({});
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
              skipNextStableWrite.current = true;
              setMastery(result.mastery);
            } else {
              // A blocked read must never be followed by an empty write that
              // could erase still-readable legacy progress.
              skipNextStableWrite.current = true;
              setPersistenceError(result);
            }
          }
        } else {
          const raw = await AsyncStorage.getItem(storageKey);
          if (!cancelled) {
            setMastery(parseStoredMastery(raw));
            if (shadowPathEnabled && languageId) {
              void compareMasteryInShadow(
                AsyncStorage,
                languageId,
                categoryKey
              ).catch(() => {});
            }
          }
        }
      } catch {
        if (stablePathEnabled) skipNextStableWrite.current = true;
        // ignore – start fresh
      } finally {
        if (!cancelled) setIsLoading(false);
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

  // Persist whenever mastery changes (after initial load)
  useEffect(() => {
    if (isLoading) return;
    if (stablePathEnabled && languageId) {
      if (skipNextStableWrite.current) {
        skipNextStableWrite.current = false;
        return;
      }
      const provenance = nextWriteProvenance.current;
      nextWriteProvenance.current = 'practice';
      stableWriteQueue.current = stableWriteQueue.current
        .then(async () => {
          const result = await writeCompatibleMastery(
            AsyncStorage,
            languageId,
            categoryKey,
            mastery,
            provenance,
            rolloutState
          );
          if (result.status !== 'complete') setPersistenceError(result);
        })
        .catch(setPersistenceError);
      return;
    }
    AsyncStorage.setItem(storageKey, serializeMastery(mastery)).catch(() => {});
  }, [
    categoryKey,
    isLoading,
    languageId,
    mastery,
    rolloutState,
    stablePathEnabled,
    storageKey,
  ]);

  const visible = useMemo(() => {
    return selectVisiblePairsByMastery(pairs, mastery);
  }, [pairs, mastery]);

  const promote = useCallback(
    (group: string) => {
      nextWriteProvenance.current = 'practice';
      setMastery((m) => ({
        ...m,
        [group]: Math.min((m[group] ?? 1) + 1, 6),
      }));
    },
    []
  );

  /** Set every group to the given tier (clamped 1-6). Used by the placement test. */
  const setAllGroupsToTier = useCallback(
    (tier: number) => {
      nextWriteProvenance.current = 'placement';
      setMastery(buildMasteryForAllGroups(pairs, tier));
    },
    [pairs]
  );

  const resetMastery = useCallback(async () => {
    if (stablePathEnabled && languageId) {
      skipNextStableWrite.current = true;
      setMastery({});
      const result = await writeCompatibleMastery(
        AsyncStorage,
        languageId,
        categoryKey,
        {},
        'reset',
        rolloutState
      );
      if (result.status !== 'complete') setPersistenceError(result);
      return;
    }
    setMastery({});
    await AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [
    categoryKey,
    languageId,
    rolloutState,
    stablePathEnabled,
    storageKey,
  ]);

  /** Re-read mastery from AsyncStorage (e.g. when the tab gains focus). */
  const refresh = useCallback(async () => {
    try {
      if (stablePathEnabled && languageId) {
        const result = await readCompatibleMastery(
          AsyncStorage,
          languageId,
          categoryKey,
          rolloutState
        );
        if (result.status === 'ready') {
          skipNextStableWrite.current = true;
          setMastery(result.mastery);
        } else {
          setPersistenceError(result);
        }
        return;
      }
      const raw = await AsyncStorage.getItem(storageKey);
      setMastery((current) => parseStoredMastery(raw, current));
      if (shadowPathEnabled && languageId) {
        void compareMasteryInShadow(
          AsyncStorage,
          languageId,
          categoryKey
        ).catch(() => {});
      }
    } catch {
      // ignore
    }
  }, [
    categoryKey,
    languageId,
    rolloutState,
    shadowPathEnabled,
    stablePathEnabled,
    storageKey,
  ]);

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
