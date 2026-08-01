import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  CONTRAST_MASTERY_ROLLOUT_STATE,
  CONTRAST_MASTERY_ROLLOUT_STATES,
  type ContrastMasteryRolloutState,
} from '@/src/config/featureFlags';
import { SUPPORTED_LANGUAGE_IDS, type LanguageId } from '@/src/domain/identity';
import type {
  DiagnosticSelfMetrics,
  MasteryMigrationDiagnosticOutcome,
  MasteryRolloutDiagnosticEvent,
  MasteryRolloutMetrics,
  MasteryRolloutStorageFailureOperation,
} from '@/src/analytics/masteryRolloutDiagnostics';

export const MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY =
  '@diagnostics_masteryRollout_v1';
export const MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION = 2;
export const MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS = 100;
export const MAX_PENDING_MASTERY_ROLLOUT_DIAGNOSTICS = 100;
export const MAX_OPEN_RELIABILITY_CONDITIONS = 64;

/**
 * Complete field catalogue used to make producer absence explicit. The
 * manifest below is intentionally a subset: absence means unavailable, never
 * an observed zero.
 */
export const RUNTIME_EVIDENCE_FIELD_CATALOG = Object.freeze([
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
] as const);

export type RuntimeEvidenceFieldName =
  (typeof RUNTIME_EVIDENCE_FIELD_CATALOG)[number];

export interface DiagnosticProducerManifest {
  readonly manifestVersion: number;
  /** Capability only. This does not claim that any producer was exercised. */
  readonly producedFields: readonly RuntimeEvidenceFieldName[];
}

export const DIAGNOSTIC_PRODUCER_MANIFEST: DiagnosticProducerManifest =
  Object.freeze({
    manifestVersion: 1,
    producedFields: Object.freeze([
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
    ] as const),
  });

export interface DiagnosticKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

type StableReadOutcome = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'stable-read' }
>['status'];
type ShadowComparisonEvent = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'shadow-comparison' }
>;
type ShadowComparisonOutcome = ShadowComparisonEvent['status'];
type DivergenceKind = keyof ShadowComparisonEvent['divergencesByKind'];
type BlockedMigrationOutcome = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'blocked-migration' }
>['reason'];
type CompatibilityWriteEvent = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'compatibility-write' }
>;
type OrphanAdoptionEvent = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'orphan-adoption' }
>;
type StorageFailureOperation = MasteryRolloutStorageFailureOperation;
export type ReliabilityConditionKind =
  | 'partial-write'
  | 'storage-failure'
  | 'migration-failure'
  | 'orphan-adoption-residue';

export interface OpenReliabilityCondition {
  readonly kind: ReliabilityConditionKind;
  readonly languageId: LanguageId;
  /** Present only for storage failures. */
  readonly operation?: StorageFailureOperation;
  readonly openedAtSequence: number;
}

export interface LanguageObservation {
  readonly shadowComparisons: number;
  readonly stableReads: number;
  readonly compatibilityWrites: number;
  readonly historicalIdentityResolutionObserved: number;
}

interface PersistedEventBase {
  readonly sequence: number;
  readonly rolloutState: ContrastMasteryRolloutState;
}

export type PersistedMasteryRolloutDiagnosticEvent =
  | (PersistedEventBase & {
      readonly category: 'stable-read';
      readonly languageId: LanguageId;
      readonly outcome: StableReadOutcome;
    })
  | (PersistedEventBase & {
      readonly category: 'legacy-fallback';
      readonly languageId: LanguageId;
      readonly outcome: 'missing-stable';
    })
  | (PersistedEventBase & {
      readonly category: 'shadow-comparison';
      readonly languageId: LanguageId;
      readonly outcome: ShadowComparisonOutcome;
      readonly stableDocumentPresent: boolean;
      readonly currentLabelIsHistorical: boolean;
      readonly historicalIdentityResolutionObserved: number;
      readonly divergencesByKind: Partial<Record<DivergenceKind, number>>;
      readonly divergenceCount: number;
      readonly unexplainedDivergenceCount: number;
      readonly unresolvedMappingCount: number;
      readonly malformedLegacyCount: number;
    })
  | (PersistedEventBase & {
      readonly category: 'reconciliation-conflict';
      readonly languageId: LanguageId;
      readonly outcome: 'observed';
      readonly count: number;
    })
  | (PersistedEventBase & {
      readonly category: 'blocked-migration';
      readonly languageId: LanguageId;
      readonly outcome: BlockedMigrationOutcome;
    })
  | (PersistedEventBase & {
      readonly category: 'migration-outcome';
      readonly languageId: LanguageId;
      readonly outcome: MasteryMigrationDiagnosticOutcome;
    })
  | (PersistedEventBase & {
      readonly category: 'compatibility-write';
      readonly languageId: LanguageId;
      readonly provenance: CompatibilityWriteEvent['provenance'];
      readonly outcome: CompatibilityWriteEvent['status'];
      readonly legacyOutcome: CompatibilityWriteEvent['legacyStatus'];
      readonly stableOutcome: CompatibilityWriteEvent['stableStatus'];
    })
  | (PersistedEventBase & {
      readonly category: 'orphan-adoption';
      readonly languageId: LanguageId;
      readonly outcome: OrphanAdoptionEvent['status'];
      readonly operationOutcome: OrphanAdoptionEvent['outcome'];
      readonly adoptedRecordCount: number;
    })
  | (PersistedEventBase & {
      readonly category: 'storage-failure';
      readonly languageId: LanguageId;
      readonly outcome: 'failed';
      readonly operation: StorageFailureOperation;
    })
  | (PersistedEventBase & {
      readonly category: 'storage-operation';
      readonly languageId: LanguageId;
      readonly outcome: 'success';
      readonly operation: StorageFailureOperation;
      readonly historicalIdentityResolutionObserved: number;
    })
  | (PersistedEventBase & {
      readonly category: 'cold-start';
      readonly outcome: 'observed';
    });

