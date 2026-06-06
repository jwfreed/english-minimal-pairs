const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  PAIR_PROGRESS_STORAGE_KEY,
  MAX_ATTEMPTS_PER_PAIR,
  getDefaultProgress,
  parseStoredProgress,
  serializeProgress,
  pruneAttemptHistory,
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

// ── pruneAttemptHistory ──────────────────────────────────────────────────────

runTest('MAX_ATTEMPTS_PER_PAIR is exported and equals 100', () => {
  assert.strictEqual(MAX_ATTEMPTS_PER_PAIR, 100);
});

runTest('pruneAttemptHistory leaves fewer-than-cap attempts unchanged', () => {
  const attempts = [
    { isCorrect: true, timestamp: 1, durationMin: 0.1 },
    { isCorrect: false, timestamp: 2, durationMin: 0.2 },
  ];
  assert.deepStrictEqual(plain(pruneAttemptHistory(attempts)), attempts);
});

runTest('pruneAttemptHistory leaves exactly-cap attempts unchanged', () => {
  const attempts = Array.from({ length: MAX_ATTEMPTS_PER_PAIR }, (_, i) => ({
    isCorrect: i % 2 === 0,
    timestamp: i,
    durationMin: 0.1,
  }));
  const result = pruneAttemptHistory(attempts);
  assert.strictEqual(result.length, MAX_ATTEMPTS_PER_PAIR);
  assert.deepStrictEqual(plain(result), attempts);
});

runTest('pruneAttemptHistory retains the most recent (last) N entries when over cap', () => {
  const total = MAX_ATTEMPTS_PER_PAIR + 10;
  const attempts = Array.from({ length: total }, (_, i) => ({
    isCorrect: i % 2 === 0,
    timestamp: i,
    durationMin: 0.1,
  }));
  const result = pruneAttemptHistory(attempts);
  assert.strictEqual(result.length, MAX_ATTEMPTS_PER_PAIR);
  // Should retain the last MAX_ATTEMPTS_PER_PAIR entries (indices 10..total-1)
  assert.strictEqual(result[0].timestamp, 10);
  assert.strictEqual(result[result.length - 1].timestamp, total - 1);
});

runTest('pruneAttemptHistory handles null/undefined attempts without crashing', () => {
  assert.strictEqual(pruneAttemptHistory(null).length, 0);
  assert.strictEqual(pruneAttemptHistory(undefined).length, 0);
  assert.strictEqual(pruneAttemptHistory([]).length, 0);
});

runTest('pruneAttemptHistory handles non-array attempts without crashing', () => {
  assert.strictEqual(pruneAttemptHistory('bad').length, 0);
  assert.strictEqual(pruneAttemptHistory(42).length, 0);
  assert.strictEqual(pruneAttemptHistory({}).length, 0);
});

// ── parseStoredProgress normalizes oversized history on load ─────────────────

runTest('parseStoredProgress prunes oversized attempt arrays on load', () => {
  const oversizedAttempts = Array.from({ length: MAX_ATTEMPTS_PER_PAIR + 50 }, (_, i) => ({
    isCorrect: i % 3 === 0,
    timestamp: i,
    durationMin: 0.05,
  }));
  const raw = JSON.stringify({
    'pair-a': { attempts: oversizedAttempts },
  });
  const result = parseStoredProgress(raw);
  assert.strictEqual(result['pair-a'].attempts.length, MAX_ATTEMPTS_PER_PAIR);
  // Most recent entries retained
  assert.strictEqual(result['pair-a'].attempts[0].timestamp, 50);
  assert.strictEqual(result['pair-a'].attempts[MAX_ATTEMPTS_PER_PAIR - 1].timestamp, MAX_ATTEMPTS_PER_PAIR + 49);
});

runTest('parseStoredProgress handles pairs with missing attempts field without crashing', () => {
  const raw = JSON.stringify({ 'pair-x': {} });
  const result = parseStoredProgress(raw);
  assert.strictEqual(result['pair-x'].attempts.length, 0);
});

runTest('multiple pairs are pruned independently', () => {
  const makeAttempts = (n) =>
    Array.from({ length: n }, (_, i) => ({ isCorrect: true, timestamp: i, durationMin: 0 }));

  const raw = JSON.stringify({
    'pair-small': { attempts: makeAttempts(5) },
    'pair-exact': { attempts: makeAttempts(MAX_ATTEMPTS_PER_PAIR) },
    'pair-over': { attempts: makeAttempts(MAX_ATTEMPTS_PER_PAIR + 20) },
  });

  const result = parseStoredProgress(raw);
  assert.strictEqual(result['pair-small'].attempts.length, 5);
  assert.strictEqual(result['pair-exact'].attempts.length, MAX_ATTEMPTS_PER_PAIR);
  assert.strictEqual(result['pair-over'].attempts.length, MAX_ATTEMPTS_PER_PAIR);
});
