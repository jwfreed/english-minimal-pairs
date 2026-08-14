const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const SOURCE_PATH = path.join(
  ROOT,
  'src',
  'domain',
  'practice',
  'nextContrastSuggestion.ts'
);
const HOOK_PATH = path.join(
  ROOT,
  'src',
  'hooks',
  'useNextContrastSuggestion.ts'
);
const FEATURE_FLAGS_PATH = path.join(
  ROOT,
  'src',
  'config',
  'featureFlags.ts'
);

assert.ok(
  fs.existsSync(SOURCE_PATH),
  'nextContrastSuggestion.ts must exist before its behavior can pass'
);

const {
  PRODUCT_SUFFICIENCY_MINIMUM_ATTRIBUTED_ATTEMPTS,
  getNextContrastSuggestion,
} = loadTsModule(SOURCE_PATH);
const { contrastRegistry } = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'contrast', 'contrastRegistry.ts')
);
const { projectPairProgressToContrasts } = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'contrast', 'pairProgressProjection.ts')
);
const { historicalIdentityMapping } = loadTsModule(
  path.join(
    ROOT,
    'src',
    'domain',
    'compatibility',
    'historicalIdentityMapping.ts'
  )
);
const { LANGUAGE_IDS } = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'language', 'language.ts')
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

const plain = (value) => JSON.parse(JSON.stringify(value));

function assignment(
  legacyGroup,
  historicalCategoryLabel = '日本語',
  pairOffset = 0
) {
  const matches = historicalIdentityMapping.pairAssignments.filter(
    (candidate) =>
      candidate.historicalCategoryLabel === historicalCategoryLabel &&
      candidate.pairReference.pair.group === legacyGroup
  );
  assert(
    matches[pairOffset],
    `missing mapping for ${historicalCategoryLabel}/${legacyGroup}/${pairOffset}`
  );
  return matches[pairOffset];
}

function attempts(count, { invert = false, timestampOffset = 0 } = {}) {
  return Array.from({ length: count }, (_, index) => ({
    isCorrect: invert ? index % 2 !== 0 : index % 2 === 0,
    timestamp: timestampOffset + 1_000 + index * 100,
    durationMin: 0.05,
  }));
}

function projectionFor(rows) {
  return projectPairProgressToContrasts(
    Object.fromEntries(
      rows.map(([legacyPairProgressKey, pairAttempts]) => [
        legacyPairProgressKey,
        { attempts: pairAttempts },
      ])
    )
  );
}

const current = assignment('rL');
const expectedFirstOtherUnobserved = 'contrast.japanese.aVsUh';

function suggest(projection, overrides = {}) {
  return getNextContrastSuggestion({
    projection,
    languageId: LANGUAGE_IDS.japanese,
    currentContrastId: current.contrastId,
    evaluationTimestamp: 10_000,
    minimumAttributedAttemptCount:
      PRODUCT_SUFFICIENCY_MINIMUM_ATTRIBUTED_ATTEMPTS,
    ...overrides,
  });
}

runTest('incomplete projection evidence produces no suggestion', () => {
  const projection = projectionFor([
    [current.legacyPairProgressKey, attempts(2)],
    ['Unknown__rL__right_light', attempts(1)],
  ]);

  assert.strictEqual(suggest(projection), null);
});

runTest('insufficient current evidence suggests continuing the current contrast', () => {
  const projection = projectionFor([
    [current.legacyPairProgressKey, attempts(1)],
  ]);

  assert.deepStrictEqual(plain(suggest(projection)), {
    kind: 'continue-current',
    contrastId: current.contrastId,
  });
});

runTest('current insufficient evidence outranks an unobserved candidate', () => {
  const projection = projectionFor([
    [current.legacyPairProgressKey, attempts(5)],
  ]);

  assert.deepStrictEqual(plain(suggest(projection)), {
    kind: 'continue-current',
    contrastId: current.contrastId,
  });
});

runTest('observed current evidence suggests the first unobserved contrast', () => {
  const projection = projectionFor([
    [current.legacyPairProgressKey, attempts(6)],
  ]);

  assert.deepStrictEqual(plain(suggest(projection)), {
    kind: 'try-unobserved',
    contrastId: expectedFirstOtherUnobserved,
  });
});

runTest('an unobserved current contrast is never returned as its own candidate', () => {
  const result = suggest(projectionFor([]));

  assert.strictEqual(result?.kind, 'try-unobserved');
  assert.notStrictEqual(result?.contrastId, current.contrastId);
  assert.strictEqual(result?.contrastId, expectedFirstOtherUnobserved);
});

runTest('observed current evidence with no unobserved candidates returns null', () => {
  const japaneseGroups = ['aVsUh', 'bV', 'iVsI', 'rL', 'sTheta'];
  const projection = projectionFor(
    japaneseGroups.map((group) => {
      const pair = assignment(group);
      return [pair.legacyPairProgressKey, attempts(6)];
    })
  );

  assert.strictEqual(suggest(projection), null);
});

