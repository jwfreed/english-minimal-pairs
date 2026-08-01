# Phase 3.8B — Safety Gate Evidence Model

Date: 2026-07-31
Revised: 2026-08-01 — design review outcome recorded
Branch: `docs/phase-3-migration-strategy` (evidence gathered at `ed6fd3b`)
Status: **Design and implementation contract. Proposed — requires human
approval before Codex implements it. Implementation is additionally blocked
on WP-3.8A.1 (see §1.0).** No code, tests, or configuration were changed to
produce this document.

Scope: WP-3.8B in `docs/Phase-3.8-Stabilization-Plan.md`. Governed by
Decision 011 and by the three hardening invariants and the Authority Boundary
Invariant in that plan. This document defines *what evidence is*, *how
evidence is compared*, *what blocks advancement*, and *how evidence becomes a
human release decision*. It does not advance rollout, retire compatibility, or
authorize either.

Formalized as proposed Decisions 012 (evidence provenance), 013 (reliability
evaluates unresolved state), and 014 (advisory gate, three-valued output) in
`docs/Contrast-Domain-Architecture-Decisions.md`, under "Proposed Decisions —
not accepted." This document is the design rationale for those three; they are
the durable record. If a proposal is amended on approval, the amendment wins
and this document is revised to match.

Decision 011 is unaffected. Its retirement evidence requirements remain in
force exactly as written. Everything below constrains how evidence is
classified and evaluated, which makes those gates harder to satisfy by
accident, never easier.

---

## 0. Contract summary

The safety gate is **advisory**. Restated as enforceable properties, not
intentions:

| # | Property | How it is enforced |
|---|---|---|
| P1 | The gate cannot mutate rollout state | Gate module may not import `FEATURE_FLAGS` (value); rollout state enters only as a data argument, typed via a `import type` of `ContrastMasteryRolloutState`. Import-graph test. |
| P2 | The gate cannot write learner state | Gate and assembler modules perform zero I/O; snapshots and attestations are passed in as already-read values. Import-graph test. |
| P3 | The gate's output cannot express a command | Output is a frozen data record; the recommendation enum has exactly three members, none of which is an action; no field is a function or callback. Type-level test. |
| P4 | Diagnostics never become learner-state authority | Assembler reads only the WP-3.8A diagnostic key; no learner-state key is readable from the evidence layer. Import-graph test. |
| P5 | Missing evidence cannot pass | Every field is tri-state; `unknown` maps to `insufficient-evidence` and can never map to `ready`. Unit tests per field. |
| P6 | A zero reading is only evidence when its producer ran | Every field declares a **witness**; a zero with a dead witness is `unknown`, not `satisfied`. Unit tests per field. |
| P7 | No automatic progression | The gate refuses non-adjacent transitions and evaluates exactly one declared transition per report. |
| P8 | Only a human can reach `ready` | Manual-attestation classes are structurally invisible to the in-app surface, so the on-device report can never return `ready`. |

P8 is the load-bearing one. The rest prevent the gate from acting; P8 makes the
human step architecturally necessary rather than merely policy.

---

## 1.0 Why Phase 3.8B cannot safely proceed yet

**WP-3.8B is blocked. Two things must happen first.**

**1. Proposed Decisions 012–014 must be resolved.** All three change what the
evidence model must record and how it must be read. Implementing against a
draft that a human later amends would mean rebuilding the producer layer
underneath a shipped gate.

**2. WP-3.8A.1 must complete the diagnostic producer model.** The gate is a
pure evaluator. It can only be as trustworthy as the evidence handed to it, and
the evidence available today is dimensionally insufficient in ways no amount of
evaluation logic can repair. §1's six findings (D1–D6) are all facts the
diagnostic layer *never recorded*: an undirected divergence total that cannot
say which way a tier moved, an undifferentiated storage-failure scalar that
cannot say which side failed, a failure counter with no recovery counter, an
event with no `LanguageId`.

The tempting shortcut is to compensate inside the gate — infer direction from
the recent-event ring, treat a low failure count as converged, assume a
snapshot represents one language. Every one of those is the gate inventing a
fact the system did not observe, which is precisely how an evaluator acquires
an opinion of its own and becomes the second authority the Authority Boundary
Invariant exists to prevent. Producer gaps are closed in the producer layer.

**Why shipping WP-3.8B early would be worse than shipping nothing.** Today the
system has an *acknowledged* absence of rollout evidence, and Decision 011
correctly blocks retirement on that basis. A gate wired to the current snapshot
would report `passed: true` — it would convert an acknowledged absence of
evidence into an apparent presence of it, in front of a human whose job is to
decide whether to advance. The current state is safe because it is honestly
empty. The intermediate state would be unsafe because it is dishonestly full.

Nothing in this blockage affects the running application. Rollout is
`disabled`, the gate has no caller, and no learner-visible behavior depends on
any of it.

---

## 1. Why the current gate cannot be wired as written

