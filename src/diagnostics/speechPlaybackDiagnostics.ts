import { AppState, type AppStateStatus } from 'react-native';

const TTS_LIFECYCLE_LOG_PREFIX = '[tts-lifecycle]';
const SYSTEM_DEFAULT_VOICE_IDENTIFIER = 'system-default';
const NATIVE_STATE_UNAVAILABLE_REASON = 'not-exposed-by-current-js-api';

export type SpeechDiagnosticPhase =
  | 'coordinator-acquired'
  | 'speech-options-created'
  | 'speech-speak-invoked'
  | 'speech-speak-returned'
  | 'native-started'
  | 'native-finished-coordinator-released'
  | 'native-stopped-coordinator-released'
  | 'native-error-coordinator-released'
  | 'submission-failed-coordinator-released';

export interface SpeechDiagnosticTime {
  monotonicTimestampMs: number;
  epochTimestampMs: number;
  monotonicClockSource: 'performance.now' | 'Date.now-fallback';
}

export interface SpeechDiagnosticAudioSessionInput {
  configuredIntent: {
    category: 'playback';
    mode: 'default';
    options: readonly ['duckOthers'];
  };
  audioModeConfigured: boolean;
  experimentVariant: string;
  silentWarmupEnabled: boolean;
}

interface SpeechDiagnosticAudioSessionSnapshot
  extends SpeechDiagnosticAudioSessionInput {
  silentWarmupPlayInvoked: boolean;
  nativeState: {
    active: 'unavailable';
    route: 'unavailable';
    reason: typeof NATIVE_STATE_UNAVAILABLE_REASON;
  };
}

export interface CreateSpeechDiagnosticAttemptInput {
  requestId: string;
  voiceIdentifier: string | null;
  coordinatorAcquiredAt: SpeechDiagnosticTime;
  audioSession: SpeechDiagnosticAudioSessionInput;
}

export interface SpeechDiagnosticAttempt {
  diagnosticSessionId: string;
  requestId: string;
  utteranceSequenceNumber: number;
  isFirstPlaybackSinceLaunch: boolean;
  voiceIdentifier: string;
  isFirstPlaybackForVoice: boolean;
  playbackCountForVoice: number;
  coordinatorAcquiredAtMonotonicMs: number;
  speechOptionsCreatedAtMonotonicMs: number | null;
  speechSpeakInvokedAtMonotonicMs: number | null;
  speechSpeakReturnedAtMonotonicMs: number | null;
  nativeStartCallbackAtMonotonicMs: number | null;
  nativeTerminalCallbackAtMonotonicMs: number | null;
  coordinatorReleasedAtMonotonicMs: number | null;
  coordinatorObservedOwnershipCount: 0 | 1;
  audioSession: SpeechDiagnosticAudioSessionSnapshot;
}

export interface SpeechDiagnosticPhaseUpdate {
  coordinatorReleasedAtMonotonicMs?: number;
  coordinatorObservedOwnershipCount?: 0 | 1;
}

export interface SpeechLifecycleDiagnosticEvent
  extends SpeechDiagnosticAttempt,
    SpeechDiagnosticTime {
  phase: SpeechDiagnosticPhase;
}

interface AppStateDiagnosticEvent extends SpeechDiagnosticTime {
  phase: 'app-state-changed';
  diagnosticSessionId: string;
  appStateTransitionNumber: number;
  previousAppState: AppStateStatus;
  nextAppState: AppStateStatus;
  utteranceSequenceNumberAtTransition: number;
}

type SpeechDiagnosticEvent =
  | SpeechLifecycleDiagnosticEvent
  | AppStateDiagnosticEvent;

type SpeechDiagnosticSink = (
  prefix: typeof TTS_LIFECYCLE_LOG_PREFIX,
  event: SpeechDiagnosticEvent
) => void;

interface AppStateLike {
  currentState: AppStateStatus;
  addEventListener(
    eventName: 'change',
    listener: (state: AppStateStatus) => void
  ): { remove(): void };
}

interface CreateSpeechPlaybackDiagnosticsOptions {
  enabled: boolean;
  diagnosticSessionId: string;
  sink?: SpeechDiagnosticSink;
  captureTime?: () => SpeechDiagnosticTime | null;
}

