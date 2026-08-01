# **Contrast Domain Architecture Evolution Plan**

## **Purpose**

This document defines the architectural direction for evolving Soundwise from a minimal-pair exercise application into a contrast-learning system.

It exists as shared context for:

* AI coding agents  
* human engineers  
* reviewers  
* future contributors

All implementation work related to domain modeling, progression, practice sessions, persistence, analytics, and learning architecture should reference this document.

The goal is **evolution, not rewrite**.

---

# **Executive Summary**

## **Current State**

The application is a well-structured offline-first Expo application.

Strengths:

* strong TypeScript discipline  
* pure learning logic separated from React  
* deterministic scheduling helpers  
* dataset validation  
* audio coordination isolation  
* CI verification  
* testable domain functions

The architecture has successfully supported:

* minimal pair practice  
* pronunciation contrasts  
* learner progress  
* adaptive difficulty  
* TTS playback

---

## **Architectural Pressure**

The product concept has evolved.

The original model:

Minimal Pair Trainer

is becoming:

Contrast Learning System

The code already reflects this direction:

* analytics use contrast identifiers  
* UI presents contrast concepts  
* mastery operates at contrast level  
* recommendations target contrast groups

However, the static data model and pair-progress identity still primarily
represent `Pair`, while `Contrast` exists implicitly through `Pair.group`.

This mismatch is the primary architectural opportunity. The first priority is
to make identity safe before making Contrast ownership explicit.

---

# **Historical Identity Risk**

## **Confirmed facts**

* category display labels have changed over the life of the application  
* learner-language selection includes migration aliases for historical labels  
* mastery and placement storage keys still include category labels  
* pair-progress identifiers still include category, group, and word content

## **Interpretation**

The original identifiers were practical when labels and pair content were
treated as stable. As the dataset and product vocabulary evolved, those values
became mutable while still participating in identity.

This does not prove that every historical learner record was lost. It does
confirm that a label or content change can make existing data unreachable
unless compatibility is handled explicitly.

## **Confirmed orphaned learner data**

Repository review for Phase 3 confirmed a specific, recoverable case.

The learner-language preference migrates across six historical label renames.
Nothing re-points the learner data stored under those historical labels:

* `@mastery_${historicalLabel}`  
* `@placementDone_${historicalLabel}`  
* pair-progress keys of the form `${historicalLabel}__${group}__${word1}_${word2}`

For learners in those six languages, mastery, placement, and pair history
recorded before the rename are still present on device but currently
unreachable. Phase 3 recovers this data through read-side alias adoption.

## **Future risk**

Future agents must not repeat this pattern. Renaming a label, correcting a word,
or normalizing an identifier must never silently create a new learner identity.

Two known unrepaired identity hazards remain after Phase 3:

* pair-progress keys still embed word content, so a word correction can orphan
  pair history until `PairId` is assigned  
* the ephemeral trial identifier omits the category, so it collides across
  languages. It must never become persisted identity

---

# **Core Architectural Principle**

## **Make the domain explicit**

A concept important enough to:

* track mastery  
* analyze progress  
* schedule practice  
* personalize learning  
* explain to users

must exist as a first-class domain concept.

Therefore:

Contrast

becomes a core domain entity.

---

# **Identity Invariants**

These rules apply before, during, and after the migration:

* existing `Pair.group` values are historical identifiers  
* `Pair.group` is a legacy identity representation  
* it may be read for compatibility  
* it should not be used as the basis for new identity-bearing behavior  
* existing persistence keys must remain readable  
* display labels are not identities  
* content changes must not reset learner history  
* new identifiers must be stable and immutable  
* compatibility must be explicit whenever an identity representation changes

Cleaner naming does not justify breaking historical continuity.

## **Identity scope invariants**

Established by Decision 006 and Decision 007:

* `ContrastId` is language-scoped, for example `contrast.japanese.rL`  
* `ContrastId` values are immutable after release  
* cross-language contrast equivalence is a future modeling concern  
* `LanguageId` is an application-owned identity, for example `lang.japanese`  
* `LanguageId` is not a display label and not a locale standard identifier  
* `LanguageId` is the stable namespace boundary for identity-based persistence  
* historical category labels reach `LanguageId` only through an append-only
  alias table

