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

## **Future risk**

Future agents must not repeat this pattern. Renaming a label, correcting a word,
or normalizing an identifier must never silently create a new learner identity.

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

Verification:

* existing users retain progress  
* new writes use new format  
* migration is idempotent  
* old identifiers remain readable for the supported compatibility period

## **Completion Criteria**

* migration preserves existing users  
* migration is idempotent  
* legacy reads remain supported during the compatibility period  
* rollback and progress-preservation verification remain valid

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
