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

## 18. TEMPORARY — iOS TTS Generation-Drain Mitigation Phase 1 Ship Gate

**Status: rotation is enabled by explicit exception, not by satisfying this
gate.** (`soundwiseGenerationRotationEnabled = true` as of 2026-08-08.) The
blocking acceptance criteria below were written to gate this constant and
were **not** evaluated — the 60-attempt physical-device matrix in Step 2 was
not run, and no candidate-arm device evidence exists. See "Enablement
exception" immediately below the Build-arm procedure for the actual decision
basis, evidence used, and residual risk. See
`docs/tts-expo-speech-native-contract.md` for the mechanism, its
Debug/Release policy, and its removal criteria (a larger, separate process
from the rollback defined here).

This section was originally written and committed **before** any
physical-device attempt was run, specifically so the acceptance rules, the
labeling procedure, and the blocking/advisory split could not be adjusted
after seeing results. The rules below are preserved unmodified as the
standard this exception deviates from — they were not weakened to fit the
decision that was actually made.

**Who can execute this:** an agent cannot run this section. It requires a
physical iPhone, an Apple Developer signing/deploy setup, and a human
listening to and labeling audio. Tooling support (patch regeneration, patch
provenance verification, strict log analysis, control-vs-candidate
comparison) is already built and ready — see the Build-arm procedure and
Analysis subsections — but the acoustic judgment and the physical execution
are not delegable.

### Build-arm procedure

Two adjacent commits, identical except for one Swift boolean:

1. Edit `node_modules/expo-speech/ios/SpeechModule.swift`, flip only
   `soundwiseGenerationRotationEnabled`.
2. Regenerate the patch: `npx patch-package expo-speech`.
3. Recompute the source hash:
   `shasum -a 256 node_modules/expo-speech/ios/SpeechModule.swift`, and
   update the `sha256` field in `scripts/expoSpeechPatchManifest.json` to
   match — the constant flip changes the file's hash, so this step is
   mandatory, not optional. `npm run verify:expo-speech-patch` fails loudly
   if it's skipped.
4. `npm run verify:expo-speech-patch` — confirm it passes against the new
   hash.
5. `npm run check` — full local verification.
6. `git diff --check`; confirm the diff against the prior validation commit
   touches only `patches/expo-speech+14.0.7.patch` (regenerated) and
   `scripts/expoSpeechPatchManifest.json` (the hash), and that
   `src/domain/speechPlaybackCoordinator.ts`, `src/domain/audioPlayback.ts`,
   and `src/hooks/useAudio.ts` are untouched.
7. Commit as the "control" build identity (constant `false`) or the
   "candidate" build identity (constant `true`), then produce a Debug
   physical-device build from that exact commit.

**Control arm:** constant `false` — this was the committed state through
2026-08-08.
**Candidate arm:** constant `true` — normally built only after the control
arm's device matrix (below) has actually reproduced the original failure.
That sequencing was not followed for the current production state; see
Enablement exception immediately below.

### Enablement exception (2026-08-08) — Task 7 matrix not run

Rotation was enabled in production (`soundwiseGenerationRotationEnabled =
true`) by explicit user decision, without running Step 2's 60-attempt
physical-device matrix or building/testing a candidate arm on any device.
This is documented here, in the same section that defines the gate it
bypasses, so the exception cannot be mistaken for the gate having been
satisfied.

- **Decision basis:** the existing controlled experiment on
  `experiment/tts-lifecycle-commit2` (commit `1c81d90`, physical iPhone 16
  Pro, iOS 26.5.2, voice `com.apple.eloquence.en-GB.Shelley`, 34 retained
  attempts vs. 34 counted + 1 calibration reset attempts, analyzer-classified
  `VALID`/`PROCEED`). That experiment's own findings doc states its
  conclusion is causal-evidence only: it "does not establish root cause,
  generalize to other devices/iOS versions, authorize production code, or
  select a permanent mitigation," and rates confidence as "moderate" with
  memory measurement, acoustic-label denominators, arm ordering, and device
  coverage explicitly called out as limited.
