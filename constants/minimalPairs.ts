// constants/minimalPairs.ts
// --------------------------------------------
// Master index that re-exports every L1 dataset
// so HomeScreen and other modules can simply do:
//
//   import { minimalPairs } from '@/constants/minimalPairs';
//
// Add additional imports (mandarin, thai, …) as
// you create them.  No other code needs to change.
// --------------------------------------------

/* ── shared types ─────────────────────────── */
export type Difficulty = 1 | 2 | 3 | 4; // 1 easy … 4 very-hard

export interface Pair {
  word1: string;
  word2: string;
  ipa1: string;
  ipa2: string;
  difficulty: Difficulty;
  /** optional custom playback-rate (falls back to global table) */
  variantRate?: number;
  audio1: any; // require() at build time
  audio2: any;
}

export interface Category {
  /** UI label for the dropdown – here: the language in its own script */
  category: string; // e.g. '日本語', '中文', 'ไทย'
  pairs: Pair[];
}

/* ── language datasets ────────────────────── */
import japanese from './minimalPairs/japanese';
// import mandarin from './minimalPairs/mandarin';
// import thai     from './minimalPairs/thai';
// …add more as you create them

/* ── aggregated export (unchanged import path) */
export const minimalPairs: Category[] = [
  japanese,
  // mandarin,
  // thai,
  // …
];
