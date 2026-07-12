# **Option A implementation plan**

**Goal:** improve reliability and consistency of device TTS while preserving the app’s lightweight, offline-first design.

This should be split into small PRs. The `expo-audio` migration must remain a **behavior-preserving infrastructure change**, separate from voice-selection and pedagogical changes. That reduces rollback risk and prevents audio regressions from being confused with quality-policy changes. This follows the project’s reliability and complexity-management principles.

## **Current repo state**

The relevant paths are:

| Concern | Current file |
| ----- | ----- |
| TTS playback and audio session | `src/hooks/useAudio.ts` |
| Speech option construction | `src/domain/audioPlayback.ts` |
| Voice collection and rotation | `src/context/SettingsContext.tsx` |
| Voice controls | `app/(tabs)/settings.tsx` |
| TTS diagnostics | `src/components/TTSDebugScreen.tsx` |
| Audio unit tests | `scripts/audioPlayback.test.js` |
| Audio asset validation | `scripts/validate-audio-assets.js` |
| Manual verification | `docs/manual-smoke-test.md` |
| Silent-mode workaround | `assets/audio/silent.mp3` |
| Dependencies and quality gates | `package.json` |

The app currently uses:

* `expo-speech` to generate spoken words.  
* `expo-av` to configure the audio session and play `silent.mp3`.  
* A round-robin pool containing both enhanced and default-quality English voices.  
* A hardcoded `en-US` speech language, even when the selected voice has another locale.

---

# **PR 1 — Migrate `expo-av` to `expo-audio`**

**Suggested work item:** `app-059-migrate-expo-audio`

## **Scope**

Only replace the deprecated audio-session and silent-file APIs. Do not change:

* voice filtering  
* voice rotation  
* playback rate  
* speech locale  
* UI  
* pair data  
* the silent-mode workaround  
* TTS behavior intentionally

