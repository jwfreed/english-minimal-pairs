// constants/minimalPairs/hindu_urdu.ts
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

const wV: Row[] = [
  ['wine', 'vine', 1, '/waɪn/', '/vaɪn/', 'wV', 'initial'],
  ['west', 'vest', 2, '/wɛst/', '/vɛst/', 'wV', 'initial'],
  ['wow', 'vow', 3, '/waʊ/', '/vaʊ/', 'wV', 'initial'],
  ['wane', 'vane', 4, '/weɪn/', '/veɪn/', 'wV', 'initial'],
  ['wheel', 'veal', 5, '/wiːl/', '/viːl/', 'wV', 'initial'],
  ['wiper', 'viper', 6, '/ˈwaɪpər/', '/ˈvaɪpər/', 'wV', 'initial'],
];

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE', 'medial'],
  ['bag', 'beg', 1, '/bæɡ/', '/bɛɡ/', 'aVsE', 'medial'],
  ['man', 'men', 1, '/mæn/', '/mɛn/', 'aVsE', 'medial'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE', 'medial'],
  ['gas', 'guess', 2, '/ɡæs/', '/ɡɛs/', 'aVsE', 'medial'],
  ['sad', 'said', 2, '/sæd/', '/sɛd/', 'aVsE', 'medial'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE', 'medial'],
  ['land', 'lend', 3, '/lænd/', '/lɛnd/', 'aVsE', 'medial'],
  ['mat', 'met', 3, '/mæt/', '/mɛt/', 'aVsE', 'medial'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE', 'medial'],
  ['band', 'bend', 5, '/bænd/', '/bɛnd/', 'aVsE', 'medial'],
  ['ham', 'hem', 6, '/hæm/', '/hɛm/', 'aVsE', 'medial'],
];

/* ---------- export category object ----------------------------- */
const hinduUrdu: Category = {
  category: 'हिन्दी / اردو',
  pairs: [
    ...thetaT.map(r => make(r, 'θ', 't')),
    ...ethD.map(r => make(r, 'ð', 'd')),
    ...zS.map(r => make(r, 'z', 's')),
    ...wV.map(r => make(r, 'w', 'v')),
    ...aVsE.map(r => make(r, 'æ', 'ɛ')),
  ],
};

export default hinduUrdu;
