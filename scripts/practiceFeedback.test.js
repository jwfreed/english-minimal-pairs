const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { buildPracticeFeedbackCopy } = loadTsModule(
  path.join(__dirname, '..', 'utils', 'practiceFeedback.ts')
);

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function assertJsonEqual(actual, expected) {
  assert.strictEqual(JSON.stringify(actual), JSON.stringify(expected));
}

const makePair = (overrides = {}) => ({
  word1: 'right',
  word2: 'light',
  ipa1: '/raɪt/',
  ipa2: '/laɪt/',
  difficulty: 1,
  group: 'rL',
  position: 'initial',
  contrastPhoneme1: 'r',
  contrastPhoneme2: 'l',
  ...overrides,
});

runTest('buildPracticeFeedbackCopy renders correct feedback for word1 with phoneme', () => {
  assertJsonEqual(
    buildPracticeFeedbackCopy({ pair: makePair(), feedback: 'correct', playedIdx: 0 }),
    {
      headline: 'Correct — you heard /r/ in right.',
      detail: null,
      correctWord: 'right',
      correctIpa: '/raɪt/',
      correctPhoneme: '/r/',
      contrastWord: 'light',
      contrastIpa: '/laɪt/',
    }
  );
});

runTest('buildPracticeFeedbackCopy renders correct feedback for word2 with phoneme', () => {
  assertJsonEqual(
    buildPracticeFeedbackCopy({ pair: makePair(), feedback: 'correct', playedIdx: 1 }),
    {
      headline: 'Correct — you heard /l/ in light.',
      detail: null,
      correctWord: 'light',
      correctIpa: '/laɪt/',
      correctPhoneme: '/l/',
      contrastWord: 'right',
      contrastIpa: '/raɪt/',
    }
  );
});

runTest('buildPracticeFeedbackCopy renders incorrect feedback identifying the correct word', () => {
  assertJsonEqual(
    buildPracticeFeedbackCopy({ pair: makePair(), feedback: 'incorrect', playedIdx: 0 }),
    {
      headline: 'This was right.',
      detail: 'Listen again and compare it with light.',
      correctWord: 'right',
      correctIpa: '/raɪt/',
      correctPhoneme: '/r/',
      contrastWord: 'light',
      contrastIpa: '/laɪt/',
    }
  );
});

runTest('buildPracticeFeedbackCopy falls back when phoneme is missing', () => {
  assertJsonEqual(
    buildPracticeFeedbackCopy({
      pair: makePair({ contrastPhoneme1: ' ' }),
      feedback: 'correct',
      playedIdx: 0,
    }),
    {
      headline: 'Correct — that was right.',
      detail: null,
      correctWord: 'right',
      correctIpa: '/raɪt/',
      correctPhoneme: null,
      contrastWord: 'light',
      contrastIpa: '/laɪt/',
    }
  );
});

runTest('buildPracticeFeedbackCopy normalizes phoneme display slashes', () => {
  assert.strictEqual(
    buildPracticeFeedbackCopy({
      pair: makePair({ contrastPhoneme1: ' /r/ ' }),
      feedback: 'correct',
      playedIdx: 0,
    }).headline,
    'Correct — you heard /r/ in right.'
  );
});

runTest('buildPracticeFeedbackCopy does not mutate pair input', () => {
  const pair = makePair({ contrastPhoneme1: ' /r/ ' });
  const before = JSON.stringify(pair);

  buildPracticeFeedbackCopy({ pair, feedback: 'correct', playedIdx: 0 });

  assert.strictEqual(JSON.stringify(pair), before);
});

console.log('\nAll practiceFeedback tests passed.');
