# Phase 3.8B — Evaluation Architecture Review

Date: 2026-08-01
Branch: `docs/phase-3-migration-strategy`
Reviewed at: `c0f89bd` (implementation), against a design written at `ed6fd3b`
Status: **Architecture proposal. No code, tests, or configuration changed.**

Scope: WP-3.8B. This document reviews the existing design of record,
`docs/Phase-3.8B-Safety-Gate-Evidence-Model.md`, against the diagnostic
evidence layer that WP-3.8A.1 actually shipped, and proposes amendments. It
does not advance rollout, retire compatibility, or authorize either.

---

## 1. Executive summary

**The Phase 3.8B evaluation architecture already exists and is sound.** It is
specified in `docs/Phase-3.8B-Safety-Gate-Evidence-Model.md` and formalized as
proposed Decisions 012 (provenance), 013 (reliability evaluates unresolved
state), and 014 (advisory gate, three-valued output), all still
**Proposed — not accepted**. Writing a second evaluation model would itself be
the dual-authority mistake the Authority Boundary Invariant forbids, applied to
the design layer. This review therefore amends rather than replaces.

**The blocking condition has cleared.** That design was written at `ed6fd3b` and
declared itself blocked on WP-3.8A.1, because its six findings (D1–D6) were all
facts the producer layer never recorded. WP-3.8A.1 shipped at `c0f89bd` and
discharged essentially all of §5's producer obligations: directional divergence
kinds, per-operation storage failures, per-language observations, cold starts,
a reliability ledger, persisted diagnostic self-metrics, `firstSequence`, and a
producer manifest. D1–D6 are closed in code. §1.0's blockage is satisfied.

**One finding is blocking and new.** Proposed Decision 013 specifies the
reliability predicate as `residual = observed − recovered`. Against the ledger
WP-3.8A.1 actually built, that arithmetic is wrong in both directions, and one
of those directions reintroduces exactly the D2 failure the Decision was
written to eliminate. Detail in §4.2. **Decision 013 must be amended before it
is accepted**, and it is fortunate that it has not been.

**Three further conflicts** arise because the implementation recorded facts the
design did not model: `openConditionOverflow`, `rolloutStateObservations`, and
the producer manifest as a first-class evidence input. Each needs an
interpretation rule the design does not currently contain (§4.3–§4.5).

**Recommendation.** Amend the design in the four places named in §4, then seek
approval for 012 and 014 as written and 013 as amended. The evaluator itself
remains what §7 of the design already specifies: a small, explicit, pure
module. Nothing in this review adds a runtime authority path.

---

## 2. Current evidence capabilities

Verified by reading `src/storage/masteryRolloutDiagnosticStorage.ts`,
`src/analytics/masteryRolloutDiagnostics.ts`, `src/storage/masteryCompatibility.ts`,
and `scripts/masteryRolloutDiagnostics.test.js` at `c0f89bd`.

### 2.1 D1–D6 disposition

| Finding | Design fix (§5) | Implementation at `c0f89bd` | Status |
|---|---|---|---|
| D1 — absence indistinguishable from cleanliness | provenance + witnesses | `RUNTIME_EVIDENCE_FIELD_CATALOG` (33) vs `DIAGNOSTIC_PRODUCER_MANIFEST.producedFields` (29); manifest is capability-only, asserted not to imply exercise | **Closed at producer layer**; evaluator side is WP-3.8B |
| D2 — zero-tolerance on monotonic counters unsatisfiable | `residual-zero` | `openConditions` ledger + `reliabilityConditionsOpened` / `reliabilityConditionsRecovered` / `openConditionOverflow` | **Closed, but the predicate in Decision 013 does not match the ledger — see §4.2** |
| D3 — record-level loss classified as expected | split `missing-stable-record` | `stable-document-absent` / `stable-record-absent` split at `masteryCompatibility.ts:471-472`; only `stable-document-absent` excluded from `unexplainedDivergenceCount` (`:636`) | **Closed** |
| D4 — headline counter not persisted | cumulative counters | `shadowUnexplainedDivergences`, `divergencesByKind` | **Closed** |
| D5 — direction and operation erased | counter decomposition | `tier-disagreement-stable-higher` / `-lower`, `storageFailuresByOperation`, `stableReadsByStatus`, `compatibilityWritesByStatus`, `orphanAdoptionsByStatus`, `migrationOutcomes` | **Closed** |
| D6 — volume gates unmeasurable | per-language counts, cold starts | `languageObservations` keyed by `LanguageId`, `coldStarts`, `historicalIdentityResolutionObserved`, `languageId` on the event ring | **Closed** |

