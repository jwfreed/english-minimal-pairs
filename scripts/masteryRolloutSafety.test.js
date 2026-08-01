const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const safety = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'masteryRolloutSafety.ts')
);
const diagnosticStorage = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'masteryRolloutDiagnosticStorage.ts')
);

const EVIDENCE_FIELDS = [
  'aliasRegressions',
  'blockedComparisons',
  'blockedMigrations',
  'coldStartsObserved',
  'crossLanguageCollisions',
  'diagnosticDeliveryFailures',
  'diagnosticEventsDropped',
  'duplicatedMasteryRecords',
  'languagesExercised',
  'legacyFallbackRatio',
  'legacyRecordAbsences',
  'lostMasteryRecords',
  'malformedStableFallbacks',
  'migrationFailures',
  'migrationOutcomesUnexpected',
  'orphanAdoptionFailures',
  'orphanAdoptionResidue',
  'placementFailures',
  'practiceBehaviorChanges',
  'renamedLanguagesExercised',
  'resetFailures',
  'shadowComparisons',
  'snapshotIntegrity',
  'stableRecordAbsences',
  'storageFailureRate',
  'unexpectedMasteryDecreases',
  'unexpectedMasteryIncreases',
  'unexplainedDivergences',
  'unhandledLegacyStorageFailures',
  'unhandledMigrationStateFailures',
  'unhandledPartialWrites',
  'unhandledStableStorageFailures',
  'unresolvedContrastMappings',
];

const PRODUCED_FIELDS = [
  'aliasRegressions',
  'blockedComparisons',
  'blockedMigrations',
  'coldStartsObserved',
  'diagnosticDeliveryFailures',
  'diagnosticEventsDropped',
  'languagesExercised',
  'legacyFallbackRatio',
  'legacyRecordAbsences',
  'malformedStableFallbacks',
  'migrationFailures',
  'migrationOutcomesUnexpected',
  'orphanAdoptionFailures',
  'orphanAdoptionResidue',
  'placementFailures',
  'renamedLanguagesExercised',
  'resetFailures',
  'shadowComparisons',
  'snapshotIntegrity',
  'stableRecordAbsences',
  'storageFailureRate',
  'unexpectedMasteryDecreases',
  'unexpectedMasteryIncreases',
  'unexplainedDivergences',
  'unhandledLegacyStorageFailures',
  'unhandledMigrationStateFailures',
  'unhandledPartialWrites',
  'unhandledStableStorageFailures',
  'unresolvedContrastMappings',
];

const COVERAGE_FIELDS = new Set([
  'coldStartsObserved',
  'languagesExercised',
  'renamedLanguagesExercised',
  'shadowComparisons',
]);

const NON_RUNTIME_PROVENANCE = {
  crossLanguageCollisions: 'harness-attested',
  duplicatedMasteryRecords: 'harness-attested',
  lostMasteryRecords: 'harness-attested',
  practiceBehaviorChanges: 'manually-attested',
};

const plain = (value) => JSON.parse(JSON.stringify(value));

function observed(field, value, overrides = {}) {
  const provenance =
    overrides.provenance ??
    NON_RUNTIME_PROVENANCE[field] ??
    'runtime-measured';
  return {
    kind: 'observed',
    value,
    provenance,
    source: `${provenance}:phase-3.8b-test`,
    witnessed: true,
    ...overrides,
  };
}

function createEvidenceSnapshot() {
  const fields = {};
  for (const field of EVIDENCE_FIELDS) {
    fields[field] = [observed(field, COVERAGE_FIELDS.has(field) ? 3 : 0)];
  }

  return {
    windowId: 'window-a',
    transition: { from: 'shadow', to: 'internal-test' },
    generatedFrom: 'operator-report',
    producerManifest: {
      manifestVersion: 1,
      producedFields: [...PRODUCED_FIELDS],
    },
    fields,
    thresholds: {
      coldStartsObserved: 2,
      languagesExercised: 3,
      renamedLanguagesExercised: 1,
      shadowComparisons: 1,
    },
    rolloutStateObservations: {
      disabled: 0,
      shadow: 12,
      'internal-test': 0,
      limited: 0,
      enabled: 0,
    },
    openConditions: [],
    completeness: {
      snapshotIntegrity: 'intact',
      diagnosticDeliveryFailures: 0,
      diagnosticEventsDropped: 0,
      openConditionOverflow: 0,
    },
    reliabilityContext: {
      opened: {
        'partial-write': 0,
        'storage-failure': 0,
        'migration-failure': 0,
        'orphan-adoption-residue': 0,
      },
      recovered: {
        'partial-write': 0,
        'storage-failure': 0,
        'migration-failure': 0,
        'orphan-adoption-residue': 0,
      },
    },
  };
}

