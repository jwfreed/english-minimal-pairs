# Phase 3.8 Stabilization Plan

Date: 2026-07-31
Revised: 2026-08-01 — safety-gate design review
Branch: `docs/phase-3-migration-strategy` (evidence gathered at `276b714`;
review evidence at `ed6fd3b`)
Status: **Authoritative planning document.** WP-3.8A completion is recorded
below. All other packages remain proposed and require their stated approval
and evidence gates.

**2026-08-01 revision.** The WP-3.8B design review
(`docs/Phase-3.8B-Safety-Gate-Evidence-Model.md`) found that the safety gate
cannot be wired to the WP-3.8A snapshot as either is currently written:
missing evidence would present as success, and reliability fields would be
unsatisfiable. The revision adds **WP-3.8A.1** as a prerequisite
evidence-completeness package, records new gaps G9–G11, and re-sequences
WP-3.8B behind it. Three proposed Decisions (012–014) are recorded in
`docs/Contrast-Domain-Architecture-Decisions.md` under "Proposed Decisions —
not accepted" and require human approval before either package proceeds.

No runtime behavior, rollout state, migration activation, or accepted Decision
changed in this revision. WP-3.8A's completion record below is unmodified: the
package delivered what it was scoped to deliver, and WP-3.8A.1 is additional
scope identified afterward, not a defect in it.

