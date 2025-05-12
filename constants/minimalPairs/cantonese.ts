// constants/minimalPairs/cantonese.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
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

/* ---------- audio map (re‑use existing clips) -------------------- */
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

  // r ~ l
  right: require('../../assets/audio/right.mp3'),
  light: require('../../assets/audio/light.mp3'),
  road: require('../../assets/audio/road.mp3'),
  load: require('../../assets/audio/load.mp3'),
  rip: require('../../assets/audio/rip.mp3'),
  lip: require('../../assets/audio/lip.mp3'),
  rake: require('../../assets/audio/rake.mp3'),
  lake: require('../../assets/audio/lake.mp3'),

  // v ~ w
  vine: require('../../assets/audio/vine.mp3'),
  wine: require('../../assets/audio/wine.mp3'),
  vest: require('../../assets/audio/vest.mp3'),
  west: require('../../assets/audio/west.mp3'),
  vow: require('../../assets/audio/vow.mp3'),
  wow: require('../../assets/audio/wow.mp3'),
  vane: require('../../assets/audio/vane.mp3'),
  wane: require('../../assets/audio/wane.mp3'),

  // iː ~ ɪ
  sheep: require('../../assets/audio/sheep.mp3'),
  ship: require('../../assets/audio/ship.mp3'),
  leave: require('../../assets/audio/leave.mp3'),
  live: require('../../assets/audio/live.mp3'),
  beat: require('../../assets/audio/beat.mp3'),
  bit: require('../../assets/audio/bit.mp3'),
  feet: require('../../assets/audio/feet.mp3'),
  fit: require('../../assets/audio/fit.mp3'),

  // æ ~ ɛ
  bad: require('../../assets/audio/bad.mp3'),
  bed: require('../../assets/audio/bed.mp3'),
  pan: require('../../assets/audio/pan.mp3'),
  pen: require('../../assets/audio/pen.mp3'),
  dad: require('../../assets/audio/dad.mp3'),
  dead: require('../../assets/audio/dead.mp3'),
  bat: require('../../assets/audio/bat.mp3'),
  bet: require('../../assets/audio/bet.mp3'),
};

/* ---------- word lists ------------------------------------------- */
const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL'],
  ['rip', 'lip', 3, '/rɪp/', '/lɪp/', 'rL'],
  ['rake', 'lake', 4, '/reɪk/', '/leɪk/', 'rL'],
];

const vW: Row[] = [
  ['vine', 'wine', 1, '/vaɪn/', '/waɪn/', 'vW'],
  ['vest', 'west', 2, '/vɛst/', '/wɛst/', 'vW'],
  ['vow', 'wow', 3, '/vaʊ/', '/waʊ/', 'vW'],
  ['vane', 'wane', 4, '/veɪn/', '/weɪn/', 'vW'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE'],
];

/* ---------- export ------------------------------------------------ */
const cantonese: Category = {
  category: '廣東話',
  pairs: [
    ...thetaS.map(make),
    ...rL.map(make),
    ...vW.map(make),
    ...iVsI.map(make),
    ...aVsE.map(make),
  ],
};

export default cantonese;
