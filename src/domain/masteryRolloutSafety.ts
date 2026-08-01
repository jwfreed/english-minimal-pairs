export const SAFETY_EVIDENCE_FIELD_CATALOG = Object.freeze([
  'aliasRegressions',
  'blockedComparisons',
  'blockedMigrations',
  'coldStartsObserved',
  'crossLanguageCollisions',
  'diagnosticDeliveryFailures',
  'diagnosticEventsDropped',
  'duplicatedMasteryRecords',
  'languagesExercised',
  'legacyFallbackRatio',
  'legacyRecordAbsences',
  'lostMasteryRecords',
  'malformedStableFallbacks',
  'migrationFailures',
  'migrationOutcomesUnexpected',
  'orphanAdoptionFailures',
  'orphanAdoptionResidue',
  'placementFailures',
  'practiceBehaviorChanges',
  'renamedLanguagesExercised',
  'resetFailures',
  'shadowComparisons',
  'snapshotIntegrity',
  'stableRecordAbsences',
  'storageFailureRate',
  'unexpectedMasteryDecreases',
  'unexpectedMasteryIncreases',
  'unexplainedDivergences',
  'unhandledLegacyStorageFailures',
  'unhandledMigrationStateFailures',
  'unhandledPartialWrites',
  'unhandledStableStorageFailures',
  'unresolvedContrastMappings',
] as const);

export type SafetyEvidenceFieldName =
  (typeof SAFETY_EVIDENCE_FIELD_CATALOG)[number];

export type EvidenceProvenance =
  | 'runtime-measured'
  | 'harness-attested'
  | 'manually-attested'
  | 'unknown';

export type EvidenceUnknownReason =
  | 'no-producer'
  | 'producer-not-exercised'
  | 'snapshot-unavailable'
  | 'attestation-missing'
  | 'attestation-stale'
  | 'manifest-missing'
  | 'provenance-ineligible'
  | 'diagnostic-loss'
  | 'evidence-truncated'
  | 'rollout-attribution-missing'
  | 'rollout-attribution-mismatch'
  | 'rollout-regime-mixed';

export type EvidenceObservation =
  | {
      readonly kind: 'observed';
      readonly value: number;
      readonly provenance: Exclude<EvidenceProvenance, 'unknown'>;
      readonly source: string;
      readonly witnessed: boolean;
    }
  | {
      readonly kind: 'unknown';
      readonly provenance: 'unknown';
      readonly reason: EvidenceUnknownReason;
    };

export const MASTERY_ROLLOUT_STATES = Object.freeze([
  'disabled',
  'shadow',
  'internal-test',
  'limited',
  'enabled',
] as const);

export type RolloutState = (typeof MASTERY_ROLLOUT_STATES)[number];

export interface MasteryRolloutTransition {
  readonly from: RolloutState;
  readonly to: RolloutState;
}

export type ReliabilityConditionKind =
  | 'partial-write'
  | 'storage-failure'
  | 'migration-failure'
  | 'orphan-adoption-residue';

export type ReliabilityStorageOperation =
  | 'read-stable'
  | 'write-stable'
  | 'read-migration-state'
  | 'write-migration-state'
  | 'read-legacy'
  | 'read-legacy-fallback'
  | 'write-legacy';

export interface OpenReliabilityConditionEvidence {
  readonly kind: ReliabilityConditionKind;
  readonly languageId: string;
  readonly operation?: ReliabilityStorageOperation;
  readonly openedAtSequence: number;
}

export interface EvidenceCompleteness {
  readonly snapshotIntegrity: 'intact' | 'degraded' | 'unavailable';
  readonly diagnosticDeliveryFailures: number;
  readonly diagnosticEventsDropped: number;
  readonly openConditionOverflow: number;
}

export type CoverageEvidenceFieldName =
  | 'coldStartsObserved'
  | 'languagesExercised'
  | 'renamedLanguagesExercised'
  | 'shadowComparisons';

export interface ReliabilityCounterContext {
  readonly opened: Readonly<Record<ReliabilityConditionKind, number>>;
  readonly recovered: Readonly<Record<ReliabilityConditionKind, number>>;
}

