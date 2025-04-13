import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { alternateLanguages } from '../constants/alternateLanguages';

const STORAGE_KEY = '@userLanguage';
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
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [categoryIndex, setCategoryIndex] = useState(0);

  // Load language from storage
  useEffect(() => {
    const loadLanguage = async () => {
      const storedLang = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedLang && alternateLanguages[storedLang]) {
        setLanguageState(storedLang);
      }
    };
    loadLanguage();
  }, []);

  // Update both state and storage
  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang);
  }, []);

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
    [language, setLanguage, translate, categoryIndex]
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
