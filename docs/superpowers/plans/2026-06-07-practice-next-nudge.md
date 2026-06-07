# Practice This Next Nudge — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Practice this next" recommendation card to the Results screen that surfaces the lowest-accuracy contrast group in the user's currently selected L1 category, using only existing local progress data.

**Architecture:** A pure helper function (`computePracticeNextRecommendation`) receives the in-memory progress snapshot and the current category's pair list, groups all attempts by contrast group, computes recent accuracy per group, and returns the lowest-accuracy group (or null when there is not enough data). The Results screen calls this helper via `useMemo` and renders a styled card inline between the mastery summary card and the FlashList. Three new translation keys carry the card copy.

**Tech Stack:** React Native, TypeScript, Expo Router, existing AsyncStorage-backed `PairProgressContext`, existing `tKeys` / `alternateLanguages` i18n system, Node.js `assert`-based test runner (`scripts/run-tests.js`).

---

## Files

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/utils/recommendNextPractice.ts` | Pure helper: aggregate attempts by group, return lowest-accuracy group or null |
| Create | `scripts/recommendNextPractice.test.js` | Unit tests for the pure helper |
| Modify | `app/constants/translationKeys.ts` | Add 3 new `tKeys` entries |
| Modify | `app/constants/alternateLanguages.ts` | Add English fallback strings for the 3 new keys to all 15 language blocks |
| Modify | `app/(tabs)/results.tsx` | Import helper, compute recommendation via `useMemo`, render card between mastery card and FlashList |

**Nothing else changes.** Placement, audio, scoring, mastery, onboarding, storage schema, and adaptive progression are untouched.

---

### Task 1: Write the failing tests

**Files:**
- Create: `scripts/recommendNextPractice.test.js`

- [ ] **Step 1.1: Create the test file**

```javascript
// scripts/recommendNextPractice.test.js
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { computePracticeNextRecommendation } = loadTsModule(
  path.join(__dirname, '..', 'app', 'utils', 'recommendNextPractice.ts')
);

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// Helper: build a Pair-shaped object for a given group and phonemes.
const makePair = (group, cp1, cp2, word1, word2) => ({
  word1,
  word2,
  ipa1: `/${cp1}/`,
  ipa2: `/${cp2}/`,
  difficulty: 1,
  group,
  position: 'initial',
  contrastPhoneme1: cp1,
  contrastPhoneme2: cp2,
});

// Helper: build a PairAttempt.
const makeAttempt = (isCorrect, timestamp = Date.now()) => ({
  isCorrect,
  timestamp,
  durationMin: 0,
});

// Helper: build a pair ID exactly as the helper does.
const pairId = (category, pair) =>
  `${category}__${pair.group}__${pair.word1}_${pair.word2}`;

// ─── Tests ────────────────────────────────────────────────────────────────────

runTest('returns null when progress is empty', () => {
  const pairs = [makePair('rL', 'r', 'l', 'rake', 'lake')];
  const result = computePracticeNextRecommendation({}, pairs, 'Japanese');
  assert.strictEqual(result, null);
});

runTest('returns null when no pair in the current category has enough attempts', () => {
  const cat = 'Japanese';
  const pair = makePair('rL', 'r', 'l', 'rake', 'lake');
  // Only 2 attempts — below the 3-attempt threshold
  const progress = {
    [pairId(cat, pair)]: {
      attempts: [makeAttempt(true), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pair], cat);
  assert.strictEqual(result, null);
});

runTest('returns the one practiced group when it has enough attempts', () => {
  const cat = 'Japanese';
  const pair = makePair('rL', 'r', 'l', 'rake', 'lake');
  const progress = {
    [pairId(cat, pair)]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pair], cat);
  assert.ok(result !== null, 'expected a recommendation');
  assert.strictEqual(result.groupId, 'rL');
  assert.strictEqual(result.label, '/r/ vs /l/');
  assert.ok(typeof result.recentAccuracy === 'number');
  assert.ok(result.recentAccuracy >= 0 && result.recentAccuracy <= 1);
});

