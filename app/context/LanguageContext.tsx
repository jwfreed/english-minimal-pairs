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
const MANUAL_ENGLISH_UI_KEY = '@manualEnglishUIToggle';
const DEFAULT_LANGUAGE = Object.keys(alternateLanguages)[0];
const DEFAULT_LANGUAGE_CODE = 'en';

interface DeviceLocaleInfo {
  languageCode: string;
  regionCode?: string;
}

const findRegionFromTag = (tag?: string): string | undefined => {
  if (!tag) {
    return undefined;
  }
  const normalizedParts = tag.replace(/_/g, '-').split('-').filter(Boolean);
  for (let i = normalizedParts.length - 1; i >= 1; i -= 1) {
    const part = normalizedParts[i];
    if (
      part.length === 2 &&
      /^[A-Za-z]+$/.test(part) &&
      part === part.toUpperCase()
    ) {
      return part;
    }
  }
  return undefined;
};

const getDeviceLocaleInfo = (): DeviceLocaleInfo => {
  const [primaryLocale] = Localization.getLocales();
  const languageCode =
    primaryLocale?.languageCode?.toLowerCase() ||
    primaryLocale?.languageTag?.split(/[-_]/)[0]?.toLowerCase() ||
    DEFAULT_LANGUAGE_CODE;

  const regionCode =
    primaryLocale?.regionCode ||
    findRegionFromTag(primaryLocale?.languageTag || undefined);

  return {
    languageCode,
    regionCode: regionCode ? regionCode.toUpperCase() : undefined,
  };
};

/**
 * Maps device locale codes to app language names
 */
const getLanguageFromLocale = (languageCode: string): string => {
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
const getLanguageFromRegion = (regionCode?: string): string | null => {
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
const isEnglishSpeakingRegion = (regionCode?: string): boolean => {
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
      const manualToggle = await AsyncStorage.getItem(MANUAL_ENGLISH_UI_KEY);
      
      // Check if user has MANUALLY toggled the English UI (not just auto-set)
      const hasManualEnglishUIOverride = manualToggle === 'true';
      
      if (hasManualEnglishUIOverride) {
        setUseEnglishUIState(englishUIOverride === 'true');
      }
      
      if (stored && alternateLanguages[stored]) {
        // Use previously saved language
        setLanguageState(stored);
        
        // If user has a stored language but NO manual UI override, infer the UI setting
        // based on their current locale (e.g., en-TH should have English UI even with Thai language)
        if (!hasManualEnglishUIOverride) {
          const { languageCode, regionCode } = getDeviceLocaleInfo();
          const isEnglishRegion = isEnglishSpeakingRegion(regionCode);
          const regionLanguage = getLanguageFromRegion(regionCode);
          
          // If in English-speaking region OR English language in non-English region → English UI
          if (isEnglishRegion || (languageCode === 'en' && regionLanguage && alternateLanguages[regionLanguage])) {
            setUseEnglishUIState(true);
            await AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, 'true');
          } else if (stored !== 'English') {
            // Non-English language in native region → native UI
            setUseEnglishUIState(false);
            await AsyncStorage.removeItem(ENGLISH_UI_OVERRIDE_KEY);
          }
        }
      } else {
        // Auto-detect from device locale
        const { languageCode, regionCode } = getDeviceLocaleInfo();
        const detectedLanguage = getLanguageFromLocale(languageCode);
        const regionLanguage = getLanguageFromRegion(regionCode);
        const isEnglishRegion = isEnglishSpeakingRegion(regionCode);
        
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
        // Example: en-JP (English in Japan) → App: Japanese, UI: Japanese (English UI disabled)
        else if (languageCode === 'en' && regionLanguage && alternateLanguages[regionLanguage]) {
          setLanguageState(regionLanguage);
          if (!hasManualEnglishUIOverride) {
            setUseEnglishUIState(false);
            await AsyncStorage.removeItem(ENGLISH_UI_OVERRIDE_KEY);
          }
        }
        // Case 3: System language matches region (or no specific region handling needed)
        // Example: ja-JP (Japanese in Japan) → App: Japanese, UI: Japanese
        // Example: en-US (English in US) → App: English, UI: English
        else if (alternateLanguages[detectedLanguage]) {
          setLanguageState(detectedLanguage);
          if (!hasManualEnglishUIOverride) {
            if (detectedLanguage === 'English') {
              setUseEnglishUIState(true);
              await AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, 'true');
            } else {
              setUseEnglishUIState(false);
              await AsyncStorage.removeItem(ENGLISH_UI_OVERRIDE_KEY);
            }
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
    // Mark this as a manual toggle so we don't override it with locale detection
    AsyncStorage.setItem(MANUAL_ENGLISH_UI_KEY, 'true');
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
