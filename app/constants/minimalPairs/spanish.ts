// constants/minimalPairs/spanish.ts
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
];

const uhVsAh: Row[] = [
  ['cut', 'cot', 1, '/kʌt/', '/kɑːt/', 'uhVsAh', 'medial'],
  ['luck', 'lock', 2, '/lʌk/', '/lɑːk/', 'uhVsAh', 'medial'],
  ['cup', 'cop', 3, '/kʌp/', '/kɑːp/', 'uhVsAh', 'medial'],
  ['duck', 'dock', 4, '/dʌk/', '/dɑːk/', 'uhVsAh', 'medial'],
  ['hut', 'hot', 5, '/hʌt/', '/hɑːt/', 'uhVsAh', 'medial'],
  ['sung', 'song', 6, '/sʌŋ/', '/sɑːŋ/', 'uhVsAh', 'medial'],
];

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE', 'medial'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE', 'medial'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE', 'medial'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE', 'medial'],
  ['band', 'bend', 5, '/bænd/', '/bɛnd/', 'aVsE', 'medial'],
  ['ham', 'hem', 6, '/hæm/', '/hɛm/', 'aVsE', 'medial'],
];

const bV: Row[] = [
  ['ban', 'van', 1, '/bæn/', '/væn/', 'bV', 'initial'],
  ['berry', 'very', 2, '/ˈbɛri/', '/ˈvɛri/', 'bV', 'initial'],
  ['bow', 'vow', 3, '/baʊ/', '/vaʊ/', 'bV', 'initial'],
  ['bat', 'vat', 4, '/bæt/', '/væt/', 'bV', 'initial'],
  ['marble', 'marvel', 5, '/ˈmɑːrbəl/', '/ˈmɑːrvəl/', 'bV', 'medial'],
  ['curb', 'curve', 6, '/kɜːrb/', '/kɜːrv/', 'bV', 'final'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS', 'initial'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS', 'initial'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS', 'initial'],
  ['theme', 'seem', 4, '/θiːm/', '/siːm/', 'thetaS', 'initial'],
  ['mouth', 'mouse', 5, '/maʊθ/', '/maʊs/', 'thetaS', 'final'],
  ['path', 'pass', 6, '/pæθ/', '/pæs/', 'thetaS', 'final'],
];

/* ---------- export category object ------------------------------- */
const spanish: Category = {
  category: 'Español',
  pairs: [
    ...iVsI.map(r => make(r, 'iː', 'ɪ')),
    ...uhVsAh.map(r => make(r, 'ʌ', 'ɑː')),
    ...aVsE.map(r => make(r, 'æ', 'ɛ')),
    ...bV.map(r => make(r, 'b', 'v')),
    ...thetaS.map(r => make(r, 'θ', 's')),
  ],
};

export default spanish;
