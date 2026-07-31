import {
  buildMasteryStorageKey,
  parseStoredMastery,
  serializeMastery,
  type MasteryMap,
} from '@/src/domain/masteryPersistence';
import { FEATURE_FLAGS } from '@/src/config/featureFlags';
import type { ContrastId, LanguageId } from '@/src/domain/identity';
import {
  CONTRAST_MASTERY_SCHEMA_VERSION,
  candidatesToMasteryEntries,
  defineMasteryRevision,
  defineMasteryTier,
  fingerprintLegacySources,
  reconcileInitialLegacyMastery,
  reconcileSteadyStateMastery,
  updateLegacySourceObservations,
  type ContrastMasteryDocument,
  type LegacyMasteryDiagnostic,
  type LegacyMasterySource,
  type MasteryProvenance,
} from '@/src/domain/contrastMasteryPersistence';
import { historicalIdentityMapping } from '@/src/domain/compatibility/historicalIdentityMapping';
import { contrastRegistry } from '@/src/domain/contrast/contrastRegistry';
import {
  readContrastMastery,
  readContrastMasteryMigrationState,
  writeContrastMastery,
  writeContrastMasteryMigrationState,
  type MasteryKeyValueStorage,
  type MasteryStorageReadResult,
} from '@/src/storage/contrastMasteryStorage';

export interface MasteryCompatibilityDiagnostics {
  readonly malformed: readonly LegacyMasteryDiagnostic[];
  readonly unresolved: readonly LegacyMasteryDiagnostic[];
}

export type LazyMasteryMigrationResult =
  | {
      readonly status:
        | 'already-current'
        | 'migrated'
        | 'migration-state-recreated';
      readonly document: ContrastMasteryDocument;
      readonly diagnostics: MasteryCompatibilityDiagnostics;
    }
  | {
      readonly status: 'unresolved-historical-identities';
      readonly document: ContrastMasteryDocument;
      readonly diagnostics: MasteryCompatibilityDiagnostics;
    }
  | {
      readonly status: 'partially-migrated';
      readonly document: ContrastMasteryDocument;
      readonly failedWrite: 'migration-state';
      readonly error: unknown;
      readonly diagnostics: MasteryCompatibilityDiagnostics;
    }
  | {
      readonly status: 'degraded';
      readonly document: ContrastMasteryDocument;
      readonly source: 'legacy' | 'migration-state';
      readonly reason:
        | 'legacy-read-failure'
        | 'malformed-legacy'
        | 'migration-state-read-failure';
      readonly error?: unknown;
      readonly diagnostics: MasteryCompatibilityDiagnostics;
    }
  | {
      readonly status: 'blocked-by-unusable-stable';
      readonly stableStatus: 'malformed' | 'unsupported-version';
      readonly diagnostics: MasteryCompatibilityDiagnostics;
      readonly readResult: MasteryStorageReadResult<ContrastMasteryDocument>;
    }
  | {
      readonly status: 'blocked-by-malformed-data';
      readonly source: 'legacy';
      readonly diagnostics: MasteryCompatibilityDiagnostics;
    }
  | {
      readonly status: 'storage-failure';
      readonly operation:
        | 'read-stable'
        | 'read-migration-state'
        | 'read-legacy'
        | 'write-mastery';
      readonly error: unknown;
      readonly diagnostics: MasteryCompatibilityDiagnostics;
    };

function diagnostics(
  malformed: readonly LegacyMasteryDiagnostic[] = [],
  unresolved: readonly LegacyMasteryDiagnostic[] = []
): MasteryCompatibilityDiagnostics {
  return { malformed, unresolved };
}

function sourceLabelsForLanguage(languageId: LanguageId) {
  return historicalIdentityMapping.categoryLabels.filter(
    (assignment) => assignment.languageId === languageId
  );
}

export async function readLegacySourcesForLanguage(
  storage: MasteryKeyValueStorage,
  languageId: LanguageId
): Promise<
  | { readonly status: 'ok'; readonly sources: readonly LegacyMasterySource[] }
  | { readonly status: 'storage-error'; readonly error: unknown }
> {
  const sources: LegacyMasterySource[] = [];
  for (const assignment of sourceLabelsForLanguage(languageId)) {
    const storageKey = buildMasteryStorageKey(
      assignment.historicalCategoryLabel
    );
    try {
      sources.push({
        storageKey,
        categoryLabel: assignment.historicalCategoryLabel,
        raw: await storage.getItem(storageKey),
      });
    } catch (error) {
      return { status: 'storage-error', error };
    }
  }
  return { status: 'ok', sources };
}

