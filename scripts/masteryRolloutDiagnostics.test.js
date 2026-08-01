const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');
const {
  buildBoundedWorstCaseSnapshot,
  buildLargeAppendableSnapshot,
} = require('./measure-mastery-rollout-diagnostics');

const ROOT = path.join(__dirname, '..');
const cache = new Map();
const diagnosticStorage = loadTsModule(
  path.join(
    ROOT,
    'src',
    'storage',
    'masteryRolloutDiagnosticStorage.ts'
  ),
  cache
);
const diagnostics = loadTsModule(
  path.join(ROOT, 'src', 'analytics', 'masteryRolloutDiagnostics.ts'),
  cache
);
const masteryStorage = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'contrastMasteryStorage.ts'),
  cache
);
const compatibility = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'masteryCompatibility.ts'),
  cache
);
const { LANGUAGE_IDS } = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'language', 'language.ts'),
  cache
);

const plain = (value) => JSON.parse(JSON.stringify(value));

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const reads = [];
  const writes = [];
  let readError = null;
  let writeError = null;

  return {
    values,
    reads,
    writes,
    set readError(error) {
      readError = error;
    },
    set writeError(error) {
      writeError = error;
    },
    async getItem(key) {
      reads.push(key);
      if (readError) throw readError;
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      writes.push([key, value]);
      if (writeError) throw writeError;
      values.set(key, value);
    },
  };
}

async function flushPromises() {
  await new Promise((resolve) => setImmediate(resolve));
  await new Promise((resolve) => setImmediate(resolve));
}

