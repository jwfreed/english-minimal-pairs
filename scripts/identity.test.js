const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');
const { loadRepoData } = require('./validate-data');

const {
  assertUniqueContrastIds,
  assertUniqueLanguageIds,
  assertUniquePairIds,
  defineContrastId,
  defineLanguageId,
  definePairId,
  SUPPORTED_LANGUAGE_IDS,
} = loadTsModule(path.join(__dirname, '..', 'src', 'domain', 'identity.ts'));
const { buildPairId } = loadTsModule(
  path.join(__dirname, '..', 'utils', 'idHelpers.ts')
);

// Identity-bearing legacy fields are guarded because they participate in stored
// learner identity:
// - contrast mastery: category storage key + Pair.group
// - pair progress: category + Pair.group + word1 + word2
//
// IPA, difficulty, position, phoneme, playback, and audio metadata are
// intentionally absent. This protects compatibility, not all dataset content.
// Changing a guarded value requires an explicit, tested migration.
const HISTORICAL_CONTRAST_IDENTITY_COUNT = 70;
const HISTORICAL_CONTRAST_IDENTITY_SHA256 =
  '4a03abbae1db87f1feefce3aea9478e4d274baf2966229e1d9b2cbb987284304';
const HISTORICAL_PAIR_PROGRESS_ID_COUNT = 813;
const HISTORICAL_PAIR_PROGRESS_ID_SHA256 =
  'ac8c44edf27c06079bc264fe59759b4269fb0a9fdca639af2c8ddbf144491570';

// Additive examples are allowed. Register each post-baseline pair's exact
// legacy progress key here. Registered keys are excluded from the original
// aggregate fingerprint but must remain present afterward, so additions do not
// rewrite the baseline and their learner history is protected once released.
// This registry is append-only; changing or removing a released key requires an
// explicit compatibility migration.
const POST_BASELINE_PAIR_PROGRESS_IDS = [];

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function fingerprint(values) {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify([...values].sort()))
    .digest('hex');
}

function partitionPairProgressIds(
  pairProgressIds,
  postBaselineIds = POST_BASELINE_PAIR_PROGRESS_IDS
) {
  const registeredIds = new Set(postBaselineIds);
  assert.strictEqual(
    registeredIds.size,
    postBaselineIds.length,
    'post-baseline pair progress IDs must be unique'
  );

  const currentIds = new Set(pairProgressIds);
  for (const pairProgressId of registeredIds) {
    assert(
      currentIds.has(pairProgressId),
      `registered post-baseline pair progress ID is missing: ${pairProgressId}`
    );
  }

  return {
    historicalPairProgressIds: pairProgressIds.filter(
      (pairProgressId) => !registeredIds.has(pairProgressId)
    ),
    postBaselinePairProgressIds: pairProgressIds.filter((pairProgressId) =>
      registeredIds.has(pairProgressId)
    ),
  };
}

function getIdentityInventory() {
  const { minimalPairs } = loadRepoData();
  const contrastIdentities = new Set();
  const pairProgressIds = [];

  for (const category of minimalPairs) {
    for (const pair of category.pairs) {
      contrastIdentities.add(`${category.category}\u0000${pair.group}`);
      pairProgressIds.push(buildPairId(pair, category.category));
    }
  }

  return { contrastIdentities: [...contrastIdentities], pairProgressIds };
}

runTest('display-label changes do not change contrast identity', () => {
  const contrastId = defineContrastId('contrast.japanese.rL');
  const original = { id: contrastId, displayLabel: '/r/ vs /l/' };
  const relabeled = { ...original, displayLabel: 'R and L sounds' };

  assert.strictEqual(relabeled.id, original.id);
  assert.notStrictEqual(relabeled.displayLabel, original.displayLabel);
});

runTest('LanguageIds are stable and independent from display labels', () => {
  const languageId = defineLanguageId('lang.japanese');
  const original = { id: languageId, displayLabel: '日本語' };
  const relabeled = { ...original, displayLabel: 'Japanese' };

  assert.strictEqual(relabeled.id, original.id);
  assert.notStrictEqual(relabeled.displayLabel, original.displayLabel);
  assert.deepStrictEqual(Array.from(SUPPORTED_LANGUAGE_IDS), [
    'lang.arabic',
    'lang.cantonese',
    'lang.farsi',
    'lang.hindi-urdu',
    'lang.indonesian',
    'lang.japanese',
    'lang.korean',
    'lang.mandarin',
    'lang.portuguese',
    'lang.russian',
    'lang.spanish',
    'lang.thai',
    'lang.turkish',
    'lang.vietnamese',
  ]);
});

runTest('word-content changes do not change explicit pair identity', () => {
  const pairId = definePairId('pair-r-l-001');
  const original = { id: pairId, word1: 'right', word2: 'light' };
  const corrected = { ...original, word1: 'write' };

  assert.strictEqual(corrected.id, original.id);
  assert.notStrictEqual(corrected.word1, original.word1);
});

runTest('legacy content-derived progress IDs remain unchanged and distinct from stable IDs', () => {
  const pair = {
    group: 'rL',
    word1: 'right',
    word2: 'light',
  };

  assert.strictEqual(buildPairId(pair, 'Test'), 'Test__rL__right_light');
  assert.notStrictEqual(
    buildPairId({ ...pair, word1: 'write' }, 'Test'),
    buildPairId(pair, 'Test')
  );
  assert.strictEqual(definePairId('pair-r-l-001'), 'pair-r-l-001');
});

