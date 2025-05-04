// constants/minimalPairs/spanish.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
 *  Each `group` represents the SAME phonemic contrast across tiers.
 * ----------------------------------------------------------------- */
type Row = [string, string, Difficulty, string, string, string];

const make = ([w1, w2, diff, ipa1, ipa2, group]: Row) => ({
  word1: w1,
  word2: w2,
  ipa1,
  ipa2,
  difficulty: diff,
  group,
  audio1: audio[w1],
  audio2: audio[w2],
});

/* ---------- static require map ----------------------------------- */
const audio: Record<string, any> = {
  // iː ~ ɪ
  sheep: require('../../assets/audio/sheep.mp3'),
  ship: require('../../assets/audio/ship.mp3'),
  leave: require('../../assets/audio/leave.mp3'),
  live: require('../../assets/audio/live.mp3'),
  beat: require('../../assets/audio/beat.mp3'),
  bit: require('../../assets/audio/bit.mp3'),
  feet: require('../../assets/audio/feet.mp3'),
  fit: require('../../assets/audio/fit.mp3'),

  // ʌ ~ ɑː
  cut: require('../../assets/audio/cut.mp3'),
  cot: require('../../assets/audio/cot.mp3'),
  luck: require('../../assets/audio/luck.mp3'),
  lock: require('../../assets/audio/lock.mp3'),
  cup: require('../../assets/audio/cup.mp3'),
  cop: require('../../assets/audio/cop.mp3'),
  duck: require('../../assets/audio/duck.mp3'),
  dock: require('../../assets/audio/dock.mp3'),

  // æ ~ ɛ
  bad: require('../../assets/audio/bad.mp3'),
  bed: require('../../assets/audio/bed.mp3'),
  pan: require('../../assets/audio/pan.mp3'),
  pen: require('../../assets/audio/pen.mp3'),
  dad: require('../../assets/audio/dad.mp3'),
  dead: require('../../assets/audio/dead.mp3'),
  bat: require('../../assets/audio/bat.mp3'),
  bet: require('../../assets/audio/bet.mp3'),

  // b ~ v
  ban: require('../../assets/audio/ban.mp3'),
  van: require('../../assets/audio/van.mp3'),
  berry: require('../../assets/audio/berry.mp3'),
  very: require('../../assets/audio/very.mp3'),
  bow: require('../../assets/audio/bow.mp3'),
  vow: require('../../assets/audio/vow.mp3'),
  ball: require('../../assets/audio/ball.mp3'),
  wall: require('../../assets/audio/wall.mp3'),

  // θ ~ s
  thin: require('../../assets/audio/thin.mp3'),
  sin: require('../../assets/audio/sin.mp3'),
  thick: require('../../assets/audio/thick.mp3'),
  sick: require('../../assets/audio/sick.mp3'),
  think: require('../../assets/audio/think.mp3'),
  sink: require('../../assets/audio/sink.mp3'),
  theme: require('../../assets/audio/theme.mp3'),
  seem: require('../../assets/audio/seem.mp3'),
};

/* ---------- word lists ------------------------------------------- */
const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const uhVsAh: Row[] = [
  ['cut', 'cot', 1, '/kʌt/', '/kɑːt/', 'uhVsAh'],
  ['luck', 'lock', 2, '/lʌk/', '/lɑːk/', 'uhVsAh'],
  ['cup', 'cop', 3, '/kʌp/', '/kɑːp/', 'uhVsAh'],
  ['duck', 'dock', 4, '/dʌk/', '/dɑːk/', 'uhVsAh'],
];

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE'],
];

const bV: Row[] = [
  ['ban', 'van', 1, '/bæn/', '/væn/', 'bV'],
  ['berry', 'very', 2, '/ˈbɛri/', '/ˈvɛri/', 'bV'],
  ['bow', 'vow', 3, '/baʊ/', '/vaʊ/', 'bV'],
  ['ball', 'wall', 4, '/bɔːl/', '/wɔːl/', 'bV'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['theme', 'seem', 4, '/θiːm/', '/siːm/', 'thetaS'],
];

/* ---------- export ------------------------------------------------ */
const spanish: Category = {
  category: 'español',
  pairs: [
    ...iVsI.map(make),
    ...uhVsAh.map(make),
    ...aVsE.map(make),
    ...bV.map(make),
    ...thetaS.map(make),
  ],
};

export default spanish;
