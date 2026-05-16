const assert = require('assert');
const {
  validateDatasetContract,
  formatValidationError,
} = require('./validate-data');

const makePair = (difficulty, overrides = {}) => ({
  word1: `word${difficulty}a`,
  word2: `word${difficulty}b`,
  ipa1: `/a${difficulty}/`,
  ipa2: `/b${difficulty}/`,
  difficulty,
  group: 'testGroup',
  position: 'initial',
  contrastPhoneme1: 'a',
  contrastPhoneme2: 'b',
  ...overrides,
});

const makeCategory = (category, pairs = [1, 2, 3, 4, 5, 6].map(makePair)) => ({
  category,
  pairs,
});

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('reports category drift across translations and locale maps', () => {
  const result = validateDatasetContract({
    minimalPairs: [makeCategory('हिन्दी / اردو')],
    translationLanguageKeys: ['हिंदी/اردو'],
    localeLanguageKeys: ['हिंदी/اردو'],
    expectedCategoryCount: 1,
    expectedGroupsPerCategory: 1,
  });

  assert(
    result.errors.some(
      (error) =>
        error.rule === 'CATEGORY_TRANSLATION_ALIGNMENT' &&
        error.category === 'हिन्दी / اردو' &&
        error.message.includes('alternateLanguages')
    )
  );
  assert(
    result.errors.some(
      (error) =>
        error.rule === 'CATEGORY_LOCALE_ALIGNMENT' &&
        error.category === 'हिन्दी / اردو' &&
        error.message.includes('locale')
    )
  );
});

runTest('malformed pairs include useful category group tier and word context', () => {
  const pairs = [1, 2, 3, 4, 5, 6].map(makePair);
  pairs[1] = makePair(2, {
    word1: '',
    ipa1: '',
    contrastPhoneme1: '',
    position: 'middle',
  });

  const result = validateDatasetContract({
    minimalPairs: [makeCategory('Test Language', pairs)],
    translationLanguageKeys: ['Test Language'],
    localeLanguageKeys: ['Test Language'],
    expectedCategoryCount: 1,
    expectedGroupsPerCategory: 1,
  });

  const badWord = result.errors.find((error) => error.rule === 'PAIR_WORD_NON_EMPTY');
  assert(badWord, 'expected empty word error');
  assert.strictEqual(badWord.category, 'Test Language');
  assert.strictEqual(badWord.group, 'testGroup');
  assert.strictEqual(badWord.tier, 2);
  assert.strictEqual(badWord.pairId, 'Test Language__testGroup___word2b');
  assert.deepStrictEqual(badWord.words, ['', 'word2b']);

  const formatted = formatValidationError(badWord);
  assert(formatted.includes('Test Language'));
  assert(formatted.includes('testGroup'));
  assert(formatted.includes('tier 2'));
  assert(formatted.includes('PAIR_WORD_NON_EMPTY'));
  assert(formatted.includes('/word2b'));
});
