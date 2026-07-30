import arabic from '@/src/constants/minimalPairs/arabic';
import cantonese from '@/src/constants/minimalPairs/cantonese';
import farsi from '@/src/constants/minimalPairs/farsi';
import hindiUrdu from '@/src/constants/minimalPairs/hindu_urdu';
import indonesian from '@/src/constants/minimalPairs/indonesian';
import japanese from '@/src/constants/minimalPairs/japanese';
import korean from '@/src/constants/minimalPairs/korean';
import mandarin from '@/src/constants/minimalPairs/mandarin';
import portuguese from '@/src/constants/minimalPairs/portuguese';
import russian from '@/src/constants/minimalPairs/russian';
import spanish from '@/src/constants/minimalPairs/spanish';
import thai from '@/src/constants/minimalPairs/thai';
import turkish from '@/src/constants/minimalPairs/turkish';
import vietnamese from '@/src/constants/minimalPairs/vietnamese';
import type { Category } from '@/src/constants/minimalPairs';
import {
  assertUniqueContrastIds,
  defineContrastId,
  type ContrastId,
  type LanguageId,
} from '@/src/domain/identity';
import {
  LANGUAGE_IDS,
  languageRegistry,
  type LanguageRegistry,
} from '@/src/domain/language/language';
import {
  defineContrast,
  type Contrast,
} from '@/src/domain/contrast/contrast';

/**
 * Domain-only catalog of Contrast identity, ownership, and metadata.
 *
 * This boundary provides deterministic definition lookup. It does not own
 * persistence, learner data, migration, or runtime orchestration.
 */
export interface ContrastRegistry {
  readonly contrasts: readonly Contrast[];
  getById(id: ContrastId): Contrast | undefined;
}

export function createContrastRegistry(
  definitions: readonly Contrast[],
  languages: LanguageRegistry = languageRegistry
): ContrastRegistry {
  const validatedDefinitions = definitions.map((definition) => {
    const contrast = defineContrast(definition);

    if (!languages.getById(contrast.languageId)) {
      throw new Error(
        `Contrast "${contrast.id}" uses unsupported language "${contrast.languageId}"`
      );
    }

    return contrast;
  });

  assertUniqueContrastIds(
    validatedDefinitions.map((contrast) => contrast.id)
  );

  const contrasts = Object.freeze(
    [...validatedDefinitions].sort((left, right) =>
      left.id.localeCompare(right.id)
    )
  );
  const contrastsById = new Map(
    contrasts.map((contrast) => [contrast.id, contrast])
  );

  return Object.freeze({
    contrasts,
    getById: (id: ContrastId) => contrastsById.get(id),
  });
}

/**
 * Released identity assignments are append-only.
 *
 * An existing ContrastId must never be renamed, reassigned to another
 * language/contrast, or repurposed. Metadata such as phonemes and examples may
 * evolve without creating a new identity.
 */
interface ContrastDeclaration {
  readonly id: ContrastId;
  readonly languageId: LanguageId;
  readonly dataset: Category;
  readonly legacyGroup: string;
  readonly phoneme1: string;
  readonly phoneme2: string;
}

function declareContrast(
  id: string,
  languageId: LanguageId,
  dataset: Category,
  legacyGroup: string,
  phoneme1: string,
  phoneme2: string
): ContrastDeclaration {
  return {
    id: defineContrastId(id),
    languageId,
    dataset,
    legacyGroup,
    phoneme1,
    phoneme2,
  };
}

function materializeContrast(
  declaration: ContrastDeclaration
): Contrast {
  return {
    id: declaration.id,
    languageId: declaration.languageId,
    phoneme1: declaration.phoneme1,
    phoneme2: declaration.phoneme2,
    examples: declaration.dataset.pairs.filter(
      (pair) => pair.group === declaration.legacyGroup
    ),
    legacyGroup: declaration.legacyGroup,
  };
}