function withField(snapshot, field, value, overrides = {}) {
  return {
    ...snapshot,
    fields: {
      ...snapshot.fields,
      [field]: [observed(field, value, overrides)],
    },
  };
}

function withCompleteness(snapshot, changes) {
  return {
    ...snapshot,
    completeness: { ...snapshot.completeness, ...changes },
  };
}

function reorderObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reorderObjectKeys);
  if (value === null || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .reverse()
      .map(([key, nested]) => [key, reorderObjectKeys(nested)])
  );
}

function assertDeepFrozen(value) {
  if (value === null || typeof value !== 'object') return;
  assert(Object.isFrozen(value));
  for (const nested of Object.values(value)) assertDeepFrozen(nested);
}

function assertNoFunctionValues(value) {
  if (value === null || typeof value !== 'object') {
    assert.notStrictEqual(typeof value, 'function');
    return;
  }
  for (const nested of Object.values(value)) assertNoFunctionValues(nested);
}

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

runTest('exports the Phase 3.8B evaluator contract', () => {
  assert.strictEqual(typeof safety.evaluateMasteryRolloutSafety, 'function');
  assert.strictEqual(safety.evaluateMasteryRolloutSafetyGate, undefined);
  assert.deepStrictEqual(plain(safety.SAFETY_EVIDENCE_FIELD_CATALOG), EVIDENCE_FIELDS);
  assert.deepStrictEqual(
    plain(safety.SAFETY_EVIDENCE_FIELD_CATALOG),
    plain(diagnosticStorage.RUNTIME_EVIDENCE_FIELD_CATALOG)
  );
});

runTest('complete eligible evidence produces an advisory READY assessment', () => {
  const assessment = safety.evaluateMasteryRolloutSafety(
    createEvidenceSnapshot()
  );

  assert.strictEqual(assessment.recommendation, 'ready');
  assert.deepStrictEqual(plain(assessment.blockers), []);
  assert.deepStrictEqual(plain(assessment.gaps), []);
  assert.deepStrictEqual(plain(assessment.unmetVolumeGates), []);
  assert.strictEqual(assessment.fields.length, EVIDENCE_FIELDS.length);
  assert.strictEqual(assessment.coverage.fieldsUnknown, 0);
});

runTest('known integrity violations and unresolved ledger conditions produce BLOCKED', () => {
  const integrity = safety.evaluateMasteryRolloutSafety(
    withField(createEvidenceSnapshot(), 'lostMasteryRecords', 1)
  );
  assert.strictEqual(integrity.recommendation, 'blocked');
  assert(
    integrity.blockers.some(
      (finding) =>
        finding.code === 'integrity-violation' &&
        finding.field === 'lostMasteryRecords'
    )
  );

  const unresolved = safety.evaluateMasteryRolloutSafety({
    ...createEvidenceSnapshot(),
    openConditions: [
      {
        kind: 'partial-write',
        languageId: 'lang.japanese',
        openedAtSequence: 12,
      },
    ],
  });
  assert.strictEqual(unresolved.recommendation, 'blocked');
  assert(
    unresolved.blockers.some(
      (finding) =>
        finding.code === 'unresolved-reliability-condition' &&
        finding.field === 'unhandledPartialWrites'
    )
  );
});

runTest('reliability uses only the ledger and never cumulative counter arithmetic', () => {
  const snapshot = createEvidenceSnapshot();
  snapshot.reliabilityContext.opened['storage-failure'] = 9;
  snapshot.reliabilityContext.recovered['storage-failure'] = 1;

  const assessment = safety.evaluateMasteryRolloutSafety(snapshot);
  assert.strictEqual(assessment.recommendation, 'ready');
  assert.deepStrictEqual(plain(assessment.blockers), []);
});

