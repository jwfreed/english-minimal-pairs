# **Contrast Domain Architecture Decisions**

## **Decision 001**

Date:  
2026-07-30

Status:  
Accepted

## **Context**

The static data and pair-progress identity primarily represent minimal pairs.

However, product behavior already treats contrast groups as the true learning
unit.

Examples:

* mastery  
* analytics  
* recommendations  
* curriculum progression

## **Decision**

Contrast is a first-class domain entity.

Pairs are examples belonging to contrasts.

This is the target domain direction. It does not claim that an explicit
Contrast model has already been implemented.

---

## **Consequences**

Positive:

* clearer domain model  
* safer learner progression  
* future exercise types become possible

Tradeoffs:

* migration complexity  
* temporary compatibility code

---

## **Rules**

New code:

✅ may depend on ContrastId

New code:

❌ should not introduce new uses of Pair.group as identity

---

This prevents future agents from reopening the same architectural debate.

---

# **Decision 002**

Date:  
2026-07-30

Status:  
Accepted

## **Context**

Repository reconnaissance confirmed that the highest-risk failure mode is not
the absence of a Contrast type. It is corrupting or orphaning learner history
while changing identifiers.

## **Decision**

Identity foundation comes before domain or persistence migration.

Phase 1 introduces explicit ID types, freezes historical identifiers, and adds
identity validation without changing user-visible behavior.

## **Reason**

Stable identity is a prerequisite for safely migrating Contrast ownership,
progress, mastery, analytics, or recommendations.

---

# **Decision 003**

Date:  
2026-07-30

Status:  
Accepted

## **Context**

Existing group values and content-derived persistence keys may already appear
in learner data and analytics history. Some identifiers could be made cleaner
or normalized, but doing so would change historical identity.

## **Decision**

Do not rename, merge, reverse, or otherwise normalize existing identifiers as
part of the identity foundation.

## **Reason**

Cleaner identifiers are less important than preserving historical continuity.
Any future normalization requires an explicit, tested compatibility migration.

---

# **Decision 004**

Date:  
2026-07-30

Status:  
Accepted

## **Context**

The current application works and already has contrast-centric behavior in
mastery, scheduling, recommendations, analytics, and UI vocabulary.

## **Decision**

Contrast migration must be incremental and compatibility-first.

## **Reason**

The system should evolve without a rewrite. Each phase must preserve existing
behavior and keep old learner data readable before the next phase begins.

---

# **Decision 005**

Date:  
2026-07-30

Status:  
Accepted

## **Title**

Compatibility Over Purity

## **Context**

During migration, temporary compatibility layers and duplicated
representations may exist.

## **Decision**

Prefer explicit compatibility boundaries over premature cleanup.

## **Reason**

Temporary complexity is acceptable when it prevents risky coordinated
migrations across identity, persistence, analytics, and learner history.

---

# **Decision 006**

Date:  
2026-07-30

Status:  
Accepted

## **Title**

Contrast Identity Is Language-Scoped

## **Context**

The same phonological distinction appears in multiple language datasets. The
legacy `group` token is not unique across languages: the shipped datasets use
only 25 distinct group tokens, and 16 of them appear in more than one language.
For example `rL` appears in the Cantonese, Japanese, Korean, Mandarin, Thai, and
Vietnamese datasets, and `ethD` appears in nine.

Legacy mastery is already stored per category (`@mastery_${categoryLabel}`), so
today a learner's mastery of `rL` means "mastery of `rL` for the selected
language", not "mastery of /r/ vs /l/ in general".

## **Decision**

`ContrastId` is language-scoped.

A Contrast represents a learning target within a specific language context.

Examples:

contrast.japanese.rL

contrast.korean.rL

contrast.spanish.rL

Do not create universal, cross-language `ContrastId` values in Phase 3.

## **Required statements**

* `ContrastId` scope is language-scoped.  
* `ContrastId` values are immutable after release.  
* Cross-language contrast equivalence is a future modeling concern, not a
  Phase 3 concern.

## **Reason**

Although phonological concepts may look similar across languages, mastery
meaning, curriculum placement, examples, and learner history are currently
language-specific. Language-scoped identity preserves existing per-category
mastery semantics exactly. A universal identity would either merge unrelated
learner state or duplicate it, and both outcomes are irreversible once shipped.

## **Consequences**

Positive:

* existing mastery semantics are preserved without translation  
* migration mapping stays unambiguous  
* no learner state is merged across languages

Tradeoffs:

* a learner practicing two languages holds two independent contrast states  
* cross-language transfer modeling requires a later, explicit phase

## **Deferred**

Universal contrast modeling, cross-language equivalence classes, and shared
curriculum ordering are deferred to a future curriculum/domain evolution phase.
That phase must treat any equivalence as an additional relationship layer above
language-scoped identity, never as a rename of existing `ContrastId` values.

---

# **Decision 007**

Date:  
2026-07-30

Status:  
Accepted

## **Title**

LanguageId Is an Application-Owned Identity

