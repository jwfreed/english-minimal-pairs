// constants/minimalPairs/russian.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ----------------------------------------------------------------
 *  Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
 * ----------------------------------------------------------------*/
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

/* ---------- static require map ---------------------------------- */
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

  // æ ~ ʌ
  bat: require('../../assets/audio/bat.mp3'),
  but: require('../../assets/audio/but.mp3'),
  cap: require('../../assets/audio/cap.mp3'),
  cup: require('../../assets/audio/cup.mp3'),
  pan: require('../../assets/audio/pan.mp3'),
  pun: require('../../assets/audio/pun.mp3'),
  ban: require('../../assets/audio/ban.mp3'),
  bun: require('../../assets/audio/bun.mp3'),

  // w ~ v
  wine: require('../../assets/audio/wine.mp3'),
  vine: require('../../assets/audio/vine.mp3'),
  west: require('../../assets/audio/west.mp3'),
  vest: require('../../assets/audio/vest.mp3'),
  wow: require('../../assets/audio/wow.mp3'),
  vow: require('../../assets/audio/vow.mp3'),
  wane: require('../../assets/audio/wane.mp3'),
  vane: require('../../assets/audio/vane.mp3'),

  // θ ~ s
  thin: require('../../assets/audio/thin.mp3'),
  sin: require('../../assets/audio/sin.mp3'),
  thick: require('../../assets/audio/thick.mp3'),
  sick: require('../../assets/audio/sick.mp3'),
  think: require('../../assets/audio/think.mp3'),
  sink: require('../../assets/audio/sink.mp3'),
  mouth: require('../../assets/audio/mouth.mp3'),
  mouse: require('../../assets/audio/mouse.mp3'),

  // h deletion
  hat: require('../../assets/audio/hat.mp3'),
  at: require('../../assets/audio/at.mp3'),
  heat: require('../../assets/audio/heat.mp3'),
  eat: require('../../assets/audio/eat.mp3'),
  hill: require('../../assets/audio/hill.mp3'),
  ill: require('../../assets/audio/ill.mp3'),
  hair: require('../../assets/audio/hair.mp3'),
  air: require('../../assets/audio/air.mp3'),
};

/* ---------- word lists ------------------------------------------ */
const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const aVsUh: Row[] = [
  ['bat', 'but', 1, '/bæt/', '/bʌt/', 'aVsUh'],
  ['cap', 'cup', 2, '/kæp/', '/kʌp/', 'aVsUh'],
  ['pan', 'pun', 3, '/pæn/', '/pʌn/', 'aVsUh'],
  ['ban', 'bun', 4, '/bæn/', '/bʌn/', 'aVsUh'],
];

const wV: Row[] = [
  ['wine', 'vine', 1, '/waɪn/', '/vaɪn/', 'wV'],
  ['west', 'vest', 2, '/wɛst/', '/vɛst/', 'wV'],
  ['wow', 'vow', 3, '/waʊ/', '/vaʊ/', 'wV'],
  ['wane', 'vane', 4, '/weɪn/', '/veɪn/', 'wV'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

const hZero: Row[] = [
  ['hat', 'at', 1, '/hæt/', '/æt/', 'hZero'],
  ['heat', 'eat', 2, '/hiːt/', '/iːt/', 'hZero'],
  ['hill', 'ill', 3, '/hɪl/', '/ɪl/', 'hZero'],
  ['hair', 'air', 4, '/heə/', '/eə/', 'hZero'],
];

/* ---------- export --------------------------------------------- */
const russian: Category = {
  category: 'русский язык',
  pairs: [
    ...iVsI.map(make),
    ...aVsUh.map(make),
    ...wV.map(make),
    ...thetaS.map(make),
    ...hZero.map(make),
  ],
};

export default russian;
