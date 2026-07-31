/**
 * Pure read-side projection for already-parsed legacy pair progress.
 *
 * Storage access, storage keys, parser orchestration, and React integration
 * belong outside this module. Its runtime dependencies are limited to static
 * domain data and the exact historical identity mapping.
 */
import type { Pair } from '@/src/constants/minimalPairs';
import {
  historicalIdentityMapping,
  isStructurallyValidLegacyPairProgressKey,
  type HistoricalIdentityMapping,
  type HistoricalPairAssignment,
} from '@/src/domain/compatibility/historicalIdentityMapping';
import type { ContrastId, LanguageId } from '@/src/domain/identity';

export interface ParsedPairProgressStats {
  readonly attempts: readonly unknown[];
}

export type ParsedPairProgress = Readonly<
  Record<string, ParsedPairProgressStats>
>;

export interface ProjectedAttempt {
  readonly isCorrect: boolean;
  readonly timestamp: number;
  readonly durationMin: number;
}

export interface LatestPairAttempt {
  readonly legacyPairProgressKey: string;
  readonly attemptIndex: number;
  readonly attempt: ProjectedAttempt;
}

export interface PairProgressTotals {
  readonly attemptCount: number;
  readonly correctCount: number;
  readonly incorrectCount: number;
  readonly accuracy: number;
  readonly totalDurationMin: number;
  readonly latestAttempt: LatestPairAttempt | null;
}

export interface ProjectedPairReference {
  readonly currentCategoryLabel: string;
  readonly pair: Readonly<Pair>;
}

export interface ProjectedPairHistory {
  readonly legacyPairProgressKey: string;
  readonly historicalCategoryLabel: string;
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
  readonly pairReference: ProjectedPairReference;
  readonly attempts: readonly ProjectedAttempt[];
  readonly totals: PairProgressTotals;
}

export interface ContrastPairProgress {
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
  readonly pairHistories: readonly ProjectedPairHistory[];
  readonly totals: PairProgressTotals;
}

interface DiagnosticPairHistory {
  readonly legacyPairProgressKey: string;
  readonly attempts: readonly ProjectedAttempt[];
  readonly totals: PairProgressTotals;
}

export interface UnmappedPairProgressEntry extends DiagnosticPairHistory {
  readonly reason: 'unmapped-pair-key';
}

export interface MalformedPairProgressEntry extends DiagnosticPairHistory {
  readonly reason: 'malformed-pair-key';
}

export interface MalformedPairProgressAttempt {
  readonly legacyPairProgressKey: string;
  readonly attemptIndex: number;
  readonly reason: 'invalid-attempt';
}

export interface PairProgressProjectionDiagnostics {
  readonly sourceEntryCount: number;
  readonly mappedEntryCount: number;
  readonly unmappedEntryCount: number;
  readonly malformedEntryCount: number;
  readonly sourceAttemptSlotCount: number;
  readonly effectiveAttemptCount: number;
  readonly mappedAttemptCount: number;
  readonly unmappedAttemptCount: number;
  readonly malformedEntryAttemptCount: number;
  readonly malformedAttemptCount: number;
}

export interface ContrastPairProgressProjection {
  readonly contrasts: readonly ContrastPairProgress[];
  readonly unmappedEntries: readonly UnmappedPairProgressEntry[];
  readonly malformedEntries: readonly MalformedPairProgressEntry[];
  readonly malformedAttempts: readonly MalformedPairProgressAttempt[];
  /**
   * Totals for attempts mapped to stable Contrast identities.
   */
  readonly mappedTotals: PairProgressTotals;
  /**
   * Lifetime totals for every valid parsed attempt, including histories whose
   * legacy keys are unknown or malformed.
   */
  readonly aggregateTotals: PairProgressTotals;
  readonly diagnostics: PairProgressProjectionDiagnostics;
}

interface ValidAttemptRecord {
  readonly legacyPairProgressKey: string;
  readonly attemptIndex: number;
  readonly attempt: ProjectedAttempt;
}