runTest('recommends the group with the lowest recent accuracy when multiple are practiced', () => {
  const cat = 'Japanese';
  const pairRL = makePair('rL', 'r', 'l', 'rake', 'lake');
  const pairBV = makePair('bV', 'b', 'v', 'ban', 'van');

  // rL: 2 out of 3 correct = ~0.67 accuracy
  // bV: 1 out of 3 correct = ~0.33 accuracy → should be recommended
  const progress = {
    [pairId(cat, pairRL)]: {
      attempts: [makeAttempt(true), makeAttempt(true), makeAttempt(false)],
    },
    [pairId(cat, pairBV)]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pairRL, pairBV], cat);
  assert.ok(result !== null, 'expected a recommendation');
  assert.strictEqual(result.groupId, 'bV');
  assert.strictEqual(result.label, '/b/ vs /v/');
});

runTest('aggregates attempts across multiple pairs in the same group', () => {
  const cat = 'Japanese';
  const pair1 = makePair('rL', 'r', 'l', 'rake', 'lake');
  const pair2 = makePair('rL', 'r', 'l', 'rate', 'late');
  // pair1: 1 correct attempt; pair2: 2 incorrect attempts
  // Together: 3 total, 1 correct → low accuracy
  const progress = {
    [pairId(cat, pair1)]: {
      attempts: [makeAttempt(true)],
    },
    [pairId(cat, pair2)]: {
      attempts: [makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pair1, pair2], cat);
  assert.ok(result !== null, 'expected a recommendation');
  assert.strictEqual(result.groupId, 'rL');
  // Accuracy: 1/3 ≈ 0.333
  assert.ok(Math.abs(result.recentAccuracy - 1 / 3) < 0.01);
});

runTest('uses deterministic alphabetical tie-breaking when accuracies are equal', () => {
  const cat = 'Japanese';
  const pairBV = makePair('bV', 'b', 'v', 'ban', 'van');
  const pairRL = makePair('rL', 'r', 'l', 'rake', 'lake');
  // Both groups: 1 out of 3 correct (identical accuracy)
  const progress = {
    [pairId(cat, pairBV)]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
    [pairId(cat, pairRL)]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pairBV, pairRL], cat);
  assert.ok(result !== null);
  // 'bV' < 'rL' alphabetically → 'bV' wins the tie
  assert.strictEqual(result.groupId, 'bV');
});

runTest('ignores progress entries from other categories', () => {
  const cat = 'Japanese';
  const pair = makePair('rL', 'r', 'l', 'rake', 'lake');
  // Progress key is for a different category ('Spanish')
  const progress = {
    [`Spanish__rL__rake_lake`]: {
      attempts: [makeAttempt(true), makeAttempt(false), makeAttempt(false)],
    },
  };
  const result = computePracticeNextRecommendation(progress, [pair], cat);
  assert.strictEqual(result, null);
});

runTest('does not divide by zero when a group has an empty attempts array', () => {
  const cat = 'Japanese';
  const pair = makePair('rL', 'r', 'l', 'rake', 'lake');
  const progress = {
    [pairId(cat, pair)]: { attempts: [] },
  };
  // Empty array → no crash, returns null
  assert.doesNotThrow(() => {
    const result = computePracticeNextRecommendation(progress, [pair], cat);
    assert.strictEqual(result, null);
  });
});

console.log('\nAll recommendNextPractice tests passed.');
```

- [ ] **Step 1.2: Run the tests — confirm they fail with "module not found" or similar**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && npm run test
```

Expected: error that `app/utils/recommendNextPractice.ts` does not exist (the test file is discovered and fails to load the module).

---

### Task 2: Implement `computePracticeNextRecommendation`

**Files:**
- Create: `app/utils/recommendNextPractice.ts`

- [ ] **Step 2.1: Create the helper**

