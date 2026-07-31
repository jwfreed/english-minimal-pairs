import AsyncStorage from '@react-native-async-storage/async-storage';

import type {
  MasteryRolloutDiagnosticEvent,
  MasteryRolloutMetrics,
} from '@/src/analytics/masteryRolloutDiagnostics';

export const MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY =
  '@diagnostics_masteryRollout_v1';
export const MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION = 1;
export const MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS = 100;
export const MAX_PENDING_MASTERY_ROLLOUT_DIAGNOSTICS = 100;

export interface DiagnosticKeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

type StableReadOutcome = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'stable-read' }
>['status'];
type ShadowComparisonOutcome = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'shadow-comparison' }
>['status'];
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
type StorageFailureOperation = Extract<
  MasteryRolloutDiagnosticEvent,
  { readonly name: 'storage-failure' }
>['operation'];

export type PersistedMasteryRolloutDiagnosticEvent =
  | {
      readonly sequence: number;
      readonly category: 'stable-read';
      readonly outcome: StableReadOutcome;
    }
  | {
      readonly sequence: number;
      readonly category: 'legacy-fallback';
      readonly outcome: 'missing-stable';
    }
  | {
      readonly sequence: number;
      readonly category: 'shadow-comparison';
      readonly outcome: ShadowComparisonOutcome;
      readonly divergenceCount: number;
      readonly unexplainedDivergenceCount: number;
      readonly unresolvedMappingCount: number;
    }
  | {
      readonly sequence: number;
      readonly category: 'reconciliation-conflict';
      readonly outcome: 'observed';
      readonly count: number;
    }
  | {
      readonly sequence: number;
      readonly category: 'blocked-migration';
      readonly outcome: BlockedMigrationOutcome;
    }
  | {
      readonly sequence: number;
      readonly category: 'compatibility-write';
      readonly outcome: CompatibilityWriteEvent['status'];
      readonly legacyOutcome: CompatibilityWriteEvent['legacyStatus'];
      readonly stableOutcome: CompatibilityWriteEvent['stableStatus'];
    }
  | {
      readonly sequence: number;
      readonly category: 'orphan-adoption';
      readonly outcome: OrphanAdoptionEvent['status'];
      readonly operationOutcome: OrphanAdoptionEvent['outcome'];
      readonly adoptedRecordCount: number;
    }
  | {
      readonly sequence: number;
      readonly category: 'storage-failure';
      readonly outcome: 'failed';
      readonly operation: StorageFailureOperation;
    };

export interface MasteryRolloutDiagnosticSnapshot {
  readonly schemaVersion: typeof MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION;
  readonly sequence: number;
  readonly metrics: PersistedMasteryRolloutMetrics;
  readonly recentEvents: readonly PersistedMasteryRolloutDiagnosticEvent[];
}

export type PersistedMasteryRolloutMetrics = Omit<
  MasteryRolloutMetrics,
  'diagnosticDeliveryFailures' | 'diagnosticEventsDropped'
>;

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

