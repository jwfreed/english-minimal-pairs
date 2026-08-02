# Phase 4.2 — Mastery and Progress State Lifecycle Architecture Review

Date: 2026-08-02
Branch: `main` (HEAD `a5f487c`, working tree clean)
Status: **Analysis only. Not a proposal, not an authorization.** No file under
`src/`, `app/`, `utils/`, `scripts/`, or `android/`/`ios/` was created, edited,
or deleted to produce this document. No feature flag, rollout state, or Decision
was changed.

Evidence base: `npm test` → **493 passing assertions, 0 failures** at HEAD
`a5f487c`. Every `file:line` citation was read directly at that commit. Where a
claim rests on computation rather than reading, the computation is shown.

Throughout, **Fact** marks something read or measured in the repository.
**Interpretation** marks a judgment made by this document. **Recommendation**
marks proposed work. They are never merged into one statement.

### Authority of this document

This document defines no Decision, accepts no proposed Decision, grants no
permission, and moves no gate. On any conflict, the authoritative source
governs:

| Subject | Authoritative source |
|---|---|
| Accepted and proposed Decisions | [`Contrast-Domain-Architecture-Decisions.md`](./Contrast-Domain-Architecture-Decisions.md) |
| Phase definitions | [`Contrast-Domain-Architecture-Evolution Plan.md`](./Contrast-Domain-Architecture-Evolution%20Plan.md) |
| Work-package sequencing, Phase 4 entry criteria | [`Phase-3.8-Stabilization-Plan.md`](./Phase-3.8-Stabilization-Plan.md) |
| Phase 4 slice scope and invariants | [`Phase-4-Architecture-Plan.md`](./Phase-4-Architecture-Plan.md) |

---

## 1. Executive summary

**The question this review answers:** *do we need to change the
mastery/progression architecture, and if so, what is the smallest justified
change?*

**Answer: yes, but not the change the risk list implies — and not yet a
persistence change.**

Three things were established:

1. **The durability split is real and is larger than "some refs are
   transient."** Mastery tier is durable. **Every input that produces the next
   mastery tier is not.** Speed tier, fast streak, and long streak live only in
   `usePracticeSession` refs (`usePracticeSession.ts:60-62`), are written by no
   storage adapter, are read by no test, and are destroyed on unmount. A learner
   one correct answer away from a level-up who backgrounds the app long enough
   to be killed restarts that level-up from zero — a minimum of **9 further
   fast-correct answers** (three speed cycles × `FAST_STREAK_NEEDED = 3`), or up
   to 18 merely-correct ones.

2. **Whether that loss is intended has never been decided.** **Fact:** no
   document in `docs/` states an intent for progression durability. The only
   mention of the mechanism anywhere outside the Phase 4 plan is a manual smoke
   step (`manual-smoke-test.md:95-96`) that describes the rate increasing, not
   what happens to it afterwards. This is an **undecided product question**, not
   a defect and not a known accepted trade-off.

3. **The mastery write path has a data-safety exposure that is broader than
   previously recorded.** The known legacy failed-read-then-empty-write finding
   (Phase 4 plan §2.2) is not confined to the learner's own language: because
   `language` initializes to `'English'` — which is not a practice category —
   **every cold start transiently mounts the practice screen against `日本語`**
   and reads/writes `@mastery_日本語`, regardless of which language the learner
   actually uses (§5.4). This is timing-dependent and unproven at runtime, but
   it is a code-path reading, not speculation.

**What follows from that:**

- **A new domain module is warranted** — the one Phase 4.2 already scopes
  (`src/domain/practice/progressionState.ts`). It is warranted on *ownership*
  grounds that hold independently of the durability question, and it is the
  prerequisite that makes the durability question answerable at all. Today
  "progression" has no name, no serializable shape, and no test.
- **Persistence work is not yet justified.** It requires a product decision that
  has not been made, and the state it would persist is not currently
  addressable. Doing it now means inventing a schema for a concept that has no
  module.
- **The smallest safe next work package is Phase 4.2 exactly as the Phase 4 plan
  scopes it** — a two-commit, storage-free, ref-semantics-preserving extraction
  — **plus one paragraph of recorded product decision** on whether progression
  should survive a restart. The decision does not block the extraction; the
  extraction should not wait for it.

Nothing in this review recommends touching `useContrastPairs`, any storage
adapter, the compatibility chain, or the rollout flag.

---

## 2. Current state model

### 2.1 The distinct learner progression concepts

**Fact.** Seven distinct concepts exist. They are listed here with their actual
storage location, not their apparent one.

