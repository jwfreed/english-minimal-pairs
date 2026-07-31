import {
  assertContrastIdOwnedByLanguage,
  defineContrastId,
  defineLanguageId,
  type ContrastId,
  type LanguageId,
} from '@/src/domain/identity';
import {
  historicalIdentityMapping,
  type HistoricalIdentityMapping,
} from '@/src/domain/compatibility/historicalIdentityMapping';
import { contrastRegistry } from '@/src/domain/contrast/contrastRegistry';

declare const masteryTierBrand: unique symbol;

export type MasteryTier = number & {
  readonly [masteryTierBrand]: 'mastery-tier';
};

export const CONTRAST_MASTERY_SCHEMA_VERSION = 1;
export const CONTRAST_MASTERY_MIGRATION_SCHEMA_VERSION = 1;

export type MasteryProvenance =
  | 'initial-migration'
  | 'legacy-reconciliation'
  | 'practice'
  | 'placement'
  | 'reset';

export interface ContrastMasteryRecord {
  readonly contrastId: ContrastId;
  readonly tier: MasteryTier;
  readonly revision: number;
  readonly provenance: Exclude<MasteryProvenance, 'reset'>;
}

export interface ContrastMasteryTombstone {
  readonly contrastId: ContrastId;
  readonly revision: number;
  readonly provenance: 'reset';
}

export interface ContrastMasteryDocument {
  readonly schemaVersion: typeof CONTRAST_MASTERY_SCHEMA_VERSION;
  readonly languageId: LanguageId;
  readonly lastRevision: number;
  readonly records: readonly ContrastMasteryRecord[];
  readonly tombstones: readonly ContrastMasteryTombstone[];
}

export interface LegacySourceObservation {
  readonly storageKey: string;
  readonly fingerprint: string;
  /**
   * Monotonic order in which this migration system observed source changes.
   *
   * This is persisted as `revision` in schema v1 for compatibility. It is not
   * a timestamp and does not prove when the underlying legacy learner action
   * occurred relative to stable actions outside the same observation ledger.
   */
  readonly revision: number;
  readonly contrastIds: readonly ContrastId[];
}

export interface ContrastMasteryMigrationState {
  readonly schemaVersion: typeof CONTRAST_MASTERY_MIGRATION_SCHEMA_VERSION;
  readonly languageId: LanguageId;
  readonly sourceFingerprint: string;
  readonly lastRevision: number;
  readonly sources: readonly LegacySourceObservation[];
}

export interface LegacyMasterySource {
  readonly storageKey: string;
  readonly categoryLabel: string;
  readonly raw: string | null;
}

export interface LegacyMasteryDiagnostic {
  readonly storageKey: string;
  readonly categoryLabel: string;
  readonly legacyGroup?: string;
  readonly reason:
    | 'invalid-json'
    | 'non-object-payload'
    | 'invalid-tier'
    | 'unknown-category-label'
    | 'unknown-group';
}

export interface LegacyMasteryCandidate {
  readonly storageKey: string;
  readonly legacyGroup: string;
  readonly contrastId: ContrastId;
  readonly tier: MasteryTier;
  /** Migration observation order, not authoritative legacy action causality. */
  readonly revision: number;
  readonly provenance: 'initial-migration' | 'legacy-reconciliation';
}

export interface LegacyMasteryInspection {
  readonly candidates: readonly LegacyMasteryCandidate[];
  readonly malformed: readonly LegacyMasteryDiagnostic[];
  readonly unresolved: readonly LegacyMasteryDiagnostic[];
}

export interface InitialMasteryReconciliation {
  readonly document: ContrastMasteryDocument;
  readonly malformed: readonly LegacyMasteryDiagnostic[];
  readonly unresolved: readonly LegacyMasteryDiagnostic[];
  readonly aliasReconciledContrastIds: readonly ContrastId[];
}

type MasteryEntry = ContrastMasteryRecord | ContrastMasteryTombstone;

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function defineMasteryTier(value: number): MasteryTier {
  if (!Number.isInteger(value) || value < 1 || value > 6) {
    throw new Error(`Mastery tier must be an integer from 1 through 6: "${value}"`);
  }
  return value as MasteryTier;
}