runTest('non-identity metadata changes do not affect legacy pair progress identity', () => {
  const pair = {
    group: 'rL',
    word1: 'right',
    word2: 'light',
    ipa1: '/raɪt/',
    difficulty: 1,
    position: 'initial',
    variantRate: 0.8,
  };
  const metadataUpdate = {
    ...pair,
    ipa1: '/ɹaɪt/',
    difficulty: 2,
    position: 'medial',
    variantRate: 0.9,
  };

  assert.strictEqual(
    buildPairId(metadataUpdate, 'Test'),
    buildPairId(pair, 'Test')
  );
});

runTest('identity definitions preserve exact values without normalization', () => {
  assert.strictEqual(
    defineContrastId('contrast.japanese.rL'),
    'contrast.japanese.rL'
  );
  assert.strictEqual(definePairId('Pair_R-L.001'), 'Pair_R-L.001');
});

runTest('historical identity baselines remain stable while additions stay separate', () => {
  const { contrastIdentities, pairProgressIds } = getIdentityInventory();
  const { historicalPairProgressIds, postBaselinePairProgressIds } =
    partitionPairProgressIds(pairProgressIds);

  assert.strictEqual(contrastIdentities.length, HISTORICAL_CONTRAST_IDENTITY_COUNT);
  assert.strictEqual(
    fingerprint(contrastIdentities),
    HISTORICAL_CONTRAST_IDENTITY_SHA256
  );
  assert.strictEqual(
    historicalPairProgressIds.length,
    HISTORICAL_PAIR_PROGRESS_ID_COUNT
  );
  assert.strictEqual(
    fingerprint(historicalPairProgressIds),
    HISTORICAL_PAIR_PROGRESS_ID_SHA256
  );
  assert.deepStrictEqual(
    [...postBaselinePairProgressIds].sort(),
    [...POST_BASELINE_PAIR_PROGRESS_IDS].sort()
  );
});

runTest('registered additive pairs do not rewrite the historical fingerprint', () => {
  const { pairProgressIds } = getIdentityInventory();
  const additivePairProgressId = 'Test__rL__new_novel';
  const { historicalPairProgressIds, postBaselinePairProgressIds } =
    partitionPairProgressIds(
      [...pairProgressIds, additivePairProgressId],
      [...POST_BASELINE_PAIR_PROGRESS_IDS, additivePairProgressId]
    );

  assert.strictEqual(
    historicalPairProgressIds.length,
    HISTORICAL_PAIR_PROGRESS_ID_COUNT
  );
  assert.strictEqual(
    fingerprint(historicalPairProgressIds),
    HISTORICAL_PAIR_PROGRESS_ID_SHA256
  );
  assert(postBaselinePairProgressIds.includes(additivePairProgressId));
});

runTest('historical identity fingerprints are independent of dataset ordering', () => {
  const { contrastIdentities, pairProgressIds } = getIdentityInventory();
  const { historicalPairProgressIds } = partitionPairProgressIds(pairProgressIds);

  assert.strictEqual(
    fingerprint(contrastIdentities),
    fingerprint([...contrastIdentities].reverse())
  );
  assert.strictEqual(
    fingerprint(historicalPairProgressIds),
    fingerprint([...historicalPairProgressIds].reverse())
  );
});

runTest('blank identity values fail validation', () => {
  assert.throws(() => defineContrastId(''), /contrast ID must be a non-empty string/);
  assert.throws(() => defineLanguageId('   '), /language ID must be a non-empty string/);
  assert.throws(() => definePairId('   '), /pair ID must be a non-empty string/);
});

runTest('ContrastIds require an explicit supported language scope', () => {
  assert.throws(
    () => defineContrastId('contrast.rL'),
    /Contrast ID must be language-scoped/
  );
  assert.throws(
    () => defineContrastId('contrast.japanese.r/L'),
    /Contrast ID must be language-scoped/
  );
  assert.throws(
    () => defineContrastId('contrast.french.rL'),
    /unsupported language namespace/
  );
});

runTest('unsupported LanguageIds fail validation', () => {
  assert.throws(
    () => defineLanguageId('lang.ja-JP'),
    /Unsupported language ID/
  );
  assert.throws(
    () => defineLanguageId('Japanese'),
    /Unsupported language ID/
  );
  assert.throws(
    () => defineLanguageId('lang.french'),
    /Unsupported language ID/
  );
});

runTest('duplicate contrast, language, and pair IDs fail validation', () => {
  const contrastId = defineContrastId('contrast.japanese.rL');
  const languageId = defineLanguageId('lang.japanese');
  const pairId = definePairId('pair-r-l-001');

  assert.throws(
    () => assertUniqueContrastIds([contrastId, contrastId]),
    /Duplicate contrast ID/
  );
  assert.throws(
    () => assertUniqueLanguageIds([languageId, languageId]),
    /Duplicate language ID/
  );
  assert.throws(
    () => assertUniquePairIds([pairId, pairId]),
    /Duplicate pair ID/
  );
});

runTest('identity validation is independent of declaration order', () => {
  const first = definePairId('pair-r-l-001');
  const second = definePairId('pair-r-l-002');

  assert.doesNotThrow(() => assertUniquePairIds([first, second]));
  assert.doesNotThrow(() => assertUniquePairIds([second, first]));
});