export interface PersistedMasteryRolloutMetrics extends MasteryRolloutMetrics {
  readonly reliabilityConditionsOpened: Readonly<
    Record<ReliabilityConditionKind, number>
  >;
  readonly reliabilityConditionsRecovered: Readonly<
    Record<ReliabilityConditionKind, number>
  >;
  readonly openConditionOverflow: number;
}

export interface MasteryRolloutDiagnosticSnapshot {
  readonly schemaVersion: typeof MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION;
  readonly sequence: number;
  readonly firstSequence: number;
  readonly producerManifest: DiagnosticProducerManifest;
  readonly metrics: PersistedMasteryRolloutMetrics;
  readonly languageObservations: Readonly<
    Partial<Record<LanguageId, LanguageObservation>>
  >;
  readonly rolloutStateObservations: Readonly<
    Record<ContrastMasteryRolloutState, number>
  >;
  readonly openConditions: readonly OpenReliabilityCondition[];
  readonly recentEvents: readonly PersistedMasteryRolloutDiagnosticEvent[];
}

export type MasteryRolloutDiagnosticSnapshotResult =
  | {
      readonly status: 'ok' | 'missing' | 'malformed';
      readonly snapshot: MasteryRolloutDiagnosticSnapshot;
    }
  | {
      readonly status: 'storage-error';
      readonly snapshot: MasteryRolloutDiagnosticSnapshot;
      readonly error: unknown;
    };

export type DiagnosticWriteResult =
  | { readonly status: 'written' }
  | { readonly status: 'dropped'; readonly reason: 'queue-full' }
  | { readonly status: 'storage-error'; readonly error: unknown };

export class DiagnosticQueueFullError extends Error {
  readonly name = 'DiagnosticQueueFullError';

  constructor() {
    super('Diagnostic event dropped because the write queue is full');
  }
}

const SCALAR_METRIC_KEYS = Object.freeze([
  'stableReadsAttempted',
  'stableReadsSuccessful',
  'legacyFallbacksUsed',
  'reconciliationConflicts',
  'blockedMigrations',
  'orphanAdoptionEvents',
  'compatibilityWrites',
  'partialWrites',
  'storageFailures',
  'shadowComparisons',
  'shadowDivergences',
  'shadowUnexplainedDivergences',
  'unresolvedMappings',
  'blockedComparisons',
  'legacySourceReadsAttempted',
  'migrationAttempts',
  'coldStarts',
  'historicalIdentityResolutionObserved',
  'diagnosticDeliveryFailures',
  'diagnosticEventsDropped',
  'openConditionOverflow',
] as const);
const NESTED_METRIC_KEYS = Object.freeze([
  'divergencesByKind',
  'storageFailuresByOperation',
  'storageOperationSuccessesByOperation',
  'stableReadsByStatus',
  'compatibilityWritesByStatus',
  'compatibilityWritesByProvenance',
  'orphanAdoptionsByStatus',
  'migrationOutcomes',
  'reliabilityConditionsOpened',
  'reliabilityConditionsRecovered',
] as const);
const METRIC_KEYS = Object.freeze([
  ...SCALAR_METRIC_KEYS,
  ...NESTED_METRIC_KEYS,
] as const satisfies readonly (keyof PersistedMasteryRolloutMetrics)[]);

const STABLE_READ_OUTCOMES = Object.freeze([
  'ok',
  'missing',
  'malformed',
  'unsupported-version',
  'storage-error',
] as const);
const SHADOW_COMPARISON_OUTCOMES = Object.freeze([
  'compared',
  'stable-missing',
  'blocked',
] as const);
const DIVERGENCE_KINDS = Object.freeze([
  'stable-document-absent',
  'stable-record-absent',
  'legacy-record-absent',
  'tier-disagreement-stable-higher',
  'tier-disagreement-stable-lower',
  'reset-disagreement',
  'placement-disagreement',
  'alias-resolution-difference',
  'unexpected-fallback-behavior',
] as const satisfies readonly DivergenceKind[]);
const BLOCKED_MIGRATION_OUTCOMES = Object.freeze([
  'malformed-stable',
  'unsupported-stable-version',
  'malformed-legacy',
] as const);
const MIGRATION_OUTCOMES = Object.freeze([
  'already-current',
  'migrated',
  'migration-state-recreated',
  'unresolved-historical-identities',
  'partially-migrated',
  'degraded',
  'blocked-by-unusable-stable',
  'blocked-by-malformed-data',
  'storage-failure',
] as const satisfies readonly MasteryMigrationDiagnosticOutcome[]);
const WRITE_OUTCOMES = Object.freeze(['complete', 'partial', 'failed'] as const);
const WRITE_PROVENANCES = Object.freeze([
  'practice',
  'placement',
  'reset',
] as const);
const WRITE_LEG_OUTCOMES = Object.freeze([
  'not-attempted',
  'written',
  'failed',
  'blocked',
] as const);
const ORPHAN_ADOPTION_OUTCOMES = Object.freeze([
  'no-stable-state',
  'blocked-by-unusable-stable',
  'no-candidates',
  'candidates-adopted',
  'candidates-partially-persisted',
  'marker-only-repair',
  'storage-failure',
] as const);
const STORAGE_OPERATIONS = Object.freeze([
  'read-stable',
  'write-stable',
  'read-migration-state',
  'write-migration-state',
  'read-legacy',
  'read-legacy-fallback',
  'write-legacy',
] as const satisfies readonly StorageFailureOperation[]);
const RELIABILITY_CONDITION_KINDS = Object.freeze([
  'partial-write',
  'storage-failure',
  'migration-failure',
  'orphan-adoption-residue',
] as const satisfies readonly ReliabilityConditionKind[]);
const LANGUAGE_ID_VALUES = new Set<string>(SUPPORTED_LANGUAGE_IDS);

