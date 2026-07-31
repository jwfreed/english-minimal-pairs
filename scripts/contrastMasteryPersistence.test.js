const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const domain = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'contrastMasteryPersistence.ts')
);
const adapter = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'contrastMasteryStorage.ts')
);
const compatibility = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'masteryCompatibility.ts')
);
const { LANGUAGE_IDS } = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'language', 'language.ts')
);
const { FEATURE_FLAGS } = loadTsModule(
  path.join(ROOT, 'src', 'config', 'featureFlags.ts')
);

const plain = (value) => JSON.parse(JSON.stringify(value));

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  const writes = [];
  const reads = [];
  const failSetKeys = new Set();
  const failGetKeys = new Set();
  return {
    values,
    writes,
    reads,
    failSetKeys,
    failGetKeys,
    async getItem(key) {
      reads.push(key);
      if (failGetKeys.has(key)) throw new Error(`get failed: ${key}`);
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      writes.push([key, value]);
      if (failSetKeys.has(key)) throw new Error(`set failed: ${key}`);
      values.set(key, value);
    },
  };
}

async function runTest(name, fn) {
  try {
    await fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

function legacySource(label, value) {
  return {
    storageKey: `@mastery_${label}`,
    categoryLabel: label,
    raw: value === null || typeof value === 'string'
      ? value
      : JSON.stringify(value),
  };
}

function record(document, contrastId) {
  return document.records.find((candidate) => candidate.contrastId === contrastId);
}

module.exports = (async () => {
  await runTest('feature flag is disabled and stable keys use LanguageId', () => {
    assert.strictEqual(FEATURE_FLAGS.contrastMasteryStore, false);
    assert.strictEqual(
      adapter.buildContrastMasteryStorageKey(LANGUAGE_IDS.japanese),
      '@masteryByContrast_lang.japanese'
    );
    assert.strictEqual(
      adapter.buildContrastMasteryMigrationKey(LANGUAGE_IDS.japanese),
      '@masteryByContrastMigration_lang.japanese'
    );
  });

  await runTest('initial aliases reconcile by highest valid tier only once', () => {
    const result = domain.reconcileInitialLegacyMastery(
      LANGUAGE_IDS.spanish,
      [
        legacySource('idioma español', { aVsE: 5 }),
        legacySource('Español', { aVsE: 2 }),
      ]
    );
    assert.strictEqual(result.document.schemaVersion, 1);
    assert.strictEqual(result.document.languageId, 'lang.spanish');
    assert.strictEqual(
      record(result.document, 'contrast.spanish.aVsE').tier,
      5
    );
    assert.deepStrictEqual(plain(result.aliasReconciledContrastIds), [
      'contrast.spanish.aVsE',
    ]);
    assert.strictEqual(
      domain.serializeContrastMasteryDocument(result.document),
      domain.serializeContrastMasteryDocument(
        domain.reconcileInitialLegacyMastery(
          LANGUAGE_IDS.spanish,
          [
            legacySource('Español', { aVsE: 2 }),
            legacySource('idioma español', { aVsE: 5 }),
          ]
        ).document
      )
    );
  });

  await runTest('malformed and unknown legacy evidence remains explicit', () => {
    const result = domain.reconcileInitialLegacyMastery(
      LANGUAGE_IDS.japanese,
      [
        legacySource('日本語', '{"rL":3,"bad":"tier"}'),
        legacySource('Japanese', { rL: 4 }),
        legacySource('日本語', { notReleased: 2 }),
      ]
    );
    assert.strictEqual(
      record(result.document, 'contrast.japanese.rL').tier,
      3
    );
    assert.deepStrictEqual(
      plain(result.malformed.map((item) => item.reason)),
      ['invalid-tier']
    );
    assert.deepStrictEqual(
      plain(result.unresolved.map((item) => item.reason).sort()),
      ['unknown-category-label', 'unknown-group']
    );
  });

  await runTest('steady state is revision-first and permits lowering', () => {
    const initial = domain.reconcileInitialLegacyMastery(
      LANGUAGE_IDS.japanese,
      [legacySource('日本語', { rL: 5 })]
    ).document;
    const lowered = domain.reconcileSteadyStateMastery(initial, [
      {
        contrastId: 'contrast.japanese.rL',
        tier: domain.defineMasteryTier(2),
        revision: 1,
        provenance: 'placement',
      },
    ]);
    const staleHigher = domain.reconcileSteadyStateMastery(lowered, [
      {
        contrastId: 'contrast.japanese.rL',
        tier: domain.defineMasteryTier(6),
        revision: 0,
        provenance: 'legacy-reconciliation',
      },
    ]);
    assert.strictEqual(record(lowered, 'contrast.japanese.rL').tier, 2);
    assert.strictEqual(record(staleHigher, 'contrast.japanese.rL').tier, 2);
    assert.strictEqual(
      record(staleHigher, 'contrast.japanese.rL').provenance,
      'placement'
    );
  });

  await runTest('reset tombstones prevent stale evidence from resurrecting mastery', () => {
    const initial = domain.reconcileInitialLegacyMastery(
      LANGUAGE_IDS.japanese,
      [legacySource('日本語', { rL: 5 })]
    ).document;
    const reset = domain.reconcileSteadyStateMastery(initial, [
      {
        contrastId: 'contrast.japanese.rL',
        revision: 2,
        provenance: 'reset',
      },
    ]);
    const retried = domain.reconcileSteadyStateMastery(reset, [
      {
        contrastId: 'contrast.japanese.rL',
        tier: domain.defineMasteryTier(5),
        revision: 0,
        provenance: 'legacy-reconciliation',
      },
    ]);
    assert.strictEqual(retried.records.length, 0);
    assert.strictEqual(retried.tombstones.length, 1);
    assert.strictEqual(retried.tombstones[0].revision, 2);
  });

  await runTest('adapter distinguishes missing, malformed, and unsupported versions', async () => {
    const key = adapter.buildContrastMasteryStorageKey(LANGUAGE_IDS.japanese);
    const storage = createStorage();
    assert.strictEqual(
      (await adapter.readContrastMastery(storage, LANGUAGE_IDS.japanese)).status,
      'missing'
    );
    storage.values.set(key, '{bad json');
    assert.strictEqual(
      (await adapter.readContrastMastery(storage, LANGUAGE_IDS.japanese)).status,
      'malformed'
    );
    storage.values.set(key, JSON.stringify({ schemaVersion: 99 }));
    const unsupported = await adapter.readContrastMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(unsupported.status, 'unsupported-version');
    assert.strictEqual(unsupported.version, 99);
  });

  await runTest('validated stable payload serialization is deterministic', async () => {
    const document = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 3,
      records: [
        {
          contrastId: 'contrast.japanese.rL',
          tier: 2,
          revision: 3,
          provenance: 'practice',
        },
        {
          contrastId: 'contrast.japanese.bV',
          tier: 4,
          revision: 2,
          provenance: 'placement',
        },
      ],
      tombstones: [],
    };
    const first = domain.serializeContrastMasteryDocument(document);
    const second = domain.serializeContrastMasteryDocument({
      ...document,
      records: [...document.records].reverse(),
    });
    assert.strictEqual(first, second);
    const storage = createStorage();
    assert.strictEqual(
      (await adapter.writeContrastMastery(storage, document)).status,
      'written'
    );
    const read = await adapter.readContrastMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(read.status, 'ok');
    assert.strictEqual(
      read.value.records[0].contrastId,
      'contrast.japanese.bV'
    );
  });

  await runTest('flag-off read and write preserve legacy behavior with zero new writes', async () => {
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 3 }),
    });
    const read = await compatibility.readCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語'
    );
    assert.strictEqual(read.status, 'ready');
    assert.deepStrictEqual(plain(read.mastery), { rL: 3 });
    const write = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 4 },
      'practice'
    );
    assert.strictEqual(write.status, 'complete');
    assert.strictEqual(write.writeOrder, 'legacy-only');
    assert.strictEqual(write.stable.attempted, false);
    assert.strictEqual(write.retryRequired, false);
    assert.strictEqual(storage.values.get('@mastery_日本語'), '{"rL":4}');
    assert.strictEqual(
      storage.writes.filter(([key]) => key.startsWith('@masteryByContrast'))
        .length,
      0
    );
  });

  await runTest('lazy migration is per-language, additive, and idempotent', async () => {
    const original = JSON.stringify({ rL: 3, bV: 2 });
    const storage = createStorage({ '@mastery_日本語': original });
    const first = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    const firstStableBytes = storage.values.get(
      '@masteryByContrast_lang.japanese'
    );
    const firstStateBytes = storage.values.get(
      '@masteryByContrastMigration_lang.japanese'
    );
    const second = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(first.status, 'migrated');
    assert.strictEqual(second.status, 'already-current');
    assert.deepStrictEqual(
      storage.writes.slice(0, 2).map(([key]) => key),
      [
        '@masteryByContrast_lang.japanese',
        '@masteryByContrastMigration_lang.japanese',
      ]
    );
    assert.strictEqual(
      storage.values.get('@masteryByContrast_lang.japanese'),
      firstStableBytes
    );
    assert.strictEqual(
      storage.values.get('@masteryByContrastMigration_lang.japanese'),
      firstStateBytes
    );
    assert.strictEqual(storage.values.get('@mastery_日本語'), original);
    assert(
      storage.reads.every(
        (key) =>
          !key.includes('lang.spanish') &&
          key !== '@mastery_Español' &&
          key !== '@mastery_idioma español'
      )
    );
  });

  await runTest('rollback legacy write receives a newer source revision and can lower', async () => {
    const storage = createStorage({
      '@mastery_idioma español': JSON.stringify({ aVsE: 5 }),
      '@mastery_Español': JSON.stringify({ aVsE: 2 }),
    });
    const initial = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.spanish
    );
    assert.strictEqual(
      record(initial.document, 'contrast.spanish.aVsE').tier,
      5
    );

    storage.values.set('@mastery_Español', JSON.stringify({ aVsE: 1 }));
    const afterRollback = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.spanish
    );
    const lowered = record(
      afterRollback.document,
      'contrast.spanish.aVsE'
    );
    assert.strictEqual(lowered.tier, 1);
    assert.strictEqual(lowered.revision, 1);
    assert.strictEqual(lowered.provenance, 'legacy-reconciliation');
  });

  await runTest('malformed legacy blocks completion without deleting or rewriting evidence', async () => {
    const storage = createStorage({ '@mastery_日本語': '{bad json' });
    const result = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(result.status, 'blocked-by-malformed-data');
    assert.strictEqual(result.source, 'legacy');
    assert.strictEqual(storage.values.get('@mastery_日本語'), '{bad json');
    assert.strictEqual(
      storage.writes.filter(([key]) => key.startsWith('@masteryByContrast'))
        .length,
      0
    );
  });

  await runTest('migration-state write failure is explicit and retry converges', async () => {
    const stateKey = '@masteryByContrastMigration_lang.japanese';
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 3 }),
    });
    storage.failSetKeys.add(stateKey);
    const partial = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(partial.status, 'partially-migrated');
    assert(storage.values.has('@masteryByContrast_lang.japanese'));
    assert(!storage.values.has(stateKey));
    const stableBytes = storage.values.get(
      '@masteryByContrast_lang.japanese'
    );
    storage.writes.length = 0;

    storage.failSetKeys.delete(stateKey);
    const retry = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(retry.status, 'migration-state-recreated');
    assert.strictEqual(
      record(retry.document, 'contrast.japanese.rL').tier,
      3
    );
    assert.strictEqual(retry.document.records.length, 1);
    assert.strictEqual(
      storage.values.get('@masteryByContrast_lang.japanese'),
      stableBytes
    );
    assert.deepStrictEqual(
      storage.writes.map(([key]) => key),
      [stateKey]
    );
  });

  await runTest('compatibility write reports legacy success and stable failure', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const storage = createStorage();
    storage.failSetKeys.add(stableKey);
    const result = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 3 },
      'practice',
      true
    );
    assert.strictEqual(result.status, 'partial');
    assert.strictEqual(result.legacy.status, 'written');
    assert.strictEqual(result.stable.status, 'failed');
    assert.strictEqual(result.stable.attempted, true);
    assert.strictEqual(result.stable.succeededThisInvocation, false);
    assert.strictEqual(result.retryRequired, true);
    assert.strictEqual(storage.values.get('@mastery_日本語'), '{"rL":3}');
  });

  await runTest('retry after a stable-write failure converges from the legacy copy', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const storage = createStorage();
    storage.failSetKeys.add(stableKey);
    const partial = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 3 },
      'practice',
      true
    );
    storage.failSetKeys.delete(stableKey);
    const retry = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 3 },
      'practice',
      true
    );
    const read = await adapter.readContrastMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(partial.status, 'partial');
    assert.strictEqual(retry.status, 'complete');
    assert.strictEqual(read.status, 'ok');
    assert.strictEqual(read.value.records.length, 1);
    assert.strictEqual(record(read.value, 'contrast.japanese.rL').tier, 3);
  });

  await runTest('legacy failure stops before stable write even when stable state pre-exists', async () => {
    const legacyKey = '@mastery_日本語';
    const storage = createStorage();
    await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 2 },
      'practice',
      true
    );
    const stableBytes = storage.values.get(
      '@masteryByContrast_lang.japanese'
    );
    storage.writes.length = 0;
    storage.failSetKeys.add(legacyKey);
    const result = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 3 },
      'practice',
      true
    );
    assert.strictEqual(result.status, 'failed');
    assert.strictEqual(result.writeOrder, 'legacy-first');
    assert.strictEqual(result.legacy.status, 'failed');
    assert.strictEqual(result.legacy.attempted, true);
    assert.strictEqual(result.legacy.succeeded, false);
    assert.strictEqual(result.stable.status, 'not-attempted');
    assert.strictEqual(result.stable.attempted, false);
    assert.strictEqual(result.stable.preExisting, true);
    assert.strictEqual(result.stable.succeededThisInvocation, false);
    assert.strictEqual(result.retryRequired, true);
    assert.strictEqual(
      storage.values.get('@masteryByContrast_lang.japanese'),
      stableBytes
    );
    assert.deepStrictEqual(
      storage.writes.map(([key]) => key),
      [legacyKey]
    );
  });

  await runTest('both compatibility writes succeed and a retry does not duplicate state', async () => {
    const storage = createStorage();
    const first = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 4 },
      'practice',
      true
    );
    const second = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 4 },
      'practice',
      true
    );
    const read = await adapter.readContrastMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(first.status, 'complete');
    assert.strictEqual(second.status, 'complete');
    assert.strictEqual(first.retryRequired, false);
    assert.strictEqual(second.retryRequired, false);
    assert.strictEqual(read.status, 'ok');
    assert.strictEqual(read.value.records.length, 1);
    assert.strictEqual(
      record(read.value, 'contrast.japanese.rL').tier,
      4
    );
  });

  await runTest('placement and reset actions remain valid downward transitions', async () => {
    const storage = createStorage();
    await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 5 },
      'practice',
      true
    );
    await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      { rL: 2 },
      'placement',
      true
    );
    let read = await adapter.readContrastMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(
      record(read.value, 'contrast.japanese.rL').tier,
      2
    );
    assert.strictEqual(
      record(read.value, 'contrast.japanese.rL').provenance,
      'placement'
    );

    await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      {},
      'reset',
      true
    );
    read = await adapter.readContrastMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(read.value.records.length, 0);
    assert.strictEqual(read.value.tombstones.length, 1);
    assert.strictEqual(read.value.tombstones[0].provenance, 'reset');
    assert.strictEqual(storage.values.get('@mastery_日本語'), '{}');
  });

  await runTest('unusable stable state never resurfaces stale mastery after downward actions', async () => {
    const scenarios = [
      {
        name: 'reset tombstone',
        action: async (storage) => {
          await compatibility.writeCompatibleMastery(
            storage,
            LANGUAGE_IDS.japanese,
            '日本語',
            {},
            'reset',
            true
          );
          const stable = await adapter.readContrastMastery(
            storage,
            LANGUAGE_IDS.japanese
          );
          assert.strictEqual(stable.value.tombstones.length, 1);
        },
        corrupt: '{bad json',
        expectedReason: 'malformed-stable',
      },
      {
        name: 'placement lowering',
        action: (storage) =>
          compatibility.writeCompatibleMastery(
            storage,
            LANGUAGE_IDS.japanese,
            '日本語',
            { rL: 2 },
            'placement',
            true
          ),
        corrupt: '{bad json',
        expectedReason: 'malformed-stable',
      },
      {
        name: 'lower-tier practice update',
        action: (storage) =>
          compatibility.writeCompatibleMastery(
            storage,
            LANGUAGE_IDS.japanese,
            '日本語',
            { rL: 2 },
            'practice',
            true
          ),
        corrupt: JSON.stringify({ schemaVersion: 99 }),
        expectedReason: 'unsupported-stable-version',
      },
    ];

    for (const scenario of scenarios) {
      const stableKey = '@masteryByContrast_lang.japanese';
      const storage = createStorage();
      await compatibility.writeCompatibleMastery(
        storage,
        LANGUAGE_IDS.japanese,
        '日本語',
        { rL: 5 },
        'practice',
        true
      );
      await scenario.action(storage);
      storage.values.set('@mastery_日本語', JSON.stringify({ rL: 5 }));
      storage.values.set(stableKey, scenario.corrupt);
      const legacyBytes = storage.values.get('@mastery_日本語');
      const stableBytes = storage.values.get(stableKey);
      storage.writes.length = 0;

      const result = await compatibility.readCompatibleMastery(
        storage,
        LANGUAGE_IDS.japanese,
        '日本語',
        true
      );
      assert.strictEqual(result.status, 'blocked', scenario.name);
      assert.strictEqual(
        result.reason,
        scenario.expectedReason,
        scenario.name
      );
      assert.strictEqual(storage.values.get('@mastery_日本語'), legacyBytes);
      assert.strictEqual(storage.values.get(stableKey), stableBytes);
      assert.strictEqual(storage.writes.length, 0);
    }
  });

  await runTest('marker loss baselines stale legacy evidence without outranking a stable reset', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const stateKey = '@masteryByContrastMigration_lang.japanese';
    const stableDocument = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 7,
      records: [],
      tombstones: [
        {
          contrastId: 'contrast.japanese.rL',
          revision: 7,
          provenance: 'reset',
        },
      ],
    };
    const stableBytes = domain.serializeContrastMasteryDocument(stableDocument);
    const storage = createStorage({
      [stableKey]: stableBytes,
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
    });
    const result = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(result.status, 'migration-state-recreated');
    assert.strictEqual(result.document.records.length, 0);
    assert.strictEqual(result.document.tombstones[0].revision, 7);
    assert.strictEqual(storage.values.get(stableKey), stableBytes);
    assert(storage.values.has(stateKey));
    const marker = JSON.parse(storage.values.get(stateKey));
    assert.strictEqual(marker.lastRevision, 7);
    assert(
      marker.sources.every((source) => source.revision === 0),
      'baseline observations must not claim to be newer than the stable reset'
    );
  });

  await runTest('malformed marker is safely recreated without raising stale legacy above placement', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const stateKey = '@masteryByContrastMigration_lang.japanese';
    const stableDocument = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 4,
      records: [
        {
          contrastId: 'contrast.japanese.rL',
          tier: 2,
          revision: 4,
          provenance: 'placement',
        },
      ],
      tombstones: [],
    };
    const stableBytes = domain.serializeContrastMasteryDocument(stableDocument);
    const storage = createStorage({
      [stableKey]: stableBytes,
      [stateKey]: '{bad marker',
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
    });
    const result = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(result.status, 'migration-state-recreated');
    assert.strictEqual(
      record(result.document, 'contrast.japanese.rL').tier,
      2
    );
    assert.strictEqual(
      record(result.document, 'contrast.japanese.rL').provenance,
      'placement'
    );
    assert.strictEqual(storage.values.get(stableKey), stableBytes);
    assert.doesNotThrow(() => JSON.parse(storage.values.get(stateKey)));
  });

  await runTest('legacy revisions order migration observations, not historical action time', () => {
    const sources = [legacySource('日本語', { rL: 5 })];
    const baseline = domain.updateLegacySourceObservations(
      LANGUAGE_IDS.japanese,
      sources,
      undefined,
      9
    );
    assert.strictEqual(baseline.state.lastRevision, 9);
    assert.strictEqual(baseline.state.sources[0].revision, 0);

    const changed = domain.updateLegacySourceObservations(
      LANGUAGE_IDS.japanese,
      [legacySource('日本語', { rL: 1 })],
      baseline.state,
      9
    );
    assert.strictEqual(changed.state.sources[0].revision, 10);
    assert.strictEqual(changed.inspection.candidates[0].revision, 10);
  });

  await runTest('legacy reset remains recoverable when its stable write fails', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
    });
    await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    storage.failSetKeys.add(stableKey);
    const partial = await compatibility.writeCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      {},
      'reset',
      true
    );
    storage.failSetKeys.delete(stableKey);
    const recovered = await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(partial.status, 'partial');
    assert.strictEqual(recovered.document.records.length, 0);
    assert.strictEqual(recovered.document.tombstones.length, 1);
    assert.strictEqual(
      recovered.document.tombstones[0].contrastId,
      'contrast.japanese.rL'
    );
  });

  await runTest('unsupported stable state blocks instead of resurfacing a legacy alias', async () => {
    const storage = createStorage({
      '@masteryByContrast_lang.spanish': JSON.stringify({
        schemaVersion: 99,
      }),
      '@mastery_idioma español': JSON.stringify({ aVsE: 4 }),
    });
    const result = await compatibility.readCompatibleMastery(
      storage,
      LANGUAGE_IDS.spanish,
      'Español',
      true
    );
    assert.strictEqual(result.status, 'blocked');
    assert.strictEqual(result.reason, 'unsupported-stable-version');
    assert.strictEqual(
      storage.values.get('@masteryByContrast_lang.spanish'),
      '{"schemaVersion":99}'
    );
  });

  await runTest('stable read failure is explicit and does not downgrade to legacy success', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const storage = createStorage({
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
    });
    storage.failGetKeys.add(stableKey);
    const result = await compatibility.readCompatibleMastery(
      storage,
      LANGUAGE_IDS.japanese,
      '日本語',
      true
    );
    assert.strictEqual(result.status, 'blocked');
    assert.strictEqual(result.reason, 'stable-read-failure');
    assert.strictEqual(storage.writes.length, 0);
  });
})();
