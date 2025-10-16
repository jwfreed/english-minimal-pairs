// hooks/useSpeech.ts
// -----------------------------------------------------------------------------
import { useCallback, useState } from 'react';
import * as Speech from 'expo-speech';
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
  const [audioModeReady] = useState(true); // Speech API is always ready

  /**
   * Plays the specified word using text-to-speech
   * @param idx 0 for word1, 1 for word2
   */
  const play = useCallback(
    async (idx: 0 | 1) => {
      if (!selectedPair) {
        throw new Error('No pair selected');
      }

      // Stop any ongoing speech
      if (isSpeaking) {
        await Speech.stop();
      }

      const word = idx === 0 ? selectedPair.word1 : selectedPair.word2;

      setIsSpeaking(true);

      // Build speech options
      const speechOptions: Speech.SpeechOptions = {
        language: 'en-US', // American English
        pitch: 1.0, // Normal pitch
        rate: rate, // Use the provided rate
        ...(voice ? { voice: voice.identifier } : {}),
        onDone: () => setIsSpeaking(false),
        onStopped: () => setIsSpeaking(false),
        onError: () => {
          setIsSpeaking(false);
          console.error(`Failed to speak word: ${word}`);
        },
      };

      Speech.speak(word, speechOptions);
    },
    [selectedPair, rate, voice, isSpeaking]
  );

  return { play, audioModeReady };
};