# **Contrast Domain Architecture Decisions**

## **Decision 001**

Date:  
2026-07-30

Status:  
Accepted

## **Context**

The application currently represents learning progress primarily through minimal pairs.

However, product behavior treats contrast groups as the true learning unit.

Examples:

* mastery  
* analytics  
* recommendations  
* curriculum progression

## **Decision**

Contrast is a first-class domain entity.

Pairs are examples belonging to contrasts.

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

# **First Agent Task**

I would **not** start with implementation.

First task:

## **Agent reconnaissance \+ plan validation**

Give Codex/Claude this task:

---

## **Task**

Review the current repository against:

docs/Contrast Domain Architecture Evolution Plan.md

Do not modify code.

Validate:

1. Current domain boundaries  
2. Existing identity assumptions  
3. Persistence formats  
4. Migration risks  
5. First implementation slice

Return:

* confirmed assumptions  
* contradictions  
* missing information  
* recommended Phase 1 implementation plan

---

Why?

Because AI agents are excellent at execution, but we want to avoid:

> "The plan said X, but the repo actually works differently."

The Codex knowledge base specifically emphasizes inspecting before modifying and verifying against repository truth.  
Claude's guidance similarly emphasizes source-of-truth grounding and context before action.

---

# **Proposed Execution Sequence**

## **Step 0 — Architecture Lock**

Create:

docs/architecture/  
    contrast-domain-decisions.md

No code.

---

## **Step 1 — Identity Stabilization**

Smallest valuable code change.

Introduce:

ContrastId  
PairId

Add tests.

No behavior changes.

Goal:

Prevent future identity drift.

---

## **Step 2 — Introduce Contrast Types**

Add:

src/domain/contrast/

Only types \+ validation.

No migration yet.

---

## **Step 3 — Migrate Read Paths**

Change:

group

usage toward:

contrastId

Keep compatibility.

---

## **Step 4 — Migrate Persistence**

Only after identity is stable.

---

## **Step 5 — Practice Engine Boundary**

Only after domain concepts settle.

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
→ **Phase 1: Stable identity**

Not:

"Refactor Contrast everywhere."

The first commit should feel almost boring:

* new types  
* new validation  
* new tests  
* zero user-visible change

That is the right first move for a production app.

The system is already healthy; the goal is to make its architecture catch up with the product's domain.