interface PendingDiagnosticWrite {
  readonly event: MasteryRolloutDiagnosticEvent;
  /** Read lazily so queued writes can persist drops observed after enqueue. */
  readonly selfMetrics?:
    | DiagnosticSelfMetrics
    | (() => DiagnosticSelfMetrics);
  readonly rolloutState: ContrastMasteryRolloutState;
  readonly resolve: (result: DiagnosticWriteResult) => void;
}

interface DiagnosticWriteQueue {
  active: boolean;
  readonly pending: PendingDiagnosticWrite[];
}

const writeQueues = new WeakMap<
  DiagnosticKeyValueStorage,
  DiagnosticWriteQueue
>();

function zeroRecord<Key extends string>(keys: readonly Key[]): Record<Key, number> {
  return Object.fromEntries(keys.map((key) => [key, 0])) as Record<Key, number>;
}

function createEmptyMetrics(): PersistedMasteryRolloutMetrics {
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
    compatibilityWritesByStatus: zeroRecord(WRITE_OUTCOMES),
    compatibilityWritesByProvenance: zeroRecord(WRITE_PROVENANCES),
    orphanAdoptionsByStatus: zeroRecord(WRITE_OUTCOMES),
    migrationOutcomes: zeroRecord(MIGRATION_OUTCOMES),
    diagnosticDeliveryFailures: 0,
    diagnosticEventsDropped: 0,
    reliabilityConditionsOpened: zeroRecord(RELIABILITY_CONDITION_KINDS),
    reliabilityConditionsRecovered: zeroRecord(RELIABILITY_CONDITION_KINDS),
    openConditionOverflow: 0,
  };
}

function createEmptyRolloutStateObservations(): Record<
  ContrastMasteryRolloutState,
  number
> {
  return zeroRecord(CONTRAST_MASTERY_ROLLOUT_STATES);
}

