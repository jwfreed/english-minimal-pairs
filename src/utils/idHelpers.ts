// src/utils/idHelpers.ts
// -----------------------------------------------------------------------------
import { Pair } from '@/constants/minimalPairs';

/**
 * Consistent ID used for tracking progress per pair.
 * Format: `${category}__${group}__${word1}_${word2}`
 */
export const buildPairId = (pair: Pair, category: string): string => {
  return `${category}__${pair.group}__${pair.word1}_${pair.word2}`;
};
