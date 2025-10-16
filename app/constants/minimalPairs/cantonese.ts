// constants/minimalPairs/cantonese.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
 * ----------------------------------------------------------------- */
type Row = [string, string, Difficulty, string, string, string];

const make = ([w1, w2, diff, ipa1, ipa2, group]: Row) => ({
  word1: w1,
  word2: w2,
  ipa1,
  ipa2,
  difficulty: diff,
  group,
});

/* ---------- word lists ------------------------------------------- */
const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL'],
  ['rip', 'lip', 3, '/rɪp/', '/lɪp/', 'rL'],
  ['rake', 'lake', 4, '/reɪk/', '/leɪk/', 'rL'],
];

const vW: Row[] = [
  ['vine', 'wine', 1, '/vaɪn/', '/waɪn/', 'vW'],
  ['vest', 'west', 2, '/vɛst/', '/wɛst/', 'vW'],
  ['vow', 'wow', 3, '/vaʊ/', '/waʊ/', 'vW'],
  ['vane', 'wane', 4, '/veɪn/', '/weɪn/', 'vW'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE'],
];

/* ---------- export ------------------------------------------------ */
const cantonese: Category = {
  category: '廣東話',
  pairs: [
    ...thetaS.map(make),
    ...rL.map(make),
    ...vW.map(make),
    ...iVsI.map(make),
    ...aVsE.map(make),
  ],
};

export default cantonese;
