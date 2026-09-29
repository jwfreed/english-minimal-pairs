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
 * Checks if the region is English-speaking
 */
const isEnglishSpeakingRegion = (regionCode?: string): boolean => {
  if (!regionCode) return false;
  return englishSpeakingRegions.has(regionCode);
};

/**
 * The UI language the device asks for: its language when the app supports it
 * as a UI language, otherwise English. English-speaking regions and English
 * devices use English. Independent of the learner's native language.
 */
const resolveDeviceUILanguage = ({
  languageCode,
  regionCode,
}: DeviceLocaleInfo): string => {
  if (isEnglishSpeakingRegion(regionCode)) return 'English';
  const detected = localeLanguageMap[languageCode];
  return detected && alternateLanguages[detected] ? detected : 'English';
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
   * The chosen learner language once resolved; before that, a placeholder
   * that must not be used to select an inventory. Never the UI language.
   */
  language: string;
  learnerLanguageStatus: LearnerLanguageStatus;
  /** Records an explicit learner-language (L1) choice. */
  setLanguage: (lang: string) => void;
  /** Language the interface is shown in: the device's, or forced English. */
  uiLanguage: string;
  translate: (key: TranslationKey) => string;
  /** Whether the interface is currently shown in English. */
  useEnglishUI: boolean;
  /** Explicitly forces English (true) or returns to the device language. */
  setUseEnglishUI: (value: boolean) => void;
}

const LanguageContext = createContext<LanguageContextValue | undefined>(
  undefined
);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState(DEFAULT_LANGUAGE);
  const [deviceUILanguage, setDeviceUILanguage] = useState(() =>
    resolveDeviceUILanguage(getDeviceLocaleInfo())
  );
  // Only an explicit toggle is a UI preference; null means "follow device".
  const [manualEnglishUI, setManualEnglishUI] = useState<boolean | null>(null);
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

      // The UI follows the device unless the learner explicitly toggled
      // English UI; the learner language never changes it.
      setDeviceUILanguage(resolveDeviceUILanguage(getDeviceLocaleInfo()));
      if (manualToggle === 'true') {
        setManualEnglishUI(englishUIOverride === 'true');
      }

      setLearnerLanguageStatus(
        isLearnerLanguage(stored) ? 'resolved' : 'unresolved'
      );
      if (stored && alternateLanguages[stored]) {
        setLanguageState(stored);
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
    setManualEnglishUI(value);
    AsyncStorage.setItem(ENGLISH_UI_OVERRIDE_KEY, value.toString());
    // Mark this as a manual toggle so we don't override it with locale detection
    AsyncStorage.setItem(MANUAL_ENGLISH_UI_KEY, 'true');
  }, []);

  const useEnglishUI = manualEnglishUI === true || deviceUILanguage === 'English';
  const uiLanguage = useEnglishUI ? 'English' : deviceUILanguage;

  const translate = useCallback(
    (key: TranslationKey) =>
      resolveTranslation(uiLanguage, key, {
        isDevelopment: __DEV__,
        onMissing: __DEV__ ? (message) => console.warn(message) : undefined,
      }),
    [uiLanguage]
  );

  const value = useMemo(
    () => ({
      language,
      learnerLanguageStatus,
      setLanguage,
      uiLanguage,
      translate,
      useEnglishUI,
      setUseEnglishUI,
    }),
    [
      language,
      learnerLanguageStatus,
      setLanguage,
      uiLanguage,
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
