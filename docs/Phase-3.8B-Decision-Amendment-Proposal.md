# Phase 3.8B — Decision Amendment Proposal

Date: 2026-08-01
Revised: 2026-08-01 — review clarifications incorporated (overflow window
scoping, §4.1 and §4.2; Decision 013/014 ownership boundary, §2.2 and §4.1;
evidence window independence and historical preservation, §4.1, §7.2, §11)
Branch: `docs/phase-3-migration-strategy`
Reviewed at: `c0f89bd`
Status: **Implementation-ready design contract. Requires human approval before
Codex implements it. No code, tests, or configuration changed. Decisions 012,
013, and 014 remain `Proposed — not accepted`, and no evaluator implementation
begins until they are accepted.**

Scope: amends the wording of proposed Decision 013 and extends the Phase 3.8B
evidence model with two rules the model predates. It does not accept any
Decision, does not renumber any Decision, does not alter Decisions 001–011, and
does not create a second evaluation architecture. The design of record remains
`docs/Phase-3.8B-Safety-Gate-Evidence-Model.md`.

**Sources of authority after this amendment.** The amended Decision 013 is the
source for reliability-evidence semantics. Decision 014 is the source for
evaluator behavior, assessment vocabulary, and the authority boundary. Decision
012 is the source for provenance. Nothing in rollout state, migration
orchestration, or learner-state behavior changes.

---

## 1. Executive summary

Phase 3.8A.1 shipped the evidence layer at `c0f89bd` and discharged the
producer obligations Phase 3.8B was blocked on. Reading the implemented layer
against the proposed Decisions surfaces one defect and two gaps.

**The defect (blocking).** Proposed Decision 013 specifies the reliability
predicate as `residual = observed − recovered`. The implemented layer does not
hold reliability state that way. It holds an explicit **ledger of unresolved
conditions** (`openConditions`), alongside cumulative counters
(`reliabilityConditionsOpened` / `reliabilityConditionsRecovered`) and an
**overflow counter** (`openConditionOverflow`). The counters and the ledger
count different things — events versus distinct domain conditions — so
subtracting them yields a number that is not the residual. In one direction it
blocks a fully converged system, which is the exact failure Decision 013 was
written to eliminate. §3 documents this with the repository's own test as
evidence.

**The direction of the fix.** The evaluator reads unresolved conditions. It
does not reconstruct unresolved state from telemetry counters. Counters become
supporting evidence for human judgment; the ledger becomes the sole predicate;
overflow invalidates confidence rather than producing a verdict.

**Gap 1 — rollout attribution.** The layer records
`rolloutStateObservations`, so a snapshot can say which rollout regimes it
spans. No Decision says what to do about that. Without a rule, observations
accumulated while rollout was `disabled` can satisfy a volume requirement for
`shadow -> internal-test`, which is witness evasion at the window level. §5
adds the rule.

**Gap 2 — producer manifest eligibility.** `DIAGNOSTIC_PRODUCER_MANIFEST`
declares what this build *can* emit. It is a capability claim, and the producer
tests already fence it as such. No Decision says the evaluator must consult it.
§6 makes it an eligibility gate, which converts Decision 012's central
invariant from convention into a structural property.

**Nothing here loosens any gate.** Every amendment converts a reading that
could previously have been treated as satisfied into `unknown`, or replaces a
predicate that produced a wrong verdict with one that produces a correct one.
The single loosening in Decision 013 — that recovered failures do not
permanently block — was already the approved intent of the unamended proposal
and is preserved unchanged.

---

## 2. Why amendment is required

### 2.1 The design was written before the implementation

`docs/Phase-3.8B-Safety-Gate-Evidence-Model.md` gathered evidence at `ed6fd3b`
and specified producer obligations in its §5. Phase 3.8A.1 implemented those
obligations at `c0f89bd`, and in three places implemented something **better
than** what §5 specified:

| §5 specified | Implementation shipped | Consequence for the Decisions |
|---|---|---|
| `partialWritesOpened` / `partialWritesConverged`, "residual = open count" | An identity-keyed `openConditions` ledger **plus** counters **plus** `openConditionOverflow` | Decision 013's formula no longer matches the data shape — §3 |
| No equivalent | `rolloutStateObservations`, `rolloutState` stamped per event | New attributable fact with no interpretation rule — §5 |
| No equivalent | `DIAGNOSTIC_PRODUCER_MANIFEST` with capability/exercise separation | Decision 012's invariant now has a structural anchor — §6 |

Amending now is cheap. The evaluator does not exist, no caller exists, rollout
is `disabled`, and all three Decisions are still `Proposed`. Accepting Decision
013 as written would freeze a formula the implementation cannot satisfy, and
correcting it later would mean amending an accepted Decision.

### 2.2 Decisions 012 and 014 need no amendment

Both are ratified as written by this proposal and remain `Proposed`.

Decision 012 (provenance) is unaffected in substance; §6 strengthens its
enforcement without changing its text. Decision 014 (advisory gate,
three-valued output) is unaffected entirely — §4's redefinition of the three
states elaborates the conditions under which each is returned, using Decision
014's own vocabulary, and adds no fourth state and no write capability.

The boundary between 013 and 014 is stated explicitly in the revised text
(§4.1, "Decision ownership") so that a future reader amending one does not
silently move the other: **013 owns what reliability evidence means; 014 owns
what the evaluator may say and may do.** Where they appear to conflict on the
meaning of a recommendation state, 014 governs.

### 2.3 What must not change

Decision 013's preserved intent, carried into the revised text verbatim in
substance:

- Reliability evidence evaluates **unresolved state**, not historical occurrence.
- Recovered failures **may be acceptable**.
- Integrity failures remain **strict** — zero tolerance on occurrence.
- Unresolved conditions **block readiness**.
- Recovery is observed per identity and never netted across identities.
- Convergence tracking is best-effort diagnostics and never affects learner state.

---

## 3. Decision 013 — before / after

### 3.1 Before

> ```
> residual = observed − recovered
> blocked  ⟺  residual > 0
> ```
>
> | Observed failures | Recovered | Safety state |
> |---|---|---|
> | 10 | 10 | healthy — every failure converged |
> | 10 | 8 | **blocked** — two conditions remain unresolved |
> | 0 | 0 | *not* healthy — witness unmet, evidence is `unknown` |

### 3.2 Why the arithmetic is unsafe against the implemented ledger

**The two counters measure different things.**
`reliabilityConditionsOpened` is incremented on *every* opening event, outside
the de-duplication guard that protects the ledger
([masteryRolloutDiagnosticStorage.ts:1273-1282](../src/storage/masteryRolloutDiagnosticStorage.ts#L1273-L1282)):
the increment precedes the `if (!openConditions.some(...))` check.
`reliabilityConditionsRecovered` increments only on an actual ledger removal.
So opened counts **events**; recovered counts **distinct conditions**.
Subtracting one from the other is a category error, not an off-by-one.

**Failure direction A — blocks a converged system.** The repository's own test
asserts the divergence: two identical `storage-failure` events for
`japanese/write-stable` produce `openConditions.length === 1` and
`reliabilityConditionsOpened === 2`
([masteryRolloutDiagnostics.test.js:801-804](../scripts/masteryRolloutDiagnostics.test.js#L801-L804)).
One subsequent success closes the single condition. Ledger residual is `0`; the
arithmetic residual is `2 − 1 = 1`. Decision 013 as written returns **blocked**
on a system that has fully converged — and no amount of further success can
clear it, because the surplus is permanent. That is D2 of the evidence model,
reintroduced by the formula intended to cure it.

**Failure direction B — misreads overflow.** At
`MAX_OPEN_RELIABILITY_CONDITIONS` (64) an opening event increments
`reliabilityConditionsOpened` and `openConditionOverflow` but is **not**
admitted to the ledger. A condition never admitted can never be recovered, so
the ledger understates the true residual **silently, in the safe-looking
direction**. Neither the ledger alone nor the arithmetic alone detects this;
only `openConditionOverflow` does.

**The general principle.** Counters are a lossy projection of domain state:
de-duplicated at the ledger but not at the counter, bounded by overflow, and
best-effort in delivery. Domain state is the ledger. An evaluator that
reconstructs domain truth from telemetry is inventing a fact the system did not
record — the mechanism by which an evaluator acquires an opinion of its own.

### 3.3 After

> ```
> unresolved(kind) = entries in openConditions with that kind    [domain state]
> BLOCKED               ⟸  unresolved > 0
> INSUFFICIENT_EVIDENCE ⟸  openConditionOverflow > 0   [absorbing, per window]
> INSUFFICIENT_EVIDENCE ⟸  witness unmet or evidence unavailable
> ```
>
> Counters are supporting evidence for human judgment. They are never a
> predicate. Overflow never resolves within its own window; a later complete
> window is a new evidence claim, not a repair.

### 3.4 Comparison

| Aspect | Before | After |
|---|---|---|
| Source of truth for unresolved state | arithmetic over two cumulative counters | the `openConditions` ledger |
| Role of `reliabilityConditionsOpened` / `Recovered` | the safety predicate | reported context only; never a predicate |
| Repeated identical failure then success | **blocked** (wrong) | not blocking — ledger is empty |
| Ledger overflow | undetected; residual silently wrong | `INSUFFICIENT_EVIDENCE`, absorbing within the window |
| Zero failures, no witness | `unknown` | `unknown` — **unchanged** |
| Integrity conditions | zero tolerance, out of scope | zero tolerance, out of scope — **unchanged** |
| Per-identity, never netted | required | required — **unchanged** |

---

## 4. Revised Decision 013 — proposed replacement text

Replaces the **Decision** section and the **Required statements** section of
proposed Decision 013 in `docs/Contrast-Domain-Architecture-Decisions.md`. The
Title, Date proposed, Context, Reason, and Consequences sections are unchanged
except as noted in §4.4. **Status remains `Proposed — not accepted`.** The
number 013 is unchanged and no other Decision is touched.

### 4.1 Proposed replacement — "Decision"

> Reliability conditions are evaluated from **explicit unresolved-condition
> state**, not from historical occurrence and not from arithmetic over
> cumulative counters.
>
> **The ledger is the predicate.** The diagnostic layer maintains an explicit
> record of currently unresolved reliability conditions, each keyed by its
> domain identity — condition kind, `LanguageId`, and, for storage failures,
> the failing operation. A condition is opened by a failure outcome and closed
> only by an observed successful outcome for the same identity. The evaluator
> reads this record. The safety predicate is:
>
> ```
> unresolved(kind) = the set of currently open conditions of that kind
> blocked ⟺ unresolved is non-empty
> ```
>
> **Counters are supporting evidence only.** Cumulative counts of conditions
> opened and recovered are reported to a human as context, and may inform
> threshold calibration. They must not be used to derive, reconstruct, verify,
> or override unresolved state. Specifically, `opened − recovered` is not a
> residual: the counters count delivery events and the ledger counts distinct
> domain conditions, and the two diverge under repeated failures for one
> identity and under ledger overflow. Any evaluator that computes a residual
> from counters has substituted telemetry for domain state.
>
> **Overflow invalidates confidence.** The unresolved-condition record is
> bounded. When the bound is reached, a further condition is refused admission
> and the refusal is counted. A non-zero overflow count means the record is a
> lower bound of unknown slack: it can no longer support the claim that nothing
> is unresolved. While overflow is non-zero for a window, every reliability
> condition in that window is `unknown`, and the assessment is
> `INSUFFICIENT_EVIDENCE` — never `READY`, and never `BLOCKED` on the strength
> of the truncation itself.
>
> **Overflow is absorbing within the evaluated evidence window. A future
> evidence window may be evaluated independently only when its completeness and
> attribution requirements are satisfied.** Overflow never resolves within the
> window in which it occurred: no subsequent recovery, success, or additional
> observation inside that window can restore the completeness the truncation
> destroyed. Nor does it permanently poison future evaluation. A later window
> that independently satisfies its completeness and attribution requirements is
> a **new evidence claim**, evaluated on its own merits — it is not a repair of
> the truncated window, and it makes no retrospective assertion about it. A
> truncated window remains permanently `INSUFFICIENT_EVIDENCE` in the record.
>
> **Evidence window independence and historical preservation.** Each evidence
> window is evaluated independently. A later complete window may establish new
> evidence of current conditions, but it does not erase, rewrite, or repair
> findings from prior windows. Historical evaluations remain immutable review
> artifacts.
>
> Three consequences follow, and they are the operative content of this clause:
>
> * Overflow inside a window produces `INSUFFICIENT_EVIDENCE` **for that
>   window**, permanently and unrepairably.
> * A later window is eligible for evaluation **only because it has its own
>   complete evidence** — never because time passed, never because a prior
>   window's conditions later resolved, and never because it is adjacent to a
>   complete window.
> * Evaluators **must not combine incomplete and complete windows** to
>   manufacture readiness. A complete window merged with an incomplete one
>   yields an incomplete claim, not a partial credit.
>
> This introduces no runtime state, and it introduces no cross-window scoring,
> averaging, decay, aging, or recovery semantics. There is no mechanism by
> which a window's assessment improves after the fact. The purpose is exactly
> threefold: one incomplete window must not permanently poison a device; a
> later window must not silently forgive an earlier finding; and the audit
> history must remain truthful about what was known when.
>
> **Missing evidence produces unknown, never healthy.** An empty
> unresolved-condition record is evidence of health only when its producer
> demonstrably ran, per Decision 012's witness requirement. An absent,
> malformed, or unreadable evidence source; an unexercised producer; or a
> truncated record all resolve to `unknown`. No default, coercion, or absent
> field may convert `unknown` into a satisfied condition.
>
> **Recovery must be observed, not assumed.** A condition counts as recovered
> only when the producing layer records a corresponding successful outcome for
> the same identity. Absence of a repeat failure is not recovery. Recovery is
> tracked per `LanguageId` and never netted across identities: a converged
> failure on one language does not offset an open one on another.
>
> **Decision ownership.** Decision 013 defines the meaning and evaluation rules
> of reliability evidence. Decision 014 defines the assessment vocabulary, the
> advisory nature, and the authority boundary of the evaluator.
>
> Decision 013 answers: what is unresolved reliability state; what counts as
> observed recovery; and when reliability evidence is `unknown`. Decision 014
> answers: what recommendation states the evaluator may return, and how the
> recommendation is prevented from becoming runtime control.
>
> Where this decision names `READY`, `BLOCKED`, or `INSUFFICIENT_EVIDENCE`, it
> is *using* Decision 014's vocabulary, not defining or extending it. This
> decision introduces no state, adds no fourth value, and does not widen the
> recommendation union. If the two decisions ever appear to conflict on what a
> recommendation state means or on what the evaluator may do with it, Decision
> 014 governs; this decision governs only what the underlying reliability
> evidence means.
>
> **Scope.** This decision covers reliability conditions only — storage
> failures, partial writes, migration failures, and orphan-adoption residue.
> Data-integrity conditions — lost mastery, duplicated mastery, reset
> resurrection, identity mismatch, and unexplained divergence — remain
> zero-tolerance on occurrence and are expressly not covered, because none of
> them has a recovery path that restores the lost information. A recovered
> storage failure has genuinely been recovered from; a lost mastery record has
> not.
>
> **Resulting assessment states**, in the vocabulary of Decision 014:
>
> * `READY` — no blocking unresolved conditions; required evidence exists under
>   an accepted provenance; every witness is met.
> * `BLOCKED` — unresolved conditions remain, or an integrity violation
>   occurred, or eligible provenance classes conflict.
> * `INSUFFICIENT_EVIDENCE` — required evidence is missing; the producer is
>   unavailable or unexercised; or overflow, delivery loss, or a degraded
>   evidence source prevents confidence.
>
> Recording convergence is subject to the existing diagnostic reliability
> contract without exception. Convergence tracking is best-effort,
> failure-isolated, and fire-and-forget; a failure to record convergence
> degrades evidence confidence and must never retry into, block, or delay a
> learner-state operation.

### 4.2 Proposed replacement — "Required statements"

> * Reliability conditions evaluate unresolved state, not historical occurrence.
> * Unresolved state is read from the explicit unresolved-condition record. It
>   is never computed from cumulative counters.
> * Cumulative counters are supporting evidence for human judgment and must
>   never be treated as safety predicates.
> * Overflow or truncation of the unresolved-condition record yields `unknown`,
>   and therefore `INSUFFICIENT_EVIDENCE`.
> * Overflow is absorbing within the evaluated evidence window and never
>   resolves inside it. A later window that independently satisfies its
>   completeness and attribution requirements is a new evidence claim, not a
>   repair of the truncated one.
> * Each evidence window is evaluated independently. A later window does not
>   erase, rewrite, or repair findings from prior windows, and historical
>   evaluations remain immutable review artifacts.
> * Evaluators must not combine incomplete and complete windows to manufacture
>   readiness. No cross-window scoring, averaging, decay, or recovery semantics
>   exist, and none may be introduced.
> * Missing evidence produces `unknown`, never healthy.
> * Decision 013 defines the meaning and evaluation rules of reliability
>   evidence; Decision 014 defines the assessment vocabulary, advisory nature,
>   and authority boundary of the evaluator. This decision uses that vocabulary
>   and introduces no state.
> * Data-integrity conditions remain zero-tolerance on occurrence and are not
>   covered by this decision.
> * Recovery must be observed per identity and never netted across identities.
> * Convergence tracking is best-effort diagnostics and must never affect
>   learner-state behavior.
> * This decision does not renumber or alter Decisions 001–011.

### 4.3 What the replacement deliberately does not change

The loosening that Decision 013 exists to authorize — that a recovered
reliability failure does not permanently disqualify a device — is retained in
full and still requires explicit approval as a loosening. The worked example's
load-bearing third row (`0 / 0` is *not* healthy) is retained as the "missing
evidence produces unknown" clause. Integrity remains untouched.

### 4.4 Consequential edits

Two sentences elsewhere in Decision 013 reference the superseded mechanism and
must be updated on approval: the Context section's closing description of the
predicate, and the Consequences tradeoff naming the producer obligation as
"record recovery, not only failure" — which is now discharged and should read
as shipped in Phase 3.8A.1 rather than pending.

---

## 5. Rollout attribution model

### 5.1 The rule

**Evidence is only comparable within compatible rollout regimes.** The five
regimes are `disabled`, `shadow`, `internal-test`, `limited`, and `enabled`.

For a declared transition `A -> B`, runtime-measured evidence is admissible
only if it was observed while rollout state was `A`. Observations from any
other regime are not evidence about `A`, because the code paths under
evaluation either did not run or ran under different conditions.

Explicitly:

- **Allowed** — shadow-regime observations satisfying a shadow-evaluation
  volume requirement.
- **Not allowed** — `disabled`-regime observations satisfying a shadow volume
  requirement. Under `disabled`, shadow comparisons do not run; a large
  observation count from that regime attests to nothing about shadow.

### 5.2 What the implementation can and cannot attribute

This is the constraint that shapes the rule, and it must not be glossed over.

| Fact | Attributable to a regime? |
|---|---|
| `rolloutStateObservations` | **Yes** — a per-regime tally of accepted events |
| Per-event `rolloutState` on the ring | Yes, but the ring is bounded and wrapping, and is **never** a valid aggregation source |
| Cumulative scalar metrics, `divergencesByKind`, `languageObservations`, ledger entries | **No** — they are lifetime totals across every regime the install has passed through |

Therefore attribution is implementable today as a **regime-purity check**, not
as a partitioning operation. The evaluator cannot split a counter by regime,
and must not pretend to.

There are no timestamps anywhere in the diagnostic layer — confirmed by
inspection — so an observation window cannot be device-derived either. Window
identity is operator-declared, with `firstSequence` and `sequence` available
only to detect truncation and ordering discontinuity *within* one snapshot.

### 5.3 Required fields

Every assembled evidence set carries:

- **Rollout-state attribution** — the regime tally from
  `rolloutStateObservations`, plus the derived `observedRolloutStates` set and
  a `regimePure` flag for the transition's `from` state.
- **Observation window** — operator-declared window identity and device label,
  since the app can produce neither. `firstSequence` / `sequence` accompany it
  as the within-snapshot continuity evidence.
- **Evidence provenance** — per Decision 012, unchanged.

### 5.4 Evaluation rules

1. **Empty regime.** If `rolloutStateObservations[from] === 0`, every
   runtime-measured field is `unknown / producer-not-exercised`. The window
   never ran in the regime under evaluation.
2. **Mixed regime.** If more than one regime has a non-zero tally, cumulative
   runtime evidence is not attributable. Apply the asymmetry that already
   governs lossy evidence: **a zero or a volume count becomes `unknown`; a
   non-zero integrity finding still blocks.** Blocking on an integrity
   violation observed under a neighbouring regime is conservative and therefore
   safe; crediting a volume gate from an unrelated regime is not.
3. **Missing attribution.** If the attribution field is absent, unparseable, or
   from a snapshot that predates the field, the evidence is `unknown` and can
   never count toward readiness. **Missing attribution is never valid readiness
   evidence.**
4. **Merged snapshots.** Regime purity is evaluated per snapshot before merge;
   one impure snapshot degrades the merge. Purity is never inferred from the
   sum.
5. **Reporting.** The assessment names every observed regime, so a human can
   see that the window was mixed rather than only that fields went `unknown`.

### 5.5 Scope note

Making cumulative counters regime-partitionable would require reopening the
Phase 3.8A.1 producer layer. That is **not** proposed here; it is recorded as
open question §12.4. The regime-purity check requires no producer change and is
strictly conservative in the interim.

---

## 6. Producer manifest eligibility model

### 6.1 Three distinct claims

The manifest is evidence of **capability**, never of success. Collapsing these
three claims is precisely how a silent zero becomes a passing gate.

| Term | Claim | Source |
|---|---|---|
| **produced** | "This build's runtime *can* emit this evidence." | `DIAGNOSTIC_PRODUCER_MANIFEST.producedFields` |
| **observed** | "The runtime *actually did* emit it in this window." | the field's declared witness holding a positive value |
| **eligible** | "The evaluator *may consider* this value." | produced ∧ observed ∧ accepted provenance ∧ attributable regime |

`produced` is a property of the build. `observed` is a property of the window.
`eligible` is the conjunction the evaluator requires before a value may satisfy
anything.

### 6.2 Rules

1. **Produced but never observed → `INSUFFICIENT_EVIDENCE`.** Capability
   without exercise is not measurement. This is Decision 012's witness
   requirement, now with a structural anchor for the capability half.
2. **Not produced → `unknown`, or requires non-runtime provenance.** A field
   absent from `producedFields` can never carry `runtime-measured` provenance.
   Absent an eligible harness or manual attestation it is
   `unknown / no-producer`.
3. **Observed without manifest support → invalid evidence.** A value claiming
   `runtime-measured` provenance for a field the manifest does not declare is a
   contradiction: either the manifest is stale or the value is fabricated. The
   evaluator must reject it as invalid rather than accept it, and report the
   inconsistency.
4. **Permanent non-runtime fields stay outside runtime evidence.**
   `lostMasteryRecords`, `duplicatedMasteryRecords`, `crossLanguageCollisions`,
   and `practiceBehaviorChanges` are absent from the manifest by design. They
   are permanently `harness-attested` or `manually-attested`. Adding a runtime
   producer for any of them would require holding mastery content or recording
   learner behavior in the diagnostic store, which the diagnostic-data-boundary
   invariant prohibits. This is a deliberate permanent assignment, not a gap.

   Note: `masteryRolloutDiagnostics.test.js:678-679` currently fences only two
   of the four (`lostMasteryRecords`, `practiceBehaviorChanges`). The fence
   should be widened to all four, so that a future producer added for
   `duplicatedMasteryRecords` or `crossLanguageCollisions` fails the suite
   rather than silently acquiring runtime provenance (§10.20).
5. **Manifest divergence across merged snapshots.** If `manifestVersion` or
   `producedFields` differs, the merge spans builds with different
   capabilities. Take the **intersection** and degrade coverage. Never the
   union.

### 6.3 Why this prevents silent zeros

`RUNTIME_EVIDENCE_FIELD_CATALOG` enumerates 33 fields; `producedFields`
declares 29. Under the current evaluator, a struct assembled from a snapshot
would set the four undeclared fields to `0`, and `0` passes. With the manifest
as an eligibility gate, those four cannot carry runtime provenance at all, so
the zero has nowhere to enter from. A future field added to the catalogue
without a producer is `unknown` **by default** rather than by remembering to
declare it — the failure mode is a report that says "I do not know," which is
the correct and safe reading.

---

## 7. Updated safety evaluator contract

Amends `docs/Phase-3.8B-Safety-Gate-Evidence-Model.md` §7. It does not replace
that section's module layout, which stands.

### 7.1 Properties

The evaluator is **pure**, **deterministic**, **read-only**, and **advisory**.

- **Pure / read-only** — a function of already-read values. No storage access,
  no clock, no randomness, no network, no filesystem. All I/O belongs to the
  caller.
- **Deterministic** — identical input yields a byte-identical assessment and an
  identical evidence digest, across runs and across key insertion order.
- **Advisory** — output is a frozen record. It can express a recommendation and
  cannot express a command.

```
EvidenceSnapshot   ──►   [ pure evaluator ]   ──►   SafetyAssessment
```

`EvidenceSnapshot` is the assembled, provenance-typed, regime-attributed,
manifest-filtered evidence set for **exactly one evidence window** and exactly
one declared adjacent transition.
`SafetyAssessment` carries the three-valued recommendation of Decision 014,
ranked blockers, gaps with their unknown-reasons, unmet volume gates, every
evaluated field, coverage, the thresholds used, the observed regimes, the
truncation sources, the manifest version, and a stable evidence digest.

### 7.2 Prohibited capability

The evaluator must not, and structurally cannot: mutate a feature flag or any
rollout configuration; invoke, schedule, or influence migration; write learner
state; write diagnostic evidence; perform any storage write; or return any
property that is a function, callback, command, `advance`, `apply`, or
`nextState`. Enforced by module boundaries and an import-graph test over the
transitive closure, not by review discipline.

It must also not span windows. The evaluator holds no state between
evaluations, reads no prior assessment, and has no representation of an
evaluation history. It cannot combine an incomplete window with a complete one,
carry a finding forward, age a finding out, or improve a past assessment — each
of which would require cross-window state the evaluator is prohibited from
having. Purity and determinism already make this structural: an assessment is a
function of one `EvidenceSnapshot` and nothing else. Preserving prior
assessments as immutable review artifacts is therefore an operator and
WP-3.8F recordkeeping obligation, not an evaluator capability.

### 7.3 Evaluation order

```
1. Reject non-adjacent or backward transition        → BLOCKED
2. Establish eligibility, in order:
     field not in producer manifest                  → unknown            [6.2]
     runtime provenance without manifest support     → invalid, report    [6.2]
     rolloutStateObservations[from] === 0            → unknown            [5.4]
     regime impure                                   → zeros and volumes
                                                        unknown; non-zero
                                                        integrity still blocks
     snapshot integrity unavailable                  → all runtime unknown
     events dropped / delivery failures              → runtime zeros unknown
     openConditionOverflow > 0                       → reliability unknown [4.1]
3. Per eligible field, by declared category:
     integrity     → any occurrence                  → BLOCKED
     reliability   → open ledger entry of that kind  → BLOCKED
     coverage      → below declared threshold        → unmet volume gate
     interpretive  → report only; companion rule only
     provenance classes conflict                     → BLOCKED
4. any blocker                                       → BLOCKED
   else any gap, unmet gate, degraded coverage,
        or on-device generation                      → INSUFFICIENT_EVIDENCE
   else                                              → READY
```

Step 2 runs before step 3 by construction: eligibility is a precondition of
evaluation, so no ineligible value can reach a predicate.

### 7.4 Human authority is unchanged

A `READY` assessment is an input to a human decision, never a substitute for
it. A human records a decision artifact citing the evidence digest, then edits
`CONTRAST_MASTERY_ROLLOUT_STATE` and ships a release. There is no code path
from an assessment to that constant. A human may decline to advance on a
`READY` assessment, and that must be recordable.

---

## 8. Updated evidence state model

### 8.1 Four layers

| Layer | Meaning | May satisfy |
|---|---|---|
| **Runtime measured** | A cumulative counter or ledger state persisted by the diagnostic layer | Only fields declared in the producer manifest, observed via a met witness, from an attributable regime |
| **Harness attested** | A deterministic harness run, identified by the commit it ran against | Only fields whose declared provenance set accepts it; never a real-install volume or rollback field |
| **Manual attested** | A human drill or observation recorded through the operator runbook | Only fields whose declared provenance set accepts it; structurally invisible to the on-device surface |
| **Unknown** | No producer; producer unexercised; source unreadable; attestation absent or stale; regime unattributable; evidence truncated | Nothing, ever |

### 8.2 Unknown is absorbing

`unknown` propagates and never resolves upward. It cannot be defaulted,
coerced, zero-filled, averaged away, or outvoted by another field. A field that
is `unknown` for any reason makes readiness unreachable for that field, and
therefore for the assessment.

A missing witness cannot become healthy. An empty ledger, a zero counter, and
an absent snapshot are three different things, and only the first — and only
when its producer demonstrably ran, in an attributable regime, with no
truncation — is evidence of health.

### 8.3 Asymmetry under lossy evidence

Diagnostic delivery is best-effort, so a cumulative counter is a **lower
bound**. This gives loss an exact and asymmetric effect, and the same rule
governs all four truncation sources:

| Source | Effect |
|---|---|
| `diagnosticEventsDropped > 0` | runtime-measured **zeros** → `unknown` |
| `diagnosticDeliveryFailures > 0` | runtime-measured **zeros** → `unknown` |
| `openConditionOverflow > 0` | reliability conditions → `unknown` |
| regime impure or unattributed | zeros and volume counts → `unknown` |

In every case a **non-zero** reading remains trustworthy and still blocks: the
condition definitely occurred. None of the four ever blocks on its own.
Diagnostic loss must never become a correctness blocker, because that would
make diagnostics load-bearing for correctness — the second-authority failure
these boundaries exist to prevent. Loss makes the assessment say "I do not
know," never "something is wrong."

---

## 9. Failure modes and safe outcomes

No row resolves to `READY`.

| Failure mode | Detection | Safe outcome |
|---|---|---|
| Counter/ledger divergence under repeated failures | ledger is the predicate; counters are not consulted | correct residual; converged systems are not blocked |
| Ledger overflow | `openConditionOverflow > 0` | reliability → `unknown` → `INSUFFICIENT_EVIDENCE` for that window; unresolvable inside it; a later complete window is a new claim |
| Field has no runtime producer | absent from `producedFields` | `unknown / no-producer` |
| Producer exists but never ran | witness zero or unknown | `unknown / producer-not-exercised` |
| Runtime value for an undeclared field | manifest cross-check | invalid evidence; reported, never counted |
| Mixed-build merge | `manifestVersion` / `producedFields` differ | intersect capabilities; degrade coverage |
| Wrong-regime window | `rolloutStateObservations[from] === 0` | all runtime fields `unknown` |
| Mixed-regime window | more than one non-zero regime tally | zeros and volumes `unknown`; integrity still blocks |
| Missing regime attribution | field absent or unparseable | `unknown`; never counts toward readiness |
| Dropped or undelivered diagnostics | persisted self-metrics | zeros → `unknown`; non-zeros still block |
| Stale or malformed snapshot | schema version; `firstSequence` / `sequence` discontinuity | `degraded` or `unavailable`; `unavailable` forces all runtime fields `unknown` |
| Incomplete export / undistinct devices | distinctness unattested | merge counts as one device for every volume gate |
| Conflicting evidence | two eligible provenance classes disagree | `BLOCKED` with `evidence-conflict`; adopt the worse |
| Stale attestation | commit SHA not an ancestor of the build | `attestation-stale` → `unknown` |
| Evaluator defect | determinism and digest tests; table-driven default-deny over the full catalogue | a field added without a producer fails the suite rather than passing |
| Human misinterpretation | evidence digest cited in the decision artifact; explicit rationale required to advance with any `unknown` | the decision remains reconstructible and auditable |
| On-device over-reading | `generatedFrom: 'on-device'` | structurally cannot render `READY` |

---

## 10. Testing requirements

Tests protect architectural behavior, not implementation detail. They are
completion evidence for the amended contract and follow the existing
`scripts/*.test.js` `runTest` + `node:assert` style.

**Ledger-derived reliability (§4) — the regression tests for this amendment.**

1. Two identical failure events for one identity, then one success → **not
   blocking**, even though `reliabilityConditionsOpened` is non-zero. The
   superseded arithmetic fails this test; this is the amendment's primary
   guard.
2. One failure, no subsequent success → `BLOCKED`.
3. Converged on language A, open on language B → `BLOCKED`. Convergence never
   nets across identities.
4. A success for a *different* operation or language does not close an open
   condition.
5. `openConditionOverflow > 0` → reliability `unknown`, assessment
   `INSUFFICIENT_EVIDENCE` — not `READY`, and not `BLOCKED` on truncation alone.
6. **Overflow does not resolve within its window.** A window with non-zero
   overflow followed by recoveries that empty the ledger still assesses
   `INSUFFICIENT_EVIDENCE`. An empty ledger never clears a truncation.
7. **Overflow does not poison the next window.** A separate window with zero
   overflow, met witnesses, and satisfied attribution is evaluated on its own
   merits and can reach `READY`. Evidence from the truncated window is not
   carried into it.
8. Assertion that no evaluator code path reads `reliabilityConditionsOpened` or
   `reliabilityConditionsRecovered` as a predicate — they may appear only in
   reported context.

**Window independence (§4.1).**

9. An incomplete window merged with a complete one yields
   `INSUFFICIENT_EVIDENCE`, never `READY`. Incompleteness is not diluted by
   combination and earns no partial credit.
10. Evaluating window B does not alter, and cannot access, the assessment of
    window A. The evaluator exposes no evaluation history, no prior-assessment
    input, and no accumulator; two evaluations in one process are independent.
11. Re-evaluating a truncated window's evidence always reproduces
    `INSUFFICIENT_EVIDENCE` — assessments are immutable and reproducible from
    their evidence digest, so an audit record cannot be rewritten by a later
    run.

**Rollout attribution (§5).**

12. Evidence observed wholly under `disabled` cannot satisfy any runtime field
   for `shadow -> internal-test`.
13. A mixed-regime window renders zeros and volume counts `unknown` while a
   non-zero integrity finding still blocks.
14. Absent attribution → `unknown`; never counts toward readiness.
15. Regime purity is evaluated per snapshot before merge; one impure snapshot
    degrades the merge.

**Manifest eligibility (§6).**

16. A field absent from `producedFields` cannot carry `runtime-measured`
    provenance.
17. Produced but unwitnessed → `INSUFFICIENT_EVIDENCE`.
18. A runtime-provenance value for an undeclared field is rejected as invalid
    and reported.
19. Divergent manifests across merged snapshots intersect, never union.
20. The four permanent non-runtime fields remain absent from the manifest —
    extends the existing fence.

**Unknown is absorbing (§8).** Table-driven over the **full 33-field
catalogue**, so a field added later without a producer fails by default:

21. Every field `unknown` → `INSUFFICIENT_EVIDENCE`.
22. Every field `0` with unmet witness → `INSUFFICIENT_EVIDENCE`.
23. Every field `0` and every witness unmet → `INSUFFICIENT_EVIDENCE` — the
    exact scenario today's gate reports as `passed: true`.
24. No combination of coverage, thresholds, or attestations clears an integrity
    blocker.

**Advisory and deterministic (§7).**

25. Import-graph: the evaluator's transitive closure contains no writer, no
    `AsyncStorage`, and no `FEATURE_FLAGS` value.
26. Type-level: no assessment property is a function; the recommendation union
    has exactly three members.
27. Evaluating any transition on any evidence leaves
    `FEATURE_FLAGS.contrastMasteryRollout` unchanged and performs zero storage
    calls.
28. Identical input → byte-identical assessment and identical digest, across
    runs and key orders.
29. Non-adjacent and backward transitions refused; thresholds read from input
    and echoed.
30. `generatedFrom: 'on-device'` never returns `READY`.

**Non-regression.**

31. The Phase 3.8A / 3.8A.1 isolation suite passes unchanged — a throwing or
    slow diagnostic sink still cannot fail or delay any learner operation.

---

## 11. Explicit non-goals

This proposal produces a design contract. It does **not** include, authorize,
or begin any of the following:

- **No evaluator implementation.** No evaluator, assembler, CLI, on-device
  surface, or attestation schema is written here.
- **No rollout advancement.** `CONTRAST_MASTERY_ROLLOUT_STATE` remains
  `disabled`. No transition is executed or authorized.
- **No migration activation.** No migration is triggered, scheduled, or
  orchestrated. Phase 3.8C remains separate and unstarted.
- **No runtime decision making.** Nothing here is consulted by any runtime code
  path. Diagnostics remain observer-only and are never a runtime control input.
- **No automatic approvals.** No mechanism converts an assessment into a
  decision. Human approval remains outside runtime code.
- **No feature flag changes.** No flag is added, removed, enabled, or read as a
  value by any evaluator module.
- **No Phase 3.8C work.** No orchestration design, no compatibility retirement,
  no `@pairProgress_v2` or placement-completion work.

- **No cross-window semantics.** No scoring, averaging, decay, aging, rolling
  windows, carry-forward, or recovery-over-time. No evaluation history, no
  prior-assessment input, and no accumulator. A later window never repairs an
  earlier one, and an earlier one never handicaps a later one.
- **No new runtime state.** The window-independence rule is an evaluation and
  recordkeeping boundary. It adds no counter, no field, no persisted marker,
  and no diagnostic producer.

Additionally: no Decision is accepted; no Decision is renumbered; Decisions
001–011 are untouched; no second evaluation architecture is created; no generic
rule engine, predicate registry, DSL, or configurable policy loader is
introduced; and no diagnostic storage is modified — **if implementation finds
itself editing `masteryRolloutDiagnosticStorage.ts`, the scope boundary has
been crossed.**

---

## 12. Open questions requiring human approval

1. **Adopt the revised Decision 013 text (§4).** Recommendation: **adopt**. The
   superseded formula returns `blocked` on a converged system, demonstrated by
   the repository's own test. This is the blocking item.
2. **Adopt the rollout attribution model (§5)** as a regime-purity check.
   Recommendation: **adopt**. Without it, a `disabled` window can satisfy a
   shadow volume gate.
3. **Adopt the manifest eligibility model (§6).** Recommendation: **adopt**. It
   converts Decision 012's central invariant from convention into structure.
4. **Should cumulative counters become regime-partitionable?** This would make
   attribution a partitioning operation rather than a purity check, at the cost
   of reopening the completed Phase 3.8A.1 producer layer. Recommendation:
   **defer**, and record the non-attributability of lifetime totals as a
   declared blind spot. Reopening a completed layer needs stronger cause than
   convenience.
5. **Is `MAX_OPEN_RELIABILITY_CONDITIONS = 64` the right bound**, given that
   overflow now forces `INSUFFICIENT_EVIDENCE`? A window that legitimately
   opens 65 conditions cannot reach `READY`. The window-scoping clarification
   (§4.1) bounds the consequence: the loss is confined to that window, and a
   later clean window is evaluated independently, so the bound cannot
   permanently disqualify a device. Recommendation: **retain 64** until a real
   collection window shows otherwise — 64 unresolved conditions is itself a
   signal — but the interaction should be named rather than discovered.
6. **Observation-window identity is operator-declared**, because the diagnostic
   layer has no timestamps and must not acquire any. Recommendation:
   **confirm**, and specify the window schema in the WP-3.8E runbook.
7. **Threshold ownership** — who sets the transition thresholds and who may
   change them. Unresolved; extends open item 6 in the Stabilization Plan.
8. **The `legacyFallbackRatio` companion rule** — the only proposed blocking
   rule over a rate, inert until Phase 3.8C exists. Recommendation: **adopt**,
   since nothing else detects silently failing migration.
9. **Fate of the boolean adapter** on `evaluateMasteryRolloutSafetyGate`. It
   cannot express `INSUFFICIENT_EVIDENCE`. Recommendation: retain temporarily
   with `@deprecated`, remove once no caller remains; outright deletion is
   defensible, as it has no production caller.

---

## Quality bar verification

| Requirement | Verification |
|---|---|
| No second evaluation model was created | This document amends `Phase-3.8B-Safety-Gate-Evidence-Model.md` and proposed Decision 013. The design of record is unchanged in structure; §7 refines its §7 rather than replacing it. |
| Decision numbering unchanged | 012, 013, 014 keep their numbers and their `Proposed — not accepted` status. Decisions 001–011 are untouched. No Decision is accepted by this proposal. |
| Unknown cannot become READY | `unknown` is absorbing (§8.2). No row in §9 resolves to `READY`. The default-deny tests (§10.21–24) fail the suite for any field added without a producer. |
| Counters are not treated as domain truth | §4.1 prohibits deriving, reconstructing, verifying, or overriding unresolved state from counters; §10.8 asserts no evaluator path reads them as a predicate. |
| Ledger state is authoritative for unresolved reliability | §4.1 makes `openConditions` the sole predicate; overflow marks it a lower bound and forces `unknown`. |
| Overflow is window-scoped, not permanent | §4.1: absorbing within the evaluated window, unresolvable inside it, and never carried into a later window that independently satisfies completeness and attribution. Overflow yields `INSUFFICIENT_EVIDENCE`, never `READY` and never `BLOCKED` on truncation alone. Tests §10.6–7. |
| Evidence windows are independent; history is immutable | §4.1 "Evidence window independence": each window evaluated independently; a later window does not erase, rewrite, or repair prior findings; historical evaluations remain immutable review artifacts. Incomplete and complete windows may not be combined to manufacture readiness. §7.2 makes this structural — the evaluator holds no cross-window state. Tests §10.9–11. |
| No cross-window scoring or hidden forgiveness | §11: no scoring, averaging, decay, aging, carry-forward, or recovery-over-time; no evaluation history and no accumulator. No new runtime state is introduced. |
| Decision ownership is unambiguous | §4.1 "Decision ownership" and §2.2: 013 owns reliability-evidence meaning; 014 owns vocabulary, advisory nature, and authority. 014 governs on conflict. No state added — `READY` / `BLOCKED` / `INSUFFICIENT_EVIDENCE` remain 014's vocabulary. |
| Rollout evidence cannot mix incompatible states | §5.4: empty regime → all runtime `unknown`; mixed regime → zeros and volumes `unknown`; missing attribution never counts toward readiness. |
| Manifest cannot imply success | §6.1 separates produced / observed / eligible; §6.2.1 makes produced-but-unobserved `INSUFFICIENT_EVIDENCE`; §6.2.3 rejects runtime provenance without manifest support. |
| Human rollout authority remains external | §7.4: no code path from assessment to `CONTRAST_MASTERY_ROLLOUT_STATE`; the on-device surface structurally cannot render `READY`; a human may decline a `READY` assessment. |

**Net effect.** Every amendment narrows. Each converts a reading that could
have been treated as satisfied into `unknown`, or replaces a predicate that
returned a wrong verdict with one that returns a correct one. The only
loosening — recovered reliability failures do not permanently block — was
already Decision 013's approved intent and is carried through unchanged.