export function createEmptyDiagnosticSnapshot(): MasteryRolloutDiagnosticSnapshot {
  return {
    schemaVersion: MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION,
    sequence: 0,
    firstSequence: 0,
    producerManifest: DIAGNOSTIC_PRODUCER_MANIFEST,
    metrics: createEmptyMetrics(),
    languageObservations: {},
    rolloutStateObservations: createEmptyRolloutStateObservations(),
    openConditions: [],
    recentEvents: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[]
): boolean {
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function isCount(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isOneOf<const Value extends string>(
  value: unknown,
  allowed: readonly Value[]
): value is Value {
  return typeof value === 'string' && allowed.includes(value as Value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isLanguageId(value: unknown): value is LanguageId {
  return typeof value === 'string' && LANGUAGE_ID_VALUES.has(value);
}

function isCountRecord(
  value: unknown,
  allowedKeys: readonly string[],
  sparse = false
): value is Record<string, number> {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  if (
    (!sparse && !hasExactKeys(value, allowedKeys)) ||
    (sparse && keys.some((key) => !allowedKeys.includes(key)))
  ) {
    return false;
  }
  return keys.every((key) => isCount(value[key]));
}

function isProducerManifest(value: unknown): value is DiagnosticProducerManifest {
  if (
    !isRecord(value) ||
    !hasExactKeys(value, ['manifestVersion', 'producedFields']) ||
    !isCount(value.manifestVersion) ||
    !Array.isArray(value.producedFields)
  ) {
    return false;
  }
  const fields = value.producedFields;
  return (
    fields.every((field) =>
      isOneOf(field, RUNTIME_EVIDENCE_FIELD_CATALOG)
    ) &&
    new Set(fields).size === fields.length &&
    fields.every(
      (field, index) => index === 0 || fields[index - 1] < field
    )
  );
}

function isMetrics(value: unknown): value is PersistedMasteryRolloutMetrics {
  return (
    isRecord(value) &&
    hasExactKeys(value, METRIC_KEYS) &&
    SCALAR_METRIC_KEYS.every((key) => isCount(value[key])) &&
    isCountRecord(value.divergencesByKind, DIVERGENCE_KINDS) &&
    isCountRecord(value.storageFailuresByOperation, STORAGE_OPERATIONS) &&
    isCountRecord(
      value.storageOperationSuccessesByOperation,
      STORAGE_OPERATIONS
    ) &&
    isCountRecord(value.stableReadsByStatus, STABLE_READ_OUTCOMES) &&
    isCountRecord(value.compatibilityWritesByStatus, WRITE_OUTCOMES) &&
    isCountRecord(
      value.compatibilityWritesByProvenance,
      WRITE_PROVENANCES
    ) &&
    isCountRecord(value.orphanAdoptionsByStatus, WRITE_OUTCOMES) &&
    isCountRecord(value.migrationOutcomes, MIGRATION_OUTCOMES) &&
    isCountRecord(
      value.reliabilityConditionsOpened,
      RELIABILITY_CONDITION_KINDS
    ) &&
    isCountRecord(
      value.reliabilityConditionsRecovered,
      RELIABILITY_CONDITION_KINDS
    )
  );
}

function isPersistedEvent(
  value: unknown
): value is PersistedMasteryRolloutDiagnosticEvent {
  if (
    !isRecord(value) ||
    !isCount(value.sequence) ||
    !isOneOf(value.rolloutState, CONTRAST_MASTERY_ROLLOUT_STATES)
  ) {
    return false;
  }

  switch (value.category) {
    case 'stable-read':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'outcome',
        ]) &&
        isLanguageId(value.languageId) &&
        isOneOf(value.outcome, STABLE_READ_OUTCOMES)
      );
    case 'legacy-fallback':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'outcome',
        ]) &&
        isLanguageId(value.languageId) &&
        value.outcome === 'missing-stable'
      );
    case 'shadow-comparison':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'outcome',
          'stableDocumentPresent',
          'currentLabelIsHistorical',
          'historicalIdentityResolutionObserved',
          'divergencesByKind',
          'divergenceCount',
          'unexplainedDivergenceCount',
          'unresolvedMappingCount',
          'malformedLegacyCount',
        ]) &&
        isLanguageId(value.languageId) &&
        isOneOf(value.outcome, SHADOW_COMPARISON_OUTCOMES) &&
        isBoolean(value.stableDocumentPresent) &&
        isBoolean(value.currentLabelIsHistorical) &&
        isCount(value.historicalIdentityResolutionObserved) &&
        isCountRecord(value.divergencesByKind, DIVERGENCE_KINDS, true) &&
        isCount(value.divergenceCount) &&
        isCount(value.unexplainedDivergenceCount) &&
        isCount(value.unresolvedMappingCount) &&
        isCount(value.malformedLegacyCount)
      );
    case 'reconciliation-conflict':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'outcome',
          'count',
        ]) &&
        isLanguageId(value.languageId) &&
        value.outcome === 'observed' &&
        isCount(value.count)
      );
    case 'blocked-migration':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'outcome',
        ]) &&
        isLanguageId(value.languageId) &&
        isOneOf(value.outcome, BLOCKED_MIGRATION_OUTCOMES)
      );
    case 'migration-outcome':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'outcome',
        ]) &&
        isLanguageId(value.languageId) &&
        isOneOf(value.outcome, MIGRATION_OUTCOMES)
      );
    case 'compatibility-write':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'provenance',
          'outcome',
          'legacyOutcome',
          'stableOutcome',
        ]) &&
        isLanguageId(value.languageId) &&
        isOneOf(value.provenance, WRITE_PROVENANCES) &&
        isOneOf(value.outcome, WRITE_OUTCOMES) &&
        isOneOf(value.legacyOutcome, WRITE_LEG_OUTCOMES) &&
        isOneOf(value.stableOutcome, WRITE_LEG_OUTCOMES)
      );
    case 'orphan-adoption':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'outcome',
          'operationOutcome',
          'adoptedRecordCount',
        ]) &&
        isLanguageId(value.languageId) &&
        isOneOf(value.outcome, WRITE_OUTCOMES) &&
        isOneOf(value.operationOutcome, ORPHAN_ADOPTION_OUTCOMES) &&
        isCount(value.adoptedRecordCount)
      );
    case 'storage-failure':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'outcome',
          'operation',
        ]) &&
        isLanguageId(value.languageId) &&
        value.outcome === 'failed' &&
        isOneOf(value.operation, STORAGE_OPERATIONS)
      );
    case 'storage-operation':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'languageId',
          'outcome',
          'operation',
          'historicalIdentityResolutionObserved',
        ]) &&
        isLanguageId(value.languageId) &&
        value.outcome === 'success' &&
        isOneOf(value.operation, STORAGE_OPERATIONS) &&
        isCount(value.historicalIdentityResolutionObserved)
      );
    case 'cold-start':
      return (
        hasExactKeys(value, [
          'sequence',
          'rolloutState',
          'category',
          'outcome',
        ]) && value.outcome === 'observed'
      );
    default:
      return false;
  }
}

function isLanguageObservations(
  value: unknown
): value is MasteryRolloutDiagnosticSnapshot['languageObservations'] {
  if (!isRecord(value)) return false;
  return Object.entries(value).every(
    ([languageId, observation]) =>
      isLanguageId(languageId) &&
      isRecord(observation) &&
      hasExactKeys(observation, [
        'shadowComparisons',
        'stableReads',
        'compatibilityWrites',
        'historicalIdentityResolutionObserved',
      ]) &&
      Object.values(observation).every(isCount)
  );
}

function isRolloutStateObservations(
  value: unknown
): value is MasteryRolloutDiagnosticSnapshot['rolloutStateObservations'] {
  return isCountRecord(value, CONTRAST_MASTERY_ROLLOUT_STATES);
}

function conditionKey(
  condition: Pick<
    OpenReliabilityCondition,
    'kind' | 'languageId' | 'operation'
  >
): string {
  return JSON.stringify([
    condition.kind,
    condition.languageId,
    condition.operation ?? null,
  ]);
}

