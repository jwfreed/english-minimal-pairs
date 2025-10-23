// context/SettingsContext.tsx
// -----------------------------------------------------------------------------
// Manages user settings including TTS voice selection
// -----------------------------------------------------------------------------
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

const SETTINGS_STORAGE_KEY = '@userSettings';

type Voice = Speech.Voice;

interface SettingsContextType {
  selectedVoice: Voice | null;
  availableVoices: Voice[];
  isLoadingVoices: boolean;
  setSelectedVoice: (voice: Voice | null) => Promise<void>;
  refreshVoices: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedVoice, setSelectedVoiceState] = useState<Voice | null>(null);
  const [availableVoices, setAvailableVoices] = useState<Voice[]>([]);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const debugLog = useCallback(
    (...args: Parameters<typeof console.log>) => {
      if (__DEV__) {
        console.log(...args);
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

  const selectPriorityVoices = useCallback((voices: Speech.Voice[]) => {
    const selectedVoices: Speech.Voice[] = [];

    const samantha = voices.find(
      (v) =>
        v.name === 'Samantha' && v.language.toLowerCase().startsWith('en-us')
    );
    if (samantha) {
      selectedVoices.push(samantha);
      debugLog('✅ Found US Female: Samantha');
    } else {
      debugWarn('❌ Samantha (US Female) not found');
      const usFallback = voices.find((v) =>
        v.language.toLowerCase().startsWith('en-us')
      );
      if (usFallback) {
        selectedVoices.push(usFallback);
        debugWarn(`⚠️  Using fallback US voice: ${usFallback.name}`);
      }
    }

    const daniel = voices.find(
      (v) =>
        v.name === 'Daniel' && v.language.toLowerCase().startsWith('en-gb')
    );
    if (daniel) {
      selectedVoices.push(daniel);
      debugLog('✅ Found UK Male: Daniel');
    } else {
      debugWarn('❌ Daniel (UK Male) not found');
      const ukFallback = voices.find((v) =>
        v.language.toLowerCase().startsWith('en-gb')
      );
      if (ukFallback) {
        selectedVoices.push(ukFallback);
        debugWarn(`⚠️  Using fallback UK voice: ${ukFallback.name}`);
      }
    }

    return selectedVoices;
  }, [debugLog, debugWarn]);

  const resolvePreferredVoice = useCallback(
    (voices: Voice[], preferredIdentifier: string | null | undefined) => {
      if (voices.length === 0) {
        return null;
      }

      if (preferredIdentifier === null) {
        // Explicit request for system default
        return null;
      }

      if (preferredIdentifier) {
        const match = voices.find(
          (voice) => voice.identifier === preferredIdentifier
        );
        if (match) {
          return match;
        }
      }

      return voices[0] ?? null;
    },
    []
  );

  const hydrateVoices = useCallback(
    async (preferredIdentifier?: string | null) => {
      setIsLoadingVoices(true);
      try {
        const voices = await Speech.getAvailableVoicesAsync();
        debugLog(
          '🎤 Available voices:',
          voices.map((v) => `${v.name} (${v.language})`)
        );

        const curatedVoices = selectPriorityVoices(voices);

        if (!isMountedRef.current) {
          return;
        }

        setAvailableVoices(curatedVoices);

        const nextVoice = resolvePreferredVoice(
          curatedVoices,
          preferredIdentifier
        );
        setSelectedVoiceState(nextVoice);

        if (preferredIdentifier && !nextVoice) {
          debugWarn('⚠️ Saved voice not available, using fallback voice');
        }

        if (nextVoice) {
          debugLog('✅ Active voice:', nextVoice.name);
        } else {
          debugLog('✅ Using system default voice');
        }
      } catch (error) {
        debugError('Failed to load voices:', error);
        if (isMountedRef.current) {
          setAvailableVoices([]);
          // Only reset selection if the preference was not explicitly system default (null)
          if (preferredIdentifier !== null) {
            setSelectedVoiceState(null);
          }
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoadingVoices(false);
        }
      }
    },
    [debugError, debugLog, debugWarn, resolvePreferredVoice, selectPriorityVoices]
  );

  // Load saved settings on mount
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      let savedIdentifier: string | null | undefined = undefined;
      try {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          savedIdentifier =
            parsed?.selectedVoiceIdentifier !== undefined
              ? parsed.selectedVoiceIdentifier
              : undefined;
          if (savedIdentifier) {
            debugLog('📦 Found saved voice identifier:', savedIdentifier);
          }
        }
      } catch (error) {
        debugError('Failed to load settings:', error);
      }

      if (!cancelled) {
        await hydrateVoices(savedIdentifier);
      }
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [debugError, debugLog, hydrateVoices]);

  const setSelectedVoice = async (voice: Voice | null) => {
    try {
      setSelectedVoiceState(voice);

      const settings = {
        selectedVoiceIdentifier: voice?.identifier ?? null,
      };

      await AsyncStorage.setItem(
        SETTINGS_STORAGE_KEY,
        JSON.stringify(settings)
      );
      debugLog(
        '✅ Saved voice preference:',
        voice ? voice.name : 'System Default'
      );
    } catch (error) {
      debugError('Failed to save voice setting:', error);
    }
  };

  const refreshVoices = async () => {
    await hydrateVoices(selectedVoice ? selectedVoice.identifier : null);
  };

  return (
    <SettingsContext.Provider
      value={{
        selectedVoice,
        availableVoices,
        isLoadingVoices,
        setSelectedVoice,
        refreshVoices,
      }}
    >
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