runTest('an unresolved current contrast returns null', () => {
  assert.strictEqual(
    suggest(projectionFor([]), { currentContrastId: undefined }),
    null
  );
});

runTest('a current contrast owned by another language returns null', () => {
  const spanish = assignment('aVsE', 'Español');

  assert.strictEqual(
    suggest(projectionFor([]), { currentContrastId: spanish.contrastId }),
    null
  );
});

runTest('multiple unobserved candidates use stable contrast identity order', () => {
  const result = suggest(
    projectionFor([[current.legacyPairProgressKey, attempts(7)]])
  );

  assert.strictEqual(result?.contrastId, 'contrast.japanese.aVsUh');
});

runTest('the product threshold distinguishes 0, 1, 5, 6, and 7 attempts', () => {
  const cases = [
    [0, 'try-unobserved'],
    [1, 'continue-current'],
    [5, 'continue-current'],
    [6, 'try-unobserved'],
    [7, 'try-unobserved'],
  ];

  for (const [attemptCount, expectedKind] of cases) {
    const rows =
      attemptCount === 0
        ? []
        : [[current.legacyPairProgressKey, attempts(attemptCount)]];
    assert.strictEqual(
      suggest(projectionFor(rows))?.kind,
      expectedKind,
      `${attemptCount} attempts`
    );
  }
});

runTest('correct and incorrect outcomes with identical counts produce the same suggestion', () => {
  const allCorrect = projectionFor([
    [current.legacyPairProgressKey, attempts(5)],
  ]);
  const inverted = projectionFor([
    [current.legacyPairProgressKey, attempts(5, { invert: true })],
  ]);

  assert.deepStrictEqual(plain(suggest(allCorrect)), plain(suggest(inverted)));
});

runTest('shifted and future timestamps produce the same suggestion', () => {
  const earlier = projectionFor([
    [current.legacyPairProgressKey, attempts(6)],
  ]);
  const future = projectionFor([
    [
      current.legacyPairProgressKey,
      attempts(6, { timestampOffset: 1_000_000 }),
    ],
  ]);

  assert.deepStrictEqual(plain(suggest(earlier)), plain(suggest(future)));
});

runTest('invalid product minima preserve domain validation behavior', () => {
  for (const minimumAttributedAttemptCount of [0, -1, 0.5, Number.NaN]) {
    assert.throws(
      () =>
        suggest(projectionFor([]), { minimumAttributedAttemptCount }),
      /minimum attributed attempt count must be a positive safe integer/
    );
  }
});

runTest('the pure suggestion boundary has no protected dependencies or semantics', () => {
  const source = fs.readFileSync(SOURCE_PATH, 'utf8');
  for (const forbiddenText of [
    'src/dev/',
    'CONTRAST_KNOWLEDGE_INSPECTION_MINIMUM',
    'correctCount',
    'recency',
    'accuracy',
    'mastery',
    'speedTier',
    'storage',
    'React',
    'featureFlags',
  ]) {
    assert.ok(
      !source.includes(forbiddenText),
      `pure suggestion source must not reference ${forbiddenText}`
    );
  }
});

runTest('the product threshold is six attributed attempts', () => {
  assert.strictEqual(
    PRODUCT_SUFFICIENCY_MINIMUM_ATTRIBUTED_ATTEMPTS,
    6
  );
});

runTest('canonical registry evidence is used for current-language ownership', () => {
  assert.strictEqual(
    contrastRegistry.getById(current.contrastId)?.languageId,
    LANGUAGE_IDS.japanese
  );
});

function loadSuggestionHook({
  flagEnabled,
  isLoading = false,
  progress = {},
  categoryIndex = 0,
  language = '日本語',
  projectionResult = { whole: 'projection' },
  projectionError,
  suggestionResult = {
    kind: 'continue-current',
    contrastId: current.contrastId,
  },
  suggestionError,
  evaluationTimestamp = 42_000,
}) {
  const calls = {
    projection: 0,
    suggestion: 0,
    projectedProgress: undefined,
    suggestionInput: undefined,
  };
  const moduleMocks = {
    react: {
      useMemo: (factory) => factory(),
    },
    '@/src/config/featureFlags': {
      CONTRAST_PRACTICE_SUGGESTION_ENABLED: flagEnabled,
    },
    '@/src/context/PairProgressContext': {
      usePairProgress: () => ({ progress, isLoading }),
    },
    '@/src/context/CategoryContext': {
      useCategory: () => ({ categoryIndex }),
    },
    '@/src/context/LanguageContext': {
      useLanguage: () => ({ language }),
    },
    '@/src/domain/contrast/pairProgressProjection': {
      projectPairProgressToContrasts: (receivedProgress) => {
        calls.projection += 1;
        calls.projectedProgress = receivedProgress;
        if (projectionError) throw projectionError;
        return projectionResult;
      },
    },
    '@/src/domain/practice/nextContrastSuggestion': {
      PRODUCT_SUFFICIENCY_MINIMUM_ATTRIBUTED_ATTEMPTS: 6,
      getNextContrastSuggestion: (input) => {
        calls.suggestion += 1;
        calls.suggestionInput = input;
        if (suggestionError) throw suggestionError;
        return suggestionResult;
      },
    },
  };
  const { useNextContrastSuggestion } = loadTsModule(
    HOOK_PATH,
    new Map(),
    moduleMocks,
    { Date: { now: () => evaluationTimestamp } }
  );

  return { calls, useNextContrastSuggestion };
}

