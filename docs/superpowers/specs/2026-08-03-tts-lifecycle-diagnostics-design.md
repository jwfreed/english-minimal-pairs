# TTS Lifecycle Diagnostics Design

**Goal:** Add temporary development-only OS/device logging that compares the
first, second, and third TTS utterance lifecycles without changing playback
behavior.

**Scope:** JavaScript diagnostics only. The implementation will not add a
native module, patch Expo, persist or export logs, change `Speech.speak`
options, or add delays, retries, buffering, or playback state transitions.

## Files

- Create `src/domain/speechPlaybackDiagnostics.ts`: development diagnostic
  session metadata, monotonic/epoch timestamps, per-launch and per-voice
  counters, event construction, and guarded Console/Xcode emission.
- Modify `src/hooks/useAudio.ts`: emit diagnostic events at the existing
  coordinator, speech-option, `Speech.speak`, and native callback boundaries;
  observe development-only app foreground/background transitions.
- Create `scripts/speechPlaybackDiagnostics.test.js`: unit coverage for event
  ordering metadata, required fields, counters, and disabled emission.
- Modify `scripts/ttsDebugScreen.test.js` only if an integration source-contract
  assertion is needed to prove the production hook keeps the expected boundary
  calls. The new test file is otherwise auto-discovered by
  `scripts/run-tests.js`.

`src/domain/speechPlaybackCoordinator.ts`,
`src/hooks/useSilentWarmupPlayer.ts`, Expo package sources, progression,
mastery, scheduling, and voice policy will not change.

## Diagnostic runtime session

One diagnostic runtime session is created when the JavaScript module is loaded
in a development build. It has:

- an opaque `diagnosticSessionId` for correlating one app runtime;
- a playback counter that increases only for coordinator-accepted utterances;
- per-voice playback counters, with system-default speech represented by the
  explicit value `system-default`;
- an app-state transition counter.

The same session ID and playback counters continue across background/resume.
Development-only `app-state-changed` events record the previous and next app
states and the current playback counter, which distinguishes a fresh runtime
from continued playback after resume. No diagnostic state is persisted, so a
process relaunch creates a new session ID and resets all counters.

## Time model

Every event contains:

- `monotonicTimestampMs`: `performance.now()` when available, used for event
  ordering and elapsed-time comparisons;
- `epochTimestampMs`: `Date.now()`, used only to correlate with macOS
  Console/Xcode device logs;
- `monotonicClockSource`: `performance.now` or `Date.now-fallback`.

The fallback is labeled explicitly and will not be described as monotonic.
Each instrumentation boundary captures its timestamp once and reuses that
value in the operation-specific fields and event envelope.

## Event schema

All utterance events use the Console prefix `[tts-lifecycle]` and this shape:

```ts
interface TtsLifecycleDiagnosticEvent {
  phase:
    | 'coordinator-acquired'
    | 'speech-options-created'
    | 'speech-speak-invoked'
    | 'native-started'
    | 'native-finished-coordinator-released'
    | 'native-stopped-coordinator-released'
    | 'native-error-coordinator-released'
    | 'submission-failed-coordinator-released';
  diagnosticSessionId: string;
  requestId: string;
  utteranceSequenceNumber: number;
  isFirstPlaybackSinceLaunch: boolean;
  voiceIdentifier: string;
  isFirstPlaybackForVoice: boolean;
  playbackCountForVoice: number;
  monotonicTimestampMs: number;
  epochTimestampMs: number;
  monotonicClockSource: 'performance.now' | 'Date.now-fallback';
  coordinatorAcquiredAtMonotonicMs: number;
  speechOptionsCreatedAtMonotonicMs: number | null;
  speechSpeakInvokedAtMonotonicMs: number | null;
  nativeStartCallbackAtMonotonicMs: number | null;
  nativeTerminalCallbackAtMonotonicMs: number | null;
  coordinatorReleasedAtMonotonicMs: number | null;
  coordinatorObservedOwnershipCount: 0 | 1;
  audioSession: {
    configuredIntent: {
      category: 'playback';
      mode: 'default';
      options: readonly ['duckOthers'];
    };
    audioModeConfigured: boolean;
    experimentVariant: string;
    silentWarmupEnabled: boolean;
    silentWarmupPlayInvoked: boolean;
    nativeState: {
      active: 'unavailable';
      route: 'unavailable';
      reason: 'not-exposed-by-current-js-api';
    };
  };
}
```

