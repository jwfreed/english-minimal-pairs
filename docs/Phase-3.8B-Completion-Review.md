# Phase 3.8B — Completion Review

Date: 2026-08-01

Status: **Implementation checkpoint. Not a rollout authorization.**

Scope: documentation only. This document records what was built and what
remains undecided. It changes no source, no test, no configuration, no feature
flag, no rollout state, and no Decision.

Implementation of record:
[`a6424d1`](../src/domain/masteryRolloutSafety.ts) — *feat: add advisory mastery
rollout safety evaluator*. Status recorded in the Evolution Plan by `6554b6d`.

**This document is a record, not a source of truth.** It describes what was
built and what remains undecided at one point in time. It does not define
architecture, does not create or amend any Decision, and does not authorize
anything. Where it summarizes a rule, the authoritative statement of that rule
lives elsewhere and governs on any conflict:

| Subject | Authoritative source |
|---|---|
| Accepted and proposed Decisions, and their status | [`Contrast-Domain-Architecture-Decisions.md`](./Contrast-Domain-Architecture-Decisions.md) |
| Evidence model, catalogue, blind spots, collection sequence | [`Phase-3.8B-Safety-Gate-Evidence-Model.md`](./Phase-3.8B-Safety-Gate-Evidence-Model.md) |
| Amendments to the evidence model and to proposed Decision 013 | [`Phase-3.8B-Decision-Amendment-Proposal.md`](./Phase-3.8B-Decision-Amendment-Proposal.md) |
| Why those amendments were raised | [`Phase-3.8B-Evaluation-Architecture-Review.md`](./Phase-3.8B-Evaluation-Architecture-Review.md) |
| Phase and sub-package status | [`Contrast-Domain-Architecture-Evolution Plan.md`](./Contrast-Domain-Architecture-Evolution%20Plan.md) |
| Work package sequencing and dependencies | [`Phase-3.8-Stabilization-Plan.md`](./Phase-3.8-Stabilization-Plan.md) |
| Retirement evidence gates | [`Phase-3.8-Architecture-Audit.md`](./Phase-3.8-Architecture-Audit.md) |

If this document and any of the above disagree, the above is correct and this
document is stale.

---

## 1. Executive Summary

Phase 3.8B implementation is **complete**. The advisory safety evaluator exists,
is tested, and is isolated from runtime.

Three statements define this checkpoint, and they must not be collapsed into
each other:

1. **The evaluator has been implemented.** A pure function maps an
   `EvidenceSnapshot` to a `SafetyAssessment` carrying a three-valued
   recommendation.
2. **The evaluator is advisory only.** It has no write capability, no runtime
   consumer, and no output member capable of expressing advancement.
3. **Completion does not imply rollout readiness.** No organization decision to
   trust, consult, or act on this evaluator has been made. Building an
   instrument is not the same event as deciding to rely on it.

The purpose of this document is to preserve the boundary between statement (1)
and a future statement — *"the organization has decided to trust and act on the
evaluator"* — which has **not** occurred and is not recorded anywhere in this
repository.

The proposed Decisions that describe this evaluator's semantics — 012, 013, and
014 — all remain `Proposed — not accepted`. The implementation follows their
shape so that the shape can be reviewed against working code. **Implementation
is not acceptance.** A future reader must not infer approval of a Decision from
the existence of code that matches it.

---

## 2. Implementation Completed

### 2.1 Evaluator boundary — `EvidenceSnapshot` → `SafetyAssessment`

The evaluator is a single exported function in
[`src/domain/masteryRolloutSafety.ts`](../src/domain/masteryRolloutSafety.ts):

```
evaluateMasteryRolloutSafety(snapshot: EvidenceSnapshot): SafetyAssessment
```

It performs no I/O. Evidence is passed in as already-read values. The snapshot
declares one operator-identified observation window (`windowId`), exactly one
transition, and a `generatedFrom` origin of `on-device` or `operator-report`.

Evidence is evaluated across the 33-entry `SAFETY_EVIDENCE_FIELD_CATALOG`, with
each field assigned an internal category that determines its rule:

