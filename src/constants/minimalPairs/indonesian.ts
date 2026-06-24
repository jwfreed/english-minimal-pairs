// constants/minimalPairs/indonesian.ts
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

/* ---------- word-lists with group IDs --------------------------- */
const thetaT: Row[] = [
  ['thin', 'tin', 1, '/θɪn/', '/tɪn/', 'thetaT', 'initial'],
  ['thick', 'tick', 2, '/θɪk/', '/tɪk/', 'thetaT', 'initial'],
  ['thank', 'tank', 3, '/θæŋk/', '/tæŋk/', 'thetaT', 'initial'],
  ['thaw', 'taw', 4, '/θɔː/', '/tɔː/', 'thetaT', 'initial'],
  ['math', 'mat', 5, '/mæθ/', '/mæt/', 'thetaT', 'final'],
  ['oath', 'oat', 6, '/oʊθ/', '/oʊt/', 'thetaT', 'final'],
];

const ethD: Row[] = [
  ['then', 'den', 1, '/ðɛn/', '/dɛn/', 'ethD', 'initial'],
  ['though', 'dough', 2, '/ðoʊ/', '/doʊ/', 'ethD', 'initial'],
  ['they', 'day', 3, '/ðeɪ/', '/deɪ/', 'ethD', 'initial'],
  ['there', 'dare', 4, '/ðɛə/', '/dɛə/', 'ethD', 'initial'],
  ['breathe', 'breed', 5, '/briːð/', '/briːd/', 'ethD', 'final'],
  ['loathe', 'load', 6, '/loʊð/', '/loʊd/', 'ethD', 'final'],
];

const vF: Row[] = [
  ['vine', 'fine', 1, '/vaɪn/', '/faɪn/', 'vF', 'initial'],
  ['vast', 'fast', 1, '/væst/', '/fæst/', 'vF', 'initial'],
  ['veil', 'fail', 1, '/veɪl/', '/feɪl/', 'vF', 'initial'],
  ['vat', 'fat', 2, '/væt/', '/fæt/', 'vF', 'initial'],
  ['vault', 'fault', 2, '/vɔːlt/', '/fɔːlt/', 'vF', 'initial'],
  ['view', 'few', 2, '/vjuː/', '/fjuː/', 'vF', 'initial'],
  ['van', 'fan', 3, '/væn/', '/fæn/', 'vF', 'initial'],
  ['very', 'ferry', 3, '/ˈvɛri/', '/ˈfɛri/', 'vF', 'initial'],
  ['veer', 'fear', 3, '/vɪər/', '/fɪər/', 'vF', 'initial'],
  ['vase', 'face', 4, '/veɪs/', '/feɪs/', 'vF', 'initial'],
  ['save', 'safe', 5, '/seɪv/', '/seɪf/', 'vF', 'final'],
  ['leave', 'leaf', 6, '/liːv/', '/liːf/', 'vF', 'final'],
];

const aVsUh: Row[] = [
  ['cat', 'cut', 1, '/kæt/', '/kʌt/', 'aVsUh', 'medial'],
  ['batter', 'butter', 2, '/ˈbætər/', '/ˈbʌtər/', 'aVsUh', 'medial'],
  ['ran', 'run', 3, '/ræn/', '/rʌn/', 'aVsUh', 'medial'],
  ['cap', 'cup', 4, '/kæp/', '/kʌp/', 'aVsUh', 'medial'],
  ['hang', 'hung', 5, '/hæŋ/', '/hʌŋ/', 'aVsUh', 'medial'],
  ['stamp', 'stump', 6, '/stæmp/', '/stʌmp/', 'aVsUh', 'medial'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI', 'medial'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI', 'medial'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI', 'medial'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI', 'medial'],
  ['neat', 'knit', 5, '/niːt/', '/nɪt/', 'iVsI', 'medial'],
  ['peach', 'pitch', 6, '/piːtʃ/', '/pɪtʃ/', 'iVsI', 'medial'],
];

/* ---------- export category object ----------------------------- */
const indonesian: Category = {
  category: 'Bahasa Indonesia',
  pairs: [
    ...thetaT.map(r => make(r, 'θ', 't')),
    ...ethD.map(r => make(r, 'ð', 'd')),
    ...vF.map(r => make(r, 'v', 'f')),
    ...aVsUh.map(r => make(r, 'æ', 'ʌ')),
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
  ],
};

export default indonesian;