Expo SDK 54 recommends `expo-audio`; `expo-av` is deprecated, receives no patches, and is scheduled for removal in SDK 55\. ([Expo Documentation](https://docs.expo.dev/versions/v54.0.0/sdk/av/))

## **Step 1: Establish a baseline**

Before editing:

npm ci  
npm run check  
npx expo install \--check

Record the current behavior on:

* physical iPhone, silent switch on  
* physical iPhone, silent switch off  
* physical Android device  
* headphones/Bluetooth  
* repeated rapid playback  
* playback after app background/foreground  
* playback while another app is producing audio

The repository’s `npm run check` already runs lint, TypeScript, data validation, audio validation, and tests.

## **Step 2: Update dependencies**

Use Expo’s compatible package resolution:

npx expo install expo-audio  
npm uninstall expo-av

Expected changes:

* `package.json`  
* package lockfile

Do not add recording functionality or microphone permissions. The app only needs playback and audio-session configuration.

## **Step 3: Replace the audio-session API**

In `src/hooks/useAudio.ts`:

import {  
  setAudioModeAsync,  
  useAudioPlayer,  
} from 'expo-audio';

Replace the current `Audio.setAudioModeAsync()` calls with `setAudioModeAsync()`.

Conceptual mapping:

| `expo-av` setting | `expo-audio` setting |
| ----- | ----- |
| `playsInSilentModeIOS: true` | `playsInSilentMode: true` |
| `staysActiveInBackground: false` | `shouldPlayInBackground: false` |
| `allowsRecordingIOS: false` | `allowsRecording: false` |
| `interruptionModeIOS: 2` | `interruptionMode: 'duckOthers'` |
| `shouldDuckAndroid: true` | `interruptionMode: 'duckOthers'` |

`expo-audio` uses a unified `interruptionMode` and exposes `playsInSilentMode`, `allowsRecording`, and `shouldPlayInBackground`. ([Expo Documentation](https://docs.expo.dev/versions/v54.0.0/sdk/audio/)) ([Expo Documentation](https://docs.expo.dev/versions/v54.0.0/sdk/audio/))

Keep platform-specific configuration explicit rather than sending irrelevant iOS properties on Android or web.

## **Step 4: Migrate `silent.mp3` playback**

Prefer the lifecycle-managed hook:

const silentPlayer \= useAudioPlayer(  
  require('../../assets/audio/silent.mp3')  
);

Use it for the existing one-time iOS warmup. `useAudioPlayer` automatically manages and releases its player when the component unmounts, avoiding manual `stopAsync()` and `unloadAsync()` cleanup. ([Expo Documentation](https://docs.expo.dev/versions/v54.0.0/sdk/audio/))

Keep the asset reference in `src/hooks/useAudio.ts` for this PR. The existing validator explicitly checks that:

1. `assets/audio/silent.mp3` exists.  
2. The filename appears in `src/hooks/useAudio.ts`.

Moving or removing the reference during this migration would require an unrelated validator change.

## **Step 5: Preserve hook behavior**

The public contract must remain:

{  
  play,  
  audioModeReady,  
  isSpeaking  
}

Preserve these invariants:

* `audioModeReady` eventually becomes `true`, even when initialization fails.  
* iOS verifies that voices exist before playback.  
* active speech is stopped before new speech starts.  
* `isSpeaking` resets on completion, stop, synchronous exception, or speech error.  
* the audio session is reconfigured if it was interrupted or failed to initialize.

The current hook implements these behaviors explicitly.

## **PR 1 acceptance criteria**

### **Automated**

npm run check  
npx expo install \--check

Additionally:

grep \-R "expo-av" \--exclude-dir=node\_modules .

Expected result: no source or dependency references.

### **Manual**

| Scenario | Expected result |
| ----- | ----- |
| iPhone silent switch on | Word is audible |
| iPhone silent switch off | Word is audible |
| Android playback | Word is audible |
| Tap repeatedly | Latest utterance plays; state does not stick |
| Background then foreground | Playback recovers |
| Other audio playing | Other audio ducks consistently |
| No iOS simulator voices | Existing explicit error remains |
| Navigate away during playback | No crash or leaked player |
| Refresh voice list | Existing behavior remains |

## **Rollback**

Revert the single PR and reinstall dependencies. There is:

* no data migration  
* no settings migration  
* no schema change  
* no user-visible state change

---

# **PR 2 — Validate and simplify the iOS workaround**

**Suggested work item:** `app-060-audit-ios-tts-session`

Do not remove `silent.mp3` merely because `expo-audio` was installed.

Test three configurations on physical iOS devices:

| Configuration | Purpose |
| ----- | ----- |
| Application audio session \+ silent warmup | Current behavior |
| Application audio session without warmup | Determine whether `expo-audio` makes the workaround unnecessary |
| `useApplicationAudioSession: false` without warmup | Let iOS manage speech separately |

`expo-speech` supports `useApplicationAudioSession: false`, under which the system manages speech interruptions, mixing, and ducking through a separate session. ([Expo Documentation](https://docs.expo.dev/versions/v54.0.0/sdk/speech/))

### **Decision rule**

Remove `silent.mp3` only if the replacement passes:

* silent-switch playback  
* interruption recovery  
* repeated playback  
* headphones/Bluetooth  
* at least two physical iOS versions

If removed, update together:

* `src/hooks/useAudio.ts`  
* `scripts/validate-audio-assets.js`  
* `assets/audio/silent.mp3`  
* `docs/manual-smoke-test.md`

---

# **PR 3 — Extract and test the voice-selection policy**

**Suggested work item:** `app-061-curate-device-tts-voices`

The current `SettingsContext` contains both persistence mechanics and pedagogical voice policy. Extract the policy into a pure module, for example:

src/domain/voiceSelection.ts

That keeps device APIs and storage in the context while making the selection rules explicit and testable. It also prevents voice-quality rules from being distributed across settings UI, hooks, and infrastructure.

## **Voice policy**

Apply this order:

1. Non-excluded `en-US` enhanced voices.  
2. Non-excluded `en-US` default voices.  
3. Non-excluded enhanced `en-*` voices.  
4. Any non-excluded `en-*` voice.  
5. System default as the final fallback.

Use the Expo enum rather than string inspection:

voice.quality \=== Speech.VoiceQuality.Enhanced

Expo exposes `Default` and `Enhanced` as the available voice-quality classifications. ([Expo Documentation](https://docs.expo.dev/versions/v54.0.0/sdk/speech/))

## **Required invariants**

* Never return an explicitly excluded voice.  
* Never return a known novelty voice.  
* Prefer enhanced voices when available.  
* Avoid immediate speaker repetition when the pool contains multiple voices.  
* Reset rotation predictably when the pool changes.  
* Always retain a fallback path.  
* Do not hardcode platform-specific voice identifiers.

Add tests for:

* mixed enhanced/default pools  
* no enhanced voices  
* only non-US voices  
* excluded enhanced voices  
* one available voice  
* empty pool  
* rotation after exclusions change

---

# **PR 4 — Match speech locale to the selected voice**

**Suggested work item:** `app-062-align-tts-locale`

Update the voice abstraction in `src/domain/audioPlayback.ts`:

export interface PlaybackVoice {  
  identifier: string;  
  language: string;  
}

Then construct options using:

language: voice?.language ?? 'en-US'

The current code always sets `language: 'en-US'` while the voice pool may contain `en-GB`, `en-AU`, `en-IN`, and other locales.

Add unit tests confirming:

* selected voice locale is used  
* no-voice fallback remains `en-US`  
* existing rate, pitch, volume, and callback behavior remains unchanged

---

# **PR 5 — Introduce controlled voice variability**

**Suggested work item:** `app-063-stage-voice-variability`

Do not rotate through every installed voice indiscriminately.

Use the pair difficulty already present in the data:

| Difficulty | Active voice pool |
| ----- | ----- |
| 1–2 | Highest-priority voice only |
| 3–4 | First two prioritized voices |
| 5–6 | Full prioritized pool |

This 1 / 2 / full staging gives a cleaner progression than larger stage sizes: easy pairs are always heard from one stable voice, medium pairs introduce a single alternate, and hard pairs expose the full rotation.

Pass playback context into voice selection:

getNextVoice({  
  difficulty: selectedPair.difficulty,  
});

Keep selection deterministic—round-robin rather than random—so failures can be reproduced.

Fallback gracefully when a device has fewer voices. The rule should be “use up to N voices,” not “require N voices.”

The placement test is an assessment, not guided practice, so it opts out of staging explicitly (`getNextVoice({ mode: 'placement' })`) and always rotates across the full prioritized pool.

---

# **PR 6 — Add TTS quality auditing**

**Suggested work item:** `app-064-audit-device-tts-risk`

Option A cannot force the TTS engine to follow the stored IPA. The app supplies the written word to `Speech.speak()`, while each pair separately stores its intended IPA.

Add a repository audit that identifies:

* the same spelling associated with multiple IPA values  
* likely heteronyms  
* dialect-sensitive words  
* words repeatedly used across contrast groups  
* pairs known to collapse under particular device voices

Start the audit as reporting-only, not a failing gate.

Extend `TTSDebugScreen.tsx` to show:

* word  
* intended IPA  
* selected voice  
* locale  
* quality  
* playback rate  
* last playback error

The frozen dataset contains 813 pair records, so manual verification should prioritize unique and ambiguous words rather than blindly reviewing every pair instance.

---

# **Completion criteria**

Option A is complete when:

1. `expo-av` is fully removed.  
2. Physical-device playback remains reliable.  
3. No recording permissions are introduced.  
4. Enhanced voices are preferred.  
5. Voice locale and speech locale agree.  
6. Early training uses a smaller, stable voice pool.  
7. Later training introduces controlled variability.  
8. Ambiguous TTS words are visible through an audit.  
9. The existing `npm run check` remains the required merge gate.  
10. Quality claims are based on device testing, not assumptions about the new playback library.

## **Recommended sequence**

PR 1: expo-audio migration  
PR 2: iOS workaround experiment  
PR 3: voice-policy extraction and enhanced preference  
PR 4: locale alignment  
PR 5: staged voice variability  
PR 6: pronunciation-risk audit and diagnostics

The key constraint is to keep **audio infrastructure**, **voice-selection policy**, and **pedagogical sequencing** as separate changes. That makes each regression attributable, testable, and reversible.

