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
  ['thigh', 'tie', 1, '/θaɪ/', '/taɪ/', 'thetaT', 'initial'],
  ['thorn', 'torn', 1, '/θɔːrn/', '/tɔːrn/', 'thetaT', 'initial'],
  ['thick', 'tick', 2, '/θɪk/', '/tɪk/', 'thetaT', 'initial'],
  ['thought', 'taught', 2, '/θɔːt/', '/tɔːt/', 'thetaT', 'initial'],
  ['three', 'tree', 2, '/θriː/', '/triː/', 'thetaT', 'initial'],
  ['thank', 'tank', 3, '/θæŋk/', '/tæŋk/', 'thetaT', 'initial'],
  ['thread', 'tread', 3, '/θrɛd/', '/trɛd/', 'thetaT', 'initial'],
  ['threw', 'true', 3, '/θruː/', '/truː/', 'thetaT', 'initial'],
  ['thaw', 'taw', 4, '/θɔː/', '/tɔː/', 'thetaT', 'initial'],
  ['thrash', 'trash', 4, '/θræʃ/', '/træʃ/', 'thetaT', 'initial'],
  ['math', 'mat', 5, '/mæθ/', '/mæt/', 'thetaT', 'final'],
  ['bath', 'bat', 5, '/bæθ/', '/bæt/', 'thetaT', 'final'],
  ['oath', 'oat', 6, '/oʊθ/', '/oʊt/', 'thetaT', 'final'],
  ['cloth', 'clot', 6, '/klɑːθ/', '/klɑːt/', 'thetaT', 'final'],
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

const uVsU: Row[] = [
  ['pool', 'pull', 1, '/puːl/', '/pʊl/', 'uVsU', 'medial'],
  ['suit', 'soot', 2, '/suːt/', '/sʊt/', 'uVsU', 'medial'],
  ['fool', 'full', 3, '/fuːl/', '/fʊl/', 'uVsU', 'medial'],
  ['wooed', 'wood', 3, '/wuːd/', '/wʊd/', 'uVsU', 'medial'],
  ['Luke', 'look', 4, '/luːk/', '/lʊk/', 'uVsU', 'medial'],
  ['cooed', 'could', 5, '/kuːd/', '/kʊd/', 'uVsU', 'medial'],
  ['stewed', 'stood', 6, '/stuːd/', '/stʊd/', 'uVsU', 'medial'],
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
