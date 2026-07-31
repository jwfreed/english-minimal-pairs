const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');
const { loadRepoData } = require('./validate-data');

const PROJECT_ROOT = path.join(__dirname, '..');
const GOLDEN_PATH = path.join(
  __dirname,
  'fixtures',
  'historical-identity-mapping.golden.tsv'
);

const {
  HISTORICAL_CATEGORY_LABELS,
  createHistoricalIdentityMapping,
  historicalIdentityMapping,
  isStructurallyValidLegacyPairProgressKey,
  serializeHistoricalContrastAssignments,
  validateHistoricalIdentityAssignments,
} = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'src',
    'domain',
    'compatibility',
    'historicalIdentityMapping.ts'
  )
);
const {
  contrastRegistry,
  createContrastRegistry,
} = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'src',
    'domain',
    'contrast',
    'contrastRegistry.ts'
  )
);
const { defineContrastId } = loadTsModule(
  path.join(PROJECT_ROOT, 'src', 'domain', 'identity.ts')
);
const { LANGUAGE_IDS, languageRegistry } = loadTsModule(
  path.join(PROJECT_ROOT, 'src', 'domain', 'language', 'language.ts')
);
const { buildPairId } = loadTsModule(
  path.join(PROJECT_ROOT, 'utils', 'idHelpers.ts')
);

const { minimalPairs } = loadRepoData();

const RELEASED_CURRENT_MAPPING_COUNT = 70;
const RELEASED_HISTORICAL_ALIAS_COUNT = 6;
const RELEASED_PAIR_MAPPING_COUNT = 1170;
const RELEASED_ALIAS_PAIR_MAPPING_COUNT = 357;
const RELEASED_PAIR_MAPPING_SHA256 =
  '1af4e38cd9ee8abec64e95582070eaccece494fb99569d5732cc5259fd38e658';

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

function currentAssignments(mapping = historicalIdentityMapping) {
  return mapping.contrastAssignments.filter((assignment) => assignment.isCurrent);
}

function aliasAssignments(mapping = historicalIdentityMapping) {
  return mapping.categoryLabels.filter((assignment) => !assignment.isCurrent);
}

function validationInput(overrides = {}) {
  return {
    categoryLabels: historicalIdentityMapping.categoryLabels,
    datasets: minimalPairs,
    contrasts: contrastRegistry,
    languages: languageRegistry,
    contrastAssignments: historicalIdentityMapping.contrastAssignments,
    pairAssignments: historicalIdentityMapping.pairAssignments,
    ...overrides,
  };
}

function mappingIdentityRows(mapping) {
  return mapping.contrastAssignments.map(
    (assignment) =>
      `${assignment.historicalCategoryLabel}\u0000${assignment.legacyGroup}\u0000${assignment.languageId}\u0000${assignment.contrastId}`
  );
}

runTest('all 70 shipped contrasts have exactly one current historical mapping', () => {
  const assignments = currentAssignments();
  const datasetIdentities = new Set();

  for (const category of minimalPairs) {
    for (const pair of category.pairs) {
      datasetIdentities.add(`${category.category}\u0000${pair.group}`);
    }
  }

  assert.strictEqual(assignments.length, RELEASED_CURRENT_MAPPING_COUNT);
  assert.strictEqual(datasetIdentities.size, RELEASED_CURRENT_MAPPING_COUNT);
  assert.strictEqual(
    new Set(assignments.map((assignment) => assignment.contrastId)).size,
    RELEASED_CURRENT_MAPPING_COUNT
  );
  assert.strictEqual(
    new Set(
      assignments.map(
        (assignment) =>
          `${assignment.historicalCategoryLabel}\u0000${assignment.legacyGroup}`
      )
    ).size,
    RELEASED_CURRENT_MAPPING_COUNT
  );
});

