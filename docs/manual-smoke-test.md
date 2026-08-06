# Manual Smoke Test Checklist

## When to Run This

Run before each release build submission (App Store / Play Store). Estimated time: 15–25 minutes on one iOS device and one Android device.

> **Note:** Node/CI cannot validate device TTS, installed voices, iOS silent-mode behavior, or foreground/background audio routing. This checklist covers those gaps. Automated checks (see Preflight) must also pass independently.

---

## Preflight

Run automated checks first. All must pass before proceeding to manual testing.

```
npm run check
```

This runs: lint · typecheck · data validation · audio asset validation · unit tests.

- [ ] `npm run check` exits 0 with no errors.

---

## Devices

| Device | OS Version | Tester | Date |
|---|---|---|---|
| iOS (physical) | | | |
| Android (physical) | | | |

---

## Test Matrix

### 1. App Launch

- [ ] App launches without crash.
  Expected: home screen (Practice tab) renders with a Listen button and two word-choice buttons.
- [ ] No red error overlay visible on cold start.

### 2. Language / Category Selection

- [ ] Navigate to Settings tab.
  Expected: Settings tab loads without crash.
- [ ] Change the target language (if multiple are listed).
  Expected: word pair buttons on Practice tab update to reflect the selected language.
- [ ] Open the category dropdown on the Practice tab (or Settings, whichever exposes it).
  Expected: category list appears; selecting a category changes the displayed pair.

### 3. Placement Test (first run or after reset)

- [ ] On a fresh install (or after clearing app data), launch the app.
  Expected: a placement test screen appears before the main practice loop.
- [ ] Answer all placement questions.
  Expected: placement completes without crash and drops the user into the practice screen at an appropriate starting tier.
- [ ] The placement test does not appear again on subsequent launches without a reset.
  Expected: returning to the app skips placement and goes directly to practice.

### 4. Practice — Listen Flow

- [ ] Tap the Listen button.
  Expected: exactly one of the two displayed words is spoken via device TTS. The spoken word is not revealed visually.
- [ ] Verify TTS is audible (device not muted, see iOS silent-mode section below).
  Expected: speech is clearly heard through the device speaker or connected audio output.

### 5. Replay Before Answer

- [ ] Tap Listen again before selecting an answer.
  Expected: the same word is replayed. The app does not pick a new word for the same round.
- [ ] Tap Listen a third time.
  Expected: same word replayed again; answer buttons remain enabled.

### 6. Correct Answer

- [ ] Tap the answer button that matches the spoken word.
  Expected: visual correct-answer feedback appears (color, icon, or animation). A new round begins automatically or on next tap.
- [ ] Confirm haptic feedback fires on correct answer (iOS / Android physical device only).
  Expected: brief haptic pulse is felt.

### 7. Incorrect Answer

- [ ] Tap the answer button that does NOT match the spoken word.
  Expected: visual incorrect-answer feedback appears. The correct word is indicated.
- [ ] Confirm the app does not crash or freeze on an incorrect answer.

### 8. Listen Again After Feedback

- [ ] After receiving feedback (correct or incorrect), tap Listen.
  Expected: the word for that completed round plays again; the app does not advance to the next round mid-playback.

### 9. Round Progression

- [ ] Complete 5–10 rounds in a row.
  Expected: rounds advance normally; word pairs change according to the adaptive progression (playback rate may increase after a streak of correct answers).
- [ ] Confirm playback speed increases after a correct streak (3–6 answers).
  Expected: spoken audio is noticeably faster compared to early rounds.

### 10. Progress / Mastery Sanity

- [ ] Navigate to the Results tab after completing at least 5 rounds.
  Expected: Results screen shows attempt counts or accuracy data; no crash.
- [ ] Return to Practice tab.
  Expected: practice resumes from the current state; session data is not reset by tab navigation.

### 11. Reset / Progress Clear (if available)

- [ ] If the Settings or Results screen exposes a "Reset progress" action, tap it.
  Expected: confirmation prompt appears before any data is cleared.
- [ ] Confirm reset and relaunch the app.
  Expected: progress is cleared; placement test appears again on next session start.

