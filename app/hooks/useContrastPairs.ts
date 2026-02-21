import { useState, useMemo, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Pair } from '@/app/constants/minimalPairs';

const MASTERY_KEY_PREFIX = '@mastery_';

export const useContrastPairs = (pairs: Pair[], categoryKey: string) => {
  // map group → highest tier mastered (start at 1)
  const [mastery, setMastery] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);

  const storageKey = `${MASTERY_KEY_PREFIX}${categoryKey}`;

  // Load persisted mastery on mount / category change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(storageKey);
        if (raw && !cancelled) {
          setMastery(JSON.parse(raw));
        }
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
    AsyncStorage.setItem(storageKey, JSON.stringify(mastery)).catch(() => {});
  }, [mastery, storageKey, isLoading]);

  const visible = useMemo(() => {
    const byGroup: Record<string, Pair[]> = {};
    pairs.forEach((p) => (byGroup[p.group] ??= []).push(p));

    return Object.values(byGroup).map((groupArr) => {
      const tier = mastery[groupArr[0].group] ?? 1;
      return groupArr.find((p) => p.difficulty === tier) ?? groupArr[0];
    });
  }, [pairs, mastery]);

  const promote = useCallback(
    (group: string) =>
      setMastery((m) => ({ ...m, [group]: Math.min((m[group] ?? 1) + 1, 6) })),
    []
  );

  const resetMastery = useCallback(async () => {
    setMastery({});
    await AsyncStorage.removeItem(storageKey).catch(() => {});
  }, [storageKey]);

  return { visible, promote, mastery, resetMastery, isLoading };
};
