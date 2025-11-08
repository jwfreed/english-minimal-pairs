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
const ENGLISH_UI_OVERRIDE_KEY = '@useEnglishUI';
const DEFAULT_LANGUAGE = Object.keys(alternateLanguages)[0];

/**
 * Maps device locale codes to app language names
 */
const getLanguageFromLocale = (locale: string): string => {
  const languageCode = locale.split('-')[0].toLowerCase();
  
  const localeMap: Record<string, string> = {
    'en': 'English',
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

/**
 * Maps device region codes to app language names
 * Used when system language is English but region supports another language
 */
const getLanguageFromRegion = (locale: string): string | null => {
  const regionCode = locale.split('-')[1]?.toUpperCase();
  if (!regionCode) return null;
  
  const regionMap: Record<string, string> = {
    'JP': '日本語',
    'CN': '中文',
    'TW': '中文',
    'HK': '廣東話',
    'TH': 'ภาษาไทย',
    'KR': '한국어',
    'IN': 'हिंदी/اردو',
    'PK': 'हिंदी/اردو',
    'PT': 'Português',
    'BR': 'Português',
    'TR': 'Türkçe',
    'ES': 'idioma español',
    'MX': 'idioma español',
    'AR': 'idioma español',
    'CO': 'idioma español',
    'CL': 'idioma español',
    'PE': 'idioma español',
    'VE': 'idioma español',
    'SA': 'اللغة العربية',
    'AE': 'اللغة العربية',
    'EG': 'اللغة العربية',
    'IQ': 'اللغة العربية',
    'JO': 'اللغة العربية',
    'KW': 'اللغة العربية',
    'LB': 'اللغة العربية',
    'RU': 'русский язык',
    'VN': 'Tiếng Việt',
    'IR': 'زبان فارسی',
    'ID': 'bahasa Indo',
  };
  
  return regionMap[regionCode] || null;
};

/**
 * Checks if the region is English-speaking
 */
const isEnglishSpeakingRegion = (locale: string): boolean => {
  const regionCode = locale.split('-')[1]?.toUpperCase();
  if (!regionCode) return false;
  
  const englishRegions = ['US', 'GB', 'CA', 'AU', 'NZ', 'IE', 'ZA', 'SG'];
  return englishRegions.includes(regionCode);
};

interface LanguageContextValue {
  language: string;
  setLanguage: (lang: string) => void;
  translate: (key: string) => string;
  useEnglishUI: boolean;
  setUseEnglishUI: (value: boolean) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [useEnglishUI, setUseEnglishUIState] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    // Prevent double initialization
    if (isInitialized) {
      return;
    }
    
    const initializeLanguage = async () => {
      // Check if user has previously set a language
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      const englishUIOverride = await AsyncStorage.getItem(ENGLISH_UI_OVERRIDE_KEY);
      
      // Check if user has manually set the English UI override
      const hasManualEnglishUIOverride = englishUIOverride !== null;
      
      if (hasManualEnglishUIOverride) {
        setUseEnglishUIState(englishUIOverride === 'true');
      }
      
      if (stored && alternateLanguages[stored]) {
        // Use previously saved language
        setLanguageState(stored);
      } else {
        // Auto-detect from device locale
        const deviceLocale = Localization.getLocales()[0]?.languageTag || 'en';
        const languageCode = deviceLocale.split('-')[0].toLowerCase();
        const detectedLanguage = getLanguageFromLocale(deviceLocale);
        const regionLanguage = getLanguageFromRegion(deviceLocale);
        const isEnglishRegion = isEnglishSpeakingRegion(deviceLocale);
        
        // Case 1: System language is one of our supported languages in an English-speaking region
        // Example: ja-US (Japanese in US) → App: Japanese, UI: English
        if (isEnglishRegion && 
            languageCode !== 'en' && 
            alternateLanguages[detectedLanguage]) {
          setLanguageState(detectedLanguage);
          if (!hasManualEnglishUIOverride) {
            setUseEnglishUIState(true);
            await AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, 'true');
          }
        }
        // Case 2: System language is English but region supports another language
        // Example: en-JP (English in Japan) → App: Japanese, UI: English
        else if (languageCode === 'en' && regionLanguage && alternateLanguages[regionLanguage]) {
          setLanguageState(regionLanguage);
          if (!hasManualEnglishUIOverride) {
            setUseEnglishUIState(true);
            await AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, 'true');
          }
        }
        // Case 3: System language matches region (or no specific region handling needed)
        // Example: ja-JP (Japanese in Japan) → App: Japanese, UI: Japanese
        else if (alternateLanguages[detectedLanguage]) {
          setLanguageState(detectedLanguage);
          // System language is supported and not English-with-region, use native UI
          if (!hasManualEnglishUIOverride && detectedLanguage !== 'English') {
            setUseEnglishUIState(false);
            await AsyncStorage.removeItem(ENGLISH_UI_OVERRIDE_KEY);
          }
        }
        // Case 4: Neither system language nor region is supported
        // Example: fr-FR (French in France) → App: English, UI: English
        else {
          if (!hasManualEnglishUIOverride) {
            setUseEnglishUIState(true);
            await AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, 'true');
          }
          setLanguageState(DEFAULT_LANGUAGE);
        }
      }
      
      setIsInitialized(true);
    };
    
    initializeLanguage();
  }, [isInitialized]);

  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const setUseEnglishUI = useCallback((value: boolean) => {
    setUseEnglishUIState(value);
    AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, value.toString());
  }, []);

  const translate = useCallback(
    (key: string) => {
      // If English UI override is enabled, always use English translations
      const targetLanguage = useEnglishUI ? 'English' : language;
      return alternateLanguages[targetLanguage]?.[key] || key;
    },
    [language, useEnglishUI]
  );

  const value = useMemo(
    () => ({ language, setLanguage, translate, useEnglishUI, setUseEnglishUI }),
    [language, setLanguage, translate, useEnglishUI, setUseEnglishUI]
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
