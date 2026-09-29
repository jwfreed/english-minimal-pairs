import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useLanguage } from '@/src/context/LanguageContext';
import { minimalPairs } from '@/src/constants/minimalPairs';

interface CategoryContextValue {
  categoryIndex: number;
  setCategoryIndex: (index: number) => void;
  /**
   * True only when the learner language is explicitly resolved and the
   * active category is that language's inventory. Category-dependent
   * placement and practice must not start before this.
   */
  isCategoryResolved: boolean;
  /** Records an explicit learner-language choice and activates its inventory. */
  selectLearnerCategory: (index: number) => void;
}

const CategoryContext = createContext<CategoryContextValue | undefined>(
  undefined
);

export const CategoryProvider = ({ children }: { children: ReactNode }) => {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const { language, learnerLanguageStatus, setLanguage } = useLanguage();

  useEffect(() => {
    const nextIndex = minimalPairs.findIndex(
      (cat) => cat.category === language
    );
    if (nextIndex !== -1 && nextIndex !== categoryIndex) {
      setCategoryIndex(nextIndex);
    }
  }, [language, categoryIndex]);

  const selectLearnerCategory = useCallback(
    (index: number) => {
      const category = minimalPairs[index];
      if (!category) return;
      setCategoryIndex(index);
      setLanguage(category.category);
    },
    [setLanguage]
  );

  const isCategoryResolved =
    learnerLanguageStatus === 'resolved' &&
    minimalPairs[categoryIndex]?.category === language;

  const value = useMemo(
    () => ({
      categoryIndex,
      setCategoryIndex,
      isCategoryResolved,
      selectLearnerCategory,
    }),
    [categoryIndex, isCategoryResolved, selectLearnerCategory]
  );

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
};

export const useCategory = () => {
  const ctx = useContext(CategoryContext);
  if (!ctx)
    throw new Error('useCategory must be used within a CategoryProvider');
  return ctx;
};
