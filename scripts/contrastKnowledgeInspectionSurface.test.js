const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const REPORT_PATH = path.join(
  ROOT,
  'src',
  'dev',
  'contrastKnowledgeInspectionReport.ts'
);
const {
  CONTRAST_KNOWLEDGE_INSPECTION_MINIMUM,
  buildContrastKnowledgeInspectionReport,
} = loadTsModule(REPORT_PATH);
const { projectPairProgressToContrasts } = loadTsModule(
  path.join(
    ROOT,
    'src',
    'domain',
    'contrast',
    'pairProgressProjection.ts'
  )
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

function report(projection, overrides = {}) {
  return buildContrastKnowledgeInspectionReport({
    projection,
    categoryLabel: '日本語',
    evaluationTimestamp: 10_000,
    minimumAttributedAttemptCount: 5,
    ...overrides,
  });
}

runTest('builds a presentation report from supplied inputs', () => {
  const japanese = assignment('rL');
  const spanish = assignment('aVsE', 0, 'Español');
  const projection = projectionFor([
    [
      japanese.legacyPairProgressKey,
      [attempt(2_000, false), attempt(4_000)],
    ],
    [spanish.legacyPairProgressKey, [attempt(3_000)]],
  ]);
  const result = report(projection);

  assert.strictEqual(result.status, 'available');
  assert.strictEqual(result.evidenceScope, 'GLOBAL');
  assert.strictEqual(result.languageId, 'lang.japanese');
  assert.strictEqual(result.developerInspectionMinimum, 5);
  assert.strictEqual(result.globalAttributedRetainedAttemptCount, 3);
  assert.deepStrictEqual(plain(result.diagnostics), {
    completeness: 'attested',
    unmappedEntryCount: 0,
    malformedEntryCount: 0,
    malformedAttemptCount: 0,
  });
  assert.deepStrictEqual(plain(result.standingCensus), {
    indeterminate: 0,
    unobserved: 4,
    insufficient: 1,
    observed: 0,
  });
  assert.deepStrictEqual(
    plain(
      result.entries.find(
        (entry) => entry.contrastId === japanese.contrastId
      )
    ),
    {
      contrastId: japanese.contrastId,
      label: '/r/ vs /l/',
      standing: 'insufficient',
      attributedRetainedAttemptCount: 2,
      correctCount: 1,
      recency: {
        elapsedMilliseconds: 6_000,
        displayText: '6 seconds',
      },
    }
  );
});

runTest('unresolved category labels fail closed', () => {
  assert.deepStrictEqual(
    plain(report(projectionFor([]), { categoryLabel: 'not-a-language' })),
    {
      status: 'unavailable',
      categoryLabel: 'not-a-language',
      reason: 'unresolved-category-label',
    }
  );
});

runTest('passes the supplied developer minimum explicitly', () => {
  const known = assignment('rL');
  const attempts = [1, 2, 3, 4].map((timestamp) => attempt(timestamp));
  const projection = projectionFor([
    [known.legacyPairProgressKey, attempts],
  ]);
  const strict = report(projection, {
    minimumAttributedAttemptCount: 5,
  });
  const permissive = report(projection, {
    minimumAttributedAttemptCount: 4,
  });
  const standing = (result) =>
    result.entries.find(
      (entry) => entry.contrastId === known.contrastId
    ).standing;

  assert.strictEqual(strict.developerInspectionMinimum, 5);
  assert.strictEqual(permissive.developerInspectionMinimum, 4);
  assert.strictEqual(standing(strict), 'insufficient');
  assert.strictEqual(standing(permissive), 'observed');
});

runTest('changing only the instant changes only recency presentation', () => {
  const known = assignment('rL');
  const projection = projectionFor([
    [known.legacyPairProgressKey, [attempt(4_000)]],
  ]);
  const earlier = plain(
    report(projection, { evaluationTimestamp: 5_000 })
  );
  const later = plain(
    report(projection, { evaluationTimestamp: 9_000 })
  );
  const stripRecency = (value) => ({
    ...value,
    entries: value.entries.map(({ recency, ...entry }) => entry),
  });

  assert.deepStrictEqual(stripRecency(earlier), stripRecency(later));
  assert.deepStrictEqual(
    earlier.entries.find(
      (entry) => entry.contrastId === known.contrastId
    ).recency,
    { elapsedMilliseconds: 1_000, displayText: '1 second' }
  );
  assert.deepStrictEqual(
    later.entries.find(
      (entry) => entry.contrastId === known.contrastId
    ).recency,
    { elapsedMilliseconds: 5_000, displayText: '5 seconds' }
  );
});

runTest('negative elapsed observations stay signed and unclamped', () => {
  const known = assignment('rL');
  const result = report(
    projectionFor([
      [known.legacyPairProgressKey, [attempt(12_500)]],
    ])
  );
  const entry = result.entries.find(
    (candidate) => candidate.contrastId === known.contrastId
  );

  assert.deepStrictEqual(plain(entry.recency), {
    elapsedMilliseconds: -2_500,
    displayText: '-2.5 seconds',
  });
});

runTest('global diagnostics preserve unrelated evidence failures', () => {
  const known = assignment('rL');
  const result = report(
    projectionFor([
      [known.legacyPairProgressKey, [attempt(2_000)]],
      ['Unknown__rL__right_light', [attempt(3_000)]],
    ])
  );

  assert.strictEqual(result.status, 'available');
  assert.deepStrictEqual(plain(result.diagnostics), {
    completeness: 'unattested',
    unmappedEntryCount: 1,
    malformedEntryCount: 0,
    malformedAttemptCount: 0,
  });
  assert.strictEqual(result.globalAttributedRetainedAttemptCount, 1);
  assert.deepStrictEqual(plain(result.standingCensus), {
    indeterminate: 5,
    unobserved: 0,
    insufficient: 0,
    observed: 0,
  });
});

runTest('standing census is descriptive and contains no score or ranking', () => {
  const result = report(projectionFor([]));
  const serialized = JSON.stringify(result.standingCensus);

  assert.deepStrictEqual(Object.keys(result.standingCensus).sort(), [
    'indeterminate',
    'insufficient',
    'observed',
    'unobserved',
  ]);
  assert.ok(!/score|rank|priority|ability/i.test(serialized));
});

assert.strictEqual(CONTRAST_KNOWLEDGE_INSPECTION_MINIMUM, 5);

console.log('\nAll ContrastKnowledge inspection-surface tests passed.');
