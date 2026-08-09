# TTS Stutter Investigation

## Scope and current conclusion

The repository contained a confirmed playback-orchestration race: two play
requests delivered in the same JavaScript event batch could both observe stale
React `isSpeaking` state and call `Speech.speak`. Expo Speech queues every call
on its single native synthesizer, so one apparent user action could produce two
utterances.

The phoneme-specific voice-artifact hypothesis is still open. `right`, `light`,
and `three` are difficulty 1–2 examples, and that tier intentionally uses the
same first prioritized device voice. A physical-device batch is required to
determine whether that voice also elongates R, L, or TH in the generated audio.

The playback rate is not changed by the orchestration fix.

## Playback lifecycle

```text
Listen/compare/placement press
  -> useAudio.play(word index)
  -> global SpeechPlaybackCoordinator accepts or rejects the request
  -> iOS voice availability check
  -> difficulty-scoped voice selection
  -> speech options and app request identity created
  -> Speech.speak
  -> Expo creates AVSpeechUtterance on its single AVSpeechSynthesizer
  -> onStart
  -> onDone / onStopped / onError
  -> coordinator releases the request
  -> React isSpeaking becomes false
```

The coordinator is the synchronous source of truth. React state only renders
the UI and no longer decides whether native speech is already owned.

## Diagnostic events

Development builds log `[tts-playback]` events for:

- `requested`
- `accepted`
- `rejected-duplicate`
- `submitted-to-native-speech`
- `started`
- `completed`
- `cancelled`
- `failed`

Each event includes the word, difficulty, selected voice identifier, request
ID, request/submission/start/finish/cancel timestamps, current `isSpeaking`,
and coordinator-observed active playback ownership count. This is ownership in
application code, not a native utterance count: Expo does not expose its private
native utterance ID, native queue depth, or exact `AVSpeechUtterance`
construction time. `speechSubmittedAtMs` is the nearest observable submission
boundary, and `onStart` is the first native playback callback. A healthy
accepted request has one submission, one start, and exactly one terminal event.
Coordinator-observed active playback ownership must never exceed one. Rejected
same-batch calls include their own request ID plus the active playback owner's
request ID. For requests that reach native speech, the accepted-request count
must equal the `submitted-to-native-speech` event count; a rejected duplicate
must never produce a native-submission event.

## Reproduction evidence

With the pre-fix UI and a deterministic browser speech stub, two presses
delivered in one JavaScript batch produced:

```json
{"speechSpeakCalls":2,"speechStopCalls":0}
```

With the coordinator in place:

- 20 normal press cycles produced 20 speech submissions.
- 20 cycles containing two same-batch presses produced 20 speech submissions,
  not 40.
- The duplicate request emitted `rejected-duplicate`.
- The accepted request emitted one submission, one start, and one finish.

This proves the queue race and its fix. It does not prove that the native voice
never synthesizes an elongated phoneme.

## Physical-device acoustic matrix

Use a development build on a physical iPhone and capture both the device audio
and Metro/Xcode `[tts-playback]` logs. The existing `TTSDebugScreen` contains a
fixed batch of `right`, `light`, `three`, `cat`, and `dog`, with 20 repetitions
per word at one fixed voice and rate. Mount it inside `SettingsProvider` as its
file header describes.

Run the full batch:

1. Immediately after cold launch.
2. After backgrounding for at least 10 seconds and resuming.
3. With normal single presses in the production practice screen.
4. With at least five rapid repeated presses in the production practice screen.
5. Once per candidate voice, changing only the included voice between runs.

Record results in this form:

| Scenario | Voice ID | Word | Repetitions | Stutters | Log lifecycle | Acoustic pattern |
|---|---|---|---:|---:|---|---|
| Cold launch |  | right | 20 |  | 1 submit/start/finish | elongated or restart |
| Cold launch |  | light | 20 |  | 1 submit/start/finish | elongated or restart |
| Cold launch |  | three | 20 |  | 1 submit/start/finish | elongated or restart |
| Cold launch |  | cat | 20 |  | 1 submit/start/finish | control |
| Cold launch |  | dog | 20 |  | 1 submit/start/finish | control |

Repeat the five rows for background/resume and for each tested voice.

## Decision rules

- If a captured stutter has two request IDs, submissions, or starts,
  playback orchestration is still faulty.
- If a captured stutter has exactly one lifecycle and follows one voice across
  R/L/TH while controls remain clean, the generated voice audio is faulty;
  adjust voice eligibility only for the identified voice.
- If failures cluster only on the first post-launch or post-resume request
  across both affected and control words, investigate audio-session activation.
- Do not change rate, add delays, or exclude voices without one of these evidence
  patterns.

## Generation-drain hypothesis (follow-on work)

A separate, later hypothesis under evaluation: a retained `AVSpeechSynthesizer`
instance may accumulate stutter risk across many sequential utterances,
independent of the phoneme-artifact hypothesis above. This is a candidate
explanation supported by one matched physical-device experiment, not a
confirmed root cause, and the two hypotheses are not mutually exclusive.

A native mitigation (idle-to-active synthesizer generation rotation, patched
into `expo-speech`) exists and has been **enabled** since 2026-08-08, by
explicit exception rather than by satisfying its own Phase 1 physical-device
ship gate — see `docs/tts-expo-speech-native-contract.md` for the mechanism,
its Debug/Release policy, and its removal criteria, and
`docs/manual-smoke-test.md` section 18 for the enablement exception, the
evidence it was based on, and what it leaves unmeasured. Enabling it is not a
claim that either hypothesis is confirmed or that the original acoustic
failure is fixed. It does not change anything described above:
the coordinator-level fix and the physical-device acoustic matrix in this
document remain the reference evidence for the phoneme-artifact hypothesis,
independent of whatever the generation-drain evaluation concludes.