export async function migrateLanguageMastery(
  storage: MasteryKeyValueStorage,
  languageId: LanguageId
): Promise<LazyMasteryMigrationResult> {
  const masteryRead = await readContrastMastery(storage, languageId);
  if (masteryRead.status === 'storage-error') {
    return {
      status: 'storage-failure',
      operation: 'read-stable',
      error: masteryRead.error,
      diagnostics: diagnostics(),
    };
  }
  if (
    masteryRead.status === 'malformed' ||
    masteryRead.status === 'unsupported-version'
  ) {
    return {
      status: 'blocked-by-unusable-stable',
      stableStatus: masteryRead.status,
      diagnostics: diagnostics(),
      readResult: masteryRead,
    };
  }

  const priorDocument =
    masteryRead.status === 'ok' ? masteryRead.value : undefined;
  const migrationRead = await readContrastMasteryMigrationState(
    storage,
    languageId
  );
  if (migrationRead.status === 'storage-error') {
    if (priorDocument) {
      return {
        status: 'degraded',
        document: priorDocument,
        source: 'migration-state',
        reason: 'migration-state-read-failure',
        error: migrationRead.error,
        diagnostics: diagnostics(),
      };
    }
    return {
      status: 'storage-failure',
      operation: 'read-migration-state',
      error: migrationRead.error,
      diagnostics: diagnostics(),
    };
  }

  const priorState =
    migrationRead.status === 'ok' ? migrationRead.value : undefined;
  const legacyRead = await readLegacySourcesForLanguage(storage, languageId);
  if (legacyRead.status === 'storage-error') {
    if (priorDocument) {
      return {
        status: 'degraded',
        document: priorDocument,
        source: 'legacy',
        reason: 'legacy-read-failure',
        error: legacyRead.error,
        diagnostics: diagnostics(),
      };
    }
    return {
      status: 'storage-failure',
      operation: 'read-legacy',
      error: legacyRead.error,
      diagnostics: diagnostics(),
    };
  }
  const initial = reconcileInitialLegacyMastery(languageId, legacyRead.sources);
  const migrationDiagnostics = diagnostics(
    initial.malformed,
    initial.unresolved
  );
  if (initial.malformed.length > 0) {
    if (priorDocument) {
      return {
        status: 'degraded',
        document: priorDocument,
        source: 'legacy',
        reason: 'malformed-legacy',
        diagnostics: migrationDiagnostics,
      };
    }
    return {
      status: 'blocked-by-malformed-data',
      source: 'legacy',
      diagnostics: migrationDiagnostics,
    };
  }

  /*
   * Migration-state metadata is advisory. If a valid stable document survives
   * marker loss or corruption, baseline the currently visible legacy bytes as
   * observations without reconciling them. Their historical action order is
   * unknowable, so they cannot outrank stable reset/lowering records merely
   * because the marker disappeared.
   */
  if (priorDocument && migrationRead.status !== 'ok') {
    const recreatedState = updateLegacySourceObservations(
      languageId,
      legacyRead.sources,
      undefined,
      priorDocument.lastRevision
    ).state;
    const stateWrite = await writeContrastMasteryMigrationState(
      storage,
      recreatedState
    );
    if (stateWrite.status === 'storage-error') {
      return {
        status: 'partially-migrated',
        document: priorDocument,
        failedWrite: 'migration-state',
        error: stateWrite.error,
        diagnostics: migrationDiagnostics,
      };
    }
    return {
      status: 'migration-state-recreated',
      document: priorDocument,
      diagnostics: migrationDiagnostics,
    };
  }

  if (
    priorDocument &&
    priorState &&
    priorState.sourceFingerprint === fingerprintLegacySources(legacyRead.sources)
  ) {
    return {
      status:
        initial.unresolved.length > 0
          ? 'unresolved-historical-identities'
          : 'already-current',
      document: priorDocument,
      diagnostics: migrationDiagnostics,
    };
  }

  let document: ContrastMasteryDocument;
  let nextState;
  if (!priorDocument) {
    document = initial.document;
    nextState = updateLegacySourceObservations(
      languageId,
      legacyRead.sources,
      undefined,
      document.lastRevision
    ).state;
  } else {
    const observation = updateLegacySourceObservations(
      languageId,
      legacyRead.sources,
      priorState,
      priorDocument.lastRevision
    );
    document = reconcileSteadyStateMastery(priorDocument, [
      ...candidatesToMasteryEntries(observation.inspection.candidates),
      ...observation.deletedEntries,
    ]);
    nextState = observation.state;
  }

  const masteryWrite = await writeContrastMastery(storage, document);
  if (masteryWrite.status === 'storage-error') {
    return {
      status: 'storage-failure',
      operation: 'write-mastery',
      error: masteryWrite.error,
      diagnostics: migrationDiagnostics,
    };
  }
  const stateWrite = await writeContrastMasteryMigrationState(
    storage,
    nextState
  );
  if (stateWrite.status === 'storage-error') {
    return {
      status: 'partially-migrated',
      document,
      failedWrite: 'migration-state',
      error: stateWrite.error,
      diagnostics: migrationDiagnostics,
    };
  }
  return {
    status:
      initial.unresolved.length > 0
        ? 'unresolved-historical-identities'
        : 'migrated',
    document,
    diagnostics: migrationDiagnostics,
  };
}