```typescript
// app/utils/recommendNextPractice.ts
import type { Pair } from '@/app/constants/minimalPairs';
import type { PairAttempt, PairStats } from '@/app/storage/progressStorage';

export interface PracticeNextRecommendation {
  groupId: string;
  label: string;       // e.g. "/r/ vs /l/"
  recentAccuracy: number; // 0–1
}

// A group needs at least this many total attempts before it is considered.
// Prevents a single unlucky first attempt from dominating.
const MIN_GROUP_ATTEMPTS = 3;

// Number of most-recent attempts used to compute group accuracy,
// consistent with getWeightedAccuracy in progressStorage.ts.
const RECENT_ATTEMPT_COUNT = 20;

/**
 * Returns the contrast group with the lowest recent accuracy, or null when
 * there is not enough data. Scope is limited to the currently selected category.
 *
 * Pair ID format mirrors buildPairId in idHelpers.ts:
 *   `${category}__${group}__${word1}_${word2}`
 */
export function computePracticeNextRecommendation(
  progress: Record<string, PairStats>,
  pairs: Pair[],
  category: string
): PracticeNextRecommendation | null {
  // ── 1. Aggregate attempts by group for the current category ──────────────
  type GroupData = {
    attempts: PairAttempt[];
    cp1: string;
    cp2: string;
  };
  const byGroup = new Map<string, GroupData>();

  for (const pair of pairs) {
    // Must match buildPairId in idHelpers.ts exactly.
    const id = `${category}__${pair.group}__${pair.word1}_${pair.word2}`;
    const stats = progress[id];
    if (!stats?.attempts?.length) continue;

    const existing = byGroup.get(pair.group);
    if (existing) {
      existing.attempts.push(...stats.attempts);
    } else {
      byGroup.set(pair.group, {
        attempts: [...stats.attempts],
        cp1: pair.contrastPhoneme1,
        cp2: pair.contrastPhoneme2,
      });
    }
  }

  // ── 2. Filter groups below the minimum attempt threshold ─────────────────
  const eligible: Array<{ groupId: string; accuracy: number; cp1: string; cp2: string }> = [];

  for (const [groupId, data] of byGroup) {
    if (data.attempts.length < MIN_GROUP_ATTEMPTS) continue;

    // Sort by timestamp descending and take the most recent N attempts.
    const sorted = [...data.attempts].sort((a, b) => b.timestamp - a.timestamp);
    const recent = sorted.slice(0, RECENT_ATTEMPT_COUNT);
    const correct = recent.filter((a) => a.isCorrect).length;
    const accuracy = correct / recent.length;

    eligible.push({ groupId, accuracy, cp1: data.cp1, cp2: data.cp2 });
  }

  if (eligible.length === 0) return null;

  // ── 3. Find lowest accuracy; deterministic alphabetical tie-break ─────────
  eligible.sort((a, b) => {
    if (a.accuracy !== b.accuracy) return a.accuracy - b.accuracy;
    return a.groupId.localeCompare(b.groupId);
  });

  const { groupId, accuracy, cp1, cp2 } = eligible[0];
  return {
    groupId,
    label: `/${cp1}/ vs /${cp2}/`,
    recentAccuracy: accuracy,
  };
}
```

- [ ] **Step 2.2: Run the tests — confirm they pass**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && npm run test
```

Expected: all tests pass including the new `recommendNextPractice` tests.

- [ ] **Step 2.3: Run typecheck**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && npm run typecheck
```

Expected: no errors.

- [ ] **Step 2.4: Commit**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && git add app/utils/recommendNextPractice.ts scripts/recommendNextPractice.test.js && git commit -m "feat: add computePracticeNextRecommendation helper and tests"
```

---

### Task 3: Add translation keys

**Files:**
- Modify: `app/constants/translationKeys.ts`
- Modify: `app/constants/alternateLanguages.ts`

- [ ] **Step 3.1: Add keys to `translationKeys.ts`**

In `app/constants/translationKeys.ts`, append three keys inside the `tKeys` object before the closing `} as const`:

```typescript
  // Practice This Next nudge (Results screen)
  practiceThisNext: 'practiceThisNext',
  practiceThisNextReason: 'practiceThisNextReason',
  practiceThisNextEmpty: 'practiceThisNextEmpty',
