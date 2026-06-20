const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const PROJECT_ROOT = path.join(__dirname, '..');
const EXPECTED_CATEGORY_COUNT = 14;
const EXPECTED_GROUP_COUNT = 5;
const EXPECTED_TIERS = [1, 2, 3, 4, 5, 6];
const VALID_POSITIONS = new Set(['initial', 'medial', 'final']);
const PHONEMES_NOT_EXPECTED_IN_IPA = new Set(['∅']);

function buildPairId(pair, category) {
  return `${category}__${pair.group}__${pair.word1}_${pair.word2}`;
}

function createError(rule, message, context = {}) {
  const pair = context.pair;
  return {
    rule,
    message,
    category: context.category,
    group: context.group ?? pair?.group,
    tier: context.tier ?? pair?.difficulty,
    pairId:
      context.pairId ??
      (pair && context.category ? buildPairId(pair, context.category) : undefined),
    words: context.words ?? (pair ? [pair.word1, pair.word2] : undefined),
  };
}

function formatValidationError(error) {
  const parts = [`[${error.rule}]`];
  if (error.category) parts.push(`category "${error.category}"`);
  if (error.group) parts.push(`group "${error.group}"`);
  if (error.tier !== undefined) parts.push(`tier ${error.tier}`);
  if (error.pairId) parts.push(`pair "${error.pairId}"`);
  if (error.words) parts.push(`words "${error.words[0]}/${error.words[1]}"`);
  parts.push(`- ${error.message}`);
  return parts.join(' ');
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function sortedUnique(values) {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b)));
}

function normalizeWordForDuplicateCheck(word) {
  return String(word).trim().toLowerCase();
}

function validateCategoryAlignment({
  categoryKeys,
  translationLanguageKeys,
  localeLanguageKeys,
}) {
  const errors = [];
  const categorySet = new Set(categoryKeys);
  const translationSet = new Set(translationLanguageKeys);
  const localeSet = new Set(localeLanguageKeys);

  for (const category of categoryKeys) {
    if (!translationSet.has(category)) {
      errors.push(
        createError(
          'CATEGORY_TRANSLATION_ALIGNMENT',
          `Category is missing from alternateLanguages keys: ${category}`,
          { category }
        )
      );
    }
    if (!localeSet.has(category)) {
      errors.push(
        createError(
          'CATEGORY_LOCALE_ALIGNMENT',
          `Category is not emitted by locale auto-selection maps: ${category}`,
          { category }
        )
      );
    }
  }

  for (const key of translationLanguageKeys) {
    if (key !== 'English' && !categorySet.has(key)) {
      errors.push(
        createError(
          'TRANSLATION_CATEGORY_ALIGNMENT',
          `alternateLanguages key has no matching minimal-pair category: ${key}`,
          { category: key }
        )
      );
    }
  }

  for (const key of localeLanguageKeys) {
    if (key !== 'English' && !categorySet.has(key)) {
      errors.push(
        createError(
          'LOCALE_CATEGORY_ALIGNMENT',
          `Locale auto-selection emits a key with no matching minimal-pair category: ${key}`,
          { category: key }
        )
      );
    }
  }

  return errors;
}

