import type { Pair } from '@/src/constants/minimalPairs';
import {
  defineContrastId,
  type ContrastId,
} from '@/src/domain/identity';

/**
 * The phonological distinction a learner is training.
 *
 * `legacyGroup` keeps the relationship to existing Pair.group-based flows
 * explicit during the compatibility period. It is not the Contrast identity;
 * new identity-bearing behavior must use `id`.
 */
export interface Contrast {
  readonly id: ContrastId;
  readonly phoneme1: string;
  readonly phoneme2: string;
  readonly examples: readonly Pair[];
  readonly legacyGroup: string;
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Defines a Contrast without changing or wrapping its existing Pair examples.
 *
 * Pair shape validation remains owned by the dataset validator. This boundary
 * only validates the metadata and relationships owned by Contrast.
 */
export function defineContrast(contrast: Contrast): Contrast {
  defineContrastId(contrast.id);

  if (!isNonEmptyString(contrast.phoneme1)) {
    throw new Error('Contrast phoneme1 must be a non-empty string');
  }
  if (!isNonEmptyString(contrast.phoneme2)) {
    throw new Error('Contrast phoneme2 must be a non-empty string');
  }
  if (!isNonEmptyString(contrast.legacyGroup)) {
    throw new Error('Contrast legacy group must be a non-empty string');
  }
  if (!Array.isArray(contrast.examples) || contrast.examples.length === 0) {
    throw new Error('Contrast must include at least one Pair example');
  }

  for (const example of contrast.examples) {
    const pairLabel = `${example.word1}/${example.word2}`;

    if (example.group !== contrast.legacyGroup) {
      throw new Error(
        `Contrast example "${pairLabel}" uses legacy group "${example.group}"; expected "${contrast.legacyGroup}"`
      );
    }
    if (
      example.contrastPhoneme1 !== contrast.phoneme1 ||
      example.contrastPhoneme2 !== contrast.phoneme2
    ) {
      throw new Error(
        `Contrast example "${pairLabel}" has phoneme metadata inconsistent with its Contrast`
      );
    }
  }

  return contrast;
}
