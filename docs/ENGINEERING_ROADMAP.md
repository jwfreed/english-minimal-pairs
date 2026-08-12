# Soundwise Product Vision — Contrast Mastery

> **This document defines no phases and authorizes no implementation.**
>
> It records **product direction**. It is not an architecture authority, not a
> work sequence, and not a set of instructions for an agent.
>
> Under **Decision 015**, phase numbering belongs to exactly one place:
>
> | Subject | Authoritative source |
> |---|---|
> | Accepted and proposed Decisions | [`Contrast-Domain-Architecture-Decisions.md`](./Contrast-Domain-Architecture-Decisions.md) |
> | Phase definitions, completion records, exit gates | [`Contrast-Domain-Architecture-Evolution Plan.md`](./Contrast-Domain-Architecture-Evolution%20Plan.md) |
> | Slice scope and invariants within a phase | `docs/Phase-*.md` |
>
> An unqualified phase number anywhere — a prompt, an issue, a commit message —
> refers to the Evolution Plan.

**Status of this document:** vision, reconciled against the repository on
2026-08-12 at HEAD `8a1cceb`.

**History.** This document was originally written as an independent roadmap with
its own Phase 0–6 numbering. That numbering collided with the Evolution Plan's
Phase 0–5, and described a repository state that no longer existed — most of its
phases had already shipped under different numbers, and one of its readings led
into a migration gated by Decision 011. The phase structure has been removed and
replaced with themes. The product intent is preserved unchanged.

---

## 1. Why the product is changing

### The loop that is not changing

```
Present contrast → Learner listens → Learner responds → Feedback → Repeat
```

This loop is product-critical. It is not being replaced, redesigned, or
restructured by any work described here.

### The model that is changing

Today, learning is represented as:

```
Contrast Group → Mastery Tier (1-6) → Visible Practice Items
```

The problem is at the ceiling: **tier 6 has no meaningful next state.** A
learner who reaches it has nowhere to go, and the system has nothing to say
about whether their perception has actually become durable.

### Where it is going

From **"complete levels"** toward **"build durable perception mastery."**

```
Learner
  └── Contrast Knowledge
        ├── Current ability
        ├── Confidence
        ├── Recency
        ├── Retention
        └── Practice recommendation
```

The question the system should be able to answer:

> What practice creates the highest learning value for this learner now?

### The principle underneath

Learners do not master levels. **Learners master contrasts.**

---

## 2. Standing principles

These are stable commitments, not work items.

**Domain first.** The domain layer explains learning, not React. Organize around
domain concepts → application workflows → infrastructure → UI.

**Deep modules.** Prefer one module that hides real complexity behind a simple
interface over a family of `Service` / `Manager` / `Helper` / `Utils` shells.
Note that a `PracticeSessionEngine` was evaluated against this principle and
**rejected** — see `Phase-4.2-Mastery-Progress-Lifecycle-Review.md` §7.3.

**Reliability is correctness.** Every feature answers: what can fail, how is it
detected, what is the recovery, what is the user impact.

**Data ownership is explicit.** Every persistent fact has an owner, a schema, a
migration path, validation, and a defined recovery behavior. React state must
never become the database by accident.

**No ML, no external AI, no complex prediction.** Retention and recommendation
start deterministic and stay explainable.

---

## 3. Themes, and where each one actually stands

Annotations are point-in-time, verified 2026-08-12 at HEAD `8a1cceb`. For
current status, the Evolution Plan governs.

### Theme — Shared architectural language

*Define Learner, Contrast, ContrastProgress, PracticeAttempt, PracticeSession as
explicit domain terms.*

**Delivered.** `Contrast-Domain-Architecture-Evolution Plan.md` §"Domain
Concepts" and accepted Decisions 001–011 and 015. Contrast, Pair, and identity
are explicit domain entities with branded `ContrastId` / `LanguageId` /
`PairId` types.

### Theme — Learning rules live outside React

*Move streak, speed, and mastery decision logic out of `usePracticeSession`.*

**Delivered.** The rules were never in React — `src/learning/adaptiveProgression.ts`
has always owned the promotion arithmetic as a pure function. The *state* moved
out in tracked Phase 4.2 (`eb41f1b`), which created
`src/domain/practice/progressionState.ts`. Tracked Phase 4 delivered five such
extractions: trial scheduling (`86334ab`), progression state (`eb41f1b`),
placement assessment (`66ad104`), mastery read-projection (`933aeb7`), and pair
identity consolidation (`5cc4213`).

