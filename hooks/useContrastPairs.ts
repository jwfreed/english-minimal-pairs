import { useState, useMemo } from 'react';
import type { Pair } from '@/constants/minimalPairs';

export const useContrastPairs = (pairs: Pair[]) => {
  // map group → highest tier mastered (start at 1)
  const [mastery, setMastery] = useState<Record<string, number>>({});

  const visible = useMemo(() => {
    const byGroup: Record<string, Pair[]> = {};
    pairs.forEach((p) => (byGroup[p.group] ??= []).push(p));

    return Object.values(byGroup).map((groupArr) => {
      const tier = mastery[groupArr[0].group] ?? 1;
      return groupArr.find((p) => p.difficulty === tier)!;
    });
  }, [pairs, mastery]);

  const promote = (group: string) =>
    setMastery((m) => ({ ...m, [group]: Math.min((m[group] ?? 1) + 1, 4) }));

  return { visible, promote };
};
