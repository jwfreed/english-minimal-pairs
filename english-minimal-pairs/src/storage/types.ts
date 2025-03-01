// types.ts

/** Represents a single word in a minimal pair */
export interface PairWord {
  word: string;
  ipa: string;
  audio: any; // Could be number if using require(...), or string for URI
}

/** Represents one minimal pair (e.g., "bat-pat"), with two words */
export interface MinimalPairItem {
  id: string;
  words: PairWord[];
}

/** Represents a category containing multiple minimal pairs (e.g., Consonants) */
export interface MinimalPairCategory {
  category: string;
  pair: MinimalPairItem[];
}

/** Your top-level data array would be MinimalPairCategory[] */
///////////////////////////////////////////////////////////////
// *** EXAMPLE minimalPairs.ts ***
// import { MinimalPairCategory } from './types';

// export const minimalPairs: MinimalPairCategory[] = [...];
///////////////////////////////////////////////////////////////

/** Describes a single practice session for a given pair */
export interface PairSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  attempts: number;
  correct: number;
}

/** Maps each pair ID to an array of practice sessions */
export interface PairSessionHistory {
  [pairId: string]: PairSession[];
}
