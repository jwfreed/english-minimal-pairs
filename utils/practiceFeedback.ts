import type { Pair } from '@/app/constants/minimalPairs';
import type { PlayedIndex, PracticeFeedback } from '@/app/domain/practiceSession';

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
}

function normalizePhonemeForDisplay(value: string | undefined): string | null {
  const compact = (value ?? '').trim().replace(/^\/+|\/+$/g, '').trim();
  return compact ? `/${compact}/` : null;
}

export function buildPracticeFeedbackCopy({
  pair,
  feedback,
  playedIdx,
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
        ? `Correct — you heard ${correctPhoneme} in ${correctWord}.`
        : `Correct — that was ${correctWord}.`,
      detail: null,
      correctWord,
      correctIpa,
      correctPhoneme,
      contrastWord,
      contrastIpa,
    };
  }

  return {
    headline: `This was ${correctWord}.`,
    detail: `Listen again and compare it with ${contrastWord}.`,
    correctWord,
    correctIpa,
    correctPhoneme,
    contrastWord,
    contrastIpa,
  };
}
