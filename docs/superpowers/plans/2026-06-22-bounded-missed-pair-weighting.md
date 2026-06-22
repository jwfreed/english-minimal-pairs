# Bounded Missed-Pair Weighting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give recently missed word pairs a temporary, bounded priority boost in the practice scheduler — without breaking same-tier coverage, no-immediate-repeat behavior, group-level mastery, or any existing characterization test.

**Architecture:** Extend `selectNextTrialPair` with an optional `recentlyMissedPairId` input. Add a pure `updateRecentMissState` helper that the caller invokes after every answered trial to track and decay the boost. Wire two new refs in `index.tsx` alongside the existing `lastPairIdRef` and `seenThisCycleRef` pattern. No persistence changes, no UI changes, no mastery/recommendation changes.

**Tech Stack:** TypeScript, React Native (Expo), CommonJS Jest-style tests (Node runner in `scripts/`), `npm test` / `npm run typecheck` / `npm run lint`

---

## File Map

| File | Change |
|------|--------|
| `scripts/practiceSession.test.js` | Add 7 new tests (added first, failing) |
| `app/domain/practiceSession.ts` | Add `RecentMissState`, `RECENT_MISS_DECAY_TRIALS`, `updateRecentMissState`; extend `SelectNextTrialPairInput`; update `selectNextTrialPair` |
| `app/(tabs)/index.tsx` | Import new exports; add `recentMissStateRef`; wire `handleAnswer` and `selectNextTrialPair` call; reset in effects |

---

## Task 1: Add failing tests for bounded missed-pair weighting

**Files:**
- Modify: `scripts/practiceSession.test.js`

- [ ] **Step 1.1: Extend the destructuring import in the test file**

In `scripts/practiceSession.test.js`, find the `loadTsModule` destructuring block (lines 5–14) and add two new exports:

```javascript
const {
  advanceTrialCycleSeenIds,
  applyPracticeAnswer,
  buildTrialPairId,
  buildMasteryForAllGroups,
  choosePlaybackForRound,
  recommendPlacementTier,
  selectNextTrialPair,
  selectVisiblePairsByMastery,
  updateRecentMissState,
  RECENT_MISS_DECAY_TRIALS,
} = loadTsModule(path.join(__dirname, '..', 'app', 'domain', 'practiceSession.ts'));
```

- [ ] **Step 1.2: Add 7 new tests at the end of the file, before the final `console.log`**

Append the following block to `scripts/practiceSession.test.js`, right after the last `runTest(...)` call and before the `// ─── Characterization: full cycle` block (or at the very end of the file):