---

## Audio Checks

### 12. iOS Physical Device — TTS

- [ ] Run on a physical iPhone (not Simulator).
  Expected: `expo-speech` produces audible output. Simulator TTS behavior does not represent device behavior.
- [ ] Verify the correct English voice is used (not a placeholder or silent fallback).
  Expected: clearly intelligible English speech.
- [ ] Test with AirPods or wired headphones connected.
  Expected: audio routes to the connected output, not the built-in speaker.

### 13. Android Physical Device — TTS

- [ ] Run on a physical Android device (not Emulator).
  Expected: `expo-speech` produces audible output.
- [ ] Verify the English TTS engine/voice is installed on the device.
  Expected: speech is clearly intelligible English; no "language data missing" error is shown.
- [ ] Test with headphones connected.
  Expected: audio routes correctly to the connected output.

### 14. iOS Silent Mode (Ring/Silent Switch)

> This cannot be validated by automated tests.

- [ ] Put the iOS device into silent mode (physical switch on the side).
  Expected: **TTS audio still plays** through the speaker. `expo-audio` is configured with `playsInSilentMode: true` and `interruptionMode: 'duckOthers'`; the app intentionally overrides silent mode for learning audio. Ringtones and notifications should be muted, but the app's TTS must not be.
- [ ] Turn silent mode off (switch back to ring) and tap Listen.
  Expected: TTS plays normally; no change in volume or routing versus silent mode.
- [ ] Verify no regression: muting with the iOS volume buttons does reduce app audio volume (the silent switch alone should not silence TTS).

### 15. Background / Foreground Behavior

- [ ] Start a practice round, then press the Home button (or switch to another app).
  Expected: audio playback stops or is paused; the app does not continue speaking in the background.
- [ ] Return to the app.
  Expected: app resumes at the same round state without crash; a tap on Listen replays correctly.
- [ ] Receive a phone call during a round (if testable).
  Expected: TTS audio pauses; call audio works normally; returning to the app does not crash audio session.

### 16. Audio Session Regression Checks (expo-audio migration)

> Added for the migration to `expo-audio`. Run on physical devices after any change to `src/hooks/useAudio.ts` or the audio dependencies.

- [ ] Tap Listen rapidly 5+ times while speech is still playing.
  Expected: the previous utterance stops, the latest one plays, and the speaking state does not get stuck (Listen keeps working afterward).
- [ ] Start music in another app (e.g. Music/Spotify), return to the app, tap Listen.
  Expected: the other app's audio ducks (lowers) during TTS and recovers afterward; TTS is clearly audible over it.
- [ ] Navigate to another tab during playback, and again immediately after playback ends.
  Expected: no crash, no audio glitch, and returning to Practice lets Listen work normally.
- [ ] iOS Simulator only: tap Listen with no TTS voices installed.
  Expected: the existing explicit error appears ("TTS not available on iOS Simulator. Please test on a physical device."); the app does not hang or crash.
- [ ] In Settings, refresh the voice list and toggle a voice exclusion, then play several rounds.
  Expected: voice rotation behavior is unchanged; excluded voices are never used; no audio-session errors.

**First-utterance checks (iOS, silent switch on).** These specifically test the moment the audio session must be (re-)configured before speech runs — the highest-risk point for a swallowed first word:

- [ ] Cold launch: force-quit the app, relaunch, and tap Listen as the very first action.
  Expected: the first utterance is audible; it is not silently dropped while the session/warmup initializes.
- [ ] Foreground recovery: background the app for several seconds, return to it, and tap Listen as the first action after returning.
  Expected: the first utterance after resuming is audible, not just the second or later tap.
- [ ] Interruption recovery: receive a phone call (or trigger another system interruption) during idle time, dismiss it, and tap Listen as the first action afterward.
  Expected: the first utterance after the interruption ends is audible.
- [ ] Bluetooth route change: with the app open and idle, connect (or disconnect) a Bluetooth audio device, then tap Listen as the first action after the route change.
  Expected: the first utterance after the route change is audible and plays through the new route.

---