| # | Concept | Shape | Lives in | Key |
|---|---|---|---|---|
| 1 | **Mastery tier** | `Record<group, 1..6>` | React state in `useContrastPairs` ([:27](../src/hooks/useContrastPairs.ts#L27)), mirrored to `AsyncStorage` | `@mastery_${category}` |
| 2 | **Speed tier** | `Record<group, 0\|1\|2>` | React **ref** in `usePracticeSession` ([:60](../src/hooks/usePracticeSession.ts#L60)) | *none* |
| 3 | **Fast streak** | `Record<group, number>` | React **ref** ([:61](../src/hooks/usePracticeSession.ts#L61)) | *none* |
| 4 | **Long streak** | `Record<group, number>` | React **ref** ([:62](../src/hooks/usePracticeSession.ts#L62)) | *none* |
| 5 | **Attempt history** | `Record<pairId, {attempts[]}>` | React state in `PairProgressContext` + `AsyncStorage` | `@pairProgress_v2` |
| 6 | **Placement completion** | boolean per category | `AsyncStorage`, read by `usePracticeEntryState` | `@placementDone_${category}`, `@placementDoneLegacyMigrated` |
| 7 | **Practice time** | daily + cumulative seconds | `AsyncStorage`, owned by `SessionTimer` | `@sessionTimer`, `@sessionTimerCumulative` |

Plus one **derived** value and several **session/UI** values (§2.2).

### 2.2 Classification — durable / session / derived / UI-only

**Fact, by inspection of every write path:**

**Durable learner facts** (survive process death):

- Mastery tier — written at `useContrastPairs.ts:126` (legacy path).
- Attempt history — written at `progressStorage.ts:97`.
- Placement completion — written at `usePracticeEntryState.ts:64`,
  `settings.tsx:97-100`.
- Practice time, daily and cumulative — `SessionTimer.tsx`.
- Language preference — `@userLanguage`, `LanguageContext.tsx:232`.

**Temporary session state** (destroyed on unmount, no storage path exists):

- **Speed tier, fast streak, long streak** — concepts 2–4. *These are learner
  progression, not interaction state.* They are grouped here by where they live,
  not by what they mean; see §4.2.
- Trial scheduling state — `TrialSchedulingState` in
  `trialScheduling.ts:10-15`, held in one ref at `usePracticeSession.ts:80`.
  Correctly session-scoped: it encodes "what have I shown you *this sitting*."
- `activeGroup`, `pairIndex`, `startTime`, `playedIdx`, `pendingPlayback`,
  `stableVisible` — round and picker state.
- `lastStartedContrastRef` ([:81](../src/hooks/usePracticeSession.ts#L81)) —
  analytics de-duplication, deliberately not scheduling state.

**Derived values** (recomputed, never stored):

- `visible` — `selectVisiblePairsByMastery(pairs, mastery)`
  ([useContrastPairs.ts:137-139](../src/hooks/useContrastPairs.ts#L137-L139)).
  The eligible pair set is a **pure projection of mastery**; it is the mechanism
  by which a mastery promotion changes what the learner sees.
- `activeGroupPairs`, `safePairIndex`, `contrastDetailPairs`,
  `activeGroupPairIdsKey` — memos in `usePracticeSession`.
- Playback rate — `SPEED_TABLE[speedTier]`
  ([:194](../src/hooks/usePracticeSession.ts#L194)). Derived from a
  **non-durable** input, and therefore itself non-durable.
- The Results mastery summary — computed inline at
  `results.tsx:75-95`.

**UI-only state:**

- `feedback`, `promotedTier`, `isHelpVisible`, `isContrastDetailsVisible`,
  `highlightProgress` / `highlightCurrentTier`.

**Interpretation.** The recent truthfulness fixes drew the line between
*measured progress* and *reward feedback* correctly at the presentation layer.
This review finds that the same line is **not drawn in the state layer**:
concepts 2–4 are measured progress that is stored like round state. The UI is
now honest about what it shows; the architecture is not yet honest about what it
keeps.

---

## 3. Ownership map

### 3.1 Who owns what today

| Concept | Read authority | Write authority | Rules authority | Persistence authority |
|---|---|---|---|---|
| **Mastery tier** | `useContrastPairs` | `useContrastPairs` (`promote` [:141-150](../src/hooks/useContrastPairs.ts#L141-L150), `setAllGroupsToTier` [:153-159](../src/hooks/useContrastPairs.ts#L153-L159), `resetMastery` [:161-184](../src/hooks/useContrastPairs.ts#L161-L184)) | `masteryPersistence.ts` (normalize/clamp), `practiceSession.ts` (visibility projection) | `useContrastPairs` **itself** — direct `AsyncStorage` at [:72](../src/hooks/useContrastPairs.ts#L72), [:126](../src/hooks/useContrastPairs.ts#L126), [:177](../src/hooks/useContrastPairs.ts#L177) |
| **Speed / fast streak / long streak** | `usePracticeSession` | `usePracticeSession` ([:381-382](../src/hooks/usePracticeSession.ts#L381-L382), [:400](../src/hooks/usePracticeSession.ts#L400), [:407](../src/hooks/usePracticeSession.ts#L407), [:424-425](../src/hooks/usePracticeSession.ts#L424-L425)) | `adaptiveProgression.ts` (pure) | **none — no persistence exists** |
| **Promotion decision** | — | — | `getNextAdaptiveProgression` ([adaptiveProgression.ts:34-82](../src/learning/adaptiveProgression.ts#L34-L82)), surfaced via `applyPracticeAnswer` | — |
| **Promotion *application*** | — | `usePracticeSession.handleAnswer` calls `promote(group)` ([:408](../src/hooks/usePracticeSession.ts#L408)) | — | `useContrastPairs` |
| **Trial scheduling** | `usePracticeSession` | `usePracticeSession` (one dispatch fn, [:82-90](../src/hooks/usePracticeSession.ts#L82-L90)) | `trialScheduling.ts` (pure, Phase 4.1) | none, by design |
| **Attempt history** | `PairProgressContext` | `PairProgressContext` **and** `progressStorage` — two independent appends | `progressStorage.ts` (prune) | `progressStorage.ts` |
| **Placement completion** | `usePracticeEntryState`, `settings.tsx` | both, directly | `masteryPersistence.resolvePlacementStateForCategory` (pure) | **hook and screen, directly** |

### 3.2 Is ownership clear? Where are the competing authorities?

**Fact — mastery has one *rule* authority and two concurrent *instance*
authorities.** `useContrastPairs` is the only module that reads or writes
`@mastery_${category}`. But it is a hook, so each mount is an independent copy
of the mastery map with an independent write path. Two are mounted
simultaneously: the practice screen (`index.tsx:78`) and the Results screen
(`results.tsx:72`).

**Fact — the promotion decision and the promotion application are split across
two modules with no shared transaction.** `usePracticeSession` decides (via the
pure rule) and calls `promote`; `useContrastPairs` applies and persists. The
decision inputs (streaks, speed) live in the deciding module and are never
persisted; the decision output (tier) lives in the applying module and always
is.

**Fact — mastery has a *dual-mode* authority that is currently dormant.**
`useContrastPairs.ts:37-43` selects between a legacy path and a compatibility
path per render. `CONTRAST_MASTERY_ROLLOUT_STATE = 'disabled'`
([featureFlags.ts:18](../src/config/featureFlags.ts#L18)), so only the legacy
branch executes in shipped builds. The stable branch, `masteryCompatibility`,
`contrastMasteryPersistence`, `orphanMasteryAdoption`, and
`masteryRolloutSafety` are all unreached from `app/` and `src/` at this rollout
state.

**Interpretation — ownership is clear for rules and unclear for state.**

- For **mastery**, the *authority module* is unambiguous; what is ambiguous is
  *which instance of it is authoritative at a given moment*. That is the
  known WP-3.8G item and this review adds nothing to its classification.
- For **progression**, there is no ambiguity because there is no authority
  — there is a hook that happens to hold three maps. Nothing else can read them,
  nothing can test them, nothing can serialize them. **This is the ownership gap
  Phase 4.2 exists to close**, and it is a real gap independent of any
  durability decision.
- For **attempt history**, there are genuinely two writers with different
  semantics (`PairProgressContext.tsx:54-66` appends unpruned to memory,
  `progressStorage.ts:89-98` appends pruned to disk, each stamping its own
  `Date.now()`). Already classified as product-owned; unchanged by this review.

---

## 4. Lifecycle analysis

### 4.1 Verified lifecycle map

**Fact — the tab navigator is keyed on language.**
`app/(tabs)/_layout.tsx:60` renders `<Tabs key={language} …>`. A language change
therefore **unmounts and remounts every screen**, including `HomeScreen` and
with it `usePracticeSession`.

**Fact — the providers sit outside that key.**
`_layout.tsx:88-100` nests `PairProgressProvider > LanguageProvider >
ThemeProvider > SettingsProvider > CategoryProvider > PracticeTargetProvider >
TabLayout`. Attempt history, category index, and settings survive the remount.

**Fact — category changes only ever accompany a language change.**
`setCategoryIndex` has exactly two call sites: `CategoryContext.tsx:29` (an
effect that derives the index *from* `language`) and `settings.tsx:80`, which is
immediately followed by `setLanguage` on the next line. There is no path that
changes category while holding language constant.

**Fact — the tab screens stay mounted across tab switches.** `HomeScreen`
returns early during the entry-gate reload (`index.tsx:112-134`), but
`usePracticeSession` is called at `index.tsx:78`, *above* every early return, so
the hook and its refs persist across onboarding/placement gating and across
focus changes.

### 4.2 Progression state lifecycle

**Fact.** `groupSpeedRef`, `groupStreakRef`, and `groupLongStreakRef` are:

- initialized to `{}` at mount ([:60-62](../src/hooks/usePracticeSession.ts#L60-L62));
- **not** cleared by the category-reset effect
  ([:94-103](../src/hooks/usePracticeSession.ts#L94-L103)), which resets six
  round-state values and the scheduling state but not these three;
- referenced nowhere outside `usePracticeSession.ts` — verified by
  `grep -rn "groupSpeedRef\|groupStreakRef\|groupLongStreakRef" scripts src app`
  → 9 hits, all in `usePracticeSession.ts`;
- covered by **zero** assertions. `scripts/adaptiveProgression.test.js` covers
  the pure arithmetic; nothing covers the state that feeds it.

**Fact — the promotion ladder requires three consecutive achievements.**
`getNextAdaptiveProgression` promotes speed while `currentSpeed < MAX_SPEED`
(0→1→2), and only promotes **mastery** on the next qualifying run at speed 2
([adaptiveProgression.ts:63-81](../src/learning/adaptiveProgression.ts#L63-L81)).
Each run needs `fastStreak >= 3` with each answer under `FAST_THRESHOLD_MS =
5000`, or `longStreak >= 6`
([:12-14](../src/learning/adaptiveProgression.ts#L12-L14)). A mastery tier
therefore costs a minimum of **9 fast-correct answers** in three unbroken runs,
and all of that accumulated state is in the three refs.

**Fact — the refs are the only publication channel for playback rate.**
`speedTier` is read during render ([:189-191](../src/hooks/usePracticeSession.ts#L189-L191))
and passed as `SPEED_TABLE[speedTier]` into `useAudio`
([:192-196](../src/hooks/usePracticeSession.ts#L192-L196)). `useAudio`'s `play`
is a `useCallback` with `rate` in its dependency array
([useAudio.ts:456-465](../src/hooks/useAudio.ts#L456-L465)), so a new rate
reaches audio **only via a re-render** — which is why `forceRender`
([:63](../src/hooks/usePracticeSession.ts#L63), fired at
[:426](../src/hooks/usePracticeSession.ts#L426)) is load-bearing rather than
cosmetic.

**Interpretation.** Progression state has the lifecycle of round state and the
meaning of learner progress. Its lifetime is not the product of a decision — it
is the product of `useRef` being the convenient way to avoid stale closures, as
the comment at [:59](../src/hooks/usePracticeSession.ts#L59) states
(*"always-current, no stale closures"*). That comment explains a **read**
concern; the durability consequence is a side effect of the mechanism chosen to
solve it.

### 4.3 A latent hazard: progression keys are group-scoped, categories are not

**Fact (computed).** Group IDs are **not** unique across categories. Loading
`src/constants/minimalPairs.ts` and counting: 14 categories, **19 distinct group
IDs, 13 of which appear in more than one category**. `iVsI` appears in 11
categories; `ethD` in 9; `thetaT` in 8.

**Fact.** The three progression refs are keyed by `group` alone
([:340-342](../src/hooks/usePracticeSession.ts#L340-L342)), while mastery is
namespaced by category through its storage key
(`buildMasteryStorageKey`, [masteryPersistence.ts:25-27](../src/domain/masteryPersistence.ts#L25-L27)).
The category-reset effect does not clear them (§4.2).

**Fact.** The hazard is **currently unreachable**, and only for an incidental
reason: the sole path to a category change also changes `language` (§4.1), which
changes the `<Tabs key>`, which remounts the hook and destroys the refs before
any cross-category read can occur.

**Interpretation.** A correctness property of the progression model — *streaks
earned in Spanish must not count toward a promotion in Japanese* — is being
enforced by a remount key in an unrelated layout file, with no test, no comment,
and no stated connection. Removing `key={language}` from `_layout.tsx:60` is an
entirely plausible future change (it is the obvious fix if the remount ever
looks like a performance or state-loss problem), and it would silently convert
this into a reachable defect that grants unearned mastery promotions across
languages. **This is not a live bug. It is an invariant with no owner.**

### 4.4 Mastery state lifecycle

**Fact — read path.** Mount or `categoryKey` change → load effect
([:46-99](../src/hooks/useContrastPairs.ts#L46-L99)) sets `isLoading = true` and
`mastery = {}`, then reads `@mastery_${category}` and sets
`parseStoredMastery(raw)`. `parseStoredMastery` drops any entry that is not an
integer in `[1,6]` ([masteryPersistence.ts:41-72](../src/domain/masteryPersistence.ts#L41-L72)).

**Fact — write path.** The persist effect
([:102-135](../src/hooks/useContrastPairs.ts#L102-L135)) fires whenever
`mastery` identity changes and `isLoading` is false; on the legacy path it is
**unconditional** and unqueued: `AsyncStorage.setItem(storageKey,
serializeMastery(mastery)).catch(() => {})`.

**Fact — every mount writes.** `parseStoredMastery` returns a fresh object for
any non-null `raw`, so the identity always changes and the effect always fires.
Asserted by `scripts/useContrastPairsFlagOff.test.js:149-186`, which observes
`writes = [['@mastery_日本語', '{"rL":3}']]` after a clean load.

**Fact — failure behavior.** A read rejection is caught at
[:84-86](../src/hooks/useContrastPairs.ts#L84-L86). The `skipNextStableWrite`
guard is armed **only on the stable path**; the legacy path leaves `mastery` at
the `{}` set at [:50](../src/hooks/useContrastPairs.ts#L50), `finally` clears
`isLoading`, and the unguarded persist branch then writes `{}`. Asserted:
`assert.deepStrictEqual(storage.writes, [['@mastery_日本語', '{}']])`
(`useContrastPairsFlagOff.test.js:188-210`). A **write** rejection is swallowed
entirely (`.catch(() => {})` at [:126](../src/hooks/useContrastPairs.ts#L126));
`persistenceError` is only ever set on the stable path.

**Fact — concurrency assumptions.** The legacy write path has **no queue**
(`stableWriteQueue` at [:32](../src/hooks/useContrastPairs.ts#L32) is used only
by the stable branch), no revision, no compare-and-set, and no cross-instance
coordination. Two mounted instances of the same key rely entirely on
last-writer-wins.

**Interpretation.** Mastery is durable in the ordinary case and its rules are
sound. What is missing is not durability but **failure semantics**: a read
failure is treated as "no progress" rather than "unknown", and a write failure
is treated as nothing at all. Both are pinned by passing tests, which means they
are current shipped behavior and not Phase 4 material — but "pinned" describes
the test suite, not the learner's data.

---

## 5. Persistence guarantees

### 5.1 What survives what — verified

| Learner state | App restart | Screen remount | Language switch | OS kill in background |
|---|---|---|---|---|
| Mastery tier | **Yes** | **Yes** (re-read) | **Yes** (per-category key) | **Yes** |
| Attempt history | **Yes** | **Yes** | **Yes** (provider is outside the tabs key) | **Yes** |
| Placement completion | **Yes** | **Yes** | **Yes** (per-category key) | **Yes** |
| Practice time (daily/cumulative) | **Yes** | **Yes** | **Yes** (provider-independent) | **Yes** |
| **Speed tier** | **No** | **No** | **No** | **No** |
| **Fast streak** | **No** | **No** | **No** | **No** |
| **Long streak** | **No** | **No** | **No** | **No** |
| Trial scheduling state | No (by design) | No (by design) | No (by design) | No (by design) |
| Active contrast / round state | No | No | No | No |

"Screen remount" above means an actual unmount of `HomeScreen`. Note that the
common cases — switching to Results/Settings and back, the entry-gate reload on
focus (`index.tsx:52-55`), and the placement gate — do **not** unmount it (§4.1),
so progression survives ordinary in-session navigation. It does not survive the
tabs-key remount or process death.

### 5.2 What can disappear, and is that intentional?

| Disappearing state | Classification | Basis |
|---|---|---|
| Trial scheduling state | **Intentional** | Explicitly designed as session-scoped; `Phase-4-Architecture-Plan.md` §3.1 states the module owns per-session bookkeeping and nothing durable |
| Round/UI state | **Intentional** | Category-reset effect exists precisely to clear it ([:92-93](../src/hooks/usePracticeSession.ts#L92-L93) comment) |
| **Speed tier, fast streak, long streak** | **Unknown — never decided** | No document states an intent. `useRef` was chosen for closure freshness ([:59](../src/hooks/usePracticeSession.ts#L59)), not for lifetime. The Phase 4 plan classifies them as "domain state held in React" (§2.1) without ruling on durability |
| In-memory vs on-disk attempt divergence past 100 attempts | **Accidental, product-owned** | Already recorded, `Phase-4-Architecture-Plan.md` §2.5 / §6.3 |
| Mastery, on a legacy read failure | **Accidental, data-safety** | Already recorded and escalated to WP-3.8G, §2.2 / §6.3 |

**Interpretation.** Only one row is genuinely open: progression. It is not
"intentional" — nothing decided it. It is not clearly "accidental" either — an
argument exists that a promotion should represent *sustained current* skill and
that a cold restart legitimately restarts the run. **That argument has never
been made or rejected in writing, which is the actual finding.** An architecture
review cannot resolve it; it can only stop it from being resolved implicitly by
whoever next touches the refs.

### 5.3 Is persistence work required?

**Recommendation: no, not as the next step, and not before a recorded decision.**

Reasoning, in order:

1. The state has no serializable shape today. Persisting it now means designing
   a schema, a storage key, a normalization function, and a migration story for
   a concept that does not yet exist as a module. That is the largest possible
   version of this change, proposed before the smallest one has been done.
2. The product question is genuinely open (§5.2). Persisting is not the
   conservative default — it changes learner-visible behavior (a restart would
   preserve the playback rate rather than resetting it to 0.85) and it makes
   promotions cheaper in a way that was never sized.
3. Every existing durable key is reached through either a named adapter or
   `useContrastPairs`. Adding a new durable key from inside `usePracticeSession`
   would add a **third** direct-`AsyncStorage` learner-state site
   (`Phase-4-Architecture-Plan.md` §1.3 already flags the two that exist as a
   defect), and would do it in the module Phase 4 is trying to shrink.

**Recommendation.** Extract first (§8.1), decide second (§8.2), persist only if
the decision says so — at which point it is a small, well-scoped addition to a
module that already owns the shape.

### 5.4 One newly-observed exposure in the mastery write path

**Fact.** `DEFAULT_LANGUAGE` is `Object.keys(alternateLanguages)[0]`
([LanguageContext.tsx:25](../src/context/LanguageContext.tsx#L25)), which
evaluates to **`'English'`** (verified by loading the module: 15 keys, first is
`English`). `LanguageProvider` initializes `language` to that value
([:117](../src/context/LanguageContext.tsx#L117)) and only later resolves the
stored preference asynchronously ([:121-228](../src/context/LanguageContext.tsx#L121-L228)).

**Fact.** `'English'` is not a practice category — `minimalPairs` has 14
categories and `minimalPairs[0].category` is `日本語`. `CategoryContext`'s
`findIndex` therefore returns `-1` and `categoryIndex` stays at its initial `0`
([CategoryContext.tsx:24-31](../src/context/CategoryContext.tsx#L24-L31)).

**Interpretation.** On **every cold start**, before the stored language
resolves, the practice screen mounts against `日本語` and `useContrastPairs`
begins a read of `@mastery_日本語` — for every learner, in every language. If
that read resolves before the language switch remounts the tabs, the
unconditional mount-write fires against that key. In the happy path it writes
back exactly what it read and is harmless. On a transient read failure it writes
`{}` (§4.4).

**This does not change the classification of the known finding, it widens its
blast radius:** the previously-recorded exposure was "a failed read of *your*
mastery key erases *your* progress." The actual exposure includes "a failed read
during cold start can erase the Japanese mastery key of a learner who has never
opened Japanese in this session." Whether the race is won often enough to matter
is **unmeasured** — this is a code-path reading, not an observed event, and no
test covers the interleaving.

**Recommendation.** Record this as an amendment to the existing WP-3.8G
deferred finding (`Phase-4-Architecture-Plan.md` §6.3, row 1). Do **not** fix it
in Phase 4 — it is inside `useContrastPairs`, which every Phase 4 slice is
forbidden to touch. Do not attempt to fix it by changing `DEFAULT_LANGUAGE` or
the tabs key either; both are load-bearing elsewhere and neither addresses the
unguarded write.

---

## 6. Failure scenarios

Ranked by **probability × impact**, with detectability noted separately because
the least detectable are the ones that will not be reported.

| # | Failure | Probability | Impact | Detectability | Basis |
|---|---|---|---|---|---|
| **1** | **Learner loses an in-flight level-up to a restart.** Speed tier and both streaks reset to zero; the next level-up costs ≥9 fast-correct answers again, and playback audibly drops back to 0.85× | **Certain** — happens on every cold start and every language switch | Moderate per occurrence, compounding: a learner who practises in short daily sessions may *never* accumulate three unbroken runs and can plateau permanently below their ability | **Very low.** No error, no log, no analytics event. The learner experiences it as "this app is slow to level up," not as data loss | §4.2, §5.1 |
| **2** | **Cold-start read failure writes `{}` over a populated mastery key** — plausibly `@mastery_日本語` for a learner who does not use Japanese | Low (needs a transient `AsyncStorage` read rejection) but sampled on **every** launch | **Severe and irreversible** — total mastery loss for that category, no backup, no undo | **Very low.** The write is `.catch(() => {})`; `persistenceError` is never set on the legacy path | §4.4, §5.4 |
| **3** | **Silent mastery write failure.** A promotion is applied in memory, celebrated in the UI, and never persisted | Low | Moderate — one tier lost at next launch; the learner saw a celebration for progress that did not survive | **Zero.** Swallowed at [:126](../src/hooks/useContrastPairs.ts#L126) | §4.4 |
| **4** | **Cross-category streak leak** grants an unearned promotion | **Zero today**; becomes high if `key={language}` is ever removed from `_layout.tsx:60` | Severe — directly violates the truthfulness principle the recent fixes established, in the state layer rather than the view layer | **Very low.** Would present as "levelling up suspiciously fast in my second language" | §4.3 |
| **5** | **Stale concurrent mastery write** from the Results instance overwrites a newer practice promotion | Very low — no realized interleaving exists in the current navigation flow (Results only ever writes a value it just read, within one tick) | Severe | Very low | §3.2; already classified, WP-3.8G |
| **6** | **Results charts show more attempts before restart than after**, past 100 attempts on one pair | Low (requires 100+ attempts on a single pair in one session) | Low | Moderate — visible in the chart | §3.1; product-owned |

**Interpretation.** #1 is the highest-ranked failure and is also the only one
that is *certain*. It has never been reported as a bug because it is
indistinguishable from the app simply being demanding. That is precisely the
profile of a defect that survives indefinitely: high frequency, low
per-occurrence visibility, and a plausible innocent explanation.

**#1 and #2 differ in kind and must not be bundled.** #1 is a design question
about what progress means. #2 is a data-safety defect with a named owner. A work
package that "fixes progression persistence and hardens the mastery write" is
two decisions wearing one hat, and it crosses the WP-3.8G boundary.

---

## 7. Architecture risks

### 7.1 Risks in the current design

| Risk | Evidence | Status |
|---|---|---|
| Progression state has no owner, no name, no test, no serializable shape | §3.2, §4.2 | **Addressed by Phase 4.2 as scoped** |
| A progression-model invariant (category isolation) is enforced by an unrelated layout key | §4.3 | **Not addressed by any planned slice** |
| The promotion *decision* inputs are transient while the promotion *output* is durable — an asymmetry no document justifies | §3.1, §5.2 | **Undecided** |
| `forceRender` is the publication channel for a value that reaches the audio hook only via re-render | §4.2, [useAudio.ts:456-465](../src/hooks/useAudio.ts#L456-L465) | **Named constraint on Phase 4.2** (`Phase-4-Architecture-Plan.md` §4.2) |
| Mastery read/write failure semantics are silent on the legacy path | §4.4 | Deferred, WP-3.8G |
| Cold start touches `@mastery_日本語` for all learners | §5.4 | **New** — amend the WP-3.8G deferred finding |
| Two concurrent `useContrastPairs` instances, unqueued legacy writes | §3.2 | Deferred, WP-3.8G |

### 7.2 Risks a Phase 4.2 extraction would introduce

| Risk | Why | Mitigation |
|---|---|---|
| **Playback-rate timing change** | Moving state from a ref to `useState` changes when the new rate reaches `useAudio`, because `play` closes over `rate` | Preserve ref semantics — state object in a ref, `forceRender` retained. Already mandated by `Phase-4-Architecture-Plan.md` §4.2 |
| **Silent re-keying** | Changing the map key from `group` to `(category, group)` fixes §4.3 but is only *provably* behavior-preserving under the current navigation flow | Treat as a separate, explicitly-argued change with its own assertion — **not** folded into the move (§8.1) |
| **Scope creep into persistence** | Once the state is a named serializable object, adding a storage key looks trivial | The module must not import `AsyncStorage` or any storage adapter; assert it, in the shape `trialScheduling` already uses |
| **Test-harness fidelity** | The hand-rolled hook harness fakes React scheduling; behavior proven under it is not proven under React 19 | Manual smoke pass per `docs/manual-smoke-test.md`, specifically steps 95-96 which exercise the rate ladder |

### 7.3 What this review explicitly does **not** recommend

Per the constraints, and stated so the absence reads as a decision:

- No service layer, repository, factory, engine, or state library.
- No `PracticeSessionEngine` — already rejected on recorded grounds.
- No change to `useContrastPairs`, `masteryCompatibility`,
  `contrastMasteryStorage`, `contrastMasteryPersistence`,
  `historicalIdentityMapping`, or any file under `src/storage/`.
- No change to `featureFlags.ts`; rollout stays `disabled` and human-controlled.
- No change to `practiceSession.ts` or `adaptiveProgression.ts` — the rules are
  correct and covered.
- No new storage key, and no relocation of an existing one.
- No repair of the attempt-history divergence, the malformed-narrowing write, or
  the read-failure empty write.

---

## 8. Recommended next steps

### 8.1 The smallest safe next work package — Phase 4.2 as already scoped

**Recommendation: execute `Phase-4-Architecture-Plan.md` §4.2 unchanged, in two
commits, mirroring the 4.1 shape.**

*Is a new domain module warranted?* **Yes** —
`src/domain/practice/progressionState.ts`.

**What it should own:** the per-contrast map of speed tier, fast streak, and
long streak, and the transition that applies a `PracticeAnswerResult` to it.

**What it must not own:** the promotion arithmetic (stays in
`adaptiveProgression.ts`); the mastery tier; when a promotion is persisted;
playback-rate *selection*; any I/O; React lifecycle.

**Why it is warranted independently of the durability question:** three of the
seven learner-progression concepts (§2.1) currently have no addressable
representation. They cannot be asserted, inspected, replayed, or reasoned about
without mounting a 513-line hook. Every option for resolving §5.2 — persist,
don't persist, persist partially — requires this shape to exist first. The
module earns its place by moving a responsibility out of React, which is the
bar `Phase-4-Architecture-Plan.md` §6.4 sets.

**Commit 1 — characterization only.** `scripts/` only. Assert the current
behavior that has zero coverage today:

- the speed ladder 0→1→2→mastery, via `fastStreak >= 3` and via `longStreak >= 6`;
- streak reset on an incorrect answer, with **no** speed demotion
  ([:393-396](../src/hooks/usePracticeSession.ts#L393-L396));
- speed reset to 0 on mastery promotion;
- per-group isolation of all three maps within one category;
- **the exact `(trial → speed tier → rate)` triple sequence** for a scripted
  answer run under a stubbed clock — this is the acceptance fixture for Commit 2
  and it must contain a mastery promotion, which means the clock must be
  script-advanced (a real clock makes `responseTimeMs < 5000` machine-dependent);
- that progression state is **not** cleared by the category-reset effect — the
  current behavior, pinned so that Commit 2 cannot change it silently.

Every assertion gets a mutation check: inject the regression, observe *that*
assertion fail, revert.

**Commit 2 — extract.** Add the module, collapse the three refs into one state
ref, replace the mutation sites with a transition call, delete the displaced
inline policy. **Preserve ref semantics and `forceRender`.** The Commit 1 rate
fixture must reproduce byte-identically **without being edited**. Assert the
module's forbidden imports (`react`, `AsyncStorage`, `FEATURE_FLAGS`,
`practiceAnalytics`, any storage module).

**Verification:** `npm test` ≥493 passing / 0 failing at both commits;
`npm run check` green; `scripts/adaptiveProgression.test.js` and
`scripts/practiceSession.test.js` unchanged and passing; diff audit confirming
nothing under `src/storage/`, `src/domain/compatibility/`, `featureFlags.ts`, or
`useContrastPairs.ts` changed; manual smoke pass of the rate ladder.

**Rollback:** `git revert` of either commit. No key, format, schema, or flag
changes, so no data repair.

### 8.2 In parallel — one recorded product decision (no code)

**Recommendation.** Record a decision answering: *should progression toward the
next mastery tier survive an app restart?* The three defensible answers, with
what each implies:

- **No, by design** — a promotion must represent sustained *current* skill;
  restarting the run is the feature. **Implication:** §5.2's open row closes,
  failure #1 is reclassified as intended behavior, and §4.3's latent hazard
  becomes the only progression work left.
- **Yes, fully** — speed and both streaks persist per category+group.
  **Implication:** a follow-on slice adds one durable key owned by the new
  module's adapter; playback rate survives restart (learner-visible); the
  promotion ladder becomes materially cheaper for intermittent users.
- **Partially** — persist speed tier (an earned plateau), discard streaks (an
  in-flight run). **Implication:** the middle option; it makes the durable/
  transient split match the earned/in-flight split, which is the same
  distinction the recent UI truthfulness fixes drew at the presentation layer.

**This decision does not block §8.1 and §8.1 must not wait for it.** The
extraction is behavior-preserving under all three answers. The decision only
determines whether a *fourth* commit ever happens.

### 8.3 Documentation-only amendments

- Amend `Phase-4-Architecture-Plan.md` §6.3 row 1 (legacy failed-read
  empty-write) with the cold-start `日本語` widening from §5.4, keeping the
  owner as WP-3.8G.
- Add §4.3 (progression category isolation enforced by the tabs key) to the same
  deferred-findings table, owned by Phase 4.2, so it is met as a classified risk.

---

## 9. Deferred items

**These are known and intentionally excluded from the recommended package.**

| Item | Why deferred | Owner |
|---|---|---|
| Progression **persistence** | Requires the §8.2 decision and the §8.1 module. Doing it first means designing a schema for a concept with no shape | Phase 4.2 follow-on, gated on §8.2 |
| Re-keying progression by `(category, group)` (§4.3) | Currently unobservable, so "behavior-preserving" is provable only under the present navigation flow. It deserves its own argument and assertion, not a free ride on a move commit | Phase 4.2 follow-on |
| Legacy failed-read empty-write, incl. the cold-start widening (§5.4) | Inside `useContrastPairs`; Phase 4 may not touch mastery authority while WP-3.8G is unbuilt. **Data-safety, not cleanup** | WP-3.8G |
| Silent legacy mastery write failure (§4.4, failure #3) | Same module, same gate | WP-3.8G |
| Concurrent `useContrastPairs` instances | Same module, same gate; no realized overwrite in the current flow | WP-3.8G |
| `ProgressUpdater` / mastery mutation ownership | All four Stabilization Plan unblocking conditions unmet — rollout is `disabled`, WP-3.8C and WP-3.8G unbuilt | WP-3.8G, gated |
| In-memory vs on-disk attempt divergence | Learner-visible in the Results charts; needs a product decision | Product |
| Placement identity gap (`@placementDone_${categoryLabel}`) | Out of Phase 4 entirely | Open, Audit §8 |
| Placement assessment extraction (4.3), mastery summary (4.4), pair-key consolidation (4.5) | Separate slices with separate verification | Phase 4.3–4.5 |
| Dropped deferred playback (I18) | Playback-lifecycle reliability | Phase 5 |

**Rule.** None of these may be fixed opportunistically inside §8.1. A slice that
grows to include one is no longer the slice this review assessed, and its
rollback and verification arguments no longer hold.

---

## 10. Implementation readiness assessment

| Criterion | Status | Evidence |
|---|---|---|
| Test baseline green | **Yes** — 493 passing, 0 failures, exit 0 | `npm test` at HEAD `a5f487c` |
| Working tree clean | **Yes** | `git status --porcelain` empty |
| Target behavior currently covered | **No** — zero assertions touch progression state | `grep` over `scripts/`: 0 hits for the three refs |
| Rules the module will compose already covered | **Yes** | `scripts/adaptiveProgression.test.js` |
| Precedent for the extraction shape | **Yes** — Phase 4.1 landed the same two-commit pattern | `86334ab`, `9ae0d84` |
| Deterministic verification possible | **Yes, with a stubbed clock** | Promotion timing depends on `responseTimeMs < 5000` |
| Storage/compatibility surfaces untouched by the plan | **Yes** | §7.3; no slice imports storage |
| Phase 3.8 gates affected | **None** | No evidence producer, no rollout path, no diagnostic |
| Product decision required to start | **No** | §8.2 is parallel, not blocking |
| Product decision required to finish the *durability* question | **Yes** | §5.2, §8.2 |

**Readiness verdict: ready for Commit 1 of §8.1 today.** The only precondition
that is unmet — behavioral coverage of progression state — *is* Commit 1.

**Standing caution.** The extraction's single largest hazard is not the move; it
is the temptation to improve while moving. Three improvements will present
themselves and all three must be refused inside the move commit: converting the
ref to `useState` (changes rate timing), re-keying by category (§4.3, unobservable
today, deserves its own argument), and adding a storage key (§5.3, needs §8.2).

---

## Verification performed for this document

| Check | Result |
|---|---|
| Code changed | **None.** No file under `src/`, `app/`, `utils/`, or `scripts/` created, edited, or deleted |
| Rollout state changed | No. `CONTRAST_MASTERY_ROLLOUT_STATE = 'disabled'`, read only |
| Feature flags / Decisions changed | No |
| Test baseline | `npm test` → 493 passing assertions, 0 failures, exit 0 at HEAD `a5f487c` |
| Files read directly | `usePracticeSession.ts`, `useContrastPairs.ts`, `adaptiveProgression.ts`, `practiceSession.ts`, `trialScheduling.ts`, `masteryPersistence.ts`, `progressStorage.ts`, `PairProgressContext.tsx`, `usePracticeEntryState.ts`, `LanguageContext.tsx`, `CategoryContext.tsx`, `featureFlags.ts`, `sessionTimerPersistence.ts`, `app/(tabs)/_layout.tsx`, `index.tsx`, `results.tsx`, `settings.tsx`, `SessionTimer.tsx` (partial), `useAudio.ts` (partial), `useContrastPairsFlagOff.test.js`, `Phase-4-Architecture-Plan.md`, `Phase-3.8-Stabilization-Plan.md` (WP-3.8G section), the two 2026-08-02 truthfulness design specs |
| Claims verified by computation, not reading | Group-ID overlap across categories (19 distinct IDs, 13 shared) and `DEFAULT_LANGUAGE = 'English'` — both computed by loading the modules via `scripts/load-ts-module.js` |
| Claims verified by search | Progression-ref reference set (9 hits, all in one file); `setCategoryIndex` call sites (2); direct `AsyncStorage` call sites |
| Uncertainty stated explicitly | Yes — §5.4 (cold-start race is a code-path reading, unmeasured at runtime), §4.3 (hazard currently unreachable), §6 (failure #5 has no realized interleaving) |
| Fact / Interpretation / Recommendation separated | Maintained throughout |
| New requirements invented | None. Every constraint derives from `Phase-4-Architecture-Plan.md`, `Phase-3.8-Stabilization-Plan.md`, or the truthfulness principle established by the 2026-08-02 design specs |
