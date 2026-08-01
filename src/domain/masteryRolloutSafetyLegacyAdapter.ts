import {
  SAFETY_EVIDENCE_FIELD_CATALOG,
  evaluateMasteryRolloutSafety,
} from '@/src/domain/masteryRolloutSafety';
import type {
  EvidenceObservation,
  EvidenceSnapshot,
  OpenReliabilityConditionEvidence,
  SafetyEvidenceFieldName,
} from '@/src/domain/masteryRolloutSafety';

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

const RUNTIME_PRODUCED_FIELDS = Object.freeze(
  SAFETY_EVIDENCE_FIELD_CATALOG.filter(
    (field) =>
      field !== 'crossLanguageCollisions' &&
      field !== 'duplicatedMasteryRecords' &&
      field !== 'lostMasteryRecords' &&
      field !== 'practiceBehaviorChanges'
  )
);

const LEGACY_COVERAGE_FIELDS = new Set<SafetyEvidenceFieldName>([
  'coldStartsObserved',
  'languagesExercised',
  'renamedLanguagesExercised',
  'shadowComparisons',
]);

function legacyObservation(
  field: SafetyEvidenceFieldName,
  value: number
): EvidenceObservation {
  switch (field) {
    case 'lostMasteryRecords':
    case 'duplicatedMasteryRecords':
    case 'crossLanguageCollisions':
      return {
        kind: 'observed',
        value,
        provenance: 'harness-attested',
        source: 'legacy-safety-adapter',
        witnessed: true,
      };
    case 'practiceBehaviorChanges':
      return {
        kind: 'observed',
        value,
        provenance: 'manually-attested',
        source: 'legacy-safety-adapter',
        witnessed: true,
      };
    default:
      return {
        kind: 'observed',
        value,
        provenance: 'runtime-measured',
        source: 'legacy-safety-adapter',
        witnessed: true,
      };
  }
}

function createLegacyCompatibilitySnapshot(
  evidence: MasteryRolloutSafetyEvidence
): EvidenceSnapshot {
  const fields: Partial<
    Record<SafetyEvidenceFieldName, readonly EvidenceObservation[]>
  > = {};
  for (const field of SAFETY_EVIDENCE_FIELD_CATALOG) {
    let value = 0;
    if (field in evidence) {
      value = evidence[field as keyof MasteryRolloutSafetyEvidence];
    } else if (LEGACY_COVERAGE_FIELDS.has(field)) {
      value = 1;
    }
    fields[field] = [legacyObservation(field, value)];
  }

  const openConditions: OpenReliabilityConditionEvidence[] = [];
  if (evidence.unhandledStableStorageFailures > 0) {
    openConditions.push({
      kind: 'storage-failure',
      languageId: 'legacy-adapter',
      operation: 'read-stable',
      openedAtSequence: 0,
    });
  }
  if (evidence.unhandledLegacyStorageFailures > 0) {
    openConditions.push({
      kind: 'storage-failure',
      languageId: 'legacy-adapter',
      operation: 'read-legacy',
      openedAtSequence: 0,
    });
  }
  if (evidence.unhandledPartialWrites > 0) {
    openConditions.push({
      kind: 'partial-write',
      languageId: 'legacy-adapter',
      openedAtSequence: 0,
    });
  }

  return {
    windowId: 'legacy-adapter',
    transition: { from: 'shadow', to: 'internal-test' },
    generatedFrom: 'operator-report',
    producerManifest: {
      manifestVersion: 1,
      producedFields: RUNTIME_PRODUCED_FIELDS,
    },
    fields,
    thresholds: {
      coldStartsObserved: 0,
      languagesExercised: 0,
      renamedLanguagesExercised: 0,
      shadowComparisons: 1,
    },
    rolloutStateObservations: {
      disabled: 0,
      shadow: 1,
      'internal-test': 0,
      limited: 0,
      enabled: 0,
    },
    openConditions,
    completeness: {
      snapshotIntegrity: 'intact',
      diagnosticDeliveryFailures: 0,
      diagnosticEventsDropped: 0,
      openConditionOverflow: 0,
    },
  };
}

/**
 * @deprecated Use evaluateMasteryRolloutSafety. This lossy adapter cannot
 * represent insufficient evidence and exists only for the pre-Phase-3.8B API.
 */
export function evaluateMasteryRolloutSafetyGate(
  evidence: MasteryRolloutSafetyEvidence
): MasteryRolloutSafetyGateResult {
  const assessment = evaluateMasteryRolloutSafety(
    createLegacyCompatibilitySnapshot(evidence)
  );
  const blockedFields = new Set<keyof MasteryRolloutSafetyEvidence>();
  for (const finding of assessment.blockers) {
    if (finding.field && finding.field in evidence) {
      blockedFields.add(finding.field as keyof MasteryRolloutSafetyEvidence);
    }
  }
  for (const field of assessment.unmetVolumeGates) {
    if (field in evidence) {
      blockedFields.add(field as keyof MasteryRolloutSafetyEvidence);
    }
  }

  const blockers = (
    Object.keys(evidence) as (keyof MasteryRolloutSafetyEvidence)[]
  ).filter((field) => blockedFields.has(field));

  return Object.freeze({
    passed: assessment.recommendation === 'ready',
    blockers: Object.freeze(blockers),
  });
}
