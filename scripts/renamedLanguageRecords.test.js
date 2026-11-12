// Characterizes what happens to learner records written under the six language
// labels renamed in February 2026 (LANGUAGE_KEY_MIGRATION in LanguageContext).
//
// Timeline, from git history:
//   eb897cd 2026-02-18  five labels renamed (app 1.0.0)
//   67b72d6 2026-02-21  sixth label renamed, and '@mastery_<label>' introduced
//                       in the same commit (mastery was in-memory before)
//   626f718 2026-06-06  per-category '@placementDone_<label>' introduced
// So no released code ever wrote mastery or placement under an old label. Only
// attempt history ('@pairProgress_v2', keyed '<label>__<group>__<w1>_<w2>')
// predates the renames.
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const RENAMES = [
  ['idioma español', 'Español'],
  ['اللغة العربية', 'العربية'],
  ['русский язык', 'Русский'],
  ['زبان فارسی', 'فارسی'],
  ['bahasa Indo', 'Bahasa Indonesia'],
  ['हिंदी/اردو', 'हिन्दी / اردو'],
];
const plain = (value) => JSON.parse(JSON.stringify(value));

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
    async removeItem(key) {
      values.delete(key);
    },
  };
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

module.exports = (async () => {
  const cache = new Map();
  const { minimalPairs } = loadTsModule(path.join(ROOT, 'src/constants/minimalPairs.ts'), cache);
  const { historicalIdentityMapping } = loadTsModule(
    path.join(ROOT, 'src/domain/compatibility/historicalIdentityMapping.ts'),
    cache
  );
  const { projectPairProgressToContrasts } = loadTsModule(
    path.join(ROOT, 'src/domain/contrast/pairProgressProjection.ts'),
    cache
  );
  const { buildPairId } = loadTsModule(path.join(ROOT, 'utils/idHelpers.ts'), cache);
  const { buildMasteryStorageKey, buildPlacementStorageKey } = loadTsModule(
    path.join(ROOT, 'src/domain/masteryPersistence.ts'),
    cache
  );
  const ATTEMPT = { isCorrect: true, timestamp: 1700000000000, durationMin: 0.05 };

  await runTest('each renamed label is a verified alias of exactly one current inventory', () => {
    for (const [oldLabel, newLabel] of RENAMES) {
      const language = historicalIdentityMapping.resolveCategoryLabel(newLabel);
      assert.ok(language, newLabel);
      assert.strictEqual(historicalIdentityMapping.resolveCategoryLabel(oldLabel), language, oldLabel);
      assert.ok(minimalPairs.some((category) => category.category === newLabel), newLabel);
      assert.ok(!minimalPairs.some((category) => category.category === oldLabel), oldLabel);
    }
  });

  await runTest('the active scheme reads mastery and placement under the current label only', () => {
    for (const [oldLabel, newLabel] of RENAMES) {
      assert.strictEqual(buildMasteryStorageKey(newLabel), `@mastery_${newLabel}`);
      assert.strictEqual(buildPlacementStorageKey(newLabel), `@placementDone_${newLabel}`);
      assert.notStrictEqual(buildMasteryStorageKey(oldLabel), buildMasteryStorageKey(newLabel));
    }
  });

  await runTest('old-label attempt history is attributed to its contrast but is not found by the Results lookup', () => {
    for (const [oldLabel, newLabel] of RENAMES) {
      const category = minimalPairs.find((entry) => entry.category === newLabel);
      const pair = category.pairs[0];
      const oldKey = buildPairId(pair, oldLabel);
      const newKey = buildPairId(pair, newLabel);
      assert.notStrictEqual(oldKey, newKey);

      const progress = { [oldKey]: { attempts: [ATTEMPT] } };
      // Results looks rows up by the current label's pair ID.
      assert.strictEqual(progress[newKey], undefined);

      // The Contrast-level projection resolves the old key through the alias.
      const projection = projectPairProgressToContrasts(progress);
      assert.strictEqual(projection.unmappedEntries.length, 0, oldLabel);
      assert.strictEqual(projection.contrasts.length, 1, oldLabel);
      assert.strictEqual(
        projection.contrasts[0].contrastId,
        historicalIdentityMapping.resolveContrast(newLabel, pair.group)
      );
      assert.strictEqual(projection.contrasts[0].totals.attemptCount, 1);
    }
  });

  await runTest('saving under the new label never rewrites or removes old-label history', async () => {
    const [oldLabel, newLabel] = RENAMES[0];
    const pair = minimalPairs.find((entry) => entry.category === newLabel).pairs[0];
    const oldKey = buildPairId(pair, oldLabel);
    const newKey = buildPairId(pair, newLabel);
    const stored = { [oldKey]: { attempts: [ATTEMPT, { ...ATTEMPT, timestamp: ATTEMPT.timestamp + 1 }] } };
    const storage = createStorage({ '@pairProgress_v2': JSON.stringify(stored) });
    const { saveAttempt } = loadTsModule(path.join(ROOT, 'src/storage/progressStorage.ts'), new Map(), {
      '@react-native-async-storage/async-storage': storage,
    });

    await saveAttempt(newKey, true, 0.02, ATTEMPT.timestamp + 2);
    const after = JSON.parse(storage.values.get('@pairProgress_v2'));
    assert.deepStrictEqual(plain(after[oldKey]), stored[oldKey]);
    assert.strictEqual(after[newKey].attempts.length, 1);
    assert.deepStrictEqual(Object.keys(after).sort(), [oldKey, newKey].sort());
  });
})();
