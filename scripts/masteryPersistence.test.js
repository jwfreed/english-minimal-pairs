const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  PLACEMENT_DONE_KEY,
  buildMasteryStorageKey,
  getDefaultMastery,
  parsePlacementDone,
  parseStoredMastery,
  serializeMastery,
  serializePlacementDone,
  shouldShowPlacementTest,
} = loadTsModule(path.join(__dirname, '..', 'app', 'domain', 'masteryPersistence.ts'));

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

runTest('buildMasteryStorageKey is deterministic per category', () => {
  assert.strictEqual(buildMasteryStorageKey('日本語'), '@mastery_日本語');
  assert.strictEqual(buildMasteryStorageKey('Español'), '@mastery_Español');
  assert.strictEqual(buildMasteryStorageKey(''), '@mastery_');
});

runTest('parseStoredMastery returns defaults for missing stored mastery', () => {
  const fallback = { rL: 2 };

  assert.deepStrictEqual(plain(parseStoredMastery(null)), plain(getDefaultMastery()));
  assert.deepStrictEqual(plain(parseStoredMastery('', fallback)), fallback);
});

runTest('parseStoredMastery returns fallback for malformed stored mastery', () => {
  const fallback = { rL: 3 };

  assert.deepStrictEqual(plain(parseStoredMastery('{not json', fallback)), fallback);
  assert.deepStrictEqual(plain(parseStoredMastery('"not a mastery map"', fallback)), fallback);
  assert.deepStrictEqual(plain(parseStoredMastery('[["rL",2]]', fallback)), fallback);
});

runTest('valid stored mastery round-trips through serialize and parse', () => {
  const mastery = { rL: 2, vW: 5 };

  assert.deepStrictEqual(plain(parseStoredMastery(serializeMastery(mastery))), mastery);
});

runTest('parseStoredMastery preserves valid unknown group keys intentionally', () => {
  const stored = serializeMastery({ rL: 2, legacyGroup: 4 });

  assert.deepStrictEqual(plain(parseStoredMastery(stored)), { rL: 2, legacyGroup: 4 });
});

runTest('parseStoredMastery rejects invalid tier values without dropping valid progress', () => {
  const stored = JSON.stringify({
    rL: 2,
    tooLow: 0,
    tooHigh: 7,
    decimal: 2.5,
    text: '3',
    missing: null,
  });

  assert.deepStrictEqual(plain(parseStoredMastery(stored)), { rL: 2 });
});

runTest('placement completion state parses safely', () => {
  assert.strictEqual(PLACEMENT_DONE_KEY, '@placementDone');
  assert.strictEqual(serializePlacementDone(), '1');
  assert.strictEqual(parsePlacementDone(null), false);
  assert.strictEqual(parsePlacementDone('1'), true);
  assert.strictEqual(parsePlacementDone('unexpected legacy value'), true);
  assert.strictEqual(shouldShowPlacementTest(null), true);
  assert.strictEqual(shouldShowPlacementTest('1'), false);
});
