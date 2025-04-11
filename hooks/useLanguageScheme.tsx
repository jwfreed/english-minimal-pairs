import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
} from 'react';
import { alternateLanguages } from '../constants/alternateLanguages';

// Compute the default language only once at the module level.
const DEFAULT_LANGUAGE = Object.keys(alternateLanguages)[0];

interface LanguageSchemeContextProps {
  language: string;
  setLanguage: (lang: string) => void;
  t: (key: string) => string;
  // Persist the category index so it doesn't reset on re-mount
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

  // Memoize the translation function so it only changes when the language changes.
  const t = useCallback(
    (key: string) => alternateLanguages[language]?.[key] || key,
    [language]
  );

  // Memoize the provider value to prevent unnecessary re-renders.
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      categoryIndex,
      setCategoryIndex,
    }),
    [language, t, categoryIndex]
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
