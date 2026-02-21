// constants/minimalPairs/arabic.ts
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
const pB: Row[] = [
  ['pat', 'bat', 1, '/pæt/', '/bæt/', 'pB', 'initial'],
  ['pan', 'ban', 2, '/pæn/', '/bæn/', 'pB', 'initial'],
  ['pear', 'bear', 3, '/pɛə/', '/bɛə/', 'pB', 'initial'],
  ['pack', 'back', 4, '/pæk/', '/bæk/', 'pB', 'initial'],
  ['rapid', 'rabid', 5, '/ˈræpɪd/', '/ˈræbɪd/', 'pB', 'medial'],
  ['cap', 'cab', 6, '/kæp/', '/kæb/', 'pB', 'final'],
];

const vF: Row[] = [
  ['vine', 'fine', 1, '/vaɪn/', '/faɪn/', 'vF', 'initial'],
  ['vat', 'fat', 2, '/væt/', '/fæt/', 'vF', 'initial'],
  ['van', 'fan', 3, '/væn/', '/fæn/', 'vF', 'initial'],
  ['vase', 'face', 4, '/veɪs/', '/feɪs/', 'vF', 'initial'],
  ['save', 'safe', 5, '/seɪv/', '/seɪf/', 'vF', 'final'],
  ['leave', 'leaf', 6, '/liːv/', '/liːf/', 'vF', 'final'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS', 'initial'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS', 'initial'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS', 'initial'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS', 'final'],
  ['mouth', 'mouse', 5, '/maʊθ/', '/maʊs/', 'thetaS', 'final'],
  ['path', 'pass', 6, '/pæθ/', '/pæs/', 'thetaS', 'final'],
];

const ethD: Row[] = [
  ['then', 'den', 1, '/ðɛn/', '/dɛn/', 'ethD', 'initial'],
  ['though', 'dough', 2, '/ðoʊ/', '/doʊ/', 'ethD', 'initial'],
  ['they', 'day', 3, '/ðeɪ/', '/deɪ/', 'ethD', 'initial'],
  ['there', 'dare', 4, '/ðɛə/', '/dɛə/', 'ethD', 'initial'],
  ['breathe', 'breed', 5, '/briːð/', '/briːd/', 'ethD', 'final'],
  ['loathe', 'load', 6, '/loʊð/', '/loʊd/', 'ethD', 'final'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI', 'medial'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI', 'medial'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI', 'medial'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI', 'medial'],
  ['neat', 'knit', 5, '/niːt/', '/nɪt/', 'iVsI', 'medial'],
  ['peach', 'pitch', 6, '/piːtʃ/', '/pɪtʃ/', 'iVsI', 'medial'],
];

/* ---------- export category object ------------------------------- */
const arabic: Category = {
  category: 'العربية',
  pairs: [
    ...pB.map(r => make(r, 'p', 'b')),
    ...vF.map(r => make(r, 'v', 'f')),
    ...thetaS.map(r => make(r, 'θ', 's')),
    ...ethD.map(r => make(r, 'ð', 'd')),
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
  ],
};

export default arabic;
