// constants/minimalPairs/farsi.ts
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

/* ---------- audio map -------------------------------------------- */
const audio: Record<string, any> = {
  // θ ~ t
  thin: require('../../assets/audio/thin.mp3'),
  tin: require('../../assets/audio/tin.mp3'),
  thick: require('../../assets/audio/thick.mp3'),
  tick: require('../../assets/audio/tick.mp3'),
  think: require('../../assets/audio/think.mp3'),
  tink: require('../../assets/audio/tink.mp3'),
  mouth: require('../../assets/audio/mouth.mp3'),
  tout: require('../../assets/audio/tout.mp3'),

  // ð ~ d
  then: require('../../assets/audio/then.mp3'),
  den: require('../../assets/audio/den.mp3'),
  though: require('../../assets/audio/though.mp3'),
  dough: require('../../assets/audio/dough.mp3'),
  they: require('../../assets/audio/they.mp3'),
  day: require('../../assets/audio/day.mp3'),
  there: require('../../assets/audio/there.mp3'),
  dare: require('../../assets/audio/dare.mp3'),

  // w ~ v
  wine: require('../../assets/audio/wine.mp3'),
  vine: require('../../assets/audio/vine.mp3'),
  west: require('../../assets/audio/west.mp3'),
  vest: require('../../assets/audio/vest.mp3'),
  wow: require('../../assets/audio/wow.mp3'),
  vow: require('../../assets/audio/vow.mp3'),
  wane: require('../../assets/audio/wane.mp3'),
  vane: require('../../assets/audio/vane.mp3'),

  // p ~ b
  pat: require('../../assets/audio/pat.mp3'),
  bat: require('../../assets/audio/bat.mp3'),
  pan: require('../../assets/audio/pan.mp3'),
  ban: require('../../assets/audio/ban.mp3'),
  pear: require('../../assets/audio/pear.mp3'),
  bear: require('../../assets/audio/bear.mp3'),
  pack: require('../../assets/audio/pack.mp3'),
  back: require('../../assets/audio/back.mp3'),

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
const thetaT: Row[] = [
  ['thin', 'tin', 1, '/θɪn/', '/tɪn/', 'thetaT'],
  ['thick', 'tick', 2, '/θɪk/', '/tɪk/', 'thetaT'],
  ['think', 'tink', 3, '/θɪŋk/', '/tɪŋk/', 'thetaT'],
  ['mouth', 'tout', 4, '/maʊθ/', '/taʊt/', 'thetaT'],
];

const ethD: Row[] = [
  ['then', 'den', 1, '/ðɛn/', '/dɛn/', 'ethD'],
  ['though', 'dough', 2, '/ðoʊ/', '/doʊ/', 'ethD'],
  ['they', 'day', 3, '/ðeɪ/', '/deɪ/', 'ethD'],
  ['there', 'dare', 4, '/ðɛə/', '/dɛə/', 'ethD'],
];

const wV: Row[] = [
  ['wine', 'vine', 1, '/waɪn/', '/vaɪn/', 'wV'],
  ['west', 'vest', 2, '/wɛst/', '/vɛst/', 'wV'],
  ['wow', 'vow', 3, '/waʊ/', '/vaʊ/', 'wV'],
  ['wane', 'vane', 4, '/weɪn/', '/veɪn/', 'wV'],
];

const pB: Row[] = [
  ['pat', 'bat', 1, '/pæt/', '/bæt/', 'pB'],
  ['pan', 'ban', 2, '/pæn/', '/bæn/', 'pB'],
  ['pear', 'bear', 3, '/pɛə/', '/bɛə/', 'pB'],
  ['pack', 'back', 4, '/pæk/', '/bæk/', 'pB'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

/* ---------- export ---------------------------------------------- */
const farsi: Category = {
  category: 'زبان فارسی',
  pairs: [
    ...thetaT.map(make),
    ...ethD.map(make),
    ...wV.map(make),
    ...pB.map(make),
    ...iVsI.map(make),
  ],
};

export default farsi;