```javascript
// ─── Bounded missed-pair weighting ────────────────────────────────────────────
//
// These tests define the boost policy:
//   - Coverage phase (unseen pairs exist): boost is ignored; unseen pairs win.
//   - All-seen phase: recently missed pair is selected before neutral seen pairs.
//   - No-immediate-repeat rule outranks boost: missed pair cannot be last pair.
//   - Boost decays after RECENT_MISS_DECAY_TRIALS subsequent answered trials.
//   - Correct answer on the missed pair clears boost immediately.
//   - A new miss overrides the previous missed pair.

runTest('selectNextTrialPair: unseen pair wins over recently missed pair in coverage phase', () => {
  // Even when pairA is marked as recently missed, pairB (unseen) takes priority.
  const pairA = makePair('rL', 2, 'rake', 'lake');   // recently missed, already seen
  const pairB = makePair('rL', 2, 'rate', 'late');   // unseen
  const pairC = makePair('rL', 2, 'rip', 'lip');     // seen

  const next = selectNextTrialPair({
    eligiblePairs: [pairA, pairB, pairC],
    activeGroup: 'rL',
    seenThisCycle: [buildTrialPairId(pairA), buildTrialPairId(pairC)],
    recentlyMissedPairId: buildTrialPairId(pairA),
    random: () => 0,
  });

  assert.strictEqual(next, pairB, 'unseen pair wins over missed-pair boost during coverage phase');
});

runTest('selectNextTrialPair: recently missed pair is preferred once all same-tier pairs have been seen', () => {
  // All pairs seen. random: () => 0.99 would pick pairC (index 1 of [pairA, pairC])
  // without boost, but boost must override and return pairA.
  const pairA = makePair('rL', 2, 'rake', 'lake');   // recently missed
  const pairB = makePair('rL', 2, 'rate', 'late');   // last shown (excluded by lastPairId)
  const pairC = makePair('rL', 2, 'rip', 'lip');

  const next = selectNextTrialPair({
    eligiblePairs: [pairA, pairB, pairC],
    activeGroup: 'rL',
    lastPairId: buildTrialPairId(pairB),
    seenThisCycle: [buildTrialPairId(pairA), buildTrialPairId(pairB), buildTrialPairId(pairC)],
    recentlyMissedPairId: buildTrialPairId(pairA),
    random: () => 0.99,  // would pick pairC without boost
  });

  assert.strictEqual(next, pairA, 'missed pair is preferred in all-seen phase');
});

runTest('selectNextTrialPair: missed pair is not chosen when it was the immediately previous pair', () => {
  // lastPairId === recentlyMissedPairId: no-repeat rule outranks boost.
  const pairA = makePair('rL', 2, 'rake', 'lake');   // missed AND just shown
  const pairB = makePair('rL', 2, 'rate', 'late');

  const next = selectNextTrialPair({
    eligiblePairs: [pairA, pairB],
    activeGroup: 'rL',
    lastPairId: buildTrialPairId(pairA),
    seenThisCycle: [buildTrialPairId(pairA), buildTrialPairId(pairB)],
    recentlyMissedPairId: buildTrialPairId(pairA),
    random: () => 0,
  });

  assert.strictEqual(next, pairB, 'no-repeat rule blocks missed-pair boost when pair was just shown');
});

runTest('updateRecentMissState: boost expires after RECENT_MISS_DECAY_TRIALS subsequent correct answers', () => {
  const pairA = makePair('rL', 2, 'rake', 'lake');
  const pairB = makePair('rL', 2, 'rate', 'late');

  // Record a miss on pairA.
  let state = updateRecentMissState({
    state: { recentlyMissedPairId: null, trialsSinceMiss: 0 },
    answeredPairId: buildTrialPairId(pairA),
    wasCorrect: false,
  });
  assert.strictEqual(state.recentlyMissedPairId, buildTrialPairId(pairA), 'miss is recorded');
  assert.strictEqual(state.trialsSinceMiss, 0);

  // Answer pairB correctly (RECENT_MISS_DECAY_TRIALS - 1) times — boost still active.
  for (let i = 0; i < RECENT_MISS_DECAY_TRIALS - 1; i++) {
    state = updateRecentMissState({
      state,
      answeredPairId: buildTrialPairId(pairB),
      wasCorrect: true,
    });
    assert.ok(state.recentlyMissedPairId !== null, `boost still active after ${i + 1} correct answers on other pair`);
  }

  // One final correct answer on pairB → decay threshold reached → boost clears.
  state = updateRecentMissState({
    state,
    answeredPairId: buildTrialPairId(pairB),
    wasCorrect: true,
  });
  assert.strictEqual(state.recentlyMissedPairId, null, 'boost expires after RECENT_MISS_DECAY_TRIALS trials');
  assert.strictEqual(state.trialsSinceMiss, 0, 'counter resets after expiry');
});

runTest('updateRecentMissState: correct answer on the missed pair clears boost immediately', () => {
  const pairA = makePair('rL', 2, 'rake', 'lake');

  let state = updateRecentMissState({
    state: { recentlyMissedPairId: null, trialsSinceMiss: 0 },
    answeredPairId: buildTrialPairId(pairA),
    wasCorrect: false,
  });
  assert.strictEqual(state.recentlyMissedPairId, buildTrialPairId(pairA));

  state = updateRecentMissState({
    state,
    answeredPairId: buildTrialPairId(pairA),
    wasCorrect: true,
  });
  assert.strictEqual(state.recentlyMissedPairId, null, 'correct answer on missed pair clears boost');
  assert.strictEqual(state.trialsSinceMiss, 0);
});

runTest('selectNextTrialPair: no boost applied when recentlyMissedPairId is null — random selection governs', () => {
  // With null recentlyMissedPairId, behavior is unchanged from the existing scheduler.
  const pairA = makePair('rL', 2, 'rake', 'lake');
  const pairB = makePair('rL', 2, 'rate', 'late');

  const next = selectNextTrialPair({
    eligiblePairs: [pairA, pairB],
    activeGroup: 'rL',
    lastPairId: buildTrialPairId(pairA),
    seenThisCycle: [buildTrialPairId(pairA), buildTrialPairId(pairB)],
    recentlyMissedPairId: null,
    random: () => 0,
  });

  // repeatSafePairs = [pairB]; random: () => 0 → pairB.
  assert.strictEqual(next, pairB, 'null recentlyMissedPairId leaves selection to random');
});

runTest('updateRecentMissState: a new incorrect answer overrides the previous missed pair', () => {
  const pairA = makePair('rL', 2, 'rake', 'lake');
  const pairB = makePair('rL', 2, 'rate', 'late');

  let state = updateRecentMissState({
    state: { recentlyMissedPairId: null, trialsSinceMiss: 0 },
    answeredPairId: buildTrialPairId(pairA),
    wasCorrect: false,
  });
  assert.strictEqual(state.recentlyMissedPairId, buildTrialPairId(pairA));

  state = updateRecentMissState({
    state,
    answeredPairId: buildTrialPairId(pairB),
    wasCorrect: false,
  });
  assert.strictEqual(state.recentlyMissedPairId, buildTrialPairId(pairB), 'new miss overrides old missed pair');
  assert.strictEqual(state.trialsSinceMiss, 0, 'trial counter resets on new miss');
});
```

