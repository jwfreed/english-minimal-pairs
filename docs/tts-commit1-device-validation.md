# TTS Commit 1 — Device Validation Protocol

Validates the playback ownership recovery floor (`fix/tts-playback-ownership-recovery`)
on a physical device. Commit 2 — the synthesizer lifecycle experiment — is
gated on a clean result here.

## Gate

Commit 2 does not begin until all three hold:

1. No regression in normal practice playback.
2. Zero unexpected watchdog recoveries during normal use.
3. Timeout diagnostics confirmed to appear on-device.

Item 3 is confirmed by deliberately provoking one timeout (see §4). A run that
reports zero timeouts without ever demonstrating that a timeout *would* be
visible has not confirmed the diagnostics — it has only confirmed silence.

## 1. Build

Use a **development build**, not `preview`.

```
npx expo run:ios --device      # or: eas build --profile development --platform ios
```

Reason: the attempt denominator comes from `logSpeechDiagnostic`, which returns
early when `!__DEV__` (`src/hooks/useAudio.ts`). Only the recovery diagnostics
are ungated. A release build reports timeouts with no denominator — you would
learn there were three recoveries but not out of how many playbacks.

No `TTSDebugScreen` mounting is required. Normal practice already routes
through `useAudio`.

## 2. Capture

```
npx expo start --dev-client 2>&1 | tee /tmp/tts-validation.log
```

Keep one continuous capture per device. Note the device model, iOS version, and
build number at the top of the file.

## 3. Sessions

Hold the device off silent, on speaker, at a fixed volume. Target **≥ 30
counted attempts** total.

| # | Condition | What it exercises |
|---|---|---|
| 1 | Cold launch, then normal practice at unhurried intervals | Baseline; first-utterance path |
| 2 | Rapid replay — tap A/B alternately as fast as the UI allows, ≥ 10 times | The reported regression, and the duplicate-rejection path |
| 3 | Background ≥ 10s, resume, continue practice | Post-resume audio session state |
| 4 | Repeated identical pair, ≥ 10 plays of the same word | Retained-synthesizer degradation, if present |
| 5 | Repeat across at least two voices if the difficulty tiers expose them | Voice independence |

Record any audible defect against the wall-clock time so it can be aligned with
the log: stutter at word onset, delayed playback, a queued utterance arriving
late, or silence.

## Analyzer input integrity

The analyzer accepts the real one-line JSON emitted by the iPhone development
client and the constrained legacy multiline Metro representation with unquoted
keys and single-quoted values. A diagnostic record begins only on a line
containing `[tts-playback]`. Unmarked console lines are unrelated noise and are
ignored. After a marked record begins, a missing closing boundary, malformed
payload, or a second marker before completion invalidates that record and the
entire capture.

The analyzer is a verification tool, not a best-effort log viewer. Every
discovered diagnostic record must parse and satisfy the known Commit 1 event
schema. Malformed JSON or legacy records, incomplete multiline records,
unknown phases, missing required fields, invalid request identifiers or
timestamps, and lifecycle sequences that Commit 1 cannot emit invalidate the
entire capture. The analyzer never falls back from malformed JSON to tolerant
token matching and never derives a verdict from partially parsed metrics.

Lifecycle validation preserves the intended exceptional paths: rejected
duplicates, terminal callbacks after a missing `started` callback, both timeout
phases, callbacks arriving after a timeout and newer ownership, and
`late-callback-unknown-request` events without a known request lifecycle.
Every accepted request must resolve to exactly one of `completed`, `cancelled`,
`failed`, `ownership-timeout-awaiting-start`, or
`ownership-timeout-awaiting-terminal`; missing and duplicate terminal outcomes
invalidate the capture.

The coordinator has exactly one global playback owner. Active ordinary phases
must report one owner, terminal and timeout phases must report ownership already
released, accepted requests cannot overlap, and duplicate or late-callback
diagnostics that name an active owner must identify the owner established by the
lifecycle history. Any contradiction invalidates the capture.

Every analysis reports one capture classification:

