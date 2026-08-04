# iOS TTS Synthesizer Lifecycle Experiment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a temporary iOS development experiment that compares a retained `AVSpeechSynthesizer` with replacement between utterances while holding the native implementation, speech inputs, callbacks, coordinator, diagnostics, warmup, and audio-session configuration constant.

**Architecture:** A local iOS-only Expo module reproduces the inspected Expo Speech 14.0.7 utterance mapping and lifecycle events. Its two modes share every code path except the conditional replacement of the synthesizer before the second and later valid utterances; a TypeScript adapter restores the callback contract consumed by `useAudio`, whose release and non-iOS path remains `Speech.speak`.

**Tech Stack:** Expo SDK 54, Expo Modules Core 3.0.22, Swift 5.9, AVFoundation, TypeScript, React Native, Node `assert` tests, CocoaPods, Xcode.

## Global Constraints

- This is a temporary causal probe, not a production fix or a new production speech architecture.
- Do not patch `node_modules`, fork Expo Speech, or modify tracked/generated `ios/` files.
- Do not add dependencies.
- Do not change speech defaults, voice fallback, language/voice precedence, pitch/rate conversion, volume behavior, audio-session option handling, callback semantics required by `useAudio`, stop behavior, scheduling, retries, delays, buffering, automatic stop, or terminal cleanup.
- Keep Android, web, Expo voice discovery, `TTSDebugScreen`, coordinator logic, warmup behavior, application audio-session configuration, learning logic, and UI behavior unchanged.
- Use the same module, delegate, utterance type, option mapping, event bridge, and adapter for `retained` and `reset-per-utterance`; synthesizer replacement between utterances is the sole mode difference.
- Preserve all existing `[tts-lifecycle]` and `[tts-playback]` diagnostics and add the selected synthesizer lifecycle mode to every accepted-attempt lifecycle snapshot.
- Route through the native experiment only when `__DEV__` is true and `Platform.OS === 'ios'`; release and non-iOS builds retain the existing Expo `Speech.speak` path.
- If the local native module is unavailable in an iOS development experiment, fail explicitly rather than silently falling back to Expo Speech.
- Do not claim native callback timing equivalence. Preserve only the observable lifecycle events and callback semantics required by the adapter.
- A reset result is interpretable only after the experimental retained mode reproduces `clean → stutter → stutter` under matched physical-device conditions.
- Rollback must require only deletion of the local module, adapter, development selector/routing branch, diagnostic mode field, and experiment tests/documentation.

---

### Task 1: Lock native parity and implement the two-mode iOS module

**Files:**
- Create: `scripts/ttsSynthesizerLifecycleExperiment.test.js`
- Create: `modules/tts-synthesizer-lifecycle-experiment/package.json`
- Create: `modules/tts-synthesizer-lifecycle-experiment/expo-module.config.json`
- Create: `modules/tts-synthesizer-lifecycle-experiment/ios/TtsSynthesizerLifecycleExperiment.podspec`
- Create: `modules/tts-synthesizer-lifecycle-experiment/ios/TtsSynthesizerLifecycleExperimentModule.swift`
- Reference only: `node_modules/expo-speech/ios/SpeechModule.swift`
- Reference only: `node_modules/expo-speech/ios/SpeechDelegate.swift`
- Reference only: `node_modules/expo-speech/ios/SpeechOptions.swift`
- Reference only: `node_modules/expo-speech/ios/SpeechExceptions.swift`

**Interfaces:**
- Consumes: Expo Modules Core `Module`, `Record`, `Enumerable`, and `GenericException`; AVFoundation `AVSpeechSynthesizer`, `AVSpeechUtterance`, and `AVSpeechSynthesizerDelegate`.
- Produces: native module `TtsSynthesizerLifecycleExperiment` with `speak(id:text:options:mode:)`, `stop()`, and start/boundary/done/stopped events.
- Produces: native mode values `retained` and `reset-per-utterance`.

- [ ] **Step 1: Write the failing native parity/source-contract tests**

Create `scripts/ttsSynthesizerLifecycleExperiment.test.js` with the repository's existing `runTest` style. Read the inspected Expo sources and the planned experiment source, then assert the frozen parity map and sole allocation branch:

```js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

const root = path.join(__dirname, '..');
const expoSpeechModuleSource = fs.readFileSync(
  path.join(root, 'node_modules', 'expo-speech', 'ios', 'SpeechModule.swift'),
  'utf8'
);
const experimentModulePath = path.join(
  root,
  'modules',
  'tts-synthesizer-lifecycle-experiment',
  'ios',
  'TtsSynthesizerLifecycleExperimentModule.swift'
);
const experimentModuleSource = fs.readFileSync(experimentModulePath, 'utf8');

runTest('Expo Speech 14.0.7 parity target still has one retained synthesizer', () => {
  assert.ok(expoSpeechModuleSource.includes('private var synthesizer = AVSpeechSynthesizer()'));
  assert.strictEqual(
    (expoSpeechModuleSource.match(/synthesizer\.speak\(utterance\)/g) || []).length,
    1
  );
});

runTest('experiment preserves Expo utterance option order and conversions', () => {
  const language = experimentModuleSource.indexOf('if let language = options.language');
  const voice = experimentModuleSource.indexOf('if let voice = options.voice');
  const pitch = experimentModuleSource.indexOf('utterance.pitchMultiplier = Float(pitch)');
  const rate = experimentModuleSource.indexOf(
    'utterance.rate = Float(rate) * AVSpeechUtteranceDefaultSpeechRate'
  );
  const session = experimentModuleSource.indexOf(
    'synthesizer.usesApplicationAudioSession = useApplicationAudioSession'
  );
  assert.ok(language >= 0 && language < voice);
  assert.ok(voice < pitch && pitch < rate && rate < session);
  assert.ok(experimentModuleSource.includes('guard utterance.voice != nil else'));
});

runTest('synthesizer lifetime is the sole native mode branch', () => {
  assert.ok(
    experimentModuleSource.includes(
      'if mode == .resetPerUtterance && hasSubmittedUtterance'
    )
  );
  assert.strictEqual(
    (experimentModuleSource.match(/synthesizer = makeSynthesizer\(\)/g) || []).length,
    2,
    'one module-creation allocation plus one reset branch'
  );
  assert.strictEqual(
    (experimentModuleSource.match(/synthesizer\.speak\(utterance\)/g) || []).length,
    1
  );
});

runTest('stop remains immediate and does not reset synthesizer state', () => {
  assert.strictEqual(
    (experimentModuleSource.match(/stopSpeaking\(at: \.immediate\)/g) || []).length,
    1
  );
  assert.ok(!experimentModuleSource.includes('asyncAfter'));
  assert.ok(!experimentModuleSource.includes('Thread.sleep'));
});
```

Also assert the same start, boundary, done, and stopped event payload keys and assert the experimental native options record does not define `volume`, callback functions, `_voiceIndex`, retry, delay, or buffer fields.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk node scripts/ttsSynthesizerLifecycleExperiment.test.js
```

Expected: FAIL with `ENOENT` for `TtsSynthesizerLifecycleExperimentModule.swift`.

- [ ] **Step 3: Add the minimal local Expo module metadata**

Create `modules/tts-synthesizer-lifecycle-experiment/package.json`:

```json
{
  "name": "tts-synthesizer-lifecycle-experiment",
  "version": "0.0.1",
  "private": true
}
```

Create `modules/tts-synthesizer-lifecycle-experiment/expo-module.config.json`:

```json
{
  "platforms": ["apple"],
  "apple": {
    "modules": ["TtsSynthesizerLifecycleExperimentModule"]
  }
}
```

Create `modules/tts-synthesizer-lifecycle-experiment/ios/TtsSynthesizerLifecycleExperiment.podspec` using iOS 15.1 and Swift 5.9, matching Expo Speech's project floors:

```ruby
require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'TtsSynthesizerLifecycleExperiment'
  s.version        = package['version']
  s.summary        = 'Temporary iOS TTS synthesizer lifecycle experiment.'
  s.description    = 'Development-only retained-versus-reset AVSpeechSynthesizer probe.'
  s.license        = 'UNLICENSED'
  s.author         = 'Soundwise'
  s.homepage       = 'https://github.com/jwfreed/english-minimal-pairs'
  s.platforms      = { :ios => '15.1' }
  s.swift_version  = '5.9'
  s.source         = { :git => 'https://github.com/jwfreed/english-minimal-pairs.git' }
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,mm,swift}'
end
```

- [ ] **Step 4: Implement the parity-frozen native module**

Create `TtsSynthesizerLifecycleExperimentModule.swift` with these exact shapes:

```swift
import AVFoundation
import ExpoModulesCore

