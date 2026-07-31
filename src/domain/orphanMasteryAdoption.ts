import type { HistoricalIdentityMapping } from '@/src/domain/compatibility/historicalIdentityMapping';
import { historicalIdentityMapping } from '@/src/domain/compatibility/historicalIdentityMapping';
import type { ContrastId } from '@/src/domain/identity';
import {
  CONTRAST_MASTERY_MIGRATION_SCHEMA_VERSION,
  candidatesToMasteryEntries,
  fingerprintLegacySources,
  inspectLegacyMastery,
  parseLegacySourceFingerprint,
  reconcileSteadyStateMastery,
  serializeContrastMasteryMigrationState,
  updateLegacySourceObservations,
  type ContrastMasteryDocument,
  type ContrastMasteryMigrationState,
  type ContrastMasteryRecord,
  type LegacyMasteryCandidate,
  type LegacyMasteryDiagnostic,
  type LegacyMasterySource,
  type MasteryTier,
} from '@/src/domain/contrastMasteryPersistence';

export interface OrphanMasteryEvidence extends LegacyMasteryCandidate {
  readonly sourceFingerprint: string;
}

export interface AlreadyRepresentedOrphanEvidence {
  readonly evidence: OrphanMasteryEvidence;
  readonly reason:
    | 'stable-record'
    | 'stable-observation-batch'
    | 'advisory-fingerprint';
}

export interface BlockedOrphanEvidence {
  readonly evidence: OrphanMasteryEvidence;
  readonly reason:
    | 'reset-tombstone'
    | 'stable-placement'
    | 'stable-practice'
    | 'newer-stable-observation'
    | 'missing-fingerprint-baseline'
    | 'unusable-fingerprint-baseline';
}

export interface OrphanAdoptionCounts {
  readonly recognizedLegacyEntries: number;
  readonly alreadyRepresented: number;
  readonly adoptable: number;
  readonly adopted: number;
  readonly adoptedRecords: number;
  readonly blocked: number;
  readonly unresolved: number;
  readonly malformed: number;
}

export interface OrphanObservationBatch {
  readonly batchId: string;
  readonly contrastId: ContrastId;
  readonly revision: number;
  readonly evidence: readonly OrphanMasteryEvidence[];
  readonly tierPolicy:
    | 'single-evidence'
    | 'equivalent-evidence'
    | 'equal-observation-tier-tiebreak';
  readonly selectedTier: MasteryTier;
}

export interface OrphanAdoptionAnalysis {
  readonly observationBatches: readonly OrphanObservationBatch[];
  readonly adoptableCandidates: readonly OrphanMasteryEvidence[];
  readonly alreadyRepresentedEvidence:
    readonly AlreadyRepresentedOrphanEvidence[];
  readonly blockedEvidence: readonly BlockedOrphanEvidence[];
  readonly unresolvedIdentities: readonly LegacyMasteryDiagnostic[];
  readonly malformedEvidence: readonly LegacyMasteryDiagnostic[];
  readonly diagnostics: {
    readonly unresolved: readonly LegacyMasteryDiagnostic[];
    readonly malformed: readonly LegacyMasteryDiagnostic[];
  };
  readonly nextMigrationState: ContrastMasteryMigrationState;
  readonly markerNeedsUpdate: boolean;
  /** The marker may be written only after every proposed stable record persists. */
  readonly markerRequiresStableWrite: boolean;
  readonly counts: OrphanAdoptionCounts;
}

export type OrphanAdoptionDecision =
  | {
      readonly decision: 'adopted';
      readonly evidence: OrphanMasteryEvidence;
    }
  | {
      readonly decision: 'ignored-as-already-represented';
      readonly evidence: OrphanMasteryEvidence;
      readonly reason: AlreadyRepresentedOrphanEvidence['reason'];
    }
  | {
      readonly decision: 'blocked-by-newer-stable-evidence';
      readonly evidence: OrphanMasteryEvidence;
      readonly reason: Exclude<
        BlockedOrphanEvidence['reason'],
        'reset-tombstone'
      >;
    }
  | {
      readonly decision: 'blocked-by-reset-tombstone';
      readonly evidence: OrphanMasteryEvidence;
    }
  | {
      readonly decision: 'unresolved';
      readonly diagnostic: LegacyMasteryDiagnostic;
    }
  | {
      readonly decision: 'malformed';
      readonly diagnostic: LegacyMasteryDiagnostic;
    };

