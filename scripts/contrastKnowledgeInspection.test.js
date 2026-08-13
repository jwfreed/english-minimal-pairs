const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const PROJECT_ROOT = path.join(__dirname, '..');

const { inspectContrastKnowledge } = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'src',
    'domain',
    'contrast',
    'contrastKnowledgeInspection.ts'
  )
);
const { contrastRegistry } = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'src',
    'domain',
    'contrast',
    'contrastRegistry.ts'
  )
);
const { projectPairProgressToContrasts } = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'src',
    'domain',
    'contrast',
    'pairProgressProjection.ts'
  )
);
const { historicalIdentityMapping } = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'src',
    'domain',
    'compatibility',
    'historicalIdentityMapping.ts'
  )
);
const { LANGUAGE_IDS } = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'src',
    'domain',
    'language',
    'language.ts'
  )
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

function attempt(timestamp, isCorrect = true) {
  return { isCorrect, timestamp, durationMin: 0.05 };
}

function assignment(
  legacyGroup,
  pairOffset = 0,
  historicalCategoryLabel = '日本語'
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

function projectionFor(rows) {
  return projectPairProgressToContrasts(
    Object.fromEntries(
      rows.map(([legacyPairProgressKey, attempts]) => [
        legacyPairProgressKey,
        { attempts },
      ])
    )
  );
}

function inspect(projection, overrides = {}) {
  return inspectContrastKnowledge({
    projection,
    contrastRegistry,
    languageId: LANGUAGE_IDS.japanese,
    evaluationTimestamp: 10_000,
    minimumAttributedAttemptCount: 2,
    ...overrides,
  });
}

runTest('inspection includes every language contrast including zero evidence', () => {
  const known = assignment('rL');
  const inspection = inspect(
    projectionFor([[known.legacyPairProgressKey, [attempt(2_000, false)]]])
  );
  const expectedIds = contrastRegistry.contrasts
    .filter((contrast) => contrast.languageId === LANGUAGE_IDS.japanese)
    .map((contrast) => contrast.id)
    .sort();

  assert.deepStrictEqual(
    plain(inspection.diagnostics),
    {
      completeness: 'attested',
      unmappedEntryCount: 0,
      malformedEntryCount: 0,
      malformedAttemptCount: 0,
    }
  );
  assert.deepStrictEqual(
    plain(inspection.entries.map((entry) => entry.contrastId)),
    plain(expectedIds)
  );
  assert.strictEqual(inspection.entries.length, 5);
  assert.strictEqual(
    inspection.entries.find((entry) => entry.contrastId === known.contrastId)
      .knowledge.standing,
    'insufficient'
  );
  assert.strictEqual(
    inspection.entries.filter(
      (entry) => entry.knowledge.standing === 'unobserved'
    ).length,
    4
  );
});

runTest('every projection diagnostic class makes the scope unattested', () => {
  const known = assignment('rL');
  const cases = [
    {
      name: 'unmapped entry',
      projection: projectionFor([
        [known.legacyPairProgressKey, [attempt(1_000), attempt(2_000)]],
        ['Unknown__rL__right_light', [attempt(3_000)]],
      ]),
      expectedCounts: [1, 0, 0],
    },
    {
      name: 'malformed entry',
      projection: projectionFor([
        [known.legacyPairProgressKey, [attempt(1_000), attempt(2_000)]],
        ['malformed-key', [attempt(3_000)]],
      ]),
      expectedCounts: [0, 1, 0],
    },
    {
      name: 'malformed attempt',
      projection: projectionFor([
        [
          known.legacyPairProgressKey,
          [
            attempt(1_000),
            attempt(2_000),
            { isCorrect: 'yes', timestamp: 3_000, durationMin: 0.05 },
          ],
        ],
      ]),
      expectedCounts: [0, 0, 1],
    },
  ];

  for (const testCase of cases) {
    const inspection = inspect(testCase.projection);
    const diagnostics = inspection.diagnostics;

    assert.strictEqual(
      diagnostics.completeness,
      'unattested',
      testCase.name
    );
    assert.deepStrictEqual(
      [
        diagnostics.unmappedEntryCount,
        diagnostics.malformedEntryCount,
        diagnostics.malformedAttemptCount,
      ],
      testCase.expectedCounts,
      testCase.name
    );
    assert(
      inspection.entries.every(
        (entry) => entry.knowledge.standing === 'indeterminate'
      ),
      testCase.name
    );
  }
});

runTest('identity ordering does not change when performance values change', () => {
  const rL = assignment('rL');
  const bV = assignment('bV');
  const first = inspect(
    projectionFor([
      [rL.legacyPairProgressKey, [attempt(1_000, false), attempt(2_000, false)]],
      [bV.legacyPairProgressKey, [attempt(3_000), attempt(4_000)]],
    ])
  );
  const changed = inspect(
    projectionFor([
      [rL.legacyPairProgressKey, [attempt(5_000), attempt(6_000)]],
      [bV.legacyPairProgressKey, [attempt(7_000, false)]],
    ])
  );

  assert.deepStrictEqual(
    plain(first.entries.map((entry) => entry.contrastId)),
    plain(changed.entries.map((entry) => entry.contrastId))
  );
  assert.deepStrictEqual(
    plain(first.entries.map((entry) => entry.contrastId)),
    plain(
      first.entries
        .map((entry) => entry.contrastId)
        .sort((left, right) => left.localeCompare(right))
    )
  );
});

runTest('inspection excludes evidence attributed to another language', () => {
  const japanese = assignment('rL');
  const spanish = assignment('aVsE', 0, 'Español');
  const japaneseOnly = inspect(
    projectionFor([
      [japanese.legacyPairProgressKey, [attempt(2_000, false)]],
    ])
  );
  const mixedProjection = projectionFor([
    [japanese.legacyPairProgressKey, [attempt(2_000, false)]],
    [
      spanish.legacyPairProgressKey,
      [attempt(3_000), attempt(4_000), attempt(5_000)],
    ],
  ]);
  const mixedInspection = inspect(mixedProjection);

  assert.strictEqual(mixedProjection.contrasts.length, 2);
  assert.deepStrictEqual(plain(mixedInspection), plain(japaneseOnly));
  assert(
    mixedInspection.entries.every((entry) =>
      entry.contrastId.startsWith('contrast.japanese.')
    )
  );
});

runTest('inspection aggregates every pair history attributed to one contrast', () => {
  const firstPair = assignment('rL', 0);
  const secondPair = assignment('rL', 1);
  const projection = projectionFor([
    [firstPair.legacyPairProgressKey, [attempt(1_000)]],
    [secondPair.legacyPairProgressKey, [attempt(7_000, false)]],
  ]);
  const inspection = inspect(projection);
  const projectedContrast = projection.contrasts.find(
    (contrast) => contrast.contrastId === firstPair.contrastId
  );
  const entry = inspection.entries.find(
    (candidate) => candidate.contrastId === firstPair.contrastId
  );

  assert.strictEqual(firstPair.contrastId, secondPair.contrastId);
  assert.strictEqual(projectedContrast.pairHistories.length, 2);
  assert.deepStrictEqual(plain(entry.knowledge), {
    standing: 'observed',
    attributedAttemptCount: 2,
    correctCount: 1,
    recency: { elapsedMilliseconds: 3_000 },
  });
});

console.log('\nAll ContrastKnowledge inspection tests passed.');
