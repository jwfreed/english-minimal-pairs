const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const cache = new Map();
const featureFlags = loadTsModule(
  path.join(ROOT, 'src', 'config', 'featureFlags.ts'),
  cache
);
const domain = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'contrastMasteryPersistence.ts'),
  cache
);
const compatibility = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'masteryCompatibility.ts'),
  cache
);
const diagnostics = loadTsModule(
  path.join(ROOT, 'src', 'analytics', 'masteryRolloutDiagnostics.ts'),
  cache
);
const orphanStorage = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'orphanMasteryAdoption.ts'),
  cache
);
const rolloutSafety = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'masteryRolloutSafety.ts'),
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
  const failSetKeys = new Set();
  return {
    values,
    reads,
    writes,
    failSetKeys,
    async getItem(key) {
      reads.push(key);
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      writes.push([key, value]);
      if (failSetKeys.has(key)) throw new Error(`set failed: ${key}`);
      values.set(key, value);
    },
  };
}

function japaneseDocument({
  tier = 3,
  provenance = 'practice',
  tombstone = false,
} = {}) {
  return domain.serializeContrastMasteryDocument({
    schemaVersion: 1,
    languageId: LANGUAGE_IDS.japanese,
    lastRevision: 2,
    records: tombstone
      ? []
      : [
          {
            contrastId: 'contrast.japanese.rL',
            tier,
            revision: 2,
            provenance,
          },
        ],
    tombstones: tombstone
      ? [
          {
            contrastId: 'contrast.japanese.rL',
            revision: 2,
            provenance: 'reset',
          },
        ]
      : [],
  });
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
  await runTest('rollout stages are explicit and default to disabled', () => {
    assert.deepStrictEqual(plain(featureFlags.CONTRAST_MASTERY_ROLLOUT_STATES), [
      'disabled',
      'shadow',
      'internal-test',
      'limited',
      'enabled',
    ]);
    assert.strictEqual(featureFlags.FEATURE_FLAGS.contrastMasteryRollout, 'disabled');
    assert.strictEqual(featureFlags.FEATURE_FLAGS.contrastMasteryStore, false);
    assert.strictEqual(
      featureFlags.isContrastMasteryAuthoritative('shadow'),
      false
    );
    for (const state of ['internal-test', 'limited', 'enabled']) {
      assert.strictEqual(
        featureFlags.isContrastMasteryAuthoritative(state),
        true
      );
    }
  });

  await runTest('rollout safety gate requires shadow evidence and zero unsafe outcomes', () => {
    const cleanEvidence = {
      shadowComparisons: 12,
      unexplainedDivergences: 0,
      unresolvedContrastMappings: 0,
      lostMasteryRecords: 0,
      duplicatedMasteryRecords: 0,
      unexpectedMasteryIncreases: 0,
      unexpectedMasteryDecreases: 0,
      unhandledStableStorageFailures: 0,
      unhandledLegacyStorageFailures: 0,
      unhandledPartialWrites: 0,
      malformedStableFallbacks: 0,
      crossLanguageCollisions: 0,
      aliasRegressions: 0,
      placementFailures: 0,
      resetFailures: 0,
      practiceBehaviorChanges: 0,
    };
    assert.deepStrictEqual(
      plain(
        rolloutSafety.evaluateMasteryRolloutSafetyGate(cleanEvidence)
      ),
      { passed: true, blockers: [] }
    );
    const blocked = rolloutSafety.evaluateMasteryRolloutSafetyGate({
      ...cleanEvidence,
      shadowComparisons: 0,
      unexpectedMasteryDecreases: 1,
      unhandledPartialWrites: 2,
    });
    assert.strictEqual(blocked.passed, false);
    assert.deepStrictEqual(plain(blocked.blockers), [
      'shadowComparisons',
      'unexpectedMasteryDecreases',
      'unhandledPartialWrites',
    ]);
  });

  await runTest('shadow mode reports a clean comparison without any writes', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 3 }),
      '@masteryByContrast_lang.japanese': japaneseDocument(),
    });
    const result = await compatibility.readCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      'shadow'
    );
    assert.strictEqual(result.status, 'ready');
    assert.strictEqual(result.source, 'legacy');
    assert.deepStrictEqual(plain(result.mastery), { rL: 3 });
    assert.strictEqual(result.shadow.status, 'compared');
    assert.strictEqual(result.shadow.divergenceCount, 0);
    assert.strictEqual(result.shadow.unexplainedDivergenceCount, 0);
    assert.strictEqual(result.shadow.unresolvedMappingCount, 0);
    assert.strictEqual(storage.writes.length, 0);
    assert(
      storage.reads.every(
        (key) => !key.startsWith('@masteryByContrastMigration_')
      )
    );
    const metrics = diagnostics.getMasteryRolloutMetrics();
    assert.strictEqual(metrics.stableReadsAttempted, 1);
    assert.strictEqual(metrics.stableReadsSuccessful, 1);
    assert.strictEqual(metrics.shadowComparisons, 1);
    assert.strictEqual(metrics.shadowDivergences, 0);
  });

  await runTest('shadow mode distinguishes expected missing state from unexplained divergence', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 4 }),
    });
    const result = await compatibility.compareMasteryInShadow(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語'
    );
    assert.strictEqual(result.status, 'stable-missing');
    assert.strictEqual(result.divergenceCount, 1);
    assert.strictEqual(result.unexplainedDivergenceCount, 0);
    assert.deepStrictEqual(
      plain(result.divergences.map((item) => item.kind)),
      ['missing-stable-record']
    );
    assert.strictEqual(storage.writes.length, 0);
  });

  await runTest('shadow mode detects tier, placement, reset, and alias disagreements', async () => {
    const placementStorage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
      '@masteryByContrast_lang.japanese': japaneseDocument({
        tier: 2,
        provenance: 'placement',
      }),
    });
    const placement = await compatibility.compareMasteryInShadow(
      placementStorage,
      LANGUAGE_IDS.japanese,
      '日本語'
    );
    assert(
      placement.divergences.some(
        (item) => item.kind === 'placement-disagreement'
      )
    );

    const resetStorage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
      '@masteryByContrast_lang.japanese': japaneseDocument({
        tombstone: true,
      }),
    });
    const reset = await compatibility.compareMasteryInShadow(
      resetStorage,
      LANGUAGE_IDS.japanese,
      '日本語'
    );
    assert(
      reset.divergences.some((item) => item.kind === 'reset-disagreement')
    );

    const aliasStorage = createStorage({
      '@mastery_idioma español': JSON.stringify({ aVsE: 4 }),
      '@mastery_Español': JSON.stringify({ aVsE: 2 }),
    });
    const alias = await compatibility.compareMasteryInShadow(
      aliasStorage,
      LANGUAGE_IDS.spanish,
      'Español'
    );
    assert(
      alias.divergences.some(
        (item) => item.kind === 'alias-resolution-difference'
      )
    );
    assert.strictEqual(alias.unresolvedMappingCount, 0);
  });

  await runTest('authoritative read is stable-first and never activates migration', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
      '@masteryByContrast_lang.japanese': japaneseDocument({ tier: 2 }),
    });
    const result = await compatibility.readCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      'limited'
    );
    assert.strictEqual(result.status, 'ready');
    assert.strictEqual(result.source, 'new');
    assert.deepStrictEqual(plain(result.mastery), { rL: 2 });
    assert.deepStrictEqual(storage.reads, [
      '@masteryByContrast_lang.japanese',
    ]);
    assert.strictEqual(storage.writes.length, 0);
  });

  await runTest('authoritative missing state uses an explicit read-only legacy fallback', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 4 }),
    });
    const result = await compatibility.readCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      'internal-test'
    );
    assert.strictEqual(result.status, 'ready');
    assert.strictEqual(result.source, 'legacy');
    assert.deepStrictEqual(plain(result.mastery), { rL: 4 });
    assert.strictEqual(storage.writes.length, 0);
    assert(!storage.values.has('@masteryByContrast_lang.japanese'));
    assert(!storage.values.has('@masteryByContrastMigration_lang.japanese'));
    assert.strictEqual(
      diagnostics.getMasteryRolloutMetrics().legacyFallbacksUsed,
      1
    );
  });

  await runTest('unusable stable data blocks fallback and remains untouched', async () => {
    const stableBytes = '{bad json';
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 6 }),
      '@masteryByContrast_lang.japanese': stableBytes,
    });
    const result = await compatibility.readCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      'enabled'
    );
    assert.strictEqual(result.status, 'blocked');
    assert.strictEqual(result.reason, 'malformed-stable');
    assert.deepStrictEqual(storage.reads, [
      '@masteryByContrast_lang.japanese',
    ]);
    assert.strictEqual(
      storage.values.get('@masteryByContrast_lang.japanese'),
      stableBytes
    );
    assert.strictEqual(storage.writes.length, 0);
    assert.strictEqual(
      diagnostics.getMasteryRolloutMetrics().legacyFallbacksUsed,
      0
    );
  });

  await runTest('enabled dual writes remain legacy-first and rollback stays readable', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 2 }),
    });
    const write = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 5 },
      'practice',
      'enabled'
    );
    assert.strictEqual(write.status, 'complete');
    assert.strictEqual(write.writeOrder, 'legacy-first');
    assert.deepStrictEqual(
      storage.writes.map(([key]) => key),
      ['@mastery_日本語', '@masteryByContrast_lang.japanese']
    );

    const stableBytes = storage.values.get(
      '@masteryByContrast_lang.japanese'
    );
    const rollbackRead = await compatibility.readCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      'disabled'
    );
    assert.strictEqual(rollbackRead.source, 'legacy');
    assert.deepStrictEqual(plain(rollbackRead.mastery), { rL: 5 });
    assert.strictEqual(
      storage.values.get('@masteryByContrast_lang.japanese'),
      stableBytes
    );
  });

  await runTest('partial writes and orphan operations are measurable', async () => {
    const storage = createStorage();
    storage.failSetKeys.add('@masteryByContrast_lang.japanese');
    const write = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 3 },
      'practice',
      'enabled'
    );
    assert.strictEqual(write.status, 'partial');

    const orphan = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.spanish
    );
    assert.strictEqual(orphan.outcome, 'no-stable-state');
    const metrics = diagnostics.getMasteryRolloutMetrics();
    assert.strictEqual(metrics.partialWrites, 1);
    assert.strictEqual(metrics.storageFailures, 1);
    assert.strictEqual(metrics.orphanAdoptionEvents, 1);
  });
})();
