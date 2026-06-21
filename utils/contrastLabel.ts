import type { Pair } from '@/app/constants/minimalPairs';

const DEFAULT_CONTRAST_TITLE = 'Train this contrast';

function normalizePhonemeForDisplay(value: string | undefined): string {
  return (value ?? '').trim().replace(/^\/+|\/+$/g, '').trim();
}

function formatGroupFallback(group: string | undefined): string {
  const compact = (group ?? '').trim();
  if (!compact) return DEFAULT_CONTRAST_TITLE;

  const spaced = compact
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();

  return spaced ? `Train ${spaced}` : DEFAULT_CONTRAST_TITLE;
}

export function buildContrastTrainingTitle(pair: Pair | undefined): string {
  if (!pair) return DEFAULT_CONTRAST_TITLE;

  const first = normalizePhonemeForDisplay(pair.contrastPhoneme1);
  const second = normalizePhonemeForDisplay(pair.contrastPhoneme2);
  if (first && second) {
    return `Train /${first}/ vs /${second}/`;
  }

  return formatGroupFallback(pair.group);
}