runTest('the disabled hook performs zero projection or suggestion work', () => {
  assert.ok(
    fs.existsSync(HOOK_PATH),
    'useNextContrastSuggestion.ts must exist before adapter behavior can pass'
  );
  const { calls, useNextContrastSuggestion } = loadSuggestionHook({
    flagEnabled: false,
  });

  assert.strictEqual(useNextContrastSuggestion('rL'), null);
  assert.deepStrictEqual(
    { projection: calls.projection, suggestion: calls.suggestion },
    { projection: 0, suggestion: 0 }
  );
});

runTest('loading progress cannot be projected into unobserved evidence', () => {
  const { calls, useNextContrastSuggestion } = loadSuggestionHook({
    flagEnabled: true,
    isLoading: true,
    progress: {},
  });

  assert.strictEqual(useNextContrastSuggestion('rL'), null);
  assert.deepStrictEqual(
    { projection: calls.projection, suggestion: calls.suggestion },
    { projection: 0, suggestion: 0 }
  );
});

runTest('the enabled hook forwards whole progress and explicit policy inputs', () => {
  const progress = {
    [current.legacyPairProgressKey]: { attempts: attempts(2) },
  };
  const projectionResult = { whole: 'projection' };
  const { calls, useNextContrastSuggestion } = loadSuggestionHook({
    flagEnabled: true,
    progress,
    projectionResult,
    evaluationTimestamp: 42_000,
  });

  assert.deepStrictEqual(plain(useNextContrastSuggestion('rL')), {
    kind: 'continue-current',
    contrastId: current.contrastId,
  });
  assert.strictEqual(calls.projection, 1);
  assert.strictEqual(calls.suggestion, 1);
  assert.strictEqual(calls.projectedProgress, progress);
  assert.strictEqual(calls.suggestionInput.projection, projectionResult);
  assert.strictEqual(
    calls.suggestionInput.languageId,
    LANGUAGE_IDS.japanese
  );
  assert.strictEqual(
    calls.suggestionInput.currentContrastId,
    current.contrastId
  );
  assert.strictEqual(calls.suggestionInput.evaluationTimestamp, 42_000);
  assert.strictEqual(calls.suggestionInput.minimumAttributedAttemptCount, 6);
});

runTest('unresolved current identity returns before projection', () => {
  const { calls, useNextContrastSuggestion } = loadSuggestionHook({
    flagEnabled: true,
  });

  assert.strictEqual(useNextContrastSuggestion('unknown-group'), null);
  assert.deepStrictEqual(
    { projection: calls.projection, suggestion: calls.suggestion },
    { projection: 0, suggestion: 0 }
  );
});

runTest('category and language context mismatch returns before projection', () => {
  const { calls, useNextContrastSuggestion } = loadSuggestionHook({
    flagEnabled: true,
    categoryIndex: 0,
    language: 'Español',
  });

  assert.strictEqual(useNextContrastSuggestion('rL'), null);
  assert.deepStrictEqual(
    { projection: calls.projection, suggestion: calls.suggestion },
    { projection: 0, suggestion: 0 }
  );
});

runTest('projection failures return null without invoking the pure rule', () => {
  const { calls, useNextContrastSuggestion } = loadSuggestionHook({
    flagEnabled: true,
    projectionError: new Error('projection failed'),
  });

  assert.strictEqual(useNextContrastSuggestion('rL'), null);
  assert.deepStrictEqual(
    { projection: calls.projection, suggestion: calls.suggestion },
    { projection: 1, suggestion: 0 }
  );
});

runTest('inspection failures return null instead of a stale suggestion', () => {
  const { calls, useNextContrastSuggestion } = loadSuggestionHook({
    flagEnabled: true,
    suggestionError: new Error('inspection failed'),
  });

  assert.strictEqual(useNextContrastSuggestion('rL'), null);
  assert.deepStrictEqual(
    { projection: calls.projection, suggestion: calls.suggestion },
    { projection: 1, suggestion: 1 }
  );
});

runTest('the production practice suggestion flag is a false boolean', () => {
  const { CONTRAST_PRACTICE_SUGGESTION_ENABLED } = loadTsModule(
    FEATURE_FLAGS_PATH
  );

  assert.strictEqual(CONTRAST_PRACTICE_SUGGESTION_ENABLED, false);
  assert.strictEqual(typeof CONTRAST_PRACTICE_SUGGESTION_ENABLED, 'boolean');
});

console.log('\nAll next Contrast suggestion tests passed.');
