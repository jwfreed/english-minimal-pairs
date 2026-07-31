import type { ContrastId, LanguageId } from '@/src/domain/identity';
import {
  historicalIdentityMapping,
  isStructurallyValidLegacyPairProgressKey,
  type HistoricalIdentityMapping,
} from '@/src/domain/compatibility/historicalIdentityMapping';

export const LEGACY_PAIR_PROGRESS_STORAGE_KEY = '@pairProgress_v2';
export const LEGACY_MAX_ATTEMPTS_PER_PAIR = 100;

const MASTERY_KEY_PREFIX = '@mastery_';
const PLACEMENT_KEY_PREFIX = '@placementDone_';
const LEGACY_PLACEMENT_KEY = '@placementDone';
const LEGACY_PLACEMENT_SENTINEL_KEY = '@placementDoneLegacyMigrated';

export interface LegacyStorageEntry {
  readonly key: string;
  readonly value: string | null;
}

export type LegacyFixtureCategory =
  | 'baseline'
  | 'alias-reconciliation'
  | 'corruption-handling'
  | 'progress-conservation'
  | 'reset-semantics'
  | 'placement-semantics'
  | 'rollback-compatibility';

export interface LegacyLearnerStateFixture {
  readonly name: string;
  readonly category: LegacyFixtureCategory;
  readonly purpose: string;
  readonly storageEntries: readonly LegacyStorageEntry[];
}

export interface LegacyAttempt {
  readonly isCorrect: boolean;
  readonly timestamp: number;
  readonly durationMin: number;
}

interface SourceRecord {
  readonly sourceEntryId: string;
  readonly sourceRecordId: string;
  readonly sourceKey: string;
}

export interface MappedMasteryRecord extends SourceRecord {
  readonly historicalCategoryLabel: string;
  readonly legacyGroup: string;
  readonly tier: number;
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
}

export interface UnmappedMasteryRecord extends SourceRecord {
  readonly historicalCategoryLabel: string;
  readonly legacyGroup: string;
  readonly tier: number;
  readonly languageId?: LanguageId;
  readonly reason: 'unknown-category-label' | 'unknown-group';
}

export interface MalformedMasteryRecord extends SourceRecord {
  readonly historicalCategoryLabel: string;
  readonly legacyGroup?: string;
  readonly reason:
    | 'missing-value'
    | 'invalid-json'
    | 'non-object-payload'
    | 'invalid-tier';
}

export interface MappedAttemptRecord extends SourceRecord {
  readonly legacyPairProgressKey: string;
  readonly attemptIndex: number;
  readonly attempt: LegacyAttempt;
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
}

export interface UnmappedAttemptRecord extends SourceRecord {
  readonly legacyPairProgressKey: string;
  readonly attemptIndex: number;
  readonly attempt: LegacyAttempt;
  readonly reason: 'unmapped-pair-key' | 'malformed-pair-key';
}

export interface MalformedAttemptRecord extends SourceRecord {
  readonly legacyPairProgressKey: string;
  readonly attemptIndex: number;
  readonly reason: 'invalid-attempt';
}

export interface MalformedPairProgressRecord extends SourceRecord {
  readonly legacyPairProgressKey?: string;
  readonly reason:
    | 'missing-value'
    | 'invalid-json'
    | 'non-object-payload'
    | 'invalid-pair-stats'
    | 'invalid-attempt-container';
}

export interface PlacementRecord extends SourceRecord {
  readonly categoryLabel?: string;
  readonly languageId?: LanguageId;
  readonly isDone: boolean;
  readonly kind: 'legacy-global' | 'legacy-sentinel' | 'per-category';
  readonly reason?: 'unknown-category-label';
}

export interface StorageKeyCollision {
  readonly key: string;
  readonly entryCount: number;
  readonly kind: 'duplicate' | 'conflict';
}

export interface SnapshotMasteryIdentity {
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
  readonly records: readonly MappedMasteryRecord[];
}

export interface SnapshotAttemptIdentity {
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
  readonly records: readonly MappedAttemptRecord[];
}

export interface LegacyLearnerAuditSnapshot {
  readonly fixtureName: string;
  readonly fixtureCategory: LegacyFixtureCategory;
  readonly fixturePurpose: string;
  readonly sourceEntryCount: number;
  readonly sourceKeys: readonly {
    readonly key: string;
    readonly entryCount: number;
  }[];
  readonly storageKeyCollisions: readonly StorageKeyCollision[];
  readonly unknownStorageKeys: readonly string[];
  readonly mappedMastery: readonly MappedMasteryRecord[];
  readonly masteryByIdentity: readonly SnapshotMasteryIdentity[];
  readonly unmappedMastery: readonly UnmappedMasteryRecord[];
  readonly malformedMastery: readonly MalformedMasteryRecord[];
  readonly mappedAttempts: readonly MappedAttemptRecord[];
  readonly attemptsByIdentity: readonly SnapshotAttemptIdentity[];
  readonly unmappedAttempts: readonly UnmappedAttemptRecord[];
  readonly malformedAttempts: readonly MalformedAttemptRecord[];
  readonly malformedPairProgress: readonly MalformedPairProgressRecord[];
  readonly placement: readonly PlacementRecord[];
  readonly rawAttemptSlotCount: number;
  readonly effectiveAttemptSlotCount: number;
  readonly truncatedAttemptCount: number;
}

export interface ProjectedMasteryIdentity {
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
  readonly tier: number;
  readonly reconciliation: 'single-source' | 'initial-alias-highest-tier';
  readonly sourceRecords: readonly MappedMasteryRecord[];
}

export interface MasteryConflict {
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
  readonly sourceLabels: readonly string[];
  readonly sourceTiers: readonly number[];
  readonly kind: 'initial-alias-conflict' | 'duplicate-source-conflict';
}

export interface ProjectedAttemptIdentity {
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
  readonly attempts: readonly MappedAttemptRecord[];
}