private let speakingStarted = "TtsLifecycleExperiment.speakingStarted"
private let speakingWillSayNextString = "TtsLifecycleExperiment.speakingWillSayNextString"
private let speakingDone = "TtsLifecycleExperiment.speakingDone"
private let speakingStopped = "TtsLifecycleExperiment.speakingStopped"

private enum SynthesizerLifecycleMode: String, Enumerable {
  case retained
  case resetPerUtterance = "reset-per-utterance"
}

private struct ExperimentSpeechOptions: Record {
  @Field var language: String?
  @Field var pitch: Double?
  @Field var rate: Double?
  @Field var voice: String?
  @Field var useApplicationAudioSession: Bool?
}

private final class ExperimentInvalidVoiceException: GenericException<String> {
  override var reason: String {
    "Cannot find voice with identifier: \(param)!"
  }
}
```

Implement one delegate instance with Expo-equivalent ID casting and event payloads. In the module, retain these state fields:

```swift
private var synthesizer: AVSpeechSynthesizer!
private var delegate: TtsSynthesizerLifecycleExperimentDelegate?
private var hasSubmittedUtterance = false
```

In `OnCreate`, create the delegate and assign exactly one initial synthesizer via `makeSynthesizer()`. `makeSynthesizer()` creates `AVSpeechSynthesizer`, assigns the same retained delegate, and returns it.

Inside `AsyncFunction("speak")`, construct and configure the utterance before selecting the synthesizer. Preserve Expo's exact language-then-voice order and numeric conversions. Then use the only mode branch:

```swift
if mode == .resetPerUtterance && hasSubmittedUtterance {
  synthesizer = makeSynthesizer()
}

if let useApplicationAudioSession = options.useApplicationAudioSession {
  synthesizer.usesApplicationAudioSession = useApplicationAudioSession
}

