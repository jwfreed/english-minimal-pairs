# Phase 4 Architecture Plan — Domain Ownership Extraction

Date: 2026-08-01
Branch: `main` (HEAD `8456519`)
Status: **Proposal. Not an authorization.** Documentation only — no source,
test, configuration, feature flag, rollout state, or Decision was modified to
produce this document.

Evidence base: `npm test` → 470 passing assertions, 0 failures, exit 0, at the
commit above. Every file:line citation references the repository at that commit
and was read directly, not inferred from filenames.

**2026-08-01 revision — pre-implementation safety constraints.** Added before
Phase 4.1 begins, at the architecture owner's request. Scope is unchanged: Phase
4.1 remains trial scheduling state extraction only. The revision adds §5.2 (the
behavioral contract precedes the extraction, with mutation-testing
expectations), §5.3 (nineteen named scheduling invariants), §5.5 (the module's
enforceable may-own / must-not-own boundary), §5.7 (the mandatory two-commit
split), §6.3 (explicitly deferred findings), and §6.4 (no architecture
inflation). §5 subsections were renumbered to accommodate them.

One finding surfaced during this revision and is the reason it was worth doing:
**invariant I7 — a mastery promotion silently resets scheduling cycle
coverage**, via an identity-based React dependency. It is current shipped
behavior, covered by no test, documented nowhere, and would be removed by the
most natural reading of the code during extraction. It is now pinned.

**2026-08-01 hardening pass — final review before implementation.** A
line-by-line re-read of `usePracticeSession.ts` against this plan found five
further hazards and one error in the plan itself. Scope is unchanged. Added:
invariants **I16** (random-stream consumption), **I17** (present-then-observe
ordering), **I18** (deferred-playback branch); fixture input/output contracts
requiring a **stubbed clock and both random consumers** (§5.6); the
`round-started` event and its fixed query→consume→commit order (§5.4); the
`lastStartedContrastRef` trap (§5.5); and §5.11, an explicit
included/excluded scope table.

**Corrected in this pass:** §2.1 previously said the transition policy lived at
"five sites" in "the same four-field reset literal written three times." Both
were wrong — there are **seven sites in four distinct reset shapes**, and an
implementer working from the earlier count would have missed two mutation sites
and collapsed three resets that differ.

---

## Authority of this document

This document is a **plan**, not a source of truth. It defines no Decision,
accepts no proposed Decision, grants no permission, and changes no gate. Where
it summarizes a rule, the authoritative statement lives elsewhere and governs on
any conflict:

| Subject | Authoritative source |
|---|---|
| Accepted and proposed Decisions | [`Contrast-Domain-Architecture-Decisions.md`](./Contrast-Domain-Architecture-Decisions.md) |
| Phase definitions and completion criteria | [`Contrast-Domain-Architecture-Evolution Plan.md`](./Contrast-Domain-Architecture-Evolution%20Plan.md) |
| Work-package sequencing, Phase 4 entry criteria | [`Phase-3.8-Stabilization-Plan.md`](./Phase-3.8-Stabilization-Plan.md) |
| Retirement evidence gates | [`Phase-3.8-Architecture-Audit.md`](./Phase-3.8-Architecture-Audit.md) |
| Evidence model and evaluator semantics | [`Phase-3.8B-Safety-Gate-Evidence-Model.md`](./Phase-3.8B-Safety-Gate-Evidence-Model.md) |
| Operational review and rollout authority | [`Phase-3.8-Operational-Evidence-Review-Model.md`](./Phase-3.8-Operational-Evidence-Review-Model.md) |

Throughout, **Fact** marks something read directly in the repository.
**Interpretation** marks an architectural judgment made by this document. They
are never merged into one statement.

---

## 1. Current architecture map

### 1.1 Major runtime flows

**Flow A — practice round.**
`app/(tabs)/index.tsx` → `usePracticeSession` → (`useContrastPairs`,
`usePairProgress`, `useAudio`, `practiceAnalytics`) → `src/domain/practiceSession.ts`
→ `src/learning/adaptiveProgression.ts`.

