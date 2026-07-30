const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { defineContrast } = loadTsModule(
  path.join(__dirname, '..', 'src', 'domain', 'contrast', 'contrast.ts')
);
const { defineContrastId } = loadTsModule(
  path.join(__dirname, '..', 'src', 'domain', 'identity.ts')
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

function makePair(overrides = {}) {
  return {
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
  };
}

function makeContrast(overrides = {}) {
  return {
    id: defineContrastId('contrast-r-l-001'),
    phoneme1: 'r',
    phoneme2: 'l',
    examples: [makePair()],
    legacyGroup: 'rL',
    ...overrides,
  };
}

runTest('Contrast owns stable identity, metadata, and Pair examples', () => {
  const pair = makePair();
  const contrast = defineContrast(makeContrast({ examples: [pair] }));

  assert.strictEqual(contrast.id, 'contrast-r-l-001');
  assert.strictEqual(contrast.phoneme1, 'r');
  assert.strictEqual(contrast.phoneme2, 'l');
  assert.strictEqual(contrast.examples[0], pair);
});

runTest('Contrast preserves the existing Pair.group compatibility relationship', () => {
  const pair = makePair();
  const contrast = defineContrast(makeContrast({ examples: [pair] }));

  assert.strictEqual(contrast.legacyGroup, pair.group);
  assert.strictEqual(pair.group, 'rL');
});

runTest('Contrast identity is independent from example word content', () => {
  const original = defineContrast(makeContrast());
  const corrected = defineContrast(
    makeContrast({ examples: [makePair({ word1: 'write' })] })
  );

  assert.strictEqual(corrected.id, original.id);
  assert.notStrictEqual(
    corrected.examples[0].word1,
    original.examples[0].word1
  );
});

runTest('Contrast requires phonological metadata and at least one example', () => {
  assert.throws(
    () => defineContrast(makeContrast({ phoneme1: ' ' })),
    /Contrast phoneme1 must be a non-empty string/
  );
  assert.throws(
    () => defineContrast(makeContrast({ phoneme2: '' })),
    /Contrast phoneme2 must be a non-empty string/
  );
  assert.throws(
    () => defineContrast(makeContrast({ examples: [] })),
    /Contrast must include at least one Pair example/
  );
});

runTest('Contrast rejects an empty legacy compatibility group', () => {
  assert.throws(
    () => defineContrast(makeContrast({ legacyGroup: ' ' })),
    /Contrast legacy group must be a non-empty string/
  );
});

runTest('Contrast rejects Pair examples from another legacy group', () => {
  assert.throws(
    () =>
      defineContrast(
        makeContrast({ examples: [makePair({ group: 'bV' })] })
      ),
    /uses legacy group "bV"; expected "rL"/
  );
});

runTest('Contrast rejects Pair examples with inconsistent phoneme metadata', () => {
  assert.throws(
    () =>
      defineContrast(
        makeContrast({
          examples: [makePair({ contrastPhoneme2: 'n' })],
        })
      ),
    /phoneme metadata inconsistent with its Contrast/
  );
});
