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
import {
  advanceRotationIndex,
  applyUserExclusions,
  buildPlaybackVoicePool,
  buildPrioritizedVoiceRotationPool,
  collectEligibleVoices,
  currentRotationIndex,
  type VoicePlaybackContext,
} from '@/src/domain/voiceSelection';

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
  getNextVoice: (context?: VoicePlaybackContext) => Voice | null;
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
  const rotationRef = useRef<{ poolIds: string[]; index: number }>({
    poolIds: [],
    index: 0,
  });

  // Derive active pool from allVoices - excludedVoiceIds
  const voicePool = useMemo(
    () => applyUserExclusions(allVoices, excludedVoiceIds),
    [allVoices, excludedVoiceIds]
  );

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const debugLog = useCallback(
    (..._args: Parameters<typeof console.log>) => {},
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

  const hydrateVoices = useCallback(async () => {
    setIsLoadingVoices(true);
    try {
      // Load any user-excluded voices
      const storedExcluded = await AsyncStorage.getItem(EXCLUDED_VOICES_KEY);
      let excludedSet: Set<string>;
      if (storedExcluded) {
        try {
          const arr: string[] = JSON.parse(storedExcluded);
          excludedSet = new Set(arr);
        } catch {
          excludedSet = new Set();
        }
      } else {
        excludedSet = new Set();
      }

      const voices = await Speech.getAvailableVoicesAsync();
      const pool = collectEligibleVoices(voices);

      // Remove any stale exclusions that reference voices no longer in the pool
      // (e.g. novelty voices that are now filtered out at collection time)
      const poolIds = new Set(pool.map((v) => v.identifier));
      const cleaned = new Set([...excludedSet].filter((id) => poolIds.has(id)));
      if (cleaned.size !== excludedSet.size) {
        await AsyncStorage.setItem(
          EXCLUDED_VOICES_KEY,
          JSON.stringify([...cleaned])
        ).catch(() => {});
        excludedSet = cleaned;
      }

      if (!isMountedRef.current) return;

      setExcludedVoiceIds(excludedSet);
      setAllVoices(pool);

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
  }, [debugError, debugLog, debugWarn]);

  /** Round-robin over the prioritized rotation pool; resets on pool change.
   *  The playback context stages how much of the pool is eligible: practice
   *  stages by pair difficulty, placement always uses the full pool. */
  const getNextVoice = useCallback((context?: VoicePlaybackContext): Voice | null => {
    const rotation = buildPlaybackVoicePool(
      buildPrioritizedVoiceRotationPool(voicePool),
      context
    );
    if (rotation.length === 0) return null;
    const index = currentRotationIndex(
      rotationRef.current.poolIds,
      rotationRef.current.index,
      rotation
    );
    const voice = rotation[index];
    rotationRef.current = {
      poolIds: rotation.map((v) => v.identifier),
      index: advanceRotationIndex(index, rotation.length),
    };
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