A round proceeds: the learner presses Play
([usePracticeSession.ts:256-340](../src/hooks/usePracticeSession.ts#L256-L340));
`choosePlaybackForRound` decides replay-vs-new-round; on a new round
`selectNextTrialPair` picks the next pair within the active contrast;
`markScheduledPair` records it; `practiceAnalytics.pairPresented` fires; audio
plays. The learner answers
([:355-457](../src/hooks/usePracticeSession.ts#L355-L457)); `applyPracticeAnswer`
computes correctness, response time, and the progression outcome;
`recordAttempt` appends to pair progress; analytics fire; speed/streak refs
update; on mastery promotion `promote(group)` mutates the mastery map.

**Flow B — mastery persistence.**
`useContrastPairs` selects one of two authority modes per render
([useContrastPairs.ts:37-43](../src/hooks/useContrastPairs.ts#L37-L43)). With
`CONTRAST_MASTERY_ROLLOUT_STATE = 'disabled'`
([featureFlags.ts:18](../src/config/featureFlags.ts#L18)) the legacy branch is
live: direct `AsyncStorage` read of `@mastery_${categoryLabel}`
([:72](../src/hooks/useContrastPairs.ts#L72)), direct write
([:126](../src/hooks/useContrastPairs.ts#L126)), direct removal
([:177](../src/hooks/useContrastPairs.ts#L177)). The stable branch routes
through `readCompatibleMastery` / `writeCompatibleMastery` and is dormant.

**Flow C — results and recommendation.**
`app/(tabs)/results.tsx` reads attempt history from `usePairProgress`, mounts a
second independent `useContrastPairs` instance for the same category
([results.tsx:72](<../app/(tabs)/results.tsx#L72>)), computes a mastery summary
inline ([:75-95](<../app/(tabs)/results.tsx#L75-L95>)), and computes a next-practice
recommendation via `computePracticeNextRecommendation`
([:107-110](<../app/(tabs)/results.tsx#L107-L110>)). Selecting the recommendation
sets a target group in `PracticeTargetContext`, which the practice screen
consumes ([usePracticeSession.ts:111-129](../src/hooks/usePracticeSession.ts#L111-L129)).

**Flow D — entry gate and placement.**
`usePracticeEntryState` resolves onboarding and per-category placement state
through the pure `resolvePlacementStateForCategory`
([masteryPersistence.ts:119-147](../src/domain/masteryPersistence.ts#L119-L147)),
performing the one-way legacy placement migration writes itself
([usePracticeEntryState.ts:45-54](../src/hooks/usePracticeEntryState.ts#L45-L54)).
`PlacementTest` runs a 10-item assessment and returns a recommended tier, which
the screen applies via `setAllGroupsToTier`
([index.tsx:95-101](<../app/(tabs)/index.tsx#L95-L101>)).

**Flow E — diagnostics and evaluation (dormant).**
`masteryCompatibility` emits diagnostics to `masteryRolloutDiagnostics`, which
persists via `masteryRolloutDiagnosticStorage`. `masteryRolloutSafety` consumes
an already-read `EvidenceSnapshot`. **Fact:** no module under `app/` or `src/`
imports the evaluator, asserted by an import-graph test
(`scripts/masteryRolloutSafety.test.js`). With rollout `disabled`, Flow B's
legacy branch never reaches the compatibility layer, so this flow does not
execute in shipped builds.

### 1.2 Existing domain modules

These already exist and are pure. Phase 4 does not need to create them.

| Module | Owns | Purity |
|---|---|---|
| [`src/domain/practiceSession.ts`](../src/domain/practiceSession.ts) | Trial selection rule, cycle-coverage rule, miss-decay rule, playback choice, answer evaluation, mastery-visibility projection, placement tier thresholds | Pure; randomness injected |
| [`src/learning/adaptiveProgression.ts`](../src/learning/adaptiveProgression.ts) | Speed/streak/promotion arithmetic | Pure |
| [`src/domain/masteryPersistence.ts`](../src/domain/masteryPersistence.ts) | Mastery serialization, normalization, storage-key format, placement decision | Pure |
| [`src/domain/contrastMasteryPersistence.ts`](../src/domain/contrastMasteryPersistence.ts) | Stable document schema, reconciliation, revisions, tombstones | Pure |
| [`src/domain/compatibility/historicalIdentityMapping.ts`](../src/domain/compatibility/historicalIdentityMapping.ts) | Historical label/group → stable identity resolution | Pure |
| [`src/domain/contrast/pairProgressProjection.ts`](../src/domain/contrast/pairProgressProjection.ts) | Read-side projection of parsed pair progress onto stable identities | Pure; storage-free by construction |
| [`src/domain/identity.ts`](../src/domain/identity.ts), [`contrast/contrastRegistry.ts`](../src/domain/contrast/contrastRegistry.ts) | Branded identities, registry | Pure |
| [`src/domain/masteryRolloutSafety.ts`](../src/domain/masteryRolloutSafety.ts) | Advisory evidence evaluation | Pure; no I/O, no React |
| [`src/analytics/learningAnalytics.ts`](../src/analytics/learningAnalytics.ts) | Event type union, sink seam, delivery isolation | Pure + injectable sink |
| [`src/analytics/practiceAnalytics.ts`](../src/analytics/practiceAnalytics.ts) | Payload construction, canonical identifier translation | Pure |

**Interpretation.** The domain layer is not missing. The problem Phase 4
addresses is not *absent* domain modules — it is that the **state** those rules
operate on lives inside React, so the rules can only be composed through a
component tree.

### 1.3 Persistence boundaries

| Adapter | Key | Reached from |
|---|---|---|
| `src/storage/progressStorage.ts` | `@pairProgress_v2` | `PairProgressContext` only |
| `src/storage/contrastMasteryStorage.ts` | `@masteryByContrast_${LanguageId}`, migration marker | `masteryCompatibility` only |
| `src/storage/masteryRolloutDiagnosticStorage.ts` | diagnostic snapshot | `masteryRolloutDiagnostics` only |
| `src/storage/onboardingStorage.ts` | `@onboardingSeen` | `usePracticeEntryState` |
| **direct `AsyncStorage`** | `@mastery_${categoryLabel}` | **`useContrastPairs` itself** |
| **direct `AsyncStorage`** | `@placementDone_${categoryLabel}`, sentinel | **`usePracticeEntryState`, `app/(tabs)/settings.tsx`** |

**Fact.** Three of five learner-state keys are reached through a named storage
adapter. Two — legacy mastery and placement — are reached by React hooks and one
screen calling `AsyncStorage` directly
([useContrastPairs.ts:72](../src/hooks/useContrastPairs.ts#L72),
[usePracticeEntryState.ts:64-66](../src/hooks/usePracticeEntryState.ts#L64-L66),
[settings.tsx:97-100](<../app/(tabs)/settings.tsx#L97-L100>)).

### 1.4 UI orchestration responsibilities

`app/(tabs)/index.tsx` is close to orchestration-only: it selects the category,
gates onboarding/placement/practice, wires callbacks, and renders. It holds two
booleans of purely visual state. **Fact:** `scripts/practiceUi.test.js:242-262`
asserts the screen does **not** reference `applyPracticeAnswer`,
`selectNextTrialPair`, `practiceAnalytics`, or `useAudio` — the screen/hook
boundary is already fenced by test.

`app/(tabs)/results.tsx` and `src/components/PlacementTest.tsx` are not
orchestration-only. Both contain domain rules (§2).

---

## 2. Responsibility audit

### 2.1 `usePracticeSession` — domain state held in React

**Facts.**

- Four scheduling refs hold domain state:
  `lastPairIdRef`, `seenThisCycleRef`, `recentMissStateRef`,
  `manualPairOverrideRef`
  ([:78-87](../src/hooks/usePracticeSession.ts#L78-L87)).
- Three progression refs hold domain state: `groupSpeedRef`, `groupStreakRef`,
  `groupLongStreakRef` ([:58-60](../src/hooks/usePracticeSession.ts#L58-L60)).
- Because refs do not trigger re-render, a `forceRender` counter publishes their
  changes ([:61](../src/hooks/usePracticeSession.ts#L61),
  [:446](../src/hooks/usePracticeSession.ts#L446)).
- The transition policy for that state is spread across **seven** sites, not the
  five a first reading suggests:

  | # | Site | Mutates |
  |---|---|---|
  | 1 | Category reset effect ([:91-106](../src/hooks/usePracticeSession.ts#L91-L106)) | all four, plus a non-scheduling ref — see below |
  | 2 | Target-jump effect ([:111-129](../src/hooks/usePracticeSession.ts#L111-L129)) | all four |
  | 3 | Active-set change effect ([:177-191](../src/hooks/usePracticeSession.ts#L177-L191)) | `seenThisCycle`, `recentMiss`, `lastPairId` *conditionally* |
  | 4 | `markScheduledPair` ([:226-244](../src/hooks/usePracticeSession.ts#L226-L244)) | `lastPairId`, `seenThisCycle` |
  | 5 | `handlePlay` override consumption ([:296](../src/hooks/usePracticeSession.ts#L296)) | `manualOverride` → false |
  | 6 | `handleAnswer` miss update ([:395-399](../src/hooks/usePracticeSession.ts#L395-L399)) | `recentMiss` |
  | 7 | `selectPairManually` ([:459-484](../src/hooks/usePracticeSession.ts#L459-L484)) | three *conditionally*, `manualOverride` → **true** |

- There is **no single reset shape.** Four distinct ones exist: all-four-cleared
  (sites 1, 2); two-cleared-plus-conditional-`lastPairId` (site 3);
  three-cleared-only-if-the-group-changed followed by `manualOverride` set
  **true** (site 7); and the single-field consumption at site 5.

**Correction to an earlier reading.** A previous draft of this document
described "the same four-field reset literal written three times." That is
wrong: sites 1 and 2 are identical, site 7 resets three fields inside a
conditional and then sets `manualOverride` to `true` rather than `false`, and
site 3 resets two. An implementer collapsing all of these into one reducer arm
would change behavior at three of the four.
- The hook raises `Alert` dialogs for audio failures
  ([:218-223](../src/hooks/usePracticeSession.ts#L218-L223),
  [:260-265](../src/hooks/usePracticeSession.ts#L260-L265)) — a UI concern inside
  the workflow hook.

**Interpretation.** The *rules* are extracted; the *state machine* is not. There
is no name for "the scheduling state of a practice session," so it exists as
four independently-mutated refs whose invariants are only enforced by the
ordering of statements in a 540-line hook. This is the single largest coupling
in the application, and it is the one furthest from persisted learner state.

### 2.2 `useContrastPairs` — a hook that is also a persistence adapter and a compatibility policy

**Facts.**

- Selects between two complete authority modes per render
  ([:37-43](../src/hooks/useContrastPairs.ts#L37-L43)).
- Constructs storage keys, performs direct `AsyncStorage` I/O, and calls the
  compatibility layer — in the same module.
- Implements three protocols invisible from its signature: a blocked-read write
  suppression flag (`skipNextStableWrite`,
  [:66-68](../src/hooks/useContrastPairs.ts#L66-L68)), a write serialization
  queue (`stableWriteQueue`, [:111-123](../src/hooks/useContrastPairs.ts#L111-L123)),
  and write-provenance tagging (`nextWriteProvenance`,
  [:143](../src/hooks/useContrastPairs.ts#L143),
  [:155](../src/hooks/useContrastPairs.ts#L155)).
- Also performs the domain projection `selectVisiblePairsByMastery`
  ([:137-139](../src/hooks/useContrastPairs.ts#L137-L139)).
- **Every mount writes.** After the load effect sets `isLoading` false, the
  persist effect runs; on the legacy path it is unconditional
  ([:102-126](../src/hooks/useContrastPairs.ts#L102-L126)). `parseStoredMastery`
  returns a freshly-built object whenever `raw` is non-null
  ([masteryPersistence.ts:61-72](../src/domain/masteryPersistence.ts#L61-L72)), so
  the identity always changes and the effect always fires.
- Consequently the **Results tab performs a mastery write on mount and on every
  focus refresh** ([results.tsx:72](<../app/(tabs)/results.tsx#L72>),
  [:100-105](<../app/(tabs)/results.tsx#L100-L105>)).
- Two independent instances of this hook exist concurrently for the same
  category, one per mounted tab, each with its own copy of the mastery map.
- On the legacy path, a malformed or partially-invalid stored value is parsed to
  a narrowed map and then **written back**, discarding the unparseable portion
  ([:72-74](../src/hooks/useContrastPairs.ts#L72-L74) →
  [:126](../src/hooks/useContrastPairs.ts#L126); normalization at
  [masteryPersistence.ts:41-59](../src/domain/masteryPersistence.ts#L41-L59)).
- `resetMastery` ([:161-184](../src/hooks/useContrastPairs.ts#L161-L184)) has no
  production caller.
- **A failed legacy read is followed by a write of `{}`.** The load effect sets
  `setMastery({})` before reading ([:50](../src/hooks/useContrastPairs.ts#L50));
  the `catch` arms `skipNextStableWrite` **only on the stable path**
  ([:84-86](../src/hooks/useContrastPairs.ts#L84-L86)); `finally` clears
  `isLoading`, and the unguarded legacy persist branch then writes the empty
  map. This is not inference — it is asserted by a currently-passing test:
  `assert.deepStrictEqual(storage.writes, [['@mastery_日本語', '{}']])`
  ([useContrastPairsFlagOff.test.js:188-210](../scripts/useContrastPairsFlagOff.test.js#L188-L210)).

**Interpretation.** The read-failure write is *pinned* legacy behavior, named by
its test as "legacy read-error timing and empty fallback." What no fixture
covers, and what no reviewed document addresses, is its consequence when the key
is **non-empty**: a transient `AsyncStorage` read failure would persist an empty
mastery map over existing learner progress. The stable path is explicitly
guarded against exactly this ("a blocked read must never be followed by an empty
write that could erase still-readable legacy progress",
[:66-68](../src/hooks/useContrastPairs.ts#L66-L68)); the legacy path is not.
This sits directly under the audit's *"learner progress must never silently
disappear"* invariant and belongs to the mastery-authority workstream
(WP-3.8G) — **not to Phase 4**, which must not modify this module. It is
recorded here so a future implementer meets it as a known, classified risk
rather than discovering it mid-extraction.

**Interpretation.** This module is the compatibility contract wearing a hook's
clothing. It is also, per
[`Phase-3.8-Stabilization-Plan.md`](./Phase-3.8-Stabilization-Plan.md) §Phase 4
Readiness, explicitly off-limits to Phase 4 until WP-3.8G relocates mastery
authority. The mount-write behavior and the malformed-narrowing behavior are
**current shipped behavior** and are load-bearing for Phase 3.8 evidence shape
(§7.3). Neither is a Phase 4 defect to fix.

### 2.3 `app/(tabs)/results.tsx` — domain rules in a screen

**Facts.** The definition of "mastered" and the level-count arithmetic are
inline in the render tree: `TOTAL_TIERS = 6`,
`completedLevels += Math.min(tier - 1, TOTAL_TIERS)`,
`if (tier >= TOTAL_TIERS) masteredGroups++`
([:75-95](<../app/(tabs)/results.tsx#L75-L95>)). The tier ceiling `6` also appears
independently in `useContrastPairs.promote`
([:146](../src/hooks/useContrastPairs.ts#L146)),
`buildMasteryForAllGroups` ([practiceSession.ts:129](../src/domain/practiceSession.ts#L129)),
`getNextAdaptiveProgression` ([adaptiveProgression.ts:80](../src/learning/adaptiveProgression.ts#L80)),
and `masteryPersistence.MAX_MASTERY_TIER` ([:5](../src/domain/masteryPersistence.ts#L5)).

**Interpretation.** "How many tiers exist" is a domain fact represented five
times, once of them inside a screen. Any future tier-count change requires
finding all five.

### 2.4 `src/components/PlacementTest.tsx` — assessment logic in a component

**Facts.** Item sampling (one pair per difficulty tier, then random fill) and
shuffling live in the component ([:30-37](../src/components/PlacementTest.tsx#L30-L37),
[:47-69](../src/components/PlacementTest.tsx#L47-L69)). Scoring accumulates in
component state and is passed to the pure `recommendPlacementTier` only at the
end ([:116-137](../src/components/PlacementTest.tsx#L116-L137)). Randomness is
**not injected** — `Math.random()` is called directly at three sites
([:33](../src/components/PlacementTest.tsx#L33),
[:59](../src/components/PlacementTest.tsx#L59),
[:110](../src/components/PlacementTest.tsx#L110)).

**Interpretation.** Only the final threshold mapping is testable. Item
selection — which determines what the placement decision is actually based
on — is untestable by construction, in contrast to the practice scheduler, which
injects `random` and has 40 covering assertions.

### 2.5 `PairProgressContext` — two independent append paths

**Facts.** `recordAttempt` builds an attempt with `Date.now()` and appends it to
React state, then calls `saveAttempt`, which builds a **second** attempt object
with its **own** `Date.now()` and appends that to storage
([PairProgressContext.tsx:46-69](../src/context/PairProgressContext.tsx#L46-L69) →
[progressStorage.ts:78-99](../src/storage/progressStorage.ts#L78-L99)). The
storage path prunes to `MAX_ATTEMPTS_PER_PAIR = 100`
([:8](../src/storage/progressStorage.ts#L8),
[:36-40](../src/storage/progressStorage.ts#L36-L40)); the in-memory path does
not. Progress is loaded once on mount and never re-read
([:42-44](../src/context/PairProgressContext.tsx#L42-L44)).

**Interpretation.** In-memory and on-disk attempt histories can diverge in two
ways: attempt timestamps differ by the write latency, and a pair exceeding 100
attempts within one session shows more attempts before a restart than after.
This is **observable in the Results charts**. It is therefore not a
behavior-preserving refactor target — correcting it changes learner-visible
output and requires a product decision, not an architecture decision.

### 2.6 Identity construction duplicated

**Fact.** `utils/recommendNextPractice.ts` reconstructs the pair-progress key
format inline at two sites
([:57](../utils/recommendNextPractice.ts#L57),
[:107](../utils/recommendNextPractice.ts#L107)) rather than calling
`buildPairId` ([idHelpers.ts:11-13](../utils/idHelpers.ts#L11-L13)), with a
comment instructing that it "must match `buildPairId` exactly."

**Interpretation.** A comment is the only thing binding two copies of a
persisted-key format. This is the precise failure class Phase 3 exists to
eliminate, appearing in a module Phase 3 never touched.

### 2.7 Analytics — already well-owned

**Facts.** `practiceAnalytics` owns payload shape and canonical identifiers;
`learningAnalytics` owns the typed event union, an injectable sink, and failure
isolation ([:87-96](../src/analytics/learningAnalytics.ts#L87-L96)).
`scripts/practiceUi.test.js:304-326` asserts the hook constructs **no**
identifiers or event names, and `:328-334` asserts components emit nothing.

**Interpretation.** Analytics ownership is the healthiest boundary in the
system. The only responsibility remaining in the hook is *when* an event
fires — which is orchestration, and belongs there. **Phase 4 should not create
an `AnalyticsEmitter`.** It would add a layer without moving a responsibility.

### 2.8 The test suite is partly a source-text contract

**Fact.** `scripts/practiceUi.test.js` asserts against the *text* of
`usePracticeSession.ts`, including literal substrings
(`catObj.pairs.filter((pair) => pair.group === group)`,
`if (nextIndex === -1) return false;` — [:297-301](../scripts/practiceUi.test.js#L297-L301)),
required token orderings ([:284-296](../scripts/practiceUi.test.js#L284-L296),
[:336-346](../scripts/practiceUi.test.js#L336-L346)), and negative assertions
that certain identifiers are absent ([:318-325](../scripts/practiceUi.test.js#L318-L325)).
Its own header states the project has no component-rendering test dependency.

**Fact.** By contrast, `scripts/practiceSession.test.js` covers the scheduling
*rules* behaviorally with 40 assertions, including an integrated multi-step
simulation ([:686](../scripts/practiceSession.test.js#L686)), and
`scripts/useContrastPairsFlagOff.test.js` demonstrates a working hand-rolled
React-hook harness driving a real hook against a fake storage.

**Interpretation.** The selection *rules* are protected by behavior. The state
*transitions* are protected only by source text. Any extraction therefore fails
tests that behavior preservation cannot satisfy — which creates pressure to
weaken assertions in the same commit that changes the code they guard. This is
the primary process risk in Phase 4, and it is addressed first (§5).

**The source-text assertions are temporary structural alarms, not the permanent
contract.** §5.2 states that distinction in binding form, including the rules
governing when such an assertion may be relaxed and the mutation-testing
expectation that must be met before it is.

---

## 3. Phase 4 target architecture

**Direction:** move domain *state* out of React into named, pure, independently
testable modules, leaving `usePracticeSession` as the composition root. React
holds the state container and performs I/O; it stops being the place where
domain invariants are enforced.

**What the target explicitly is not.** The Evolution Plan sketches a
`PracticeSessionEngine` owning Scheduler / Evaluator / ProgressUpdater /
AnalyticsEmitter ([Evolution Plan:1273-1291](./Contrast-Domain-Architecture-Evolution%20Plan.md)).
This plan **defers the engine object** and delivers only the collaborators.
Rationale: a `PracticeSessionEngine` is a new runtime authority layer, which the
Phase 4 invariants prohibit; the coupling reduction comes entirely from the
collaborators, and the facade adds indirection without moving a responsibility.
The Evolution Plan's stated completion criteria — explicit boundary,
React orchestration-only, behavior preserved — are satisfiable without it.

### 3.1 Scheduling ownership — `src/domain/practice/trialScheduling.ts`

**Why it exists.** There is currently no name for the scheduling state of a
practice session; it is four refs mutated at seven sites in four distinct reset
shapes (§2.1).

**What it solves.** Makes the scheduling state machine addressable, replayable,
and testable without React. Collapses three duplicated reset literals into one
transition.

**What it owns.** Which pair is presented next within the active contrast;
per-cycle coverage bookkeeping; recent-miss boost lifetime; manual-override
lifetime (exactly one round).

**What it does NOT own.** Which contrast is active; the mastery tier; the
eligible-pair set (supplied by the caller); the `pairIndex` UI cursor;
`stableVisible` picker snapshotting; audio; analytics side effects; persistence;
mastery authority; migration; feature flags; rollout decisions; React lifecycle.
§5.5 states this boundary in enforceable form and names the assertions.

**Boundary trap.** `markScheduledPair` currently mixes a scheduling transition
with a React state setter — it records the presented pair *and* calls
`setActiveGroup` ([usePracticeSession.ts:226-244](../src/hooks/usePracticeSession.ts#L226-L244)).
The reducer takes the transition; the `setActiveGroup` call stays in the hook.
Pulling it into the module would give a pure domain function authority over
React state, which is the inversion this phase exists to remove.

**Note.** The *rules* already exist and are already tested
(`selectNextTrialPair`, `advanceTrialCycleSeenIds`, `updateRecentMissState`).
This module composes them and owns the state they thread through. No rule
changes.

### 3.2 Progression ownership — `src/domain/practice/progressionState.ts`

**Why it exists.** Per-contrast speed and streak counters are domain state held
in refs and published through a render-forcing counter (§2.1).

**What it solves.** Removes the `forceRender` mechanism's role as a domain
publication channel; makes progression state serializable and inspectable.

**What it owns.** The per-contrast map of speed tier, fast streak, and long
streak, and how a `PracticeAnswerResult` updates it.

**What it does NOT own.** The promotion *arithmetic* (stays in
`adaptiveProgression.ts`); the mastery tier; when a promotion is persisted;
playback rate selection.

### 3.3 Placement assessment ownership — `src/domain/practice/placementAssessment.ts`

**Why it exists.** Item selection and scoring live in a component with
non-injected randomness (§2.4).

**What it solves.** Makes the placement decision reproducible under a seeded
random, matching the practice scheduler's existing contract.

**What it owns.** Building the ordered item set from a pair pool, and mapping a
score to a recommended tier (delegating to the existing
`recommendPlacementTier`).

**What it does NOT own.** Placement *completion* state, its storage keys, the
legacy placement migration, or the sentinel. Those are label-derived identity
territory flagged as an open gap by
[`Phase-3.8-Architecture-Audit.md`](./Phase-3.8-Architecture-Audit.md) Finding 5
and are **excluded from Phase 4 entirely**.

### 3.4 Mastery read-projection ownership — `src/domain/contrast/masterySummary.ts`

**Why it exists.** "What counts as mastered" is a domain rule living in a screen,
and the tier ceiling is stated in five places (§2.3).

**What it solves.** One definition of mastery summarization, callable from any
surface.

**What it owns.** Interpretation of an already-read mastery map: mastered-group
count, completed-level count, totals.

**What it does NOT own.** Reading or writing mastery. `useContrastPairs` remains
the only mastery read/write path, unchanged, and **remains mounted in
`results.tsx`** (§7.3 explains why removing that mount is prohibited).

### 3.5 Analytics ownership — no change

**Deliberately no new boundary.** Ownership is already correct (§2.7). Creating
an `AnalyticsEmitter` would relocate call sites without relocating a
responsibility, and would break the existing test fence for no gain.

### 3.6 Progress (attempt-history) ownership — direction only

**Why it would exist.** The append-and-prune rule is implemented twice with
different semantics (§2.5).

**Why it is not a Phase 4 deliverable.** Unifying the two paths changes what the
Results charts display. That is a learner-visible change and violates
Invariant 1. Recorded as direction; any implementation requires a product
decision first, recorded separately.

### 3.7 Mastery mutation ownership (`ProgressUpdater`) — out of scope, gated

**Fact.** [`Phase-3.8-Stabilization-Plan.md`](./Phase-3.8-Stabilization-Plan.md)
§Phase 4 Readiness blocks `ProgressUpdater` on four simultaneous conditions:
(1) rollout held at a single authoritative state long enough for a clean gate
result; (2) WP-3.8C shipped; (3) WP-3.8G complete — mastery authority in exactly
one module; (4) WP-3.8D complete. **Fact:** rollout is `disabled`, WP-3.8C and
WP-3.8G are unbuilt. None of the four holds.

**This plan does not propose relaxing, reinterpreting, or partially satisfying
any of them.** The anti-forking rule — *at no point may two mastery-authority
implementations exist simultaneously* — is treated as binding on every slice
below.

---

## 4. Extraction sequence

Ordering principle: **outward-in by distance from persisted learner state.**
Slice 4.1 touches no storage at all; each subsequent slice moves closer to
persistence; the sequence stops before mastery authority. Every slice is a
*move* — the origin site is deleted in the same commit — so no slice can create
a second implementation of anything.

| # | Slice | Touches storage? | Touches compatibility? | Blast radius |
|---|---|---|---|---|
| 4.1a | Scheduling behavior characterization (tests only) | No | No | `scripts/` only |
| 4.1b | Trial scheduling state extraction | No | No | 1 hook, 1 new module |
| 4.2 | Progression state extraction | No | No | 1 hook, 1 new module |
| 4.3 | Placement assessment extraction | No | No | 1 component, 1 new module |
| 4.4 | Mastery read-projection extraction | Read only, unchanged | No | 1 screen, 1 new module |
| 4.5 | Identity construction consolidation | No | No | 1 util |
| — | `ProgressUpdater` | **Yes** | **Yes** | **Gated — not Phase 4** |

**No slice in this sequence involves a data migration.** No storage key,
serialization format, schema version, or flag is read or written differently by
any of them; §5.9 states this for 4.1 and it holds identically for 4.2–4.5. This
is what makes every rollback a plain `git revert` with no data repair.

### 4.1a — Scheduling behavior characterization *(no production code)*

- **Goal.** Replace source-text protection of scheduling *transitions* with
  behavioral protection, before any code moves.
- **Affected.** `scripts/` only. No file under `src/` or `app/` is edited.
- **Approach.** Add behavioral tests driving the scheduling transitions through
  their public effects, using the existing `loadTsModule` + hook-harness pattern
  from `scripts/useContrastPairsFlagOff.test.js`, plus the replay fixture. The
  full invariant list is §5.3 (I0–I18); it includes **I7, the promotion-triggered
  cycle reset**, which no existing test covers and which is the most likely
  silent behavior change in 4.1b.
- **Verification.** Mutation check on every assertion, per the injection table
  in §5.2. An assertion that cannot be made to fail is not coverage.
- **Rollback.** Revert the commit; no production behavior existed to restore.
- **This is Commit 1 of two** (§5.7). It is merged and green before 4.1b begins.

### 4.1b — Trial scheduling state extraction

- **Goal.** Move scheduling state and its transition policy into
  `src/domain/practice/trialScheduling.ts`.
- **Affected.** `src/hooks/usePracticeSession.ts` (call sites), one new module,
  `scripts/practiceUi.test.js` (relax only the assertions replaced in 4.1a).
- **Approach.** Additive-then-switch inside a single commit: the new module is
  written, the hook's four refs collapse to one state ref, the five transition
  sites become dispatches, the old inline policy is deleted. Existing rule
  functions and `scripts/practiceSession.test.js` are untouched. Module boundary
  per §5.5.
- **Verification.** §5.8. The 4.1a fixture must reproduce byte-identically
  **without being edited**; editing it invalidates the proof.
- **Rollback.** Single-commit revert to the known-good 4.1a state (§5.10). No
  storage format, key, flag, or schema changed, so revert restores the prior
  state exactly with no data repair.
- **This is Commit 2 of two** (§5.7).

### 4.2 — Progression state extraction

- **Goal.** Move `groupSpeedRef` / `groupStreakRef` / `groupLongStreakRef` into
  `src/domain/practice/progressionState.ts`.
- **Affected.** `usePracticeSession.ts`, one new module.
- **Approach.** Same additive-then-switch shape. **Critical constraint:** the
  speed tier feeds `SPEED_TABLE[speedTier]` into `useAudio`
  ([:202-209](../src/hooks/usePracticeSession.ts#L202-L209)). Moving this state
  from a ref to `useState` changes *when* the new rate reaches the audio hook
  relative to the next playback. The extraction must preserve ref semantics
  (state object held in a ref, `forceRender` retained) unless a behavioral test
  proves the rate applied to each trial is unchanged.
- **Verification.** Replay a fixed answer sequence and assert the exact
  `(trial → speed tier → rate)` triple sequence is byte-identical to a baseline
  captured before the change.
- **Rollback.** Single-commit revert.

### 4.3 — Placement assessment extraction

- **Goal.** Move item selection and scoring into
  `src/domain/practice/placementAssessment.ts` with injected randomness.
- **Affected.** `src/components/PlacementTest.tsx`, one new module.
- **Approach.** The component supplies `Math.random` as the injected source, so
  production behavior is unchanged by construction; tests supply a seeded
  source. Placement *completion* state is not touched.
- **Verification.** New pure tests for item-set construction (one pair per
  available tier, fill to 10, no duplicates, stable under a seeded random);
  existing `scripts/categoryPlacement.test.js` and
  `scripts/practiceEntryState.test.js` unchanged and passing.
- **Rollback.** Single-commit revert.

### 4.4 — Mastery read-projection extraction

- **Goal.** Move the mastery summarization rules out of `results.tsx` into
  `src/domain/contrast/masterySummary.ts`, and source the tier ceiling from
  `masteryPersistence.MAX_MASTERY_TIER`.
- **Affected.** `app/(tabs)/results.tsx`, one new module.
- **Approach.** Rules-only. **The `useContrastPairs` mount in `results.tsx`
  stays** (§7.3).
- **Verification.** New pure tests asserting the summary output equals the
  current inline computation across a table of mastery maps including missing,
  minimum, and ceiling tiers.
- **Rollback.** Single-commit revert.

### 4.5 — Identity construction consolidation *(optional)*

- **Goal.** Replace the two inline pair-key reconstructions in
  `recommendNextPractice.ts` with `buildPairId`.
- **Approach.** The produced string must remain byte-identical; this is a
  persisted-key format. Covered by `scripts/recommendNextPractice.test.js`
  (311 lines).
- **Verification.** Assert the two constructions produce identical strings for
  the full pair dataset before removing either.
- **Rollback.** Single-commit revert.

### 4.6 — Why this order is the safest available

1. **It moves outward-in from persisted state.** 4.1 touches no storage key, no
   serialization, no flag. 4.4 touches only a read. The sequence terminates
   before mastery mutation, where Phase 3.8's gates live.
2. **Every slice is individually revertible with no data repair.** Because no
   slice changes a storage key, format, schema, or flag, `git revert` is a
   complete rollback. This is the same property Decision 008 requires of
   migration paths, applied to refactors.
3. **Coverage is built before the code moves.** 4.1a means every later slice
   inherits behavioral protection rather than source-text protection, and no
   slice edits a guard in the commit that changes the guarded code.
4. **No slice can fork an implementation.** Each is a move with same-commit
   deletion of the origin, satisfying the anti-forking rule by construction.
5. **Any stopping point is coherent.** Abandoning after 4.1, 4.2, or 4.3 leaves
   a system with strictly fewer responsibilities in React and no half-migrated
   state. There is no slice whose value depends on a later slice landing.
6. **It front-loads the largest coupling.** Scheduling state is the biggest
   single concentration of domain state in React (§2.1) and simultaneously the
   furthest from Phase 3.8's protected surfaces — the rare case where highest
   value and lowest risk coincide.

---

## 5. Phase 4.1 proposal — trial scheduling state ownership

### 5.1 Why this first

- **It is the only large coupling that touches nothing Phase 3.8 protects.** No
  storage key, no compatibility path, no rollout branch, no diagnostic producer.
- **The rules are already extracted and already covered** — 40 behavioral
  assertions in `scripts/practiceSession.test.js`, including a multi-step
  scheduler simulation. 4.1 moves *state containment*, not rules, so the
  highest-risk part of the change is already fenced.
- **Randomness is already injected** (`selectNextTrialPair` accepts `random`),
  which makes exact behavior preservation *provable* by replay rather than
  merely argued.
- **It removes triplicated reset logic**, the most likely place for a future
  scheduling bug to be introduced by inconsistent editing.

### 5.2 The behavioral contract precedes the extraction

**Phase 4.1 begins with characterization, not movement.** No production file is
edited until the behavior it implements is provable independently of how it is
written.

This rests on a distinction the implementer must hold explicitly:

| | Source-text assertions (`practiceUi.test.js`) | Behavioral assertions (4.1a) |
|---|---|---|
| What they detect | That the code still *looks* a certain way | That the code still *decides* the same way |
| Survive a refactor | No — they fail on any restructuring | Yes — they fail only on a behavior change |
| Status | **Temporary structural alarms** | **The permanent contract** |

**Fact.** The source-text assertions were written for a stated reason: the
project has no component-rendering test dependency, recorded in the header of
[`scripts/practiceUi.test.js`](../scripts/practiceUi.test.js). They were the
cheapest available fence at the time.

**Interpretation.** They are an alarm, not a specification. An alarm that fires
whenever the code is touched conveys no information about whether the *behavior*
changed, and its only available response is to silence it. That is precisely the
failure mode Phase 4.1 must avoid, because silencing it in the same commit that
moves the code destroys the evidence that the move was safe.

Three rules follow, and they are binding on the implementation:

1. **Behavior must be proven before ownership moves.** Every transition relied
   upon in 4.1b has a passing behavioral assertion *before* 4.1b begins.
2. **A source-text assertion may be relaxed only once a behavioral assertion
   covers the same rule.** Relaxation is never a means of making a build green.
3. **No source-text assertion is relaxed in the same commit that changes the
   code it guards.** This is why the two-commit split (§5.7) is structural
   rather than stylistic.

**Mutation-testing expectation.** A test that has never been observed to fail is
not evidence. For each behavioral assertion added in 4.1a, the implementer must
inject a deliberate regression, observe that specific assertion fail, and revert
the injection. The table below gives a worked injection for the ten
transition-and-ordering invariants most at risk during extraction; the
remaining invariants in §5.3 (I0, I9–I15, I18) need injections too, and the
implementer designs those:

| Injected regression | Assertion that must fail |
|---|---|
| Return the last presented pair from `planNextTrial` | I1 no-immediate-repeat |
| Skip the `seenThisCycle` update on presentation | I2 full-coverage-before-repeat |
| Apply the miss boost during the coverage phase | I3 boost-ordering |
| Never expire the miss boost | I4 boost-decay |
| Leave the manual override armed for two rounds | I5 one-shot override |
| Preserve cycle state across a contrast change | I6 contrast-change reset |
| Preserve cycle state across a mastery promotion | I7 promotion reset |
| Emit analytics before committing feedback state | I8 commit-before-observe |
| Make the discarded playback draw lazy | I16 draw consumption |
| Emit `pairPresented` before the scheduling dispatch | I17 present-then-observe |

An injection that produces a **green** suite means the corresponding assertion
is not coverage and must be rewritten before 4.1b proceeds. The injections are
performed in the working tree and reverted; none is committed.

### 5.3 Phase 4.1 scheduling invariants

The contract is not *"the same final UI result."* It is **"the same scheduling
decisions."** Two implementations that display the same pair after ten trials
but reached it through different intermediate choices have **not** preserved
behavior — the learner experienced a different practice sequence.

The extraction must preserve all of the following. Each is stated so that it can
be asserted mechanically.

**Exact trial decision sequence (I0).** For a fixed dataset, seeded random
source, and action script, the ordered list of pair IDs returned by the
scheduler is identical element-for-element, before and after. Not
distributionally similar — identical.

**Presented-pair ordering (I1, I2, I3, I4).**
- **I1** — with ≥2 eligible pairs, the immediately-previous pair is never
  represented ([practiceSession.ts:162-165](../src/domain/practiceSession.ts#L162-L165)).
- **I2** — every eligible pair in the active contrast is presented once before
  any repeat ([:170-172](../src/domain/practiceSession.ts#L170-L172)).
- **I3** — an unseen pair outranks the recently-missed pair during the coverage
  phase; the boost applies only once coverage completes
  ([:169-180](../src/domain/practiceSession.ts#L169-L180)).
- **I4** — the boost expires after `RECENT_MISS_DECAY_TRIALS` subsequent correct
  answers, or immediately on a correct answer to the missed pair
  ([:77-102](../src/domain/practiceSession.ts#L77-L102)).

**Filtering behavior (I9, I10).**
- **I9** — candidates are filtered to the active contrast *before* any random
  draw, never after.
- **I10** — the eligible set is the caller's `visible` list, which is itself
  derived from the mastery map. The scheduler never re-derives, re-filters, or
  caches it. It is **never `stableVisible`** — that snapshot is deliberately
  stale during picker scrolling
  ([usePracticeSession.ts:193-200](../src/hooks/usePracticeSession.ts#L193-L200))
  and feeding it to the scheduler would change sequencing whenever the learner
  scrolls.

**Transition behavior (I5, I6, I7, I11).**
- **I5** — a manual selection owns exactly one round; the following round
  resumes contrast-scoped scheduling
  ([usePracticeSession.ts:283-296](../src/hooks/usePracticeSession.ts#L283-L296)).
- **I6** — a contrast change clears cycle coverage and miss state, and clears
  `lastPairId` only when it no longer names a pair in the new active set
  ([:177-191](../src/hooks/usePracticeSession.ts#L177-L191)).
- **I7** — **a mastery promotion also clears cycle coverage and miss state.**
  See the hidden-behavior note below.
- **I11** — a category change resets all scheduling state unconditionally
  ([:91-106](../src/hooks/usePracticeSession.ts#L91-L106)).

**Edge-case behavior (I12–I15).**
- **I12** — a single-pair contrast returns that pair repeatedly and terminates;
  `seenThisCycle` resets immediately
  ([practiceSession.ts:160](../src/domain/practiceSession.ts#L160),
  [:190-191](../src/domain/practiceSession.ts#L190-L191)).
- **I13** — an empty eligible set returns `null` and mutates no state.
- **I14** — the recently-missed pair is **not** selected when it was the
  immediately previous pair; I1 outranks I3.
- **I15** — a random value at or beyond the top of its range is clamped and
  never produces an out-of-bounds index
  ([:145-147](../src/domain/practiceSession.ts#L145-L147)).

**Analytics ordering (I8, I17).**
- **I8** — answer state is committed before analytics observes the submission —
  currently pinned only by source text
  ([practiceUi.test.js:336-346](../scripts/practiceUi.test.js#L336-L346)).
- **I17** — **scheduling state commits before analytics observes the
  presentation.** `markScheduledPair` runs at
  [:299](../src/hooks/usePracticeSession.ts#L299), `pairPresented` at
  [:300-303](../src/hooks/usePracticeSession.ts#L300-L303). Pinned by nothing
  today. It is the presentation-path mirror of I8 and must not be reordered by a
  dispatch that lands after the emit.

**Randomness consumption (I16).** The random stream is part of the behavior, not
an implementation detail of it.

- `Math.random()` is evaluated **eagerly as an argument** at
  [:272](../src/hooks/usePracticeSession.ts#L272) — on *every* `handlePlay`,
  including replay rounds where `choosePlaybackForRound` returns before reading
  it ([practiceSession.ts:216-218](../src/domain/practiceSession.ts#L216-L218)).
  The draw is consumed and discarded.
- `selectNextTrialPair` receives `random` as a **function**
  ([:293](../src/hooks/usePracticeSession.ts#L293)) and calls it **zero or one**
  times — single-eligible-pair and miss-boost branches return without drawing
  ([practiceSession.ts:160](../src/domain/practiceSession.ts#L160),
  [:175-180](../src/domain/practiceSession.ts#L175-L180)).

**Interpretation.** Making the discarded draw lazy is the obvious optimization
and it is a **behavior change**: every subsequent value in the stream shifts, so
every later selection differs. Under a seeded source the replay fixture will
catch it — the implementer must read that failure as *"I changed behavior,"* not
*"the fixture is wrong."* The number and order of draws per `handlePlay` is
therefore itself an assertable invariant.

**Deferred-playback branch (I18).** When the scheduled pair is not already the
displayed pair, `handlePlay` sets `pairIndex`, stores `pendingPlayback`, and
**returns without playing**; an effect plays it after re-render
([:304-312](../src/hooks/usePracticeSession.ts#L304-L312),
[:211-224](../src/hooks/usePracticeSession.ts#L211-L224)). When it *is* already
displayed, playback happens synchronously. Both branches run
`markScheduledPair` first. The extraction must not change which branch a given
trial takes, because the effect's guard compares `selectedPair` against the
stored `pairId` and silently drops a mismatch.

> #### Hidden behavior — I7, promotion resets the scheduling cycle
>
> **Fact.** The reset effect's dependency array is
> `[activeGroup, activeGroupPairs, activeGroupPairIdsKey]`
> ([usePracticeSession.ts:191](../src/hooks/usePracticeSession.ts#L191)).
> `activeGroupPairs` is an object memo over `[activeGroup, visible]`
> ([:136-139](../src/hooks/usePracticeSession.ts#L136-L139)); `visible` is a memo
> over `[pairs, mastery]`
> ([useContrastPairs.ts:137-139](../src/hooks/useContrastPairs.ts#L137-L139));
> `promote` replaces the mastery object
> ([:144-147](../src/hooks/useContrastPairs.ts#L144-L147)). A promotion therefore
> produces a new `activeGroupPairs` identity, which fires the effect, which
> clears `seenThisCycle` and `recentMiss`.
>
> **Fact.** No test covers this. The pure rule tests in
> `scripts/practiceSession.test.js` never involve a mastery map, and
> `practiceUi.test.js` does not assert this dependency array.
>
> **Interpretation.** This is the single most likely way 4.1b changes learner
> behavior while appearing correct. The obvious reading of the reset effect is
> "reset when the contrast changes," and a reducer modelling only a
> `contrast-changed` event would preserve cycle state across promotions —
> changing which pair the learner sees immediately after every level-up. The
> value-stable `activeGroupPairIdsKey` sits in the same dependency array and
> makes the identity-based trigger easy to overlook.
>
> **This document does not judge whether I7 is desirable.** It is current
> shipped behavior, so Phase 4.1 preserves it and pins it. Whether the reset
> *should* happen on promotion is a product question, and changing it is a
> behavior change requiring its own decision — not a refactor.

### 5.4 Proposed module shape

```text
src/domain/practice/trialScheduling.ts

  interface TrialSchedulingState {
    readonly lastPairId: string | null;
    readonly seenThisCycle: readonly string[];
    readonly recentMiss: RecentMissState;
    readonly manualOverrideArmed: boolean;
  }

  initialTrialSchedulingState(): TrialSchedulingState

  type TrialSchedulingEvent =
    | { kind: 'session-reset' }              // sites 1, 2 — clears all four
    | { kind: 'active-set-changed';          // site 3 — contrast switch OR promotion
        activeGroupPairs: Pair[] }           //   clears cycle + miss;
                                             //   clears lastPairId only if absent
    | { kind: 'round-started' }              // site 5 — consumes the override
    | { kind: 'trial-presented';             // site 4 — records coverage
        pair: Pair; activeGroupPairs: Pair[] }
    | { kind: 'answer-recorded';             // site 6
        answeredPairId: string; wasCorrect: boolean }
    | { kind: 'manual-selection';            // site 7 — arms the override;
        groupChanged: boolean }              //   clears three only if groupChanged

  reduceTrialScheduling(state, event): TrialSchedulingState

  planNextTrial({ state, eligiblePairs, activeGroup, random }): Pair | null
```

`reduceTrialScheduling` delegates to the existing `advanceTrialCycleSeenIds` and
`updateRecentMissState`. `planNextTrial` delegates to the existing
`selectNextTrialPair` and applies the manual-override precedence. **No rule
function is modified.**

After the change, `usePracticeSession` holds one ref, and each of the five
transition sites becomes a single dispatch.

**Naming, and why it matters here.** `contrast-changed` is the wrong name for
site 3's event: that effect fires on an *active-set identity change*, of which a
contrast switch is only one cause — a mastery promotion is another (I7). Name it
**`active-set-changed`**. A reducer arm named `contrast-changed` invites a future
maintainer to "fix" the caller so it only dispatches on genuine contrast
switches, silently deleting I7. The name is the last line of defence once this
document is no longer being read.

The reducer must not infer *why* the set changed — the caller knows which React
dependency fired; the module does not, and must not try to.

Event-to-site mapping, so no site is left unrouted (§2.1):

| Site | Event |
|---|---|
| 1 Category reset, 2 Target jump | `session-reset` |
| 3 Active-set change | `active-set-changed` (carries `activeGroupPairs`) |
| 4 `markScheduledPair` | `trial-presented` |
| 5 Override consumption | **`round-started` — a separate event. Do not fold.** |
| 6 `handleAnswer` miss update | `answer-recorded` |
| 7 Manual selection | `manual-selection` (carries `groupChanged`) |

**Site 5 must stay a separate event.** The obvious simplification — clear the
override inside `trial-presented` — is wrong, and the reason is an edge case
that the replay fixture may not reach:

- Consumption at [:296](../src/hooks/usePracticeSession.ts#L296) is
  **unconditional** on a new round.
- Presentation at [:299](../src/hooks/usePracticeSession.ts#L299) is
  **conditional** on `nextPair` being non-null
  ([:298](../src/hooks/usePracticeSession.ts#L298)).

`nextPair` is null when `group` is set but `selectNextTrialPair` finds no pair
in it ([practiceSession.ts:158-159](../src/domain/practiceSession.ts#L158-L159)),
or when `group` is null and `selectedPair` is undefined — both reachable with an
empty eligible list. Today the override is cleared in those cases; folded, it
would stay armed and hijack the *next* round.

The ordering within a new round is therefore fixed, and the query comes first
because it must observe the override *before* it is consumed
([:283](../src/hooks/usePracticeSession.ts#L283) reads it,
[:296](../src/hooks/usePracticeSession.ts#L296) clears it):

```text
1. planNextTrial(state, …)      → reads manualOverrideArmed while still armed
2. dispatch 'round-started'     → clears it, unconditionally
3. dispatch 'trial-presented'   → only if a pair was returned
```

Dispatching `round-started` before the query would make the override
permanently ineffective — the extraction would compile, pass every rule test,
and silently delete I5.

### 5.5 Module boundary — what `trialScheduling` may and may not own

The module is a **pure domain boundary**. Its authority is bounded on both
sides: it decides scheduling, and it decides nothing else.

**May own.**

- **Scheduling state** — `lastPairId`, `seenThisCycle`, `recentMiss`,
  `manualOverrideArmed`, and the invariants binding them.
- **State transitions** — how each event advances that state, in one place
  rather than five.
- **Scheduling decisions** — which pair to present next, given a state and a
  caller-supplied eligible set.

**Must not own.**

| Must not own | Why | Stays with |
|---|---|---|
| Persistence | The module performs no I/O and imports no storage module | `useContrastPairs`, `progressStorage` |
| Mastery authority | Gated on WP-3.8G; touching it forks the compatibility contract | `useContrastPairs` (unchanged) |
| Migration | No orchestration, no markers, no orphan adoption | `masteryCompatibility` (uncalled) |
| Feature flags | Must not import `FEATURE_FLAGS` or `CONTRAST_MASTERY_ROLLOUT_STATE` | `src/config/featureFlags.ts` |
| Rollout decisions | No scheduling behavior may vary by rollout state | Human, per the Operational Evidence Review Model |
| Analytics side effects | The module returns data; it never emits | `usePracticeSession` decides *when*, `practiceAnalytics` decides *what* |
| React lifecycle | No `react` import, no hooks, no effects, no refs | `usePracticeSession` |

**Enforcement, not intention.** These are assertable and should be asserted, in
the shape the repository already uses for
[`masteryRolloutSafety.ts`](../src/domain/masteryRolloutSafety.ts) — a
source-level scan for forbidden identifiers plus an import-graph check
(`scripts/masteryRolloutSafety.test.js`). Concretely, the module source must not
contain `AsyncStorage`, `FEATURE_FLAGS`, `CONTRAST_MASTERY_ROLLOUT_STATE`,
`from 'react'`, `useState`, `useRef`, `useEffect`, `trackLearningEvent`, or
`practiceAnalytics`.

**Interpretation.** This is the one place the plan asks for a *new* structural
test rather than a behavioral one — deliberately. A boundary assertion is not an
alarm about how code is written; it is the definition of what the module is. It
survives refactoring because it constrains dependencies, not text.

**Purity contract.** `reduceTrialScheduling` and `planNextTrial` are total
functions of their arguments: no clock, no ambient randomness (`random` is
injected), no module-level mutable state, no input mutation. `planNextTrial` is
a query and must not advance state; `reduceTrialScheduling` is a transition and
must not select a pair. Keeping them separate is what makes I0 replayable.

#### Two refs that look like scheduling state and are not

**`lastStartedContrastRef` is analytics de-duplication, not scheduling.** It
guards the once-per-contrast `practiceStarted` emit
([:159-175](../src/hooks/usePracticeSession.ts#L159-L175)) — **and it is reset
in the middle of the category-reset block**, one line below three genuine
scheduling refs ([:105](../src/hooks/usePracticeSession.ts#L105)). Moving that
block wholesale into the reducer would carry an analytics concern across the
boundary, or — more likely — drop the reset entirely, so `practiceStarted` would
stop re-firing when a learner returns to a previously-practiced contrast after a
category switch. Silent analytics loss, invisible to every existing test. It
stays in the hook and the hook keeps resetting it.

**`lastPairIdRef` is scheduling state, but its *conditional* clear is not a
simplifiable one.** At site 3 it is nulled **only** when it no longer names a
pair in the new active set ([:183-190](../src/hooks/usePracticeSession.ts#L183-L190)).
After a promotion the visible tier changes, so it usually *is* cleared — but not
always. Unconditional clearing is a behavior change to I1.

### 5.6 Behavior preservation — what "measurable" means here

The change is measurable because the scheduler is deterministic under an
injected random source. The acceptance criterion is exact sequence equality, not
statistical similarity:

> For a fixed pair dataset, a fixed seeded random sequence, and a fixed script
> of learner actions (play, answer correct/incorrect, manual select, switch
> contrast, switch category), the sequence of presented pair IDs produced after
> the change is **identical, element for element**, to the sequence produced
> before it.

The baseline sequence is captured from the current implementation **before** any
production file is edited and committed as a fixture in 4.1a.

#### Fixture inputs — all four must be controlled

| Input | Why | How |
|---|---|---|
| **Pair dataset** | Determines eligible sets and tier structure | A fixed literal fixture, not `minimalPairs` — dataset growth must not invalidate the baseline |
| **Mastery map** | `visible` is derived from it; promotions mutate it and trigger I7 | Seeded initial map; promotions occur naturally via the action script |
| **Randomness** | I16 — two independent consumers | **Both** must be stubbed: the global `Math.random` (the eager draw at [:272](../src/hooks/usePracticeSession.ts#L272)) **and** the `random` argument threaded to `planNextTrial`. Stubbing only the injected one leaves the fixture nondeterministic |
| **Clock** | `Date.now()` sets `startTime` ([:278](../src/hooks/usePracticeSession.ts#L278)) and `nowMs` ([:370](../src/hooks/usePracticeSession.ts#L370)); their difference decides `responseTimeMs < FAST_THRESHOLD_MS`, which decides `fastStreak`, which decides **when a promotion happens**, which triggers I7 | A stubbed, script-advanced clock |

> **This is a correctness requirement, not a refinement.** §5.6 requires the
> action script to contain a mastery promotion. Promotion timing depends on the
> 5000 ms fast threshold
> ([adaptiveProgression.ts:12](../src/learning/adaptiveProgression.ts#L12)).
> With a real clock, whether a scripted answer counts as "fast" varies with
> machine speed, so the promotion lands on a different trial between runs and
> the whole downstream sequence diverges. A fixture built without a stubbed
> clock would be flaky, and the most likely response to a flaky fixture is to
> weaken it — losing exactly the I7 coverage it exists to provide.

#### Fixture outputs — all four must be asserted

| Output | Assertion |
|---|---|
| **Selected sequence** | Ordered pair IDs, element-for-element equality (I0) |
| **Transitions** | The scheduling state after each step, so a divergence localizes to a transition rather than only surfacing later as a wrong pair |
| **Resets** | Which step each reset fired on, and its shape — the four shapes in §2.1 are distinguishable in the trace, and I7 is visible as a reset at the promotion step |
| **Externally visible behavior** | Per step: the `playedIdx`, whether the deferred-playback branch was taken (I18), whether `pairPresented` fired, and the running random-draw count (I16) |

**Interpretation.** Asserting only the selected sequence would let a
compensating pair of errors pass — a wrong reset plus a wrong selection that
happens to land on the same pair. Recording transitions and resets alongside the
sequence is what makes a divergence *diagnosable* rather than merely *detected*,
and it is the difference between a fixture that proves the extraction and one
that only fails when it is already too late to tell why.

The action script must include at least one **mastery promotion**, one **manual
selection followed by two rounds** (I5), one **contrast switch**, one **category
switch**, one **replay round** (a second `handlePlay` before answering, to
exercise I16's discarded draw), and one **single-eligible-pair contrast** (I12).

### 5.7 Two-commit implementation strategy

Phase 4.1 ships as exactly two commits, in this order. They must not be squashed
together.

**Commit 1 — characterization only.**
Adds behavioral tests plus the replay fixture. Touches `scripts/` only. No file
under `src/`, `app/`, or `utils/` is created, edited, or deleted. `npm test`
passes at 470 + *n* assertions. Every new assertion has passed a mutation check
(§5.2).

**Commit 2 — extract scheduling ownership.**
Adds `src/domain/practice/trialScheduling.ts`, rewires `usePracticeSession` to
it, deletes the displaced inline policy, and relaxes only those source-text
assertions whose rule Commit 1 now covers behaviorally. `npm run check` green.
The replay fixture from Commit 1 reproduces byte-identically **without being
edited**.

**Why the split is structural, not stylistic:**

- **Review quality.** In Commit 1 a reviewer answers one question: *do these
  tests describe the behavior we have today?* — answerable by reading tests
  against the current code, with no refactor to hold in mind. In Commit 2 they
  answer a different one: *does the behavior described by Commit 1 still hold?*
  — answerable mechanically, because Commit 1's assertions are unchanged inputs.
  Combined, the reviewer must evaluate a moving specification against moving
  code and can no longer distinguish a preserved behavior from a re-pinned one.
- **Rollback safety.** The split creates a **known-good intermediate state**. If
  Commit 2 fails in review, in CI, or after merge, reverting it returns the
  repository to a state with *strictly better* coverage than before Phase 4.1
  began. The characterization work is never lost to a rollback of the
  extraction, so a failed extraction costs one commit rather than the whole
  slice.
- **Regression diagnosis.** With the fixture committed first, a divergence has
  exactly one candidate cause: Commit 2. `git bisect` resolves to a single
  commit whose diff is one new module and one rewired hook. If both landed
  together, a failing fixture would be ambiguous between "the extraction changed
  behavior" and "the fixture recorded the wrong baseline" — and the fixture
  would have been generated by code that no longer exists.

**Gate between the commits.** Commit 2 does not begin until Commit 1 is merged
and green. If any invariant in §5.3 cannot be expressed as a behavioral
assertion, **stop and record why** rather than proceeding on source-text
protection — an unprovable invariant is a finding about the system, not a
formality to route around.

### 5.8 Verification strategy

1. `npm test` → **470 passing assertions, 0 failures** must hold at every commit
   (current baseline, verified at HEAD `8456519`).
2. `npm run check` (lint + typecheck + `validate:data` + `validate:audio` +
   test) green.
3. `scripts/practiceSession.test.js` — **unchanged file, unchanged results.** If
   this file needs editing, the change is not behavior-preserving and must stop.
4. The 4.1a replay fixture reproduces byte-identically.
5. Mutation check on every new assertion (§4.1a).
6. Manual smoke pass of the practice loop per
   [`docs/manual-smoke-test.md`](./manual-smoke-test.md), because the homegrown
   hook harness fakes React semantics and cannot prove behavior under React 19
   rendering.
7. Diff audit confirming: no file under `src/storage/` changed; no file under
   `src/domain/compatibility/` changed; `src/config/featureFlags.ts` unchanged;
   `src/hooks/useContrastPairs.ts` unchanged.
8. Boundary assertions from §5.5 pass — the new module imports no React, no
   storage, no flags, and no analytics.
9. Every invariant I0–I18 in §5.3 maps to at least one passing assertion, and
   each has been observed to fail under its injection (§5.2).

### 5.9 Migration approach

There is no data migration. No storage key, serialization format, schema
version, or flag is read or written differently. This is an in-process state
relocation only.

### 5.10 Rollback approach

There are **two named rollback points**, one per commit (§5.7):

| Revert | Returns to | Coverage after revert |
|---|---|---|
| Commit 2 only | Characterization landed, extraction undone | **Better than before Phase 4.1** — behavioral tests retained |
| Commits 2 then 1 | Pre-Phase-4.1 state exactly | Baseline (470 assertions) |

`git revert` is a complete rollback in both cases: no persisted state, key,
format, schema, or flag changed, so no data repair is required and the revert is
safe on any install regardless of what happened while the change was live. A
partially-reverted state is not reachable within either commit, because each is
atomic — Commit 2 in particular adds the module, rewires the hook, and deletes
the displaced policy together, so no revert can leave two scheduling
implementations coexisting.

**Preferred first response to a defect is Commit 2's revert, not a forward
fix.** The intermediate state is known-good and fully covered, so returning to
it costs nothing and preserves the diagnosis.

### 5.11 Phase 4.1 scope boundary

**Included — the complete set of allowed changes.**

| Allowed | Commit |
|---|---|
| New test file(s) under `scripts/` for the I0–I18 behavioral assertions and the replay fixture | 1 |
| New file `src/domain/practice/trialScheduling.ts` | 2 |
| Edits to `src/hooks/usePracticeSession.ts` limited to: collapsing the four scheduling refs into one state ref, replacing the seven mutation sites with dispatches, and deleting the displaced inline policy | 2 |
| Relaxing **only** those `scripts/practiceUi.test.js` assertions whose rule Commit 1 covers behaviorally | 2 |
| A boundary test asserting the new module's forbidden imports and identifiers (§5.5) | 2 |

**Excluded — tempting, in reach, and forbidden.**

| Forbidden | Why |
|---|---|
| Any edit to `useContrastPairs.ts` | Mastery authority; anti-forking rule; WP-3.8G |
| Any edit under `src/storage/` or `src/domain/compatibility/` | Compatibility contract |
| Any edit to `featureFlags.ts` | Rollout is human-controlled |
| Any edit to `src/domain/practiceSession.ts` or `adaptiveProgression.ts` | The rules are already correct and already covered; editing them means the change is not behavior-preserving |
| Making the discarded playback draw lazy | I16 — changes the whole sequence |
| Modelling site 3 as contrast-change-only | I7 — deletes the promotion reset |
| Folding override consumption into `trial-presented` | I5 — loses the override on an empty eligible set |
| Unifying the four reset shapes into one | §2.1 — three of the four differ |
| Moving `lastStartedContrastRef` into the module | Analytics de-duplication, not scheduling |
| Repairing the dropped deferred playback | Phase 5 |
| Extracting progression state (4.2), placement (4.3), summary (4.4), or pair keys (4.5) | Separate slices with separate verification |
| Touching `Alert`, `useAudio`, `timerRef`, `stableVisible`, or the picker | Not scheduling; a different slice or a different phase |
| Adding a service layer, repository, factory, engine, or state library | §6.4 |

**If an excluded change appears necessary to complete an included one, stop and
record why.** That is a finding about the boundary, not a licence to cross it.

---

## 6. Risks and rejected approaches

### 6.1 Risks that remain after this plan

| Risk | Why it remains | Mitigation |
|---|---|---|
| Test harness fidelity | The hook harness is hand-rolled and fakes React scheduling; a behavior proven under it is not proven under React 19 concurrent rendering | Keep the hook thin so the harness only has to prove the pure module; require a manual smoke pass per slice |
| Eligible-pair snapshot timing | `visible` is derived from the mastery map and re-derived on every mastery change; a scheduler that captures the wrong snapshot changes pair sequencing — learner-visible | `planNextTrial` takes `eligiblePairs` as an explicit argument; never captured internally |
| Speed-tier publication timing (4.2) | Moving progression state from a ref to `useState` can change which playback rate applies to a given trial | 4.2 preserves ref semantics unless replay proves the rate sequence unchanged |
| Assertion weakening | Relaxing source-text tests could reduce real coverage silently | Behavioral replacements land first and must pass a mutation check before any relaxation |
| Coverage-count illusion | "470 assertions pass" is a proxy; a substantial share are source-text assertions about one file | Track behavioral coverage of transitions explicitly, not assertion count |
| Two concurrent mastery hook instances | Structurally permits a last-writer-wins overwrite; no realized overwrite exists in the current navigation flow | **Not fixed by Phase 4** — the fix touches mastery authority (gated). Recorded as a known, classified risk |
| Placement identity gap | `@placementDone_${categoryLabel}` remains label-derived with no alias resolution (Audit Finding 5) | Explicitly out of scope; 4.3 touches assessment logic only, never completion state |
| Legacy read failure persists an empty mastery map (§2.2) | Pinned by a passing test; the stable path is guarded, the legacy path is not | **Not fixed by Phase 4** — `useContrastPairs` is untouched by every slice. Raised for WP-3.8G with the fixture gap named |
| Scope drift toward the engine facade | The Evolution Plan sketch invites building `PracticeSessionEngine` | Rejected explicitly in §3 and constrained forward in §6.4; any reintroduction requires a recorded decision |
| **Promotion-triggered cycle reset (I7)** | An identity-based dependency means a mastery promotion clears cycle coverage and miss state; untested, undocumented, and easy to "clean up" during extraction | Pinned as invariant I7 (§5.3) with a mandatory mutation check and a promotion in the replay script; named as a rejected simplification (§6.2) |
| **Random-stream consumption (I16)** | A draw is taken and discarded on every `handlePlay`; making it lazy shifts every later value and changes the whole sequence | Pinned as I16 with a mutation check; the fixture stubs both random consumers (§5.6) |
| **Fixture nondeterminism** | A real clock makes promotion timing machine-dependent, so a fixture containing a promotion is flaky — and the usual response to flakiness is to weaken the assertion | The clock is stubbed and script-advanced; stated as a correctness requirement, not a refinement (§5.6) |
| **Override-consumption ordering (I5)** | Consumption is unconditional per round while presentation is conditional on a pair being found; folding the two loses the override in the empty-eligible-set case, and dispatching in the wrong order deletes I5 outright | `round-started` is a separate event with a fixed query-then-consume-then-commit order (§5.4) |
| **Analytics ref inside the scheduling reset block** | `lastStartedContrastRef` sits one line below three scheduling refs in the category reset; moving the block wholesale drops it, silently stopping `practiceStarted` re-emission | Called out explicitly in §5.5; it stays in the hook |

### 6.2 Rejected approaches

**Large refactor / big-bang `PracticeSessionEngine`.** Rejected. It introduces a
new runtime authority layer, which the Phase 4 invariants prohibit. Its
correctness cannot be argued incrementally, it cannot be reverted in one commit,
and the coupling reduction it delivers is fully obtainable from the collaborator
modules without it.

**"Clean architecture" rewrite (ports / adapters / use-cases).** Rejected. The
only place the current architecture genuinely violates layering is
`useContrastPairs`, and that module is gated. A rewrite would restate the Phase
3.5 write-ordering and blocked-read invariants in new vocabulary — precisely the
forking the anti-forking rule forbids — and would deliver zero learner value in
exchange for re-proving a compatibility contract that took three sub-phases to
establish.

**Framework changes (Redux / Zustand / XState).** Rejected. The scheduling state
machine is already deterministic and already testable once extracted; a state
library adds a dependency, changes render timing (a learner-visible risk via
playback rate and picker snapshotting), and addresses none of the identified
coupling. XState in particular would encode the transitions in a DSL that the
existing test harness cannot drive.

**Replacing hooks wholesale.** Rejected. `usePracticeSession` is the composition
root where the audio seam, entry gate, analytics timing, mastery read, and pair
progress meet. Deleting it does not remove that composition — it relocates it
somewhere with less test coverage. The plan deliberately keeps the hook and
shrinks it.

**Moving too much at once.** Rejected as a sequencing style. Combining 4.1
through 4.4 into one change would make the replay fixture unable to isolate
which extraction caused a sequence divergence, and would make revert
all-or-nothing.

**Extracting `ProgressUpdater` now (or a "read-only slice" of it).** Rejected.
All four Stabilization Plan unblocking conditions are unmet, and a partial
extraction is the specific failure the anti-forking rule names.

**Creating an `AnalyticsEmitter`.** Rejected as unnecessary abstraction.
Ownership is already correct (§2.7); the change would relocate call sites
without relocating a responsibility.

**Removing the redundant `useContrastPairs` mount in `results.tsx`.** Rejected.
It would change mastery write volume, which is Phase 3.8 evidence input (§7.3).

**Fixing the in-memory / on-disk attempt divergence (§2.5), the
malformed-mastery narrowing write, or the read-failure empty write (§2.2).**
Rejected for Phase 4 — but for two different reasons, which must not be
conflated. The attempt divergence is a learner-visible data behavior requiring a
product decision. The two mastery write behaviors are inside `useContrastPairs`,
which Phase 4 may not modify at all under the anti-forking rule; touching either
would put a second hand on mastery authority while WP-3.8G is unbuilt. The
read-failure write is additionally a **data-safety** matter, not a cleanup one,
and is escalated in §2.2 rather than absorbed here.

**Modelling the cycle reset as contrast-change-only.** Rejected — it is the
default reading and it is wrong. See I7 in §5.3: the reset also fires on mastery
promotion, via an identity-based dependency. A reducer that "cleans this up"
changes the pair a learner sees immediately after every level-up.

**Deleting `resetMastery` / `resetProgress` as dead code.** Rejected.
`resetMastery` is the only producer of `'reset'` write provenance, which is a
first-class concept in the stable mastery document and in shadow comparison
(`reset-disagreement`). Removal is a retirement action and falls under
Decision 011.

### 6.3 Explicitly deferred findings

**These are known risks. They are intentionally not included in the first
extraction.** Each was found during architecture review, each is real, and none
is a Phase 4.1 deliverable. They are recorded here so a future implementer meets
them as classified risks rather than discovering them mid-extraction — and so
that leaving them unaddressed reads as a decision rather than an oversight.

| Finding | Where | Why deferred | Owner |
|---|---|---|---|
| **Legacy failed-read empty-write** — a failed legacy mastery read is followed by a write of `{}`, which would erase a non-empty key. Pinned by a passing test; the stable path is guarded, the legacy path is not | §2.2, [useContrastPairsFlagOff.test.js:188-210](../scripts/useContrastPairsFlagOff.test.js#L188-L210) | Inside `useContrastPairs`. Phase 4 may not modify mastery authority while WP-3.8G is unbuilt. **Data-safety matter, not cleanup** | WP-3.8G |
| **Mastery persistence ownership** (`ProgressUpdater`) — the dual-authority branch remains in a React hook | §2.2, §3.7 | All four Stabilization Plan unblocking conditions unmet; extracting now forks the compatibility contract | WP-3.8G, gated on WP-3.8C + held rollout state |
| **Concurrent `useContrastPairs` overwrite risk** — two instances of the same mastery key are mounted simultaneously (Practice and Results tabs), each with its own copy and its own write path | §2.2, §6.1 | No realized overwrite exists in the current navigation flow, but nothing prevents one. The fix touches mastery authority | WP-3.8G |
| **Progression / audio coupling** — the speed tier feeds `SPEED_TABLE[speedTier]` into `useAudio`, so moving progression state changes *when* a new playback rate reaches the audio hook | §2.1, slice 4.2 | Deferred to 4.2, where it is a named constraint with its own replay criterion — not carried into 4.1 | Phase 4.2 |
| **Placement identity gap** — `@placementDone_${categoryLabel}` is label-derived with no alias resolution | §2.4, Audit Finding 5 | Out of Phase 4 entirely; needs its own decision | Open, per Audit §8 |
| **In-memory / on-disk attempt divergence** | §2.5 | Learner-visible in the Results charts; requires a product decision | Product |
| **Duplicated pair-key construction** | §2.6 | Real, but unrelated to scheduling; sequenced last as optional 4.5 | Phase 4.5 |
| **Dropped deferred playback** — if `visible` changes between scheduling and the playback effect, the guard at [:213](../src/hooks/usePracticeSession.ts#L213) never matches, so the auto-play is silently dropped and `pendingPlayback` is left set. The learner must press Play again | §5.3 I18 | A playback-lifecycle reliability defect, which the Evolution Plan already scopes to **Phase 5** ("prevent answer before playback completes, recover from missing TTS callbacks"). Phase 4.1 preserves the behavior exactly and must not repair it | Phase 5 |
| **Eager discarded random draw** ([:272](../src/hooks/usePracticeSession.ts#L272)) | §5.3 I16 | Wasteful but load-bearing: removing it shifts the entire random stream. There is no correctness reason to change it, and doing so is a behavior change | Never, absent a decision |

**Rule.** None of these may be "fixed while we're in there" during Phase 4.1. A
slice that grows to include one of them is no longer the slice this plan
reviewed, and its rollback and verification arguments no longer hold.

### 6.4 Constraint — no architecture inflation

Phase 4.1 must not introduce:

- service layers
- repositories
- factories
- orchestration engines (including `PracticeSessionEngine` — §3)
- state frameworks (Redux, Zustand, XState, or similar)

**Prefer the smallest module that creates a real ownership boundary.** For 4.1
that is one file exporting a state type, a reducer, and a query function. If a
proposed abstraction does not move a responsibility out of React, it is not
earning its place.

**The bar for introducing any of the above later is evidence, not preference.** A
future proposal must name the concrete problem observed in this codebase that
the pattern solves, and why the smaller form failed — not that the pattern is
conventional. Two of the above are already rejected on recorded grounds (§3,
§6.2); this constraint extends that reasoning forward so it does not have to be
re-argued each time.

**Interpretation.** The failure mode this guards against is specific. Extraction
work creates momentum: having named one boundary, it feels natural to name a
layer to hold it, then a factory to build it, then an engine to coordinate it.
Each step is individually defensible and the aggregate is a rewrite — the
outcome this entire plan is sequenced to avoid. The `Agent Operating Rules` in
the Evolution Plan already state the governing rule: *do not introduce
abstractions without clear ownership.*

---

## 7. Relationship to Phase 3.8

### 7.1 What Phase 4 may change

Only in-process composition of practice-session domain state:

- where trial scheduling state lives and how its transitions are expressed
- where per-contrast progression state lives
- where placement item selection and scoring live
- where mastery *summarization* rules live (read-side interpretation only)
- whether pair-key construction is duplicated

Every one of these is downstream of persisted learner state and none is an input
to the Phase 3.8 evidence model.

### 7.2 What Phase 4 must preserve

- **Learner-visible behavior**, verified by exact-sequence replay, not
  inspection.
- **The mastery compatibility contract** — `useContrastPairs`,
  `masteryCompatibility`, `contrastMasteryStorage`,
  `contrastMasteryPersistence`, and `historicalIdentityMapping` are untouched by
  every slice.
- **Legacy reads and writes**, including the mount-write, the
  malformed-narrowing write, and the read-failure empty write described in §2.2.
  These are current shipped behavior; Phase 4 preserves them rather than judging
  them. Preserving is not endorsing — §2.2 escalates the third to WP-3.8G.
- **Rollout control.** `CONTRAST_MASTERY_ROLLOUT_STATE` stays `'disabled'`. No
  slice reads, writes, or adds a path to it.
- **Migration orchestration.** `migrateLanguageMastery` and
  `adoptOrphanedMasteryForLanguage` remain caller-free in `app/` and `src/`.
- **Evidence boundaries.** The evaluator remains unreferenced by any module
  under `app/` or `src/`; the import-graph test in
  `scripts/masteryRolloutSafety.test.js` must continue to pass unmodified.
- **The principle that evidence informs decisions and does not control runtime
  behavior.** No slice creates a path from a diagnostic, counter, snapshot, or
  assessment into learner-visible behavior.

### 7.3 Why the redundant mastery write must not be removed

**Fact.** `results.tsx` mounts `useContrastPairs`, which writes on mount and on
every focus refresh (§2.2).

**Fact.** Under an authoritative rollout state, that write routes through
`writeCompatibleMastery`, which emits a `compatibility-write` diagnostic on
every invocation ([masteryCompatibility.ts:902-921](../src/storage/masteryCompatibility.ts#L902-L921)).

**Interpretation.** Write volume and its provenance distribution are inputs to
the evidence the Phase 3.8 gate consumes. Removing a write path during Phase 4
would silently alter the shape of evidence collected in a later window, and the
change would be attributed to rollout behavior rather than to a refactor. Phase
4 therefore treats this write as load-bearing and leaves it in place. If it
should be removed, that is a Phase 3.8 workstream decision with an evidence
rationale — not a refactor side effect.

### 7.4 Confirmation

Phase 4 as planned does not weaken:

- **Evidence boundaries.** No slice imports, wires, or consumes the evaluator or
  the diagnostic store. No slice adds a producer or changes an existing one.
- **Compatibility safety.** No slice edits any module in the mastery
  compatibility chain, changes a storage key or format, alters write ordering,
  or removes a legacy path. Decision 011 is untouched.
- **Rollout control.** No slice modifies `featureFlags.ts` or adds a mechanism
  capable of doing so. Human control of rollout, as defined in
  [`Phase-3.8-Operational-Evidence-Review-Model.md`](./Phase-3.8-Operational-Evidence-Review-Model.md),
  is unchanged.

Phase 4 also does not satisfy, accelerate, or partially discharge any Phase 3.8
gate. Completing every slice in this plan moves no gate. Decisions 012–014
remain proposed and unaccepted; this plan neither depends on nor advances them.

---

## Architectural invariants preserved

Checked against the ten Phase 4 invariants:

| # | Invariant | How this plan holds it |
|---|---|---|
| 1 | Learner-visible behavior unchanged | Nineteen named invariants I0–I18 (§5.3), each mutation-checked (§5.2); exact-sequence replay is the acceptance criterion (§5.6); §3.6 and §6.2 reject the changes that would alter visible output |
| 2 | Mastery compatibility behavior intact | No slice edits the compatibility chain (§7.2) |
| 3 | Legacy reads/writes not removed | Explicitly preserved, including the redundant mount-write (§7.3) |
| 4 | Stable mastery authority not activated | Rollout untouched; `featureFlags.ts` unmodified |
| 5 | No migration orchestration changes | `migrateLanguageMastery` / orphan adoption remain caller-free |
| 6 | No rollout changes | No slice reads or writes rollout state |
| 7 | No new architectural authority layer | `PracticeSessionEngine` explicitly deferred (§3); modules are pure functions, not authorities; §5.5 makes the boundary assertable and §6.4 constrains inflation forward |
| 8 | Persistence adapters separate from domain decisions | New modules perform no I/O; §3.4 keeps reads in `useContrastPairs` |
| 9 | UI/hooks not the source of business rules | The direction of every slice is rules *out* of components and hooks |
| 10 | Phase 3.8 evidence boundaries unchanged | §7.3, §7.4; import-graph test must pass unmodified |

---

## Verification performed for this document

| Check | Result |
|---|---|
| Code changed | None. No file under `src/`, `app/`, `utils/`, or `scripts/` was created, edited, or deleted |
| Rollout state changed | No. `CONTRAST_MASTERY_ROLLOUT_STATE = 'disabled'` at [featureFlags.ts:18](../src/config/featureFlags.ts#L18), unread and unmodified by this work |
| Feature flags changed | No |
| Decisions accepted | None. Decisions 001–011 unchanged; 012–014 remain `Proposed — not accepted` |
| New runtime authority introduced | None. This document is prose; it defines no module and creates no code path |
| Test baseline | `npm test` → 470 passing assertions, 0 failures, exit 0 at HEAD `8456519` |
| Source of claims | Every **Fact** was read directly in the cited file at the cited lines; no claim is derived from a filename |
| Fact/interpretation separation | Maintained throughout §1–§2, §5.3, and §7 |
| Tests changed | None. The 4.1a assertions are *specified* here and *written* in Phase 4.1 Commit 1 |
| Phase 4.1 scope | Unchanged — trial scheduling state extraction only. The revision adds constraints, not deliverables |
| New requirements invented | None. Every constraint derives from an existing document: the anti-forking rule and Phase 4 entry criteria ([Stabilization Plan](./Phase-3.8-Stabilization-Plan.md)), the advisory/no-authority boundary shape ([3.8B Completion Review](./Phase-3.8B-Completion-Review.md) §3), human-controlled rollout ([Operational Evidence Review Model](./Phase-3.8-Operational-Evidence-Review-Model.md)), and *"do not introduce abstractions without clear ownership"* (Evolution Plan, Agent Operating Rules) |