## **Context**

Language identity is currently represented by the category display label (for
example `@mastery_日本語`) and by an array index into the aggregated dataset.
Both are unstable. Display labels have already been renamed six times, and the
renames are visible in the learner-language migration aliases. Dataset ordering
changes shift the index.

## **Decision**

Introduce stable, application-owned `LanguageId` values.

Preferred form:

lang.japanese

lang.cantonese

lang.spanish

`LanguageId` is an application identity. It is not a display label and not a
linguistic or locale standard identifier.

## **Required invariants**

* `LanguageId` must remain stable and immutable after release.  
* Display labels may change without affecting `LanguageId`.  
* Locale and localization metadata may evolve independently of `LanguageId`.  
* Historical category labels must map to `LanguageId` through an explicit alias
  table.

## **Reason**

`LanguageId` becomes the stable namespace boundary for identity-based
persistence. Keying new storage by `LanguageId` rather than by a display label
removes the label-rename orphaning failure mode by construction, rather than
relying on future agents to remember a compatibility step.

## **Consequences**

* new persistence namespaces are keyed by `LanguageId`, never by a label  
* `ContrastId` values embed their language scope and derive from the registry,
  not from labels  
* the alias table is the only place where historical labels participate in
  identity resolution, and it is append-only

---

# **Decision 008**

Date:  
2026-07-30

Status:  
Accepted

## **Title**

Phase 3 Migrates Mastery and Projects Pair Progress

## **Context**

Two learner data families depend on legacy identity, and they carry very
different risk:

* mastery is a small per-language map of integer tiers that the application
  already rewrites on every promotion  
* pair progress is a single global blob of append-only attempt history, and it
  is the only learner artifact in the application that cannot be re-derived

The application is offline-first with no backend, so there is no remote kill
switch. Rollback latency equals an application release cycle.

## **Decision**

Phase 3 migrates mastery identity and does not migrate pair-progress storage.

* Mastery migrates to a new namespace keyed by `LanguageId` + `ContrastId`,
  additively, lazily, per language.  
* Pair progress keeps `@pairProgress_v2` unchanged and gains a read-time
  projection onto `ContrastId`.  
* `PairId` assignment and any pair-progress storage rewrite are deferred to a
  later phase.

Rollback is achieved by code revert alone. No data repair step may be required
to roll back.

## **Hard invariant**

A previous application version must continue to read learner progress correctly
throughout the Phase 3 compatibility period.

## **Reason**

Without a remote kill switch, the only acceptable migration is one that is
non-destructive and self-healing by construction. Projection delivers
contrast-level progress ownership without rewriting irreplaceable attempt
history, and dual-write keeps legacy mastery authoritative so that a reverted
build loses nothing.

## **Consequences**

Positive:

* the highest-risk learner artifact is never written during Phase 3  
* rollback needs no data migration  
* the blast radius of the migration is one language's tier map at a time

Tradeoffs:

* temporary duplicated mastery representation during the compatibility window  
* contrast-level progress is computed rather than stored  
* pair-progress identity remains content-derived until a later phase, so word
  content corrections can still orphan pair history

---

# **Reconnaissance Status**

Architecture reconnaissance and plan validation are complete.

Confirmed findings:

* Contrast already exists implicitly through `Pair.group`  
* pair progress and mastery still depend on mutable labels or content  
* identity safety is the first implementation priority  
* persistence migration must follow, not accompany, the identity foundation

Future agents should verify current code before editing, but should not reopen
these accepted architectural decisions without new repository evidence.

---

# **Phase 3.3 Status**

Phase 3.3 is complete.

The verification harness proves:

* identity mappings are deterministic  
* learner history can be projected without loss  
* rollback compatibility assumptions hold  
* migration invariants are executable

Phase 3.4 was implemented against these verified assumptions and is complete.

---

# **Phase 3.4 Status**

Phase 3.4 is complete.

The production pair-progress projection preserves the following boundaries:

* `@pairProgress_v2` remains the authoritative pair-attempt store
* `getContrastProgress()` is an additive, read-only API over the existing
  parsed legacy state
* current and historical alias keys that resolve to the same `ContrastId`
  retain both histories, preserve deterministic ordering, and count every
  attempt exactly once
* the existing parser's normalization of a non-array attempt container to an
  empty history is documented diagnostic information loss, not a
  progress-semantics mismatch
* projected nested histories, pair references, and attempts are copied and
  frozen so they cannot mutate the parsed source state
* zero pair-progress write paths changed
* pair-progress storage format, serialization, caps, and keys remain unchanged

Phase 3.4 adds no UI, analytics, scheduling, practice-session, mastery, or
learner-visible behavior.

---

# **Phase 3.5 Status**

Phase 3.5 is complete.

The `LanguageId` + `ContrastId` mastery store, schema validation, pure
reconciliation policies, lazy per-language migration operation, compatibility
reads and writes, reset tombstones, and partial-failure reporting are
implementation-complete and testable.

The feature remains disabled by default:

