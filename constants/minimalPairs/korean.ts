// constants/minimalPairs/korean.ts
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

  // æ ~ ʌ (bat/but etc.) – not used here

  // w ~ v – not used here

  // r ~ l
  right: require('../../assets/audio/right.mp3'),
  light: require('../../assets/audio/light.mp3'),
  road: require('../../assets/audio/road.mp3'),
  load: require('../../assets/audio/load.mp3'),
  rip: require('../../assets/audio/rip.mp3'),
  lip: require('../../assets/audio/lip.mp3'),
  rake: require('../../assets/audio/rake.mp3'),
  lake: require('../../assets/audio/lake.mp3'),

  // f ~ p
  fine: require('../../assets/audio/fine.mp3'),
  pine: require('../../assets/audio/pine.mp3'),
  fan: require('../../assets/audio/fan.mp3'),
  pan: require('../../assets/audio/pan.mp3'),
  ferry: require('../../assets/audio/ferry.mp3'),
  perry: require('../../assets/audio/perry.mp3'),
  fail: require('../../assets/audio/fail.mp3'),
  pale: require('../../assets/audio/pale.mp3'),

  // v ~ b
  van: require('../../assets/audio/van.mp3'),
  ban: require('../../assets/audio/ban.mp3'),
  vest: require('../../assets/audio/vest.mp3'),
  best: require('../../assets/audio/best.mp3'),
  vow: require('../../assets/audio/vow.mp3'),
  bow: require('../../assets/audio/bow.mp3'),
  vase: require('../../assets/audio/vase.mp3'),
  base: require('../../assets/audio/base.mp3'),

  // θ ~ s
  thin: require('../../assets/audio/thin.mp3'),
  sin: require('../../assets/audio/sin.mp3'),
  thick: require('../../assets/audio/thick.mp3'),
  sick: require('../../assets/audio/sick.mp3'),
  think: require('../../assets/audio/think.mp3'),
  sink: require('../../assets/audio/sink.mp3'),
  mouth: require('../../assets/audio/mouth.mp3'),
  mouse: require('../../assets/audio/mouse.mp3'),
};

/* ---------- word lists ------------------------------------------- */
const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const fP: Row[] = [
  ['fine', 'pine', 1, '/faɪn/', '/paɪn/', 'fP'],
  ['fan', 'pan', 2, '/fæn/', '/pæn/', 'fP'],
  ['ferry', 'perry', 3, '/ˈfɛri/', '/ˈpɛri/', 'fP'],
  ['fail', 'pale', 4, '/feɪl/', '/peɪl/', 'fP'],
];

const vB: Row[] = [
  ['van', 'ban', 1, '/væn/', '/bæn/', 'vB'],
  ['vest', 'best', 2, '/vɛst/', '/bɛst/', 'vB'],
  ['vow', 'bow', 3, '/vaʊ/', '/baʊ/', 'vB'],
  ['vase', 'base', 4, '/veɪs/', '/beɪs/', 'vB'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL'],
  ['rip', 'lip', 3, '/rɪp/', '/lɪp/', 'rL'],
  ['rake', 'lake', 4, '/reɪk/', '/leɪk/', 'rL'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

/* ---------- export ------------------------------------------------ */
const korean: Category = {
  category: '한국어',
  pairs: [
    ...iVsI.map(make),
    ...fP.map(make),
    ...vB.map(make),
    ...rL.map(make),
    ...thetaS.map(make),
  ],
};

export default korean;
