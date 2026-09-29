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
import { alternateLanguages } from '@/src/constants/alternateLanguages';
import {
  DEFAULT_LANGUAGE_CODE,
  englishSpeakingRegions,
  localeLanguageMap,
  regionLanguageMap,
} from '@/src/constants/languageSelection';
import { TranslationKey } from '@/src/constants/translationKeys';
import { minimalPairs } from '@/src/constants/minimalPairs';
import { resolveTranslation } from '@/utils/resolveTranslation';

const STORAGE_KEY = '@userLanguage';
const ENGLISH_UI_OVERRIDE_KEY = '@useEnglishUI';
const MANUAL_ENGLISH_UI_KEY = '@manualEnglishUIToggle';
const DEFAULT_LANGUAGE = Object.keys(alternateLanguages)[0];

/**
 * Migration map for renamed language keys.
 * Maps old stored values to new key names so existing users don't lose their preference.
 */
const LANGUAGE_KEY_MIGRATION: Record<string, string> = {
  'idioma español': 'Español',
  'اللغة العربية': 'العربية',
  'русский язык': 'Русский',
  'زبان فارسی': 'فارسی',
  'bahasa Indo': 'Bahasa Indonesia',
  'हिंदी/اردو': 'हिन्दी / اردو',
};

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
  return localeLanguageMap[languageCode] || DEFAULT_LANGUAGE;
};

/**
 * Maps device region codes to app language names
 * Used when system language is English but region supports another language
 */
const getLanguageFromRegion = (regionCode?: string): string | null => {
  if (!regionCode) return null;
  return regionLanguageMap[regionCode] || null;
};

/**
 * Checks if the region is English-speaking
 */
const isEnglishSpeakingRegion = (regionCode?: string): boolean => {
  if (!regionCode) return false;
  return englishSpeakingRegions.has(regionCode);
};

/** A learner language (L1 background) is one of the training inventories. */
export const isLearnerLanguage = (label: string | null | undefined): boolean =>
  !!label && minimalPairs.some((category) => category.category === label);

/**
 * The learner's L1 background selects the training inventory and is distinct
 * from the UI language. It is resolved only by an explicit, persisted choice;
 * device-locale detection may pick a UI language but never an inventory.
 */
export type LearnerLanguageStatus = 'loading' | 'unresolved' | 'resolved';

interface LanguageContextValue {
  /**
   * The chosen learner language once resolved; before that, a UI-language
   * placeholder that must not be used to select an inventory.
   */
  language: string;
  learnerLanguageStatus: LearnerLanguageStatus;
  /** Records an explicit learner-language (L1) choice. */
  setLanguage: (lang: string) => void;
  translate: (key: TranslationKey) => string;
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
  const [learnerLanguageStatus, setLearnerLanguageStatus] =
    useState<LearnerLanguageStatus>('loading');

