// constants/minimalPairs/chinese.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple:  [word1, word2, difficulty, ipa1, ipa2, groupID]
 *  `group` ties all tiers of the SAME contrast together so that all
 *  /θ–s/ rows share 'thetaS', /v–w/ share 'vW', etc.
 * ----------------------------------------------------------------- */
type Row = [string, string, Difficulty, string, string, string];

/* helper: tuple → Pair object */
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
  // θ ~ s
  thin: require('../../assets/audio/thin.mp3'),
  sin: require('../../assets/audio/sin.mp3'),
  thick: require('../../assets/audio/thick.mp3'),
  sick: require('../../assets/audio/sick.mp3'),
  think: require('../../assets/audio/think.mp3'),
  sink: require('../../assets/audio/sink.mp3'),
  mouth: require('../../assets/audio/mouth.mp3'),
  mouse: require('../../assets/audio/mouse.mp3'),

  // v ~ w
  vine: require('../../assets/audio/vine.mp3'),
  wine: require('../../assets/audio/wine.mp3'),
  vest: require('../../assets/audio/vest.mp3'),
  west: require('../../assets/audio/west.mp3'),
  vow: require('../../assets/audio/vow.mp3'),
  wow: require('../../assets/audio/wow.mp3'),
  vane: require('../../assets/audio/vane.mp3'),
  wane: require('../../assets/audio/wane.mp3'),

  // r ~ l
  right: require('../../assets/audio/right.mp3'),
  light: require('../../assets/audio/light.mp3'),
  road: require('../../assets/audio/road.mp3'),
  load: require('../../assets/audio/load.mp3'),
  rake: require('../../assets/audio/rake.mp3'),
  lake: require('../../assets/audio/lake.mp3'),
  rip: require('../../assets/audio/rip.mp3'),
  lip: require('../../assets/audio/lip.mp3'),

  // iː ~ ɪ
  beat: require('../../assets/audio/beat.mp3'),
  bit: require('../../assets/audio/bit.mp3'),
  leave: require('../../assets/audio/leave.mp3'),
  live: require('../../assets/audio/live.mp3'),
  feet: require('../../assets/audio/feet.mp3'),
  fit: require('../../assets/audio/fit.mp3'),
  seat: require('../../assets/audio/seat.mp3'),
  sit: require('../../assets/audio/sit.mp3'),

  // uː ~ ʊ
  pool: require('../../assets/audio/pool.mp3'),
  pull: require('../../assets/audio/pull.mp3'),
  boot: require('../../assets/audio/boot.mp3'),
  book: require('../../assets/audio/book.mp3'),
  fool: require('../../assets/audio/fool.mp3'),
  full: require('../../assets/audio/full.mp3'),
  Luke: require('../../assets/audio/Luke.mp3'),
  look: require('../../assets/audio/look.mp3'),
};

/* ---------- word-lists with group IDs ---------------------------- */
const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

const vW: Row[] = [
  ['vine', 'wine', 1, '/vaɪn/', '/waɪn/', 'vW'],
  ['vest', 'west', 2, '/vɛst/', '/wɛst/', 'vW'],
  ['vow', 'wow', 3, '/vaʊ/', '/waʊ/', 'vW'],
  ['vane', 'wane', 4, '/veɪn/', '/weɪn/', 'vW'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL'],
  ['rake', 'lake', 3, '/reɪk/', '/leɪk/', 'rL'],
  ['rip', 'lip', 4, '/rɪp/', '/lɪp/', 'rL'],
];

const iVsI: Row[] = [
  ['beat', 'bit', 1, '/biːt/', '/bɪt/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['feet', 'fit', 3, '/fiːt/', '/fɪt/', 'iVsI'],
  ['seat', 'sit', 4, '/siːt/', '/sɪt/', 'iVsI'],
];

const uVsU: Row[] = [
  ['pool', 'pull', 1, '/puːl/', '/pʊl/', 'uVsU'],
  ['boot', 'book', 2, '/buːt/', '/bʊk/', 'uVsU'],
  ['fool', 'full', 3, '/fuːl/', '/fʊl/', 'uVsU'],
  ['Luke', 'look', 4, '/luːk/', '/lʊk/', 'uVsU'],
];

/* ---------- export category object ------------------------------- */
const chinese: Category = {
  category: '中文',
  pairs: [
    ...thetaS.map(make),
    ...vW.map(make),
    ...rL.map(make),
    ...iVsI.map(make),
    ...uVsU.map(make),
  ],
};

export default chinese;
