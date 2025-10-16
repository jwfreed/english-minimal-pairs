// constants/minimalPairs/korean.ts
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
const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const fP: Row[] = [
  ['fine', 'pine', 1, '/faɪn/', '/paɪn/', 'fP'],
  ['fan', 'pan', 2, '/fæn/', '/pæn/', 'fP'],
  ['ferry', 'perry', 3, '/ˈfɛri/', '/ˈpɛri/', 'fP'],
  ['fail', 'pale', 4, '/feɪl/', '/peɪl/', 'fP'],
];

const vB: Row[] = [
  ['van', 'ban', 1, '/væn/', '/bæn/', 'vB'],
  ['vest', 'best', 2, '/vɛst/', '/bɛst/', 'vB'],
  ['vow', 'bow', 3, '/vaʊ/', '/baʊ/', 'vB'],
  ['vase', 'base', 4, '/veɪs/', '/beɪs/', 'vB'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL'],
  ['rip', 'lip', 3, '/rɪp/', '/lɪp/', 'rL'],
  ['rake', 'lake', 4, '/reɪk/', '/leɪk/', 'rL'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

/* ---------- export ------------------------------------------------ */
const korean: Category = {
  category: '한국어',
  pairs: [
    ...iVsI.map(make),
    ...fP.map(make),
    ...vB.map(make),
    ...rL.map(make),
    ...thetaS.map(make),
  ],
};

export default korean;
