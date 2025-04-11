// /hooks/useLanguageScheme.tsx
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { alternateLanguages } from '../constants/alternateLanguages';

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
  const defaultLanguage = Object.keys(alternateLanguages)[0];
  const [language, setLanguage] = useState(defaultLanguage);
  const [categoryIndex, setCategoryIndex] = useState(0);

  const t = (key: string) => {
    return alternateLanguages[language]?.[key] || key;
  };

  return (
    <LanguageSchemeContext.Provider
      value={{ language, setLanguage, t, categoryIndex, setCategoryIndex }}
    >
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
