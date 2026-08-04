// -----------------------------------------------------------------------------
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { setAudioModeAsync } from 'expo-audio';
import type { AudioMode } from 'expo-audio';
import type { Pair } from '@/src/constants/minimalPairs';
import {
  buildSpeechOptions,
  getPlaybackWord,
  requireIosVoicesForPlayback,
} from '@/src/domain/audioPlayback';
import {
  speechPlaybackCoordinator,
  type SpeechPlaybackAttempt,
  type SpeechPlaybackRequest,
} from '@/src/domain/speechPlaybackCoordinator';
import {
  captureSpeechDiagnosticTime,
  createSpeechDiagnosticAttempt,
  recordSilentWarmupPlayInvoked,
  recordSpeechDiagnosticPhase,
  type SpeechDiagnosticAttempt,
  type SpeechDiagnosticTime,
} from '@/src/diagnostics/speechPlaybackDiagnostics';
import { useSilentWarmupPlayer } from '@/src/hooks/useSilentWarmupPlayer';

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

// EXPERIMENT (temporary, app-060, iOS only): build-time selector for the
// silent-warmup necessity experiment. Each physical-device test build must be
// produced from a commit where this constant is unambiguous; record the value
// alongside the build number in docs/manual-smoke-test.md before testing.
// Ship value: 'A-silent-warmup'. Remove this selector once the experiment
// reaches a decision.
//   'A-silent-warmup'         Baseline: warmup plays once after session config.
//   'B-no-warmup'             App audio session only; the warmup never plays.
//   'C-system-speech-session' No warmup, and expo-speech is told to use a
//                             system-managed speech session
//                             (useApplicationAudioSession: false). Answers a
//                             different question than B — session ownership
//                             moves to iOS — so do not compare it against A as
//                             if it were B.
type IosAudioSessionExperimentVariant =
  | 'A-silent-warmup'
  | 'B-no-warmup'
  | 'C-system-speech-session';
// The `as` widening keeps TypeScript from narrowing the const to one literal,
// which would make the other variants' comparisons compile errors.
const IOS_AUDIO_SESSION_EXPERIMENT =
  'C-system-speech-session' as IosAudioSessionExperimentVariant;

const IOS_SILENT_WARMUP_ENABLED =
  IOS_AUDIO_SESSION_EXPERIMENT === 'A-silent-warmup';

type SpeechDiagnosticPhase =
  | 'requested'
  | 'accepted'
  | 'rejected-duplicate'
  | 'submitted-to-native-speech'
  | 'started'
  | 'completed'
  | 'cancelled'
  | 'failed';

function logSpeechDiagnostic({
  phase,
  request,
  attempt,
  eventTimestampMs,
  isSpeaking,
  activePlaybackOwnerRequestId,
}: {
  phase: SpeechDiagnosticPhase;
  request: SpeechPlaybackRequest;
  attempt?: SpeechPlaybackAttempt;
  eventTimestampMs: number;
  isSpeaking: boolean;
  activePlaybackOwnerRequestId?: string;
}) {
  if (!__DEV__) return;
  console.log('[tts-playback]', {
    phase,
    eventTimestampMs,
    ...request,
    ...(attempt ?? {}),
    ...(activePlaybackOwnerRequestId
      ? { activePlaybackOwnerRequestId }
      : {}),
    isSpeaking,
    coordinatorObservedActivePlaybackOwnershipCount:
      speechPlaybackCoordinator.getActivePlaybackOwnershipCount(),
  });
}

/**
 * Custom hook for text-to-speech playback of minimal pairs
 * @param selectedPair  The currently displayed minimal‑pair object (may be undefined on first render)
 * @param rate          Playback‑rate multiplier (e.g. 0.8, 1.0, 1.1)
 * @param getNextVoice  Optional function that returns the next voice from the rotation pool
 */
