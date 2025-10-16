// constants/minimalPairs/russian.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ----------------------------------------------------------------
 *  Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
 * ----------------------------------------------------------------*/
type Row = [string, string, Difficulty, string, string, string];

const make = ([w1, w2, diff, ipa1, ipa2, group]: Row) => ({
  word1: w1,
  word2: w2,
  ipa1,
  ipa2,
  difficulty: diff,
  group,
});

/* ---------- word lists ------------------------------------------ */
const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const aVsUh: Row[] = [
  ['bat', 'but', 1, '/bæt/', '/bʌt/', 'aVsUh'],
  ['cap', 'cup', 2, '/kæp/', '/kʌp/', 'aVsUh'],
  ['pan', 'pun', 3, '/pæn/', '/pʌn/', 'aVsUh'],
  ['ban', 'bun', 4, '/bæn/', '/bʌn/', 'aVsUh'],
];

const wV: Row[] = [
  ['wine', 'vine', 1, '/waɪn/', '/vaɪn/', 'wV'],
  ['west', 'vest', 2, '/wɛst/', '/vɛst/', 'wV'],
  ['wow', 'vow', 3, '/waʊ/', '/vaʊ/', 'wV'],
  ['wane', 'vane', 4, '/weɪn/', '/veɪn/', 'wV'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

const hZero: Row[] = [
  ['hat', 'at', 1, '/hæt/', '/æt/', 'hZero'],
  ['heat', 'eat', 2, '/hiːt/', '/iːt/', 'hZero'],
  ['hill', 'ill', 3, '/hɪl/', '/ɪl/', 'hZero'],
  ['hair', 'air', 4, '/heə/', '/eə/', 'hZero'],
];

/* ---------- export --------------------------------------------- */
const russian: Category = {
  category: 'русский язык',
  pairs: [
    ...iVsI.map(make),
    ...aVsUh.map(make),
    ...wV.map(make),
    ...thetaS.map(make),
    ...hZero.map(make),
  ],
};

export default russian;
