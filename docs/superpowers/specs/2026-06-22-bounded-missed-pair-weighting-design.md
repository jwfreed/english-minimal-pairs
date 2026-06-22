# Bounded Missed-Pair Weighting — Design Spec

**Date:** 2026-06-22  
**Branch:** `app-024-bounded-missed-pair-weighting`  
**Scope:** Practice scheduler only — no mastery, persistence, UI, pair data, or recommendation changes.

---

## Problem

The Soundwise scheduler rotates through same-tier word pairs in coverage-first order (unseen pairs before repeats, no immediate repeat when alternatives exist). When a learner misses a pair, the current scheduler has no memory of it — the missed pair gets no extra exposure in subsequent trials. This PR adds a bounded, temporary boost for recently missed pairs.

---

## Invariants That Must Not Change

- Mastery is tracked per contrast group, not per word pair.
- Unshown same-tier pairs in the current cycle come before any repeat.
- Immediate repeats are avoided when alternatives exist.
- Single-pair tiers repeat the only available pair (dataset limitation, not a bug).
- Recommendation thresholds, speed-tier promotion, and persistence shape are unchanged.

---

## Weighting Policy

1. **Coverage first** — unseen same-tier pairs outrank the missed-pair boost.
2. **No immediate repeat** — the missed pair cannot appear if it was just shown (`lastPairId`).
3. **Missed-pair boost after coverage** — once all same-tier pairs have cycled, the recently missed pair is selected preferentially.
4. **Bounded** — `lastPairId` already prevents back-to-back appearances; natural max frequency is once every 2 trials.
5. **Temporary** — boost decays when the missed pair is answered correctly, or after `RECENT_MISS_DECAY_TRIALS = 5` subsequent answered trials.
6. **Single-pair exception** — single-pair tiers are unaffected (the early-return path runs before boost logic).

---

## Design: Approach A — Stateless boost via extended input param

### New state shape

```typescript
export interface RecentMissState {
  recentlyMissedPairId: string | null;
  trialsSinceMiss: number;
}
export const RECENT_MISS_DECAY_TRIALS = 5;
```

### Changes to `SelectNextTrialPairInput`

```typescript
export interface SelectNextTrialPairInput {
  // existing fields unchanged ...
  recentlyMissedPairId?: string | null;  // NEW — optional, defaults to null
}
```

### Changes to `selectNextTrialPair`

After computing `candidatePairs` (the existing logic), if we are in the **all-seen phase** (no unseen pairs remain) and `recentlyMissedPairId` is in `repeatSafePairs`, select it directly instead of picking randomly.

```
if (unseenPairs.length > 0) return random(unseenPairs)   // coverage phase unchanged

// all-seen phase: apply boost
missedPair = repeatSafePairs.find(id === recentlyMissedPairId)
if (missedPair) return missedPair
return random(repeatSafePairs)                            // no active boost
```

### New helper: `updateRecentMissState`

Called in `handleAnswer` (index.tsx) after every answered trial.

| Condition | Result |
|-----------|--------|
| `wasCorrect=false` | Start new miss: `{ recentlyMissedPairId: answeredPairId, trialsSinceMiss: 0 }` |
| `wasCorrect=true && pairId === missed` | Clear boost: `{ null, 0 }` |
| `wasCorrect=true && pairId ≠ missed` | Increment counter; clear if `trialsSinceMiss >= RECENT_MISS_DECAY_TRIALS` |

### Caller wiring (index.tsx)

Two new refs alongside existing `lastPairIdRef` and `seenThisCycleRef`:

```typescript
const recentMissStateRef = useRef<RecentMissState>({ recentlyMissedPairId: null, trialsSinceMiss: 0 });
```

- Reset in: group change, mastery reset, pair reset
- Updated in: `handleAnswer` via `updateRecentMissState`
- Passed into: `selectNextTrialPair` as `recentlyMissedPairId: recentMissStateRef.current.recentlyMissedPairId`

---

## Files Changed

| File | Change |
|------|--------|
| `app/domain/practiceSession.ts` | Add `RecentMissState`, `RECENT_MISS_DECAY_TRIALS`, `updateRecentMissState`; extend `SelectNextTrialPairInput`; update `selectNextTrialPair` |
| `app/(tabs)/index.tsx` | Add `recentMissStateRef`; wire `handleAnswer` and `selectNextTrialPair` call |
| `scripts/practiceSession.test.js` | 7+ new deterministic tests |

---

## Tests to Add

1. **Coverage before weighting** — unseen pair wins over missed pair
2. **Missed pair boosted after coverage** — in all-seen phase, missed pair is selected
3. **No immediate repeat of missed pair** — lastPairId rule blocks it
4. **Boost expiry after N trials** — `updateRecentMissState` clears after 5 correct answers on other pairs
5. **Correct answer clears boost** — correct on missed pair → boost gone
6. **Single-pair tier** — still returns sole pair, unaffected
7. **`updateRecentMissState` state transitions** — miss → increment → decay → clear

---

## Out of Scope

UI, copy/i18n, pair data, group IDs, mastery thresholds, recommendation thresholds, persistence migrations, analytics, new dependencies, full SRS system.