function isOpenCondition(value: unknown): value is OpenReliabilityCondition {
  if (
    !isRecord(value) ||
    !isOneOf(value.kind, RELIABILITY_CONDITION_KINDS) ||
    !isLanguageId(value.languageId) ||
    !isCount(value.openedAtSequence)
  ) {
    return false;
  }
  if (value.kind === 'storage-failure') {
    return (
      hasExactKeys(value, [
        'kind',
        'languageId',
        'operation',
        'openedAtSequence',
      ]) && isOneOf(value.operation, STORAGE_OPERATIONS)
    );
  }
  return hasExactKeys(value, ['kind', 'languageId', 'openedAtSequence']);
}

export function parseDiagnosticSnapshot(
  raw: string | null
): MasteryRolloutDiagnosticSnapshotResult {
  const empty = createEmptyDiagnosticSnapshot();
  if (raw === null) return { status: 'missing', snapshot: empty };

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      !isRecord(parsed) ||
      !hasExactKeys(parsed, [
        'schemaVersion',
        'sequence',
        'firstSequence',
        'producerManifest',
        'metrics',
        'languageObservations',
        'rolloutStateObservations',
        'openConditions',
        'recentEvents',
      ]) ||
      parsed.schemaVersion !== MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION ||
      !isCount(parsed.sequence) ||
      !isCount(parsed.firstSequence) ||
      parsed.firstSequence > parsed.sequence ||
      !isProducerManifest(parsed.producerManifest) ||
      !isMetrics(parsed.metrics) ||
      !isLanguageObservations(parsed.languageObservations) ||
      !isRolloutStateObservations(parsed.rolloutStateObservations) ||
      !Array.isArray(parsed.openConditions) ||
      parsed.openConditions.length > MAX_OPEN_RELIABILITY_CONDITIONS ||
      !parsed.openConditions.every(isOpenCondition) ||
      new Set(parsed.openConditions.map(conditionKey)).size !==
        parsed.openConditions.length ||
      parsed.openConditions.some(
        (condition) =>
          condition.openedAtSequence > (parsed.sequence as number)
      ) ||
      !Array.isArray(parsed.recentEvents) ||
      parsed.recentEvents.length > MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS ||
      !parsed.recentEvents.every(isPersistedEvent) ||
      !hasValidSequenceRange(
        parsed.sequence,
        parsed.firstSequence,
        parsed.recentEvents
      )
    ) {
      return { status: 'malformed', snapshot: empty };
    }

    return {
      status: 'ok',
      snapshot: parsed as unknown as MasteryRolloutDiagnosticSnapshot,
    };
  } catch {
    return { status: 'malformed', snapshot: empty };
  }
}

function hasValidSequenceRange(
  sequence: number,
  firstSequence: number,
  recentEvents: readonly PersistedMasteryRolloutDiagnosticEvent[]
): boolean {
  if (recentEvents.length === 0) {
    return sequence === 0 && firstSequence === 0;
  }
  return (
    firstSequence === recentEvents[0].sequence &&
    recentEvents[recentEvents.length - 1].sequence === sequence &&
    recentEvents.every(
      (event, index) =>
        index === 0 || event.sequence === recentEvents[index - 1].sequence + 1
    )
  );
}

export function serializeDiagnosticSnapshot(
  snapshot: MasteryRolloutDiagnosticSnapshot
): string {
  return JSON.stringify(sortJsonValue(snapshot));
}

function sortJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJsonValue);
  if (!isRecord(value)) return value;

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value).sort()) {
    sorted[key] = sortJsonValue(value[key]);
  }
  return sorted;
}

function addCount(current: number, increment = 1): number {
  return Math.min(Number.MAX_SAFE_INTEGER, current + increment);
}

type MutablePersistedMetrics = {
  -readonly [Key in keyof PersistedMasteryRolloutMetrics]: PersistedMasteryRolloutMetrics[Key];
};

function cloneMetrics(
  current: PersistedMasteryRolloutMetrics
): MutablePersistedMetrics {
  return {
    ...current,
    divergencesByKind: { ...current.divergencesByKind },
    storageFailuresByOperation: { ...current.storageFailuresByOperation },
    storageOperationSuccessesByOperation: {
      ...current.storageOperationSuccessesByOperation,
    },
    stableReadsByStatus: { ...current.stableReadsByStatus },
    compatibilityWritesByStatus: { ...current.compatibilityWritesByStatus },
    compatibilityWritesByProvenance: {
      ...current.compatibilityWritesByProvenance,
    },
    orphanAdoptionsByStatus: { ...current.orphanAdoptionsByStatus },
    migrationOutcomes: { ...current.migrationOutcomes },
    reliabilityConditionsOpened: { ...current.reliabilityConditionsOpened },
    reliabilityConditionsRecovered: {
      ...current.reliabilityConditionsRecovered,
    },
  };
}

function incrementMetric(
  metrics: MutablePersistedMetrics,
  key: (typeof SCALAR_METRIC_KEYS)[number],
  amount = 1
): void {
  metrics[key] = addCount(metrics[key], amount);
}

function incrementMetricMap<Key extends string>(
  map: Readonly<Record<Key, number>>,
  key: Key,
  amount = 1
): void {
  const mutable = map as Record<Key, number>;
  mutable[key] = addCount(mutable[key], amount);
}

