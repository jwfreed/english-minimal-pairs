const assert = require('assert');
const crypto = require('crypto');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  contrastRegistry,
  createContrastRegistry,
} = loadTsModule(
  path.join(
    __dirname,
    '..',
    'src',
    'domain',
    'contrast',
    'contrastRegistry.ts'
  )
);
const {
  createLanguageRegistry,
  LANGUAGE_IDS,
  languageRegistry,
} = loadTsModule(
  path.join(__dirname, '..', 'src', 'domain', 'language', 'language.ts')
);
const { defineContrastId, defineLanguageId } = loadTsModule(
  path.join(__dirname, '..', 'src', 'domain', 'identity.ts')
);

// This fingerprint protects released ContrastId assignments only. It is not a
// fingerprint of mutable metadata, examples, or display content. Existing IDs
// may not be renamed, reassigned, or repurposed; new identities are append-only.
const RELEASED_CONTRAST_ID_COUNT = 70;
const RELEASED_CONTRAST_ID_SHA256 =
  '49267d3d95e13772532c6c7e7e078914f7fe3c7e2a8caf6268b2d4a80e54aab3';

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
    id: defineContrastId('contrast.japanese.rL'),
    languageId: LANGUAGE_IDS.japanese,
    phoneme1: 'r',
    phoneme2: 'l',
    examples: [makePair()],
    legacyGroup: 'rL',
    ...overrides,
  };
}

runTest('supported LanguageIds are explicit and deterministic', () => {
  assert.strictEqual(languageRegistry.languages.length, 14);
  assert.strictEqual(
    languageRegistry.getById(defineLanguageId('lang.japanese')).id,
    'lang.japanese'
  );
  assert.deepStrictEqual(
    Array.from(languageRegistry.languages, (language) => language.id),
    Array.from(languageRegistry.languages, (language) => language.id).sort()
  );
});

runTest('duplicate LanguageIds fail registry validation', () => {
  const japanese = { id: LANGUAGE_IDS.japanese };

  assert.throws(
    () => createLanguageRegistry([japanese, japanese]),
    /Duplicate language ID/
  );
});

runTest('the shipped registry declares one stable identity per language contrast', () => {
  const contrastIds = Array.from(
    contrastRegistry.contrasts,
    (contrast) => contrast.id
  );
  const identityFingerprint = crypto
    .createHash('sha256')
    .update(JSON.stringify(contrastIds))
    .digest('hex');

  assert.strictEqual(contrastIds.length, RELEASED_CONTRAST_ID_COUNT);
  assert.strictEqual(identityFingerprint, RELEASED_CONTRAST_ID_SHA256);

  const japanese = contrastRegistry.getById(
    defineContrastId('contrast.japanese.rL')
  );
  const korean = contrastRegistry.getById(
    defineContrastId('contrast.korean.rL')
  );

  assert.strictEqual(japanese.id, 'contrast.japanese.rL');
  assert.strictEqual(japanese.languageId, 'lang.japanese');
  assert.strictEqual(korean.id, 'contrast.korean.rL');
  assert.strictEqual(korean.languageId, 'lang.korean');
  assert.notStrictEqual(japanese.id, korean.id);
});

runTest('registry lookup and enumeration are deterministic', () => {
  const first = makeContrast();
  const second = makeContrast({
    id: defineContrastId('contrast.japanese.bV'),
    phoneme1: 'b',
    phoneme2: 'v',
    examples: [
      makePair({
        group: 'bV',
        contrastPhoneme1: 'b',
        contrastPhoneme2: 'v',
      }),
    ],
    legacyGroup: 'bV',
  });
  const forward = createContrastRegistry([first, second]);
  const reversed = createContrastRegistry([second, first]);
  const firstId = defineContrastId('contrast.japanese.rL');

  assert.strictEqual(forward.getById(firstId), first);
  assert.strictEqual(reversed.getById(firstId), first);
  assert.strictEqual(
    forward.getById(defineContrastId('contrast.japanese.notRegistered')),
    undefined
  );
  assert.deepStrictEqual(
    Array.from(forward.contrasts, (contrast) => contrast.id),
    Array.from(reversed.contrasts, (contrast) => contrast.id)
  );
});

runTest('duplicate ContrastIds fail registry validation', () => {
  const contrast = makeContrast();

  assert.throws(
    () => createContrastRegistry([contrast, contrast]),
    /Duplicate contrast ID/
  );
});

runTest('invalid and unscoped ContrastIds fail registry validation', () => {
  assert.throws(
    () =>
      createContrastRegistry([makeContrast({ id: 'contrast.rL' })]),
    /Contrast ID must be language-scoped/
  );
  assert.throws(
    () =>
      createContrastRegistry([
        makeContrast({ id: 'contrast.japanese.r/L' }),
      ]),
    /Contrast ID must be language-scoped/
  );
});

runTest('Contrast language ownership must match its ID namespace', () => {
  assert.throws(
    () =>
      createContrastRegistry([
        makeContrast({ languageId: LANGUAGE_IDS.korean }),
      ]),
    /owned by "lang.korean"; expected "lang.japanese"/
  );
});

runTest('missing required Contrast metadata fails registry validation', () => {
  assert.throws(
    () => createContrastRegistry([makeContrast({ phoneme1: '' })]),
    /Contrast phoneme1 must be a non-empty string/
  );
  assert.throws(
    () => createContrastRegistry([makeContrast({ examples: [] })]),
    /Contrast must include at least one Pair example/
  );
  assert.throws(
    () => createContrastRegistry([makeContrast({ languageId: undefined })]),
    /language ID must be a non-empty string/
  );
});
