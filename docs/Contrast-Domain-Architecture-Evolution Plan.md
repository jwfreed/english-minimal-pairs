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

However:

The persistence and domain model still primarily represent:

Pair

instead of:

Contrast

This mismatch is the primary architectural opportunity.

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

# **Implementation Strategy**

## **Phase 0 — Documentation and Invariants**

Goal:

Make current assumptions explicit.

Create:

docs/architecture/domain-model.md

Document:

* Pair  
* Contrast  
* Group  
* Mastery  
* Progress

Add diagrams.

Success:

Future agents understand the intended model.

---

# **Phase 1 — Introduce Stable Domain Identity**

## **Goal**

Stop using mutable content as identity.

Current:

category \+ group \+ words

Target:

contrastId  
pairId

---

## **Changes**

Introduce:

type ContrastId \= string;  
type PairId \= string;

All new code should use IDs.

Avoid:

string group

for domain identity.

---

## **Migration Rule**

Existing IDs must remain valid.

Existing learners must not lose progress.

---

## **Verification**

Tests:

* content rename does not change identity  
* ordering changes do not change identity  
* duplicate IDs fail validation

---

# **Phase 2 — Introduce Contrast Domain Model**

## **Goal**

Create explicit Contrast ownership.

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

---

# **Phase 3 — Migrate Mastery**

## **Goal**

Move mastery from implicit groups to explicit contrasts.

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

---

# **Phase 4 — Practice Engine Extraction**

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

---

# **Phase 5 — Playback Lifecycle Hardening**

## **Goal**

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

---

# **Phase 6 — Data Governance Improvements**

## **Goal**

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

## **Additional recommendation**

I would place this alongside an agent instruction file:

AGENTS.md

with a short rule:

> Before modifying domain, progression, persistence, or practice logic, read `docs/architecture/contrast-domain-refactor-plan.md`.

That gives Codex/Claude a durable anchor while allowing implementation agents to move quickly. This follows the same principle from the agent knowledge bases: provide mission, context, source of truth, invariants, constraints, success criteria, and verification — not a giant procedural script.