function validatePairShape(pair, category) {
  const errors = [];
  const group = isNonEmptyString(pair?.group) ? pair.group : undefined;
  const tier = pair?.difficulty;
  const context = { category, group, tier, pair };

  if (!isNonEmptyString(pair?.word1) || !isNonEmptyString(pair?.word2)) {
    errors.push(
      createError('PAIR_WORD_NON_EMPTY', 'Both word fields must be non-empty strings.', context)
    );
  } else if (pair.word1.trim() === pair.word2.trim()) {
    errors.push(
      createError('PAIR_WORDS_DISTINCT', 'word1 and word2 must be different words.', context)
    );
  }

  if (!isNonEmptyString(pair?.ipa1) || !isNonEmptyString(pair?.ipa2)) {
    errors.push(
      createError('PAIR_IPA_NON_EMPTY', 'Both IPA fields must be non-empty strings.', context)
    );
  }

  if (!isNonEmptyString(pair?.group)) {
    errors.push(createError('PAIR_GROUP_NON_EMPTY', 'Group must be a non-empty string.', context));
  }

  if (!Number.isInteger(pair?.difficulty) || !EXPECTED_TIERS.includes(pair.difficulty)) {
    errors.push(
      createError(
        'PAIR_DIFFICULTY_VALID',
        `Difficulty must be one of ${EXPECTED_TIERS.join(', ')}.`,
        context
      )
    );
  }

  if (!isNonEmptyString(pair?.contrastPhoneme1) || !isNonEmptyString(pair?.contrastPhoneme2)) {
    errors.push(
      createError(
        'PAIR_CONTRAST_PHONEME_PRESENT',
        'Both contrast phoneme fields must be present.',
        context
      )
    );
  }

  if (!VALID_POSITIONS.has(pair?.position)) {
    errors.push(
      createError(
        'PAIR_POSITION_VALID',
        `Position must be one of ${[...VALID_POSITIONS].join(', ')}.`,
        context
      )
    );
  }

  const phonemeChecks = [
    ['contrastPhoneme1', 'ipa1'],
    ['contrastPhoneme2', 'ipa2'],
  ];
  for (const [phonemeField, ipaField] of phonemeChecks) {
    const phoneme = pair?.[phonemeField];
    const ipa = pair?.[ipaField];
    if (
      isNonEmptyString(phoneme) &&
      isNonEmptyString(ipa) &&
      !PHONEMES_NOT_EXPECTED_IN_IPA.has(phoneme) &&
      !ipa.includes(phoneme)
    ) {
      errors.push(
        createError(
          'PAIR_PHONEME_APPEARS_IN_IPA',
          `${phonemeField} "${phoneme}" must appear in ${ipaField} "${ipa}".`,
          context
        )
      );
    }
  }

  return errors;
}

function validateDatasetContract({
  minimalPairs,
  translationLanguageKeys,
  localeLanguageKeys,
  expectedCategoryCount = EXPECTED_CATEGORY_COUNT,
  expectedGroupsPerCategory = EXPECTED_GROUP_COUNT,
  expectedTiers = EXPECTED_TIERS,
}) {
  const errors = [];
  const categories = Array.isArray(minimalPairs) ? minimalPairs : [];
  const categoryKeys = categories.map((category) => category?.category);

  if (categories.length !== expectedCategoryCount) {
    errors.push(
      createError(
        'CATEGORY_COUNT',
        `Expected ${expectedCategoryCount} language datasets, found ${categories.length}.`
      )
    );
  }

  const categoryCounts = new Map();
  for (const category of categoryKeys) {
    categoryCounts.set(category, (categoryCounts.get(category) ?? 0) + 1);
  }
  for (const [category, count] of categoryCounts.entries()) {
    if (!isNonEmptyString(category)) {
      errors.push(
        createError('CATEGORY_KEY_NON_EMPTY', 'Category key must be a non-empty string.', {
          category,
        })
      );
    } else if (count > 1) {
      errors.push(
        createError('CATEGORY_KEY_UNIQUE', `Category key appears ${count} times.`, {
          category,
        })
      );
    }
  }

  errors.push(
    ...validateCategoryAlignment({
      categoryKeys: categoryKeys.filter(isNonEmptyString),
      translationLanguageKeys: translationLanguageKeys ?? [],
      localeLanguageKeys: localeLanguageKeys ?? [],
    })
  );

  const seenPairIds = new Set();
  for (const category of categories) {
    const categoryName = category?.category;
    const pairs = Array.isArray(category?.pairs) ? category.pairs : [];
    if (!Array.isArray(category?.pairs)) {
      errors.push(
        createError('CATEGORY_PAIRS_ARRAY', 'Category pairs must be an array.', {
          category: categoryName,
        })
      );
      continue;
    }
    if (pairs.length === 0) {
      errors.push(
        createError('CATEGORY_PAIRS_NON_EMPTY', 'Category must expose at least one pair.', {
          category: categoryName,
        })
      );
    }

    const groups = new Map();
    const seenCategoryWordPairs = new Map();
    for (const pair of pairs) {
      errors.push(...validatePairShape(pair, categoryName));

      const group = pair?.group;
      if (isNonEmptyString(group)) {
        if (!groups.has(group)) groups.set(group, []);
        groups.get(group).push(pair);
      }

      const pairId = buildPairId(pair, categoryName);
      if (seenPairIds.has(pairId)) {
        errors.push(
          createError('PAIR_ID_UNIQUE', `Pair ID is duplicated: ${pairId}`, {
            category: categoryName,
            group,
            tier: pair?.difficulty,
            pair,
            pairId,
          })
        );
      }
      seenPairIds.add(pairId);

      if (isNonEmptyString(pair?.word1) && isNonEmptyString(pair?.word2)) {
        const word1 = normalizeWordForDuplicateCheck(pair.word1);
        const word2 = normalizeWordForDuplicateCheck(pair.word2);
        const exactKey = `${word1}\u0000${word2}`;
        const reversedKey = `${word2}\u0000${word1}`;
        if (seenCategoryWordPairs.has(exactKey)) {
          errors.push(
            createError('PAIR_WORD_DUPLICATE', 'Word pair is duplicated in this category.', {
              category: categoryName,
              group,
              tier: pair?.difficulty,
              pair,
            })
          );
        } else if (seenCategoryWordPairs.has(reversedKey)) {
          errors.push(
            createError(
              'PAIR_WORD_REVERSED_DUPLICATE',
              'Reversed word pair is duplicated in this category.',
              {
                category: categoryName,
                group,
                tier: pair?.difficulty,
                pair,
              }
            )
          );
        }
        seenCategoryWordPairs.set(exactKey, pair);
      }
    }

    if (groups.size !== expectedGroupsPerCategory) {
      errors.push(
        createError(
          'CATEGORY_GROUP_COUNT',
          `Expected ${expectedGroupsPerCategory} groups, found ${groups.size}.`,
          { category: categoryName }
        )
      );
    }

    for (const [group, groupPairs] of groups.entries()) {
      const tierCounts = new Map();
      for (const pair of groupPairs) {
        tierCounts.set(pair.difficulty, (tierCounts.get(pair.difficulty) ?? 0) + 1);
      }

      for (const tier of expectedTiers) {
        const count = tierCounts.get(tier) ?? 0;
        if (count === 0) {
          errors.push(
            createError('GROUP_TIER_PRESENT', `Missing tier ${tier} in group "${group}".`, {
              category: categoryName,
              group,
              tier,
            })
          );
        }
      }

      for (const tier of tierCounts.keys()) {
        if (!expectedTiers.includes(tier)) {
          errors.push(
            createError(
              'GROUP_TIER_VALID',
              `Tier must be one of ${expectedTiers.join(', ')}.`,
              { category: categoryName, group, tier }
            )
          );
        }
      }
    }
  }

  return {
    errors,
    summaries: categories.map((category) => ({
      category: category.category,
      pairCount: Array.isArray(category.pairs) ? category.pairs.length : 0,
      groupCount: Array.isArray(category.pairs)
        ? new Set(category.pairs.map((pair) => pair.group)).size
        : 0,
    })),
  };
}

