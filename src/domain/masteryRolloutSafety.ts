export interface MasteryRolloutSafetyEvidence {
  readonly shadowComparisons: number;
  readonly unexplainedDivergences: number;
  readonly unresolvedContrastMappings: number;
  readonly lostMasteryRecords: number;
  readonly duplicatedMasteryRecords: number;
  readonly unexpectedMasteryIncreases: number;
  readonly unexpectedMasteryDecreases: number;
  readonly unhandledStableStorageFailures: number;
  readonly unhandledLegacyStorageFailures: number;
  readonly unhandledPartialWrites: number;
  readonly malformedStableFallbacks: number;
  readonly crossLanguageCollisions: number;
  readonly aliasRegressions: number;
  readonly placementFailures: number;
  readonly resetFailures: number;
  readonly practiceBehaviorChanges: number;
}

export interface MasteryRolloutSafetyGateResult {
  readonly passed: boolean;
  readonly blockers: readonly (keyof MasteryRolloutSafetyEvidence)[];
}

/**
 * Pure release gate for advancing to a broader rollout state. Evidence is
 * supplied by the Phase 3 harness, shadow metrics, and failure-path tests; this
 * function performs no scans, migration, repair, or storage writes.
 */
export function evaluateMasteryRolloutSafetyGate(
  evidence: MasteryRolloutSafetyEvidence
): MasteryRolloutSafetyGateResult {
  const blockers: (keyof MasteryRolloutSafetyEvidence)[] = [];
  if (evidence.shadowComparisons < 1) blockers.push('shadowComparisons');

  for (const key of Object.keys(evidence) as (
    keyof MasteryRolloutSafetyEvidence
  )[]) {
    if (key !== 'shadowComparisons' && evidence[key] !== 0) {
      blockers.push(key);
    }
  }

  return Object.freeze({
    passed: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}
