import {
  NativeModule,
  requireOptionalNativeModule,
} from 'expo-modules-core';
import type { SpeechOptions } from 'expo-speech';

export type IosSynthesizerLifecycleExperimentMode =
  | 'retained'
  | 'reset-per-utterance';

export type SpeechSynthesizerLifecycleMode =
  | 'expo-retained-production-path'
  | 'experimental-retained'
  | 'experimental-reset-per-utterance';

export interface SynthesizerLifecycleMetadata {
  synthesizerInstanceIdentifier: string;
  synthesizerCreationCount: number;
}

interface NativeLifecycleEvent extends SynthesizerLifecycleMetadata {
  id: string;
}

interface NativeBoundaryEvent extends NativeLifecycleEvent {
  charIndex: number;
  charLength: number;
}

interface ExperimentNativeSpeechOptions {
  language?: string;
  pitch?: number;
  rate?: number;
  voice?: string;
  useApplicationAudioSession?: boolean;
}

type ExperimentNativeEvents = {
  'TtsLifecycleExperiment.speakingStarted': (
    event: NativeLifecycleEvent
  ) => void;
  'TtsLifecycleExperiment.speakingWillSayNextString': (
    event: NativeBoundaryEvent
  ) => void;
  'TtsLifecycleExperiment.speakingDone': (
    event: NativeLifecycleEvent
  ) => void;
  'TtsLifecycleExperiment.speakingStopped': (
    event: NativeLifecycleEvent
  ) => void;
};

declare class ExperimentNativeModule extends NativeModule<ExperimentNativeEvents> {
  speak(
    id: string,
    text: string,
    options: ExperimentNativeSpeechOptions,
    mode: IosSynthesizerLifecycleExperimentMode
  ): void;
  stop(): void;
}

interface ExperimentCallbackEntry {
  options: SpeechOptions;
  onLifecycleMetadata?: (metadata: SynthesizerLifecycleMetadata) => void;
}

interface CreateExperimentAdapterOptions {
  nativeModule: ExperimentNativeModule | null;
}

export interface TtsSynthesizerLifecycleExperimentAdapter {
  speak(
    text: string,
    options: SpeechOptions,
    mode: IosSynthesizerLifecycleExperimentMode,
    onLifecycleMetadata?: (metadata: SynthesizerLifecycleMetadata) => void
  ): void;
  stop(): void;
}

const NATIVE_MODULE_UNAVAILABLE_MESSAGE =
  'TTS synthesizer lifecycle experiment native module is unavailable in this iOS development build.';

function lifecycleMetadata(
  event: NativeLifecycleEvent
): SynthesizerLifecycleMetadata {
  return {
    synthesizerInstanceIdentifier: event.synthesizerInstanceIdentifier,
    synthesizerCreationCount: event.synthesizerCreationCount,
  };
}

export function createTtsSynthesizerLifecycleExperimentAdapter({
  nativeModule,
}: CreateExperimentAdapterOptions): TtsSynthesizerLifecycleExperimentAdapter {
  let nextCallbackId = 1;
  let listenersRegistered = false;
  const callbacks = new Map<string, ExperimentCallbackEntry>();

  const requireModule = (): ExperimentNativeModule => {
    if (!nativeModule) {
      throw new Error(NATIVE_MODULE_UNAVAILABLE_MESSAGE);
    }
    return nativeModule;
  };

  const recordMetadata = (
    entry: ExperimentCallbackEntry | undefined,
    event: NativeLifecycleEvent
  ) => {
    entry?.onLifecycleMetadata?.(lifecycleMetadata(event));
  };

  const registerListenersIfNeeded = () => {
    if (listenersRegistered) return;
    const module = requireModule();
    listenersRegistered = true;

    module.addListener(
      'TtsLifecycleExperiment.speakingStarted',
      (event) => {
        const entry = callbacks.get(event.id);
        recordMetadata(entry, event);
        entry?.options.onStart?.();
      }
    );
    module.addListener(
      'TtsLifecycleExperiment.speakingWillSayNextString',
      (event) => {
        const entry = callbacks.get(event.id);
        recordMetadata(entry, event);
        if (entry?.options.onBoundary) {
          // Matches expo-speech's native boundary callback adaptation.
          // @ts-expect-error SpeechEventCallback is broader than the native event.
          entry.options.onBoundary({
            charIndex: event.charIndex,
            charLength: event.charLength,
          });
        }
      }
    );
    module.addListener('TtsLifecycleExperiment.speakingDone', (event) => {
      const entry = callbacks.get(event.id);
      recordMetadata(entry, event);
      entry?.options.onDone?.();
      callbacks.delete(event.id);
    });
    module.addListener('TtsLifecycleExperiment.speakingStopped', (event) => {
      const entry = callbacks.get(event.id);
      recordMetadata(entry, event);
      entry?.options.onStopped?.();
      callbacks.delete(event.id);
    });
  };

  return {
    speak(text, options, mode, onLifecycleMetadata) {
      const module = requireModule();
      const id = String(nextCallbackId++);
      callbacks.set(id, { options, onLifecycleMetadata });
      registerListenersIfNeeded();

      const nativeOptions: ExperimentNativeSpeechOptions = {
        ...(options.language !== undefined
          ? { language: options.language }
          : {}),
        ...(options.pitch !== undefined ? { pitch: options.pitch } : {}),
        ...(options.rate !== undefined ? { rate: options.rate } : {}),
        ...(options.voice !== undefined ? { voice: options.voice } : {}),
        ...(options.useApplicationAudioSession !== undefined
          ? {
              useApplicationAudioSession:
                options.useApplicationAudioSession,
            }
          : {}),
      };

      module.speak(id, text, nativeOptions, mode);
    },

    stop() {
      requireModule().stop();
    },
  };
}

export function resolveSpeechSynthesizerLifecycleMode({
  isDevelopment,
  platform,
  experimentMode,
}: {
  isDevelopment: boolean;
  platform: string;
  experimentMode: IosSynthesizerLifecycleExperimentMode;
}): SpeechSynthesizerLifecycleMode {
  if (!isDevelopment || platform !== 'ios') {
    return 'expo-retained-production-path';
  }
  return experimentMode === 'retained'
    ? 'experimental-retained'
    : 'experimental-reset-per-utterance';
}

const ttsSynthesizerLifecycleExperiment =
  createTtsSynthesizerLifecycleExperimentAdapter({
    nativeModule:
      requireOptionalNativeModule<ExperimentNativeModule>(
        'TtsSynthesizerLifecycleExperiment'
      ),
  });

export function speakWithSynthesizerLifecycleExperiment(
  text: string,
  options: SpeechOptions,
  mode: IosSynthesizerLifecycleExperimentMode,
  onLifecycleMetadata?: (metadata: SynthesizerLifecycleMetadata) => void
): void {
  ttsSynthesizerLifecycleExperiment.speak(
    text,
    options,
    mode,
    onLifecycleMetadata
  );
}

export function stopSynthesizerLifecycleExperiment(): void {
  ttsSynthesizerLifecycleExperiment.stop();
}