export interface EvidenceSnapshot {
  /** Operator-declared identity for exactly one independently evaluated window. */
  readonly windowId: string;
  readonly transition: MasteryRolloutTransition;
  readonly generatedFrom: 'on-device' | 'operator-report';
  readonly producerManifest?: Readonly<{
    readonly manifestVersion: number;
    /** Capability only; presence does not prove that a producer ran. */
    readonly producedFields: readonly SafetyEvidenceFieldName[];
  }>;
  readonly fields: Readonly<
    Partial<Record<SafetyEvidenceFieldName, readonly EvidenceObservation[]>>
  >;
  readonly thresholds: Readonly<
    Partial<Record<CoverageEvidenceFieldName, number>>
  >;
  readonly rolloutStateObservations?: Readonly<Record<RolloutState, number>>;
  readonly openConditions: readonly OpenReliabilityConditionEvidence[];
  readonly completeness: EvidenceCompleteness;
  /** Reported context only. The evaluator never derives unresolved state from it. */
  readonly reliabilityContext?: ReliabilityCounterContext;
}

export type SafetyRecommendation =
  | 'ready'
  | 'blocked'
  | 'insufficient-evidence';

export type SafetyBlockerCode =
  | 'non-adjacent-transition'
  | 'invalid-runtime-evidence'
  | 'evidence-conflict'
  | 'integrity-violation'
  | 'unresolved-reliability-condition';

export interface SafetyFinding {
  readonly code: SafetyBlockerCode;
  readonly field?: SafetyEvidenceFieldName;
  readonly detail: string;
}

export interface EvidenceGap {
  readonly field: SafetyEvidenceFieldName;
  readonly reason: EvidenceUnknownReason;
}

export type EvaluatedFieldStatus =
  | 'satisfied'
  | 'blocked'
  | 'unknown'
  | 'unmet-threshold'
  | 'interpretive';

export interface EvaluatedEvidenceField {
  readonly field: SafetyEvidenceFieldName;
  readonly status: EvaluatedFieldStatus;
  readonly observations: readonly EvidenceObservation[];
  readonly evaluatedValue: number | null;
  readonly threshold: number | null;
}

export interface EvidenceCoverage {
  readonly fieldsTotal: number;
  readonly fieldsMeasured: number;
  readonly fieldsUnknown: number;
  readonly volumeGatesMet: readonly CoverageEvidenceFieldName[];
  readonly volumeGatesUnmet: readonly CoverageEvidenceFieldName[];
  readonly snapshotIntegrity: EvidenceCompleteness['snapshotIntegrity'];
  readonly diagnosticDeliveryFailures: number;
  readonly diagnosticEventsDropped: number;
}

export type EvidenceTruncationSource =
  | 'snapshot-degraded'
  | 'snapshot-unavailable'
  | 'diagnostic-delivery-failures'
  | 'diagnostic-events-dropped'
  | 'open-condition-overflow';

export interface SafetyAssessment {
  readonly windowId: string;
  readonly transition: MasteryRolloutTransition;
  readonly recommendation: SafetyRecommendation;
  readonly blockers: readonly SafetyFinding[];
  readonly gaps: readonly EvidenceGap[];
  readonly unmetVolumeGates: readonly CoverageEvidenceFieldName[];
  readonly fields: readonly EvaluatedEvidenceField[];
  readonly coverage: EvidenceCoverage;
  readonly thresholds: Readonly<
    Partial<Record<CoverageEvidenceFieldName, number>>
  >;
  readonly observedRolloutStates: readonly RolloutState[];
  readonly truncationSources: readonly EvidenceTruncationSource[];
  readonly manifestVersion: number | null;
  readonly reliabilityContext: ReliabilityCounterContext | null;
  readonly evidenceDigest: string;
  readonly generatedFrom: EvidenceSnapshot['generatedFrom'];
}

type EvidenceCategory =
  | 'integrity'
  | 'reliability'
  | 'coverage'
  | 'interpretive'
  | 'confidence';

const COVERAGE_FIELD_CATALOG = Object.freeze([
  'coldStartsObserved',
  'languagesExercised',
  'renamedLanguagesExercised',
  'shadowComparisons',
] as const satisfies readonly CoverageEvidenceFieldName[]);

function categoryFor(field: SafetyEvidenceFieldName): EvidenceCategory {
  switch (field) {
    case 'migrationFailures':
    case 'orphanAdoptionResidue':
    case 'unhandledLegacyStorageFailures':
    case 'unhandledMigrationStateFailures':
    case 'unhandledPartialWrites':
    case 'unhandledStableStorageFailures':
      return 'reliability';
    case 'coldStartsObserved':
    case 'languagesExercised':
    case 'renamedLanguagesExercised':
    case 'shadowComparisons':
      return 'coverage';
    case 'legacyFallbackRatio':
    case 'storageFailureRate':
      return 'interpretive';
    case 'diagnosticDeliveryFailures':
    case 'diagnosticEventsDropped':
    case 'snapshotIntegrity':
      return 'confidence';
    default:
      return 'integrity';
  }
}

