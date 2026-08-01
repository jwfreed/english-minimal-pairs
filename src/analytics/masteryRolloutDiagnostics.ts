import {
  createPersistentDiagnosticSink,
  DiagnosticQueueFullError,
} from '@/src/storage/masteryRolloutDiagnosticStorage';
import type { LazyMasteryMigrationResult, MasteryShadowDivergenceKind } from '@/src/storage/masteryCompatibility';
import type { LanguageId } from '@/src/domain/identity';

export type OrphanAdoptionDiagnosticOutcome =
  | 'no-stable-state'
  | 'blocked-by-unusable-stable'
  | 'no-candidates'
  | 'candidates-adopted'
  | 'candidates-partially-persisted'
  | 'marker-only-repair'
  | 'storage-failure';

export type MasteryRolloutStorageFailureOperation =
  | 'read-stable'
  | 'write-stable'
  | 'read-migration-state'
  | 'write-migration-state'
  | 'read-legacy'
  | 'read-legacy-fallback'
  | 'write-legacy';

export type MasteryRolloutStorageSuccessOperation =
  MasteryRolloutStorageFailureOperation;

export type MasteryMigrationDiagnosticOutcome =
  LazyMasteryMigrationResult['status'];

export type MasteryRolloutDiagnosticEvent =
  | {
      readonly name: 'stable-read';
      readonly languageId: LanguageId;
      readonly status:
        | 'ok'
        | 'missing'
        | 'malformed'
        | 'unsupported-version'
        | 'storage-error';
    }
  | {
      readonly name: 'legacy-fallback';
      readonly languageId: LanguageId;
      readonly reason: 'missing-stable';
      readonly expected: true;
    }
  | {
      readonly name: 'shadow-comparison';
      readonly languageId: LanguageId;
      readonly status: 'compared' | 'stable-missing' | 'blocked';
      readonly stableDocumentPresent: boolean;
      readonly currentLabelIsHistorical: boolean;
      readonly historicalIdentityResolutionObserved: number;
      readonly divergencesByKind: Partial<
        Record<MasteryShadowDivergenceKind, number>
      >;
      readonly divergenceCount: number;
      readonly unexplainedDivergenceCount: number;
      readonly unresolvedMappingCount: number;
      readonly malformedLegacyCount: number;
    }
  | {
      readonly name: 'reconciliation-conflict';
      readonly languageId: LanguageId;
      readonly count: number;
    }
  | {
      readonly name: 'blocked-migration';
      readonly languageId: LanguageId;
      readonly reason:
        | 'malformed-stable'
        | 'unsupported-stable-version'
        | 'malformed-legacy';
    }
  | {
      readonly name: 'migration-outcome';
      readonly languageId: LanguageId;
      readonly status: MasteryMigrationDiagnosticOutcome;
    }
  | {
      readonly name: 'compatibility-write';
      readonly languageId: LanguageId;
      readonly provenance: 'practice' | 'placement' | 'reset';
      readonly status: 'complete' | 'partial' | 'failed';
      readonly legacyStatus: 'not-attempted' | 'written' | 'failed' | 'blocked';
      readonly stableStatus: 'not-attempted' | 'written' | 'failed' | 'blocked';
    }
  | {
      readonly name: 'orphan-adoption';
      readonly languageId: LanguageId;
      readonly status: 'complete' | 'partial' | 'failed';
      readonly outcome: OrphanAdoptionDiagnosticOutcome;
      readonly adoptedRecords: number;
    }
  | {
      readonly name: 'storage-failure';
      readonly languageId: LanguageId;
      readonly operation: MasteryRolloutStorageFailureOperation;
    }
  | {
      readonly name: 'storage-operation';
      readonly languageId: LanguageId;
      readonly status: 'success';
      readonly operation: MasteryRolloutStorageSuccessOperation;
      /** Non-zero only when a non-current historical label held data. */
      readonly historicalIdentityResolutionObserved?: number;
    }
  | {
      readonly name: 'cold-start';
    };

