# APP-020b Contrast-First Header Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the practice screen visually frame the active contrast as the lesson target while preserving scheduler-driven word-pair trials.

**Architecture:** Add one pure helper for the display title, cover it with the existing Node test harness, then make small presentation changes in the existing practice screen components. `index.tsx` keeps orchestration and scheduler flow; `PracticePairSelector`, `PairPicker`, and `AnswerButtons` keep their current behavior with copy/layout adjustments only.

**Tech Stack:** Expo Router, React Native, TypeScript, Node `assert` tests via `scripts/run-tests.js`, existing RTK command wrapper.

---

## File Structure

- Create: `utils/contrastLabel.ts`
  - Pure display helper for contrast title derivation and slash normalization.
- Create: `scripts/contrastLabel.test.js`
  - Node tests for readable labels, slash normalization, group fallback, and no-pair fallback.
- Modify: `app/(tabs)/index.tsx`
  - Use `buildContrastTrainingTitle`, change top title to `Practice`, add contrast header/instruction, keep `LevelIndicator` near the contrast, move picker below answers.
- Modify: `app/components/practice/PracticePairSelector.tsx`
  - Add secondary label text above the picker and accept styles for it.
- Modify: `app/components/PairPicker.tsx`
  - Change accessibility label from `Select word pair` to `Try a specific pair`.
- Modify: `app/components/AnswerButtons.tsx`
  - Add the prompt `Which word did you hear?` above the answer row without changing answer behavior.
- Modify: `app/constants/styles.ts`
  - Add local styles for contrast header, instruction, answer prompt, and secondary picker label.

### Task 1: Contrast Label Helper

**Files:**
- Create: `utils/contrastLabel.ts`
- Create: `scripts/contrastLabel.test.js`

- [ ] **Step 1: Write the failing helper tests**

Create `scripts/contrastLabel.test.js`:

```javascript
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const { buildContrastTrainingTitle } = loadTsModule(
  path.join(__dirname, '..', 'utils', 'contrastLabel.ts')
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

const makePair = (overrides = {}) => ({
  word1: 'right',
  word2: 'light',
  ipa1: '/raɪt/',
  ipa2: '/laɪt/',
  difficulty: 1,
  group: 'rL',
  position: 'initial',
  contrastPhoneme1: 'r',
  contrastPhoneme2: 'l',
  ...overrides,
});

runTest('buildContrastTrainingTitle renders phoneme contrast labels', () => {
  assert.strictEqual(buildContrastTrainingTitle(makePair()), 'Train /r/ vs /l/');
});

runTest('buildContrastTrainingTitle normalizes source values with slashes', () => {
  assert.strictEqual(
    buildContrastTrainingTitle(makePair({ contrastPhoneme1: '/r/', contrastPhoneme2: '/l/' })),
    'Train /r/ vs /l/'
  );
});

runTest('buildContrastTrainingTitle falls back to readable group labels', () => {
  assert.strictEqual(
    buildContrastTrainingTitle(makePair({ contrastPhoneme1: '', contrastPhoneme2: ' ', group: 'iVsI' })),
    'Train i Vs I'
  );
});

runTest('buildContrastTrainingTitle handles missing pairs safely', () => {
  assert.strictEqual(buildContrastTrainingTitle(undefined), 'Train this contrast');
});

console.log('\nAll contrastLabel tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `rtk npm test`

Expected: FAIL because `utils/contrastLabel.ts` does not exist or `buildContrastTrainingTitle` is not exported.

- [ ] **Step 3: Implement the helper**

Create `utils/contrastLabel.ts`:

```typescript
import type { Pair } from '@/app/constants/minimalPairs';

const DEFAULT_CONTRAST_TITLE = 'Train this contrast';

function normalizePhonemeForDisplay(value: string | undefined): string {
  return (value ?? '').trim().replace(/^\/+|\/+$/g, '').trim();
}

function formatGroupFallback(group: string | undefined): string {
  const compact = (group ?? '').trim();
  if (!compact) return DEFAULT_CONTRAST_TITLE;
  const spaced = compact
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Za-z])(\d)/g, '$1 $2')
    .replace(/(\d)([A-Za-z])/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim();
  return spaced ? `Train ${spaced}` : DEFAULT_CONTRAST_TITLE;
}

