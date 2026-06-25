// constants/minimalPairs/vietnamese.ts
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
  ['thigh', 'tie', 1, '/θaɪ/', '/taɪ/', 'thetaT', 'initial'],
  ['thorn', 'torn', 1, '/θɔːrn/', '/tɔːrn/', 'thetaT', 'initial'],
  ['thought', 'taught', 2, '/θɔːt/', '/tɔːt/', 'thetaT', 'initial'],
  ['three', 'tree', 2, '/θriː/', '/triː/', 'thetaT', 'initial'],
  ['thread', 'tread', 3, '/θrɛd/', '/trɛd/', 'thetaT', 'initial'],
  ['threw', 'true', 3, '/θruː/', '/truː/', 'thetaT', 'initial'],
];

const ethD: Row[] = [
  ['then', 'den', 1, '/ðɛn/', '/dɛn/', 'ethD', 'initial'],
  ['though', 'dough', 2, '/ðoʊ/', '/doʊ/', 'ethD', 'initial'],
  ['they', 'day', 3, '/ðeɪ/', '/deɪ/', 'ethD', 'initial'],
  ['there', 'dare', 4, '/ðɛə/', '/dɛə/', 'ethD', 'initial'],
  ['breathe', 'breed', 5, '/briːð/', '/briːd/', 'ethD', 'final'],
  ['loathe', 'load', 6, '/loʊð/', '/loʊd/', 'ethD', 'final'],
  ['those', 'doze', 1, '/ðoʊz/', '/doʊz/', 'ethD', 'initial'],
  ['father', 'fodder', 2, '/ˈfɑːðər/', '/ˈfɑːdər/', 'ethD', 'medial'],
  ['lather', 'ladder', 3, '/ˈlæðər/', '/ˈlædər/', 'ethD', 'medial'],
  ['seethe', 'seed', 3, '/siːð/', '/siːd/', 'ethD', 'final'],
];

const zS: Row[] = [
  ['zip', 'sip', 1, '/zɪp/', '/sɪp/', 'zS', 'initial'],
  ['zeal', 'seal', 2, '/ziːl/', '/siːl/', 'zS', 'initial'],
  ['zone', 'sewn', 3, '/zoʊn/', '/soʊn/', 'zS', 'initial'],
  ['zoo', 'sue', 4, '/zuː/', '/suː/', 'zS', 'initial'],
  ['buzz', 'bus', 5, '/bʌz/', '/bʌs/', 'zS', 'final'],
  ['lies', 'lice', 6, '/laɪz/', '/laɪs/', 'zS', 'final'],
  ['zap', 'sap', 1, '/zæp/', '/sæp/', 'zS', 'initial'],
  ['zinc', 'sink', 1, '/zɪŋk/', '/sɪŋk/', 'zS', 'initial'],
  ['rise', 'rice', 2, '/raɪz/', '/raɪs/', 'zS', 'final'],
  ['maze', 'mace', 2, '/meɪz/', '/meɪs/', 'zS', 'final'],
  ['phase', 'face', 3, '/feɪz/', '/feɪs/', 'zS', 'final'],
  ['prize', 'price', 3, '/praɪz/', '/praɪs/', 'zS', 'final'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL', 'initial'],
  ['red', 'led', 1, '/rɛd/', '/lɛd/', 'rL', 'initial'],
  ['row', 'low', 1, '/roʊ/', '/loʊ/', 'rL', 'initial'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL', 'initial'],
  ['rain', 'lane', 2, '/reɪn/', '/leɪn/', 'rL', 'initial'],
  ['read', 'lead', 2, '/riːd/', '/liːd/', 'rL', 'initial'],
  ['rip', 'lip', 3, '/rɪp/', '/lɪp/', 'rL', 'initial'],
  ['rung', 'lung', 3, '/rʌŋ/', '/lʌŋ/', 'rL', 'initial'],
  ['ride', 'lied', 3, '/raɪd/', '/laɪd/', 'rL', 'initial'],
  ['rake', 'lake', 4, '/reɪk/', '/leɪk/', 'rL', 'initial'],
  ['correct', 'collect', 5, '/kəˈrɛkt/', '/kəˈlɛkt/', 'rL', 'medial'],
  ['crowd', 'cloud', 6, '/kraʊd/', '/klaʊd/', 'rL', 'initial'],
];

const aVsUh: Row[] = [
  ['cat', 'cut', 1, '/kæt/', '/kʌt/', 'aVsUh', 'medial'],
  ['batter', 'butter', 2, '/ˈbætər/', '/ˈbʌtər/', 'aVsUh', 'medial'],
  ['ran', 'run', 3, '/ræn/', '/rʌn/', 'aVsUh', 'medial'],
  ['cap', 'cup', 4, '/kæp/', '/kʌp/', 'aVsUh', 'medial'],
  ['hang', 'hung', 5, '/hæŋ/', '/hʌŋ/', 'aVsUh', 'medial'],
  ['stamp', 'stump', 6, '/stæmp/', '/stʌmp/', 'aVsUh', 'medial'],
  ['bat', 'but', 1, '/bæt/', '/bʌt/', 'aVsUh', 'medial'],
  ['hat', 'hut', 1, '/hæt/', '/hʌt/', 'aVsUh', 'medial'],
  ['bag', 'bug', 2, '/bæɡ/', '/bʌɡ/', 'aVsUh', 'medial'],
  ['mad', 'mud', 2, '/mæd/', '/mʌd/', 'aVsUh', 'medial'],
  ['pan', 'pun', 3, '/pæn/', '/pʌn/', 'aVsUh', 'medial'],
  ['match', 'much', 3, '/mætʃ/', '/mʌtʃ/', 'aVsUh', 'medial'],
];

/* ---------- export category object ----------------------------- */
const vietnamese: Category = {
  category: 'Tiếng Việt',
  pairs: [
    ...thetaT.map(r => make(r, 'θ', 't')),
    ...ethD.map(r => make(r, 'ð', 'd')),
    ...zS.map(r => make(r, 'z', 's')),
    ...rL.map(r => make(r, 'r', 'l')),
    ...aVsUh.map(r => make(r, 'æ', 'ʌ')),
  ],
};

export default vietnamese;
