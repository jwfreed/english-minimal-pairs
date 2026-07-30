// -----------------------------------------------------------------------------
import { Pair } from '@/src/constants/minimalPairs';

/**
 * Legacy content-derived ID used for persisted pair progress.
 * Format: `${category}__${group}__${word1}_${word2}`
 *
 * Keep this format unchanged for compatibility. New identity-bearing behavior
 * must use an explicit PairId instead of deriving identity from mutable content.
 */
export const buildPairId = (pair: Pair, category: string): string => {
  return `${category}__${pair.group}__${pair.word1}_${pair.word2}`;
};
