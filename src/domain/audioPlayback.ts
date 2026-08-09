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

export interface SpeechOptions extends SpeechOptionCallbacks {
  language: string;
  pitch: 1;
  rate: number;
  volume: 1;
  voice?: string;
}

export const IOS_TTS_UNAVAILABLE_MESSAGE =
  'TTS not available on iOS Simulator. Please test on a physical device.';

// -----------------------------------------------------------------------------
// Playback timeout budgets.
//
// These are speech semantics — how long an utterance of this word at this rate
// should plausibly take — so they are derived here, next to the speech options
// they accompany. SpeechPlaybackCoordinator receives the results as opaque
// milliseconds and stays free of any TTS timing assumption.
//
// Budgets are deliberately generous. A false timeout is a user-visible defect;
// a late timeout is only a slower recovery from a state that would otherwise
// never recover at all.
// -----------------------------------------------------------------------------

/**
 * Flat budget for "submitted to native speech, but onStart never arrived".
 * Native has either begun or it has not, so this does not scale with content.
 */
export const START_BUDGET_MS = 4000;

const MS_PER_CHARACTER = 140;
const SLACK_FACTOR = 3;
export const MIN_COMPLETION_BUDGET_MS = 3000;
export const MAX_COMPLETION_BUDGET_MS = 15000;

export interface SpeechTimeoutBudgets {
  startBudgetMs: number;
  completionBudgetMs: number;
}

/**
 * Derives ownership timeout budgets for one utterance.
 *
 * A degenerate rate (zero, negative, NaN, Infinity) must never become a
 * non-finite timer delay: that would silently disarm the watchdog and restore
 * the permanent-ownership-lock failure it exists to prevent. Such rates clamp
 * to the ceiling rather than propagating.
 */
export function deriveSpeechTimeoutBudgets({
  word,
  rate,
}: {
  word: string;
  rate: number;
}): SpeechTimeoutBudgets {
  const estimatedSpeechMs = (word.length * MS_PER_CHARACTER) / rate;
  const budgetedMs = estimatedSpeechMs * SLACK_FACTOR;

  return {
    startBudgetMs: START_BUDGET_MS,
    completionBudgetMs: Number.isFinite(budgetedMs)
      ? Math.min(
          Math.max(budgetedMs, MIN_COMPLETION_BUDGET_MS),
          MAX_COMPLETION_BUDGET_MS
        )
      : MAX_COMPLETION_BUDGET_MS,
  };
}

export function getPlaybackWord(
  selectedPair: Pair | undefined,
  idx: PlaybackWordIndex
): string {
  if (!selectedPair) {
    throw new Error('No pair selected');
  }

  return idx === 0 ? selectedPair.word1 : selectedPair.word2;
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
