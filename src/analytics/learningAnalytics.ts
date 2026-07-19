/**
 * Identifier contract:
 * - contrast_id is the dataset's stable Pair.group value, never a phoneme label.
 * - pair_id is the canonical value produced by buildPairId, never UI copy.
 */
export type LearningAnalyticsEvent =
  | {
      name: 'contrast_practice_started';
      properties: {
        contrast_id: string;
        mastery_level: number;
      };
    }
  | {
      name: 'pair_presented';
      properties: {
        contrast_id: string;
        pair_id: string;
        difficulty_tier: number;
      };
    }
  | {
      name: 'pair_answered';
      properties: {
        contrast_id: string;
        pair_id: string;
        correct: boolean;
        response_time_ms: number;
      };
    }
  | {
      name: 'compare_mode_opened';
      properties: {
        contrast_id: string;
        pair_id: string;
        incorrect_attempt_context: {
          chosen_word: string;
          correct_word: string;
          response_time_ms: number;
        };
      };
    }
  | {
      name: 'pair_selected';
      properties: {
        contrast_id: string;
        pair_id: string;
      };
    };

export type LearningAnalyticsSink = (
  event: LearningAnalyticsEvent
) => void | Promise<void>;

function reportDeliveryFailure(error: unknown): void {
  if (__DEV__) {
    console.warn('[learning-analytics] Event delivery failed', error);
  }
}

const defaultSink: LearningAnalyticsSink = (event) => {
  if (__DEV__) {
    console.debug('[learning-analytics]', event.name, event.properties);
  }
};

let sink: LearningAnalyticsSink = defaultSink;

/**
 * Installs the app's analytics adapter without coupling learning code to a
 * provider. Passing null restores the development logger / production no-op.
 * The returned function restores the previous adapter, which also keeps tests
 * and temporary integrations isolated.
 */
export function setLearningAnalyticsSink(
  nextSink: LearningAnalyticsSink | null
): () => void {
  const previousSink = sink;
  sink = nextSink ?? defaultSink;

  return () => {
    sink = previousSink;
  };
}

/** Analytics must never interrupt a practice round if an adapter fails. */
export function trackLearningEvent(event: LearningAnalyticsEvent): void {
  try {
    const delivery = sink(event);
    if (delivery) {
      void delivery.catch(reportDeliveryFailure);
    }
  } catch (error) {
    reportDeliveryFailure(error);
  }
}