export interface LegacyLearnerProjection {
  readonly fixtureName: string;
  readonly fixtureCategory: LegacyFixtureCategory;
  readonly fixturePurpose: string;
  readonly mastery: readonly ProjectedMasteryIdentity[];
  readonly attempts: readonly ProjectedAttemptIdentity[];
  readonly unmappedMastery: readonly UnmappedMasteryRecord[];
  readonly malformedMastery: readonly MalformedMasteryRecord[];
  readonly unmappedAttempts: readonly UnmappedAttemptRecord[];
  readonly malformedAttempts: readonly MalformedAttemptRecord[];
  readonly malformedPairProgress: readonly MalformedPairProgressRecord[];
  readonly masteryConflicts: readonly MasteryConflict[];
  readonly aliasReconciledIdentityCount: number;
  readonly aggregateAttemptCountBeforeProjection: number;
  readonly aggregateAttemptCountAfterProjection: number;
}

export interface InvariantFailure {
  readonly fixtureName: string;
  readonly fixtureCategory: LegacyFixtureCategory;
  readonly fixturePurpose: string;
  readonly code:
    | 'CONFLICTING_SOURCE_KEY'
    | 'MASTERY_RECORD_LOST'
    | 'MASTERY_RECORD_DUPLICATED'
    | 'MASTERY_TIER_LOWERED'
    | 'ATTEMPT_LOST'
    | 'ATTEMPT_DUPLICATED'
    | 'SOURCE_FIXTURE_MUTATED'
    | 'NON_DETERMINISTIC_MAPPING'
    | 'NON_IDEMPOTENT_PROJECTION'
    | 'ALIAS_IDENTITY_DIVERGED'
    | 'UNKNOWN_RECORD_DISAPPEARED'
    | 'MALFORMED_RECORD_CONVERTED'
    | 'ATTEMPT_TOTAL_MISMATCH'
    | 'ORDER_DEPENDENT_PROJECTION';
  readonly message: string;
  readonly expected?: string | number | boolean;
  readonly actual?: string | number | boolean;
}

export interface AuditReport {
  readonly fixtureName: string;
  readonly fixtureCategory: LegacyFixtureCategory;
  readonly fixturePurpose: string;
  readonly sourceEntryCount: number;
  readonly recognizedMasteryRecordCount: number;
  readonly mappedMasteryCount: number;
  readonly unmappedMasteryCount: number;
  readonly malformedMasteryCount: number;
  readonly recognizedAttemptCount: number;
  readonly mappedAttemptCount: number;
  readonly unmappedAttemptCount: number;
  readonly malformedAttemptCount: number;
  readonly malformedPairProgressRecordCount: number;
  readonly rawAttemptSlotCount: number;
  readonly effectiveAttemptCount: number;
  readonly truncatedAttemptCount: number;
  readonly aliasReconciledIdentityCount: number;
  readonly duplicateRecordsDetected: number;
  readonly conflictsDetected: number;
  readonly invariantFailures: readonly InvariantFailure[];
}

interface LoadedEntry extends LegacyStorageEntry {
  readonly sourceEntryId: string;
}

interface ProjectionInvariantInput {
  readonly fixture: LegacyLearnerStateFixture;
  readonly sourceFixtureBefore: string;
  readonly snapshot: LegacyLearnerAuditSnapshot;
  readonly projection: LegacyLearnerProjection;
  readonly repeatedProjection?: LegacyLearnerProjection;
  readonly reorderedProjection?: LegacyLearnerProjection;
  readonly mapping?: HistoricalIdentityMapping;
}

export interface VerifiedLegacyLearnerState {
  readonly snapshot: LegacyLearnerAuditSnapshot;
  readonly projection: LegacyLearnerProjection;
  readonly report: AuditReport;
}

export interface MasteryTransitionFailure {
  readonly beforeFixtureName: string;
  readonly afterFixtureName: string;
  readonly code: 'MASTERY_REMOVED' | 'MASTERY_TIER_LOWERED';
  readonly message: string;
  readonly expected: string | number;
  readonly actual: string | number;
}

export interface RollbackPracticeResult {
  readonly before: VerifiedLegacyLearnerState;
  readonly after: VerifiedLegacyLearnerState;
  readonly updatedFixture: LegacyLearnerStateFixture;
  readonly priorAttemptCount: number;
  readonly finalAttemptCount: number;
  readonly attemptsAdded: number;
  readonly roundTripFailures: readonly InvariantFailure[];
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
  }
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isValidMasteryTier(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= 6
  );
}

function isLegacyAttempt(value: unknown): value is LegacyAttempt {
  if (!isRecord(value)) return false;
  return (
    typeof value.isCorrect === 'boolean' &&
    typeof value.timestamp === 'number' &&
    Number.isFinite(value.timestamp) &&
    typeof value.durationMin === 'number' &&
    Number.isFinite(value.durationMin) &&
    value.durationMin >= 0
  );
}

function sortSourceRecords<T extends SourceRecord>(records: readonly T[]): T[] {
  return [...records].sort(
    (left, right) =>
      compareText(left.sourceRecordId, right.sourceRecordId) ||
      compareText(left.sourceKey, right.sourceKey)
  );
}

function prepareEntries(
  storageEntries: readonly LegacyStorageEntry[]
): LoadedEntry[] {
  const sorted = storageEntries
    .map((entry) => ({ key: entry.key, value: entry.value }))
    .sort(
      (left, right) =>
        compareText(left.key, right.key) ||
        compareText(left.value ?? '', right.value ?? '')
    );
  const occurrences = new Map<string, number>();
  return sorted.map((entry) => {
    const occurrence = occurrences.get(entry.key) ?? 0;
    occurrences.set(entry.key, occurrence + 1);
    return {
      ...entry,
      sourceEntryId: `${entry.key}\u0000${occurrence}`,
    };
  });
}

function summarizeSourceKeys(entries: readonly LoadedEntry[]) {
  const counts = new Map<string, number>();
  for (const entry of entries) {
    counts.set(entry.key, (counts.get(entry.key) ?? 0) + 1);
  }
  return [...counts]
    .sort(([left], [right]) => compareText(left, right))
    .map(([key, entryCount]) => ({ key, entryCount }));
}