## 17. TEMPORARY — iOS Silent-Warmup Experiment (app-060 / PR 2)

> **Status: PAUSED, pending a second physical device/iOS version.** PR 2 is
> not complete and not closed-out — it is on hold. Variant B has passed the
> full test matrix, including repeated first-utterance scenarios, on one
> physical device (iPhone 16 Pro / iOS 26.5.2). The decision rule requires
> confirmation on a second physical iPhone or iOS version before a
> retain/remove decision can be made. `silent.mp3`, the warmup player, the
> validator, and the `IOS_AUDIO_SESSION_EXPERIMENT` selector are all
> deliberately left in place and unmodified so the experiment can be resumed
> without re-implementation once that second-device evidence is available.
> The selector is currently set to the safe ship default
> (`'A-silent-warmup'`) so any incidental production build in the meantime
> retains the workaround.
>
> **Temporary section.** Remove together with the `IOS_AUDIO_SESSION_EXPERIMENT`
> selector in `src/hooks/useAudio.ts` once the experiment reaches a final
> decision (in a dedicated follow-up cleanup PR, not as part of this pause).
> This experiment determines whether the `silent.mp3` warmup is still required
> now that `expo-audio` configures the audio session.

### Build variants

The variant is selected at build time by the `IOS_AUDIO_SESSION_EXPERIMENT`
constant in `src/hooks/useAudio.ts`. Produce each TestFlight build from a
commit where the constant is unambiguous, and record the constant value with
the build number below **before** testing. The committed ship value is
`'A-silent-warmup'`.

| Variant | Constant value | What changes |
|---|---|---|
| A (baseline) | `'A-silent-warmup'` | Current shipping behavior: warmup plays once after session config. |
| B (primary) | `'B-no-warmup'` | The silent `expo-audio` player is never loaded or played, so it triggers no session activation/retention; everything else identical. See Controls below — this is not just "no warmup sound." |
| C (secondary) | `'C-system-speech-session'` | No warmup **and** `useApplicationAudioSession: false` — iOS owns the speech session. Answers a different question than B; do not treat C results as evidence about B. |

### Controls — hold constant across variants

Same physical iPhone, same iOS version, same build configuration
(TestFlight/release), same selected TTS voice, same test words, same app
settings, same playback rate, same network state, and the same
Bluetooth/headphone route per scenario.

The effective independent variable between A and B is **whether the silent
`expo-audio` player is loaded and played** — not merely "whether the warmup
plays." In A, `useAudioPlayer` is given the `silent.mp3` source and `.play()`
is called, which triggers expo-audio's own session activation (and, via
`keepAudioSessionActive: true`, retention of that active session after the
clip finishes). In B, `useAudioPlayer` is given `null`: no source is loaded,
`.play()` is never called, and `keepAudioSessionActive` is therefore inert —
it has nothing to retain. So B does not just "skip a warmup sound"; it
removes every session-activation and session-retention effect that loading
and playing that player would otherwise cause, and relies entirely on the
AppDelegate plugin's launch-time activation (see note below) plus
`expo-speech`'s own session handling. Treat the two as differing in that
whole bundle of effects, not in playback of one audio clip alone.

Note: `plugins/withAudioSession.js` natively sets and activates the audio
session in the AppDelegate at launch in **all** variants. It is part of the
baseline environment, not an experiment variable.

### Test matrix — run per variant, per device

Repeat every first-utterance scenario (1, 2, 5, 6, 7, 12) at least 3 times.
A single success is not sufficient evidence.

| # | Scenario | Pass criterion |
|---|---|---|
| 1 | Cold launch, silent switch ON, first utterance | First word audible, not swallowed |
| 2 | Cold launch, silent switch OFF, first utterance | First word audible |
| 3 | Second and later utterances | All audible, no degradation |
| 4 | Rapid repeated Listen taps (5+) | Latest utterance plays; state never sticks |
| 5 | Background ≥10 s, foreground, first utterance | Audible on first tap after return |
| 6 | Interruption (phone call/timer), dismiss, first utterance | Audible on first tap after interruption |
| 7 | Connect/disconnect Bluetooth while idle, first utterance | Audible through the new route |
| 8 | Wired or wireless headphones | Routes to headphones, audible |
| 9 | Playback while another app plays audio | Other audio ducks during TTS, recovers after |
| 10 | Idle ≥30 s after playback | Other apps' audio is NOT still ducked |
| 11 | Navigate away during / just after playback | No crash, no stuck audio state |
| 12 | Force quit, relaunch, first utterance | Audible on first tap |

