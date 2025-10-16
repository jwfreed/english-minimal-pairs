// constants/minimalPairs/spanish.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
 *  Each `group` represents the SAME phonemic contrast across tiers.
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
const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const uhVsAh: Row[] = [
  ['cut', 'cot', 1, '/kʌt/', '/kɑːt/', 'uhVsAh'],
  ['luck', 'lock', 2, '/lʌk/', '/lɑːk/', 'uhVsAh'],
  ['cup', 'cop', 3, '/kʌp/', '/kɑːp/', 'uhVsAh'],
  ['duck', 'dock', 4, '/dʌk/', '/dɑːk/', 'uhVsAh'],
];

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE'],
];

const bV: Row[] = [
  ['ban', 'van', 1, '/bæn/', '/væn/', 'bV'],
  ['berry', 'very', 2, '/ˈbɛri/', '/ˈvɛri/', 'bV'],
  ['bow', 'vow', 3, '/baʊ/', '/vaʊ/', 'bV'],
  ['ball', 'wall', 4, '/bɔːl/', '/wɔːl/', 'bV'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['theme', 'seem', 4, '/θiːm/', '/siːm/', 'thetaS'],
];

/* ---------- export ------------------------------------------------ */
const spanish: Category = {
    category: 'idioma español',
  pairs: [
    ...iVsI.map(make),
    ...uhVsAh.map(make),
    ...aVsE.map(make),
    ...bV.map(make),
    ...thetaS.map(make),
  ],
};

export default spanish;