```

The full updated `tKeys` object ends with:

```typescript
  onboardingBullet5: 'onboardingBullet5',
  // Practice This Next nudge (Results screen)
  practiceThisNext: 'practiceThisNext',
  practiceThisNextReason: 'practiceThisNextReason',
  practiceThisNextEmpty: 'practiceThisNextEmpty',
} as const;
```

- [ ] **Step 3.2: Add English values to `englishTranslations` in `alternateLanguages.ts`**

In `app/constants/alternateLanguages.ts`, append to the `englishTranslations` object before its closing `} as const`:

```typescript
    practiceThisNext: 'Practice this next',
    practiceThisNextReason: 'Your recent accuracy is lower here.',
    practiceThisNextEmpty: 'Practice a few pairs to get a recommendation.',
```

The surrounding context:

```typescript
    onboardingBullet5: 'No microphone needed.',
    practiceThisNext: 'Practice this next',
    practiceThisNextReason: 'Your recent accuracy is lower here.',
    practiceThisNextEmpty: 'Practice a few pairs to get a recommendation.',
  } as const;
```

- [ ] **Step 3.3: Add the three keys to all 14 non-English language blocks**

Because `TranslationSchema = Record<keyof typeof englishTranslations, string>`, every entry in `alternateLanguages` must include all keys. Add the English strings as fallback values to each of the 14 non-English language blocks. Each block already ends with an `onboardingBullet5` entry — append the three keys after it:

For every block from `日本語` through `Tiếng Việt`, add:

```typescript
    practiceThisNext: 'Practice this next',
    practiceThisNextReason: 'Your recent accuracy is lower here.',
    practiceThisNextEmpty: 'Practice a few pairs to get a recommendation.',
```

The 14 non-English blocks begin with these keys (grep for `home:` to find each block start):
`日本語`, `Español`, `Português`, `中文 (普通话)`, `한국어`, `Русский`, `العربية`, `हिन्दी / اردو`, `Bahasa Indonesia`, `ภาษาไทย`, `Türkçe`, `فارسی`, `粤语 (廣東話)`, `Tiếng Việt`

- [ ] **Step 3.4: Run typecheck to confirm no missing-key errors**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && npm run typecheck
```

Expected: no errors. If TypeScript reports missing keys on any language block, it means a block was missed in Step 3.3 — fix it before continuing.

- [ ] **Step 3.5: Commit**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && git add app/constants/translationKeys.ts app/constants/alternateLanguages.ts && git commit -m "i18n: add practiceThisNext translation keys with English fallback for all language blocks"
```

---

### Task 4: Add the recommendation card to the Results screen

**Files:**
- Modify: `app/(tabs)/results.tsx`

- [ ] **Step 4.1: Import the helper**

Add to the existing imports in `app/(tabs)/results.tsx`:

```typescript
import { computePracticeNextRecommendation } from '@/app/utils/recommendNextPractice';
```

Place it after the existing utility imports (after the `buildPairId` import line).

- [ ] **Step 4.2: Compute the recommendation via `useMemo`**

Add the following `useMemo` block inside `ResultsScreen`, after the existing `flattenedPairs` memo and before the `renderItem` callback:

```typescript
  const recommendation = useMemo(
    () => computePracticeNextRecommendation(progress, catObj?.pairs ?? [], selectedCategoryName ?? ''),
    [progress, catObj, selectedCategoryName]
  );
