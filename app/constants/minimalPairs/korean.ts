// constants/minimalPairs/korean.ts
import type { Category, Difficulty, Position } from '../minimalPairs';

type Row = [string, string, Difficulty, string, string, string, Position];

const make = ([w1, w2, diff, ipa1, ipa2, group, position]: Row, cp1: string, cp2: string) => ({
  word1: w1,
  word2: w2,
  ipa1,
  ipa2,
  difficulty: diff,
  group,
  position,
  contrastPhoneme1: cp1,
  contrastPhoneme2: cp2,
});

/* ---------- word-lists with group IDs ---------------------------- */
const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI', 'medial'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI', 'medial'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI', 'medial'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI', 'medial'],
  ['neat', 'knit', 5, '/niːt/', '/nɪt/', 'iVsI', 'medial'],
  ['peach', 'pitch', 6, '/piːtʃ/', '/pɪtʃ/', 'iVsI', 'medial'],
];

const fP: Row[] = [
  ['fine', 'pine', 1, '/faɪn/', '/paɪn/', 'fP', 'initial'],
  ['fan', 'pan', 2, '/fæn/', '/pæn/', 'fP', 'initial'],
  ['ferry', 'perry', 3, '/ˈfɛri/', '/ˈpɛri/', 'fP', 'initial'],
  ['fail', 'pale', 4, '/feɪl/', '/peɪl/', 'fP', 'initial'],
  ['coffee', 'copy', 5, '/ˈkɒfi/', '/ˈkɒpi/', 'fP', 'medial'],
  ['leaf', 'leap', 6, '/liːf/', '/liːp/', 'fP', 'final'],
];

const vB: Row[] = [
  ['van', 'ban', 1, '/væn/', '/bæn/', 'vB', 'initial'],
  ['vest', 'best', 2, '/vɛst/', '/bɛst/', 'vB', 'initial'],
  ['vow', 'bow', 3, '/vaʊ/', '/baʊ/', 'vB', 'initial'],
  ['vase', 'base', 4, '/veɪs/', '/beɪs/', 'vB', 'initial'],
  ['dove', 'dub', 5, '/dʌv/', '/dʌb/', 'vB', 'final'],
  ['curve', 'curb', 6, '/kɜːrv/', '/kɜːrb/', 'vB', 'final'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL', 'initial'],
  ['rate', 'late', 2, '/reɪt/', '/leɪt/', 'rL', 'initial'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL', 'initial'],
  ['rice', 'lice', 2, '/raɪs/', '/laɪs/', 'rL', 'initial'],
  ['rip', 'lip', 3, '/rɪp/', '/lɪp/', 'rL', 'initial'],
  ['rake', 'lake', 4, '/reɪk/', '/leɪk/', 'rL', 'initial'],
  ['correct', 'collect', 5, '/kəˈrɛkt/', '/kəˈlɛkt/', 'rL', 'medial'],
  ['crowd', 'cloud', 6, '/kraʊd/', '/klaʊd/', 'rL', 'initial'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS', 'initial'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS', 'initial'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS', 'initial'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS', 'final'],
  ['both', 'boss', 5, '/boʊθ/', '/bɒs/', 'thetaS', 'final'],
  ['path', 'pass', 6, '/pæθ/', '/pæs/', 'thetaS', 'final'],
];

/* ---------- export category object ------------------------------- */
const korean: Category = {
  category: '한국어',
  pairs: [
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
    ...fP.map(r => make(r, 'f', 'p')),
    ...vB.map(r => make(r, 'v', 'b')),
    ...rL.map(r => make(r, 'r', 'l')),
    ...thetaS.map(r => make(r, 'θ', 's')),
  ],
};

export default korean;
