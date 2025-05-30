// constants/minimalPairs.ts  – aggregator + shared types (patched with `group`)
// -----------------------------------------------------------------------------
// This file re‑exports all per‑language datasets so the rest of the app can do:
//     import { minimalPairs } from '@/constants/minimalPairs';
// -----------------------------------------------------------------------------

/* ─── Shared TS types ─────────────────────────────────────────────── */
export type Difficulty = 1 | 2 | 3 | 4;

export interface Pair {
  word1: string;
  word2: string;
  ipa1: string;
  ipa2: string;
  difficulty: Difficulty; // lexical/context tier
  group: string; // contrast ID (e.g. 'rL', 'bV')
  variantRate?: number; // optional custom speed override
  audio1: any; // static require()
  audio2: any;
}

export interface Category {
  category: string; // language label – 日本語, 中文, ไทย …
  pairs: Pair[];
}

/* ─── Language datasets ──────────────────────────────────────────── */
import japanese from './minimalPairs/japanese';
import mandarin from './minimalPairs/mandarin';
import thai from './minimalPairs/thai';
import spanish from './minimalPairs/spanish';
import arabic from './minimalPairs/arabic';
import russian from './minimalPairs/russian';
import korean from './minimalPairs/korean';
import portuguese from './minimalPairs/portuguese';
import vietnamese from './minimalPairs/vietnamese';
import turkish from './minimalPairs/turkish';
import farsi from './minimalPairs/farsi';
import cantonese from './minimalPairs/cantonese';
import indonesian from './minimalPairs/indonesian';
import hinduUrdu from './minimalPairs/hindu_urdu';
// …add more as they are created

/* ─── Aggregated export (keep ordering as preferred) ─────────────── */
export const minimalPairs: Category[] = [
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
