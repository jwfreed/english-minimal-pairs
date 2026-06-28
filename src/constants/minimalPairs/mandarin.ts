// constants/minimalPairs/mandarin.ts
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
const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS', 'initial'],
  ['thaw', 'saw', 1, '/θɔː/', '/sɔː/', 'thetaS', 'initial'],
  ['thumb', 'sum', 1, '/θʌm/', '/sʌm/', 'thetaS', 'initial'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS', 'initial'],
  ['thought', 'sought', 2, '/θɔːt/', '/sɔːt/', 'thetaS', 'initial'],
  ['thank', 'sank', 2, '/θæŋk/', '/sæŋk/', 'thetaS', 'initial'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS', 'initial'],
  ['faith', 'face', 3, '/feɪθ/', '/feɪs/', 'thetaS', 'final'],
  ['math', 'mass', 3, '/mæθ/', '/mæs/', 'thetaS', 'final'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS', 'final'],
  ['both', 'boss', 5, '/boʊθ/', '/bɒs/', 'thetaS', 'final'],
  ['path', 'pass', 6, '/pæθ/', '/pæs/', 'thetaS', 'final'],
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
  ['rock', 'lock', 1, '/rɑːk/', '/lɑːk/', 'rL', 'initial'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL', 'initial'],
  ['rate', 'late', 2, '/reɪt/', '/leɪt/', 'rL', 'initial'],
  ['rain', 'lane', 2, '/reɪn/', '/leɪn/', 'rL', 'initial'],
  ['rake', 'lake', 3, '/reɪk/', '/leɪk/', 'rL', 'initial'],
  ['rice', 'lice', 3, '/raɪs/', '/laɪs/', 'rL', 'initial'],
  ['rung', 'lung', 3, '/rʌŋ/', '/lʌŋ/', 'rL', 'initial'],
  ['rip', 'lip', 4, '/rɪp/', '/lɪp/', 'rL', 'initial'],
  ['correct', 'collect', 5, '/kəˈrɛkt/', '/kəˈlɛkt/', 'rL', 'medial'],
  ['crowd', 'cloud', 6, '/kraʊd/', '/klaʊd/', 'rL', 'initial'],
];

const iVsI: Row[] = [
  ['beat', 'bit', 1, '/biːt/', '/bɪt/', 'iVsI', 'medial'],
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI', 'medial'],
  ['bean', 'bin', 1, '/biːn/', '/bɪn/', 'iVsI', 'medial'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI', 'medial'],
  ['feel', 'fill', 2, '/fiːl/', '/fɪl/', 'iVsI', 'medial'],
  ['reed', 'rid', 2, '/riːd/', '/rɪd/', 'iVsI', 'medial'],
  ['feet', 'fit', 3, '/fiːt/', '/fɪt/', 'iVsI', 'medial'],
  ['seat', 'sit', 4, '/siːt/', '/sɪt/', 'iVsI', 'medial'],
  ['neat', 'knit', 5, '/niːt/', '/nɪt/', 'iVsI', 'medial'],
  ['peach', 'pitch', 6, '/piːtʃ/', '/pɪtʃ/', 'iVsI', 'medial'],
];

const uVsU: Row[] = [
  ['pool', 'pull', 1, '/puːl/', '/pʊl/', 'uVsU', 'medial'],
  ['suit', 'soot', 2, '/suːt/', '/sʊt/', 'uVsU', 'medial'],
  ['fool', 'full', 3, '/fuːl/', '/fʊl/', 'uVsU', 'medial'],
  ['wooed', 'wood', 3, '/wuːd/', '/wʊd/', 'uVsU', 'medial'],
  ['Luke', 'look', 4, '/luːk/', '/lʊk/', 'uVsU', 'medial'],
  ['cooed', 'could', 5, '/kuːd/', '/kʊd/', 'uVsU', 'medial'],
  ['stewed', 'stood', 6, '/stuːd/', '/stʊd/', 'uVsU', 'medial'],
];

/* ---------- export category object ------------------------------- */
const chinese: Category = {
  category: '中文',
  pairs: [
    ...thetaS.map(r => make(r, 'θ', 's')),
    ...vW.map(r => make(r, 'v', 'w')),
    ...rL.map(r => make(r, 'r', 'l')),
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
    ...uVsU.map(r => make(r, 'uː', 'ʊ')),
  ],
};

export default chinese;