```

- [ ] **Step 4.3: Add the card to the JSX**

In the `return` block, insert the card **between** the closing `</View>` of the mastery summary card and the opening `<View style={{ flex: 1, paddingHorizontal: 16 }}>` of the FlashList wrapper.

Replace this section:

```tsx
        {/* Mastery Summary Card */}
        <View style={[styles.masterySummaryCard, { marginHorizontal: 16 }]}>    
          <View style={styles.masterySummaryItem}>
            <Text style={styles.masterySummaryValue}>
              {masterySummary.masteredGroups} / {masterySummary.totalGroups}
            </Text>
            <Text style={styles.masterySummaryLabel}>
              {translate(tKeys.pairsMastered)}
            </Text>
          </View>
          <View style={styles.masterySummaryItem}>
            <Text style={styles.masterySummaryValue}>
              {masterySummary.completedLevels} / {masterySummary.totalLevels}
            </Text>
            <Text style={styles.masterySummaryLabel}>
              {translate(tKeys.levelsCompleted)}
            </Text>
          </View>
        </View>
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
```

With:

```tsx
        {/* Mastery Summary Card */}
        <View style={[styles.masterySummaryCard, { marginHorizontal: 16 }]}>    
          <View style={styles.masterySummaryItem}>
            <Text style={styles.masterySummaryValue}>
              {masterySummary.masteredGroups} / {masterySummary.totalGroups}
            </Text>
            <Text style={styles.masterySummaryLabel}>
              {translate(tKeys.pairsMastered)}
            </Text>
          </View>
          <View style={styles.masterySummaryItem}>
            <Text style={styles.masterySummaryValue}>
              {masterySummary.completedLevels} / {masterySummary.totalLevels}
            </Text>
            <Text style={styles.masterySummaryLabel}>
              {translate(tKeys.levelsCompleted)}
            </Text>
          </View>
        </View>

        {/* Practice This Next Card */}
        <View
          style={[
            styles.masterySummaryCard,
            { marginHorizontal: 16, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' },
          ]}
          accessibilityRole="text"
          accessibilityLabel={
            recommendation
              ? `${translate(tKeys.practiceThisNext)}: ${recommendation.label}. ${translate(tKeys.practiceThisNextReason)}`
              : translate(tKeys.practiceThisNextEmpty)
          }
        >
          <Text style={styles.masterySummaryLabel}>
            {translate(tKeys.practiceThisNext)}
          </Text>
          {recommendation ? (
            <>
              <Text style={[styles.masterySummaryValue, { marginTop: 4 }]}>
                {recommendation.label}
              </Text>
              <Text style={[styles.masterySummaryLabel, { marginTop: 4 }]}>
                {translate(tKeys.practiceThisNextReason)}
              </Text>
            </>
          ) : (
            <Text style={[styles.masterySummaryLabel, { marginTop: 4 }]}>
              {translate(tKeys.practiceThisNextEmpty)}
            </Text>
          )}
        </View>

        <View style={{ flex: 1, paddingHorizontal: 16 }}>
```

- [ ] **Step 4.4: Run typecheck**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && npm run typecheck
```

Expected: no errors. If TypeScript reports unknown `tKeys` properties, confirm Task 3 changes are saved.

- [ ] **Step 4.5: Run lint**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && npm run lint
```

Expected: no errors or warnings introduced by the new code.

- [ ] **Step 4.6: Run tests**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && npm run test
```

Expected: all tests pass.

- [ ] **Step 4.7: Commit**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && git add app/(tabs)/results.tsx && git commit -m "feat: add Practice This Next recommendation card to Results screen"
```

---

### Task 5: Final verification

- [ ] **Step 5.1: Run the full verification suite**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && npm run test && npm run typecheck && npm run lint
```

Expected: all three commands exit with 0 errors.

- [ ] **Step 5.2: Confirm scope of diff**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && git diff main --name-only
```

Expected files changed (nothing else):
```
app/(tabs)/results.tsx
app/constants/alternateLanguages.ts
app/constants/translationKeys.ts
app/utils/recommendNextPractice.ts
scripts/recommendNextPractice.test.js
```

If any file outside this list appears, investigate before finishing.

- [ ] **Step 5.3: Verify no changes to protected files**

```bash
cd /Users/jonathanfreed/Documents/Development/english-minimal-pairs && git diff main -- app/domain/practiceSession.ts app/domain/masteryPersistence.ts app/storage/progressStorage.ts app/context/PairProgressContext.tsx app/components/OnboardingScreen.tsx
```

Expected: no output (none of these files changed).

---

## Success Criteria Checklist

| Criterion | Covered by |
|-----------|-----------|
| Recommendation shown when there is enough progress data | Task 2 helper + Task 4 card |
| Recommendation derived from existing local progress | Task 2 — reads `PairProgressContext` snapshot |
| Simple, explainable heuristic | Task 2 — lowest recent accuracy, ≥3 attempts |
| Empty/no-data states handled gracefully | Task 4 card — shows neutral empty text |
| No backend, analytics, accounts, or new adaptive algorithm | Verified by scope check in Task 5 |
| Existing behavior unchanged | Verified by Task 5.3 |
| Tests cover recommendation helper logic | Task 1 — 7 cases |
| npm run test / typecheck / lint pass | Task 5.1 |
