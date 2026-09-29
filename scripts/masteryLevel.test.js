// Decision 020: the persisted per-contrast value is a mastery level
// (1 + completed tiers). This helper is its only interpretation.
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const level = loadTsModule(
  path.join(__dirname, '..', 'src', 'domain', 'masteryLevel.ts')
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

runTest('levels 1–6 keep their practice-tier meaning and 7 is completion', () => {
  const rows = [1, 2, 3, 4, 5, 6, 7].map((value) => [
    value,
    level.practiceTierOf(value),
    level.completedTiersOf(value),
    level.isMasteredLevel(value),
  ]);
  assert.deepStrictEqual(rows, [
    [1, 1, 0, false],
    [2, 2, 1, false],
    [3, 3, 2, false],
    [4, 4, 3, false],
    [5, 5, 4, false],
    [6, 6, 5, false],
    [7, 6, 6, true],
  ]);
});

runTest('an absent level is an unstarted contrast', () => {
  assert.strictEqual(level.practiceTierOf(undefined), 1);
  assert.strictEqual(level.completedTiersOf(undefined), 0);
  assert.strictEqual(level.isMasteredLevel(undefined), false);
  assert.strictEqual(level.nextMasteryLevel(undefined), 2);
});

runTest('advancing stops at completion instead of inventing a seventh tier', () => {
  assert.strictEqual(level.nextMasteryLevel(5), 6);
  assert.strictEqual(level.nextMasteryLevel(6), 7);
  assert.strictEqual(level.nextMasteryLevel(7), 7);
  assert.strictEqual(level.MASTERED_LEVEL, 7);
  assert.strictEqual(level.FINAL_PRACTICE_TIER, 6);
});

runTest('only integers 1 through 7 are mastery levels', () => {
  for (const value of [1, 4, 7]) assert.strictEqual(level.isMasteryLevel(value), true);
  for (const value of [0, 8, 6.5, -1, '7', null, undefined, NaN]) {
    assert.strictEqual(level.isMasteryLevel(value), false, String(value));
  }
});

runTest('practice tier maps never contain level 7', () => {
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(level.practiceTierMap({ rL: 7, bV: 6, sZ: 2 }))),
    { rL: 6, bV: 6, sZ: 2 }
  );
});
