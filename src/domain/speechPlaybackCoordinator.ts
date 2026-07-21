export type SpeechPlaybackDifficulty = 1 | 2 | 3 | 4 | 5 | 6;

export interface SpeechPlaybackRequest {
  requestId: string;
  word: string;
  difficulty: SpeechPlaybackDifficulty;
  requestedAtMs: number;
}

export interface SpeechPlaybackAttempt extends SpeechPlaybackRequest {
  voiceIdentifier: string | null;
  speechSubmittedAtMs: number | null;
  playbackStartedAtMs: number | null;
  playbackFinishedAtMs: number | null;
  cancellationAtMs: number | null;
  failureAtMs: number | null;
}

export type BeginSpeechPlaybackResult =
  | { accepted: true; attempt: SpeechPlaybackAttempt }
  | {
      accepted: false;
      request: SpeechPlaybackRequest;
      activeAttempt: SpeechPlaybackAttempt;
    };

// This is coordinator-owned application state, not Expo's private native
// utterance queue depth.
export const MAX_ACTIVE_PLAYBACK_OWNERSHIP = 1;

function copyAttempt(attempt: SpeechPlaybackAttempt): SpeechPlaybackAttempt {
  return { ...attempt };
}

/**
 * Mirrors expo-speech's single native synthesizer with a single JS owner.
 * React state remains a UI projection; this coordinator is the synchronous
 * source of truth that prevents two same-batch requests from being queued.
 */
export class SpeechPlaybackCoordinator {
  private sequence = 0;
  private activeAttempt: SpeechPlaybackAttempt | null = null;

  begin({
    word,
    difficulty,
    nowMs = Date.now(),
  }: {
    word: string;
    difficulty: SpeechPlaybackDifficulty;
    nowMs?: number;
  }): BeginSpeechPlaybackResult {
    const request: SpeechPlaybackRequest = {
      requestId: `tts-${nowMs}-${++this.sequence}`,
      word,
      difficulty,
      requestedAtMs: nowMs,
    };
    if (this.activeAttempt) {
      return {
        accepted: false,
        request,
        activeAttempt: copyAttempt(this.activeAttempt),
      };
    }

    const attempt: SpeechPlaybackAttempt = {
      ...request,
      voiceIdentifier: null,
      speechSubmittedAtMs: null,
      playbackStartedAtMs: null,
      playbackFinishedAtMs: null,
      cancellationAtMs: null,
      failureAtMs: null,
    };
    this.activeAttempt = attempt;
    return { accepted: true, attempt: copyAttempt(attempt) };
  }

  selectVoice(
    requestId: string,
    voiceIdentifier: string | null
  ): SpeechPlaybackAttempt | null {
    return this.update(requestId, (attempt) => {
      attempt.voiceIdentifier = voiceIdentifier;
    });
  }

  submitSpeech(
    requestId: string,
    nowMs = Date.now()
  ): SpeechPlaybackAttempt | null {
    return this.update(requestId, (attempt) => {
      attempt.speechSubmittedAtMs = nowMs;
    });
  }

  start(requestId: string, nowMs = Date.now()): SpeechPlaybackAttempt | null {
    return this.update(requestId, (attempt) => {
      attempt.playbackStartedAtMs = nowMs;
    });
  }

  finish(requestId: string, nowMs = Date.now()): SpeechPlaybackAttempt | null {
    return this.end(requestId, (attempt) => {
      attempt.playbackFinishedAtMs = nowMs;
    });
  }

  cancel(requestId: string, nowMs = Date.now()): SpeechPlaybackAttempt | null {
    return this.end(requestId, (attempt) => {
      attempt.cancellationAtMs = nowMs;
    });
  }

  fail(requestId: string, nowMs = Date.now()): SpeechPlaybackAttempt | null {
    return this.end(requestId, (attempt) => {
      attempt.failureAtMs = nowMs;
    });
  }

  getActivePlaybackOwnershipCount(): 0 | typeof MAX_ACTIVE_PLAYBACK_OWNERSHIP {
    return this.activeAttempt ? MAX_ACTIVE_PLAYBACK_OWNERSHIP : 0;
  }

  getActivePlaybackOwnerRequestId(): string | null {
    return this.activeAttempt?.requestId ?? null;
  }

  private update(
    requestId: string,
    updateAttempt: (attempt: SpeechPlaybackAttempt) => void
  ): SpeechPlaybackAttempt | null {
    if (!this.activeAttempt || this.activeAttempt.requestId !== requestId) {
      return null;
    }
    updateAttempt(this.activeAttempt);
    return copyAttempt(this.activeAttempt);
  }

  private end(
    requestId: string,
    updateAttempt: (attempt: SpeechPlaybackAttempt) => void
  ): SpeechPlaybackAttempt | null {
    const endedAttempt = this.update(requestId, updateAttempt);
    if (!endedAttempt) return null;
    this.activeAttempt = null;
    return endedAttempt;
  }
}

// expo-speech owns one native synthesizer per module, so every useAudio
// instance must share the same coordinator rather than maintaining a local
// React ref.
export const speechPlaybackCoordinator = new SpeechPlaybackCoordinator();
