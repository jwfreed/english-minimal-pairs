# Phase 3.8A.1 — Diagnostic Evidence Completeness

Date: 2026-08-01
Revised: 2026-08-01 — architecture review clarifications incorporated (§14.1)
Branch: `docs/phase-3-migration-strategy` (repository inspected at `ed6fd3b`)
Status: **Approved in direction as the prerequisite package before WP-3.8B.
Implementation not started.**

Architecture review approved: producer-only runtime provenance, the producer
manifest, the evidence ledger in place of cumulative arithmetic, event-drop
invalidating zero claims, explicit success/convergence events, no diagnostic
v1→v2 migration, and rollback validation as external release evidence.

Implementation additionally awaits resolution of proposed Decisions 012, 013,
and 014, which remain **proposals** — all three change what this package must
record. No code, tests, or configuration were changed to produce or revise this
document.

Scope: WP-3.8A.1 in `docs/Phase-3.8-Stabilization-Plan.md`. Prerequisite to
WP-3.8B. Governed by Decision 011 and by the three hardening invariants, the
Authority Boundary Invariant, the Ownership Boundaries, and the Diagnostic
Reliability Contract in that plan.

Depends on human resolution of proposed Decisions 012, 013, and 014
(`docs/Contrast-Domain-Architecture-Decisions.md`). Those decisions are
referenced here but not restated, extended, or implied to be accepted. If any
is amended on approval, this proposal is revised to match before
implementation begins.

**This package builds no gate.** It records facts. Nothing in it compares a
value to a threshold, derives a boolean from a measurement, or produces a
recommendation.

---

## 1. Implementation proposal

### 1.1 Objective

Make the diagnostic evidence model capable of honestly supporting a safety gate
— which means capable of stating what it did **not** observe, not merely
reporting what it did.

The Phase 3.8B design review found six ways the current producer erases facts
before they reach storage. Every one is a fact the diagnostic layer never
recorded, and none is recoverable by evaluating harder:

| Erased fact | Current state | Consequence for a gate |
|---|---|---|
| Which conditions have a producer at all | Implicit; nine gate fields have none | A `0` from a field nobody measures reads as clean |
| Whether a failure recovered | Only failures counted, never recoveries | Unresolved state unmeasurable; one transient failure blocks forever |
| Which direction a tier moved | `shadowDivergences` is an undirected total | Mastery increase and decrease indistinguishable |
| Which side a storage failure hit | `storageFailures` is one scalar | Stable-side and legacy-side reliability indistinguishable |
| Which language an event concerned | No `LanguageId` on any persisted event | Language coverage and rename scenarios unmeasurable |
| Whether evidence spans one regime | No rollout-state attribution, no cold-start count | Restart and regime coverage unmeasurable |

3.8A.1 closes all six **in the producer**, and adds one thing the current model
has no representation for at all: a statement of its own coverage.

### 1.2 What this package is not

It does not: advance or change rollout state, or add any code path that could;
activate, wire, schedule, or trigger migration or orphan adoption; change any
learner-visible behavior; change runtime mastery authority; evaluate evidence,
define a threshold, or produce a recommendation; add remote telemetry, a new
dependency, or a learner-facing surface; introduce a device or user identifier;
or add any timestamp.

`readCompatibleMastery` and `writeCompatibleMastery` gain **no new write
paths**, no migration trigger, and no decision logic. Their diagnostic emissions
become richer; their control flow does not change.

### 1.3 Boundary correction — what "provenance" means for a producer

The task asks this package to define how each evidence field records whether it
is runtime-measured, harness-attested, manually-attested, or unknown. Taken
literally, that would put harness and manual attestations inside diagnostic
storage. **That must not happen**, and the reason is the Authority Boundary
Invariant: a diagnostic store that ingests attestations from other sources is
no longer an observer, it is an evidence aggregator — a component that holds an
opinion about the overall state of the migration. That is the second-authority
pattern in a new place.

The honest division:

| Provenance class | Who records it | Where it lives |
|---|---|---|
| `runtime-measured` | **This package.** The diagnostic layer observes and counts. | Diagnostic storage |
| `harness-attested` | A harness run, identified by commit | An attestation artifact, outside the app |
| `manually-attested` | A human, via the WP-3.8E runbook | An attestation artifact, outside the app |
| `unknown` | Nobody — it is the *absence* of the other three | Assigned at evidence assembly (WP-3.8B) |

So this package's contribution to provenance is twofold, and neither involves
storing another source's evidence:

1. **Make `runtime-measured` honest** — every field the diagnostic layer claims
   to measure has a real cumulative producer and a real witness (§2, §3).
2. **Make the absence of a producer detectable** — via the Producer Manifest
   (§1.4), so `unknown` is assigned by construction rather than by a
   hand-maintained list in the gate that can silently drift out of date.

The unknown-is-never-zero invariant (Decision 012) is *enforced* at the gate.
This package's job is to make it *knowable* — a gate cannot mark a field unknown
if it has no way to tell that nothing produced it.

### 1.4 The Producer Manifest

The snapshot declares which evidence fields the build that wrote it was capable
of producing:

```ts
export interface DiagnosticProducerManifest {
  readonly manifestVersion: number;
  /** Evidence fields this build's diagnostic layer produces. Sorted, frozen. */
  readonly producedFields: readonly RuntimeEvidenceFieldName[];
}
```

It is a static constant compiled into the build and serialized into every
snapshot write. It is not computed, not accumulated, and not affected by what
actually happened on the device.

Why this exists:

- **Snapshots outlive builds.** An exported snapshot may be read months later,
  by a gate compiled from different source. Without a manifest, the reader must
  assume the writer produced whatever the reader expects — which is exactly the
  false-confidence failure, one layer up.
- **It makes field drift a test failure.** A field added to the WP-3.8B evidence
  catalogue as runtime-measured, with no producer, fails a cross-check test
  (§6.6) instead of silently reading `0`.
- **It degrades correctly.** A build that stops producing a field ships a
  smaller manifest; snapshots from that build honestly declare less.

The manifest is a declaration, not an evaluation. It says "I can measure X," never "X is safe."

### 1.5 Evidence lifecycle and stage ownership

Evidence moves through five stages. Each stage is owned by exactly one layer,
and each transition is a trust boundary: evidence crosses from a layer that can
observe into a layer that can only read what the previous one wrote.

```
   PRODUCED  ──►  PERSISTED  ──►  EXPORTED  ──►  EVALUATED  ──►  ARCHIVED
      │              │               │               │               │
   producer      diagnostic       operator        evidence         release
                  storage                         evaluator        process
```

| Stage | Owner | Does | Must not do |
|---|---|---|---|
| **Produced** | Diagnostic producer (this package) | Observes a learner-state operation and emits a categorized outcome | Interpret safety; compare to a threshold; decide anything |
| **Persisted** | Diagnostic storage (this package) | Durably records evidence, preserves provenance and the producer manifest, bounds retention | Make a decision; be read by any learner-facing path; ingest evidence it did not observe |
| **Exported** | Operator, via the `__DEV__` surface | Copies a snapshot off the device; labels it with a collection window and device distinctness | Transform, filter, or edit the snapshot; add a claim the device did not record |
| **Evaluated** | Evidence evaluator (WP-3.8B) | Assembles snapshot + attestations, applies provenance and witness rules, returns `READY` / `BLOCKED` / `INSUFFICIENT_EVIDENCE` | Write anything; produce the evidence it also consumes; infer a fact no producer recorded |
| **Archived** | Human release process (WP-3.8F) | Records the decision artifact citing the evidence digest, transition, thresholds, and approver | Retroactively edit archived evidence; re-derive a past decision from present data |