The legacy `group` token cannot identify a contrast on its own. The shipped
datasets use 25 distinct group tokens and 16 of them appear in more than one
language, so legacy contrast identity requires the pair `(category label, group)`.

---

# **Target Domain Model**

## **Current**

Language Profile

    Category

        Pair Group

            Pair

Problems:

* identity derived from labels  
* mastery attached indirectly  
* business meaning hidden

---

## **Target**

Learner Language

        |  
        v

Contrast

        |  
        \+----------------+  
        |                |  
        v                v

Contrast Examples     Contrast Progress

        |  
        v

Practice Trials

        |  
        v

Learning Events

---

# **Domain Concepts**

## **Contrast**

Represents a phonological distinction being learned.

Examples:

/r/ vs /l/

/θ/ vs /s/

Responsibilities:

* stable identity  
* description  
* phonological relationship  
* associated examples

Does NOT own:

* UI rendering  
* persistence  
* audio playback

---

## **Example Pair**

Represents training material.

Responsibilities:

* words  
* audio references  
* IPA  
* difficulty metadata

Does NOT own:

* mastery  
* scheduling policy

---

## **Contrast Progress**

Represents learner state.

Responsibilities:

* exposure  
* accuracy  
* confidence  
* mastery  
* recommendation state

---

# **Future Domain Concepts**

The repository already contains implicit concepts that may become explicit as
the product evolves.

## **Contrast**

The learning target. It represents the phonological distinction being trained.

## **Curriculum**

The ordering, availability, and selection of contrasts for a learner.

## **ExerciseType**

A kind of learning activity that can use contrast examples without redefining
contrast identity.

## **Trial**

A single learner interaction, including the presented example, response, and
outcome.

## **Session**

The lifecycle and orchestration of a practice workflow across multiple trials.

These are future architectural directions, not current implementation tasks.
They must be introduced only when a bounded product or engineering need
requires them.

---

# **Non-Goals**

This refactor does NOT include:

* rewriting React architecture  
* introducing a backend  
* introducing databases  
* adding unnecessary repositories  
* microservices  
* replacing AsyncStorage  
* redesigning the UI

Avoid complexity without product justification.

---

# **Avoid Premature Abstraction**

Do not introduce:

* repositories everywhere  
* generic service layers  
* factories  
* event systems  
* domain frameworks

unless a concrete domain requirement requires them.

Abstractions should reduce complexity, not create ceremony.

---

# **Implementation Strategy**

# **Phase 0 — Architecture Alignment and Documentation**

Goal:

Keep repository reality, identity invariants, and migration constraints
explicit in the authoritative architecture documents.

Document:

* Pair  
* Contrast  
* Group  
* Mastery  
* Progress  
* current persistence identity  
* confirmed migration risks

Success:

Future agents understand both the current implicit model and the intended
direction without assuming that Pair-to-Contrast migration has already begun.

## **Completion Criteria**

* the authoritative documents reflect validated repository reality  
* identity invariants and historical risks are explicit  
* the phase sequence and non-goals are internally consistent

---

# **Phase 1 — Identity Foundation**

## **Purpose**

Protect learner history and establish stable identifiers before changing domain
ownership or persistence.

Current:

category \+ group \+ words

Target:

contrastId  
pairId

---

## **Scope**

* introduce explicit ID types such as:

type ContrastId \= string;  
type PairId \= string;

* document identity invariants in code and tests  
* freeze current identifiers as historical compatibility values  
* add validation and characterization tests for identity stability  
* require new identity-bearing data to use explicit, immutable identifiers

## **Not included**

* persistence migration  
* Pair-to-Contrast migration  
* renaming existing group identifiers  
* contrast or dataset normalization  
* user-visible behavior changes

## **Compatibility rule**

Existing IDs and persistence keys must remain valid. Existing learners must not
lose progress.

---

## **Verification**

Tests:

* content rename does not change identity  
* ordering changes do not change identity  
* duplicate IDs fail validation  
* historical identifiers remain readable

## **Completion Criteria**

* `ContrastId` and `PairId` exist  
* identity invariants are encoded in tests  
* new code does not create identity from labels or content  
* existing persistence remains unchanged  
* tests pass

---

# **Phase 2 — Contrast Domain Introduction**

## **Goal**

Create explicit Contrast ownership after the identity foundation is stable.

Add:

src/domain/contrast/

Suggested:

contrast.ts  
contrastTypes.ts  
contrastValidation.ts

