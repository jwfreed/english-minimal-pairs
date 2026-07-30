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

Phase 3.4 may begin only against these verified assumptions.

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

As of 2026-07-30:

* Phase 0 — complete  
* Phase 1 — complete (identity foundation)  
* Phase 2 — complete (Contrast domain boundary)  
* Phase 3 — design approved and locked by Decisions 006, 007, and 008;
  implementation begins at PR 3.0 of the sequence in
  `Contrast-Domain-Architecture-Evolution Plan.md`

The "don't start yet" signals above still apply, and Decision 008 adds one more:
any proposal to rewrite pair-progress storage during Phase 3 is out of scope and
should be rejected without new evidence.