const METRIC_KEYS = Object.freeze([
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
  'unresolvedMappings',
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
const BLOCKED_MIGRATION_OUTCOMES = Object.freeze([
  'malformed-stable',
  'unsupported-stable-version',
  'malformed-legacy',
] as const);
const WRITE_OUTCOMES = Object.freeze(['complete', 'partial', 'failed'] as const);
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
const STORAGE_FAILURE_OPERATIONS = Object.freeze([
  'read-stable',
  'write-stable',
  'read-migration-state',
  'write-migration-state',
  'read-legacy',
  'read-legacy-fallback',
  'write-legacy',
] as const);

interface PendingDiagnosticWrite {
  readonly event: MasteryRolloutDiagnosticEvent;
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
    unresolvedMappings: 0,
  };
}

export function createEmptyDiagnosticSnapshot(): MasteryRolloutDiagnosticSnapshot {
  return {
    schemaVersion: MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION,
    sequence: 0,
    metrics: createEmptyMetrics(),
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

function isMetrics(value: unknown): value is PersistedMasteryRolloutMetrics {
  return (
    isRecord(value) &&
    hasExactKeys(value, METRIC_KEYS) &&
    METRIC_KEYS.every((key) => isCount(value[key]))
  );
}

function isPersistedEvent(
  value: unknown
): value is PersistedMasteryRolloutDiagnosticEvent {
  if (!isRecord(value) || !isCount(value.sequence)) return false;

  switch (value.category) {
    case 'stable-read':
      return (
        hasExactKeys(value, ['sequence', 'category', 'outcome']) &&
        isOneOf(value.outcome, STABLE_READ_OUTCOMES)
      );
    case 'legacy-fallback':
      return (
        hasExactKeys(value, ['sequence', 'category', 'outcome']) &&
        value.outcome === 'missing-stable'
      );
    case 'shadow-comparison':
      return (
        hasExactKeys(value, [
          'sequence',
          'category',
          'outcome',
          'divergenceCount',
          'unexplainedDivergenceCount',
          'unresolvedMappingCount',
        ]) &&
        isOneOf(value.outcome, SHADOW_COMPARISON_OUTCOMES) &&
        isCount(value.divergenceCount) &&
        isCount(value.unexplainedDivergenceCount) &&
        isCount(value.unresolvedMappingCount)
      );
    case 'reconciliation-conflict':
      return (
        hasExactKeys(value, ['sequence', 'category', 'outcome', 'count']) &&
        value.outcome === 'observed' &&
        isCount(value.count)
      );
    case 'blocked-migration':
      return (
        hasExactKeys(value, ['sequence', 'category', 'outcome']) &&
        isOneOf(value.outcome, BLOCKED_MIGRATION_OUTCOMES)
      );
    case 'compatibility-write':
      return (
        hasExactKeys(value, [
          'sequence',
          'category',
          'outcome',
          'legacyOutcome',
          'stableOutcome',
        ]) &&
        isOneOf(value.outcome, WRITE_OUTCOMES) &&
        isOneOf(value.legacyOutcome, WRITE_LEG_OUTCOMES) &&
        isOneOf(value.stableOutcome, WRITE_LEG_OUTCOMES)
      );
    case 'orphan-adoption':
      return (
        hasExactKeys(value, [
          'sequence',
          'category',
          'outcome',
          'operationOutcome',
          'adoptedRecordCount',
        ]) &&
        isOneOf(value.outcome, WRITE_OUTCOMES) &&
        isOneOf(value.operationOutcome, ORPHAN_ADOPTION_OUTCOMES) &&
        isCount(value.adoptedRecordCount)
      );
    case 'storage-failure':
      return (
        hasExactKeys(value, [
          'sequence',
          'category',
          'outcome',
          'operation',
        ]) &&
        value.outcome === 'failed' &&
        isOneOf(value.operation, STORAGE_FAILURE_OPERATIONS)
      );
    default:
      return false;
  }
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
        'metrics',
        'recentEvents',
      ]) ||
      parsed.schemaVersion !== MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION ||
      !isCount(parsed.sequence) ||
      !isMetrics(parsed.metrics) ||
      !Array.isArray(parsed.recentEvents) ||
      parsed.recentEvents.length > MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS ||
      !parsed.recentEvents.every(isPersistedEvent)
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

function applyEventToMetrics(
  current: PersistedMasteryRolloutMetrics,
  event: MasteryRolloutDiagnosticEvent
): PersistedMasteryRolloutMetrics {
  const metrics = { ...current };
  switch (event.name) {
    case 'stable-read':
      metrics.stableReadsAttempted = addCount(metrics.stableReadsAttempted);
      if (event.status === 'ok') {
        metrics.stableReadsSuccessful = addCount(metrics.stableReadsSuccessful);
      }
      break;
    case 'legacy-fallback':
      metrics.legacyFallbacksUsed = addCount(metrics.legacyFallbacksUsed);
      break;
    case 'shadow-comparison':
      metrics.shadowComparisons = addCount(metrics.shadowComparisons);
      metrics.shadowDivergences = addCount(
        metrics.shadowDivergences,
        event.divergenceCount
      );
      metrics.unresolvedMappings = addCount(
        metrics.unresolvedMappings,
        event.unresolvedMappingCount
      );
      break;
    case 'reconciliation-conflict':
      metrics.reconciliationConflicts = addCount(
        metrics.reconciliationConflicts,
        event.count
      );
      break;
    case 'blocked-migration':
      metrics.blockedMigrations = addCount(metrics.blockedMigrations);
      break;
    case 'compatibility-write':
      metrics.compatibilityWrites = addCount(metrics.compatibilityWrites);
      if (event.status === 'partial') {
        metrics.partialWrites = addCount(metrics.partialWrites);
      }
      break;
    case 'orphan-adoption':
      metrics.orphanAdoptionEvents = addCount(metrics.orphanAdoptionEvents);
      break;
    case 'storage-failure':
      metrics.storageFailures = addCount(metrics.storageFailures);
  }
  return metrics;
}

function projectEvent(
  event: MasteryRolloutDiagnosticEvent,
  sequence: number
): PersistedMasteryRolloutDiagnosticEvent {
  switch (event.name) {
    case 'stable-read':
      return { sequence, category: event.name, outcome: event.status };
    case 'legacy-fallback':
      return { sequence, category: event.name, outcome: event.reason };
    case 'shadow-comparison':
      return {
        sequence,
        category: event.name,
        outcome: event.status,
        divergenceCount: event.divergenceCount,
        unexplainedDivergenceCount: event.unexplainedDivergenceCount,
        unresolvedMappingCount: event.unresolvedMappingCount,
      };
    case 'reconciliation-conflict':
      return {
        sequence,
        category: event.name,
        outcome: 'observed',
        count: event.count,
      };
    case 'blocked-migration':
      return { sequence, category: event.name, outcome: event.reason };
    case 'compatibility-write':
      return {
        sequence,
        category: event.name,
        outcome: event.status,
        legacyOutcome: event.legacyStatus,
        stableOutcome: event.stableStatus,
      };
    case 'orphan-adoption':
      return {
        sequence,
        category: event.name,
        outcome: event.status,
        operationOutcome: event.outcome,
        adoptedRecordCount: event.adoptedRecords,
      };
    case 'storage-failure':
      return {
        sequence,
        category: event.name,
        outcome: 'failed',
        operation: event.operation,
      };
  }
}

function appendEvent(
  snapshot: MasteryRolloutDiagnosticSnapshot,
  event: MasteryRolloutDiagnosticEvent
): MasteryRolloutDiagnosticSnapshot {
  const sequence = addCount(snapshot.sequence);
  const recentEvents = [
    ...snapshot.recentEvents,
    projectEvent(event, sequence),
  ].slice(-MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS);

  return {
    schemaVersion: MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION,
    sequence,
    metrics: applyEventToMetrics(snapshot.metrics, event),
    recentEvents,
  };
}

async function persistDiagnosticEvent(
  storage: DiagnosticKeyValueStorage,
  event: MasteryRolloutDiagnosticEvent
): Promise<void> {
  const raw = await storage.getItem(MASTERY_ROLLOUT_DIAGNOSTIC_STORAGE_KEY);
  const parsed = parseDiagnosticSnapshot(raw);
  const nextSnapshot = appendEvent(parsed.snapshot, event);
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
    await persistDiagnosticEvent(storage, write.event);
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
  storage: DiagnosticKeyValueStorage = AsyncStorage
): Promise<DiagnosticWriteResult> {
  return new Promise((resolve) => {
    let queue = writeQueues.get(storage);
    if (!queue) {
      queue = { active: false, pending: [] };
      writeQueues.set(storage, queue);
    }

    const write = { event, resolve };
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
  storage: DiagnosticKeyValueStorage = AsyncStorage
): (event: MasteryRolloutDiagnosticEvent) => Promise<void> {
  return async (event) => {
    const result = await recordDiagnosticEvent(event, storage);
    if (result.status === 'storage-error') throw result.error;
    if (result.status === 'dropped') throw new DiagnosticQueueFullError();
  };
}