function findStorageKeyCollisions(
  entries: readonly LoadedEntry[]
): StorageKeyCollision[] {
  const byKey = new Map<string, LoadedEntry[]>();
  for (const entry of entries) {
    const group = byKey.get(entry.key) ?? [];
    group.push(entry);
    byKey.set(entry.key, group);
  }
  return [...byKey]
    .filter(([, group]) => group.length > 1)
    .sort(([left], [right]) => compareText(left, right))
    .map(([key, group]) => ({
      key,
      entryCount: group.length,
      kind:
        new Set(group.map((entry) => entry.value)).size === 1
          ? 'duplicate'
          : 'conflict',
    }));
}

function parseJson(
  value: string | null
): { readonly ok: true; readonly value: unknown } | { readonly ok: false } {
  if (value === null) return { ok: false };
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch {
    return { ok: false };
  }
}

function groupSnapshotMastery(
  records: readonly MappedMasteryRecord[]
): SnapshotMasteryIdentity[] {
  const grouped = new Map<string, MappedMasteryRecord[]>();
  for (const record of records) {
    const key = stableIdentityKey(record.languageId, record.contrastId);
    const identityRecords = grouped.get(key) ?? [];
    identityRecords.push(record);
    grouped.set(key, identityRecords);
  }
  return [...grouped]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, identityRecords]) => ({
      languageId: identityRecords[0].languageId,
      contrastId: identityRecords[0].contrastId,
      records: sortSourceRecords(identityRecords),
    }));
}

function groupSnapshotAttempts(
  records: readonly MappedAttemptRecord[]
): SnapshotAttemptIdentity[] {
  const grouped = new Map<string, MappedAttemptRecord[]>();
  for (const record of records) {
    const key = stableIdentityKey(record.languageId, record.contrastId);
    const identityRecords = grouped.get(key) ?? [];
    identityRecords.push(record);
    grouped.set(key, identityRecords);
  }
  return [...grouped]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, identityRecords]) => ({
      languageId: identityRecords[0].languageId,
      contrastId: identityRecords[0].contrastId,
      records: sortSourceRecords(identityRecords),
    }));
}

export function captureLegacyFixtureBytes(
  fixture: LegacyLearnerStateFixture
): string {
  return JSON.stringify(fixture);
}