function stableDocumentToLegacyMap(
  document: ContrastMasteryDocument
): MasteryMap {
  const mastery: MasteryMap = {};
  for (const record of document.records) {
    const contrast = contrastRegistry.getById(record.contrastId);
    if (contrast && contrast.languageId === document.languageId) {
      mastery[contrast.legacyGroup] = record.tier;
    }
  }
  return mastery;
}

export type CompatibleMasteryReadResult =
  | {
      readonly status: 'ready';
      readonly mastery: MasteryMap;
      readonly source: 'legacy' | 'new';
      readonly diagnostics: MasteryCompatibilityDiagnostics;
      readonly migration?: LazyMasteryMigrationResult;
    }
  | {
      readonly status: 'blocked';
      readonly reason:
        | 'malformed-stable'
        | 'unsupported-stable-version'
        | 'stable-read-failure'
        | 'migration-state-read-failure'
        | 'legacy-read-failure'
        | 'migration-storage-failure'
        | 'missing-stable-with-malformed-legacy';
      readonly diagnostics: MasteryCompatibilityDiagnostics;
      readonly migration: LazyMasteryMigrationResult;
    };

export async function readCompatibleMastery(
  storage: MasteryKeyValueStorage,
  languageId: LanguageId,
  currentCategoryLabel: string,
  enabled: boolean = FEATURE_FLAGS.contrastMasteryStore
): Promise<CompatibleMasteryReadResult> {
  if (!enabled) {
    const raw = await storage.getItem(
      buildMasteryStorageKey(currentCategoryLabel)
    );
    return {
      status: 'ready',
      mastery: parseStoredMastery(raw),
      source: 'legacy',
      diagnostics: diagnostics(),
    };
  }

  const migration = await migrateLanguageMastery(storage, languageId);
  if (
    migration.status === 'already-current' ||
    migration.status === 'migrated' ||
    migration.status === 'migration-state-recreated' ||
    migration.status === 'unresolved-historical-identities' ||
    migration.status === 'partially-migrated' ||
    migration.status === 'degraded'
  ) {
    return {
      status: 'ready',
      mastery: stableDocumentToLegacyMap(migration.document),
      source: 'new',
      diagnostics: migration.diagnostics,
      migration,
    };
  }

  const reason =
    migration.status === 'blocked-by-unusable-stable'
      ? migration.stableStatus === 'malformed'
        ? 'malformed-stable'
        : 'unsupported-stable-version'
      : migration.status === 'storage-failure'
        ? migration.operation === 'read-stable'
          ? 'stable-read-failure'
          : migration.operation === 'read-migration-state'
            ? 'migration-state-read-failure'
            : migration.operation === 'read-legacy'
              ? 'legacy-read-failure'
              : 'migration-storage-failure'
        : 'missing-stable-with-malformed-legacy';
  return {
    status: 'blocked',
    reason,
    diagnostics: migration.diagnostics,
    migration,
  };
}

export interface CompatibilityWriteLeg {
  /** Whether this invocation attempted the write. */
  readonly attempted: boolean;
  /** Whether this invocation completed the write successfully. */
  readonly succeeded: boolean;
  readonly status: 'not-attempted' | 'written' | 'failed' | 'blocked';
  readonly error?: unknown;
  readonly reason?: string;
}

export interface StableCompatibilityWriteLeg extends CompatibilityWriteLeg {
  /** A valid stable document existed before this invocation began. */
  readonly preExisting: boolean;
  /** Explicit alias for the stable leg's invocation-local success. */
  readonly succeededThisInvocation: boolean;
}

export interface CompatibleMasteryWriteResult {
  readonly status: 'complete' | 'partial' | 'failed';
  readonly writeOrder: 'legacy-only' | 'legacy-first';
  readonly legacy: CompatibilityWriteLeg;
  readonly stable: StableCompatibilityWriteLeg;
  readonly retryRequired: boolean;
  readonly unresolvedGroups: readonly string[];
}