- **What was substituted for the gate:** nothing quantitative. No production
  build (Debug or Release) with `soundwiseGenerationRotationEnabled = true`
  has been installed on a physical device under this decision. The change
  that shipped is the native constant flip plus its provenance bookkeeping
  (regenerated patch, updated `sha256` in
  `scripts/expoSpeechPatchManifest.json`) and the existing automated test
  suite (`npm test`, `npm run verify:expo-speech-patch`), not new
  device-level evidence.
- **Not satisfied by this exception:** every item in "Blocking acceptance
  criteria" below remains unevaluated — zero-confirmed-candidate-stutter
  across 60 attempts, cross-device replication, the latency-delta thresholds,
  and absence of user-visible regressions in stop/pause/resume/background/
  interruption/route-change behavior are all unmeasured for the
  candidate arm. Task 8's memory/soak gate (Instruments Allocations/Leaks
  across a 500-utterance soak) has also not been run.
- **Rollback trigger:** any report of TTS stutter, crash, memory warning, or
  playback-control regression after this change ships — see Rollback vs.
  removal below, which remains a one-line, single-commit action
  (`soundwiseGenerationRotationEnabled` back to `false`, or reverting the
  enabling commit).

### Post-enablement smoke test (2026-08-09) — partial coverage, not the Phase 1 matrix

An informal enabled-arm smoke test was run after the enable-by-exception
decision above, on the same device used throughout this investigation
(`Chiang Mai Express`, iPhone 16 Pro, iOS 26.5.2), commit `881eac6`, Debug
build, `soundwiseGenerationRotationEnabled = true`. This is **not** the
Step 2 60-attempt matrix and does not satisfy the Blocking acceptance
criteria below — it is a smaller check that the enabled mitigation runs at
all before further work continues.

**Captured evidence:** 15 completed utterances across one session
(`/tmp/soundwise-tts-enabled-smoke.log`, merged from Metro and native device
console streams).

- All 15 `[tts-playback]` sequences completed cleanly: `requested →
  accepted → submitted-to-native-speech → started → completed`. Zero
  `cancellationAtMs`, zero `timedOutAtMs`, zero `failureAtMs`.
- All 15 `[tts-synthesizer-lifecycle]` sequences completed with `anomaly:
  null`: `creation → submission → terminal(done/delegateFinish) →
  retirement`.
- **Rotation fired on every single request** — `generation` incremented
  sequentially 1 through 15, one per utterance, with
  `trackedOutstandingUtterances` draining to 0 each time.
- Submission-to-terminal duration was tight and uniform across all 15
  (920–1150ms), with no outliers suggesting an interrupted or paused
  utterance.
- Background/resume was exercised and clean: 3 `appEntersBackground` /
  `appEntersForeground` event pairs, all completed round-trips.
- Acoustic result reported by the operator: all 15 played back clean, no
  reported stutter.

**Structural finding — three of the five originally-scoped scenarios are
unreachable in the current app, not merely untested:**

- **Explicit stop**: `Speech.stop()` is never called anywhere in `src/` or
  `app/` — not in the production practice screen, not in
  `src/components/TTSDebugScreen.tsx`. There is no code path a user or
  tester can trigger that invokes it.
- **Pause/resume**: same — `Speech.pause()` and `Speech.resume()` are never
  called anywhere in the codebase.
- **True rapid/overlapping replay**: the practice screen's replay control is
  rendered `disabled={playedIdx === null || feedback !== null || isSpeaking}`
  (`app/(tabs)/index.tsx:200`), so it cannot be tapped again until the prior
  utterance's `isSpeaking` flips false at full completion. The fastest
  possible next request is bounded by human reaction time after re-enable,
  not by any sub-second overlap — the smallest gaps actually observed in
  this session were ~1.4–1.7s, not the near-immediate replay the original
  regression and the Phase 1 protocol describe.