function applyEventToMetrics(
  current: PersistedMasteryRolloutMetrics,
  event: MasteryRolloutDiagnosticEvent,
  selfMetrics?: DiagnosticSelfMetrics
): PersistedMasteryRolloutMetrics {
  const metrics = cloneMetrics(current);
  switch (event.name) {
    case 'stable-read':
      incrementMetric(metrics, 'stableReadsAttempted');
      incrementMetricMap(metrics.stableReadsByStatus, event.status);
      if (event.status === 'ok') incrementMetric(metrics, 'stableReadsSuccessful');
      if (event.status !== 'storage-error') {
        incrementMetricMap(
          metrics.storageOperationSuccessesByOperation,
          'read-stable'
        );
      }
      break;
    case 'legacy-fallback':
      incrementMetric(metrics, 'legacyFallbacksUsed');
      break;
    case 'shadow-comparison':
      incrementMetric(metrics, 'shadowComparisons');
      incrementMetric(metrics, 'shadowDivergences', event.divergenceCount);
      incrementMetric(
        metrics,
        'shadowUnexplainedDivergences',
        event.unexplainedDivergenceCount
      );
      incrementMetric(metrics, 'unresolvedMappings', event.unresolvedMappingCount);
      if (event.status === 'blocked') incrementMetric(metrics, 'blockedComparisons');
      for (const [kind, count] of Object.entries(event.divergencesByKind)) {
        incrementMetricMap(
          metrics.divergencesByKind,
          kind as DivergenceKind,
          count
        );
      }
      break;
    case 'reconciliation-conflict':
      incrementMetric(metrics, 'reconciliationConflicts', event.count);
      break;
    case 'blocked-migration':
      incrementMetric(metrics, 'blockedMigrations');
      break;
    case 'migration-outcome':
      incrementMetric(metrics, 'migrationAttempts');
      incrementMetricMap(metrics.migrationOutcomes, event.status);
      break;
    case 'compatibility-write':
      incrementMetric(metrics, 'compatibilityWrites');
      incrementMetricMap(metrics.compatibilityWritesByStatus, event.status);
      incrementMetricMap(
        metrics.compatibilityWritesByProvenance,
        event.provenance
      );
      if (event.status === 'partial') incrementMetric(metrics, 'partialWrites');
      if (event.legacyStatus === 'written') {
        incrementMetricMap(
          metrics.storageOperationSuccessesByOperation,
          'write-legacy'
        );
      }
      break;
    case 'orphan-adoption':
      incrementMetric(metrics, 'orphanAdoptionEvents');
      incrementMetricMap(metrics.orphanAdoptionsByStatus, event.status);
      break;
    case 'storage-failure':
      incrementMetric(metrics, 'storageFailures');
      incrementMetricMap(metrics.storageFailuresByOperation, event.operation);
      if (
        event.operation === 'read-legacy' ||
        event.operation === 'read-legacy-fallback'
      ) {
        incrementMetric(metrics, 'legacySourceReadsAttempted');
      }
      break;
    case 'storage-operation':
      incrementMetricMap(
        metrics.storageOperationSuccessesByOperation,
        event.operation
      );
      if (
        event.operation === 'read-legacy' ||
        event.operation === 'read-legacy-fallback'
      ) {
        incrementMetric(metrics, 'legacySourceReadsAttempted');
      }
      incrementMetric(
        metrics,
        'historicalIdentityResolutionObserved',
        event.historicalIdentityResolutionObserved ?? 0
      );
      break;
    case 'cold-start':
      incrementMetric(metrics, 'coldStarts');
  }

  if (selfMetrics) {
    metrics.diagnosticDeliveryFailures = Math.max(
      metrics.diagnosticDeliveryFailures,
      selfMetrics.diagnosticDeliveryFailures
    );
    metrics.diagnosticEventsDropped = Math.max(
      metrics.diagnosticEventsDropped,
      selfMetrics.diagnosticEventsDropped
    );
  }
  return metrics;
}

function emptyLanguageObservation(): LanguageObservation {
  return {
    shadowComparisons: 0,
    stableReads: 0,
    compatibilityWrites: 0,
    historicalIdentityResolutionObserved: 0,
  };
}

function applyLanguageObservation(
  current: MasteryRolloutDiagnosticSnapshot['languageObservations'],
  event: MasteryRolloutDiagnosticEvent
): MasteryRolloutDiagnosticSnapshot['languageObservations'] {
  if (event.name === 'cold-start') return current;
  let shouldObserve = false;
  const next = {
    ...(current[event.languageId] ?? emptyLanguageObservation()),
  };
  switch (event.name) {
    case 'stable-read':
      next.stableReads = addCount(next.stableReads);
      shouldObserve = true;
      break;
    case 'shadow-comparison':
      next.shadowComparisons = addCount(next.shadowComparisons);
      shouldObserve = true;
      break;
    case 'compatibility-write':
      next.compatibilityWrites = addCount(next.compatibilityWrites);
      shouldObserve = true;
      break;
    case 'storage-operation': {
      const count = event.historicalIdentityResolutionObserved ?? 0;
      if (count > 0) {
        next.historicalIdentityResolutionObserved = addCount(
          next.historicalIdentityResolutionObserved,
          count
        );
        shouldObserve = true;
      }
      break;
    }
  }
  if (!shouldObserve) return current;
  return { ...current, [event.languageId]: next };
}

function openConditionForEvent(
  event: MasteryRolloutDiagnosticEvent,
  sequence: number
): OpenReliabilityCondition | undefined {
  switch (event.name) {
    case 'storage-failure':
      return {
        kind: 'storage-failure',
        languageId: event.languageId,
        operation: event.operation,
        openedAtSequence: sequence,
      };
    case 'compatibility-write':
      return event.status === 'partial'
        ? {
            kind: 'partial-write',
            languageId: event.languageId,
            openedAtSequence: sequence,
          }
        : undefined;
    case 'migration-outcome':
      return [
        'storage-failure',
        'blocked-by-malformed-data',
        'blocked-by-unusable-stable',
        'partially-migrated',
      ].includes(event.status)
        ? {
            kind: 'migration-failure',
            languageId: event.languageId,
            openedAtSequence: sequence,
          }
        : undefined;
    case 'orphan-adoption':
      return event.status === 'partial'
        ? {
            kind: 'orphan-adoption-residue',
            languageId: event.languageId,
            openedAtSequence: sequence,
          }
        : undefined;
    default:
      return undefined;
  }
}