`FEATURE_FLAGS.contrastMasteryStore = false`

No learner migration, historical orphan adoption, startup scan, or
learner-visible behavior is enabled by Phase 3.5.

## **Stable-State Fallback Policy**

| Stable state | Compatibility behavior |
| --- | --- |
| Missing | Legacy fallback and initial derivation are permitted. |
| Valid | Stable state remains authoritative and normal reconciliation rules apply. |
| Malformed | Return an explicit blocked result; do not fall back, repair, delete, or rewrite either representation. |
| Unsupported schema version | Return an explicit blocked result; do not fall back, repair, delete, or rewrite either representation. |
| Storage read failure | Return an explicit storage failure; do not silently report legacy fallback as success. |

Malformed or unsupported stable state must never be treated as missing. This
prevents stale legacy evidence from resurrecting mastery that may have been
lowered by placement or practice, or cleared by a reset tombstone.

## **Revision Semantics**

Stable learner actions use monotonic stable-document revisions.

Revisions reconstructed from legacy source fingerprints are migration
observation revisions. They order changes observed by this migration system;
they are not timestamps and do not prove the historical or causal order of the
underlying legacy learner actions relative to stable actions that were not
observed through the same migration-state ledger.

Highest-tier-wins remains limited to initial alias reconciliation and
equal-revision tie-breaking. It is not the steady-state conflict policy.

## **Compatibility Write Ordering**

Flag-on compatibility writes are legacy-first:

1. If the legacy write fails, the stable write is not attempted and the result
   is `failed`.
2. If the legacy write succeeds and the stable write fails, the result is
   `partial` and retry is required.
3. Only successful writes to both required representations produce a
   `complete` result.

A valid stable document that existed before a failed legacy write is reported
as pre-existing state, not as a stable success in the current invocation.
Compatibility writes do not simulate transactions or perform destructive
compensation.

## **Migration Marker Contract**

`@masteryByContrastMigration_${LanguageId}` is advisory metadata and an
optimization; it is not the authoritative mastery state.

A valid stable mastery document remains valid when the marker is missing,
malformed, or unsupported. The marker may be recreated by baselining the
currently visible legacy bytes without reconciling them over the stable
document. This prevents marker loss from allowing stale legacy evidence to
outrank a stable reset or lowering action.

Known limitation:

If the marker is lost, legacy actions that occurred while it was unavailable
cannot be causally ordered. The safe policy is to preserve the valid stable
document and treat the current legacy bytes as a new observation baseline.
Only a subsequent fingerprint change observed after that baseline can
participate as newer legacy evidence.

---

# **Decision 009**

Date:  
2026-07-31

Status:  
Accepted

## **Title**

Orphan Adoption Is Conservative Recovery, Not General Reconciliation

## **Context**

After stable mastery migration, legacy mastery evidence may appear that is not
represented in the stable `LanguageId + ContrastId` document.

This can result from:

* rollback to an older application version
* interrupted compatibility writes
* legacy-only learner activity after migration
* missing advisory migration metadata

Blindly reconciling every visible legacy value over stable mastery could
resurrect stale mastery, override reset tombstones, violate placement lowering,
or invent causal ordering that the stored evidence cannot prove.

## **Decision**

Orphan adoption is an explicit, per-language, deterministic, conservative
recovery operation. It remains disabled by default.

An orphan candidate must:

* map deterministically to exactly one `LanguageId + ContrastId`
* contain valid mastery evidence
* not already be represented by exact stable evidence, a persisted observation
  batch, or a known observation fingerprint
* not conflict with newer stable evidence
* not violate reset or placement semantics

Unknown, ambiguous, malformed, or causally uncertain evidence remains blocked.
Orphan adoption is not a general reconciliation mechanism and does not infer a
winner when the available evidence cannot establish one safely.

## **Invariants**

* Stable identity existence does not imply that legacy evidence is represented.
* Observation revisions are migration observations, not historical timestamps.
* Canonical ordering exists only to make output deterministic.
* Deterministic ordering must not imply learner chronology.
* Reset tombstones and placement lowering remain authoritative.
* Orphan adoption never deletes legacy storage.
* Failed adoption remains visible and eligible for a later retry.

## **Persistence Rules**

Write order:

1. stable mastery document
2. advisory migration metadata

Stable mastery is authoritative; migration metadata is advisory. A stable write
failure prevents the marker write. A marker failure after a successful stable
write produces a recoverable partial state. Retrying must converge without
duplicating adoption or drifting the stable revision.

---

# **Decision 010**

Date:

2026-07-31

Status:

Accepted

## **Title**

Rollout Authority and Compatibility Window

## **Context**

The stable mastery architecture is implementation-complete. The system now
supports stable mastery storage, compatibility reads and writes, shadow
verification, safety diagnostics, and rollback.

Implementation correctness does not equal production validation. Rollout
remains controlled, and real-install shadow evidence is required before stable
mastery advances to broader production use.

## **Decision**

Stable mastery is the future authoritative learner model.

