// constants/minimalPairs/arabic.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
 *  The `group` key ties all tiers of the same contrast.
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
  // p ~ b
  pat: require('../../assets/audio/pat.mp3'),
  bat: require('../../assets/audio/bat.mp3'),
  pan: require('../../assets/audio/pan.mp3'),
  ban: require('../../assets/audio/ban.mp3'),
  pear: require('../../assets/audio/pear.mp3'),
  bear: require('../../assets/audio/bear.mp3'),
  pack: require('../../assets/audio/pack.mp3'),
  back: require('../../assets/audio/back.mp3'),

  // v ~ f
  vine: require('../../assets/audio/vine.mp3'),
  fine: require('../../assets/audio/fine.mp3'),
  vest: require('../../assets/audio/vest.mp3'),
  fest: require('../../assets/audio/fest.mp3'),
  van: require('../../assets/audio/van.mp3'),
  fan: require('../../assets/audio/fan.mp3'),
  vase: require('../../assets/audio/vase.mp3'),
  face: require('../../assets/audio/face.mp3'),

  // θ ~ s
  thin: require('../../assets/audio/thin.mp3'),
  sin: require('../../assets/audio/sin.mp3'),
  thick: require('../../assets/audio/thick.mp3'),
  sick: require('../../assets/audio/sick.mp3'),
  think: require('../../assets/audio/think.mp3'),
  sink: require('../../assets/audio/sink.mp3'),
  mouth: require('../../assets/audio/mouth.mp3'),
  mouse: require('../../assets/audio/mouse.mp3'),

  // ð ~ d
  then: require('../../assets/audio/then.mp3'),
  den: require('../../assets/audio/den.mp3'),
  though: require('../../assets/audio/though.mp3'),
  dough: require('../../assets/audio/dough.mp3'),
  they: require('../../assets/audio/they.mp3'),
  day: require('../../assets/audio/day.mp3'),
  there: require('../../assets/audio/there.mp3'),
  dare: require('../../assets/audio/dare.mp3'),

  // iː ~ ɪ
  sheep: require('../../assets/audio/sheep.mp3'),
  ship: require('../../assets/audio/ship.mp3'),
  leave: require('../../assets/audio/leave.mp3'),
  live: require('../../assets/audio/live.mp3'),
  beat: require('../../assets/audio/beat.mp3'),
  bit: require('../../assets/audio/bit.mp3'),
  feet: require('../../assets/audio/feet.mp3'),
  fit: require('../../assets/audio/fit.mp3'),
};

/* ---------- word lists ------------------------------------------- */
const pB: Row[] = [
  ['pat', 'bat', 1, '/pæt/', '/bæt/', 'pB'],
  ['pan', 'ban', 2, '/pæn/', '/bæn/', 'pB'],
  ['pear', 'bear', 3, '/pɛə/', '/bɛə/', 'pB'],
  ['pack', 'back', 4, '/pæk/', '/bæk/', 'pB'],
];

const vF: Row[] = [
  ['vine', 'fine', 1, '/vaɪn/', '/faɪn/', 'vF'],
  ['vest', 'fest', 2, '/vɛst/', '/fɛst/', 'vF'],
  ['van', 'fan', 3, '/væn/', '/fæn/', 'vF'],
  ['vase', 'face', 4, '/veɪs/', '/feɪs/', 'vF'],
];

const thetaS: Row[] = [
  ['thin', 'sin', 1, '/θɪn/', '/sɪn/', 'thetaS'],
  ['thick', 'sick', 2, '/θɪk/', '/sɪk/', 'thetaS'],
  ['think', 'sink', 3, '/θɪŋk/', '/sɪŋk/', 'thetaS'],
  ['mouth', 'mouse', 4, '/maʊθ/', '/maʊs/', 'thetaS'],
];

const ethD: Row[] = [
  ['then', 'den', 1, '/ðɛn/', '/dɛn/', 'ethD'],
  ['though', 'dough', 2, '/ðoʊ/', '/doʊ/', 'ethD'],
  ['they', 'day', 3, '/ðeɪ/', '/deɪ/', 'ethD'],
  ['there', 'dare', 4, '/ðɛə/', '/dɛə/', 'ethD'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

/* ---------- export ------------------------------------------------ */
const arabic: Category = {
  category: 'اللغة العربية',
  pairs: [
    ...pB.map(make),
    ...vF.map(make),
    ...thetaS.map(make),
    ...ethD.map(make),
    ...iVsI.map(make),
  ],
};

export default arabic;