function closingConditionsForEvent(
  event: MasteryRolloutDiagnosticEvent
): readonly Pick<
  OpenReliabilityCondition,
  'kind' | 'languageId' | 'operation'
>[] {
  switch (event.name) {
    case 'stable-read':
      return event.status === 'storage-error'
        ? []
        : [
            {
              kind: 'storage-failure',
              languageId: event.languageId,
              operation: 'read-stable',
            },
          ];
    case 'legacy-fallback':
      return [
        {
          kind: 'storage-failure',
          languageId: event.languageId,
          operation: 'read-legacy-fallback',
        },
      ];
    case 'storage-operation':
      return [
        {
          kind: 'storage-failure',
          languageId: event.languageId,
          operation: event.operation,
        },
      ];
    case 'compatibility-write': {
      const conditions: Pick<
        OpenReliabilityCondition,
        'kind' | 'languageId' | 'operation'
      >[] = [];
      if (event.status === 'complete') {
        conditions.push({
          kind: 'partial-write',
          languageId: event.languageId,
        });
      }
      if (event.legacyStatus === 'written') {
        conditions.push({
          kind: 'storage-failure',
          languageId: event.languageId,
          operation: 'write-legacy',
        });
      }
      if (event.stableStatus === 'written') {
        conditions.push({
          kind: 'storage-failure',
          languageId: event.languageId,
          operation: 'write-stable',
        });
      }
      return conditions;
    }
    case 'migration-outcome':
      return [
        'migrated',
        'already-current',
        'migration-state-recreated',
      ].includes(event.status)
        ? [
            {
              kind: 'migration-failure',
              languageId: event.languageId,
            },
          ]
        : [];
    case 'orphan-adoption':
      return event.status === 'complete' || event.outcome === 'no-candidates'
        ? [
            {
              kind: 'orphan-adoption-residue',
              languageId: event.languageId,
            },
          ]
        : [];
    default:
      return [];
  }
}

function applyEventToLedger(
  current: readonly OpenReliabilityCondition[],
  metrics: PersistedMasteryRolloutMetrics,
  event: MasteryRolloutDiagnosticEvent,
  sequence: number
): {
  readonly openConditions: readonly OpenReliabilityCondition[];
  readonly metrics: PersistedMasteryRolloutMetrics;
} {
  let openConditions = [...current];
  const nextMetrics = cloneMetrics(metrics);
  const opened = openConditionForEvent(event, sequence);
  if (opened) {
    incrementMetricMap(nextMetrics.reliabilityConditionsOpened, opened.kind);
    if (!openConditions.some((condition) => conditionKey(condition) === conditionKey(opened))) {
      if (openConditions.length >= MAX_OPEN_RELIABILITY_CONDITIONS) {
        incrementMetric(nextMetrics, 'openConditionOverflow');
      } else {
        openConditions.push(opened);
      }
    }
  }

  for (const closing of closingConditionsForEvent(event)) {
    const key = conditionKey(closing);
    const index = openConditions.findIndex(
      (condition) => conditionKey(condition) === key
    );
    if (index >= 0) {
      const [recovered] = openConditions.splice(index, 1);
      incrementMetricMap(
        nextMetrics.reliabilityConditionsRecovered,
        recovered.kind
      );
    }
  }
  return { openConditions, metrics: nextMetrics };
}

function projectEvent(
  event: MasteryRolloutDiagnosticEvent,
  sequence: number,
  rolloutState: ContrastMasteryRolloutState
): PersistedMasteryRolloutDiagnosticEvent {
  const base = { sequence, rolloutState };
  switch (event.name) {
    case 'stable-read':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        outcome: event.status,
      };
    case 'legacy-fallback':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        outcome: event.reason,
      };
    case 'shadow-comparison':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        outcome: event.status,
        stableDocumentPresent: event.stableDocumentPresent,
        currentLabelIsHistorical: event.currentLabelIsHistorical,
        historicalIdentityResolutionObserved:
          event.historicalIdentityResolutionObserved,
        divergencesByKind: { ...event.divergencesByKind },
        divergenceCount: event.divergenceCount,
        unexplainedDivergenceCount: event.unexplainedDivergenceCount,
        unresolvedMappingCount: event.unresolvedMappingCount,
        malformedLegacyCount: event.malformedLegacyCount,
      };
    case 'reconciliation-conflict':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        outcome: 'observed',
        count: event.count,
      };
    case 'blocked-migration':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        outcome: event.reason,
      };
    case 'migration-outcome':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        outcome: event.status,
      };
    case 'compatibility-write':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        provenance: event.provenance,
        outcome: event.status,
        legacyOutcome: event.legacyStatus,
        stableOutcome: event.stableStatus,
      };
    case 'orphan-adoption':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        outcome: event.status,
        operationOutcome: event.outcome,
        adoptedRecordCount: event.adoptedRecords,
      };
    case 'storage-failure':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        outcome: 'failed',
        operation: event.operation,
      };
    case 'storage-operation':
      return {
        ...base,
        category: event.name,
        languageId: event.languageId,
        outcome: event.status,
        operation: event.operation,
        historicalIdentityResolutionObserved:
          event.historicalIdentityResolutionObserved ?? 0,
      };
    case 'cold-start':
      return { ...base, category: event.name, outcome: 'observed' };
  }
}