`evaluateMasteryRolloutSafetyGate`
([masteryRolloutSafety.ts:30](../src/domain/masteryRolloutSafety.ts#L30))
is a pure `{passed, blockers}` evaluator over 16 numeric fields with the rule
"any nonzero field blocks; `shadowComparisons` must be ≥ 1." Wiring it to
`getDiagnosticSnapshot()` today would be unsafe, for six independent reasons.
Each is a defect this evidence model exists to fix, not a limitation to work
around.

### D1 — Absence is currently indistinguishable from cleanliness

Nine of the 16 fields have no runtime producer (F12). A struct literal built
from the persisted snapshot would set them to `0`, and `0` passes. The gate
would report `passed: true` on a build where nothing observed the conditions
those fields name. This directly violates invariant 10.

**Fix:** provenance-typed tri-state fields (§3.1) plus witness requirements
(§3.3).

### D2 — Zero-tolerance on monotonic counters is unsatisfiable

`unhandledPartialWrites`, `unhandledStableStorageFailures`, and
`unhandledLegacyStorageFailures` name *unresolved* conditions, but their only
plausible producers (`metrics.partialWrites`, `metrics.storageFailures`) are
monotonic cumulative counters that are never decremented
([masteryRolloutDiagnosticStorage.ts:401-403](../src/storage/masteryRolloutDiagnosticStorage.ts#L401-L403)).
A single transient `AsyncStorage` failure anywhere in an install-week
permanently pins the gate at `blocked`, forever, on that device.

That is not conservative — it is broken. A gate that can never pass produces
no decision signal, and the predictable human response is to stop consulting
it. The word "unhandled" already implies convergence semantics that the
counters do not implement.

**Fix:** three evaluation modes (§3.2), with reliability fields evaluated as
**residual-zero** (observed minus converged) rather than absolute-zero.

### D3 — Record-level mastery loss is classified as expected

In `compareMasteryMaps`, a legacy group with no corresponding stable record
and no tombstone is classified `missing-stable-record`
([masteryCompatibility.ts:427-437](../src/storage/masteryCompatibility.ts#L427-L437)),
and `missing-stable-record` is then excluded from `unexplainedDivergenceCount`
([:558-560](../src/storage/masteryCompatibility.ts#L558-L560)) on the stated
grounds that "missing stable records are expected before explicit migration"
([:389](../src/storage/masteryCompatibility.ts#L389)).

That rationale holds only when the **whole stable document is absent**. When
the document exists and is populated, a legacy group absent from it is exactly
the signature of record-level mastery loss — and it is currently filed as
expected and excluded from the headline blocking counter.

**Fix:** split the kind by document-level context (§4.2). This changes only
classification of diagnostic output. Shadow performs no learner-state writes,
so no learner-visible behavior changes.

### D4 — The headline blocking counter is not persisted

`unexplainedDivergenceCount` exists per shadow event in the bounded ring but
has **no cumulative persisted counter**; `PersistedMasteryRolloutMetrics`
carries `shadowDivergences` (all kinds, including expected ones) and
`unresolvedMappings`
([masteryRolloutDiagnosticStorage.ts:131-144](../src/storage/masteryRolloutDiagnosticStorage.ts#L131-L144)).
The 100-entry ring is not a valid aggregation source: once it wraps, summing
it under-reports, and the under-report is silent and always in the safe-looking
direction.

**Rule this establishes:** *cumulative counters are the only aggregation
source; the ring is context for a human reading a report, never an input to a
blocking decision.*

**Fix:** new cumulative counters (§5).

### D5 — Direction and operation are erased before persistence

`unexpectedMasteryIncreases` / `unexpectedMasteryDecreases` require the
*direction* of a tier disagreement; the persisted metrics keep only an
undirected total. `unhandledStableStorageFailures` /
`unhandledLegacyStorageFailures` require the failing *operation*; the persisted
metric keeps a single undifferentiated `storageFailures` scalar. The
information exists in the domain layer and is discarded on the way to storage.

Recording direction and operation as **counts per enumerated category** adds no
learner content and stays within the diagnostic-data boundary — a count of
downward disagreements is not a tier value.

**Fix:** counter decomposition (§5).

### D6 — The transition table's volume gates are unmeasurable

The plan's `Shadow → Internal-test` row requires "≥3 languages exercised, ≥2
cold starts, ≥1 renamed language." None of the three is derivable:
`PersistedMasteryRolloutDiagnosticEvent` carries no `LanguageId`
([masteryRolloutDiagnosticStorage.ts:44-93](../src/storage/masteryRolloutDiagnosticStorage.ts#L44-L93))
despite the Evidence Pipeline Recommendation calling for one, and no cold-start
counter exists.

`LanguageId` is a stable registry identity, not learner content, and is
explicitly listed as recordable by the Evidence Pipeline Recommendation. A
cold-start counter is a bare integer.

**Fix:** per-language observation counts and a cold-start counter (§5).

---

## 2. Position in the pipeline

```
  learner-state operations (domain / storage)
              │  emit categorized outcomes only
              ▼
  WP-3.8A diagnostic sink ──► persisted snapshot   (one device, cumulative)
              │
              │ export (operator action)
              ▼
  ┌───────────────────────────────────────────────┐
  │ EVIDENCE ASSEMBLY  (pure, read-only, no I/O)  │
  │  snapshot(s) + harness attestation +          │
  │  manual attestation  ──►  GateEvidence        │
  └───────────────────────────────────────────────┘
              ▼
  ┌───────────────────────────────────────────────┐
  │ SAFETY EVALUATION  (pure)                     │
  │  GateEvidence + declared transition           │
  └───────────────────────────────────────────────┘
              ▼
        GateReport:  ready | blocked | insufficient-evidence
              ▼
  human reads report  ──►  WP-3.8F decision artifact
              ▼
  human edits featureFlags.ts  ──►  release
```

Every arrow below `GateReport` is a human action. There is no arrow from
`GateReport` back into the running system.

---

## 3. Core concepts

### 3.1 Provenance and the tri-state field

Every evidence field carries a value *and* the class of producer that supplied
it. Provenance is part of the type, not documentation.

```ts
export type EvidenceProvenance =
  | 'runtime-measured'    // cumulative counter in the WP-3.8A snapshot
  | 'harness-attested'    // deterministic test/harness run, identified by commit
  | 'manually-attested'   // human drill or observation, WP-3.8E runbook
  | 'unknown';            // no producer, or producer not exercised

export type EvidenceValue =
  | { readonly kind: 'measured'; readonly value: number;
      readonly provenance: Exclude<EvidenceProvenance, 'unknown'>;
      readonly source: EvidenceSourceRef }
  | { readonly kind: 'unknown'; readonly reason: EvidenceUnknownReason };

export type EvidenceUnknownReason =
  | 'no-producer'            // nothing in the system can measure this (D1)
  | 'producer-not-exercised' // witness requirement unmet (§3.3)
  | 'snapshot-unavailable'   // missing / malformed / storage-error
  | 'attestation-missing'    // required attestation absent from this report
  | 'attestation-stale';     // attestation predates the code under evaluation
```

Rules:

- A field may be `measured` under exactly one provenance class per report. If
  two classes disagree (harness says 0, manual drill says 1), the report
  records **both** and takes the worse; disagreement is itself a blocker
  (`evidence-conflict`).
- `unknown` is never coerced to `0`, never defaulted, and never satisfied by
  absence. This is invariant 10, made unforgeable by the type.
- `harness-attested` fields carry the commit SHA of the run. An attestation
  whose SHA is not an ancestor of the build under evaluation is
  `attestation-stale`, not valid evidence.

### 3.2 Evaluation modes

A single "must equal zero" rule cannot serve integrity, reliability, and volume
evidence at once (D2). Each field declares one of four modes.

| Mode | Rule | Rationale |
|---|---|---|
| `absolute-zero` | Any occurrence, ever, blocks. No forgiveness, no convergence. | Data-integrity conditions that cannot be "recovered from" — a lost mastery record stays lost. |
| `residual-zero` | `observed − converged > 0` blocks. Occurrence alone does not. | Reliability conditions where the system's documented answer is retry (`retryRequired`) — the question is whether retry converged, not whether a failure happened. |
| `threshold` | Compare against a per-transition numeric bound. | Volume and coverage gates (`shadowComparisons`, install-weeks, languages exercised). |
| `interpretive` | Never blocks by itself; surfaced in the report for human reading, and may block only via an explicit companion rule. | Rates whose safe value is not zero and is not yet baselined — notably legacy fallback frequency. |

`residual-zero` requires the producer to emit convergence events, not only
failure events. This is a real new obligation on WP-3.8A (§5.3), and it is the
single largest producer-side change this model requires.

`interpretive` exists so that a metric with no established baseline is not
assigned a fabricated threshold. The Rollout Transition Gates table already
states this principle ("a threshold may be set only after one collection window
establishes the observed baseline"); `interpretive` is its type-level form.

### 3.3 Witnesses — the anti-false-confidence rule

> **A zero reading is evidence only if the code that would have produced a
> nonzero reading actually ran.**

Every field declares a **witness**: another counter whose positive value proves
its producer was exercised in the collection window. If the witness is zero or
unknown, the field resolves to `unknown / producer-not-exercised`, not to
`satisfied`.

Examples:

- `unhandledStableStorageFailures == 0` means nothing unless
  `stableReadsAttempted > 0`.
- `resetFailures == 0` means nothing unless a reset was performed —
  `resetDrillsCompleted ≥ 1`.
- `aliasRegressions == 0` means nothing unless a renamed language was loaded —
  `renamedLanguagesExercised ≥ 1`.

This mechanism is what makes `shadowComparisons < 1` (the one guard the current
gate does implement) generalize correctly to all 16 fields, instead of guarding
only one.

### 3.4 Coverage

Coverage is reported separately from satisfaction, because "nothing is wrong"
and "we looked hard enough" are different claims and the gate must not conflate
them.

```ts
export interface EvidenceCoverage {
  readonly fieldsTotal: number;
  readonly fieldsMeasured: number;
  readonly fieldsUnknown: number;
  readonly volumeGatesMet: readonly string[];
  readonly volumeGatesUnmet: readonly string[];
  readonly snapshotIntegrity: 'intact' | 'degraded' | 'unavailable';
  readonly diagnosticEventsDropped: number;   // coverage-degrading, non-blocking
  readonly diagnosticDeliveryFailures: number;
  readonly distinctSnapshotsMerged: number;
  readonly deviceDistinctnessAttested: boolean;
}
```

`snapshotIntegrity` is `degraded` when the snapshot parsed but shows dropped
events or a sequence discontinuity, `unavailable` when status is `missing`,
`malformed`, or `storage-error`. Degraded coverage cannot produce `ready`.

Diagnostic loss is an accepted degradation mode (WP-3.8A) — it reduces
confidence and therefore reduces coverage. It never blocks, because treating
diagnostic loss as a data-integrity blocker would make diagnostics
load-bearing for correctness, which invariant 1 forbids.

> **Correction — 2026-08-01, superseding the paragraph above in one respect.**
> Treating drops as *generally* coverage-degrading is too weak. A cumulative
> counter under a lossy pipeline is a **lower bound**, so drops have an exact
> and asymmetric effect: a reading of `> 0` remains trustworthy (the condition
> definitely occurred, and it still blocks), but a reading of `0` may be
> understated and is therefore **`unknown`, not satisfied**.
>
> Required rule: if `diagnosticEventsDropped > 0` or
> `diagnosticDeliveryFailures > 0` for a window, **every runtime-measured zero
> in that window resolves to `unknown`**. Non-zero readings are unaffected.
>
> The original claim stands where it matters: diagnostic loss still never
> blocks, and diagnostics still never become load-bearing for correctness.
> Drops make the gate say "I do not know," not "something is wrong."
> Derived in `docs/Phase-3.8A.1-Evidence-Completeness-Proposal.md` §2.4.

---

## 4. Safe comparison model

### 4.1 What "equivalent state" means

Legacy and stable are equivalent for a `LanguageId` when, after projecting both
to the same normal form, every identity present in either side carries the same
tier on both sides, or its absence is explained by a recorded reason.

**Normal form** (already implemented by `stableDocumentToLegacyMap`
([masteryCompatibility.ts:350](../src/storage/masteryCompatibility.ts#L350))
and `reconcileInitialLegacyMastery`):

1. Both sides are projected to a map keyed by `legacyGroup`, filtered to the
   document's own `languageId`.
2. Legacy is projected through the alias table across **all** historical labels
   for the language, not only the current label
   (`readLegacySourcesForLanguage`
   ([:112](../src/storage/masteryCompatibility.ts#L112))).
3. Keys are compared as a set; iteration order is normalized by sort
   ([:410](../src/storage/masteryCompatibility.ts#L410)).

Comparison is therefore over **resolved identity and tier only**. Everything
else in the stable document — `revision`, `provenance`, `schemaVersion`,
tombstone bookkeeping, migration-state fingerprints — is representation, and is
outside the equivalence relation by construction.

### 4.2 Difference classification

`MasteryShadowDivergenceKind` currently has six members
([masteryCompatibility.ts:363-369](../src/storage/masteryCompatibility.ts#L363-L369)).
This model requires it to distinguish document-level from record-level absence
(D3) and to distinguish which side is behind.

| Kind | Present today | Classification | Reason |
|---|---|---|---|
| `stable-document-absent` | **new** (split from `missing-stable-record`) | **Expected** | No stable document exists yet; pre-migration steady state. The only genuinely expected absence. |
| `stable-record-absent` | **new** (split from `missing-stable-record`) | **Unsafe** | A populated stable document is missing a group legacy has. Record-level mastery loss signature. |
| `legacy-record-absent` | **new** (split from `tier-disagreement`) | **Unsafe** | Stable holds a group legacy does not. Under legacy-first dual writes this ordering is impossible; it implies a legacy write was lost or reverted. |
| `tier-disagreement-stable-higher` | split from `tier-disagreement` | **Unsafe** | Unexplained mastery inflation. Feeds `unexpectedMasteryIncreases`. |
| `tier-disagreement-stable-lower` | split from `tier-disagreement` | **Unsafe** | Unexplained tier reduction. Feeds `unexpectedMasteryDecreases`. |
| `reset-disagreement` | yes | **Unsafe** | Legacy holds a tier for a contrast stable has tombstoned — reset resurrection. |
| `placement-disagreement` | yes | **Unsafe** | Placement-provenance record disagrees with legacy. |
| `alias-resolution-difference` | yes | **Unsafe** | The current-label read and the alias-resolved projection disagree — identity mismatch, the exact failure Decision 007 exists to prevent. |
| `unexpected-fallback-behavior` | yes | **Unsafe** | The comparison itself could not be completed. Must never be read as "clean." |
| ordering differences | n/a | **Expected** | Eliminated by normal form; never emitted. |
| representation differences | n/a | **Expected** | Outside the equivalence relation; never emitted. |
| diagnostic metadata differences | n/a | **Expected** | Diagnostics are not compared. |

**Splitting rule for `missing-stable-record`:** emit `stable-document-absent`
when `stableRead.status === 'missing'`; emit `stable-record-absent` when
`stableRead.status === 'ok'` and the record is absent from a populated
document. `stable-document-absent` is the only kind excluded from
`unexplainedDivergenceCount`. All others count.

**Malformed legacy is not a clean comparison.** When
`malformedLegacyCount > 0`, the comparison's result must be reported as
`blocked`, not `compared` — a comparison against unparseable input is an
absence of evidence, not evidence of equivalence. Today `malformedLegacyCount`
is carried on the result
([:562](../src/storage/masteryCompatibility.ts#L562)) but does not affect
`status`.

**Conflict severity ordering**, for report ranking:

1. `reset-disagreement`, `stable-record-absent`, `legacy-record-absent` —
   learner-visible progress loss or resurrection.
2. `alias-resolution-difference` — identity mismatch; compounds silently across
   future renames.
3. `tier-disagreement-*`, `placement-disagreement` — value disagreement with
   known identity.
4. `unexpected-fallback-behavior` — evidence-quality failure.

### 4.3 What comparison cannot see

Stated explicitly so a future reader does not mistake gate silence for
coverage:

- **Attempt history.** `@pairProgress_v2` is not compared at all. Attempt loss
  is `harness-attested` only (`ATTEMPT_LOST`, `ATTEMPT_TOTAL_MISMATCH` in
  [legacyLearnerStateVerification.ts:197-219](../scripts/phase3/legacyLearnerStateVerification.ts#L197-L219)),
  never runtime-measured. Decision 008 defers pair-progress migration; this
  model does not reopen it.
- **Placement completion.** `@placementDone_${categoryLabel}` (G6) has no
  stable counterpart and no alias resolution, so no comparison exists.
  `placementFailures` covers placement *tier*, which flows through mastery
  (F9), and **not** placement completion. Recorded as a declared blind spot
  (§9), not silently omitted.
- **Cross-install behavior.** One device's snapshot describes one device.
  §8 defines merge semantics; the gate never infers a population from a
  sample.

---

## 5. Producer obligations — owned by WP-3.8A.1

**This section is the specification for WP-3.8A.1, not for WP-3.8B.** It is
recorded here because the design review derived it, but the work belongs to the
observability/operations layer under the plan's Ownership Boundaries, and ships
as a separate package before the gate exists. WP-3.8B consumes what this
produces and adds nothing to it.

Everything below is producer work: recording facts. No comparison, no
threshold, no boolean derived from a threshold, and no notion of a safe value
appears anywhere in this section — a counter that "knows" what is safe has
crossed into the evaluator's layer.

All additions are counts, enumerated categories, or stable registry identities.
None carries learner content, and each is checked against the
diagnostic-data-boundary invariant. Every added write remains fire-and-forget,
failure-isolated, and non-blocking with respect to learner-state operations,
exactly as WP-3.8A established.

### 5.1 Counter decomposition

Replace or supplement the existing scalars. Existing counters are retained;
these are additive.

| New cumulative counter | Replaces / refines | Boundary check |
|---|---|---|
| `shadowUnexplainedDivergences` | closes D4 | count only |
| `divergencesByKind: Record<MasteryShadowDivergenceKind, number>` | closes D4, D5 | enumerated category counts |
| `storageFailuresByOperation: Record<MasteryRolloutStorageFailureOperation, number>` | refines `storageFailures` | enumerated category counts |
| `stableReadsByStatus: Record<StableReadOutcome, number>` | refines `stableReadsAttempted/Successful` | enumerated category counts |
| `compatibilityWritesByStatus: Record<'complete'\|'partial'\|'failed', number>` | refines `partialWrites` | enumerated category counts |
| `orphanAdoptionsByStatus: Record<'complete'\|'partial'\|'failed', number>` | refines `orphanAdoptionEvents` | enumerated category counts |
| `migrationOutcomes: Record<LazyMasteryMigrationResult['status'], number>` | new (WP-3.8C observability) | enumerated category counts |
| `coldStarts` | closes D6 | integer |

`divergencesByKind` subsumes the direction and reset/placement splits, so
`unexpectedMasteryIncreases`, `unexpectedMasteryDecreases`, `resetFailures`,
`placementFailures`, and `aliasRegressions` all become runtime-derivable from
one map.

### 5.2 Per-language observation counts (closes D6)

Add to the snapshot:

```ts
readonly languageObservations: Readonly<Record<LanguageId, {
  readonly shadowComparisons: number;
  readonly stableReads: number;
  readonly compatibilityWrites: number;
}>>;
```

Bounded by the contrast registry's language count, so it is inherently
size-capped. `LanguageId` is an immutable registry identity (Decision 003), not
learner content: it says *which language was exercised*, never *what the
learner knows*. `renamedLanguagesExercised` is then derived by intersecting the
observed keys with languages that have alias rows in
`historicalIdentityMapping.categoryLabels` — no new stored field.

Add `languageId` to the persisted event ring as well, for human context.

### 5.3 Convergence events (enables `residual-zero`)

`residual-zero` requires the producer to say when a failure *resolved*.
Minimal, and derivable from existing return values:

- **Partial writes.** `writeCompatibleMastery` returns
  `retryRequired: true` on a legacy-succeeded/stable-failed result
  ([masteryCompatibility.ts:932-939](../src/storage/masteryCompatibility.ts#L932-L939)).
  Track an **open partial-write set keyed by `LanguageId`**: opened on
  `status: 'partial'`, closed on the next `status: 'complete'` for the same
  language. Persist `partialWritesOpened`, `partialWritesConverged`, and the
  current open-language count. Residual = open count.
- **Storage failures.** Per operation, count a failure as converged when the
  same operation subsequently succeeds for the same `LanguageId`. Persist
  `storageFailuresOpened` / `storageFailuresConverged` per operation.
- **Orphan adoption.** `candidates-partially-persisted` opens; a subsequent
  `candidates-adopted` or `no-candidates` for the same language closes.

The open set is bounded by the language count and holds no learner content —
it is a set of `LanguageId`s with a boolean state.

**Explicit non-obligation:** convergence tracking must remain fire-and-forget
and failure-isolated exactly as WP-3.8A requires. A failure to record
convergence degrades coverage; it must never retry, block, or delay a learner
write.

### 5.4 Persist the diagnostic self-metrics

`diagnosticDeliveryFailures` and `diagnosticEventsDropped` are deliberately
excluded from `PersistedMasteryRolloutMetrics`
([masteryRolloutDiagnosticStorage.ts:102-105](../src/storage/masteryRolloutDiagnosticStorage.ts#L102-L105)).
The consequence is that after a cold start an operator cannot tell whether the
snapshot is complete or silently lossy — which is precisely the question
coverage must answer.

Persist both. They are counts about the diagnostic pipeline itself, contain no
learner content, and feed `EvidenceCoverage`, never a blocker. Persisting them
is best-effort like everything else in the pipeline: a drop counter that itself
fails to persist simply degrades coverage further.

### 5.5 Snapshot integrity

Add `firstSequence` alongside the existing `sequence` so ring wrap and
truncation are detectable. Bump `MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION` to
`2`. A `v1` snapshot read by a `v2` build is `malformed` under the existing
strict validator, which resolves to `snapshot-unavailable` → every
runtime-measured field becomes `unknown` → `insufficient-evidence`. That is the
correct behavior and requires no migration path: diagnostic loss is acceptable
(WP-3.8A), and a v1 snapshot predates the counters the gate needs anyway.

---

## 6. Evidence catalogue

Columns: **Mode** per §3.2 · **Witness** per §3.3 · **Source** = producer.
"P" marks a field whose producer does not exist yet and is created by §5.

### 6.1 Correctness evidence

| Field | Source / provenance | Aggregation | Mode | Witness | Blocking condition |
|---|---|---|---|---|---|
| `lostMasteryRecords` | harness `MASTERY_RECORD_LOST`, `MASTERY_REMOVED`; rollback drill | max over runs | `absolute-zero` | harness run at build SHA | any occurrence |
| `duplicatedMasteryRecords` | harness `MASTERY_RECORD_DUPLICATED`; runtime structural check on stable document | sum | `absolute-zero` | `stableReadsByStatus.ok > 0` **P** | any occurrence |
| `unexpectedMasteryIncreases` | `divergencesByKind['tier-disagreement-stable-higher']` **P** | sum | `absolute-zero` | `shadowComparisons ≥ N(transition)` | any occurrence |
| `unexpectedMasteryDecreases` | `divergencesByKind['tier-disagreement-stable-lower']` **P** | sum | `absolute-zero` | `shadowComparisons ≥ N(transition)` | any occurrence |
| `resetFailures` | `divergencesByKind['reset-disagreement']` **P**; reset drill | sum | `absolute-zero` | `resetDrillsCompleted ≥ 1` | any occurrence |
| `placementFailures` | `divergencesByKind['placement-disagreement']` **P**; placement drill | sum | `absolute-zero` | `placementDrillsCompleted ≥ 1` | any occurrence |
| `unresolvedContrastMappings` | `unresolvedMappings` | sum | `absolute-zero` | `shadowComparisons > 0` | any occurrence |
| `malformedStableFallbacks` | `stableReadsByStatus.malformed + .unsupported-version` **P** | sum | `absolute-zero` | `stableReadsAttempted > 0` | any occurrence |
| `unexplainedDivergences` | `shadowUnexplainedDivergences` **P** | sum | `absolute-zero` | `shadowComparisons ≥ N(transition)` | any occurrence |
| `stableRecordAbsences` **new** | `divergencesByKind['stable-record-absent']` **P** | sum | `absolute-zero` | `stableReadsByStatus.ok > 0` | any occurrence (D3) |
| `legacyRecordAbsences` **new** | `divergencesByKind['legacy-record-absent']` **P** | sum | `absolute-zero` | `compatibilityWrites > 0` | any occurrence |
| `crossLanguageCollisions` | harness `CONFLICTING_SOURCE_KEY`, `NON_DETERMINISTIC_MAPPING`; golden-file fence | max over runs | `absolute-zero` | harness run at build SHA | any occurrence |
| `blockedComparisons` **new** | shadow events with `status: 'blocked'` + `malformedLegacyCount > 0` | sum | `absolute-zero` | `shadowComparisons > 0` | any occurrence — a comparison that could not run is not a clean comparison (§4.2) |

**Interpretation.** This category answers "did anything happen to learner
progress that must not happen." Every field is `absolute-zero` because none of
these conditions has a recovery path that restores the lost information.
`lostMasteryRecords` and `crossLanguageCollisions` are permanently
`harness-attested`: measuring them at runtime would require the diagnostic
store to hold enough mastery content to detect loss, which invariant 1
prohibits outright. That is a deliberate, permanent provenance assignment, not
a gap awaiting a runtime producer.

### 6.2 Compatibility evidence

| Field | Source / provenance | Aggregation | Mode | Witness | Blocking condition |
|---|---|---|---|---|---|
| `aliasRegressions` | `divergencesByKind['alias-resolution-difference']` **P**; harness `ALIAS_IDENTITY_DIVERGED` | sum | `absolute-zero` | `renamedLanguagesExercised ≥ 1` **P** | any occurrence |
| `legacyFallbackRatio` **new** | `legacyFallbacksUsed / stableReadsAttempted` | ratio over window | `interpretive` | `stableReadsAttempted ≥ N` | never blocks alone; see companion rule |
| `migrationFailures` **new** | `migrationOutcomes` in {`storage-failure`, `blocked-by-malformed-data`, `blocked-by-unusable-stable`} **P** | opened − converged | `residual-zero` | `migrationOutcomes` total > 0 | unconverged residue > 0 |
| `migrationOutcomesUnexpected` **new** | `migrationOutcomes` outside {`migrated`, `already-current`, `migration-state-recreated`, `partially-migrated`} **P** | sum | `absolute-zero` | migration attempted | any occurrence |
| `orphanAdoptionResidue` **new** | `orphanAdoptionsByStatus.partial` unconverged **P** | opened − converged | `residual-zero` | orphan adoption invoked | unconverged residue > 0 |
| `orphanAdoptionFailures` **new** | `orphanAdoptionsByStatus.failed` **P** | sum | `absolute-zero` | orphan adoption invoked | any occurrence |
| `blockedMigrations` **new** | existing `blockedMigrations` counter | sum | `absolute-zero` | migration attempted | any occurrence — a blocked migration means unusable stable or malformed legacy |

**Interpretation.** This category answers "can the two systems still coexist."
`legacyFallbackRatio` is the one field that is deliberately not zero-tolerance:
falling back to legacy on missing stable is *correct, expected behavior*
([masteryCompatibility.ts:669-673](../src/storage/masteryCompatibility.ts#L669-L673)),
and before WP-3.8C ships it is the dominant path for every unmigrated language.
Its safe value is unknown until a collection window baselines it.

**Companion rule (the only way `legacyFallbackRatio` blocks):** once WP-3.8C
orchestration is live in an authoritative state, the ratio must *decline*
across consecutive collection windows. A flat or rising ratio while
orchestration is running means migration is failing silently, and blocks with
`fallback-ratio-not-declining`. Before WP-3.8C ships, the field is reported and
never blocks.

### 6.3 Reliability evidence

| Field | Source / provenance | Aggregation | Mode | Witness | Blocking condition |
|---|---|---|---|---|---|
| `unhandledStableStorageFailures` | `storageFailuresByOperation` for `read-stable` / `write-stable`, opened − converged **P** | residual | `residual-zero` | `stableReadsAttempted > 0` | residue > 0 |
| `unhandledLegacyStorageFailures` | same for `read-legacy` / `read-legacy-fallback` / `write-legacy` **P** | residual | `residual-zero` | legacy op attempted | residue > 0 |
| `unhandledMigrationStateFailures` **new** | same for `read-migration-state` / `write-migration-state` **P** | residual | `residual-zero` | migration attempted | residue > 0 |
| `unhandledPartialWrites` | open partial-write language set **P** | residual | `residual-zero` | `compatibilityWrites > 0` | residue > 0 (D2) |
| `storageFailureRate` **new** | `storageFailures / (stableReads + compatibilityWrites)` | ratio | `interpretive` | denominator ≥ N | never blocks alone |
| `diagnosticDeliveryFailures` | persisted self-metric **P** (§5.4) | sum | coverage only | — | **never blocks**; degrades coverage |
| `diagnosticEventsDropped` | persisted self-metric **P** (§5.4) | sum | coverage only | — | **never blocks**; degrades coverage |
| `snapshotIntegrity` **new** | snapshot status + `firstSequence` continuity **P** | worst over merged snapshots | coverage only | — | **never blocks**; `unavailable` forces every runtime field to `unknown` |

**Interpretation.** This category answers "is the system's own machinery
working, and did failures resolve." The `residual-zero` mode is what makes this
category evaluable at all (D2): the architecture's documented answer to a
partial write is retry-and-converge (`retryRequired`,
[masteryCompatibility.ts:937](../src/storage/masteryCompatibility.ts#L937)), so
the honest question is convergence, not occurrence. Occurrence counts stay in
the report for human reading — a converged-but-frequent failure pattern is a
signal a human should weigh even though it does not block.

The three diagnostic-self fields never block. Making diagnostic health a
blocker would make diagnostics load-bearing for a correctness decision, which
is the second-authority failure the Authority Boundary Invariant names.

### 6.4 Rollback evidence

Rollback cannot be runtime-measured on a device that has not rolled back, and
the app has no remote configuration and no way to induce one. This category is
therefore predominantly `manually-attested`, permanently and by design.

| Field | Source / provenance | Aggregation | Mode | Witness | Blocking condition |
|---|---|---|---|---|---|
| `rollbackDrillsCompleted` | manual (WP-3.8E) | count over window | `threshold` | — | below transition minimum |
| `rollbackDivergences` **new** | manual drill: post-rollback legacy read vs pre-rollback expected | sum | `absolute-zero` | `rollbackDrillsCompleted ≥ 1` | any occurrence |
| `stableDataPreservedAfterRollback` **new** | manual drill: stable document + marker still present and valid after revert | boolean, ANDed | `absolute-zero` (must be true) | `rollbackDrillsCompleted ≥ 1` | false, or unattested |
| `legacyAuthorityRecovered` **new** | manual drill: full mastery fidelity via legacy path after revert | boolean, ANDed | `absolute-zero` (must be true) | `rollbackDrillsCompleted ≥ 1` | false, or unattested |
| `resetDrillsCompleted` | manual | count | `threshold` | — | below transition minimum |
| `placementDrillsCompleted` | manual | count | `threshold` | — | below transition minimum |
| `practiceBehaviorChanges` | manual: drill observation + support-channel review | sum | `absolute-zero` | manual attestation present | any occurrence |

**Interpretation.** This category answers "can we undo this." It is the direct
evidence for the Decision 008 hard invariant and for Finding 3 of the audit —
that removing legacy writes converts rollback from "revert the code" into
"revert the code and accept data loss."

`practiceBehaviorChanges` is permanently `manually-attested`: detecting a
behavioral change would require comparing learner-visible outcomes across
authority modes, which requires either recording behavior (prohibited) or
running both engines live (prohibited by the anti-forking rule). Assigning it a
runtime producer would be the second-authority mistake in miniature.

### 6.5 Volume and coverage gates

| Gate | Source | Mode | Notes |
|---|---|---|---|
| `shadowComparisons` | runtime | `threshold` | The only volume gate the current implementation has. |
| `languagesExercised` | `languageObservations` key count **P** | `threshold` | Closes D6. |
| `renamedLanguagesExercised` | derived: observed ∩ alias-table languages **P** | `threshold` | Closes D6. **Never satisfiable by a synthetic run** — see §7.4. |
| `coldStartsObserved` | `coldStarts` **P** | `threshold` | Closes D6. |
| `installWeeks` | manual | `threshold` | Cannot be device-measured without timestamps, which are prohibited. |
| `consecutiveCleanReleases` | manual | `threshold` | For `limited → enabled`. |

---

## 7. The safety gate contract

### 7.1 Input

```ts
export interface MasteryRolloutGateInput {
  /** The single, adjacent transition being evaluated. */
  readonly transition: MasteryRolloutTransition;
  /** Rollout state as observed data, never as a control channel. */
  readonly currentState: ContrastMasteryRolloutState;  // import type only
  readonly evidence: MasteryRolloutGateEvidence;       // every field an EvidenceValue
  readonly coverage: EvidenceCoverage;
  readonly thresholds: MasteryRolloutTransitionThresholds;
}

export type MasteryRolloutTransition =
  | 'disabled->shadow'
  | 'shadow->internal-test'
  | 'internal-test->limited'
  | 'limited->enabled';
```

`thresholds` is passed in rather than hardcoded, so the "PROPOSED defaults"
of the Rollout Transition Gates table can be recalibrated by a human editing a
declared constant, and so a report always states the thresholds it was
evaluated against. The defaults ship as a frozen record adjacent to the gate.

The gate takes **already-read** values. It never reads storage, never reads
`FEATURE_FLAGS`, and never reads a file. All I/O lives in the assembler's
callers (§7.5).

### 7.2 Output

Per proposed Decision 014 the recommendation is three-valued —
`READY` / `BLOCKED` / `INSUFFICIENT_EVIDENCE` — and binary pass/fail is
prohibited. The identifiers below are the lowercase kebab-case spelling of
those three states, matching every other discriminated union in this codebase
(`'storage-error'`, `'already-current'`, `'unsupported-version'`). The states
are the Decision's states; only the spelling is idiomatic. There is no fourth
state and no way to widen the union without amending Decision 014.

```ts
export type MasteryRolloutRecommendation =
  | 'ready'                  // READY
  | 'blocked'                // BLOCKED
  | 'insufficient-evidence'; // INSUFFICIENT_EVIDENCE

export interface MasteryRolloutGateReport {
  readonly transition: MasteryRolloutTransition;
  readonly recommendation: MasteryRolloutRecommendation;
  readonly blockers: readonly EvidenceFinding[];   // ranked, §4.2 severity
  readonly gaps: readonly EvidenceGap[];           // unknown fields + unmet witnesses
  readonly unmetVolumeGates: readonly string[];
  readonly fields: readonly EvaluatedField[];      // every field, satisfied or not
  readonly coverage: EvidenceCoverage;
  readonly thresholds: MasteryRolloutTransitionThresholds;
  readonly evidenceDigest: string;                 // stable hash of the input
  readonly generatedFrom: 'on-device' | 'operator-report';
}
```

`evidenceDigest` is a stable hash over the canonicalized input (reuse
`sortJsonValue` from
[masteryRolloutDiagnosticStorage.ts:390](../src/storage/masteryRolloutDiagnosticStorage.ts#L390)).
The WP-3.8F decision artifact cites it, so a later reader can prove which
evidence a human actually approved, and a re-run against the same input is
byte-identical.

**Nothing in this type can advance rollout.** There is no `advance`, `apply`,
`nextState`, callback, or command member. Type-level test asserts no property
is a function.

### 7.3 Decision procedure

```
1. Reject non-adjacent or backward transitions →
   recommendation 'blocked', finding 'non-adjacent-transition'.   [P7]

2. If coverage.snapshotIntegrity === 'unavailable',
   force every runtime-measured field to unknown/snapshot-unavailable.

3. For each field:
     a. unknown                         → gap
     b. witness unmet                   → gap (unknown/producer-not-exercised)
     c. provenance classes conflict     → blocker 'evidence-conflict'
     d. evaluate per mode:
          absolute-zero  → value !== 0            → blocker
          residual-zero  → opened - converged > 0 → blocker
          threshold      → value < bound          → unmet volume gate
          interpretive   → record; apply companion rule if declared

4. Recommendation:
     any blocker                                   → 'blocked'
     else any gap OR unmet volume gate
          OR coverage.snapshotIntegrity !== 'intact'
          OR generatedFrom === 'on-device'         → 'insufficient-evidence'
     else                                          → 'ready'
```

`blocked` outranks `insufficient-evidence` because a known violation is
actionable now, while missing evidence is a scheduling problem. Both are
non-advancing, so the safety property holds under either ordering; the
distinction exists to tell a human which of the two problems to work on.

Step 4's `generatedFrom === 'on-device'` clause is P8: the on-device surface
cannot see manual attestations, so it must not be able to render `ready` even
if every field it *can* see is satisfied. This is a structural guarantee, not a
UI convention.

### 7.4 Rules that prevent evidence laundering

- **Synthetic evidence cannot satisfy a real-install gate.** A harness
  attestation may satisfy only fields whose declared provenance includes
  `harness-attested`. It can never satisfy `shadowComparisons`,
  `renamedLanguagesExercised`, `coldStartsObserved`, or any rollback field.
  The audit's requirement that gate results come from "real, persisted
  diagnostic counters — not hand-constructed test evidence" becomes a type
  constraint rather than a instruction.
- **Attestations must be fresh.** A harness attestation whose commit SHA is not
  an ancestor of the build under evaluation is `attestation-stale` → `unknown`.
- **Merged evidence must be attested distinct.** See §8.
- **The gate never invents a threshold.** A transition with no declared
  threshold for a `threshold`-mode field yields an unmet volume gate, not a
  pass.

### 7.5 Module layout and enforcement

| Module | Responsibility | May import | Must not import |
|---|---|---|---|
| `src/domain/masteryRolloutSafety.ts` | pure evaluation (§7.3) | types only | storage, AsyncStorage, `FEATURE_FLAGS` value, React |
| `src/domain/masteryRolloutEvidence.ts` **new** | pure assembly: snapshot + attestations → `GateEvidence` | diagnostic *types*, registry, alias table | any writer, any learner-state key, AsyncStorage |
| `scripts/report-rollout-readiness.js` **new** | operator CLI: read exported files → report | node fs, the two above | nothing that writes to a device |
| in-app `__DEV__` surface | render on-device report | the two above, `getDiagnosticSnapshot` | nothing that writes rollout state |

Enforcement is an import-graph test, not review discipline: assert that the
transitive import closure of the two domain modules contains no module
exporting a write function and no reference to `FEATURE_FLAGS` as a value.
Precedent for the pure-module discipline already exists throughout
`src/domain/`.

### 7.5.1 No generic rule engine

The four evaluation modes (§3.2) are a **classification of this domain's
evidence fields**, not a rule language. They must be implemented as an explicit
mastery-rollout domain model, and specifically must not become:

- a generic rule/predicate engine, registry, or DSL over arbitrary conditions
- a configurable policy loader, or rules expressed as data outside the codebase
- a reusable "safety gate framework" parameterized for future subsystems
- an abstraction shared with any other domain

The evidence catalogue in §6 is a fixed, enumerated set of named fields for
mastery rollout. Adding a field is a code change and a review, which is the
point: an evidence model whose fields can be added or reweighted without a code
review is an evidence model whose gate can be widened without anyone noticing,
and that defeats the human-control property Decision 014 exists to protect.

A generic engine would also erode the boundaries this design depends on. Modes,
witnesses, and provenance are meaningful precisely because each is tied to a
specific known producer and a specific known failure mode in *this* migration.
Generalized into abstract rules over abstract metrics, they become
configuration — and configuration is exactly the thing that can drift without a
Decision reversal.

If a second subsystem later needs a safety gate, the correct move is to write a
second explicit model and extract shared structure only if the two turn out to
be genuinely the same. They almost certainly will not be.

### 7.6 Relationship to the existing function

`evaluateMasteryRolloutSafetyGate` is exported and covered by
[masteryRollout.test.js:146-150](../scripts/masteryRollout.test.js#L146-L150).
It is **not** deleted and **not** left as a parallel evaluator — two evaluators
would be exactly the dual-authority pattern the Authority Boundary Invariant
forbids, applied to the gate itself.

Required shape: the new provenance-aware evaluator is the single
implementation; the existing function is reduced to a thin adapter that lifts a
plain numeric `MasteryRolloutSafetyEvidence` into all-`runtime-measured`,
all-witnessed evidence for the `shadow->internal-test` transition and returns
`{passed, blockers}` derived from the report (`passed === recommendation ===
'ready'`). Its existing tests must pass unchanged. It should carry a
`@deprecated` note directing callers to the report API, because its boolean
return cannot express `insufficient-evidence` — the distinction this entire
model exists to preserve.

---

## 8. Multi-snapshot merge

Each snapshot describes one device. Evidence for an install-week or a
multi-language window is an operator-assembled merge, and the merge rules must
not manufacture confidence.

| Field class | Merge rule |
|---|---|
| cumulative counters | sum |
| `absolute-zero` fields | sum (any nonzero anywhere blocks) |
| `residual-zero` fields | sum opened, sum converged, residual per device then summed — never net across devices |
| ratios | recompute from summed numerator/denominator; never average of ratios |
| `languageObservations` | key-wise sum; `languagesExercised` = union cardinality |
| `snapshotIntegrity` | worst of all inputs |
| boolean manual attestations | AND |
| coverage counts | sum, plus `distinctSnapshotsMerged` |

**Device distinctness is an operator assertion, not an app capability.** The
diagnostic schema is prohibited from carrying any device or user identifier
(WP-3.8A), so the app cannot de-duplicate two exports from the same device.
Therefore:

- Each exported snapshot is labeled by the operator, in the manual attestation,
  with a collection-window ID and an operator-assigned device label.
- `deviceDistinctnessAttested` records whether the operator asserted the merged
  snapshots came from distinct devices.
- If distinctness is unattested, **the merge counts as one device** for every
  volume gate. Volume gates are the only thing double-counting could inflate,
  and this rule makes the inflation impossible rather than merely discouraged.

This keeps the no-identifier privacy rule intact and moves the de-duplication
obligation to the human who actually knows the answer.

---

## 9. Declared blind spots

Recorded so that gate silence is never mistaken for coverage. Each is a
permanent or explicitly-deferred absence of evidence, not a bug.

| Blind spot | Consequence | Disposition |
|---|---|---|
| Placement **completion** (`@placementDone_${label}`, G6) | A rename re-shows placement; no field detects it | Declared out of scope for WP-3.8B. The report must render a standing note, not an `unknown` field, so it is never mistaken for a measurable gap. Owned by the pre-Phase-4 placement package. |
| Pair-progress / attempt history (G7, Decision 008) | Attempt loss invisible at runtime | `harness-attested` only. Not reopened here. |
| Install version distribution | Population unknowable | Permanently unknown; no telemetry exists. Gate never infers population from a sample. |
| Rollback frequency in the field | Real-world rollback rate unknown | Manual drills substitute for field data; drills prove *capability*, never *frequency*. |
| Pre-`v2` pair-progress payloads (Phase 3 Open Question 1) | Unknown existence | Nothing may be deleted or ignored; unchanged by this model. |
| Behavior change beyond drills | Learner-visible regressions outside drilled paths | `practiceBehaviorChanges` is manual and low-sensitivity by construction. |

---

## 10. Evidence → decision

1. **Collect.** Operator runs the WP-3.8E procedure on ≥1 real install, logging
   every explicitly invoked operation (orphan adoption, WP-3.8C orchestration)
   so the window is not confounded.
2. **Export.** Operator exports each device's snapshot JSON from the `__DEV__`
   surface. The on-device report is visible during collection and, by P8, can
   report `blocked` or `insufficient-evidence` but never `ready`.
3. **Attest.** Harness attestation emitted from a test run at the build SHA;
   manual attestation written per the WP-3.8E schema, including drill outcomes
   and the device-distinctness assertion.
4. **Assemble and evaluate.** Operator runs the CLI over snapshot(s) +
   attestations, producing a `MasteryRolloutGateReport` with an
   `evidenceDigest`.
5. **Decide.** A human reads the report and records a WP-3.8F decision
   artifact: transition, recommendation, `evidenceDigest`, thresholds used,
   named approver, and — required — an explicit rationale when advancing while
   any field is `unknown`.
6. **Act.** A human edits `CONTRAST_MASTERY_ROLLOUT_STATE` in
   [featureFlags.ts:18](../src/config/featureFlags.ts#L18) and ships a release.

Steps 5 and 6 have no automated component and no code path from step 4. A
`ready` recommendation is an input to step 5, never a substitute for it. A human
may decline to advance on a `ready` report; that is a valid outcome and must be
recordable in the artifact.

---

## 11. Verification requirements

Codex must produce tests for each. These are the completion evidence for
WP-3.8B.

**Advisory-only (P1–P4):**

1. Import-graph test: `masteryRolloutSafety.ts` and `masteryRolloutEvidence.ts`
   transitively import no writer, no `AsyncStorage`, and no `FEATURE_FLAGS`
   value.
2. Type-level test: no property of `MasteryRolloutGateReport` is a function;
   the recommendation union has exactly three members.
3. Test: evaluating any transition, on any evidence, leaves
   `FEATURE_FLAGS.contrastMasteryRollout` unchanged and performs no storage
   call (assert against a throwing storage stub passed nowhere).

**No false confidence (P5, P6, D1):**

4. For every field: a `unknown` value yields `insufficient-evidence`, never
   `ready` — table-driven over the full field set, so a field added later
   without a producer fails the test by default.
5. For every field: value `0` with an unmet witness yields
   `insufficient-evidence`, not `ready`.
6. An evidence object with every field `0` and every witness unmet yields
   `insufficient-evidence` — the exact scenario the current gate would report
   as `passed: true`.
7. A `harness-attested` value cannot satisfy `shadowComparisons`,
   `renamedLanguagesExercised`, `coldStartsObserved`, or any rollback field.
8. A stale harness attestation (SHA not an ancestor) yields `unknown`.

**Convergence semantics (D2):**

9. One partial write followed by a successful complete write for the same
   `LanguageId` yields `unhandledPartialWrites` residual `0` and does not
   block.
10. One partial write with no subsequent success blocks.
11. A partial write on language A converged, plus an open one on language B,
    blocks — convergence does not net across languages.

**Comparison model (D3, §4.2):**

12. A legacy group absent from a **populated** stable document is classified
    `stable-record-absent` and counts toward `unexplainedDivergences`.
13. The same absence with **no** stable document is classified
    `stable-document-absent` and does not count.
14. `malformedLegacyCount > 0` yields comparison `status: 'blocked'` and
    increments `blockedComparisons`.
15. A stable record with no legacy counterpart is classified
    `legacy-record-absent` and blocks.
16. Tier disagreements are split by direction into the increase/decrease
    fields.

**Transition scoping (P7):**

17. `disabled->limited` is rejected as `non-adjacent-transition`.
18. A backward transition is rejected.
19. Thresholds are read from the input, and the report echoes the thresholds it
    used.

**On-device surface (P8):**

20. A report with `generatedFrom: 'on-device'` never returns `ready`, even with
    every visible field satisfied.
21. The `__DEV__` surface exposes no control that writes rollout state.

**Merge (§8):**

22. Two snapshots without an attested distinctness assertion count as one
    device for volume gates.
23. Ratios are recomputed from summed components, not averaged.

**Diagnostic isolation (unchanged obligation):**

24. The existing WP-3.8A isolation tests still pass with the §5 producer
    changes: a throwing or slow diagnostic sink cannot fail or delay a mastery
    read, write, reset, or placement action — including the new convergence
    tracking.
25. Schema test: the extended snapshot still rejects any field resembling raw
    mastery, answer, or attempt content, and `languageObservations` accepts
    only registry-known `LanguageId` keys.

**Backward compatibility (§7.6):**

26. `masteryRollout.test.js`'s existing gate assertions pass unchanged against
    the adapter.

---

## 12. Out of scope

This package does not, and must not: advance rollout state; retire any
compatibility component; wire WP-3.8C orchestration; implement placement
migration; touch `@pairProgress_v2`; add remote telemetry or any new
dependency; introduce a device or user identifier; build a generic rule engine
(§7.5.1); or add any learner-visible surface. `readCompatibleMastery` and
`writeCompatibleMastery` gain no new write paths. The §4.2 divergence-kind
changes alter diagnostic classification only — shadow remains read-only.

**Also out of scope for WP-3.8B specifically:** everything in §5. Those are
producer obligations owned by WP-3.8A.1 and shipped before this package. If
WP-3.8B implementation finds itself modifying diagnostic storage, the scope
boundary has been crossed.

**Domain boundaries this package must leave intact**, restated because the
evidence layer touches all three:

| Layer | Does | Must not do |
|---|---|---|
| Diagnostic | observes, records, reports | decide anything; influence learner state; be read by any learner-facing path |
| Migration | resolves identities, performs explicit migration, preserves learner-state invariants | be triggered by diagnostics or by the gate; hide a write inside a read |
| Rollout boundary | evaluates evidence, supports a human decision | write anything; advance itself; produce evidence it also consumes |

No hidden writes inside reads. No automatic migration from diagnostics. No
component in this package reads diagnostics to decide learner-visible
behavior.

---

## 13. Requires human approval before implementation

**Structural approvals** are recorded as proposed Decisions in
`docs/Contrast-Domain-Architecture-Decisions.md`; that file is authoritative
for them, and this list is a pointer, not a second copy:

| Proposal | Covers | Sections here |
|---|---|---|
| **Decision 012** — evidence provenance | Provenance classes; unknown never evaluates as zero; witness requirement | §3.1, §3.3, D1 |
| **Decision 013** — reliability evaluates unresolved state | `residual-zero`; cumulative counters are not safety predicates; integrity stays absolute-zero | §3.2, §5.3, §6.3, D2 |
| **Decision 014** — advisory gate, three-valued output | `READY` / `BLOCKED` / `INSUFFICIENT_EVIDENCE`; no write capability; adjacent transitions only | §0, §7, D-none |

**Sequencing approval** is recorded in the Stabilization Plan's approval list
(items 12–15): WP-3.8A.1 as a separate package, the schema version bump,
`LanguageId` and per-language observation counts in diagnostic storage, and
persisting the diagnostic self-metrics.

**Design choices specific to this document**, not covered by either of the
above and requiring a decision here:

1. **The `legacyFallbackRatio` companion rule** (§6.2) — a declining-ratio
   requirement once WP-3.8C orchestration is live. This is the only
   non-zero-tolerance *blocking* rule proposed anywhere in the model, and the
   only place a rate can block. Recommendation: **adopt**, because a flat or
   rising fallback ratio while orchestration runs is the signature of
   silently-failing migration, and nothing else detects it.
2. **Device-distinctness as an operator assertion** (§8), with unattested
   merges counting as one device. Recommendation: **adopt** — the app is
   prohibited from carrying a device identifier, so de-duplication has to move
   to the human who knows the answer, and the conservative default makes
   double-counting impossible rather than merely discouraged.
3. **Placement completion (G6) as a declared blind spot** (§9) rather than an
   `unknown` evidence field, for this package only. Recommendation: **adopt** —
   an `unknown` field implies a producer could exist and someone should build
   it; a declared blind spot states correctly that this belongs to the
   pre-Phase-4 placement package.
4. **Threshold ownership** — who sets `MasteryRolloutTransitionThresholds` and
   who may change it. Extends open item 6 in the Stabilization Plan; unresolved
   here.
5. **Whether the deprecated boolean adapter is retained at all** (§7.6). It
   cannot represent `INSUFFICIENT_EVIDENCE`, which is the distinction this
   model exists to preserve. Recommendation: **retain temporarily** so existing
   tests stay green, with a `@deprecated` note and removal once no caller
   remains — but deleting it outright is a defensible alternative, since it has
   no production caller today (F4).

---

## Architectural invariants preserved

- The gate is advisory: it consumes evidence, evaluates evidence, and emits a
  recommendation. It cannot mutate feature flags or learner state, enforced by
  module boundaries and an import-graph test rather than by convention.
- Diagnostics remain operational metadata. They feed evidence assembly and
  nothing else; no learner-facing path reads them; diagnostic health degrades
  coverage and never blocks, so diagnostics never become load-bearing for
  correctness.
- Evidence and decisions are distinct artifacts: a `GateReport` names a
  recommendation and an `evidenceDigest`; a WP-3.8F artifact names a human and
  a transition. Neither can be derived from the other automatically.
- Unknown reduces confidence. `unknown` and unwitnessed zeros resolve to
  `insufficient-evidence`, and no default, coercion, or absence can produce
  `ready`.
- Legacy compatibility remains available and stable mastery remains the only
  future authority candidate. Nothing here retires, disables, or introduces a
  second authority — including a second gate evaluator.
- Rollout advancement remains a human release decision, one adjacent state at a
  time. The gate refuses non-adjacent transitions, and the on-device surface is
  structurally incapable of reporting readiness.
