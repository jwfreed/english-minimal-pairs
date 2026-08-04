# iOS TTS Synthesizer Lifecycle Experiment Design

**Goal:** Determine whether recreating `AVSpeechSynthesizer` between otherwise
identical utterances eliminates the observed `clean → stutter → stutter`
transition on iOS.

**Status:** Temporary diagnostic experiment only. A positive result is evidence
for a later production design; it does not authorize a production fix.

## Established evidence

The experiment builds on the existing `diagnostics/tts-lifecycle` branch and
does not revisit voice policy, JavaScript coordination, silent warmup, or
application audio-session ownership. Existing evidence shows one accepted
request, one native submission, one start, one terminal callback, and one
coordinator release per playback. The stutter follows playback count across
voices and remains present without warmup and with
`useApplicationAudioSession: false`.

## Verified Expo boundary

Expo Speech 14.0.7 exposes no synthesizer lifecycle operation. Its JavaScript
API calls the native `ExpoSpeech` module, and the iOS `SpeechModule`:

- is declared `final`;
- owns one `private var synthesizer = AVSpeechSynthesizer()`;
- creates a new `AVSpeechUtterance` for every `speak` call;
- maps language, voice, pitch, rate, and `useApplicationAudioSession` onto that
  utterance or retained synthesizer;
- exposes only speak, voice lookup, stop, pause, resume, and speaking state.

JavaScript cannot replace the private synthesizer. A separate Swift extension
cannot access it, and the final module cannot be subclassed. Keeping the exact
Expo module while adding reset behavior would therefore require patching or
forking Expo Speech, which this experiment forbids.

An app-owned native experiment module is consequently unavoidable. It will be
strictly bounded and will not become the production speech implementation.

## Native parity map

The parity target is the checked-in dependency source at
`node_modules/expo-speech/ios/SpeechModule.swift` and
`node_modules/expo-speech/ios/SpeechDelegate.swift` for Expo Speech 14.0.7.
The implementation must preserve the following map before lifecycle mode is
allowed to vary:

| Behavior | Expo Speech 14.0.7 | Experimental equivalent | Unavoidable difference |
|---|---|---|---|
| Utterance creation | Constructs `ExpoSpeechUtterance(id:text:)`, which subclasses `AVSpeechUtterance`, stores the opaque callback ID, and calls `super.init(string: text)`. | `TtsLifecycleExperimentUtterance(id:text:)` at `modules/tts-synthesizer-lifecycle-experiment/ios/TtsSynthesizerLifecycleExperimentModule.swift` has the same stored ID and superclass initializer. | Swift class name and owning module differ; utterance contents and ID role do not. |
| Language assignment | If `options.language` exists, assigns `AVSpeechSynthesisVoice(language:)`. | Performs the same conditional assignment first. | None known. |
| Voice assignment and fallback | If `options.voice` exists, assigns `AVSpeechSynthesisVoice(identifier:)` after language assignment, so it overrides the language-derived voice. Throws `InvalidVoiceException` when the identifier resolves to `nil`. If no explicit voice exists, the prior language assignment or AVFoundation default remains. | Performs the same second assignment and nil check, throwing an experiment-local invalid-voice exception. It does not add fallback or normalization. | Exception class/module name differs. Successful voice selection and failure condition are the parity target. |
| Pitch conversion | If supplied, assigns `Float(pitch)` to `pitchMultiplier`; otherwise leaves the AVFoundation default. | Same conditional conversion and assignment. | None known. |
| Rate conversion | If supplied, assigns `Float(rate) * AVSpeechUtteranceDefaultSpeechRate`; otherwise leaves the AVFoundation default. | Same conditional conversion and multiplication. | None known. |
| Volume and unsupported JS fields | iOS native code does not read `volume`, `_voiceIndex`, or JS callback fields from `SpeechOptions`. | The native record does not read or apply them. Callback functions remain in the TypeScript adapter only. | None known for iOS playback. |
| Audio-session option | If `useApplicationAudioSession` is supplied, assigns it to `synthesizer.usesApplicationAudioSession`; if omitted, does not assign it. On the retained synthesizer a prior explicit value therefore remains resident. | Performs the same conditional assignment on the synthesizer selected for the utterance. No session activation, category, delay, or cleanup is added. | In reset mode an omitted option encounters a fresh synthesizer default rather than retained prior state. Matched experiment runs must pass identical options; this consequence is intrinsic to changing synthesizer lifetime and is recorded as part of the tested variable. |
| Start callback | Delegate receives `didStart`, casts to the ID-carrying utterance, and emits the ID to JavaScript. | Delegate receives `didStart`, casts to the experiment utterance, and emits the same ID shape for adapter routing. | Event namespace and bridge implementation differ. Native delivery timing equivalence is not claimed. |
| Boundary callback | Delegate receives `willSpeakRangeOfSpeechString` and emits ID, character index, and length. | Emits the same observable values for the adapter. | Event namespace and bridge implementation differ. Native delivery timing equivalence is not claimed. |
| Finish callback | Delegate receives `didFinish` and emits the ID. Expo's JS callback registry calls `onDone`, then removes that ID. | Emits the ID; the experiment adapter calls `onDone`, then removes that ID. | Callback registry ownership and event namespace differ. Native delivery timing equivalence is not claimed. |
| Cancel callback | Delegate receives `didCancel` and emits the ID. Expo's JS callback registry calls `onStopped`, then removes that ID. | Emits the ID; the experiment adapter calls `onStopped`, then removes that ID. | Callback registry ownership and event namespace differ. Native delivery timing equivalence is not claimed. |
| Error callback | Expo's JS layer registers an error listener, but the iOS `SpeechDelegate` has no AVSpeechSynthesizer error delegate callback and `SpeechModule` never emits the error event. | Does not invent a native error event. Synchronous/async native invocation failures retain the bridge's normal failure behavior. | Exception identity belongs to the experiment module. No timing equivalence is claimed. |
| Stop behavior | Calls `synthesizer.stopSpeaking(at: .immediate)` and relies on `didCancel` for the observable stopped event. It does not recreate the synthesizer. | Exposes `stop()` that calls `.stopSpeaking(at: .immediate)` on the currently owned synthesizer and does not reset it. | The app does not currently call stop through `useAudio`; the method exists to keep the experiment boundary behaviorally complete. |
| Synthesizer allocation | Initializes one private `AVSpeechSynthesizer` for the native module and reuses it for every utterance. | Both modes create one synthesizer during module creation through the same factory. Both use it for the first utterance. `retained` keeps reusing it; `reset-per-utterance` replaces it immediately before each later valid utterance. The same delegate instance and all code after selection are shared. | Reset mode intentionally changes allocation lifetime between utterances; this is the sole experimental variable. |