function appendEvent(
  snapshot: MasteryRolloutDiagnosticSnapshot,
  event: MasteryRolloutDiagnosticEvent,
  rolloutState: ContrastMasteryRolloutState,
  selfMetrics?: DiagnosticSelfMetrics
): MasteryRolloutDiagnosticSnapshot {
  const sequence = addCount(snapshot.sequence);
  const recentEvents = [
    ...snapshot.recentEvents,
    projectEvent(event, sequence, rolloutState),
  ].slice(-MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS);
  const eventMetrics = applyEventToMetrics(snapshot.metrics, event, selfMetrics);
  const ledger = applyEventToLedger(
    snapshot.openConditions,
    eventMetrics,
    event,
    sequence
  );
  const rolloutStateObservations = {
    ...snapshot.rolloutStateObservations,
    [rolloutState]: addCount(snapshot.rolloutStateObservations[rolloutState]),
  };

  return {
    schemaVersion: MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION,
    sequence,
    firstSequence: recentEvents[0]?.sequence ?? 0,
    producerManifest: DIAGNOSTIC_PRODUCER_MANIFEST,
    metrics: ledger.metrics,
    languageObservations: applyLanguageObservation(
      snapshot.languageObservations,
      event
    ),
    rolloutStateObservations,
    openConditions: ledger.openConditions,
    recentEvents,
  };
}

async function persistDiagnosticEvent(
  storage: DiagnosticKeyValueStorage,
  event: MasteryRolloutDiagnosticEvent,
  rolloutState: ContrastMasteryRolloutState,
  selfMetrics?: DiagnosticSelfMetrics
): Promise<void> {
  const raw = await storage.getItem(MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY);
  const parsed = parseDiagnosticSnapshot(raw);
  const nextSnapshot = appendEvent(
    parsed.snapshot,
    event,
    rolloutState,
    selfMetrics
  );
  await storage.setItem(
    MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY,
    serializeDiagnosticSnapshot(nextSnapshot)
  );
}

async function deliverNextDiagnosticEvent(
  storage: DiagnosticKeyValueStorage,
  queue: DiagnosticWriteQueue,
  write: PendingDiagnosticWrite
): Promise<void> {
  let result: DiagnosticWriteResult;
  try {
    await persistDiagnosticEvent(
      storage,
      write.event,
      write.rolloutState,
      typeof write.selfMetrics === 'function'
        ? write.selfMetrics()
        : write.selfMetrics
    );
    result = { status: 'written' };
  } catch (error) {
    result = { status: 'storage-error', error };
  }
  write.resolve(result);

  const next = queue.pending.shift();
  if (next) {
    void deliverNextDiagnosticEvent(storage, queue, next);
    return;
  }

  queue.active = false;
  writeQueues.delete(storage);
}

/**
 * Records operational evidence on a diagnostics-only queue. At most one
 * event is active and MAX_PENDING_MASTERY_ROLLOUT_DIAGNOSTICS wait behind it.
 * Newer events are dropped at capacity: losing evidence is safer than
 * retaining an unbounded backlog or delaying a learner-state workflow.
 */
export function recordDiagnosticEvent(
  event: MasteryRolloutDiagnosticEvent,
  storage: DiagnosticKeyValueStorage = AsyncStorage,
  selfMetrics?: DiagnosticSelfMetrics | (() => DiagnosticSelfMetrics),
  rolloutState: ContrastMasteryRolloutState = CONTRAST_MASTERY_ROLLOUT_STATE
): Promise<DiagnosticWriteResult> {
  return new Promise((resolve) => {
    let queue = writeQueues.get(storage);
    if (!queue) {
      queue = { active: false, pending: [] };
      writeQueues.set(storage, queue);
    }

    const write = { event, selfMetrics, rolloutState, resolve };
    if (!queue.active) {
      queue.active = true;
      void deliverNextDiagnosticEvent(storage, queue, write);
      return;
    }

    if (queue.pending.length >= MAX_PENDING_MASTERY_ROLLOUT_DIAGNOSTICS) {
      resolve({ status: 'dropped', reason: 'queue-full' });
      return;
    }

    queue.pending.push(write);
  });
}

/** Reads operational evidence only; learner-facing code must never call this. */
export async function getDiagnosticSnapshot(
  storage: DiagnosticKeyValueStorage = AsyncStorage
): Promise<MasteryRolloutDiagnosticSnapshotResult> {
  try {
    return parseDiagnosticSnapshot(
      await storage.getItem(MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY)
    );
  } catch (error) {
    return {
      status: 'storage-error',
      snapshot: createEmptyDiagnosticSnapshot(),
      error,
    };
  }
}

export function createPersistentDiagnosticSink(
  storage: DiagnosticKeyValueStorage = AsyncStorage,
  getSelfMetrics?: () => DiagnosticSelfMetrics
): (event: MasteryRolloutDiagnosticEvent) => Promise<void> {
  return async (event) => {
    const result = await recordDiagnosticEvent(
      event,
      storage,
      getSelfMetrics
    );
    if (result.status === 'storage-error') throw result.error;
    if (result.status === 'dropped') throw new DiagnosticQueueFullError();
  };
}