export interface SpeechPlaybackDiagnostics {
  captureTime(): SpeechDiagnosticTime | null;
  createAttempt(
    input: CreateSpeechDiagnosticAttemptInput
  ): SpeechDiagnosticAttempt | null;
  recordPhase(
    attempt: SpeechDiagnosticAttempt | null,
    phase: SpeechDiagnosticPhase,
    time: SpeechDiagnosticTime | null,
    update?: SpeechDiagnosticPhaseUpdate
  ): void;
  recordSilentWarmupPlayInvoked(): void;
  observeAppState(appState: AppStateLike): void;
}

function captureSpeechDiagnosticTimeNow(): SpeechDiagnosticTime | null {
  try {
    const epochTimestampMs = Date.now();
    const performanceNow = globalThis.performance?.now;
    if (typeof performanceNow === 'function') {
      return {
        monotonicTimestampMs: performanceNow.call(globalThis.performance),
        epochTimestampMs,
        monotonicClockSource: 'performance.now',
      };
    }
    return {
      monotonicTimestampMs: epochTimestampMs,
      epochTimestampMs,
      monotonicClockSource: 'Date.now-fallback',
    };
  } catch {
    return null;
  }
}

function createRuntimeSessionId(): string {
  try {
    return `tts-runtime-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  } catch {
    return 'tts-runtime-id-unavailable';
  }
}

export function createSpeechPlaybackDiagnostics({
  enabled,
  diagnosticSessionId,
  sink = (prefix, event) => console.info(prefix, event),
  captureTime = captureSpeechDiagnosticTimeNow,
}: CreateSpeechPlaybackDiagnosticsOptions): SpeechPlaybackDiagnostics {
  let utteranceSequenceNumber = 0;
  let appStateTransitionNumber = 0;
  let silentWarmupPlayInvoked = false;
  const playbackCountsByVoice = new Map<string, number>();

  const safelyCaptureTime = (): SpeechDiagnosticTime | null => {
    if (!enabled) return null;
    try {
      return captureTime();
    } catch {
      return null;
    }
  };

  const safelyEmit = (event: SpeechDiagnosticEvent) => {
    if (!enabled) return;
    try {
      sink(TTS_LIFECYCLE_LOG_PREFIX, event);
    } catch {
      // Diagnostics must never become a playback dependency.
    }
  };

  return {
    captureTime: safelyCaptureTime,

    createAttempt(input) {
      if (!enabled) return null;
      try {
        const voiceIdentifier =
          input.voiceIdentifier || SYSTEM_DEFAULT_VOICE_IDENTIFIER;
        const playbackCountForVoice =
          (playbackCountsByVoice.get(voiceIdentifier) ?? 0) + 1;
        playbackCountsByVoice.set(voiceIdentifier, playbackCountForVoice);
        utteranceSequenceNumber += 1;

        return {
          diagnosticSessionId,
          requestId: input.requestId,
          utteranceSequenceNumber,
          isFirstPlaybackSinceLaunch: utteranceSequenceNumber === 1,
          voiceIdentifier,
          isFirstPlaybackForVoice: playbackCountForVoice === 1,
          playbackCountForVoice,
          coordinatorAcquiredAtMonotonicMs:
            input.coordinatorAcquiredAt.monotonicTimestampMs,
          speechOptionsCreatedAtMonotonicMs: null,
          speechSpeakInvokedAtMonotonicMs: null,
          speechSpeakReturnedAtMonotonicMs: null,
          nativeStartCallbackAtMonotonicMs: null,
          nativeTerminalCallbackAtMonotonicMs: null,
          coordinatorReleasedAtMonotonicMs: null,
          coordinatorObservedOwnershipCount: 1,
          audioSession: {
            configuredIntent: {
              category: input.audioSession.configuredIntent.category,
              mode: input.audioSession.configuredIntent.mode,
              options: [...input.audioSession.configuredIntent.options] as [
                'duckOthers',
              ],
            },
            audioModeConfigured: input.audioSession.audioModeConfigured,
            experimentVariant: input.audioSession.experimentVariant,
            silentWarmupEnabled: input.audioSession.silentWarmupEnabled,
            silentWarmupPlayInvoked,
            nativeState: {
              active: 'unavailable',
              route: 'unavailable',
              reason: NATIVE_STATE_UNAVAILABLE_REASON,
            },
          },
        };
      } catch {
        return null;
      }
    },

    recordPhase(attempt, phase, time, update = {}) {
      if (!enabled || !attempt || !time) return;
      try {
        switch (phase) {
          case 'speech-options-created':
            attempt.speechOptionsCreatedAtMonotonicMs =
              time.monotonicTimestampMs;
            break;
          case 'speech-speak-invoked':
            attempt.speechSpeakInvokedAtMonotonicMs =
              time.monotonicTimestampMs;
            break;
          case 'speech-speak-returned':
            attempt.speechSpeakReturnedAtMonotonicMs =
              time.monotonicTimestampMs;
            break;
          case 'native-started':
            attempt.nativeStartCallbackAtMonotonicMs =
              time.monotonicTimestampMs;
            break;
          case 'native-finished-coordinator-released':
          case 'native-stopped-coordinator-released':
          case 'native-error-coordinator-released':
          case 'submission-failed-coordinator-released':
            attempt.nativeTerminalCallbackAtMonotonicMs =
              time.monotonicTimestampMs;
            break;
          case 'coordinator-acquired':
            break;
        }

        if (update.coordinatorReleasedAtMonotonicMs !== undefined) {
          attempt.coordinatorReleasedAtMonotonicMs =
            update.coordinatorReleasedAtMonotonicMs;
        }
        if (update.coordinatorObservedOwnershipCount !== undefined) {
          attempt.coordinatorObservedOwnershipCount =
            update.coordinatorObservedOwnershipCount;
        }

        safelyEmit({
          phase,
          ...attempt,
          ...time,
          audioSession: {
            ...attempt.audioSession,
            configuredIntent: {
              ...attempt.audioSession.configuredIntent,
              options: [...attempt.audioSession.configuredIntent.options] as [
                'duckOthers',
              ],
            },
            nativeState: { ...attempt.audioSession.nativeState },
          },
        });
      } catch {
        // Diagnostics must never alter callback or coordinator behavior.
      }
    },

    recordSilentWarmupPlayInvoked() {
      if (!enabled) return;
      try {
        silentWarmupPlayInvoked = true;
      } catch {
        // Diagnostics must never alter warmup behavior.
      }
    },

    observeAppState(appState) {
      if (!enabled) return;
      try {
        let previousAppState = appState.currentState;
        appState.addEventListener('change', (nextAppState) => {
          try {
            const time = safelyCaptureTime();
            if (!time) return;
            appStateTransitionNumber += 1;
            safelyEmit({
              phase: 'app-state-changed',
              diagnosticSessionId,
              appStateTransitionNumber,
              previousAppState,
              nextAppState,
              utteranceSequenceNumberAtTransition: utteranceSequenceNumber,
              ...time,
            });
            previousAppState = nextAppState;
          } catch {
            // App-state diagnostics must never affect application lifecycle.
          }
        });
      } catch {
        // AppState is observational and optional for these diagnostics.
      }
    },
  };
}

const speechPlaybackDiagnostics = createSpeechPlaybackDiagnostics({
  enabled: __DEV__,
  diagnosticSessionId: createRuntimeSessionId(),
});

if (__DEV__) {
  speechPlaybackDiagnostics.observeAppState(AppState);
}

export function captureSpeechDiagnosticTime(): SpeechDiagnosticTime | null {
  return speechPlaybackDiagnostics.captureTime();
}

export function createSpeechDiagnosticAttempt(
  input: CreateSpeechDiagnosticAttemptInput
): SpeechDiagnosticAttempt | null {
  return speechPlaybackDiagnostics.createAttempt(input);
}

export function recordSpeechDiagnosticPhase(
  attempt: SpeechDiagnosticAttempt | null,
  phase: SpeechDiagnosticPhase,
  time: SpeechDiagnosticTime | null,
  update?: SpeechDiagnosticPhaseUpdate
): void {
  speechPlaybackDiagnostics.recordPhase(attempt, phase, time, update);
}

export function recordSilentWarmupPlayInvoked(): void {
  speechPlaybackDiagnostics.recordSilentWarmupPlayInvoked();
}
