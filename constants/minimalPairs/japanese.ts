// constants/minimalPairs/japanese.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple:  [word1, word2, difficulty, ipa1, ipa2, groupID]
 *  `group` ties all tiers of the SAME contrast together
 *  so /r-l/ rows share 'rL', /b-v/ share 'bV', etc.
 * ----------------------------------------------------------------- */
type Row = [string, string, Difficulty, string, string, string];

/* helper: tuple → Pair object */
const make = ([w1, w2, diff, ipa1, ipa2, group]: Row) => ({
  word1: w1,
  word2: w2,
  ipa1,
  ipa2,
  difficulty: diff,
  group, // ← new field
  audio1: audio[w1],
  audio2: audio[w2],
});

/* ---------- static require map (unchanged) ---------------------- */
const audio: Record<string, any> = {
  rake: require('../../assets/audio/rake.mp3'),
  lake: require('../../assets/audio/lake.mp3'),
  rate: require('../../assets/audio/rate.mp3'),
  late: require('../../assets/audio/late.mp3'),
  rag: require('../../assets/audio/rag.mp3'),
  lag: require('../../assets/audio/lag.mp3'),
  pray: require('../../assets/audio/pray.mp3'),
  play: require('../../assets/audio/play.mp3'),
  road: require('../../assets/audio/road.mp3'),
  load: require('../../assets/audio/load.mp3'),
  fry: require('../../assets/audio/fry.mp3'),
  fly: require('../../assets/audio/fly.mp3'),
  ban: require('../../assets/audio/ban.mp3'),
  van: require('../../assets/audio/van.mp3'),
  berry: require('../../assets/audio/berry.mp3'),
  very: require('../../assets/audio/very.mp3'),
  bow: require('../../assets/audio/bow.mp3'),
  vow: require('../../assets/audio/vow.mp3'),
  ball: require('../../assets/audio/ball.mp3'),
  wall: require('../../assets/audio/wall.mp3'),
  sink: require('../../assets/audio/sink.mp3'),
  think: require('../../assets/audio/think.mp3'),
  sip: require('../../assets/audio/sip.mp3'),
  thick: require('../../assets/audio/thick.mp3'),
  mass: require('../../assets/audio/mass.mp3'),
  math: require('../../assets/audio/math.mp3'),
  seal: require('../../assets/audio/seal.mp3'),
  theel: require('../../assets/audio/theel.mp3'),
  cat: require('../../assets/audio/cat.mp3'),
  cut: require('../../assets/audio/cut.mp3'),
  batter: require('../../assets/audio/batter.mp3'),
  butter: require('../../assets/audio/butter.mp3'),
  ran: require('../../assets/audio/ran.mp3'),
  run: require('../../assets/audio/run.mp3'),
  cash: require('../../assets/audio/cash.mp3'),
  cush: require('../../assets/audio/cush.mp3'),
  sheep: require('../../assets/audio/sheep.mp3'),
  ship: require('../../assets/audio/ship.mp3'),
  leave: require('../../assets/audio/leave.mp3'),
  live: require('../../assets/audio/live.mp3'),
  beat: require('../../assets/audio/beat.mp3'),
  bit: require('../../assets/audio/bit.mp3'),
  feet: require('../../assets/audio/feet.mp3'),
  fit: require('../../assets/audio/fit.mp3'),
};

/* ---------- word-lists with group IDs --------------------------- */
const rL: Row[] = [
  ['rake', 'lake', 1, '/reɪk/', '/leɪk/', 'rL'],
  ['rate', 'late', 2, '/reɪt/', '/leɪt/', 'rL'],
  ['rag', 'lag', 3, '/ræɡ/', '/læɡ/', 'rL'],
  ['pray', 'play', 4, '/preɪ/', '/pleɪ/', 'rL'],
];

const bV: Row[] = [
  ['ban', 'van', 1, '/bæn/', '/væn/', 'bV'],
  ['berry', 'very', 2, '/ˈbɛri/', '/ˈvɛri/', 'bV'],
  ['bow', 'vow', 3, '/baʊ/', '/vaʊ/', 'bV'],
  ['ball', 'wall', 4, '/bɔːl/', '/wɔːl/', 'bV'],
];

const sTheta: Row[] = [
  ['sink', 'think', 1, '/sɪŋk/', '/θɪŋk/', 'sTheta'],
  ['sip', 'thick', 2, '/sɪp/', '/θɪk/', 'sTheta'],
  ['mass', 'math', 3, '/mæs/', '/mæθ/', 'sTheta'],
  ['seal', 'theel', 4, '/siːl/', '/θiːl/', 'sTheta'],
];

const aVsUh: Row[] = [
  ['cat', 'cut', 1, '/kæt/', '/kʌt/', 'aVsUh'],
  ['batter', 'butter', 2, '/ˈbætər/', '/ˈbʌtər/', 'aVsUh'],
  ['ran', 'run', 3, '/ræn/', '/rʌn/', 'aVsUh'],
  ['cash', 'cush', 4, '/kæʃ/', '/kʊʃ/', 'aVsUh'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

/* ---------- export category object ----------------------------- */
const japanese: Category = {
  category: '日本語',
  pairs: [
    ...rL.map(make),
    ...bV.map(make),
    ...sTheta.map(make),
    ...aVsUh.map(make),
    ...iVsI.map(make),
  ],
};

export default japanese;