type StableReadOutcome = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'stable-read' }
>['status'];
type CompatibilityWriteStatus = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'compatibility-write' }
>['status'];
type CompatibilityWriteProvenance = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'compatibility-write' }
>['provenance'];
type OrphanAdoptionStatus = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'orphan-adoption' }
>['status'];

export interface MasteryRolloutMetrics {
  readonly stableReadsAttempted: number;
  readonly stableReadsSuccessful: number;
  readonly legacyFallbacksUsed: number;
  readonly reconciliationConflicts: number;
  readonly blockedMigrations: number;
  readonly orphanAdoptionEvents: number;
  readonly compatibilityWrites: number;
  readonly partialWrites: number;
  readonly storageFailures: number;
  readonly shadowComparisons: number;
  readonly shadowDivergences: number;
  readonly shadowUnexplainedDivergences: number;
  readonly unresolvedMappings: number;
  readonly blockedComparisons: number;
  readonly legacySourceReadsAttempted: number;
  readonly migrationAttempts: number;
  readonly coldStarts: number;
  readonly historicalIdentityResolutionObserved: number;
  readonly divergencesByKind: Readonly<
    Record<MasteryShadowDivergenceKind, number>
  >;
  readonly storageFailuresByOperation: Readonly<
    Record<MasteryRolloutStorageFailureOperation, number>
  >;
  readonly storageOperationSuccessesByOperation: Readonly<
    Record<MasteryRolloutStorageSuccessOperation, number>
  >;
  readonly stableReadsByStatus: Readonly<Record<StableReadOutcome, number>>;
  readonly compatibilityWritesByStatus: Readonly<
    Record<CompatibilityWriteStatus, number>
  >;
  readonly compatibilityWritesByProvenance: Readonly<
    Record<CompatibilityWriteProvenance, number>
  >;
  readonly orphanAdoptionsByStatus: Readonly<
    Record<OrphanAdoptionStatus, number>
  >;
  readonly migrationOutcomes: Readonly<
    Record<MasteryMigrationDiagnosticOutcome, number>
  >;
  readonly diagnosticDeliveryFailures: number;
  readonly diagnosticEventsDropped: number;
}

export interface DiagnosticSelfMetrics {
  readonly diagnosticDeliveryFailures: number;
  readonly diagnosticEventsDropped: number;
}

export type MasteryRolloutDiagnosticSink = (
  event: MasteryRolloutDiagnosticEvent
) => void | Promise<void>;

const DIVERGENCE_KINDS: readonly MasteryShadowDivergenceKind[] = [
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
const STORAGE_OPERATIONS: readonly MasteryRolloutStorageFailureOperation[] = [
  'read-stable',
  'write-stable',
  'read-migration-state',
  'write-migration-state',
  'read-legacy',
  'read-legacy-fallback',
  'write-legacy',
];
const STABLE_READ_OUTCOMES: readonly StableReadOutcome[] = [
  'ok',
  'missing',
  'malformed',
  'unsupported-version',
  'storage-error',
];
const WRITE_STATUSES: readonly CompatibilityWriteStatus[] = [
  'complete',
  'partial',
  'failed',
];
const WRITE_PROVENANCES: readonly CompatibilityWriteProvenance[] = [
  'practice',
  'placement',
  'reset',
];
const ORPHAN_STATUSES: readonly OrphanAdoptionStatus[] = [
  'complete',
  'partial',
  'failed',
];
const MIGRATION_OUTCOMES: readonly MasteryMigrationDiagnosticOutcome[] = [
  'already-current',
  'migrated',
  'migration-state-recreated',
  'unresolved-historical-identities',
  'partially-migrated',
  'degraded',
  'blocked-by-unusable-stable',
  'blocked-by-malformed-data',
  'storage-failure',
];

function zeroRecord<Key extends string>(keys: readonly Key[]): Record<Key, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
}

