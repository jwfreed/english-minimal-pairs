// context/SettingsContext.tsx
// -----------------------------------------------------------------------------
// Manages user settings including TTS voice selection
// -----------------------------------------------------------------------------
import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Load saved settings on mount
  useEffect(() => {
    loadSettings();
    loadAvailableVoices();
  }, []);

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        if (settings.selectedVoice) {
          setSelectedVoiceState(settings.selectedVoice);
        }
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const loadAvailableVoices = async () => {
    try {
      setIsLoadingVoices(true);
      const voices = await Speech.getAvailableVoicesAsync();
      
      // Filter to only US (en-US) and UK (en-GB) English voices
      // Also filter by voice name patterns to identify male/female voices
      const filteredVoices = voices.filter((voice) => {
        const lang = voice.language.toLowerCase();
        const name = voice.name.toLowerCase();
        
        // Only include US English (en-US) or UK English (en-GB)
        const isUSorUK = lang.startsWith('en-us') || lang.startsWith('en-gb');
        if (!isUSorUK) return false;
        
        // Filter out voices that are typically enhanced/premium variants
        // Keep standard male and female voices
        const excludePatterns = [
          'enhanced',
          'premium',
          'compact',
          'siri',
          '(enhanced)',
          '(premium)',
        ];
        
        const shouldExclude = excludePatterns.some(pattern => 
          name.includes(pattern.toLowerCase())
        );
        
        return !shouldExclude;
      });
      
      // Sort voices by locale (US first, then UK) and then by name
      const sortedVoices = filteredVoices.sort((a, b) => {
        // Sort US voices before UK voices
        const aIsUS = a.language.toLowerCase().startsWith('en-us');
        const bIsUS = b.language.toLowerCase().startsWith('en-us');
        
        if (aIsUS && !bIsUS) return -1;
        if (!aIsUS && bIsUS) return 1;
        
        // Within same locale, sort by name
        return a.name.localeCompare(b.name);
      });
      
      console.log(`✅ Loaded ${sortedVoices.length} US/UK English voices`);
      setAvailableVoices(sortedVoices);
    } catch (error) {
      console.error('Failed to load voices:', error);
      setAvailableVoices([]);
    } finally {
      setIsLoadingVoices(false);
    }
  };

  const setSelectedVoice = async (voice: Voice | null) => {
    try {
      setSelectedVoiceState(voice);
      
      const settings = {
        selectedVoice: voice,
      };
      
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    } catch (error) {
      console.error('Failed to save voice setting:', error);
    }
  };

  const refreshVoices = async () => {
    await loadAvailableVoices();
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
