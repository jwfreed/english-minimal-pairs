// constants/minimalPairs/thai.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 *  Row tuple:  [word1, word2, difficulty, ipa1, ipa2, groupID]
 *  `group` stitches all tiers of the SAME contrast together so that
 *  /θ–t/ rows share 'thetaT', /ð–d/ share 'ethD', etc.
 * ----------------------------------------------------------------- */
type Row = [string, string, Difficulty, string, string, string];

/** helper → Pair object  */
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
  // θ ~ t
  thin: require('../../assets/audio/thin.mp3'),
  tin: require('../../assets/audio/tin.mp3'),
  thick: require('../../assets/audio/thick.mp3'),
  tick: require('../../assets/audio/tick.mp3'),
  thank: require('../../assets/audio/thank.mp3'),
  tank: require('../../assets/audio/tank.mp3'),
  think: require('../../assets/audio/think.mp3'),
  tink: require('../../assets/audio/tink.mp3'),

  // ð ~ d
  then: require('../../assets/audio/then.mp3'),
  den: require('../../assets/audio/den.mp3'),
  though: require('../../assets/audio/though.mp3'),
  dough: require('../../assets/audio/dough.mp3'),
  they: require('../../assets/audio/they.mp3'),
  day: require('../../assets/audio/day.mp3'),
  there: require('../../assets/audio/there.mp3'),
  dare: require('../../assets/audio/dare.mp3'),

  // v ~ f
  vine: require('../../assets/audio/vine.mp3'),
  fine: require('../../assets/audio/fine.mp3'),
  vest: require('../../assets/audio/vest.mp3'),
  fest: require('../../assets/audio/fest.mp3'),
  van: require('../../assets/audio/van.mp3'),
  fan: require('../../assets/audio/fan.mp3'),
  vase: require('../../assets/audio/vase.mp3'),
  face: require('../../assets/audio/face.mp3'),

  // z ~ s
  zip: require('../../assets/audio/zip.mp3'),
  sip: require('../../assets/audio/sip.mp3'),
  zeal: require('../../assets/audio/zeal.mp3'),
  seal: require('../../assets/audio/seal.mp3'),
  zoom: require('../../assets/audio/zoom.mp3'),
  soon: require('../../assets/audio/soon.mp3'),
  zoo: require('../../assets/audio/zoo.mp3'),
  sue: require('../../assets/audio/sue.mp3'),

  // r ~ l
  right: require('../../assets/audio/right.mp3'),
  light: require('../../assets/audio/light.mp3'),
  road: require('../../assets/audio/road.mp3'),
  load: require('../../assets/audio/load.mp3'),
  rip: require('../../assets/audio/rip.mp3'),
  lip: require('../../assets/audio/lip.mp3'),
  rake: require('../../assets/audio/rake.mp3'),
  lake: require('../../assets/audio/lake.mp3'),
};

/* ---------- word lists ------------------------------------------- */
const thetaT: Row[] = [
  ['thin', 'tin', 1, '/θɪn/', '/tɪn/', 'thetaT'],
  ['thick', 'tick', 2, '/θɪk/', '/tɪk/', 'thetaT'],
  ['thank', 'tank', 3, '/θæŋk/', '/tæŋk/', 'thetaT'],
  ['think', 'tink', 4, '/θɪŋk/', '/tɪŋk/', 'thetaT'],
];

const ethD: Row[] = [
  ['then', 'den', 1, '/ðɛn/', '/dɛn/', 'ethD'],
  ['though', 'dough', 2, '/ðoʊ/', '/doʊ/', 'ethD'],
  ['they', 'day', 3, '/ðeɪ/', '/deɪ/', 'ethD'],
  ['there', 'dare', 4, '/ðɛə/', '/dɛə/', 'ethD'],
];

const vF: Row[] = [
  ['vine', 'fine', 1, '/vaɪn/', '/faɪn/', 'vF'],
  ['vest', 'fest', 2, '/vɛst/', '/fɛst/', 'vF'],
  ['van', 'fan', 3, '/væn/', '/fæn/', 'vF'],
  ['vase', 'face', 4, '/veɪs/', '/feɪs/', 'vF'],
];

const zS: Row[] = [
  ['zip', 'sip', 1, '/zɪp/', '/sɪp/', 'zS'],
  ['zeal', 'seal', 2, '/ziːl/', '/siːl/', 'zS'],
  ['zoom', 'soon', 3, '/zuːm/', '/suːn/', 'zS'],
  ['zoo', 'sue', 4, '/zuː/', '/suː/', 'zS'],
];

const rL: Row[] = [
  ['right', 'light', 1, '/raɪt/', '/laɪt/', 'rL'],
  ['road', 'load', 2, '/roʊd/', '/loʊd/', 'rL'],
  ['rip', 'lip', 3, '/rɪp/', '/lɪp/', 'rL'],
  ['rake', 'lake', 4, '/reɪk/', '/leɪk/', 'rL'],
];

/* ---------- export ------------------------------------------------ */
const thai: Category = {
  category: 'ภาษาไทย',
  pairs: [
    ...thetaT.map(make),
    ...ethD.map(make),
    ...vF.map(make),
    ...zS.map(make),
    ...rL.map(make),
  ],
};

export default thai;