interface MappedHistoryBuilder {
  readonly assignment: HistoricalPairAssignment;
  readonly records: readonly ValidAttemptRecord[];
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isValidAttempt(value: unknown): value is ProjectedAttempt {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const attempt = value as Record<string, unknown>;
  return (
    typeof attempt.isCorrect === 'boolean' &&
    typeof attempt.timestamp === 'number' &&
    Number.isFinite(attempt.timestamp) &&
    typeof attempt.durationMin === 'number' &&
    Number.isFinite(attempt.durationMin) &&
    attempt.durationMin >= 0
  );
}

function copyAttempt(attempt: ProjectedAttempt): ProjectedAttempt {
  return Object.freeze({
    isCorrect: attempt.isCorrect,
    timestamp: attempt.timestamp,
    durationMin: attempt.durationMin,
  });
}

function copyPairReference(
  assignment: HistoricalPairAssignment
): ProjectedPairReference {
  return Object.freeze({
    currentCategoryLabel: assignment.pairReference.currentCategoryLabel,
    pair: Object.freeze({ ...assignment.pairReference.pair }),
  });
}

function isLaterAttempt(
  candidate: LatestPairAttempt,
  current: LatestPairAttempt
): boolean {
  if (candidate.attempt.timestamp !== current.attempt.timestamp) {
    return candidate.attempt.timestamp > current.attempt.timestamp;
  }

  const keyComparison = compareText(
    candidate.legacyPairProgressKey,
    current.legacyPairProgressKey
  );
  if (keyComparison !== 0) return keyComparison < 0;
  return candidate.attemptIndex > current.attemptIndex;
}

function totalsFor(records: readonly ValidAttemptRecord[]): PairProgressTotals {
  let correctCount = 0;
  let totalDurationMin = 0;
  let latestAttempt: LatestPairAttempt | null = null;

  for (const record of records) {
    if (record.attempt.isCorrect) correctCount += 1;
    totalDurationMin += record.attempt.durationMin;

    const candidate = Object.freeze({
      legacyPairProgressKey: record.legacyPairProgressKey,
      attemptIndex: record.attemptIndex,
      attempt: record.attempt,
    });
    if (!latestAttempt || isLaterAttempt(candidate, latestAttempt)) {
      latestAttempt = candidate;
    }
  }

  const attemptCount = records.length;
  return Object.freeze({
    attemptCount,
    correctCount,
    incorrectCount: attemptCount - correctCount,
    accuracy: attemptCount === 0 ? 0 : correctCount / attemptCount,
    totalDurationMin,
    latestAttempt,
  });
}

function stableContrastKey(
  languageId: LanguageId,
  contrastId: ContrastId
): string {
  return `${languageId}\u0000${contrastId}`;
}

function validAttemptRecords(
  legacyPairProgressKey: string,
  attempts: readonly unknown[],
  malformedAttempts: MalformedPairProgressAttempt[]
): readonly ValidAttemptRecord[] {
  const records: ValidAttemptRecord[] = [];

  attempts.forEach((attempt, attemptIndex) => {
    if (!isValidAttempt(attempt)) {
      malformedAttempts.push(
        Object.freeze({
          legacyPairProgressKey,
          attemptIndex,
          reason: 'invalid-attempt' as const,
        })
      );
      return;
    }

    records.push(
      Object.freeze({
        legacyPairProgressKey,
        attemptIndex,
        attempt: copyAttempt(attempt),
      })
    );
  });

  return Object.freeze(records);
}

function diagnosticHistory(
  legacyPairProgressKey: string,
  records: readonly ValidAttemptRecord[]
): Omit<DiagnosticPairHistory, 'reason'> {
  return {
    legacyPairProgressKey,
    attempts: Object.freeze(records.map((record) => record.attempt)),
    totals: totalsFor(records),
  };
}

/**
 * Projects the already-parsed legacy pair-progress state onto stable Contrast
 * identities. This function does not read storage, cap histories, infer
 * identities, repair records, or mutate its input.
 */
export function projectPairProgressToContrasts(
  progress: ParsedPairProgress,
  mapping: HistoricalIdentityMapping = historicalIdentityMapping
): ContrastPairProgressProjection {
  const mappedHistories = new Map<string, MappedHistoryBuilder[]>();
  const mappedRecords: ValidAttemptRecord[] = [];
  const aggregateRecords: ValidAttemptRecord[] = [];
  const unmappedEntries: UnmappedPairProgressEntry[] = [];
  const malformedEntries: MalformedPairProgressEntry[] = [];
  const malformedAttempts: MalformedPairProgressAttempt[] = [];
  let sourceAttemptSlotCount = 0;

  for (const [legacyPairProgressKey, stats] of Object.entries(progress).sort(
    ([left], [right]) => compareText(left, right)
  )) {
    sourceAttemptSlotCount += stats.attempts.length;
    const records = validAttemptRecords(
      legacyPairProgressKey,
      stats.attempts,
      malformedAttempts
    );
    aggregateRecords.push(...records);

    const assignment = mapping.resolvePairProgressKey(
      legacyPairProgressKey
    );
    if (assignment) {
      const key = stableContrastKey(
        assignment.languageId,
        assignment.contrastId
      );
      const histories = mappedHistories.get(key) ?? [];
      histories.push({ assignment, records });
      mappedHistories.set(key, histories);
      mappedRecords.push(...records);
      continue;
    }

    if (
      isStructurallyValidLegacyPairProgressKey(legacyPairProgressKey)
    ) {
      unmappedEntries.push(
        Object.freeze({
          ...diagnosticHistory(legacyPairProgressKey, records),
          reason: 'unmapped-pair-key',
        })
      );
    } else {
      malformedEntries.push(
        Object.freeze({
          ...diagnosticHistory(legacyPairProgressKey, records),
          reason: 'malformed-pair-key',
        })
      );
    }
  }

  const contrasts = [...mappedHistories]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, historyBuilders]) => {
      const pairHistories = historyBuilders
        .sort((left, right) =>
          compareText(
            left.assignment.legacyPairProgressKey,
            right.assignment.legacyPairProgressKey
          )
        )
        .map(({ assignment, records }) =>
          Object.freeze({
            legacyPairProgressKey: assignment.legacyPairProgressKey,
            historicalCategoryLabel:
              assignment.historicalCategoryLabel,
            languageId: assignment.languageId,
            contrastId: assignment.contrastId,
            pairReference: copyPairReference(assignment),
            attempts: Object.freeze(
              records.map((record) => record.attempt)
            ),
            totals: totalsFor(records),
          })
        );
      const contrastRecords = historyBuilders.flatMap(
        (history) => history.records
      );
      const firstAssignment = historyBuilders[0].assignment;

      return Object.freeze({
        languageId: firstAssignment.languageId,
        contrastId: firstAssignment.contrastId,
        pairHistories: Object.freeze(pairHistories),
        totals: totalsFor(contrastRecords),
      });
    });

  const malformedEntryAttemptCount = malformedEntries.reduce(
    (sum, entry) => sum + entry.totals.attemptCount,
    0
  );
  const unmappedAttemptCount = unmappedEntries.reduce(
    (sum, entry) => sum + entry.totals.attemptCount,
    0
  );
  const mappedEntryCount = [...mappedHistories.values()].reduce(
    (sum, histories) => sum + histories.length,
    0
  );

  return Object.freeze({
    contrasts: Object.freeze(contrasts),
    unmappedEntries: Object.freeze(unmappedEntries),
    malformedEntries: Object.freeze(malformedEntries),
    malformedAttempts: Object.freeze(malformedAttempts),
    mappedTotals: totalsFor(mappedRecords),
    aggregateTotals: totalsFor(aggregateRecords),
    diagnostics: Object.freeze({
      sourceEntryCount: Object.keys(progress).length,
      mappedEntryCount,
      unmappedEntryCount: unmappedEntries.length,
      malformedEntryCount: malformedEntries.length,
      sourceAttemptSlotCount,
      effectiveAttemptCount: aggregateRecords.length,
      mappedAttemptCount: mappedRecords.length,
      unmappedAttemptCount,
      malformedEntryAttemptCount,
      malformedAttemptCount: malformedAttempts.length,
    }),
  });
}