- [ ] **Step 1.3: Run tests and confirm exactly 4 fail**

```
npm test 2>&1 | grep "not ok"
```

Expected output (4 failing tests):
```
not ok - selectNextTrialPair: recently missed pair is preferred once all same-tier pairs have been seen
not ok - updateRecentMissState: boost expires after RECENT_MISS_DECAY_TRIALS subsequent correct answers
not ok - updateRecentMissState: correct answer on the missed pair clears boost immediately
not ok - updateRecentMissState: a new incorrect answer overrides the previous missed pair
```

(The other 3 new tests characterize existing behavior and pass without changes.)

- [ ] **Step 1.4: Commit failing tests**

```bash
git add scripts/practiceSession.test.js
git commit -m "test: add failing tests for bounded missed-pair weighting"
```

---

## Task 2: Add `RecentMissState`, `RECENT_MISS_DECAY_TRIALS`, and `updateRecentMissState` to the domain

**Files:**
- Modify: `app/domain/practiceSession.ts`

- [ ] **Step 2.1: Add the new interface, constant, and helper**

In `app/domain/practiceSession.ts`, after the `AdvanceTrialCycleSeenIdsInput` interface (after line 57) and before `recommendPlacementTier`, insert:

```typescript
export interface RecentMissState {
  recentlyMissedPairId: string | null;
  trialsSinceMiss: number;
}

// Boost expires after this many subsequent answered trials since the miss.
export const RECENT_MISS_DECAY_TRIALS = 5;

/**
 * Returns the updated recent-miss state after one answered trial.
 *
 * Rules:
 * - Any incorrect answer starts a new miss (resets counter).
 * - Correct answer on the missed pair clears the boost immediately.
 * - Correct answer on any other pair increments the decay counter;
 *   boost expires when the counter reaches RECENT_MISS_DECAY_TRIALS.
 */
export function updateRecentMissState({
  state,
  answeredPairId,
  wasCorrect,
}: {
  state: RecentMissState;
  answeredPairId: string;
  wasCorrect: boolean;
}): RecentMissState {
  if (!wasCorrect) {
    return { recentlyMissedPairId: answeredPairId, trialsSinceMiss: 0 };
  }

  if (!state.recentlyMissedPairId) {
    return state;
  }

  if (answeredPairId === state.recentlyMissedPairId) {
    return { recentlyMissedPairId: null, trialsSinceMiss: 0 };
  }

  const next = state.trialsSinceMiss + 1;
  return next >= RECENT_MISS_DECAY_TRIALS
    ? { recentlyMissedPairId: null, trialsSinceMiss: 0 }
    : { ...state, trialsSinceMiss: next };
}
```

- [ ] **Step 2.2: Run tests and confirm only 1 test still fails**