No parity claim extends to identical native callback timing. The required
equivalence is the same observable lifecycle events and adapter callback
semantics. The retained control is the empirical check that unavoidable module
and bridge differences have not removed the defect.

## Experimental boundary

Create one local, iOS-only Expo module under `modules/` and one TypeScript
adapter under `src/experiments/`. Expo SDK 54's autolinker searches the local
`modules/` directory by default, so no generated `ios/` files or installed
package sources need to be committed or patched.

The native module will copy only Expo Speech 14.0.7's observable iOS behavior
needed by `useAudio`:

- accept an opaque utterance ID, text, unchanged speech options, and lifecycle
  mode;
- create the same `AVSpeechUtterance` subclass carrying that ID;
- apply language, voice, pitch, rate, and `useApplicationAudioSession` with the
  same precedence and conversions as Expo Speech 14.0.7;
- submit once to `AVSpeechSynthesizer.speak`;
- emit start, boundary, finish, and stop events containing the same utterance
  ID used to route existing callbacks.

It will not normalize values, alter defaults, add fallback behavior, retry,
delay, buffer, automatically stop, clean up at terminal callbacks, or change
submission scheduling.

The module supports exactly two experimental lifecycle modes:

1. `retained`: create one synthesizer during module creation and reuse it for
   all utterances.
2. `reset-per-utterance`: use the same module-creation synthesizer for the first
   utterance, then replace it immediately before each later valid utterance,
   after the prior utterance has reached a terminal callback through the
   existing coordinator contract.

Both modes use the same module, delegate, option mapping, event routing, and
JavaScript adapter. The allocation decision is the only difference.

## Development-only routing

Add an explicit build-time TypeScript selector:

```ts
type IosSynthesizerLifecycleExperimentMode =
  | 'retained'
  | 'reset-per-utterance';

const IOS_SYNTHESIZER_LIFECYCLE_EXPERIMENT_MODE =
  'retained' as IosSynthesizerLifecycleExperimentMode;
```

`useAudio` routes through the experiment adapter only when all three
conditions hold:

- `__DEV__` is true;
- `Platform.OS === 'ios'`;
- the local native module is available.

