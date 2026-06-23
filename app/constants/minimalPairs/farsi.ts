// constants/minimalPairs/farsi.ts
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

const wV: Row[] = [
  ['wine', 'vine', 1, '/waɪn/', '/vaɪn/', 'wV', 'initial'],
  ['went', 'vent', 1, '/wɛnt/', '/vɛnt/', 'wV', 'initial'],
  ['wet', 'vet', 1, '/wɛt/', '/vɛt/', 'wV', 'initial'],
  ['west', 'vest', 2, '/wɛst/', '/vɛst/', 'wV', 'initial'],
  ['while', 'vile', 2, '/waɪl/', '/vaɪl/', 'wV', 'initial'],
  ['wow', 'vow', 3, '/waʊ/', '/vaʊ/', 'wV', 'initial'],
  ['wane', 'vane', 4, '/weɪn/', '/veɪn/', 'wV', 'initial'],
  ['wheel', 'veal', 5, '/wiːl/', '/viːl/', 'wV', 'initial'],
  ['wiper', 'viper', 6, '/ˈwaɪpər/', '/ˈvaɪpər/', 'wV', 'initial'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI', 'medial'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI', 'medial'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI', 'medial'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI', 'medial'],
  ['neat', 'knit', 5, '/niːt/', '/nɪt/', 'iVsI', 'medial'],
  ['peach', 'pitch', 6, '/piːtʃ/', '/pɪtʃ/', 'iVsI', 'medial'],
];

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE', 'medial'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE', 'medial'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE', 'medial'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE', 'medial'],
  ['band', 'bend', 5, '/bænd/', '/bɛnd/', 'aVsE', 'medial'],
  ['ham', 'hem', 6, '/hæm/', '/hɛm/', 'aVsE', 'medial'],
];

/* ---------- export category object ----------------------------- */
const farsi: Category = {
  category: 'فارسی',
  pairs: [
    ...thetaT.map(r => make(r, 'θ', 't')),
    ...ethD.map(r => make(r, 'ð', 'd')),
    ...wV.map(r => make(r, 'w', 'v')),
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
    ...aVsE.map(r => make(r, 'æ', 'ɛ')),
  ],
};

export default farsi;