runTest('every current and renamed category label resolves to one LanguageId', () => {
  assert.strictEqual(
    historicalIdentityMapping.categoryLabels.filter(
      (assignment) => assignment.isCurrent
    ).length,
    14
  );
  assert.strictEqual(
    aliasAssignments().length,
    RELEASED_HISTORICAL_ALIAS_COUNT
  );

  for (const assignment of historicalIdentityMapping.categoryLabels) {
    assert.strictEqual(
      historicalIdentityMapping.resolveCategoryLabel(
        assignment.historicalCategoryLabel
      ),
      assignment.languageId
    );
    assert.strictEqual(
      historicalIdentityMapping.resolveMasteryKey(
        `@mastery_${assignment.historicalCategoryLabel}`
      ),
      assignment.languageId
    );
  }
});

runTest('the compatibility aliases cover every LANGUAGE_KEY_MIGRATION rename', () => {
  const languageContextSource = fs.readFileSync(
    path.join(PROJECT_ROOT, 'src', 'context', 'LanguageContext.tsx'),
    'utf8'
  );
  const migrationBlock = languageContextSource.match(
    /const LANGUAGE_KEY_MIGRATION:[^{]+{([\s\S]*?)};/
  );
  assert(migrationBlock, 'expected LANGUAGE_KEY_MIGRATION declaration');

  const migrationRows = Array.from(
    migrationBlock[1].matchAll(/^\s*'([^']+)':\s*'([^']+)',?$/gm),
    (match) => ({ historicalLabel: match[1], currentLabel: match[2] })
  );
  assert.strictEqual(migrationRows.length, RELEASED_HISTORICAL_ALIAS_COUNT);

  for (const { historicalLabel, currentLabel } of migrationRows) {
    const aliasLanguage =
      historicalIdentityMapping.resolveCategoryLabel(historicalLabel);
    assert(aliasLanguage, `missing historical alias "${historicalLabel}"`);
    assert.strictEqual(
      aliasLanguage,
      historicalIdentityMapping.resolveCategoryLabel(currentLabel)
    );
  }
});

runTest('shared group tokens remain language-scoped and never collide', () => {
  const japanese = historicalIdentityMapping.resolveContrast('日本語', 'rL');
  const korean = historicalIdentityMapping.resolveContrast('한국어', 'rL');
  const mandarin = historicalIdentityMapping.resolveContrast('中文', 'rL');

  assert.strictEqual(japanese, 'contrast.japanese.rL');
  assert.strictEqual(korean, 'contrast.korean.rL');
  assert.strictEqual(mandarin, 'contrast.mandarin.rL');
  assert.notStrictEqual(japanese, korean);
  assert.notStrictEqual(korean, mandarin);
  assert.strictEqual(historicalIdentityMapping.resolveContrast('', 'rL'), undefined);
  assert.strictEqual(
    historicalIdentityMapping.resolveContrast('Unknown', 'rL'),
    undefined
  );
});

runTest('historical aliases converge on the same stable ContrastId', () => {
  const cases = [
    ['idioma español', 'Español', 'aVsE'],
    ['اللغة العربية', 'العربية', 'pB'],
    ['русский язык', 'Русский', 'hZero'],
    ['زبان فارسی', 'فارسی', 'wV'],
    ['bahasa Indo', 'Bahasa Indonesia', 'vF'],
    ['हिंदी/اردو', 'हिन्दी / اردو', 'zS'],
  ];

  for (const [historicalLabel, currentLabel, group] of cases) {
    assert.strictEqual(
      historicalIdentityMapping.resolveContrast(historicalLabel, group),
      historicalIdentityMapping.resolveContrast(currentLabel, group)
    );
  }
});

runTest('unknown labels, groups, mastery keys, and pair keys remain unmapped', () => {
  assert.strictEqual(
    historicalIdentityMapping.resolveCategoryLabel('Japanese'),
    undefined
  );
  assert.strictEqual(
    historicalIdentityMapping.resolveMasteryKey('@mastery_Japanese'),
    undefined
  );
  assert.strictEqual(
    historicalIdentityMapping.resolveMasteryKey('@placementDone_日本語'),
    undefined
  );
  assert.strictEqual(
    historicalIdentityMapping.resolveContrast('日本語', 'notReleased'),
    undefined
  );
  assert.strictEqual(
    historicalIdentityMapping.resolvePairProgressKey(
      '日本語__rL__unknown_unknown'
    ),
    undefined
  );
});

runTest('legacy pair mappings use the canonical builder and recover aliases exactly', () => {
  const spanish = minimalPairs.find(
    (category) => category.category === 'Español'
  );
  assert(spanish);
  const pair = spanish.pairs[0];
  const currentKey = buildPairId(pair, 'Español');
  const historicalKey = buildPairId(pair, 'idioma español');
  const current = historicalIdentityMapping.resolvePairProgressKey(currentKey);
  const historical =
    historicalIdentityMapping.resolvePairProgressKey(historicalKey);

  assert(current);
  assert(historical);
  assert.strictEqual(current.legacyPairProgressKey, currentKey);
  assert.strictEqual(historical.legacyPairProgressKey, historicalKey);
  assert.deepStrictEqual(
    JSON.parse(JSON.stringify(current.pairReference.pair)),
    JSON.parse(JSON.stringify(pair))
  );
  assert.strictEqual(
    current.pairReference.pair,
    historical.pairReference.pair
  );
  assert.strictEqual(current.contrastId, historical.contrastId);
});

runTest('malformed legacy pair keys are never parsed or guessed', () => {
  const known = historicalIdentityMapping.pairAssignments[0];
  const malformed = [
    known.legacyPairProgressKey.toLowerCase(),
    ` ${known.legacyPairProgressKey}`,
    `${known.legacyPairProgressKey} `,
    known.legacyPairProgressKey.replace('__', '_'),
    known.legacyPairProgressKey.replace(/_[^_]+$/, ''),
    known.legacyPairProgressKey.split('__').reverse().join('__'),
  ];

  for (const key of malformed) {
    if (key !== known.legacyPairProgressKey) {
      assert.strictEqual(
        historicalIdentityMapping.resolvePairProgressKey(key),
        undefined
      );
    }
  }
});

runTest('legacy pair-key shape checks are diagnostic-only and exact', () => {
  const known = historicalIdentityMapping.pairAssignments[0];

  assert.strictEqual(
    isStructurallyValidLegacyPairProgressKey(
      known.legacyPairProgressKey
    ),
    true
  );
  assert.strictEqual(
    isStructurallyValidLegacyPairProgressKey(
      'Unknown__rL__right_light'
    ),
    true
  );
  assert.strictEqual(
    historicalIdentityMapping.resolvePairProgressKey(
      'Unknown__rL__right_light'
    ),
    undefined
  );
  assert.strictEqual(
    isStructurallyValidLegacyPairProgressKey(
      '日本語_rL_right_light'
    ),
    false
  );
  assert.strictEqual(
    isStructurallyValidLegacyPairProgressKey(
      '日本語__rL__broken'
    ),
    false
  );
});

runTest('mapping output is independent from declaration and dataset order', () => {
  const reversedRegistry = createContrastRegistry(
    [...contrastRegistry.contrasts].reverse()
  );
  const reversed = createHistoricalIdentityMapping({
    categoryLabels: [...HISTORICAL_CATEGORY_LABELS].reverse(),
    datasets: [...minimalPairs].reverse(),
    contrasts: reversedRegistry,
  });

  assert.strictEqual(
    serializeHistoricalContrastAssignments(reversed.contrastAssignments),
    serializeHistoricalContrastAssignments(
      historicalIdentityMapping.contrastAssignments
    )
  );
  assert.deepStrictEqual(
    Array.from(
      reversed.pairAssignments,
      (assignment) => assignment.legacyPairProgressKey
    ),
    Array.from(
      historicalIdentityMapping.pairAssignments,
      (assignment) => assignment.legacyPairProgressKey
    )
  );
});

runTest('ambiguous labels and contrast mappings fail validation', () => {
  const japaneseLabel = historicalIdentityMapping.categoryLabels.find(
    (assignment) => assignment.historicalCategoryLabel === '日本語'
  );
  const japaneseRL = historicalIdentityMapping.contrastAssignments.find(
    (assignment) =>
      assignment.historicalCategoryLabel === '日本語' &&
      assignment.legacyGroup === 'rL'
  );
  assert(japaneseLabel);
  assert(japaneseRL);

  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({
          categoryLabels: [
            ...historicalIdentityMapping.categoryLabels,
            {
              ...japaneseLabel,
              currentCategoryLabel: '한국어',
              languageId: LANGUAGE_IDS.korean,
              isCurrent: false,
            },
          ],
        })
      ),
    /Ambiguous historical category label "日本語"/
  );

  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({
          contrastAssignments: [
            ...historicalIdentityMapping.contrastAssignments,
            {
              ...japaneseRL,
              contrastId: defineContrastId('contrast.japanese.bV'),
            },
          ],
        })
      ),
    /Ambiguous historical contrast mapping for label "日本語" and group "rL"/
  );
});