---

Responsibilities:

Contrast owns:

* identity  
* metadata  
* example relationship

Contrast does not own:

* storage  
* React  
* audio

Compatibility with `Pair.group` remains in place during this phase. Phase 2
does not migrate learner persistence.

## **Completion Criteria**

* Contrast domain ownership exists  
* `Pair.group` compatibility remains intact  
* no learner persistence migration has occurred

---

# **Architecture Review Gate Before Phase 3**

Before migrating persistence, the following review is required:

* identity model approved  
* migration strategy documented  
* rollback strategy documented  
* progress preservation verified

Phase 3 must not begin until this gate is satisfied.

## **Gate Status**

Date: 2026-07-30

* identity model approved — Decision 006 (`ContrastId` is language-scoped) and
  Decision 007 (`LanguageId` is an application-owned identity)  
* migration strategy documented — Decision 008 and the Phase 3 sections below  
* rollback strategy documented — Compatibility and Rollback Strategy below  
* progress preservation verified — Phase 3.3 provides the executable harness,
  and PR 3.7 may not ship until that harness reports a clean audit

Design review is satisfied, so implementation may begin at PR 3.0. The
progress-preservation evidence itself is produced during the phase and gates the
only learner-visible release.

Phase 3.3 is complete.

The verification harness proves:

* identity mappings are deterministic  
* learner history can be projected without loss  
* rollback compatibility assumptions hold  
* migration invariants are executable

Phase 3.4 was implemented against these verified assumptions and is complete.

### **Phase 3.4 Completion Record**

The read-only production projection establishes:

* `@pairProgress_v2` remains the sole authoritative pair-attempt store
* `getContrastProgress()` is additive and performs no writes
* current and historical pair-key aliases converge on the same stable
  `ContrastId` without overwriting either history or duplicating attempts
* alias-derived history and aggregate ordering are deterministic and repeated
  projection is idempotent
* non-array attempt containers retain the existing production behavior of
  normalizing to an empty history; the raw `invalid-attempt-container` reason
  is therefore unrecoverable after parsing, which is documented diagnostic
  information loss rather than a progress-semantics mismatch
* projected histories, pair references, and attempts are copied and frozen,
  providing deep reference isolation from parsed learner state
* zero pair-progress write paths changed

Storage keys, serialization, history caps, UI, analytics, scheduling,
practice-session behavior, and mastery remain unchanged.

### **Phase 3.5 Completion Record**

Phase 3.5 is complete. Its stable-identity mastery foundation remains disabled
by default and introduces no learner-visible migration behavior.

### **Phase 3.6 Completion Record**

Phase 3.6 is complete as an explicit historical orphan-adoption foundation.

Implemented:

* deterministic orphan detection
* conservative orphan-adoption policy
* rollback-era legacy recovery
* retry-safe, explicit per-language adoption
* represented-evidence-only marker repair
* deterministic, whole-document stable persistence

The pure analysis recognizes exact legacy evidence through the Phase 3.2
mapping and Phase 3.5 fingerprint contracts, then reports adoptable,
already-represented, blocked, unresolved, and malformed evidence with
deterministic counts and decisions. The policy preserves valid stable state,
reset tombstones, placement lowering, and stable practice updates. Newly
observed evidence can update only migration-derived state; missing marker
metadata permits additive recovery only where stable identity state is absent.

The per-language operation is explicit and retry-safe. It writes the stable
mastery document first and advisory migration metadata second, reports partial
completion when only the first write succeeds, never deletes legacy data, and
does not repair unusable stable payloads.

The pre-merge hardening pass locks four additional invariants:

* stable identity existence and exact legacy-evidence representation are
  distinct analysis states
* simultaneous aliases form one `ContrastId + observation revision` batch;
  equal-tier evidence converges and conflicting tiers use only the existing
  equal-revision tie-break
* marker repair fingerprints only represented or successfully persisted
  evidence; blocked, reset-protected, unresolved, malformed, and failed
  adoption evidence remains excluded and visible on retry
* stable persistence is one deterministic, whole-document `setItem`; a failed
  stable write leaves prior bytes authoritative and stops before marker writing

Not implemented:

* production enablement
* startup migration
* background migration
* automatic recovery execution

`FEATURE_FLAGS.contrastMasteryStore` remains false. There is no startup,
background, UI, analytics, scheduling, practice, pair-progress, or Phase 3.7
integration.

