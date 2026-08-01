# Phase 3.8 — Operational Evidence Review Model

Date: 2026-08-01

Status: **Design document. Not a Decision, not a rollout authorization, and not
an acceptance of any proposed Decision.**

Scope: documentation only. This document changes no source, no test, no
configuration, no feature flag, no rollout state, and no Decision. It creates no
Decision number. It defines the *human* layer that sits after the Phase 3.8B
evaluator and before any rollout transition.

---

## Note on the filename

This document was requested as `Phase-3.8F-Operational-Evidence-Review-Plan.md`.
It is filed under a name without an `F` because **WP-3.8F already exists** as a
specific work package in
[`Phase-3.8-Stabilization-Plan.md`](./Phase-3.8-Stabilization-Plan.md) — *"Rollout
advancement decision record"*, whose deliverable is one signed artifact **per
transition attempted**.

This document is not that artifact and does not replace that package. It spans
three things WP-3.8F alone does not cover:

* the collection and export interface owned by **WP-3.8E**,
* the review process that consumes a `SafetyAssessment`, and
* the **rollback** authority that operates outside any transition attempt.

Naming it `Phase-3.8F-…` would imply this file *is* WP-3.8F's scope definition,
which would put a second authority beside the Stabilization Plan on what WP-3.8F
is. The neutral name avoids that. If the maintainer prefers the original name,
renaming this file changes nothing about its content — but the ambiguity above
should be resolved in whichever direction, not left implicit.

---

## Authority of this document

| Subject | Authoritative source | This document's relationship |
|---|---|---|
| Accepted and proposed Decisions and their status | [`Contrast-Domain-Architecture-Decisions.md`](./Contrast-Domain-Architecture-Decisions.md) | Cites. Never amends, accepts, or reinterprets. |
| Work package scope, sequencing, ownership boundaries | [`Phase-3.8-Stabilization-Plan.md`](./Phase-3.8-Stabilization-Plan.md) | Applies its Ownership Boundaries section to a human process. Adds no package. |
| Evidence model, field catalogue, blind spots, evidence→decision sequence | [`Phase-3.8B-Safety-Gate-Evidence-Model.md`](./Phase-3.8B-Safety-Gate-Evidence-Model.md) | Elaborates its §10 into an owned workflow. Adds no field and no rule. |
| Amendments to the evidence model and to proposed Decision 013 | [`Phase-3.8B-Decision-Amendment-Proposal.md`](./Phase-3.8B-Decision-Amendment-Proposal.md) | Cites as proposal only. |
| What Phase 3.8B did and did not establish | [`Phase-3.8B-Completion-Review.md`](./Phase-3.8B-Completion-Review.md) | Historical record only, per its own §preamble. |
| Retirement gating | Decision 011 (`Accepted`) | Unchanged and in force. |

**On conflict, the source above governs and this document is wrong.** Conflicts
observed while writing it are recorded, not resolved: the Decision 013
divergence immediately below, and a low-severity terminology conflict in §10.1.

---

## Recorded architecture divergence — Decision 013

**This is not an open question, and it is not filed as one.** It is a known,
deliberate divergence between a recorded Decision and shipped code. It appears
here — ahead of the process this document defines — so that no reader reaches an
approval record without having seen it, and so that a reader in 2027 finds the
mismatch *explained* rather than *apparent*.

| | |
|---|---|
| **Recorded text** | Decision 013 in [`Contrast-Domain-Architecture-Decisions.md`](./Contrast-Domain-Architecture-Decisions.md) specifies the reliability predicate as `residual = observed − recovered` over cumulative counters. |
| **Implemented behavior** | [`src/domain/masteryRolloutSafety.ts`](../src/domain/masteryRolloutSafety.ts) evaluates reliability against `snapshot.openConditions` — an explicit unresolved-condition ledger, matched per condition kind, `LanguageId`, and storage operation. Cumulative counters are carried as reported context, and no evaluator path derives unresolved state from them. |
| **Status of both forms** | Decision 013 is `Proposed — not accepted`. The Amendment Proposal's replacement text is likewise proposed. **Neither binds.** No *accepted* Decision is contradicted, which is why this is a divergence to be resolved rather than a violation to be corrected. |
| **Why it exists** | Amendment Proposal §3.2 finds the counter arithmetic unsafe against the ledger WP-3.8A.1 actually shipped: it returns `blocked` on a fully converged system, and the repository's own diagnostic test demonstrates the divergence. The implementation follows the proposed replacement deliberately. |
| **Direction of risk** | The implemented predicate is correct where the recorded formula is demonstrably wrong. It is nonetheless **semantics a human has not approved**, and "more correct" is not the same as "authorized." |

### Operational consequences — binding on this process

1. **Every approval record must name this divergence** through
   `decisionBasisStatus` (§6.3). A record that omits it asserts, by silence,
   that the evaluator's reliability semantics were settled. They were not.
2. **The divergence must not be closed quietly from either side.** Editing
   Decision 013's recorded text to match the code, or reverting the code to match
   the recorded text, are both Decision-level acts belonging to the Architecture
   Owner in the Decisions document. Neither is a documentation cleanup, and
   neither may happen as a side effect of a review. Reverting to the recorded
   counter formula would reintroduce the failure the amendment exists to prevent.
3. **No review may treat the implemented semantics as settled** because they are
   shipped, tested, and working. Code matching a proposal is not approval of the
   proposal (Completion Review §6).
4. **Resolution is a Phase 3.8C prerequisite** (§9.2, row 1) — not because 3.8C
   touches the evaluator, but because 3.8C's orchestration outcomes become
   reliability evidence, and collecting them against an unresolved predicate
   risks producing a window that has to be discarded.

This document does not resolve which form should govern. That is a human
decision that has not been made, and §10.1.2 records it as still outstanding.

---

## 1. Purpose and scope

### 1.1 Why this document exists

Phase 3.8B ends at a recommendation:

```
EvidenceSnapshot → evaluateMasteryRolloutSafety() → SafetyAssessment
                                                     { ready | blocked | insufficient-evidence }
```

Everything after the arrow is undefined. There is no owner of the assessment, no
cadence for producing one, no format for recording what a human concluded from
it, no named authority for reversing a transition, and no statement of what the
process is forbidden from doing. The evaluator's own safety properties (P1–P8 in
the Evidence Model §0) constrain the *code*; they say nothing about the humans
who read its output.

That gap is the specific risk this document addresses. The Completion Review §7
names it directly: the evaluator will report `insufficient-evidence` for a long
time, *"and the pressure to reinterpret that as approval is a real risk."*
Reinterpretation pressure is not a code defect and cannot be fixed in code. It is
resisted, if at all, by a written process that says who decides, on what record,
and what they may not do.

The invariant this document exists to preserve is the one the Completion Review
states as its whole purpose:

> **implementation complete ≠ rollout authorized**

### 1.2 What this document defines

Ownership of evidence review; review cadence; the export and reporting workflow;
the minimum content of an approval record; rollback authority; and the boundary
between what the evaluator decides and what humans decide.

### 1.3 What this document does not define, and must never acquire