This means the achievable coverage from this smoke test is **normal
playback and background/resume only** — the other two scenarios in the
original 5-scenario request (stop, pause/resume) and true rapid-replay
timing cannot be exercised as user-facing paths in this app as currently
built. **Unreachable is not the same status as passed.** These three
conditions were not attempted and did not succeed; they are absent from
this evidence entirely. Recording them as "achievable coverage: 2 of 5"
means the validation *scope* shrank to what the app makes reachable, not
that the app was tested against all five conditions and cleared three of
them silently. It also means the production UI's own request serialization
is, independently of the native rotation mitigation, already structurally
preventing the overlapping-tap condition most associated with the original
regression — a separate, favorable structural fact, but not a substitute
for having actually run those scenarios.

### What this evidence does and does not establish

Two different claims are easy to conflate here and must be kept separate:

1. **Mitigation stability on reachable app flows** — supported by this
   smoke test. On the scenarios the shipped app can actually exercise
   (normal playback, background/resume), the enabled build ran 15/15
   utterances cleanly: no native anomalies, no watchdogs, no timeouts, no
   cancellations, rotation firing on every request, uniform submission-to-
   terminal timing. This is real, if narrow, evidence that enabling
   rotation did not destabilize the flows this app can reach.
2. **Evidence that the original retained-synthesizer failure is
   eliminated** — **not supported by this smoke test.** The original
   failure was characterized (in the Commit 2 experiment) under rapid
   back-to-back replay on a retained synthesizer — exactly the condition
   this app's UI structurally prevents from being tested at all here. A
   clean 15/15 result on scenarios that don't reproduce the failure
   condition is not evidence the failure condition is fixed; it's evidence
   the reachable, non-failure-triggering flows still work after the change.
   The failure this mitigation targets remains unreproduced and
   unretested end-to-end in this session.

Claim 1 is established. Claim 2 is not, and nothing in this section should
be read as implying it. This does not establish that the mitigation fixes
the underlying bug.

### Acoustic labeling procedure

Defined now, before any attempt is run, so labeling cannot be biased by
having already seen a result:

1. **Label before reviewing logs.** For each attempt, the reviewer records
   an acoustic label — `clean`, `stutter`, or `ambiguous` — immediately after
   listening, before opening or reviewing that attempt's native lifecycle
   diagnostics or the analyzer's output. The log evidence and the acoustic
   evidence are two independent checks on the same mitigation; collapsing
   them by letting one bias the other defeats the purpose of having both.
2. **`ambiguous` is a real, retained label**, not a forced binary choice. An
   ambiguous attempt is not discarded and is not silently folded into either
   `clean` or `stutter` — it is logged as its own row and requires a second
   listen (ideally by the same reviewer, noted as a second pass) before the
   matrix is considered complete. If a second listen doesn't resolve it, it
   stays `ambiguous` and is called out explicitly when the gate is applied.
3. **Document reviewer and conditions** for every session: reviewer name,
   date, device, iOS version, playback condition (device speaker vs.
   headphones — specify which), and environment (quiet room vs. ambient
   noise). Acoustic perception is condition-sensitive; a session run through
   headphones in a quiet room is not directly comparable to one run on a
   speaker with background noise, and mixing them without noting it would
   quietly corrupt the comparison.
4. **Known limitation, not solved here:** the reviewer knows which arm
   (control or candidate) they are testing, since the two arms are built and
   installed sequentially, not interleaved or randomized. This is expectation
   bias risk that this procedure does not eliminate — only the log-blinding
   in step 1 is enforced. Treat any single reviewer's result with that in
   mind; a second, independent reviewer on at least the original-device
   configuration would reduce this risk if resourcing allows, but is not a
   blocking requirement below.

### Device matrix

