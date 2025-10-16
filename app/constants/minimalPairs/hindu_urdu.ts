// constants/minimalPairs/hindu_urdu.ts
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
});

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

const vW: Row[] = [
  ['vine', 'wine', 1, '/vaɪn/', '/waɪn/', 'vW'],
  ['vest', 'west', 2, '/vɛst/', '/wɛst/', 'vW'],
  ['vow', 'wow', 3, '/vaʊ/', '/waʊ/', 'vW'],
  ['vane', 'wane', 4, '/veɪn/', '/weɪn/', 'vW'],
];

const zS: Row[] = [
  ['zip', 'sip', 1, '/zɪp/', '/sɪp/', 'zS'],
  ['zeal', 'seal', 2, '/ziːl/', '/siːl/', 'zS'],
  ['zoom', 'soon', 3, '/zuːm/', '/suːn/', 'zS'],
  ['zoo', 'sue', 4, '/zuː/', '/suː/', 'zS'],
];

const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

/* ---------- export ------------------------------------------------ */
const hindustani: Category = {
  category: 'हिंदी/اردو',
  pairs: [
    ...thetaT.map(make),
    ...ethD.map(make),
    ...vW.map(make),
    ...zS.map(make),
    ...iVsI.map(make),
  ],
};

export default hindustani;