Three properties make this a boundary rather than a diagram:

**The lifecycle is one-directional.** There is no arrow back. Evidence never
flows from Evaluated to Produced, because that arrow is a feedback loop, and a
feedback loop from an evaluator into a producer is control. This is the
structural form of the invariant in §1.6.

**No stage may be skipped or merged.** A producer that also evaluates is a gate
with private inputs. An evaluator that also produces is a gate that can
manufacture its own justification. An archive written by anything other than a
human is an automated approval. Each collapse is a different way of building the
same failure.

**Archived evidence is immutable.** A decision artifact cites an evidence
digest, so a later reader can prove what a human actually approved. Re-running
an evaluation against newer evidence produces a *new* report, never a revision
of the archived one.

#### The exported evidence trust boundary

> **Exported evidence snapshots are immutable review artifacts and are
> evaluated outside the runtime authority boundary.**

Export is the point where evidence stops being operational state and becomes a
review artifact. The boundary runs between stages 2 and 3:

| | Inside the runtime authority boundary | Outside it |
|---|---|---|
| Stages | Produced, Persisted | Exported, Evaluated, Archived |
| Artifact | Live diagnostic state on a device | An immutable snapshot |
| Who acts | The application | Tooling and humans |

- **Runtime produces evidence.** It observes operations and records outcomes.
- **Export creates a review artifact.** A snapshot, once exported, is fixed. It
  is copied, not transformed — export does not filter, normalize, summarize, or
  add a claim the device did not record. Two exports of the same device state
  are identical.
- **Evaluation interprets evidence.** It reads the artifact, applies provenance
  and witness rules, and returns a recommendation. It never writes back.
- **Humans make rollout decisions.** The recommendation is an input to that
  decision, never a substitute for it.

**Exported evidence must not:** become learner-state input; trigger migration;
mutate rollout state; or modify feature flags.

This holds regardless of how the artifact travels or what reads it. An exported
snapshot has no return path into the application — there is no import step, no
reconciliation, and no mechanism by which an evaluated result reaches the
device it came from. That absence is the guarantee: evidence crossing the export
boundary becomes something a human reasons about, and stops being something the
system can act on.

**Why this matters:** authority accumulates quietly. It rarely arrives as a
component announcing that it now decides things — it arrives as a producer that
"just" filters obviously-irrelevant events, or an evaluator that "just" caches
its last result, or an export step that "just" normalizes a field. Each is
locally reasonable and each moves a decision one layer away from the human who
owns it. Naming the owner of every stage means a change that relocates
responsibility has to argue with a written boundary instead of slipping past an
unstated one.

### 1.6 Evidence Consumption Invariant

> **Safety evidence is not runtime control input.**

No runtime component may consume safety evidence — diagnostic counters, the
snapshot, the open-condition ledger, the producer manifest, or any gate
report — in order to:

- change learner behavior
- modify mastery authority
- trigger, schedule, or influence migration
- advance or alter rollout state
- enable, disable, or derive a feature flag
- repair, reconstruct, or alter learner state

**Runtime may produce evidence only.** Rollout remains human-controlled,
unchanged by this package and by anything it enables.

**The one permitted read, stated precisely.** The diagnostic layer reads its own
storage — it must, in order to append to a snapshot and to close a ledger entry
(§2.6). That is bookkeeping within a single layer, not consumption. The
invariant prohibits *cross-layer* consumption and *decision* consumption. Stated
exactly:

- The diagnostic layer may read diagnostic storage to maintain diagnostic
  records. Nothing it reads may influence a learner-visible outcome, an
  authority decision, or a migration decision.
- No other layer may read diagnostic storage at runtime at all. The evidence
  evaluator reads an *exported* snapshot, off-device, at stage 4.

#### The diagnostic storage import boundary

> **Learner-facing runtime modules, migration modules, and rollout-control
> modules must not import diagnostic storage.**

**Allowed:**

- **Diagnostic infrastructure maintaining its own evidence lifecycle** —
  appending to a snapshot, opening and closing ledger entries, reading its own
  prior state in order to write the next one.
- **External tooling and review workflows accessing exported evidence** — the
  operator CLI, the evidence evaluator, and review scripts, all of which read a
  snapshot that has already left the device.

**Forbidden:**

- **Learner behavior depending on diagnostics** — no mastery read, write,
  reset, placement, scheduling, or rendering decision may consult evidence.
- **Migration decisions depending on diagnostic storage** — whether to migrate,
  what to migrate, whether a migration already ran, or whether to retry must
  never be answered from diagnostic state. Migration state has its own
  authoritative record in the migration marker.
- **Rollout control consuming diagnostics directly at runtime** — no runtime
  path may read evidence to derive, gate, or influence rollout state or a
  feature flag.

**This rule protects an authority boundary; it is not a permanent file-count
constraint.** The number of modules importing diagnostic storage may legitimately
change — an inspection surface, a second producer, or an export helper could all
be added without weakening anything. What must not change is *which kinds* of
module import it. A test that pins an exact importer count would fail on
harmless additions and pass on a harmful one that merely replaced an existing
importer, so the test asserts module *class*, not cardinality (§10.8).

**Relationship to existing invariants.** This does not replace the plan's
Authority Boundary Invariant; it is that invariant applied to the specific
artifact this package creates. Phase 3.8A established that diagnostics cannot
*affect* learner state. This establishes the converse direction that becomes
possible once evidence is rich enough to be worth acting on: that nothing may
*act on* it inside the running application. A more useful evidence store is a
more tempting one to consult, and this invariant is written now, before the
temptation exists.

---

## 2. Reliability evidence — observed, recovered, unresolved

Per proposed Decision 013. The producer obligation is to record recovery, which
it currently does not do at all.

### 2.1 Why a ledger, not counter arithmetic

The obvious implementation is two counters per condition and
`unresolved = observed − recovered`. **Rejected.** Diagnostic events can be
dropped when the write backlog is full — that is deliberate, documented WP-3.8A
behavior. Under drops, a subtraction fails in the unsafe direction (a dropped
failure event understates `observed`, so residual reads lower than reality) and
can produce nonsense (negative residual under interleaving). It also cannot
express *which* identity is unresolved, so it cannot honor the
never-net-across-identities rule in Decision 013.

Instead, unresolved state is a **ledger of currently-open conditions** — a
state, not a difference:

```ts
export type ReliabilityConditionKind =
  | 'partial-write'
  | 'storage-failure'
  | 'migration-failure'
  | 'orphan-adoption-residue';

export interface OpenReliabilityCondition {
  readonly kind: ReliabilityConditionKind;
  readonly languageId: LanguageId;
  /** Present only for 'storage-failure'. */
  readonly operation?: MasteryRolloutStorageFailureOperation;
  readonly openedAtSequence: number;
}
```

