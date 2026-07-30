import {
  assertUniqueLanguageIds,
  defineLanguageId,
  SUPPORTED_LANGUAGE_IDS,
  type LanguageId,
} from '@/src/domain/identity';

export interface LanguageDefinition {
  readonly id: LanguageId;
}

export interface LanguageRegistry {
  readonly languages: readonly LanguageDefinition[];
  getById(id: LanguageId): LanguageDefinition | undefined;
}

export function createLanguageRegistry(
  definitions: readonly LanguageDefinition[]
): LanguageRegistry {
  const validatedDefinitions = definitions.map((definition) => ({
    id: defineLanguageId(definition.id),
  }));

  assertUniqueLanguageIds(
    validatedDefinitions.map((definition) => definition.id)
  );

  const languages = Object.freeze(
    [...validatedDefinitions].sort((left, right) =>
      left.id.localeCompare(right.id)
    )
  );
  const languagesById = new Map(
    languages.map((language) => [language.id, language])
  );

  return Object.freeze({
    languages,
    getById: (id: LanguageId) => languagesById.get(id),
  });
}

export const languageRegistry = createLanguageRegistry(
  SUPPORTED_LANGUAGE_IDS.map((id) => ({ id }))
);

export const LANGUAGE_IDS = Object.freeze({
  arabic: defineLanguageId('lang.arabic'),
  cantonese: defineLanguageId('lang.cantonese'),
  farsi: defineLanguageId('lang.farsi'),
  hindiUrdu: defineLanguageId('lang.hindi-urdu'),
  indonesian: defineLanguageId('lang.indonesian'),
  japanese: defineLanguageId('lang.japanese'),
  korean: defineLanguageId('lang.korean'),
  mandarin: defineLanguageId('lang.mandarin'),
  portuguese: defineLanguageId('lang.portuguese'),
  russian: defineLanguageId('lang.russian'),
  spanish: defineLanguageId('lang.spanish'),
  thai: defineLanguageId('lang.thai'),
  turkish: defineLanguageId('lang.turkish'),
  vietnamese: defineLanguageId('lang.vietnamese'),
});