function createMetrics(): MasteryRolloutMetrics {
  return {
    stableReadsAttempted: 0,
    stableReadsSuccessful: 0,
    legacyFallbacksUsed: 0,
    reconciliationConflicts: 0,
    blockedMigrations: 0,
    orphanAdoptionEvents: 0,
    compatibilityWrites: 0,
    partialWrites: 0,
    storageFailures: 0,
    shadowComparisons: 0,
    shadowDivergences: 0,
    shadowUnexplainedDivergences: 0,
    unresolvedMappings: 0,
    blockedComparisons: 0,
    legacySourceReadsAttempted: 0,
    migrationAttempts: 0,
    coldStarts: 0,
    historicalIdentityResolutionObserved: 0,
    divergencesByKind: zeroRecord(DIVERGENCE_KINDS),
    storageFailuresByOperation: zeroRecord(STORAGE_OPERATIONS),
    storageOperationSuccessesByOperation: zeroRecord(STORAGE_OPERATIONS),
    stableReadsByStatus: zeroRecord(STABLE_READ_OUTCOMES),
    compatibilityWritesByStatus: zeroRecord(WRITE_STATUSES),
    compatibilityWritesByProvenance: zeroRecord(WRITE_PROVENANCES),
    orphanAdoptionsByStatus: zeroRecord(ORPHAN_STATUSES),
    migrationOutcomes: zeroRecord(MIGRATION_OUTCOMES),
    diagnosticDeliveryFailures: 0,
    diagnosticEventsDropped: 0,
  };
}

type MutableMetrics = {
  -readonly [Key in keyof MasteryRolloutMetrics]: MasteryRolloutMetrics[Key];
};

let metrics = createMetrics() as MutableMetrics;

const persistentSink = createPersistentDiagnosticSink(undefined, () => ({
  diagnosticDeliveryFailures: metrics.diagnosticDeliveryFailures,
  diagnosticEventsDropped: metrics.diagnosticEventsDropped,
}));
const defaultSink: MasteryRolloutDiagnosticSink = (event) => {
  if (__DEV__) {
    console.debug('[mastery-rollout]', event.name, event);
  }
  return persistentSink(event);
};

let sink: MasteryRolloutDiagnosticSink = defaultSink;
let coldStartRecorded = false;

function incrementMap<Key extends string>(
  map: Readonly<Record<Key, number>>,
  key: Key,
  amount = 1
): void {
  const mutable = map as Record<Key, number>;
  mutable[key] = Math.min(Number.MAX_SAFE_INTEGER, mutable[key] + amount);
}

function incrementMetric<Key extends keyof MasteryRolloutMetrics>(
  key: Key,
  amount = 1
): void {
  const current = metrics[key];
  if (typeof current === 'number') {
    (metrics as unknown as Record<Key, number>)[key] = Math.min(
      Number.MAX_SAFE_INTEGER,
      current + amount
    );
  }
}

