const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

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
      { name: 'stable-read', status: 'ok' },
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
            status: 'compared',
            divergenceCount: 2,
            unexplainedDivergenceCount: 1,
            unresolvedMappingCount: 3,
          },
          storage
        )
      ).status,
      'written'
    );

    const result = await diagnosticStorage.getDiagnosticSnapshot(storage);
    assert.strictEqual(result.status, 'ok');
    assert.strictEqual(result.snapshot.schemaVersion, 1);
    assert.strictEqual(result.snapshot.sequence, 1);
    assert.strictEqual(result.snapshot.metrics.shadowComparisons, 1);
    assert.strictEqual(result.snapshot.metrics.shadowDivergences, 2);
    assert.strictEqual(result.snapshot.metrics.unresolvedMappings, 3);
    assert.deepStrictEqual(plain(result.snapshot.recentEvents), [
      {
        sequence: 1,
        category: 'shadow-comparison',
        outcome: 'compared',
        divergenceCount: 2,
        unexplainedDivergenceCount: 1,
        unresolvedMappingCount: 3,
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
        unresolvedMappingCount: event.unresolvedMappingCount,
        unexplainedDivergenceCount: event.unexplainedDivergenceCount,
        divergenceCount: event.divergenceCount,
        outcome: event.outcome,
        category: event.category,
        sequence: event.sequence,
      })),
      metrics: Object.fromEntries(
        Object.entries(result.snapshot.metrics).reverse()
      ),
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
          { name: 'legacy-fallback', reason: 'missing-stable', expected: true },
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
        { name: 'stable-read', status: 'missing' },
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
        { name: 'stable-read', status: 'missing' },
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
      { name: 'blocked-migration', reason: 'malformed-stable' },
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
      'tier',
      'answer',
      'attempts',
      'freeText',
      'learner content',
    ]) {
      assert(!serialized.includes(forbidden));
    }
  });

  await runTest('diagnostic storage failures are safe and observable in memory', async () => {
    const storage = createStorage();
    storage.writeError = new Error('diagnostic write unavailable');
    const result = await diagnosticStorage.recordDiagnosticEvent(
      { name: 'stable-read', status: 'missing' },
      storage
    );
    assert.strictEqual(result.status, 'storage-error');

    const restoreSink = diagnostics.setMasteryRolloutDiagnosticSink(
      diagnosticStorage.createPersistentDiagnosticSink(storage)
    );
    try {
      diagnostics.reportMasteryRolloutDiagnostic({
        name: 'stable-read',
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
      { name: 'stable-read', status: 'ok' },
      sharedStorage
    );
    assert.strictEqual(seed.status, 'written');

    abandonNextRead = true;
    void oldDiagnosticStorage.recordDiagnosticEvent(
      { name: 'stable-read', status: 'missing' },
      sharedStorage
    );
    void oldDiagnosticStorage.recordDiagnosticEvent(
      { name: 'blocked-migration', reason: 'malformed-stable' },
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
      { name: 'legacy-fallback', reason: 'missing-stable', expected: true },
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