### Verified TestFlight build log

Record each production build's variant here **before** testing, verified
against the EAS build record (`eas build:list --platform ios`), not inferred
from the marketing version number — `appVersionSource` is `"remote"`
([eas.json](../eas.json)), so `app.json`'s committed `buildNumber` does not
reflect the actual submitted build number, and the same marketing version
(e.g. `1.1.3`) can span multiple build numbers and multiple commits.

| Build no. | Version | Commit | Profile | Build date | Selector value at that commit | Verified via |
|---|---|---|---|---|---|---|
| 79 | 1.1.3 | `8e97b072facfdfe20e65cca2a03a91c60b659738` | production | 2026-07-12 | `B-no-warmup` (unchanged from build 78 — this commit only touched docs) | `eas build:list` + `git show <commit>:src/hooks/useAudio.ts` |
| 78 | 1.1.3 | `5b83006280384eac68a5994ebe1398afcf0becde` | production | 2026-07-12 | `B-no-warmup` | `eas build:list` + `git show <commit>:src/hooks/useAudio.ts` |
| 77 | 1.1.3 | `a3f4ef41062cf378af174a4bc9732e2b3eb92af2` | production | 2026-07-12 | `A-silent-warmup` | `eas build:list` + `git show <commit>:src/hooks/useAudio.ts` |
| 76 | 1.1.3 | `0f168d3c99db2f1b049005975b8252eff9a03225` | production | 2026-07-11 | n/a — pre-experiment (PR 1 migration; selector did not exist yet) | `eas build:list` |

**Build 79 is the build actually tested on device**, and it is confirmed
Variant B: it was built from the doc-only commit immediately after 78, which
made no changes to `src/hooks/useAudio.ts` (`git diff --stat 5b83006..8e97b07
-- src/hooks/useAudio.ts` is empty) and has the identical native fingerprint
(`f93faaf7...`) as build 78. Build 78 itself was never installed/tested.
Log device results against **build 79**.

Build 77 is the **baseline (A)** configuration — it predates any B or C
build. Do not record device results for build 77 against variant B or C rows
below; any testing on build 77 only re-validates the current shipping
behavior, not the experiment.

### Results log

> **Note on device coverage:** the second test round below was reported as
> run on "the same device, iPhone 16 [Pro], iOS 26.5.2" — i.e. the identical
> physical device and identical iOS version as round 1, not a second
> configuration. The decision rule requires success on **at least two
> distinct physical iOS versions or devices**, specifically to catch
> device-model- or OS-version-specific behavior. Two passes on one
> device/iOS combination satisfy the *repetition* requirement for the
> first-utterance scenarios but do **not** satisfy the *two-device/version*
> requirement. Round 2 is logged below as additional repetitions on device
> config #1, not as device config #2.

| Variant | Device / iOS | Build no. | Commit | Scenario # | Attempts | Pass/Fail | Notes |
|---|---|---|---|---|---|---|---|
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 1 (cold launch, silent ON) | 3/3 | Pass | Meets ≥3 repetition threshold |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 2 (cold launch, silent OFF) | 3/3 | Pass | Meets ≥3 repetition threshold |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 3 (later utterances) | 2/2 | Pass | |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 4 (rapid repeated taps) | 2/2 | Pass | |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 5 (background/foreground) | 3/3 | Pass | Meets ≥3 repetition threshold |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 6 (interruption recovery) | 3/3 | Pass | Meets ≥3 repetition threshold |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 7 (Bluetooth route change) | 3/3 | Pass | Meets ≥3 repetition threshold |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 8 (headphones) | 2/2 | Pass | |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 9 (ducking during playback) | 2/2 | Pass | |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 10 (idle after playback, ducking recovery) | 2/2 | Pass | |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 11 (navigate away during/after) | 2/2 | Pass | |
| B | iPhone 16 Pro / iOS 26.5.2 | 79 | `8e97b07` | 12 (force quit, relaunch) | 3/3 | Pass | Meets ≥3 repetition threshold |

