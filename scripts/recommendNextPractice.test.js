// scripts/recommendNextPractice.test.js
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { computePracticeNextRecommendation } = loadTsModule(
  path.join(__dirname, '..', 'utils', 'recommendNextPractice.ts')
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

// Helper: build a Pair-shaped object for a given group and phonemes.
const makePair = (group, cp1, cp2, word1, word2) => ({
  word1,
  word2,
  ipa1: `/${cp1}/`,
  ipa2: `/${cp2}/`,
  difficulty: 1,
  group,
  position: 'initial',
  contrastPhoneme1: cp1,
  contrastPhoneme2: cp2,
});

// Helper: build a PairAttempt.
const makeAttempt = (isCorrect, timestamp = Date.now()) => ({
  isCorrect,
  timestamp,
  durationMin: 0,
});

// Helper: build a pair ID exactly as the helper does.
const pairId = (category, pair) =>
  `${category}__${pair.group}__${pair.word1}_${pair.word2}`;

// ─── Tests ────────────────────────────────────────────────────────────────────

runTest('recommends a new pair when nothing has been practiced', () => {
  const pairs = [makePair('rL', 'r', 'l', 'rake', 'lake')];
  const result = computePracticeNextRecommendation({}, pairs, 'Japanese');
  assert.ok(result !== null, 'expected a new-pair recommendation');
  assert.strictEqual(result.reason, 'newPair');
  assert.strictEqual(result.groupId, 'rL');
  assert.strictEqual(result.label, '/r/ vs /l/');
  assert.strictEqual(result.recentAccuracy, 0);
});

runTest('returns null when the only practiced pair lacks enough attempts and no unpracticed pair remains', () => {
  const cat = 'Japanese';
  const pair = makePair('rL', 'r', 'l', 'rake', 'lake');
  // Only 2 attempts — below the 3-attempt threshold, and no unpracticed pair
  const progress = {
    [pairId(cat, pair)]: {
      attempts: [makeAttempt(true), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pair], cat);
  assert.strictEqual(result, null);
});

runTest('returns the one practiced group when it has enough attempts', () => {
  const cat = 'Japanese';
  const pair = makePair('rL', 'r', 'l', 'rake', 'lake');
  const progress = {
    [pairId(cat, pair)]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pair], cat);
  assert.ok(result !== null, 'expected a recommendation');
  assert.strictEqual(result.reason, 'lowAccuracy');
  assert.strictEqual(result.groupId, 'rL');
  assert.strictEqual(result.label, '/r/ vs /l/');
  assert.ok(typeof result.recentAccuracy === 'number');
  assert.ok(result.recentAccuracy >= 0 && result.recentAccuracy <= 1);
});

runTest('recommends the first unpracticed pair when every practiced group is strong', () => {
  const cat = 'Japanese';
  const strong = makePair('rL', 'r', 'l', 'rake', 'lake');
  const fresh = makePair('bV', 'b', 'v', 'ban', 'van');
  // rL: 3/3 correct = 1.0 accuracy (strong); bV: never practiced
  const progress = {
    [pairId(cat, strong)]: {
      attempts: [makeAttempt(true), makeAttempt(true), makeAttempt(true)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [strong, fresh], cat);
  assert.ok(result !== null, 'expected a new-pair recommendation');
  assert.strictEqual(result.reason, 'newPair');
  assert.strictEqual(result.groupId, 'bV');
  assert.strictEqual(result.label, '/b/ vs /v/');
  assert.strictEqual(result.recentAccuracy, 0);
});

runTest('prefers a low-accuracy group over an unpracticed pair', () => {
  const cat = 'Japanese';
  const weak = makePair('rL', 'r', 'l', 'rake', 'lake');
  const fresh = makePair('bV', 'b', 'v', 'ban', 'van');
  // rL: 1/3 correct (weak); bV: unpracticed
  const progress = {
    [pairId(cat, weak)]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [weak, fresh], cat);
  assert.ok(result !== null);
  assert.strictEqual(result.reason, 'lowAccuracy');
  assert.strictEqual(result.groupId, 'rL');
});

runTest('falls back to lowest-accuracy when all groups are strong and no unpracticed pair remains', () => {
  const cat = 'Japanese';
  const pair = makePair('rL', 'r', 'l', 'rake', 'lake');
  // Single group, all correct (strong), nothing else to recommend
  const progress = {
    [pairId(cat, pair)]: {
      attempts: [makeAttempt(true), makeAttempt(true), makeAttempt(true)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pair], cat);
  assert.ok(result !== null, 'expected a fallback recommendation');
  assert.strictEqual(result.reason, 'lowAccuracy');
  assert.strictEqual(result.groupId, 'rL');
});

runTest('recommends the group with the lowest recent accuracy when multiple are practiced', () => {
  const cat = 'Japanese';
  const pairRL = makePair('rL', 'r', 'l', 'rake', 'lake');
  const pairBV = makePair('bV', 'b', 'v', 'ban', 'van');

  // rL: 2 out of 3 correct = ~0.67 accuracy
  // bV: 1 out of 3 correct = ~0.33 accuracy → should be recommended
  const progress = {
    [pairId(cat, pairRL)]: {
      attempts: [makeAttempt(true), makeAttempt(true), makeAttempt(false)],
    },
    [pairId(cat, pairBV)]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pairRL, pairBV], cat);
  assert.ok(result !== null, 'expected a recommendation');
  assert.strictEqual(result.groupId, 'bV');
  assert.strictEqual(result.label, '/b/ vs /v/');
});

runTest('aggregates attempts across multiple pairs in the same group', () => {
  const cat = 'Japanese';
  const pair1 = makePair('rL', 'r', 'l', 'rake', 'lake');
  const pair2 = makePair('rL', 'r', 'l', 'rate', 'late');
  // pair1: 1 correct attempt; pair2: 2 incorrect attempts
  // Together: 3 total, 1 correct → low accuracy
  const progress = {
    [pairId(cat, pair1)]: {
      attempts: [makeAttempt(true)],
    },
    [pairId(cat, pair2)]: {
      attempts: [makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pair1, pair2], cat);
  assert.ok(result !== null, 'expected a recommendation');
  assert.strictEqual(result.groupId, 'rL');
  // Accuracy: 1/3 ≈ 0.333
  assert.ok(Math.abs(result.recentAccuracy - 1 / 3) < 0.01);
});

runTest('uses deterministic alphabetical tie-breaking when accuracies are equal', () => {
  const cat = 'Japanese';
  const pairBV = makePair('bV', 'b', 'v', 'ban', 'van');
  const pairRL = makePair('rL', 'r', 'l', 'rake', 'lake');
  // Both groups: 1 out of 3 correct (identical accuracy)
  const progress = {
    [pairId(cat, pairBV)]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
    [pairId(cat, pairRL)]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pairBV, pairRL], cat);
  assert.ok(result !== null);
  // 'bV' < 'rL' alphabetically → 'bV' wins the tie
  assert.strictEqual(result.groupId, 'bV');
});

runTest('ignores progress entries from other categories', () => {
  const cat = 'Japanese';
  const pair = makePair('rL', 'r', 'l', 'rake', 'lake');
  // Progress key is for a different category ('Spanish') — the local pair is
  // unpracticed, so it surfaces as a new-pair recommendation, not based on the
  // Spanish accuracy.
  const progress = {
    [`Spanish__rL__rake_lake`]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pair], cat);
  assert.ok(result !== null);
  assert.strictEqual(result.reason, 'newPair');
  assert.strictEqual(result.groupId, 'rL');
});

runTest('does not divide by zero when a group has an empty attempts array', () => {
  const cat = 'Japanese';
  const pair = makePair('rL', 'r', 'l', 'rake', 'lake');
  const progress = {
    [pairId(cat, pair)]: { attempts: [] },
  };
  // Empty array → no crash; treated as unpracticed → new-pair recommendation.
  assert.doesNotThrow(() => {
    const result = computePracticeNextRecommendation(progress, [pair], cat);
    assert.ok(result !== null);
    assert.strictEqual(result.reason, 'newPair');
    assert.strictEqual(result.groupId, 'rL');
  });
});

console.log('\nAll recommendNextPractice tests passed.');
