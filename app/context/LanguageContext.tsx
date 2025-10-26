// src/context/LanguageContext.tsx
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useMemo,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Localization from 'expo-localization';
import { alternateLanguages } from '@/app/constants/alternateLanguages';

const STORAGE_KEY = '@userLanguage';
const DEFAULT_LANGUAGE = Object.keys(alternateLanguages)[0];

/**
 * Maps device locale codes to app language names
 */
const getLanguageFromLocale = (locale: string): string => {
  const languageCode = locale.split('-')[0].toLowerCase();
  
  const localeMap: Record<string, string> = {
    'ja': '日本語',
    'zh': '中文',
    'th': 'ภาษาไทย',
    'ko': '한국어',
    'hi': 'हिंदी/اردو',
    'ur': 'हिंदी/اردو',
    'pt': 'Português',
    'tr': 'Türkçe',
    'yue': '廣東話',
    'es': 'idioma español',
    'ar': 'اللغة العربية',
    'ru': 'русский язык',
    'vi': 'Tiếng Việt',
    'fa': 'زبان فارسی',
    'id': 'bahasa Indo',
  };
  
  return localeMap[languageCode] || DEFAULT_LANGUAGE;
};

interface LanguageContextValue {
  language: string;
  setLanguage: (lang: string) => void;
  translate: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    const initializeLanguage = async () => {
      // First check if user has previously set a language
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      
      if (stored && alternateLanguages[stored]) {
        // Use previously saved language
        setLanguageState(stored);
      } else {
        // Auto-detect from device locale
        const deviceLocale = Localization.getLocales()[0]?.languageTag || 'en';
        const detectedLanguage = getLanguageFromLocale(deviceLocale);
        
        if (alternateLanguages[detectedLanguage]) {
          setLanguageState(detectedLanguage);
          // Don't save to storage yet - only save when user manually changes it
        }
      }
    };
    
    initializeLanguage();
  }, []);

  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const translate = useCallback(
    (key: string) => alternateLanguages[language]?.[key] || key,
    [language]
  );

  const value = useMemo(
    () => ({ language, setLanguage, translate }),
    [language, setLanguage, translate]
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx)
    throw new Error('useLanguage must be used within a LanguageProvider');
  return ctx;
};