During the compatibility window, reads prefer stable mastery and fall back to
legacy mastery only when stable state is unavailable and fallback is safe.
Malformed, unsupported, or unreadable stable state is not safe fallback
evidence.

Writes preserve legacy compatibility and maintain stable mastery writes.
Compatibility write ordering remains legacy-first, and partial failures remain
explicit and retryable.

Rollback remains possible without destructive cleanup or learner-data repair.
Legacy mastery stays readable, stable mastery remains preserved, and disabling
the rollout restores legacy runtime authority.

The compatibility window remains open until the Phase 3.8 exit criteria are
satisfied. Phase 3.7 completion does not close or shorten that window.

## **Invariants**

* Stable read authority and compatibility write ordering are separate
  architectural decisions.
* Deterministic shadow comparison does not imply automatic migration.
* Shadow mode must not mutate learner state.
* Legacy compatibility remains intentionally preserved until retirement
  criteria are met.
* Rollout state changes must remain controlled and reversible.

---

# **Phase 3.6 Status**

Phase 3.6 is complete as an explicit, disabled-by-default recovery foundation.

An orphan candidate is exact legacy mastery evidence that:

* resolves through the released historical mapping to one
  `LanguageId + ContrastId`
* has a valid tier
* is not already represented by an exact stable tier, a persisted observation
  batch result, or the exact per-source advisory fingerprint baseline
* is newly observed by the migration ledger or is safely additive to an
  identity absent from stable state
* has not already been adopted

Malformed tiers, unknown or ambiguous identities, known fingerprint evidence,
unusable baselines, reset-protected evidence, and conflicts with stable
placement or practice records are not adoptable.

`analyzeOrphanedMastery` and `proposeOrphanMasteryAdoption` are pure,
deterministic functions. Adoption may add an absent stable record or update
migration-derived evidence after a later migration observation. It cannot
override reset tombstones or conflicting stable placement/practice evidence.
Sources changed in one scan share one observation revision; the existing
equal-revision tie-break is used only within that observation.

Stable identity existence is not evidence representation. A stable record alone
never suppresses later evidence. An exact stable tier or an already-persisted
observation-batch result may represent it; an exact advisory fingerprint is
reported separately. A changed fingerprint for the same `ContrastId` remains
newly observed and is adopted, represented by the batch result, or explicitly
blocked by provenance/revision policy.

Simultaneous alias evidence is grouped by `ContrastId + observation revision`
before decisions are assigned. Equivalent tiers converge directly. Conflicting
tiers within that single observation may use the existing equal-revision
higher-tier tie-break. Canonical source ordering never creates a different
revision or causal priority inside the batch.

Phase 3.6 marker repair stores a represented-evidence projection, not an
unqualified copy of all current legacy bytes. The projection includes exact
already-represented evidence and proposed evidence only after its stable
document write succeeds. It excludes blocked, reset-protected, unresolved,
malformed, and unpersisted evidence. Excluded source evidence remains in legacy
storage and is re-diagnosed on every retry.

`adoptOrphanedMasteryForLanguage(storage, languageId)` is the only Phase 3.6
storage operation. It is explicit, scans one language, writes the stable
document before the advisory marker, reports complete/partial/failed outcomes,
and is retry-safe. It never deletes or rewrites legacy mastery.

Stable adoption is document-atomic at the application storage boundary:
`writeContrastMastery` deterministically serializes one complete document and
performs one whole-value `setItem`. No individual Contrast record is written.
A rejected stable write leaves the previously stored document authoritative
and prevents the marker write.

The stable mastery feature flag remains false. Phase 3.6 adds no startup,
background, UI, analytics, scheduling, practice, pair-progress, or rollout
integration.

---

# **Phase 3.7 Status**

Phase 3.7 controlled-rollout support is implementation-complete. The production
build remains in the `disabled` state until real-install shadow evidence passes
the release gate.

Rollout is a build-time state because the repository has no remote
configuration convention:

`disabled -> shadow -> internal-test -> limited -> enabled`

`disabled` preserves the legacy-only runtime. `shadow` performs read-only
stable/legacy comparison, records structured internal diagnostics, and never
changes UI state or writes stable mastery. The three authoritative stages share
stable-first reads, legacy fallback only when stable state is missing, and the
Phase 3.5 legacy-first compatibility-write contract.

Authoritative reads no longer invoke migration implicitly. Explicit
`migrateLanguageMastery` and `adoptOrphanedMasteryForLanguage` operations remain
available for measured per-language activation and recovery, but neither is
wired to startup, background work, or the learner UI.

Malformed, unsupported, or unreadable stable state is blocked rather than
treated as missing. A blocked initial read is also prevented from triggering an
empty persistence write.

Internal diagnostics provide session counters and an isolated sink for stable
read attempts/successes, legacy fallbacks, shadow divergences, unresolved
mappings, reconciliation conflicts, blocked migrations, compatibility writes,
partial writes, orphan-adoption operations, and storage failures. A pure safety
gate requires shadow evidence and zero unsafe data, identity, storage, reset,
placement, or practice outcomes before a broader rollout state is selected.