* **No rollout authorization.** Nothing here advances, approves, or schedules a
  transition. `CONTRAST_MASTERY_ROLLOUT_STATE` remains `disabled`
  ([`featureFlags.ts:18`](../src/config/featureFlags.ts#L18)).
* **No Decision.** No Decision number is created; Decisions 012–014 remain
  `Proposed — not accepted`; Decisions 001–011 are untouched.
* **No runtime workflow.** No process defined here is executable by, triggered
  by, or readable by any code in `app/` or `src/`. This is not a spec for a
  tool.
* **No code requirement.** No section imposes an implementation obligation on
  any package. Where a capability does not exist yet (export, assembly,
  attestation), that is recorded as a prerequisite, not commissioned here.
* **No second evaluator.** See §8.3.
* **No threshold values.** The numbers in the Stabilization Plan's *Rollout
  Transition Gates* table are labelled **PROPOSED defaults, not measured**, and
  are treated as unapproved throughout this document.

### 1.4 Standing constraint that shapes everything below

The application is offline-first with no backend and no remote kill switch
(Decision 008). **Rollback latency equals an application release cycle.** A
review process for a system that can be reverted in seconds may be optimistic; a
review process for a system that cannot must be conservative, because the cost of
a wrong forward decision is paid for the length of a store review plus an update
adoption curve. Every cadence and authority choice below follows from this.

---

## 2. Operational authority model

### 2.1 Roles, not people

Five roles are defined. They are **functions in a process**, not job titles,
headcount, or an assertion about who exists. This repository documents a
founder/operator model ([`operations.md`](./operations.md)); one person may
therefore hold several of these roles. That is permitted and is addressed in
§2.4 — it is not permitted to leave *unrecorded* which role was being exercised.

| Role | Answers | May not |
|---|---|---|
| **Evidence Collector** | "What was observed, on what build, under what regime, with which operations invoked?" | Evaluate; approve; decide what the evidence means. |
| **Evidence Reviewer** | "Is this evidence complete, attributable, and honestly assembled? What does the assessment say?" | Approve a transition; alter an assessment; recompute a recommendation by hand. |
| **Architecture Owner** | "What do the Decisions say, and do the evaluator's semantics still match them?" | Approve a transition on architectural grounds alone; change evaluator behavior without a recorded Decision change. |
| **Release Approver** | "Given this assessment and this review, do we transition — and is the reason recorded?" | Skip the record; approve a transition whose evidence they also collected and reviewed without declaring role collapse (§2.4). |
| **Rollback Authority** | "Do we return to the last known-good state, now?" | Be unnamed while a non-`disabled` state is live (§7.2). |

### 2.2 Who reviews evidence

The **Evidence Reviewer**, on the record produced by the **Evidence Collector**.

Review is an integrity check on the *evidence*, not a re-litigation of the
*recommendation*. Concretely, the Reviewer establishes:

* the window is scoped and identified (window identity is operator-declared —
  Amendment Proposal §12.6, unresolved);
* the collection log records every explicitly invoked state-mutating operation
  (orphan adoption, and later the WP-3.8C orchestration function), per the
  WP-3.8E confounding risk;
* the device-distinctness assertion is present or the merge is being counted as
  one device (Evidence Model §8);
* the harness attestation names a build SHA, and the manual attestation exists;
* the `SafetyAssessment`'s reported gaps, blockers, coverage, and truncation
  sources are read as written, not summarized away.

A Reviewer who believes the assessment is wrong has exactly one remedy: §8.3.

### 2.3 Who approves decisions, and who may authorize a rollout transition

The **Release Approver**, and only through the approval record in §6. This is
the same authority the Stabilization Plan already assigns:

> **Rollout transition ownership — Owned by the release/process boundary**, the
> human decision recorded in WP-3.8F, exercised by editing `featureFlags.ts` and
> shipping a release. Not owned by any runtime code path, including the safety
> gate itself.

Authorization is a two-artifact act and both artifacts are required:

1. an **approval record** (§6) exists, naming the transition and the evidence it
   rests on; then
2. a human edits the build-time constant and ships a release.

Neither step implies the other. A record without a release is a decision not yet
executed. A release without a record is a **process violation**, and the correct
response is to write the record retrospectively, marked as such, and to treat the
omission as a review finding.

**The Release Approver's discretion is asymmetric**, and this asymmetry is the
central safety property of the whole operational layer:

| Assessment | Approver may be *more* conservative | Approver may be *less* conservative |
|---|---|---|
| `ready` | Yes, freely — declining a `ready` assessment requires no justification beyond a recorded rationale, and is an explicitly valid outcome (Evidence Model §10). | n/a |
| `insufficient-evidence` | Yes — decline or defer. | Only as a declared **override** (§6.4). Never silently, never by re-reading the assessment as approval. |
| `blocked` | Yes — decline. | Only as a declared **override** (§6.4), and never for anything Decision 011 gates (§9.4). |

The direction matters: humans may always tighten what the evidence supports.
Loosening it is possible — the Evidence Model §10.5 already contemplates
advancing while fields are `unknown`, and requires an explicit rationale — but it
must be *visible as a loosening* in the record, not absorbed as an
interpretation. An override that does not look like an override is the failure
mode this table exists to prevent.

### 2.4 Role collapse

When one person holds two or more roles for a given decision, the approval record
**must name every role that person exercised**. Collapse is not prohibited here —
prohibiting it in a single-maintainer project would produce a process nobody can
follow, which is worse than one everybody can — but it must be legible in the
record, because a reader in 2027 cannot otherwise tell whether a decision had
independent review.

Whether Reviewer and Approver *should* be separable, and what compensating
control substitutes for separation when they are not, is an unresolved
operational policy question (§10.2). This document does not invent one.

### 2.5 Who owns rollback decisions

The **Rollback Authority**, under §7. Deliberately separated from the Release
Approver as a role even where the same person holds both, because the two have
opposite defaults: the Approver's default is *do not advance*; the Rollback
Authority's default is *revert on doubt*. A single role holding both defaults
tends to resolve toward whichever it exercised most recently.

---

## 3. Evidence lifecycle

Six stages. Each has exactly one owning layer or role. **Ownership does not
transfer implicitly** — a stage begins when its owner acts, not when the previous
stage finishes.

| # | Stage | Owner | Boundary rule |
|---|---|---|---|
| 1 | **Produced** | Diagnostic producer layer (WP-3.8A / WP-3.8A.1) — *code, no human* | Best-effort, failure-isolated, fire-and-forget. Producing evidence must never block, delay, or fail a learner-state operation (Diagnostic Reliability Contract). |
| 2 | **Persisted** | Diagnostic storage layer — *code, no human* | One dedicated key, disjoint from every learner-state key; bounded ring; never read by any learner-facing path. Loss is an accepted degradation mode that reduces confidence, never correctness. |
| 3 | **Exported** | **Evidence Collector** | Export is a **read**. It copies; it must not clear, compact, or reset the persisted store. Diagnostic reset is a separate, explicit operator action that **ends the window** and must be logged as such. |
| 4 | **Reviewed** | **Evidence Reviewer**, with the **Architecture Owner** consulted on semantics | Evaluation happens off-device, on assembled evidence. The assessment is read as data; it is not edited, annotated in place, or partially quoted into the record. |
| 5 | **Decision recorded** | **Release Approver** | The approval record (§6) is created *before* any build-time constant is edited. |
| 6 | **Archived** | **Evidence Reviewer** (custody), **Architecture Owner** (retention policy) | Append-only. Records are never edited or deleted; a correction is a new record that supersedes a named prior record. |

### 3.1 Lifecycle invariants

* **Evidence flows one way.** Produced → … → Archived. No stage feeds back into
  an earlier one. In particular, **nothing archived is ever read by the
  evaluator** — the evaluator holds no cross-window state by construction
  (Completion Review §2.6), and the operational record must not become the
  history the evaluator was deliberately denied.
* **Windows are independent and immutable.** A later window is a new evidence
  claim, never a repair of an earlier one; incomplete and complete windows may
  not be combined to manufacture readiness (Amendment Proposal §4.1). The
  archive therefore preserves `insufficient-evidence` windows permanently, and
  their preservation is the point, not clutter.
* **The archive is not evidence.** An approval record is a record of what a human
  concluded. It is never re-injected as an input to a later evaluation, and it
  never upgrades the evidentiary status of the window it describes.
* **No learner data enters the lifecycle at any stage.** The diagnostic-data
  boundary (Stabilization Plan, Invariant 1) governs stages 1–2; §6.5 extends the
  same exclusion to stages 5–6, which are the stages a human writes by hand and
  could therefore violate by accident.

---

## 4. Review workflow

This elaborates Evidence Model §10 into owned steps. **It adds no step and
changes no rule there.** Steps marked *(capability absent)* cannot be performed
today; see §9.2.

| # | Step | Owner | Output |
|---|---|---|---|
| 1 | **Declare the window** — assign a window ID, the rollout regime under evaluation, the build SHA, the intended transition (if any), and the device labels in scope. | Evidence Collector | Window declaration, opened in the collection log |
| 2 | **Collect** — run the WP-3.8E procedure on ≥1 real install, logging every explicitly invoked operation so the window is not confounded. *(capability absent — WP-3.8E unwritten)* | Evidence Collector | Collection log |
| 3 | **Export** — copy each device's snapshot JSON from the `__DEV__` surface. *(capability absent — export unbuilt)* | Evidence Collector | One snapshot per device, labelled |
| 4 | **Attest** — harness attestation from a test run at the named build SHA; manual attestation including drill outcomes and the device-distinctness assertion. *(capability absent — attestation schema undefined)* | Evidence Collector | Attestation set |
| 5 | **Assemble and evaluate** — run the evaluator over snapshot(s) + attestations. *(capability absent — assembly CLI unbuilt)* | Evidence Collector runs it; **Evidence Reviewer** owns the result | `SafetyAssessment` with an `evidenceDigest` |
| 6 | **Review** — integrity check per §2.2; confirm the assessment's own reported gaps and truncation sources are understood. | Evidence Reviewer | Review note, attached to the record |
| 7 | **Semantics check** — confirm the evaluator build's semantics against the Decisions document, and record which unresolved proposals the run depended on. | Architecture Owner | Semantics note (see §6.3) |
| 8 | **Decide and record** — create the approval record per §6. | Release Approver | Approval record |
| 9 | **Act, or not** — if and only if the record approves a transition, a human edits the build-time constant and ships a release. | Release Approver | Released build, referenced back into the record |
| 10 | **Archive** — close the window; file the record, review note, assessment, and collection log together. | Evidence Reviewer | Archived window |

### 4.1 Workflow rules

* **Steps 8 and 9 have no automated component and no code path from step 5.**
  This restates Evidence Model §10 and is the reason the workflow is written as
  prose rather than as a pipeline.
* **Step 5 is mechanical; step 6 is judgment.** The person running the evaluator
  does not thereby own its output. Collapsing 5 and 6 into "whoever ran it says
  what it means" is the shape that turns a reviewer into a rubber stamp.
* **Step 7 is not optional while Decisions 012–014 are unaccepted.** A run today
  depends on proposals a human has not approved; a record that does not say so
  will read, later, as though it rested on settled architecture.
* **A window may close with no transition proposed.** Observation windows are
  expected to outnumber transition windows, especially early. Steps 8–9 reduce
  to a recorded "no transition proposed" outcome.
* **The on-device surface is a collection aid, not a review surface.** It can
  render `blocked` or `insufficient-evidence` but structurally never `ready`
  (Evidence Model P8), and it exposes no control that writes rollout state. It is
  never the basis of an approval record.

---

## 5. Evidence review cadence

### 5.1 Cadence is event-driven first

The primary trigger for a review is **a window closing**, not a date. Calendar
cadence exists only to bound how long a live non-`disabled` state may run without
anyone looking at it. Both are stated below; the bounds are **proposed and
unapproved**, and are recommendations to be calibrated by the first real
collection window — consistent with the Stabilization Plan's framework rule that
*a threshold may be set only after one collection window establishes the observed
baseline*.

**Standing out-of-cycle triggers** — any of these opens a review immediately,
regardless of cadence, in any regime:

* any integrity blocker in any assessment (lost or duplicated mastery, reset
  resurrection, identity mismatch, unexplained divergence);
* any `invalid-runtime-evidence` blocker — a claim of runtime measurement the
  build cannot support is treated as a defect, not a gap (Completion Review §2.4);
* any failed drill (rollback, reset, placement);
* `snapshotIntegrity` other than `intact`, or any nonzero diagnostic delivery
  failure or dropped-event count, in a window intended to support a transition;
* any support-channel report plausibly describing mastery loss, duplication, or
  unexpected tier movement;
* a rollout regime change of any kind, including a rollback.

### 5.2 Cadence by regime

| Regime | What review is for | Event trigger | Proposed calendar bound (unapproved) |
|---|---|---|---|
| **Shadow observation review** | Confirming the evidence pipeline itself works — that producers ran, that regime attribution is clean, that snapshots export and merge. Shadow performs no learner-state writes, so the subject of review is *evidence quality*, not learner risk. | Each closed collection window; at minimum one covering ≥1 renamed language, per WP-3.8E completion evidence. | Review the first window before opening a second. Thereafter, per window; no live-shadow build should run more than one release cycle unreviewed. |
| **Internal rollout review** (`internal-test`) | First regime where stable mastery is authoritative on a real install. Review covers reliability convergence, migration outcomes, and drill results — not only counters. | Each closed window, plus after every explicitly invoked orchestration or orphan-adoption operation, since either can confound a window. | Every release at `internal-test`, and before any transition proposal. |
| **Limited rollout review** | Sustained-behavior review across more than one release. The question shifts from "did anything break" to "has it stayed unbroken across a period nobody was watching closely." | Each closed window; each release boundary. | Every release at `limited`. A window that spans a release boundary is declared as two windows, because build SHA is part of window identity. |
| **Retirement review** | Whether Decision 011's operational-evidence gates are satisfied for a *named* compatibility component. This is a different question from rollout readiness and is never answered as a side effect of one. | Only on an explicit retirement proposal naming one component. Never scheduled, never automatic, never implied by reaching a regime. | None. There is no cadence at which retirement becomes due. See §9.4. |

### 5.3 What cadence must not become

* **Cadence is not a threshold.** "Reviewed every release" says nothing about
  whether evidence supports a transition. A cadence met on schedule with
  `insufficient-evidence` every time is a correct outcome, not a stalled process.
* **Cadence does not accumulate credit.** Four reviewed windows at
  `insufficient-evidence` do not sum to one `ready`. Windows are independent by
  construction (Amendment Proposal §4.1) and the human process must not do
  informally what the evaluator is structurally prevented from doing.
* **Cadence does not expire evidence.** Nothing here ages a finding out. A
  blocker recorded in an archived window stays recorded; a later clean window is
  a new claim beside it, not a replacement for it.

---

## 6. Approval record format

### 6.1 Status of this format

This is the **minimum content** of the artifact WP-3.8F calls for. The
Stabilization Plan owns whether WP-3.8F requires more; this document proposes
nothing less. Format (Markdown file, front-matter, table) is unconstrained; the
*fields* are the contract.

**Suggested location:** one file per record under `docs/rollout-decisions/`,
named by window ID. This is a recommendation about where humans put files, not a
schema and not a code requirement.

### 6.2 Required fields

| Field | Why it is required |
|---|---|
| `recordId` | Stable reference for supersession (§6.6). |
| `date` | When the decision was made — distinct from when the window was collected. |
| `windowId` | Operator-declared window identity (schema unresolved — §10.1). |
| `evidenceDigest` | The evaluator's canonical hash of the exact snapshot evaluated. Without it, the record names no specific evidence and cannot be audited. |
| `recommendation` | `ready` / `blocked` / `insufficient-evidence`, transcribed verbatim from the assessment. |
| `blockersAndGaps` | The assessment's blockers, gaps, and unmet volume gates — reproduced, not summarized to a count. |
| `provenanceSummary` | Per-field provenance distribution and the unknown-reason breakdown, so a reader sees *why* fields were unknown. |
| `coverageSummary` | Snapshots merged, `deviceDistinctnessAttested`, languages exercised, cold starts, truncation sources. |
| `snapshotOrigin` | `on-device` or `operator-report`. An `on-device` origin structurally cannot yield `ready`. |
| `rolloutRegimeObserved` | The regime(s) the evidence was attributed to, and whether the window was regime-pure. |
| `buildSha` | The build the evidence came from and the harness attested at. |
| `evaluatorCommit` | Which evaluator build produced the assessment. Semantics are the commit's, not the document's. |
| `manifestVersion` | Producer manifest version — declares what the build was *capable* of producing. |
| `thresholdsUsed` | The operator-supplied thresholds, echoed. Thresholds are inputs, and unapproved (§10.1). |
| `transitionRequested` | `from → to`, or explicitly `none`. Must be adjacent and forward if present. |
| `decision` | `approve` / `decline` / `defer` / `override` (§6.4). |
| `rolesExercised` | Every role, and who exercised it — including collapse (§2.4). |
| `reviewerRole` / `approverRole` | Named explicitly even when identical. |
| `rationale` | Why. Required for every value of `decision`, including `approve` on `ready`. |
| `unknownFieldRationale` | **Required whenever any field is `unknown` and the decision advances.** Restates Evidence Model §10.5. |
| `decisionBasisStatus` | Which unresolved proposals the evaluator run depended on — today, Decisions 012–014 and the Amendment Proposal's revised 013, attribution, and manifest models (§6.3). |
| `rollbackAuthority` | The role holding rollback authority for the state this record establishes (§7.2). |
| `rollbackTriggers` | The specific observations that would open a rollback consideration for this state. |
| `releaseReference` | Filled after step 9. Empty until a release actually ships. |

### 6.3 The `decisionBasisStatus` field

Every record written before Decisions 012–014 are resolved must state that they
are unresolved, and must state that the evaluator implements the Amendment
Proposal's **revised** reliability rule rather than Decision 013's currently
recorded counter formula — the divergence recorded in full in *Recorded
architecture divergence — Decision 013*, above. Without this field, a record
written today reads later as though it rested on accepted architecture. That
misreading is the specific historical error this field prevents.

### 6.4 Overrides

An **override** is a decision to advance further than the assessment supports —
approving on `insufficient-evidence` or on `blocked`. It is not prohibited
(§2.3), and it is not a normal outcome.

#### 6.4.1 What an override is, and what it is not

**An override is an acceptance of uncertainty. It is never an alternative
assessment.**

The distinction is the whole content of this subsection, because the two are
easy to conflate in prose and have opposite safety properties:

| | Acceptance of uncertainty *(what an override is)* | Alternative assessment *(prohibited — §8.3)* |
|---|---|---|
| What it claims | "The evidence is exactly as incomplete as reported, and we are proceeding anyway." | "The evidence is better than reported." |
| What it does to the recommendation | Nothing. The recommendation stands verbatim in the record. | Replaces or discounts it. |
| Who bears the risk | The named approver, in writing, for a stated transition. | Nobody — the risk is described away. |
| What it leaves behind | A legible, auditable acceptance of a known gap. | A record that reads as though the gap did not exist. |

Concretely, an override **must not**:

* restate, soften, or re-characterize the recommendation — an
  `insufficient-evidence` assessment is recorded as `insufficient-evidence`, and
  the `decision` field carries the override, not the `recommendation` field;
* argue that a blocker or unknown field is *mistaken*, *stale*, or *not really
  applicable*. Any such claim is a claim about the evaluator's rules, and its
  only remedy is a Decision (§8.3);
* substitute the approver's own reading of the raw fields for the evaluator's —
  that is a second evaluator, prohibited regardless of the conclusion it reaches;
* be justified by evidence outside the window. Evidence from another window is
  another window's claim, and windows do not combine (§5.3).

An override therefore **narrows to a single legitimate shape**: the assessment is
accepted as correct and complete-as-reported, the residual uncertainty is
enumerated, and a human accepts the consequences of acting inside it.

#### 6.4.2 Required content

An override record additionally requires:

* the exact blockers or unknown fields being overridden, enumerated — not
  counted, not summarized;
* for each, an explicit statement that it is being **accepted as unresolved**,
  and why that is tolerable **for this transition specifically**;
* what would have to be observed to withdraw the override;
* an explicit acknowledgment that rollback latency is one release cycle (§1.4);
* the Rollback Authority's name, recorded at override time rather than later.

#### 6.4.3 Overrides do not accumulate or generalize

* An override applies to **one transition, in one window**. It does not carry
  forward, and a later window that reports the same gap is not thereby
  pre-approved.
* **A prior override is not precedent.** Citing "we accepted this last time" as
  the rationale is the mechanism by which a one-time acceptance of uncertainty
  becomes a standing reinterpretation of the field catalogue.
* **Overrides are excluded entirely for anything Decision 011 gates** (§9.4).
  There, uncertainty is what the accepted Decision exists to refuse.

### 6.5 What a record must not contain

No mastery tier values, no mastery maps, no per-`ContrastId` learner state, no
raw legacy JSON, no attempt histories, no learner answers or word content, no
device or user identifier, and no timestamp precise enough to reconstruct a
session. The operator-assigned **device label** is permitted and is the only
device-level identity that exists anywhere in this system.

This mirrors the diagnostic-data boundary. It is restated here because stages 5–6
are hand-written by a human, and a hand-written record is the one place in the
pipeline where a well-meaning "for context, the affected tiers were…" can breach a
boundary that the code enforces everywhere else.

### 6.6 Immutability

Records are **append-only**. A record is never edited after the release it
references ships, and is never deleted. A correction is a new record naming the
record it supersedes and stating what changed and why. This is the operational
analogue of the evidence-window immutability rule the Amendment Proposal already
requires: *historical evaluations remain immutable review artifacts*.

### 6.7 Evidence artifact reference rules

Immutability of the record is worthless if the record points at something that
can change underneath it. These rules govern **how a record names the evidence it
rests on**, and they apply equally to approval records (§6), rollback records
(§7.4), review notes, and the archive (§3, stage 6).

#### 6.7.1 References are by immutable identifier only

An evidence reference is the tuple below. All five parts are required; a
reference missing any of them names no specific evidence and cannot be audited:

| Part | Identifies |
|---|---|
| `windowId` | Which operator-declared collection window |
| `evidenceDigest` | The exact snapshot content that was evaluated |
| `evaluatorCommit` | Which evaluator semantics produced the assessment |
| `buildSha` | Which build produced the evidence and was attested against |
| `manifestVersion` | What that build was capable of producing |

**Mutable pointers are prohibited** as the identity of evidence: file paths,
"the latest export", "the current `__DEV__` snapshot", a branch name, "main",
"today's run", or a directory that could be re-populated. Such a pointer may
appear *alongside* the tuple as a convenience for locating a file. It may never
appear *instead of* it.

#### 6.7.2 A reference is a claim about the past, not a recipe

A reference records **what was evaluated and what it said**. It is not an
instruction to reproduce the result, and a record's validity does not depend on
the artifact still being reachable.

* **Re-running the evaluator does not recover a reference.** A re-run over
  reassembled inputs produces a *new* assessment, which is a new claim requiring
  its own record. It never retroactively substantiates an old one, even if the
  recommendation matches.
* **A lost artifact does not invalidate the record**, and does not license
  editing it. It is recorded as a custody gap — a review finding under §5.1 — and
  the record stands as written.
* **A digest is never recomputed to make it match.** If a digest and an artifact
  disagree, the artifact is not the evidence the record describes, and that
  disagreement is itself the finding.

#### 6.7.3 Digests are not comparable across evaluator commits

`evidenceDigest` canonicalizes the *snapshot*, not the semantics applied to it.
Two records sharing a digest but naming different `evaluatorCommit` values
describe **the same evidence read under different rules** — which, while the
Decision 013 divergence stands unresolved, is a live possibility rather than a
theoretical one.

Consequently: equal digests never justify carrying one record's conclusion into
another, and a digest match is never a substitute for a review.

#### 6.7.4 Cross-record references

* A superseding record names the `recordId` it supersedes (§6.6); the superseded
  record is never edited to point forward.
* A rollback record names the approval record that established the state being
  reverted (§7.4); that approval record is never annotated in hindsight.
* No record may reference a *future* artifact — a record is complete when
  written, except for `releaseReference`, which is the single field permitted to
  be filled after step 9 of §4 and which may be filled exactly once.

---

## 7. Rollback authority

### 7.1 Rollback is not a decision of the same kind

A rollback returns the system to a state that already ran. Under Decisions 008
and 010 it is achieved by code/config revert alone, requires no data repair, and
leaves stable records intact and legacy mastery readable. Its risk profile is
therefore the inverse of an advancement: **advancing on weak evidence can be
unrecoverable within a release cycle; rolling back on weak evidence costs a
release.**

The rule that follows is the one operational asymmetry that must never be
softened:

> **Rollback never requires evidence of readiness.** No assessment, no window, no
> digest, and no cadence is a precondition for reverting. Requiring evidence to
> roll back would make the safety mechanism harder to use than the risk it
> guards against.

### 7.2 Who may request, who may approve

* **Anyone may request a rollback.** Evidence Collector, Evidence Reviewer,
  Architecture Owner, Release Approver, or a person acting on a support-channel
  report. No role gate exists on raising the question.
* **The Rollback Authority approves.** Approval does not wait for a review cycle,
  a window to close, or an assessment to be produced.
* **The Rollback Authority must be named while any non-`disabled` state is
  live.** It is recorded in the approval record that established that state
  (§6.2). A live regime with no named rollback authority is itself a standing
  out-of-cycle review trigger (§5.1).

### 7.3 Evidence that opens a rollback consideration

Consideration, not automatic action — the decision remains human in every case.
Any of:

* any observed integrity condition: lost or duplicated mastery, reset
  resurrection, identity mismatch, unexplained divergence;
* any unresolved reliability condition that does not converge across a window;
* a failed rollback, reset, or placement drill;
* the rollback triggers named in the approval record for the current state;
* a support-channel report plausibly describing mastery loss or unexpected tier
  movement — **note that this may be the only signal available**, since no
  telemetry exists and field rollback frequency is a declared permanent blind
  spot (Evidence Model §9);
* evidence that cannot be attributed to the running regime, where the regime
  itself is in doubt.

The Evidence Model's own asymmetry applies here too: degraded attribution can
suppress a claim of safety, but **a positive integrity observation still blocks**.
An integrity signal is not weakened by arriving through a degraded channel.

### 7.4 How rollback decisions are recorded

Same immutability and same exclusions as §6.5–6.6. A rollback record requires:

| Field | Note |
|---|---|
| `recordId`, `date`, `rolesExercised` | As §6.2. |
| `trigger` | What was observed, and through which channel. |
| `stateBefore` / `stateAfter` | The regime transition performed. |
| `assessmentAvailable` | Whether an assessment existed at all. **`no` is a valid and expected value.** |
| `evidenceDigest` | Only if an assessment existed. Absent otherwise; never reconstructed after the fact. |
| `rationale` | Why now rather than after the next window. |
| `windowDisposition` | The window in progress is **closed as truncated** — it is not resumed after the regime changes, because build SHA and regime are part of window identity. |
| `followUp` | What must be observed before the reverted transition is proposed again. |
| `releaseReference` | The release that carried the revert. |

**A rollback does not invalidate the archive.** The approval record that
authorized the reverted transition stands as written; the rollback record sits
beside it. Rewriting the earlier record to look prescient is the exact failure the
append-only rule exists to prevent.

### 7.5 What rollback authority is not

It is not a runtime capability, not a flag, not a script, and not a kill switch.
No component may acquire the ability to revert rollout state on its own evidence —
that would be the Authority Boundary Invariant violated in the reverse direction,
and a self-reverting system is no more human-controlled than a self-advancing one.

---

## 8. Relationship to Phase 3.8B

### 8.1 The evaluator is advisory

Restating what the code already enforces structurally (Completion Review §3): the
evaluator returns data; its output type has no `advance`, `apply`, `nextState`,
command, or callback member and no function-valued property; it imports no
feature flag; it performs no I/O; and no module in `app/` or `src/` references it
at all. There is no code path from an assessment to rollout state.

This document does not restate those properties as process rules, because a
process rule that duplicates a structural guarantee weakens it — a reader may
conclude the guarantee is procedural and therefore waivable. It is not.

### 8.2 The division of questions

| Question | Answered by | Never answered by |
|---|---|---|
| "What does the evidence support?" | The evaluator, deterministically, over one window | Any human, at review time |
| "Is this evidence complete and honestly assembled?" | Evidence Reviewer | The evaluator — it reports faithfully against what it was given and cannot detect a mis-scoped window, a confounded collection, or a threshold set too low |
| "What decision should humans make?" | Release Approver, on the record | The evaluator — `ready` is an input to a decision, never the decision |
| "Should the rules themselves change?" | Architecture Owner, via a recorded Decision | Either of the above, in the course of a review |

### 8.2.1 Evidentiary sufficiency vs. operational sufficiency

The first two rows of that table are the boundary most likely to be blurred in
practice, because both are naturally described as "is the evidence good enough?"
They are different questions, asked by different parties, over different subject
matter, and neither can answer the other.

| | **Evidentiary sufficiency** | **Operational sufficiency** |
|---|---|---|
| Question | Given this snapshot, do the fields, provenances, witnesses, attributions, and volume gates support the claim being made? | Is this snapshot the *right* evidence — from a window that was scoped, unconfounded, honestly assembled, and representative of what the transition actually risks? |
| Subject | The contents of the `EvidenceSnapshot` | The circumstances of its collection |
| Answered by | The evaluator, mechanically and deterministically | The Evidence Reviewer, as judgment (§2.2) |
| Output | `ready` / `blocked` / `insufficient-evidence` | A review note: accepted, or accepted with named reservations, or rejected as unfit for review |
| Failure it catches | Missing producers, unwitnessed zeros, ineligible provenance, mixed regimes, truncation, integrity violations | Mis-scoped windows, confounded collections, unlogged state-mutating operations, thresholds set too low, self-collection generalized to a population, a device label reused across exports |
| Blind to | Everything about how the evidence came to exist | Everything the evaluator already computed — the reviewer does not recompute it (§8.3) |

**The evaluator cannot perform operational sufficiency review.** It reports
faithfully against what it was given and, by design, has no way to know what it
was not given: it cannot detect a mis-scoped window, a confounded collection, or
a threshold set too low (Completion Review §7). Those are facts about the world
outside the snapshot, and an evaluator that inferred them would be inventing
facts the system did not observe — the precise route by which an evaluator
acquires an opinion of its own.

**Operational sufficiency review cannot perform evidentiary sufficiency
review.** A reviewer who concludes "the collection was clean, so the evidence is
sufficient" has answered the wrong question. Clean collection of insufficient
evidence is still insufficient evidence.

#### The one-way rule

**Operational sufficiency review can only subtract confidence. It can never
add.**

* A window that passes operational review is evaluated exactly as the evaluator
  reported it. Passing operational review adds nothing — it removes a reason to
  discount.
* A window that fails operational review is **unfit for use in a decision**,
  regardless of what the evaluator said about it. A `ready` assessment over a
  confounded window supports nothing, and the correct outcome is to discard the
  window and collect again.
* There is no combination in which operational review upgrades an assessment. A
  reviewer's confidence in the collection never converts
  `insufficient-evidence` into anything else. If a human proceeds anyway, that is
  an override (§6.4) — an acceptance of the reported uncertainty — and it is
  recorded as one.

Stated as a sequence: **the evaluator sets a ceiling; operational review can only
lower it; the approval record documents where inside that ceiling a human chose
to act.**

### 8.3 Operations cannot change evaluator semantics

The single most important constraint in this document.

* **No recomputation.** No reviewer, spreadsheet, script, or note may re-derive a
  recommendation from raw fields. A hand-computed verdict is a **second
  evaluator**, and the Authority Boundary Invariant prohibits a second authority
  in this system as directly as it prohibits a second mastery authority.
* **No reinterpretation.** `insufficient-evidence` does not become "effectively
  ready" because a reviewer judges the missing fields unimportant. If they are
  unimportant, that is a claim about the *field catalogue*, and the remedy is to
  change the catalogue through a Decision — not to discount the field in a
  review.
* **No selective transcription.** An approval record reproduces the assessment's
  blockers and gaps; it does not report a subset judged relevant.
* **The only remedy for disagreement is a Decision.** A Reviewer or Approver who
  concludes the evaluator's rules are wrong routes that to the Architecture Owner,
  who amends the Decisions document and, if accepted, the evaluator changes. The
  path is slow on purpose: it is the same path that made the rules trustworthy.
* **No feedback loop.** Approval records are never read by the evaluator, never
  represented as evidence, and never used to adjust a later evaluation. The
  evaluator's freedom from cross-window state is structural (Completion Review
  §2.6); the operational layer must not reintroduce that state by hand.

---

## 9. Relationship to Phase 3.8C

### 9.1 What WP-3.8C is

Explicit migration orchestration for missing-stable state — the first package in
Phase 3.8 that changes learner-visible behavior, and only in states production
has not reached. Per the Stabilization Plan it is **forbidden in `disabled` and
`shadow`** and may only be invoked in authoritative regimes.

### 9.2 Prerequisites, none of which are satisfied today

| # | Prerequisite | Status |
|---|---|---|
| 1 | **Accepted decisions** — Decisions 012, 013, and 014 resolved: accepted, amended, or rejected, with a recorded date. For 013 this necessarily includes closing the recorded architecture divergence (front matter), since the two candidate texts imply different reliability evidence. | **Not satisfied.** All `Proposed — not accepted`, and the 013 divergence is open. The Stabilization Plan places this approval checkpoint at order 3, ahead of the evidence work already done. |
| 2 | **A collection capability** — WP-3.8E runbook, snapshot export, harness attestation at a build SHA, manual attestation schema, assembly. | **Not satisfied.** All unbuilt; steps 2–5 of §4 cannot be performed. |
| 3 | **Operational evidence** — at least one closed, reviewed, regime-attributed window from a real install, including ≥1 renamed language. | **Not satisfied.** No snapshot from a real install has ever been evaluated. |
| 4 | **Approved rollout state** — an approval record advancing `disabled → shadow`, then `shadow → internal-test`, each with its own record and release. WP-3.8C ships only into `internal-test`. | **Not satisfied.** Rollout is `disabled`; no approval record exists. |
| 5 | **Rollback confidence** — ≥1 completed rollback drill recorded; a named Rollback Authority; the §7.4 record format exercised at least once. | **Not satisfied.** No drill recorded. Drills prove *capability*, never *frequency* (Evidence Model §9). |
| 6 | **An operational review process that exists** — this document reviewed and adopted, or replaced by one that is. | **Not satisfied.** This document is a proposal on the day it was written. |

### 9.3 Sequencing note

Prerequisite 1 precedes prerequisite 3, for the reason the Completion Review
gives: collecting evidence against rules nobody has accepted risks producing a
window that has to be discarded. This document adds no sequencing authority — the
Stabilization Plan and Evolution Plan own sequencing — it only records that its
own prerequisites inherit that order.

### 9.4 Retirement is a separate gate and has no override path

Decision 011 (`Accepted`) gates retirement of legacy mastery reads, legacy mastery
writes, migration markers, and orphan recovery on **operational evidence from real
installs**, explicitly not on implementation completeness or on having reached a
phase number.

Two consequences for this document:

* **No cadence makes retirement due** (§5.2), and no rollout approval record
  authorizes retirement as a side effect. A retirement decision is a separate
  record, naming one component, against Decision 011's gates.
* **The §6.4 override path does not extend to retirement.** An override is a
  human choosing to advance past what the *evidence model* reports;
  retirement is gated by an **accepted Decision**. Advancing past that is not an
  override, it is a Decision reversal, and it belongs in the Decisions document
  as one — visible, dated, and argued.

---

## 10. Open questions

Not resolved here. Grouped by who can answer them, because the failure mode is a
product question being settled by an architecture default or vice versa.

### 10.1 Architectural questions

These belong to the Architecture Owner and are settled in the Decisions document
or the owning design document.

1. **Decisions 012, 013, and 014** — accept, amend, or reject. Blocking
   everything downstream.
2. **Which Decision 013 text governs** — the recorded counter formula, or the
   Amendment Proposal's ledger predicate that the evaluator actually implements.
   **This is no longer carried only as an open question.** It is recorded as an
   explicit architecture divergence in *Recorded architecture divergence —
   Decision 013*, above, which states the two forms, their status, the direction
   of risk, and the four operational consequences binding on this process. What
   remains open here is solely the *resolution*: which form a human accepts, and
   when. Nothing in this section may be read as resolving it, and the divergence
   section may not be deleted when it is resolved — it is superseded by the
   Decision that resolves it, and the record of it stands.
3. **Threshold ownership** — who sets `MasteryRolloutTransitionThresholds` and who
   may change them. Open in the Stabilization Plan (item 6), the Evidence Model
   (§13.4), and the Amendment Proposal (§12.7). It is unresolved in three
   documents, which is itself a signal that no one has claimed it. Until it is
   resolved, `thresholdsUsed` in an approval record names an input with no owner.
4. **Observation-window identity schema** — operator-declared, with the schema
   deferred to the WP-3.8E runbook that does not exist. §4 step 1 and §6.2
   `windowId` both depend on it.
5. **Rollout attribution and producer manifest eligibility models** — proposed,
   recommended for adoption, not adopted.
6. **`MAX_OPEN_RELIABILITY_CONDITIONS = 64`** — calibration, not existence, given
   that overflow now forces `insufficient-evidence`.
7. **Whether cumulative counters should become regime-partitionable** —
   recommendation is to defer and record non-attributability as a blind spot.
8. **The `legacyFallbackRatio` companion rule** — the only proposed blocking rule
   over a rate; inert until WP-3.8C exists, which makes it easy to forget at
   exactly the moment it becomes live.
9. **Fate of the deprecated boolean adapter.**
10. **Terminology drift.** The Evidence Model specifies a
    `MasteryRolloutGateReport`; the implementation produces a `SafetyAssessment`
    from `evaluateMasteryRolloutSafety`. *Conflict observed, low severity:* no
    Decision names either type, so no higher-authority source is contradicted,
    but a record citing "the gate report" is ambiguous today. This document uses
    the implemented names.

### 10.2 Operational policy questions

These belong to whoever owns the process — a role this repository has not named.

1. **Role separation.** Must Evidence Reviewer and Release Approver be different
   people? If they cannot be, what compensating control substitutes — a
   mandatory interval between review and approval, a written devil's-advocate
   section, something else? §2.4 records collapse; it does not judge it.
2. **Where approval records live**, and whether they are committed to this public
   repository. They contain no learner data by §6.5, but they do contain
   decisions and rationales.
3. **Retention of exported snapshots.** Are raw exports archived alongside
   records, or is the `evidenceDigest` sufficient? Digest-only makes records
   compact and unauditable; archiving raw exports makes them auditable and
   large.
4. **Who may reset diagnostic storage**, and how a reset is recorded. Reset ends a
   window (§3, stage 3) and is currently an unconstrained operator action.
5. **Cadence bounds** in §5.2 — all proposed, none calibrated, and calibratable
   only after a first real window.
6. **Whether the `__DEV__` diagnostic surface ships in release builds behind a
   flag** — Phase 3 Open Question 4, still open, and a precondition for
   collecting from anything other than a development build.
7. **What "≥1 real install" means operationally** when the operator's own device
   is the install. Self-collection is legitimate evidence of *capability* and weak
   evidence of *population*; the distinction should be recorded rather than
   discovered.

### 10.3 Product decisions

These belong to the product owner and are not architectural.

1. **Whether a `limited` regime has any external cohort at all.** No cohort
   infrastructure exists and none is planned; if `limited` is operationally
   identical to `internal-test` with more time, that should be stated rather than
   implied by the state machine's name.
2. **Appetite for override.** Is advancing on `insufficient-evidence` (§6.4)
   something the product is willing to do at all, or should the override path be
   closed by policy? Closing it is defensible and would simplify §2.3
   considerably.
3. **Acceptance that rollback becomes lossy** when legacy writes are eventually
   retired — named in the Compatibility Lifecycle Classification as requiring
   "explicit product acceptance," and not yet given.
4. **Support-channel signal as evidence.** Support is currently the only
   field-failure channel that exists (§7.3). Whether support reports are
   systematically reviewed as rollout evidence, and by whom, is a product
   staffing question with an architectural consequence.
5. **Tolerance for how long `insufficient-evidence` persists.** The honest answer
   may be years. If that is unacceptable to the product, the response is to fund
   collection capability — never to reinterpret the recommendation.

---

## 11. Phase 3.8 completion boundary

Recorded so that the existence of this document is never read as evidence that
Phase 3.8 is operational.

Phase 3.8 architecture is complete through **evidence production**, **evidence
interpretation**, and **operational review modeling**. That is the whole of what
is complete.

**Phase 3.8 does not authorize:**

* rollout activation
* migration execution
* compatibility retirement
* learner-state changes

Those require **accepted decisions** and **explicit operational authorization**,
neither of which exists. Decisions 012–014 remain `Proposed — not accepted`, the
Decision 013 divergence is open (front matter), no approval record has ever been
written, and the collection capability that would produce one is unbuilt (§9.2).

A modeled process is not an exercised one. This document defines who would
decide, on what record, under what constraints — it does not establish that
anyone has decided anything, and it confers no authority on the person reading
it.

---

## Appendix A — Operational failure modes

Filed as an appendix so the required section numbering above is unchanged.

Every failure below is a **human-process** failure. None is a code defect, none
is detectable by the evaluator, and none would be caught by any test in this
repository — which is precisely why they are written down. The controls are
documentary; they work only to the extent that someone reads them.

The "residual risk" column is deliberately populated. A control that claims to
eliminate its failure mode is usually the control that has not been thought
about.

| # | Failure mode | How it appears in practice | Why it defeats the model | Control | Residual risk |
|---|---|---|---|---|---|
| F1 | **Reinterpretation drift** | `insufficient-evidence` is discussed as "effectively fine", "only missing the fields we can't measure anyway", "not a real blocker" | Converts an acknowledged absence of evidence into an apparent presence of it — the exact inversion the Evidence Model §1.0 says is worse than having no gate | §2.3 asymmetry; §6.4.1 override framing; recommendation transcribed verbatim (§6.2) | High. This is the named risk in Completion Review §7 and no document prevents a conversation. |
| F2 | **Shadow evaluation** | A reviewer, spreadsheet, or note re-derives a verdict from raw fields | Creates a second evaluator, and therefore a second authority — the Authority Boundary Invariant violated in the evidence layer | §8.3 prohibition; §8.2.1 one-way rule | Moderate. Nothing detects a private recomputation. |
| F3 | **Silent override** | Advancing on `insufficient-evidence` without the `decision: override` value and without §6.4.2 content | An override that does not look like an override leaves no trace of accepted risk | §6.2 required fields; §6.4 | Moderate. Depends entirely on the writer's honesty. |
| F4 | **Assessment shopping** | Re-collecting or re-assembling until a window produces a better recommendation, and recording only that one | Turns evidence into a search for a permitting result | §3.1 window immutability; §6.7.2 (a re-run is a new claim); all windows archived, including discarded ones | High if collection is cheap. The archive only helps if discarded windows are actually filed. |
| F5 | **Window laundering** | Merging an incomplete window with a complete one, or citing a prior window's evidence to fill this one's gap | Manufactures readiness from parts, which the evaluator is structurally prevented from doing | §5.3; §6.4.1 (no outside-window justification); Amendment Proposal §4.1 | Low structurally, moderate in prose — merges happen in the operator's assembly step, which no test observes. |
| F6 | **Confounded window** | A state-mutating operation (orphan adoption, later WP-3.8C orchestration) runs mid-collection and is not logged | The evidence describes a system that was being changed while observed; the evaluator cannot see this | §4 step 2 collection log; §2.2 reviewer check; WP-3.8E's stated mitigation | High until WP-3.8E exists. Today there is no runbook to violate. |
| F7 | **Mutable evidence reference** | A record cites "the latest export" or a file path instead of the §6.7.1 tuple | An immutable record pointing at mutable evidence is not immutable | §6.7.1 | Low if the record template carries the fields; high if records are freehand. |
| F8 | **Retrospective record** | The release ships first; the approval record is written afterwards to match | Inverts the order that makes the record a decision rather than a description | §2.3 (release without a record is a process violation, corrected by a record marked retrospective); §4 step 8 precedes step 9 | Moderate. Detectable only by comparing record dates to release dates. |
| F9 | **Archive revision** | An earlier record is edited after a rollback so it reads as more cautious than it was | Destroys the audit trail at exactly the moment it becomes valuable | §6.6 append-only; §7.4 (rollback record sits beside, never rewrites) | Low in a versioned repository; git history is the real control here. |
| F10 | **Precedent creep** | "We accepted this gap last time" becomes the rationale | A one-time acceptance of uncertainty silently becomes a permanent reinterpretation of the field catalogue | §6.4.3 | Moderate. Precedent is persuasive by nature. |
| F11 | **Basis amnesia** | Records omit that Decisions 012–014 were unaccepted and that the Decision 013 divergence stood | A future reader concludes the decisions rested on settled architecture | `decisionBasisStatus` (§6.3); divergence section consequence 1 | Low while the divergence section exists; the field must survive any record-template change. |
| F12 | **Evaluator drift without a Decision** | Evaluator semantics are adjusted to make a gate satisfiable, framed as a fix | Changes what "ready" means without anyone deciding to change it | §8.3 (only remedy is a Decision); divergence section consequence 2 | Moderate. A semantics change and a bug fix can look identical in a diff. |
| F13 | **Cadence as substitute for evidence** | Reviews happen on schedule; nobody asks what they concluded | Process compliance is mistaken for progress | §5.3 ("cadence is not a threshold", "does not accumulate credit") | Low in impact, high in likelihood — this is the benign failure. |
| F14 | **Unnamed rollback authority** | A non-`disabled` state runs live with no named authority | The one decision that must be fast has no owner when it is needed | §7.2; standing out-of-cycle trigger in §5.1 | Low if the approval record template requires the field. |
| F15 | **Population generalization** | Evidence from the operator's own device is treated as evidence about installs in general | Confuses evidence of *capability* with evidence of *frequency* — the same error the Evidence Model §9 flags for rollback drills | §10.2.7 (open); Evidence Model §9 blind spots | High. No control exists yet; this is an open operational question, not a solved problem. |
| F16 | **Retirement by side effect** | A rollout approval is read as also authorizing removal of a compatibility component | Decision 011 — an *accepted* Decision — is bypassed without a Decision reversal | §5.2 (no cadence makes retirement due); §9.4 (no override path) | Low. Decision 011 is explicit and accepted; this row exists because the audit found the same misreading already latent in a sequencing note. |

**None of these controls is enforceable by code, and none should become so.**
Making any of them executable would require a runtime component that reads
operational records and acts on them, which is the authority boundary this
document exists to keep closed. The correct response to a control that keeps
failing is a better-designed record or a resolved open question — never
automation.

---

## Verification

| Check | Result |
|---|---|
| Source files changed | None. This document is the sole addition. No file under `src/`, `app/`, `scripts/`, or `utils/` was read-modified or written. |
| Rollout state | `CONTRAST_MASTERY_ROLLOUT_STATE` unchanged at `disabled`. Not referenced as writable anywhere above. |
| Decisions accepted | None. Decisions 012–014 remain `Proposed — not accepted`; Decisions 001–011 untouched; Decision 011 cited as in force. No Decision number created. |
| Rollout authorization language | None introduced. Every transition reference is conditional and human-executed; §2.3 requires a record plus a release, and neither is performed here. |
| Operational authority location | Entirely outside runtime. No process step is executable by, triggered by, or readable by any module. §7.5 forbids acquiring runtime rollback capability. |
| Second evaluator | Prohibited explicitly in §8.3, including hand recomputation and selective transcription; reinforced by the §8.2.1 one-way rule and §6.4.1's prohibition on overrides as alternative assessments. |
| Feedback loop into evaluation | Prohibited in §3.1 and §8.3 — archived records are never evaluator input. §6.7.2 additionally forbids re-running the evaluator to substantiate an existing record. |
| Thresholds | None stated as fact. §5.1 and §6.2 mark thresholds as unapproved inputs with unresolved ownership. |
| Organizational ownership | Roles only. No individual, team, or headcount asserted; role collapse acknowledged as a real condition and recorded, not invented around. |
| Claims traceable to sources | Every architectural claim cites Decisions 008/010/011, the Stabilization Plan's invariants and Ownership Boundaries, the Evidence Model §0/§1.0/§8/§9/§10, or the Amendment Proposal §3.2/§4.1/§12. Completion Review used as a historical record only. |
| Sufficiency boundary | §8.2.1 separates evidentiary from operational sufficiency and establishes that operational review can only lower the evaluator's ceiling, never raise it. |
| Override semantics | §6.4.1 defines an override as acceptance of enumerated uncertainty, never an alternative assessment; the recommendation is transcribed unchanged, and §6.4.3 denies overrides accumulation and precedent. |
| Evidence reference immutability | §6.7 requires the five-part immutable tuple, prohibits mutable pointers, forbids digest recomputation, and denies digest comparability across evaluator commits. |
| Failure modes | Appendix A enumerates 16 human-process failure modes with controls and residual risk, and states that none may be made enforceable by code. |
| Conflicts | Decision 013's recorded text vs. the implemented ledger predicate is **promoted to an explicit recorded architecture divergence** (front matter), with §10.1.2 retaining only its unresolved *resolution*. One low-severity conflict remains an open question: `MasteryRolloutGateReport` vs. `SafetyAssessment` naming (§10.1.10). |
