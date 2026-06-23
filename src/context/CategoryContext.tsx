import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { useLanguage } from '@/src/context/LanguageContext';
import { minimalPairs } from '@/src/constants/minimalPairs';

interface CategoryContextValue {
  categoryIndex: number;
  setCategoryIndex: (index: number) => void;
}

const CategoryContext = createContext<CategoryContextValue | undefined>(
  undefined
);

export const CategoryProvider = ({ children }: { children: ReactNode }) => {
  const [categoryIndex, setCategoryIndex] = useState(0);
  const { language } = useLanguage();

  useEffect(() => {
    const nextIndex = minimalPairs.findIndex(
      (cat) => cat.category === language
    );
    if (nextIndex !== -1 && nextIndex !== categoryIndex) {
      setCategoryIndex(nextIndex);
    }
  }, [language, categoryIndex]);

  return (
    <CategoryContext.Provider value={{ categoryIndex, setCategoryIndex }}>
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