### **Phase 3.7 Complete**

Phase 3.7 is complete. It adds controlled rollout support without advancing the
production build beyond `disabled`.

Implemented:

* build-time states: `disabled`, `shadow`, `internal-test`, `limited`, and
  `enabled`
* a non-mutating shadow comparison with explicit missing-record, tier, reset,
  placement, alias, fallback, malformed, and unresolved diagnostics
* stable-first authoritative reads with legacy fallback only for genuinely
  missing stable state
* existing legacy-first compatibility writes in every authoritative state
* session metrics and an internal diagnostic sink for rollout operations and
  failures
* a pure measurable release gate covering data, error, identity, placement,
  reset, and practice safety
* rollback verification from enabled dual writes to disabled legacy reads

Runtime reads do not activate migration, repair markers, or adopt orphans.
Migration and adoption remain explicit per-language operations. No startup
migration, background scan, bulk recovery, remote infrastructure, pair-progress
write, learner-facing analytics, or UI behavior was added.

Production state:

* `FEATURE_FLAGS.contrastMasteryStore` remains disabled
* real-install shadow evidence is outstanding
* Phase 3.8 status: architecture audit complete; retirement deferred (see
  below and Decision 011)

A real install carrying real learner history must complete shadow verification
with zero unresolved mappings and zero unexplained divergence before rollout
advances. This is an operational release gate, not missing migration
architecture.

### **Phase 3.8 Status**

Phase 3.8's architecture audit is complete (`docs/Phase-3.8-Architecture-Audit.md`).
Its findings:

* the migration and compatibility architecture is implementation-complete and
  internally consistent
* production retirement of any compatibility component is deferred — see
  Decision 011
* rollout remains `disabled`; no shipped install has written a stable mastery
  document
* legacy reads, legacy writes, migration markers, and orphan recovery remain
  protected until the operational evidence gates in the audit are satisfied
* stabilization and evidence-collection work (persisting rollout diagnostics,
  making the safety gate observable against real data, advancing rollout on
  internal builds) is in scope for Phase 3.8; cleanup or deletion of
  compatibility code is not

No cleanup or deletion phase has begun. Phase 3.8 is stabilization and
evidence work, not migration retirement.

#### **Phase 3.8 sub-package status — updated 2026-08-01**

* **3.8A — diagnostic evidence persistence: complete.** Rollout diagnostics
  are durable across cold start, bounded, isolated from learner state, and
  schema-validated. Diagnostic loss remains an accepted degradation mode.
* **3.8A.1 — diagnostic evidence completeness: complete.** The observer-only
  producer layer now preserves directional divergence, operation-scoped
  storage outcomes, unresolved reliability conditions, language observations,
  cold starts, diagnostic self-metrics, and an explicit producer manifest.
  Evidence interpretation remains outside the diagnostic runtime.
* **3.8B — advisory safety evaluator: implemented, not wired.** The pure
  evaluator consumes already-read evidence and emits `READY`, `BLOCKED`, or
  `INSUFFICIENT_EVIDENCE`; the lossy compatibility API is isolated in a legacy
  adapter. No runtime module consumes either evaluator surface, and the
  implementation does not accept or activate the proposed Decisions below.
* **3.8C–3.8G:** unchanged, still proposed, still sequenced after the above.

Proposed Decisions 012 (evidence provenance — unknown never evaluates as
zero), 013 (reliability evaluates unresolved state, not historical
occurrence), and 014 (advisory gate with `READY` / `BLOCKED` /
`INSUFFICIENT_EVIDENCE` output and no write capability) are recorded in
`docs/Contrast-Domain-Architecture-Decisions.md` under "Proposed Decisions —
not accepted." They are proposals awaiting human approval.

Production state is unchanged by all of the above: rollout remains `disabled`,
legacy remains the sole mastery authority, no migration is wired, and no
learner-visible behavior has changed. Decision 011's retirement evidence
requirements remain in force and remain unsatisfied.

---

# **Phase 3 — Progress/Mastery Evolution**

## **Goal**

Move learner progress and mastery from implicit, mutable keys toward explicit
stable identities.

Current:

mastery\[group\]

Target:

mastery\[contrastId\]

---

Migration requirements:

Support:

old storage  
        |  
        v

migration layer

        |  
        v