runTest('missing provenance and witnesses produce INSUFFICIENT_EVIDENCE', () => {
  const missingProvenance = createEvidenceSnapshot();
  missingProvenance.fields.aliasRegressions = [
    {
      kind: 'observed',
      value: 0,
      source: 'phase-3.8b-test:missing-provenance',
      witnessed: true,
    },
  ];
  const missingProvenanceAssessment =
    safety.evaluateMasteryRolloutSafety(missingProvenance);
  assert.strictEqual(
    missingProvenanceAssessment.recommendation,
    'insufficient-evidence'
  );
  assert(
    missingProvenanceAssessment.gaps.some(
      (gap) =>
        gap.field === 'aliasRegressions' &&
        gap.reason === 'provenance-ineligible'
    )
  );

  const unknown = createEvidenceSnapshot();
  unknown.fields.lostMasteryRecords = [
    {
      kind: 'unknown',
      provenance: 'unknown',
      reason: 'attestation-missing',
    },
  ];
  const unknownAssessment = safety.evaluateMasteryRolloutSafety(unknown);
  assert.strictEqual(unknownAssessment.recommendation, 'insufficient-evidence');
  assert(
    unknownAssessment.gaps.some(
      (gap) =>
        gap.field === 'lostMasteryRecords' &&
        gap.reason === 'attestation-missing'
    )
  );

  const partiallyKnown = createEvidenceSnapshot();
  partiallyKnown.fields.lostMasteryRecords = [
    observed('lostMasteryRecords', 0),
    {
      kind: 'unknown',
      provenance: 'unknown',
      reason: 'attestation-missing',
    },
  ];
  const partiallyKnownAssessment =
    safety.evaluateMasteryRolloutSafety(partiallyKnown);
  assert.strictEqual(
    partiallyKnownAssessment.fields.find(
      (field) => field.field === 'lostMasteryRecords'
    ).status,
    'unknown'
  );

  const unwitnessed = withField(
    createEvidenceSnapshot(),
    'aliasRegressions',
    0,
    { witnessed: false }
  );
  const unwitnessedAssessment =
    safety.evaluateMasteryRolloutSafety(unwitnessed);
  assert.strictEqual(
    unwitnessedAssessment.recommendation,
    'insufficient-evidence'
  );
  assert(
    unwitnessedAssessment.gaps.some(
      (gap) =>
        gap.field === 'aliasRegressions' &&
        gap.reason === 'producer-not-exercised'
    )
  );
});

runTest('diagnostic loss and ledger overflow degrade confidence without becoming blockers', () => {
  for (const snapshot of [
    withCompleteness(createEvidenceSnapshot(), {
      snapshotIntegrity: 'degraded',
    }),
    withCompleteness(createEvidenceSnapshot(), {
      snapshotIntegrity: 'unavailable',
    }),
    withCompleteness(createEvidenceSnapshot(), {
      diagnosticEventsDropped: 1,
    }),
    withCompleteness(createEvidenceSnapshot(), {
      diagnosticDeliveryFailures: 1,
    }),
    withCompleteness(createEvidenceSnapshot(), {
      openConditionOverflow: 1,
    }),
  ]) {
    const assessment = safety.evaluateMasteryRolloutSafety(snapshot);
    assert.strictEqual(assessment.recommendation, 'insufficient-evidence');
    assert.deepStrictEqual(plain(assessment.blockers), []);
    assert(assessment.truncationSources.length > 0);
  }
});

runTest('rollout attribution mismatch, mixing, and absence cannot satisfy readiness', () => {
  const wrongRegime = createEvidenceSnapshot();
  wrongRegime.rolloutStateObservations = {
    disabled: 12,
    shadow: 0,
    'internal-test': 0,
    limited: 0,
    enabled: 0,
  };
  assert.strictEqual(
    safety.evaluateMasteryRolloutSafety(wrongRegime).recommendation,
    'insufficient-evidence'
  );

  const missing = { ...createEvidenceSnapshot() };
  delete missing.rolloutStateObservations;
  assert.strictEqual(
    safety.evaluateMasteryRolloutSafety(missing).recommendation,
    'insufficient-evidence'
  );

  const mixed = createEvidenceSnapshot();
  mixed.rolloutStateObservations = {
    disabled: 1,
    shadow: 11,
    'internal-test': 0,
    limited: 0,
    enabled: 0,
  };
  assert.strictEqual(
    safety.evaluateMasteryRolloutSafety(mixed).recommendation,
    'insufficient-evidence'
  );

  const mixedViolation = withField(mixed, 'aliasRegressions', 1);
  assert.strictEqual(
    safety.evaluateMasteryRolloutSafety(mixedViolation).recommendation,
    'blocked'
  );
});

