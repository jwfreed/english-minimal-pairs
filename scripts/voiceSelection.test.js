const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  collectEligibleVoices,
  applyUserExclusions,
  buildVoiceRotationPool,
} = loadTsModule(path.join(__dirname, '..', 'src', 'domain', 'voiceSelection.ts'));

// Values returned by the vm-loaded module live in another realm; strip
// prototypes before deep comparison (same pattern as masteryPersistence.test.js).
const plain = (value) => JSON.parse(JSON.stringify(value));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// Voice factory: quality is 'Enhanced' | 'Default' (expo-speech serialization)
function v(identifier, name, quality, language) {
  return { identifier, name, quality, language };
}

runTest('collectEligibleVoices keeps only en-* voices', () => {
  const result = collectEligibleVoices([
    v('us-1', 'Samantha', 'Default', 'en-US'),
    v('fr-1', 'Thomas', 'Enhanced', 'fr-FR'),
    v('gb-1', 'Daniel', 'Default', 'en-GB'),
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier).sort()),
    ['gb-1', 'us-1']
  );
});

runTest('collectEligibleVoices strips novelty voices by name and locale+name', () => {
  const result = collectEligibleVoices([
    v('us-1', 'Samantha', 'Default', 'en-US'),
    v('us-2', 'Zarvox', 'Default', 'en-US'),
    v('us-3', 'Good News', 'Default', 'en-US'),
    v('gb-1', 'Sandy', 'Default', 'en-GB'), // locale+name exclusion
    v('us-4', 'Sandy', 'Default', 'en-US'), // same name, different locale: kept
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier).sort()),
    ['us-1', 'us-4']
  );
});

runTest('collectEligibleVoices sorts enhanced first, then locale, then name', () => {
  const result = collectEligibleVoices([
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('gb-e', 'Daniel', 'Enhanced', 'en-GB'),
    v('au-e', 'Karen', 'Enhanced', 'en-AU'),
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['au-e', 'gb-e', 'us-e', 'us-d']
  );
});

runTest('collectEligibleVoices collapses duplicate identifiers deterministically', () => {
  const a = v('dup', 'Karen', 'Default', 'en-AU');
  const b = v('dup', 'Karen', 'Enhanced', 'en-AU');
  const forward = collectEligibleVoices([a, b]);
  const backward = collectEligibleVoices([b, a]);
  assert.strictEqual(forward.length, 1);
  assert.strictEqual(forward[0].quality, 'Enhanced'); // enhanced wins
  assert.deepStrictEqual(plain(forward), plain(backward)); // input order irrelevant
});

runTest('applyUserExclusions removes excluded identifiers and keeps order', () => {
  const pool = collectEligibleVoices([
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('gb-e', 'Daniel', 'Enhanced', 'en-GB'),
  ]);
  const result = applyUserExclusions(pool, new Set(['gb-e']));
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['us-e', 'us-d']
  );
});

runTest('applyUserExclusions with no exclusions returns the same voices', () => {
  const pool = collectEligibleVoices([v('us-1', 'Samantha', 'Default', 'en-US')]);
  assert.deepStrictEqual(plain(applyUserExclusions(pool, new Set())), plain(pool));
});

runTest('buildVoiceRotationPool orders by tier and keeps every voice', () => {
  const pool = [
    v('au-d', 'Lee', 'Default', 'en-AU'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
    v('gb-e', 'Daniel', 'Enhanced', 'en-GB'),
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
  ];
  const result = buildVoiceRotationPool(pool);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['us-e', 'us-d', 'gb-e', 'au-d'] // enhanced US, default US, enhanced en-*, default en-*
  );
});

runTest('buildVoiceRotationPool does not discard defaults when enhanced exist', () => {
  const result = buildVoiceRotationPool([
    v('us-e', 'Evan', 'Enhanced', 'en-US'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
  ]);
  assert.strictEqual(result.length, 2);
});

runTest('buildVoiceRotationPool with no enhanced voices keeps all defaults usable', () => {
  const result = buildVoiceRotationPool([
    v('gb-d', 'Serena', 'Default', 'en-GB'),
    v('us-d', 'Aaron', 'Default', 'en-US'),
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['us-d', 'gb-d']
  );
});

runTest('buildVoiceRotationPool with only non-US voices still orders enhanced first', () => {
  const result = buildVoiceRotationPool([
    v('gb-d', 'Serena', 'Default', 'en-GB'),
    v('au-e', 'Karen', 'Enhanced', 'en-AU'),
  ]);
  assert.deepStrictEqual(
    plain(result.map((x) => x.identifier)),
    ['au-e', 'gb-d']
  );
});

runTest('buildVoiceRotationPool returns [] for an empty pool', () => {
  assert.deepStrictEqual(plain(buildVoiceRotationPool([])), []);
});

runTest('buildVoiceRotationPool ties break deterministically (language, name, id)', () => {
  const a = v('id-a', 'Karen', 'Enhanced', 'en-AU');
  const b = v('id-b', 'Karen', 'Enhanced', 'en-AU');
  assert.deepStrictEqual(
    plain(buildVoiceRotationPool([b, a]).map((x) => x.identifier)),
    ['id-a', 'id-b']
  );
});