hasSubmittedUtterance = true
synthesizer.speak(utterance)
```

Expose `AsyncFunction("stop")` as only:

```swift
synthesizer.stopSpeaking(at: .immediate)
```

Do not clear the synthesizer at terminal events and do not add pause, resume, voice lookup, retry, timing, or scheduling code because `useAudio` does not consume those operations through the experiment adapter.

- [ ] **Step 5: Run the focused parity test and verify GREEN**

Run:

```bash
rtk node scripts/ttsSynthesizerLifecycleExperiment.test.js
```

Expected: all native parity and allocation-source tests pass.

- [ ] **Step 6: Verify Expo autolinking discovers only an Apple experiment module**

Run:

```bash
rtk proxy npx expo-modules-autolinking search --platform ios --json
```

Expected: output contains `tts-synthesizer-lifecycle-experiment`, its local `modules/` path, and Apple module `TtsSynthesizerLifecycleExperimentModule`.

Run:

```bash
rtk proxy npx expo-modules-autolinking search --platform android --json
```

Expected: output does not register the experiment for Android.

- [ ] **Step 7: Commit the native parity boundary**

```bash
rtk git add scripts/ttsSynthesizerLifecycleExperiment.test.js modules/tts-synthesizer-lifecycle-experiment
rtk git commit -m "test: add retained versus reset iOS synthesizer probe"
```

### Task 2: Add the callback-preserving TypeScript adapter

**Files:**
- Create: `src/experiments/ttsSynthesizerLifecycleExperiment.ts`
- Modify: `scripts/ttsSynthesizerLifecycleExperiment.test.js`

**Interfaces:**
- Consumes: `requireOptionalNativeModule` and the native module from Task 1.
- Consumes: `Speech.SpeechOptions` without mutating it.
- Produces: `IosSynthesizerLifecycleExperimentMode`, `SpeechSynthesizerLifecycleMode`, `resolveSpeechSynthesizerLifecycleMode`, `speakWithSynthesizerLifecycleExperiment`, and `stopSynthesizerLifecycleExperiment`.
- Produces for tests: `createTtsSynthesizerLifecycleExperimentAdapter({ nativeModule })`.

- [ ] **Step 1: Add failing adapter tests with an injected native-module fake**

Extend `scripts/ttsSynthesizerLifecycleExperiment.test.js` using `loadTsModule`. Mock `expo-modules-core.requireOptionalNativeModule` and capture listeners/calls:

Load the adapter exports with explicit local aliases used by the assertions:

```js
const {
  createTtsSynthesizerLifecycleExperimentAdapter: createAdapter,
  resolveSpeechSynthesizerLifecycleMode: resolveMode,
} = loadTsModule(adapterPath, new Map(), {
  'expo-modules-core': {
    requireOptionalNativeModule() {
      return null;
    },
  },
});
```

```js
function makeNativeModule() {
  const listeners = new Map();
  const speakCalls = [];
  let stopCalls = 0;
  return {
    listeners,
    speakCalls,
    get stopCalls() {
      return stopCalls;
    },
    addListener(name, listener) {
      listeners.set(name, listener);
      return { remove() {} };
    },
    speak(...args) {
      speakCalls.push(args);
    },
    stop() {
      stopCalls += 1;
    },
  };
}
```

Add tests that prove:

```js
runTest('adapter passes identical native input in retained and reset modes', () => {
  const retainedNative = makeNativeModule();
  const resetNative = makeNativeModule();
  const retained = createAdapter({ nativeModule: retainedNative });
  const reset = createAdapter({ nativeModule: resetNative });
  const options = {
    language: 'en-US',
    voice: 'voice-a',
    pitch: 1,
    rate: 0.8,
    volume: 1,
    useApplicationAudioSession: false,
    onStart() {},
    onDone() {},
    onStopped() {},
    onError() {},
  };

  retained.speak('right', options, 'retained');
  reset.speak('right', options, 'reset-per-utterance');

  assert.deepStrictEqual(retainedNative.speakCalls[0].slice(1, 3), resetNative.speakCalls[0].slice(1, 3));
  assert.deepStrictEqual(retainedNative.speakCalls[0][3], 'retained');
  assert.deepStrictEqual(resetNative.speakCalls[0][3], 'reset-per-utterance');
  assert.ok(!Object.prototype.hasOwnProperty.call(retainedNative.speakCalls[0][2], 'volume'));
  assert.ok(!Object.prototype.hasOwnProperty.call(retainedNative.speakCalls[0][2], 'onDone'));
});
```

Add separate tests for start/boundary/done/stopped ID routing, exactly-once terminal removal, direct stop delegation, an explicit unavailable-module error, and routing resolution:

```js
assert.strictEqual(
  resolveMode({ isDevelopment: false, platform: 'ios', experimentMode: 'retained' }),
  'expo-retained-production-path'
);
assert.strictEqual(
  resolveMode({ isDevelopment: true, platform: 'android', experimentMode: 'retained' }),
  'expo-retained-production-path'
);
assert.strictEqual(
  resolveMode({ isDevelopment: true, platform: 'ios', experimentMode: 'retained' }),
  'experimental-retained'
);
assert.strictEqual(
  resolveMode({ isDevelopment: true, platform: 'ios', experimentMode: 'reset-per-utterance' }),
  'experimental-reset-per-utterance'
);
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
rtk node scripts/ttsSynthesizerLifecycleExperiment.test.js
```

Expected: FAIL because `src/experiments/ttsSynthesizerLifecycleExperiment.ts` does not exist.

- [ ] **Step 3: Implement the adapter without adding native semantics**

Create the adapter with these public types:

```ts
import { requireOptionalNativeModule, type NativeModule } from 'expo-modules-core';
import type { SpeechOptions } from 'expo-speech';

export type IosSynthesizerLifecycleExperimentMode =
  | 'retained'
  | 'reset-per-utterance';

