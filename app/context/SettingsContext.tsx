// context/SettingsContext.tsx
// -----------------------------------------------------------------------------
// Manages user settings including TTS voice pool (auto-rotation) and haptics.
// Users can exclude specific voices via the Settings UI; excluded identifiers
// are persisted so they survive restarts.
// -----------------------------------------------------------------------------
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

const SETTINGS_STORAGE_KEY = '@userSettings';
const EXCLUDED_VOICES_KEY = '@excludedVoices';

type Voice = Speech.Voice;

interface SettingsContextType {
  /** All available en-* voices (auto-collected, sorted) */
  allVoices: Voice[];
  /** Active voice pool (allVoices minus excluded) */
  voicePool: Voice[];
  /** Convenience count of active voices */
  voiceCount: number;
  /** Set of excluded voice identifiers */
  excludedVoiceIds: Set<string>;
  /** Toggle a voice in/out of the pool */
  toggleVoice: (identifier: string) => void;
  /** Round-robin: returns the next voice from the active pool */
  getNextVoice: () => Voice | null;
  isLoadingVoices: boolean;
  refreshVoices: () => Promise<void>;
  hapticsEnabled: boolean;
  setHapticsEnabled: (enabled: boolean) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [allVoices, setAllVoices] = useState<Voice[]>([]);
  const [excludedVoiceIds, setExcludedVoiceIds] = useState<Set<string>>(new Set());
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [hapticsEnabled, setHapticsEnabledState] = useState(true);
  const isMountedRef = useRef(true);
  const rotationIndexRef = useRef(0);

  // Derive active pool from allVoices - excludedVoiceIds
  const voicePool = useMemo(
    () => allVoices.filter((v) => !excludedVoiceIds.has(v.identifier)),
    [allVoices, excludedVoiceIds]
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const debugLog = useCallback(
    (...args: Parameters<typeof console.log>) => {
      if (__DEV__) {
        // console.log(...args);
      }
    },
    []
  );

  const debugWarn = useCallback(
    (...args: Parameters<typeof console.warn>) => {
      if (__DEV__) {
        console.warn(...args);
      }
    },
    []
  );

  const debugError = useCallback(
    (...args: Parameters<typeof console.error>) => {
      if (__DEV__) {
        console.error(...args);
      }
    },
    []
  );

  /**
   * Collect ALL en-* voices from the device TTS engine.
   * Prefer "enhanced" / "premium" quality voices first, then sort by locale
   * so we get good variety (en-US, en-GB, en-AU, en-IN, …).
   */
  const collectEnVoices = useCallback((voices: Speech.Voice[]) => {
    const enVoices = voices.filter((v) =>
      v.language.toLowerCase().startsWith('en')
    );

    // Sort: enhanced quality first, then alphabetical by locale + name
    enVoices.sort((a, b) => {
      const aq = (a.quality ?? '').toLowerCase().includes('enhanced') ? 0 : 1;
      const bq = (b.quality ?? '').toLowerCase().includes('enhanced') ? 0 : 1;
      if (aq !== bq) return aq - bq;
      const locCmp = a.language.localeCompare(b.language);
      if (locCmp !== 0) return locCmp;
      return a.name.localeCompare(b.name);
    });

    debugLog(`✅ Collected ${enVoices.length} en-* voices from device`);
    return enVoices;
  }, [debugLog]);

  const hydrateVoices = useCallback(async () => {
    setIsLoadingVoices(true);
    try {
      // Load excluded list first
      const storedExcluded = await AsyncStorage.getItem(EXCLUDED_VOICES_KEY);
      if (storedExcluded) {
        try {
          const arr: string[] = JSON.parse(storedExcluded);
          setExcludedVoiceIds(new Set(arr));
        } catch { /* ignore bad data */ }
      }

      const voices = await Speech.getAvailableVoicesAsync();
      const pool = collectEnVoices(voices);

      if (!isMountedRef.current) return;

      setAllVoices(pool);
      rotationIndexRef.current = 0;

      if (pool.length === 0) {
        debugWarn('⚠️ No en-* TTS voices found on device');
      } else {
        debugLog(`✅ Voice pool ready: ${pool.length} voices`);
      }
    } catch (error) {
      debugError('Failed to load voices:', error);
      if (isMountedRef.current) {
        setAllVoices([]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoadingVoices(false);
      }
    }
  }, [collectEnVoices, debugError, debugLog, debugWarn]);

  /** Round-robin voice selection — cycles through the pool */
  const getNextVoice = useCallback((): Voice | null => {
    if (voicePool.length === 0) return null;
    const voice = voicePool[rotationIndexRef.current % voicePool.length];
    rotationIndexRef.current = (rotationIndexRef.current + 1) % voicePool.length;
    return voice;
  }, [voicePool]);

  // Load saved settings on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let savedHapticsEnabled = true;
      try {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          if (parsed?.hapticsEnabled !== undefined) {
            savedHapticsEnabled = parsed.hapticsEnabled;
            debugLog('📦 Found saved haptics setting:', savedHapticsEnabled);
          }
        }
      } catch (error) {
        debugError('Failed to load settings:', error);
      }

      if (!cancelled) {
        setHapticsEnabledState(savedHapticsEnabled);
        await hydrateVoices();
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [debugError, debugLog, hydrateVoices]);

  const setHapticsEnabled = useCallback(async (enabled: boolean) => {
    try {
      setHapticsEnabledState(enabled);

      const existingSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      const parsed = existingSettings ? JSON.parse(existingSettings) : {};

      const settings = {
        ...parsed,
        hapticsEnabled: enabled,
      };

      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      debugLog('✅ Saved haptics preference:', enabled);
    } catch (error) {
      debugError('Failed to save haptics setting:', error);
    }
  }, [debugLog, debugError]);

  const refreshVoices = useCallback(async () => {
    await hydrateVoices();
  }, [hydrateVoices]);

  /** Toggle a voice's excluded status and persist the change */
  const toggleVoice = useCallback((identifier: string) => {
    setExcludedVoiceIds((prev) => {
      const next = new Set(prev);
      if (next.has(identifier)) {
        next.delete(identifier);
      } else {
        next.add(identifier);
      }
      // Persist
      AsyncStorage.setItem(EXCLUDED_VOICES_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
    rotationIndexRef.current = 0;
  }, []);

  const value = useMemo(() => ({
    allVoices,
    voicePool,
    voiceCount: voicePool.length,
    excludedVoiceIds,
    toggleVoice,
    getNextVoice,
    isLoadingVoices,
    refreshVoices,
    hapticsEnabled,
    setHapticsEnabled,
  }), [
    allVoices,
    voicePool,
    excludedVoiceIds,
    toggleVoice,
    getNextVoice,
    isLoadingVoices,
    refreshVoices,
    hapticsEnabled,
    setHapticsEnabled,
  ]);

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
