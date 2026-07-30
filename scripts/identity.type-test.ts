import {
  type ContrastId,
  type LanguageId,
  type PairId,
  defineContrastId,
  defineLanguageId,
  definePairId,
} from '@/src/domain/identity';

const contrastId: ContrastId = defineContrastId('contrast.japanese.rL');
const languageId: LanguageId = defineLanguageId('lang.japanese');
const pairId: PairId = definePairId('pair-r-l-001');

// @ts-expect-error ContrastId and PairId are intentionally not interchangeable.
const pairFromContrast: PairId = contrastId;

// @ts-expect-error PairId and ContrastId are intentionally not interchangeable.
const contrastFromPair: ContrastId = pairId;

// @ts-expect-error LanguageId and ContrastId are intentionally not interchangeable.
const contrastFromLanguage: ContrastId = languageId;

// @ts-expect-error ContrastId and LanguageId are intentionally not interchangeable.
const languageFromContrast: LanguageId = contrastId;

// @ts-expect-error Raw strings must pass through explicit PairId construction.
const pairFromRawString: PairId = 'pair-r-l-raw';

// @ts-expect-error Raw strings must pass through explicit ContrastId construction.
const contrastFromRawString: ContrastId = 'contrast-r-l-raw';

void pairFromContrast;
void contrastFromPair;
void contrastFromLanguage;
void languageFromContrast;
void pairFromRawString;
void contrastFromRawString;