- `VALID` — every diagnostic record parsed and passed schema/lifecycle checks,
  and accepted or submitted events prove the playback-attempt denominator.
- `INVALID_CAPTURE` — at least one record failed parsing, schema, or lifecycle
  validation, or diagnostic records exist without denominator evidence.
- `EMPTY_CAPTURE` — no diagnostic records were found.

Only `VALID` captures expose playback metrics and the Commit 1 runtime verdict.
`INVALID_CAPTURE` and `EMPTY_CAPTURE` exit nonzero, explain why the evidence is
unusable, and withhold partial metrics. The parse summary always includes lines
inspected, records found, parsed and invalid record counts, the first invalid
line, representative parse/schema errors, and lifecycle validation failures.

`VALID`, `INVALID_CAPTURE`, and `EMPTY_CAPTURE` describe whether the evidence
can be trusted. `PROCEED`, `INCONCLUSIVE`, `REVIEW`, and `BLOCKED` describe the
runtime behavior observed only after the evidence is `VALID`. `VALID` alone is
not a pass, and the analyzer exits 0 only for `PROCEED`.

## 4. Confirm the diagnostics are actually visible

Zero timeouts in a healthy run proves nothing about whether a timeout would be
*seen*. Provoke one once, on a scratch build:

Temporarily lower `START_BUDGET_MS` in `src/domain/audioPlayback.ts` to a value
below normal start latency (for example 50), rebuild, and play one word. For
the separate authorized timeout-visibility run, record all three facts:

1. The timeout diagnostic appears in the capture.
2. `coordinatorObservedActivePlaybackOwnershipCount` is `0`, proving ownership
   released before the diagnostic was emitted.
3. The operator visually confirms the UI speaking state clears.

The analyzer can prove the first two from the diagnostic payload. The third is
a required physical-device observation because the timeout diagnostic does not
emit React UI state.

**Revert the constant before the real validation run.** Record in the results
that this check was performed and reverted.

## 5. Analyze

```
npm run analyze:tts-log -- /tmp/tts-validation.log
```

Exits 0 only for a clean `VALID` capture and exits 1 otherwise. After the
capture classification passes, the runtime verdict distinguishes:

- `PROCEED` — ≥ 30 attempts, zero recoveries, zero late callbacks.
- `INCONCLUSIVE` — clean but under-sampled.
- `REVIEW` — no recoveries, but native errors or unexplained late callbacks.
- `BLOCKED` — watchdog recoveries during normal use.

`INVALID_CAPTURE` and `EMPTY_CAPTURE` do not receive a runtime verdict.

## 6. Results

| Field | Value |
|---|---|
| Device | |
| iOS version | |
| Build / commit | |
| Voices exercised | |
| Total playback attempts | |
| Completed / cancelled / failed | |
| Rejected as duplicate | |
| Watchdog timeouts — awaiting-start | |
| Watchdog timeouts — awaiting-terminal | |
| Late callbacks — after-timeout | |
| Late callbacks — unknown-request | |
| Audible stutters (count, condition) | |
| Delayed or queued utterances | |
| Diagnostics visibility confirmed (§4) | |
| Verdict | |

## 7. Interpreting a timeout

Do **not** adjust the timeout constants on a first sighting. Classify first:

- **False positive** — audio sounded completely normal and the utterance
  finished, but the watchdog fired anyway. The budget is too tight for this
  device or rate. This is the only case that justifies changing constants, and
  the change should raise the floor rather than the per-character estimate.
- **True positive** — audio was silent, truncated, or the UI was stuck before
  the watchdog fired. The floor is doing its job; the underlying lost callback
  is the finding, and it is significant.

Either way, a recovery during normal use blocks Commit 2 until explained.

## 8. What this validation cannot establish

It does not test the synthesizer lifecycle hypothesis, does not compare recycle
on/off, and does not measure inter-utterance gap. Those belong to Commit 2's
symmetric experiment. A clean result here means only that the reliability floor
is safe to build on — not that the stutter is fixed. The stutter is expected to
still be present.
