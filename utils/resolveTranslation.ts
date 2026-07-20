import {
  alternateLanguages,
  englishTranslations,
} from '@/src/constants/alternateLanguages';
import type { TranslationKey } from '@/src/constants/translationKeys';

interface ResolveTranslationOptions {
  isDevelopment: boolean;
  onMissing?: (message: string) => void;
}

/** Resolves UI copy without leaking English into a non-English interface. */
export function resolveTranslation(
  targetLanguage: string,
  key: TranslationKey,
  { isDevelopment, onMissing }: ResolveTranslationOptions
): string {
  const value = alternateLanguages[targetLanguage]?.[key];
  if (value !== undefined) return value;

  onMissing?.(`Missing translation for "${key}" in "${targetLanguage}"`);

  if (targetLanguage === 'English') {
    return englishTranslations[key] ?? (isDevelopment ? key : '');
  }

  return isDevelopment ? key : '';
}