function loadRepoData() {
  const moduleCache = new Map();
  const minimalPairsModule = loadTsModule(
    path.join(PROJECT_ROOT, 'app', 'constants', 'minimalPairs.ts'),
    moduleCache
  );
  const translationsModule = loadTsModule(
    path.join(PROJECT_ROOT, 'app', 'constants', 'alternateLanguages.ts'),
    moduleCache
  );
  const languageSelectionModule = loadTsModule(
    path.join(PROJECT_ROOT, 'app', 'constants', 'languageSelection.ts'),
    moduleCache
  );

  const localeLanguageKeys = sortedUnique([
    ...Object.values(languageSelectionModule.localeLanguageMap ?? {}),
    ...Object.values(languageSelectionModule.regionLanguageMap ?? {}),
  ]);

  return {
    minimalPairs: minimalPairsModule.minimalPairs,
    translationLanguageKeys: Object.keys(translationsModule.alternateLanguages ?? {}),
    localeLanguageKeys,
  };
}

function runCli() {
  const result = validateDatasetContract(loadRepoData());

  for (const summary of result.summaries) {
    console.log(
      `${summary.category}: ${summary.groupCount} groups, ${summary.pairCount} pairs`
    );
  }

  if (result.errors.length > 0) {
    console.error(`\nDataset validation failed with ${result.errors.length} error(s):`);
    for (const error of result.errors) {
      console.error(`  ${formatValidationError(error)}`);
    }
    process.exit(1);
  }

  console.log(`\nDataset validation passed for ${result.summaries.length} categories.`);
}

if (require.main === module) {
  runCli();
}

module.exports = {
  buildPairId,
  formatValidationError,
  loadRepoData,
  validateDatasetContract,
};
