import type {
  ContrastKnowledgeStanding,
  EvidenceCompleteness,
} from '@/src/domain/contrast/contrastKnowledge';
import {
  inspectContrastKnowledge,
  type ContrastKnowledgeInspection,
} from '@/src/domain/contrast/contrastKnowledgeInspection';
import { contrastRegistry } from '@/src/domain/contrast/contrastRegistry';
import type { ContrastPairProgressProjection } from '@/src/domain/contrast/pairProgressProjection';
import { historicalIdentityMapping } from '@/src/domain/compatibility/historicalIdentityMapping';
import type { ContrastId, LanguageId } from '@/src/domain/identity';

/**
 * Developer inspection policy only. This is not a ContrastKnowledge default
 * and not a learner, product, or adaptive threshold.
 */
export const CONTRAST_KNOWLEDGE_INSPECTION_MINIMUM = 5;

export interface ContrastKnowledgeInspectionReportRecency {
  readonly elapsedMilliseconds: number;
  readonly displayText: string;
}

interface ContrastKnowledgeInspectionReportEntryBase {
  readonly contrastId: ContrastId;
  readonly label: string;
}

interface ContrastKnowledgeInspectionReportEntryWithoutObservations
  extends ContrastKnowledgeInspectionReportEntryBase {
  readonly standing: 'indeterminate' | 'unobserved';
}

interface ContrastKnowledgeInspectionReportEntryWithObservations
  extends ContrastKnowledgeInspectionReportEntryBase {
  readonly standing: 'insufficient' | 'observed';
  readonly attributedRetainedAttemptCount: number;
  readonly correctCount: number;
  readonly recency: ContrastKnowledgeInspectionReportRecency;
}

export type ContrastKnowledgeInspectionReportEntry =
  | ContrastKnowledgeInspectionReportEntryWithoutObservations
  | ContrastKnowledgeInspectionReportEntryWithObservations;

export interface ContrastKnowledgeInspectionReportDiagnostics {
  readonly completeness: EvidenceCompleteness;
  readonly unmappedEntryCount: number;
  readonly malformedEntryCount: number;
  readonly malformedAttemptCount: number;
}

export interface UnavailableContrastKnowledgeInspectionReport {
  readonly status: 'unavailable';
  readonly categoryLabel: string;
  readonly reason: 'unresolved-category-label';
}

export interface AvailableContrastKnowledgeInspectionReport {
  readonly status: 'available';
  readonly categoryLabel: string;
  readonly languageId: LanguageId;
  readonly evidenceScope: 'GLOBAL';
  readonly developerInspectionMinimum: number;
  readonly globalAttributedRetainedAttemptCount: number;
  readonly diagnostics: ContrastKnowledgeInspectionReportDiagnostics;
  readonly standingCensus: Readonly<
    Record<ContrastKnowledgeStanding, number>
  >;
  readonly entries: readonly ContrastKnowledgeInspectionReportEntry[];
}

export type ContrastKnowledgeInspectionReport =
  | UnavailableContrastKnowledgeInspectionReport
  | AvailableContrastKnowledgeInspectionReport;

export interface BuildContrastKnowledgeInspectionReportInput {
  readonly projection: ContrastPairProgressProjection;
  readonly categoryLabel: string;
  readonly evaluationTimestamp: number;
  readonly minimumAttributedAttemptCount: number;
}

function formatElapsedMilliseconds(elapsedMilliseconds: number): string {
  const sign = elapsedMilliseconds < 0 ? '-' : '';
  const absolute = Math.abs(elapsedMilliseconds);
  const format = (value: number) =>
    Number.isInteger(value)
      ? String(value)
      : value.toFixed(1).replace(/\.0$/, '');
  const quantity = (
    value: number,
    singular: string,
    plural: string
  ) => {
    const displayValue = format(value);
    return `${sign}${displayValue} ${
      displayValue === '1' ? singular : plural
    }`;
  };

  if (absolute < 1_000) {
    return quantity(absolute, 'millisecond', 'milliseconds');
  }
  if (absolute < 60_000) {
    return quantity(absolute / 1_000, 'second', 'seconds');
  }
  if (absolute < 3_600_000) {
    return quantity(absolute / 60_000, 'minute', 'minutes');
  }
  if (absolute < 86_400_000) {
    return quantity(absolute / 3_600_000, 'hour', 'hours');
  }
  return quantity(absolute / 86_400_000, 'day', 'days');
}

function reportEntry(
  entry: ContrastKnowledgeInspection['entries'][number]
): ContrastKnowledgeInspectionReportEntry {
  const contrast = contrastRegistry.getById(entry.contrastId)!;
  const base = {
    contrastId: entry.contrastId,
    label: `/${contrast.phoneme1}/ vs /${contrast.phoneme2}/`,
  };

  if (
    entry.knowledge.standing === 'indeterminate' ||
    entry.knowledge.standing === 'unobserved'
  ) {
    return Object.freeze({
      ...base,
      standing: entry.knowledge.standing,
    });
  }

  return Object.freeze({
    ...base,
    standing: entry.knowledge.standing,
    attributedRetainedAttemptCount:
      entry.knowledge.attributedAttemptCount,
    correctCount: entry.knowledge.correctCount,
    recency: Object.freeze({
      elapsedMilliseconds:
        entry.knowledge.recency.elapsedMilliseconds,
      displayText: formatElapsedMilliseconds(
        entry.knowledge.recency.elapsedMilliseconds
      ),
    }),
  });
}

function standingCensus(
  entries: readonly ContrastKnowledgeInspectionReportEntry[]
): Readonly<Record<ContrastKnowledgeStanding, number>> {
  const census: Record<ContrastKnowledgeStanding, number> = {
    indeterminate: 0,
    unobserved: 0,
    insufficient: 0,
    observed: 0,
  };

  for (const entry of entries) {
    census[entry.standing] += 1;
  }

  return Object.freeze(census);
}

export function buildContrastKnowledgeInspectionReport({
  projection,
  categoryLabel,
  evaluationTimestamp,
  minimumAttributedAttemptCount,
}: BuildContrastKnowledgeInspectionReportInput): ContrastKnowledgeInspectionReport {
  const languageId =
    historicalIdentityMapping.resolveCategoryLabel(categoryLabel);

  if (!languageId) {
    return Object.freeze({
      status: 'unavailable',
      categoryLabel,
      reason: 'unresolved-category-label',
    });
  }

  const inspection = inspectContrastKnowledge({
    projection,
    contrastRegistry,
    languageId,
    evaluationTimestamp,
    minimumAttributedAttemptCount,
  });
  const entries = Object.freeze(inspection.entries.map(reportEntry));

  return Object.freeze({
    status: 'available',
    categoryLabel,
    languageId,
    evidenceScope: 'GLOBAL',
    developerInspectionMinimum: minimumAttributedAttemptCount,
    globalAttributedRetainedAttemptCount:
      projection.mappedTotals.attemptCount,
    diagnostics: inspection.diagnostics,
    standingCensus: standingCensus(entries),
    entries,
  });
}
