import {
  buildMasteryStorageKey,
  parseStoredMastery,
  serializeMastery,
  type MasteryMap,
} from '@/src/domain/masteryPersistence';
import {
  FEATURE_FLAGS,
  isContrastMasteryAuthoritative,
  isContrastMasteryShadowEnabled,
  type ContrastMasteryRolloutState,
} from '@/src/config/featureFlags';
import { reportMasteryRolloutDiagnostic } from '@/src/analytics/masteryRolloutDiagnostics';
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
  | {
      readonly status: 'ok';
      readonly sources: readonly LegacyMasterySource[];
      readonly historicalIdentityResolutionObserved: number;
    }
  | { readonly status: 'storage-error'; readonly error: unknown }
> {
  const sources: LegacyMasterySource[] = [];
  let historicalIdentityResolutionObserved = 0;
  for (const assignment of sourceLabelsForLanguage(languageId)) {
    const storageKey = buildMasteryStorageKey(
      assignment.historicalCategoryLabel
    );
    try {
      const raw = await storage.getItem(storageKey);
      sources.push({
        storageKey,
        categoryLabel: assignment.historicalCategoryLabel,
        raw,
      });
      if (!assignment.isCurrent && raw !== null) {
        historicalIdentityResolutionObserved += 1;
      }
    } catch (error) {
      reportMasteryRolloutDiagnostic({
        name: 'storage-failure',
        languageId,
        operation: 'read-legacy',
      });
      return { status: 'storage-error', error };
    }
  }
  reportMasteryRolloutDiagnostic({
    name: 'storage-operation',
    languageId,
    status: 'success',
    operation: 'read-legacy',
    historicalIdentityResolutionObserved,
  });
  return {
    status: 'ok',
    sources,
    historicalIdentityResolutionObserved,
  };
}