| Category | Fields | Rule |
|---|---|---|
| integrity | default for uncategorized fields (lost/duplicated mastery, divergences, collisions, alias regressions, placement/reset failures, …) | zero-tolerance on occurrence |
| reliability | `migrationFailures`, `orphanAdoptionResidue`, `unhandledPartialWrites`, `unhandledStableStorageFailures`, `unhandledLegacyStorageFailures`, `unhandledMigrationStateFailures` | unresolved-state ledger |
| coverage | `coldStartsObserved`, `languagesExercised`, `renamedLanguagesExercised`, `shadowComparisons` | volume threshold |
| interpretive | `legacyFallbackRatio`, `storageFailureRate` | reported, never blocking |
| confidence | `snapshotIntegrity`, `diagnosticDeliveryFailures`, `diagnosticEventsDropped` | reported, feeds truncation and coverage |

The output is a deeply frozen `SafetyAssessment` carrying the recommendation,
blockers, gaps, unmet volume gates, per-field evaluation, coverage summary,
observed rollout states, truncation sources, manifest version, reported
reliability counters, an evidence digest, and the snapshot origin.

### 2.2 Provenance handling

`EvidenceObservation` is a discriminated union. An observation is either
`observed` — carrying a value, a non-unknown provenance, a source string, and a
`witnessed` flag — or `unknown`, carrying only a reason. There is no
representation in which an absent value becomes a number.

Four provenance classes exist: `runtime-measured`, `harness-attested`,
`manually-attested`, `unknown`. Provenance classes are not interchangeable.
Each field declares which classes it accepts, and an observation of a class the
field does not accept is discarded to a `provenance-ineligible` gap rather than
counted. Fields that cannot be runtime-measured without violating the
diagnostic-data boundary are structurally restricted:
`practiceBehaviorChanges` accepts only `manually-attested`;
`duplicatedMasteryRecords` and `crossLanguageCollisions` accept only
`harness-attested`; `lostMasteryRecords` accepts either attested class but not
runtime measurement.

An observation whose `witnessed` flag is false becomes a
`producer-not-exercised` gap. A zero reading does not become evidence of safety
merely by being zero.

Twelve distinct `EvidenceUnknownReason` values are carried through to the
assessment's `gaps` array, so a reader sees *why* a field is unknown rather than
only *that* it is.

### 2.3 Reliability ledger evaluation

Reliability fields are evaluated against `snapshot.openConditions` — a ledger of
currently unresolved conditions, each carrying its kind, `languageId`, optional
storage operation, and the sequence at which it opened. A reliability field
blocks if and only if at least one open condition matches it. Matching is
operation-scoped: stable, legacy, and migration-state storage failures are
routed to distinct fields.

`snapshot.reliabilityContext` — the opened/recovered cumulative counters — is
carried into the assessment as **reported context only**. No evaluator path
derives unresolved state from it, and the source declares this explicitly at the
type definition. Cumulative counters are not used as a safety predicate.

### 2.4 Manifest eligibility

`producerManifest` declares a manifest version and the set of fields the
producing build is *capable* of producing. The type comment states the limiting
principle directly: presence declares capability and does not prove a producer
ran.

Two rules follow, and they differ in severity:

* A `runtime-measured` observation with **no manifest at all** yields a
  `manifest-missing` gap — insufficient evidence.
* A `runtime-measured` observation for a field **absent from the manifest**
  raises an `invalid-runtime-evidence` blocker and marks the field `blocked` —
  a claim of runtime measurement the build cannot support is treated as a
  defect, not a gap.

### 2.5 Rollout attribution handling

`rolloutStateObservations` records how many observations arrived under each
rollout state. Runtime-measured observations are attributed before they count:

* absent attribution → `rollout-attribution-missing`
* the transition's source regime never observed → `rollout-attribution-mismatch`
* more than one regime observed in the window → `rollout-regime-mixed`
* `snapshotIntegrity: 'unavailable'` → `snapshot-unavailable`
* open-condition overflow, for reliability fields → `evidence-truncated`
* any diagnostic delivery failure or dropped event → `diagnostic-loss`