new storage

Never silently reset progress.

---

## **Phase 3 Philosophy**

* Preserve legacy storage.  
* Prefer projection over destructive migration.  
* Introduce new identities additively.  
* Keep rollback possible without data repair.  
* Treat learner history as immutable evidence.

The application is offline-first with no backend, so there is no remote kill
switch and rollback latency equals a release cycle. The migration must therefore
be non-destructive and self-healing by construction rather than reversible by
operational action.

---

## **Phase 3.6 Orphan Adoption Strategy**

### **Purpose**

Recover safely from valid legacy mastery evidence that appears after stable
mastery migration without weakening the authority of stable learner state.

### **Non-goals**

Phase 3.6 does not:

* enable stable mastery
* run automatically
* scan all users or languages
* delete legacy data
* repair malformed records
* infer unknown or ambiguous mappings

### **Recovery Model**

legacy mastery  
        |  
        v

historical identity mapping  
        |  
        v

orphan analysis  
        |  
        v

adoption decision  
        |  
        v

stable mastery document  
        |  
        v

advisory marker update

### **Evidence Classification**

Orphan analysis classifies evidence as:

* already represented
* adoptable
* blocked
* unresolved
* malformed

Only adoptable evidence may modify the stable mastery document.

### **Alias Handling**

Aliases that map to one Contrast and are observed together are evaluated as one
observation batch. Canonical ordering provides deterministic output only; it
does not represent learner-action order or create causal priority.

### **Failure Handling**

If stable persistence fails:

* the advisory marker is not updated
* the previous stable document remains authoritative

If marker persistence fails:

* the operation returns `partial`
* the successfully written stable document remains valid
* retry repairs the marker without duplicating the stable adoption

### **Known Limitation**

If migration metadata is lost, historical causality cannot always be
reconstructed. The system preserves correctness by blocking ambiguous
conflicts rather than guessing.

---

## **Mastery Migration Strategy**

Mastery migrates.

Approach:

* new namespace keyed by `LanguageId` + `ContrastId`  
* lazy per-language migration, performed when that language is loaded  
* dual-read during the transition  
* dual-write during the compatibility window  
* legacy reads remain supported permanently  
* legacy writes stop only after the validation period

Read order during the transition:

new namespace  
        |  
        v

legacy namespace and historical label aliases (fallback and derivation source)

New-namespace-first is deliberate. It exercises the new path from the first
release while legacy remains authoritative, so defects surface while dual-write
still protects the learner.

Stable-state fallback is intentionally asymmetric:

| Stable state | Compatibility behavior |
| --- | --- |
| Missing | Legacy fallback and initial derivation are permitted. |
| Valid | Use the stable document and normal stable/legacy reconciliation rules. |
| Malformed | Block with diagnostics; do not fall back to legacy or modify either representation. |
| Unsupported schema version | Block with diagnostics; do not fall back to legacy or modify either representation. |
| Storage read failure | Return an explicit storage failure; do not silently downgrade to legacy success. |

Malformed and unsupported stable documents are evidence, not absence. Blocking
fallback prevents stale legacy tiers from undoing reset tombstones, placement
lowering, or lower-tier stable practice updates.

Required properties:

* idempotent  
* non-destructive  
* fingerprint validated  
* revision-aware conflict handling

Supporting rules:

* migration is a pure function of legacy data, the alias table, and the
  registry, so re-running it converges on the same result  
* the fingerprint of the legacy source is stored alongside the derived data; a
  mismatch means legacy changed out of band, which is the rollback-then-forward
  case, and triggers re-derivation  
* stable conflicts resolve by monotonic stable-document revision; where
  comparable revisions are equal the higher tier is a deterministic
  tie-breaker, so no migration step can lower an earned tier
* revisions reconstructed from legacy fingerprints are observation revisions:
  they order source changes observed by this migration system, but are not
  timestamps and do not prove the true causal order of the underlying legacy
  learner action relative to independently written stable actions
* initial derivation across historical label aliases merges by highest tier  
* the only permitted downward movement is learner-initiated: reset, and the
  existing placement flow. Revision-aware resolution exists so that highest-tier
  merging cannot resurrect state the learner deliberately cleared  
* wall-clock values are metadata only and must never decide a conflict  
* migration is scoped per language, so there is no cross-key transaction  
* the derived data is written before the migration state record; a failure
  between the two leaves a valid stable document that the next load preserves
  while safely recreating the advisory marker
