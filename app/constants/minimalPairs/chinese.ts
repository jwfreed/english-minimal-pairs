// constants/minimalPairs/chinese.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple:  [word1, word2, difficulty, ipa1, ipa2, groupID]
 *  `group` ties all tiers of the SAME contrast together so that all
 *  /θ–s/ rows share 'thetaS', /v–w/ share 'vW', etc.
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

/* ---------- word-lists with group IDs ---------------------------- */
const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

const vW: Row[] = [
  ['vine', 'wine', 1, '/vaɪn/', '/waɪn/', 'vW'],
  ['vest', 'west', 2, '/vɛst/', '/wɛst/', 'vW'],
  ['vow', 'wow', 3, '/vaʊ/', '/waʊ/', 'vW'],
  ['vane', 'wane', 4, '/veɪn/', '/weɪn/', 'vW'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL'],
  ['rake', 'lake', 3, '/reɪk/', '/leɪk/', 'rL'],
  ['rip', 'lip', 4, '/rɪp/', '/lɪp/', 'rL'],
];

const iVsI: Row[] = [
  ['beat', 'bit', 1, '/biːt/', '/bɪt/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['feet', 'fit', 3, '/fiːt/', '/fɪt/', 'iVsI'],
  ['seat', 'sit', 4, '/siːt/', '/sɪt/', 'iVsI'],
];

const uVsU: Row[] = [
  ['pool', 'pull', 1, '/puːl/', '/pʊl/', 'uVsU'],
  ['boot', 'book', 2, '/buːt/', '/bʊk/', 'uVsU'],
  ['fool', 'full', 3, '/fuːl/', '/fʊl/', 'uVsU'],
  ['Luke', 'look', 4, '/luːk/', '/lʊk/', 'uVsU'],
];

/* ---------- export category object ------------------------------- */
const chinese: Category = {
  category: '中文',
  pairs: [
    ...thetaS.map(make),
    ...vW.map(make),
    ...rL.map(make),
    ...iVsI.map(make),
    ...uVsU.map(make),
  ],
};

export default chinese;