export function loadLegacyLearnerStateSnapshot(
  fixture: LegacyLearnerStateFixture,
  mapping: HistoricalIdentityMapping = historicalIdentityMapping
): LegacyLearnerAuditSnapshot {
  const entries = prepareEntries(fixture.storageEntries);
  const mappedMastery: MappedMasteryRecord[] = [];
  const unmappedMastery: UnmappedMasteryRecord[] = [];
  const malformedMastery: MalformedMasteryRecord[] = [];
  const mappedAttempts: MappedAttemptRecord[] = [];
  const unmappedAttempts: UnmappedAttemptRecord[] = [];
  const malformedAttempts: MalformedAttemptRecord[] = [];
  const malformedPairProgress: MalformedPairProgressRecord[] = [];
  const placement: PlacementRecord[] = [];
  const unknownStorageKeys: string[] = [];
  let rawAttemptSlotCount = 0;
  let effectiveAttemptSlotCount = 0;
  let truncatedAttemptCount = 0;

  for (const entry of entries) {
    if (entry.key.startsWith(MASTERY_KEY_PREFIX)) {
      const historicalCategoryLabel = entry.key.slice(
        MASTERY_KEY_PREFIX.length
      );
      const parsed = parseJson(entry.value);
      if (!parsed.ok) {
        malformedMastery.push({
          sourceEntryId: entry.sourceEntryId,
          sourceRecordId: `${entry.sourceEntryId}\u0000payload`,
          sourceKey: entry.key,
          historicalCategoryLabel,
          reason: entry.value === null ? 'missing-value' : 'invalid-json',
        });
        continue;
      }
      if (!isRecord(parsed.value)) {
        malformedMastery.push({
          sourceEntryId: entry.sourceEntryId,
          sourceRecordId: `${entry.sourceEntryId}\u0000payload`,
          sourceKey: entry.key,
          historicalCategoryLabel,
          reason: 'non-object-payload',
        });
        continue;
      }

      const languageId = mapping.resolveCategoryLabel(
        historicalCategoryLabel
      );
      for (const [legacyGroup, tier] of Object.entries(parsed.value).sort(
        ([left], [right]) => compareText(left, right)
      )) {
        const sourceRecordId = `${entry.sourceEntryId}\u0000${legacyGroup}`;
        if (!isValidMasteryTier(tier)) {
          malformedMastery.push({
            sourceEntryId: entry.sourceEntryId,
            sourceRecordId,
            sourceKey: entry.key,
            historicalCategoryLabel,
            legacyGroup,
            reason: 'invalid-tier',
          });
          continue;
        }

        const contrastId = mapping.resolveContrast(
          historicalCategoryLabel,
          legacyGroup
        );
        if (languageId && contrastId) {
          mappedMastery.push({
            sourceEntryId: entry.sourceEntryId,
            sourceRecordId,
            sourceKey: entry.key,
            historicalCategoryLabel,
            legacyGroup,
            tier,
            languageId,
            contrastId,
          });
        } else {
          unmappedMastery.push({
            sourceEntryId: entry.sourceEntryId,
            sourceRecordId,
            sourceKey: entry.key,
            historicalCategoryLabel,
            legacyGroup,
            tier,
            ...(languageId ? { languageId } : {}),
            reason: languageId ? 'unknown-group' : 'unknown-category-label',
          });
        }
      }
      continue;
    }

    if (entry.key === LEGACY_PAIR_PROGRESS_STORAGE_KEY) {
      const parsed = parseJson(entry.value);
      if (!parsed.ok) {
        malformedPairProgress.push({
          sourceEntryId: entry.sourceEntryId,
          sourceRecordId: `${entry.sourceEntryId}\u0000payload`,
          sourceKey: entry.key,
          reason: entry.value === null ? 'missing-value' : 'invalid-json',
        });
        continue;
      }
      if (!isRecord(parsed.value)) {
        malformedPairProgress.push({
          sourceEntryId: entry.sourceEntryId,
          sourceRecordId: `${entry.sourceEntryId}\u0000payload`,
          sourceKey: entry.key,
          reason: 'non-object-payload',
        });
        continue;
      }

      for (const [legacyPairProgressKey, stats] of Object.entries(
        parsed.value
      ).sort(([left], [right]) => compareText(left, right))) {
        const pairRecordId = `${entry.sourceEntryId}\u0000${legacyPairProgressKey}`;
        if (!isRecord(stats)) {
          malformedPairProgress.push({
            sourceEntryId: entry.sourceEntryId,
            sourceRecordId: pairRecordId,
            sourceKey: entry.key,
            legacyPairProgressKey,
            reason: 'invalid-pair-stats',
          });
          continue;
        }
        if (!Array.isArray(stats.attempts)) {
          malformedPairProgress.push({
            sourceEntryId: entry.sourceEntryId,
            sourceRecordId: pairRecordId,
            sourceKey: entry.key,
            legacyPairProgressKey,
            reason: 'invalid-attempt-container',
          });
          continue;
        }

        rawAttemptSlotCount += stats.attempts.length;
        const retainedStart = Math.max(
          0,
          stats.attempts.length - LEGACY_MAX_ATTEMPTS_PER_PAIR
        );
        truncatedAttemptCount += retainedStart;
        const retainedAttempts = stats.attempts.slice(retainedStart);
        effectiveAttemptSlotCount += retainedAttempts.length;
        const pairAssignment =
          mapping.resolvePairProgressKey(legacyPairProgressKey);
        const pairKeyLooksValid = isStructurallyValidLegacyPairProgressKey(
          legacyPairProgressKey
        );

        retainedAttempts.forEach((attempt, retainedIndex) => {
          const attemptIndex = retainedStart + retainedIndex;
          const sourceRecordId = `${pairRecordId}\u0000${String(
            attemptIndex
          ).padStart(6, '0')}`;
          if (!isLegacyAttempt(attempt)) {
            malformedAttempts.push({
              sourceEntryId: entry.sourceEntryId,
              sourceRecordId,
              sourceKey: entry.key,
              legacyPairProgressKey,
              attemptIndex,
              reason: 'invalid-attempt',
            });
            return;
          }
          const immutableAttempt = deepFreeze({ ...attempt });
          if (pairAssignment) {
            mappedAttempts.push({
              sourceEntryId: entry.sourceEntryId,
              sourceRecordId,
              sourceKey: entry.key,
              legacyPairProgressKey,
              attemptIndex,
              attempt: immutableAttempt,
              languageId: pairAssignment.languageId,
              contrastId: pairAssignment.contrastId,
            });
          } else {
            unmappedAttempts.push({
              sourceEntryId: entry.sourceEntryId,
              sourceRecordId,
              sourceKey: entry.key,
              legacyPairProgressKey,
              attemptIndex,
              attempt: immutableAttempt,
              reason: pairKeyLooksValid
                ? 'unmapped-pair-key'
                : 'malformed-pair-key',
            });
          }
        });
      }
      continue;
    }

    if (
      entry.key === LEGACY_PLACEMENT_KEY ||
      entry.key === LEGACY_PLACEMENT_SENTINEL_KEY ||
      entry.key.startsWith(PLACEMENT_KEY_PREFIX)
    ) {
      const isPerCategory = entry.key.startsWith(PLACEMENT_KEY_PREFIX);
      const categoryLabel = isPerCategory
        ? entry.key.slice(PLACEMENT_KEY_PREFIX.length)
        : undefined;
      const languageId =
        categoryLabel === undefined
          ? undefined
          : mapping.resolveCategoryLabel(categoryLabel);
      placement.push({
        sourceEntryId: entry.sourceEntryId,
        sourceRecordId: `${entry.sourceEntryId}\u0000placement`,
        sourceKey: entry.key,
        ...(categoryLabel === undefined ? {} : { categoryLabel }),
        ...(languageId === undefined ? {} : { languageId }),
        isDone: entry.value !== null,
        kind:
          entry.key === LEGACY_PLACEMENT_KEY
            ? 'legacy-global'
            : entry.key === LEGACY_PLACEMENT_SENTINEL_KEY
              ? 'legacy-sentinel'
              : 'per-category',
        ...(categoryLabel !== undefined && languageId === undefined
          ? { reason: 'unknown-category-label' as const }
          : {}),
      });
      continue;
    }

    unknownStorageKeys.push(entry.key);
  }

  const sortedMappedMastery = sortSourceRecords(mappedMastery);
  const sortedMappedAttempts = sortSourceRecords(mappedAttempts);
  return deepFreeze({
    fixtureName: fixture.name,
    fixtureCategory: fixture.category,
    fixturePurpose: fixture.purpose,
    sourceEntryCount: entries.length,
    sourceKeys: summarizeSourceKeys(entries),
    storageKeyCollisions: findStorageKeyCollisions(entries),
    unknownStorageKeys: [...new Set(unknownStorageKeys)].sort(compareText),
    mappedMastery: sortedMappedMastery,
    masteryByIdentity: groupSnapshotMastery(sortedMappedMastery),
    unmappedMastery: sortSourceRecords(unmappedMastery),
    malformedMastery: sortSourceRecords(malformedMastery),
    mappedAttempts: sortedMappedAttempts,
    attemptsByIdentity: groupSnapshotAttempts(sortedMappedAttempts),
    unmappedAttempts: sortSourceRecords(unmappedAttempts),
    malformedAttempts: sortSourceRecords(malformedAttempts),
    malformedPairProgress: sortSourceRecords(malformedPairProgress),
    placement: sortSourceRecords(placement),
    rawAttemptSlotCount,
    effectiveAttemptSlotCount,
    truncatedAttemptCount,
  });
}

function stableIdentityKey(
  languageId: LanguageId,
  contrastId: ContrastId
): string {
  return `${languageId}\u0000${contrastId}`;
}