Fields that have not occurred at a phase are `null`, so each emitted line is a
complete cumulative snapshot for one attempt. The audio-session block reports
only configured application intent and directly observed JavaScript flags. It
does not claim the actual native session category, mode, options, active state,
or route.

Expo creates `AVSpeechUtterance` after the JavaScript-to-native call, and that
timestamp is not exposed without patching Expo. Therefore the observable event
is named `speech-options-created`; the schema will not mislabel it as native
utterance creation. `speech-speak-invoked` is captured immediately before the
existing `Speech.speak` call. `native-started` and terminal timestamps are the
times JavaScript receives Expo's callbacks, not timestamps generated inside
AVFoundation.

## Instrumentation points

1. **Coordinator accepted:** Establishes the first observable ownership point,
   assigns the per-launch/per-voice sequence metadata, and distinguishes
   accepted playback from rejected duplicate presses.
2. **Speech options created:** Shows whether the delay before submission or the
   selected voice differs between playback one and later playbacks. It does not
   alter the options object.
3. **Immediately before `Speech.speak`:** Provides the closest JavaScript
   submission boundary and lets device logs measure acquire-to-submit time.
4. **`onStart`:** Provides the first native-originating callback and allows
   submit-to-start latency comparison.
5. **`onDone`, `onStopped`, and `onError`:** Capture the terminal native callback
   before coordinator release, then capture the release timestamp immediately
   after the existing coordinator operation succeeds.
6. **App-state transition:** Marks background/resume while preserving the same
   runtime session and playback sequence.

Rejected duplicate requests retain the existing `[tts-playback]` diagnostic and
do not receive an utterance sequence number because no utterance is submitted.

## Guard and output

The diagnostic runtime is created only when `__DEV__` is true. Emission accepts
an explicit enabled flag and returns before calling the supplied Console sink
when disabled. Output uses `console.info('[tts-lifecycle]', event)` so a physical
development build launched through Xcode is visible in Xcode or macOS Console.
There is no AsyncStorage, file access, network access, serialization pipeline,
or in-app viewer.

## Testing

Tests will not simulate native audio. They will verify only diagnostic behavior:

- accepted attempts receive increasing sequence numbers and correct first-play
  and per-voice metadata;
- event snapshots expose all required fields and preserve monotonically ordered
  boundary timestamps supplied by the test;
- the expected phase sequence is acquire, options, invoke, native start, native
  terminal/release;
- a disabled emitter does not invoke the Console sink;
- the production hook passes `__DEV__` to the emitter and retains the existing
  `Speech.speak` option construction and callback boundaries.

Verification after implementation will run the focused diagnostic test first,
then `npm test`, `npm run typecheck`, and `npm run lint`.

## Device experiment and interpretation

On one physical development device, hold word, voice, rate, route, and app
settings constant. Capture three completed utterances after cold launch, then
background/resume and capture three more without killing the process.

For each sequence compare:

- coordinator-acquire to `Speech.speak` invocation;
- invocation to native-start callback;
- native-start to native-finish callback;
- native-finish callback to coordinator release;
- session ID, per-launch sequence, per-voice count, configured intent, and
  warmup flags.

If the stuttering utterance has the same single acquire/invoke/start/finish
sequence and comparable JavaScript timing, the evidence moves beyond JS
orchestration toward retained native synthesizer/audio-session state. If the
first divergence is before native start, investigate the corresponding
application boundary before changing playback code.