export function buildContrastTrainingTitle(pair: Pair | undefined): string {
  if (!pair) return DEFAULT_CONTRAST_TITLE;

  const first = normalizePhonemeForDisplay(pair.contrastPhoneme1);
  const second = normalizePhonemeForDisplay(pair.contrastPhoneme2);
  if (first && second) {
    return `Train /${first}/ vs /${second}/`;
  }

  return formatGroupFallback(pair.group);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `rtk npm test`

Expected: PASS, including `contrastLabel.test.js`.

- [ ] **Step 5: Commit**

```bash
rtk git add utils/contrastLabel.ts scripts/contrastLabel.test.js
rtk git commit -m "feat: add contrast training label helper"
```

### Task 2: Practice Screen Framing

**Files:**
- Modify: `app/(tabs)/index.tsx`
- Modify: `app/constants/styles.ts`

- [ ] **Step 1: Add the contrast title calculation**

Modify imports in `app/(tabs)/index.tsx`:

```typescript
import { buildContrastTrainingTitle } from '@/utils/contrastLabel';
```

Add after `selectedPair` is computed:

```typescript
  const contrastTrainingTitle = useMemo(
    () => buildContrastTrainingTitle(selectedPair),
    [selectedPair]
  );
```

- [ ] **Step 2: Add local styles**

Add these style entries in `app/constants/styles.ts` near the practice/card styles:

```typescript
    contrastHeader: {
      width: '100%',
      alignItems: 'center' as const,
      marginBottom: 12,
    },
    contrastTitle: {
      fontSize: isTablet ? 34 : 24,
      fontWeight: '800' as const,
      color: colors.text,
      textAlign: 'center' as const,
    },
    contrastInstruction: {
      fontSize: isTablet ? 18 : 14,
      color: colors.textSecondary,
      textAlign: 'center' as const,
      marginTop: 4,
    },
```

- [ ] **Step 3: Reorder and reframe the practice card**

Replace the return content from `PracticeHeader` through the card body with this structure, preserving existing handlers and props:

```tsx
      <PracticeHeader
        title="Practice"
        onHelpPress={() => setIsHelpVisible(true)}
        primaryColor={theme.primary}
        styles={styles}
      />

      <SessionTimer timerRef={timerRef} />

      <View style={styles.mainCard}>
        <View
          style={styles.contrastHeader}
          accessibilityRole="header"
        >
          <Text style={styles.contrastTitle}>{contrastTrainingTitle}</Text>
          <Text style={styles.contrastInstruction}>
            Listen for the sound difference.
          </Text>
        </View>

        {selectedPair && (
          <LevelIndicator currentTier={mastery[selectedPair.group] ?? 1} showCriteria />
        )}

        <LevelUpCelebration
          promotedTier={promotedTier}
          label={translate(tKeys.levelUnlocked)}
          styles={styles}
        />

        <ListenControls
          label={playAudioText}
          onPlay={handlePlay}
          disabled={!audioModeReady || isSpeaking}
          styles={styles}
        />

        {selectedPair && (
          <AnswerButtons
            pair={selectedPair}
            onAnswer={handleAnswer}
            feedback={feedback}
            disabled={playedIdx === null || feedback !== null}
            playedIdx={playedIdx}
            onReplay={handleReplay}
          />
        )}

        <PracticePairSelector
          isLoading={isLoading}
          selectedPair={selectedPair}
          pairs={stableVisible}
          index={safePairIndex}
          onIndexChange={handlePairChange}
          color={theme.text}
          loadingTextColor={theme.textSecondary}
          styles={styles}
          onScrollStart={handlePickerScrollStart}
          onScrollEnd={handlePickerScrollEnd}
        />
      </View>
```

- [ ] **Step 4: Run focused verification**

Run: `rtk npm run typecheck`

Expected: PASS. If it fails because `PracticePairSelector` does not yet accept `styles`, leave this task uncommitted and complete Task 3 before rerunning.

### Task 3: Secondary Picker and Answer Prompt

**Files:**
- Modify: `app/components/practice/PracticePairSelector.tsx`
- Modify: `app/components/PairPicker.tsx`
- Modify: `app/components/AnswerButtons.tsx`
- Modify: `app/constants/styles.ts`

- [ ] **Step 1: Add picker and answer prompt styles**

Add these entries in `app/constants/styles.ts` near the new practice styles:

```typescript
    pickerOverrideContainer: {
      width: '100%',
      marginTop: 16,
      alignItems: 'center' as const,
    },
    pickerOverrideLabel: {
      fontSize: isTablet ? 18 : 14,
      fontWeight: '700' as const,
      color: colors.textSecondary,
      textAlign: 'center' as const,
      marginBottom: 4,
    },
    answerPrompt: {
      fontSize: isTablet ? 20 : 16,
      fontWeight: '700' as const,
      color: colors.text,
      textAlign: 'center' as const,
      marginBottom: 10,
    },
```

- [ ] **Step 2: Update `PracticePairSelector` to render a secondary label**

Modify `app/components/practice/PracticePairSelector.tsx`:

```tsx
import React from 'react';
import { Text, View } from 'react-native';
import PairPicker from '@/app/components/PairPicker';
import type { Pair } from '@/app/constants/minimalPairs';
import type { AppStyles } from '@/app/constants/styles';

type PracticePairSelectorStyles = Pick<
  AppStyles,
  'pickerOverrideContainer' | 'pickerOverrideLabel'
>;

interface PracticePairSelectorProps {
  isLoading: boolean;
  selectedPair: Pair | undefined;
  pairs: Pair[];
  index: number;
  onIndexChange: (index: number) => void;
  color: string;
  loadingTextColor: string;
  styles: PracticePairSelectorStyles;
  onScrollStart: () => void;
  onScrollEnd: () => void;
}

export default function PracticePairSelector({
  isLoading,
  selectedPair,
  pairs,
  index,
  onIndexChange,
  color,
  loadingTextColor,
  styles,
  onScrollStart,
  onScrollEnd,
}: PracticePairSelectorProps) {
  if (isLoading || !selectedPair) {
    return (
      <View
        style={{ height: 220, justifyContent: 'center', alignItems: 'center' }}
      >
        <Text style={{ color: loadingTextColor }}>Loading…</Text>
      </View>
    );
  }

  return (
    <View style={styles.pickerOverrideContainer}>
      <Text style={styles.pickerOverrideLabel}>Try a specific pair</Text>
      <PairPicker
        pairs={pairs}
        index={index}
        setIndex={onIndexChange}
        color={color}
        onScrollStart={onScrollStart}
        onScrollEnd={onScrollEnd}
      />
    </View>
  );
}
```

- [ ] **Step 3: Update picker accessibility copy**

In `app/components/PairPicker.tsx`, change:

```tsx
      accessibilityLabel="Select word pair"
```

to:

```tsx
      accessibilityLabel="Try a specific pair"
```

- [ ] **Step 4: Add answer prompt without changing answer behavior**

In `app/components/AnswerButtons.tsx`, insert the prompt immediately inside `styles.answerContainer` before `styles.buttonRow`:

```tsx
      <Text style={styles.answerPrompt}>Which word did you hear?</Text>
```

Update the styles type by relying on the existing `createStyles` inference; no prop changes are needed.

- [ ] **Step 5: Run verification**

Run:

```bash
rtk npm test
rtk npm run typecheck
```

Expected: both PASS.

- [ ] **Step 6: Commit**

```bash
rtk git add 'app/(tabs)/index.tsx' app/constants/styles.ts app/components/practice/PracticePairSelector.tsx app/components/PairPicker.tsx app/components/AnswerButtons.tsx
rtk git commit -m "feat: reframe practice around active contrast"
```

### Task 4: Final Verification and Manual QA Notes

**Files:**
- Modify only if a verification failure exposes a scoped APP-020b issue.

- [ ] **Step 1: Run required validation commands**

Run:

```bash
rtk git status --short
rtk git diff
rtk npm test
rtk npm run lint
rtk npm run typecheck
rtk npm run validate:data
```

Expected:

- Working tree clean after commits, or only intentional uncommitted changes if a final fix is still in progress.
- Tests, lint, typecheck, and data validation pass.
- Diff contains UI framing/helper/test/spec changes only.

- [ ] **Step 2: Manual QA checklist**

Record final manual QA notes in the completion response:

```text
Manual QA not run in simulator/device unless explicitly performed.
Code-level coverage checked:
1. Practice screen now renders active contrast as lesson target.
2. Current answer pair still comes from selectedPair in AnswerButtons.
3. Listen/play still receives selectedPair through useAudio and existing handlePlay.
4. Answer checking still uses applyPracticeAnswer with selectedPair.
5. Scheduler call sites selectNextTrialPair/advanceTrialCycleSeenIds are unchanged.
6. Manual picker still calls handlePairChange and manualPairOverrideRef.
7. Category reset effect is unchanged.
8. PairPicker accessibility label no longer says Select word pair.
```

- [ ] **Step 3: Final review**

Run:

```bash
rtk git log --oneline -3
rtk git status --short
```

Expected: branch contains the spec commit plus implementation commits, and no accidental `.superpowers/` or root-worktree files are staged.
