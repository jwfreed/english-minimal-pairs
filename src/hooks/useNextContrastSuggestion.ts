import { useMemo } from 'react';

import { minimalPairs } from '@/src/constants/minimalPairs';
import { CONTRAST_PRACTICE_SUGGESTION_ENABLED } from '@/src/config/featureFlags';
import { useCategory } from '@/src/context/CategoryContext';
import { useLanguage } from '@/src/context/LanguageContext';
import { usePairProgress } from '@/src/context/PairProgressContext';
import { historicalIdentityMapping } from '@/src/domain/compatibility/historicalIdentityMapping';
import { projectPairProgressToContrasts } from '@/src/domain/contrast/pairProgressProjection';
import {
  PRODUCT_SUFFICIENCY_MINIMUM_ATTRIBUTED_ATTEMPTS,
  getNextContrastSuggestion,
  type ContrastPracticeSuggestion,
} from '@/src/domain/practice/nextContrastSuggestion';

export function useNextContrastSuggestion(
  currentGroup: string | undefined
): ContrastPracticeSuggestion {
  const { progress, isLoading } = usePairProgress();
  const { categoryIndex } = useCategory();
  const { language } = useLanguage();

  return useMemo(() => {
    if (!CONTRAST_PRACTICE_SUGGESTION_ENABLED) return null;
    if (isLoading) return null;

    const category = minimalPairs[categoryIndex];
    if (!category || category.category !== language || !currentGroup) {
      return null;
    }

    const languageId =
      historicalIdentityMapping.resolveCategoryLabel(language);
    const currentContrastId = historicalIdentityMapping.resolveContrast(
      language,
      currentGroup
    );
    if (!languageId || !currentContrastId) return null;

    try {
      const projection = projectPairProgressToContrasts(progress);
      return getNextContrastSuggestion({
        projection,
        languageId,
        currentContrastId,
        evaluationTimestamp: Date.now(),
        minimumAttributedAttemptCount:
          PRODUCT_SUFFICIENCY_MINIMUM_ATTRIBUTED_ATTEMPTS,
      });
    } catch {
      return null;
    }
  }, [categoryIndex, currentGroup, isLoading, language, progress]);
}