function acceptsProvenance(
  field: SafetyEvidenceFieldName,
  provenance: Exclude<EvidenceProvenance, 'unknown'>
): boolean {
  switch (field) {
    case 'lostMasteryRecords':
      return provenance === 'harness-attested' || provenance === 'manually-attested';
    case 'duplicatedMasteryRecords':
    case 'crossLanguageCollisions':
      return provenance === 'harness-attested';
    case 'practiceBehaviorChanges':
      return provenance === 'manually-attested';
    case 'aliasRegressions':
      return provenance === 'runtime-measured' || provenance === 'harness-attested';
    case 'placementFailures':
    case 'resetFailures':
      return provenance === 'runtime-measured' || provenance === 'manually-attested';
    default:
      return provenance === 'runtime-measured';
  }
}

function conditionMatchesField(
  field: SafetyEvidenceFieldName,
  condition: OpenReliabilityConditionEvidence
): boolean {
  switch (field) {
    case 'migrationFailures':
      return condition.kind === 'migration-failure';
    case 'orphanAdoptionResidue':
      return condition.kind === 'orphan-adoption-residue';
    case 'unhandledPartialWrites':
      return condition.kind === 'partial-write';
    case 'unhandledStableStorageFailures':
      return (
        condition.kind === 'storage-failure' &&
        (condition.operation === 'read-stable' ||
          condition.operation === 'write-stable')
      );
    case 'unhandledLegacyStorageFailures':
      return (
        condition.kind === 'storage-failure' &&
        (condition.operation === 'read-legacy' ||
          condition.operation === 'read-legacy-fallback' ||
          condition.operation === 'write-legacy')
      );
    case 'unhandledMigrationStateFailures':
      return (
        condition.kind === 'storage-failure' &&
        (condition.operation === 'read-migration-state' ||
          condition.operation === 'write-migration-state')
      );
    default:
      return false;
  }
}

function isAdjacentTransition(transition: MasteryRolloutTransition): boolean {
  const fromIndex = MASTERY_ROLLOUT_STATES.indexOf(transition.from);
  return fromIndex >= 0 && MASTERY_ROLLOUT_STATES[fromIndex + 1] === transition.to;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== 'object') return value;

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(value as Record<string, unknown>).sort()) {
    const nested = (value as Record<string, unknown>)[key];
    if (nested !== undefined) sorted[key] = canonicalize(nested);
  }
  return sorted;
}

