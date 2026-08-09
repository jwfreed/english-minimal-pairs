export type SpeechPlaybackDifficulty = 1 | 2 | 3 | 4 | 5 | 6;

export interface SpeechPlaybackRequest {
  requestId: string;
  word: string;
  difficulty: SpeechPlaybackDifficulty;
  requestedAtMs: number;
}

/**
 * Which callback the coordinator was still waiting for when ownership timed
 * out. `awaiting-start` means native never acknowledged the submission;
 * `awaiting-terminal` means it started speaking and never reported an end.
 */
export type SpeechPlaybackTimeoutPhase = 'awaiting-start' | 'awaiting-terminal';

export interface SpeechPlaybackAttempt extends SpeechPlaybackRequest {
  voiceIdentifier: string | null;
  speechSubmittedAtMs: number | null;
  playbackStartedAtMs: number | null;
  playbackFinishedAtMs: number | null;
  cancellationAtMs: number | null;
  failureAtMs: number | null;
  timedOutAtMs: number | null;
  timedOutPhase: SpeechPlaybackTimeoutPhase | null;
}

/**
 * How a callback that the coordinator refused to act on should be reported.
 * `after-timeout` means the watchdog had already released this request;
 * `unknown-request` means the coordinator never owned it, or owned it long
 * enough ago that it has aged out of the recent-timeout ring.
 */
export type StaleSpeechCallbackClassification =
  | 'after-timeout'
  | 'unknown-request';

/**
 * The host timer API, injected so tests can drive expiry deterministically.
 * `scripts/run-tests.js` is a bare Node runner with no fake-timer support, so
 * this is a requirement rather than a stylistic preference.
 */
export interface SpeechPlaybackScheduler {
  setTimeout: (callback: () => void, delayMs: number) => unknown;
  clearTimeout: (timerId: unknown) => void;
  now: () => number;
}

export type SpeechPlaybackTimeoutListener = (
  attempt: SpeechPlaybackAttempt
) => void;

const DEFAULT_SCHEDULER: SpeechPlaybackScheduler = {
  setTimeout: (callback, delayMs) => setTimeout(callback, delayMs),
  clearTimeout: (timerId) => clearTimeout(timerId as ReturnType<typeof setTimeout>),
  now: () => Date.now(),
};

// How many recently timed-out request IDs stay classifiable. Bounded so a long
// session cannot accumulate them without limit; large enough that a late
// callback arriving several presses later is still reported accurately.
export const RECENT_TIMEOUT_RING_SIZE = 8;

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
  private readonly scheduler: SpeechPlaybackScheduler;
  private activeBudgets: {
    startBudgetMs?: number;
    completionBudgetMs?: number;
  } = {};
  private activeTimerId: unknown = null;
  private readonly recentlyTimedOutRequestIds: string[] = [];
  private readonly timeoutListeners = new Set<SpeechPlaybackTimeoutListener>();

  constructor({
    scheduler = DEFAULT_SCHEDULER,
  }: { scheduler?: SpeechPlaybackScheduler } = {}) {
    this.scheduler = scheduler;
  }

  /**
   * Registers a listener for watchdog releases so the UI can stop rendering a
   * playback that will never report back. Returns an unsubscribe function.
   *
   * Unsubscribing intentionally does not disarm a pending timeout: the
   * coordinator is a module singleton that outlives any one `useAudio` mount,
   * and cancelling on unsubscribe would restore the permanent-ownership-lock
   * failure this watchdog exists to prevent.
   */
  subscribeToOwnershipTimeout(
    listener: SpeechPlaybackTimeoutListener
  ): () => void {
    this.timeoutListeners.add(listener);
    return () => {
      this.timeoutListeners.delete(listener);
    };
  }

  /**
   * Explains a callback the coordinator declined to act on, so diagnostics can
   * distinguish "the watchdog already released this" from "we have never heard
   * of this request".
   */
  classifyStaleCallback(requestId: string): StaleSpeechCallbackClassification {
    return this.recentlyTimedOutRequestIds.includes(requestId)
      ? 'after-timeout'
      : 'unknown-request';
  }

  begin({
    word,
    difficulty,
    nowMs = Date.now(),
    startBudgetMs,
    completionBudgetMs,
  }: {
    word: string;
    difficulty: SpeechPlaybackDifficulty;
    nowMs?: number;
    // Opaque milliseconds supplied by the caller. The coordinator owns
    // ownership lifetime, not speech timing: it never derives these from the
    // word, the rate, or any other utterance property. Omitting them disables
    // the watchdog for that request.
    startBudgetMs?: number;
    completionBudgetMs?: number;
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
      timedOutAtMs: null,
      timedOutPhase: null,
    };
    this.activeAttempt = attempt;
    this.activeBudgets = { startBudgetMs, completionBudgetMs };
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
    const submitted = this.update(requestId, (attempt) => {
      attempt.speechSubmittedAtMs = nowMs;
    });
    // Armed here rather than at admission: until the request has been handed
    // to native speech there is nothing that could fail to call back.
    if (submitted) {
      this.armTimeout(requestId, 'awaiting-start', this.activeBudgets.startBudgetMs);
    }
    return submitted;
  }

  start(requestId: string, nowMs = Date.now()): SpeechPlaybackAttempt | null {
    const started = this.update(requestId, (attempt) => {
      attempt.playbackStartedAtMs = nowMs;
    });
    if (started) {
      this.armTimeout(
        requestId,
        'awaiting-terminal',
        this.activeBudgets.completionBudgetMs
      );
    }
    return started;
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
    this.release();
    return endedAttempt;
  }

  private release(): void {
    this.disarmTimeout();
    this.activeAttempt = null;
    this.activeBudgets = {};
  }

  private disarmTimeout(): void {
    if (this.activeTimerId === null) return;
    this.scheduler.clearTimeout(this.activeTimerId);
    this.activeTimerId = null;
  }

  private armTimeout(
    requestId: string,
    phase: SpeechPlaybackTimeoutPhase,
    budgetMs: number | undefined
  ): void {
    // Replacing, never stacking: the start budget is superseded by the
    // completion budget when native reports that it began speaking.
    this.disarmTimeout();
    if (budgetMs === undefined) return;
    this.activeTimerId = this.scheduler.setTimeout(() => {
      this.activeTimerId = null;
      this.timeOut(requestId, phase);
    }, budgetMs);
  }

  private timeOut(
    requestId: string,
    phase: SpeechPlaybackTimeoutPhase
  ): void {
    if (!this.activeAttempt || this.activeAttempt.requestId !== requestId) {
      return;
    }
    this.activeAttempt.timedOutAtMs = this.scheduler.now();
    this.activeAttempt.timedOutPhase = phase;
    const timedOutAttempt = copyAttempt(this.activeAttempt);

    this.rememberTimedOutRequest(requestId);
    this.release();

    // Ownership is already released before any listener runs, so a throwing
    // subscriber cannot leave the coordinator locked.
    for (const listener of [...this.timeoutListeners]) {
      try {
        listener(copyAttempt(timedOutAttempt));
      } catch {
        // A diagnostic or UI failure must never affect playback ownership.
      }
    }
  }

  private rememberTimedOutRequest(requestId: string): void {
    this.recentlyTimedOutRequestIds.push(requestId);
    if (this.recentlyTimedOutRequestIds.length > RECENT_TIMEOUT_RING_SIZE) {
      this.recentlyTimedOutRequestIds.shift();
    }
  }
}

// expo-speech owns one native synthesizer per module, so every useAudio
// instance must share the same coordinator rather than maintaining a local
// React ref.
export const speechPlaybackCoordinator = new SpeechPlaybackCoordinator();
