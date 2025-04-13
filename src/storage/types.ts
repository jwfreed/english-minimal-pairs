// types.ts

/** Represents one minimal pair (e.g. "road-load") */
export interface SimplePair {
  word1: string;
  word2: string;
  ipa1: string;
  ipa2: string;
  audio1: any; // require(...) or string for URI
  audio2: any; // likewise
}

/** Represents a single L1 category with an array of minimal pairs */
export interface L1Category {
  category: string;
  pairs: SimplePair[];
}

/** The top-level data array is L1Category[] */
///////////////////////////////////////////////////////////////
// *** EXAMPLE minimalPairs.ts ***
//
// import { L1Category } from './types';
//
// export const minimalPairs: L1Category[] = [ ... ];
///////////////////////////////////////////////////////////////

/** Describes a single practice session for a given pair */
export interface PairSession {
  sessionId: string;
  startTime: number;
  endTime?: number;
  attempts: number;
  correct: number;
}

/** Maps each pair ID to an array of practice sessions,
 * if you track multiple sessions per pair.
 */
export interface PairSessionHistory {
  [pairId: string]: PairSession[];
}

export interface PairAttempt {
  isCorrect: boolean;
  timestamp: number;
  durationMin?: number;
}

export interface PairStats {
  attempts: PairAttempt[];
}
