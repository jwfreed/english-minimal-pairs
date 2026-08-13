export type ContrastKnowledgeStanding =
  | 'indeterminate'
  | 'unobserved'
  | 'insufficient'
  | 'observed';

export type EvidenceCompleteness = 'attested' | 'unattested';

export interface AttributedContrastAttempt {
  readonly isCorrect: boolean;
  readonly timestamp: number;
}

export interface ContrastRecencyObservation {
  readonly elapsedMilliseconds: number;
}

interface IndeterminateContrastKnowledge {
  readonly standing: 'indeterminate';
}

interface UnobservedContrastKnowledge {
  readonly standing: 'unobserved';
}

interface PositiveContrastKnowledgeObservations {
  readonly attributedAttemptCount: number;
  readonly correctCount: number;
  readonly recency: ContrastRecencyObservation;
}

interface InsufficientContrastKnowledge
  extends PositiveContrastKnowledgeObservations {
  readonly standing: 'insufficient';
}

interface ObservedContrastKnowledge
  extends PositiveContrastKnowledgeObservations {
  readonly standing: 'observed';
}

export type ContrastKnowledge =
  | IndeterminateContrastKnowledge
  | UnobservedContrastKnowledge
  | InsufficientContrastKnowledge
  | ObservedContrastKnowledge;

export interface DeriveContrastKnowledgeInput {
  readonly attributedAttempts: readonly AttributedContrastAttempt[];
  readonly completeness: EvidenceCompleteness;
  readonly evaluationTimestamp: number;
  readonly minimumAttributedAttemptCount: number;
}

export function deriveContrastKnowledge({
  attributedAttempts,
  completeness,
  evaluationTimestamp,
  minimumAttributedAttemptCount,
}: DeriveContrastKnowledgeInput): ContrastKnowledge {
  if (
    !Number.isSafeInteger(minimumAttributedAttemptCount) ||
    minimumAttributedAttemptCount <= 0
  ) {
    throw new Error(
      'ContrastKnowledge minimum attributed attempt count must be a positive safe integer'
    );
  }

  if (!Number.isFinite(evaluationTimestamp)) {
    throw new Error(
      'ContrastKnowledge evaluation timestamp must be a finite number'
    );
  }

  if (completeness === 'unattested') {
    return Object.freeze({ standing: 'indeterminate' });
  }

  if (attributedAttempts.length === 0) {
    return Object.freeze({ standing: 'unobserved' });
  }

  let correctCount = 0;
  let latestAttemptTimestamp = attributedAttempts[0].timestamp;

  for (const attempt of attributedAttempts) {
    if (attempt.isCorrect) correctCount += 1;
    if (attempt.timestamp > latestAttemptTimestamp) {
      latestAttemptTimestamp = attempt.timestamp;
    }
  }

  const observations = {
    attributedAttemptCount: attributedAttempts.length,
    correctCount,
    recency: Object.freeze({
      elapsedMilliseconds: evaluationTimestamp - latestAttemptTimestamp,
    }),
  };

  return Object.freeze({
    standing:
      attributedAttempts.length < minimumAttributedAttemptCount
        ? 'insufficient'
        : 'observed',
    ...observations,
  });
}
