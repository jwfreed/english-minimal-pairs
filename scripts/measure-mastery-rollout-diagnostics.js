const assert = require('assert');
const path = require('path');
const { performance } = require('perf_hooks');
const { loadTsModule } = require('./load-ts-module');

const ROOT = path.join(__dirname, '..');
const cache = new Map();
const diagnosticStorage = loadTsModule(
  path.join(ROOT, 'src', 'storage', 'masteryRolloutDiagnosticStorage.ts'),
  cache
);
const { SUPPORTED_LANGUAGE_IDS } = loadTsModule(
  path.join(ROOT, 'src', 'domain', 'identity.ts'),
  cache
);

const MAX_COUNT = Number.MAX_SAFE_INTEGER;
const DIVERGENCE_KINDS = [
  'stable-document-absent',
  'stable-record-absent',
  'legacy-record-absent',
  'tier-disagreement-stable-higher',
  'tier-disagreement-stable-lower',
  'reset-disagreement',
  'placement-disagreement',
  'alias-resolution-difference',
  'unexpected-fallback-behavior',
];
const STORAGE_OPERATIONS = [
  'read-stable',
  'write-stable',
  'read-migration-state',
  'write-migration-state',
  'read-legacy',
  'read-legacy-fallback',
  'write-legacy',
];

function createStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    async setItem(key, value) {
      values.set(key, value);
    },
  };
}

function byteLength(snapshot) {
  return Buffer.byteLength(
    diagnosticStorage.serializeDiagnosticSnapshot(snapshot),
    'utf8'
  );
}

function maximizeCountRecord(record) {
  return Object.fromEntries(Object.keys(record).map((key) => [key, MAX_COUNT]));
}

async function buildTypicalSnapshot() {
  const storage = createStorage();
  await diagnosticStorage.recordDiagnosticEvent({ name: 'cold-start' }, storage);

  for (const languageId of SUPPORTED_LANGUAGE_IDS.slice(0, 3)) {
    await diagnosticStorage.recordDiagnosticEvent(
      { name: 'stable-read', languageId, status: 'ok' },
      storage
    );
    await diagnosticStorage.recordDiagnosticEvent(
      {
        name: 'storage-operation',
        languageId,
        status: 'success',
        operation: 'read-legacy',
        historicalIdentityResolutionObserved: 0,
      },
      storage
    );
    await diagnosticStorage.recordDiagnosticEvent(
      {
        name: 'shadow-comparison',
        languageId,
        status: 'compared',
        stableDocumentPresent: true,
        currentLabelIsHistorical: false,
        historicalIdentityResolutionObserved: 0,
        divergencesByKind: {},
        divergenceCount: 0,
        unexplainedDivergenceCount: 0,
        unresolvedMappingCount: 0,
        malformedLegacyCount: 0,
      },
      storage
    );
    await diagnosticStorage.recordDiagnosticEvent(
      {
        name: 'compatibility-write',
        languageId,
        provenance: 'practice',
        status: 'complete',
        legacyStatus: 'written',
        stableStatus: 'written',
      },
      storage
    );
  }

  return (await diagnosticStorage.getDiagnosticSnapshot(storage)).snapshot;
}

function buildBoundedWorstCaseSnapshot() {
  const snapshot = JSON.parse(
    JSON.stringify(diagnosticStorage.createEmptyDiagnosticSnapshot())
  );
  snapshot.sequence = MAX_COUNT;
  snapshot.firstSequence = MAX_COUNT -
    diagnosticStorage.MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS + 1;
  snapshot.producerManifest.manifestVersion = MAX_COUNT;

  for (const key of Object.keys(snapshot.metrics)) {
    snapshot.metrics[key] =
      typeof snapshot.metrics[key] === 'number'
        ? MAX_COUNT
        : maximizeCountRecord(snapshot.metrics[key]);
  }
  snapshot.languageObservations = Object.fromEntries(
    SUPPORTED_LANGUAGE_IDS.map((languageId) => [
      languageId,
      {
        shadowComparisons: MAX_COUNT,
        stableReads: MAX_COUNT,
        compatibilityWrites: MAX_COUNT,
        historicalIdentityResolutionObserved: MAX_COUNT,
      },
    ])
  );
  snapshot.rolloutStateObservations = maximizeCountRecord(
    snapshot.rolloutStateObservations
  );

  const conditionCandidates = [];
  for (const languageId of SUPPORTED_LANGUAGE_IDS) {
    for (const operation of STORAGE_OPERATIONS) {
      conditionCandidates.push({
        kind: 'storage-failure',
        languageId,
        operation,
        openedAtSequence: MAX_COUNT,
      });
    }
    for (const kind of [
      'partial-write',
      'migration-failure',
      'orphan-adoption-residue',
    ]) {
      conditionCandidates.push({
        kind,
        languageId,
        openedAtSequence: MAX_COUNT,
      });
    }
  }
  snapshot.openConditions = conditionCandidates
    .sort((left, right) => JSON.stringify(right).length - JSON.stringify(left).length)
    .slice(0, diagnosticStorage.MAX_OPEN_RELIABILITY_CONDITIONS);

  const divergencesByKind = Object.fromEntries(
    DIVERGENCE_KINDS.map((kind) => [kind, MAX_COUNT])
  );
  const longestLanguageId = [...SUPPORTED_LANGUAGE_IDS].sort(
    (left, right) => right.length - left.length
  )[0];
  snapshot.recentEvents = Array.from(
    { length: diagnosticStorage.MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS },
    (_, index) => ({
      sequence: snapshot.firstSequence + index,
      rolloutState: 'internal-test',
      category: 'shadow-comparison',
      languageId: longestLanguageId,
      outcome: 'stable-missing',
      stableDocumentPresent: false,
      currentLabelIsHistorical: false,
      historicalIdentityResolutionObserved: MAX_COUNT,
      divergencesByKind,
      divergenceCount: MAX_COUNT,
      unexplainedDivergenceCount: MAX_COUNT,
      unresolvedMappingCount: MAX_COUNT,
      malformedLegacyCount: MAX_COUNT,
    })
  );

  const serialized = diagnosticStorage.serializeDiagnosticSnapshot(snapshot);
  assert.strictEqual(
    diagnosticStorage.parseDiagnosticSnapshot(serialized).status,
    'ok',
    'bounded worst-case fixture must remain valid under the production parser'
  );
  return snapshot;
}

