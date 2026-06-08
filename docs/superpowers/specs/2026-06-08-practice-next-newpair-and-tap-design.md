# Practice This Next: new-pair fallback + tappable card

Date: 2026-06-08

## Problem

The Results screen "Practice this next" card always shows the reason
"Your recent accuracy is lower here." Today the recommender only ever
returns groups with ≥3 attempts, so the card is silent (empty message)
when the user has nothing practiced. Two gaps:

1. When no group has enough data — or every practiced group is already
   strong — we should nudge the user toward a new pair with an honest
   message, not the "accuracy is lower" copy and not the generic empty
   text.
2. The card is informational only. Tapping it should take the user
   straight to that pair on the Practice screen.

## Scope

In scope: recommendation selection logic, a new reason message, a
cross-tab navigation target, making the card tappable.

Out of scope: scoring, mastery/adaptive progression, audio, placement,
onboarding, the capped-attempt retention behavior, practice selection
ordering beyond the new fallback.

## Design

### 1. `app/utils/recommendNextPractice.ts`

Add a `reason` discriminator and a strong-accuracy threshold.

```ts
export interface PracticeNextRecommendation {
  groupId: string;
  label: string;          // "/r/ vs /l/"
  recentAccuracy: number; // 0–1
  reason: 'lowAccuracy' | 'newPair';
}

const STRONG_ACCURACY = 0.9; // groups at/above this count as "strong"
```

Selection order:

1. Build eligible groups (≥ `MIN_GROUP_ATTEMPTS`) with recent accuracy
   (unchanged aggregation).
2. If any eligible group has accuracy **< STRONG_ACCURACY**, recommend
   the lowest-accuracy one (alphabetical tie-break) →
   `reason: 'lowAccuracy'`. (Today's behavior.)
3. Otherwise (no eligible groups, **or** all eligible groups are
   strong): find the **first pair in `pairs` order with zero recorded
   attempts**. If found, recommend its group →
   `{ label: "/cp1/ vs /cp2/", recentAccuracy: 0, reason: 'newPair' }`.
4. Otherwise, if eligible groups exist (all strong, no unpracticed
   pairs left), fall back to the lowest-accuracy eligible group →
   `reason: 'lowAccuracy'`.
5. Otherwise return `null` → existing empty message.

"Zero attempts" = no `progress[id]?.attempts?.length` for that pair's id.

### 2. `app/context/PracticeTargetContext.tsx` (new)

A minimal context to pass a target group between tabs:

```ts
interface PracticeTargetValue {
  targetGroup: string | null;
  requestPractice: (group: string) => void;
  consumeTarget: () => string | null; // returns + clears
}
```

Implemented with `useState` + `useRef` so `consumeTarget` reads and
clears atomically. Mounted in `app/(tabs)/_layout.tsx` inside
`CategoryProvider` (both Practice and Results tabs are descendants).

### 3. `app/(tabs)/results.tsx`

- Wrap the "Practice this next" card in a `Pressable` when a
  recommendation exists.
- `onPress`: `requestPractice(recommendation.groupId)` then
  `router.navigate('/')` (Practice tab is the `index` route).
- `accessibilityRole="button"`; keep the existing `accessibilityLabel`.
- Reason text key chosen by `recommendation.reason`:
  - `lowAccuracy` → `tKeys.practiceThisNextReason`
  - `newPair` → `tKeys.practiceThisNextReasonNew`
- When there is no recommendation, the card stays non-pressable with
  the existing empty message.

### 4. `app/(tabs)/index.tsx` (Practice)

Consume the target via an effect keyed on `[targetGroup, visible]`:
when `targetGroup` is set and `visible` contains a pair with that
group, set `pairIndex` to that index, reset round state
(`feedback`, `playedIdx`, `startTime`) the same way `handlePairChange`
does, and clear the target. `visible` always has exactly one pair per
group (`selectVisiblePairsByMastery`), so the target is always
resolvable for the current category. Category already matches because
both tabs share `CategoryContext`.

### 5. `app/constants/alternateLanguages.ts`

Add `practiceThisNextReasonNew` to all 15 language blocks (schema
completeness). English: **"You haven't practiced this pair yet."**
Best-effort natural translations per existing block.

## Testing

Extend `__tests__`/the existing `recommendNextPractice` suite:

- Returns `reason: 'lowAccuracy'` for the existing low-accuracy path.
- New-pair fallback when **no** group meets the attempt threshold but an
  unpracticed pair exists → `reason: 'newPair'`, correct group/label.
- New-pair fallback when **all** eligible groups are strong (≥0.9) and an
  unpracticed pair exists → `reason: 'newPair'`.
- All eligible strong and **no** unpracticed pairs left → falls back to
  lowest-accuracy eligible, `reason: 'lowAccuracy'`.
- Still returns `null` when nothing is eligible and no unpracticed pair
  exists.

Navigation wiring (context + Pressable + practice effect) is verified
manually; the recommendation logic stays pure and unit-tested.

## Risks / Notes

- A `newPair` recommendation points at the group's
  `selectVisiblePairsByMastery` representative pair (difficulty == tier,
  default tier 1), which is the pair the user would practice anyway.
- The strong threshold (0.9) is a heuristic; easy to tune later.
