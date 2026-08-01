import type { LanguageId } from '@/src/domain/identity';
import { reportMasteryRolloutDiagnostic } from '@/src/analytics/masteryRolloutDiagnostics';
import {
  analyzeOrphanedMastery,
  proposeOrphanMasteryAdoption,
  type OrphanAdoptionAnalysis,
  type OrphanAdoptionCounts,
  type OrphanAdoptionPlan,
} from '@/src/domain/orphanMasteryAdoption';
import type {
  ContrastMasteryDocument,
  LegacyMasteryDiagnostic,
} from '@/src/domain/contrastMasteryPersistence';
import {
  readContrastMastery,
  readContrastMasteryMigrationState,
  writeContrastMastery,
  writeContrastMasteryMigrationState,
  type MasteryKeyValueStorage,
} from '@/src/storage/contrastMasteryStorage';
import { readLegacySourcesForLanguage } from '@/src/storage/masteryCompatibility';

export interface OrphanAdoptionWriteLeg {
  readonly attempted: boolean;
  readonly succeeded: boolean;
  readonly status: 'not-attempted' | 'written' | 'failed';
  readonly error?: unknown;
}

export interface OrphanAdoptionOperationResult {
  readonly status: 'complete' | 'partial' | 'failed';
  readonly outcome:
    | 'no-stable-state'
    | 'blocked-by-unusable-stable'
    | 'no-candidates'
    | 'candidates-adopted'
    | 'candidates-partially-persisted'
    | 'marker-only-repair'
    | 'storage-failure';
  readonly writeOrder: 'stable-then-migration-state';
  readonly stableWrite: OrphanAdoptionWriteLeg;
  readonly migrationStateWrite: OrphanAdoptionWriteLeg;
  readonly retryRequired: boolean;
  readonly counts: OrphanAdoptionCounts;
  readonly diagnostics: {
    readonly unresolved: readonly LegacyMasteryDiagnostic[];
    readonly malformed: readonly LegacyMasteryDiagnostic[];
  };
  readonly hasUnresolvedHistoricalEvidence: boolean;
  readonly document?: ContrastMasteryDocument;
  readonly analysis?: OrphanAdoptionAnalysis;
  readonly plan?: OrphanAdoptionPlan;
  readonly stableStatus?: 'malformed' | 'unsupported-version';
  readonly operation?:
    | 'read-stable'
    | 'read-migration-state'
    | 'read-legacy'
    | 'write-stable'
    | 'write-migration-state';
  readonly error?: unknown;
}

const NOT_ATTEMPTED: OrphanAdoptionWriteLeg = {
  attempted: false,
  succeeded: false,
  status: 'not-attempted',
};

const EMPTY_COUNTS: OrphanAdoptionCounts = {
  recognizedLegacyEntries: 0,
  alreadyRepresented: 0,
  adoptable: 0,
  adopted: 0,
  adoptedRecords: 0,
  blocked: 0,
  unresolved: 0,
  malformed: 0,
};

const EMPTY_DIAGNOSTICS = {
  unresolved: [] as readonly LegacyMasteryDiagnostic[],
  malformed: [] as readonly LegacyMasteryDiagnostic[],
};

function reportOrphanAdoption(
  languageId: LanguageId,
  result: OrphanAdoptionOperationResult
): OrphanAdoptionOperationResult {
  reportMasteryRolloutDiagnostic({
    name: 'orphan-adoption',
    languageId,
    status: result.status,
    outcome: result.outcome,
    adoptedRecords: result.counts.adoptedRecords,
  });
  return result;
}

/**
 * Explicit Phase 3.6 recovery operation. It scans exactly one language, never
 * deletes legacy data, and is intentionally not wired to startup or UI code.
 */