export function projectLegacyLearnerState(
  snapshot: LegacyLearnerAuditSnapshot
): LegacyLearnerProjection {
  const masteryByIdentity = new Map<string, MappedMasteryRecord[]>();
  const attemptsByIdentity = new Map<string, MappedAttemptRecord[]>();

  for (const record of snapshot.mappedMastery) {
    const key = stableIdentityKey(record.languageId, record.contrastId);
    const records = masteryByIdentity.get(key) ?? [];
    records.push(record);
    masteryByIdentity.set(key, records);
  }
  for (const record of snapshot.mappedAttempts) {
    const key = stableIdentityKey(record.languageId, record.contrastId);
    const records = attemptsByIdentity.get(key) ?? [];
    records.push(record);
    attemptsByIdentity.set(key, records);
  }

  let aliasReconciledIdentityCount = 0;
  const masteryConflicts: MasteryConflict[] = [];
  const mastery = [...masteryByIdentity]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, records]) => {
      const sortedRecords = sortSourceRecords(records);
      const sourceLabels = [
        ...new Set(
          sortedRecords.map((record) => record.historicalCategoryLabel)
        ),
      ].sort(compareText);
      const sourceTiers = [
        ...new Set(sortedRecords.map((record) => record.tier)),
      ].sort((left, right) => left - right);
      const hasAliases = sourceLabels.length > 1;
      if (hasAliases) aliasReconciledIdentityCount += 1;
      if (sourceTiers.length > 1) {
        masteryConflicts.push({
          languageId: sortedRecords[0].languageId,
          contrastId: sortedRecords[0].contrastId,
          sourceLabels,
          sourceTiers,
          kind: hasAliases
            ? 'initial-alias-conflict'
            : 'duplicate-source-conflict',
        });
      }

      /*
       * `Math.max` models one narrowly approved operation: the initial
       * reconciliation of pre-rename and post-rename mastery aliases.
       *
       * Highest-tier-wins is not a general mastery rule. It must not be reused
       * for placement, learner reset, normal learning, or future conflict
       * handling; those operations require their own revision-aware semantics.
       */
      return {
        languageId: sortedRecords[0].languageId,
        contrastId: sortedRecords[0].contrastId,
        tier: Math.max(...sortedRecords.map((record) => record.tier)),
        reconciliation: hasAliases
          ? ('initial-alias-highest-tier' as const)
          : ('single-source' as const),
        sourceRecords: sortedRecords,
      };
    });

  const attempts = [...attemptsByIdentity]
    .sort(([left], [right]) => compareText(left, right))
    .map(([, records]) => {
      const sortedRecords = sortSourceRecords(records);
      return {
        languageId: sortedRecords[0].languageId,
        contrastId: sortedRecords[0].contrastId,
        attempts: sortedRecords,
      };
    });

  const aggregateAttemptCountBeforeProjection =
    snapshot.mappedAttempts.length + snapshot.unmappedAttempts.length;
  const aggregateAttemptCountAfterProjection =
    attempts.reduce((sum, group) => sum + group.attempts.length, 0) +
    snapshot.unmappedAttempts.length;

  return deepFreeze({
    fixtureName: snapshot.fixtureName,
    fixtureCategory: snapshot.fixtureCategory,
    fixturePurpose: snapshot.fixturePurpose,
    mastery,
    attempts,
    unmappedMastery: snapshot.unmappedMastery,
    malformedMastery: snapshot.malformedMastery,
    unmappedAttempts: snapshot.unmappedAttempts,
    malformedAttempts: snapshot.malformedAttempts,
    malformedPairProgress: snapshot.malformedPairProgress,
    masteryConflicts: masteryConflicts.sort((left, right) =>
      compareText(
        stableIdentityKey(left.languageId, left.contrastId),
        stableIdentityKey(right.languageId, right.contrastId)
      )
    ),
    aliasReconciledIdentityCount,
    aggregateAttemptCountBeforeProjection,
    aggregateAttemptCountAfterProjection,
  });
}

function recordCounts(records: readonly SourceRecord[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const record of records) {
    counts.set(
      record.sourceRecordId,
      (counts.get(record.sourceRecordId) ?? 0) + 1
    );
  }
  return counts;
}

function invariantFailure(
  fixture: LegacyLearnerStateFixture,
  code: InvariantFailure['code'],
  message: string,
  expected?: InvariantFailure['expected'],
  actual?: InvariantFailure['actual']
): InvariantFailure {
  return {
    fixtureName: fixture.name,
    fixtureCategory: fixture.category,
    fixturePurpose: fixture.purpose,
    code,
    message,
    ...(expected === undefined ? {} : { expected }),
    ...(actual === undefined ? {} : { actual }),
  };
}

function addCountFailures(
  fixture: LegacyLearnerStateFixture,
  failures: InvariantFailure[],
  expectedRecords: readonly SourceRecord[],
  actualRecords: readonly SourceRecord[],
  lostCode: InvariantFailure['code'],
  duplicatedCode: InvariantFailure['code'],
  recordKind: string
): void {
  const expected = recordCounts(expectedRecords);
  const actual = recordCounts(actualRecords);
  for (const [sourceRecordId, expectedCount] of expected) {
    const actualCount = actual.get(sourceRecordId) ?? 0;
    if (actualCount < expectedCount) {
      failures.push(
        invariantFailure(
          fixture,
          lostCode,
          `${recordKind} "${sourceRecordId}" disappeared from projection`,
          expectedCount,
          actualCount
        )
      );
    }
    if (actualCount > expectedCount) {
      failures.push(
        invariantFailure(
          fixture,
          duplicatedCode,
          `${recordKind} "${sourceRecordId}" was duplicated by projection`,
          expectedCount,
          actualCount
        )
      );
    }
  }
}

function projectionMasteryRecords(
  projection: LegacyLearnerProjection
): MappedMasteryRecord[] {
  return projection.mastery.flatMap((identity) => identity.sourceRecords);
}

function projectionMappedAttempts(
  projection: LegacyLearnerProjection
): MappedAttemptRecord[] {
  return projection.attempts.flatMap((identity) => identity.attempts);
}