function buildActionDocument(
  current: ContrastMasteryDocument,
  categoryLabel: string,
  mastery: MasteryMap,
  provenance: Exclude<MasteryProvenance, 'initial-migration' | 'legacy-reconciliation'>
): { document: ContrastMasteryDocument; unresolvedGroups: string[] } {
  const revision = defineMasteryRevision(current.lastRevision + 1);
  const unresolvedGroups: string[] = [];
  const records = Object.entries(mastery)
    .sort(([left], [right]) => left.localeCompare(right))
    .flatMap(([legacyGroup, value]) => {
      const contrastId = historicalIdentityMapping.resolveContrast(
        categoryLabel,
        legacyGroup
      );
      if (!contrastId) {
        unresolvedGroups.push(legacyGroup);
        return [];
      }
      return [
        {
          contrastId,
          tier: defineMasteryTier(value),
          revision,
          provenance: provenance === 'reset' ? ('practice' as const) : provenance,
        },
      ];
    });

  if (provenance === 'reset') {
    const identities = new Set<ContrastId>([
      ...current.records.map((record) => record.contrastId),
      ...current.tombstones.map((record) => record.contrastId),
    ]);
    return {
      document: reconcileSteadyStateMastery(
        current,
        [...identities].map((contrastId) => ({
          contrastId,
          revision,
          provenance: 'reset' as const,
        }))
      ),
      unresolvedGroups,
    };
  }
  return {
    document: reconcileSteadyStateMastery(current, records),
    unresolvedGroups,
  };
}

/**
 * Flag-on writes are an explicit legacy-first state machine. A failed legacy
 * write stops the operation before any stable write. No compensating delete or
 * rewrite is attempted, so a legacy-only partial success is safe to retry.
 */
export async function writeCompatibleMastery(
  storage: MasteryKeyValueStorage,
  languageId: LanguageId,
  currentCategoryLabel: string,
  mastery: MasteryMap,
  provenance: 'practice' | 'placement' | 'reset',
  enabled: boolean = FEATURE_FLAGS.contrastMasteryStore
): Promise<CompatibleMasteryWriteResult> {
  const currentRead = enabled
    ? await readContrastMastery(storage, languageId)
    : undefined;
  const stablePreExisting = currentRead?.status === 'ok';
  let legacy: CompatibilityWriteLeg;
  try {
    await storage.setItem(
      buildMasteryStorageKey(currentCategoryLabel),
      serializeMastery(mastery)
    );
    legacy = { attempted: true, succeeded: true, status: 'written' };
  } catch (error) {
    legacy = { attempted: true, succeeded: false, status: 'failed', error };
  }

  if (!legacy.succeeded) {
    return {
      status: 'failed',
      writeOrder: enabled ? 'legacy-first' : 'legacy-only',
      legacy,
      stable: {
        attempted: false,
        succeeded: false,
        status: 'not-attempted',
        reason: 'legacy-write-failed',
        preExisting: stablePreExisting,
        succeededThisInvocation: false,
      },
      retryRequired: true,
      unresolvedGroups: [],
    };
  }
  if (!enabled) {
    return {
      status: 'complete',
      writeOrder: 'legacy-only',
      legacy,
      stable: {
        attempted: false,
        succeeded: false,
        status: 'not-attempted',
        reason: 'feature-disabled',
        preExisting: false,
        succeededThisInvocation: false,
      },
      retryRequired: false,
      unresolvedGroups: [],
    };
  }

  if (!currentRead) {
    throw new Error('Enabled compatibility write must inspect stable state');
  }
  let stable: StableCompatibilityWriteLeg;
  let unresolvedGroups: string[] = [];
  if (
    currentRead.status === 'malformed' ||
    currentRead.status === 'unsupported-version' ||
    currentRead.status === 'storage-error'
  ) {
    stable = {
      attempted: false,
      succeeded: false,
      status: 'blocked',
      reason: `new-mastery-${currentRead.status}`,
      preExisting: stablePreExisting,
      succeededThisInvocation: false,
    };
  } else {
    const current =
      currentRead.status === 'ok'
        ? currentRead.value
        : ({
            schemaVersion: CONTRAST_MASTERY_SCHEMA_VERSION,
            languageId,
            lastRevision: 0,
            records: [],
            tombstones: [],
          } satisfies ContrastMasteryDocument);
    const action = buildActionDocument(
      current,
      currentCategoryLabel,
      mastery,
      provenance
    );
    unresolvedGroups = action.unresolvedGroups;
    const stableWrite = await writeContrastMastery(storage, action.document);
    stable =
      stableWrite.status === 'written'
        ? {
            attempted: true,
            succeeded: true,
            status: 'written',
            preExisting: stablePreExisting,
            succeededThisInvocation: true,
          }
        : {
            attempted: true,
            succeeded: false,
            status: 'failed',
            error: stableWrite.error,
            preExisting: stablePreExisting,
            succeededThisInvocation: false,
          };
  }

  return {
    status: stable.succeeded ? 'complete' : 'partial',
    writeOrder: 'legacy-first',
    legacy,
    stable,
    retryRequired: !stable.succeeded,
    unresolvedGroups,
  };
}
