// hooks/useSpeech.ts
// -----------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react';
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
  const silentSoundRef = useRef<Audio.Sound | null>(null);
  const availableVoicesRef = useRef<Speech.Voice[] | null>(null);
  const audioModeConfiguredRef = useRef(false);

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

  // Check if we're on a real device vs simulator
  useEffect(() => {
    let cancelled = false;
    debugLog('🚀 useAudio mounted - starting initialization');

    const checkPlatform = async () => {
      try {
        debugLog('📱 Platform:', Platform.OS);

        if (Platform.OS === 'ios') {
          // Configure audio session to play even when device is in silent mode
          // This is critical for TTS to work when the phone is in silent mode
          debugLog('🔧 Configuring audio mode…');
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
            shouldDuckAndroid: false,
            interruptionModeIOS: 2, // INTERRUPTION_MODE_IOS_DUCK_OTHERS
            allowsRecordingIOS: false,
          });
          audioModeConfiguredRef.current = true;
          debugLog('✅ Audio mode configured for silent mode playback');

          // WORKAROUND: Play a silent audio file to enable TTS in silent mode
          // This is a known workaround for expo-speech on iOS
          // See: https://stackoverflow.com/questions/61949934/expo-speech-not-working-on-some-ios-devices/62331403#62331403
          try {
            debugLog('🔇 Loading silent audio file…');
            const { sound } = await Audio.Sound.createAsync(
              require('../../assets/audio/silent.mp3')
            );
            silentSoundRef.current = sound;
            await sound.playAsync();
            debugLog('✅ Silent audio played - iOS silent-mode workaround enabled');
          } catch (soundError) {
            debugWarn(
              '⚠️ Could not load silent audio, TTS may not work in silent mode:',
              soundError
            );
          }

          // iOS Simulator doesn't support TTS - check if voices are available
          if (!availableVoicesRef.current) {
            debugLog('🔧 Fetching available voices…');
            const voices = await Speech.getAvailableVoicesAsync();
            availableVoicesRef.current = voices;

            if (voices.length === 0) {
              debugWarn('⚠️ No TTS voices available - likely running on iOS Simulator');
            } else {
              debugLog(`✅ Found ${voices.length} TTS voices available`);
            }
          }
        } else {
          // On Android, just configure audio mode
          await Audio.setAudioModeAsync({
            playsInSilentModeIOS: false,
            staysActiveInBackground: false,
            shouldDuckAndroid: true,
          });
          audioModeConfiguredRef.current = true;
          debugLog('✅ Audio mode configured for Android');
        }

        // Audio system is ready
        if (!cancelled) {
          setAudioModeReady(true);
        }
        debugLog('✅ Audio system fully initialized and ready');
      } catch (error) {
        debugError('❌ Error initializing audio system:', error);
        if (error instanceof Error) {
          debugError('❌ Error message:', error.message);
          debugError('❌ Error stack:', error.stack);
        }
        // Set ready anyway so app doesn't block
        if (!cancelled) {
          setAudioModeReady(true);
        }
      }
    };

    checkPlatform();

    // Cleanup: unload silent sound
    return () => {
      cancelled = true;
      const silentSound = silentSoundRef.current;
      silentSoundRef.current = null;
      if (silentSound) {
        (async () => {
          try {
            await silentSound.stopAsync().catch(() => undefined);
          } finally {
            await silentSound.unloadAsync();
          }
        })().catch((error) => {
          debugWarn('⚠️ Error releasing silent audio resource:', error);
        });
      }
    };
  }, [debugError, debugLog, debugWarn]);

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
        const voices =
          availableVoicesRef.current ??
          (availableVoicesRef.current = await Speech.getAvailableVoicesAsync());
        if (voices.length === 0) {
          throw new Error('TTS not available on iOS Simulator. Please test on a physical device.');
        }

        // Re-ensure audio mode is set before each playback to handle cases
        // where the audio session might have been interrupted or reset
        if (!audioModeConfiguredRef.current) {
          try {
            await Audio.setAudioModeAsync({
              playsInSilentModeIOS: true,
              staysActiveInBackground: false,
              shouldDuckAndroid: false,
              interruptionModeIOS: 2, // INTERRUPTION_MODE_IOS_DUCK_OTHERS
              allowsRecordingIOS: false,
            });
            audioModeConfiguredRef.current = true;
            debugLog('🔧 Audio mode re-confirmed before playback');
          } catch (error) {
            debugWarn('⚠️ Error re-setting audio mode (continuing anyway):', error);
          }
        }
      }

      // Stop any ongoing speech
      if (isSpeaking) {
        try {
          await Speech.stop();
        } catch (error) {
          debugWarn('⚠️ Error stopping speech:', error);
        }
      }

      const word = idx === 0 ? selectedPair.word1 : selectedPair.word2;

      debugLog(`🔊 Attempting to speak: "${word}" at rate ${rate}`);
      if (voice) {
        debugLog(`🎤 Using voice: ${voice.name} (${voice.identifier})`);
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
          debugLog(`✅ Successfully spoke: "${word}"`);
        },
        onStopped: () => {
          setIsSpeaking(false);
          debugLog(`⏸️ Speech stopped for: "${word}"`);
        },
        onError: (error) => {
          setIsSpeaking(false);
          debugError(`❌ TTS Error for "${word}":`, error);
        },
      };

      try {
        // Log speech attempt details
        debugLog('📋 Speech options:', {
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
        debugError(`❌ Exception during speech playback: "${word}"`, error);
        throw error;
      }
    },
    [debugError, debugLog, debugWarn, isSpeaking, rate, selectedPair, voice]
  );

  return { play, audioModeReady, isSpeaking };\n};
};