export type SpeechSynthesizerLifecycleMode =
  | 'expo-retained-production-path'
  | 'experimental-retained'
  | 'experimental-reset-per-utterance';
```

Define native event payloads with `{ id: string }` and boundary payloads with `{ id: string; charIndex: number; charLength: number }`. Define native speech options with only `language`, `pitch`, `rate`, `voice`, and `useApplicationAudioSession`.

`createTtsSynthesizerLifecycleExperimentAdapter` owns a callback map and lazily installs the four listeners on the first `speak`. Use a local monotonically increasing string ID. On done and stopped, invoke the matching callback and then delete the ID, matching Expo's JS registry order. Do not emit or synthesize an iOS error callback.

Build native options only from defined native fields:

```ts
const nativeOptions = {
  ...(options.language !== undefined ? { language: options.language } : {}),
  ...(options.pitch !== undefined ? { pitch: options.pitch } : {}),
  ...(options.rate !== undefined ? { rate: options.rate } : {}),
  ...(options.voice !== undefined ? { voice: options.voice } : {}),
  ...(options.useApplicationAudioSession !== undefined
    ? { useApplicationAudioSession: options.useApplicationAudioSession }
    : {}),
};
```

Do not pass `volume` or callback functions over the native bridge. Do not mutate `options`. If `nativeModule` is null, throw:

```ts
new Error(
  'TTS synthesizer lifecycle experiment native module is unavailable in this iOS development build.'
)
```

Export the module-scoped adapter singleton backed by:

```ts
requireOptionalNativeModule<ExperimentNativeModule>(
  'TtsSynthesizerLifecycleExperiment'
)
```

Implement the pure resolver exactly as the four assertions above specify.

- [ ] **Step 4: Run the focused adapter test and verify GREEN**

Run:

```bash
rtk node scripts/ttsSynthesizerLifecycleExperiment.test.js
```

Expected: all parity, routing, option-forwarding, callback, unavailable-module, and stop tests pass.

- [ ] **Step 5: Run TypeScript verification for the adapter**

Run:

```bash
rtk npm run typecheck
```

Expected: exit 0.

- [ ] **Step 6: Commit the adapter**

```bash
rtk git add src/experiments/ttsSynthesizerLifecycleExperiment.ts scripts/ttsSynthesizerLifecycleExperiment.test.js
rtk git commit -m "test: add TTS lifecycle experiment adapter"
```

### Task 3: Add lifecycle mode to existing diagnostics

**Files:**
- Modify: `src/diagnostics/speechPlaybackDiagnostics.ts:45-68`
- Modify: `scripts/speechPlaybackDiagnostics.test.js:47-89,106-209`

**Interfaces:**
- Consumes: `SpeechSynthesizerLifecycleMode` from the adapter.
- Extends: `CreateSpeechDiagnosticAttemptInput` and `SpeechDiagnosticAttempt` with `synthesizerLifecycleMode`.
- Preserves: all event phase names, timestamps, audio-session fields, counters, and non-throwing behavior.

- [ ] **Step 1: Add failing diagnostic field tests**

Import the lifecycle mode type in the diagnostic implementation plan, then first update test fixtures so `makeAttemptInput` includes:

```js
synthesizerLifecycleMode: 'experimental-retained',
```

Add `synthesizerLifecycleMode` to `REQUIRED_EVENT_FIELDS` and assert every emitted lifecycle snapshot equals `experimental-retained`. Add a second attempt using `experimental-reset-per-utterance` and assert the mode is captured per attempt rather than read from mutable global state.

- [ ] **Step 2: Run the focused diagnostic test and verify RED**

Run:

```bash
rtk node scripts/speechPlaybackDiagnostics.test.js
```

Expected: FAIL because emitted events do not contain `synthesizerLifecycleMode`.

- [ ] **Step 3: Add the immutable mode field to diagnostic attempts**

In `speechPlaybackDiagnostics.ts`, import the type only:

```ts
import type { SpeechSynthesizerLifecycleMode } from '@/src/experiments/ttsSynthesizerLifecycleExperiment';
```

Add this field to both interfaces:

```ts
synthesizerLifecycleMode: SpeechSynthesizerLifecycleMode;
```

In `createAttempt`, copy `input.synthesizerLifecycleMode` into the returned attempt. Do not change `recordPhase`; its existing `{ phase, ...attempt, ...time }` snapshots will carry the immutable mode through every phase.

- [ ] **Step 4: Run the diagnostic test and verify GREEN**

Run:

```bash
rtk node scripts/speechPlaybackDiagnostics.test.js
```

Expected: all existing diagnostics tests plus lifecycle-mode assertions pass.

- [ ] **Step 5: Commit the diagnostic schema extension**

```bash
rtk git add src/diagnostics/speechPlaybackDiagnostics.ts scripts/speechPlaybackDiagnostics.test.js
rtk git commit -m "chore: label TTS synthesizer lifecycle diagnostics"
```

### Task 4: Route only iOS development submissions through the experiment

**Files:**
- Modify: `src/hooks/useAudio.ts:18-26,52-76,338-353,496-498`
- Modify: `scripts/ttsSynthesizerLifecycleExperiment.test.js`
- Modify: `scripts/speechPlaybackDiagnostics.test.js:315-388`
- Verify unchanged: `src/domain/audioPlayback.ts`
- Verify unchanged: `src/domain/speechPlaybackCoordinator.ts`
- Verify unchanged: `src/components/TTSDebugScreen.tsx`

**Interfaces:**
- Consumes: adapter mode resolver and experimental `speak` from Task 2.
- Passes: selected `Speech.SpeechOptions` object unchanged to either experimental adapter or Expo Speech.
- Supplies: immutable diagnostic lifecycle mode to `createSpeechDiagnosticAttempt`.

- [ ] **Step 1: Add failing source-contract tests for the routing boundary**

Extend `scripts/ttsSynthesizerLifecycleExperiment.test.js` to read `useAudio.ts` and assert:

```js
assert.strictEqual((useAudioSource.match(/Speech\.speak\(word, speechOptions\)/g) || []).length, 1);
assert.strictEqual(
  (useAudioSource.match(/speakWithSynthesizerLifecycleExperiment\(/g) || []).length,
  1
);
assert.ok(useAudioSource.includes('const IOS_SYNTHESIZER_LIFECYCLE_EXPERIMENT_MODE ='));
assert.ok(useAudioSource.includes("'retained' as IosSynthesizerLifecycleExperimentMode"));
assert.ok(useAudioSource.includes('isDevelopment: __DEV__'));
assert.ok(useAudioSource.includes('platform: Platform.OS'));
```

Assert the same `speechOptions` identifier is supplied to both call sites, the invocation diagnostic timestamp remains before the branch, and the returned timestamp remains after the branch. Assert only one new `if` selects between the two submission functions.

Extend `scripts/speechPlaybackDiagnostics.test.js` so the `useAudio` integration source contract requires `synthesizerLifecycleMode` in the attempt input while preserving the existing hook state/ref counts, callback bodies, coordinator calls, and dependency lists.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
rtk node scripts/ttsSynthesizerLifecycleExperiment.test.js
rtk node scripts/speechPlaybackDiagnostics.test.js
```

Expected: FAIL because `useAudio` has no lifecycle selector, experimental call, or diagnostic mode input.

- [ ] **Step 3: Add the development selector and immutable resolved mode**

Import:

```ts
import {
  resolveSpeechSynthesizerLifecycleMode,
  speakWithSynthesizerLifecycleExperiment,
  type IosSynthesizerLifecycleExperimentMode,
} from '@/src/experiments/ttsSynthesizerLifecycleExperiment';
```

Near the existing iOS audio-session experiment selector, add:

```ts
// TEMPORARY iOS development-only causal probe. Release/non-iOS paths continue
// through Expo Speech. Build retained first; change only this value for reset.
const IOS_SYNTHESIZER_LIFECYCLE_EXPERIMENT_MODE =
  'retained' as IosSynthesizerLifecycleExperimentMode;

const SPEECH_SYNTHESIZER_LIFECYCLE_MODE =
  resolveSpeechSynthesizerLifecycleMode({
    isDevelopment: __DEV__,
    platform: Platform.OS,
    experimentMode: IOS_SYNTHESIZER_LIFECYCLE_EXPERIMENT_MODE,
  });
```

Pass `SPEECH_SYNTHESIZER_LIFECYCLE_MODE` into `createSpeechDiagnosticAttempt` as `synthesizerLifecycleMode`.

- [ ] **Step 4: Branch only at the existing synchronous submission line**

Keep timestamp capture immediately before and after submission. Replace the single call body with:

```ts
speechSpeakInvokedDiagnosticTime = captureSpeechDiagnosticTime();
if (
  SPEECH_SYNTHESIZER_LIFECYCLE_MODE === 'experimental-retained' ||
  SPEECH_SYNTHESIZER_LIFECYCLE_MODE ===
    'experimental-reset-per-utterance'
) {
  speakWithSynthesizerLifecycleExperiment(
    word,
    speechOptions,
    IOS_SYNTHESIZER_LIFECYCLE_EXPERIMENT_MODE
  );
} else {
  Speech.speak(word, speechOptions);
}
const speechSpeakReturnedDiagnosticTime = captureSpeechDiagnosticTime();
```

Do not move or edit option construction, callbacks, coordinator submission, diagnostics emission, warmup, audio-mode calls, or hook dependencies.

- [ ] **Step 5: Run focused experiment and audio tests**

Run:

```bash
rtk node scripts/ttsSynthesizerLifecycleExperiment.test.js
rtk node scripts/speechPlaybackDiagnostics.test.js
rtk node scripts/audioPlayback.test.js
rtk node scripts/speechPlaybackCoordinator.test.js
rtk node scripts/ttsDebugScreen.test.js
```

Expected: every focused test passes. `TTSDebugScreen` still has its own one Expo `Speech.speak` call and no experiment import.

- [ ] **Step 6: Review the behavioral diff before committing**

Run:

```bash
rtk git diff -- src/hooks/useAudio.ts src/domain/audioPlayback.ts src/domain/speechPlaybackCoordinator.ts src/components/TTSDebugScreen.tsx
```

Confirm that only `useAudio.ts` changed, and only by imports, a development selector/resolved mode, one diagnostic field, and the synchronous submission branch. Confirm speech options, coordinator transitions, callback bodies, audio-session option, warmup selector, state/refs, and dependencies are unchanged.

- [ ] **Step 7: Commit the development-only routing**

```bash
rtk git add src/hooks/useAudio.ts scripts/ttsSynthesizerLifecycleExperiment.test.js scripts/speechPlaybackDiagnostics.test.js
rtk git commit -m "chore: route iOS dev TTS through lifecycle probe"
```

### Task 5: Document the matched control, reset run, and rollback

**Files:**
- Modify: `docs/manual-smoke-test.md`

**Interfaces:**
- Consumes: the two build-time modes and `[tts-lifecycle]` mode field.
- Produces: an explicit same-device protocol, control gate, results record, decision rules, and deletion-only rollback instructions.

- [ ] **Step 1: Add the temporary physical-device experiment section**

Append a separate section titled `TEMPORARY — iOS AVSpeechSynthesizer Lifecycle Experiment`. Record the selector file/value, required controls, and this non-placeholder initial status:

```markdown
**Status:** Implementation verified locally; physical-device retained control not yet run.

| Mode | Device / iOS | Voice ID | Word | Rate | Route | Playback 1 | Playback 2 | Playback 3 | Valid control? |
|---|---|---|---|---:|---|---|---|---|---|
| `retained` | Not run | Not run | Not run | — | Not run | Not run | Not run | Not run | No evidence yet |
| `reset-per-utterance` | Blocked until retained reproduces | Same as retained | Same as retained | Same as retained | Same as retained | Not run | Not run | Not run | Requires valid retained control |
```

State the gate verbatim:

```markdown
Do not run or interpret reset mode until retained mode reproduces
`clean → stutter → stutter` under the same device, iOS version, development
build configuration, voice, word, rate, route, app settings, warmup variant,
and application audio-session configuration. If retained does not reproduce,
stop and report the lifecycle experiment as inconclusive.
```

Add the two interpretation rules from the design and state that any other pattern remains inconclusive.

- [ ] **Step 2: Document deletion-only rollback**

Add:

```markdown
### Removal

Delete `modules/tts-synthesizer-lifecycle-experiment/` and
`src/experiments/ttsSynthesizerLifecycleExperiment.ts`; remove the temporary
selector/submission branch from `src/hooks/useAudio.ts`; remove
`synthesizerLifecycleMode` from the diagnostics schema; and delete the focused
experiment assertions and this temporary section. No stored data, production
migration, content change, or native project edit is required.
```

- [ ] **Step 3: Commit the experiment protocol**

```bash
rtk git add docs/manual-smoke-test.md
rtk git commit -m "docs: add iOS synthesizer lifecycle protocol"
```

### Task 6: Verify JavaScript, native integration, and final scope

**Files:**
- Verify all files changed by Tasks 1-5.
- Do not commit: generated/ignored `ios/` contents.

**Interfaces:**
- Consumes: complete experimental implementation.
- Produces: fresh verification evidence for the completion report; no behavior changes.

- [ ] **Step 1: Run focused experiment and audio verification**

Run:

```bash
rtk node scripts/ttsSynthesizerLifecycleExperiment.test.js
rtk node scripts/speechPlaybackDiagnostics.test.js
rtk node scripts/audioPlayback.test.js
rtk node scripts/speechPlaybackCoordinator.test.js
rtk node scripts/ttsDebugScreen.test.js
```

Expected: all focused tests pass with zero failures.

- [ ] **Step 2: Run full repository verification**

Run each command separately and retain its exit status:

```bash
rtk npm test
rtk npm run typecheck
rtk npm run lint
rtk git diff --check
```

Expected: all commands exit 0.

- [ ] **Step 3: Regenerate the ignored iOS project and install pods**

Run:

```bash
rtk proxy npx expo prebuild --platform ios --no-install
```

Expected: prebuild completes without changing tracked files.

Run:

```bash
rtk proxy pod install --project-directory=ios
```

Expected: CocoaPods installs `TtsSynthesizerLifecycleExperiment` as a local Expo module without modifying tracked files.

- [ ] **Step 4: Compile an iOS Debug simulator build**

Run from the repository root:

```bash
rtk proxy xcodebuild -workspace ios/SoundwiseEnglish.xcworkspace -scheme SoundwiseEnglish -configuration Debug -sdk iphonesimulator -derivedDataPath /tmp/english-minimal-pairs-tts-lifecycle-derived-data CODE_SIGNING_ALLOWED=NO build
```

Expected: `** BUILD SUCCEEDED **`. This verifies Swift compilation and linkage but does not provide audible or physical-device evidence.

- [ ] **Step 5: Review changed files and forbidden scope**

Run:

```bash
rtk git status --short
rtk git diff --stat main...HEAD
rtk git diff main...HEAD -- package.json package-lock.json app.json eas.json src/domain src/components app
rtk git diff main...HEAD -- modules/tts-synthesizer-lifecycle-experiment src/experiments src/hooks/useAudio.ts src/diagnostics scripts docs/manual-smoke-test.md
```

Confirm:

- no dependency or app/deployment configuration changed;
- no tracked generated native file changed;
- Android/web, debug-screen, domain, coordinator, UI, learning, voice, warmup, and audio-session behavior did not change;
- the native module contains one mode branch and one `synthesizer.speak` call;
- the Expo `Speech.speak` release/non-iOS fallback remains;
- diagnostics retain every existing phase and add only the lifecycle mode;
- rollback remains deletion-only.

- [ ] **Step 6: Record the honest experiment state**

If no controlled physical-device run has been supplied, report:

```text
Retained control: not run on a physical device.
Reset comparison: blocked by the retained-control gate.
Hypothesis: neither confirmed nor rejected; experiment implementation and native build are verified only.
```

If device results are supplied, verify the retained row first. Only interpret reset when retained reproduced `clean → stutter → stutter` under the recorded matched controls.

- [ ] **Step 7: Commit any verification-only documentation correction**

If Task 6 required a documentation correction, stage only that file and use:

```bash
rtk git commit -m "docs: clarify TTS lifecycle verification"
```

If no tracked file changed during verification, do not create an empty commit.