  useEffect(() => {
    // Prevent double initialization
    if (isInitialized) {
      return;
    }
    
    const initializeLanguage = async () => {
      // Check if user has previously set a language
      let stored = await AsyncStorage.getItem(STORAGE_KEY);
      const englishUIOverride = await AsyncStorage.getItem(ENGLISH_UI_OVERRIDE_KEY);
      const manualToggle = await AsyncStorage.getItem(MANUAL_ENGLISH_UI_KEY);
      
      // Migrate old language key names to new ones
      if (stored && LANGUAGE_KEY_MIGRATION[stored]) {
        stored = LANGUAGE_KEY_MIGRATION[stored];
        await AsyncStorage.setItem(STORAGE_KEY, stored);
      }
      
      // Check if user has MANUALLY toggled the English UI (not just auto-set)
      const hasManualEnglishUIOverride = manualToggle === 'true';
      
      if (hasManualEnglishUIOverride) {
        setUseEnglishUIState(englishUIOverride === 'true');
      }
      
      setLearnerLanguageStatus(
        isLearnerLanguage(stored) ? 'resolved' : 'unresolved'
      );

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
        // Auto-detect a UI language from the device locale. This never chooses
        // the learner's training inventory; the learner confirms that
        // explicitly before placement or practice.
        const { languageCode, regionCode } = getDeviceLocaleInfo();
        const detectedLanguage = getLanguageFromLocale(languageCode);
        const regionLanguage = getLanguageFromRegion(regionCode);
        const isEnglishRegion = isEnglishSpeakingRegion(regionCode);
        
        // Scenario 1: Locale English, System English
        // Example: en-US -> UI: English; the learner language stays unresolved
        if (isEnglishRegion && languageCode === 'en') {
          setLanguageState(DEFAULT_LANGUAGE);
          if (!hasManualEnglishUIOverride) {
            setUseEnglishUIState(true);
            await AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, 'true');
          }
        }
        // Scenario 2: Locale English, System Supported (non-English)
        // Example: ja-US -> App: Japanese, UI: English (Enabled)
        else if (isEnglishRegion && alternateLanguages[detectedLanguage] && detectedLanguage !== 'English') {
          setLanguageState(detectedLanguage);
          if (!hasManualEnglishUIOverride) {
            setUseEnglishUIState(true);
            await AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, 'true');
          }
        }
        // Scenario 3: Locale Supported, System Supported
        // Example: ja-JP -> App: Japanese, UI: Native (Disabled)
        else if (!isEnglishRegion && alternateLanguages[detectedLanguage] && detectedLanguage !== 'English') {
          setLanguageState(detectedLanguage);
          if (!hasManualEnglishUIOverride) {
            setUseEnglishUIState(false);
            await AsyncStorage.removeItem(ENGLISH_UI_OVERRIDE_KEY);
          }
        }
        // Scenario 4: Locale Supported, System English
        // Example: en-JP -> App: Japanese (from region), UI: English (Enabled)
        else if (!isEnglishRegion && languageCode === 'en' && regionLanguage && alternateLanguages[regionLanguage]) {
          setLanguageState(regionLanguage);
          if (!hasManualEnglishUIOverride) {
            setUseEnglishUIState(true);
            await AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, 'true');
          }
        }
        // Fallback: Unsupported locale/system
        // Example: fr-FR -> App: English, UI: English (Enabled)
        else {
          setLanguageState(DEFAULT_LANGUAGE);
          if (!hasManualEnglishUIOverride) {
            setUseEnglishUIState(true);
            await AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, 'true');
          }
        }
      }
      
      setIsInitialized(true);
    };
    
    initializeLanguage().catch(() => {
      // Unknown preferences must not leave practice blocked on loading; the
      // learner can still choose their language explicitly.
      setLearnerLanguageStatus((status) =>
        status === 'loading' ? 'unresolved' : status
      );
      setIsInitialized(true);
    });
  }, [isInitialized]);

  const setLanguage = useCallback((lang: string) => {
    setLanguageState(lang);
    setLearnerLanguageStatus(
      isLearnerLanguage(lang) ? 'resolved' : 'unresolved'
    );
    AsyncStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const setUseEnglishUI = useCallback((value: boolean) => {
    setUseEnglishUIState(value);
    AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, value.toString());
    // Mark this as a manual toggle so we don't override it with locale detection
    AsyncStorage.setItem(MANUAL_ENGLISH_UI_KEY, 'true');
  }, []);

  const translate = useCallback(
    (key: TranslationKey) => {
      // If English UI override is enabled, always use English translations
      const targetLanguage = useEnglishUI ? 'English' : language;

      return resolveTranslation(targetLanguage, key, {
        isDevelopment: __DEV__,
        onMissing: __DEV__ ? (message) => console.warn(message) : undefined,
      });
    },
    [language, useEnglishUI]
  );

  const value = useMemo(
    () => ({
      language,
      learnerLanguageStatus,
      setLanguage,
      translate,
      useEnglishUI,
      setUseEnglishUI,
    }),
    [
      language,
      learnerLanguageStatus,
      setLanguage,
      translate,
      useEnglishUI,
      setUseEnglishUI,
    ]
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
