const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const PROJECT_ROOT = path.join(__dirname, '..');
const verificationPath = path.join(
  PROJECT_ROOT,
  'scripts',
  'phase3',
  'legacyLearnerStateVerification.ts'
);
const {
  LEGACY_MAX_ATTEMPTS_PER_PAIR,
  assertProjectionInvariants,
  captureLegacyFixtureBytes,
  createAuditReport,
  evaluateMasteryTransition,
  evaluateProjectionInvariants,
  loadLegacyLearnerStateSnapshot,
  projectLegacyLearnerState,
  simulateRollbackPracticeReprojection,
  verifyLegacyLearnerStateFixture,
} = loadTsModule(verificationPath);
const {
  FIXTURE_PAIR_KEYS,
  LEGACY_LEARNER_STATE_FIXTURES,
  ROLLBACK_PRACTICE_ATTEMPT,
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
  historicalIdentityMapping,
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
const { minimalPairs } = loadTsModule(
  path.join(PROJECT_ROOT, 'src', 'constants', 'minimalPairs.ts')
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
const { languageRegistry } = loadTsModule(
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

runTest('all required Phase 3.3 scenario fixtures execute cleanly', () => {
  const required = [
    'fresh-learner',
    'one-language-learner',
    'multi-language-learner',
    'historical-alias-only-mastery',
    'historical-and-current-alias-mastery',
    'conflicting-tiers-across-aliases',
    'unknown-group-recognized-label',
    'recognized-group-unknown-label',
    'malformed-mastery-payload',
    'malformed-pair-progress-key',
    'valid-attempts-across-contrasts',
    'capped-attempt-history',
    'partial-corrupt-global-pair-progress',
    'learner-reset-state',
    'placement-lowered-mastery-state',
    'post-rollback-divergence',
  ];
  assert.deepStrictEqual(
    plain(LEGACY_LEARNER_STATE_FIXTURES.map((fixture) => fixture.name)),
    required
  );

  for (const fixture of LEGACY_LEARNER_STATE_FIXTURES) {
    const result = verifyLegacyLearnerStateFixture(fixture);
    assert.deepStrictEqual(
      plain(result.report.invariantFailures),
      [],
      fixture.name
    );
  }
});

runTest('alias reconciliation is initial-only and uses the highest tier', () => {
  const result = verifyLegacyLearnerStateFixture(
    fixtureNamed('conflicting-tiers-across-aliases')
  );
  assert.strictEqual(result.projection.mastery.length, 1);
  assert.strictEqual(result.projection.mastery[0].tier, 5);
  assert.strictEqual(
    result.projection.mastery[0].reconciliation,
    'initial-alias-highest-tier'
  );
  assert.strictEqual(result.report.aliasReconciledIdentityCount, 1);
  assert.strictEqual(
    result.projection.masteryConflicts[0].kind,
    'initial-alias-conflict'
  );
});

runTest('unknown and malformed records remain explicit and never become identities', () => {
  const unknownGroup = verifyLegacyLearnerStateFixture(
    fixtureNamed('unknown-group-recognized-label')
  );
  const unknownLabel = verifyLegacyLearnerStateFixture(
    fixtureNamed('recognized-group-unknown-label')
  );
  const malformedMastery = verifyLegacyLearnerStateFixture(
    fixtureNamed('malformed-mastery-payload')
  );
  const partialProgress = verifyLegacyLearnerStateFixture(
    fixtureNamed('partial-corrupt-global-pair-progress')
  );

  assert.strictEqual(unknownGroup.report.unmappedMasteryCount, 1);
  assert.strictEqual(
    unknownGroup.snapshot.unmappedMastery[0].reason,
    'unknown-group'
  );
  assert.strictEqual(unknownLabel.report.unmappedMasteryCount, 1);
  assert.strictEqual(
    unknownLabel.snapshot.unmappedMastery[0].reason,
    'unknown-category-label'
  );
  assert.strictEqual(malformedMastery.report.mappedMasteryCount, 1);
  assert.strictEqual(malformedMastery.report.malformedMasteryCount, 2);
  assert.strictEqual(partialProgress.report.mappedAttemptCount, 1);
  assert.strictEqual(partialProgress.report.unmappedAttemptCount, 1);
  assert.strictEqual(partialProgress.report.malformedAttemptCount, 1);
  assert.strictEqual(
    partialProgress.report.malformedPairProgressRecordCount,
    1
  );
});

runTest('effective attempt counts apply the existing per-pair cap before projection', () => {
  const result = verifyLegacyLearnerStateFixture(
    fixtureNamed('capped-attempt-history')
  );
  assert.strictEqual(
    result.report.rawAttemptSlotCount,
    LEGACY_MAX_ATTEMPTS_PER_PAIR + 5
  );
  assert.strictEqual(
    result.report.effectiveAttemptCount,
    LEGACY_MAX_ATTEMPTS_PER_PAIR
  );
  assert.strictEqual(result.report.truncatedAttemptCount, 5);
  assert.strictEqual(
    result.projection.aggregateAttemptCountBeforeProjection,
    LEGACY_MAX_ATTEMPTS_PER_PAIR
  );
  assert.strictEqual(
    result.projection.aggregateAttemptCountAfterProjection,
    LEGACY_MAX_ATTEMPTS_PER_PAIR
  );
  assert.strictEqual(result.snapshot.mappedAttempts[0].attempt.timestamp, 10005);
});

runTest('projection is deterministic, idempotent, order-independent, and immutable', () => {
  const fixture = fixtureNamed('multi-language-learner');
  const before = captureLegacyFixtureBytes(fixture);
  const snapshot = loadLegacyLearnerStateSnapshot(fixture);
  const projection = projectLegacyLearnerState(snapshot);
  const repeated = projectLegacyLearnerState(snapshot);
  const reversedSnapshot = loadLegacyLearnerStateSnapshot({
    ...fixture,
    storageEntries: [...fixture.storageEntries].reverse(),
  });
  const reversed = projectLegacyLearnerState(reversedSnapshot);

  assert.deepStrictEqual(plain(repeated), plain(projection));
  assert.deepStrictEqual(plain(reversed), plain(projection));
  assert.strictEqual(captureLegacyFixtureBytes(fixture), before);
  assert(Object.isFrozen(snapshot));
  assert(Object.isFrozen(snapshot.mappedAttempts));
  assert(Object.isFrozen(projection));
});

runTest('valid and unmapped attempts both remain in the global aggregate', () => {
  const result = verifyLegacyLearnerStateFixture(
    fixtureNamed('partial-corrupt-global-pair-progress')
  );
  assert.strictEqual(
    result.projection.aggregateAttemptCountAfterProjection,
    result.report.mappedAttemptCount + result.report.unmappedAttemptCount
  );
});

runTest('snapshots group mapped mastery and attempts by stable identity', () => {
  const result = verifyLegacyLearnerStateFixture(
    fixtureNamed('multi-language-learner')
  );
  assert.strictEqual(result.snapshot.masteryByIdentity.length, 2);
  assert.strictEqual(result.snapshot.attemptsByIdentity.length, 2);
  for (const identity of result.snapshot.masteryByIdentity) {
    assert(
      identity.records.every(
        (record) =>
          record.languageId === identity.languageId &&
          record.contrastId === identity.contrastId
      )
    );
  }
  for (const identity of result.snapshot.attemptsByIdentity) {
    assert(
      identity.records.every(
        (record) =>
          record.languageId === identity.languageId &&
          record.contrastId === identity.contrastId
      )
    );
  }
});

runTest('intentionally invalid projections fail with precise diagnostics', () => {
  const fixture = fixtureNamed('one-language-learner');
  const sourceFixtureBefore = captureLegacyFixtureBytes(fixture);
  const snapshot = loadLegacyLearnerStateSnapshot(fixture);
  const projection = projectLegacyLearnerState(snapshot);
  const firstMastery = projection.mastery[0];
  const firstAttemptGroup = projection.attempts[0];
  const invalidProjection = {
    ...plain(projection),
    mastery: [
      {
        ...plain(firstMastery),
        tier: firstMastery.tier - 1,
      },
      {
        ...plain(projection.mastery[1]),
        sourceRecords: [],
      },
    ],
    attempts: [
      {
        ...plain(firstAttemptGroup),
        attempts: [
          plain(firstAttemptGroup.attempts[0]),
          plain(firstAttemptGroup.attempts[0]),
        ],
      },
      ...plain(projection.attempts.slice(1)),
    ],
    aggregateAttemptCountAfterProjection:
      projection.aggregateAttemptCountAfterProjection + 1,
  };
  const failures = evaluateProjectionInvariants({
    fixture,
    sourceFixtureBefore,
    snapshot,
    projection: invalidProjection,
    repeatedProjection: invalidProjection,
    reorderedProjection: invalidProjection,
  });
  const codes = new Set(failures.map((failure) => failure.code));
  assert(codes.has('MASTERY_RECORD_LOST'));
  assert(codes.has('MASTERY_TIER_LOWERED'));
  assert(codes.has('ATTEMPT_LOST'));
  assert(codes.has('ATTEMPT_DUPLICATED'));
  assert(codes.has('ATTEMPT_TOTAL_MISMATCH'));
  assert.throws(
    () =>
      assertProjectionInvariants({
        fixture,
        sourceFixtureBefore,
        snapshot,
        projection: invalidProjection,
        repeatedProjection: invalidProjection,
        reorderedProjection: invalidProjection,
      }),
    /MASTERY_RECORD_LOST/
  );
});

runTest('malformed source records cannot be relabeled as valid projection rows', () => {
  const fixture = fixtureNamed('malformed-mastery-payload');
  const sourceFixtureBefore = captureLegacyFixtureBytes(fixture);
  const snapshot = loadLegacyLearnerStateSnapshot(fixture);
  const projection = projectLegacyLearnerState(snapshot);
  const malformed = plain(snapshot.malformedMastery[0]);
  const invalidProjection = {
    ...plain(projection),
    unmappedMastery: [
      ...plain(projection.unmappedMastery),
      {
        ...malformed,
        legacyGroup: malformed.legacyGroup || 'rL',
        tier: 3,
        reason: 'unknown-group',
      },
    ],
  };
  const failures = evaluateProjectionInvariants({
    fixture,
    sourceFixtureBefore,
    snapshot,
    projection: invalidProjection,
    repeatedProjection: invalidProjection,
    reorderedProjection: invalidProjection,
  });
  assert(
    failures.some(
      (failure) => failure.code === 'MALFORMED_RECORD_CONVERTED'
    )
  );
});

runTest('conflicting duplicate storage captures fail instead of being guessed', () => {
  const fixture = {
    name: 'conflicting-storage-capture',
    storageEntries: [
      { key: '@mastery_日本語', value: JSON.stringify({ rL: 2 }) },
      { key: '@mastery_日本語', value: JSON.stringify({ rL: 5 }) },
    ],
  };
  const result = verifyLegacyLearnerStateFixture(fixture);
  assert(
    result.report.invariantFailures.some(
      (failure) => failure.code === 'CONFLICTING_SOURCE_KEY'
    )
  );
});

runTest('reset and placement lowering are domain operations, not migration loss', () => {
  const before = verifyLegacyLearnerStateFixture(
    fixtureNamed('one-language-learner')
  ).projection;
  const reset = verifyLegacyLearnerStateFixture(
    fixtureNamed('learner-reset-state')
  ).projection;
  const placement = verifyLegacyLearnerStateFixture(
    fixtureNamed('placement-lowered-mastery-state')
  ).projection;

  assert(
    evaluateMasteryTransition(before, reset, 'migration').some(
      (failure) => failure.code === 'MASTERY_REMOVED'
    )
  );
  assert.deepStrictEqual(
    plain(evaluateMasteryTransition(before, reset, 'reset')),
    []
  );
  assert.deepStrictEqual(
    plain(evaluateMasteryTransition(before, placement, 'placement')),
    []
  );
});

runTest('rollback, legacy practice, and reprojection conserve all progress', () => {
  const fixture = fixtureNamed('post-rollback-divergence');
  const beforeBytes = captureLegacyFixtureBytes(fixture);
  const result = simulateRollbackPracticeReprojection(
    fixture,
    FIXTURE_PAIR_KEYS.spanishAVsE,
    ROLLBACK_PRACTICE_ATTEMPT
  );
  assert.deepStrictEqual(plain(result.roundTripFailures), []);
  assert.strictEqual(result.attemptsAdded, 1);
  assert.strictEqual(result.finalAttemptCount, result.priorAttemptCount + 1);
  assert.strictEqual(captureLegacyFixtureBytes(fixture), beforeBytes);
  assert.strictEqual(result.after.projection.mastery[0].tier, 4);
});

runTest('current shipped identity mappings validate with zero ambiguity', () => {
  assert.doesNotThrow(() =>
    validateHistoricalIdentityAssignments({
      categoryLabels: historicalIdentityMapping.categoryLabels,
      datasets: minimalPairs,
      contrasts: contrastRegistry,
      languages: languageRegistry,
      contrastAssignments: historicalIdentityMapping.contrastAssignments,
      pairAssignments: historicalIdentityMapping.pairAssignments,
    })
  );
});

runTest('the Phase 3.3 harness has no production storage or runtime dependency', () => {
  const source = fs.readFileSync(verificationPath, 'utf8');
  const forbidden = [
    'AsyncStorage',
    '.getItem(',
    '.setItem(',
    '.removeItem(',
    '@masteryByContrast',
    'PairProgressContext',
    'useContrastPairs',
  ];
  for (const token of forbidden) {
    assert(!source.includes(token), `unexpected harness dependency: ${token}`);
  }
});

runTest('audit reports contain only deterministic counts and identifiers', () => {
  const result = verifyLegacyLearnerStateFixture(
    fixtureNamed('multi-language-learner')
  );
  const rebuilt = createAuditReport(
    result.snapshot,
    result.projection,
    result.report.invariantFailures
  );
  assert.deepStrictEqual(plain(rebuilt), plain(result.report));
  assert.strictEqual(typeof rebuilt.fixtureName, 'string');
  assert.strictEqual(typeof rebuilt.mappedAttemptCount, 'number');
});
