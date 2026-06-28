// constants/minimalPairs/russian.ts
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
  ['bean', 'bin', 1, '/biːn/', '/bɪn/', 'iVsI', 'medial'],
  ['keen', 'kin', 1, '/kiːn/', '/kɪn/', 'iVsI', 'medial'],
  ['reed', 'rid', 2, '/riːd/', '/rɪd/', 'iVsI', 'medial'],
  ['deep', 'dip', 2, '/diːp/', '/dɪp/', 'iVsI', 'medial'],
  ['seal', 'sill', 3, '/siːl/', '/sɪl/', 'iVsI', 'medial'],
  ['heap', 'hip', 3, '/hiːp/', '/hɪp/', 'iVsI', 'medial'],
];

const aVsUh: Row[] = [
  ['bat', 'but', 1, '/bæt/', '/bʌt/', 'aVsUh', 'medial'],
  ['cap', 'cup', 2, '/kæp/', '/kʌp/', 'aVsUh', 'medial'],
  ['pan', 'pun', 3, '/pæn/', '/pʌn/', 'aVsUh', 'medial'],
  ['ban', 'bun', 4, '/bæn/', '/bʌn/', 'aVsUh', 'medial'],
  ['hang', 'hung', 5, '/hæŋ/', '/hʌŋ/', 'aVsUh', 'medial'],
  ['stamp', 'stump', 6, '/stæmp/', '/stʌmp/', 'aVsUh', 'medial'],
  ['cat', 'cut', 1, '/kæt/', '/kʌt/', 'aVsUh', 'medial'],
  ['hat', 'hut', 1, '/hæt/', '/hʌt/', 'aVsUh', 'medial'],
  ['bag', 'bug', 2, '/bæɡ/', '/bʌɡ/', 'aVsUh', 'medial'],
  ['mad', 'mud', 2, '/mæd/', '/mʌd/', 'aVsUh', 'medial'],
  ['match', 'much', 3, '/mætʃ/', '/mʌtʃ/', 'aVsUh', 'medial'],
  ['ran', 'run', 3, '/ræn/', '/rʌn/', 'aVsUh', 'medial'],
];

const wV: Row[] = [
  ['wine', 'vine', 1, '/waɪn/', '/vaɪn/', 'wV', 'initial'],
  ['went', 'vent', 1, '/wɛnt/', '/vɛnt/', 'wV', 'initial'],
  ['wet', 'vet', 1, '/wɛt/', '/vɛt/', 'wV', 'initial'],
  ['west', 'vest', 2, '/wɛst/', '/vɛst/', 'wV', 'initial'],
  ['while', 'vile', 2, '/waɪl/', '/vaɪl/', 'wV', 'initial'],
  ['worse', 'verse', 2, '/wɜːrs/', '/vɜːrs/', 'wV', 'initial'],
  ['wow', 'vow', 3, '/waʊ/', '/vaʊ/', 'wV', 'initial'],
  ['wail', 'veil', 3, '/weɪl/', '/veɪl/', 'wV', 'initial'],
  ['wane', 'vane', 4, '/weɪn/', '/veɪn/', 'wV', 'initial'],
  ['wheel', 'veal', 5, '/wiːl/', '/viːl/', 'wV', 'initial'],
  ['wiper', 'viper', 6, '/ˈwaɪpər/', '/ˈvaɪpər/', 'wV', 'initial'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS', 'initial'],
  ['thaw', 'saw', 1, '/θɔː/', '/sɔː/', 'thetaS', 'initial'],
  ['thumb', 'sum', 1, '/θʌm/', '/sʌm/', 'thetaS', 'initial'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS', 'initial'],
  ['thought', 'sought', 2, '/θɔːt/', '/sɔːt/', 'thetaS', 'initial'],
  ['thank', 'sank', 2, '/θæŋk/', '/sæŋk/', 'thetaS', 'initial'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS', 'initial'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS', 'final'],
  ['both', 'boss', 5, '/boʊθ/', '/bɒs/', 'thetaS', 'final'],
  ['path', 'pass', 6, '/pæθ/', '/pæs/', 'thetaS', 'final'],
];

const hZero: Row[] = [
  ['hat', 'at', 1, '/hæt/', '/æt/', 'hZero', 'initial'],
  ['hit', 'it', 1, '/hɪt/', '/ɪt/', 'hZero', 'initial'],
  ['hall', 'all', 1, '/hɔːl/', '/ɔːl/', 'hZero', 'initial'],
  ['heat', 'eat', 2, '/hiːt/', '/iːt/', 'hZero', 'initial'],
  ['hear', 'ear', 2, '/hɪr/', '/ɪr/', 'hZero', 'initial'],
  ['hold', 'old', 2, '/hoʊld/', '/oʊld/', 'hZero', 'initial'],
  ['hill', 'ill', 3, '/hɪl/', '/ɪl/', 'hZero', 'initial'],
  ['harm', 'arm', 3, '/hɑːrm/', '/ɑːrm/', 'hZero', 'initial'],
  ['her', 'err', 3, '/hɜːr/', '/ɜːr/', 'hZero', 'initial'],
  ['hair', 'air', 4, '/heə/', '/eə/', 'hZero', 'initial'],
  ['hedge', 'edge', 5, '/hɛdʒ/', '/ɛdʒ/', 'hZero', 'initial'],
  ['hand', 'and', 6, '/hænd/', '/ænd/', 'hZero', 'initial'],
];

/* ---------- export category object ------------------------------- */
const russian: Category = {
  category: 'Русский',
  pairs: [
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
    ...aVsUh.map(r => make(r, 'æ', 'ʌ')),
    ...wV.map(r => make(r, 'w', 'v')),
    ...thetaS.map(r => make(r, 'θ', 's')),
    ...hZero.map(r => make(r, 'h', '∅')),
  ],
};

export default russian;
