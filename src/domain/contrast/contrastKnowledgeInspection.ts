import {
  deriveContrastKnowledge,
  type ContrastKnowledge,
  type EvidenceCompleteness,
} from '@/src/domain/contrast/contrastKnowledge';
import type { ContrastRegistry } from '@/src/domain/contrast/contrastRegistry';
import type {
  ContrastPairProgress,
  ContrastPairProgressProjection,
} from '@/src/domain/contrast/pairProgressProjection';
import type { ContrastId, LanguageId } from '@/src/domain/identity';

export interface ContrastKnowledgeInspectionDiagnostics {
  readonly completeness: EvidenceCompleteness;
  readonly unmappedEntryCount: number;
  readonly malformedEntryCount: number;
  readonly malformedAttemptCount: number;
}

export interface ContrastKnowledgeInspectionEntry {
  readonly contrastId: ContrastId;
  readonly knowledge: ContrastKnowledge;
}

export interface ContrastKnowledgeInspection {
  readonly languageId: LanguageId;
  readonly entries: readonly ContrastKnowledgeInspectionEntry[];
  readonly diagnostics: ContrastKnowledgeInspectionDiagnostics;
}

export interface InspectContrastKnowledgeInput {
  readonly projection: ContrastPairProgressProjection;
  readonly contrastRegistry: ContrastRegistry;
  readonly languageId: LanguageId;
  readonly evaluationTimestamp: number;
  readonly minimumAttributedAttemptCount: number;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function attributedAttempts(
  progress: ContrastPairProgress | undefined
) {
  return progress?.pairHistories.flatMap((history) => history.attempts) ?? [];
}

export function inspectContrastKnowledge({
  projection,
  contrastRegistry,
  languageId,
  evaluationTimestamp,
  minimumAttributedAttemptCount,
}: InspectContrastKnowledgeInput): ContrastKnowledgeInspection {
  const diagnostics = Object.freeze({
    completeness:
      projection.unmappedEntries.length === 0 &&
      projection.malformedEntries.length === 0 &&
      projection.malformedAttempts.length === 0
        ? ('attested' as const)
        : ('unattested' as const),
    unmappedEntryCount: projection.unmappedEntries.length,
    malformedEntryCount: projection.malformedEntries.length,
    malformedAttemptCount: projection.malformedAttempts.length,
  });
  const progressByContrastId = new Map(
    projection.contrasts
      .filter((progress) => progress.languageId === languageId)
      .map((progress) => [progress.contrastId, progress])
  );
  const entries = contrastRegistry.contrasts
    .filter((contrast) => contrast.languageId === languageId)
    .sort((left, right) => compareText(left.id, right.id))
    .map((contrast) =>
      Object.freeze({
        contrastId: contrast.id,
        knowledge: deriveContrastKnowledge({
          attributedAttempts: attributedAttempts(
            progressByContrastId.get(contrast.id)
          ),
          completeness: diagnostics.completeness,
          evaluationTimestamp,
          minimumAttributedAttemptCount,
        }),
      })
    );

  return Object.freeze({
    languageId,
    entries: Object.freeze(entries),
    diagnostics,
  });
}
