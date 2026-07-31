import { minimalPairs, type Category, type Pair } from '@/src/constants/minimalPairs';
import {
  contrastRegistry,
  type ContrastRegistry,
} from '@/src/domain/contrast/contrastRegistry';
import type { Contrast } from '@/src/domain/contrast/contrast';
import {
  type ContrastId,
  type LanguageId,
} from '@/src/domain/identity';
import {
  LANGUAGE_IDS,
  languageRegistry,
  type LanguageRegistry,
} from '@/src/domain/language/language';
import { buildMasteryStorageKey } from '@/src/domain/masteryPersistence';
import { buildPairId } from '@/utils/idHelpers';

export interface HistoricalCategoryLabelAssignment {
  readonly historicalCategoryLabel: string;
  readonly currentCategoryLabel: string;
  readonly languageId: LanguageId;
  readonly isCurrent: boolean;
}

export interface HistoricalContrastAssignment {
  readonly historicalCategoryLabel: string;
  readonly legacyGroup: string;
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
  readonly isCurrent: boolean;
}

export interface LegacyPairDatasetReference {
  readonly currentCategoryLabel: string;
  readonly pair: Pair;
}

export interface HistoricalPairAssignment {
  readonly legacyPairProgressKey: string;
  readonly historicalCategoryLabel: string;
  readonly languageId: LanguageId;
  readonly contrastId: ContrastId;
  readonly pairReference: LegacyPairDatasetReference;
}

export interface HistoricalIdentityMapping {
  readonly categoryLabels: readonly HistoricalCategoryLabelAssignment[];
  readonly contrastAssignments: readonly HistoricalContrastAssignment[];
  readonly pairAssignments: readonly HistoricalPairAssignment[];
  resolveCategoryLabel(categoryLabel: string): LanguageId | undefined;
  resolveMasteryKey(masteryKey: string): LanguageId | undefined;
  resolveContrast(
    categoryLabel: string,
    legacyGroup: string
  ): ContrastId | undefined;
  resolvePairProgressKey(
    legacyPairProgressKey: string
  ): HistoricalPairAssignment | undefined;
}

/**
 * Checks only the released legacy pair-key shape for diagnostics.
 *
 * This must never be used to infer identity. Exact lookup through
 * HistoricalIdentityMapping.resolvePairProgressKey remains the only supported
 * way to map a learner record to stable LanguageId and ContrastId values.
 */
export function isStructurallyValidLegacyPairProgressKey(
  legacyPairProgressKey: string
): boolean {
  const sections = legacyPairProgressKey.split('__');
  if (
    sections.length !== 3 ||
    sections.some((section) => section.length === 0)
  ) {
    return false;
  }

  const wordSeparator = sections[2].indexOf('_');
  return wordSeparator > 0 && wordSeparator < sections[2].length - 1;
}

interface HistoricalIdentityMappingInput {
  readonly categoryLabels: readonly HistoricalCategoryLabelAssignment[];
  readonly datasets: readonly Category[];
  readonly contrasts: ContrastRegistry;
  readonly languages?: LanguageRegistry;
}