The mixed-regime and diagnostic-loss rules carry one deliberate exception: a
**positive integrity observation still blocks**. Degraded attribution can
suppress a claim of safety; it can never suppress a claim of harm.

### 2.6 Deterministic assessment behavior

The evaluator is deterministic and side-effect free:

* no clock, no randomness — `Date.now(` and `Math.random(` are absent and their
  absence is asserted by test
* no cross-window state; each snapshot is evaluated independently and the module
  holds no accumulator or history
* the input snapshot is not mutated; observations are cloned before evaluation
* the returned assessment is deeply frozen and contains no function-valued
  member
* `evidenceDigest` is computed by canonicalizing the snapshot — recursively
  key-sorted, `undefined` dropped — and hashing with FNV-1a/32, so
  key-reordered-but-equivalent snapshots produce an identical digest and any
  substantive change produces a different one

Recommendation resolution is total and ordered: any blocker yields `blocked`;
otherwise any gap, unmet volume gate, non-`intact` snapshot integrity, or an
`on-device` origin yields `insufficient-evidence`; only then `ready`. The
`on-device` clause means the on-device surface structurally cannot render
`ready`.

### 2.7 Test coverage

[`scripts/masteryRolloutSafety.test.js`](../scripts/masteryRolloutSafety.test.js)
(656 lines added) covers the evaluation rules and asserts the structural
invariants in §3 directly, including an import-graph scan of `app/` and `src/`.
[`scripts/masteryRolloutSafety.type-test.ts`](../scripts/masteryRolloutSafety.type-test.ts)
asserts type-level constraints.

---

## 3. Architectural Invariants Preserved

Each of the following is enforced by structure or by test, not by review
discipline.

**No runtime authority.** The evaluator returns data. Its output type has no
`advance`, `apply`, `nextState`, `history`, command, or callback member, and no
property that is a function. A test asserts the absence of those members and
that no value in the frozen result is a function.

