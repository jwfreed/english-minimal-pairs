const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { buildContrastLabel, buildContrastTrainingTitle } = loadTsModule(
  path.join(__dirname, '..', 'utils', 'contrastLabel.ts')
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

runTest('buildContrastTrainingTitle renders phoneme contrast labels', () => {
  assert.strictEqual(buildContrastTrainingTitle(makePair()), 'Train /r/ vs /l/');
});

runTest('buildContrastTrainingTitle normalizes source values with slashes', () => {
  assert.strictEqual(
    buildContrastTrainingTitle(makePair({ contrastPhoneme1: '/r/', contrastPhoneme2: '/l/' })),
    'Train /r/ vs /l/'
  );
});

runTest('buildContrastTrainingTitle falls back to readable group labels', () => {
  assert.strictEqual(
    buildContrastTrainingTitle(makePair({ contrastPhoneme1: '', contrastPhoneme2: ' ', group: 'iVsI' })),
    'Train i Vs I'
  );
});

runTest('buildContrastTrainingTitle handles missing pairs safely', () => {
  assert.strictEqual(buildContrastTrainingTitle(undefined), 'Train this contrast');
});

runTest('buildContrastLabel renders the contrast without practice-action copy', () => {
  assert.strictEqual(buildContrastLabel(makePair()), '/r/ vs /l/');
  assert.strictEqual(
    buildContrastLabel(makePair({ contrastPhoneme1: '', contrastPhoneme2: ' ', group: 'iVsI' })),
    'i Vs I'
  );
});

runTest('buildContrastLabel stays empty when learning content is unavailable', () => {
  assert.strictEqual(buildContrastLabel(undefined), '');
});

console.log('\nAll contrastLabel tests passed.');
