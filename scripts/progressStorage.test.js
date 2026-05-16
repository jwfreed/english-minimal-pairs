const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  PAIR_PROGRESS_STORAGE_KEY,
  getDefaultProgress,
  parseStoredProgress,
  serializeProgress,
} = loadTsModule(path.join(__dirname, '..', 'app', 'storage', 'progressStorage.ts'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const plain = (value) => JSON.parse(JSON.stringify(value));

runTest('pair progress storage key is explicit', () => {
  assert.strictEqual(PAIR_PROGRESS_STORAGE_KEY, '@pairProgress_v2');
});

runTest('parseStoredProgress returns defaults for missing progress', () => {
  assert.deepStrictEqual(plain(parseStoredProgress(null)), plain(getDefaultProgress()));
  assert.deepStrictEqual(plain(parseStoredProgress('')), plain(getDefaultProgress()));
});

runTest('parseStoredProgress returns defaults for malformed progress', () => {
  assert.deepStrictEqual(plain(parseStoredProgress('{bad json')), plain(getDefaultProgress()));
});

runTest('valid progress round-trips through serialize and parse', () => {
  const progress = {
    Test__rL__right_light: {
      attempts: [
        { isCorrect: true, timestamp: 1700000000000, durationMin: 0.05 },
        { isCorrect: false, timestamp: 1700000001000, durationMin: 0.1 },
      ],
    },
  };

  assert.deepStrictEqual(plain(parseStoredProgress(serializeProgress(progress))), progress);
});
