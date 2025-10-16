// constants/minimalPairs/portuguese.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 * Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
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

/* ---------- word lists ------------------------------------------- */
const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const uVsU: Row[] = [
  ['pool', 'pull', 1, '/puːl/', '/pʊl/', 'uVsU'],
  ['boot', 'book', 2, '/buːt/', '/bʊk/', 'uVsU'],
  ['fool', 'full', 3, '/fuːl/', '/fʊl/', 'uVsU'],
  ['Luke', 'look', 4, '/luːk/', '/lʊk/', 'uVsU'],
];

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE'],
];

const thetaT: Row[] = [
  ['thin', 'tin', 1, '/θɪn/', '/tɪn/', 'thetaT'],
  ['thick', 'tick', 2, '/θɪk/', '/tɪk/', 'thetaT'],
  ['think', 'tink', 3, '/θɪŋk/', '/tɪŋk/', 'thetaT'],
  ['mouth', 'tout', 4, '/maʊθ/', '/taʊt/', 'thetaT'],
];

const ethD: Row[] = [
  ['then', 'den', 1, '/ðɛn/', '/dɛn/', 'ethD'],
  ['though', 'dough', 2, '/ðoʊ/', '/doʊ/', 'ethD'],
  ['they', 'day', 3, '/ðeɪ/', '/deɪ/', 'ethD'],
  ['there', 'dare', 4, '/ðɛə/', '/dɛə/', 'ethD'],
];

/* ---------- export ---------------------------------------------- */
const portuguese: Category = {
  category: 'Português',
  pairs: [
    ...iVsI.map(make),
    ...uVsU.map(make),
    ...aVsE.map(make),
    ...thetaT.map(make),
    ...ethD.map(make),
  ],
};

export default portuguese;