```
npm test 2>&1 | grep "not ok"
```

Expected: exactly one failure:
```
not ok - selectNextTrialPair: recently missed pair is preferred once all same-tier pairs have been seen
```

(The 3 `updateRecentMissState` tests now pass. The scheduler boost test still fails because `selectNextTrialPair` does not yet use `recentlyMissedPairId`.)

- [ ] **Step 2.3: Commit**

```bash
git add app/domain/practiceSession.ts
git commit -m "feat: add RecentMissState, RECENT_MISS_DECAY_TRIALS, updateRecentMissState"
```

---

## Task 3: Extend `selectNextTrialPair` with the missed-pair boost

**Files:**
- Modify: `app/domain/practiceSession.ts`

- [ ] **Step 3.1: Add `recentlyMissedPairId` to `SelectNextTrialPairInput`**

Find the `SelectNextTrialPairInput` interface (currently around lines 45–51) and add the new optional field:

```typescript
export interface SelectNextTrialPairInput {
  eligiblePairs: Pair[];
  activeGroup: string;
  lastPairId?: string | null;
  seenThisCycle?: readonly string[] | ReadonlySet<string> | null;
  recentlyMissedPairId?: string | null;
  random?: () => number;
}
```

- [ ] **Step 3.2: Update `selectNextTrialPair` to apply the boost**

Replace the entire `selectNextTrialPair` function body with:

```typescript
export function selectNextTrialPair({
  eligiblePairs,
  activeGroup,
  lastPairId = null,
  seenThisCycle = null,
  recentlyMissedPairId = null,
  random = Math.random,
}: SelectNextTrialPairInput): Pair | null {
  const activePairs = eligiblePairs.filter((pair) => pair.group === activeGroup);
  if (activePairs.length === 0) return null;
  if (activePairs.length === 1) return activePairs[0];

  const nonRepeatingPairs = lastPairId
    ? activePairs.filter((pair) => buildTrialPairId(pair) !== lastPairId)
    : activePairs;
  const repeatSafePairs = nonRepeatingPairs.length > 0 ? nonRepeatingPairs : activePairs;
  const seenIds = new Set(seenThisCycle ?? []);
  const unseenPairs = repeatSafePairs.filter((pair) => !seenIds.has(buildTrialPairId(pair)));

  // Coverage phase: unseen same-tier pairs outrank the missed-pair boost.
  if (unseenPairs.length > 0) {
    return chooseFromPairs(unseenPairs, random);
  }

  // All-seen phase: boost the recently missed pair when eligible.
  if (recentlyMissedPairId) {
    const missedPair = repeatSafePairs.find(
      (pair) => buildTrialPairId(pair) === recentlyMissedPairId
    );
    if (missedPair) return missedPair;
  }

  return chooseFromPairs(repeatSafePairs, random);
}
```

- [ ] **Step 3.3: Run tests and confirm all pass**

```
npm test 2>&1 | grep "not ok"
```

Expected: no output (0 failures). Total passing should be 158 (151 + 7 new).

```
npm test 2>&1 | grep -c "^ok"
```

Expected: `158`

- [ ] **Step 3.4: Commit**

```bash
git add app/domain/practiceSession.ts
git commit -m "feat: apply bounded missed-pair boost in selectNextTrialPair"
```

---

## Task 4: Wire `recentMissStateRef` into the practice screen

**Files:**
- Modify: `app/(tabs)/index.tsx`

- [ ] **Step 4.1: Add new imports**

Find the existing import block from `@/app/domain/practiceSession` (around lines 29–35):

```typescript
import {
  advanceTrialCycleSeenIds,
  applyPracticeAnswer,
  buildTrialPairId,
  choosePlaybackForRound,
  selectNextTrialPair,
} from '@/app/domain/practiceSession';
```

Replace it with:

```typescript
import {
  advanceTrialCycleSeenIds,
  applyPracticeAnswer,
  buildTrialPairId,
  choosePlaybackForRound,
  selectNextTrialPair,
  updateRecentMissState,
  type RecentMissState,
} from '@/app/domain/practiceSession';
```

- [ ] **Step 4.2: Declare `recentMissStateRef` alongside existing session refs**