**Follow-on delivered.** Progression state is keyed by resolved `ContrastId`
rather than by the ambiguous `Pair.group` string, closing a cross-category
collision that was previously prevented only by an unrelated layout remount key.

### Theme — Mastery becomes richer than a number

*Tier stops being the whole model.*

**Open.** This vision does not decide whether richer mastery remains a read-side
projection or eventually changes durable state. The existing per-contrast
persistence (`ContrastMasteryRecord`, versioned document, tombstones,
provenance) ships **disabled** behind Decision 011's evidence gate.

### Theme — Retention, not just performance

*From "did they answer correctly" to "will they remember later."*

**Not started.** Deterministic only: last reviewed, review interval, retention
confidence. Bounded by what `@pairProgress_v2` retains — it caps at 100 attempts
per pair, so any long-horizon signal must state its behavior at that boundary.

### Theme — Practice recommendation

*Separate "what exists" from "what should happen next."*

**Partly delivered.** `utils/recommendNextPractice.ts` already produces a
recommendation with a stated reason, covered by a 311-line test. A richer
`PracticeDecision` over per-contrast state remains future work.

### Theme — Data reliability

*Schema versions, migrations, recovery behavior, verification.*

**Delivered for contrast mastery.** `CONTRAST_MASTERY_SCHEMA_VERSION`, migration
state with fingerprinted legacy-source observations, tombstones, provenance,
rollback verification, and shadow comparison — tracked Phases 3.5 through 3.7.
Not yet extended to every stored entity.

### Theme — Operational visibility

*Observe practice, persistence, and migration failures.*

**Delivered as diagnostics.** `src/analytics/masteryRolloutDiagnostics.ts` and
`src/storage/masteryRolloutDiagnosticStorage.ts`; tracked Phase 3.8A recorded
complete 2026-08-01. Learner-facing developer tooling (view state, export
progress, validate storage) remains unbuilt.

---

## 4. Authoritative constraints relevant to this direction

These summarize constraints already established by the Decisions and Evolution
Plan. Consult those sources before implementation; this vision document does
not create additional authority.

* **The practice loop is untouchable.** Hear → choose → feedback → repeat.
* **Rollout state is human-controlled.** `CONTRAST_MASTERY_ROLLOUT_STATE` stays
  `disabled` until real-install evidence satisfies Decision 011's gates. No
  agent may advance it.
* **Mastery authority is protected.** `src/hooks/useContrastPairs.ts`,
  everything under `src/storage/`, `contrastMasteryPersistence.ts`,
  `masteryRolloutSafety*.ts`, `orphanMasteryAdoption.ts`, and
  `historicalIdentityMapping.ts` carry recorded findings owned by WP-3.8G. Read
  them; do not edit them.
* **Identity is never derived from a label.** Resolve through
  `historicalIdentityMapping`. Category labels and pair content have both
  changed over the life of the application; that is why Decisions 006–008 exist.
* **No new progress model.** Three contrast-progress-shaped types already exist
  (`ContrastPairProgress`, `ContrastMasteryRecord`, `ContrastProgression`). A
  fourth requires saying explicitly what it supersedes.
* **Smallest cohesive change.** No unrelated refactors, no new dependencies, no
  opportunistic fixes folded into a move.

---

## 5. Open product decisions

These block direction, not the current work.

| # | Question | Where it lives |
|---|---|---|
| A | Should progression toward the next mastery tier survive an app restart? | Unresolved — `Phase-4.2-Mastery-Progress-Lifecycle-Review.md` §8.2 records the options but authorizes none |
| B | Does contrast mastery replace tiers, or project over them? | Unresolved product decision; this vision document authorizes neither model |
| C | What unblocks the Phase 3.8 evidence gate, and who owns collecting it? | Evolution Plan, Decision 011 — unowned |
| D | Is orphan mastery recovery surfaced to the learner or applied silently? | Evolution Plan, Phase 3 Open Questions |
| E | In-memory vs. on-disk attempt divergence past 100 attempts | `Phase-4-Architecture-Plan.md` §2.5 — learner-visible in Results charts |

---

## 6. For agents

Read [`AGENTS.md`](../AGENTS.md) first. Then:

1. Read the Evolution Plan and the Decisions document. **This file is not an
   instruction set**, and a theme in §3 is not a task.
2. Inspect the current implementation before proposing a change. Several themes
   above are already delivered; verify before building.
3. State current behavior, the intended change, and the risks before editing.
4. Make the smallest cohesive change. Preserve existing behavior. Add tests.
   Avoid unrelated refactors and new dependencies.
5. Verify with `npm run check`, and report: files changed, tests run, results,
   risks, follow-ups.
