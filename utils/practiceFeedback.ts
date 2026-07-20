import type { Pair } from '@/src/constants/minimalPairs';
import { tKeys, TranslationKey } from '@/src/constants/translationKeys';
import type { PlayedIndex, PracticeFeedback } from '@/src/domain/practiceSession';
import { formatTranslation } from '@/utils/formatTranslation';

export interface PracticeFeedbackCopy {
  headline: string;
  detail: string | null;
  correctWord: string;
  correctIpa: string;
  correctPhoneme: string | null;
  contrastWord: string;
  contrastIpa: string;
}

export interface PracticeFeedbackCopyInput {
  pair: Pair;
  feedback: PracticeFeedback;
  playedIdx: PlayedIndex;
  translate: (key: TranslationKey) => string;
}

function normalizePhonemeForDisplay(value: string | undefined): string | null {
  const compact = (value ?? '').trim().replace(/^\/+|\/+$/g, '').trim();
  return compact ? `/${compact}/` : null;
}

export function buildPracticeFeedbackCopy({
  pair,
  feedback,
  playedIdx,
  translate,
}: PracticeFeedbackCopyInput): PracticeFeedbackCopy {
  const isWord1 = playedIdx === 0;
  const correctWord = isWord1 ? pair.word1 : pair.word2;
  const correctIpa = isWord1 ? pair.ipa1 : pair.ipa2;
  const correctPhoneme = normalizePhonemeForDisplay(
    isWord1 ? pair.contrastPhoneme1 : pair.contrastPhoneme2
  );
  const contrastWord = isWord1 ? pair.word2 : pair.word1;
  const contrastIpa = isWord1 ? pair.ipa2 : pair.ipa1;

  if (feedback === 'correct') {
    return {
      headline: correctPhoneme
        ? formatTranslation(translate(tKeys.correctYouHeardIn), {
            phoneme: correctPhoneme,
            word: correctWord,
          })
        : `${translate(tKeys.correctThatWas)} ${correctWord}.`,
      detail: null,
      correctWord,
      correctIpa,
      correctPhoneme,
      contrastWord,
      contrastIpa,
    };
  }

  return {
    headline: `${translate(tKeys.incorrectThisWas)} ${correctWord}.`,
    detail: `${translate(tKeys.listenAndCompareWith)} ${contrastWord}.`,
    correctWord,
    correctIpa,
    correctPhoneme,
    contrastWord,
    contrastIpa,
  };
}