* a migration-complete state must never be recorded when the legacy source was
  unparseable  
* compatibility writes are serialized and legacy-first: a legacy failure stops
  before the stable write, a stable failure after legacy success is explicitly
  partial, and only both writes succeeding is complete
* learner-initiated reset remains legacy-readable and is represented in stable
  state by revisioned reset tombstones; stale migration metadata must never
  resurrect the cleared records

### **Migration-State Marker**

`@masteryByContrastMigration_${LanguageId}` is advisory metadata and an
optimization, not authoritative learner mastery.

The stable mastery document contains the authoritative revisioned records and
reset tombstones. Missing, malformed, or unsupported marker metadata does not
invalidate or downgrade a valid stable document. The marker is recreated by
baselining the currently visible legacy bytes without reconciling them over
stable state.

Known limitation:

After marker loss, the migration system cannot establish when legacy actions
that occurred while the marker was unavailable happened relative to stable
actions. It therefore preserves the valid stable document and records current
legacy bytes as an observation baseline. Only later observed fingerprint
changes can be ordered as newer legacy evidence.

---

## **Phase 3.7 Controlled Rollout Strategy**

### **Purpose**

Validate stable mastery behavior safely before enabling broader production
usage.

### **Rollout Model**

```text
disabled
    ↓
shadow
    ↓
internal-test
    ↓
limited
    ↓
enabled
```

The rollout state is intentionally controlled. No remote configuration
infrastructure was introduced.

### **Shadow Verification**

Shadow mode:

* compares stable and legacy behavior
* records divergence diagnostics
* performs no migration
* performs no repair
* performs no stable writes
* preserves learner-visible behavior

### **Compatibility Rules**

Read authority:

```text
stable mastery
      ↓
safe legacy fallback
```

Write compatibility:

```text
legacy compatibility write
      ↓
stable mastery write
```

Read authority and compatibility write ordering are separate decisions.
Fallback is permitted only when stable state is unavailable and the fallback is
safe. Compatibility writes retain explicit partial-failure reporting.

### **Safety Gates**

Rollout advancement requires measurable verification of:

* lost mastery
* duplicated mastery
* unexpected tier changes
* reset correctness
* placement correctness
* storage failures
* partial writes
* identity resolution
* alias regressions
* practice behavior

### **Rollback**

Rollback must preserve:

* legacy readability
* stable data preservation
* no destructive cleanup
* no repair requirement

---

## **Pair Progress Strategy**

Pair progress does NOT migrate storage in Phase 3.

Instead:

* keep `@pairProgress_v2` unchanged  
* add read-time projection  
* resolve legacy pair keys into `ContrastId` relationships  
* compute contrast-level progress from legacy history  
* defer `PairId` assignment and storage rewrite to a later phase

Reason:

Pair attempt history is the highest-risk learner artifact and the only learner
data in the application that cannot be re-derived. It should not be rewritten
during this phase.

Projection rules:

* the projection performs no writes to learner progress storage  
* alias expansion covers historical category labels so orphaned pair history
  becomes readable  
* records with no mapping are preserved, counted, and excluded from
  contrast-level rollups  
* unmapped records remain included in global lifetime aggregates so a learner's
  lifetime totals never shrink  
* attempt comparisons are evaluated after the existing per-pair history cap is
  applied

---

## **Historical Identity Mapping Strategy**

Historical identity mapping:

legacy identity → ContrastId

Source of truth:

* code-owned registry  
* immutable `ContrastId` assignments  
* alias table for historical category labels  
* CI validation

The mapping is code, not device data. Nothing about the mapping is persisted on
device; only the result of applying it is stored. A mapping defect is therefore
fixed by a release rather than by repairing learner data.

Required validations:

* unique `ContrastId` values  
* complete dataset coverage  
* no ambiguous mappings  
* aliases are append-only  
* golden-file identity stability

Additional required assertion:

* every historical category label present in the learner-language migration
  aliases must be covered by the contrast registry alias table

Ambiguity is resolved at build time. The application must never choose between
two candidate contrasts at runtime.

---

## **Compatibility and Rollback Strategy**

Rollback strategy:

* no destructive migration  
* no legacy key deletion  
* rollback achieved through code revert  
* legacy storage remains available throughout the compatibility period

