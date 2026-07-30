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