Find lines 170–172 (the ref declarations):

```typescript
const lastPairIdRef = useRef<string | null>(null);
const seenThisCycleRef = useRef<string[]>([]);
const manualPairOverrideRef = useRef(false);
```

Add the new ref after `seenThisCycleRef`:

```typescript
const lastPairIdRef = useRef<string | null>(null);
const seenThisCycleRef = useRef<string[]>([]);
const recentMissStateRef = useRef<RecentMissState>({ recentlyMissedPairId: null, trialsSinceMiss: 0 });
const manualPairOverrideRef = useRef(false);
```

- [ ] **Step 4.3: Reset in the category-change effect**

Find the `useEffect` that fires on `categoryIndex` change (around lines 176–186):

```typescript
useEffect(() => {
  setPairIndex(0);
  setActiveGroup(null);
  setFeedback(null);
  setPlayedIdx(null);
  setStartTime(null);
  setPendingPlayback(null);
  lastPairIdRef.current = null;
  seenThisCycleRef.current = [];
  manualPairOverrideRef.current = false;
}, [categoryIndex]);
```

Add the reset after `seenThisCycleRef.current = []`:

```typescript
useEffect(() => {
  setPairIndex(0);
  setActiveGroup(null);
  setFeedback(null);
  setPlayedIdx(null);
  setStartTime(null);
  setPendingPlayback(null);
  lastPairIdRef.current = null;
  seenThisCycleRef.current = [];
  recentMissStateRef.current = { recentlyMissedPairId: null, trialsSinceMiss: 0 };
  manualPairOverrideRef.current = false;
}, [categoryIndex]);
```

- [ ] **Step 4.4: Reset in the targetGroup-jump effect**

Find the `useEffect` that handles `targetGroup` (around lines 191–205):

```typescript
lastPairIdRef.current = null;
seenThisCycleRef.current = [];
manualPairOverrideRef.current = false;
```

Add the reset after `seenThisCycleRef.current = []`:

```typescript
lastPairIdRef.current = null;
seenThisCycleRef.current = [];
recentMissStateRef.current = { recentlyMissedPairId: null, trialsSinceMiss: 0 };
manualPairOverrideRef.current = false;
```

- [ ] **Step 4.5: Reset in the activeGroup-change effect**

Find the `useEffect` that fires on `[activeGroup, activeGroupPairs, activeGroupPairIdsKey]` (around lines 232–240):

```typescript
useEffect(() => {
  seenThisCycleRef.current = [];
  if (
    lastPairIdRef.current &&
    !activeGroupPairs.some((pair) => buildTrialPairId(pair) === lastPairIdRef.current)
  ) {
    lastPairIdRef.current = null;
  }
}, [activeGroup, activeGroupPairs, activeGroupPairIdsKey]);
```

Add the reset at the top of the effect body:

```typescript
useEffect(() => {
  seenThisCycleRef.current = [];
  recentMissStateRef.current = { recentlyMissedPairId: null, trialsSinceMiss: 0 };
  if (
    lastPairIdRef.current &&
    !activeGroupPairs.some((pair) => buildTrialPairId(pair) === lastPairIdRef.current)
  ) {
    lastPairIdRef.current = null;
  }
}, [activeGroup, activeGroupPairs, activeGroupPairIdsKey]);
```

- [ ] **Step 4.6: Reset in `handlePairChange` when the group changes**

Find the `handlePairChange` callback (around lines 451–468):

```typescript
if (groupChanged) {
  lastPairIdRef.current = null;
  seenThisCycleRef.current = [];
}
```

Add the reset:

```typescript
if (groupChanged) {
  lastPairIdRef.current = null;
  seenThisCycleRef.current = [];
  recentMissStateRef.current = { recentlyMissedPairId: null, trialsSinceMiss: 0 };
}
```

- [ ] **Step 4.7: Update `handleAnswer` to call `updateRecentMissState`**

Find `handleAnswer` (around line 380). After `recordAttempt(result.pairId, result.correct, result.durationMin)` (line 404) and before `groupLongStreakRef.current[g] = result.nextLongStreak`, insert:

```typescript
recentMissStateRef.current = updateRecentMissState({
  state: recentMissStateRef.current,
  answeredPairId: buildTrialPairId(selectedPair),
  wasCorrect: result.correct,
});
```

