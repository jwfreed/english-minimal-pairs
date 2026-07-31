const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const PROJECT_ROOT = path.join(__dirname, '..');
const PAIR_PROGRESS_STORAGE_KEY = '@pairProgress_v2';
const PROJECTION_PATH = path.join(
  PROJECT_ROOT,
  'src',
  'domain',
  'contrast',
  'pairProgressProjection.ts'
);

const {
  projectPairProgressToContrasts,
} = loadTsModule(PROJECTION_PATH);
const {
  MAX_ATTEMPTS_PER_PAIR,
  parseStoredProgress,
} = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'src',
    'storage',
    'progressStorage.ts'
  ),
  new Map(),
  {
    '@react-native-async-storage/async-storage': {
      getItem: async () => null,
      setItem: async () => undefined,
      removeItem: async () => undefined,
    },
  }
);
const {
  historicalIdentityMapping,
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
  LEGACY_LEARNER_STATE_FIXTURES,
  fixtureNamed,
} = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'scripts',
    'phase3',
    'legacyLearnerStateFixtures.ts'
  )
);
const {
  verifyLegacyLearnerStateFixture,
} = loadTsModule(
  path.join(
    PROJECT_ROOT,
    'scripts',
    'phase3',
    'legacyLearnerStateVerification.ts'
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

async function runAsyncTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const plain = (value) => JSON.parse(JSON.stringify(value));

function attempt(timestamp, isCorrect = true, durationMin = 0.05) {
  return { isCorrect, timestamp, durationMin };
}

function assignment(categoryLabel, legacyGroup, pairOffset = 0) {
  const matches = historicalIdentityMapping.pairAssignments.filter(
    (candidate) =>
      candidate.historicalCategoryLabel === categoryLabel &&
      candidate.pairReference.pair.group === legacyGroup
  );
  assert(
    matches[pairOffset],
    `missing mapping for ${categoryLabel}/${legacyGroup}/${pairOffset}`
  );
  return matches[pairOffset];
}

function parseRows(rows) {
  return parseStoredProgress(
    JSON.stringify(
      Object.fromEntries(
        rows.map(([key, attempts]) => [key, { attempts }])
      )
    )
  );
}

function parsedFixtureProgress(fixture) {
  const entry = fixture.storageEntries.find(
    (candidate) => candidate.key === PAIR_PROGRESS_STORAGE_KEY
  );
  return parseStoredProgress(entry?.value ?? null);
}

function projectedAttemptsByPair(projection) {
  return new Map(
    projection.contrasts.flatMap((contrast) =>
      contrast.pairHistories.map((history) => [
        history.legacyPairProgressKey,
        history.attempts,
      ])
    )
  );
}

runTest('projector dependency boundary remains pure and domain-only', () => {
  const source = fs.readFileSync(PROJECTION_PATH, 'utf8');
  const imports = Array.from(
    source.matchAll(/from '([^']+)'/g),
    (match) => match[1]
  );

  assert.deepStrictEqual(imports, [
    '@/src/constants/minimalPairs',
    '@/src/domain/compatibility/historicalIdentityMapping',
    '@/src/domain/identity',
  ]);
  for (const forbidden of [
    'AsyncStorage',
    '@/src/storage/',
    '@/src/context/',
    '@/src/hooks/',
    "from 'react'",
    '@pairProgress_v',
    'PAIR_PROGRESS_STORAGE_KEY',
    'getProgress(',
    'saveAttempt(',
    'clearProgress(',
    'useEffect(',
    'useState(',
  ]) {
    assert(
      !source.includes(forbidden),
      `pure projector must not depend on ${forbidden}`
    );
  }
});

runTest('empty parsed progress produces an empty deterministic projection', () => {
  const projection = projectPairProgressToContrasts({});

  assert.deepStrictEqual(plain(projection.contrasts), []);
  assert.deepStrictEqual(plain(projection.unmappedEntries), []);
  assert.deepStrictEqual(plain(projection.malformedEntries), []);
  assert.strictEqual(projection.aggregateTotals.attemptCount, 0);
  assert.strictEqual(projection.mappedTotals.attemptCount, 0);
  assert.strictEqual(projection.diagnostics.sourceEntryCount, 0);
  assert.strictEqual(projection.diagnostics.effectiveAttemptCount, 0);
});

runTest('one Contrast exposes mapped history, totals, accuracy, duration, and latest attempt', () => {
  const japaneseRL = assignment('日本語', 'rL');
  const progress = parseRows([
    [
      japaneseRL.legacyPairProgressKey,
      [
        attempt(3, true, 0.1),
        attempt(1, false, 0.2),
        attempt(2, true, 0.3),
      ],
    ],
  ]);
  const projection = projectPairProgressToContrasts(progress);
  const contrast = projection.contrasts[0];
  const history = contrast.pairHistories[0];

  assert.strictEqual(projection.contrasts.length, 1);
  assert.strictEqual(contrast.languageId, 'lang.japanese');
  assert.strictEqual(contrast.contrastId, 'contrast.japanese.rL');
  assert.deepStrictEqual(
    plain(history.attempts.map((entry) => entry.timestamp)),
    [3, 1, 2],
    'pair history order must remain source order'
  );
  assert.deepStrictEqual(
    plain(history.pairReference.pair),
    plain(japaneseRL.pairReference.pair)
  );
  assert.strictEqual(contrast.totals.attemptCount, 3);
  assert.strictEqual(contrast.totals.correctCount, 2);
  assert.strictEqual(contrast.totals.incorrectCount, 1);
  assert.strictEqual(contrast.totals.accuracy, 2 / 3);
  assert.ok(Math.abs(contrast.totals.totalDurationMin - 0.6) < 1e-10);
  assert.strictEqual(contrast.totals.latestAttempt.attempt.timestamp, 3);
});

runTest('multiple contrasts and languages are canonically ordered and language-scoped', () => {
  const japaneseRL = assignment('日本語', 'rL');
  const japaneseBV = assignment('日本語', 'bV');
  const koreanRL = assignment('한국어', 'rL');
  const projection = projectPairProgressToContrasts(
    parseRows([
      [koreanRL.legacyPairProgressKey, [attempt(30)]],
      [japaneseRL.legacyPairProgressKey, [attempt(20, false)]],
      [japaneseBV.legacyPairProgressKey, [attempt(10)]],
    ])
  );

  assert.deepStrictEqual(
    plain(
      projection.contrasts.map((contrast) => contrast.contrastId)
    ),
    [
      'contrast.japanese.bV',
      'contrast.japanese.rL',
      'contrast.korean.rL',
    ]
  );
  assert.notStrictEqual(
    projection.contrasts[1].contrastId,
    projection.contrasts[2].contrastId
  );
  assert.strictEqual(projection.mappedTotals.attemptCount, 3);
});

runTest('current and historical alias keys converge without overwrite, duplication, or order drift', () => {
  const current = assignment('Español', 'aVsE');
  const historical = assignment('idioma español', 'aVsE');
  const progress = parseRows([
    [
      historical.legacyPairProgressKey,
      [attempt(30, false), attempt(10)],
    ],
    [
      current.legacyPairProgressKey,
      [attempt(40), attempt(20, false)],
    ],
  ]);
  const projection = projectPairProgressToContrasts(progress);
  const repeated = projectPairProgressToContrasts(progress);
  const reversed = projectPairProgressToContrasts(
    Object.fromEntries(Object.entries(progress).reverse())
  );
  const contrast = projection.contrasts[0];
  const historiesByKey = new Map(
    contrast.pairHistories.map((history) => [
      history.legacyPairProgressKey,
      history,
    ])
  );

  assert.strictEqual(projection.contrasts.length, 1);
  assert.strictEqual(contrast.languageId, 'lang.spanish');
  assert.strictEqual(contrast.contrastId, 'contrast.spanish.aVsE');
  assert.strictEqual(contrast.pairHistories.length, 2);
  assert.deepStrictEqual(
    plain(
      contrast.pairHistories.map(
        (history) => history.legacyPairProgressKey
      )
    ),
    [
      current.legacyPairProgressKey,
      historical.legacyPairProgressKey,
    ].sort()
  );
  assert.deepStrictEqual(
    plain(
      historiesByKey
        .get(current.legacyPairProgressKey)
        .attempts.map((entry) => entry.timestamp)
    ),
    [40, 20]
  );
  assert.deepStrictEqual(
    plain(
      historiesByKey
        .get(historical.legacyPairProgressKey)
        .attempts.map((entry) => entry.timestamp)
    ),
    [30, 10]
  );
  assert.strictEqual(contrast.totals.attemptCount, 4);
  assert.strictEqual(contrast.totals.correctCount, 2);
  assert.strictEqual(contrast.totals.incorrectCount, 2);
  assert.strictEqual(projection.mappedTotals.attemptCount, 4);
  assert.deepStrictEqual(plain(repeated), plain(projection));
  assert.deepStrictEqual(plain(reversed), plain(projection));
});

runTest('unknown keys, malformed keys, and invalid attempts remain explicit and excluded from mapped totals', () => {
  const known = assignment('日本語', 'rL');
  const progress = parseRows([
    [
      known.legacyPairProgressKey,
      [
        attempt(1),
        { isCorrect: 'yes', timestamp: 2, durationMin: 0.05 },
      ],
    ],
    ['Unknown__rL__right_light', [attempt(3, false)]],
    ['日本語_rL_right_light', [attempt(4)]],
  ]);
  const before = JSON.stringify(progress);
  const projection = projectPairProgressToContrasts(progress);

  assert.strictEqual(projection.unmappedEntries.length, 1);
  assert.strictEqual(
    projection.unmappedEntries[0].reason,
    'unmapped-pair-key'
  );
  assert.strictEqual(projection.malformedEntries.length, 1);
  assert.strictEqual(
    projection.malformedEntries[0].reason,
    'malformed-pair-key'
  );
  assert.strictEqual(projection.malformedAttempts.length, 1);
  assert.strictEqual(
    projection.malformedAttempts[0].legacyPairProgressKey,
    known.legacyPairProgressKey
  );
  assert.strictEqual(projection.mappedTotals.attemptCount, 1);
  assert.strictEqual(projection.aggregateTotals.attemptCount, 3);
  assert.strictEqual(projection.aggregateTotals.correctCount, 2);
  assert.strictEqual(projection.aggregateTotals.incorrectCount, 1);
  assert.strictEqual(projection.diagnostics.sourceAttemptSlotCount, 4);
  assert.strictEqual(projection.diagnostics.effectiveAttemptCount, 3);
  assert.strictEqual(projection.diagnostics.malformedAttemptCount, 1);
  assert.strictEqual(JSON.stringify(progress), before);
});

runTest('projection never recaps parsed history and preserves the production cap', () => {
  const fixture = fixtureNamed('capped-attempt-history');
  const progress = parsedFixtureProgress(fixture);
  const projection = projectPairProgressToContrasts(progress);
  const history = projection.contrasts[0].pairHistories[0];

  assert.strictEqual(history.attempts.length, MAX_ATTEMPTS_PER_PAIR);
  assert.strictEqual(history.attempts[0].timestamp, 10005);
  assert.strictEqual(
    history.attempts[history.attempts.length - 1].timestamp,
    10104
  );
  assert.strictEqual(
    projection.diagnostics.sourceAttemptSlotCount,
    MAX_ATTEMPTS_PER_PAIR
  );
});

runTest('non-array parser normalization is diagnostic loss, not a progress mismatch', () => {
  const known = assignment('日本語', 'rL');
  const parsed = parseStoredProgress(
    JSON.stringify({
      [known.legacyPairProgressKey]: {
        attempts: 'not-an-array',
      },
    })
  );
  const projection = projectPairProgressToContrasts(parsed);

  assert.deepStrictEqual(
    plain(parsed[known.legacyPairProgressKey].attempts),
    []
  );
  assert.strictEqual(projection.contrasts.length, 1);
  assert.strictEqual(
    projection.contrasts[0].pairHistories[0].attempts.length,
    0
  );
  assert.strictEqual(projection.malformedAttempts.length, 0);
  assert.strictEqual(projection.diagnostics.sourceAttemptSlotCount, 0);
  assert.strictEqual(projection.diagnostics.effectiveAttemptCount, 0);
  assert.strictEqual(projection.mappedTotals.attemptCount, 0);
});

runTest('projection is immutable, idempotent, and independent of input enumeration order', () => {
  const japanese = assignment('日本語', 'rL');
  const spanish = assignment('Español', 'aVsE');
  const firstAttempt = attempt(1);
  const forward = {
    [japanese.legacyPairProgressKey]: { attempts: [firstAttempt] },
    [spanish.legacyPairProgressKey]: { attempts: [attempt(2, false)] },
  };
  const reversed = Object.fromEntries(Object.entries(forward).reverse());
  const before = JSON.stringify(forward);
  const projected = projectPairProgressToContrasts(forward);

  assert.deepStrictEqual(
    plain(projectPairProgressToContrasts(forward)),
    plain(projected)
  );
  assert.deepStrictEqual(
    plain(projectPairProgressToContrasts(reversed)),
    plain(projected)
  );
  assert.strictEqual(JSON.stringify(forward), before);
  assert.strictEqual(Object.isFrozen(firstAttempt), false);
  assert(Object.isFrozen(projected));
  assert(Object.isFrozen(projected.contrasts));
  assert(Object.isFrozen(projected.contrasts[0].pairHistories));
  assert(Object.isFrozen(projected.contrasts[0].pairHistories[0].attempts[0]));
});

runTest('projected nested histories and attempts are deeply isolated from parsed input', () => {
  const known = assignment('日本語', 'rL');
  const progress = parseRows([
    [known.legacyPairProgressKey, [attempt(1)]],
  ]);
  const sourceAttempt =
    progress[known.legacyPairProgressKey].attempts[0];
  const before = JSON.stringify(progress);
  const projection = projectPairProgressToContrasts(progress);
  const contrast = projection.contrasts[0];
  const history = contrast.pairHistories[0];
  const projectedAttempt = history.attempts[0];

  assert.notStrictEqual(projectedAttempt, sourceAttempt);
  assert.throws(() => {
    history.attempts.push(attempt(2));
  });
  assert.throws(() => {
    contrast.pairHistories.pop();
  });
  assert.throws(() => {
    'use strict';
    projectedAttempt.timestamp = 999;
  });
  assert.strictEqual(JSON.stringify(progress), before);
  assert.strictEqual(sourceAttempt.timestamp, 1);
  assert.strictEqual(progress[known.legacyPairProgressKey].attempts.length, 1);
});

runTest('all 1,170 released pair-key mappings project without ambiguity', () => {
  const progress = Object.fromEntries(
    historicalIdentityMapping.pairAssignments.map((row) => [
      row.legacyPairProgressKey,
      { attempts: [] },
    ])
  );
  const projection = projectPairProgressToContrasts(progress);

  assert.strictEqual(
    historicalIdentityMapping.pairAssignments.length,
    1170
  );
  assert.strictEqual(projection.diagnostics.sourceEntryCount, 1170);
  assert.strictEqual(projection.diagnostics.mappedEntryCount, 1170);
  assert.strictEqual(projection.diagnostics.unmappedEntryCount, 0);
  assert.strictEqual(projection.diagnostics.malformedEntryCount, 0);
  assert.strictEqual(projection.contrasts.length, 70);
});

runTest('production projection conserves every valid Phase 3.3 fixture attempt exactly', () => {
  for (const fixture of LEGACY_LEARNER_STATE_FIXTURES) {
    const reference = verifyLegacyLearnerStateFixture(fixture);
    const projection = projectPairProgressToContrasts(
      parsedFixtureProgress(fixture)
    );
    const expectedEffectiveCount =
      reference.report.mappedAttemptCount +
      reference.report.unmappedAttemptCount;
    const referenceMappedAttempts = reference.snapshot.mappedAttempts.map(
      (record) => record.attempt
    );
    const referenceAggregateAttempts = [
      ...referenceMappedAttempts,
      ...reference.snapshot.unmappedAttempts.map(
        (record) => record.attempt
      ),
    ];
    const expectedMappedCorrect = referenceMappedAttempts.filter(
      (entry) => entry.isCorrect
    ).length;
    const expectedAggregateCorrect =
      referenceAggregateAttempts.filter(
        (entry) => entry.isCorrect
      ).length;

    assert.strictEqual(
      projection.mappedTotals.attemptCount,
      reference.report.mappedAttemptCount,
      `${fixture.name}: mapped attempt count`
    );
    assert.strictEqual(
      projection.aggregateTotals.attemptCount,
      expectedEffectiveCount,
      `${fixture.name}: effective attempt count`
    );
    assert.strictEqual(
      projection.diagnostics.malformedAttemptCount,
      reference.report.malformedAttemptCount,
      `${fixture.name}: malformed attempt count`
    );
    assert.strictEqual(
      projection.mappedTotals.correctCount,
      expectedMappedCorrect,
      `${fixture.name}: mapped correct count`
    );
    assert.strictEqual(
      projection.mappedTotals.incorrectCount,
      referenceMappedAttempts.length - expectedMappedCorrect,
      `${fixture.name}: mapped incorrect count`
    );
    assert.strictEqual(
      projection.aggregateTotals.correctCount,
      expectedAggregateCorrect,
      `${fixture.name}: aggregate correct count`
    );
    assert.strictEqual(
      projection.aggregateTotals.incorrectCount,
      referenceAggregateAttempts.length - expectedAggregateCorrect,
      `${fixture.name}: aggregate incorrect count`
    );

    const productionByPair = projectedAttemptsByPair(projection);
    const referenceByPair = new Map();
    for (const record of reference.snapshot.mappedAttempts) {
      const attempts =
        referenceByPair.get(record.legacyPairProgressKey) ?? [];
      attempts.push(record.attempt);
      referenceByPair.set(record.legacyPairProgressKey, attempts);
    }
    for (const [legacyPairProgressKey, attempts] of referenceByPair) {
      assert.deepStrictEqual(
        plain(productionByPair.get(legacyPairProgressKey)),
        plain(attempts),
        `${fixture.name}: ${legacyPairProgressKey} history`
      );
    }
  }
});

module.exports = runAsyncTest(
  'read service repeatedly derives from @pairProgress_v2 without writing',
  async () => {
    const known = assignment('日本語', 'rL');
    const raw = JSON.stringify({
      [known.legacyPairProgressKey]: {
        attempts: [attempt(1), attempt(2, false)],
      },
    });
    let readCount = 0;
    let writeCount = 0;
    const asyncStorage = {
      async getItem(key) {
        assert.strictEqual(key, PAIR_PROGRESS_STORAGE_KEY);
        readCount += 1;
        return raw;
      },
      async setItem() {
        writeCount += 1;
      },
      async removeItem() {
        writeCount += 1;
      },
    };
    const { getContrastProgress } = loadTsModule(
      path.join(
        PROJECT_ROOT,
        'src',
        'storage',
        'contrastProgressStorage.ts'
      ),
      new Map(),
      {
        '@react-native-async-storage/async-storage': asyncStorage,
      }
    );

    const first = await getContrastProgress();
    const second = await getContrastProgress();

    assert.deepStrictEqual(plain(second), plain(first));
    assert.strictEqual(first.mappedTotals.attemptCount, 2);
    assert.strictEqual(readCount, 2);
    assert.strictEqual(writeCount, 0);
  }
);