async function runTest(name, fn) {
  diagnostics.resetMasteryRolloutMetrics();
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

module.exports = (async () => {
  await runTest('diagnostics use one learner-state-disjoint storage key', async () => {
    const key = diagnosticStorage.MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY;
    const learnerPrefixes = [
      '@mastery_',
      '@masteryByContrast_',
      '@masteryByContrastMigration_',
      '@pairProgress_v2',
      '@placementDone',
    ];
    assert(learnerPrefixes.every((prefix) => !key.startsWith(prefix)));

    const storage = createStorage({
      '@mastery_日本語': '{"rL":4}',
      '@pairProgress_v2': '{"pair":{"attempts":[]}}',
    });
    const learnerStateBefore = new Map(storage.values);
    const result = await diagnosticStorage.recordDiagnosticEvent(
      {
        name: 'stable-read',
        languageId: LANGUAGE_IDS.japanese,
        status: 'ok',
      },
      storage
    );

    assert.strictEqual(result.status, 'written');
    assert(storage.reads.every((readKey) => readKey === key));
    assert(storage.writes.every(([writeKey]) => writeKey === key));
    assert.strictEqual(
      storage.values.get('@mastery_日本語'),
      learnerStateBefore.get('@mastery_日本語')
    );
    assert.strictEqual(
      storage.values.get('@pairProgress_v2'),
      learnerStateBefore.get('@pairProgress_v2')
    );
  });

  await runTest('diagnostic events persist counters and deterministic snapshots', async () => {
    const storage = createStorage();
    assert.strictEqual(
      (
        await diagnosticStorage.recordDiagnosticEvent(
          {
            name: 'shadow-comparison',
            languageId: LANGUAGE_IDS.japanese,
            status: 'compared',
            stableDocumentPresent: true,
            currentLabelIsHistorical: false,
            historicalIdentityResolutionObserved: 0,
            divergencesByKind: {
              'stable-document-absent': 1,
              'stable-record-absent': 1,
            },
            divergenceCount: 2,
            unexplainedDivergenceCount: 1,
            unresolvedMappingCount: 3,
            malformedLegacyCount: 0,
          },
          storage
        )
      ).status,
      'written'
    );

    const result = await diagnosticStorage.getDiagnosticSnapshot(storage);
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.snapshot.schemaVersion, 2);
    assert.strictEqual(result.snapshot.sequence, 1);
    assert.strictEqual(result.snapshot.firstSequence, 1);
    assert.strictEqual(result.snapshot.metrics.shadowComparisons, 1);
    assert.strictEqual(result.snapshot.metrics.shadowDivergences, 2);
    assert.strictEqual(
      result.snapshot.metrics.shadowUnexplainedDivergences,
      1
    );
    assert.strictEqual(result.snapshot.metrics.unresolvedMappings, 3);
    assert.deepStrictEqual(plain(result.snapshot.recentEvents), [
      {
        sequence: 1,
        rolloutState: 'disabled',
        category: 'shadow-comparison',
        languageId: LANGUAGE_IDS.japanese,
        outcome: 'compared',
        stableDocumentPresent: true,
        currentLabelIsHistorical: false,
        historicalIdentityResolutionObserved: 0,
        divergencesByKind: {
          'stable-document-absent': 1,
          'stable-record-absent': 1,
        },
        divergenceCount: 2,
        unexplainedDivergenceCount: 1,
        unresolvedMappingCount: 3,
        malformedLegacyCount: 0,
      },
    ]);
    const serialized = diagnosticStorage.serializeDiagnosticSnapshot(
      result.snapshot
    );
    assert.strictEqual(
      serialized,
      storage.values.get(
        diagnosticStorage.MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY
      )
    );
    assert.strictEqual(
      diagnosticStorage.serializeDiagnosticSnapshot(
        diagnosticStorage.parseDiagnosticSnapshot(serialized).snapshot
      ),
      serialized
    );
    const reorderedSnapshot = {
      recentEvents: result.snapshot.recentEvents.map((event) => ({
        malformedLegacyCount: event.malformedLegacyCount,
        unresolvedMappingCount: event.unresolvedMappingCount,
        unexplainedDivergenceCount: event.unexplainedDivergenceCount,
        divergenceCount: event.divergenceCount,
        divergencesByKind: event.divergencesByKind,
        historicalIdentityResolutionObserved:
          event.historicalIdentityResolutionObserved,
        currentLabelIsHistorical: event.currentLabelIsHistorical,
        stableDocumentPresent: event.stableDocumentPresent,
        outcome: event.outcome,
        languageId: event.languageId,
        category: event.category,
        rolloutState: event.rolloutState,
        sequence: event.sequence,
      })),
      openConditions: result.snapshot.openConditions,
      rolloutStateObservations: result.snapshot.rolloutStateObservations,
      languageObservations: result.snapshot.languageObservations,
      metrics: Object.fromEntries(
        Object.entries(result.snapshot.metrics).reverse()
      ),
      producerManifest: result.snapshot.producerManifest,
      firstSequence: result.snapshot.firstSequence,
      sequence: result.snapshot.sequence,
      schemaVersion: result.snapshot.schemaVersion,
    };
    assert.strictEqual(
      diagnosticStorage.serializeDiagnosticSnapshot(reorderedSnapshot),
      serialized
    );
  });

  await runTest('concurrent diagnostic reports are serialized without lost counts', async () => {
    const storage = createStorage();
    const results = await Promise.all(
      Array.from({ length: 20 }, () =>
        diagnosticStorage.recordDiagnosticEvent(
          {
            name: 'legacy-fallback',
            languageId: LANGUAGE_IDS.japanese,
            reason: 'missing-stable',
            expected: true,
          },
          storage
        )
      )
    );
    assert(results.every((result) => result.status === 'written'));

    const snapshot = await diagnosticStorage.getDiagnosticSnapshot(storage);
    assert.strictEqual(snapshot.status, 'ok');
    assert.strictEqual(snapshot.snapshot.sequence, 20);
    assert.strictEqual(snapshot.snapshot.metrics.legacyFallbacksUsed, 20);
    assert.strictEqual(snapshot.snapshot.recentEvents.length, 20);
  });

  await runTest('recent diagnostic retention is bounded and drops oldest events', async () => {
    const storage = createStorage();
    const limit = diagnosticStorage.MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS;
    for (let index = 0; index < limit + 5; index += 1) {
      const result = await diagnosticStorage.recordDiagnosticEvent(
        {
          name: 'stable-read',
          languageId: LANGUAGE_IDS.japanese,
          status: 'missing',
        },
        storage
      );
      assert.strictEqual(result.status, 'written');
    }

    const result = await diagnosticStorage.getDiagnosticSnapshot(storage);
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.snapshot.metrics.stableReadsAttempted, limit + 5);
    assert.strictEqual(result.snapshot.recentEvents.length, limit);
    assert.strictEqual(result.snapshot.recentEvents[0].sequence, 6);
    assert.strictEqual(
      result.snapshot.recentEvents[result.snapshot.recentEvents.length - 1]
        .sequence,
      limit + 5
    );
  });

  await runTest('diagnostic snapshot has a measured structural size bound', () => {
    const snapshot = buildBoundedWorstCaseSnapshot();
    const serialized = diagnosticStorage.serializeDiagnosticSnapshot(snapshot);
    const parsed = diagnosticStorage.parseDiagnosticSnapshot(serialized);

    assert.strictEqual(parsed.status, 'ok');
    assert.strictEqual(
      snapshot.recentEvents.length,
      diagnosticStorage.MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS
    );
    assert.strictEqual(
      snapshot.openConditions.length,
      diagnosticStorage.MAX_OPEN_RELIABILITY_CONDITIONS
    );
    assert.strictEqual(Object.keys(snapshot.languageObservations).length, 14);
    assert(
      Buffer.byteLength(serialized, 'utf8') <= 100 * 1024,
      'schema-saturated diagnostic snapshot exceeded the documented 100 KiB bound'
    );
  });

  await runTest('large snapshot append rewrites one bounded whole snapshot', async () => {
    const snapshot = buildLargeAppendableSnapshot();
    const storageKey = diagnosticStorage.MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY;
    const before = diagnosticStorage.serializeDiagnosticSnapshot(snapshot);
    assert.strictEqual(
      diagnosticStorage.parseDiagnosticSnapshot(before).status,
      'ok'
    );
    const lastEvent = snapshot.recentEvents[snapshot.recentEvents.length - 1];
    const event = {
      name: 'shadow-comparison',
      languageId: lastEvent.languageId,
      status: lastEvent.outcome,
      stableDocumentPresent: lastEvent.stableDocumentPresent,
      currentLabelIsHistorical: lastEvent.currentLabelIsHistorical,
      historicalIdentityResolutionObserved:
        lastEvent.historicalIdentityResolutionObserved,
      divergencesByKind: lastEvent.divergencesByKind,
      divergenceCount: lastEvent.divergenceCount,
      unexplainedDivergenceCount: lastEvent.unexplainedDivergenceCount,
      unresolvedMappingCount: lastEvent.unresolvedMappingCount,
      malformedLegacyCount: lastEvent.malformedLegacyCount,
    };
    const storage = createStorage({ [storageKey]: before });

    const result = await diagnosticStorage.recordDiagnosticEvent(
      event,
      storage,
      undefined,
      lastEvent.rolloutState
    );

    assert.strictEqual(result.status, 'written');
    assert.strictEqual(storage.writes.length, 1);
    assert.strictEqual(storage.writes[0][0], storageKey);

    const written = storage.writes[0][1];
    const beforeBytes = Buffer.byteLength(before, 'utf8');
    const writtenBytes = Buffer.byteLength(written, 'utf8');
    const eventBytes = Buffer.byteLength(JSON.stringify(event), 'utf8');
    const logicalGrowthBytes = writtenBytes - beforeBytes;
    const writeAmplification = writtenBytes / eventBytes;
    assert(beforeBytes > 90 * 1024, 'fixture must exercise a large snapshot');
    assert(logicalGrowthBytes > 0, 'append growth must remain observable');
    assert(
      logicalGrowthBytes < 1024,
      'one capped-ring append unexpectedly grew the logical snapshot by 1 KiB or more'
    );
    assert(
      writeAmplification > 50,
      'write no longer exhibits the documented whole-snapshot amplification'
    );
    assert(
      writtenBytes <= 100 * 1024,
      'large snapshot append exceeded the documented 100 KiB bound'
    );

    const parsed = diagnosticStorage.parseDiagnosticSnapshot(written);
    assert.strictEqual(parsed.status, 'ok');
    assert.strictEqual(parsed.snapshot.sequence, snapshot.sequence + 1);
    assert.strictEqual(parsed.snapshot.firstSequence, 2);
    assert.strictEqual(
      parsed.snapshot.recentEvents.length,
      diagnosticStorage.MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS
    );
  });

  await runTest('stalled diagnostic storage retains only a bounded backlog', async () => {
    const storage = createStorage();
    const originalGetItem = storage.getItem.bind(storage);
    let releaseFirstRead;
    const firstReadGate = new Promise((resolve) => {
      releaseFirstRead = resolve;
    });
    let firstRead = true;
    storage.getItem = async (key) => {
      if (firstRead) {
        firstRead = false;
        await firstReadGate;
      }
      return originalGetItem(key);
    };

    const pendingLimit =
      diagnosticStorage.MAX_PENDING_MASTERY_ROLLOUT_DIAGNOSTICS;
    const reportCount = pendingLimit + 26;
    const reports = Array.from({ length: reportCount }, () =>
      diagnosticStorage.recordDiagnosticEvent(
        {
          name: 'stable-read',
          languageId: LANGUAGE_IDS.japanese,
          status: 'missing',
        },
        storage
      )
    );
    await flushPromises();

    const earlyResults = [];
    for (const report of reports) {
      void report.then((result) => earlyResults.push(result));
    }
    await flushPromises();
    assert.strictEqual(
      earlyResults.filter((result) => result.status === 'dropped').length,
      reportCount - (pendingLimit + 1)
    );
    assert.strictEqual(storage.writes.length, 0);

    const learnerStorage = createStorage();
    const restoreSink = diagnostics.setMasteryRolloutDiagnosticSink(
      diagnosticStorage.createPersistentDiagnosticSink(storage)
    );
    try {
      const read = await masteryStorage.readContrastMastery(
        learnerStorage,
        LANGUAGE_IDS.japanese
      );
      assert.strictEqual(read.status, 'missing');
      assert.strictEqual(learnerStorage.writes.length, 0);
      await flushPromises();
      assert.strictEqual(
        diagnostics.getMasteryRolloutMetrics().diagnosticEventsDropped,
        1
      );
    } finally {
      restoreSink();
    }

    releaseFirstRead();
    const results = await Promise.all(reports);
    assert.strictEqual(
      results.filter((result) => result.status === 'written').length,
      pendingLimit + 1
    );
    assert.strictEqual(
      results.filter((result) => result.status === 'dropped').length,
      reportCount - (pendingLimit + 1)
    );

    const snapshot = await diagnosticStorage.getDiagnosticSnapshot(storage);
    assert.strictEqual(snapshot.status, 'ok');
    assert.strictEqual(snapshot.snapshot.sequence, pendingLimit + 1);
    assert.strictEqual(
      snapshot.snapshot.recentEvents.length,
      diagnosticStorage.MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS
    );
  });

  await runTest('malformed diagnostics return an inert empty snapshot and recover on write', async () => {
    const key = diagnosticStorage.MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY;
    const storage = createStorage({ [key]: '{bad json' });

    const malformed = await diagnosticStorage.getDiagnosticSnapshot(storage);
    assert.strictEqual(malformed.status, 'malformed');
    assert.deepStrictEqual(
      plain(malformed.snapshot),
      plain(diagnosticStorage.createEmptyDiagnosticSnapshot())
    );

    const write = await diagnosticStorage.recordDiagnosticEvent(
      {
        name: 'blocked-migration',
        languageId: LANGUAGE_IDS.japanese,
        reason: 'malformed-stable',
      },
      storage
    );
    assert.strictEqual(write.status, 'written');
    const recovered = await diagnosticStorage.getDiagnosticSnapshot(storage);
    assert.strictEqual(recovered.status, 'ok');
    assert.strictEqual(recovered.snapshot.sequence, 1);
  });

  await runTest('unknown learner payload fields cannot enter diagnostic storage', async () => {
    const storage = createStorage();
    const eventWithForbiddenFields = {
      name: 'stable-read',
      languageId: LANGUAGE_IDS.japanese,
      status: 'ok',
      masteryMap: { 'contrast.japanese.rL': 5 },
      tier: 5,
      answer: 'light',
      attempts: [{ isCorrect: true }],
      freeText: 'learner content',
    };

    const write = await diagnosticStorage.recordDiagnosticEvent(
      eventWithForbiddenFields,
      storage
    );
    assert.strictEqual(write.status, 'written');
    const serialized = storage.values.get(
      diagnosticStorage.MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY
    );
    for (const forbidden of [
      'masteryMap',
      'contrast.japanese.rL',
      '"tier":',
      'answer',
      'attempts',
      'freeText',
      'learner content',
    ]) {
      assert(!serialized.includes(forbidden));
    }
  });

  await runTest('schema rejects unknown language scope and unknown producer fields', () => {
    const unknownLanguage = plain(
      diagnosticStorage.createEmptyDiagnosticSnapshot()
    );
    unknownLanguage.languageObservations['lang.unknown'] = {
      shadowComparisons: 1,
      stableReads: 0,
      compatibilityWrites: 0,
      historicalIdentityResolutionObserved: 0,
    };
    assert.strictEqual(
      diagnosticStorage.parseDiagnosticSnapshot(
        JSON.stringify(unknownLanguage)
      ).status,
      'malformed'
    );

    const unknownProducer = plain(
      diagnosticStorage.createEmptyDiagnosticSnapshot()
    );
    unknownProducer.producerManifest.producedFields.push('imaginedSafeField');
    unknownProducer.producerManifest.producedFields.sort();
    assert.strictEqual(
      diagnosticStorage.parseDiagnosticSnapshot(
        JSON.stringify(unknownProducer)
      ).status,
      'malformed'
    );
  });

  await runTest('diagnostic storage failures are safe and observable in memory', async () => {
    const storage = createStorage();
    storage.writeError = new Error('diagnostic write unavailable');
    const result = await diagnosticStorage.recordDiagnosticEvent(
      {
        name: 'stable-read',
        languageId: LANGUAGE_IDS.japanese,
        status: 'missing',
      },
      storage
    );
    assert.strictEqual(result.status, 'storage-error');

    const restoreSink = diagnostics.setMasteryRolloutDiagnosticSink(
      diagnosticStorage.createPersistentDiagnosticSink(storage)
    );
    try {
      diagnostics.reportMasteryRolloutDiagnostic({
        name: 'stable-read',
        languageId: LANGUAGE_IDS.japanese,
        status: 'missing',
      });
      await flushPromises();
      assert.strictEqual(
        diagnostics.getMasteryRolloutMetrics().diagnosticDeliveryFailures,
        1
      );
      assert.strictEqual(
        diagnostics.getMasteryRolloutMetrics().diagnosticEventsDropped,
        0
      );
    } finally {
      restoreSink();
    }
  });

  await runTest('broken or missing diagnostics do not alter learner-state reads', async () => {
    const learnerStorage = createStorage();
    const brokenDiagnostics = createStorage();
    brokenDiagnostics.readError = new Error('diagnostics unavailable');
    let restoreSink = diagnostics.setMasteryRolloutDiagnosticSink(
      diagnosticStorage.createPersistentDiagnosticSink(brokenDiagnostics)
    );
    try {
      const read = await masteryStorage.readContrastMastery(
        learnerStorage,
        LANGUAGE_IDS.japanese
      );
      assert.strictEqual(read.status, 'missing');
      assert.strictEqual(learnerStorage.writes.length, 0);
      await flushPromises();
    } finally {
      restoreSink();
    }

    const emptyDiagnostics = createStorage();
    restoreSink = diagnostics.setMasteryRolloutDiagnosticSink(
      diagnosticStorage.createPersistentDiagnosticSink(emptyDiagnostics)
    );
    try {
      const read = await masteryStorage.readContrastMastery(
        learnerStorage,
        LANGUAGE_IDS.japanese
      );
      assert.strictEqual(read.status, 'missing');
      await flushPromises();
      const snapshot = await diagnosticStorage.getDiagnosticSnapshot(
        emptyDiagnostics
      );
      assert.strictEqual(snapshot.status, 'ok');
      assert.strictEqual(snapshot.snapshot.metrics.stableReadsAttempted, 1);
    } finally {
      restoreSink();
    }
  });

  await runTest('slow diagnostic delivery cannot delay a learner-state read', async () => {
    const learnerStorage = createStorage();
    const neverCompletes = new Promise(() => {});
    const restoreSink = diagnostics.setMasteryRolloutDiagnosticSink(
      () => neverCompletes
    );
    try {
      const read = await masteryStorage.readContrastMastery(
        learnerStorage,
        LANGUAGE_IDS.japanese
      );
      assert.strictEqual(read.status, 'missing');
    } finally {
      restoreSink();
    }
  });

  await runTest('producer manifest declares capability without converting absence to zero', () => {
    const snapshot = diagnosticStorage.createEmptyDiagnosticSnapshot();
    const manifest = snapshot.producerManifest;
    const expectedRuntimeProducedFields = [
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
    assert.strictEqual(manifest.manifestVersion, 1);
    assert.deepStrictEqual(plain(manifest.producedFields), expectedRuntimeProducedFields);
    assert.deepStrictEqual(
      plain(manifest.producedFields),
      [...manifest.producedFields].sort()
    );
    assert.strictEqual(new Set(manifest.producedFields).size, manifest.producedFields.length);
    assert(manifest.producedFields.includes('resetFailures'));
    assert(!manifest.producedFields.includes('lostMasteryRecords'));
    assert(!manifest.producedFields.includes('duplicatedMasteryRecords'));
    assert(!manifest.producedFields.includes('crossLanguageCollisions'));
    assert(!manifest.producedFields.includes('practiceBehaviorChanges'));
    assert.strictEqual(snapshot.metrics.lostMasteryRecords, undefined);

    const reducedCapability = plain(snapshot);
    reducedCapability.producerManifest.producedFields =
      reducedCapability.producerManifest.producedFields.filter(
        (field) => field !== 'resetFailures'
      );
    const parsed = diagnosticStorage.parseDiagnosticSnapshot(
      JSON.stringify(reducedCapability)
    );
    assert.strictEqual(parsed.status, 'ok');
    assert(!parsed.snapshot.producerManifest.producedFields.includes('resetFailures'));
    assert(!JSON.stringify(manifest).includes('verified'));
  });

  await runTest('reliability ledger opens and closes only on same-identity success evidence', async () => {
    const storage = createStorage();
    const record = (event) =>
      diagnosticStorage.recordDiagnosticEvent(event, storage);

    await record({
      name: 'storage-failure',
      languageId: LANGUAGE_IDS.japanese,
      operation: 'read-legacy',
    });
    await record({
      name: 'storage-operation',
      languageId: LANGUAGE_IDS.spanish,
      status: 'success',
      operation: 'read-legacy',
    });
    let snapshot = (await diagnosticStorage.getDiagnosticSnapshot(storage)).snapshot;
    assert.deepStrictEqual(plain(snapshot.openConditions), [
      {
        kind: 'storage-failure',
        languageId: LANGUAGE_IDS.japanese,
        operation: 'read-legacy',
        openedAtSequence: 1,
      },
    ]);

    await record({
      name: 'storage-operation',
      languageId: LANGUAGE_IDS.japanese,
      status: 'success',
      operation: 'read-legacy',
    });
    await record({
      name: 'compatibility-write',
      languageId: LANGUAGE_IDS.japanese,
      provenance: 'practice',
      status: 'partial',
      legacyStatus: 'written',
      stableStatus: 'failed',
    });
    await record({
      name: 'compatibility-write',
      languageId: LANGUAGE_IDS.japanese,
      provenance: 'practice',
      status: 'complete',
      legacyStatus: 'written',
      stableStatus: 'written',
    });
    await record({
      name: 'migration-outcome',
      languageId: LANGUAGE_IDS.arabic,
      status: 'storage-failure',
    });
    await record({
      name: 'migration-outcome',
      languageId: LANGUAGE_IDS.arabic,
      status: 'already-current',
    });
    await record({
      name: 'orphan-adoption',
      languageId: LANGUAGE_IDS.farsi,
      status: 'partial',
      outcome: 'candidates-partially-persisted',
      adoptedRecords: 1,
    });
    await record({
      name: 'orphan-adoption',
      languageId: LANGUAGE_IDS.farsi,
      status: 'complete',
      outcome: 'no-candidates',
      adoptedRecords: 0,
    });

    snapshot = (await diagnosticStorage.getDiagnosticSnapshot(storage)).snapshot;
    assert.deepStrictEqual(plain(snapshot.openConditions), []);
    assert.deepStrictEqual(plain(snapshot.metrics.reliabilityConditionsOpened), {
      'partial-write': 1,
      'storage-failure': 1,
      'migration-failure': 1,
      'orphan-adoption-residue': 1,
    });
    assert.deepStrictEqual(plain(snapshot.metrics.reliabilityConditionsRecovered), {
      'partial-write': 1,
      'storage-failure': 1,
      'migration-failure': 1,
      'orphan-adoption-residue': 1,
    });
  });

  await runTest('repeated failures do not duplicate or age out unresolved conditions', async () => {
    const storage = createStorage();
    const failure = {
      name: 'storage-failure',
      languageId: LANGUAGE_IDS.japanese,
      operation: 'write-stable',
    };
    await diagnosticStorage.recordDiagnosticEvent(failure, storage);
    await diagnosticStorage.recordDiagnosticEvent(failure, storage);
    for (let index = 0; index < 105; index += 1) {
      await diagnosticStorage.recordDiagnosticEvent(
        { name: 'cold-start' },
        storage
      );
    }

    const snapshot = (await diagnosticStorage.getDiagnosticSnapshot(storage)).snapshot;
    assert.strictEqual(snapshot.openConditions.length, 1);
    assert.strictEqual(snapshot.openConditions[0].openedAtSequence, 1);
    assert.strictEqual(snapshot.metrics.reliabilityConditionsOpened['storage-failure'], 2);
    assert.strictEqual(snapshot.metrics.reliabilityConditionsRecovered['storage-failure'], 0);
    assert.strictEqual(snapshot.firstSequence, 8);
  });

  await runTest('ledger overflow refuses new conditions and never evicts prior evidence', async () => {
    const storage = createStorage();
    const languageIds = Object.values(LANGUAGE_IDS);
    const operations = [
      'read-stable',
      'write-stable',
      'read-migration-state',
      'write-migration-state',
      'read-legacy',
      'read-legacy-fallback',
      'write-legacy',
    ];
    for (const languageId of languageIds) {
      for (const operation of operations) {
        await diagnosticStorage.recordDiagnosticEvent(
          { name: 'storage-failure', languageId, operation },
          storage
        );
      }
    }

    const snapshot = (await diagnosticStorage.getDiagnosticSnapshot(storage)).snapshot;
    const attempts = languageIds.length * operations.length;
    assert.strictEqual(
      snapshot.openConditions.length,
      diagnosticStorage.MAX_OPEN_RELIABILITY_CONDITIONS
    );
    assert.strictEqual(
      snapshot.metrics.openConditionOverflow,
      attempts - diagnosticStorage.MAX_OPEN_RELIABILITY_CONDITIONS
    );
    assert.deepStrictEqual(plain(snapshot.openConditions[0]), {
      kind: 'storage-failure',
      languageId: languageIds[0],
      operation: operations[0],
      openedAtSequence: 1,
    });
  });

  await runTest('diagnostic loss remains visible beside zero and nonzero observations', async () => {
    const lossyStorage = createStorage();
    await diagnosticStorage.recordDiagnosticEvent(
      {
        name: 'stable-read',
        languageId: LANGUAGE_IDS.japanese,
        status: 'ok',
      },
      lossyStorage,
      { diagnosticDeliveryFailures: 2, diagnosticEventsDropped: 1 }
    );
    let snapshot = (await diagnosticStorage.getDiagnosticSnapshot(lossyStorage)).snapshot;
    assert.strictEqual(snapshot.metrics.shadowUnexplainedDivergences, 0);
    assert.strictEqual(snapshot.metrics.diagnosticDeliveryFailures, 2);
    assert.strictEqual(snapshot.metrics.diagnosticEventsDropped, 1);

    await diagnosticStorage.recordDiagnosticEvent(
      {
        name: 'storage-failure',
        languageId: LANGUAGE_IDS.japanese,
        operation: 'read-stable',
      },
      lossyStorage,
      { diagnosticDeliveryFailures: 2, diagnosticEventsDropped: 1 }
    );
    snapshot = (await diagnosticStorage.getDiagnosticSnapshot(lossyStorage)).snapshot;
    assert.strictEqual(snapshot.metrics.storageFailures, 1);
    assert.strictEqual(snapshot.metrics.diagnosticEventsDropped, 1);

    const intact = diagnosticStorage.createEmptyDiagnosticSnapshot();
    assert.strictEqual(intact.metrics.shadowUnexplainedDivergences, 0);
    assert.strictEqual(intact.metrics.diagnosticEventsDropped, 0);
    assert.notDeepStrictEqual(
      plain(snapshot.metrics),
      plain(intact.metrics)
    );
  });

  await runTest('queue drops are persisted by already-queued diagnostic work', async () => {
    const storage = createStorage();
    const originalGetItem = storage.getItem.bind(storage);
    let releaseFirstRead;
    const firstReadGate = new Promise((resolve) => {
      releaseFirstRead = resolve;
    });
    let firstRead = true;
    storage.getItem = async (key) => {
      if (firstRead) {
        firstRead = false;
        await firstReadGate;
      }
      return originalGetItem(key);
    };
    const restoreSink = diagnostics.setMasteryRolloutDiagnosticSink(
      diagnosticStorage.createPersistentDiagnosticSink(storage, () => {
        const current = diagnostics.getMasteryRolloutMetrics();
        return {
          diagnosticDeliveryFailures: current.diagnosticDeliveryFailures,
          diagnosticEventsDropped: current.diagnosticEventsDropped,
        };
      })
    );
    const reportCount =
      diagnosticStorage.MAX_PENDING_MASTERY_ROLLOUT_DIAGNOSTICS + 26;
    try {
      for (let index = 0; index < reportCount; index += 1) {
        diagnostics.reportMasteryRolloutDiagnostic({
          name: 'stable-read',
          languageId: LANGUAGE_IDS.japanese,
          status: 'missing',
        });
      }
      await flushPromises();
      const expectedDrops =
        reportCount -
        (diagnosticStorage.MAX_PENDING_MASTERY_ROLLOUT_DIAGNOSTICS + 1);
      assert.strictEqual(
        diagnostics.getMasteryRolloutMetrics().diagnosticEventsDropped,
        expectedDrops
      );

      releaseFirstRead();
      await flushPromises();
      const snapshot = (
        await diagnosticStorage.getDiagnosticSnapshot(storage)
      ).snapshot;
      assert.strictEqual(
        snapshot.metrics.diagnosticEventsDropped,
        expectedDrops
      );
      assert.strictEqual(
        snapshot.metrics.diagnosticDeliveryFailures,
        expectedDrops
      );
      assert.strictEqual(
        snapshot.metrics.stableReadsAttempted,
        diagnosticStorage.MAX_PENDING_MASTERY_ROLLOUT_DIAGNOSTICS + 1
      );
    } finally {
      restoreSink();
    }
  });

  await runTest('historical identity resolution observes alias data but not current-label reads', async () => {
    const diagnosticStore = createStorage();
    const restoreSink = diagnostics.setMasteryRolloutDiagnosticSink(
      diagnosticStorage.createPersistentDiagnosticSink(diagnosticStore)
    );
    try {
      const aliasStorage = createStorage({
        '@mastery_idioma español': JSON.stringify({ aVsE: 4 }),
      });
      const aliasRead = await compatibility.readLegacySourcesForLanguage(
        aliasStorage,
        LANGUAGE_IDS.spanish
      );
      assert.strictEqual(aliasRead.status, 'ok');
      assert.strictEqual(aliasRead.historicalIdentityResolutionObserved, 1);
      await flushPromises();
    } finally {
      restoreSink();
    }

    let snapshot = (await diagnosticStorage.getDiagnosticSnapshot(diagnosticStore)).snapshot;
    assert.strictEqual(
      snapshot.metrics.historicalIdentityResolutionObserved,
      1
    );
    assert.strictEqual(
      snapshot.languageObservations[LANGUAGE_IDS.spanish]
        .historicalIdentityResolutionObserved,
      1
    );

    const currentOnlyStore = createStorage();
    const restoreCurrentSink = diagnostics.setMasteryRolloutDiagnosticSink(
      diagnosticStorage.createPersistentDiagnosticSink(currentOnlyStore)
    );
    try {
      const currentStorage = createStorage({
        '@mastery_Español': JSON.stringify({ aVsE: 4 }),
      });
      const currentRead = await compatibility.readLegacySourcesForLanguage(
        currentStorage,
        LANGUAGE_IDS.spanish
      );
      assert.strictEqual(currentRead.status, 'ok');
      assert.strictEqual(currentRead.historicalIdentityResolutionObserved, 0);
      await flushPromises();
    } finally {
      restoreCurrentSink();
    }
    snapshot = (await diagnosticStorage.getDiagnosticSnapshot(currentOnlyStore)).snapshot;
    assert.strictEqual(snapshot.metrics.historicalIdentityResolutionObserved, 0);
  });

  await runTest('every fallible storage operation emits observed success evidence', async () => {
    const events = [];
    const restoreSink = diagnostics.setMasteryRolloutDiagnosticSink((event) => {
      events.push(event);
    });
    const storage = createStorage();
    try {
      await masteryStorage.readContrastMastery(
        storage,
        LANGUAGE_IDS.japanese
      );
      await masteryStorage.writeContrastMastery(storage, {
        schemaVersion: 1,
        languageId: LANGUAGE_IDS.japanese,
        lastRevision: 0,
        records: [],
        tombstones: [],
      });
      await masteryStorage.readContrastMasteryMigrationState(
        storage,
        LANGUAGE_IDS.japanese
      );
      await masteryStorage.writeContrastMasteryMigrationState(storage, {
        schemaVersion: 1,
        languageId: LANGUAGE_IDS.japanese,
        sourceFingerprint: 'observed-empty-source',
        lastRevision: 0,
        sources: [],
      });
      await compatibility.readLegacySourcesForLanguage(
        storage,
        LANGUAGE_IDS.japanese
      );
      await compatibility.readCompatibleMastery(
        createStorage(),
        LANGUAGE_IDS.japanese,
        '日本語',
        'internal-test'
      );
      await compatibility.writeCompatibleMastery(
        storage,
        LANGUAGE_IDS.japanese,
        '日本語',
        {},
        'practice',
        'disabled'
      );
    } finally {
      restoreSink();
    }

    const successfulOperations = new Set(
      events.flatMap((event) => {
        if (event.name === 'stable-read' && event.status !== 'storage-error') {
          return ['read-stable'];
        }
        if (event.name === 'storage-operation') return [event.operation];
        if (
          event.name === 'compatibility-write' &&
          event.legacyStatus === 'written'
        ) {
          return ['write-legacy'];
        }
        return [];
      })
    );
    assert.deepStrictEqual([...successfulOperations].sort(), [
      'read-legacy',
      'read-legacy-fallback',
      'read-migration-state',
      'read-stable',
      'write-legacy',
      'write-migration-state',
      'write-stable',
    ]);
  });

  await runTest('cold starts and rollout regimes are explicit observations', async () => {
    const coldStartCache = new Map();
    const freshDiagnostics = loadTsModule(
      path.join(ROOT, 'src', 'analytics', 'masteryRolloutDiagnostics.ts'),
      coldStartCache
    );
    const events = [];
    const restoreSink = freshDiagnostics.setMasteryRolloutDiagnosticSink(
      (event) => events.push(event)
    );
    try {
      freshDiagnostics.recordMasteryRolloutColdStart();
      freshDiagnostics.recordMasteryRolloutColdStart();
    } finally {
      restoreSink();
    }
    assert.deepStrictEqual(plain(events), [{ name: 'cold-start' }]);
    assert.strictEqual(freshDiagnostics.getMasteryRolloutMetrics().coldStarts, 1);

    const storage = createStorage();
    await diagnosticStorage.recordDiagnosticEvent(
      { name: 'cold-start' },
      storage,
      undefined,
      'shadow'
    );
    await diagnosticStorage.recordDiagnosticEvent(
      { name: 'cold-start' },
      storage,
      undefined,
      'internal-test'
    );
    const snapshot = (await diagnosticStorage.getDiagnosticSnapshot(storage)).snapshot;
    assert.strictEqual(snapshot.rolloutStateObservations.shadow, 1);
    assert.strictEqual(snapshot.rolloutStateObservations['internal-test'], 1);
  });

  await runTest('diagnostic reducers have no operation trigger and evidence has no runtime consumer', () => {
    const diagnosticSource = fs.readFileSync(
      path.join(ROOT, 'src', 'storage', 'masteryRolloutDiagnosticStorage.ts'),
      'utf8'
    );
    for (const forbidden of [
      "from '@/src/storage/masteryCompatibility'",
      "from '@/src/storage/contrastMasteryStorage'",
      "from '@/src/storage/orphanMasteryAdoption'",
      'migrateLanguageMastery(',
      'adoptOrphanedMasteryForLanguage(',
      'writeCompatibleMastery(',
      'writeContrastMastery(',
      'setTimeout(',
      'Date.now(',
    ]) {
      assert(!diagnosticSource.includes(forbidden), forbidden);
    }

    const runtimeRoots = [
      path.join(ROOT, 'app'),
      path.join(ROOT, 'src'),
    ];
    const sourceFiles = [];
    const visit = (directory) => {
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const file = path.join(directory, entry.name);
        if (entry.isDirectory()) visit(file);
        else if (/\.tsx?$/.test(entry.name)) sourceFiles.push(file);
      }
    };
    runtimeRoots.forEach(visit);

    const diagnosticStorageImporters = sourceFiles.filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      return /from\s+['"][^'"]*masteryRolloutDiagnosticStorage['"]/.test(
        source
      );
    });
    const forbiddenConsumerRoots = [
      path.join(ROOT, 'app'),
      path.join(ROOT, 'src', 'components'),
      path.join(ROOT, 'src', 'config'),
      path.join(ROOT, 'src', 'context'),
      path.join(ROOT, 'src', 'domain'),
      path.join(ROOT, 'src', 'hooks'),
      path.join(ROOT, 'src', 'learning'),
      path.join(ROOT, 'src', 'storage'),
    ];
    const forbiddenConsumerFiles = [];
    forbiddenConsumerRoots.forEach((directory) => {
      const before = sourceFiles.length;
      visit(directory);
      forbiddenConsumerFiles.push(...sourceFiles.slice(before));
    });
    for (const file of forbiddenConsumerFiles) {
      if (
        file ===
        path.join(ROOT, 'src', 'storage', 'masteryRolloutDiagnosticStorage.ts')
      ) {
        continue;
      }
      const source = fs.readFileSync(file, 'utf8');
      assert(!source.includes('masteryRolloutDiagnosticStorage'), file);
      assert(!source.includes('getDiagnosticSnapshot'), file);
      assert(!source.includes('MasteryRolloutDiagnosticSnapshot'), file);
    }
    for (const file of diagnosticStorageImporters) {
      assert(
        !forbiddenConsumerFiles.includes(file),
        `forbidden diagnostic-storage importer class: ${path.relative(ROOT, file)}`
      );
    }

    for (const orchestrationFile of [
      'src/storage/masteryCompatibility.ts',
      'src/storage/orphanMasteryAdoption.ts',
    ]) {
      const source = fs.readFileSync(path.join(ROOT, orchestrationFile), 'utf8');
      assert(!source.includes('getDiagnosticSnapshot'), orchestrationFile);
      assert(!source.includes('MasteryRolloutDiagnosticSnapshot'), orchestrationFile);
      assert(!source.includes('openConditions'), orchestrationFile);
      assert(!source.includes('producerManifest'), orchestrationFile);
    }

    const featureFlagSource = fs.readFileSync(
      path.join(ROOT, 'src', 'config', 'featureFlags.ts'),
      'utf8'
    );
    assert(!/diagnostic/i.test(featureFlagSource));
  });

  await runTest('diagnostic producers expose facts and do not evaluate rollout safety', () => {
    const diagnosticModules = [
      'src/analytics/masteryRolloutDiagnostics.ts',
      'src/storage/masteryRolloutDiagnosticStorage.ts',
    ];
    const forbiddenEvaluatorSymbols = [
      'evaluateMasteryRolloutSafetyGate',
      'MasteryRolloutSafetyEvidence',
      'MasteryRolloutSafetyGateResult',
      'rolloutRecommendation',
      'migrationRecommendation',
      'readinessScore',
      'confidenceScore',
      'safetyDecision',
    ];

    for (const file of diagnosticModules) {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      assert(!source.includes("from '@/src/domain/masteryRolloutSafety'"), file);
      for (const symbol of forbiddenEvaluatorSymbols) {
        assert(!source.includes(symbol), `${file}: ${symbol}`);
      }
    }

    const safetyGateSource = fs.readFileSync(
      path.join(ROOT, 'src', 'domain', 'masteryRolloutSafety.ts'),
      'utf8'
    );
    assert(!safetyGateSource.includes('masteryRolloutDiagnosticStorage'));
    assert(!safetyGateSource.includes('getDiagnosticSnapshot'));
  });

  await runTest('process loss drops queued events without corrupting restart state', async () => {
    const oldCache = new Map();
    const oldDiagnosticStorage = loadTsModule(
      path.join(
        ROOT,
        'src',
        'storage',
        'masteryRolloutDiagnosticStorage.ts'
      ),
      oldCache
    );
    const sharedStorage = createStorage();
    const originalGetItem = sharedStorage.getItem.bind(sharedStorage);
    let abandonNextRead = false;
    const neverCompletes = new Promise(() => {});
    sharedStorage.getItem = async (key) => {
      if (abandonNextRead) {
        abandonNextRead = false;
        await neverCompletes;
      }
      return originalGetItem(key);
    };

    const seed = await oldDiagnosticStorage.recordDiagnosticEvent(
      {
        name: 'stable-read',
        languageId: LANGUAGE_IDS.japanese,
        status: 'ok',
      },
      sharedStorage
    );
    assert.strictEqual(seed.status, 'written');

    abandonNextRead = true;
    void oldDiagnosticStorage.recordDiagnosticEvent(
      {
        name: 'stable-read',
        languageId: LANGUAGE_IDS.japanese,
        status: 'missing',
      },
      sharedStorage
    );
    void oldDiagnosticStorage.recordDiagnosticEvent(
      {
        name: 'blocked-migration',
        languageId: LANGUAGE_IDS.japanese,
        reason: 'malformed-stable',
      },
      sharedStorage
    );
    await flushPromises();

    // A fresh module cache models a new process: the abandoned in-memory
    // queue does not exist, while the last complete snapshot remains.
    const restartCache = new Map();
    const restartedDiagnosticStorage = loadTsModule(
      path.join(
        ROOT,
        'src',
        'storage',
        'masteryRolloutDiagnosticStorage.ts'
      ),
      restartCache
    );
    const restartedDiagnostics = loadTsModule(
      path.join(ROOT, 'src', 'analytics', 'masteryRolloutDiagnostics.ts'),
      restartCache
    );
    const restartedMasteryStorage = loadTsModule(
      path.join(ROOT, 'src', 'storage', 'contrastMasteryStorage.ts'),
      restartCache
    );
    const restartedLanguage = loadTsModule(
      path.join(ROOT, 'src', 'domain', 'language', 'language.ts'),
      restartCache
    );

    const restartWrite = await restartedDiagnosticStorage.recordDiagnosticEvent(
      {
        name: 'legacy-fallback',
        languageId: restartedLanguage.LANGUAGE_IDS.japanese,
        reason: 'missing-stable',
        expected: true,
      },
      sharedStorage
    );
    assert.strictEqual(restartWrite.status, 'written');
    let snapshot = await restartedDiagnosticStorage.getDiagnosticSnapshot(
      sharedStorage
    );
    assert.strictEqual(snapshot.status, 'ok');
    assert.strictEqual(snapshot.snapshot.sequence, 2);
    assert.deepStrictEqual(
      plain(snapshot.snapshot.recentEvents.map((event) => event.category)),
      ['stable-read', 'legacy-fallback']
    );

    const restoreSink = restartedDiagnostics.setMasteryRolloutDiagnosticSink(
      restartedDiagnosticStorage.createPersistentDiagnosticSink(sharedStorage)
    );
    try {
      const learnerStorage = createStorage();
      const learnerRead = await restartedMasteryStorage.readContrastMastery(
        learnerStorage,
        restartedLanguage.LANGUAGE_IDS.japanese
      );
      assert.strictEqual(learnerRead.status, 'missing');
      assert.strictEqual(learnerStorage.writes.length, 0);
      await flushPromises();
    } finally {
      restoreSink();
    }

    snapshot = await restartedDiagnosticStorage.getDiagnosticSnapshot(
      sharedStorage
    );
    assert.strictEqual(snapshot.status, 'ok');
    assert.strictEqual(snapshot.snapshot.sequence, 3);
  });
})();