Rollback remains code/config-only: dual writes preserve the legacy namespace,
disabling rollout immediately returns reads and writes to legacy behavior, and
stable records remain untouched. No cleanup or Phase 3.8 behavior is included.

---

# **Proposed Execution Sequence**

## **Step 0 — Architecture Lock**

Maintain the current evolution plan and decisions document as the authoritative
constraints. No application code.

---

## **Step 1 — Identity Foundation**

Smallest valuable code change.

Introduce:

ContrastId  
PairId

Add tests.

No behavior changes.

Do not migrate persistence, migrate Pair to Contrast, rename groups, or
normalize data.

Goal:

Protect learner history and prevent future identity drift.

---

## **Step 2 — Introduce Contrast Domain**

Add:

src/domain/contrast/

Introduce ownership and relationships while keeping `Pair.group`
compatibility. No persistence migration yet.

---

## **Step 3 — Evolve Progress and Mastery**

Migrate read and write paths only after identity is stable. Preserve legacy
reads and require idempotent migration behavior.

Scope is fixed by Decision 008: mastery migrates identity, pair progress gains a
read-time projection and keeps its storage format. The approved sequence,
verification requirements, and non-goals live in the Phase 3 section of
`Contrast-Domain-Architecture-Evolution Plan.md`.

---

## **Step 4 — Practice Engine Boundary**

Only after domain concepts settle.

---

## **Step 5 — Reliability Improvements**

Harden playback lifecycle and data governance without combining them with
identity or persistence changes.

---

# **Definition of "Don't Start Yet"**

I would stop and reassess if:

* agents propose deleting existing persistence  
* agents propose replacing AsyncStorage  
* agents propose rewriting hooks wholesale  
* agents introduce repository/service layers everywhere  
* agents cannot explain the migration path

Those are signs of AI-driven architecture drift.

---

# **My Recommendation**

Yes, begin.

But begin with:

**Phase 0: Architecture alignment**  
→ **Phase 1: Identity foundation**

Not:

"Refactor Contrast everywhere."

The first commit should feel almost boring:

* new types  
* new validation  
* new tests  
* zero user-visible change

That is the right first move for a production app.

The system is already healthy; the goal is to make its architecture catch up with the product's domain.

---

# **Phase Status**

As of 2026-07-31:

* Phase 0 — complete  
* Phase 1 — complete (identity foundation)  
* Phase 2 — complete (Contrast domain boundary)  
* Phase 3 — design approved and locked by Decisions 006, 007, and 008;
  implementation is complete through Phase 3.4 of the sequence in
  `Contrast-Domain-Architecture-Evolution Plan.md`

The "don't start yet" signals above still apply, and Decision 008 adds one more:
any proposal to rewrite pair-progress storage during Phase 3 is out of scope and
should be rejected without new evidence.

---

# **Decision 011**

Date:
2026-07-31

Status:
Accepted

## **Title**

Compatibility Retirement Requires Operational Evidence

## **Context**

Phase 3.7 completed controlled-rollout support with production still in the
`disabled` state. The Phase 3.8 architecture audit (`docs/Phase-3.8-Architecture-Audit.md`)
confirmed that the migration and compatibility architecture is
implementation-complete and internally consistent, but that no shipped install
has ever written a stable mastery document, and that the repository has no
wired mechanism to collect real-install rollout evidence: rollout diagnostics
are in-memory and session-scoped, and the rollout safety gate has no caller in
application code.

The existing sequencing note that "3.8 closes legacy writes only" was written
before this evidence gap was identified, and on its own could be read as
authorizing retirement once Phase 3.8 is reached as a numbered phase. That
reading is incorrect. Reaching Phase 3.8 records that the audit is complete; it
does not by itself satisfy the conditions the audit found necessary before any
compatibility component may be removed.

## **Decision**

Retirement of any Phase 3 compatibility component is gated on operational
evidence collected from real installs, not on implementation completeness or
on having reached a given phase number.

Until the evidence gates recorded in the Phase 3.8 audit are satisfied, the
following remain protected and must not be removed, disabled by default-off
flag deletion, or otherwise retired:

* legacy mastery reads and the historical identity mapping that resolves them
* legacy mastery writes (the legacy leg of the compatibility write contract)
* migration markers (`@masteryByContrastMigration_${LanguageId}`) and their
  write paths
* orphan recovery (`analyzeOrphanedMastery`, `proposeOrphanMasteryAdoption`,
  `adoptOrphanedMasteryForLanguage`)

Phase 3.8 is stabilization and evidence work: persisting rollout diagnostics,
making the safety gate observable against real data, and advancing rollout
state on internal builds while re-verifying rollback at each step. It is not a
cleanup or deletion phase, and completing it does not by itself authorize
removing any component listed above.

## **Reason**