const contrastDeclarations: readonly ContrastDeclaration[] = [
  declareContrast('contrast.arabic.pB', LANGUAGE_IDS.arabic, arabic, 'pB', 'p', 'b'),
  declareContrast('contrast.arabic.vF', LANGUAGE_IDS.arabic, arabic, 'vF', 'v', 'f'),
  declareContrast('contrast.arabic.thetaS', LANGUAGE_IDS.arabic, arabic, 'thetaS', 'θ', 's'),
  declareContrast('contrast.arabic.ethD', LANGUAGE_IDS.arabic, arabic, 'ethD', 'ð', 'd'),
  declareContrast('contrast.arabic.iVsI', LANGUAGE_IDS.arabic, arabic, 'iVsI', 'iː', 'ɪ'),

  declareContrast('contrast.cantonese.thetaT', LANGUAGE_IDS.cantonese, cantonese, 'thetaT', 'θ', 't'),
  declareContrast('contrast.cantonese.ethD', LANGUAGE_IDS.cantonese, cantonese, 'ethD', 'ð', 'd'),
  declareContrast('contrast.cantonese.vW', LANGUAGE_IDS.cantonese, cantonese, 'vW', 'v', 'w'),
  declareContrast('contrast.cantonese.rL', LANGUAGE_IDS.cantonese, cantonese, 'rL', 'r', 'l'),
  declareContrast('contrast.cantonese.iVsI', LANGUAGE_IDS.cantonese, cantonese, 'iVsI', 'iː', 'ɪ'),

  declareContrast('contrast.farsi.thetaT', LANGUAGE_IDS.farsi, farsi, 'thetaT', 'θ', 't'),
  declareContrast('contrast.farsi.ethD', LANGUAGE_IDS.farsi, farsi, 'ethD', 'ð', 'd'),
  declareContrast('contrast.farsi.wV', LANGUAGE_IDS.farsi, farsi, 'wV', 'w', 'v'),
  declareContrast('contrast.farsi.iVsI', LANGUAGE_IDS.farsi, farsi, 'iVsI', 'iː', 'ɪ'),
  declareContrast('contrast.farsi.aVsE', LANGUAGE_IDS.farsi, farsi, 'aVsE', 'æ', 'ɛ'),

  declareContrast('contrast.hindi-urdu.thetaT', LANGUAGE_IDS.hindiUrdu, hindiUrdu, 'thetaT', 'θ', 't'),
  declareContrast('contrast.hindi-urdu.ethD', LANGUAGE_IDS.hindiUrdu, hindiUrdu, 'ethD', 'ð', 'd'),
  declareContrast('contrast.hindi-urdu.zS', LANGUAGE_IDS.hindiUrdu, hindiUrdu, 'zS', 'z', 's'),
  declareContrast('contrast.hindi-urdu.wV', LANGUAGE_IDS.hindiUrdu, hindiUrdu, 'wV', 'w', 'v'),
  declareContrast('contrast.hindi-urdu.aVsE', LANGUAGE_IDS.hindiUrdu, hindiUrdu, 'aVsE', 'æ', 'ɛ'),

  declareContrast('contrast.indonesian.thetaT', LANGUAGE_IDS.indonesian, indonesian, 'thetaT', 'θ', 't'),
  declareContrast('contrast.indonesian.ethD', LANGUAGE_IDS.indonesian, indonesian, 'ethD', 'ð', 'd'),
  declareContrast('contrast.indonesian.vF', LANGUAGE_IDS.indonesian, indonesian, 'vF', 'v', 'f'),
  declareContrast('contrast.indonesian.aVsUh', LANGUAGE_IDS.indonesian, indonesian, 'aVsUh', 'æ', 'ʌ'),
  declareContrast('contrast.indonesian.iVsI', LANGUAGE_IDS.indonesian, indonesian, 'iVsI', 'iː', 'ɪ'),

  declareContrast('contrast.japanese.rL', LANGUAGE_IDS.japanese, japanese, 'rL', 'r', 'l'),
  declareContrast('contrast.japanese.bV', LANGUAGE_IDS.japanese, japanese, 'bV', 'b', 'v'),
  declareContrast('contrast.japanese.sTheta', LANGUAGE_IDS.japanese, japanese, 'sTheta', 's', 'θ'),
  declareContrast('contrast.japanese.aVsUh', LANGUAGE_IDS.japanese, japanese, 'aVsUh', 'æ', 'ʌ'),
  declareContrast('contrast.japanese.iVsI', LANGUAGE_IDS.japanese, japanese, 'iVsI', 'iː', 'ɪ'),

  declareContrast('contrast.korean.iVsI', LANGUAGE_IDS.korean, korean, 'iVsI', 'iː', 'ɪ'),
  declareContrast('contrast.korean.fP', LANGUAGE_IDS.korean, korean, 'fP', 'f', 'p'),
  declareContrast('contrast.korean.vB', LANGUAGE_IDS.korean, korean, 'vB', 'v', 'b'),
  declareContrast('contrast.korean.rL', LANGUAGE_IDS.korean, korean, 'rL', 'r', 'l'),
  declareContrast('contrast.korean.thetaS', LANGUAGE_IDS.korean, korean, 'thetaS', 'θ', 's'),

  declareContrast('contrast.mandarin.thetaS', LANGUAGE_IDS.mandarin, mandarin, 'thetaS', 'θ', 's'),
  declareContrast('contrast.mandarin.vW', LANGUAGE_IDS.mandarin, mandarin, 'vW', 'v', 'w'),
  declareContrast('contrast.mandarin.rL', LANGUAGE_IDS.mandarin, mandarin, 'rL', 'r', 'l'),
  declareContrast('contrast.mandarin.iVsI', LANGUAGE_IDS.mandarin, mandarin, 'iVsI', 'iː', 'ɪ'),
  declareContrast('contrast.mandarin.uVsU', LANGUAGE_IDS.mandarin, mandarin, 'uVsU', 'uː', 'ʊ'),

  declareContrast('contrast.portuguese.thetaT', LANGUAGE_IDS.portuguese, portuguese, 'thetaT', 'θ', 't'),
  declareContrast('contrast.portuguese.ethD', LANGUAGE_IDS.portuguese, portuguese, 'ethD', 'ð', 'd'),
  declareContrast('contrast.portuguese.iVsI', LANGUAGE_IDS.portuguese, portuguese, 'iVsI', 'iː', 'ɪ'),
  declareContrast('contrast.portuguese.uVsU', LANGUAGE_IDS.portuguese, portuguese, 'uVsU', 'uː', 'ʊ'),
  declareContrast('contrast.portuguese.aVsE', LANGUAGE_IDS.portuguese, portuguese, 'aVsE', 'æ', 'ɛ'),

  declareContrast('contrast.russian.iVsI', LANGUAGE_IDS.russian, russian, 'iVsI', 'iː', 'ɪ'),
  declareContrast('contrast.russian.aVsUh', LANGUAGE_IDS.russian, russian, 'aVsUh', 'æ', 'ʌ'),
  declareContrast('contrast.russian.wV', LANGUAGE_IDS.russian, russian, 'wV', 'w', 'v'),
  declareContrast('contrast.russian.thetaS', LANGUAGE_IDS.russian, russian, 'thetaS', 'θ', 's'),
  declareContrast('contrast.russian.hZero', LANGUAGE_IDS.russian, russian, 'hZero', 'h', '∅'),

  declareContrast('contrast.spanish.iVsI', LANGUAGE_IDS.spanish, spanish, 'iVsI', 'iː', 'ɪ'),
  declareContrast('contrast.spanish.uhVsAh', LANGUAGE_IDS.spanish, spanish, 'uhVsAh', 'ʌ', 'ɑː'),
  declareContrast('contrast.spanish.aVsE', LANGUAGE_IDS.spanish, spanish, 'aVsE', 'æ', 'ɛ'),
  declareContrast('contrast.spanish.bV', LANGUAGE_IDS.spanish, spanish, 'bV', 'b', 'v'),
  declareContrast('contrast.spanish.thetaS', LANGUAGE_IDS.spanish, spanish, 'thetaS', 'θ', 's'),

  declareContrast('contrast.thai.thetaT', LANGUAGE_IDS.thai, thai, 'thetaT', 'θ', 't'),
  declareContrast('contrast.thai.ethD', LANGUAGE_IDS.thai, thai, 'ethD', 'ð', 'd'),
  declareContrast('contrast.thai.vF', LANGUAGE_IDS.thai, thai, 'vF', 'v', 'f'),
  declareContrast('contrast.thai.zS', LANGUAGE_IDS.thai, thai, 'zS', 'z', 's'),
  declareContrast('contrast.thai.rL', LANGUAGE_IDS.thai, thai, 'rL', 'r', 'l'),

  declareContrast('contrast.turkish.thetaT', LANGUAGE_IDS.turkish, turkish, 'thetaT', 'θ', 't'),
  declareContrast('contrast.turkish.ethD', LANGUAGE_IDS.turkish, turkish, 'ethD', 'ð', 'd'),
  declareContrast('contrast.turkish.iVsI', LANGUAGE_IDS.turkish, turkish, 'iVsI', 'iː', 'ɪ'),
  declareContrast('contrast.turkish.uVsU', LANGUAGE_IDS.turkish, turkish, 'uVsU', 'uː', 'ʊ'),
  declareContrast('contrast.turkish.aVsUh', LANGUAGE_IDS.turkish, turkish, 'aVsUh', 'æ', 'ʌ'),

  declareContrast('contrast.vietnamese.thetaT', LANGUAGE_IDS.vietnamese, vietnamese, 'thetaT', 'θ', 't'),
  declareContrast('contrast.vietnamese.ethD', LANGUAGE_IDS.vietnamese, vietnamese, 'ethD', 'ð', 'd'),
  declareContrast('contrast.vietnamese.zS', LANGUAGE_IDS.vietnamese, vietnamese, 'zS', 'z', 's'),
  declareContrast('contrast.vietnamese.rL', LANGUAGE_IDS.vietnamese, vietnamese, 'rL', 'r', 'l'),
  declareContrast('contrast.vietnamese.aVsUh', LANGUAGE_IDS.vietnamese, vietnamese, 'aVsUh', 'æ', 'ʌ'),
];

export const contrastRegistry = createContrastRegistry(
  contrastDeclarations.map(materializeContrast)
);