Restated precisely because the source plan's phrasing ("60 attempts on the
original device and at least 30 per arm on...") is ambiguous about whether
the two additional configurations need both arms or only the candidate arm.
**Both arms, on all three configurations**, is the reading used here — the
gate requires a like-for-like comparison on every configuration tested, not
just the original device, or "no new stutter on other configurations"
(Blocking, below) would have nothing to compare against on those two configs:

| Configuration | Control attempts | Candidate attempts |
|---|---:|---:|
| Original failing device/iOS (where the bug reproduces today) | 60 | 60 |
| One different iPhone generation | ≥30 | ≥30 |
| One different supported iOS major version | ≥30 | ≥30 |

Scenario coverage, one acoustic label per completed request, applied across
the attempt counts above: cold launch, normal, rapid replay,
background/resume, identical word, multiple voices, explicit stop,
pause/resume, interruption, route-change.

### Capture naming and provenance convention

Defined before any build so captures from different sessions, arms, and
configurations can never be silently confused with each other.

**Raw capture files** (Metro/Xcode console output, containing the
`[tts-playback]` and `[tts-synthesizer-lifecycle]` marked diagnostics):

```
/tmp/soundwise-tts-<arm>-<config-id>.log
```

- `<arm>` — `retained` or `mitigation`, matching the Build-arm procedure
  above.
- `<config-id>` — `device1` (the original failing device/iOS), `device2`
  (the different iPhone generation), or `device3` (the different iOS major
  version), matching the Device matrix table above. `device1` always means
  the original failing configuration, regardless of which specific physical
  unit is used as `device2`/`device3`.

One file per arm per configuration, covering that entire cell's attempts (60
or ≥30). Cold-launch scenarios necessarily interrupt a live console capture
by relaunching the app; if a session produces multiple log segments,
concatenate them in chronological capture order into the single named file
before analysis (`cat segment1.log segment2.log > /tmp/soundwise-tts-<arm>-<config-id>.log`)
rather than analyzing fragments separately.
`scripts/analyze-tts-validation-log.js` validates marked lines in file order,
so concatenation in true capture order is safe; concatenation out of order is
not, since the JS lifecycle validator enforces per-request event ordering.

**Analyzer JSON output**, one per raw capture:

```bash
npm run analyze:tts-log -- --require-native-lifecycle --json \
  /tmp/soundwise-tts-<arm>-<config-id>.log > /tmp/soundwise-tts-<arm>-<config-id>.json
```

**Comparator output**, one per configuration, comparing the two arms with the
same `<config-id>`:

```bash
node scripts/compare-tts-lifecycle-validation.js \
  /tmp/soundwise-tts-retained-<config-id>.json \
  /tmp/soundwise-tts-mitigation-<config-id>.json
```

**Provenance stays in the Results log, not the filename.** Filenames encode
only arm and configuration — deliberately not device model, iOS version,
commit SHA, reviewer, or date, which would make them unwieldy and still
wouldn't be authoritative. That metadata belongs in the Results log row for
that capture, following the same pattern as the "Verified TestFlight build
log" table in section 17 above: build/commit verified via `eas build:list`
or `git show`, never inferred from a filename or marketing version.

**Captures are not committed.** Raw `.log` and `.json` files stay local
(`/tmp` or wherever convenient) and are never added to git — only the
Results log summary, the comparator's verdict per configuration, and the
Decision record get committed to this document.

### Analysis (tooling already built, ready to use)

Per capture file, per arm, per configuration:

```bash
npm run analyze:tts-log -- --require-native-lifecycle --json <capture>.log > <capture>.json
node scripts/compare-tts-lifecycle-validation.js <control>.json <candidate>.json
```

### Blocking acceptance criteria (all required; any failure stops the decision)