The resulting block should look like:

```typescript
setFeedback(result.feedback);
recordAttempt(result.pairId, result.correct, result.durationMin);
recentMissStateRef.current = updateRecentMissState({
  state: recentMissStateRef.current,
  answeredPairId: buildTrialPairId(selectedPair),
  wasCorrect: result.correct,
});

groupLongStreakRef.current[g] = result.nextLongStreak;
groupStreakRef.current[g] = result.nextFastStreak;
```

- [ ] **Step 4.8: Pass `recentlyMissedPairId` to `selectNextTrialPair`**

Find the `selectNextTrialPair` call inside `handlePlay` (around line 326):

```typescript
selectNextTrialPair({
  eligiblePairs: visible,
  activeGroup: group,
  lastPairId: lastPairIdRef.current,
  seenThisCycle: seenThisCycleRef.current,
  random: Math.random,
})
```

Add the new parameter:

```typescript
selectNextTrialPair({
  eligiblePairs: visible,
  activeGroup: group,
  lastPairId: lastPairIdRef.current,
  seenThisCycle: seenThisCycleRef.current,
  recentlyMissedPairId: recentMissStateRef.current.recentlyMissedPairId,
  random: Math.random,
})
```

- [ ] **Step 4.9: Run typecheck**

```
npm run typecheck
```

Expected: no errors.

- [ ] **Step 4.10: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: wire recentMissStateRef into practice screen scheduler"
```

---

## Task 5: Final verification

- [ ] **Step 5.1: Run all tests**

```
npm test
```

Expected: all tests pass, 0 failures. Count:

```
npm test 2>&1 | grep -c "^ok"
```

Expected: `158` (151 original + 7 new).

```
npm test 2>&1 | grep "not ok"
```

Expected: no output.

- [ ] **Step 5.2: Typecheck**

```
npm run typecheck
```

Expected: no errors or warnings.

- [ ] **Step 5.3: Lint**

```
npm run lint 2>&1 | tail -20
```

If lint errors appear: check whether they were pre-existing by running `git stash && npm run lint 2>&1 | tail -20 && git stash pop`. Only lint errors introduced by this PR need fixing.

- [ ] **Step 5.4: Check for trailing whitespace**

```
git diff --check
```

Expected: no output.

- [ ] **Step 5.5: Verify changed files are exactly the expected set**

```
git diff main --name-only
```

Expected files (no others):
```
app/(tabs)/index.tsx
app/domain/practiceSession.ts
docs/superpowers/plans/2026-06-22-bounded-missed-pair-weighting.md
docs/superpowers/specs/2026-06-22-bounded-missed-pair-weighting-design.md
scripts/practiceSession.test.js
```

- [ ] **Step 5.6: Verify no unintended changes to key invariant files**

```
git diff main -- app/domain/masteryPersistence.ts app/learning/adaptiveProgression.ts utils/recommendNextPractice.ts app/hooks/useContrastPairs.ts app/constants/minimalPairs.ts
```

Expected: no output (these files must not change).

---

## Self-Review Checklist

**Spec coverage:**
- [x] Coverage first (unseen wins) — Test 1 + boost gated behind `unseenPairs.length === 0`
- [x] No immediate repeat — Test 3 + `repeatSafePairs` excludes `lastPairId`
- [x] Missed-pair boost after coverage — Test 2 + boost logic in `selectNextTrialPair`
- [x] Bounded (once every 2 trials via lastPairId) — structurally enforced
- [x] Temporary (decay via `updateRecentMissState`) — Tests 4, 5
- [x] Single-pair tier unaffected — early return for `activePairs.length === 1` runs before boost
- [x] New miss overrides old — Test 7
- [x] All original 151 tests still pass — Task 5.1

**No placeholders:** All code blocks contain exact implementations.

**Type consistency:**
- `RecentMissState` defined in Task 2, imported in Task 4
- `updateRecentMissState` defined in Task 2, imported and called in Task 4
- `RECENT_MISS_DECAY_TRIALS` defined in Task 2, used in tests
- `recentlyMissedPairId` field added to `SelectNextTrialPairInput` in Task 3, passed in Task 4
