const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const masteryDomain = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'contrastMasteryPersistence.ts')
);
const orphanDomain = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'orphanMasteryAdoption.ts')
);
const compatibility = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'masteryCompatibility.ts')
);
const orphanStorage = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'orphanMasteryAdoption.ts')
);
const { LANGUAGE_IDS } = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'language', 'language.ts')
);
const { fixtureNamed } = loadTsModule(
  path.join(ROOT, 'scripts', 'phase3', 'legacyLearnerStateFixtures.ts')
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

function legacySource(label, value) {
  return {
    storageKey: `@mastery_${label}`,
    categoryLabel: label,
    raw:
      value === null || typeof value === 'string'
        ? value
        : JSON.stringify(value),
  };
}

function baseline(
  languageId,
  sources,
  mapping = historicalIdentityMapping
) {
  const initial = masteryDomain.reconcileInitialLegacyMastery(
    languageId,
    sources,
    mapping
  );
  const marker = masteryDomain.updateLegacySourceObservations(
    languageId,
    sources,
    undefined,
    initial.document.lastRevision,
    mapping
  ).state;
  return { document: initial.document, marker };
}

function record(document, contrastId) {
  return document.records.find((candidate) => candidate.contrastId === contrastId);
}

function decodedMarkerPayload(state, storageKey, categoryLabel) {
  const source = state.sources.find(
    (candidate) => candidate.storageKey === storageKey
  );
  assert(source, `missing marker source ${storageKey}`);
  const decoded = masteryDomain.parseLegacySourceFingerprint(
    source.fingerprint,
    categoryLabel
  );
  assert(decoded, `unreadable marker fingerprint for ${storageKey}`);
  return {
    source,
    raw: decoded.raw,
    mastery: decoded.raw === null ? {} : JSON.parse(decoded.raw),
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

module.exports = (async () => {
  await runTest('pure analysis identifies only exact newly observed orphan evidence', () => {
    const original = [legacySource('日本語', { rL: 2 })];
    const { document, marker } = baseline(LANGUAGE_IDS.japanese, original);
    const current = [
      legacySource('日本語', {
        rL: 3,
        bV: 4,
        notReleased: 2,
        sTheta: 'invalid',
      }),
    ];

    const first = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      current
    );
    const repeated = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      current
    );
    const plan = orphanDomain.proposeOrphanMasteryAdoption(document, first);

    assert.deepStrictEqual(plain(repeated), plain(first));
    assert.deepStrictEqual(
      plain(first.adoptableCandidates.map((candidate) => candidate.contrastId)),
      ['contrast.japanese.bV', 'contrast.japanese.rL']
    );
    assert.strictEqual(
      first.adoptableCandidates.find(
        (candidate) => candidate.contrastId === 'contrast.japanese.rL'
      ).revision,
      1,
      'an existing stable identity must not suppress its changed fingerprint'
    );
    assert.strictEqual(first.markerRequiresStableWrite, true);
    assert.deepStrictEqual(plain(first.counts), {
      recognizedLegacyEntries: 2,
      alreadyRepresented: 0,
      adoptable: 2,
      adopted: 0,
      adoptedRecords: 0,
      blocked: 0,
      unresolved: 1,
      malformed: 1,
    });
    assert.strictEqual(plan.counts.adopted, 2);
    assert.strictEqual(plan.counts.adoptedRecords, 2);
    assert.strictEqual(record(plan.document, 'contrast.japanese.rL').tier, 3);
    assert.strictEqual(record(plan.document, 'contrast.japanese.bV').tier, 4);
    assert.deepStrictEqual(
      plain(plan.decisions.map((decision) => decision.decision)),
      ['adopted', 'adopted', 'unresolved', 'malformed']
    );
  });

  await runTest('an unrelated source change does not re-adopt exact baseline evidence', () => {
    const original = [
      legacySource('日本語', { rL: 5 }),
    ];
    const { marker } = baseline(LANGUAGE_IDS.japanese, original);
    const lowered = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 1,
      records: [
        {
          contrastId: 'contrast.japanese.rL',
          tier: 1,
          revision: 1,
          provenance: 'legacy-reconciliation',
        },
      ],
      tombstones: [],
    };
    const analysis = orphanDomain.analyzeOrphanedMastery(
      lowered,
      marker,
      [legacySource('日本語', { rL: 5, bV: 2 })]
    );
    const plan = orphanDomain.proposeOrphanMasteryAdoption(lowered, analysis);

    assert.deepStrictEqual(
      plain(analysis.alreadyRepresentedEvidence.map((item) => item.evidence.contrastId)),
      ['contrast.japanese.rL']
    );
    assert.deepStrictEqual(
      plain(analysis.adoptableCandidates.map((item) => item.contrastId)),
      ['contrast.japanese.bV']
    );
    assert.strictEqual(record(plan.document, 'contrast.japanese.rL').tier, 1);
    assert.strictEqual(record(plan.document, 'contrast.japanese.bV').tier, 2);
  });

  await runTest('reset, placement lowering, and lower-tier practice block stale adoption', () => {
    const original = [
      legacySource('日本語', { rL: 5, bV: 5, sTheta: 5 }),
    ];
    const { marker } = baseline(LANGUAGE_IDS.japanese, original);
    const protectedDocument = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 8,
      records: [
        {
          contrastId: 'contrast.japanese.bV',
          tier: 2,
          revision: 7,
          provenance: 'placement',
        },
        {
          contrastId: 'contrast.japanese.sTheta',
          tier: 2,
          revision: 8,
          provenance: 'practice',
        },
      ],
      tombstones: [
        {
          contrastId: 'contrast.japanese.rL',
          revision: 6,
          provenance: 'reset',
        },
      ],
    };
    const current = [
      legacySource('日本語', { rL: 6, bV: 6, sTheta: 6 }),
    ];
    const analysis = orphanDomain.analyzeOrphanedMastery(
      protectedDocument,
      marker,
      current
    );
    const plan = orphanDomain.proposeOrphanMasteryAdoption(
      protectedDocument,
      analysis
    );

    assert.strictEqual(analysis.counts.adoptable, 0);
    assert.deepStrictEqual(
      plain(analysis.blockedEvidence.map((item) => item.reason).sort()),
      ['reset-tombstone', 'stable-placement', 'stable-practice']
    );
    assert.strictEqual(plan.document.records.length, 2);
    assert.strictEqual(plan.document.tombstones.length, 1);
    assert.strictEqual(record(plan.document, 'contrast.japanese.bV').tier, 2);
    assert.strictEqual(
      record(plan.document, 'contrast.japanese.sTheta').tier,
      2
    );
  });

  await runTest('known fingerprint and newer stable observation remain authoritative', () => {
    const sources = [legacySource('日本語', { rL: 5 })];
    const { marker } = baseline(LANGUAGE_IDS.japanese, sources);
    const stable = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 4,
      records: [
        {
          contrastId: 'contrast.japanese.rL',
          tier: 2,
          revision: 4,
          provenance: 'legacy-reconciliation',
        },
      ],
      tombstones: [],
    };
    const analysis = orphanDomain.analyzeOrphanedMastery(
      stable,
      marker,
      sources
    );
    const plan = orphanDomain.proposeOrphanMasteryAdoption(stable, analysis);

    assert.strictEqual(analysis.counts.adoptable, 0);
    assert.strictEqual(analysis.counts.alreadyRepresented, 1);
    assert.strictEqual(analysis.markerRequiresStableWrite, false);
    assert.strictEqual(
      analysis.alreadyRepresentedEvidence[0].reason,
      'advisory-fingerprint'
    );
    assert.strictEqual(record(plan.document, 'contrast.japanese.rL').tier, 2);
    assert.strictEqual(record(plan.document, 'contrast.japanese.rL').revision, 4);
  });

  await runTest('a later exact historical mapping can recover bytes the marker never represented', () => {
    const sources = [legacySource('日本語', { notReleased: 4 })];
    const stableBeforeMapping = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 0,
      records: [],
      tombstones: [],
    };
    const beforeMapping = orphanDomain.analyzeOrphanedMastery(
      stableBeforeMapping,
      undefined,
      sources
    );
    const mappingWithReleasedAlias = {
      ...historicalIdentityMapping,
      resolveContrast(label, group) {
        return label === '日本語' && group === 'notReleased'
          ? 'contrast.japanese.rL'
          : historicalIdentityMapping.resolveContrast(label, group);
      },
    };
    const analysis = orphanDomain.analyzeOrphanedMastery(
      stableBeforeMapping,
      beforeMapping.nextMigrationState,
      sources,
      mappingWithReleasedAlias
    );
    const plan = orphanDomain.proposeOrphanMasteryAdoption(
      stableBeforeMapping,
      analysis
    );

    assert.strictEqual(beforeMapping.counts.unresolved, 1);
    assert.strictEqual(beforeMapping.counts.adoptable, 0);
    const excludedSource = decodedMarkerPayload(
      beforeMapping.nextMigrationState,
      '@mastery_日本語',
      '日本語'
    );
    assert.strictEqual(excludedSource.raw, null);
    assert.deepStrictEqual(plain(excludedSource.source.contrastIds), []);
    assert.strictEqual(analysis.counts.adoptable, 1);
    assert.strictEqual(analysis.counts.alreadyRepresented, 0);
    assert.strictEqual(plan.adoptedRecords.length, 1);
    assert.strictEqual(
      plan.adoptedRecords[0].contrastId,
      'contrast.japanese.rL'
    );
    assert.strictEqual(plan.adoptedRecords[0].tier, 4);
  });

  await runTest('marker loss permits additive recovery but cannot override stable lowering', () => {
    const stable = {
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
    const analysis = orphanDomain.analyzeOrphanedMastery(
      stable,
      undefined,
      [legacySource('日本語', { rL: 5, bV: 3 })]
    );
    const plan = orphanDomain.proposeOrphanMasteryAdoption(stable, analysis);

    assert.strictEqual(analysis.markerNeedsUpdate, true);
    assert.strictEqual(analysis.markerRequiresStableWrite, true);
    assert.deepStrictEqual(
      plain(analysis.adoptableCandidates.map((candidate) => candidate.contrastId)),
      ['contrast.japanese.bV']
    );
    assert.strictEqual(analysis.blockedEvidence[0].reason, 'stable-placement');
    assert.strictEqual(record(plan.document, 'contrast.japanese.rL').tier, 2);
    assert.strictEqual(record(plan.document, 'contrast.japanese.bV').tier, 3);
    assert.strictEqual(record(plan.document, 'contrast.japanese.bV').revision, 0);
  });

  await runTest('aliases observed together converge once with canonical stable ordering', () => {
    const original = [
      legacySource('idioma español', { aVsE: 2 }),
      legacySource('Español', { aVsE: 2 }),
    ];
    const { document, marker } = baseline(LANGUAGE_IDS.spanish, original);
    const current = [
      legacySource('Español', { aVsE: 4 }),
      legacySource('idioma español', { aVsE: 5 }),
      legacySource('日本語', { rL: 6 }),
      legacySource('Unknown language', { aVsE: 6 }),
    ];
    const analysis = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      current
    );
    const reordered = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      [...current].reverse()
    );
    const plan = orphanDomain.proposeOrphanMasteryAdoption(document, analysis);

    assert.deepStrictEqual(plain(reordered), plain(analysis));
    assert.strictEqual(analysis.counts.adoptable, 2);
    assert.strictEqual(analysis.counts.unresolved, 1);
    const aliasBatch = analysis.observationBatches.find(
      (batch) => batch.contrastId === 'contrast.spanish.aVsE'
    );
    assert.strictEqual(aliasBatch.evidence.length, 2);
    assert.strictEqual(
      aliasBatch.tierPolicy,
      'equal-observation-tier-tiebreak'
    );
    assert.deepStrictEqual(plain(aliasBatch.evidence.map((item) => item.revision)), [
      1,
      1,
    ]);
    assert.strictEqual(plan.adoptedRecords.length, 1);
    assert.strictEqual(plan.adoptedRecords[0].revision, 1);
    assert.strictEqual(plan.adoptedRecords[0].tier, 5);
    assert.strictEqual(plan.document.records.length, 1);
    assert.strictEqual(
      plan.document.records[0].contrastId,
      'contrast.spanish.aVsE'
    );
    assert(
      plan.decisions.every(
        (decision) =>
          !('evidence' in decision) ||
          !decision.evidence.contrastId.startsWith('contrast.japanese.')
      )
    );
  });

  await runTest('same-tier aliases form one equivalent observation batch', () => {
    const original = [
      legacySource('idioma español', { aVsE: 2 }),
      legacySource('Español', { aVsE: 2 }),
    ];
    const { document, marker } = baseline(LANGUAGE_IDS.spanish, original);
    const current = [
      legacySource('Español', { aVsE: 4 }),
      legacySource('idioma español', { aVsE: 4 }),
    ];
    const analysis = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      current
    );
    const plan = orphanDomain.proposeOrphanMasteryAdoption(document, analysis);

    assert.strictEqual(analysis.observationBatches.length, 1);
    assert.strictEqual(
      analysis.observationBatches[0].tierPolicy,
      'equivalent-evidence'
    );
    assert.strictEqual(analysis.observationBatches[0].evidence.length, 2);
    assert.deepStrictEqual(
      plain(analysis.observationBatches[0].evidence.map((item) => item.revision)),
      [1, 1]
    );
    assert.strictEqual(plan.adoptedRecords.length, 1);
    assert.strictEqual(plan.adoptedRecords[0].tier, 4);
  });

  await runTest('three simultaneous aliases cannot gain priority from input order', () => {
    const thirdAlias = 'español histórico adicional';
    const mapping = {
      ...historicalIdentityMapping,
      categoryLabels: [
        ...historicalIdentityMapping.categoryLabels,
        {
          historicalCategoryLabel: thirdAlias,
          currentCategoryLabel: 'Español',
          languageId: LANGUAGE_IDS.spanish,
          isCurrent: false,
        },
      ],
      resolveCategoryLabel(label) {
        return label === thirdAlias
          ? LANGUAGE_IDS.spanish
          : historicalIdentityMapping.resolveCategoryLabel(label);
      },
      resolveContrast(label, group) {
        return label === thirdAlias && group === 'aVsE'
          ? 'contrast.spanish.aVsE'
          : historicalIdentityMapping.resolveContrast(label, group);
      },
    };
    const original = [
      legacySource('Español', { aVsE: 2 }),
      legacySource('idioma español', { aVsE: 2 }),
      legacySource(thirdAlias, { aVsE: 2 }),
    ];
    const { document, marker } = baseline(
      LANGUAGE_IDS.spanish,
      original,
      mapping
    );
    const current = [
      legacySource('Español', { aVsE: 3 }),
      legacySource('idioma español', { aVsE: 5 }),
      legacySource(thirdAlias, { aVsE: 4 }),
    ];
    const forward = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      current,
      mapping
    );
    const reversed = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      [...current].reverse(),
      mapping
    );
    const rotated = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      [current[1], current[2], current[0]],
      mapping
    );
    const plan = orphanDomain.proposeOrphanMasteryAdoption(document, forward);

    assert.deepStrictEqual(plain(reversed), plain(forward));
    assert.deepStrictEqual(plain(rotated), plain(forward));
    assert.strictEqual(forward.observationBatches.length, 1);
    assert.strictEqual(forward.observationBatches[0].evidence.length, 3);
    assert.strictEqual(
      forward.observationBatches[0].tierPolicy,
      'equal-observation-tier-tiebreak'
    );
    assert.deepStrictEqual(
      plain(forward.observationBatches[0].evidence.map((item) => item.revision)),
      [1, 1, 1]
    );
    assert.strictEqual(plan.adoptedRecords.length, 1);
    assert.strictEqual(plan.adoptedRecords[0].tier, 5);
  });

  await runTest('reversed legacy object enumeration has canonical decisions and marker output', () => {
    const original = [
      legacySource('日本語', { rL: 2, bV: 3, sTheta: 1 }),
    ];
    const { document, marker } = baseline(LANGUAGE_IDS.japanese, original);
    const forward = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      [legacySource('日本語', '{"rL":2,"bV":3}')]
    );
    const reversed = orphanDomain.analyzeOrphanedMastery(
      document,
      marker,
      [legacySource('日本語', '{"bV":3,"rL":2}')]
    );
    const decisionSummary = (analysis) =>
      orphanDomain
        .proposeOrphanMasteryAdoption(document, analysis)
        .decisions.map((decision) => ({
          decision: decision.decision,
          legacyGroup: decision.evidence?.legacyGroup,
          reason: decision.reason,
        }));

    assert.deepStrictEqual(
      plain(decisionSummary(reversed)),
      plain(decisionSummary(forward))
    );
    assert.deepStrictEqual(
      plain(reversed.nextMigrationState),
      plain(forward.nextMigrationState)
    );
    assert.deepStrictEqual(
      plain(reversed.observationBatches.map((batch) => batch.contrastId)),
      plain(forward.observationBatches.map((batch) => batch.contrastId))
    );
  });

  await runTest('rollback fixture activity is adopted exactly once without legacy mutation', async () => {
    const fixture = fixtureNamed('post-rollback-divergence');
    const initial = Object.fromEntries(
      fixture.storageEntries.map((entry) => [entry.key, entry.value])
    );
    const storage = createStorage(initial);
    await compatibility.migrateLanguageMastery(storage, LANGUAGE_IDS.spanish);
    storage.values.set('@mastery_Español', JSON.stringify({ aVsE: 5 }));
    const legacyBefore = new Map(
      [...storage.values].filter(([key]) => key.startsWith('@mastery_'))
    );
    storage.writes.length = 0;

    const first = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.spanish
    );
    const stableAfterFirst = storage.values.get(
      '@masteryByContrast_lang.spanish'
    );
    const writeCountAfterFirst = storage.writes.length;
    const second = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.spanish
    );

    assert.strictEqual(first.status, 'complete');
    assert.strictEqual(first.outcome, 'candidates-adopted');
    assert.strictEqual(first.counts.adopted, 1);
    assert.strictEqual(first.counts.adoptedRecords, 1);
    assert.strictEqual(second.status, 'complete');
    assert.strictEqual(second.outcome, 'no-candidates');
    assert.strictEqual(second.counts.adopted, 0);
    assert.strictEqual(
      storage.values.get('@masteryByContrast_lang.spanish'),
      stableAfterFirst
    );
    assert.strictEqual(storage.writes.length, writeCountAfterFirst);
    assert.strictEqual(
      record(second.document, 'contrast.spanish.aVsE').tier,
      5
    );
    assert.deepStrictEqual(
      plain(
        [...storage.values].filter(([key]) => key.startsWith('@mastery_'))
      ),
      plain([...legacyBefore])
    );
  });

  await runTest('stable-first persistence failures are explicit and retries converge', async () => {
    const legacyKey = '@mastery_日本語';
    const stableKey = '@masteryByContrast_lang.japanese';
    const markerKey = '@masteryByContrastMigration_lang.japanese';
    const storage = createStorage({ [legacyKey]: JSON.stringify({ rL: 2 }) });
    await compatibility.migrateLanguageMastery(
      storage,
      LANGUAGE_IDS.japanese
    );
    storage.values.set(legacyKey, JSON.stringify({ rL: 3 }));
    storage.writes.length = 0;

    storage.failSetKeys.add(stableKey);
    const stableFailure =
      await orphanStorage.adoptOrphanedMasteryForLanguage(
        storage,
        LANGUAGE_IDS.japanese
      );
    assert.strictEqual(stableFailure.status, 'failed');
    assert.strictEqual(stableFailure.outcome, 'storage-failure');
    assert.strictEqual(stableFailure.operation, 'write-stable');
    assert.strictEqual(stableFailure.counts.adopted, 0);
    assert.strictEqual(stableFailure.analysis.counts.adoptable, 1);
    const failedProposal =
      masteryDomain.serializeContrastMasteryDocument(
        stableFailure.plan.document
      );
    assert.strictEqual(stableFailure.stableWrite.status, 'failed');
    assert.strictEqual(
      stableFailure.migrationStateWrite.status,
      'not-attempted'
    );
    assert.deepStrictEqual(
      storage.writes.map(([key]) => key),
      [stableKey]
    );
    assert.strictEqual(
      storage.values.get(stableKey),
      masteryDomain.serializeContrastMasteryDocument(
        stableFailure.document
      )
    );

    storage.failSetKeys.delete(stableKey);
    storage.failSetKeys.add(markerKey);
    storage.writes.length = 0;
    const partial = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(partial.status, 'partial');
    assert.strictEqual(partial.outcome, 'candidates-partially-persisted');
    assert.strictEqual(partial.analysis.counts.adoptable, 1);
    assert.strictEqual(
      masteryDomain.serializeContrastMasteryDocument(partial.plan.document),
      failedProposal
    );
    assert.strictEqual(partial.stableWrite.status, 'written');
    assert.strictEqual(partial.migrationStateWrite.status, 'failed');
    assert.deepStrictEqual(
      storage.writes.map(([key]) => key),
      [stableKey, markerKey]
    );

    storage.failSetKeys.delete(markerKey);
    storage.writes.length = 0;
    const retry = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(retry.status, 'complete');
    assert.strictEqual(retry.outcome, 'marker-only-repair');
    assert.strictEqual(retry.counts.adopted, 0);
    assert.strictEqual(retry.stableWrite.attempted, false);
    assert.strictEqual(retry.migrationStateWrite.status, 'written');
    assert.deepStrictEqual(
      storage.writes.map(([key]) => key),
      [markerKey]
    );
    assert.strictEqual(retry.document.records.length, 1);
    assert.strictEqual(
      record(retry.document, 'contrast.japanese.rL').tier,
      3
    );
    const repairedMarker = JSON.parse(storage.values.get(markerKey));
    const repairedSource = decodedMarkerPayload(
      repairedMarker,
      legacyKey,
      '日本語'
    );
    assert.deepStrictEqual(repairedSource.mastery, { rL: 3 });
    assert.deepStrictEqual(repairedSource.source.contrastIds, [
      'contrast.japanese.rL',
    ]);
    assert.strictEqual(
      repairedSource.source.revision,
      record(retry.document, 'contrast.japanese.rL').revision,
      'marker retry must reuse the persisted adoption revision'
    );
    assert.strictEqual(repairedMarker.lastRevision, retry.document.lastRevision);
  });

  await runTest('partial alias-batch retry preserves the winning tier and revision', async () => {
    const stableKey = '@masteryByContrast_lang.spanish';
    const markerKey = '@masteryByContrastMigration_lang.spanish';
    const original = [
      legacySource('Español', { aVsE: 2 }),
      legacySource('idioma español', { aVsE: 2 }),
    ];
    const { document, marker } = baseline(LANGUAGE_IDS.spanish, original);
    const storage = createStorage({
      [stableKey]:
        masteryDomain.serializeContrastMasteryDocument(document),
      [markerKey]:
        masteryDomain.serializeContrastMasteryMigrationState(marker),
      '@mastery_Español': JSON.stringify({ aVsE: 3 }),
      '@mastery_idioma español': JSON.stringify({ aVsE: 5 }),
    });
    storage.failSetKeys.add(markerKey);
    const partial = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.spanish
    );
    const stableAfterPartial = storage.values.get(stableKey);
    const persistedAfterPartial = JSON.parse(stableAfterPartial);

    assert.strictEqual(partial.status, 'partial');
    assert.strictEqual(partial.counts.adopted, 2);
    assert.strictEqual(
      record(persistedAfterPartial, 'contrast.spanish.aVsE').tier,
      5
    );
    assert.strictEqual(
      record(persistedAfterPartial, 'contrast.spanish.aVsE').revision,
      1
    );

    storage.failSetKeys.delete(markerKey);
    storage.writes.length = 0;
    const retry = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.spanish
    );
    const repairedMarker = JSON.parse(storage.values.get(markerKey));

    assert.strictEqual(retry.status, 'complete');
    assert.strictEqual(retry.outcome, 'marker-only-repair');
    assert.strictEqual(retry.counts.adopted, 0);
    assert.strictEqual(retry.counts.alreadyRepresented, 2);
    assert(
      retry.analysis.alreadyRepresentedEvidence.some(
        (item) => item.reason === 'stable-observation-batch'
      )
    );
    assert.strictEqual(storage.values.get(stableKey), stableAfterPartial);
    assert.deepStrictEqual(
      storage.writes.map(([key]) => key),
      [markerKey]
    );
    assert(
      repairedMarker.sources.every((source) => source.revision === 1)
    );
    assert.strictEqual(repairedMarker.lastRevision, 1);

    storage.writes.length = 0;
    const converged = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.spanish
    );
    assert.strictEqual(converged.outcome, 'no-candidates');
    assert.strictEqual(storage.writes.length, 0);
    assert.strictEqual(
      record(converged.document, 'contrast.spanish.aVsE').tier,
      5
    );
    assert.strictEqual(
      record(converged.document, 'contrast.spanish.aVsE').revision,
      1
    );
  });

  await runTest('stable adoption performs one atomic whole-document write', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const markerKey = '@masteryByContrastMigration_lang.japanese';
    const legacyKey = '@mastery_日本語';
    const originalSources = [
      legacySource('日本語', { rL: 2, bV: 2, sTheta: 5 }),
    ];
    const { document, marker } = baseline(
      LANGUAGE_IDS.japanese,
      originalSources
    );
    const originalStableBytes =
      masteryDomain.serializeContrastMasteryDocument(document);
    const storage = createStorage({
      [stableKey]: originalStableBytes,
      [markerKey]:
        masteryDomain.serializeContrastMasteryMigrationState(marker),
      [legacyKey]: JSON.stringify({ rL: 3, bV: 2, aVsUh: 4 }),
    });
    const result = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    const stableWrites = storage.writes.filter(([key]) => key === stableKey);
    const markerWrites = storage.writes.filter(([key]) => key === markerKey);

    assert.strictEqual(result.status, 'complete');
    assert.strictEqual(result.outcome, 'candidates-adopted');
    assert.strictEqual(stableWrites.length, 1);
    assert.strictEqual(markerWrites.length, 1);
    assert.deepStrictEqual(
      storage.writes.map(([key]) => key),
      [stableKey, markerKey]
    );
    assert.strictEqual(
      stableWrites[0][1],
      masteryDomain.serializeContrastMasteryDocument(result.plan.document)
    );
    const persisted = JSON.parse(stableWrites[0][1]);
    assert.deepStrictEqual(
      persisted.records.map((item) => [
        item.contrastId,
        item.tier,
      ]),
      [
        ['contrast.japanese.aVsUh', 4],
        ['contrast.japanese.bV', 2],
        ['contrast.japanese.rL', 3],
        ['contrast.japanese.sTheta', 5],
      ]
    );
    assert(
      storage.writes.every(
        ([key]) =>
          key === stableKey ||
          key === markerKey
      )
    );
    assert.strictEqual(
      masteryDomain.serializeContrastMasteryDocument(document),
      originalStableBytes,
      'proposal and persistence must not mutate the previously read document'
    );
  });

  await runTest('marker repair excludes unresolved evidence and keeps it visible', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const markerKey = '@masteryByContrastMigration_lang.japanese';
    const legacyKey = '@mastery_日本語';
    const stableDocument = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 2,
      records: [
        {
          contrastId: 'contrast.japanese.rL',
          tier: 2,
          revision: 2,
          provenance: 'legacy-reconciliation',
        },
      ],
      tombstones: [],
    };
    const storage = createStorage({
      [stableKey]:
        masteryDomain.serializeContrastMasteryDocument(stableDocument),
      [legacyKey]: JSON.stringify({ rL: 2, notReleased: 4 }),
    });
    const first = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    const marker = JSON.parse(storage.values.get(markerKey));
    const markerSource = decodedMarkerPayload(marker, legacyKey, '日本語');

    assert.strictEqual(first.status, 'complete');
    assert.strictEqual(first.outcome, 'marker-only-repair');
    assert.strictEqual(first.counts.unresolved, 1);
    assert.deepStrictEqual(markerSource.mastery, { rL: 2 });
    assert.deepStrictEqual(markerSource.source.contrastIds, [
      'contrast.japanese.rL',
    ]);
    assert(!markerSource.raw.includes('notReleased'));

    storage.writes.length = 0;
    const retry = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(retry.status, 'complete');
    assert.strictEqual(retry.outcome, 'no-candidates');
    assert.strictEqual(retry.counts.unresolved, 1);
    assert.strictEqual(retry.migrationStateWrite.attempted, false);
    assert.strictEqual(storage.writes.length, 0);
  });

  await runTest('mixed marker projection includes only represented and persisted evidence', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const markerKey = '@masteryByContrastMigration_lang.japanese';
    const legacyKey = '@mastery_日本語';
    const stableDocument = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 4,
      records: [
        {
          contrastId: 'contrast.japanese.bV',
          tier: 2,
          revision: 1,
          provenance: 'legacy-reconciliation',
        },
        {
          contrastId: 'contrast.japanese.rL',
          tier: 2,
          revision: 4,
          provenance: 'placement',
        },
      ],
      tombstones: [],
    };
    const storage = createStorage({
      [stableKey]:
        masteryDomain.serializeContrastMasteryDocument(stableDocument),
      [legacyKey]: JSON.stringify({
        rL: 5,
        bV: 2,
        aVsUh: 3,
        sTheta: 'invalid',
        notReleased: 4,
      }),
    });
    const result = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    const marker = JSON.parse(storage.values.get(markerKey));
    const markerSource = decodedMarkerPayload(marker, legacyKey, '日本語');

    assert.strictEqual(result.status, 'complete');
    assert.strictEqual(result.outcome, 'candidates-adopted');
    assert.deepStrictEqual(plain(result.counts), {
      recognizedLegacyEntries: 3,
      alreadyRepresented: 1,
      adoptable: 1,
      adopted: 1,
      adoptedRecords: 1,
      blocked: 1,
      unresolved: 1,
      malformed: 1,
    });
    assert.deepStrictEqual(markerSource.mastery, { aVsUh: 3, bV: 2 });
    assert.deepStrictEqual(markerSource.source.contrastIds, [
      'contrast.japanese.aVsUh',
      'contrast.japanese.bV',
    ]);
    assert(!markerSource.raw.includes('rL'));
    assert(!markerSource.raw.includes('sTheta'));
    assert(!markerSource.raw.includes('notReleased'));

    storage.writes.length = 0;
    const retry = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(retry.status, 'complete');
    assert.strictEqual(retry.outcome, 'no-candidates');
    assert.strictEqual(retry.counts.alreadyRepresented, 2);
    assert.strictEqual(retry.counts.blocked, 1);
    assert.strictEqual(retry.counts.unresolved, 1);
    assert.strictEqual(retry.counts.malformed, 1);
    assert.strictEqual(retry.migrationStateWrite.attempted, false);
    assert.strictEqual(storage.writes.length, 0);
  });

  await runTest('marker-only repair preserves reset state and stale legacy bytes', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const markerKey = '@masteryByContrastMigration_lang.japanese';
    const legacyBytes = JSON.stringify({ rL: 5 });
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
    const stableBytes =
      masteryDomain.serializeContrastMasteryDocument(stableDocument);
    const storage = createStorage({
      [stableKey]: stableBytes,
      [markerKey]: '{bad marker',
      '@mastery_日本語': legacyBytes,
    });
    const result = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );

    assert.strictEqual(result.status, 'complete');
    assert.strictEqual(result.outcome, 'marker-only-repair');
    assert.strictEqual(result.counts.blocked, 1);
    assert.strictEqual(result.counts.adopted, 0);
    assert.strictEqual(result.stableWrite.attempted, false);
    assert.strictEqual(result.migrationStateWrite.status, 'written');
    assert.strictEqual(storage.values.get(stableKey), stableBytes);
    assert.strictEqual(storage.values.get('@mastery_日本語'), legacyBytes);
    assert.doesNotThrow(() => JSON.parse(storage.values.get(markerKey)));
    const marker = JSON.parse(storage.values.get(markerKey));
    const markerSource = decodedMarkerPayload(
      marker,
      '@mastery_日本語',
      '日本語'
    );
    assert.strictEqual(markerSource.raw, null);
    assert.deepStrictEqual(markerSource.source.contrastIds, []);

    storage.writes.length = 0;
    const retry = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(retry.status, 'complete');
    assert.strictEqual(retry.outcome, 'no-candidates');
    assert.strictEqual(retry.counts.blocked, 1);
    assert.strictEqual(retry.migrationStateWrite.attempted, false);
    assert.strictEqual(storage.writes.length, 0);
  });

  await runTest('malformed marker repair cannot absorb a placement-blocked conflict', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const markerKey = '@masteryByContrastMigration_lang.japanese';
    const legacyKey = '@mastery_日本語';
    const stableDocument = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 5,
      records: [
        {
          contrastId: 'contrast.japanese.rL',
          tier: 2,
          revision: 5,
          provenance: 'placement',
        },
      ],
      tombstones: [],
    };
    const storage = createStorage({
      [stableKey]:
        masteryDomain.serializeContrastMasteryDocument(stableDocument),
      [markerKey]: '{bad marker',
      [legacyKey]: JSON.stringify({ rL: 5 }),
    });
    const first = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    const marker = JSON.parse(storage.values.get(markerKey));
    const markerSource = decodedMarkerPayload(marker, legacyKey, '日本語');

    assert.strictEqual(first.status, 'complete');
    assert.strictEqual(first.outcome, 'marker-only-repair');
    assert.strictEqual(first.counts.blocked, 1);
    assert.strictEqual(
      first.analysis.blockedEvidence[0].reason,
      'stable-placement'
    );
    assert.strictEqual(markerSource.raw, null);
    assert.deepStrictEqual(markerSource.source.contrastIds, []);

    storage.writes.length = 0;
    const retry = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );
    assert.strictEqual(retry.status, 'complete');
    assert.strictEqual(retry.outcome, 'no-candidates');
    assert.strictEqual(retry.counts.blocked, 1);
    assert.strictEqual(
      retry.analysis.blockedEvidence[0].reason,
      'stable-placement'
    );
    assert.strictEqual(retry.migrationStateWrite.attempted, false);
    assert.strictEqual(storage.writes.length, 0);
  });

  await runTest('a failed marker-only repair is failed rather than reported complete', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const markerKey = '@masteryByContrastMigration_lang.japanese';
    const stableDocument = {
      schemaVersion: 1,
      languageId: LANGUAGE_IDS.japanese,
      lastRevision: 3,
      records: [
        {
          contrastId: 'contrast.japanese.rL',
          tier: 2,
          revision: 3,
          provenance: 'placement',
        },
      ],
      tombstones: [],
    };
    const storage = createStorage({
      [stableKey]:
        masteryDomain.serializeContrastMasteryDocument(stableDocument),
      '@mastery_日本語': JSON.stringify({ rL: 5 }),
    });
    storage.failSetKeys.add(markerKey);
    const result = await orphanStorage.adoptOrphanedMasteryForLanguage(
      storage,
      LANGUAGE_IDS.japanese
    );

    assert.strictEqual(result.status, 'failed');
    assert.strictEqual(result.outcome, 'storage-failure');
    assert.strictEqual(result.operation, 'write-migration-state');
    assert.strictEqual(result.stableWrite.attempted, false);
    assert.strictEqual(result.migrationStateWrite.status, 'failed');
    assert.strictEqual(result.retryRequired, true);
    assert.deepStrictEqual(
      storage.writes.map(([key]) => key),
      [markerKey]
    );
  });

  await runTest('missing or unusable stable state never triggers legacy or marker writes', async () => {
    const cases = [
      {
        name: 'missing',
        initial: { '@mastery_日本語': JSON.stringify({ rL: 4 }) },
        expected: 'no-stable-state',
      },
      {
        name: 'malformed',
        initial: {
          '@masteryByContrast_lang.japanese': '{bad json',
          '@mastery_日本語': JSON.stringify({ rL: 4 }),
        },
        expected: 'blocked-by-unusable-stable',
      },
      {
        name: 'unsupported',
        initial: {
          '@masteryByContrast_lang.japanese': JSON.stringify({
            schemaVersion: 99,
          }),
          '@mastery_日本語': JSON.stringify({ rL: 4 }),
        },
        expected: 'blocked-by-unusable-stable',
      },
    ];
    for (const scenario of cases) {
      const storage = createStorage(scenario.initial);
      const result = await orphanStorage.adoptOrphanedMasteryForLanguage(
        storage,
        LANGUAGE_IDS.japanese
      );
      assert.strictEqual(result.status, 'failed', scenario.name);
      assert.strictEqual(result.outcome, scenario.expected, scenario.name);
      assert.strictEqual(storage.writes.length, 0, scenario.name);
    }
  });

  await runTest('storage read failures are reported without fallback or writes', async () => {
    const stableKey = '@masteryByContrast_lang.japanese';
    const markerKey = '@masteryByContrastMigration_lang.japanese';
    const source = [legacySource('日本語', { rL: 2 })];
    const { document, marker } = baseline(LANGUAGE_IDS.japanese, source);
    const storage = createStorage({
      [stableKey]: masteryDomain.serializeContrastMasteryDocument(document),
      [markerKey]:
        masteryDomain.serializeContrastMasteryMigrationState(marker),
      '@mastery_日本語': source[0].raw,
    });
    storage.failGetKeys.add(stableKey);
    const stableFailure =
      await orphanStorage.adoptOrphanedMasteryForLanguage(
        storage,
        LANGUAGE_IDS.japanese
      );
    assert.strictEqual(stableFailure.status, 'failed');
    assert.strictEqual(stableFailure.operation, 'read-stable');
    assert.strictEqual(storage.writes.length, 0);

    storage.failGetKeys.delete(stableKey);
    storage.failGetKeys.add(markerKey);
    const markerFailure =
      await orphanStorage.adoptOrphanedMasteryForLanguage(
        storage,
        LANGUAGE_IDS.japanese
      );
    assert.strictEqual(markerFailure.status, 'failed');
    assert.strictEqual(markerFailure.operation, 'read-migration-state');
    assert.strictEqual(storage.writes.length, 0);

    storage.failGetKeys.delete(markerKey);
    storage.failGetKeys.add('@mastery_日本語');
    const legacyFailure =
      await orphanStorage.adoptOrphanedMasteryForLanguage(
        storage,
        LANGUAGE_IDS.japanese
      );
    assert.strictEqual(legacyFailure.status, 'failed');
    assert.strictEqual(legacyFailure.operation, 'read-legacy');
    assert.strictEqual(storage.writes.length, 0);
  });

  await runTest('operation remains explicit and does not alter the feature flag', () => {
    const { FEATURE_FLAGS } = loadTsModule(
      path.join(ROOT, 'src', 'config', 'featureFlags.ts')
    );
    const hookSource = require('fs').readFileSync(
      path.join(ROOT, 'src', 'hooks', 'useContrastPairs.ts'),
      'utf8'
    );
    assert.strictEqual(FEATURE_FLAGS.contrastMasteryStore, false);
    assert(!hookSource.includes('adoptOrphanedMasteryForLanguage'));
    assert.strictEqual(
      typeof orphanStorage.adoptOrphanedMasteryForLanguage,
      'function'
    );
  });
})();
