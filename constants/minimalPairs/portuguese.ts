// constants/minimalPairs/portuguese.ts
import type { Category, Difficulty } from '../minimalPairs';

/** ------------------------------------------------------------------
 * Row tuple: [word1, word2, difficulty, ipa1, ipa2, groupID]
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

  // uː ~ ʊ
  pool: require('../../assets/audio/pool.mp3'),
  pull: require('../../assets/audio/pull.mp3'),
  boot: require('../../assets/audio/boot.mp3'),
  book: require('../../assets/audio/book.mp3'),
  fool: require('../../assets/audio/fool.mp3'),
  full: require('../../assets/audio/full.mp3'),
  Luke: require('../../assets/audio/Luke.mp3'),
  look: require('../../assets/audio/look.mp3'),

  // æ ~ ɛ
  bad: require('../../assets/audio/bad.mp3'),
  bed: require('../../assets/audio/bed.mp3'),
  pan: require('../../assets/audio/pan.mp3'),
  pen: require('../../assets/audio/pen.mp3'),
  dad: require('../../assets/audio/dad.mp3'),
  dead: require('../../assets/audio/dead.mp3'),
  bat: require('../../assets/audio/bat.mp3'),
  bet: require('../../assets/audio/bet.mp3'),

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
};

/* ---------- word lists ------------------------------------------- */
const iVsI: Row[] = [
  ['sheep', 'ship', 1, '/ʃiːp/', '/ʃɪp/', 'iVsI'],
  ['leave', 'live', 2, '/liːv/', '/lɪv/', 'iVsI'],
  ['beat', 'bit', 3, '/biːt/', '/bɪt/', 'iVsI'],
  ['feet', 'fit', 4, '/fiːt/', '/fɪt/', 'iVsI'],
];

const uVsU: Row[] = [
  ['pool', 'pull', 1, '/puːl/', '/pʊl/', 'uVsU'],
  ['boot', 'book', 2, '/buːt/', '/bʊk/', 'uVsU'],
  ['fool', 'full', 3, '/fuːl/', '/fʊl/', 'uVsU'],
  ['Luke', 'look', 4, '/luːk/', '/lʊk/', 'uVsU'],
];

const aVsE: Row[] = [
  ['bad', 'bed', 1, '/bæd/', '/bɛd/', 'aVsE'],
  ['pan', 'pen', 2, '/pæn/', '/pɛn/', 'aVsE'],
  ['dad', 'dead', 3, '/dæd/', '/dɛd/', 'aVsE'],
  ['bat', 'bet', 4, '/bæt/', '/bɛt/', 'aVsE'],
];

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

/* ---------- export ---------------------------------------------- */
const portuguese: Category = {
  category: 'Português',
  pairs: [
    ...iVsI.map(make),
    ...uVsU.map(make),
    ...aVsE.map(make),
    ...thetaT.map(make),
    ...ethD.map(make),
  ],
};

export default portuguese;