An offline-first application with no remote kill switch and rollback latency
equal to a release cycle cannot safely retire a compatibility mechanism on the
strength of code review or test coverage alone. The mechanisms above are the
only evidence the system has that a reverted or still-legacy install continues
to read learner progress correctly. Removing any of them before real-install
evidence exists would remove a proven safety mechanism to make room for one
that has not yet been exercised against real learner data.

## **Consequences**

Positive:

* retirement decisions are anchored to observable evidence rather than to
  calendar or phase-number milestones
* Decision 008's rollback invariant remains protected for the full duration of
  the compatibility window, however long that turns out to be
* future agents cannot infer retirement authorization from "Phase 3.8" alone

Tradeoffs:

* the compatibility window has no fixed end date; it ends when evidence gates
  are satisfied, not on a schedule
* dual-write and dual-read complexity persists for as long as retirement
  remains ungated

## **Required statements**

* Reaching Phase 3.8 does not authorize retirement.
* Retirement requires operational evidence gates to be satisfied, as recorded
  in `docs/Phase-3.8-Architecture-Audit.md`.
* This decision does not renumber or alter Decisions 001–010.

---

# **Proposed Decisions — not accepted**

Everything below this line is a **proposal**. Proposed entries are not binding,
do not constrain implementation, and must not be cited as authority. They
become effective only when a human changes their `Status` to `Accepted` and
records the approval date.

Decisions 001–011 above are unchanged by this section. No entry below renumbers,
alters, supersedes, or weakens any accepted Decision. Decision 011's retirement
evidence requirements in particular remain in force exactly as written — the
proposals below constrain how evidence is *classified and evaluated*, which
makes Decision 011's gates harder to satisfy accidentally, never easier.

Origin: the Phase 3.8B safety-gate design review recorded in
`docs/Phase-3.8B-Safety-Gate-Evidence-Model.md`.

---

# **Decision 012**

Date proposed:
2026-08-01

Status:
**Proposed — not accepted**

## **Title**

Evidence Provenance Is Part Of The Evidence Model

## **Context**

The rollout safety gate
([`src/domain/masteryRolloutSafety.ts`](../src/domain/masteryRolloutSafety.ts))
evaluates sixteen numeric evidence fields under the rule "any nonzero value
blocks." Nine of those fields have no runtime producer. Any evidence object
assembled from the Phase 3.8A diagnostic snapshot therefore sets those fields
to `0`, and `0` passes.

The consequence is that the gate cannot distinguish two states that mean
opposite things:

* **observed safe** — the condition was measured, and it did not occur.
* **not measured** — nothing in the system is capable of observing the
  condition, or the code that would have observed it never ran.

Both currently present as `0`. The gate reports `passed: true` for both. This
is not a reporting inaccuracy; it is a safety inversion, because the second
state is the one that should most strongly discourage advancement.

The same collapse occurs a second way even for fields that *do* have a
producer: a counter reading `0` is meaningless if the code path that increments
it never executed. A build that never performed a stable read reports zero
stable-read failures, which is true and tells a reader nothing.

## **Decision**

Evidence is not a number. Evidence is a number **plus the class of producer
that supplied it**, and the absence of a producer is a distinct, first-class
value that the type system can represent.

Every evidence field carries exactly one provenance:

* `runtime-measured` — a cumulative counter persisted by the diagnostic layer.
* `harness-attested` — a deterministic harness or test run, identified by the
  commit it ran against.
* `manually-attested` — a human observation or drill outcome recorded through
  the operator runbook.
* `unknown` — no producer exists, the producer was not exercised, the evidence
  source was unreadable, or a required attestation is absent or stale.

Two invariants follow, and are the operative content of this decision:

1. **Unknown evidence must never evaluate as zero.** No default, coercion,
   fallback, struct initializer, or absent field may convert `unknown` into a
   satisfied condition. Unknown reduces confidence; it never creates it.
2. **A zero reading is evidence only when its producer demonstrably ran.**
   Every field declares a *witness* — a separate observation whose positive
   value proves the producing code path executed. A zero with an unmet witness
   is `unknown`, not `satisfied`.

Provenance classes are not interchangeable. A field's declared provenance set
is part of its definition: evidence of a class the field does not accept cannot
satisfy it. In particular, harness or synthetic evidence can never satisfy a
field that requires real-install observation.

## **Reason**

The Phase 3.8 audit already requires that gate results come from "real,
persisted diagnostic counters — not hand-constructed test evidence." That
requirement is currently prose. Provenance makes it a property of the data,
enforced wherever the evidence travels, rather than a rule a future reader must
remember to apply.

Two of the sixteen fields — mastery loss and practice-behavior change — cannot
ever be runtime-measured without violating the Phase 3.8 diagnostic-data
boundary: detecting mastery loss at runtime would require the diagnostic store
to hold enough mastery content to notice something missing, and detecting
behavior change would require recording learner behavior or running two
authority engines concurrently. Both are prohibited. Without provenance, those
fields have no honest representation and silently read as `0` forever. With
provenance, they are permanently and visibly `harness-attested` and
`manually-attested` respectively — a deliberate assignment rather than an
unnoticed gap.