- **observed** — cumulative `...Opened` counter, monotonic. Reported as context.
- **recovered** — cumulative `...Recovered` counter, monotonic. Reported as context.
- **unresolved** — `openConditions` filtered by kind. **This is the safety input.**

The ledger fails in the safe direction under drops: a dropped recovery event
leaves an entry open, which blocks. A dropped failure event means the entry was
never opened, which does not block — and that case is caught by §2.4.

### 2.2 Identity and lifecycle

Ledger key: `(kind, languageId, operation?)`. Re-failing an already-open
condition increments `observed` and does **not** add a second entry — the
condition is already unresolved and cannot become more unresolved.

| Kind | Opened by | Closed by |
|---|---|---|
| `partial-write` | `compatibility-write` with `status: 'partial'` | `compatibility-write` with `status: 'complete'`, same language |
| `storage-failure` | `storage-failure` event, per operation | a recorded **success** of that same operation, same language (§2.3) |
| `migration-failure` | migration outcome in {`storage-failure`, `blocked-by-malformed-data`, `blocked-by-unusable-stable`, `partially-migrated`} | outcome in {`migrated`, `already-current`, `migration-state-recreated`}, same language |
| `orphan-adoption-residue` | `orphan-adoption` with `status: 'partial'` | `orphan-adoption` with `status: 'complete'` or outcome `no-candidates`, same language |

Closing is always same-language. A converged failure on Spanish never offsets an
open one on Arabic.

### 2.3 Success signals — the core producer change