- the control arm reproduces the original failure on the original device
  often enough to make the comparison meaningful (procedural validity — if
  the control arm doesn't show the bug, there is nothing to have fixed);
- every capture, every arm, every configuration classifies `VALID`
  (`analyze-tts-validation-log.js`'s `captureStatus`);
- zero watchdogs, late callbacks, duplicate terminals, or callback failures,
  every arm, every configuration;
- zero confirmed candidate-arm stutters on the tested matrix (per the
  labeling procedure above — a candidate attempt labeled `stutter` after the
  second-listen step is a confirmed stutter and blocks the gate; an
  attempt still `ambiguous` after a second listen does not by itself block
  the gate, but must be recorded and called out explicitly in the Decision
  record, not silently passed over);
- median latency delta ≤ 15ms and p95 delta ≤ 30ms, per configuration
  (`compare-tts-lifecycle-validation.js`'s thresholds);
- zero user-visible regressions in stop/pause/resume/background/
  interruption/route-change behavior, on any configuration;
- no crash and no explicit iOS low-memory warning during the matrix.

**Reading note on the comparator's "unexpected cancellations" check:** it is
a proxy over total `cancelled` count (documented in
`docs/tts-expo-speech-native-contract.md`), because the JS event schema
doesn't distinguish a deliberate stop-initiated cancellation from an
unexpected one. The matrix includes an explicit-stop and a pause/resume
scenario by design — those will legitimately produce `cancelled` events. Read
the comparator's automated verdict for those two scenarios by hand; do not
treat an automated FAIL there as a blocking failure without checking whether
it's explained entirely by the deliberate-stop scenarios.

### Advisory observations (inform the decision; do not gate it)

- **Acoustic improvement magnitude** — how much better (or not) the
  candidate arm sounds relative to the control arm's confirmed failure rate,
  beyond the binary "zero confirmed stutters" blocking bar.
- **Memory observations** — informal resident-memory behavior noticed during
  the Phase 1 matrix. A rigorous quantitative memory gate (Instruments
  Allocations/Leaks across a 500-utterance soak, ≤10MB settled-memory delta)
  is Task 8's job, not Task 7's; Phase 1 only records what was informally
  observed. A genuine crash or an explicit system memory-warning event is
  **not** advisory — see Blocking above.
- **Cross-device confidence** — how consistent results were across the three
  configurations; informs how much weight the decision below places on this
  evidence, without being itself a pass/fail line.

### Rollback vs. removal — not the same action

**Rollback** (this section's concern): if a problem is found after the
candidate arm is built — during Phase 1 testing, or hypothetically after a
later production enable — the remedy is reverting
`soundwiseGenerationRotationEnabled` back to `false`, or reverting the
specific commit that flipped it. This is a one-line, single-commit action.
Everything built in Tasks 1–6 (the generation/terminal accounting, the
serialized native lifecycle queue, the patch-provenance verifier, the CI
provenance job, the log analyzer and comparator) stays in place regardless —
none of that is rotation-specific, and rolling back the flag does not touch
any of it.

**Removal** (a separate, larger process, not triggered by this section): the
full Removal criteria in `docs/tts-expo-speech-native-contract.md` — deleting
the patch entirely, which requires re-running this same device matrix in
reverse, a clean install, and unpatched source-provenance verification. Do
not conflate a rotation rollback with mitigation removal; they are different
actions with different evidence requirements.

### Decision record

One of exactly four values, per `docs/tts-expo-speech-native-contract.md`'s
Debug/Release policy: **enable**, **reject**, **defer**, or **remove**.

| Field | Value |
|---|---|
| Decision | **enable** — by exception, not by satisfying the gate above |
| Decided by | Repository owner (Jonathan Freed), explicit chat instruction |
| Date | 2026-08-08 |
| Evidence summary | `experiment/tts-lifecycle-commit2` (commit `1c81d90`) single-device causal comparison, not the Step 2 60-attempt matrix defined above. See "Enablement exception" under Build-arm procedure for the full basis and what remains unmeasured. |

### Results log

_(Empty — populated once physical-device attempts are run. One row per
capture per configuration per arm, plus the acoustic labeling log and the
comparator verdict per configuration, following the format established in
section 17's Results log above.)_

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