async function migrateLanguageMasteryInternal(
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
    reportMasteryRolloutDiagnostic({
      name: 'blocked-migration',
      languageId,
      reason:
        masteryRead.status === 'malformed'
          ? 'malformed-stable'
          : 'unsupported-stable-version',
    });
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
    reportMasteryRolloutDiagnostic({
      name: 'blocked-migration',
      languageId,
      reason: 'malformed-legacy',
    });
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

export async function migrateLanguageMastery(
  storage: MasteryKeyValueStorage,
  languageId: LanguageId
): Promise<LazyMasteryMigrationResult> {
  const result = await migrateLanguageMasteryInternal(storage, languageId);
  reportMasteryRolloutDiagnostic({
    name: 'migration-outcome',
    languageId,
    status: result.status,
  });
  return result;
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

export type MasteryShadowDivergenceKind =
  | 'stable-document-absent'
  | 'stable-record-absent'
  | 'legacy-record-absent'
  | 'tier-disagreement-stable-higher'
  | 'tier-disagreement-stable-lower'
  | 'reset-disagreement'
  | 'placement-disagreement'
  | 'alias-resolution-difference'
  | 'unexpected-fallback-behavior';

export interface MasteryShadowDivergence {
  readonly kind: MasteryShadowDivergenceKind;
  readonly legacyGroup?: string;
  readonly contrastId?: ContrastId;
  readonly stableTier?: number;
  readonly legacyTier?: number;
}

export interface MasteryShadowComparison {
  readonly status: 'compared' | 'stable-missing' | 'blocked';
  readonly stableStatus:
    | 'ok'
    | 'missing'
    | 'malformed'
    | 'unsupported-version'
    | 'storage-error';
  readonly divergences: readonly MasteryShadowDivergence[];
  readonly divergenceCount: number;
  /** Only whole-document stable absence is expected before migration. */
  readonly unexplainedDivergenceCount: number;
  readonly unresolvedMappingCount: number;
  readonly malformedLegacyCount: number;
  readonly diagnostics: MasteryCompatibilityDiagnostics;
}

function compareMasteryMaps(
  languageId: LanguageId,
  stableDocument: ContrastMasteryDocument | undefined,
  legacyMastery: MasteryMap,
  divergences: MasteryShadowDivergence[]
): void {
  const stableMastery = stableDocument
    ? stableDocumentToLegacyMap(stableDocument)
    : {};
  const groups = new Set([
    ...Object.keys(stableMastery),
    ...Object.keys(legacyMastery),
  ]);

  for (const legacyGroup of [...groups].sort((left, right) =>
    left.localeCompare(right)
  )) {
    const stableTier = stableMastery[legacyGroup];
    const legacyTier = legacyMastery[legacyGroup];
    const contrastId = contrastRegistry.contrasts.find(
      (contrast) =>
        contrast.languageId === languageId &&
        contrast.legacyGroup === legacyGroup
    )?.id;
    const stableRecord = stableDocument?.records.find(
      (record) => record.contrastId === contrastId
    );
    const tombstone = stableDocument?.tombstones.find(
      (record) => record.contrastId === contrastId
    );

    if (legacyTier !== undefined && stableTier === undefined) {
      divergences.push({
        kind: tombstone
          ? 'reset-disagreement'
          : stableDocument
            ? 'stable-record-absent'
            : 'stable-document-absent',
        legacyGroup,
        contrastId: tombstone?.contrastId ?? contrastId,
        legacyTier,
      });
      continue;
    }
    if (stableTier === legacyTier) continue;

    if (stableTier !== undefined && legacyTier === undefined) {
      divergences.push({
        kind: 'legacy-record-absent',
        legacyGroup,
        contrastId: stableRecord?.contrastId,
        stableTier,
      });
      continue;
    }

    divergences.push({
      kind:
        tombstone && legacyTier !== undefined
          ? 'reset-disagreement'
          : stableRecord?.provenance === 'placement'
            ? 'placement-disagreement'
            : (stableTier ?? 0) > (legacyTier ?? 0)
              ? 'tier-disagreement-stable-higher'
              : 'tier-disagreement-stable-lower',
      legacyGroup,
      contrastId: stableRecord?.contrastId ?? tombstone?.contrastId,
      stableTier,
      legacyTier,
    });
  }
}

function countDivergencesByKind(
  divergences: readonly MasteryShadowDivergence[]
): Partial<Record<MasteryShadowDivergenceKind, number>> {
  const counts: Partial<Record<MasteryShadowDivergenceKind, number>> = {};
  for (const divergence of divergences) {
    counts[divergence.kind] = (counts[divergence.kind] ?? 0) + 1;
  }
  return counts;
}

/**
 * Reads and compares both representations without invoking migration,
 * reconciliation writes, marker repair, orphan adoption, or compatibility
 * writes. The returned data is diagnostic only and never drives UI state.
 */
export async function compareMasteryInShadow(
  storage: MasteryKeyValueStorage,
  languageId: LanguageId,
  currentCategoryLabel: string
): Promise<MasteryShadowComparison> {
  const stableRead = await readContrastMastery(storage, languageId);
  const legacyRead = await readLegacySourcesForLanguage(storage, languageId);
  const divergences: MasteryShadowDivergence[] = [];
  const stableDocumentPresent = stableRead.status === 'ok';
  const currentLabelIsHistorical = sourceLabelsForLanguage(languageId).some(
    (assignment) =>
      assignment.historicalCategoryLabel === currentCategoryLabel &&
      !assignment.isCurrent
  );

  if (legacyRead.status === 'storage-error') {
    divergences.push({ kind: 'unexpected-fallback-behavior' });
    const result: MasteryShadowComparison = {
      status: 'blocked',
      stableStatus: stableRead.status,
      divergences,
      divergenceCount: divergences.length,
      unexplainedDivergenceCount: divergences.length,
      unresolvedMappingCount: 0,
      malformedLegacyCount: 0,
      diagnostics: diagnostics(),
    };
    reportMasteryRolloutDiagnostic({
      name: 'shadow-comparison',
      languageId,
      status: result.status,
      stableDocumentPresent,
      currentLabelIsHistorical,
      historicalIdentityResolutionObserved: 0,
      divergencesByKind: countDivergencesByKind(result.divergences),
      divergenceCount: result.divergenceCount,
      unexplainedDivergenceCount: result.unexplainedDivergenceCount,
      unresolvedMappingCount: result.unresolvedMappingCount,
      malformedLegacyCount: result.malformedLegacyCount,
    });
    return result;
  }

  const legacyProjection = reconcileInitialLegacyMastery(
    languageId,
    legacyRead.sources
  );
  const comparisonDiagnostics = diagnostics(
    legacyProjection.malformed,
    legacyProjection.unresolved
  );
  const projectedLegacyMastery = stableDocumentToLegacyMap(
    legacyProjection.document
  );
  const currentLegacySource = legacyRead.sources.find(
    (source) => source.categoryLabel === currentCategoryLabel
  );
  const currentLegacyMastery = parseStoredMastery(
    currentLegacySource?.raw ?? null
  );

  for (const legacyGroup of new Set([
    ...Object.keys(projectedLegacyMastery),
    ...Object.keys(currentLegacyMastery),
  ])) {
    if (
      projectedLegacyMastery[legacyGroup] !==
      currentLegacyMastery[legacyGroup]
    ) {
      divergences.push({
        kind: 'alias-resolution-difference',
        legacyGroup,
        contrastId: historicalIdentityMapping.resolveContrast(
          currentCategoryLabel,
          legacyGroup
        ),
        legacyTier: currentLegacyMastery[legacyGroup],
        stableTier: projectedLegacyMastery[legacyGroup],
      });
    }
  }

  if (stableRead.status === 'ok') {
    compareMasteryMaps(
      languageId,
      stableRead.value,
      projectedLegacyMastery,
      divergences
    );
  } else if (stableRead.status === 'missing') {
    compareMasteryMaps(
      languageId,
      undefined,
      projectedLegacyMastery,
      divergences
    );
  } else {
    divergences.push({ kind: 'unexpected-fallback-behavior' });
  }

  const result: MasteryShadowComparison = {
    status:
      legacyProjection.malformed.length > 0
        ? 'blocked'
        : stableRead.status === 'ok'
        ? 'compared'
        : stableRead.status === 'missing'
          ? 'stable-missing'
          : 'blocked',
    stableStatus: stableRead.status,
    divergences,
    divergenceCount: divergences.length,
    unexplainedDivergenceCount: divergences.filter(
      (divergence) => divergence.kind !== 'stable-document-absent'
    ).length,
    unresolvedMappingCount: legacyProjection.unresolved.length,
    malformedLegacyCount: legacyProjection.malformed.length,
    diagnostics: comparisonDiagnostics,
  };
  reportMasteryRolloutDiagnostic({
    name: 'shadow-comparison',
    languageId,
    status: result.status,
    stableDocumentPresent,
    currentLabelIsHistorical,
    historicalIdentityResolutionObserved:
      legacyRead.historicalIdentityResolutionObserved,
    divergencesByKind: countDivergencesByKind(result.divergences),
    divergenceCount: result.divergenceCount,
    unexplainedDivergenceCount: result.unexplainedDivergenceCount,
    unresolvedMappingCount: result.unresolvedMappingCount,
    malformedLegacyCount: result.malformedLegacyCount,
  });
  if (result.unexplainedDivergenceCount > 0) {
    reportMasteryRolloutDiagnostic({
      name: 'reconciliation-conflict',
      languageId,
      count: result.unexplainedDivergenceCount,
    });
  }
  return result;
}

export type CompatibleMasteryReadResult =
  | {
      readonly status: 'ready';
      readonly mastery: MasteryMap;
      readonly source: 'legacy' | 'new';
      readonly diagnostics: MasteryCompatibilityDiagnostics;
      readonly migration?: LazyMasteryMigrationResult;
      readonly shadow?: MasteryShadowComparison;
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
  rollout: boolean | ContrastMasteryRolloutState =
    FEATURE_FLAGS.contrastMasteryRollout
): Promise<CompatibleMasteryReadResult> {
  const state: ContrastMasteryRolloutState =
    typeof rollout === 'boolean'
      ? rollout
        ? 'enabled'
        : 'disabled'
      : rollout;
  if (!isContrastMasteryAuthoritative(state)) {
    const raw = await storage.getItem(
      buildMasteryStorageKey(currentCategoryLabel)
    );
    const shadow = isContrastMasteryShadowEnabled(state)
      ? await compareMasteryInShadow(
          storage,
          languageId,
          currentCategoryLabel
        )
      : undefined;
    return {
      status: 'ready',
      mastery: parseStoredMastery(raw),
      source: 'legacy',
      diagnostics: diagnostics(),
      shadow,
    };
  }

  const stableRead = await readContrastMastery(storage, languageId);
  if (stableRead.status === 'ok') {
    return {
      status: 'ready',
      mastery: stableDocumentToLegacyMap(stableRead.value),
      source: 'new',
      diagnostics: diagnostics(),
    };
  }
  if (stableRead.status === 'missing') {
    let raw: string | null;
    try {
      raw = await storage.getItem(
        buildMasteryStorageKey(currentCategoryLabel)
      );
    } catch (error) {
      reportMasteryRolloutDiagnostic({
        name: 'storage-failure',
        languageId,
        operation: 'read-legacy-fallback',
      });
      return {
        status: 'blocked',
        reason: 'legacy-read-failure',
        diagnostics: diagnostics(),
        migration: {
          status: 'storage-failure',
          operation: 'read-legacy',
          error,
          diagnostics: diagnostics(),
        },
      };
    }
    reportMasteryRolloutDiagnostic({
      name: 'storage-operation',
      languageId,
      status: 'success',
      operation: 'read-legacy-fallback',
    });
    reportMasteryRolloutDiagnostic({
      name: 'legacy-fallback',
      languageId,
      reason: 'missing-stable',
      expected: true,
    });
    return {
      status: 'ready',
      mastery: parseStoredMastery(raw),
      source: 'legacy',
      diagnostics: diagnostics(),
    };
  }

  const reason =
    stableRead.status === 'malformed'
      ? 'malformed-stable'
      : stableRead.status === 'unsupported-version'
        ? 'unsupported-stable-version'
        : 'stable-read-failure';
  const migration: LazyMasteryMigrationResult =
    stableRead.status === 'storage-error'
      ? {
          status: 'storage-failure',
          operation: 'read-stable',
          error: stableRead.error,
          diagnostics: diagnostics(),
        }
      : {
          status: 'blocked-by-unusable-stable',
          stableStatus: stableRead.status,
          diagnostics: diagnostics(),
          readResult: stableRead,
        };
  return {
    status: 'blocked',
    reason,
    diagnostics: diagnostics(),
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
  rollout: boolean | ContrastMasteryRolloutState =
    FEATURE_FLAGS.contrastMasteryRollout
): Promise<CompatibleMasteryWriteResult> {
  const state: ContrastMasteryRolloutState =
    typeof rollout === 'boolean'
      ? rollout
        ? 'enabled'
        : 'disabled'
      : rollout;
  const enabled = isContrastMasteryAuthoritative(state);
  const finish = (
    result: CompatibleMasteryWriteResult
  ): CompatibleMasteryWriteResult => {
    reportMasteryRolloutDiagnostic({
      name: 'compatibility-write',
      languageId,
      provenance,
      status: result.status,
      legacyStatus: result.legacy.status,
      stableStatus: result.stable.status,
    });
    if (result.legacy.status === 'failed') {
      reportMasteryRolloutDiagnostic({
        name: 'storage-failure',
        languageId,
        operation: 'write-legacy',
      });
    }
    return result;
  };
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
    return finish({
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
    });
  }
  if (!enabled) {
    return finish({
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
    });
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

  return finish({
    status: stable.succeeded ? 'complete' : 'partial',
    writeOrder: 'legacy-first',
    legacy,
    stable,
    retryRequired: !stable.succeeded,
    unresolvedGroups,
  });
}