## **Consequences**

Positive:

* the gate can state what it does not know, instead of implying it observed
  safety it never observed
* fields with no possible runtime producer are visible as such rather than
  silently passing
* synthetic evidence cannot satisfy a real-install gate, because provenance
  travels with the value

Tradeoffs:

* every evidence field requires an explicit provenance declaration and an
  explicit witness, which is more design work per field than a bare counter
* more fields will read `unknown` in early collection windows, which will make
  the gate look further from ready than the previous model suggested — this is
  the correct reading, not a regression

## **Required statements**

* Unknown evidence must never evaluate as zero.
* A zero reading with an unmet witness is unknown, not safe.
* Provenance is part of the evidence type, not documentation about it.
* This decision constrains evidence classification only. It does not change
  runtime behavior, rollout state, migration behavior, or learner state.
* This decision does not renumber or alter Decisions 001–011.

---

# **Decision 013**

Date proposed:
2026-08-01

Status:
**Proposed — not accepted**

## **Title**

Reliability Evidence Evaluates Unresolved State, Not Historical Occurrence

## **Context**

Three gate fields name *unresolved* conditions — `unhandledPartialWrites`,
`unhandledStableStorageFailures`, `unhandledLegacyStorageFailures` — but their
only available producers are monotonic cumulative counters that are incremented
on failure and never decremented
([`masteryRolloutDiagnosticStorage.ts`](../src/storage/masteryRolloutDiagnosticStorage.ts)).

Evaluating a monotonic counter under a zero-tolerance rule means a single
transient storage failure, anywhere in a collection window, pins the gate at
blocked permanently on that device. No subsequent successful retry can clear
it, because nothing decrements.

This contradicts the architecture's own design. The compatibility write
contract answers a failed stable write with `retryRequired: true`
([`masteryCompatibility.ts`](../src/storage/masteryCompatibility.ts)) — the
documented response is retry and converge, and a legacy-only partial success is
explicitly stated to be safe to retry. A gate that treats the retryable
condition as permanently disqualifying evaluates the system against a contract
the system was never built to meet.

The practical failure mode is not a false negative. It is that a gate which can
never pass produces no decision signal, and the predictable human response is
to stop consulting it — at which point the safety mechanism has been defeated
without anyone deciding to defeat it.

## **Decision**

Reliability conditions are evaluated on **currently unresolved state**, not on
historical occurrence.

The safety predicate is:

```
residual = observed − recovered
blocked  ⟺  residual > 0
```

Worked example, as the review specified it:

| Observed failures | Recovered | Safety state |
|---|---|---|
| 10 | 10 | healthy — every failure converged |
| 10 | 8 | **blocked** — two conditions remain unresolved |
| 0 | 0 | *not* healthy — witness unmet, evidence is `unknown` (Decision 012) |

This applies to reliability conditions only: storage failures, partial writes,
migration failures, and orphan-adoption residue. It does **not** apply to
data-integrity conditions — lost mastery, duplicated mastery, reset
resurrection, identity mismatch, and unexplained divergence remain
zero-tolerance on occurrence, because none of them has a recovery path that
restores the lost information. A recovered storage failure has genuinely been
recovered from; a lost mastery record has not.

Two obligations follow:

1. **Cumulative counters are not safety predicates.** A raw occurrence count
   may be reported to a human as context, and may inform threshold
   calibration, but may not by itself block or clear a transition.
2. **Recovery must be observed, not assumed.** A condition counts as recovered
   only when the producing layer records a corresponding successful outcome for
   the same identity. Absence of a repeat failure is not recovery. Convergence
   must be tracked per `LanguageId` and never netted across identities: a
   converged failure on one language does not offset an open one on another.

Recording convergence is subject to the existing diagnostic reliability
contract without exception. Convergence tracking is best-effort, failure-
isolated, and fire-and-forget; a failure to record convergence degrades
evidence confidence and must never retry into, block, or delay a learner-state
operation.

## **Reason**

The distinction this decision draws is between conditions the system is
designed to recover from and conditions it is designed to prevent. Collapsing
them into one rule makes the gate simultaneously too strict to satisfy for
reliability and no stricter than before for integrity.

Keeping integrity conditions at absolute zero preserves the guarantee that
matters: Decision 008's rollback invariant and the "learner progress must never
silently disappear" invariant are unaffected, and are if anything strengthened,
because integrity fields are no longer diluted by reliability noise in the same
counter.

## **Consequences**

Positive:

* the gate becomes satisfiable under realistic device conditions, so it remains
  a consulted signal rather than a permanently red one that gets ignored
* unresolved failures are distinguished from recovered ones, which is the
  distinction an operator actually needs in order to act
* integrity conditions become *more* legible, because they are no longer mixed
  with transient reliability events

Tradeoffs:

* this is a deliberate loosening relative to the current all-zero reading, and
  must be approved as such rather than absorbed as an implementation detail