Convergence is unmeasurable today because **the producer only emits failures**.
`readLegacySourcesForLanguage` reports `storage-failure` on error and nothing on
success ([masteryCompatibility.ts:112-139](../src/storage/masteryCompatibility.ts#L112-L139)).
A failure-only stream cannot express recovery.

The rule this package adopts: **every operation that can emit a failure must
also emit its outcome on success.** Concretely:

| Operation | Success signal today | Change |
|---|---|---|
| `read-stable` | `stable-read` with `status: 'ok'` — **exists** | none |
| `write-stable` | `compatibility-write` with `stableStatus: 'written'` — **exists** | none |
| `write-legacy` | `compatibility-write` with `legacyStatus: 'written'` — **exists** | none |
| `read-legacy` | none | new: emit an outcome event on success as well as failure |
| `read-legacy-fallback` | none | new: emit on success as well as failure |
| `read-migration-state` | none | new: emit on success as well as failure |
| `write-migration-state` | none | new: emit on success as well as failure |

Three of the seven already have a success signal in a differently-named event;
the ledger consumes those rather than duplicating them. Only four need a new
emission.

**Volume:** these operations run at category-load and explicit-migration
granularity — not per practice attempt. A learner switching languages ten times
in a session produces tens of events, not thousands. The existing 100-deep
backlog with drop-on-full is unchanged and remains the safety valve.

### 2.4 Zero validity — dropped events invalidate zeros, not non-zeros

A cumulative counter under a lossy pipeline is a **lower bound**, not a value.
That has an exact consequence:

- A counter reading **> 0** is trustworthy. The lower bound is above zero, so
  the condition definitely occurred. It blocks, correctly.
- A counter reading **0** is *not* trustworthy if any event was dropped in the
  window. The true value may be positive.

Therefore: **if `diagnosticEventsDropped > 0` or `diagnosticDeliveryFailures > 0`
for a window, every runtime-measured zero in that window is `unknown`, not
satisfied.** Non-zero readings remain valid.

This requires persisting the two diagnostic self-metrics, which the current
schema deliberately omits
([masteryRolloutDiagnosticStorage.ts:102-105](../src/storage/masteryRolloutDiagnosticStorage.ts#L102-L105)).
Without them, a snapshot cannot be distinguished from a silently lossy one, and
"was this zero real" is unanswerable.

> **Correction to the WP-3.8B draft.** That document classifies dropped events
> as coverage-degrading but non-blocking. That is too weak. Drops do not merely
> reduce confidence in general — they specifically invalidate the zeros, which
> are the readings a gate uses to pass. The rule above supersedes it, and
> `docs/Phase-3.8B-Safety-Gate-Evidence-Model.md` §3.4 should be revised to
> match when that package is implemented. The direction of the correction is
> stricter.

Drops still never block a learner operation and never fail a diagnostic write —
this changes only how a *reader* interprets a zero.

### 2.5 Bounding the ledger

`MAX_OPEN_RELIABILITY_CONDITIONS` — proposed **64**. The natural bound is
kinds × operations × languages, which is larger than any plausible real state
but not small enough to leave uncapped.

At capacity, the producer **refuses to add** and increments
`openConditionOverflow`. It never evicts. Eviction would silently convert an
unresolved condition into a resolved-looking one, which is the exact failure
mode this ledger exists to prevent. A nonzero `openConditionOverflow` forces all
reliability fields to `unknown`.

### 2.6 Ledger ownership

The ledger has three roles across two layers. Separating them keeps the ledger
a record of what happened rather than a plan for what should happen next.

| Role | Layer | Responsibility |
|---|---|---|
| **Producer** | Diagnostic layer (this package) | Opens a condition when a failure outcome is observed. Records kind, operation, language scope, and the opening sequence number. |
| **Reducer / resolver** | Diagnostic layer (this package) | Closes a condition when explicit successful-completion evidence for the same identity arrives. Nothing else closes a condition. |
| **Evaluator** | Evidence evaluator (WP-3.8B, off-device) | Reads unresolved conditions and determines readiness. Never writes. |

**No component may:**

- **Infer missing resolution.** A condition closes only on an observed success
  event for the same `(kind, languageId, operation)`. There is no TTL, no
  age-out, no "probably fine by now," and no heuristic. An open condition that
  never receives a closing event stays open forever, and that is the correct
  behavior — it records that the system never observed the recovery.
- **Mutate learner state.** The ledger has no write access to any learner-state
  key.
- **Modify migration state.** The ledger observes migration outcomes; it never
  writes the migration marker or the stable document.
- **Repair production data.** Nothing in the ledger path fixes, retries, or
  compensates for the condition it recorded.

**The reducer is not a retry engine.** This is the distinction most likely to
erode under future pressure, so it is stated directly: the reducer does not
schedule, trigger, prioritize, or request the operation that would close a
condition. It observes that a closing event arrived and updates the record. A
ledger that initiated the work needed to clear its own entries would be a
migration trigger wearing a different name — a hidden write path created by
the component least expected to have one, and a direct violation of §1.6.

**The ledger represents observed operational truth, not a workflow engine.** It
answers "what has the system observed to be unresolved," not "what should the
system do about it." The second question is the operator's, and they answer it
by reading a report, not by the app acting.

**Consequence for interpretation.** Because nothing infers resolution, an open
ledger is not evidence that something is broken *now* — it is evidence that a
recovery was never observed. Those differ when evidence is lossy (§2.4), and
the evaluator, not the producer, is where that distinction gets weighed.

---

## 3. Comparison evidence

Shadow comparison currently persists three numbers and a status. It must
preserve direction, side attribution, language scope, and observation context.

### 3.1 Divergence kind decomposition

`MasteryShadowDivergenceKind`
([masteryCompatibility.ts:363-369](../src/storage/masteryCompatibility.ts#L363-L369))
gains the splits identified in the WP-3.8B review:

| Kind | Status | Records |
|---|---|---|
| `stable-document-absent` | **new**, split from `missing-stable-record` | No stable document exists — the only expected absence |
| `stable-record-absent` | **new**, split from `missing-stable-record` | Populated document missing a group legacy has — record-level loss signature |
| `legacy-record-absent` | **new**, split from `tier-disagreement` | Stable holds a group legacy does not — impossible under legacy-first writes |
| `tier-disagreement-stable-higher` | **new**, split | Direction: stable ahead |
| `tier-disagreement-stable-lower` | **new**, split | Direction: stable behind |
| `reset-disagreement` | unchanged | |
| `placement-disagreement` | unchanged | |
| `alias-resolution-difference` | unchanged | |
| `unexpected-fallback-behavior` | unchanged | |

Only `stable-document-absent` is excluded from `unexplainedDivergenceCount`.

**This is classification work, not behavior change.** `compareMasteryInShadow`
performs no learner-state writes and has no production caller while rollout is
`disabled`. Splitting a diagnostic enum changes what is recorded about a
comparison, never what the comparison does.

### 3.2 Enriched shadow-comparison event

```ts
{
  readonly name: 'shadow-comparison';
  readonly status: 'compared' | 'stable-missing' | 'blocked';
  readonly languageId: LanguageId;                    // NEW — language scope
  readonly stableDocumentPresent: boolean;            // NEW — enables the §3.1 split
  readonly currentLabelIsHistorical: boolean;         // NEW — rename context
  readonly historicalIdentityResolutionObserved: number; // NEW — §3.5
  readonly divergencesByKind: Partial<Record<MasteryShadowDivergenceKind, number>>; // NEW, sparse
  readonly divergenceCount: number;
  readonly unexplainedDivergenceCount: number;
  readonly unresolvedMappingCount: number;
  readonly malformedLegacyCount: number;              // NEW to the event; already on the result
}
```

`divergencesByKind` is **sparse** — zero-valued kinds are omitted — so a clean
comparison costs a handful of bytes rather than a full nine-key map in every
ring entry (§7.2).

`malformedLegacyCount` already exists on `MasteryShadowComparison`
([:562](../src/storage/masteryCompatibility.ts#L562)) but never reaches
diagnostics. It matters because a comparison against unparseable legacy input is
an absence of evidence, not evidence of equivalence.

### 3.3 Operation attribution and observation context

**Operation attribution.** Storage failures are counted per operation
(`storageFailuresByOperation`) rather than into one scalar, so stable-side and
legacy-side reliability separate. The operation is already on the event
([masteryRolloutDiagnostics.ts:69-72](../src/analytics/masteryRolloutDiagnostics.ts#L69-L72));
it is discarded at the metrics layer.

**Stable vs legacy source.** `stable-read` outcomes are counted by status
(`stableReadsByStatus`), and compatibility writes by leg status, so
"which side failed" is answerable without inspecting the ring.

**Observation context.** Every persisted event is stamped by the recorder with
the rollout state it was observed under. This is not threaded through call
signatures — the diagnostics module reads the build constant once. The recorder
observing configuration is not the recorder controlling configuration; nothing
here can write `FEATURE_FLAGS`.

Rationale: cumulative counters are never reset automatically (operator-only
reset policy), so a device that ships from `shadow` to `internal-test`
accumulates both regimes in one snapshot. Evidence from a read-only regime and
an authoritative regime mean different things and must not be silently summed.
The snapshot therefore carries:

```ts
readonly rolloutStateObservations: Readonly<
  Record<ContrastMasteryRolloutState, number>
>;
```

Bounded at five entries. More than one non-zero means the snapshot spans
regimes; the gate treats transition-scoped volume gates over such a snapshot as
`unknown` unless an operator declares a window. The producer records the fact
and draws no conclusion from it.

**Write provenance.** `compatibility-write` gains
`provenance: 'practice' | 'placement' | 'reset'`. This is already a parameter of
`writeCompatibleMastery`
([:798](../src/storage/masteryCompatibility.ts#L798)) and is discarded before
diagnostics. It provides runtime corroboration for reset and placement drill
witnesses (§5.2).

### 3.4 Diagnostic boundary check

Every addition is a count, an enumerated category, a boolean, or a registry
identity:

| Addition | Classification | Can it reconstruct mastery? |
|---|---|---|
| `languageId` | Immutable registry identity (Decision 003) | No — names which language was exercised, never what is known |
| `divergencesByKind` counts | Enumerated category counts | No — "3 groups disagreed downward" carries no group and no tier |
| `storageFailuresByOperation` | Enumerated category counts | No |
| `stableReadsByStatus` | Enumerated category counts | No |
| `provenance` on writes | Enumerated category | No |
| `rolloutState` stamp | Build configuration | No |
| `stableDocumentPresent` | Boolean about document existence | No |
| `openConditions` | `(kind, languageId, operation)` tuples | No |
| `coldStarts` | Integer | No |

No tier value, no `ContrastId`, no mastery map, no raw legacy payload, no
attempt history, no answer, no free text, no timestamp, no device or user
identifier. The store remains write-mostly, disjoint from every learner-state
key, and unreadable by any learner-facing path.

The one addition that needed an explicit boundary ruling is
`historicalIdentityResolutionObserved`, defined in §3.5.

### 3.5 `historicalIdentityResolutionObserved`

**Renamed on architecture review.** An earlier draft called this
`aliasSourceHits`. That name described a storage-lookup outcome — "a key was
hit" — which invites reading it as activity on the device, and activity is
adjacent to learner behavior. The metric is not about the learner. It is about
whether the **migration compatibility path** was exercised. The name now says
so.

**What it measures:**

- **Historical identity resolution events** — occurrences where a legacy source
  stored under a *non-current* historical label was resolved to a current
  identity through the alias table.
- **Alias compatibility paths exercised** — evidence that the
  `historicalIdentityMapping` resolution path executed against real stored
  data, rather than merely being reachable.
- **Rename scenario coverage** — which of the six shipped renames
  ([historicalIdentityMapping.ts:254-286](../src/domain/compatibility/historicalIdentityMapping.ts#L254-L286))
  have actually been exercised on the devices under observation.

**What it does not measure:** learner behavior, progress, mastery, engagement,
session activity, or anything a learner did. It counts a code path resolving an
identity. It is incremented identically whether the resolved record represents
a mastered contrast or an untouched one, because the tier is never inspected.

**Why the distinction is load-bearing.** The rollout transition gates require
"≥1 renamed language" exercised. Without this metric, the only available
substitute is "a renamed language was opened," which is satisfied by a learner
who opens Spanish on a fresh install where no historical key exists — the
compatibility path never ran, and the gate would pass on evidence of nothing.
This metric is the difference between *the code path was reachable* and *the
code path did something*, and that difference is precisely what the gate is
asking about.

**Diagnostic boundary.** A non-zero value discloses that the install holds data
under a label predating a rename — install lineage, not learner progress. It
carries no tier, no `ContrastId`, no group, and no count of anything the
learner did. It is the same class of fact as "this install has a stable mastery
document," which the diagnostic layer already records. It stays within the
boundary, and the rename removes the reading under which it looked like it
might not.

---

## 4. Volume evidence

### 4.1 Language coverage

```ts
readonly languageObservations: Readonly<Record<LanguageId, {
  readonly shadowComparisons: number;
  readonly stableReads: number;
  readonly compatibilityWrites: number;
  readonly historicalIdentityResolutionObserved: number;
}>>;
```

Bounded by the contrast registry's language count, so the map is inherently
size-capped and cannot grow with usage. Keys are validated against the registry
on read; an unknown key makes the snapshot malformed rather than being silently
accepted.

`languagesExercised` is the key count — derived by the reader, not stored.

### 4.2 Renamed identity scenarios

Six alias rows exist in `HISTORICAL_CATEGORY_LABELS` — Spanish, Arabic,
Russian, Farsi, Indonesian, Hindi/Urdu — confirmed by inspection at
[historicalIdentityMapping.ts:254-286](../src/domain/compatibility/historicalIdentityMapping.ts#L254-L286).

A rename scenario is **not** exercised merely because a renamed language was
opened. It is exercised when a *historical, non-current* label key actually held
data that the alias path resolved. That is what
`historicalIdentityResolutionObserved` counts (§3.5).

`renamedLanguagesExercised` is therefore derived — languages with
`historicalIdentityResolutionObserved > 0` intersected with alias-bearing
languages — and not stored as its own field. Nothing new is persisted for it
beyond §4.1.

### 4.3 Cold-start coverage

```ts
readonly coldStarts: number;
```

Incremented by an explicit `recordMasteryRolloutColdStart()` called once from
the app root ([app/_layout.tsx](../app/_layout.tsx)), guarded to fire once per
process.

**Not** a module-import side effect. Import-time writes are invisible at the
call site, fire unpredictably under test and under bundler behavior, and would
make a module import perform storage I/O — a smaller instance of exactly the
hidden-side-effect pattern the migration-orchestration invariant prohibits. An
explicit call is testable and honest.

This is the one file outside `src/` that this package touches, and the change is
a single fire-and-forget call that cannot throw into render.

### 4.4 Shadow observation volume

`shadowComparisons` already exists as a cumulative counter and needs no change.
It gains meaning from §4.1's per-language decomposition and §3.3's regime
attribution: "40 comparisons" is not evidence until you know across how many
languages and under which rollout states.

---

## 5. Witness model

Per Decision 012: a zero reading is evidence only if the code that would have
produced a non-zero reading actually ran.

### 5.1 Runtime witnesses this package delivers

| Evidence field | Witness counter | Why it proves the producer ran |
|---|---|---|
| stable storage failures | `stableReadsAttempted` | The stable read path executed |
| legacy storage failures | `legacySourceReadsAttempted` **new** | The legacy read path executed |
| partial writes | `compatibilityWrites` | The dual-write path executed |
| unexplained divergences, tier direction | `shadowComparisons` | A comparison was performed |
| unresolved mappings | `shadowComparisons` | Identity resolution was attempted |
| malformed stable fallbacks | `stableReadsAttempted` | Something was read and validated |
| alias regressions | `historicalIdentityResolutionObserved` | The historical identity resolution path actually executed against stored data |
| migration failures | `migrationAttempts` **new** | Migration ran |
| orphan adoption residue | `orphanAdoptionEvents` | Adoption ran |
| cross-language collisions (runtime part) | `stableReadsByStatus.ok` | A document was read and structurally checked |

### 5.2 Drill witnesses — corroborated, not replaced

Reset and placement drills are manual attestations. This package cannot make
them runtime-measured — a human must still state what they did and what they
observed. But `provenance` on `compatibility-write` (§3.3) provides
**corroboration**: a claimed reset drill that produced no `provenance: 'reset'`
write is a claim contradicted by the device.

That is a cross-check available to a human reading a report, not an automated
validation, and it does not convert the attestation to `runtime-measured`.

### 5.3 Rollback has no runtime witness, by construction

A rollback drill runs a *previous build* — a binary that predates these
counters and cannot write them. There is no version of this package that can
observe its own rollback. Rollback evidence is permanently
`manually-attested`, and any future proposal to runtime-measure it should be
treated as a design error rather than an improvement.

### 5.4 The zero-without-witness rule is enforced at the gate

This package supplies witness counters. It does not evaluate them — deciding
that an unmet witness makes a field `unknown` is evaluation, and evaluation is
WP-3.8B. The producer records; the gate concludes.

---

## 6. Required schema changes

Diagnostic schema version **1 → 2**.

### 6.1 Snapshot shape

```ts
export interface MasteryRolloutDiagnosticSnapshot {
  readonly schemaVersion: 2;
  readonly sequence: number;
  readonly firstSequence: number;                    // NEW — ring-wrap detection
  readonly producerManifest: DiagnosticProducerManifest;  // NEW — §1.4
  readonly metrics: PersistedMasteryRolloutMetrics;  // extended, §6.2
  readonly languageObservations: Readonly<Record<LanguageId, LanguageObservation>>; // NEW
  readonly rolloutStateObservations: Readonly<Record<ContrastMasteryRolloutState, number>>; // NEW
  readonly openConditions: readonly OpenReliabilityCondition[];  // NEW — §2
  readonly recentEvents: readonly PersistedMasteryRolloutDiagnosticEvent[];
}
```

### 6.2 Metric additions

Existing counters are retained unchanged; all additions are additive.

| Counter | Purpose |
|---|---|
| `shadowUnexplainedDivergences` | Cumulative headline blocking counter — the ring is not a valid aggregation source |
| `divergencesByKind` | Per-kind counts, direction and side attribution |
| `storageFailuresByOperation` | Per-operation failure counts |
| `storageOperationSuccessesByOperation` | Per-operation success counts (convergence input) |
| `stableReadsByStatus` | Per-status read outcomes |
| `compatibilityWritesByStatus` | Per-status write outcomes |
| `compatibilityWritesByProvenance` | practice / placement / reset |
| `orphanAdoptionsByStatus` | Per-status adoption outcomes |
| `migrationOutcomes` | Per-`LazyMasteryMigrationResult['status']` counts |
| `migrationAttempts` | Witness for migration fields |
| `legacySourceReadsAttempted` | Witness for legacy reliability fields |
| `coldStarts` | Restart coverage |
| `reliabilityConditionsOpened` / `...Recovered` | Cumulative context for §2 |
| `openConditionOverflow` | Ledger capacity breach |
| `diagnosticDeliveryFailures` | **Newly persisted** — §2.4 |
| `diagnosticEventsDropped` | **Newly persisted** — §2.4 |

`PersistedMasteryRolloutMetrics` is currently defined as `Omit<
MasteryRolloutMetrics, 'diagnosticDeliveryFailures' | 'diagnosticEventsDropped'>`.
That `Omit` is removed; the persisted type becomes a superset of the in-memory
type rather than a subset of it.

### 6.3 Validation

The existing strict validator
([:265-347](../src/storage/masteryRolloutDiagnosticStorage.ts#L265-L347)) is
extended in the same style — `hasExactKeys` per variant, enumerated outcomes,
`isCount` for every number. New requirements:

- `languageObservations` keys must be registry-known `LanguageId` values;
  unknown keys make the snapshot malformed.
- `rolloutStateObservations` keys must be members of
  `CONTRAST_MASTERY_ROLLOUT_STATES`.
- `openConditions.length ≤ MAX_OPEN_RELIABILITY_CONDITIONS`; entries must be
  unique on `(kind, languageId, operation)`.
- `divergencesByKind` accepts only known kinds, sparsely.
- `firstSequence ≤ sequence`.
- `producerManifest.producedFields` must be sorted, unique, and drawn from the
  known field enum.

Unknown fields continue to be rejected, preserving the existing
"unknown learner payload fields cannot enter diagnostic storage" guarantee.

---

## 7. Runtime producer changes

### 7.1 Emission changes

| Location | Change | Behavior change? |
|---|---|---|
| `readLegacySourcesForLanguage` | Emit outcome on success, not only on failure; count historical identity resolutions | **No** — control flow unchanged |
| `compareMasteryInShadow` | Emit `languageId`, `stableDocumentPresent`, `currentLabelIsHistorical`, `historicalIdentityResolutionObserved`, sparse `divergencesByKind`, `malformedLegacyCount` | **No** — already computes all of it |
| `compareMasteryMaps` | Emit the §3.1 split kinds | **No** — classification only |
| `writeCompatibleMastery` | Emit `languageId` and `provenance` on `compatibility-write` | **No** — both are already in scope |
| `readCompatibleMastery` | Emit `languageId` on `stable-read` / `legacy-fallback` | **No** |
| `migrateLanguageMastery` | Emit a migration-outcome event per result status | **No** — currently emits only on blocked |
| `contrastMasteryStorage` migration-state read/write | Emit outcome on success as well as failure | **No** |
| `orphanMasteryAdoption` (storage) | Emit `languageId` on the adoption event | **No** |
| `masteryRolloutDiagnostics` | Stamp rollout state; maintain the ledger; new counters; `recordMasteryRolloutColdStart()` | **No** |
| `app/_layout.tsx` | One cold-start call | **No** — fire-and-forget, cannot throw into render |

Every diagnostic emission remains fire-and-forget and failure-isolated through
the existing `reportMasteryRolloutDiagnostic` boundary
([masteryRolloutDiagnostics.ts:170-180](../src/analytics/masteryRolloutDiagnostics.ts#L170-L180)).
Ledger maintenance happens inside the persistence layer, on the diagnostic
queue, never on a learner-state path.

### 7.2 Size budget

Worst case, with sparse encoding: ring 100 events × ~180 B ≈ 18 KB;
`languageObservations` ~20 languages × ~90 B ≈ 1.8 KB; `openConditions`
64 × ~90 B ≈ 5.8 KB; counters and manifest ≈ 2 KB. **≈ 28 KB**, against roughly
8–10 KB today.

That is acceptable for a single AsyncStorage value but is a real ~3× growth,
and it is why `divergencesByKind` is sparse rather than dense. If measurement
shows the ring dominating, the correct lever is reducing
`MAX_RECENT_MASTERY_ROLLOUT_DIAGNOSTICS` — the ring is human-reading context,
while the cumulative counters and the ledger are the evidence, and those are
small.

---

## 8. Files likely affected

| File | Change | Size |
|---|---|---|
| [src/storage/masteryRolloutDiagnosticStorage.ts](../src/storage/masteryRolloutDiagnosticStorage.ts) | Schema v2, ledger, manifest, per-language and per-state maps, extended validation | **Major** |
| [src/analytics/masteryRolloutDiagnostics.ts](../src/analytics/masteryRolloutDiagnostics.ts) | Event union, new counters, rollout-state stamping, cold-start API | **Major** |
| [src/storage/masteryCompatibility.ts](../src/storage/masteryCompatibility.ts) | Divergence-kind split, richer emissions, success signals | **Moderate** — emissions only |
| [src/storage/contrastMasteryStorage.ts](../src/storage/contrastMasteryStorage.ts) | Migration-state read/write success signals | Small |
| [src/storage/orphanMasteryAdoption.ts](../src/storage/orphanMasteryAdoption.ts) | `languageId` on the adoption event | Small |
| [app/_layout.tsx](../app/_layout.tsx) | One cold-start call | Trivial |
| [scripts/masteryRolloutDiagnostics.test.js](../scripts/masteryRolloutDiagnostics.test.js) | Extended; all existing tests retained | **Major** |
| [scripts/masteryRollout.test.js](../scripts/masteryRollout.test.js) | Divergence-kind assertions | Moderate |

**Explicitly not touched:** `src/config/featureFlags.ts`,
`src/hooks/useContrastPairs.ts`, `src/domain/masteryRolloutSafety.ts`,
`src/domain/contrastMasteryPersistence.ts`,
`src/domain/compatibility/historicalIdentityMapping.ts`, and every
learner-state storage module. If implementation finds itself editing
`masteryRolloutSafety.ts`, the scope boundary has been crossed — that is
WP-3.8B.

---

## 9. Migration compatibility considerations

**Learner state is untouched.** No change to `@mastery_*`,
`@masteryByContrast_*`, `@masteryByContrastMigration_*`, `@pairProgress_v2`,
`@placementDone_*`, or any preference key. No new learner-state key. No
learner-state read or write path is added, removed, or reordered.

**Diagnostic v1 snapshots are discarded, and no migration is written.** Under
the existing strict validator, a v1 snapshot read by a v2 build is `malformed`
→ inert empty snapshot → recovers on next write. That path is already
implemented and already tested ("malformed diagnostics return an inert empty
snapshot and recover on write").

Writing a v1→v2 diagnostic migration is **rejected**: it would add code that
must itself be correct, on a store whose loss is explicitly acceptable, to
preserve evidence that does not exist — rollout is `disabled`, so no shipped
install has produced meaningful diagnostic evidence. The one operational
consequence is that an operator with a collection window in progress must
export before upgrading, which belongs in the WP-3.8E runbook.

**Alias table untouched.** Append-only per Decision 007. This package reads it
to count historical identity resolutions; it never writes it.

**No shipped behavior changes.** `compareMasteryInShadow` and the compatibility
write path have no production caller while rollout is `disabled`
([featureFlags.ts:18](../src/config/featureFlags.ts#L18)), and
`useContrastPairs` bypasses the compatibility layer entirely in that state. The
divergence-kind widening is therefore invisible to every shipped install.

**Rollback of this package:** revert the code. The orphaned v2 diagnostics key
is inert and **must not be auto-deleted** — same rule as WP-3.8A. A reverted
build reads v2 as malformed and starts clean.

**Decision 008 rollback invariant:** unaffected. The legacy-first write ordering
is not modified; the legacy leg still runs first and still stops the operation
on failure.

---

## 10. Test strategy

Organized by the guarantee each group defends. Existing tests are retained
unchanged, not rewritten — they are the record of what WP-3.8A verified.

**10.1 Boundary regression (all existing tests must still pass).**
All eleven current diagnostic tests, re-run against the v2 producer — including
disjoint storage key, bounded retention, stalled-backlog capping, malformed
recovery, unknown-payload rejection, storage-failure observability, process-loss
handling, and the two isolation tests (a throwing sink and a slow sink cannot
fail or delay a learner-state read). The isolation tests must additionally
cover the **ledger** write path, since that is new work on the diagnostic
queue.

**10.2 Reliability ledger.**
Open then close on the same language → residual 0. Open with no close →
residual 1. Open on language A closed, open on language B → still blocked
(never nets across identities). Re-failing an already-open condition increments
`observed` without adding a second ledger entry. Ledger at capacity refuses to
add, increments `openConditionOverflow`, and evicts nothing. Each of the four
condition kinds opens and closes on its specified signals.

**10.3 Zero validity.**
A dropped event plus a zero counter must be representable as distinct from a
zero counter with no drops — asserted on the persisted shape, since the
interpretation itself belongs to WP-3.8B. A non-zero counter with drops remains
non-zero.

**10.4 Comparison classification.**
A legacy group absent from a **populated** stable document →
`stable-record-absent`, counted as unexplained. The same absence with **no**
stable document → `stable-document-absent`, not counted. A stable record with
no legacy counterpart → `legacy-record-absent`. Tier disagreements split by
direction. `malformedLegacyCount` reaches the persisted event.

**10.5 Volume and identity.**
Per-language counts accumulate independently and survive a cold start. An
unknown `LanguageId` key makes a snapshot malformed.
`historicalIdentityResolutionObserved` increments only when a **non-current**
historical label held data — asserted against a real alias row, not a synthetic
one — and does not increment for a current-label read on a fresh install. Cold
starts increment once per process, not once per import. Events observed under
different rollout states are attributed separately.

**10.6 Producer manifest cross-check.**
A test asserting that every field the WP-3.8B evidence catalogue marks
`runtime-measured` appears in `producerManifest.producedFields`, and vice
versa. This is the structural fence against G9 recurring: a future field added
to the catalogue with no producer fails this test instead of silently reading
zero. Until WP-3.8B exists, the catalogue side is a declared constant in this
package's test fixtures.

**10.7 No-inference / import direction.**
`masteryRolloutDiagnosticStorage.ts` and `masteryRolloutDiagnostics.ts` must not
import `masteryRolloutSafety.ts` or any evaluator, must export no comparison or
threshold function, and must contain no named constant describing a safe or
acceptable value. Enforced as an import-graph and export-surface test, matching
the existing precedent of asserting module boundaries by name in
`masteryRolloutDiagnostics.test.js`.

**10.8 Evidence Consumption Invariant (§1.6).**
A test asserting the import boundary by module **class**, not by importer
count: no learner-facing runtime module, migration module, or rollout-control
module imports diagnostic storage, `getDiagnosticSnapshot`, or the ledger.
Diagnostic infrastructure maintaining its own evidence lifecycle is permitted,
and so is external tooling reading exported evidence.

Asserting a class rather than a cardinality matters in both directions: a count
would fail on a harmless addition such as an inspection surface, and would pass
a harmful change that swapped a permitted importer for a forbidden one. These
extend the existing "no learner-facing code reads diagnostics" guarantee to the
richer evidence this package introduces, which is the point at which the
guarantee starts being worth breaking.

**10.9 Ledger ownership (§2.6).**
A condition never closes without an observed success event for the same
identity — asserted by advancing time and event volume with no matching
success, and confirming the entry stays open. No TTL, no age-out. A test
asserting the ledger path issues no retry, no scheduling, and no call into any
migration or storage-write function: the reducer observes and records only.

**10.8 Schema strictness.**
Every new field is validated; unknown fields are still stripped or rejected; no
field accepting a tier, `ContrastId`, mastery map, attempt, timestamp, or
free-text value can be added to the snapshot.

---

## 11. Verification criteria

WP-3.8A.1 is complete when all of the following hold:

1. Every field the WP-3.8B catalogue marks `runtime-measured` has a real
   cumulative producer, verified by the §10.6 cross-check.
2. Every reliability condition has both a failure producer and a recovery
   producer, and unresolved state is a ledger, not a subtraction.
3. Per-language counts, rollout-state attribution,
   `historicalIdentityResolutionObserved`, and cold starts all survive a cold
   start and an app restart.
4. The producer manifest is present in every snapshot and matches the build.
5. Both diagnostic self-metrics are persisted.
6. All WP-3.8A isolation guarantees hold unchanged, including for ledger
   writes: no learner-state operation can fail, block, or be delayed by any
   diagnostic write.
7. Clearing diagnostic storage has zero effect on any learner-state key.
8. `npm test` green, with all existing assertions retained.
9. `CONTRAST_MASTERY_ROLLOUT_STATE` is still `'disabled'` and unmodified.
10. No gate, evaluator, threshold, or recommendation exists anywhere in the
    diff.

---

## 12. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Write amplification** — success signals and ledger updates increase event volume, raising drop rate, which under §2.4 converts more zeros to `unknown` | Medium | Events are per category-load, not per attempt. The drop counter makes the effect *visible* rather than silent — a noisier pipeline honestly reports lower confidence instead of quietly reporting clean zeros. Measure drop rate in the first collection window before tuning. |
| **Scope drift into evaluation** — a counter that "knows" a safe value has become a gate | High | §10.7 import-direction and export-surface tests; no threshold constants; explicit non-goal in §1.2. |
| **Ledger correctness becomes load-bearing** — a wrong ledger produces wrong evidence | Medium | Ledger fails safe under drops (an unclosed entry blocks). Bounded with refuse-not-evict. Six dedicated tests in §10.2. |
| **Snapshot size growth** (~3×) on constrained devices | Low | 28 KB worst case; sparse encoding; the ring is the tunable dial, not the evidence. |
| **Divergence-kind split changes a test's expectations** and is mistaken for a behavior change | Low | Shadow performs no learner-state writes and has no production caller at `disabled`. §10.4 asserts classification explicitly. |
| **Cold-start counter fires under test harness imports**, inflating coverage | Low | Explicit call from app root, guarded once per process; never a module side effect (§4.3). |
| **An operator upgrades mid-collection** and loses the window | Low | Documented in §9; belongs in the WP-3.8E runbook as an export-before-upgrade step. |

---

## 13. Rejected alternatives

1. **Residual as `observed − recovered`.** Rejected: fails in the unsafe
   direction under dropped events, can go negative under interleaving, and
   cannot express which identity is unresolved — violating Decision 013's
   never-net-across-identities rule. Replaced by the state ledger (§2.1).
2. **Deriving evidence by summing the recent-event ring.** Rejected: the ring
   wraps at 100 entries, so summation under-reports silently and always in the
   safe-looking direction. Cumulative counters are the only aggregation source;
   the ring is human-reading context.
3. **Storing harness and manual attestations in diagnostic storage.** Rejected:
   converts an observer into an evidence aggregator, which is the
   second-authority pattern (§1.3). Also unbounded and unvalidatable — the
   store cannot verify a claim it did not observe.
4. **Auto-migrating v1 snapshots to v2.** Rejected: new code that must be
   correct, on a store whose loss is accepted, to preserve evidence that does
   not exist (§9).
5. **Timestamps for windowing.** Rejected: prohibited by the diagnostic-data
   boundary — precise timestamps can reconstruct a session. Sequence numbers
   plus operator-declared collection windows serve the same purpose.
6. **A device identifier for snapshot de-duplication.** Rejected: prohibited.
   Distinctness is an operator assertion (WP-3.8B §8).
7. **Resetting counters when rollout state changes.** Rejected: silent data
   loss, and it conflicts with the operator-only reset policy. Regime
   attribution (§3.3) records the mixing instead of destroying it.
8. **Evicting the oldest open condition at ledger capacity.** Rejected:
   silently converts an unresolved condition into a resolved-looking one, which
   is precisely the failure the ledger exists to prevent. Refuse-and-flag
   instead.
9. **Incrementing cold starts as a module-import side effect.** Rejected:
   invisible at the call site, unpredictable under test and bundler behavior,
   and makes an import perform I/O (§4.3).
10. **Emitting success signals at per-attempt granularity.** Rejected on volume
    grounds; scoped to category-load and explicit-operation granularity, which
    is where the failures being converged actually occur.
11. **Letting the gate infer direction, operation, or language from the ring.**
    Rejected — this is the alternative that makes the whole package
    unnecessary, and it is the second-authority failure in its purest form: an
    evaluator inventing facts the system never observed.
12. **A ledger that closes its own conditions by triggering the work.**
    Rejected: a reducer that schedules or requests the operation which would
    close an entry is a migration trigger by another name — a hidden write path
    in the component least expected to have one, violating §1.6 and the
    migration-orchestration invariant simultaneously. The reducer observes
    closing evidence; it never causes it (§2.6).
13. **Aging open conditions out after a threshold of events or restarts.**
    Rejected: an aged-out condition is an *inferred* resolution, and inference
    is exactly what this package exists to eliminate. An entry that never
    receives a closing event correctly records that recovery was never
    observed.
14. **Keeping the name `aliasSourceHits`.** Rejected on architecture review:
    it describes a storage-lookup outcome and reads as device activity, which
    is adjacent to learner behavior. The metric records migration
    compatibility-path observation. Renamed to
    `historicalIdentityResolutionObserved` (§3.5) so the name states the
    boundary the metric actually sits on.

---

## 14. Verification of this proposal

- **No gate implementation is proposed.** No evaluator, threshold, safe-value
  constant, or recommendation appears anywhere in scope.
  `src/domain/masteryRolloutSafety.ts` is explicitly not touched (§8), and §10.7
  fences it by test.
- **No rollout automation is introduced.** Nothing reads or writes
  `FEATURE_FLAGS` except to stamp the observed state onto a diagnostic record.
  `CONTRAST_MASTERY_ROLLOUT_STATE` remains `'disabled'` and unmodified.
- **No learner-state behavior changes are required.** Every producer change is
  an added emission; no control flow, ordering, or return value in any
  learner-state path changes. Shadow comparison remains read-only.
- **No hidden migration paths are created.** No migration is wired, triggered,
  or scheduled. `readCompatibleMastery` gains no write. `migrateLanguageMastery`
  gains diagnostic emissions and no new caller.
- **Unknown evidence remains explicit.** The producer manifest makes the
  absence of a producer detectable; the zero-validity rule keeps an
  untrustworthy zero from reading as safe; the producer records these facts and
  concludes nothing from them.
- **Existing architecture decisions remain preserved.** Decisions 001–011 are
  unchanged and uncited as authority for anything new. Decisions 012–014 remain
  proposals; this package is contingent on their resolution and does not assume
  their acceptance.
- **One correction to prior work is recorded, in the stricter direction**
  (§2.4): dropped events invalidate zeros rather than merely degrading
  confidence, superseding `Phase-3.8B-Safety-Gate-Evidence-Model.md` §3.4.
- **WP-3.8B scope is unchanged.** Evaluation, provenance assignment, witness
  enforcement, thresholds, and the three-valued recommendation all remain that
  package's. This revision moved no responsibility into or out of it.
- **No generic rule engine, reusable safety framework, or attestation storage
  is introduced**, and no runtime rollout automation or hidden migration path
  exists anywhere in scope.

### 14.1 Architecture review clarifications — 2026-08-01

Four clarifications were incorporated. All four are **architecture boundaries,
not implementation details**: each names an owner or prohibits a class of
change, and none prescribes how the code is written.

| # | Clarification | Where | Kind of statement |
|---|---|---|---|
| 1 | Evidence lifecycle and stage ownership — Produced → Persisted → Exported → Evaluated → Archived, one owner per stage, one-directional, no stage merged or skipped | §1.5 | Ownership boundary |
| 2 | **Evidence Consumption Invariant** — "Safety evidence is not runtime control input," with the six prohibited consumptions and the single narrow carve-out for the diagnostic layer reading its own storage | §1.6, fenced by §10.8 | Named invariant |
| 3 | `aliasSourceHits` → `historicalIdentityResolutionObserved`, with an explicit statement of what it measures (compatibility-path observation) and what it does not (learner behavior, progress, mastery, engagement) | §3.5, §4.2, §5.1 | Boundary clarification via naming |
| 4 | Unresolved-condition ledger ownership — producer opens, reducer closes only on observed success, evaluator reads; no inference, no learner-state or migration-state mutation, no repair; the reducer is not a retry engine | §2.6, fenced by §10.9 | Ownership boundary |

Scope is unchanged by all four. No new counter, event, schema field, file, or
test area was added beyond the two boundary-fencing test groups (§10.8, §10.9)
that exist to hold clarifications 2 and 4 in place.

### 14.2 Final review — wording adjustments, 2026-08-01

Two adjustments. Both restate existing boundaries more precisely. Neither adds
scope, a metric, a schema field, or an affected file.

| # | Adjustment | Where | Effect |
|---|---|---|---|
| 1 | The diagnostic storage import rule is stated as an authority invariant — *learner-facing runtime modules, migration modules, and rollout-control modules must not import diagnostic storage* — with explicit allowed and forbidden lists, replacing the earlier structural phrasing about importer count | §1.6, §10.8 | The rule now names the module classes it protects against, and the test asserts class rather than cardinality |
| 2 | The export step is named as a trust boundary — *exported evidence snapshots are immutable review artifacts and are evaluated outside the runtime authority boundary* — with the four-role division and the four prohibitions on exported evidence | §1.5 | Makes explicit that the runtime authority boundary falls between Persisted and Exported, and that the artifact has no return path into the application |

Adjustment 1 corrects a real weakness rather than only rephrasing one. An
importer-count assertion is wrong in both directions: it fails when a harmless
importer is added, such as an inspection surface, and it passes when a
forbidden importer replaces a permitted one. The invariant is about *which
kinds* of module may read evidence, and the test now says so.

**Unchanged by this review:** Phase 3.8A.1's scope; Decisions 001–011;
Decisions 012–014, which remain proposals and are not accepted here; rollout
configuration, still `disabled`; and Phase 3.8B, which remains blocked until
evidence completeness is implemented.
