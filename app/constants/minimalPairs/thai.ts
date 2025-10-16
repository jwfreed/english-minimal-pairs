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
});

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