export async function adoptOrphanedMasteryForLanguage(
  storage: MasteryKeyValueStorage,
  languageId: LanguageId
): Promise<OrphanAdoptionOperationResult> {
  const stableRead = await readContrastMastery(storage, languageId);
  if (stableRead.status === 'storage-error') {
    return reportOrphanAdoption(languageId, {
      status: 'failed',
      outcome: 'storage-failure',
      writeOrder: 'stable-then-migration-state',
      stableWrite: NOT_ATTEMPTED,
      migrationStateWrite: NOT_ATTEMPTED,
      retryRequired: true,
      counts: EMPTY_COUNTS,
      diagnostics: EMPTY_DIAGNOSTICS,
      hasUnresolvedHistoricalEvidence: false,
      operation: 'read-stable',
      error: stableRead.error,
    });
  }
  if (stableRead.status === 'missing') {
    return reportOrphanAdoption(languageId, {
      status: 'failed',
      outcome: 'no-stable-state',
      writeOrder: 'stable-then-migration-state',
      stableWrite: NOT_ATTEMPTED,
      migrationStateWrite: NOT_ATTEMPTED,
      retryRequired: false,
      counts: EMPTY_COUNTS,
      diagnostics: EMPTY_DIAGNOSTICS,
      hasUnresolvedHistoricalEvidence: false,
    });
  }
  if (
    stableRead.status === 'malformed' ||
    stableRead.status === 'unsupported-version'
  ) {
    return reportOrphanAdoption(languageId, {
      status: 'failed',
      outcome: 'blocked-by-unusable-stable',
      writeOrder: 'stable-then-migration-state',
      stableWrite: NOT_ATTEMPTED,
      migrationStateWrite: NOT_ATTEMPTED,
      retryRequired: false,
      counts: EMPTY_COUNTS,
      diagnostics: EMPTY_DIAGNOSTICS,
      hasUnresolvedHistoricalEvidence: false,
      stableStatus: stableRead.status,
    });
  }

  const migrationRead = await readContrastMasteryMigrationState(
    storage,
    languageId
  );
  if (migrationRead.status === 'storage-error') {
    return reportOrphanAdoption(languageId, {
      status: 'failed',
      outcome: 'storage-failure',
      writeOrder: 'stable-then-migration-state',
      stableWrite: NOT_ATTEMPTED,
      migrationStateWrite: NOT_ATTEMPTED,
      retryRequired: true,
      counts: EMPTY_COUNTS,
      diagnostics: EMPTY_DIAGNOSTICS,
      hasUnresolvedHistoricalEvidence: false,
      document: stableRead.value,
      operation: 'read-migration-state',
      error: migrationRead.error,
    });
  }

  const legacyRead = await readLegacySourcesForLanguage(storage, languageId);
  if (legacyRead.status === 'storage-error') {
    return reportOrphanAdoption(languageId, {
      status: 'failed',
      outcome: 'storage-failure',
      writeOrder: 'stable-then-migration-state',
      stableWrite: NOT_ATTEMPTED,
      migrationStateWrite: NOT_ATTEMPTED,
      retryRequired: true,
      counts: EMPTY_COUNTS,
      diagnostics: EMPTY_DIAGNOSTICS,
      hasUnresolvedHistoricalEvidence: false,
      document: stableRead.value,
      operation: 'read-legacy',
      error: legacyRead.error,
    });
  }

  const analysis = analyzeOrphanedMastery(
    stableRead.value,
    migrationRead.status === 'ok' ? migrationRead.value : undefined,
    legacyRead.sources
  );
  const plan = proposeOrphanMasteryAdoption(stableRead.value, analysis);
  const common = {
    writeOrder: 'stable-then-migration-state' as const,
    counts: plan.counts,
    diagnostics: analysis.diagnostics,
    hasUnresolvedHistoricalEvidence:
      plan.counts.unresolved > 0 || plan.counts.malformed > 0,
    analysis,
    plan,
  };

  let stableWrite = NOT_ATTEMPTED;
  if (plan.adoptedRecords.length > 0) {
    const write = await writeContrastMastery(storage, plan.document);
    if (write.status === 'storage-error') {
      stableWrite = {
        attempted: true,
        succeeded: false,
        status: 'failed',
        error: write.error,
      };
      return reportOrphanAdoption(languageId, {
        ...common,
        counts: {
          ...plan.counts,
          adopted: 0,
          adoptedRecords: 0,
        },
        status: 'failed',
        outcome: 'storage-failure',
        stableWrite,
        migrationStateWrite: NOT_ATTEMPTED,
        retryRequired: true,
        document: stableRead.value,
        operation: 'write-stable',
        error: write.error,
      });
    }
    stableWrite = { attempted: true, succeeded: true, status: 'written' };
  }

  let migrationStateWrite = NOT_ATTEMPTED;
  if (analysis.markerNeedsUpdate) {
    // If the marker contains proposed adoption evidence, its required stable
    // write succeeded above; stable failures return before reaching this leg.
    const write = await writeContrastMasteryMigrationState(
      storage,
      analysis.nextMigrationState
    );
    if (write.status === 'storage-error') {
      migrationStateWrite = {
        attempted: true,
        succeeded: false,
        status: 'failed',
        error: write.error,
      };
      return reportOrphanAdoption(languageId, {
        ...common,
        status: stableWrite.succeeded ? 'partial' : 'failed',
        outcome: stableWrite.succeeded
          ? 'candidates-partially-persisted'
          : 'storage-failure',
        stableWrite,
        migrationStateWrite,
        retryRequired: true,
        document: stableWrite.succeeded ? plan.document : stableRead.value,
        operation: 'write-migration-state',
        error: write.error,
      });
    }
    migrationStateWrite = {
      attempted: true,
      succeeded: true,
      status: 'written',
    };
  }

  return reportOrphanAdoption(languageId, {
    ...common,
    status: 'complete',
    outcome:
      plan.adoptedRecords.length > 0
        ? 'candidates-adopted'
        : migrationStateWrite.succeeded
          ? 'marker-only-repair'
          : 'no-candidates',
    stableWrite,
    migrationStateWrite,
    retryRequired: false,
    document: plan.document,
  });
}
