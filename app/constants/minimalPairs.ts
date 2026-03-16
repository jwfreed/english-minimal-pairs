// constants/minimalPairs.ts  – aggregator + shared types (patched with `group`)
// -----------------------------------------------------------------------------
// This file re‑exports all per‑language datasets so the rest of the app can do:
//     import { minimalPairs } from '@/constants/minimalPairs';
// -----------------------------------------------------------------------------

// import english from './minimalPairs/english'; // TODO: Add English pairs
import arabic from './minimalPairs/arabic';
import cantonese from './minimalPairs/cantonese';
import farsi from './minimalPairs/farsi';
import hinduUrdu from './minimalPairs/hindu_urdu';
import indonesian from './minimalPairs/indonesian';
import japanese from './minimalPairs/japanese';
import korean from './minimalPairs/korean';
import mandarin from './minimalPairs/mandarin';
import portuguese from './minimalPairs/portuguese';
import russian from './minimalPairs/russian';
import spanish from './minimalPairs/spanish';
import thai from './minimalPairs/thai';
import turkish from './minimalPairs/turkish';
import vietnamese from './minimalPairs/vietnamese';

/* ─── Shared TS types ─────────────────────────────────────────────── */
export type Difficulty = 1 | 2 | 3 | 4 | 5 | 6;
export type Position = 'initial' | 'medial' | 'final';

export interface Pair {
  word1: string;
  word2: string;
  ipa1: string;
  ipa2: string;
  difficulty: Difficulty; // lexical/context tier
  group: string; // contrast ID (e.g. 'rL', 'bV')
  position: Position; // phonetic position of the contrast
  contrastPhoneme1: string; // e.g. 'r' for rake in rL group
  contrastPhoneme2: string; // e.g. 'l' for lake in rL group
  variantRate?: number; // optional custom speed override
}

export interface Category {
  category: string; // language label – 日本語, 中文, ไทย …
  pairs: Pair[];
}

/* ─── Aggregated export (keep ordering as preferred) ─────────────── */
export const minimalPairs: Category[] = [
  // english, // TODO: Uncomment when English pairs are added
  japanese,
  mandarin,
  thai,
  spanish,
  arabic,
  russian,
  korean,
  portuguese,
  vietnamese,
  turkish,
  farsi,
  cantonese,
  indonesian,
  hinduUrdu,
];