function evidenceDigest(snapshot: EvidenceSnapshot): string {
  const serialized = JSON.stringify(canonicalize(snapshot));
  let hash = 0x811c9dc5;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a32:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function deepFreeze<Value>(value: Value): Value {
  if (value === null || typeof value !== 'object' || Object.isFrozen(value)) {
    return value;
  }
  for (const nested of Object.values(value as Record<string, unknown>)) {
    deepFreeze(nested);
  }
  return Object.freeze(value);
}

function cloneObservation(observation: EvidenceObservation): EvidenceObservation {
  return observation.kind === 'unknown'
    ? {
        kind: 'unknown',
        provenance: 'unknown',
        reason: observation.reason,
      }
    : {
        kind: 'observed',
        value: observation.value,
        provenance: observation.provenance,
        source: observation.source,
        witnessed: observation.witnessed,
      };
}

function defaultGapReason(
  field: SafetyEvidenceFieldName,
  produced: boolean
): EvidenceUnknownReason {
  if (produced) return 'producer-not-exercised';
  return acceptsProvenance(field, 'harness-attested') ||
    acceptsProvenance(field, 'manually-attested')
    ? 'attestation-missing'
    : 'no-producer';
}

function cloneReliabilityContext(
  context: ReliabilityCounterContext | undefined
): ReliabilityCounterContext | null {
  return context
    ? {
        opened: {
          'partial-write': context.opened['partial-write'],
          'storage-failure': context.opened['storage-failure'],
          'migration-failure': context.opened['migration-failure'],
          'orphan-adoption-residue': context.opened['orphan-adoption-residue'],
        },
        recovered: {
          'partial-write': context.recovered['partial-write'],
          'storage-failure': context.recovered['storage-failure'],
          'migration-failure': context.recovered['migration-failure'],
          'orphan-adoption-residue': context.recovered['orphan-adoption-residue'],
        },
      }
    : null;
}

/**
 * Pure Phase 3.8B evidence interpretation for one independent window.
 * The assessment is advisory data; it cannot express or perform rollout.
 */
export function evaluateMasteryRolloutSafety(
  snapshot: EvidenceSnapshot
): SafetyAssessment {
  const blockers: SafetyFinding[] = [];
  const gaps: EvidenceGap[] = [];
  const gapKeys = new Set<string>();
  const evaluatedFields: EvaluatedEvidenceField[] = [];
  const unmetVolumeGates: CoverageEvidenceFieldName[] = [];
  const volumeGatesMet: CoverageEvidenceFieldName[] = [];

  const addGap = (
    field: SafetyEvidenceFieldName,
    reason: EvidenceUnknownReason
  ): void => {
    const key = `${field}:${reason}`;
    if (gapKeys.has(key)) return;
    gapKeys.add(key);
    gaps.push({ field, reason });
  };

  if (!isAdjacentTransition(snapshot.transition)) {
    blockers.push({
      code: 'non-adjacent-transition',
      detail: `${snapshot.transition.from}->${snapshot.transition.to}`,
    });
  }

  const observedRolloutStates = MASTERY_ROLLOUT_STATES.filter(
    (state) => (snapshot.rolloutStateObservations?.[state] ?? 0) > 0
  );
  const attributionMissing = snapshot.rolloutStateObservations === undefined;
  const sourceRegimeObserved =
    (snapshot.rolloutStateObservations?.[snapshot.transition.from] ?? 0) > 0;
  const regimeMixed = observedRolloutStates.length > 1;
  const diagnosticLoss =
    snapshot.completeness.diagnosticDeliveryFailures > 0 ||
    snapshot.completeness.diagnosticEventsDropped > 0;
  const manifestFields = new Set(
    snapshot.producerManifest?.producedFields ?? []
  );

  for (const field of SAFETY_EVIDENCE_FIELD_CATALOG) {
    const category = categoryFor(field);
    const observations = (snapshot.fields[field] ?? []).map(cloneObservation);
    const produced = manifestFields.has(field);
    const eligible: Extract<EvidenceObservation, { kind: 'observed' }>[] = [];
    let invalidRuntimeEvidence = false;

    if (observations.length === 0) {
      addGap(field, defaultGapReason(field, produced));
    }

    for (const observation of observations) {
      if (observation.kind === 'unknown') {
        addGap(field, observation.reason);
        continue;
      }
      if (observation.provenance === 'runtime-measured') {
        if (!snapshot.producerManifest) {
          addGap(field, 'manifest-missing');
          continue;
        }
        if (!produced) {
          invalidRuntimeEvidence = true;
          blockers.push({
            code: 'invalid-runtime-evidence',
            field,
            detail: 'runtime provenance is absent from the producer manifest',
          });
          continue;
        }
      }
      if (!acceptsProvenance(field, observation.provenance)) {
        addGap(field, 'provenance-ineligible');
        continue;
      }
      if (!observation.witnessed) {
        addGap(field, 'producer-not-exercised');
        continue;
      }

      if (observation.provenance === 'runtime-measured') {
        if (attributionMissing) {
          addGap(field, 'rollout-attribution-missing');
          continue;
        }
        if (!sourceRegimeObserved) {
          addGap(field, 'rollout-attribution-mismatch');
          continue;
        }
        if (snapshot.completeness.snapshotIntegrity === 'unavailable') {
          addGap(field, 'snapshot-unavailable');
          continue;
        }
        if (snapshot.completeness.openConditionOverflow > 0 && category === 'reliability') {
          addGap(field, 'evidence-truncated');
          continue;
        }
        if (
          regimeMixed &&
          !(category === 'integrity' && observation.value > 0)
        ) {
          addGap(field, 'rollout-regime-mixed');
          continue;
        }
        if (
          diagnosticLoss &&
          !(category === 'integrity' && observation.value > 0)
        ) {
          addGap(field, 'diagnostic-loss');
          continue;
        }
      }

      eligible.push(observation);
    }

    const distinctValues = new Set(eligible.map((item) => item.value));
    if (distinctValues.size > 1) {
      blockers.push({
        code: 'evidence-conflict',
        field,
        detail: 'eligible provenance classes disagree',
      });
    }

    const evaluatedValue =
      eligible.length > 0
        ? Math.max(...eligible.map((observation) => observation.value))
        : null;
    let status: EvaluatedFieldStatus =
      eligible.length > 0 ? 'satisfied' : 'unknown';
    let threshold: number | null = null;

    if (invalidRuntimeEvidence) {
      status = 'blocked';
    } else if (eligible.length > 0) {
      switch (category) {
        case 'integrity':
          if ((evaluatedValue ?? 0) !== 0) {
            blockers.push({
              code: 'integrity-violation',
              field,
              detail: `observed value ${evaluatedValue}`,
            });
            status = 'blocked';
          }
          break;
        case 'reliability': {
          const unresolved = snapshot.openConditions.filter((condition) =>
            conditionMatchesField(field, condition)
          ).length;
          if (unresolved > 0) {
            blockers.push({
              code: 'unresolved-reliability-condition',
              field,
              detail: `${unresolved} condition${unresolved === 1 ? '' : 's'} open`,
            });
            status = 'blocked';
          }
          break;
        }
        case 'coverage': {
          const coverageField = field as CoverageEvidenceFieldName;
          const configured = snapshot.thresholds[coverageField];
          if (
            !Number.isFinite(configured) ||
            configured === undefined ||
            configured < 0 ||
            (evaluatedValue ?? -1) < configured
          ) {
            unmetVolumeGates.push(coverageField);
            status = 'unmet-threshold';
          } else {
            threshold = configured;
            volumeGatesMet.push(coverageField);
          }
          break;
        }
        case 'interpretive':
        case 'confidence':
          status = 'interpretive';
          break;
      }
    }

    if (
      status !== 'blocked' &&
      gaps.some((gap) => gap.field === field)
    ) {
      status = 'unknown';
    }

    evaluatedFields.push({
      field,
      status,
      observations,
      evaluatedValue,
      threshold,
    });
  }

  const truncationSources: EvidenceTruncationSource[] = [];
  if (snapshot.completeness.snapshotIntegrity === 'degraded') {
    truncationSources.push('snapshot-degraded');
  }
  if (snapshot.completeness.snapshotIntegrity === 'unavailable') {
    truncationSources.push('snapshot-unavailable');
  }
  if (snapshot.completeness.diagnosticDeliveryFailures > 0) {
    truncationSources.push('diagnostic-delivery-failures');
  }
  if (snapshot.completeness.diagnosticEventsDropped > 0) {
    truncationSources.push('diagnostic-events-dropped');
  }
  if (snapshot.completeness.openConditionOverflow > 0) {
    truncationSources.push('open-condition-overflow');
  }

  const fieldsUnknown = evaluatedFields.filter(
    (field) => field.status === 'unknown'
  ).length;
  const coverage: EvidenceCoverage = {
    fieldsTotal: SAFETY_EVIDENCE_FIELD_CATALOG.length,
    fieldsMeasured: SAFETY_EVIDENCE_FIELD_CATALOG.length - fieldsUnknown,
    fieldsUnknown,
    volumeGatesMet: [...volumeGatesMet],
    volumeGatesUnmet: [...unmetVolumeGates],
    snapshotIntegrity: snapshot.completeness.snapshotIntegrity,
    diagnosticDeliveryFailures:
      snapshot.completeness.diagnosticDeliveryFailures,
    diagnosticEventsDropped: snapshot.completeness.diagnosticEventsDropped,
  };

  const recommendation: SafetyRecommendation =
    blockers.length > 0
      ? 'blocked'
      : gaps.length > 0 ||
          unmetVolumeGates.length > 0 ||
          snapshot.completeness.snapshotIntegrity !== 'intact' ||
          snapshot.generatedFrom === 'on-device'
        ? 'insufficient-evidence'
        : 'ready';

  const thresholds: Partial<Record<CoverageEvidenceFieldName, number>> = {};
  for (const field of COVERAGE_FIELD_CATALOG) {
    const threshold = snapshot.thresholds[field];
    if (threshold !== undefined) thresholds[field] = threshold;
  }

  return deepFreeze({
    windowId: snapshot.windowId,
    transition: {
      from: snapshot.transition.from,
      to: snapshot.transition.to,
    },
    recommendation,
    blockers: [...blockers],
    gaps: [...gaps],
    unmetVolumeGates: [...unmetVolumeGates],
    fields: evaluatedFields,
    coverage,
    thresholds,
    observedRolloutStates: [...observedRolloutStates],
    truncationSources,
    manifestVersion: snapshot.producerManifest?.manifestVersion ?? null,
    reliabilityContext: cloneReliabilityContext(snapshot.reliabilityContext),
    evidenceDigest: evidenceDigest(snapshot),
    generatedFrom: snapshot.generatedFrom,
  });
}