function stableProjection(projection: LegacyLearnerProjection): string {
  return JSON.stringify(projection);
}

export function evaluateProjectionInvariants({
  fixture,
  sourceFixtureBefore,
  snapshot,
  projection,
  repeatedProjection = projectLegacyLearnerState(snapshot),
  reorderedProjection = projectLegacyLearnerState(
    loadLegacyLearnerStateSnapshot(
      {
        ...fixture,
        storageEntries: [...fixture.storageEntries].reverse(),
      },
      historicalIdentityMapping
    )
  ),
  mapping = historicalIdentityMapping,
}: ProjectionInvariantInput): readonly InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const conflictingKeys = snapshot.storageKeyCollisions.filter(
    (collision) => collision.kind === 'conflict'
  );
  for (const collision of conflictingKeys) {
    failures.push(
      invariantFailure(
        fixture,
        'CONFLICTING_SOURCE_KEY',
        `Source key "${collision.key}" has conflicting captured values`,
        1,
        collision.entryCount
      )
    );
  }

  const projectedMasteryRecords = projectionMasteryRecords(projection);
  addCountFailures(
    fixture,
    failures,
    snapshot.mappedMastery,
    projectedMasteryRecords,
    'MASTERY_RECORD_LOST',
    'MASTERY_RECORD_DUPLICATED',
    'Mastery record'
  );

  for (const identity of projection.mastery) {
    for (const sourceRecord of identity.sourceRecords) {
      if (identity.tier < sourceRecord.tier) {
        failures.push(
          invariantFailure(
            fixture,
            'MASTERY_TIER_LOWERED',
            `Projected mastery "${identity.contrastId}" is below its source tier`,
            sourceRecord.tier,
            identity.tier
          )
        );
      }
    }
  }

  const projectedMappedAttempts = projectionMappedAttempts(projection);
  const expectedAttempts = [
    ...snapshot.mappedAttempts,
    ...snapshot.unmappedAttempts,
  ];
  const actualAttempts = [
    ...projectedMappedAttempts,
    ...projection.unmappedAttempts,
  ];
  addCountFailures(
    fixture,
    failures,
    expectedAttempts,
    actualAttempts,
    'ATTEMPT_LOST',
    'ATTEMPT_DUPLICATED',
    'Attempt'
  );

  if (captureLegacyFixtureBytes(fixture) !== sourceFixtureBefore) {
    failures.push(
      invariantFailure(
        fixture,
        'SOURCE_FIXTURE_MUTATED',
        'Source legacy fixture changed while loading or projecting',
        'unchanged',
        'mutated'
      )
    );
  }

  for (const record of snapshot.mappedMastery) {
    const resolvedLanguage = mapping.resolveCategoryLabel(
      record.historicalCategoryLabel
    );
    const resolvedContrast = mapping.resolveContrast(
      record.historicalCategoryLabel,
      record.legacyGroup
    );
    if (
      resolvedLanguage !== record.languageId ||
      resolvedContrast !== record.contrastId
    ) {
      failures.push(
        invariantFailure(
          fixture,
          'NON_DETERMINISTIC_MAPPING',
          `Mastery identity "${record.sourceRecordId}" no longer resolves to its captured stable identity`,
          `${record.languageId}/${record.contrastId}`,
          `${resolvedLanguage ?? 'unmapped'}/${resolvedContrast ?? 'unmapped'}`
        )
      );
    }
  }
  for (const record of snapshot.mappedAttempts) {
    const assignment = mapping.resolvePairProgressKey(
      record.legacyPairProgressKey
    );
    if (
      assignment?.languageId !== record.languageId ||
      assignment.contrastId !== record.contrastId
    ) {
      failures.push(
        invariantFailure(
          fixture,
          'NON_DETERMINISTIC_MAPPING',
          `Pair identity "${record.sourceRecordId}" no longer resolves to its captured stable identity`,
          `${record.languageId}/${record.contrastId}`,
          assignment
            ? `${assignment.languageId}/${assignment.contrastId}`
            : 'unmapped'
        )
      );
    }
  }

  if (stableProjection(repeatedProjection) !== stableProjection(projection)) {
    failures.push(
      invariantFailure(
        fixture,
        'NON_IDEMPOTENT_PROJECTION',
        'Repeated projection did not converge on the same result',
        'same projection',
        'different projection'
      )
    );
  }

  const aliasTargets = new Map<string, Set<ContrastId>>();
  for (const record of snapshot.mappedMastery) {
    const key = `${record.languageId}\u0000${record.legacyGroup}`;
    const targets = aliasTargets.get(key) ?? new Set<ContrastId>();
    targets.add(record.contrastId);
    aliasTargets.set(key, targets);
  }
  for (const [identity, targets] of aliasTargets) {
    if (targets.size > 1) {
      failures.push(
        invariantFailure(
          fixture,
          'ALIAS_IDENTITY_DIVERGED',
          `Historical aliases for "${identity}" resolved to multiple ContrastIds`,
          1,
          targets.size
        )
      );
    }
  }

  const expectedUnknowns = [
    ...snapshot.unmappedMastery,
    ...snapshot.unmappedAttempts,
  ];
  const projectedUnknowns = [
    ...projection.unmappedMastery,
    ...projection.unmappedAttempts,
  ];
  const projectedUnknownIds = new Set(
    projectedUnknowns.map((record) => record.sourceRecordId)
  );
  for (const record of expectedUnknowns) {
    if (!projectedUnknownIds.has(record.sourceRecordId)) {
      failures.push(
        invariantFailure(
          fixture,
          'UNKNOWN_RECORD_DISAPPEARED',
          `Unknown record "${record.sourceRecordId}" disappeared from diagnostics`,
          'preserved as unknown',
          'missing'
        )
      );
    }
  }

  const malformedIds = new Set(
    [
      ...snapshot.malformedMastery,
      ...snapshot.malformedAttempts,
      ...snapshot.malformedPairProgress,
    ].map((record) => record.sourceRecordId)
  );
  const projectedValidIds = new Set(
    [
      ...projectedMasteryRecords,
      ...projectedMappedAttempts,
      ...projection.unmappedMastery,
      ...projection.unmappedAttempts,
    ].map((record) => record.sourceRecordId)
  );
  for (const sourceRecordId of malformedIds) {
    if (projectedValidIds.has(sourceRecordId)) {
      failures.push(
        invariantFailure(
          fixture,
          'MALFORMED_RECORD_CONVERTED',
          `Malformed record "${sourceRecordId}" was converted into a valid identity`,
          'remain malformed',
          'converted to valid identity'
        )
      );
    }
  }

  const expectedAttemptTotal =
    snapshot.mappedAttempts.length + snapshot.unmappedAttempts.length;
  const actualProjectedAttemptTotal =
    projection.attempts.reduce(
      (sum, identity) => sum + identity.attempts.length,
      0
    ) + projection.unmappedAttempts.length;
  if (
    projection.aggregateAttemptCountBeforeProjection !==
      expectedAttemptTotal ||
    projection.aggregateAttemptCountAfterProjection !==
      actualProjectedAttemptTotal ||
    projection.aggregateAttemptCountBeforeProjection !==
      projection.aggregateAttemptCountAfterProjection
  ) {
    failures.push(
      invariantFailure(
        fixture,
        'ATTEMPT_TOTAL_MISMATCH',
        `Global valid attempt total does not equal projected plus explicitly unmapped attempts; declared before=${projection.aggregateAttemptCountBeforeProjection}, declared after=${projection.aggregateAttemptCountAfterProjection}`,
        expectedAttemptTotal,
        actualProjectedAttemptTotal
      )
    );
  }

  if (stableProjection(reorderedProjection) !== stableProjection(projection)) {
    failures.push(
      invariantFailure(
        fixture,
        'ORDER_DEPENDENT_PROJECTION',
        'Projection changed when fixture entries were enumerated in reverse',
        'same projection',
        'different projection'
      )
    );
  }

  return deepFreeze(failures);
}

