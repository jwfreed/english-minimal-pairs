// src/hooks/useLanguageScheme.tsx
import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import { alternateLanguages } from '../constants/alternateLanguages';

const DEFAULT_LANGUAGE = Object.keys(alternateLanguages)[0];

interface LanguageSchemeContextProps {
  language: string;
  setLanguage: (lang: string) => void;
  translate: (key: string) => string;
  categoryIndex: number;
  setCategoryIndex: (index: number) => void;
}

const LanguageSchemeContext = createContext<
  LanguageSchemeContextProps | undefined
>(undefined);

export const LanguageSchemeProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const [language, setLanguage] = useState(DEFAULT_LANGUAGE);
  const [categoryIndex, setCategoryIndex] = useState(0);

  const translate = useCallback(
    (key: string) => alternateLanguages[language]?.[key] || key,
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      translate,
      categoryIndex,
      setCategoryIndex,
    }),
    [language, translate, categoryIndex]
  );

  return (
    <LanguageSchemeContext.Provider value={value}>
      {children}
    </LanguageSchemeContext.Provider>
  );
};

export const useLanguageScheme = () => {
  const context = useContext(LanguageSchemeContext);
  if (!context) {
    throw new Error(
      'useLanguageScheme must be used within a LanguageSchemeProvider'
    );
  }
  return context;
};
