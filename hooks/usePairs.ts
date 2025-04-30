import { useMemo, useState, useEffect } from 'react';
import { minimalPairs } from '@/constants/minimalPairs';
import { useCategory } from '@/src/context/CategoryContext';

export const usePairs = (difficulty: 1|2|3|4) => {
  const { categoryIndex } = useCategory();
  const catObj = minimalPairs[categoryIndex];

  const visiblePairs = useMemo(
    () => catObj.pairs.filter(p => p.difficulty === difficulty).slice(0,10),
    [catObj, difficulty]
  );

  const [pairIndex, setPairIndex] = useState(0);

  useEffect(() => setPairIndex(0), [categoryIndex, difficulty]);
  useEffect(() => {
    if (pairIndex >= visiblePairs.length) setPairIndex(0);
  }, [visiblePairs.length, pairIndex]);

  return { catObj, visiblePairs, pairIndex, setPairIndex };
};
