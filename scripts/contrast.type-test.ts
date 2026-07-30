import type { Pair } from '@/src/constants/minimalPairs';
import { defineContrast, type Contrast } from '@/src/domain/contrast/contrast';
import {
  defineContrastId,
  definePairId,
} from '@/src/domain/identity';

const pair: Pair = {
  word1: 'right',
  word2: 'light',
  ipa1: '/raɪt/',
  ipa2: '/laɪt/',
  difficulty: 1,
  group: 'rL',
  position: 'initial',
  contrastPhoneme1: 'r',
  contrastPhoneme2: 'l',
};

const contrast: Contrast = defineContrast({
  id: defineContrastId('contrast-r-l-001'),
  phoneme1: 'r',
  phoneme2: 'l',
  examples: [pair],
  legacyGroup: 'rL',
});

const pairId = definePairId('pair-r-l-001');

// @ts-expect-error PairId and ContrastId remain intentionally distinct.
const contrastWithPairIdentity: Contrast = { ...contrast, id: pairId };

// @ts-expect-error Contrast example relationships are immutable.
contrast.examples.push(pair);

void contrastWithPairIdentity;
