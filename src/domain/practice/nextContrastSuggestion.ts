import { inspectContrastKnowledge } from '@/src/domain/contrast/contrastKnowledgeInspection';
import { contrastRegistry } from '@/src/domain/contrast/contrastRegistry';
import type { ContrastPairProgressProjection } from '@/src/domain/contrast/pairProgressProjection';
import type { ContrastId, LanguageId } from '@/src/domain/identity';

/**
 * Product policy for the first learner-facing ContrastKnowledge consumer.
 * 0 = unobserved, 1–5 = insufficient, 6+ = observed.
 * Observational coverage only; intentionally independent from developer policy.
 */
export const PRODUCT_SUFFICIENCY_MINIMUM_ATTRIBUTED_ATTEMPTS = 6;

export type ContrastPracticeSuggestion =
  | {
      readonly kind: 'continue-current';
      readonly contrastId: ContrastId;
    }
  | {
      readonly kind: 'try-unobserved';
      readonly contrastId: ContrastId;
    }
  | null;

export interface NextContrastSuggestionInput {
  readonly projection: ContrastPairProgressProjection;
  readonly languageId: LanguageId;
  readonly currentContrastId: ContrastId | undefined;
  readonly evaluationTimestamp: number;
  readonly minimumAttributedAttemptCount: number;
}

export function getNextContrastSuggestion({
  projection,
  languageId,
  currentContrastId,
  evaluationTimestamp,
  minimumAttributedAttemptCount,
}: NextContrastSuggestionInput): ContrastPracticeSuggestion {
  const inspection = inspectContrastKnowledge({
    projection,
    contrastRegistry,
    languageId,
    evaluationTimestamp,
    minimumAttributedAttemptCount,
  });

  if (
    inspection.entries.some(
      (entry) => entry.knowledge.standing === 'indeterminate'
    )
  ) {
    return null;
  }

  if (!currentContrastId) return null;

  const currentDefinition = contrastRegistry.getById(currentContrastId);
  if (
    !currentDefinition ||
    currentDefinition.languageId !== languageId
  ) {
    return null;
  }

  const current = inspection.entries.find(
    (entry) => entry.contrastId === currentContrastId
  );
  if (!current) return null;

  if (current.knowledge.standing === 'insufficient') {
    return Object.freeze({
      kind: 'continue-current',
      contrastId: currentContrastId,
    });
  }

  const candidate = inspection.entries.find(
    (entry) =>
      entry.contrastId !== currentContrastId &&
      entry.knowledge.standing === 'unobserved'
  );

  return candidate
    ? Object.freeze({
        kind: 'try-unobserved',
        contrastId: candidate.contrastId,
      })
    : null;
}