export function formatInvariantFailure(failure: InvariantFailure): string {
  const comparison =
    failure.expected === undefined && failure.actual === undefined
      ? ''
      : ` Expected: ${JSON.stringify(failure.expected)}; actual: ${JSON.stringify(failure.actual)}.`;
  return `[fixture=${failure.fixtureName}] [category=${failure.fixtureCategory}] [${failure.code}] ${failure.message}.${comparison} Intent: ${failure.fixturePurpose}`;
}

export function assertProjectionInvariants(
  input: ProjectionInvariantInput
): void {
  const failures = evaluateProjectionInvariants(input);
  if (failures.length > 0) {
    throw new Error(
      `Legacy learner-state verification failed for fixture "${input.fixture.name}" (${input.fixture.category}).\nPurpose: ${input.fixture.purpose}\n${failures
        .map((failure) => `- ${formatInvariantFailure(failure)}`)
        .join('\n')}`
    );
  }
}

export function createAuditReport(
  snapshot: LegacyLearnerAuditSnapshot,
  projection: LegacyLearnerProjection,
  invariantFailures: readonly InvariantFailure[]
): AuditReport {
  const recognizedMasteryRecordCount =
    snapshot.mappedMastery.length +
    snapshot.unmappedMastery.filter((record) => record.languageId).length;
  return deepFreeze({
    fixtureName: snapshot.fixtureName,
    fixtureCategory: snapshot.fixtureCategory,
    fixturePurpose: snapshot.fixturePurpose,
    sourceEntryCount: snapshot.sourceEntryCount,
    recognizedMasteryRecordCount,
    mappedMasteryCount: snapshot.mappedMastery.length,
    unmappedMasteryCount: snapshot.unmappedMastery.length,
    malformedMasteryCount: snapshot.malformedMastery.length,
    recognizedAttemptCount: snapshot.mappedAttempts.length,
    mappedAttemptCount: snapshot.mappedAttempts.length,
    unmappedAttemptCount: snapshot.unmappedAttempts.length,
    malformedAttemptCount: snapshot.malformedAttempts.length,
    malformedPairProgressRecordCount:
      snapshot.malformedPairProgress.length,
    rawAttemptSlotCount: snapshot.rawAttemptSlotCount,
    effectiveAttemptCount:
      snapshot.mappedAttempts.length + snapshot.unmappedAttempts.length,
    truncatedAttemptCount: snapshot.truncatedAttemptCount,
    aliasReconciledIdentityCount:
      projection.aliasReconciledIdentityCount,
    duplicateRecordsDetected: snapshot.storageKeyCollisions.filter(
      (collision) => collision.kind === 'duplicate'
    ).length,
    conflictsDetected:
      projection.masteryConflicts.length +
      snapshot.storageKeyCollisions.filter(
        (collision) => collision.kind === 'conflict'
      ).length,
    invariantFailures,
  });
}

export function verifyLegacyLearnerStateFixture(
  fixture: LegacyLearnerStateFixture,
  mapping: HistoricalIdentityMapping = historicalIdentityMapping
): VerifiedLegacyLearnerState {
  const sourceFixtureBefore = captureLegacyFixtureBytes(fixture);
  const snapshot = loadLegacyLearnerStateSnapshot(fixture, mapping);
  const projection = projectLegacyLearnerState(snapshot);
  const repeatedProjection = projectLegacyLearnerState(snapshot);
  const reorderedProjection = projectLegacyLearnerState(
    loadLegacyLearnerStateSnapshot(
      {
        ...fixture,
        storageEntries: [...fixture.storageEntries].reverse(),
      },
      mapping
    )
  );
  const invariantFailures = evaluateProjectionInvariants({
    fixture,
    sourceFixtureBefore,
    snapshot,
    projection,
    repeatedProjection,
    reorderedProjection,
    mapping,
  });
  return deepFreeze({
    snapshot,
    projection,
    report: createAuditReport(snapshot, projection, invariantFailures),
  });
}

