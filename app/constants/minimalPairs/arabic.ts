// constants/minimalPairs/arabic.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
 *  The `group` key ties all tiers of the same contrast.
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
const pB: Row[] = [
  ['pat', 'bat', 1, '/pæt/', '/bæt/', 'pB'],
  ['pan', 'ban', 2, '/pæn/', '/bæn/', 'pB'],
  ['pear', 'bear', 3, '/pɛə/', '/bɛə/', 'pB'],
  ['pack', 'back', 4, '/pæk/', '/bæk/', 'pB'],
];

const vF: Row[] = [
  ['vine', 'fine', 1, '/vaɪn/', '/faɪn/', 'vF'],
  ['vest', 'fest', 2, '/vɛst/', '/fɛst/', 'vF'],
  ['van', 'fan', 3, '/væn/', '/fæn/', 'vF'],
  ['vase', 'face', 4, '/veɪs/', '/feɪs/', 'vF'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

const ethD: Row[] = [
  ['then', 'den', 1, '/ðɛn/', '/dɛn/', 'ethD'],
  ['though', 'dough', 2, '/ðoʊ/', '/doʊ/', 'ethD'],
  ['they', 'day', 3, '/ðeɪ/', '/deɪ/', 'ethD'],
  ['there', 'dare', 4, '/ðɛə/', '/dɛə/', 'ethD'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

/* ---------- export ------------------------------------------------ */
const arabic: Category = {
  category: 'اللغة العربية',
  pairs: [
    ...pB.map(make),
    ...vF.map(make),
    ...thetaS.map(make),
    ...ethD.map(make),
    ...iVsI.map(make),
  ],
};

export default arabic;
