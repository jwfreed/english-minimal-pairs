declare const identityBrand: unique symbol;

type StableId<Kind extends 'contrast' | 'language' | 'pair'> = string & {
  readonly [identityBrand]: Kind;
};

/**
 * Stable identity for a phonological contrast.
 *
 * Assign independently from display labels and the legacy Pair.group value.
 */
export type ContrastId = StableId<'contrast'>;

/**
 * Stable identity for a training pair.
 *
 * Assign independently from word content and legacy progress keys.
 */
export type PairId = StableId<'pair'>;

/**
 * Stable application-owned identity for a learner language.
 *
 * This is intentionally independent from display labels and locale standards.
 */
export type LanguageId = StableId<'language'>;

const SUPPORTED_LANGUAGE_ID_VALUES = [
  'lang.arabic',
  'lang.cantonese',
  'lang.farsi',
  'lang.hindi-urdu',
  'lang.indonesian',
  'lang.japanese',
  'lang.korean',
  'lang.mandarin',
  'lang.portuguese',
  'lang.russian',
  'lang.spanish',
  'lang.thai',
  'lang.turkish',
  'lang.vietnamese',
] as const;

const supportedLanguageIdValues = new Set<string>(
  SUPPORTED_LANGUAGE_ID_VALUES
);
const LANGUAGE_SCOPED_CONTRAST_ID_PATTERN =
  /^contrast\.([a-z][a-z0-9-]*)\.([A-Za-z][A-Za-z0-9]*)$/;

function defineIdentity<TId extends ContrastId | LanguageId | PairId>(
  value: string,
  kind: 'contrast' | 'language' | 'pair'
): TId {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${kind} ID must be a non-empty string`);
  }

  // Identity constructors validate exact values but never normalize them.
  return value as TId;
}

export function defineContrastId(value: string): ContrastId {
  defineIdentity<ContrastId>(value, 'contrast');

  const match = LANGUAGE_SCOPED_CONTRAST_ID_PATTERN.exec(value);
  if (!match) {
    throw new Error(`Contrast ID must be language-scoped: "${value}"`);
  }

  const languageId = `lang.${match[1]}`;
  if (!supportedLanguageIdValues.has(languageId)) {
    throw new Error(
      `Contrast ID uses unsupported language namespace: "${value}"`
    );
  }

  return value as ContrastId;
}

export function definePairId(value: string): PairId {
  return defineIdentity<PairId>(value, 'pair');
}

export function defineLanguageId(value: string): LanguageId {
  defineIdentity<LanguageId>(value, 'language');

  if (!supportedLanguageIdValues.has(value)) {
    throw new Error(`Unsupported language ID: "${value}"`);
  }

  return value as LanguageId;
}

export function assertContrastIdOwnedByLanguage(
  contrastId: ContrastId,
  languageId: LanguageId
): void {
  defineContrastId(contrastId);
  defineLanguageId(languageId);

  const languageNamespace =
    LANGUAGE_SCOPED_CONTRAST_ID_PATTERN.exec(contrastId)?.[1];
  const expectedLanguageId = `lang.${languageNamespace}`;

  if (languageId !== expectedLanguageId) {
    throw new Error(
      `Contrast "${contrastId}" is owned by "${languageId}"; expected "${expectedLanguageId}"`
    );
  }
}

/**
 * The complete application-owned language identity namespace.
 *
 * Additions are explicit. Released values must never be renamed or removed.
 */
export const SUPPORTED_LANGUAGE_IDS: readonly LanguageId[] = Object.freeze(
  SUPPORTED_LANGUAGE_ID_VALUES.map(defineLanguageId)
);

function assertUniqueIds(
  ids: readonly string[],
  kind: 'contrast' | 'language' | 'pair'
): void {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${kind} ID: "${id}"`);
    }
    seen.add(id);
  }
}

export function assertUniqueContrastIds(ids: readonly ContrastId[]): void {
  assertUniqueIds(ids, 'contrast');
}

export function assertUniquePairIds(ids: readonly PairId[]): void {
  assertUniqueIds(ids, 'pair');
}

export function assertUniqueLanguageIds(ids: readonly LanguageId[]): void {
  assertUniqueIds(ids, 'language');
}