Otherwise it calls the existing `Speech.speak(word, speechOptions)` path
unchanged. Android, web, release builds, voice discovery, the debug screen,
and production defaults remain on Expo Speech.

If the selector requests the experiment in an iOS development build but the
native module is unavailable, playback fails explicitly before submission.
It must not silently fall back to Expo because that would mislabel the tested
lifecycle mode.

## Callback and state preservation

The TypeScript adapter presents a `speak(text, options, mode)` boundary with
the existing `Speech.SpeechOptions` callbacks. It assigns an opaque ID,
registers option callbacks by ID, and routes native events to `onStart`,
`onBoundary`, `onDone`, and `onStopped`. Terminal events remove the callback
entry exactly once.

`useAudio` keeps its existing:

- coordinator acquire/select/submit/start/finish/cancel/fail calls;
- `buildSpeechOptions` result;
- selected word, voice, language, pitch, rate, volume, and audio-session
  option;
- React state and refs;
- callback bodies and dependency lists;
- silent warmup and application audio-session configuration.

Only the synchronous speech submission function changes in an iOS development
experiment build. The existing Expo submission remains byte-for-byte present
as the release/non-iOS path.

## Diagnostics

Preserve every existing `[tts-lifecycle]` event and timestamp boundary. Add:

```ts
synthesizerLifecycleMode:
  | 'expo-retained-production-path'
  | 'experimental-retained'
  | 'experimental-reset-per-utterance';
```

The mode is captured once for an accepted attempt and repeated in every
cumulative event snapshot. No existing phase or field is removed or renamed.
The existing `[tts-playback]` diagnostics remain unchanged.

The native module does not add extra timing, retry, delay, or buffering logic.
The current diagnostics remain the comparison record for playback one, two,
and three.

## Tests

Use test-driven development for the new abstraction.

Automated coverage will verify:

- the adapter assigns unique utterance IDs and routes start and terminal
  events to the correct existing callbacks;
- terminal callbacks are delivered and removed exactly once;
- unavailable native experiment code fails explicitly in a requested iOS
  development experiment;
- retained and reset modes pass identical text and option values to the same
  native function;
- the native source has one lifecycle allocation branch and identical option
  mapping after that branch;
- `useAudio` retains one Expo `Speech.speak` fallback and changes no coordinator
  or callback behavior;
- every `[tts-lifecycle]` event contains the selected lifecycle mode;
- release and non-iOS routing cannot select the experiment.

Verification will run:

- focused lifecycle-abstraction and diagnostics tests;
- existing audio playback, coordinator, and debug-screen tests;
- `npm test`;
- `npm run typecheck`;
- `npm run lint`;
- `git diff --check`;
- Expo iOS autolinking verification;
- an iOS native compile using the generated development project.

## Physical-device protocol

Use one physical iPhone and hold these controls constant across both builds:

- device and iOS version;
- development build configuration;
- voice identifier;
- word;
- playback rate;
- audio route;
- app settings;
- warmup variant;
- application audio-session configuration.

Run the retained mode first after a cold process launch and record playback
one, two, and three. The retained control must reproduce
`clean → stutter → stutter` in that build. If it does not, stop: the local
boundary has not established a valid control, and the reset result is not
interpretable.

After a valid retained reproduction, build reset-per-utterance mode and repeat
the same three-playback sequence under the matched controls.

| Mode | Playback 1 | Playback 2 | Playback 3 | Interpretation |
|---|---|---|---|---|
| Retained | clean | stutter | stutter | Required valid control |
| Reset | clean | clean | clean | Retained synthesizer lifetime is causal or a necessary trigger |
| Reset | clean | stutter | stutter | Retained synthesizer lifetime alone is insufficient |

Any other pattern is recorded without forcing a binary conclusion. A failed
retained reproduction is inconclusive, not evidence against the hypothesis.

## Scope and cleanup

The experiment changes no learning content, learning sequence, UI, coordinator
policy, voice policy, warmup behavior, audio-session configuration, or
production playback default. It adds no dependency and does not modify
`node_modules` or generated native projects.

After physical-device results are reviewed, production lifecycle design or
experiment removal is a separate task. This experiment will not be promoted
to production behavior directly.

Rollback requires no production migration. Delete the local experiment module
and TypeScript adapter, remove the development selector and routing branch from
`useAudio`, and remove the lifecycle-mode diagnostic field and experiment test
coverage. The unchanged Expo Speech release path then remains as the sole
submission path.