runTest('unsupported and disconnected historical aliases fail validation', () => {
  const alias = aliasAssignments()[0];

  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({
          categoryLabels: [
            ...historicalIdentityMapping.categoryLabels.filter(
              (assignment) => assignment !== alias
            ),
            { ...alias, languageId: 'lang.unsupported' },
          ],
        })
      ),
    /uses unsupported LanguageId "lang.unsupported"/
  );

  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({
          categoryLabels: [
            ...historicalIdentityMapping.categoryLabels.filter(
              (assignment) => assignment !== alias
            ),
            { ...alias, currentCategoryLabel: 'Missing Dataset' },
          ],
        })
      ),
    /is not connected to current dataset "Missing Dataset"/
  );

  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({
          categoryLabels: [
            ...historicalIdentityMapping.categoryLabels.filter(
              (assignment) => assignment !== alias
            ),
            {
              ...alias,
              currentCategoryLabel: '한국어',
            },
          ],
        })
      ),
    /disagrees with LanguageId "lang.korean" owned by current dataset "한국어"/
  );
});

runTest('duplicate pair keys claiming different targets fail validation', () => {
  const pair = historicalIdentityMapping.pairAssignments.find(
    (assignment) => assignment.contrastId === 'contrast.japanese.rL'
  );
  const differentTarget = historicalIdentityMapping.pairAssignments.find(
    (assignment) => assignment.contrastId === 'contrast.japanese.bV'
  );
  assert(pair);
  assert(differentTarget);

  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({
          pairAssignments: [
            ...historicalIdentityMapping.pairAssignments,
            {
              ...differentTarget,
              legacyPairProgressKey: pair.legacyPairProgressKey,
            },
          ],
        })
      ),
    /Duplicate legacy pair-progress key .* claims different targets/
  );
});

