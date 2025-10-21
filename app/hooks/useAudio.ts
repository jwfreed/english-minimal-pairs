// hooks/useSpeech.ts
// -----------------------------------------------------------------------------
import { useCallback, useState, useEffect } from 'react';
import { Platform } from 'react-native';
import Tts from 'react-native-tts';
import type { Pair } from '@/app/constants/minimalPairs';

// Type definition for react-native-tts Voice
interface TtsVoice {
  id: string;
  name: string;
  language: string;
  quality: number;
  latency: number;
  networkConnectionRequired: boolean;
  notInstalled: boolean;
}

/**
 * Custom hook for text-to-speech playback of minimal pairs
 * @param selectedPair  The currently displayed minimal‑pair object (may be undefined on first render)
 * @param rate          Playback‑rate multiplier (e.g. 0.8, 1.0, 1.1)
 * @param voice         Optional voice to use for speech (from SettingsContext)
 */
export const useAudio = (
  selectedPair: Pair | undefined,
  rate: number,
  voice?: TtsVoice | null
) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioModeReady, setAudioModeReady] = useState(false);

  // Initialize TTS and configure for silent mode playback
  useEffect(() => {
    console.log('🚀 useAudio useEffect triggered - starting initialization');
    
    const initializeTts = async () => {
      try {
        console.log('📱 Platform:', Platform.OS);
        
        if (Platform.OS === 'ios') {
          // CRITICAL: This enables audio playback even when iPhone is in silent mode
          Tts.setIgnoreSilentSwitch('ignore');
          console.log('✅ TTS configured to ignore silent switch');
          
          // iOS Simulator doesn't support TTS - check if voices are available
          console.log('🔧 Checking available voices...');
          const voices = await Tts.voices();
          if (voices.length === 0) {
            console.warn('⚠️ No TTS voices available - you may be on iOS Simulator');
            console.warn('⚠️ TTS only works on physical iOS devices');
          } else {
            console.log(`✅ Found ${voices.length} TTS voices available`);
          }
        }
        
        // Set default speech rate
        await Tts.setDefaultRate(rate);
        
        // Set up event listeners
        Tts.addEventListener('tts-start', () => {
          console.log('🔊 TTS started');
          setIsSpeaking(true);
        });
        
        Tts.addEventListener('tts-finish', () => {
          console.log('✅ TTS finished');
          setIsSpeaking(false);
        });
        
        Tts.addEventListener('tts-cancel', () => {
          console.log('⏸️ TTS cancelled');
          setIsSpeaking(false);
        });
        
        setAudioModeReady(true);
        console.log('✅ TTS system fully initialized and ready');
      } catch (error) {
        console.error('❌ Error initializing TTS system:', error);
        if (error instanceof Error) {
          console.error('❌ Error message:', error.message);
          console.error('❌ Error stack:', error.stack);
        }
        // audioModeReady stays false, user will see error message if they try to play
      }
    };
    
    initializeTts();

    // Cleanup: remove event listeners
    return () => {
      Tts.removeAllListeners('tts-start');
      Tts.removeAllListeners('tts-finish');
      Tts.removeAllListeners('tts-cancel');
    };
  }, []); // Empty array - only run once on mount

  // Update rate when it changes
  useEffect(() => {
    if (audioModeReady) {
      Tts.setDefaultRate(rate).catch((error) => {
        console.warn('⚠️ Error setting TTS rate:', error);
      });
    }
  }, [rate, audioModeReady]);

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
        const voices = await Tts.voices();
        if (voices.length === 0) {
          throw new Error('TTS not available on iOS Simulator. Please test on a physical device.');
        }
      }

      // Stop any ongoing speech
      if (isSpeaking) {
        try {
          await Tts.stop();
        } catch (error) {
          console.warn('⚠️ Error stopping speech:', error);
        }
      }

      const word = idx === 0 ? selectedPair.word1 : selectedPair.word2;
      
      console.log(`🔊 Attempting to speak: "${word}" at rate ${rate}`);
      if (voice) {
        console.log(`🎤 Using voice: ${voice.name} (${voice.id})`);
      }

      try {
        // Set the voice if one is selected
        if (voice) {
          await Tts.setDefaultVoice(voice.id);
          console.log(`✅ Voice set to: ${voice.name}`);
        }
        
        // Set the rate (may have changed since last play)
        await Tts.setDefaultRate(rate);
        
        // Log speech attempt details
        console.log('📋 Speech options:', {
          word,
          rate,
          voice: voice?.name || 'system default',
        });
        
        // Speak the word
        await Tts.speak(word);
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