runTest('producer capability never substitutes for observation and rejects contradictions', () => {
  const manifestMissing = createEvidenceSnapshot();
  delete manifestMissing.producerManifest;
  const manifestMissingAssessment =
    safety.evaluateMasteryRolloutSafety(manifestMissing);
  assert.strictEqual(
    manifestMissingAssessment.recommendation,
    'insufficient-evidence'
  );
  assert(
    manifestMissingAssessment.gaps.some(
      (gap) =>
        gap.field === 'aliasRegressions' && gap.reason === 'manifest-missing'
    )
  );

  const unobserved = createEvidenceSnapshot();
  delete unobserved.fields.aliasRegressions;
  const unobservedAssessment =
    safety.evaluateMasteryRolloutSafety(unobserved);
  assert.strictEqual(
    unobservedAssessment.recommendation,
    'insufficient-evidence'
  );
  assert(
    unobservedAssessment.gaps.some(
      (gap) =>
        gap.field === 'aliasRegressions' &&
        gap.reason === 'producer-not-exercised'
    )
  );

  const unsupported = createEvidenceSnapshot();
  unsupported.producerManifest.producedFields =
    unsupported.producerManifest.producedFields.filter(
      (field) => field !== 'aliasRegressions'
    );
  const unsupportedAssessment =
    safety.evaluateMasteryRolloutSafety(unsupported);
  assert.strictEqual(unsupportedAssessment.recommendation, 'blocked');
  assert(
    unsupportedAssessment.blockers.some(
      (finding) =>
        finding.code === 'invalid-runtime-evidence' &&
        finding.field === 'aliasRegressions'
    )
  );

  const permanentlyNonRuntime = withField(
    createEvidenceSnapshot(),
    'lostMasteryRecords',
    0,
    { provenance: 'runtime-measured' }
  );
  const permanentlyNonRuntimeAssessment =
    safety.evaluateMasteryRolloutSafety(permanentlyNonRuntime);
  assert.strictEqual(permanentlyNonRuntimeAssessment.recommendation, 'blocked');
  assert(
    permanentlyNonRuntimeAssessment.blockers.some(
      (finding) =>
        finding.code === 'invalid-runtime-evidence' &&
        finding.field === 'lostMasteryRecords'
    )
  );
});

runTest('below-threshold and on-device evidence cannot produce READY', () => {
  const belowThreshold = withField(
    createEvidenceSnapshot(),
    'languagesExercised',
    2
  );
  const thresholdAssessment =
    safety.evaluateMasteryRolloutSafety(belowThreshold);
  assert.strictEqual(
    thresholdAssessment.recommendation,
    'insufficient-evidence'
  );
  assert.deepStrictEqual(plain(thresholdAssessment.unmetVolumeGates), [
    'languagesExercised',
  ]);

  const onDevice = {
    ...createEvidenceSnapshot(),
    generatedFrom: 'on-device',
  };
  assert.strictEqual(
    safety.evaluateMasteryRolloutSafety(onDevice).recommendation,
    'insufficient-evidence'
  );
});

runTest('conflicting eligible provenance is BLOCKED and adopts neither value as safe', () => {
  const conflict = createEvidenceSnapshot();
  conflict.fields.placementFailures = [
    observed('placementFailures', 0),
    observed('placementFailures', 1, {
      provenance: 'manually-attested',
      source: 'manually-attested:placement-drill',
    }),
  ];

  const assessment = safety.evaluateMasteryRolloutSafety(conflict);
  assert.strictEqual(assessment.recommendation, 'blocked');
  assert(
    assessment.blockers.some(
      (finding) =>
        finding.code === 'evidence-conflict' &&
        finding.field === 'placementFailures'
    )
  );
});

runTest('non-adjacent transitions are BLOCKED', () => {
  const snapshot = createEvidenceSnapshot();
  snapshot.transition = { from: 'disabled', to: 'limited' };

  const assessment = safety.evaluateMasteryRolloutSafety(snapshot);
  assert.strictEqual(assessment.recommendation, 'blocked');
  assert.strictEqual(assessment.blockers[0].code, 'non-adjacent-transition');
});

