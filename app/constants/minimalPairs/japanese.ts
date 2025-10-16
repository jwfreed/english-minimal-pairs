// constants/minimalPairs/japanese.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple:  [word1, word2, difficulty, ipa1, ipa2, groupID]
 *  `group` ties all tiers of the SAME contrast together
 *  so /r-l/ rows share 'rL', /b-v/ share 'bV', etc.
 * ----------------------------------------------------------------- */
type Row = [string, string, Difficulty, string, string, string];

/* helper: tuple → Pair object */
const make = ([w1, w2, diff, ipa1, ipa2, group]: Row) => ({
  word1: w1,
  word2: w2,
  ipa1,
  ipa2,
  difficulty: diff,
  group,
});

/* ---------- word-lists with group IDs --------------------------- */
const rL: Row[] = [
  ['rake', 'lake', 1, '/reɪk/', '/leɪk/', 'rL'],
  ['rate', 'late', 2, '/reɪt/', '/leɪt/', 'rL'],
  ['rag', 'lag', 3, '/ræɡ/', '/læɡ/', 'rL'],
  ['pray', 'play', 4, '/preɪ/', '/pleɪ/', 'rL'],
];

const bV: Row[] = [
  ['ban', 'van', 1, '/bæn/', '/væn/', 'bV'],
  ['berry', 'very', 2, '/ˈbɛri/', '/ˈvɛri/', 'bV'],
  ['bow', 'vow', 3, '/baʊ/', '/vaʊ/', 'bV'],
  ['ball', 'wall', 4, '/bɔːl/', '/wɔːl/', 'bV'],
];

const sTheta: Row[] = [
  ['sink', 'think', 1, '/sɪŋk/', '/θɪŋk/', 'sTheta'],
  ['sip', 'thick', 2, '/sɪp/', '/θɪk/', 'sTheta'],
  ['mass', 'math', 3, '/mæs/', '/mæθ/', 'sTheta'],
  ['seal', 'theel', 4, '/siːl/', '/θiːl/', 'sTheta'],
];

const aVsUh: Row[] = [
  ['cat', 'cut', 1, '/kæt/', '/kʌt/', 'aVsUh'],
  ['batter', 'butter', 2, '/ˈbætər/', '/ˈbʌtər/', 'aVsUh'],
  ['ran', 'run', 3, '/ræn/', '/rʌn/', 'aVsUh'],
  ['cash', 'cush', 4, '/kæʃ/', '/kʊʃ/', 'aVsUh'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

/* ---------- export category object ----------------------------- */
const japanese: Category = {
  category: '日本語',
  pairs: [
    ...rL.map(make),
    ...bV.map(make),
    ...sTheta.map(make),
    ...aVsUh.map(make),
    ...iVsI.map(make),
  ],
};

export default japanese;