export const useAudio = (
  selectedPair: Pair | undefined,
  rate: number,
  getNextVoice?: (context?: {
    difficulty?: Pair['difficulty'];
  }) => Speech.Voice | null
) => {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioModeReady, setAudioModeReady] = useState(false);
  const isSpeakingRef = useRef(false);
  const availableVoicesRef = useRef<Speech.Voice[] | null>(null);
  const audioModeConfiguredRef = useRef(false);

  // Lifecycle-managed player for the one-time iOS warmup; released
  // automatically on unmount. Non-iOS platforms — and no-warmup experiment
  // variants — get a source-less player that never plays. A source-less
  // player never calls play() and therefore never triggers expo-audio's own
  // session activation/retention, so `keepAudioSessionActive: true` is inert
  // in those variants; it is kept in the constructor call only so the two
  // code paths stay visually parallel, not because it makes B or C behave
  // like A. In the warmup-enabled case, it prevents expo-audio from
  // deactivating the iOS audio session when the warmup clip finishes — the
  // previous audio library deliberately never deactivated the session while
  // the app was foregrounded (see expo/expo#15873), and deactivation would
  // undo the silent-mode workaround before TTS runs.
  const silentWarmupPlayer = useSilentWarmupPlayer(
    Platform.OS === 'ios' && IOS_SILENT_WARMUP_ENABLED
      ? SILENT_WARMUP_SOURCE
      : null
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

  const updateIsSpeaking = useCallback((nextIsSpeaking: boolean) => {
    isSpeakingRef.current = nextIsSpeaking;
    setIsSpeaking(nextIsSpeaking);
  }, []);

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
          debugLog(
            `🧪 iOS audio-session experiment variant: ${IOS_AUDIO_SESSION_EXPERIMENT}`
          );
          if (IOS_SILENT_WARMUP_ENABLED) {
            try {
              debugLog('🔇 Playing silent warmup audio…');
              silentWarmupPlayer.play();
              recordSilentWarmupPlayInvoked();
              debugLog('✅ Silent audio played - iOS silent-mode workaround enabled');
            } catch (soundError) {
              debugWarn(
                '⚠️ Could not play silent audio, TTS may not work in silent mode:',
                soundError
              );
            }
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

      const word = getPlaybackWord(selectedPair, idx);
      const beginResult = speechPlaybackCoordinator.begin({
        word,
        difficulty: selectedPair.difficulty,
      });
      const request = beginResult.accepted
        ? beginResult.attempt
        : beginResult.request;
      logSpeechDiagnostic({
        phase: 'requested',
        request,
        eventTimestampMs: request.requestedAtMs,
        isSpeaking: isSpeakingRef.current,
      });
      if (!beginResult.accepted) {
        logSpeechDiagnostic({
          phase: 'rejected-duplicate',
          request: beginResult.request,
          eventTimestampMs: beginResult.request.requestedAtMs,
          isSpeaking: isSpeakingRef.current,
          activePlaybackOwnerRequestId: beginResult.activeAttempt.requestId,
        });
        return;
      }

      const { requestId } = beginResult.attempt;
      const coordinatorAcquiredDiagnosticTime = captureSpeechDiagnosticTime();
      let diagnosticAttempt: SpeechDiagnosticAttempt | null = null;
      let speechOptionsCreatedDiagnosticTime: SpeechDiagnosticTime | null = null;
      let speechSpeakInvokedDiagnosticTime: SpeechDiagnosticTime | null = null;
      logSpeechDiagnostic({
        phase: 'accepted',
        request: beginResult.attempt,
        attempt: beginResult.attempt,
        eventTimestampMs: beginResult.attempt.requestedAtMs,
        isSpeaking: isSpeakingRef.current,
      });
      updateIsSpeaking(true);

      try {
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

        // Pick the next voice from the rotation pool for this utterance; the
        // pair's difficulty stages how much of the pool is eligible.
        const voice = getNextVoice
          ? getNextVoice({ difficulty: selectedPair.difficulty })
          : null;
        speechPlaybackCoordinator.selectVoice(requestId, voice?.identifier ?? null);
        if (coordinatorAcquiredDiagnosticTime) {
          diagnosticAttempt = createSpeechDiagnosticAttempt({
            requestId,
            voiceIdentifier: voice?.identifier ?? null,
            coordinatorAcquiredAt: coordinatorAcquiredDiagnosticTime,
            audioSession: {
              configuredIntent: {
                category: 'playback',
                mode: 'default',
                options: ['duckOthers'],
              },
              audioModeConfigured: audioModeConfiguredRef.current,
              experimentVariant: IOS_AUDIO_SESSION_EXPERIMENT,
              silentWarmupEnabled: IOS_SILENT_WARMUP_ENABLED,
            },
          });
        }

        debugLog(`🔊 Attempting to speak: "${word}" at rate ${rate}`);
        if (voice) {
          debugLog(`🎤 Using voice: ${voice.name} (${voice.identifier})`);
        }

        const speechOptions: Speech.SpeechOptions = {
          ...buildSpeechOptions({
            rate,
            voice,
            onDone: () => {
              const nativeFinishedDiagnosticTime =
                captureSpeechDiagnosticTime();
              const finishedAtMs = Date.now();
              const finishedAttempt = speechPlaybackCoordinator.finish(
                requestId,
                finishedAtMs
              );
              const coordinatorReleasedDiagnosticTime =
                captureSpeechDiagnosticTime();
              if (!finishedAttempt) return;
              updateIsSpeaking(false);
              logSpeechDiagnostic({
                phase: 'completed',
                request: finishedAttempt,
                attempt: finishedAttempt,
                eventTimestampMs: finishedAtMs,
                isSpeaking: isSpeakingRef.current,
              });
              debugLog(`✅ Successfully spoke: "${word}"`);
              recordSpeechDiagnosticPhase(
                diagnosticAttempt,
                'native-finished-coordinator-released',
                nativeFinishedDiagnosticTime,
                {
                  coordinatorReleasedAtMonotonicMs:
                    coordinatorReleasedDiagnosticTime?.monotonicTimestampMs,
                }
              );
            },
            onStopped: () => {
              const nativeStoppedDiagnosticTime = captureSpeechDiagnosticTime();
              const cancelledAtMs = Date.now();
              const cancelledAttempt = speechPlaybackCoordinator.cancel(
                requestId,
                cancelledAtMs
              );
              const coordinatorReleasedDiagnosticTime =
                captureSpeechDiagnosticTime();
              if (!cancelledAttempt) return;
              updateIsSpeaking(false);
              logSpeechDiagnostic({
                phase: 'cancelled',
                request: cancelledAttempt,
                attempt: cancelledAttempt,
                eventTimestampMs: cancelledAtMs,
                isSpeaking: isSpeakingRef.current,
              });
              debugLog(`⏸️ Speech stopped for: "${word}"`);
              recordSpeechDiagnosticPhase(
                diagnosticAttempt,
                'native-stopped-coordinator-released',
                nativeStoppedDiagnosticTime,
                {
                  coordinatorReleasedAtMonotonicMs:
                    coordinatorReleasedDiagnosticTime?.monotonicTimestampMs,
                }
              );
            },
            onError: (error) => {
              const nativeErrorDiagnosticTime = captureSpeechDiagnosticTime();
              const failedAtMs = Date.now();
              const failedAttempt = speechPlaybackCoordinator.fail(
                requestId,
                failedAtMs
              );
              const coordinatorReleasedDiagnosticTime =
                captureSpeechDiagnosticTime();
              if (!failedAttempt) return;
              updateIsSpeaking(false);
              logSpeechDiagnostic({
                phase: 'failed',
                request: failedAttempt,
                attempt: failedAttempt,
                eventTimestampMs: failedAtMs,
                isSpeaking: isSpeakingRef.current,
              });
              debugError(`❌ TTS Error for "${word}":`, error);
              recordSpeechDiagnosticPhase(
                diagnosticAttempt,
                'native-error-coordinator-released',
                nativeErrorDiagnosticTime,
                {
                  coordinatorReleasedAtMonotonicMs:
                    coordinatorReleasedDiagnosticTime?.monotonicTimestampMs,
                }
              );
            },
          }),
          onStart: () => {
            const nativeStartedDiagnosticTime = captureSpeechDiagnosticTime();
            const startedAtMs = Date.now();
            const startedAttempt = speechPlaybackCoordinator.start(
              requestId,
              startedAtMs
            );
            if (!startedAttempt) return;
            logSpeechDiagnostic({
              phase: 'started',
              request: startedAttempt,
              attempt: startedAttempt,
              eventTimestampMs: startedAtMs,
              isSpeaking: isSpeakingRef.current,
            });
            recordSpeechDiagnosticPhase(
              diagnosticAttempt,
              'native-started',
              nativeStartedDiagnosticTime
            );
          },
          // Experiment variant C only: hand the speech audio session to iOS.
          // AVSpeechSynthesizer latches this on its first utterance, so it must
          // be identical for every utterance in a build — the build-time
          // constant guarantees that.
          ...(Platform.OS === 'ios' &&
          IOS_AUDIO_SESSION_EXPERIMENT === 'C-system-speech-session'
            ? { useApplicationAudioSession: false }
            : {}),
        };
        speechOptionsCreatedDiagnosticTime = captureSpeechDiagnosticTime();

        // Log speech attempt details
        debugLog('📋 Speech options:', {
          word,
          language: speechOptions.language,
          rate: speechOptions.rate,
          pitch: speechOptions.pitch,
          volume: speechOptions.volume,
          voice: voice?.name || 'system default',
        });

        speechSpeakInvokedDiagnosticTime = captureSpeechDiagnosticTime();
        Speech.speak(word, speechOptions);
        const speechSpeakReturnedDiagnosticTime = captureSpeechDiagnosticTime();
        const submittedAtMs = Date.now();
        const submittedAttempt = speechPlaybackCoordinator.submitSpeech(
          requestId,
          submittedAtMs
        );
        if (submittedAttempt) {
          logSpeechDiagnostic({
            phase: 'submitted-to-native-speech',
            request: submittedAttempt,
            attempt: submittedAttempt,
            eventTimestampMs: submittedAtMs,
            isSpeaking: isSpeakingRef.current,
          });
        }
        recordSpeechDiagnosticPhase(
          diagnosticAttempt,
          'coordinator-acquired',
          coordinatorAcquiredDiagnosticTime
        );
        recordSpeechDiagnosticPhase(
          diagnosticAttempt,
          'speech-options-created',
          speechOptionsCreatedDiagnosticTime
        );
        recordSpeechDiagnosticPhase(
          diagnosticAttempt,
          'speech-speak-invoked',
          speechSpeakInvokedDiagnosticTime
        );
        recordSpeechDiagnosticPhase(
          diagnosticAttempt,
          'speech-speak-returned',
          speechSpeakReturnedDiagnosticTime
        );
      } catch (error) {
        const submissionFailedDiagnosticTime = captureSpeechDiagnosticTime();
        const failedAtMs = Date.now();
        const failedAttempt = speechPlaybackCoordinator.fail(
          requestId,
          failedAtMs
        );
        const coordinatorReleasedDiagnosticTime = captureSpeechDiagnosticTime();
        if (failedAttempt) {
          updateIsSpeaking(false);
          logSpeechDiagnostic({
            phase: 'failed',
            request: failedAttempt,
            attempt: failedAttempt,
            eventTimestampMs: failedAtMs,
            isSpeaking: isSpeakingRef.current,
          });
        }
        debugError(`❌ Exception during speech playback: "${word}"`, error);
        recordSpeechDiagnosticPhase(
          diagnosticAttempt,
          'submission-failed-coordinator-released',
          submissionFailedDiagnosticTime,
          {
            coordinatorReleasedAtMonotonicMs:
              coordinatorReleasedDiagnosticTime?.monotonicTimestampMs,
          }
        );
        throw error;
      }
    },
    [
      debugError,
      debugLog,
      debugWarn,
      rate,
      selectedPair,
      getNextVoice,
      updateIsSpeaking,
    ]
  );

  return { play, audioModeReady, isSpeaking };
};
