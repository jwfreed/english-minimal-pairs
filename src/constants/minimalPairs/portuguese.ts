// constants/minimalPairs/portuguese.ts
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
  ['thrill', 'trill', 3, '/θrɪl/', '/trɪl/', 'thetaT', 'initial'],
  ['thread', 'tread', 3, '/θrɛd/', '/trɛd/', 'thetaT', 'initial'],
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

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI', 'medial'],
  ['peel', 'pill', 1, '/piːl/', '/pɪl/', 'iVsI', 'medial'],
  ['heel', 'hill', 1, '/hiːl/', '/hɪl/', 'iVsI', 'medial'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI', 'medial'],
  ['feel', 'fill', 2, '/fiːl/', '/fɪl/', 'iVsI', 'medial'],
  ['bead', 'bid', 2, '/biːd/', '/bɪd/', 'iVsI', 'medial'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI', 'medial'],
  ['green', 'grin', 3, '/ɡriːn/', '/ɡrɪn/', 'iVsI', 'medial'],
  ['seek', 'sick', 3, '/siːk/', '/sɪk/', 'iVsI', 'medial'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI', 'medial'],
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

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE', 'medial'],
  ['man', 'men', 1, '/mæn/', '/mɛn/', 'aVsE', 'medial'],
  ['sat', 'set', 1, '/sæt/', '/sɛt/', 'aVsE', 'medial'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE', 'medial'],
  ['mass', 'mess', 2, '/mæs/', '/mɛs/', 'aVsE', 'medial'],
  ['sad', 'said', 2, '/sæd/', '/sɛd/', 'aVsE', 'medial'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE', 'medial'],
  ['land', 'lend', 3, '/lænd/', '/lɛnd/', 'aVsE', 'medial'],
  ['mat', 'met', 3, '/mæt/', '/mɛt/', 'aVsE', 'medial'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE', 'medial'],
  ['rack', 'wreck', 4, '/ræk/', '/rɛk/', 'aVsE', 'medial'],
  ['band', 'bend', 5, '/bænd/', '/bɛnd/', 'aVsE', 'medial'],
  ['bland', 'blend', 5, '/blænd/', '/blɛnd/', 'aVsE', 'medial'],
  ['ham', 'hem', 6, '/hæm/', '/hɛm/', 'aVsE', 'medial'],
  ['flash', 'flesh', 6, '/flæʃ/', '/flɛʃ/', 'aVsE', 'medial'],
];

/* ---------- export category object ----------------------------- */
const portuguese: Category = {
  category: 'Português',
  pairs: [
    ...thetaT.map(r => make(r, 'θ', 't')),
    ...ethD.map(r => make(r, 'ð', 'd')),
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
    ...uVsU.map(r => make(r, 'uː', 'ʊ')),
    ...aVsE.map(r => make(r, 'æ', 'ɛ')),
  ],
};

export default portuguese;