runTest('evaluation is deterministic, frozen, and isolated across windows', () => {
  const ready = createEvidenceSnapshot();
  const inputBeforeEvaluation = JSON.stringify(ready);
  const first = safety.evaluateMasteryRolloutSafety(ready);
  const identical = safety.evaluateMasteryRolloutSafety(ready);
  const reordered = safety.evaluateMasteryRolloutSafety(
    reorderObjectKeys(ready)
  );
  assert.strictEqual(JSON.stringify(first), JSON.stringify(identical));
  assert.strictEqual(first.evidenceDigest, identical.evidenceDigest);
  assert.strictEqual(JSON.stringify(first), JSON.stringify(reordered));
  assert.strictEqual(first.evidenceDigest, reordered.evidenceDigest);

  const changedEvidence = safety.evaluateMasteryRolloutSafety(
    withField(ready, 'aliasRegressions', 1)
  );
  assert.strictEqual(changedEvidence.recommendation, 'blocked');
  assert.notStrictEqual(first.evidenceDigest, changedEvidence.evidenceDigest);
  assert.strictEqual(JSON.stringify(ready), inputBeforeEvaluation);
  assertDeepFrozen(first);
  assertNoFunctionValues(first);

  const truncated = safety.evaluateMasteryRolloutSafety(
    withCompleteness(ready, { openConditionOverflow: 1 })
  );
  const later = safety.evaluateMasteryRolloutSafety({
    ...createEvidenceSnapshot(),
    windowId: 'window-b',
  });
  assert.strictEqual(truncated.recommendation, 'insufficient-evidence');
  assert.strictEqual(later.recommendation, 'ready');
  assert.strictEqual(first.recommendation, 'ready');
  for (const forbidden of ['advance', 'apply', 'nextState', 'history']) {
    assert(!Object.prototype.hasOwnProperty.call(first, forbidden));
  }
});

runTest('the evaluator has no runtime authority or I/O import boundary', () => {
  const evaluatorPath = path.join(
    ROOT,
    'src',
    'domain',
    'masteryRolloutSafety.ts'
  );
  const legacyAdapterPath = path.join(
    ROOT,
    'src',
    'domain',
    'masteryRolloutSafetyLegacyAdapter.ts'
  );
  assert(
    fs.existsSync(legacyAdapterPath),
    'dedicated legacy safety adapter module is missing'
  );
  const source = fs.readFileSync(evaluatorPath, 'utf8');
  for (const forbidden of [
    'AsyncStorage',
    'FEATURE_FLAGS',
    'CONTRAST_MASTERY_ROLLOUT_STATE',
    'masteryRolloutDiagnosticStorage',
    'getDiagnosticSnapshot',
    'recordDiagnosticEvent',
    'migrateLanguageMastery(',
    'adoptOrphanedMasteryForLanguage(',
    'writeCompatibleMastery(',
    'writeContrastMastery(',
    'Date.now(',
    'Math.random(',
    'masteryRolloutSafetyLegacyAdapter',
    'evaluateMasteryRolloutSafetyGate',
    'MasteryRolloutSafetyEvidence',
    'MasteryRolloutSafetyGateResult',
    'legacy-safety-adapter',
    "from 'react'",
    'from "react"',
  ]) {
    assert(!source.includes(forbidden), forbidden);
  }

  const productionSourceFiles = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(file);
      } else if (/\.[cm]?[jt]sx?$/.test(entry.name)) {
        productionSourceFiles.push(file);
      }
    }
  };
  visit(path.join(ROOT, 'app'));
  visit(path.join(ROOT, 'src'));

  for (const file of productionSourceFiles) {
    if (file === evaluatorPath || file === legacyAdapterPath) continue;
    const productionSource = fs.readFileSync(file, 'utf8');
    assert(
      !productionSource.includes('masteryRolloutSafety'),
      `production evaluator import: ${path.relative(ROOT, file)}`
    );
    assert(
      !productionSource.includes('evaluateMasteryRolloutSafetyGate'),
      `legacy adapter import: ${path.relative(ROOT, file)}`
    );
  }
});