Also shipped beyond §5: `blockedComparisons` and comparison `status: 'blocked'`
when `malformedLegacyCount > 0` (`masteryCompatibility.ts:624-626`),
`storageOperationSuccessesByOperation` (a real witness source, not merely a
failure counter), `compatibilityWritesByProvenance`, `firstSequence`, and
`rolloutStateObservations`.

### 2.2 Provenance classes the producer layer can and cannot serve

The four catalogue fields absent from the manifest are exactly the four the
design assigned permanent non-runtime provenance: `lostMasteryRecords`,
`duplicatedMasteryRecords`, `crossLanguageCollisions`, and
`practiceBehaviorChanges`. The producer layer and the design agree, and
`masteryRolloutDiagnostics.test.js:677-679` fences the agreement. This is a
deliberate permanent assignment, not a gap awaiting a producer: measuring
mastery loss at runtime would require the diagnostic store to hold mastery
content, which the diagnostic-data-boundary invariant prohibits.

### 2.3 What remains unbuilt

No evaluator exists. `evaluateMasteryRolloutSafetyGate`
([masteryRolloutSafety.ts:30](../src/domain/masteryRolloutSafety.ts#L30)) is
still the 16-field `{passed, blockers}` function, still has no production
caller, and still must not be wired: given a struct built from the snapshot it
would read absent producers as `0` and report `passed: true`. The assembler,
the CLI, the on-device surface, and the attestation schemas are all unbuilt.

---

## 3. Proposed evaluator architecture

The design's §7.5 module layout is ratified unchanged. Restated with this
review's amendments folded in.

### 3.1 Where the evaluator lives

Three pure modules and one operator entry point. No new dependency.

| Module | Responsibility | May import | Must not import |
|---|---|---|---|
| `src/domain/masteryRolloutSafety.ts` | pure evaluation | types only | storage, `AsyncStorage`, `FEATURE_FLAGS` **value**, React |
| `src/domain/masteryRolloutEvidence.ts` *(new)* | pure assembly: snapshot + attestations → `GateEvidence` | diagnostic **types**, registry, alias table | any writer, any learner-state key, `AsyncStorage` |
| `scripts/report-rollout-readiness.js` *(new)* | operator CLI over exported files | node `fs`, the two above | anything that writes to a device |
| in-app `__DEV__` surface | render on-device report | the two above, `getDiagnosticSnapshot` | anything that writes rollout state |

The evaluator is a **function of already-read values**. All I/O is the caller's.
It performs no storage access, no clock read, and no randomness, which is what
makes `evidenceDigest` reproducible.

### 3.2 Inputs

`{ transition, currentState, evidence, coverage, thresholds }`, as the design's
§7.1 specifies, with two amendments from this review:

- `currentState` enters as data, typed by `import type` of
  `ContrastMasteryRolloutState`. A type-only import cannot become a control
  path because it does not exist at runtime.
- `evidence` gains a **rollout-state attribution** (§4.4) and a **manifest
  witness** (§4.5).

`thresholds` is passed in, never hardcoded, so a report always states what it
was evaluated against and a human can recalibrate a declared constant.

### 3.3 Outputs

One frozen `MasteryRolloutGateReport` (§5 below). No function-valued property,
no `advance`/`apply`/`nextState` member.

### 3.4 Dependencies it must not have

`FEATURE_FLAGS` as a value; any storage module; any module exporting a write
function; any learner-state key; React; the network; the clock. Enforced by an
import-graph test over the transitive closure, not by review discipline.

### 3.5 The question it answers

"What does this evidence support, for this one declared adjacent transition?"
It never answers "should rollout happen." The distinction is preserved
structurally by the output type, which can express a recommendation and cannot
express a command.

---

## 4. Evidence interpretation rules

§3.1 (provenance), §3.3 (witnesses), §4 (comparison model), §7.4 (anti-
laundering), and §8 (merge) of the design are ratified as written. Five
amendments follow.

### 4.1 Provenance precedence (ratified, restated)

Four classes: `runtime-measured`, `harness-attested`, `manually-attested`,
`unknown`. Provenance is not flattened; it is carried on every value.

Precedence is **not** a ranking — no class outranks another. The rules are:

1. **Eligibility.** A field declares which classes may satisfy it. A harness
   attestation cannot satisfy `shadowComparisons`, `renamedLanguagesExercised`,
   `coldStartsObserved`, or any rollback field. Synthetic evidence cannot
   satisfy a real-install gate.
2. **Conflict takes the worse and blocks.** If two eligible classes disagree,
   the report records both, adopts the worse, and raises `evidence-conflict`.
   Disagreement is itself a blocker, because one of the two producers is wrong
   and the evaluator cannot know which.
3. **Freshness.** A harness attestation whose commit SHA is not an ancestor of
   the build under evaluation is `attestation-stale` → `unknown`.
4. **`unknown` is absorbing.** It is never coerced to `0`, never defaulted,
   never satisfied by absence.

### 4.2 Reliability residual — **amends proposed Decision 013 (blocking)**

Decision 013 states the predicate as:

```
residual = observed − recovered
blocked  ⟺  residual > 0
```

Against the implemented ledger this is unsafe in both directions.

**Direction 1 — it blocks a fully converged system.**
`reliabilityConditionsOpened` is incremented on *every* opening event, outside
the de-duplication guard that protects the ledger
([masteryRolloutDiagnosticStorage.ts:1274-1280](../src/storage/masteryRolloutDiagnosticStorage.ts#L1274-L1280)).
`reliabilityConditionsRecovered` increments only on an actual ledger removal.
The counters therefore measure different things: opened counts *events*,
recovered counts *distinct conditions*.

The repository's own test asserts the divergence: two identical
`storage-failure` events for `japanese/write-stable` yield
`openConditions.length === 1` but `reliabilityConditionsOpened === 2`
([masteryRolloutDiagnostics.test.js:801-804](../scripts/masteryRolloutDiagnostics.test.js#L801-L804)).
One subsequent success closes the single condition: ledger residual `0`,
arithmetic residual `2 − 1 = 1`. Decision 013 would report **blocked** on a
system that has fully converged — a permanent, unclearable block from a
transient repeated failure. That is D2, reintroduced through the arithmetic
that was meant to cure it.

**Direction 2 — it misreads overflow.** When the ledger is at
`MAX_OPEN_RELIABILITY_CONDITIONS` (64), the opening event increments
`reliabilityConditionsOpened` and `openConditionOverflow` but is *not* admitted
to the ledger. A condition never admitted can never be recovered. The ledger
then understates the true residual **silently and in the safe-looking
direction**, which is the precise failure mode the design's §1.0 exists to
prevent.

**Proposed amendment.** Replace the predicate with:

```
residual(kind) = count of openConditions with that kind        [the ledger]
blocked  ⟺  residual > 0
unknown  ⟸  openConditionOverflow > 0                          [absorbing]
```

- **The ledger is the predicate.** `openConditions` is the only authoritative
  statement of what is currently unresolved. It is identity-keyed
  (`kind`+`languageId`+`operation`), de-duplicated, and closed only by
  same-identity success evidence.
- **`reliabilityConditionsOpened` / `Recovered` are human context, never a
  predicate.** They answer "how often did this happen," which a human should
  weigh, and they cannot answer "what is unresolved now." This preserves
  Decision 013's actual intent — evaluate unresolved state, not historical
  occurrence — and generalizes its own rule that cumulative counters are not
  safety predicates to these two counters as well.
- **Overflow forces `unknown`, not `blocked` and not `satisfied`.**
  `openConditionOverflow > 0` means the ledger is a lower bound of unknown
  slack, so every reliability residual in that window resolves to
  `unknown / evidence-truncated`. This mirrors the design's existing and
  correct treatment of dropped diagnostics (§3.4 correction).

Decision 013's worked example survives the amendment intact, including the
load-bearing third row (`0 / 0` is *not* healthy — witness unmet). Only the
mechanism changes: read the ledger, do not subtract counters. This is a
narrowing amendment; it cannot make any gate easier to satisfy.

### 4.3 Coverage degradation is asymmetric (ratified, extended)

The design's 2026-08-01 correction is correct and now has a second instance.
A cumulative counter under a lossy pipeline is a **lower bound**, so loss has an
exact asymmetric effect: a reading `> 0` remains trustworthy and still blocks; a
reading of `0` may be understated and is therefore `unknown`.

Three truncation sources now exist, and all three carry the same rule:

| Source | Effect on zeros in that window |
|---|---|
| `diagnosticEventsDropped > 0` | every runtime-measured zero → `unknown` |
| `diagnosticDeliveryFailures > 0` | every runtime-measured zero → `unknown` |
| `openConditionOverflow > 0` **(new)** | every reliability residual → `unknown` |

None of the three ever blocks. Making diagnostic health a blocker would make
diagnostics load-bearing for correctness, which invariant 1 forbids. They make
the gate say "I do not know," never "something is wrong."

### 4.4 Rollout-state attribution — **new rule**

WP-3.8A.1 persists `rolloutStateObservations: Record<ContrastMasteryRolloutState, number>`
and stamps `rolloutState` on every persisted event. The design does not model
this, and it matters.

Evidence is only evidence *of the state under which it was observed*. A
snapshot accumulated while rollout was `disabled` says nothing about `shadow`
behavior; shadow comparisons did not run. Without a rule, an operator could
merge a long `disabled` window with a short `shadow` window and satisfy a
volume gate with observations that never exercised the code under evaluation.
That is witness evasion at the window level rather than the field level.

**Proposed rule.** For transition `A -> B`, runtime-measured evidence is
admissible only from observations recorded while rollout state was `A`.

- The assembler partitions snapshot evidence by observed rollout state and
  discards non-`A` observations rather than summing them.
- If `rolloutStateObservations[A] === 0`, every runtime-measured field is
  `unknown / producer-not-exercised` — the window never ran in the state being
  evaluated.
- If the window spans multiple states, the report names them. Mixed windows
  degrade coverage; they never silently merge.

The cumulative scalar metrics are not partitionable by state, since they are
totals. Where a total cannot be attributed to state `A`, it is context for a
human, not a predicate — the same disposition as `reliabilityConditionsOpened`.
This is a real limitation and belongs in the declared blind spots.

### 4.5 The producer manifest is an evidence input — **new rule**

`DIAGNOSTIC_PRODUCER_MANIFEST` declares which fields this *build* can produce.
It is a capability claim and explicitly not an exercise claim, a distinction the
producer tests already fence.

**Proposed rule.** The manifest is a first-class assembler input and gates
provenance eligibility:

- A field absent from `producedFields` can never carry `runtime-measured`
  provenance. Absent an eligible attestation it is `unknown / no-producer`.
  This makes D1 unforgeable at the type level rather than by convention.
- Manifest presence establishes only *capability*. A witness is still required
  to establish *exercise*. Manifest ∧ witness ⇒ a zero is evidence; either
  alone ⇒ `unknown`.
- If `manifestVersion` or `producedFields` differs across merged snapshots, the
  merge spans builds with different capabilities. Take the intersection and
  degrade coverage; never the union.

---

## 5. Output contract

The design's §7.2 is ratified. `passed: true/false` is rejected: it cannot
distinguish "we looked and it is clean" from "we did not look," which is the
distinction this entire model exists to preserve.

```ts
export type MasteryRolloutRecommendation =
  | 'ready'
  | 'blocked'
  | 'insufficient-evidence';
```

Three members, none an action. The report is frozen, carries no function-valued
property, and includes: ranked `blockers`, `gaps` (unknown fields and unmet
witnesses, each with its `EvidenceUnknownReason`), `unmetVolumeGates`, every
`EvaluatedField` whether satisfied or not, `coverage`, the `thresholds` used,
a stable `evidenceDigest` over the canonicalized input, and `generatedFrom`.

**Additions proposed by this review**, all reporting-only:

- `observedRolloutStates` — which states the window covered (§4.4).
- `evidenceTruncated` — the three §4.3 sources, so a human can see *why* fields
  went unknown rather than only *that* they did.
- `manifestVersion` of the merged evidence (§4.5).

Decision procedure, amended at steps 2 and 3:

```
1. Non-adjacent or backward transition → 'blocked', 'non-adjacent-transition'.
2. Force to unknown:
     snapshotIntegrity 'unavailable'      → all runtime-measured fields
     events dropped / delivery failures   → all runtime-measured zeros
     openConditionOverflow > 0            → all reliability residuals   [4.2]
     rolloutStateObservations[from] === 0 → all runtime-measured fields [4.4]
     field not in producer manifest       → that field                  [4.5]
3. Per field: unknown → gap; witness unmet → gap; provenance conflict →
   blocker; else evaluate per declared mode
     absolute-zero → value !== 0                 → blocker
     residual-zero → ledger residual > 0         → blocker              [4.2]
     threshold     → value < bound               → unmet volume gate
     interpretive  → record; companion rule only
4. any blocker                                   → 'blocked'
   else any gap, unmet gate, degraded coverage,
        or generatedFrom === 'on-device'         → 'insufficient-evidence'
   else                                          → 'ready'
```

`blocked` outranks `insufficient-evidence` because a known violation is
actionable now. Both are non-advancing, so the safety property holds under
either ordering.

---

## 6. Safety categories

Four categories with four evaluation modes. The modes are a fixed
classification of *this domain's* fields — explicitly not a rule engine,
predicate registry, DSL, configurable policy loader, or reusable framework.
Adding a field is a code change and a review, which is the point.

### 6.1 Integrity — `absolute-zero`, zero tolerance

Lost mastery, duplicated records, unexplained divergence, `stable-record-absent`,
`legacy-record-absent`, directional tier disagreements, reset and placement
disagreements, alias regressions, unresolved mappings, malformed stable
fallbacks, blocked comparisons.

Any occurrence, ever, blocks. No convergence, no forgiveness. The justification
is uniform and is the reason the category is drawn this way: **none of these
conditions has a recovery path that restores the lost information.** A
recovered storage failure has genuinely been recovered from; a lost mastery
record has not.

A comparison that could not run is never a clean comparison —
`malformedLegacyCount > 0` yields `status: 'blocked'` and counts.

### 6.2 Reliability — `residual-zero` over the ledger

Unhandled stable, legacy, and migration-state storage failures; unhandled
partial writes; orphan-adoption residue; migration failures.

The architecture's documented answer to a partial write is retry and converge
(`retryRequired`), so the honest question is convergence, not occurrence.
Evaluated per §4.2: **read the ledger, never subtract the counters**, and treat
`openConditionOverflow > 0` as `unknown`. Occurrence counts stay in the report
for human reading — a converged-but-frequent failure pattern is a signal a
human should weigh even though it does not block.

Convergence never nets across identities. A converged condition on language A
plus an open one on language B blocks.

### 6.3 Coverage — `threshold`, insufficient ⇒ `insufficient-evidence`

`shadowComparisons`, `languagesExercised`, `renamedLanguagesExercised`,
`coldStartsObserved`, install-weeks, drill counts, consecutive clean releases.

Insufficient coverage never produces `blocked` and never produces `ready`; it
produces `insufficient-evidence`, because "we did not look hard enough" is a
scheduling problem, not a defect. The gate never invents a threshold: a
`threshold`-mode field with no declared bound for the transition yields an unmet
volume gate, not a pass. Thresholds ship as a frozen declared record and are
echoed in every report.

Coverage is reported separately from satisfaction throughout, because "nothing
is wrong" and "we looked hard enough" are different claims.

### 6.4 Interpretive — never blocks alone

`legacyFallbackRatio`, `storageFailureRate`, and the diagnostic self-metrics.

These must not become blocking predicates because **their safe value is not
zero and is not yet known.** Falling back to legacy on a missing stable
document is correct, expected behavior, and before WP-3.8C ships it is the
dominant path for every unmigrated language. Assigning a threshold today would
be the gate inventing a fact the system has not observed — the mechanism by
which an evaluator acquires an opinion of its own and becomes a second
authority.

Ratios are recomputed from summed numerators and denominators, never averaged
across devices.

The one proposed exception remains the design's `legacyFallbackRatio` companion
rule: once WP-3.8C orchestration is live, a flat or rising ratio is the
signature of silently failing migration, and blocks. That rule is inert until
WP-3.8C exists and requires explicit approval (§9).

---

## 7. Failure handling model

Every row resolves to a non-advancing outcome. There is no row whose safe
outcome is `ready`.

| Failure mode | Detection | Safe outcome |
|---|---|---|
| Missing producer | field absent from `DIAGNOSTIC_PRODUCER_MANIFEST` (§4.5) | `unknown / no-producer` → `insufficient-evidence` |
| Producer present, never exercised | witness counter is `0` or unknown | `unknown / producer-not-exercised` → `insufficient-evidence` |
| Dropped diagnostics | persisted `diagnosticEventsDropped` / `diagnosticDeliveryFailures` | zeros → `unknown`; non-zeros still block; never blocks on loss itself |
| Ledger overflow | `openConditionOverflow > 0` | reliability residuals → `unknown` (§4.2) |
| Stale snapshot | `firstSequence` / `sequence` discontinuity; schema version | `degraded` or `unavailable`; `unavailable` forces all runtime fields unknown |
| Wrong-state window | `rolloutStateObservations[from] === 0` (§4.4) | all runtime fields `unknown` |
| Incomplete export | fewer snapshots than attested devices; distinctness unattested | merge counts as one device for every volume gate |
| Conflicting evidence | two eligible provenance classes disagree | `evidence-conflict` blocker; adopt the worse |
| Stale attestation | commit SHA not an ancestor of build | `attestation-stale` → `unknown` |
| Mixed-build merge | `manifestVersion` / `producedFields` differ | intersect capabilities; degrade coverage |
| Evaluator bug | determinism + digest tests; every-field table-driven tests; the default-deny test in §8 | a new field with no producer fails the suite by default rather than passing |
| Human misinterpretation | `evidenceDigest` cited in the WP-3.8F artifact; explicit rationale required to advance with any `unknown` | the decision is reconstructible and auditable after the fact |
| On-device over-reading | `generatedFrom: 'on-device'` | structurally cannot render `ready` |

The load-bearing property across the table: **every degradation path leads to
`unknown` or `blocked`, never to `satisfied`.** Absence of evidence is never
converted to evidence of absence.

---

## 8. Testing strategy

Tests protect architectural behavior, not implementation detail. They follow
the existing `scripts/*.test.js` `runTest` + `node:assert` style.

**Advisory-only (structural).** Import-graph test: the two domain modules
transitively import no writer, no `AsyncStorage`, and no `FEATURE_FLAGS` value.
Type-level test: no report property is a function; the recommendation union has
exactly three members. Behavioral test: evaluating any transition on any
evidence leaves `FEATURE_FLAGS.contrastMasteryRollout` unchanged and performs
zero storage calls.

**Unknown and provenance (default-deny).** Table-driven over the **full field
catalogue**, so a field added later without a producer fails by default:
every field `unknown` → `insufficient-evidence`; every field `0` with unmet
witness → `insufficient-evidence`; **every field `0` and every witness unmet →
`insufficient-evidence`**, which is the exact scenario today's gate reports as
`passed: true`. Plus: harness attestation cannot satisfy a real-install field; a
stale SHA yields `unknown`; two eligible classes disagreeing yields
`evidence-conflict`.

**Integrity.** Each `absolute-zero` field blocks at value `1`. No coverage
level, threshold, or attestation can clear an integrity blocker.

**Recovered reliability (§4.2 — the amended rule).** These are the tests that
would have caught the Decision 013 defect:

- One partial write, then a `complete` write for the same `LanguageId` → ledger
  residual `0`, does not block, **even though `reliabilityConditionsOpened` is
  non-zero**.
- *Two identical* failure events then one success → does not block. This is the
  direct regression test for the counter/ledger divergence; the arithmetic
  predicate fails it.
- One partial write, no subsequent success → blocks.
- Converged on language A, open on language B → blocks; convergence does not net.
- `openConditionOverflow > 0` → reliability residuals `unknown`, recommendation
  `insufficient-evidence`, **not** `ready` and **not** `blocked`.

**Coverage.** Below-threshold volume → `insufficient-evidence`, never `blocked`.
A `threshold` field with no declared bound → unmet gate, not a pass. Two
snapshots without attested distinctness count as one device. Ratios recomputed
from summed components, not averaged.

**Rollout-state attribution (§4.4).** Evidence observed wholly under `disabled`
cannot satisfy any `shadow -> internal-test` runtime field. A mixed-state window
degrades coverage and names the states observed.

**Determinism.** The same input yields a byte-identical report and an identical
`evidenceDigest` across runs and across key insertion orders. No clock, no
randomness, no I/O.

**Transition scoping.** `disabled -> limited` rejected as non-adjacent; backward
transitions rejected; thresholds read from input and echoed.

**On-device surface.** `generatedFrom: 'on-device'` never returns `ready` even
with every visible field satisfied; the surface exposes no control that writes
rollout state.

**Non-regression.** The WP-3.8A/3.8A.1 isolation suite passes unchanged — a
throwing or slow diagnostic sink still cannot fail or delay any learner
operation. `masteryRollout.test.js`'s existing gate assertions pass unchanged
against the deprecated adapter.

---

## 9. Open questions

Requiring a human decision before implementation.

1. **Decision 013's predicate (§4.2) — blocking.** Amend to read the ledger and
   treat overflow as `unknown`? Recommendation: **adopt**; the counter
   arithmetic reintroduces D2 and the repo's own tests demonstrate it.
2. **Rollout-state attribution (§4.4) — new.** Restrict runtime evidence to
   observations recorded under the `from` state? Recommendation: **adopt**;
   without it a volume gate can be satisfied by a window that never exercised
   the code under evaluation.
3. **Manifest as eligibility gate (§4.5) — new.** Recommendation: **adopt**; it
   converts D1 from convention into a type constraint.
4. **Unattributable cumulative scalars (§4.4).** Totals that cannot be
   partitioned by rollout state are context, not predicates. Should this be a
   declared blind spot, or should the producer layer partition them? The latter
   is WP-3.8A.1 scope re-opened and is **not** recommended without strong cause.
5. **`legacyFallbackRatio` companion rule** — the only proposed blocking rule
   over a rate, inert until WP-3.8C. Recommendation: **adopt**, since nothing
   else detects silently failing migration.
6. **Threshold ownership** — who sets `MasteryRolloutTransitionThresholds` and
   who may change it. Unresolved; extends open item 6 in the Stabilization Plan.
7. **Fate of the boolean adapter.** It cannot express `insufficient-evidence`.
   Recommendation: retain temporarily with `@deprecated`, remove once no caller
   remains; outright deletion is defensible, as it has no production caller.
8. **Storage key vs schema version.** The key is
   `@diagnostics_masteryRollout_v1` while `MASTERY_ROLLOUT_DIAGNOSTIC_SCHEMA_VERSION`
   is `2`. Harmless today — the strict validator classifies a v1 payload as
   malformed and replaces it in memory — but the mismatch will mislead a future
   reader. Cosmetic; note it, do not churn storage for it.

---

## 10. Explicit non-goals

This package does not and must not: advance rollout state; enable or modify any
feature flag; trigger, schedule, or orchestrate migration; retire any
compatibility component; wire WP-3.8C; touch `@pairProgress_v2` or placement
completion; add any learner-visible surface or behavior; add remote telemetry, a
device identifier, a user identifier, or any new dependency; make any runtime
decision.

It also must not: build a generic rule engine, predicate registry, DSL,
configurable policy loader, or reusable safety-gate framework; express evidence
rules as data outside the codebase; merge evaluator and producer
responsibilities; introduce a second evaluator alongside the existing one; or
modify diagnostic storage. **If WP-3.8B implementation finds itself editing
`masteryRolloutDiagnosticStorage.ts`, the scope boundary has been crossed** —
that is WP-3.8A.1's layer, and it is complete.

Phase 3.8C migration orchestration remains entirely separate and unstarted.

---

## 11. Verification

Checked against the invariants this review was required to preserve.

| Requirement | Verification |
|---|---|
| No runtime authority path introduced | The evaluator is a pure function of already-read values with no production caller. Every §4 amendment is an interpretation rule, and each strictly narrows what can be concluded. `currentState` enters via `import type`, which does not exist at runtime. |
| Evaluator remains advisory | Output is a frozen record whose recommendation enum has three members, none an action, and no function-valued property. It cannot express a command. |
| Human rollout control remains external | Advancement is a human editing `CONTRAST_MASTERY_ROLLOUT_STATE` and shipping a release. No code path leads from a report to that constant. The on-device surface structurally cannot render `ready`, so the human step is architecturally necessary rather than merely policy. |
| Phase 3.8C remains separate | No orchestration, scheduling, or migration trigger appears anywhere. The `legacyFallbackRatio` companion rule is inert until 3.8C independently exists. |
| Unknown evidence never treated as safe | `unknown` is absorbing. §7's table has no row whose safe outcome is `ready`. The three truncation sources in §4.3 convert zeros to `unknown`, never to satisfied. The default-deny test in §8 fails the suite for any field added without a producer. |
| Diagnostics never become runtime control input | Unchanged: no learner-facing, migration, rollout, or flag module imports diagnostic storage. The evaluator reads diagnostic **types** only; snapshots reach it as caller-supplied data. Diagnostic health degrades coverage and never blocks, so diagnostics never become load-bearing for correctness. |
| Evaluators cannot write anything | Zero I/O by construction, enforced by an import-graph test over the transitive closure rather than by review discipline. |

**Net effect of every amendment in §4 is to narrow.** Each converts a reading
that would previously have been treated as satisfied into `unknown`, or a
predicate that could block spuriously into one that blocks correctly. No
amendment makes any gate easier to satisfy.