* it places a new obligation on the diagnostic producer layer to record
  recovery, not only failure — scoped as Phase 3.8A.1
* a frequently-failing-but-always-converging install passes this rule; the raw
  occurrence rate is therefore retained in the report for human judgment

## **Required statements**

* Reliability conditions evaluate unresolved state, not historical occurrence.
* Cumulative counters must not be treated as direct safety predicates.
* Data-integrity conditions remain zero-tolerance on occurrence and are not
  covered by this decision.
* Recovery must be observed per identity and never netted across identities.
* Convergence tracking is best-effort diagnostics and must never affect
  learner-state behavior.
* This decision does not renumber or alter Decisions 001–011.

---

# **Decision 014**

Date proposed:
2026-08-01

Status:
**Proposed — not accepted**

## **Title**

The Rollout Safety Gate Is Advisory And Cannot Express Advancement

## **Context**

The human-control requirement for rollout is currently recorded in
`featureFlags.ts` as a comment and in `docs/Phase-3.8-Stabilization-Plan.md` as
a planning invariant. Neither is a durable architectural record, and neither
constrains what a future gate implementation is *able* to do — only what it is
supposed to do.

The gate also returns `{passed: boolean, blockers}`. A boolean cannot represent
the state Decision 012 makes central: evidence that is absent rather than
clean. Under a binary return, "insufficient evidence" must collapse into either
`passed` (unsafe) or `blocked` (indistinguishable from a real violation, and
misdirects the operator toward fixing a defect that does not exist).

## **Decision**

The rollout safety gate is advisory. It consumes evidence, evaluates evidence,
and emits a recommendation. It never changes rollout state.

**Output.** The gate's recommendation is three-valued, and binary pass/fail is
prohibited:

* `READY` — every required field is satisfied under an accepted provenance,
  every witness is met, and every volume threshold for the declared transition
  is reached.
* `BLOCKED` — at least one field violated its rule. A known violation.
* `INSUFFICIENT_EVIDENCE` — no violation observed, but coverage is incomplete:
  unknown fields, unmet witnesses, unmet volume thresholds, or a degraded
  evidence source.

A missing measurement must never produce a passing gate. `INSUFFICIENT_EVIDENCE`
is the required result whenever evidence is absent, and it is never a weaker
form of approval.

`BLOCKED` outranks `INSUFFICIENT_EVIDENCE` when both apply. Both are
non-advancing, so the safety property is unaffected by the ordering; the
distinction exists so an operator knows whether to fix a defect or collect more
evidence.

**Capability.** The gate has no write access of any kind:

* it cannot modify feature flags or any rollout configuration
* it cannot trigger, schedule, or influence migration
* it cannot read or write learner state
* it cannot write to diagnostic storage — it is a consumer of evidence, never a
  producer
* its output type cannot express advancement: no `advance`, `apply`,
  `nextState`, command, or callback member, and no property that is a function

These are enforced by module boundaries and an import-graph test, not by review
discipline. The gate performs no I/O; evidence is passed to it as
already-read values.

**Transitions.** The gate evaluates exactly one declared, adjacent, forward
transition per report. Non-adjacent and backward transitions are refused. There
is no representation of a multi-step advance, so no automatic
`disabled → shadow → internal-test → limited → enabled` progression can be
expressed.

**Authority.** The final rollout decision lives outside runtime code. A human
reads a gate report, records a decision artifact naming the transition, the
evidence identity, and the approver, and then edits the build-time rollout
constant and ships a release. A `READY` recommendation is an input to that
decision, never a substitute for it, and a human may decline to advance on a
`READY` report.

## **Reason**

The application may provide evidence; humans authorize rollout transitions.
Writing this as a Decision rather than a plan invariant makes it survive the
plan documents that produced it, and makes a future change that grants the gate
write capability a visible Decision reversal rather than an unremarked
refactor.

The three-valued output is not a presentation choice. It is what makes
Decision 012 enforceable at the boundary where a human actually reads the
result: a provenance model that carefully distinguishes "not measured" from
"observed safe" is defeated entirely if the final output collapses them back
into one bit.

## **Consequences**

Positive:

* human ownership of rollout survives as an architectural record, not a comment
* the gate's advisory nature is enforced by structure rather than intention
* absence of evidence reaches the human as absence of evidence

Tradeoffs:

* callers must handle three states; the existing boolean-returning function
  becomes a lossy adapter that cannot represent `INSUFFICIENT_EVIDENCE`, and
  must be documented as such
* reports will more often say `INSUFFICIENT_EVIDENCE` than the previous model
  said `blocked`, which requires operator familiarity with the distinction

## **Required statements**

* The safety gate is advisory and has no write access.
* The safety gate cannot modify feature flags, trigger migration, or alter
  learner state.
* Gate output is `READY` / `BLOCKED` / `INSUFFICIENT_EVIDENCE`; binary
  pass/fail is prohibited.
* A missing measurement must never produce a passing gate.
* Rollout authorization remains outside runtime code.
* This decision does not renumber or alter Decisions 001–011.
