// src/hooks/useAudio.ts
// -----------------------------------------------------------------------------
import { useEffect, useRef, useState } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import type { Pair } from '@/app/constants/minimalPairs';

/**
 * @param selectedPair  The currently displayed minimal‑pair object (may be undefined on first render)
 * @param rate          Playback‑rate multiplier (e.g. 0.8, 1.0, 1.1)
 */
export const useAudio = (selectedPair: Pair | undefined, rate: number) => {
  const cache = useRef<Record<string, Audio.Sound>>({});
  const [audioModeReady, setAudioModeReady] = useState(false);

  /* 1️⃣  Configure global audio mode once (silent‑switch override) */
  useEffect(() => {
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true, // ← critical so sound plays when ringer is off
          interruptionModeIOS: InterruptionModeIOS.DuckOthers,
          interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
          shouldDuckAndroid: true,
          staysActiveInBackground: false,
          playThroughEarpieceAndroid: false,
        });
        setAudioModeReady(true);
      } catch (error) {
        console.error('Failed to set audio mode:', error);
        // Still allow playback attempt even if audio mode setup fails
        setAudioModeReady(true);
      }
    })();
  }, []);

  /* 2️⃣  Pre‑load & cache the two word tokens whenever the pair changes */
  useEffect(() => {
    if (!audioModeReady || !selectedPair) return;

    (async () => {
      for (const [word, uri] of [
        [selectedPair.word1, selectedPair.audio1],
        [selectedPair.word2, selectedPair.audio2],
      ] as const) {
        if (!cache.current[word]) {
          try {
            const s = new Audio.Sound();
            await s.loadAsync(uri);
            cache.current[word] = s;
          } catch (error) {
            console.error(`Failed to load audio for ${word}:`, error);
          }
        }
      }
    })();

    return () => {
      // Unload all cached sounds on unmount (optional but safe)
      Object.values(cache.current).forEach((s) => s?.unloadAsync().catch(() => {}));
    };
  }, [selectedPair, audioModeReady]);

  /* 3️⃣  Imperative play helper used by HomeScreen */
  const play = async (idx: 0 | 1) => {
    if (!audioModeReady) {
      throw new Error('Audio mode not ready');
    }
    if (!selectedPair) {
      throw new Error('No pair selected');
    }
    const word = idx ? selectedPair.word2 : selectedPair.word1;
    const sound = cache.current[word];
    if (!sound) {
      // If sound isn't cached, try to load it immediately
      const uri = idx ? selectedPair.audio2 : selectedPair.audio1;
      try {
        const s = new Audio.Sound();
        await s.loadAsync(uri);
        cache.current[word] = s;
        await s.setRateAsync(rate, true);
        await s.replayAsync();
        return;
      } catch (error) {
        console.error(`Failed to load/play audio for ${word}:`, error);
        throw new Error(`Cannot load audio for ${word}`);
      }
    }
    await sound.setRateAsync(rate, true); // keep pitch
    await sound.replayAsync();
  };

  return { play, audioModeReady };
};