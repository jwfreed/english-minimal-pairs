// -----------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import type { AudioMode } from 'expo-audio';
import type { Pair } from '@/src/constants/minimalPairs';
import {
  buildSpeechOptions,
  getPlaybackWord,
  requireIosVoicesForPlayback,
} from '@/src/domain/audioPlayback';

// Audio-session configuration for TTS playback. `playsInSilentMode` is the
// critical setting: without it, iOS mutes TTS when the ring/silent switch is on.
const IOS_PLAYBACK_AUDIO_MODE: Partial<AudioMode> = {
  playsInSilentMode: true,
  interruptionMode: 'duckOthers',
  allowsRecording: false,
  shouldPlayInBackground: false,
};

// Also used on web, where expo-audio's setAudioModeAsync is a no-op.
const ANDROID_PLAYBACK_AUDIO_MODE: Partial<AudioMode> = {
  interruptionMode: 'duckOthers',
  shouldPlayInBackground: false,
};

// WORKAROUND (temporary, iOS only): playing a short silent file after
// configuring the audio session keeps expo-speech audible when the iOS
// ring/silent switch is on. Whether expo-audio still needs this is an open
// question scheduled for a separate physical-device experiment; do not remove
// it as part of unrelated changes.
// See: https://stackoverflow.com/questions/61949934/expo-speech-not-working-on-some-ios-devices/62331403#62331403
// scripts/validate-audio-assets.js checks that this file references silent.mp3.
const SILENT_WARMUP_SOURCE = require('../../assets/audio/silent.mp3');

/**
 * Custom hook for text-to-speech playback of minimal pairs
 * @param selectedPair  The currently displayed minimal‑pair object (may be undefined on first render)
 * @param rate          Playback‑rate multiplier (e.g. 0.8, 1.0, 1.1)
 * @param getNextVoice  Optional function that returns the next voice from the rotation pool
 */
export const useAudio = (
  selectedPair: Pair | undefined,
  rate: number,
  getNextVoice?: () => Speech.Voice | null
) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioModeReady, setAudioModeReady] = useState(false);
  const availableVoicesRef = useRef<Speech.Voice[] | null>(null);
  const audioModeConfiguredRef = useRef(false);

  // Lifecycle-managed player for the one-time iOS warmup; released
  // automatically on unmount. Non-iOS platforms get a source-less player that
  // never plays. `keepAudioSessionActive` prevents expo-audio from
  // deactivating the iOS audio session when the warmup clip finishes — the
  // previous audio library deliberately never deactivated the session while
  // the app was foregrounded (see expo/expo#15873), and deactivation would
  // undo the silent-mode workaround before TTS runs.
  const silentWarmupPlayer = useAudioPlayer(
    Platform.OS === 'ios' ? SILENT_WARMUP_SOURCE : null,
    { keepAudioSessionActive: true }
  );

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
          await setAudioModeAsync(IOS_PLAYBACK_AUDIO_MODE);
          audioModeConfiguredRef.current = true;
          debugLog('✅ Audio mode configured for silent mode playback');

          // One-time silent warmup — see SILENT_WARMUP_SOURCE above.
          try {
            debugLog('🔇 Playing silent warmup audio…');
            silentWarmupPlayer.play();
            debugLog('✅ Silent audio played - iOS silent-mode workaround enabled');
          } catch (soundError) {
            debugWarn(
              '⚠️ Could not play silent audio, TTS may not work in silent mode:',
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
          await setAudioModeAsync(ANDROID_PLAYBACK_AUDIO_MODE);
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

    return () => {
      cancelled = true;
    };
  }, [debugError, debugLog, debugWarn, silentWarmupPlayer]);

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
        requireIosVoicesForPlayback(Platform.OS, voices);

        // Re-ensure audio mode is set before each playback to handle cases
        // where the audio session might have been interrupted or reset
        if (!audioModeConfiguredRef.current) {
          try {
            await setAudioModeAsync(IOS_PLAYBACK_AUDIO_MODE);
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

      const word = getPlaybackWord(selectedPair, idx);

      // Pick the next voice from the rotation pool for this utterance
      const voice = getNextVoice ? getNextVoice() : null;

      debugLog(`🔊 Attempting to speak: "${word}" at rate ${rate}`);
      if (voice) {
        debugLog(`🎤 Using voice: ${voice.name} (${voice.identifier})`);
      }

      setIsSpeaking(true);

      const speechOptions: Speech.SpeechOptions = buildSpeechOptions({
        rate,
        voice,
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
      });

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
    [debugError, debugLog, debugWarn, isSpeaking, rate, selectedPair, getNextVoice]
  );

  return { play, audioModeReady, isSpeaking };
};