runTest('nonexistent targets and pair ownership disagreements fail validation', () => {
  const contrast = historicalIdentityMapping.contrastAssignments.find(
    (assignment) =>
      assignment.historicalCategoryLabel === '日本語' &&
      assignment.legacyGroup === 'rL'
  );
  const pair = historicalIdentityMapping.pairAssignments.find(
    (assignment) => assignment.contrastId === 'contrast.japanese.rL'
  );
  assert(contrast);
  assert(pair);

  const nonexistent = {
    ...contrast,
    contrastId: defineContrastId('contrast.japanese.notRegistered'),
  };
  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({
          contrastAssignments:
            historicalIdentityMapping.contrastAssignments.map((assignment) =>
              assignment === contrast ? nonexistent : assignment
            ),
        })
      ),
    /targets nonexistent ContrastId "contrast.japanese.notRegistered"/
  );

  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({
          pairAssignments:
            historicalIdentityMapping.pairAssignments.map((assignment) =>
              assignment === pair
                ? {
                    ...assignment,
                    contrastId: defineContrastId('contrast.japanese.bV'),
                  }
                : assignment
            ),
        })
      ),
    /disagrees with Contrast ownership/
  );
});

runTest('missing current and registry coverage fails validation', () => {
  const removed = currentAssignments()[0];
  const incomplete = historicalIdentityMapping.contrastAssignments.filter(
    (assignment) => assignment !== removed
  );

  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({ contrastAssignments: incomplete })
      ),
    /Current dataset contrast missing mapping/
  );
  assert.throws(
    () =>
      validateHistoricalIdentityAssignments(
        validationInput({ contrastAssignments: incomplete })
      ),
    /Registry contrast .* current legacy coverage row; found 0/
  );
});