interface HistoricalIdentityValidationInput {
  readonly categoryLabels: readonly HistoricalCategoryLabelAssignment[];
  readonly datasets: readonly Category[];
  readonly contrasts: ContrastRegistry;
  readonly languages: LanguageRegistry;
  readonly contrastAssignments: readonly HistoricalContrastAssignment[];
  readonly pairAssignments: readonly HistoricalPairAssignment[];
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function contrastLookupKey(categoryLabel: string, legacyGroup: string): string {
  return JSON.stringify([categoryLabel, legacyGroup]);
}

function ownedContrastLookupKey(
  languageId: LanguageId,
  legacyGroup: string
): string {
  return JSON.stringify([languageId, legacyGroup]);
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function freezeRows<T extends object>(rows: readonly T[]): readonly T[] {
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

function sortCategoryLabels(
  assignments: readonly HistoricalCategoryLabelAssignment[]
): HistoricalCategoryLabelAssignment[] {
  return [...assignments].sort(
    (left, right) =>
      compareText(
        left.historicalCategoryLabel,
        right.historicalCategoryLabel
      ) ||
      compareText(left.currentCategoryLabel, right.currentCategoryLabel) ||
      compareText(left.languageId, right.languageId)
  );
}

function sortContrastAssignments(
  assignments: readonly HistoricalContrastAssignment[]
): HistoricalContrastAssignment[] {
  return [...assignments].sort(
    (left, right) =>
      compareText(
        left.historicalCategoryLabel,
        right.historicalCategoryLabel
      ) ||
      compareText(left.legacyGroup, right.legacyGroup) ||
      compareText(left.contrastId, right.contrastId)
  );
}

function sortPairAssignments(
  assignments: readonly HistoricalPairAssignment[]
): HistoricalPairAssignment[] {
  return [...assignments].sort((left, right) =>
    compareText(left.legacyPairProgressKey, right.legacyPairProgressKey)
  );
}

/**
 * Current labels plus every rename recorded by LANGUAGE_KEY_MIGRATION.
 *
 * Historical aliases are released compatibility identities. Existing entries
 * are append-only and must never be renamed, removed, or normalized.
 */
export const HISTORICAL_CATEGORY_LABELS: readonly HistoricalCategoryLabelAssignment[] =
  freezeRows([
    {
      historicalCategoryLabel: '日本語',
      currentCategoryLabel: '日本語',
      languageId: LANGUAGE_IDS.japanese,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: '中文',
      currentCategoryLabel: '中文',
      languageId: LANGUAGE_IDS.mandarin,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'ภาษาไทย',
      currentCategoryLabel: 'ภาษาไทย',
      languageId: LANGUAGE_IDS.thai,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'Español',
      currentCategoryLabel: 'Español',
      languageId: LANGUAGE_IDS.spanish,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'العربية',
      currentCategoryLabel: 'العربية',
      languageId: LANGUAGE_IDS.arabic,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'Русский',
      currentCategoryLabel: 'Русский',
      languageId: LANGUAGE_IDS.russian,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: '한국어',
      currentCategoryLabel: '한국어',
      languageId: LANGUAGE_IDS.korean,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'Português',
      currentCategoryLabel: 'Português',
      languageId: LANGUAGE_IDS.portuguese,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'Tiếng Việt',
      currentCategoryLabel: 'Tiếng Việt',
      languageId: LANGUAGE_IDS.vietnamese,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'Türkçe',
      currentCategoryLabel: 'Türkçe',
      languageId: LANGUAGE_IDS.turkish,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'فارسی',
      currentCategoryLabel: 'فارسی',
      languageId: LANGUAGE_IDS.farsi,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: '廣東話',
      currentCategoryLabel: '廣東話',
      languageId: LANGUAGE_IDS.cantonese,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'Bahasa Indonesia',
      currentCategoryLabel: 'Bahasa Indonesia',
      languageId: LANGUAGE_IDS.indonesian,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'हिन्दी / اردو',
      currentCategoryLabel: 'हिन्दी / اردو',
      languageId: LANGUAGE_IDS.hindiUrdu,
      isCurrent: true,
    },
    {
      historicalCategoryLabel: 'idioma español',
      currentCategoryLabel: 'Español',
      languageId: LANGUAGE_IDS.spanish,
      isCurrent: false,
    },
    {
      historicalCategoryLabel: 'اللغة العربية',
      currentCategoryLabel: 'العربية',
      languageId: LANGUAGE_IDS.arabic,
      isCurrent: false,
    },
    {
      historicalCategoryLabel: 'русский язык',
      currentCategoryLabel: 'Русский',
      languageId: LANGUAGE_IDS.russian,
      isCurrent: false,
    },
    {
      historicalCategoryLabel: 'زبان فارسی',
      currentCategoryLabel: 'فارسی',
      languageId: LANGUAGE_IDS.farsi,
      isCurrent: false,
    },
    {
      historicalCategoryLabel: 'bahasa Indo',
      currentCategoryLabel: 'Bahasa Indonesia',
      languageId: LANGUAGE_IDS.indonesian,
      isCurrent: false,
    },
    {
      historicalCategoryLabel: 'हिंदी/اردو',
      currentCategoryLabel: 'हिन्दी / اردو',
      languageId: LANGUAGE_IDS.hindiUrdu,
      isCurrent: false,
    },
  ]);

/**
 * Validates released compatibility assignments without reading learner data.
 *
 * The validator accepts explicit rows so ambiguity and ownership failures can
 * be tested independently from the deterministic shipped-row generator.
 */
export function validateHistoricalIdentityAssignments({
  categoryLabels,
  datasets,
  contrasts,
  languages,
  contrastAssignments,
  pairAssignments,
}: HistoricalIdentityValidationInput): void {
  const errors: string[] = [];
  const datasetByLabel = new Map<string, Category>();
  const labelsByHistoricalLabel = new Map<
    string,
    HistoricalCategoryLabelAssignment
  >();
  const currentLabelsByDataset = new Map<
    string,
    HistoricalCategoryLabelAssignment[]
  >();
  const contrastAssignmentsByKey = new Map<
    string,
    HistoricalContrastAssignment
  >();
  const pairAssignmentsByKey = new Map<string, HistoricalPairAssignment>();

  for (const dataset of datasets) {
    if (datasetByLabel.has(dataset.category)) {
      errors.push(`Duplicate current dataset category "${dataset.category}"`);
    } else {
      datasetByLabel.set(dataset.category, dataset);
    }
  }

  for (const assignment of categoryLabels) {
    if (
      !isNonEmptyString(assignment.historicalCategoryLabel) ||
      !isNonEmptyString(assignment.currentCategoryLabel)
    ) {
      errors.push('Historical category labels must be non-empty exact strings');
      continue;
    }
    if (!languages.getById(assignment.languageId)) {
      errors.push(
        `Historical category label "${assignment.historicalCategoryLabel}" uses unsupported LanguageId "${assignment.languageId}"`
      );
    }
    if (!datasetByLabel.has(assignment.currentCategoryLabel)) {
      errors.push(
        `Historical category label "${assignment.historicalCategoryLabel}" is not connected to current dataset "${assignment.currentCategoryLabel}"`
      );
    }

    const existing = labelsByHistoricalLabel.get(
      assignment.historicalCategoryLabel
    );
    if (existing) {
      if (
        existing.languageId !== assignment.languageId ||
        existing.currentCategoryLabel !== assignment.currentCategoryLabel
      ) {
        errors.push(
          `Ambiguous historical category label "${assignment.historicalCategoryLabel}"`
        );
      } else {
        errors.push(
          `Duplicate historical category label assignment "${assignment.historicalCategoryLabel}"`
        );
      }
    } else {
      labelsByHistoricalLabel.set(
        assignment.historicalCategoryLabel,
        assignment
      );
    }

    if (assignment.isCurrent) {
      if (
        assignment.historicalCategoryLabel !==
        assignment.currentCategoryLabel
      ) {
        errors.push(
          `Current category label "${assignment.historicalCategoryLabel}" must reference itself exactly`
        );
      }
      const currentLabels =
        currentLabelsByDataset.get(assignment.currentCategoryLabel) ?? [];
      currentLabels.push(assignment);
      currentLabelsByDataset.set(assignment.currentCategoryLabel, currentLabels);
    }
  }

  for (const dataset of datasets) {
    const currentLabels = currentLabelsByDataset.get(dataset.category) ?? [];
    if (currentLabels.length !== 1) {
      errors.push(
        `Current dataset "${dataset.category}" must have exactly one current category-label assignment; found ${currentLabels.length}`
      );
    }
  }

  for (const assignment of categoryLabels) {
    if (assignment.isCurrent) continue;

    const [currentAssignment] =
      currentLabelsByDataset.get(assignment.currentCategoryLabel) ?? [];
    if (
      currentAssignment &&
      currentAssignment.languageId !== assignment.languageId
    ) {
      errors.push(
        `Historical category label "${assignment.historicalCategoryLabel}" disagrees with LanguageId "${currentAssignment.languageId}" owned by current dataset "${assignment.currentCategoryLabel}"`
      );
    }
  }

  for (const assignment of contrastAssignments) {
    const key = contrastLookupKey(
      assignment.historicalCategoryLabel,
      assignment.legacyGroup
    );
    const existing = contrastAssignmentsByKey.get(key);
    if (existing) {
      if (
        existing.contrastId !== assignment.contrastId ||
        existing.languageId !== assignment.languageId
      ) {
        errors.push(
          `Ambiguous historical contrast mapping for label "${assignment.historicalCategoryLabel}" and group "${assignment.legacyGroup}"`
        );
      } else {
        errors.push(
          `Duplicate historical contrast mapping for label "${assignment.historicalCategoryLabel}" and group "${assignment.legacyGroup}"`
        );
      }
    } else {
      contrastAssignmentsByKey.set(key, assignment);
    }

    const labelAssignment = labelsByHistoricalLabel.get(
      assignment.historicalCategoryLabel
    );
    if (!labelAssignment) {
      errors.push(
        `Historical contrast mapping uses undeclared category label "${assignment.historicalCategoryLabel}"`
      );
    } else if (labelAssignment.languageId !== assignment.languageId) {
      errors.push(
        `Historical contrast mapping for label "${assignment.historicalCategoryLabel}" disagrees with LanguageId ownership`
      );
    }

    const contrast = contrasts.getById(assignment.contrastId);
    if (!contrast) {
      errors.push(
        `Historical contrast mapping targets nonexistent ContrastId "${assignment.contrastId}"`
      );
    } else if (
      contrast.languageId !== assignment.languageId ||
      contrast.legacyGroup !== assignment.legacyGroup
    ) {
      errors.push(
        `Historical contrast mapping for label "${assignment.historicalCategoryLabel}" and group "${assignment.legacyGroup}" disagrees with Contrast ownership`
      );
    }
  }

  for (const dataset of datasets) {
    const groups = new Set(dataset.pairs.map((pair) => pair.group));
    for (const legacyGroup of groups) {
      const mapping = contrastAssignmentsByKey.get(
        contrastLookupKey(dataset.category, legacyGroup)
      );
      if (!mapping || !mapping.isCurrent) {
        errors.push(
          `Current dataset contrast missing mapping for label "${dataset.category}" and group "${legacyGroup}"`
        );
      }
    }
  }

  for (const contrast of contrasts.contrasts) {
    const currentCoverage = contrastAssignments.filter(
      (assignment) =>
        assignment.isCurrent &&
        assignment.contrastId === contrast.id &&
        assignment.languageId === contrast.languageId &&
        assignment.legacyGroup === contrast.legacyGroup
    );
    if (currentCoverage.length !== 1) {
      errors.push(
        `Registry contrast "${contrast.id}" must have exactly one current legacy coverage row; found ${currentCoverage.length}`
      );
    }
  }

  for (const assignment of pairAssignments) {
    const existing = pairAssignmentsByKey.get(
      assignment.legacyPairProgressKey
    );
    if (existing) {
      if (
        existing.contrastId !== assignment.contrastId ||
        existing.pairReference.pair !== assignment.pairReference.pair
      ) {
        errors.push(
          `Duplicate legacy pair-progress key "${assignment.legacyPairProgressKey}" claims different targets`
        );
      } else {
        errors.push(
          `Duplicate legacy pair-progress key "${assignment.legacyPairProgressKey}"`
        );
      }
    } else {
      pairAssignmentsByKey.set(assignment.legacyPairProgressKey, assignment);
    }

    const contrast = contrasts.getById(assignment.contrastId);
    const contrastMapping = contrastAssignmentsByKey.get(
      contrastLookupKey(
        assignment.historicalCategoryLabel,
        assignment.pairReference.pair.group
      )
    );
    const expectedKey = buildPairId(
      assignment.pairReference.pair,
      assignment.historicalCategoryLabel
    );

    if (assignment.legacyPairProgressKey !== expectedKey) {
      errors.push(
        `Legacy pair-progress key "${assignment.legacyPairProgressKey}" does not match the canonical legacy key builder`
      );
    }
    if (
      !contrast ||
      contrast.id !== contrastMapping?.contrastId ||
      contrast.id !== assignment.contrastId ||
      contrast.languageId !== assignment.languageId ||
      contrast.legacyGroup !== assignment.pairReference.pair.group
    ) {
      errors.push(
        `Legacy pair-progress key "${assignment.legacyPairProgressKey}" disagrees with Contrast ownership`
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Historical identity mapping validation failed:\n${errors
        .map((error) => `- ${error}`)
        .join('\n')}`
    );
  }
}

export function createHistoricalIdentityMapping({
  categoryLabels,
  datasets,
  contrasts,
  languages = languageRegistry,
}: HistoricalIdentityMappingInput): HistoricalIdentityMapping {
  const datasetByLabel = new Map(
    datasets.map((dataset) => [dataset.category, dataset])
  );
  const contrastByOwnership = new Map<string, Contrast>();

  for (const contrast of contrasts.contrasts) {
    const key = ownedContrastLookupKey(
      contrast.languageId,
      contrast.legacyGroup
    );
    const existing = contrastByOwnership.get(key);
    if (existing && existing.id !== contrast.id) {
      throw new Error(
        `Ambiguous Contrast ownership for language "${contrast.languageId}" and legacy group "${contrast.legacyGroup}"`
      );
    }
    contrastByOwnership.set(key, contrast);
  }

  const contrastAssignments: HistoricalContrastAssignment[] = [];
  const pairAssignments: HistoricalPairAssignment[] = [];

  for (const labelAssignment of categoryLabels) {
    const dataset = datasetByLabel.get(labelAssignment.currentCategoryLabel);
    if (!dataset) continue;

    const groups = new Set(dataset.pairs.map((pair) => pair.group));
    for (const legacyGroup of groups) {
      const contrast = contrastByOwnership.get(
        ownedContrastLookupKey(labelAssignment.languageId, legacyGroup)
      );
      if (!contrast) continue;

      contrastAssignments.push({
        historicalCategoryLabel: labelAssignment.historicalCategoryLabel,
        legacyGroup,
        languageId: labelAssignment.languageId,
        contrastId: contrast.id,
        isCurrent: labelAssignment.isCurrent,
      });
    }

    for (const pair of dataset.pairs) {
      const contrast = contrastByOwnership.get(
        ownedContrastLookupKey(labelAssignment.languageId, pair.group)
      );
      if (!contrast) continue;

      pairAssignments.push({
        legacyPairProgressKey: buildPairId(
          pair,
          labelAssignment.historicalCategoryLabel
        ),
        historicalCategoryLabel: labelAssignment.historicalCategoryLabel,
        languageId: labelAssignment.languageId,
        contrastId: contrast.id,
        pairReference: Object.freeze({
          currentCategoryLabel: labelAssignment.currentCategoryLabel,
          pair,
        }),
      });
    }
  }

  const sortedLabels = freezeRows(sortCategoryLabels(categoryLabels));
  const sortedContrasts = freezeRows(
    sortContrastAssignments(contrastAssignments)
  );
  const sortedPairs = freezeRows(sortPairAssignments(pairAssignments));

  validateHistoricalIdentityAssignments({
    categoryLabels: sortedLabels,
    datasets,
    contrasts,
    languages,
    contrastAssignments: sortedContrasts,
    pairAssignments: sortedPairs,
  });

  const languagesByCategoryLabel = new Map(
    sortedLabels.map((assignment) => [
      assignment.historicalCategoryLabel,
      assignment.languageId,
    ])
  );
  const languagesByMasteryKey = new Map(
    sortedLabels.map((assignment) => [
      buildMasteryStorageKey(assignment.historicalCategoryLabel),
      assignment.languageId,
    ])
  );
  const contrastsByLegacyIdentity = new Map(
    sortedContrasts.map((assignment) => [
      contrastLookupKey(
        assignment.historicalCategoryLabel,
        assignment.legacyGroup
      ),
      assignment.contrastId,
    ])
  );
  const pairsByLegacyKey = new Map(
    sortedPairs.map((assignment) => [
      assignment.legacyPairProgressKey,
      assignment,
    ])
  );

  return Object.freeze({
    categoryLabels: sortedLabels,
    contrastAssignments: sortedContrasts,
    pairAssignments: sortedPairs,
    resolveCategoryLabel: (categoryLabel: string) =>
      languagesByCategoryLabel.get(categoryLabel),
    resolveMasteryKey: (masteryKey: string) =>
      languagesByMasteryKey.get(masteryKey),
    resolveContrast: (categoryLabel: string, legacyGroup: string) =>
      contrastsByLegacyIdentity.get(
        contrastLookupKey(categoryLabel, legacyGroup)
      ),
    resolvePairProgressKey: (legacyPairProgressKey: string) =>
      pairsByLegacyKey.get(legacyPairProgressKey),
  });
}

export function serializeHistoricalContrastAssignments(
  assignments: readonly HistoricalContrastAssignment[]
): string {
  const header =
    'historicalCategoryLabel\tlegacyGroup\tlanguageId\tcontrastId';
  const rows = sortContrastAssignments(assignments).map(
    (assignment) =>
      `${assignment.historicalCategoryLabel}\t${assignment.legacyGroup}\t${assignment.languageId}\t${assignment.contrastId}`
  );
  return `${[header, ...rows].join('\n')}\n`;
}

export const historicalIdentityMapping = createHistoricalIdentityMapping({
  categoryLabels: HISTORICAL_CATEGORY_LABELS,
  datasets: minimalPairs,
  contrasts: contrastRegistry,
});
