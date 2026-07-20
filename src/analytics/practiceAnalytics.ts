import type { Pair } from '@/src/constants/minimalPairs';
import { buildPairId } from '@/utils/idHelpers';

import { trackLearningEvent } from './learningAnalytics';

interface PracticePairContext {
  pair: Pair;
  category: string;
}

function identifyPair({ pair, category }: PracticePairContext) {
  return {
    contrast_id: pair.group,
    pair_id: buildPairId(pair, category),
  };
}

export const practiceAnalytics = {
  practiceStarted({
    contrast,
    masteryLevel,
  }: {
    contrast: string;
    masteryLevel: number;
  }): void {
    trackLearningEvent({
      name: 'contrast_practice_started',
      properties: {
        contrast_id: contrast,
        mastery_level: masteryLevel,
      },
    });
  },

  pairPresented({ pair, category }: PracticePairContext): void {
    trackLearningEvent({
      name: 'pair_presented',
      properties: {
        ...identifyPair({ pair, category }),
        difficulty_tier: pair.difficulty,
      },
    });
  },

  answerSubmitted({
    pair,
    category,
    correct,
    responseTimeMs,
  }: PracticePairContext & {
    correct: boolean;
    responseTimeMs: number;
  }): void {
    trackLearningEvent({
      name: 'pair_answered',
      properties: {
        ...identifyPair({ pair, category }),
        correct,
        response_time_ms: responseTimeMs,
      },
    });
  },

  comparisonOpened({
    pair,
    category,
    chosenIndex,
    correctIndex,
    responseTimeMs,
  }: PracticePairContext & {
    chosenIndex: 0 | 1;
    correctIndex: 0 | 1;
    responseTimeMs: number;
  }): void {
    const words = [pair.word1, pair.word2];
    trackLearningEvent({
      name: 'compare_mode_opened',
      properties: {
        ...identifyPair({ pair, category }),
        incorrect_attempt_context: {
          chosen_word: words[chosenIndex],
          correct_word: words[correctIndex],
          response_time_ms: responseTimeMs,
        },
      },
    });
  },

  pairSelected({ pair, category }: PracticePairContext): void {
    trackLearningEvent({
      name: 'pair_selected',
      properties: identifyPair({ pair, category }),
    });
  },
};