function buildLargeAppendableSnapshot() {
  const snapshot = buildBoundedWorstCaseSnapshot();
  snapshot.sequence = diagnosticStorage.MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS;
  snapshot.firstSequence = 1;
  snapshot.producerManifest.manifestVersion =
    diagnosticStorage.DIAGNOSTIC_PRODUCER_MANIFEST.manifestVersion;
  snapshot.openConditions = snapshot.openConditions.map((condition) => ({
    ...condition,
    openedAtSequence: 1,
  }));
  snapshot.recentEvents = snapshot.recentEvents.map((event, index) => ({
    ...event,
    sequence: index + 1,
  }));

  const serialized = diagnosticStorage.serializeDiagnosticSnapshot(snapshot);
  assert.strictEqual(
    diagnosticStorage.parseDiagnosticSnapshot(serialized).status,
    'ok',
    'large appendable fixture must remain valid under the production parser'
  );
  return snapshot;
}

function percentile(samples, fraction) {
  const sorted = [...samples].sort((left, right) => left - right);
  return sorted[Math.ceil(sorted.length * fraction) - 1];
}

function measureSerialization(snapshot, samples = 100) {
  const durations = [];
  let previous;
  let deterministic = true;
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    const serialized = diagnosticStorage.serializeDiagnosticSnapshot(snapshot);
    durations.push(performance.now() - startedAt);
    if (previous !== undefined && serialized !== previous) deterministic = false;
    previous = serialized;
  }
  return {
    samples,
    deterministic,
    medianMs: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
  };
}

async function measureWrites(samples = 40) {
  const storage = createStorage();
  const durations = [];
  for (let index = 0; index < samples; index += 1) {
    const startedAt = performance.now();
    const result = await diagnosticStorage.recordDiagnosticEvent(
      {
        name: 'stable-read',
        languageId: SUPPORTED_LANGUAGE_IDS[index % SUPPORTED_LANGUAGE_IDS.length],
        status: 'ok',
      },
      storage
    );
    assert.strictEqual(result.status, 'written');
    durations.push(performance.now() - startedAt);
  }

  const perStorageOperationDelayMs = 15;
  const delayedStorage = createStorage();
  const delay = () =>
    new Promise((resolve) => setTimeout(resolve, perStorageOperationDelayMs));
  const originalGetItem = delayedStorage.getItem.bind(delayedStorage);
  const originalSetItem = delayedStorage.setItem.bind(delayedStorage);
  delayedStorage.getItem = async (key) => {
    await delay();
    return originalGetItem(key);
  };
  delayedStorage.setItem = async (key, value) => {
    await delay();
    return originalSetItem(key, value);
  };
  const delayedStartedAt = performance.now();
  const delayedResult = await diagnosticStorage.recordDiagnosticEvent(
    { name: 'cold-start' },
    delayedStorage
  );
  const delayedDurationMs = performance.now() - delayedStartedAt;
  assert.strictEqual(delayedResult.status, 'written');

  return {
    inMemory: {
      samples,
      medianMs: percentile(durations, 0.5),
      p95Ms: percentile(durations, 0.95),
      maxMs: Math.max(...durations),
    },
    delayedAdapter: {
      perStorageOperationDelayMs,
      storageOperationsPerWrite: 2,
      observedEndToEndMs: delayedDurationMs,
    },
  };
}

async function measure() {
  const typical = await buildTypicalSnapshot();
  const boundedWorstCase = buildBoundedWorstCaseSnapshot();
  return {
    environment: {
      node: process.version,
      platform: `${process.platform}-${process.arch}`,
    },
    fixtures: {
      typical: {
        description:
          'one cold start plus clean read, legacy-read, shadow, and compatibility-write evidence for three languages',
        recentEvents: typical.recentEvents.length,
        openConditions: typical.openConditions.length,
        bytes: byteLength(typical),
      },
      boundedWorstCase: {
        description:
          'all schema collections at their caps, all language observations present, maximum safe-integer counts, and the largest event shape',
        recentEvents: boundedWorstCase.recentEvents.length,
        openConditions: boundedWorstCase.openConditions.length,
        languages: Object.keys(boundedWorstCase.languageObservations).length,
        bytes: byteLength(boundedWorstCase),
      },
    },
    serialization: {
      typical: measureSerialization(typical),
      boundedWorstCase: measureSerialization(boundedWorstCase),
    },
    writes: await measureWrites(),
  };
}

if (require.main === module) {
  measure()
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
}

module.exports = {
  buildBoundedWorstCaseSnapshot,
  buildLargeAppendableSnapshot,
  buildTypicalSnapshot,
  measure,
};