This plan is a peer of `docs/Phase-3.8-Architecture-Audit.md` and is scoped by
Decision 011 (`docs/Contrast-Domain-Architecture-Decisions.md`): compatibility
retirement requires operational evidence, not implementation readiness or
phase completion. Nothing here proposes retirement. Nothing here changes
Phase 3.8's status as recorded in `Contrast-Domain-Architecture-Evolution
Plan.md`.

---

## Architectural Hardening Invariants

These three invariants govern every work package below. They were identified
as necessary before any Phase 3.8 code work begins, and any package that
would violate one is out of scope as written and must be redesigned before
implementation.

### 1. Diagnostic evidence is operational metadata, not learner state

Diagnostics exist to produce rollout confidence, never to reconstruct or
influence what a learner has mastered.

- Diagnostics may record: rollout observations, divergence *categories* (not
  values that reconstruct mastery), safety-gate evidence, and operational
  failure outcomes.
- Diagnostics must never contain enough data to reconstruct mastery state —
  no per-`ContrastId` tier values, no full mastery maps, no raw legacy
  payloads. Where a count or a category is sufficient evidence, only the
  count or category is recorded.
- Diagnostics must not become a second source of truth. No code may read
  diagnostic storage to decide learner-visible behavior, mastery content, or
  rollout eligibility for a specific learner. Diagnostics are write-mostly:
  produced by learner-state operations, consumed only by the operator-facing
  inspection surface and the safety gate's evidence input.
- Losing, corrupting, resetting, or failing to persist diagnostics may reduce
  rollout *confidence* — it must never affect learner progress, mastery
  correctness, or any write to a learner-state key. This extends the existing
  isolation contract at
  [masteryRolloutDiagnostics.ts:137-147](../src/analytics/masteryRolloutDiagnostics.ts#L137-L147),
  which already prevents a broken diagnostic sink from throwing into a
  caller; the persisted store must inherit the same guarantee.
- Diagnostic persistence must live in its own storage key, entirely separate
  from every learner-state key (`@mastery_*`, `@masteryByContrast_*`,
  `@masteryByContrastMigration_*`, `@pairProgress_v2`,
  `@placementDone_*`), so an operator can inspect or clear diagnostics
  without any possibility of touching learner data.
- No answers, audio, free text, attempt histories, or mastery records may be
  stored in diagnostic persistence, full stop. This is stricter than "must
  not be enough to reconstruct mastery" — these categories are prohibited
  even in a form that alone would be harmless, because diagnostic payloads
  accumulate over a device's lifetime and prohibition-by-category is the only
  rule that stays true under that accumulation.

### 2. Migration remains an explicit domain operation

Migration is a decision the system makes visibly, not a side effect a caller
discovers by accident.

- Migration may be triggered by controlled runtime workflows — for example, a
  category-load workflow that, after reading stable state, explicitly decides
  to invoke migration. What migration must **not** be is a write hidden
  inside a function whose name and contract promise only a read.
- Stable reads remain deterministic and explainable: calling a read function
  twice in a row without any intervening explicit operation must not have
  side effects the caller cannot see in the read's own return value. A "read"
  API answers "what is stored," not "what should now be stored."
- The required shape is:

  ```
  read → determine state → explicitly invoke migration → persist → return result
  ```

  not:

  ```
  read → silently migrate → persist → return
  ```

  Concretely: the function that answers "what is the learner's stable
  mastery" and the function that answers "should this language be migrated,
  and did it succeed" must be distinct, separately named, and separately
  callable — even when a single orchestrating workflow calls both in
  sequence on every category load. The orchestration may be automatic and
  frequent; the operation boundary must still be honest.
- Migration success and failure remain observable through the diagnostics
  boundary above (as categorized outcomes, not learner data).
- Retry behavior remains explicit: a migration attempt has a defined
  in-flight and attempted-this-session state, not an implicit "try again next
  time a read happens to occur" behavior indistinguishable from the read
  path itself.
- Historical identity resolution continues through the existing migration
  pathways (`historicalIdentityMapping`, `migrateLanguageMastery`) — this
  invariant does not introduce a new resolution mechanism, it constrains
  *how* the existing one is invoked.

### 3. Rollout advancement is a human-controlled release decision

The application may measure and report; it may never decide for itself.

- Safety gates (`evaluateMasteryRolloutSafetyGate` and any evidence pipeline
  built around it) produce evidence and a recommendation. They are pure
  evaluators of evidence already collected.
- Safety gates do not mutate rollout configuration, under any circumstance,
  including a unanimous "all clear" result. There is no code path in this
  plan in which a gate's output writes to `CONTRAST_MASTERY_ROLLOUT_STATE` or
  any equivalent.
- Rollout transitions remain explicit release decisions: a human edits
  `featureFlags.ts` (or an equivalent build-time constant) and ships a
  release. This is unchanged from the existing architecture
  ([featureFlags.ts:12-19](../src/config/featureFlags.ts#L12-L19), which
  already documents rollout as "a local build-time release decision").
- No automatic `disabled → shadow → internal-test → limited → enabled`
  progression exists, or may be introduced by any package in this plan.
- The application may report readiness (via the diagnostics/gate surface) but
  must not self-enable migration, self-advance rollout, or otherwise change
  its own operating mode based on its own evidence.

---

## Authority Boundary Invariant

The three invariants above each constrain one component's *behavior*. This
invariant states the property they exist to jointly guarantee, and is the
lens every work package below must be checked against before implementation.

During Phase 3.8:

- Diagnostics observe learner-state behavior but do not influence it.
- Migration orchestrators transform state but do not redefine domain
  ownership.
- Rollout gates evaluate evidence but do not activate themselves.
- Stable mastery remains the only future authority candidate.

**No Phase 3.8 component may create a second learner-state authority.**

### Reason

This captures the central risk this architecture has been managing since
Phase 3.5: dual authority. The biggest architectural danger at this stage is
not data loss — the legacy-first write ordering and blocked-read policy
already guard against that. The danger is **two competing systems both
believing they own mastery semantics**: a diagnostic store that starts being
consulted for learner-facing decisions, a migration orchestrator that starts
writing its own opinion of mastery independent of the reconciliation rules in
`contrastMasteryPersistence.ts`, or a rollout gate that starts acting on its
own evidence. Each of the three invariants above is, individually, a specific
instance of preventing exactly this. Stating it once, explicitly, is meant to
catch a fourth or fifth instance that a future package might introduce
without recognizing it as the same risk.

This is also the formal statement underlying two things already elsewhere in
this plan: the WP-3.8G "anti-forking rule" (Phase 4 Readiness, above) is this
invariant applied specifically to the `useContrastPairs` dual-branch, and the
requirement that `readCompatibleMastery` gain no hidden write (Migration
Wiring Recommendation, Option A vs. the rejected A′) is this invariant
applied specifically to the migration orchestration boundary. Any future
work package must be checked against this invariant directly, not only
against whichever of the three narrower invariants seems closest.

---

## Ownership Boundaries

The three invariants above describe *what* must hold. This section assigns
*who* is architecturally responsible for keeping each one true. "Ownership"
here means architectural responsibility — which layer of the system a given
concern belongs to — not necessarily a named individual or team. Its purpose
is to prevent a future change from drifting a concern into the wrong layer
(for example, a diagnostic write creeping into a domain module, or a rollout
decision creeping into a storage function) simply because no boundary was
written down.

### Diagnostic evidence ownership

**Owned by the observability/operations layer** — the code paths and
surfaces described in WP-3.8A, not the domain or storage layers that produce
the events being observed.

Responsibilities:

- Define diagnostic schemas (the event shapes, categories, and retention
  rules in the Evidence Pipeline Recommendation).
- Store rollout evidence, in a key disjoint from every learner-state key.
- Preserve operational visibility — make evidence inspectable and
  exportable.
- Never influence learner state. This layer has no write access to any
  learner-state key, and no learner-facing code path reads from it.

Diagnostics are observational only. This layer watches; it does not act.

### Migration orchestration ownership

**Owned by the domain migration layer** — `historicalIdentityMapping`,
`contrastMasteryPersistence`, `migrateLanguageMastery`, and the WP-3.8C
orchestration function. Not the storage adapters
(`contrastMasteryStorage.ts`, `masteryCompatibility.ts`'s read primitives),
which remain simple read/write mechanisms with no migration decision logic
of their own.

Responsibilities:

- Resolve historical identities through the existing alias table.
- Perform explicit migrations, invoked as a separately named operation per
  the migration-orchestration invariant.
- Manage retry semantics (in-flight guards, attempted-this-session state).
- Preserve learner-state invariants — reset tombstones, placement lowering,
  and the Decision 008 rollback guarantee are never overridden by a
  migration decision.

Migration is a domain operation, not a storage side effect. A storage
function's job is to read or write exactly what it is told; deciding
*whether* a migration should happen belongs one layer up, in the domain
migration layer.

### Rollout transition ownership

**Owned by the release/process boundary** — the human decision recorded in
WP-3.8F, exercised by editing `featureFlags.ts` and shipping a release. Not
owned by any runtime code path, including the safety gate itself.

Responsibilities:

- Review evidence surfaced by the observability layer and the WP-3.8B gate.
- Approve rollout transitions, recorded as a WP-3.8F decision artifact.
- Change rollout configuration — the only layer with that authority.

The application may report readiness but never advance rollout state
automatically. No runtime code path in this plan is permitted to hold this
responsibility, regardless of how conclusive its evidence appears.

---

## Diagnostic Reliability Contract

This section states, in SRE terms, what "diagnostics are operational
metadata, not learner state" (Invariant 1) means for how the diagnostic
pipeline is allowed to fail.

**Diagnostic evidence is best-effort operational metadata.** It is not a
transactional system, it has no durability guarantee stronger than "survives
a normal cold start," and it is explicitly permitted to lose data under
failure conditions that a learner-state store is not permitted to lose data
under.

**Invariant:** *If the diagnostic pipeline is unavailable, learner-state
behavior must remain unchanged.*

**Allowed diagnostic-failure impact:**

- Reduced rollout confidence — a gate evaluation with fewer or gapped
  observations.
- Missing operational evidence — an outcome that should have been recorded
  was not.

**Not allowed, under any diagnostic failure:**

- Learner progress loss.
- Failed learner operations (a mastery read, write, reset, or placement
  action must never fail *because* a diagnostic write failed).
- Migration corruption — a diagnostic failure must never leave a stable
  mastery document or migration marker in a partial or inconsistent state.
- Blocking reads or writes — no learner-facing operation may await, retry
  on, or be gated by diagnostic persistence.

**Operational requirements this implies for WP-3.8A:**

- Diagnostic writes must fail independently of the learner-state operation
  that triggered them — a `try/catch` (or equivalent) boundary around the
  diagnostic call, not a shared transaction or awaited chain with the
  learner-state write.
- Diagnostic storage failures must be visible — recorded as a diagnostic
  event about diagnostics themselves (e.g. via the existing
  `storage-failure` event shape), inspectable on the WP-3.8A surface, even
  though the underlying write did not persist.
- Diagnostic retries must not affect learner workflows — if a retry
  mechanism is added for diagnostic durability, it must run independently of
  (never blocking, never sharing a queue with) any learner-state write path.
- Diagnostics must never become a prerequisite for correctness — no future
  package may make a learner-visible decision (what mastery to show, whether
  migration ran, whether a reset succeeded) conditional on diagnostic state
  existing or being readable. Diagnostics describe what happened; they are
  never consulted to decide what happens next for a learner.

---

## Executive Recommendation

**What should happen next** *(revised 2026-08-01)*: WP-3.8A is complete.
Complete the diagnostic **producer** model (WP-3.8A.1) before defining the
safety-gate evidence contract (WP-3.8B). The design review found that a gate
wired to today's snapshot would report success on conditions nothing observed
(G9) and would become permanently unsatisfiable after one transient storage
failure (G10) — so WP-3.8B cannot safely proceed until the evidence it
consumes is dimensionally complete and until proposed Decisions 012–014 are
approved. In parallel — because it is read-only and independent — run the
label-derived learner-state audit (WP-3.8D).

**Why the ordering matters:** a safety gate is only as trustworthy as the
evidence handed to it. Implementing WP-3.8B first would produce a gate that
looks operational, is consulted by humans, and is wrong in the unsafe
direction — which is worse than having no gate at all, because it converts an
acknowledged absence of evidence into an apparent presence of it.

**What must not happen yet:** No rollout state advance, no compatibility
retirement, no placement migration implementation, no `ProgressUpdater`
extraction, and — per the hardening invariants above — no migration logic
embedded as a hidden side effect inside a read function, and no code path by
which the app changes its own rollout state.

**Phase 4:** Remains blocked for `ProgressUpdater` only. Scheduler / Evaluator
/ AnalyticsEmitter work is **not** blocked and can proceed independently.

**Revision note on migration wiring:** the prior draft of this plan
recommended wiring `migrateLanguageMastery` directly into
`readCompatibleMastery`'s missing-stable branch, so that a read call would
transparently trigger a write. Under the migration-orchestration invariant
above, that shape is rejected as written: a read function must not silently
migrate. The Migration Wiring Recommendation section below replaces that
design with an explicit orchestration step that preserves the same
learner-visible timing (mastery is still recovered promptly after upgrade)
while keeping the read primitive itself deterministic and side-effect-free.

---

## Repository Facts

Verified at `276b714`. `npm test` → 431 assertions pass, 0 failures.

| # | Fact | Evidence |
|---|---|---|
| F1 | Rollout state is `disabled` | [featureFlags.ts:18](../src/config/featureFlags.ts#L18) |
| F2 | `useContrastPairs` is the only production consumer of the 3.5–3.7 surface | repo-wide grep |
| F3 | Rollout metrics are a module-level in-memory object, reset on cold start | [masteryRolloutDiagnostics.ts:70-85](../src/analytics/masteryRolloutDiagnostics.ts#L70-L85) |
| F4 | `evaluateMasteryRolloutSafetyGate` has no caller in `src/` or `app/` | grep |
| F5 | `writeCompatibleMastery` writes only the stable document — never the migration marker | [masteryCompatibility.ts:912](../src/storage/masteryCompatibility.ts#L912) |
| F6 | `migrateLanguageMastery` and `adoptOrphanedMasteryForLanguage` have no production caller; the latter is test-asserted | [orphanMasteryAdoption.test.js:1270](../scripts/orphanMasteryAdoption.test.js#L1270) |
| F7 | Missing-stable fallback reads only the current label, not alias sources | [masteryCompatibility.ts:649](../src/storage/masteryCompatibility.ts#L649) vs `readLegacySourcesForLanguage` at [:112](../src/storage/masteryCompatibility.ts#L112) |
| F8 | Placement completion is label-keyed with no alias resolution | [masteryPersistence.ts:21](../src/domain/masteryPersistence.ts#L21) |
| F9 | Placement *tier* is written through mastery, so it inherits identity protection | `setAllGroupsToTier` → [useContrastPairs.ts:153](../src/hooks/useContrastPairs.ts#L153) |
| F10 | `@pairProgress_v2` keys embed the mutable label: `${category}__${group}__${w1}_${w2}` | [idHelpers.ts:11](../utils/idHelpers.ts#L11) |
| F11 | Results and recommendations rebuild pair keys with the current label | [results.tsx:148](<../app/(tabs)/results.tsx#L148>), [recommendNextPractice.ts:56](../utils/recommendNextPractice.ts#L56) |
| F12 | Gate evidence has 16 fields; runtime metrics has 12; ~9 gate fields have no runtime producer | [masteryRolloutSafety.ts:1-18](../src/domain/masteryRolloutSafety.ts#L1-L18) vs [masteryRolloutDiagnostics.ts:51-64](../src/analytics/masteryRolloutDiagnostics.ts#L51-L64) |
| F13 | A `__DEV__`-gated diagnostic screen precedent exists | [TTSDebugScreen.tsx](../src/components/TTSDebugScreen.tsx) |
| F14 | Rename-table sync is test-fenced — not a gap | [historicalIdentityMapping.test.js:161](../scripts/historicalIdentityMapping.test.js#L161) |
| F15 | Diagnostics delivery is already isolated from learner paths | [masteryRolloutDiagnostics.ts:137-147](../src/analytics/masteryRolloutDiagnostics.ts#L137-L147) |
| F16 | Rollout state is already documented as a manual, build-time release decision | [featureFlags.ts:12-19](../src/config/featureFlags.ts#L12-L19) |

---

## Stabilization Gaps

| Gap | Severity | Consequence if unaddressed |
|---|---|---|
| **G1** Evidence is not durable (F3) | Blocking | No gate can ever be satisfied; shadow produces nothing |
| **G2** Evidence cannot leave the device | Blocking | Offline-first + no backend means observed evidence is unreadable by the operator |
| **G3** Gate contract exceeds runtime measurability (F12) | Blocking | "Wire the gate" is ill-defined; 9 fields would silently read 0 and falsely pass |
| **G4** Alias mastery is not seeded on missing-stable (F7) | High | Enabling rollout bakes pre-rename mastery loss into stable records |
| **G5** Markers never created in normal operation (F5) | High | Orphan recovery permanently degraded to additive-only |
| **G6** Placement completion is label-derived (F8) | High | Rename re-shows placement to placed learners |
| **G7** Pair-progress keys are label-derived and not alias-resolved at runtime (F10, F11) | High | Pre-rename attempt history already stranded; explicitly deferred by Decision 008 |
| **G8** No runbook for real-install verification | Medium | Evidence collection would be unrepeatable and unauditable |
| **G9** Missing evidence is indistinguishable from clean evidence | Blocking | Nine gate fields have no producer and read `0`; the gate reports `passed: true` on a build that observed nothing. Safety inversion, not a reporting flaw. |
| **G10** Reliability fields are unsatisfiable as specified | Blocking | `unhandled*` fields name unresolved conditions but read monotonic counters; one transient failure blocks the gate permanently, so it stops being consulted |
| **G11** Persisted evidence lacks the dimensions the transition gates require | Blocking | No cumulative unexplained-divergence counter, no divergence direction, no failure-operation attribution, no `LanguageId`, no cold-start count — so the "≥3 languages, ≥2 cold starts, ≥1 renamed language" row is unmeasurable and the headline blocking counter cannot be aggregated |

Note on G6/G7: these are already-realized, not hypothetical — six renames
have shipped. Nothing is deleted; data is stranded and remains recoverable
through the alias table.

Note on G9–G11 (added 2026-08-01): these are evidence-model gaps, not runtime
defects. Nothing about learner behavior, mastery correctness, or rollback
safety is affected by them — rollout is `disabled` and the gate has no caller.
They block only the ability to make a *trustworthy rollout decision*, which is
precisely what Phase 3.8 exists to produce. G9 and G10 are addressed by
proposed Decisions 012 and 013; G11 is producer work, scoped as WP-3.8A.1.

---

## Proposed Work Packages

### WP-3.8A — Evidence persistence and inspection

- **Objective:** Make rollout diagnostics durable, bounded, exportable, and
  privacy-safe, under the diagnostic-data-boundary invariant.
- **Rationale:** G1, G2.
- **Affected areas:** `src/analytics/masteryRolloutDiagnostics.ts`; a new
  storage module using a dedicated key, disjoint from every learner-state
  key; a new `__DEV__`-gated inspection surface (precedent: F13).
- **Dependencies:** None. **First package.**
- **Non-goals:** No remote telemetry, no new dependency, no rollout-state
  change, no learner-visible surface, no code path that reads diagnostic
  storage to influence mastery, migration, or rollout eligibility.
- **Boundary compliance:**
  - Persisted event shape carries category/outcome/count fields only — no
    per-`ContrastId` tiers, no mastery maps, no raw legacy JSON payloads.
  - The persisted store is write-mostly: consumed only by the inspection
    surface and by evidence assembly for the safety gate, never by any
    learner-facing code path.
  - A diagnostic write failure must be caught at the boundary and must never
    propagate to, delay, or block a mastery read, write, reset, or placement
    action.
- **Risks:** A diagnostic write competing with or delaying a learner write.
  Mitigation: diagnostic persistence is fire-and-forget from the perspective
  of the caller, with its own isolated failure path (extends F15).
- **Verification:** Unit tests for serialize/parse/cap/reset; a test proving
  a throwing or slow diagnostic sink cannot fail or delay a mastery read,
  write, reset, or placement action; a test proving the persisted schema
  rejects or strips any field resembling raw mastery/answer/attempt content.
- **Rollback:** Additive new key + dev-only surface. Revert is code-only; the
  orphaned diagnostics key is inert and must not be auto-deleted.
- **Completion evidence:** Counters survive a cold start; a snapshot can be
  exported from a device; the schema test proves no learner-state category
  can be persisted; tests green.

#### Phase 3.8A completion status — 2026-07-31

**Implemented:**

- An isolated, versioned diagnostic storage boundary disjoint from every
  learner-state key.
- Bounded persistence: a 100-entry recent-event ring and a diagnostic write
  backlog capped at one active write plus 100 pending events. New events are
  dropped when the backlog is full; diagnostics never block learner work.
- Failure-isolated, fire-and-forget writes with storage failures observable
  through the existing in-memory diagnostic metrics.
- Strict schema projection and validation that admit only enumerated
  operational outcomes and counts and strip unknown payload fields.
- Explicit `recordDiagnosticEvent(...)` and `getDiagnosticSnapshot(...)`
  operational APIs with deterministic serialization and safe malformed-data
  handling.

Diagnostic loss is an accepted degradation mode and must never affect
learner-state correctness.

**Verified:**

- Missing, malformed, unavailable, stalled, or process-lost diagnostics do
  not fail or delay learner-state behavior.
- Diagnostic persistence cannot store learner state or reconstruct mastery.
- No learner-facing code reads diagnostics, so diagnostics cannot influence
  mastery, migration, placement, or rollout decisions.
- Rollout remains a human-controlled build-time decision and remains
  `disabled` in the production configuration.

**Deferred:**

- Safety-gate evidence consumption and provenance mapping (WP-3.8B).
- Any rollout advancement or migration orchestration.
- Production evidence collection and release-window evaluation.

### WP-3.8A.1 — Diagnostic evidence completeness *(added 2026-08-01; prerequisite to WP-3.8B)*

- **Full proposal:** `docs/Phase-3.8A.1-Evidence-Completeness-Proposal.md`
  (2026-08-01, revised same day after architecture review) — schema changes,
  producer changes, affected files, migration compatibility, test strategy,
  verification criteria, risks, and rejected alternatives. The summary below is
  the plan-level entry; that document is authoritative for the package's
  design. **Approved in direction**; implementation still awaits resolution of
  proposed Decisions 012–014 at the order-3 checkpoint below.
- **Boundaries established by that proposal**, and binding on every later
  package in this plan:
  - **Evidence lifecycle ownership** — Produced → Persisted → Exported →
    Evaluated → Archived, with exactly one owner per stage. The lifecycle is
    one-directional; no stage may be skipped or merged. Prevents authority
    accumulating in a single layer by increments that each look reasonable.
  - **Evidence Consumption Invariant** — *"Safety evidence is not runtime
    control input."* No runtime component may consume safety evidence to change
    learner behavior, modify mastery authority, trigger migration, advance
    rollout state, enable a feature flag, or repair learner state. Runtime
    produces evidence only. This is the Authority Boundary Invariant applied to
    the artifact WP-3.8A.1 creates, written before the evidence store becomes
    rich enough to be tempting to consult.
  - **Ledger ownership** — the diagnostic producer opens conditions, the
    reducer closes them only on observed successful completion, the evaluator
    reads them. Nothing infers a missing resolution, ages a condition out, or
    triggers the work that would close one. The ledger records observed
    operational truth; it is not a workflow engine.
- **Objective:** Complete the diagnostic **producer** model so that the
  evidence a safety gate would consume is dimensionally sufficient, and so
  that a zero reading is distinguishable from an unmeasured one. This package
  finishes the observation layer. It does not evaluate anything.
- **Rationale:** G9, G10, G11, and the design review recorded in
  `docs/Phase-3.8B-Safety-Gate-Evidence-Model.md` §1.
- **Why this is producer work, not safety-gate work.** The gate is a pure
  evaluator; it can only be as trustworthy as the evidence handed to it. Every
  gap G9–G11 is a fact the *diagnostic layer never recorded* — an undirected
  divergence total that cannot answer "which way did the tier move," an
  undifferentiated storage-failure scalar that cannot answer "which side
  failed," a failure counter with no corresponding recovery counter, an event
  with no `LanguageId`. None of these can be recovered by evaluating harder.
  Attempting to compensate inside the gate would mean inferring unrecorded
  facts from recorded ones, which is exactly how a gate acquires an opinion of
  its own and becomes a second authority. Per the Ownership Boundaries section
  above, diagnostic schemas and stored evidence are owned by the
  observability/operations layer; this package stays inside that layer.
- **Scope:**
  - **Counter decomposition** — cumulative counters for each condition the
    gate names, replacing aggregate scalars that erase the distinction. Notably
    a cumulative unexplained-divergence counter: the bounded recent-event ring
    is not a valid aggregation source, because once it wraps, summing it
    under-reports silently and always in the safe-looking direction.
  - **Event direction** — divergences counted by kind, including which side is
    higher and which side is absent, so mastery increase and decrease are
    separable.
  - **Operation attribution** — storage failures counted per operation, so
    stable-side and legacy-side reliability are separable.
  - **Language identity** — `LanguageId` on persisted events and bounded
    per-language observation counts, so "which languages were exercised" and
    "was a renamed language exercised" become answerable.
  - **Cold-start tracking** — a cold-start counter, so restart-spanning
    evidence gates become answerable.
  - **Convergence tracking** — recovery recorded alongside failure, per
    identity, so unresolved state is measurable (proposed Decision 013).
    Best-effort and failure-isolated like every other diagnostic write.
  - **Schema evolution** — a schema version bump if the above requires one,
    accepting that older snapshots become unreadable and are discarded.
- **Boundary compliance:** every added field is a count, an enumerated
  category, or a registry identity. No per-`ContrastId` tier, no mastery map,
  no raw legacy payload, no attempt history, no timestamp, no device or user
  identifier. `LanguageId` is an immutable registry identity (Decision 003) and
  states *which language was exercised*, never *what the learner knows*.
  Per-language observation counts are bounded by the contrast registry, so the
  store stays size-capped. The store remains write-mostly and disjoint from
  every learner-state key.
- **Explicitly excluded** — this package does **not**:
  - advance or change rollout state, or add any code path that could
  - activate, wire, schedule, or trigger migration or orphan adoption
  - change learner-visible behavior in any way
  - change runtime authority — legacy remains the sole authority, stable
    mastery remains the only future authority candidate
  - evaluate evidence, define thresholds, or produce a recommendation — all of
    that is WP-3.8B
  - add remote telemetry, a new dependency, or a learner-facing surface
- **Dependencies:** WP-3.8A (complete). Blocks WP-3.8B.
- **Risks:** Scope drift into evaluation logic — a counter that "knows" what a
  safe value is has crossed into the gate's layer. Mitigation: this package
  adds no comparison, no threshold, and no boolean derived from a threshold.
  Second risk: convergence tracking introducing state that a learner write
  waits on. Mitigation: convergence records are diagnostic writes under the
  existing Diagnostic Reliability Contract — fire-and-forget, failure-isolated,
  never awaited by a learner path, and losing them degrades confidence only.
- **Verification:** Every WP-3.8A isolation test still passes with the added
  counters, including for convergence tracking — a throwing or slow diagnostic
  sink still cannot fail or delay a mastery read, write, reset, or placement
  action. Schema tests prove the extended shape still rejects learner-state
  categories and accepts only registry-known language keys. A test proves the
  cumulative counters, not the recent-event ring, are the aggregation source. A
  test proves clearing diagnostics has zero effect on any learner-state key.
- **Rollback:** Additive counters behind a schema version bump; revert is
  code-only. An orphaned diagnostics key is inert and must not be auto-deleted.
- **Completion evidence:** Every field the WP-3.8B evidence catalogue marks as
  runtime-measured has a real cumulative producer; every reliability field has
  both a failure and a recovery producer; per-language and cold-start counts
  survive a cold start; isolation and schema tests green; rollout state
  unchanged and still `disabled`.

### WP-3.8B — Safety-gate evidence contract and human-controlled reporting

> **Status (2026-08-01): blocked on WP-3.8A.1 and on approval of proposed
> Decisions 012–014.** The design is drafted in
> `docs/Phase-3.8B-Safety-Gate-Evidence-Model.md`. It must not be implemented
> against the current snapshot shape: doing so would wire a gate that reports
> success on unmeasured conditions (G9) and that becomes permanently
> unsatisfiable after one transient storage failure (G10). The objective and
> scope below are revised to match that design.

- **Objective:** Define which gate fields are runtime-measured, which are
  harness-attested, which are manually attested, and which are `unknown`; wire
  only the runtime-measured subset to real counters; replace the binary
  `{passed, blockers}` result with a three-valued recommendation; ensure the
  gate's output is read-only with respect to rollout state and structurally
  incapable of expressing advancement.
- **Rationale:** G3, G9, G10, and the human-control invariant. Formalized as
  proposed Decisions 012 (provenance; unknown never evaluates as zero), 013
  (reliability evaluates unresolved state), and 014 (advisory gate;
  three-valued output).
- **Affected areas:** `src/domain/masteryRolloutSafety.ts` (contract,
  provenance typing, and the three-valued result — the function must remain
  pure and gains no I/O); a new pure evidence-assembly module; an
  operator-facing report path; a release decision artifact under `docs/`.
  WP-3.8A's snapshot shape is **not** modified here — that is WP-3.8A.1.
- **Dependencies:** WP-3.8A, **WP-3.8A.1**, and human approval of proposed
  Decisions 012–014.
- **Non-goals:** The gate must not alter rollout state and must not be given
  any write capability. It has no caller that could feed its result back
  into `featureFlags.ts` or any runtime configuration. It produces an
  evidence report and a recommendation for a human to act on — nothing in
  this package authorizes or implements automatic advancement.
- **Boundary compliance:**
  - The gate's evidence input is assembled read-only from WP-3.8A's
    persisted snapshot; the gate never writes to that snapshot.
  - The gate's output type explicitly cannot express a rollout-state
    mutation — it is a report, not a command.
  - Any surface that displays the gate's result (the WP-3.8A inspection
    screen) is presentation only; advancing rollout remains a manual code
    change and release, per F16.
- **Risks:** Silently treating unmeasured fields as passing — the G9 failure.
  Mitigation: unmeasured fields carry an explicit `unknown` provenance that
  resolves to `INSUFFICIENT_EVIDENCE`, never to a pass, and a zero reading
  whose producer never ran is `unknown` rather than satisfied. Second risk:
  the gate compensating for missing producers by inferring facts the
  diagnostic layer did not record — that is how a gate acquires an opinion and
  becomes a second authority. Mitigation: producer gaps are closed in
  WP-3.8A.1, never inside the gate.
- **Verification:** A test asserting that a field with no runtime producer
  cannot be reported as satisfied by absence; a table-driven test over the
  full field set asserting `unknown` never yields `READY`, so a field added
  later without a producer fails by default; a test asserting an all-zero,
  all-witnesses-unmet evidence object yields `INSUFFICIENT_EVIDENCE` rather
  than the `passed: true` the current gate would return; convergence tests for
  the reliability fields; an import-graph test confirming the gate's
  transitive imports contain no writer, no storage, and no feature-flag value;
  a type-level check confirming the output cannot express advancement.
- **Rollback:** Pure additive typing/reporting; revert is code-only.
- **Completion evidence:** Every evidence field has a documented producer or
  an explicit `unknown` classification; the recommendation is three-valued;
  gate evaluation on a real snapshot is reproducible and identifies the
  evidence it evaluated; no code path exists from gate output to rollout
  configuration, migration, or learner state.

### WP-3.8C — Explicit migration orchestration for missing-stable state

- **Objective:** Introduce an explicit, separately named orchestration step
  that — only when invoked — checks stable state and, if missing, invokes
  `migrateLanguageMastery` and returns the result. This replaces the
  previously proposed design of embedding migration inside the read
  function's missing-stable branch.
- **Rationale:** G4, G5, and the migration-orchestration invariant. Closes
  the only path that recovers pre-rename mastery (F7) without making the
  read primitive lie about its own contract.
- **Affected areas:** A new orchestration function (naming illustrative only,
  not an implementation commitment — e.g. `ensureLanguageMasteryMigrated`),
  called explicitly by the workflow that loads a category in
  `useContrastPairs`; `readCompatibleMastery` itself is **not modified** to
  add a write.
- **Dependencies:** WP-3.8A (so outcomes are observable). Must not ship
  before shadow evidence exists.
- **Non-goals:** Never invoked in `disabled` or `shadow`. No startup scan, no
  background work, no orphan adoption, no bulk migration, and — explicitly —
  **no write added to `readCompatibleMastery` or any other function whose
  name and existing contract promise a read.**
- **Required shape:**

  ```
  1. call the existing, unmodified readCompatibleMastery (read)
  2. inspect its status (determine state)
  3. if status is exactly "missing" and rollout is authoritative,
     explicitly call the orchestration function, which itself calls
     migrateLanguageMastery (explicitly invoke migration)
  4. the orchestration function persists via the existing
     migrateLanguageMastery write path (persist)
  5. the calling workflow uses the orchestration function's returned
     document (return result)
  ```

  The calling workflow (inside `useContrastPairs`'s load effect) is where the
  automatic, frequent triggering lives — that is acceptable and matches
  "may be triggered by controlled runtime workflows." What is not acceptable
  is triggering it from inside the read function itself, where a caller
  reading state would have no way to know a write might occur.
- **Risks:** A caller elsewhere in the codebase calling `readCompatibleMastery`
  directly and expecting the orchestration behavior "for free," then silently
  not getting alias recovery. Mitigation: `readCompatibleMastery` remains
  documented as read-only; the orchestration function is the only supported
  entry point for triggering recovery, and is the one `useContrastPairs`
  calls. Concurrency and marker-write risks are otherwise the same as the
  prior design (in-flight guard per `(LanguageId, session)`; whole-document
  `setItem` atomicity is unchanged).
- **Verification:** Tests for — shadow never invokes the orchestration
  function; a renamed language recovers alias mastery when the workflow
  invokes it; migration failure inside the orchestration function falls back
  to today's missing-stable legacy behavior rather than blocking; at most one
  attempt per `(LanguageId, session)`; retry converges after a partial write;
  a direct call to `readCompatibleMastery` alone never writes anything,
  proving the read/orchestrate separation holds.
- **Rollback:** Rollout state to `disabled` restores legacy authority
  immediately; stable and marker records remain and are re-validated, never
  deleted.
- **Completion evidence:** A renamed-language install shows recovered
  mastery and a created marker after the orchestration function runs;
  diagnostics record the outcome; `readCompatibleMastery` has zero new write
  paths.

### WP-3.8D — Label-derived learner-state identity audit (read-only)

- **Objective:** Complete inventory and bounded recommendation for every
  label-derived persisted learner state.
- **Rationale:** G6, G7. Scope must be known before Phase 4.
- **Affected areas:** Documentation only.
- **Dependencies:** None. Can run in parallel with WP-3.8A.
- **Non-goals:** No implementation, no schema change, no new identity system,
  no pair-progress rewrite (barred by Decision 008).
- **Risks:** Scope creep into a general identity redesign. Mitigation: the
  deliverable is a table plus one bounded recommendation per row.
- **Verification:** Peer review against the key inventory in this plan.
- **Rollback:** N/A (documentation).
- **Completion evidence:** Table below is confirmed complete, with each row
  classified required / pre-Phase-4 / deferrable.

### WP-3.8E — Shadow real-install runbook

- **Objective:** A repeatable procedure for producing and capturing shadow
  evidence.
- **Rationale:** G8. Evidence must be auditable and reproducible.
- **Affected areas:** Documentation only.
- **Dependencies:** WP-3.8A, WP-3.8B.
- **Non-goals:** No automation, no cohort infrastructure, no auto-collection
  that itself decides to advance anything.
- **Risks:** Confounded evidence if a state-mutating operation (orphan
  adoption, the WP-3.8C orchestration function) runs mid-collection.
  Mitigation: the runbook must require recording every explicit operation
  invoked during a collection window.
- **Verification:** A second person can follow it and produce a comparable
  snapshot.
- **Completion evidence:** One completed run recorded, including at least
  one renamed language.

### WP-3.8F — Rollout advancement decision record

- **Objective:** Per-transition decision artifact capturing evidence, gate
  result, and the human approver — the explicit mechanism by which the
  human-control invariant is exercised in practice.
- **Dependencies:** WP-3.8B, WP-3.8E.
- **Non-goals:** Not a code change; does not itself advance rollout; is not
  and must not become an automated approval mechanism.
- **Risks:** Advancing on implementation confidence rather than evidence —
  the exact failure Decision 011 exists to prevent.
- **Completion evidence:** One signed artifact per transition attempted,
  produced by a human reading a gate report and manually editing
  `featureFlags.ts`.

### WP-3.8G — Mastery authority extraction *(Phase 4 unblocker; approval-gated, likely post-3.8)*

- **Objective:** Move the dual-authority branch out of `useContrastPairs`
  into a single mastery-authority module so exactly one implementation
  exists.
- **Rationale:** Prevents Phase 4 from forking the compatibility contract.
- **Dependencies:** WP-3.8C, and a rollout state held stable long enough to
  prove the authority boundary.
- **Non-goals:** Not a `ProgressUpdater`; not a Phase 4 deliverable; no
  behavior change.
- **Risks:** Attempting this while both authority modes are live re-creates
  the fork it is meant to prevent.
- **Verification:** Existing hook tests pass unchanged; no second write path
  introduced.

---

## Evidence Pipeline Recommendation

| Option | Evidence quality | Privacy | Complexity | Persistence | Testability | Verdict |
|---|---|---|---|---|---|---|
| Session counters only (today) | Very low | Safe | None | None | High | **Insufficient** |
| Persisted local snapshot | Good | Safe if constrained | Low | Survives restart | High | **Recommend** |
| Exportable dev diagnostics | Required to read evidence | Safe | Low | N/A | Medium | **Recommend** |
| Existing analytics sink | N/A | — | — | — | — | **Reject** — no transport exists |
| Dev-build surface | Good | Safe | Low | N/A | Medium | **Recommend** (precedent F13) |
| Manual verification workflow | Necessary context | Safe | None | N/A | N/A | **Recommend** |
| Remote telemetry | High | Poor fit | High | — | — | **Reject** — out of scope, no backend |

**Recommended shape, under the diagnostic-data-boundary invariant:**

- **Recorded:** the existing counters, plus per-field provenance, plus a
  bounded ring of recent structured *outcomes* — event name, status/reason
  enum, `LanguageId`, rollout state, monotonic sequence. No tier values, no
  mastery maps, no legacy payload bytes.
- **Excluded, enforced by test:** audio, learner answers, free text, word
  content, mastery tier values, raw legacy JSON, attempt histories, precise
  timestamps that could reconstruct a session, and any device or user
  identifier.
- **Storage:** one dedicated AsyncStorage key, versioned, disjoint from every
  learner-state key. Diagnostics are never read by any learner-facing code
  path — they are a write-mostly operational log.
- **Retention:** fixed-size ring (propose 100 entries, mirroring
  `MAX_ATTEMPTS_PER_PAIR`) plus cumulative counters; oldest entries dropped
  first.
- **Reset:** explicit operator action only. Never cleared automatically,
  never on upgrade. Clearing diagnostics has zero effect on any learner-state
  key — this is the practical test of "losing diagnostics never affects
  learner progress."
- **Isolation:** extends the existing guarantee (F15) — a diagnostic write
  failure must never surface to a learner path, and must never be retried in
  a way that competes with a learner write.
- **Inspection:** `__DEV__`-gated surface with copy/share of a JSON snapshot.
  This surface may also render the WP-3.8B gate's recommendation, but
  rendering a recommendation is not the same as acting on it — there is no
  button on this surface that changes rollout state.

---

## Migration Wiring Recommendation

| Option | Latency | Read side effects | Idempotent | Rollback | Marker | Alias recovery | Orchestration boundary | Verdict |
|---|---|---|---|---|---|---|---|---|
| **A** Explicit orchestration on missing-stable | Small, first access per language | **None inside the read function** — the write lives in a separately named, explicitly invoked function | Yes (fingerprint) | Safe, additive | Yes | Yes | **Honored** — read stays pure | **Recommend** |
| **A′ (rejected)** Read-time write embedded in `readCompatibleMastery` | Small | Yes, hidden inside the read | Yes | Safe, additive | Yes | Yes | **Violated** — read silently migrates | **Rejected** — superseded by A |
| **B** Operator-invoked only | None | No | Yes | Safe | Yes, rarely | Only when invoked | Honored | Insufficient alone |
| **C** On first mastery write | None | No | Partly | Safe | No | No (F7) | Honored | Reject as primary |
| **D** No migration | None | No | — | Safe | No | No | Honored | Reject — perpetuates G4/G5 |

**Recommendation: Option A, with migration kept behind an explicit
orchestration boundary.** The prior draft of this plan proposed A′: wiring
`migrateLanguageMastery` directly into `readCompatibleMastery`'s
missing-stable branch, so that calling the read function could itself
trigger a write. That violates the migration-orchestration invariant — a
function whose name and existing callers treat it as a read must not
silently become a write under some conditions. A achieves the identical
learner-visible outcome (mastery recovered promptly on first access after
upgrade, for the same reason A′ did — F7 shows the plain read path cannot
recover alias sources on its own) by moving the decision-and-write step into
a distinct, explicitly-invoked function that the calling workflow
(`useContrastPairs`'s load effect) calls as a separate, visible step
immediately after the read.

Exact conditions, all required:

- **Read/write separation:** `readCompatibleMastery` receives no
  modification in this package. It remains exactly what it is today: a
  function that reads and returns, never writes.
- **Orchestration function:** a new, separately named function is the only
  code path that may call `migrateLanguageMastery` in response to a missing
  stable read. It is not itself a "read" function — its name and contract
  say it may write.
- **Stages:** the orchestration function may be invoked by the runtime
  workflow only in authoritative states (`internal-test`, `limited`,
  `enabled`). **Forbidden in `shadow` and `disabled`** — preserves the
  shadow read-only invariant.
- **Trigger condition:** the calling workflow invokes orchestration only when
  the prior read's status is exactly `missing`. Never on `malformed`,
  `unsupported-version`, or `storage-error`, which continue to block per
  existing policy.
- **Ordering:** the calling workflow awaits the orchestration function's
  result before rendering, so a learner sees recovered alias mastery
  immediately rather than after a delay — the same user-visible timing as
  the rejected A′ design, achieved through an explicit second call instead
  of a hidden branch in the first.
- **Failure:** any non-success outcome from the orchestration function
  causes the calling workflow to fall back to today's missing-stable legacy
  behavior and emit a diagnostic. Migration failure must never block the
  practice screen or empty the learner's view.
- **Retry:** at most one orchestration attempt per `(LanguageId, app
  session)`, guarded by an in-flight promise plus an attempted set owned by
  the orchestration function, not by the read function. No in-session retry
  loop; natural retry on next cold start.
- **Concurrency:** the per-language in-flight guard must prevent two mounts
  racing a whole-document `setItem`.
- **Marker:** created by the existing `migrateLanguageMastery` write ordering
  (stable first, marker second), making markers normal operation and closing
  G5.
- **Diagnostics:** every orchestration outcome recorded via the WP-3.8A
  pipeline, including `already-current`, so evidence distinguishes "migrated"
  from "nothing to do." Recorded as a category/outcome, never as the mastery
  content itself, per the diagnostic-data-boundary invariant.
- **Observability:** because the orchestration function is separately named
  and separately testable, its success/failure is directly assertable in
  tests without needing to infer it from `readCompatibleMastery`'s behavior —
  this is the concrete benefit of keeping the boundary explicit.

---

## Placement Identity Assessment

| Dependency | Identity basis | Historical risk | Migration needed? | Blocking? |
|---|---|---|---|---|
| `@placementDone_${categoryLabel}` | Mutable display label, no alias resolution | **Realized** — 6 renames shipped | Yes — `LanguageId` key + alias-fallback read | Not 3.8; **before Phase 4** |
| Placement tier result | Written through mastery (`setAllGroupsToTier`) | Protected by alias table and stable `provenance: 'placement'` | No | No |
| `@placementDone` (global) + sentinel | Global, label-independent, one-way | None | No | No |
| `@pairProgress_v2` internal keys | Label + content derived | **Realized** — stranded pre-rename history (F10, F11) | Explicitly deferred by Decision 008 | No — deferred |
| `@userLanguage` | Stores the label; `LANGUAGE_KEY_MIGRATION` applied | Low — sync is test-fenced (F14) | No | No |
| `@mastery_${categoryLabel}` | Label-derived but alias-resolved in compatibility layer | Mitigated (pending WP-3.8C) | Covered by 3.8C | No |
| `@sessionTimer*`, `@hasSeenOnboarding`, settings/theme/voice keys | Global or preference, not learner progress identity | None | No | No |

**Recommendation:** Placement needs stable `LanguageId` keying with a
label-alias fallback read — mirroring the proven mastery pattern, and subject
to the same migration-orchestration invariant established above (an explicit
orchestration step, not a hidden read side effect). It does not need a new
`PlacementId` (completion is per-language, not per-contrast) and does not
need `ContrastId`.

**Classification:** Safe as a separate, small pre-Phase-4 package. The audit
(WP-3.8D) belongs in Phase 3.8; the implementation does not. It is not
deferrable indefinitely — every future rename compounds it — but it is not on
the rollout critical path, because placement completion is independent of
mastery authority.

---

## Rollout Transition Gates

All numeric values are **PROPOSED defaults**, not measured. They are
deliberately conservative and should be recalibrated by the first real
collection window. **Every transition in this table is executed by a human
editing a build-time constant and shipping a release — no row in this table
describes or authorizes automatic advancement.**

| Transition | Preconditions | Required evidence | Blockers | Rollback trigger |
|---|---|---|---|---|
| **Disabled → Shadow** | WP-3.8A, 3.8B, 3.8E complete | Tests prove shadow performs no learner-state writes; counters survive a cold start; a snapshot exports successfully | Any of 3.8A/B/E incomplete | Any observed learner-state mutation attributable to shadow |
| **Shadow → Internal-test** | Shadow ran on ≥1 real install with real history | `unexplainedDivergenceCount == 0`; `unresolvedMappingCount == 0`; *proposed:* ≥3 languages exercised, ≥2 cold starts, **≥1 renamed language** | Any unexplained divergence; any unresolved identity; any malformed/unsupported stable document | Any nonzero unexplained divergence |
| **Internal-test → Limited** | WP-3.8C shipped and observed; ≥1 rollback drill, ≥1 reset drill, ≥1 placement drill | *Proposed:* ≥1 install-week; 0 unresolved partial writes; 0 unhandled storage failures; 0 reset or placement disagreements; migration outcomes all `migrated`/`already-current` | Any partial write left unconverged; any reset or placement disagreement | Any lost/duplicated mastery, or a failed rollback drill |
| **Limited → Enabled** | Sustained clean window | *Proposed:* ≥2 consecutive releases at `limited` with no rollback and no blocker; support channel quiet | Any gate blocker; any `unknown`-provenance field per WP-3.8B | Any mastery loss, duplication, or unexpected tier movement |

**Framework where numbers are unavailable:** a threshold may be set only
after one collection window establishes the observed baseline; until then
every safety-relevant counter uses zero-tolerance, and volume gates
(`shadowComparisons`, install-weeks) are the only tunable dials.
`missing-stable-record` divergences remain pre-classified as expected
([masteryCompatibility.ts:389](../src/storage/masteryCompatibility.ts#L389))
and must not be counted as unexplained.

**Reporting vs. deciding:** the "Required evidence" column describes what
the WP-3.8B gate and WP-3.8E runbook must show. The gate reporting "passed"
is an input to the human decision recorded in WP-3.8F — it is never itself
the transition.

---

## Compatibility Lifecycle Classification

| Component | Current role | Recommended lifecycle | Retirement evidence required |
|---|---|---|---|
| Legacy mastery reads | Sole authority today | **Likely permanent** (historical mastery reader) | Would require proving no install can hold un-migrated legacy state — unprovable offline |
| Legacy mastery writes | Rollback guarantee | **Retain through compatibility window** | ≥3 releases at `enabled`, gate passing on real evidence, 0 partial writes, and explicit product acceptance that rollback becomes lossy |
| Historical identity mapping / alias table | Runtime identity resolution | **Likely permanent** (append-only, Decision 007) | None — retirement not contemplated |
| `Contrast.legacyGroup` | Binds stable identity to group-keyed UI/scheduler/analytics | **Likely permanent** until Phase 4+ retires `Pair.group` as a runtime key | Full removal of group-keyed runtime consumers |
| Migration markers | Observation ledger; enables idempotent recovery | **Retain through compatibility window**; permanent while legacy writes exist | Retirement of legacy writes first |
| Orphan recovery | Explicit rollback-era recovery | **Likely permanent** as operator tooling | Retirement of legacy writes and legacy reads |
| Pair-progress projection | Read-only bridge, no production consumer | **Retain** — sole `@pairProgress_v2` → `ContrastId` path | None — do not treat "unused" as "removable" |
| Rollout state machinery | Build-time rollout authority | **Retirement candidate after evidence** | `enabled` permanent across multiple releases with no rollback |
| Rollout diagnostics | Evidence producer | **Retirement candidate after evidence** | Compatibility window closed |
| `FEATURE_FLAGS.contrastMasteryStore` | Derived alias, no consumer | **Retirement candidate** (lowest risk in the inventory) | Confirm no consumer at removal time |
| Phase 3.3 harness + golden fixtures | Identity immutability fence | **Likely permanent** | None — retirement not contemplated |
| Placement legacy migration + sentinel | Pre-Phase-3 one-way migration | **Likely permanent** (sentinel is durable one-way state) | Insufficient information |

This table is unchanged from the prior draft; the three hardening invariants
do not alter any retirement classification, only the implementation shape of
WP-3.8A/B/C.

---

## Phase 4 Readiness

**Recommendation: staged scope.** Permit Scheduler / Evaluator /
AnalyticsEmitter work now; gate `ProgressUpdater` on WP-3.8G.

- **Not blocked:** Scheduler, Evaluator, AnalyticsEmitter. None touches
  mastery authority or the compatibility contract.
- **Blocked:** `ProgressUpdater`. Extracting it while `useContrastPairs`
  still selects between two authority modes per render
  ([useContrastPairs.ts:38-43](../src/hooks/useContrastPairs.ts#L38-L43))
  would fork the Phase 3.5 write-ordering and blocked-read invariants into a
  second implementation.

**Exact unblocking conditions for `ProgressUpdater`, all required:**

1. Rollout is held at a single authoritative state long enough to produce a
   clean gate result (WP-3.8B/F), decided by a human per the human-control
   invariant.
2. WP-3.8C shipped, with migration living behind the explicit orchestration
   boundary — so Phase 4 inherits one honest read/write contract, not a read
   function with a hidden write.
3. WP-3.8G complete — mastery authority lives in exactly one module, and the
   dual-mode branch no longer resides in the hook.
4. WP-3.8D complete, so placement and pair-progress identity risks are
   classified rather than carried unexamined into a new boundary.

**Anti-forking rule to record:** at no point may two mastery-authority
implementations exist simultaneously. WP-3.8G must move authority, never copy
it.

### Phase 4 entry criteria, restated

Phase 3.8 is stabilization and evidence work, not a prerequisite to *finish
migrating everything*. Phase 4 may begin only when the following hold —
this list is deliberately narrower than "all migration work is done":

- **Stable mastery authority has operational evidence** — the WP-3.8B/F
  gate has passed on real-install evidence, per the human-control invariant
  and ownership boundary above, not on test coverage alone.
- **Rollout behavior has been validated** — at minimum through
  `internal-test`, with a completed rollback drill (WP-3.8C/E), so the
  authoritative-read and legacy-first-write behavior is proven, not merely
  implemented.
- **Compatibility behavior is understood** — the WP-3.8D label-derived
  identity audit is complete, so whatever remains label-derived at the time
  is a known, classified risk rather than an undiscovered one.
- **Progress mutation ownership can move without creating dual authority** —
  WP-3.8G has relocated mastery authority into a single module, so
  `ProgressUpdater` extraction moves an existing single authority rather than
  forking a second one out of `useContrastPairs`.

**Explicitly, Phase 3.8 does NOT require, and Phase 4 readiness does NOT
depend on:**

- Placement migration completion (Placement Identity Assessment above remains
  a separate, deferrable pre-Phase-4 package — its *audit* is in scope here,
  its *implementation* is not).
- Pair-progress migration completion (out of scope per Decision 008; the
  read-time projection is the permanent Phase 3 answer, not a step toward a
  rewrite).
- Removal of legacy compatibility of any kind — reads, writes, migration
  markers, or orphan recovery. Retirement remains deferred per Decision 011,
  independent of Phase 4 timing.
- Full retirement of migration infrastructure. The Compatibility Lifecycle
  Classification table above stands: several components are "likely
  permanent," and Phase 4 readiness is not conditioned on reclassifying any
  of them.

Phase 4 readiness is about proving mastery authority is singular and
evidenced — it is not a gate that waits for the compatibility window to
close.

---

## Decisions Requiring Human Approval

1. Adopt the explicit-orchestration shape (Option A) for missing-stable
   migration, rejecting the previously proposed embedded-in-read design
   (Option A′).
2. Whether WP-3.8C's orchestration function needs its own build-time toggle
   so it can be enabled independently of rollout state during internal-test.
3. Diagnostics retention size and reset policy (proposed: 100-entry ring,
   operator-only reset).
4. Whether the dev diagnostic surface ships in release builds behind a flag
   — Phase 3 Open Question 4, still open.
5. Placement migration timing — confirm "separate pre-Phase-4 package," not
   in-scope for 3.8.
6. Provisional gate thresholds in the transitions table, and who owns each
   transition decision (WP-3.8F).
7. Phase 4 staged scope, including the anti-forking rule.
8. Orphan adoption lifecycle: confirm dev/operator-invoked only, never
   automatic in any stage, with invocations recorded in the collection log so
   evidence is not confounded.

### Added 2026-08-01 — safety-gate design review

These gate WP-3.8A.1 and WP-3.8B. Items 9–11 are the proposed Decisions;
items 12–15 are implementation choices that follow from them.

9. **Proposed Decision 012 — evidence provenance.** Adopt
   `runtime-measured` / `harness-attested` / `manually-attested` / `unknown`
   as part of the evidence type, with the invariants that unknown never
   evaluates as zero and that a zero reading with an unmet witness is unknown.
   *Recommendation: accept.* Without it, G9 is unfixable — the gate cannot
   state what it did not observe.
10. **Proposed Decision 013 — reliability evaluates unresolved state.**
    Reliability fields block on `observed − recovered > 0` rather than on
    occurrence; cumulative counters stop being direct safety predicates;
    data-integrity fields stay at absolute zero. *Recommendation: accept.*
    This is a deliberate loosening and must be approved as one — but it is
    also what makes the gate satisfiable at all (G10).
11. **Proposed Decision 014 — advisory gate, three-valued output.** `READY` /
    `BLOCKED` / `INSUFFICIENT_EVIDENCE`, no write capability, one adjacent
    transition per report, authorization outside runtime code.
    *Recommendation: accept.* Mostly a formalization of the human-control
    invariant already in this plan; the new content is the three-valued output
    and the structural enforcement.
12. **WP-3.8A.1 as a separate package** rather than folding producer changes
    into WP-3.8B. *Recommendation: separate* — the changes are producer-side
    and belong to the layer that owns diagnostics under Ownership Boundaries;
    folding them into the gate package would put schema authority in the
    evaluator.
13. **Diagnostic schema version bump**, accepting that existing snapshots
    become unreadable and are discarded. *Recommendation: accept* — diagnostic
    loss is an accepted degradation mode, and no shipped install has produced
    meaningful evidence because rollout is `disabled`.
14. **`LanguageId` and bounded per-language observation counts in diagnostic
    storage.** Confirm this stays within the diagnostic-data boundary.
    *Recommendation: yes* — registry identity, not learner content, and already
    contemplated by the Evidence Pipeline Recommendation above.
15. **Persisting the diagnostic self-metrics** (delivery failures, dropped
    events), currently excluded from the persisted shape. *Recommendation:
    persist, as confidence input only* — without them an operator cannot tell
    a complete snapshot from a silently lossy one, which is the question
    evidence confidence has to answer.

---

## Unknowns

Explicitly not estimated:

- Install version distribution; no telemetry source exists.
- Real shadow divergence rates — unknown until a collection window runs.
- Rollback frequency and realistic store-review latency.
- Whether an abandoned pre-`v2` pair-progress payload exists on device, and
  in what format (Phase 3 Open Question 1). Nothing may be deleted until
  answered.
- How much pre-rename mastery and pair progress is actually stranded across
  the six renames — recoverable in principle, unmeasured in practice.
- Whether any learner has been re-shown a placement test due to G6.
- The concrete dual-write window length in releases (Phase 3 Open
  Question 2).
- Runtime cost of building `pairAssignments` eagerly at import — not
  measured.

---

## Recommended Codex Implementation Sequence

Revised 2026-08-01. Two steps were inserted: an approval checkpoint for the
proposed Decisions, and WP-3.8A.1 ahead of WP-3.8B.

| Order | Package | Gate to proceed |
|---|---|---|
| 1 | **WP-3.8A** Evidence persistence and inspection | ✅ **Complete** — counters survive cold start; isolation and schema tests green |
| 2 | **WP-3.8D** Label-derived identity audit *(parallel — read-only)* | Table reviewed and classified |
| 3 | — | **Approval checkpoint (human):** accept, amend, or reject proposed Decisions 012 (provenance), 013 (unresolved-state reliability), 014 (advisory three-valued gate). Nothing in orders 4–5 may begin until this is resolved, because all three change what the evidence model must record. |
| 4 | **WP-3.8A.1** Diagnostic evidence completeness | Every runtime-measured field has a real cumulative producer; every reliability field has a recovery producer; per-language and cold-start counts survive a cold start; isolation and schema tests green; rollout still `disabled` |
| 5 | **WP-3.8B** Gate evidence contract | Every field has a producer or explicit `unknown`; recommendation is three-valued; unknown cannot yield `READY`; gate has no write capability |
| 6 | **WP-3.8E** Shadow runbook | One dry run completed |
| 7 | — | **Approval checkpoint (human):** advance `disabled → shadow` |
| 8 | **WP-3.8F** Decision record for the shadow window | Clean evidence, ≥1 renamed language |
| 9 | **WP-3.8C** Explicit migration orchestration | Ships only into `internal-test`; forbidden in shadow; `readCompatibleMastery` unmodified |
| 10 | — | **Approval checkpoint (human):** `internal-test` → `limited` → `enabled`, one at a time |
| 11 | **WP-3.8G** Mastery authority extraction | Phase 4 `ProgressUpdater` unblocker; separate approval |

Orders 1–6 are independently reviewable and carry no learner-visible risk.
Order 9 is the only package that changes learner-visible behavior, and only in
states production has not yet reached, and only through the explicit
orchestration boundary defined above. No package in this sequence retires,
deletes, or disables any compatibility component, and no package introduces
a code path by which the application changes its own rollout state.

**Sequencing constraint added 2026-08-01:** WP-3.8A.1 must ship before
WP-3.8B, and WP-3.8B must not be implemented against the current snapshot
shape. If schedule pressure makes reordering tempting, the correct reduction
is to ship WP-3.8A.1 alone and defer WP-3.8B entirely — a complete producer
with no gate is a known absence of evidence, whereas a gate over an incomplete
producer is a false presence of it.
