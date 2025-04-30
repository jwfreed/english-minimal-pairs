// src/hooks/useAudio.ts
// -----------------------------------------------------------------------------
import { useEffect, useRef } from 'react';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import type { Pair } from '@/constants/minimalPairs';

/**
 * @param selectedPair  The currently displayed minimal‑pair object (may be undefined on first render)
 * @param rate          Playback‑rate multiplier (e.g. 0.8, 1.0, 1.1)
 */
export const useAudio = (selectedPair: Pair | undefined, rate: number) => {
  const cache = useRef<Record<string, Audio.Sound>>({});

  /* 1️⃣  Configure global audio mode once (silent‑switch override) */
  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true, // ← critical so sound plays when ringer is off
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
      staysActiveInBackground: false,
      playThroughEarpieceAndroid: false,
    });
  }, []);

  /* 2️⃣  Pre‑load & cache the two word tokens whenever the pair changes */
  useEffect(() => {
    (async () => {
      if (!selectedPair) return;
      for (const [word, uri] of [
        [selectedPair.word1, selectedPair.audio1],
        [selectedPair.word2, selectedPair.audio2],
      ] as const) {
        if (!cache.current[word]) {
          const s = new Audio.Sound();
          await s.loadAsync(uri);
          cache.current[word] = s;
        }
      }
    })();

    return () => {
      // Unload all cached sounds on unmount (optional but safe)
      Object.values(cache.current).forEach((s) => s?.unloadAsync());
    };
  }, [selectedPair]);

  /* 3️⃣  Imperative play helper used by HomeScreen */
  const play = async (idx: 0 | 1) => {
    if (!selectedPair) return;
    const word = idx ? selectedPair.word2 : selectedPair.word1;
    const sound = cache.current[word];
    if (!sound) return;
    await sound.setRateAsync(rate, true); // keep pitch
    await sound.replayAsync();
  };

  return { play };
};