**No feature flag mutation.** The evaluator does not import `FEATURE_FLAGS` or
`CONTRAST_MASTERY_ROLLOUT_STATE`; a source-level test asserts both identifiers
are absent from the module. There is no code path from an assessment to
[`featureFlags.ts:18`](../src/config/featureFlags.ts#L18).

**No migration activation.** The evaluator does not reference
`migrateLanguageMastery(`, `adoptOrphanedMasteryForLanguage(`,
`writeCompatibleMastery(`, or `writeContrastMastery(`. Asserted by test.

**No learner-state writes.** The evaluator performs no I/O of any kind. It does
not import `AsyncStorage`, `masteryRolloutDiagnosticStorage`,
`getDiagnosticSnapshot`, or `recordDiagnosticEvent`. It is a consumer of
evidence and never a producer — it cannot write to diagnostic storage either.

**No hidden feedback loop from evaluator to system behavior.** No module under
`app/` or `src/` — other than the evaluator and its legacy adapter — references
`masteryRolloutSafety` or `evaluateMasteryRolloutSafetyGate`. The import-graph
test walks both trees and fails on any such reference. The evaluator therefore
cannot influence learner-visible behavior, because nothing learner-visible can
reach it.

**No React coupling.** Imports from `react` are absent and asserted absent,
which keeps the evaluator out of the rendering path by construction.

---

## 4. Compatibility Boundary

The pre-Phase-3.8B boolean API was not deleted and was not left entangled with
the new evaluator. It was extracted into a separate module.

**Pure evaluator ownership** —
[`src/domain/masteryRolloutSafety.ts`](../src/domain/masteryRolloutSafety.ts)
owns the evidence types, the field catalog, provenance and witness rules, the
category rules, attribution, the digest, and the three-valued recommendation. It
knows nothing about the legacy shape: `masteryRolloutSafetyLegacyAdapter`,
`evaluateMasteryRolloutSafetyGate`, `MasteryRolloutSafetyEvidence`,
`MasteryRolloutSafetyGateResult`, and the string `legacy-safety-adapter` are all
asserted absent from its source.

**Legacy adapter ownership** —
[`src/domain/masteryRolloutSafetyLegacyAdapter.ts`](../src/domain/masteryRolloutSafetyLegacyAdapter.ts)
owns the 16-field boolean evidence shape, the synthesis of a compatibility
snapshot from it, and the lossy collapse of a three-valued recommendation into
`{ passed, blockers }`. `passed` is true only when the recommendation is
`ready`, so `insufficient-evidence` and `blocked` both surface as `passed:
false` — the adapter cannot distinguish them, and is marked `@deprecated`
stating exactly that.

**Dependency direction** is one-way and enforced:

```
legacy adapter  →  evaluator          (permitted; the adapter imports the evaluator)
evaluator       →  legacy compatibility  (prohibited; asserted absent by test)
```

The evaluator can be read, reasoned about, and changed without reference to the
legacy shape. The adapter is the only thing that knows the old contract, which
is what makes its eventual removal a contained change.

---

## 5. Rollout Status

* **Rollout remains disabled.** `CONTRAST_MASTERY_ROLLOUT_STATE` is `'disabled'`
  at [`featureFlags.ts:18`](../src/config/featureFlags.ts#L18). Phase 3.8B did
  not change it and did not add any mechanism that could.
* **No production rollout decision has been made.** No WP-3.8F decision artifact
  exists in this repository. No transition has been proposed, approved, or
  recorded.
* **Evaluator output does not control rollout.** No runtime module consumes the
  evaluator, so no assessment has ever been produced outside a test. Even if one
  were, the assessment cannot express or perform a transition.
* **No real-install evidence has been collected.** The WP-3.8E runbook does not
  exist yet, so no snapshot from a real install has ever been evaluated.

Phase 3.8B built the ability to interpret evidence. It did not collect evidence,
and it did not act on any.

---

## 6. Decision Status

All three Decisions describing this evaluator remain **unaccepted**. They are
recorded below the "Proposed Decisions — not accepted" divider in
[`Contrast-Domain-Architecture-Decisions.md`](./Contrast-Domain-Architecture-Decisions.md),
which states that proposed entries are not binding, do not constrain
implementation, and must not be cited as authority.

| Decision | Title | Status | Date proposed |
|---|---|---|---|
| **012** | Evidence Provenance Is Part Of The Evidence Model | **Proposed — not accepted** | 2026-08-01 |
| **013** | Reliability Evidence Evaluates Unresolved State, Not Historical Occurrence | **Proposed — not accepted** | 2026-08-01 |
| **014** | The Rollout Safety Gate Is Advisory And Cannot Express Advancement | **Proposed — not accepted** | 2026-08-01 |

Additional status notes, recorded so the sequence is not misread later:

* **Decision 013 is unresolved in a way that matters when reading the code.**
  Its currently-recorded text specifies the reliability predicate as
  `residual = observed − recovered` over cumulative counters.
  [`Phase-3.8B-Decision-Amendment-Proposal.md`](./Phase-3.8B-Decision-Amendment-Proposal.md)
  §4 proposes replacement text specifying the predicate as the `openConditions`
  ledger, with counters demoted to reported context. **Both forms are
  proposals under review; neither has been accepted as the governing
  reliability-evidence rule.**

  The implementation follows the **proposed replacement**, not the recorded
  text: §2.3 above describes a ledger predicate. This divergence is deliberate
  and is documented in
  [`Phase-3.8B-Evaluation-Architecture-Review.md`](./Phase-3.8B-Evaluation-Architecture-Review.md)
  §4.2 and Amendment Proposal §3.2, which find the counter arithmetic unsafe
  against the ledger WP-3.8A.1 actually shipped — it returns `blocked` on a
  fully converged system, and the repository's own diagnostic test demonstrates
  the divergence.

  It is recorded here so a future maintainer comparing the evaluator against
  the Decisions document finds the mismatch explained rather than apparent.
  **Reverting the evaluator to the recorded counter formula would reintroduce
  the failure the amendment exists to prevent.** This document does not resolve
  which form should govern; that is a human decision that has not been made.
* The rollout attribution model (§5) and producer manifest eligibility model
  (§6) of the Amendment Proposal are likewise **proposed**, with a
  recommendation to adopt and no recorded adoption.
* Decisions 001–011 are unchanged by Phase 3.8B. Decision 011 — *Compatibility
  Retirement Requires Operational Evidence*, `Accepted`, 2026-07-31 — remains in
  force exactly as written. Reaching Phase 3.8B does not authorize retirement of
  any compatibility component.
* Phase 3.8B **did not** mark any proposed Decision as accepted, and this
  document does not either. Acceptance requires a human to change a `Status`
  field and record an approval date; no such change has been made.

---

## 7. Evidence Limitations

The evaluator's quality is bounded by the evidence available to it. The
following limitations are unresolved as of this checkpoint.

**Diagnostic evidence is observational.** The Phase 3.8A.1 producer layer
observes and records; it does not decide, and it does not verify. A counter
records what the diagnostic path saw, which is not the same as what the system
did. The evaluator inherits that gap and cannot close it.

**Missing evidence remains unknown, and unknown is not safe.** Fields with no
producer, no witness, no manifest support, or no rollout attribution resolve to
`unknown` and force `insufficient-evidence`. This is the intended behavior, and
it means early collection windows will look further from ready than a
naive-zero reading would have suggested. That is the correct reading, not a
regression. It also means the evaluator will report `insufficient-evidence` for
a long time, and the pressure to reinterpret that as approval is a real risk
this checkpoint exists to document.

**Declared blind spots persist.** Recorded in
[`Phase-3.8B-Safety-Gate-Evidence-Model.md`](./Phase-3.8B-Safety-Gate-Evidence-Model.md)
§9 and unchanged by this implementation: placement completion is out of scope
and produces no field; pair-progress and attempt history are `harness-attested`
only; install version distribution and field rollback frequency are permanently
unknowable with no telemetry; pre-`v2` pair-progress payloads are of unknown
existence; behavior change outside drilled paths is not detectable. Gate silence
on these is not coverage.

**Lifetime cumulative counters are not regime-attributable.** The
opened/recovered counters carried in `reliabilityContext` cannot be partitioned
by rollout state. They are reported for human judgment and threshold
calibration only.

**Export and operator workflows are separate concerns and do not exist yet.**
Snapshot export from the `__DEV__` surface, the assembly CLI, harness
attestation at a build SHA, manual attestation schema, device-distinctness
assertion, and the WP-3.8E collection runbook are all outside Phase 3.8B and
unbuilt. Without them there is no path from a real device to an assessment.

**Human interpretation remains required.** A `ready` recommendation is an input
to a decision, never the decision. Thresholds are operator-supplied and their
ownership is unresolved. Window identity is operator-declared. Device
distinctness is an operator assertion. The evaluator cannot detect a mis-scoped
window, a confounded collection, or a threshold set too low — it can only report
faithfully against what it was given.

---

## 8. Remaining Human Gates

None of the following has occurred. Each is a distinct human act, and none is
implied by Phase 3.8B completion.

**Decision acceptance.** A human must review Decisions 012, 013, and 014 — and
the Amendment Proposal's revised 013 text, attribution model, and manifest
eligibility model — and either accept them with a recorded date or reject them.
Until then the evaluator's semantics rest on unaccepted proposals, and the
Amendment Proposal's §12 open items remain open: threshold ownership, whether
`MAX_OPEN_RELIABILITY_CONDITIONS = 64` is the right bound now that overflow
forces `insufficient-evidence` (the constant is implemented at
[`masteryRolloutDiagnosticStorage.ts:22`](../src/storage/masteryRolloutDiagnosticStorage.ts#L22)
— what is open is its calibration, not its existence), whether cumulative
counters should become regime-partitionable, the `legacyFallbackRatio`
companion rule, observation-window identity, and the fate of the deprecated
boolean adapter.

**Operational review.** A human must decide whether this evaluator is the
instrument the organization intends to consult, and whether its rules match what
the organization actually wants to be protected from. Reviewing the code is not
the same as adopting the instrument.

**Evidence review process.** Collection must be defined and performed before
there is anything to interpret: the WP-3.8E runbook, real-install collection on
≥1 device with explicitly-invoked operations logged, snapshot export,
attestation at a named build SHA, and assembly into a window. The process for
who reviews an assessment, and against what standard, does not yet exist.

**Future rollout authorization.** Per Decision 014's proposed text and the
Stabilization Plan, authorization lives outside runtime code: a human reads an
assessment, records a WP-3.8F decision artifact naming the transition, the
`evidenceDigest`, the thresholds used, and the approver — including an explicit
rationale for advancing while any field is `unknown` — then edits
`CONTRAST_MASTERY_ROLLOUT_STATE` and ships a release. A human may decline to
advance on a `ready` assessment; that is a valid outcome.

---

## 9. Phase Boundary

**Phase 3.8B establishes the ability to interpret evidence safely.**

That is the whole of what it establishes. Specifically, it does **not**
establish:

* **rollout authorization** — rollout is `disabled`, no transition has been
  proposed or approved, and no decision artifact exists
* **migration completion** — no migration was activated, orchestrated, or
  scheduled; WP-3.8C remains unbuilt
* **retirement of compatibility infrastructure** — Decision 011 stands unchanged;
  legacy reads, legacy writes, migration markers, and orphan recovery all remain
  protected, and the legacy adapter itself is retained
* **evidence collection** — the evaluator has never been run against a real
  install, because no mechanism exists to get evidence from one
* **acceptance of Decisions 012–014** — code matching a proposal is not approval
  of the proposal

The distinction this document preserves is between an implemented instrument and
a trusted one. A future reader finding a complete, tested, well-structured
evaluator should not conclude that anyone decided to rely on it. As of
2026-08-01, no one has.

---

## 10. Next Allowed Work

This section is descriptive. It grants no permission and creates no
authorization — sequencing authority belongs to
[`Phase-3.8-Stabilization-Plan.md`](./Phase-3.8-Stabilization-Plan.md) and the
Evolution Plan, and gating authority belongs to the Decisions document. It is
recorded only so a future reader knows which work is *unblocked by* this
checkpoint and which is not.

**Unblocked by Phase 3.8B completion** — these depend on the evaluator existing,
and it now does:

* review of proposed Decisions 012, 013, and 014, and of the Amendment
  Proposal's revised 013 text, attribution model, and manifest eligibility model
* design of the WP-3.8E operator collection runbook, which lists WP-3.8B among
  its dependencies
* design of the WP-3.8F decision-artifact schema, likewise dependent on WP-3.8B
* planning of evidence collection, threshold selection, and window scoping

**Not unblocked, and unchanged by this checkpoint** — see §9 for the full list.
In particular, rollout enablement, migration activation, compatibility
retirement, and any change to mastery authority remain gated exactly where they
were before Phase 3.8B began. Decision 011 gates retirement on operational
evidence from real installs; no such evidence exists, so nothing about that gate
has moved.

The ordering matters: Decision review comes before collection design, because
collecting evidence against rules nobody has accepted risks producing a window
that has to be discarded.

---

## Verification

| Check | Result |
|---|---|
| Only documentation changed | This document is the sole addition; no source, test, config, or flag was modified |
| Rollout state | `CONTRAST_MASTERY_ROLLOUT_STATE = 'disabled'`, unchanged |
| Decisions 012–014 | Wording and `Proposed — not accepted` status unchanged; none accepted here |
| Decisions 001–011 | Unchanged; Decision 011 remains `Accepted` and in force |
| Runtime consumers of the evaluator | None in `app/` or `src/`; asserted by import-graph test |
| Claims vs. evidence | Every structural claim in §3 corresponds to an assertion in `scripts/masteryRolloutSafety.test.js` or to the absence of a symbol in the evaluator source |
| Source-of-truth discipline | This document defines no rule and grants no permission; the precedence table above defers every subject to its owning document |
| Field counts | Catalog is 33 fields, legacy adapter shape is 16, unknown reasons are 12 — counted from source, not from prose |