**Coverage so far:** full 12-scenario matrix completed twice, first-utterance
scenarios (1, 2, 5, 6, 7, 12) repeated 3 times each, **zero failures across
all attempts**, on **one** physical device/iOS configuration (iPhone 16 Pro,
iOS 26.5.2). This is strong evidence for that specific configuration and
satisfies the matrix's repetition requirement. It does **not** yet satisfy
the decision rule's requirement of at least two distinct physical iOS
versions or devices — see the note above and Decision rule below.

### Decision rule

Remove `silent.mp3` (and this section, the experiment selector, and the
validator entry) only if variant B passes the full matrix — including
repeated first-utterance runs and silent-switch scenarios — on at least two
physical iOS versions or devices, with no stuck ducking and no regression in
repeated playback or route changes. If evidence is incomplete or mixed,
retain the warmup and remove the experiment selector.

---

## 18. TEMPORARY — iOS Synthesizer Lifecycle Causal Experiment

> **Status:** Physical-device comparison completed on 2026-08-06. The retained
> control reproduced the stutter and reset-per-utterance produced no reported
> stutters. This supports synthesizer retention as a causal or necessary
> trigger on this device/configuration. It is evidence only and must not be
> promoted directly into production playback.

### Arms and boundary

`IOS_SYNTHESIZER_LIFECYCLE_EXPERIMENT_MODE` in `src/hooks/useAudio.ts` selects
one of two iOS development-build arms:

- `retained`: the app-owned probe creates one `AVSpeechSynthesizer` and reuses
  it for every utterance.
- `reset-per-utterance`: the first utterance uses that same initial instance;
  every later valid utterance uses a newly created synthesizer.

Both arms share the native module, delegate, utterance type, speech options,
callback adapter, Commit 1 coordinator/watchdog, warmup variant, and audio
session. Release builds and non-iOS platforms remain on Expo Speech. Native
events add a synthesizer identifier and creation count to the existing
`[tts-playback]` evidence without changing its lifecycle phases.

### Matched protocol

Run the retained control first. Use the same physical device, iOS version,
Debug development-client configuration, voice identifier, word (`oath`), rate
(`0.85`), output route, volume, silent-switch position, app settings, warmup
variant, and audio-session configuration for both arms. Cold-launch each arm
and collect one continuous log.

Count at least 30 completed attempts per arm under the same matrix:

| Condition | Count per arm |
|---|---:|
| Cold launch, unhurried replay | 5 |
| Rapid replay | 10 |
| Background at least 10 seconds, then resume | 5 |
| Repeated identical word with quick replay | 10 |

Score every attempt `clean` or `stutter` before inspecting lifecycle logs.
Record other audible outcomes separately. Analyze each capture with
`npm run analyze:tts-log -- <capture>`; any invalid capture, watchdog timeout,
late callback, ownership leak, missing terminal callback, or duplicate native
submission makes that arm unusable until explained.

For lifecycle evidence, retained must report one synthesizer identifier and
creation count throughout. Reset must advance the identifier and creation
count on every completed utterance after the first. Record callback counts and
ordering from the same capture.

Record the process memory footprint after cold launch, after attempt 15, and
after attempt 30 using the same Xcode memory gauge procedure for both arms. If
reset shows sustained growth rather than bounded churn, capture an Allocations
trace before interpreting the experiment as safe.

### Result record

| Arm | Build / commit | Attempts | Clean | Stutter | Watchdogs | Late callbacks | Synthesizer evidence | Memory observations |
|---|---|---:|---:|---:|---:|---:|---|---|
| `retained` | 1.1.3 (57), `278aac392393b54a8131021ed0bba127ebc22551` | 34 completed | 14 labels* | 24 labels* | 0 | 0 | One identifier, creation count 1 throughout | Instruments could not attach; no playback-time crash or memory warning observed |
| `reset-per-utterance` | 1.1.3 (57), `5d1a78711d136af85557f06f9fd995cb5815eccb` | 34 counted + 1 excluded calibration | 32 counted labels + 1 calibration* | 0 reported | 0 | 0 | 35 unique identifiers; creation counts 1–35 sequential | Instruments could not attach; no playback-time crash or memory warning observed |