function updateMetrics(event: MasteryRolloutDiagnosticEvent): void {
  switch (event.name) {
    case 'stable-read':
      incrementMetric('stableReadsAttempted');
      incrementMap(metrics.stableReadsByStatus, event.status);
      if (event.status === 'ok') incrementMetric('stableReadsSuccessful');
      if (event.status !== 'storage-error') {
        incrementMap(metrics.storageOperationSuccessesByOperation, 'read-stable');
      }
      return;
    case 'legacy-fallback':
      incrementMetric('legacyFallbacksUsed');
      return;
    case 'shadow-comparison':
      incrementMetric('shadowComparisons');
      incrementMetric('shadowDivergences', event.divergenceCount);
      incrementMetric(
        'shadowUnexplainedDivergences',
        event.unexplainedDivergenceCount
      );
      incrementMetric('unresolvedMappings', event.unresolvedMappingCount);
      if (event.status === 'blocked') incrementMetric('blockedComparisons');
      for (const [kind, count] of Object.entries(event.divergencesByKind)) {
        incrementMap(
          metrics.divergencesByKind,
          kind as MasteryShadowDivergenceKind,
          count
        );
      }
      return;
    case 'reconciliation-conflict':
      incrementMetric('reconciliationConflicts', event.count);
      return;
    case 'blocked-migration':
      incrementMetric('blockedMigrations');
      return;
    case 'migration-outcome':
      incrementMetric('migrationAttempts');
      incrementMap(metrics.migrationOutcomes, event.status);
      return;
    case 'compatibility-write':
      incrementMetric('compatibilityWrites');
      incrementMap(metrics.compatibilityWritesByStatus, event.status);
      incrementMap(
        metrics.compatibilityWritesByProvenance,
        event.provenance
      );
      if (event.status === 'partial') incrementMetric('partialWrites');
      if (event.legacyStatus === 'written') {
        incrementMap(
          metrics.storageOperationSuccessesByOperation,
          'write-legacy'
        );
      }
      return;
    case 'orphan-adoption':
      incrementMetric('orphanAdoptionEvents');
      incrementMap(metrics.orphanAdoptionsByStatus, event.status);
      return;
    case 'storage-failure':
      incrementMetric('storageFailures');
      incrementMap(metrics.storageFailuresByOperation, event.operation);
      if (
        event.operation === 'read-legacy' ||
        event.operation === 'read-legacy-fallback'
      ) {
        incrementMetric('legacySourceReadsAttempted');
      }
      return;
    case 'storage-operation':
      incrementMap(
        metrics.storageOperationSuccessesByOperation,
        event.operation
      );
      if (
        event.operation === 'read-legacy' ||
        event.operation === 'read-legacy-fallback'
      ) {
        incrementMetric('legacySourceReadsAttempted');
      }
      incrementMetric(
        'historicalIdentityResolutionObserved',
        event.historicalIdentityResolutionObserved ?? 0
      );
      return;
    case 'cold-start':
      incrementMetric('coldStarts');
  }
}

function reportDeliveryFailure(error: unknown): void {
  incrementMetric('diagnosticDeliveryFailures');
  if (error instanceof DiagnosticQueueFullError) {
    incrementMetric('diagnosticEventsDropped');
  }
  if (__DEV__) {
    console.warn('[mastery-rollout] Diagnostic delivery failed', error);
  }
}

/**
 * Internal diagnostics are isolated from learner behavior. A broken observer
 * can never block a mastery read, write, reset, or placement action.
 */
export function reportMasteryRolloutDiagnostic(
  event: MasteryRolloutDiagnosticEvent
): void {
  updateMetrics(event);
  try {
    const delivery = sink(event);
    if (delivery) void delivery.catch(reportDeliveryFailure);
  } catch (error) {
    reportDeliveryFailure(error);
  }
}

/** Explicit app-root signal, guarded so renders cannot over-count a process. */
export function recordMasteryRolloutColdStart(): void {
  if (coldStartRecorded) return;
  coldStartRecorded = true;
  reportMasteryRolloutDiagnostic({ name: 'cold-start' });
}

export function setMasteryRolloutDiagnosticSink(
  nextSink: MasteryRolloutDiagnosticSink | null
): () => void {
  const previousSink = sink;
  sink = nextSink ?? defaultSink;
  return () => {
    sink = previousSink;
  };
}

export function getMasteryRolloutMetrics(): MasteryRolloutMetrics {
  return Object.freeze({
    ...metrics,
    divergencesByKind: Object.freeze({ ...metrics.divergencesByKind }),
    storageFailuresByOperation: Object.freeze({
      ...metrics.storageFailuresByOperation,
    }),
    storageOperationSuccessesByOperation: Object.freeze({
      ...metrics.storageOperationSuccessesByOperation,
    }),
    stableReadsByStatus: Object.freeze({ ...metrics.stableReadsByStatus }),
    compatibilityWritesByStatus: Object.freeze({
      ...metrics.compatibilityWritesByStatus,
    }),
    compatibilityWritesByProvenance: Object.freeze({
      ...metrics.compatibilityWritesByProvenance,
    }),
    orphanAdoptionsByStatus: Object.freeze({
      ...metrics.orphanAdoptionsByStatus,
    }),
    migrationOutcomes: Object.freeze({ ...metrics.migrationOutcomes }),
  });
}

/** Keeps deterministic tests isolated; production code does not reset metrics. */
export function resetMasteryRolloutMetrics(): void {
  metrics = createMetrics() as MutableMetrics;
}
