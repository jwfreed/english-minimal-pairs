// constants/minimalPairs/japanese.ts
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
const rL: Row[] = [
  ['rake', 'lake', 1, '/reɪk/', '/leɪk/', 'rL', 'initial'],
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL', 'initial'],
  ['red', 'led', 1, '/rɛd/', '/lɛd/', 'rL', 'initial'],
  ['rate', 'late', 2, '/reɪt/', '/leɪt/', 'rL', 'initial'],
  ['rice', 'lice', 2, '/raɪs/', '/laɪs/', 'rL', 'initial'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL', 'initial'],
  ['rag', 'lag', 3, '/ræɡ/', '/læɡ/', 'rL', 'initial'],
  ['rip', 'lip', 3, '/rɪp/', '/lɪp/', 'rL', 'initial'],
  ['rain', 'lane', 3, '/reɪn/', '/leɪn/', 'rL', 'initial'],
  ['pray', 'play', 4, '/preɪ/', '/pleɪ/', 'rL', 'initial'],
  ['correct', 'collect', 5, '/kəˈrɛkt/', '/kəˈlɛkt/', 'rL', 'medial'],
  ['crowd', 'cloud', 6, '/kraʊd/', '/klaʊd/', 'rL', 'initial'],
];

const bV: Row[] = [
  ['ban', 'van', 1, '/bæn/', '/væn/', 'bV', 'initial'],
  ['bet', 'vet', 1, '/bɛt/', '/vɛt/', 'bV', 'initial'],
  ['best', 'vest', 1, '/bɛst/', '/vɛst/', 'bV', 'initial'],
  ['berry', 'very', 2, '/ˈbɛri/', '/ˈvɛri/', 'bV', 'initial'],
  ['boat', 'vote', 2, '/boʊt/', '/voʊt/', 'bV', 'initial'],
  ['bail', 'veil', 2, '/beɪl/', '/veɪl/', 'bV', 'initial'],
  ['bow', 'vow', 3, '/baʊ/', '/vaʊ/', 'bV', 'initial'],
  ['bat', 'vat', 4, '/bæt/', '/væt/', 'bV', 'initial'],
  ['marble', 'marvel', 5, '/ˈmɑːrbəl/', '/ˈmɑːrvəl/', 'bV', 'medial'],
  ['curb', 'curve', 6, '/kɜːrb/', '/kɜːrv/', 'bV', 'final'],
];

const sTheta: Row[] = [
  ['sink', 'think', 1, '/sɪŋk/', '/θɪŋk/', 'sTheta', 'initial'],
  ['saw', 'thaw', 1, '/sɔː/', '/θɔː/', 'sTheta', 'initial'],
  ['sum', 'thumb', 1, '/sʌm/', '/θʌm/', 'sTheta', 'initial'],
  ['sick', 'thick', 2, '/sɪk/', '/θɪk/', 'sTheta', 'initial'],
  ['sought', 'thought', 2, '/sɔːt/', '/θɔːt/', 'sTheta', 'initial'],
  ['sank', 'thank', 2, '/sæŋk/', '/θæŋk/', 'sTheta', 'initial'],
  ['mass', 'math', 3, '/mæs/', '/mæθ/', 'sTheta', 'final'],
  ['sigh', 'thigh', 4, '/saɪ/', '/θaɪ/', 'sTheta', 'initial'],
  ['moss', 'moth', 5, '/mɒs/', '/mɒθ/', 'sTheta', 'final'],
  ['face', 'faith', 6, '/feɪs/', '/feɪθ/', 'sTheta', 'final'],
];

const aVsUh: Row[] = [
  ['cat', 'cut', 1, '/kæt/', '/kʌt/', 'aVsUh', 'medial'],
  ['bat', 'but', 1, '/bæt/', '/bʌt/', 'aVsUh', 'medial'],
  ['hat', 'hut', 1, '/hæt/', '/hʌt/', 'aVsUh', 'medial'],
  ['batter', 'butter', 2, '/ˈbætər/', '/ˈbʌtər/', 'aVsUh', 'medial'],
  ['bag', 'bug', 2, '/bæɡ/', '/bʌɡ/', 'aVsUh', 'medial'],
  ['mad', 'mud', 2, '/mæd/', '/mʌd/', 'aVsUh', 'medial'],
  ['ran', 'run', 3, '/ræn/', '/rʌn/', 'aVsUh', 'medial'],
  ['pan', 'pun', 3, '/pæn/', '/pʌn/', 'aVsUh', 'medial'],
  ['match', 'much', 3, '/mætʃ/', '/mʌtʃ/', 'aVsUh', 'medial'],
  ['cap', 'cup', 4, '/kæp/', '/kʌp/', 'aVsUh', 'medial'],
  ['hang', 'hung', 5, '/hæŋ/', '/hʌŋ/', 'aVsUh', 'medial'],
  ['stamp', 'stump', 6, '/stæmp/', '/stʌmp/', 'aVsUh', 'medial'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI', 'medial'],
  ['peel', 'pill', 1, '/piːl/', '/pɪl/', 'iVsI', 'medial'],
  ['bean', 'bin', 1, '/biːn/', '/bɪn/', 'iVsI', 'medial'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI', 'medial'],
  ['feel', 'fill', 2, '/fiːl/', '/fɪl/', 'iVsI', 'medial'],
  ['reed', 'rid', 2, '/riːd/', '/rɪd/', 'iVsI', 'medial'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI', 'medial'],
  ['seal', 'sill', 3, '/siːl/', '/sɪl/', 'iVsI', 'medial'],
  ['heap', 'hip', 3, '/hiːp/', '/hɪp/', 'iVsI', 'medial'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI', 'medial'],
  ['neat', 'knit', 5, '/niːt/', '/nɪt/', 'iVsI', 'medial'],
  ['peach', 'pitch', 6, '/piːtʃ/', '/pɪtʃ/', 'iVsI', 'medial'],
];

/* ---------- export category object ----------------------------- */
const japanese: Category = {
  category: '日本語',
  pairs: [
    ...rL.map(r => make(r, 'r', 'l')),
    ...bV.map(r => make(r, 'b', 'v')),
    ...sTheta.map(r => make(r, 's', 'θ')),
    ...aVsUh.map(r => make(r, 'æ', 'ʌ')),
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
  ],
};

export default japanese;
