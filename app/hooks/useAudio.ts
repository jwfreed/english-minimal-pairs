// hooks/useSpeech.ts
// -----------------------------------------------------------------------------
import { useCallback, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';
import type { Pair } from '@/app/constants/minimalPairs';

/**
 * Custom hook for text-to-speech playback of minimal pairs
 * @param selectedPair  The currently displayed minimal‑pair object (may be undefined on first render)
 * @param rate          Playback‑rate multiplier (e.g. 0.8, 1.0, 1.1)
 * @param voice         Optional voice to use for speech (from SettingsContext)
 */
export const useAudio = (
  selectedPair: Pair | undefined,
  rate: number,
  voice?: Speech.Voice | null
) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioModeReady, setAudioModeReady] = useState(false);

  // Check if we're on a real device vs simulator
  useEffect(() => {
    console.log('🚀 useAudio useEffect triggered - starting initialization');
    
    const checkPlatform = async () => {
      try {
        console.log('📱 Platform:', Platform.OS);
        
        if (Platform.OS === 'ios') {
          // Configure audio session to play even when device is in silent mode
          // This is critical for TTS to work when the phone is in silent mode
          console.log('🔧 Configuring audio mode...');
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
            interruptionModeIOS: 2, // INTERRUPTION_MODE_IOS_DUCK_OTHERS
            allowsRecordingIOS: false,
          });
          console.log('✅ Audio mode configured for silent mode playback');

          // iOS Simulator doesn't support TTS - check if voices are available
          console.log('🔧 Checking available voices...');
          const voices = await Speech.getAvailableVoicesAsync();
          if (voices.length === 0) {
            console.warn('⚠️ No TTS voices available - you may be on iOS Simulator');
            console.warn('⚠️ TTS only works on physical iOS devices');
          } else {
            console.log(`✅ Found ${voices.length} TTS voices available`);
          }
        } else {
          // On Android, just configure audio mode
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: false,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
          console.log('✅ Audio mode configured for Android');
        }
        
        // Audio system is ready - the native audio session configuration
        // in AppDelegate.swift handles silent mode playback
        setAudioModeReady(true);
        console.log('✅ Audio system fully initialized and ready');
      } catch (error) {
        console.error('❌ Error initializing audio system:', error);
        if (error instanceof Error) {
          console.error('❌ Error message:', error.message);
          console.error('❌ Error stack:', error.stack);
        }
        // audioModeReady stays false, user will see error message if they try to play
      }
    };
    
    checkPlatform();

    // No cleanup needed - audio session persists for app lifetime
  }, []); // Empty array - only run once on mount

  /**
   * Plays the specified word using text-to-speech
   * @param idx 0 for word1, 1 for word2
   */
  const play = useCallback(
    async (idx: 0 | 1) => {
      if (!selectedPair) {
        throw new Error('No pair selected');
      }

      // Check if running on iOS Simulator
      if (Platform.OS === 'ios') {
        const voices = await Speech.getAvailableVoicesAsync();
        if (voices.length === 0) {
          throw new Error('TTS not available on iOS Simulator. Please test on a physical device.');
        }
        
        // Re-ensure audio mode is set before each playback to handle cases
        // where the audio session might have been interrupted or reset
        try {
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
            interruptionModeIOS: 2, // INTERRUPTION_MODE_IOS_DUCK_OTHERS
            allowsRecordingIOS: false,
          });
          console.log('🔧 Audio mode re-confirmed before playback');
        } catch (error) {
          console.warn('⚠️ Error re-setting audio mode (continuing anyway):', error);
        }
      }

      // Stop any ongoing speech
      if (isSpeaking) {
        try {
          await Speech.stop();
        } catch (error) {
          console.warn('⚠️ Error stopping speech:', error);
        }
      }

      const word = idx === 0 ? selectedPair.word1 : selectedPair.word2;
      
      console.log(`🔊 Attempting to speak: "${word}" at rate ${rate}`);
      if (voice) {
        console.log(`🎤 Using voice: ${voice.name} (${voice.identifier})`);
      }

      setIsSpeaking(true);

      // Build speech options with volume explicitly set
      const speechOptions: Speech.SpeechOptions = {
        language: 'en-US', // American English
        pitch: 1.0, // Normal pitch
        rate: rate, // Use the provided rate
        volume: 1.0, // Maximum volume
        ...(voice ? { voice: voice.identifier } : {}),
        onDone: () => {
          setIsSpeaking(false);
          console.log(`✅ Successfully spoke: "${word}"`);
        },
        onStopped: () => {
          setIsSpeaking(false);
          console.log(`⏸️ Speech stopped for: "${word}"`);
        },
        onError: (error) => {
          setIsSpeaking(false);
          console.error(`❌ TTS Error for "${word}":`, error);
        },
      };

      try {
        // Log speech attempt details
        console.log('📋 Speech options:', {
          word,
          language: speechOptions.language,
          rate: speechOptions.rate,
          pitch: speechOptions.pitch,
          volume: speechOptions.volume,
          voice: voice?.name || 'system default',
        });
        
        Speech.speak(word, speechOptions);
      } catch (error) {
        setIsSpeaking(false);
        console.error(`❌ Exception during speech playback: "${word}"`, error);
        throw error;
      }
    },
    [selectedPair, rate, voice, isSpeaking]
  );

  return { play, audioModeReady };
};