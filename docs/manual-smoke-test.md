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