Both arms ran on iPhone 16 Pro (`iPhone17,1`), iOS 26.5.2 (`23F84`),
speaker route at the operator-held volume, word `oath`, rate `0.85`, and voice
`com.apple.eloquence.en-GB.Shelley`. The retained capture is
`/tmp/tts-lifecycle-retained-278aac3.log`; the reset capture is
`/tmp/tts-lifecycle-reset-5d1a787.log`.

Both analyzer runs classified their captures `VALID` with runtime verdict
`PROCEED`. Retained recorded 34 each of requested, accepted, submitted,
started, and completed. Reset recorded 35 each including the excluded
calibration. Neither arm recorded cancellation, native failure, duplicate
rejection, watchdog recovery, or late callback. Submit-to-start latency was
22–41 ms (30 ms mean) retained and 24–55 ms (30 ms mean) reset. The reset
effect therefore did not coincide with a material onset delay.

\* The operator annotations do not exactly match the diagnostic denominators.
The retained response contains 38 acoustic labels (14 clean, 24 stutter) for
34 logged completions. The reset response contains 32 clean labels for 34
counted completions, plus one separately recorded clean calibration. The
capture denominators and lifecycle metrics are trustworthy; exact per-attempt
acoustic rates are not. The qualitative comparison remains strong because the
retained arm contains many explicitly reported stutters while reset contains
no reported stutter, but this mismatch lowers interpretation confidence.

Quantitative memory evidence is unavailable: `xctrace` listed the connected
phone as offline and produced no usable Allocations trace. A development-client
TurboModule invalidation timeout also occurred while repeatedly replacing the
JS bridge before the reset run. A fresh integrated `expo run:ios` launch loaded
the reset arm, after which all 35 playbacks completed normally. The invalidation
event is treated as development-tooling teardown evidence, not a playback
callback result; it remains a risk to investigate if the probe is extended.

Interpretation is causal and bounded: a stuttering retained arm with a clean
reset arm under matched controls supports retained synthesizer lifetime as a
causal or necessary trigger. It does not establish root cause, generalize to
other devices/iOS versions, authorize production code, or select a permanent
mitigation. Confidence for this single-device causal comparison is moderate:
native allocation, callback, timing, and ownership evidence are strong; audio
annotation denominators, memory measurement, arm ordering, and device coverage
remain limited.

### Removal

Delete `modules/tts-synthesizer-lifecycle-experiment/` and
`src/experiments/ttsSynthesizerLifecycleExperiment.ts`; remove the temporary
selector/submission branch and lifecycle metadata from `src/hooks/useAudio.ts`;
and delete the focused experiment assertions and this section. No production
data migration or generated native-file change is required.

---

## Failure Log

Record any failures below. Do not ship if any item marked Critical is failing.

| # | Area | Steps to Reproduce | Expected | Actual | Severity | Status |
|---|---|---|---|---|---|---|
| | | | | | | |

**Severity levels:** Critical (blocks release) · High (degrades core loop) · Low (cosmetic/minor)

---

## Release Decision

All of the following must be true before submitting a release build.

- [ ] `npm run check` passes (zero errors).
- [ ] App launches without crash on iOS physical device.
- [ ] App launches without crash on Android physical device.
- [ ] TTS is audible on iOS physical device.
- [ ] TTS is audible on Android physical device.
- [ ] iOS silent-mode override works (TTS plays with silent switch on).
- [ ] Correct-answer and incorrect-answer flows complete without crash.
- [ ] Round progression advances normally for 10+ rounds.
- [ ] No Critical failures recorded in the Failure Log above.

**Sign-off**

| Role | Name | Date | Pass / Fail |
|---|---|---|---|
| Tester | | | |
| Release approver | | | |
