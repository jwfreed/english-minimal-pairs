// constants/minimalPairs/turkish.ts
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

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI', 'medial'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI', 'medial'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI', 'medial'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI', 'medial'],
  ['neat', 'knit', 5, '/niːt/', '/nɪt/', 'iVsI', 'medial'],
  ['peach', 'pitch', 6, '/piːtʃ/', '/pɪtʃ/', 'iVsI', 'medial'],
];

const uVsU: Row[] = [
  ['pool', 'pull', 1, '/puːl/', '/pʊl/', 'uVsU', 'medial'],
  ['suit', 'soot', 2, '/suːt/', '/sʊt/', 'uVsU', 'medial'],
  ['fool', 'full', 3, '/fuːl/', '/fʊl/', 'uVsU', 'medial'],
  ['Luke', 'look', 4, '/luːk/', '/lʊk/', 'uVsU', 'medial'],
  ['cooed', 'could', 5, '/kuːd/', '/kʊd/', 'uVsU', 'medial'],
  ['stewed', 'stood', 6, '/stuːd/', '/stʊd/', 'uVsU', 'medial'],
];

const aVsUh: Row[] = [
  ['cat', 'cut', 1, '/kæt/', '/kʌt/', 'aVsUh', 'medial'],
  ['batter', 'butter', 2, '/ˈbætər/', '/ˈbʌtər/', 'aVsUh', 'medial'],
  ['ran', 'run', 3, '/ræn/', '/rʌn/', 'aVsUh', 'medial'],
  ['cap', 'cup', 4, '/kæp/', '/kʌp/', 'aVsUh', 'medial'],
  ['hang', 'hung', 5, '/hæŋ/', '/hʌŋ/', 'aVsUh', 'medial'],
  ['stamp', 'stump', 6, '/stæmp/', '/stʌmp/', 'aVsUh', 'medial'],
];

/* ---------- export category object ----------------------------- */
const turkish: Category = {
  category: 'Türkçe',
  pairs: [
    ...thetaT.map(r => make(r, 'θ', 't')),
    ...ethD.map(r => make(r, 'ð', 'd')),
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
    ...uVsU.map(r => make(r, 'uː', 'ʊ')),
    ...aVsUh.map(r => make(r, 'æ', 'ʌ')),
  ],
};

export default turkish;
