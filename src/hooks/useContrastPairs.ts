import { useState, useMemo, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pair } from '@/src/constants/minimalPairs';
import {
  buildMasteryForAllGroups,
  selectVisiblePairsByMastery,
} from '@/src/domain/practiceSession';
import {
  buildMasteryStorageKey,
  parseStoredMastery,
  serializeMastery,
} from '@/src/domain/masteryPersistence';

export const useContrastPairs = (pairs: Pair[], categoryKey: string) => {
  // map group → highest tier mastered (start at 1)
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = buildMasteryStorageKey(categoryKey);

  // Load persisted mastery on mount / category change
  useEffect(() => {
    let cancelled = false;
    // Reset to loading state so the UI doesn't render stale data
    setIsLoading(true);
    setMastery({});
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (!cancelled) setMastery(parseStoredMastery(raw));
      } catch {
        // ignore – start fresh
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [storageKey]);

  // Persist whenever mastery changes (after initial load)
  useEffect(() => {
    if (isLoading) return;
    AsyncStorage.setItem(storageKey, serializeMastery(mastery)).catch(() => {});
  }, [mastery, storageKey, isLoading]);

  const visible = useMemo(() => {
    return selectVisiblePairsByMastery(pairs, mastery);
  }, [pairs, mastery]);

  const promote = useCallback(
    (group: string) =>
      setMastery((m) => ({ ...m, [group]: Math.min((m[group] ?? 1) + 1, 6) })),
    []
  );

  /** Set every group to the given tier (clamped 1-6). Used by the placement test. */
  const setAllGroupsToTier = useCallback(
    (tier: number) => {
      setMastery(buildMasteryForAllGroups(pairs, tier));
    },
    [pairs]
  );

  const resetMastery = useCallback(async () => {
    setMastery({});
    await AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [storageKey]);

  /** Re-read mastery from AsyncStorage (e.g. when the tab gains focus). */
  const refresh = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem(storageKey);
      setMastery((current) => parseStoredMastery(raw, current));
    } catch {
      // ignore
    }
  }, [storageKey]);

  return { visible, promote, mastery, resetMastery, setAllGroupsToTier, refresh, isLoading };
};
