import type { Pair } from '@/src/constants/minimalPairs';

export type PlaybackWordIndex = 0 | 1;
export type PlaybackPlatform = 'ios' | 'android' | 'web' | 'windows' | 'macos';

export interface PlaybackVoice {
  identifier: string;
  language: string;
}

export interface SpeechOptionCallbacks {
  onDone: () => void;
  onStopped: () => void;
  onError: (error: unknown) => void;
}

const FALLBACK_LANGUAGE = 'en-US';
const NATURAL_SPEECH_RATE = 1;

export interface SpeechOptions extends SpeechOptionCallbacks {
  language: string;
  pitch: 1;
  rate: number;
  volume: 1;
  voice?: string;
}

export const IOS_TTS_UNAVAILABLE_MESSAGE =
  'TTS not available on iOS Simulator. Please test on a physical device.';

export function getPlaybackWord(
  selectedPair: Pair | undefined,
  idx: PlaybackWordIndex
): string {
  if (!selectedPair) {
    throw new Error('No pair selected');
  }

  return idx === 0 ? selectedPair.word1 : selectedPair.word2;
}

/**
 * Slowing an isolated word can make continuous initial /r/ and /l/ sounds
 * unnaturally long in device TTS (for example, "rr-right" or "ll-light").
 * Keep those onsets at the synthesizer's natural rate while leaving the
 * session's adaptive rate unchanged for other words and faster tiers.
 */
export function getPlaybackRate(word: string, requestedRate: number): number {
  const startsWithLiquid = /^[rl]/i.test(word.trimStart());
  return startsWithLiquid && requestedRate < NATURAL_SPEECH_RATE
    ? NATURAL_SPEECH_RATE
    : requestedRate;
}

export function requireIosVoicesForPlayback(
  platform: PlaybackPlatform,
  voices: unknown[]
): void {
  if (platform === 'ios' && voices.length === 0) {
    throw new Error(IOS_TTS_UNAVAILABLE_MESSAGE);
  }
}

export function buildSpeechOptions({
  rate,
  voice,
  onDone,
  onStopped,
  onError,
}: {
  rate: number;
  voice: PlaybackVoice | null;
} & SpeechOptionCallbacks): SpeechOptions {
  return {
    language: voice?.language || FALLBACK_LANGUAGE,
    pitch: 1.0,
    rate,
    volume: 1.0,
    ...(voice ? { voice: voice.identifier } : {}),
    onDone,
    onStopped,
    onError,
  };
}