Hard invariant:

A previous application version must continue reading learner progress during
Phase 3.

Supporting rules:

* the migration sits behind a single build flag, so disabling it is a one-line
  change  
* only additive keys are introduced: the contrast-keyed mastery namespace and
  the migration state record  
* legacy mastery, placement, pair-progress, and unrelated preference keys are
  never renamed, rewritten in place, or deleted  
* roll-forward after a rollback is automatic through fingerprint divergence and
  revision-aware merging  
* the migrate → revert → practice → re-migrate round trip is a required test,
  not a manual check

---

## **Verification Requirements**

Before migration, capture:

* learner progress counts  
* mastery values per legacy key, including historical label aliases  
* completed exercises and attempt history summaries  
* placement state  
* the resolved identity mapping, including any unmapped records

After migration, compare:

* preserved progress  
* migrated progress  
* unresolved records  
* mismatches

Verification must include realistic fixtures for fresh installs, single- and
multi-language learners, pre-rename labels only, pre- and post-rename labels
together, post-reset state, tier ceilings, corrupt or out-of-range data, unknown
group tokens, capped attempt history, interrupted migration, and post-rollback
divergence.

## **Completion Criteria**

Migration is complete only when:

* no learner progress decreases  
* no attempts are lost  
* legacy keys remain intact  
* mappings are deterministic  
* migration is idempotent  
* rollback has been tested  
* visible learner behavior is unchanged unless intentionally recovering
  orphaned history

Recovered orphaned history is the only permitted visible change, and any release
that recovers it must state so explicitly.

---

## **Phase 3 PR Boundaries**

Approved sequence. Each step is independently shippable and independently
revertable.

3.0 Architecture decisions/docs

3.1 Contrast registry + LanguageId

3.2 Legacy identity mapping + golden file

3.3 Snapshot and verification harness — complete

3.4 Pair-progress read projection — complete

3.5 Contrast mastery store behind feature flag — complete, flag remains off

3.6 Historical orphan adoption — complete, explicit operation only

3.7 Controlled stable mastery rollout — complete; production remains disabled
pending real-install shadow evidence

3.8 Migration stabilization and operational evidence — architecture audit
complete; retirement deferred pending evidence gates (Decision 011). Not a
cleanup or deletion phase. Sub-packages: 3.8A diagnostic persistence complete;
3.8A.1 diagnostic evidence completeness proposed; 3.8B safety gate designed
and blocked on 3.8A.1 (see Phase 3.8 sub-package status above).

### **Phase 3.6 Exit Gate**

Before Phase 3.7:

* orphan identity mapping is deterministic
* rollback-era legacy evidence can be recovered
* stale evidence cannot resurrect reset mastery
* placement lowering remains protected
* simultaneous aliases do not create artificial causality
* marker repair excludes unresolved evidence
* stable writes are complete document writes
* retries converge without duplication
* the mastery feature remains disabled

This gate is verified. It records Phase 3.6 completion; it does not enable or
begin Phase 3.7.

Sequencing rules:

* verification tooling ships before any migration behavior  
* the mastery store ships with its flag off, so enabling it is a one-line diff  
* 3.7 is the only learner-visible release in the phase and requires a clean
  audit on a real install carrying real history, including at least one renamed
  language  
* 3.8 does not close legacy writes on a fixed schedule; retirement of legacy
  writes, legacy reads, migration markers, or orphan recovery requires the
  operational evidence gates recorded in Decision 011 and the Phase 3.8 audit
  to be satisfied first. The alias table remains permanent regardless.

### **Phase 3.7 Exit Gate**

Before Phase 3.8:

* rollout mechanism exists — verified
* shadow comparison exists — verified
* shadow mode preserves learner-visible behavior — verified
* compatibility reads and writes remain intact — verified
* rollback behavior is verified
* migration invariants remain green
* production remains disabled pending real-install shadow evidence

This gate records Phase 3.7 implementation completion. It does not enable
production rollout, close the compatibility window, or begin Phase 3.8.

---

## **Phase 3 Non-Goals**

Phase 3 does NOT include:

* PairProgress storage rewrite  
* `PairId` assignment across all datasets  
* analytics schema migration  
* scheduler changes  
* practice engine refactor  
* UI redesign  
* cross-language contrast unification  
* persistence framework changes