export function defineMasteryRevision(value: number): number {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Mastery revision must be a non-negative safe integer: "${value}"`);
  }
  return value;
}

export function fingerprintLegacySources(
  sources: readonly LegacyMasterySource[]
): string {
  const canonical = [...sources]
    .sort((left, right) => compareText(left.storageKey, right.storageKey))
    .map((source) => [source.storageKey, source.raw])
    .map((row) => JSON.stringify(row))
    .join('\n');
  // Mastery maps are tiny, so retain the collision-free canonical evidence
  // instead of treating a lossy hash as causal ordering information.
  return `legacy-source-v1:${canonical}`;
}

export function parseLegacySourceFingerprint(
  fingerprint: string,
  categoryLabel: string
): LegacyMasterySource | undefined {
  const prefix = 'legacy-source-v1:';
  if (!fingerprint.startsWith(prefix)) return undefined;
  try {
    const row = JSON.parse(fingerprint.slice(prefix.length)) as unknown;
    if (
      !Array.isArray(row) ||
      row.length !== 2 ||
      typeof row[0] !== 'string' ||
      (row[1] !== null && typeof row[1] !== 'string')
    ) {
      return undefined;
    }
    return {
      storageKey: row[0],
      categoryLabel,
      raw: row[1],
    };
  } catch {
    return undefined;
  }
}

export function inspectLegacyMastery(
  languageId: LanguageId,
  sources: readonly LegacyMasterySource[],
  observationRevisions: ReadonlyMap<string, number>,
  provenance: 'initial-migration' | 'legacy-reconciliation',
  mapping: HistoricalIdentityMapping
): LegacyMasteryInspection {
  defineLanguageId(languageId);
  const candidates: LegacyMasteryCandidate[] = [];
  const malformed: LegacyMasteryDiagnostic[] = [];
  const unresolved: LegacyMasteryDiagnostic[] = [];

  for (const source of [...sources].sort((left, right) =>
    compareText(left.storageKey, right.storageKey)
  )) {
    if (source.raw === null) continue;
    const resolvedLanguageId = mapping.resolveCategoryLabel(source.categoryLabel);
    if (!resolvedLanguageId) {
      unresolved.push({
        storageKey: source.storageKey,
        categoryLabel: source.categoryLabel,
        reason: 'unknown-category-label',
      });
      continue;
    }
    if (resolvedLanguageId !== languageId) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(source.raw);
    } catch {
      malformed.push({
        storageKey: source.storageKey,
        categoryLabel: source.categoryLabel,
        reason: 'invalid-json',
      });
      continue;
    }
    if (!isObject(parsed)) {
      malformed.push({
        storageKey: source.storageKey,
        categoryLabel: source.categoryLabel,
        reason: 'non-object-payload',
      });
      continue;
    }

    for (const [legacyGroup, value] of Object.entries(parsed).sort(([left], [right]) =>
      compareText(left, right)
    )) {
      let tier: MasteryTier;
      try {
        tier = defineMasteryTier(value as number);
      } catch {
        malformed.push({
          storageKey: source.storageKey,
          categoryLabel: source.categoryLabel,
          legacyGroup,
          reason: 'invalid-tier',
        });
        continue;
      }
      const contrastId = mapping.resolveContrast(
        source.categoryLabel,
        legacyGroup
      );
      if (!contrastId) {
        unresolved.push({
          storageKey: source.storageKey,
          categoryLabel: source.categoryLabel,
          legacyGroup,
          reason: 'unknown-group',
        });
        continue;
      }
      candidates.push({
        storageKey: source.storageKey,
        legacyGroup,
        contrastId,
        tier,
        revision: defineMasteryRevision(
          observationRevisions.get(source.storageKey) ?? 0
        ),
        provenance,
      });
    }
  }

  return {
    candidates,
    malformed,
    unresolved,
  };
}

export function reconcileInitialLegacyMastery(
  languageId: LanguageId,
  sources: readonly LegacyMasterySource[],
  mapping: HistoricalIdentityMapping = historicalIdentityMapping
): InitialMasteryReconciliation {
  const inspection = inspectLegacyMastery(
    languageId,
    sources,
    new Map(),
    'initial-migration',
    mapping
  );
  const grouped = new Map<ContrastId, LegacyMasteryCandidate[]>();
  for (const candidate of inspection.candidates) {
    const current = grouped.get(candidate.contrastId) ?? [];
    current.push(candidate);
    grouped.set(candidate.contrastId, current);
  }

  const aliasReconciledContrastIds: ContrastId[] = [];
  const records = [...grouped]
    .sort(([left], [right]) => compareText(left, right))
    .map(([contrastId, candidates]) => {
      if (new Set(candidates.map((candidate) => candidate.storageKey)).size > 1) {
        aliasReconciledContrastIds.push(contrastId);
      }
      return {
        contrastId,
        tier: defineMasteryTier(
          Math.max(...candidates.map((candidate) => candidate.tier))
        ),
        revision: 0,
        provenance: 'initial-migration' as const,
      };
    });

  return {
    document: {
      schemaVersion: CONTRAST_MASTERY_SCHEMA_VERSION,
      languageId: defineLanguageId(languageId),
      lastRevision: 0,
      records,
      tombstones: [],
    },
    malformed: inspection.malformed,
    unresolved: inspection.unresolved,
    aliasReconciledContrastIds,
  };
}

function entryTier(entry: MasteryEntry): number {
  return 'tier' in entry ? entry.tier : 0;
}

function chooseSteadyStateEntry(
  current: MasteryEntry | undefined,
  incoming: MasteryEntry
): MasteryEntry {
  if (!current || incoming.revision > current.revision) return incoming;
  if (incoming.revision < current.revision) return current;
  if (incoming.provenance === 'reset') return incoming;
  if (current.provenance === 'reset') return current;
  return entryTier(incoming) > entryTier(current) ? incoming : current;
}

/**
 * Steady-state reconciliation is revision-first. Tier is only a deterministic
 * tie-break for evidence at the same revision; it is never the primary policy.
 */
export function reconcileSteadyStateMastery(
  document: ContrastMasteryDocument,
  incoming: readonly MasteryEntry[]
): ContrastMasteryDocument {
  const entries = new Map<ContrastId, MasteryEntry>();
  for (const entry of [...document.records, ...document.tombstones]) {
    entries.set(entry.contrastId, entry);
  }
  for (const entry of incoming) {
    assertContrastIdOwnedByLanguage(entry.contrastId, document.languageId);
    defineMasteryRevision(entry.revision);
    if ('tier' in entry) defineMasteryTier(entry.tier);
    entries.set(
      entry.contrastId,
      chooseSteadyStateEntry(entries.get(entry.contrastId), entry)
    );
  }

  const ordered = [...entries.values()].sort((left, right) =>
    compareText(left.contrastId, right.contrastId)
  );
  return {
    schemaVersion: CONTRAST_MASTERY_SCHEMA_VERSION,
    languageId: document.languageId,
    lastRevision: Math.max(
      document.lastRevision,
      ...incoming.map((entry) => entry.revision),
      0
    ),
    records: ordered.filter(
      (entry): entry is ContrastMasteryRecord => 'tier' in entry
    ),
    tombstones: ordered.filter(
      (entry): entry is ContrastMasteryTombstone => !('tier' in entry)
    ),
  };
}

export interface LegacyObservationUpdate {
  readonly state: ContrastMasteryMigrationState;
  readonly inspection: LegacyMasteryInspection;
  readonly deletedEntries: readonly ContrastMasteryTombstone[];
  readonly changed: boolean;
}

export function updateLegacySourceObservations(
  languageId: LanguageId,
  sources: readonly LegacyMasterySource[],
  previous: ContrastMasteryMigrationState | undefined,
  currentLastRevision: number,
  mapping: HistoricalIdentityMapping = historicalIdentityMapping
): LegacyObservationUpdate {
  const sourceFingerprint = fingerprintLegacySources(sources);
  const previousByKey = new Map(
    previous?.sources.map((source) => [source.storageKey, source])
  );
  let nextRevision = Math.max(
    currentLastRevision,
    previous?.lastRevision ?? 0
  );
  const observationRevisions = new Map<string, number>();
  const changedKeys = new Set<string>();
  const observations: LegacySourceObservation[] = [];

  for (const source of [...sources].sort((left, right) =>
    compareText(left.storageKey, right.storageKey)
  )) {
    const fingerprint = fingerprintLegacySources([source]);
    const prior = previousByKey.get(source.storageKey);
    const changed = Boolean(
      previous && (!prior || prior.fingerprint !== fingerprint)
    );
    if (changed) changedKeys.add(source.storageKey);
    const revision = changed ? ++nextRevision : prior?.revision ?? 0;
    observationRevisions.set(source.storageKey, revision);

    observations.push({
      storageKey: source.storageKey,
      fingerprint,
      revision,
      contrastIds: [],
    });
  }

  const inspection = inspectLegacyMastery(
    languageId,
    sources,
    observationRevisions,
    previous ? 'legacy-reconciliation' : 'initial-migration',
    mapping
  );
  const contrastIdsByKey = new Map<string, ContrastId[]>();
  for (const candidate of inspection.candidates) {
    const ids = contrastIdsByKey.get(candidate.storageKey) ?? [];
    ids.push(candidate.contrastId);
    contrastIdsByKey.set(candidate.storageKey, ids);
  }

  const completedObservations = observations.map((observation) => ({
    ...observation,
    contrastIds: [...new Set(contrastIdsByKey.get(observation.storageKey) ?? [])]
      .sort(compareText),
  }));
  const deletedEntries: ContrastMasteryTombstone[] = [];
  for (const observation of completedObservations) {
    if (!changedKeys.has(observation.storageKey)) continue;
    const currentIds = new Set(observation.contrastIds);
    const prior = previousByKey.get(observation.storageKey);
    for (const contrastId of prior?.contrastIds ?? []) {
      if (!currentIds.has(contrastId)) {
        deletedEntries.push({
          contrastId,
          revision: observation.revision,
          provenance: 'reset',
        });
      }
    }
  }

  return {
    state: {
      schemaVersion: CONTRAST_MASTERY_MIGRATION_SCHEMA_VERSION,
      languageId,
      sourceFingerprint,
      lastRevision: nextRevision,
      sources: completedObservations,
    },
    inspection,
    deletedEntries,
    changed: previous?.sourceFingerprint !== sourceFingerprint,
  };
}

export function candidatesToMasteryEntries(
  candidates: readonly LegacyMasteryCandidate[]
): readonly ContrastMasteryRecord[] {
  const grouped = new Map<string, LegacyMasteryCandidate[]>();
  for (const candidate of candidates) {
    const key = JSON.stringify([candidate.contrastId, candidate.revision]);
    const values = grouped.get(key) ?? [];
    values.push(candidate);
    grouped.set(key, values);
  }
  return [...grouped.values()]
    .map((values) => ({
      contrastId: values[0].contrastId,
      revision: values[0].revision,
      tier: defineMasteryTier(
        Math.max(...values.map((candidate) => candidate.tier))
      ),
      provenance: values[0].provenance,
    }))
    .sort((left, right) =>
      compareText(left.contrastId, right.contrastId) ||
      left.revision - right.revision
    );
}

export function validateContrastMasteryDocument(
  value: unknown
): ContrastMasteryDocument {
  if (!isObject(value)) throw new Error('Mastery payload must be an object');
  if (value.schemaVersion !== CONTRAST_MASTERY_SCHEMA_VERSION) {
    throw new Error(`Unsupported mastery schema version: "${value.schemaVersion}"`);
  }
  const languageId = defineLanguageId(value.languageId as string);
  const lastRevision = defineMasteryRevision(value.lastRevision as number);
  if (!Array.isArray(value.records) || !Array.isArray(value.tombstones)) {
    throw new Error('Mastery records and tombstones must be arrays');
  }

  const seen = new Set<string>();
  const records = value.records.map((candidate) => {
    if (!isObject(candidate)) throw new Error('Mastery record must be an object');
    const contrastId = defineContrastId(candidate.contrastId as string);
    assertContrastIdOwnedByLanguage(contrastId, languageId);
    if (!contrastRegistry.getById(contrastId)) {
      throw new Error(`Unknown released Contrast identity: "${contrastId}"`);
    }
    const tier = defineMasteryTier(candidate.tier as number);
    const revision = defineMasteryRevision(candidate.revision as number);
    if (
      candidate.provenance !== 'initial-migration' &&
      candidate.provenance !== 'legacy-reconciliation' &&
      candidate.provenance !== 'practice' &&
      candidate.provenance !== 'placement'
    ) {
      throw new Error('Invalid mastery record provenance');
    }
    if (seen.has(contrastId)) throw new Error(`Duplicate mastery identity: "${contrastId}"`);
    seen.add(contrastId);
    const provenance =
      candidate.provenance as ContrastMasteryRecord['provenance'];
    return { contrastId, tier, revision, provenance };
  });
  const tombstones = value.tombstones.map((candidate) => {
    if (!isObject(candidate)) throw new Error('Mastery tombstone must be an object');
    const contrastId = defineContrastId(candidate.contrastId as string);
    assertContrastIdOwnedByLanguage(contrastId, languageId);
    if (!contrastRegistry.getById(contrastId)) {
      throw new Error(`Unknown released Contrast identity: "${contrastId}"`);
    }
    const revision = defineMasteryRevision(candidate.revision as number);
    if (candidate.provenance !== 'reset') {
      throw new Error('Invalid mastery tombstone provenance');
    }
    if (seen.has(contrastId)) throw new Error(`Duplicate mastery identity: "${contrastId}"`);
    seen.add(contrastId);
    return { contrastId, revision, provenance: 'reset' as const };
  });
  if ([...records, ...tombstones].some((entry) => entry.revision > lastRevision)) {
    throw new Error('Mastery record revision exceeds lastRevision');
  }
  return {
    schemaVersion: CONTRAST_MASTERY_SCHEMA_VERSION,
    languageId,
    lastRevision,
    records: records.sort((left, right) => compareText(left.contrastId, right.contrastId)),
    tombstones: tombstones.sort((left, right) => compareText(left.contrastId, right.contrastId)),
  };
}

export function serializeContrastMasteryDocument(
  document: ContrastMasteryDocument
): string {
  return JSON.stringify(validateContrastMasteryDocument(document));
}

export function validateContrastMasteryMigrationState(
  value: unknown
): ContrastMasteryMigrationState {
  if (!isObject(value)) throw new Error('Mastery migration state must be an object');
  if (value.schemaVersion !== CONTRAST_MASTERY_MIGRATION_SCHEMA_VERSION) {
    throw new Error(
      `Unsupported mastery migration schema version: "${value.schemaVersion}"`
    );
  }
  const languageId = defineLanguageId(value.languageId as string);
  const sourceFingerprint = value.sourceFingerprint;
  if (typeof sourceFingerprint !== 'string' || sourceFingerprint.length === 0) {
    throw new Error('Mastery migration source fingerprint must be non-empty');
  }
  const lastRevision = defineMasteryRevision(value.lastRevision as number);
  if (!Array.isArray(value.sources)) {
    throw new Error('Mastery migration sources must be an array');
  }
  const seenKeys = new Set<string>();
  const sources = value.sources.map((candidate) => {
    if (!isObject(candidate)) {
      throw new Error('Mastery migration source must be an object');
    }
    if (
      typeof candidate.storageKey !== 'string' ||
      candidate.storageKey.length === 0 ||
      typeof candidate.fingerprint !== 'string' ||
      candidate.fingerprint.length === 0
    ) {
      throw new Error('Mastery migration source identity is malformed');
    }
    if (seenKeys.has(candidate.storageKey)) {
      throw new Error(`Duplicate mastery migration source: "${candidate.storageKey}"`);
    }
    seenKeys.add(candidate.storageKey);
    const revision = defineMasteryRevision(candidate.revision as number);
    if (revision > lastRevision) {
      throw new Error('Mastery migration source revision exceeds lastRevision');
    }
    if (!Array.isArray(candidate.contrastIds)) {
      throw new Error('Mastery migration source contrastIds must be an array');
    }
    const contrastIds = candidate.contrastIds.map((value) => {
      const contrastId = defineContrastId(value as string);
      assertContrastIdOwnedByLanguage(contrastId, languageId);
      if (!contrastRegistry.getById(contrastId)) {
        throw new Error(`Unknown released Contrast identity: "${contrastId}"`);
      }
      return contrastId;
    });
    if (new Set(contrastIds).size !== contrastIds.length) {
      throw new Error('Duplicate identity in mastery migration source');
    }
    return {
      storageKey: candidate.storageKey,
      fingerprint: candidate.fingerprint,
      revision,
      contrastIds: contrastIds.sort(compareText),
    };
  });
  return {
    schemaVersion: CONTRAST_MASTERY_MIGRATION_SCHEMA_VERSION,
    languageId,
    sourceFingerprint,
    lastRevision,
    sources: sources.sort((left, right) =>
      compareText(left.storageKey, right.storageKey)
    ),
  };
}

export function serializeContrastMasteryMigrationState(
  state: ContrastMasteryMigrationState
): string {
  return JSON.stringify(validateContrastMasteryMigrationState(state));
}
