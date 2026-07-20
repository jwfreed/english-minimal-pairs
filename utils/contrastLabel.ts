import type { Pair } from '@/src/constants/minimalPairs';
import { tKeys, TranslationKey } from '@/src/constants/translationKeys';

const DEFAULT_CONTRAST_TITLE = 'Train this contrast';

function normalizePhonemeForDisplay(value: string | undefined): string {
  return (value ?? '').trim().replace(/^\/+|\/+$/g, '').trim();
}

function formatGroupFallback(group: string | undefined): string {
  const compact = (group ?? '').trim();
  if (!compact) return '';

  const spaced = compact
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  return spaced;
}

export function buildContrastTrainingTitle(
  pair: Pair | undefined,
  translate?: (key: TranslationKey) => string,
): string {
  const t = (key: TranslationKey, fallback: string): string =>
    translate ? translate(key) : fallback;

  if (!pair) return t(tKeys.trainThisContrast, DEFAULT_CONTRAST_TITLE);

  return `${t(tKeys.trainContrast, 'Train')} ${buildContrastLabel(pair)}`;
}

export function buildContrastLabel(pair: Pair | undefined): string {
  if (!pair) return '';

  const first = normalizePhonemeForDisplay(pair.contrastPhoneme1);
  const second = normalizePhonemeForDisplay(pair.contrastPhoneme2);
  if (first && second) {
    return `/${first}/ vs /${second}/`;
  }

  return formatGroupFallback(pair.group);
}