runTest('the released golden assignments remain byte-for-byte stable', () => {
  const golden = fs.readFileSync(GOLDEN_PATH, 'utf8');
  const generated = serializeHistoricalContrastAssignments(
    historicalIdentityMapping.contrastAssignments
  );

  assert.strictEqual(generated, golden);
  assert.strictEqual(golden.trimEnd().split('\n').length - 1, 100);
});

runTest('new aliases add rows without changing or removing released assignments', () => {
  const futureAlias = {
    historicalCategoryLabel: 'Japanese historical alias',
    currentCategoryLabel: '日本語',
    languageId: LANGUAGE_IDS.japanese,
    isCurrent: false,
  };
  const extended = createHistoricalIdentityMapping({
    categoryLabels: [...HISTORICAL_CATEGORY_LABELS, futureAlias],
    datasets: minimalPairs,
    contrasts: contrastRegistry,
  });
  const releasedRows = new Set(
    mappingIdentityRows(historicalIdentityMapping)
  );
  const extendedRows = new Set(mappingIdentityRows(extended));

  for (const releasedRow of releasedRows) {
    assert(extendedRows.has(releasedRow), `released row changed: ${releasedRow}`);
  }
  assert.strictEqual(extendedRows.size, releasedRows.size + 5);
});

runTest('mutable Contrast metadata does not change compatibility assignments', () => {
  const changedContrasts = contrastRegistry.contrasts.map((contrast) => ({
    ...contrast,
    phoneme1: `updated-${contrast.phoneme1}`,
    phoneme2: `updated-${contrast.phoneme2}`,
    examples: [...contrast.examples].reverse(),
  }));
  const changedById = new Map(
    changedContrasts.map((contrast) => [contrast.id, contrast])
  );
  const metadataChangedRegistry = {
    contrasts: changedContrasts,
    getById: (id) => changedById.get(id),
  };
  const changed = createHistoricalIdentityMapping({
    categoryLabels: HISTORICAL_CATEGORY_LABELS,
    datasets: minimalPairs,
    contrasts: metadataChangedRegistry,
  });

  assert.strictEqual(
    fingerprint(mappingIdentityRows(changed)),
    fingerprint(mappingIdentityRows(historicalIdentityMapping))
  );
});

runTest('legacy pair-key generation is deterministic and fingerprint protected', () => {
  const aliasLabels = new Set(
    aliasAssignments().map(
      (assignment) => assignment.historicalCategoryLabel
    )
  );
  const fingerprintRows = historicalIdentityMapping.pairAssignments.map(
    (assignment) =>
      `${assignment.legacyPairProgressKey}\u0000${assignment.contrastId}`
  );

  assert.strictEqual(
    historicalIdentityMapping.pairAssignments.length,
    RELEASED_PAIR_MAPPING_COUNT
  );
  assert.strictEqual(
    historicalIdentityMapping.pairAssignments.filter((assignment) =>
      aliasLabels.has(assignment.historicalCategoryLabel)
    ).length,
    RELEASED_ALIAS_PAIR_MAPPING_COUNT
  );
  assert.strictEqual(
    fingerprint(fingerprintRows),
    RELEASED_PAIR_MAPPING_SHA256
  );
});

runTest('the compatibility boundary has no learner-storage dependency', () => {
  const source = fs.readFileSync(
    path.join(
      PROJECT_ROOT,
      'src',
      'domain',
      'compatibility',
      'historicalIdentityMapping.ts'
    ),
    'utf8'
  );

  assert(!source.includes('AsyncStorage'));
  assert(!source.includes('.getItem('));
  assert(!source.includes('.setItem('));
  assert(!source.includes('.removeItem('));
});
