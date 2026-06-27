// constants/minimalPairs/cantonese.ts
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
  ['thigh', 'tie', 1, '/θaɪ/', '/taɪ/', 'thetaT', 'initial'],
  ['thorn', 'torn', 1, '/θɔːrn/', '/tɔːrn/', 'thetaT', 'initial'],
  ['thick', 'tick', 2, '/θɪk/', '/tɪk/', 'thetaT', 'initial'],
  ['thought', 'taught', 2, '/θɔːt/', '/tɔːt/', 'thetaT', 'initial'],
  ['three', 'tree', 2, '/θriː/', '/triː/', 'thetaT', 'initial'],
  ['thank', 'tank', 3, '/θæŋk/', '/tæŋk/', 'thetaT', 'initial'],
  ['thread', 'tread', 3, '/θrɛd/', '/trɛd/', 'thetaT', 'initial'],
  ['threw', 'true', 3, '/θruː/', '/truː/', 'thetaT', 'initial'],
  ['thaw', 'taw', 4, '/θɔː/', '/tɔː/', 'thetaT', 'initial'],
  ['math', 'mat', 5, '/mæθ/', '/mæt/', 'thetaT', 'final'],
  ['oath', 'oat', 6, '/oʊθ/', '/oʊt/', 'thetaT', 'final'],
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

const vW: Row[] = [
  ['vine', 'wine', 1, '/vaɪn/', '/waɪn/', 'vW', 'initial'],
  ['vent', 'went', 1, '/vɛnt/', '/wɛnt/', 'vW', 'initial'],
  ['vet', 'wet', 1, '/vɛt/', '/wɛt/', 'vW', 'initial'],
  ['vest', 'west', 2, '/vɛst/', '/wɛst/', 'vW', 'initial'],
  ['vile', 'while', 2, '/vaɪl/', '/waɪl/', 'vW', 'initial'],
  ['verse', 'worse', 2, '/vɜːrs/', '/wɜːrs/', 'vW', 'initial'],
  ['vow', 'wow', 3, '/vaʊ/', '/waʊ/', 'vW', 'initial'],
  ['veil', 'wail', 3, '/veɪl/', '/weɪl/', 'vW', 'initial'],
  ['vane', 'wane', 4, '/veɪn/', '/weɪn/', 'vW', 'initial'],
  ['veal', 'wheel', 5, '/viːl/', '/wiːl/', 'vW', 'initial'],
  ['viper', 'wiper', 6, '/ˈvaɪpər/', '/ˈwaɪpər/', 'vW', 'initial'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL', 'initial'],
  ['red', 'led', 1, '/rɛd/', '/lɛd/', 'rL', 'initial'],
  ['row', 'low', 1, '/roʊ/', '/loʊ/', 'rL', 'initial'],
  ['rate', 'late', 2, '/reɪt/', '/leɪt/', 'rL', 'initial'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL', 'initial'],
  ['rice', 'lice', 2, '/raɪs/', '/laɪs/', 'rL', 'initial'],
  ['rip', 'lip', 3, '/rɪp/', '/lɪp/', 'rL', 'initial'],
  ['rain', 'lane', 3, '/reɪn/', '/leɪn/', 'rL', 'initial'],
  ['read', 'lead', 3, '/riːd/', '/liːd/', 'rL', 'initial'],
  ['rake', 'lake', 4, '/reɪk/', '/leɪk/', 'rL', 'initial'],
  ['rung', 'lung', 4, '/rʌŋ/', '/lʌŋ/', 'rL', 'initial'],
  ['correct', 'collect', 5, '/kəˈrɛkt/', '/kəˈlɛkt/', 'rL', 'medial'],
  ['ride', 'lied', 5, '/raɪd/', '/laɪd/', 'rL', 'initial'],
  ['crowd', 'cloud', 6, '/kraʊd/', '/klaʊd/', 'rL', 'initial'],
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
const cantonese: Category = {
  category: '廣東話',
  pairs: [
    ...thetaT.map(r => make(r, 'θ', 't')),
    ...ethD.map(r => make(r, 'ð', 'd')),
    ...vW.map(r => make(r, 'v', 'w')),
    ...rL.map(r => make(r, 'r', 'l')),
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
  ],
};

export default cantonese;