Analytics continue to report the existing legacy contrast value. Changing that
field mid-migration would break continuity of historical analysis, and any
future change should be additive.

---

## **Phase 3 Open Questions**

These are tracked, non-blocking, and must not be silently resolved by
implementation choice:

* whether any abandoned earlier pair-progress payload still exists on device,
  and in what format; nothing may delete it until this is answered  
* the concrete length of the dual-write window, expressed in releases, given
  that no adoption metric is available  
* whether orphan recovery is surfaced to the learner or applied silently  
* whether the verification audit surface ships in release builds behind a
  development flag

Documented defaults until decided: highest-tier merge when pre- and post-rename
data both exist, and preservation over deletion in every ambiguous case.

---

# **Phase 4 — Practice Engine Boundary**

## **Goal**

Separate learning workflow from React.

Current:

usePracticeSession

owns:

* scheduling  
* playback  
* scoring  
* persistence  
* analytics

---

Target:

PracticeSessionEngine

    |  
    \+-- Scheduler

    |  
    \+-- Evaluator

    |  
    \+-- ProgressUpdater

    |  
    \+-- AnalyticsEmitter

---

React becomes orchestration only.

## **Completion Criteria**

* the practice-engine boundary is explicit  
* React remains orchestration-only  
* scheduling, scoring, persistence, and analytics behavior is preserved  
* relevant tests pass

---

# **Phase 5 — Reliability Improvements**

Reliability work follows identity and domain stabilization. It must remain
separable from semantic migrations.

## **Playback lifecycle**

Make audio failures recoverable.

Introduce explicit state:

Idle

Loading

Playing

AwaitingAnswer

Evaluating

Completed

Failed

---

Requirements:

* prevent answer before playback completes  
* recover from missing TTS callbacks  
* expose failure information

## **Data governance**

Make invalid states harder to create.

Validation should enforce:

* unique IDs  
* valid relationships  
* stable identifiers  
* complete metadata

Prefer:

invalid data cannot compile

over:

developers remember rules

## **Completion Criteria**

* playback failures are recoverable and observable  
* identity and relationship validation prevents known invalid states  
* reliability changes do not introduce domain or persistence migrations  
* relevant tests pass

---

# **Agent Operating Rules**

## **Before editing**

Agents MUST:

1. Read this document.  
2. Inspect existing implementation.  
3. Identify current behavior.  
4. Confirm assumptions.

---

## **While editing**

Agents MUST:

* preserve existing behavior  
* make small coherent changes  
* avoid unrelated cleanup  
* add tests for behavior changes  
* update documentation when architecture changes

---

## **Agents MUST NOT:**

* rename concepts casually  
* remove compatibility layers  
* rewrite working systems  
* introduce abstractions without clear ownership  
* move logic into UI components  
* change persistence formats without migration

---

# **Review Checklist**

Before merging any architectural change:

## **Domain**

* Does this make the learning model clearer?  
* Does it strengthen Contrast as a concept?

## **Complexity**

* Does this reduce future change cost?  
* Did we create unnecessary layers?

## **Reliability**

* What happens when this fails?  
* Can we detect and recover?

## **Data**

* Are identities stable?  
* Can existing learner history survive?

## **Maintainability**

* Would a new engineer understand this?

---

# **Agent Handoff Protocol**

Every agent completing work must report:

Summary:

Files changed:

Architecture decisions:

Tests run:

Verification:

Migration concerns:

Remaining risks:

Follow-up recommendations:

---

# **Definition of Success**

This refactor succeeds when:

1. Contrast exists as an explicit domain concept.  
2. Learner progress is independent from mutable content labels.  
3. New exercise types can reuse the learning model.  
4. Practice workflow is separated from UI.  
5. Existing learners retain progress.  
6. Agents can continue development without rediscovering architecture.

---

# **Final Principle**

Do not optimize for fewer files.

Optimize for:

* clearer concepts  
* safer change  
* smaller failure domains  
* easier reasoning

The goal is not a cleaner codebase.

The goal is a codebase that better represents the learning system Soundwise has become.

---

## **Agent instruction recommendation**

Repository agent instructions should link directly to this plan and
`Contrast-Domain-Architecture-Decisions.md` before any agent modifies domain,
progression, persistence, or practice logic.

The durable guidance should provide mission, context, invariants, constraints,
success criteria, and verification without prescribing a rewrite.