export interface OrphanAdoptionPlan {
  readonly document: ContrastMasteryDocument;
  readonly adoptedRecords: readonly ContrastMasteryRecord[];
  readonly decisions: readonly OrphanAdoptionDecision[];
  readonly counts: OrphanAdoptionCounts;
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function evidenceKey(evidence: LegacyMasteryCandidate): string {
  return JSON.stringify([
    evidence.storageKey,
    evidence.legacyGroup,
    evidence.contrastId,
    evidence.tier,
  ]);
}

function compareEvidence(
  left: OrphanMasteryEvidence,
  right: OrphanMasteryEvidence
): number {
  return (
    compareText(left.storageKey, right.storageKey) ||
    compareText(left.legacyGroup, right.legacyGroup) ||
    compareText(left.contrastId, right.contrastId) ||
    left.tier - right.tier
  );
}

function diagnosticKey(diagnostic: LegacyMasteryDiagnostic): string {
  return JSON.stringify([
    diagnostic.storageKey,
    diagnostic.categoryLabel,
    diagnostic.legacyGroup ?? '',
    diagnostic.reason,
  ]);
}

function decisionKey(decision: OrphanAdoptionDecision): string {
  if ('evidence' in decision) {
    return JSON.stringify([
      decision.evidence.storageKey,
      decision.evidence.contrastId,
      decision.evidence.tier,
      decision.decision,
    ]);
  }
  return `${diagnosticKey(decision.diagnostic)}:${decision.decision}`;
}

function currentEntryByContrast(document: ContrastMasteryDocument) {
  return new Map(
    [...document.records, ...document.tombstones].map((entry) => [
      entry.contrastId,
      entry,
    ])
  );
}

function groupObservationBatches(
  evidence: readonly OrphanMasteryEvidence[]
): readonly OrphanObservationBatch[] {
  const grouped = new Map<string, OrphanMasteryEvidence[]>();
  for (const item of evidence) {
    const batchId = JSON.stringify([item.contrastId, item.revision]);
    const current = grouped.get(batchId) ?? [];
    current.push(item);
    grouped.set(batchId, current);
  }
  return [...grouped]
    .map(([batchId, items]) => {
      const ordered = [...items].sort(compareEvidence);
      const tiers = new Set(ordered.map((item) => item.tier));
      return {
        batchId,
        contrastId: ordered[0].contrastId,
        revision: ordered[0].revision,
        evidence: ordered,
        tierPolicy:
          ordered.length === 1
            ? ('single-evidence' as const)
            : tiers.size === 1
              ? ('equivalent-evidence' as const)
              : ('equal-observation-tier-tiebreak' as const),
        selectedTier: Math.max(
          ...ordered.map((item) => item.tier)
        ) as MasteryTier,
      };
    })
    .sort(
      (left, right) =>
        compareText(left.contrastId, right.contrastId) ||
        left.revision - right.revision
    );
}

function priorEvidenceKeys(
  languageId: ContrastMasteryDocument['languageId'],
  source: LegacyMasterySource,
  revision: number,
  mapping: HistoricalIdentityMapping
): ReadonlySet<string> {
  const inspection = inspectLegacyMastery(
    languageId,
    [source],
    new Map([[source.storageKey, revision]]),
    'legacy-reconciliation',
    mapping
  );
  return new Set(inspection.candidates.map(evidenceKey));
}

function sameContrastIds(
  left: readonly ContrastId[],
  right: readonly ContrastId[]
): boolean {
  return (
    left.length === right.length &&
    left.every((contrastId, index) => contrastId === right[index])
  );
}

function buildRepresentedMigrationState(
  document: ContrastMasteryDocument,
  previousMigrationState: ContrastMasteryMigrationState | undefined,
  sources: readonly LegacyMasterySource[],
  representedEvidence: readonly OrphanMasteryEvidence[]
): ContrastMasteryMigrationState {
  const evidenceBySource = new Map<string, OrphanMasteryEvidence[]>();
  for (const evidence of representedEvidence) {
    const current = evidenceBySource.get(evidence.storageKey) ?? [];
    current.push(evidence);
    evidenceBySource.set(evidence.storageKey, current);
  }
  const previousByKey = new Map(
    previousMigrationState?.sources.map((source) => [
      source.storageKey,
      source,
    ])
  );
  const stableByContrast = new Map(
    document.records.map((record) => [record.contrastId, record])
  );
  const safeSources: LegacyMasterySource[] = [];
  const observations = [...sources]
    .sort((left, right) => compareText(left.storageKey, right.storageKey))
    .map((source) => {
      const evidence = [...(evidenceBySource.get(source.storageKey) ?? [])]
        .sort(compareEvidence);
      const raw =
        evidence.length === 0
          ? null
          : JSON.stringify(
              Object.fromEntries(
                evidence.map((item) => [item.legacyGroup, item.tier])
              )
            );
      const safeSource = { ...source, raw };
      safeSources.push(safeSource);
      const fingerprint = fingerprintLegacySources([safeSource]);
      const contrastIds = [
        ...new Set(evidence.map((item) => item.contrastId)),
      ].sort(compareText);
      const prior = previousByKey.get(source.storageKey);
      const unchanged =
        prior?.fingerprint === fingerprint &&
        sameContrastIds(prior.contrastIds, contrastIds);
      const representedRevisions = evidence.map((item) => {
        const stable = stableByContrast.get(item.contrastId);
        const stableIsPersistedAdoption =
          prior &&
          stable?.tier === item.tier &&
          (stable.provenance === 'initial-migration' ||
            stable.provenance === 'legacy-reconciliation') &&
          stable.revision > prior.revision;
        return stableIsPersistedAdoption ? stable.revision : item.revision;
      });
      return {
        storageKey: source.storageKey,
        fingerprint,
        revision: unchanged
          ? prior.revision
          : Math.max(0, ...representedRevisions),
        contrastIds,
      };
    });
  return {
    schemaVersion: CONTRAST_MASTERY_MIGRATION_SCHEMA_VERSION,
    languageId: document.languageId,
    sourceFingerprint: fingerprintLegacySources(safeSources),
    lastRevision: Math.max(
      document.lastRevision,
      previousMigrationState?.lastRevision ?? 0,
      ...observations.map((source) => source.revision)
    ),
    sources: observations,
  };
}

function observeOrphanEvidence(
  document: ContrastMasteryDocument,
  previousMigrationState: ContrastMasteryMigrationState | undefined,
  sources: readonly LegacyMasterySource[],
  mapping: HistoricalIdentityMapping
) {
  const observation = updateLegacySourceObservations(
    document.languageId,
    sources,
    previousMigrationState,
    document.lastRevision,
    mapping
  );
  if (!previousMigrationState) return observation;

  const previousByKey = new Map(
    previousMigrationState.sources.map((source) => [
      source.storageKey,
      source,
    ])
  );
  const changedKeys = new Set(
    observation.state.sources
      .filter(
        (source) =>
          previousByKey.get(source.storageKey)?.fingerprint !==
          source.fingerprint
      )
      .map((source) => source.storageKey)
  );
  if (changedKeys.size < 2) return observation;

  // All source changes found by this explicit scan are one migration
  // observation. Storage-key ordering must not invent causal order.
  const revision =
    Math.max(document.lastRevision, previousMigrationState.lastRevision) + 1;
  return {
    ...observation,
    state: {
      ...observation.state,
      lastRevision: revision,
      sources: observation.state.sources.map((source) =>
        changedKeys.has(source.storageKey)
          ? { ...source, revision }
          : source
      ),
    },
    inspection: {
      ...observation.inspection,
      candidates: observation.inspection.candidates.map((candidate) =>
        changedKeys.has(candidate.storageKey)
          ? { ...candidate, revision }
          : candidate
      ),
    },
  };
}

/**
 * An orphan candidate is exact, recognized legacy mastery evidence that is
 * absent from both the stable record and the advisory fingerprint baseline.
 *
 * The analysis is pure. Fingerprints establish migration observation changes,
 * never wall-clock or learner-action causality.
 */
export function analyzeOrphanedMastery(
  document: ContrastMasteryDocument,
  previousMigrationState: ContrastMasteryMigrationState | undefined,
  sources: readonly LegacyMasterySource[],
  mapping: HistoricalIdentityMapping = historicalIdentityMapping
): OrphanAdoptionAnalysis {
  const observation = observeOrphanEvidence(
    document,
    previousMigrationState,
    sources,
    mapping
  );
  const currentSources = new Map(
    sources.map((source) => [source.storageKey, source])
  );
  const evidence = observation.inspection.candidates.map((candidate) => {
    const currentSource = currentSources.get(candidate.storageKey);
    if (!currentSource) {
      throw new Error(`Missing inspected legacy source "${candidate.storageKey}"`);
    }
    return {
      ...candidate,
      sourceFingerprint: fingerprintLegacySources([currentSource]),
    };
  });
  const observationBatches = groupObservationBatches(evidence);
  const priorSources = new Map(
    previousMigrationState?.sources.map((source) => [
      source.storageKey,
      source,
    ])
  );
  const stableEntries = currentEntryByContrast(document);
  const priorKeysBySource = new Map<string, ReadonlySet<string> | undefined>();

  const adoptableCandidates: OrphanMasteryEvidence[] = [];
  const alreadyRepresentedEvidence: AlreadyRepresentedOrphanEvidence[] = [];
  const blockedEvidence: BlockedOrphanEvidence[] = [];

  for (const batch of observationBatches) {
    const batchEntry = stableEntries.get(batch.contrastId);
    const stableRepresentsBatch =
      batchEntry &&
      'tier' in batchEntry &&
      (batchEntry.provenance === 'initial-migration' ||
        batchEntry.provenance === 'legacy-reconciliation') &&
      batchEntry.tier === batch.selectedTier;
    for (const item of batch.evidence) {
      const currentSource = currentSources.get(item.storageKey);
      if (!currentSource) {
        throw new Error(`Missing inspected legacy source "${item.storageKey}"`);
      }
      const currentEntry = stableEntries.get(item.contrastId);

      if (currentEntry && !('tier' in currentEntry)) {
        blockedEvidence.push({ evidence: item, reason: 'reset-tombstone' });
        continue;
      }
      if (
        currentEntry?.provenance === 'placement' &&
        currentEntry.tier !== item.tier
      ) {
        blockedEvidence.push({ evidence: item, reason: 'stable-placement' });
        continue;
      }
      if (
        currentEntry?.provenance === 'practice' &&
        currentEntry.tier !== item.tier
      ) {
        blockedEvidence.push({ evidence: item, reason: 'stable-practice' });
        continue;
      }

      const priorSource = priorSources.get(item.storageKey);
      if (
        priorSource?.fingerprint === item.sourceFingerprint &&
        priorSource.contrastIds.includes(item.contrastId)
      ) {
        alreadyRepresentedEvidence.push({
          evidence: item,
          reason: 'advisory-fingerprint',
        });
        continue;
      }

      let unusableFingerprintBaseline = false;
      if (
        priorSource &&
        priorSource.contrastIds.includes(item.contrastId)
      ) {
        if (!priorKeysBySource.has(item.storageKey)) {
          const decodedCandidate = parseLegacySourceFingerprint(
            priorSource.fingerprint,
            currentSource.categoryLabel
          );
          const decoded =
            decodedCandidate?.storageKey === priorSource.storageKey
              ? decodedCandidate
              : undefined;
          priorKeysBySource.set(
            item.storageKey,
            decoded
              ? priorEvidenceKeys(
                  document.languageId,
                  decoded,
                  priorSource.revision,
                  mapping
                )
              : undefined
          );
        }
        const priorKeys = priorKeysBySource.get(item.storageKey);
        if (priorKeys?.has(evidenceKey(item))) {
          alreadyRepresentedEvidence.push({
            evidence: item,
            reason: 'advisory-fingerprint',
          });
          continue;
        }
        unusableFingerprintBaseline = !priorKeys;
      }

      if (currentEntry?.tier === item.tier) {
        alreadyRepresentedEvidence.push({
          evidence: item,
          reason: 'stable-record',
        });
        continue;
      }
      if (stableRepresentsBatch) {
        alreadyRepresentedEvidence.push({
          evidence: item,
          reason: 'stable-observation-batch',
        });
        continue;
      }
      if (unusableFingerprintBaseline) {
        blockedEvidence.push({
          evidence: item,
          reason: 'unusable-fingerprint-baseline',
        });
        continue;
      }
      if (!previousMigrationState) {
        if (currentEntry) {
          blockedEvidence.push({
            evidence: item,
            reason: 'missing-fingerprint-baseline',
          });
        } else {
          adoptableCandidates.push(item);
        }
        continue;
      }
      if (currentEntry && item.revision <= currentEntry.revision) {
        blockedEvidence.push({
          evidence: item,
          reason: 'newer-stable-observation',
        });
        continue;
      }
      adoptableCandidates.push(item);
    }
  }

  const unresolvedIdentities = [...observation.inspection.unresolved].sort(
    (left, right) => compareText(diagnosticKey(left), diagnosticKey(right))
  );
  const malformedEvidence = [...observation.inspection.malformed].sort(
    (left, right) => compareText(diagnosticKey(left), diagnosticKey(right))
  );
  const recognizedLegacyEntries =
    adoptableCandidates.length +
    alreadyRepresentedEvidence.length +
    blockedEvidence.length;
  const counts: OrphanAdoptionCounts = {
    recognizedLegacyEntries,
    alreadyRepresented: alreadyRepresentedEvidence.length,
    adoptable: adoptableCandidates.length,
    adopted: 0,
    adoptedRecords: 0,
    blocked: blockedEvidence.length,
    unresolved: unresolvedIdentities.length,
    malformed: malformedEvidence.length,
  };
  const nextMigrationState = buildRepresentedMigrationState(
    document,
    previousMigrationState,
    sources,
    [
      ...alreadyRepresentedEvidence.map((item) => {
        if (item.reason !== 'stable-observation-batch') {
          return item.evidence;
        }
        const stable = stableEntries.get(item.evidence.contrastId);
        return stable && 'tier' in stable
          ? { ...item.evidence, revision: stable.revision }
          : item.evidence;
      }),
      ...adoptableCandidates,
    ]
  );

  return {
    observationBatches,
    adoptableCandidates,
    alreadyRepresentedEvidence,
    blockedEvidence,
    unresolvedIdentities,
    malformedEvidence,
    diagnostics: {
      unresolved: unresolvedIdentities,
      malformed: malformedEvidence,
    },
    nextMigrationState,
    markerNeedsUpdate:
      !previousMigrationState ||
      serializeContrastMasteryMigrationState(previousMigrationState) !==
        serializeContrastMasteryMigrationState(nextMigrationState),
    markerRequiresStableWrite: adoptableCandidates.length > 0,
    counts,
  };
}

/**
 * Adoption is additive to the evidence ledger and revision-first. It can add
 * an absent stable identity or update migration-derived evidence after a new
 * migration observation. Detection has already excluded stable learner
 * actions, reset tombstones, known fingerprints, and unsafe baselines.
 */
export function proposeOrphanMasteryAdoption(
  document: ContrastMasteryDocument,
  analysis: OrphanAdoptionAnalysis
): OrphanAdoptionPlan {
  const adoptedRecords = candidatesToMasteryEntries(
    analysis.adoptableCandidates
  );
  const proposedDocument = reconcileSteadyStateMastery(
    document,
    adoptedRecords
  );
  const decisions: OrphanAdoptionDecision[] = [
    ...analysis.adoptableCandidates.map(
      (evidence): OrphanAdoptionDecision => ({
        decision: 'adopted',
        evidence,
      })
    ),
    ...analysis.alreadyRepresentedEvidence.map(
      ({ evidence, reason }): OrphanAdoptionDecision => ({
        decision: 'ignored-as-already-represented',
        evidence,
        reason,
      })
    ),
    ...analysis.blockedEvidence.map(
      ({ evidence, reason }): OrphanAdoptionDecision =>
        reason === 'reset-tombstone'
          ? {
              decision: 'blocked-by-reset-tombstone',
              evidence,
            }
          : {
              decision: 'blocked-by-newer-stable-evidence',
              evidence,
              reason,
            }
    ),
    ...analysis.unresolvedIdentities.map(
      (diagnostic): OrphanAdoptionDecision => ({
        decision: 'unresolved',
        diagnostic,
      })
    ),
    ...analysis.malformedEvidence.map(
      (diagnostic): OrphanAdoptionDecision => ({
        decision: 'malformed',
        diagnostic,
      })
    ),
  ].sort((left, right) =>
    compareText(decisionKey(left), decisionKey(right))
  );

  return {
    document: proposedDocument,
    adoptedRecords,
    decisions,
    counts: {
      ...analysis.counts,
      adopted: analysis.adoptableCandidates.length,
      adoptedRecords: adoptedRecords.length,
    },
  };
}
