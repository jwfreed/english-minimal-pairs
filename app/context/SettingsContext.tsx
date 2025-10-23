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
        if (settings.selectedVoiceIdentifier) {
          // Find the voice by identifier from available voices
          // This will be set after voices are loaded
          console.log('📦 Found saved voice identifier:', settings.selectedVoiceIdentifier);
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
      
      console.log('🎤 All available voices:', voices.map(v => `${v.name} (${v.language})`));
      
      // Only use 2 specific voices: Samantha (US Female) and Daniel (UK Male)
      const selectedVoices: Speech.Voice[] = [];
      
      // Find Samantha (US Female)
      const samantha = voices.find(v => 
        v.name === 'Samantha' && 
        v.language.toLowerCase().startsWith('en-us')
      );
      
      if (samantha) {
        selectedVoices.push(samantha);
        console.log('✅ Found US Female: Samantha');
      } else {
        console.warn('❌ Samantha (US Female) not found');
        // Fallback to any US female voice
        const usFemale = voices.find(v => v.language.toLowerCase().startsWith('en-us'));
        if (usFemale) {
          selectedVoices.push(usFemale);
          console.log(`⚠️  Using fallback US voice: ${usFemale.name}`);
        }
      }
      
      // Find Daniel (UK Male)
      const daniel = voices.find(v => 
        v.name === 'Daniel' && 
        v.language.toLowerCase().startsWith('en-gb')
      );
      
      if (daniel) {
        selectedVoices.push(daniel);
        console.log('✅ Found UK Male: Daniel');
      } else {
        console.warn('❌ Daniel (UK Male) not found');
        // Fallback to any UK voice
        const ukVoice = voices.find(v => v.language.toLowerCase().startsWith('en-gb'));
        if (ukVoice) {
          selectedVoices.push(ukVoice);
          console.log(`⚠️  Using fallback UK voice: ${ukVoice.name}`);
        }
      }
      
      console.log(`✅ Selected ${selectedVoices.length} voices:`, 
        selectedVoices.map(v => `${v.name} (${v.language}) [${v.identifier}]`));
      
      setAvailableVoices(selectedVoices);
      
      // Restore previously selected voice if it exists
      try {
        const savedSettings = await AsyncStorage.getItem(SETTINGS_STORAGE_KEY);
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.selectedVoiceIdentifier) {
            const savedVoice = selectedVoices.find(
              v => v.identifier === settings.selectedVoiceIdentifier
            );
            if (savedVoice) {
              setSelectedVoiceState(savedVoice);
              console.log('✅ Restored saved voice:', savedVoice.name);
            } else {
              console.log('⚠️  Saved voice not available, using system default');
            }
          }
        }
      } catch (error) {
        console.error('Failed to restore saved voice:', error);
      }
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
      
      // Only save the voice identifier, not the entire Voice object
      // Voice objects contain complex data that doesn't serialize well
      const settings = {
        selectedVoiceIdentifier: voice?.identifier || null,
      };
      
      await AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      console.log('✅ Saved voice preference:', voice ? voice.name : 'System Default');
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
