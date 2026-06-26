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
  ['pig', 'big', 1, '/pɪɡ/', '/bɪɡ/', 'pB', 'initial'],
  ['pin', 'bin', 1, '/pɪn/', '/bɪn/', 'pB', 'initial'],
  ['pan', 'ban', 2, '/pæn/', '/bæn/', 'pB', 'initial'],
  ['pet', 'bet', 2, '/pɛt/', '/bɛt/', 'pB', 'initial'],
  ['pill', 'bill', 2, '/pɪl/', '/bɪl/', 'pB', 'initial'],
  ['pear', 'bear', 3, '/pɛə/', '/bɛə/', 'pB', 'initial'],
  ['peak', 'beak', 3, '/piːk/', '/biːk/', 'pB', 'initial'],
  ['pale', 'bale', 3, '/peɪl/', '/beɪl/', 'pB', 'initial'],
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
  ['vast', 'fast', 1, '/væst/', '/fæst/', 'vF', 'initial'],
  ['veil', 'fail', 1, '/veɪl/', '/feɪl/', 'vF', 'initial'],
  ['vault', 'fault', 2, '/vɔːlt/', '/fɔːlt/', 'vF', 'initial'],
  ['view', 'few', 2, '/vjuː/', '/fjuː/', 'vF', 'initial'],
  ['very', 'ferry', 3, '/ˈvɛri/', '/ˈfɛri/', 'vF', 'initial'],
  ['veer', 'fear', 3, '/vɪər/', '/fɪər/', 'vF', 'initial'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS', 'initial'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS', 'initial'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS', 'initial'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS', 'final'],
  ['both', 'boss', 5, '/boʊθ/', '/bɒs/', 'thetaS', 'final'],
  ['path', 'pass', 6, '/pæθ/', '/pæs/', 'thetaS', 'final'],
];

const ethD: Row[] = [
  ['then', 'den', 1, '/ðɛn/', '/dɛn/', 'ethD', 'initial'],
  ['those', 'doze', 1, '/ðoʊz/', '/doʊz/', 'ethD', 'initial'],
  ['though', 'dough', 2, '/ðoʊ/', '/doʊ/', 'ethD', 'initial'],
  ['father', 'fodder', 2, '/ˈfɑːðər/', '/ˈfɑːdər/', 'ethD', 'medial'],
  ['they', 'day', 3, '/ðeɪ/', '/deɪ/', 'ethD', 'initial'],
  ['lather', 'ladder', 3, '/ˈlæðər/', '/ˈlædər/', 'ethD', 'medial'],
  ['seethe', 'seed', 3, '/siːð/', '/siːd/', 'ethD', 'final'],
  ['there', 'dare', 4, '/ðɛə/', '/dɛə/', 'ethD', 'initial'],
  ['soothe', 'sued', 4, '/suːð/', '/suːd/', 'ethD', 'final'],
  ['breathe', 'breed', 5, '/briːð/', '/briːd/', 'ethD', 'final'],
  ['loathe', 'load', 6, '/loʊð/', '/loʊd/', 'ethD', 'final'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI', 'medial'],
  ['peel', 'pill', 1, '/piːl/', '/pɪl/', 'iVsI', 'medial'],
  ['bean', 'bin', 1, '/biːn/', '/bɪn/', 'iVsI', 'medial'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI', 'medial'],
  ['feel', 'fill', 2, '/fiːl/', '/fɪl/', 'iVsI', 'medial'],
  ['reed', 'rid', 2, '/riːd/', '/rɪd/', 'iVsI', 'medial'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI', 'medial'],
  ['green', 'grin', 3, '/ɡriːn/', '/ɡrɪn/', 'iVsI', 'medial'],
  ['seal', 'sill', 3, '/siːl/', '/sɪl/', 'iVsI', 'medial'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI', 'medial'],
  ['peak', 'pick', 4, '/piːk/', '/pɪk/', 'iVsI', 'medial'],
  ['neat', 'knit', 5, '/niːt/', '/nɪt/', 'iVsI', 'medial'],
  ['heed', 'hid', 5, '/hiːd/', '/hɪd/', 'iVsI', 'medial'],
  ['peach', 'pitch', 6, '/piːtʃ/', '/pɪtʃ/', 'iVsI', 'medial'],
  ['least', 'list', 6, '/liːst/', '/lɪst/', 'iVsI', 'medial'],
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
