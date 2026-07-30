import {
  type ContrastId,
  type PairId,
  defineContrastId,
  definePairId,
} from '@/src/domain/identity';

const contrastId: ContrastId = defineContrastId('contrast-r-l-001');
const pairId: PairId = definePairId('pair-r-l-001');

// @ts-expect-error ContrastId and PairId are intentionally not interchangeable.
const pairFromContrast: PairId = contrastId;

// @ts-expect-error PairId and ContrastId are intentionally not interchangeable.
const contrastFromPair: ContrastId = pairId;

// @ts-expect-error Raw strings must pass through explicit PairId construction.
const pairFromRawString: PairId = 'pair-r-l-raw';

// @ts-expect-error Raw strings must pass through explicit ContrastId construction.
const contrastFromRawString: ContrastId = 'contrast-r-l-raw';

void pairFromContrast;
void contrastFromPair;
void pairFromRawString;
void contrastFromRawString;