export function evaluateMasteryTransition(
  before: LegacyLearnerProjection,
  after: LegacyLearnerProjection,
  operation: 'migration' | 'reset' | 'placement'
): readonly MasteryTransitionFailure[] {
  /*
   * Reset and placement are explicit learner/domain operations with legitimate
   * downward semantics. They must never be routed through the initial alias
   * reconciliation's highest-tier rule.
   */
  if (operation === 'reset' || operation === 'placement') return [];
  const afterByIdentity = new Map(
    after.mastery.map((record) => [
      stableIdentityKey(record.languageId, record.contrastId),
      record,
    ])
  );
  const failures: MasteryTransitionFailure[] = [];
  for (const record of before.mastery) {
    const afterRecord = afterByIdentity.get(
      stableIdentityKey(record.languageId, record.contrastId)
    );
    if (!afterRecord) {
      failures.push({
        beforeFixtureName: before.fixtureName,
        afterFixtureName: after.fixtureName,
        code: 'MASTERY_REMOVED',
        message: `Migration removed mastery identity "${record.contrastId}"`,
        expected: `tier ${record.tier} or higher`,
        actual: 'missing',
      });
    } else if (afterRecord.tier < record.tier) {
      failures.push({
        beforeFixtureName: before.fixtureName,
        afterFixtureName: after.fixtureName,
        code: 'MASTERY_TIER_LOWERED',
        message: `Migration lowered mastery "${record.contrastId}" from tier ${record.tier} to ${afterRecord.tier}`,
        expected: record.tier,
        actual: afterRecord.tier,
      });
    }
  }
  return deepFreeze(failures);
}

function addLegacyPracticeAttempt(
  fixture: LegacyLearnerStateFixture,
  legacyPairProgressKey: string,
  attempt: LegacyAttempt
): LegacyLearnerStateFixture {
  const pairEntries = fixture.storageEntries.filter(
    (entry) => entry.key === LEGACY_PAIR_PROGRESS_STORAGE_KEY
  );
  if (pairEntries.length > 1) {
    throw new Error(
      `Rollback fixture "${fixture.name}" (${fixture.category}) requires at most one legacy pair-progress entry. Intent: ${fixture.purpose}`
    );
  }

  let progress: Record<string, unknown> = {};
  if (pairEntries.length === 1) {
    const parsed = parseJson(pairEntries[0].value);
    if (!parsed.ok || !isRecord(parsed.value)) {
      throw new Error(
        `Rollback fixture "${fixture.name}" (${fixture.category}) requires a valid legacy pair-progress payload. Intent: ${fixture.purpose}`
      );
    }
    progress = JSON.parse(JSON.stringify(parsed.value)) as Record<
      string,
      unknown
    >;
  }

  const stats = progress[legacyPairProgressKey];
  const priorAttempts =
    isRecord(stats) && Array.isArray(stats.attempts)
      ? stats.attempts.slice(-LEGACY_MAX_ATTEMPTS_PER_PAIR)
      : [];
  progress[legacyPairProgressKey] = {
    attempts: [...priorAttempts, { ...attempt }].slice(
      -LEGACY_MAX_ATTEMPTS_PER_PAIR
    ),
  };

  const nextEntry = {
    key: LEGACY_PAIR_PROGRESS_STORAGE_KEY,
    value: JSON.stringify(progress),
  };
  const storageEntries =
    pairEntries.length === 0
      ? [...fixture.storageEntries, nextEntry]
      : fixture.storageEntries.map((entry) =>
          entry.key === LEGACY_PAIR_PROGRESS_STORAGE_KEY ? nextEntry : entry
        );
  return deepFreeze({
    ...fixture,
    storageEntries,
  });
}

export function simulateRollbackPracticeReprojection(
  fixture: LegacyLearnerStateFixture,
  legacyPairProgressKey: string,
  attempt: LegacyAttempt,
  mapping: HistoricalIdentityMapping = historicalIdentityMapping
): RollbackPracticeResult {
  const sourceFixtureBefore = captureLegacyFixtureBytes(fixture);
  const before = verifyLegacyLearnerStateFixture(fixture, mapping);
  const updatedFixture = addLegacyPracticeAttempt(
    fixture,
    legacyPairProgressKey,
    attempt
  );
  const after = verifyLegacyLearnerStateFixture(updatedFixture, mapping);
  const failures: InvariantFailure[] = [];
  const beforeAttemptIds = new Set(
    [
      ...before.snapshot.mappedAttempts,
      ...before.snapshot.unmappedAttempts,
    ].map((record) => record.sourceRecordId)
  );
  const afterAttemptIds = new Set(
    [
      ...after.snapshot.mappedAttempts,
      ...after.snapshot.unmappedAttempts,
    ].map((record) => record.sourceRecordId)
  );
  for (const sourceRecordId of beforeAttemptIds) {
    if (!afterAttemptIds.has(sourceRecordId)) {
      failures.push(
        invariantFailure(
          fixture,
          'ATTEMPT_LOST',
          `Rollback/practice/reprojection lost prior attempt "${sourceRecordId}"`,
          'preserved',
          'missing'
        )
      );
    }
  }
  if (captureLegacyFixtureBytes(fixture) !== sourceFixtureBefore) {
    failures.push(
      invariantFailure(
        fixture,
        'SOURCE_FIXTURE_MUTATED',
        'Rollback simulation mutated its source fixture',
        'unchanged',
        'mutated'
      )
    );
  }
  failures.push(
    ...before.report.invariantFailures,
    ...after.report.invariantFailures
  );

  const priorAttemptCount = before.projection.aggregateAttemptCountAfterProjection;
  const finalAttemptCount = after.projection.aggregateAttemptCountAfterProjection;
  if (finalAttemptCount !== priorAttemptCount + 1) {
    failures.push(
      invariantFailure(
        fixture,
        'ATTEMPT_TOTAL_MISMATCH',
        'Rollback/practice/reprojection did not add exactly one valid legacy attempt',
        priorAttemptCount + 1,
        finalAttemptCount
      )
    );
  }

  return deepFreeze({
    before,
    after,
    updatedFixture,
    priorAttemptCount,
    finalAttemptCount,
    attemptsAdded: finalAttemptCount - priorAttemptCount,
    roundTripFailures: failures,
  });
}
