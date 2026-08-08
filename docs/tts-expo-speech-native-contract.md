# Expo Speech Native Mitigation Contract

## Document status

- **Contract type:** internal engineering contract for a first-party patch to
  a third-party native module. This is not a public API, and it is not
  reviewed or endorsed by the Expo project.
- **Version scope:** pinned exactly to `expo-speech@14.0.7`
  (`patches/expo-speech+14.0.7.patch`, verified by
  `scripts/verify-expo-speech-patch.js`). Every claim in this document is
  scoped to that exact version; any version bump invalidates it until
  re-verified — see [Removal criteria](#removal-criteria).
- **Status: temporary mitigation, not permanent architecture.** Generation
  rotation is enabled as of 2026-08-08
  (`soundwiseGenerationRotationEnabled = true` in `SpeechModule.swift`), by
  explicit decision recorded in `docs/manual-smoke-test.md` section 18's
  Decision record and Enablement exception. It was enabled without running
  that section's Phase 1 physical-device matrix — see that document for the
  evidence basis and unmeasured risk. The constant itself is unchanged in
  form (still a deletable native-only compile-time flag, not yet made
  unconditional) so rollback remains a one-line revert.
- **Removal lifecycle ownership:** there is no separate designated owner.
  Whoever next touches this patch, the `expo-speech` dependency, or its
  verification tooling is responsible for checking whether the
  [Removal criteria](#removal-criteria) apply before continuing.

## Pinned API contract

`speak`, `stop`, `pause`, `resume`, and `isSpeaking` all run on one private
serial `lifecycleQueue` (`.runOnQueue(lifecycleQueue)`), as does the module's
initial synthesizer/delegate creation. Every `SpeechDelegate` callback
(`didStart`, `willSpeak`, `didCancel`, `didFinish`) only enqueues a handler
onto that same queue — no delegate callback reads or mutates lifecycle state
off-queue.

Return shapes are pinned and unchanged from the upstream module's JS-visible
contract:
- `speak` returns `Void`.
- `stop`, `pause`, and `resume` return `Void` — the native `Bool` results
  `stopSpeaking`/`pauseSpeaking`/`continueSpeaking` produce are consumed
  internally (`stop`'s result selects the resolution path; `pause`/`resume`'s
  results are discarded) and never surfaced to JavaScript.
- `isSpeaking` returns the native boolean snapshot, unchanged.

`getVoices` is intentionally **not** on `lifecycleQueue`: it calls
`AVSpeechSynthesisVoice.speechVoices()`, a class-level query that never reads
or mutates this module's synthesizer instance, generation counter, or
outstanding-utterance accounting.

## Cancellation and anomaly behavior

- **Natural delegate resolution** (`resolveDelegateTerminal` in
  `SpeechGenerationLifecycle.swift`): a terminal callback for a tracked
  outstanding utterance delivers once (`deliverTrusted`) and retires that
  utterance. A terminal for an untracked id is delivered without accounting
  (`deliverUnknownWithoutAccounting`) — the public JS event still fires, but
  it never rotates or decrements state, since we cannot trust an id we never
  submitted.
- **Successful explicit stop** is two-phase and synchronous within one
  lifecycle-queue operation: `resolveSuccessfulStop()` snapshots every
  outstanding id in submission order and marks it pending; the caller sends
  each id's `SPEAKING_STOPPED` event and then immediately calls
  `completeSuccessfulStopDelivery(id:)`, the only operation allowed to retire
  that id. There is no async hop between native stop success, the JS bridge
  handoff, and native retirement, so a late Apple `didCancel` for the same
  utterance is processed only after the loop completes and is suppressed as a
  duplicate.
- **Failed stop** (`noteFailedStop()`) is conservative: outstanding
  utterances stay tracked exactly as they were: nothing is retired, nothing
  rotates.
- **Duplicate and unknown terminals** are suppressed
  (`suppressDuplicate`, `suppressAfterHistoryEviction`) rather than
  re-delivered or re-accounted. Resolved-utterance history is bounded; a late
  terminal that arrives after its id has been evicted from that bounded
  history is treated fail-closed — suppressed, not trusted.
- **Diagnostics are bounded to at most 20 invariant-failure events** per
  module runtime (`maxInvariantFailureDiagnostics`), so a pathological
  failure loop cannot flood logs.
- **Missing-terminal detection**: `isSpeaking` calls
  `observeSynthesizerIdle()`, which reports an anomaly if the synthesizer is
  idle while utterances remain tracked as outstanding — a terminal Apple
  never delivered.

## Debug and Release policy

```text
Debug:   mitigation/accounting enabled; full structured lifecycle diagnostics
         (creation, submission, terminal, retirement — generation,
         utteranceId, terminalKind, terminalSource,
         trackedOutstandingUtterances, timestampMs).
Release: identical mitigation/accounting; ordinary lifecycle logs suppressed;
         at most 20 invariant-failure diagnostics per module runtime.
Validation control: soundwiseGenerationRotationEnabled is a native-only
         compile-time constant, one value per commit — false is the retained
         control build, true is the rotation-candidate build. Current value:
         true, as of 2026-08-08, by the enable-by-exception decision below.
```

**The Phase 1 device matrix was not run before this decision.** The
validation constant's disposition, normally one of four values decided after
that matrix, was instead decided by exception:

- **enable** _(current, by exception)_ — the constant is `true` in production.
  Ordinarily this requires the constant to then be deleted so rotation
  becomes unconditional (the plan's original "production final" path), which
  requires the device matrix and acceptance gate to pass cleanly first. That
  step has **not** happened — the constant remains present and settable back
  to `false`, deliberately, so the decision stays a one-line rollback until
  Phase 1 evidence exists to justify deleting it;
- **reject** — the constant is deleted with rotation permanently disabled,
  and the patch is removed per [Removal criteria](#removal-criteria), if the
  matrix (were it run) shows no benefit or a regression;
- **remove** — the patch is withdrawn regardless of device-matrix outcome, if
  measured cost (allocation churn, maintenance burden) outweighs the
  reliability benefit even where the mechanism itself works;
- **defer** — the constant is retained at `false` and no production decision
  is made, if the evidence gathered is inconclusive and more is required.
  (Superseded for now by the enable-by-exception decision above.)

See `docs/manual-smoke-test.md` section 18's Decision record and Enablement
exception for who made this call, on what evidence, and what remains
unverified.

## Patch application lifecycle

```text
npm ci
  -> patch-package applies patches/expo-speech+14.0.7.patch
  -> installed verifier (scripts/verify-expo-speech-patch.js --installed)
     checks version, lockfile, sentinel, source hash, and xcframework absence
  -> CocoaPods selects the patched Swift source (native build step, outside
     this repository's JS tooling — not independently verified by it)
  -> a clean xcodebuild compiles the patched path (native build step)
  -> build-log provenance (scripts/verify-expo-speech-patch.js --installed
     --build-log <path>) confirms the compiled source resolves to the patched
     installed SpeechModule.swift, when a build log is supplied
```

Any failed stage aborts the build. The build-log provenance step is optional
input to the same script (no build log means that check is simply skipped);
it becomes a required CI gate only once wired into automation.

## Removal criteria

The mitigation is removed when any of the following holds:

- a validated upstream Expo fix lands;
- a validated iOS fix lands;
- evidence shows rotation is unnecessary (the underlying drain does not
  reproduce, or reproduces at a rate indistinguishable from noise);
- measured cost (allocation churn, ongoing maintenance) outweighs the
  reliability benefit, even where the mechanism works as designed.

Removal requires the same rigor as adding it: the same strict device matrix,
the same latency thresholds, the same callback invariants, the same memory
gate, plus patch deletion, a clean install, unpatched source-provenance
verification, and confirmation that the Commit 1 coordinator behavior is
unchanged.

Every `expo-speech` or Expo SDK version upgrade triggers this removal review.
Upstream issue or PR acceptance is not required to keep or remove the patch
locally, and upstream release notes alone are not sufficient grounds to
remove it without re-running this verification.

## Upstream draft (informational only — not submitted)

> **This section is a draft only.** It has not been submitted to Expo, has
> not been reviewed by the Expo project or any of its maintainers, and
> carries no endorsement from them. It exists so that a future, explicitly
> authorized submission does not have to be written from scratch. Nothing
> here obligates or schedules a submission. Local use of this mitigation
> does not depend on upstream acceptance, in any form, at any point.

**Draft title:** `expo-speech` (iOS): retained `AVSpeechSynthesizer` may
accumulate stutter risk across many sequential utterances

**Expo version:** _(fill in from the validated device-matrix run)_
**Device / iOS version:** _(fill in from the validated device-matrix run)_

**Minimal reproduction:** _(fill in — a fixed word list at a fixed voice and
rate, repeated N times on a single retained synthesizer instance)_

**Retained vs. reset evidence:** _(fill in from the Phase 1 matched
control/candidate device matrix once run)_

**Callback evidence:** _(fill in — native lifecycle diagnostics showing
callback ordering and accounting across the retained-synthesizer run)_

**Memory limitation:** _(fill in — note that this proposal does not claim to
have isolated a specific Apple-side memory or state-accumulation mechanism;
it describes an observed correlation, not a diagnosed internal cause)_

**Proposal:** create a fresh synthesizer generation when transitioning from
idle to active speech, once every callback from the previous generation has
drained, while keeping closely spaced queued utterances on the same
generation to preserve existing queue semantics. Framed as a workaround
candidate, not a root-cause fix — this framing is intentional and should be
preserved in any eventual submission.
