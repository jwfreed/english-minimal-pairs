# APP-020b Contrast-First Practice Header Design

## Goal

Make the practice screen read as contrast-first: the active contrast is the lesson target, while the current word pair remains the answer stimulus.

## Context

APP-019 added the pure within-contrast scheduler. APP-020a wired that scheduler into the practice flow. APP-020b must not change scheduler behavior, practice progression, mastery logic, persistence, audio/TTS behavior, or pair data.

The current practice screen still visually leads with word-pair selection. The main header says "Practice Word Pairs", and the pair picker accessibility label says "Select word pair". That makes the pair feel like the lesson target even though the scheduler now chooses trials within an active contrast.

## Approved UX Direction

Use this hierarchy on the default practice surface:

```text
Practice

Train /r/ vs /l/
Listen for the sound difference.

[Play Audio]

Which word did you hear?

[right]        [light]

Try a specific pair
right (/raɪt/) - light (/laɪt/)
```

The contrast title and instruction are primary. The listen control and answer buttons remain the main task. The pair picker stays available as a secondary manual override, placed below the listen-and-answer flow unless the existing component structure makes that too large for this PR.

## Scope

In scope:

- Change the top practice title from "Practice Word Pairs" to "Practice".
- Add a readable active-contrast header inside the practice card.
- Add the short instruction "Listen for the sound difference."
- Add "Which word did you hear?" above the answer buttons.
- Reframe the pair picker as "Try a specific pair" and update its accessibility label.
- Keep the manual picker behavior as a one-round override.
- Add a small pure helper for deriving the contrast label if needed.
- Add pure tests for the helper if it is introduced.

Out of scope:

- Scheduler, progression, mastery, or persistence changes.
- Pair data shape changes.
- New navigation, drawers, contrast browsers, compare mode, onboarding, analytics, dependencies, or website/SEO work.
- Broad component decomposition or style refactors.
- Audio/TTS behavior changes.

## Contrast Label Derivation

Derive the visible label from existing pair data:

1. Prefer `contrastPhoneme1` and `contrastPhoneme2` from the active pair.
2. Render a compact title as `Train /{phoneme1}/ vs /{phoneme2}/`.
3. Normalize contrast phonemes before rendering. If the source value already includes leading or trailing slashes, strip them before applying display slashes so the title is `Train /r/ vs /l/`, not `Train //r// vs //l//`.
4. If either phoneme is missing after normalization, fall back to a readable group label derived from `pair.group`.
5. If no pair is selected, render a safe generic fallback such as `Train this contrast`.

This avoids new data fields and avoids a hard-coded group map. It also keeps IPA secondary: the title may use IPA-like slashes because the existing data already stores contrast phonemes, but no explanatory phonetics are added.

## Component Design

`app/(tabs)/index.tsx` remains the orchestration point for the practice screen. It should compute the contrast label from `selectedPair` and pass the existing handlers unchanged.

`app/components/practice/PracticePairSelector.tsx` remains responsible for loading state and rendering `PairPicker`. It can render the secondary label "Try a specific pair" above the picker, or receive a label prop if that keeps the parent clearer.

`app/components/PairPicker.tsx` keeps its current picker behavior and item labels. Its accessibility label changes from "Select word pair" to "Try a specific pair" or an equivalent phrase that communicates a manual override instead of the primary lesson target.

`app/components/AnswerButtons.tsx` keeps answer behavior unchanged. It can render "Which word did you hear?" above the button row, or receive a prompt prop if that avoids hard-coding copy.

`app/constants/styles.ts` receives only local styles needed for the contrast header, answer prompt, and secondary picker label. Touch targets must not shrink.

`LevelIndicator` belongs with the active contrast header, not with the pair picker, because mastery is group-based. If it remains visible, place it near the contrast title and instruction or between the instruction and `Play Audio`.

## Data Flow

The selected pair and active group flow stays unchanged:

- `visible` still comes from `useContrastPairs`.
- `activeGroup`, `pairIndex`, `safePairIndex`, and `selectedPair` keep their current meaning.
- `handlePlay` still calls `selectNextTrialPair` for scheduler-driven selection.
- `handlePairChange` still sets `manualPairOverrideRef.current = true` for the next round.
- `AnswerButtons` still receives the rendered `selectedPair`.

Only presentation changes are added around this flow.

## Accessibility

- The contrast title is normal text and screen-reader readable.
- The pair picker accessibility label must not say "Select word pair".
- Answer buttons keep their existing accessible labels and hints.
- The UI must not rely on color alone to communicate the active contrast.
- Existing button and picker touch targets must remain unchanged or become larger.

## Testing

If a contrast-label helper is added, add a pure Node test loaded through `scripts/load-ts-module.js`.

Test cases:

- Returns `Train /r/ vs /l/` for a pair with `contrastPhoneme1: 'r'` and `contrastPhoneme2: 'l'`.
- Returns a readable fallback for a pair with missing phoneme values and a group key.
- Returns `Train this contrast` when no pair is selected.

No React Native UI test framework should be added for APP-020b.

Manual QA after implementation:

1. Practice screen shows the active contrast as the lesson target.
2. Current answer pair still displays correctly.
3. Listen/play still uses the rendered selected pair.
4. Answer checking still works.
5. Scheduler still advances within the active group.
6. Manual pair picker still works as a one-round override.
7. Category/group changes still reset scheduler state.
8. Screen-reader labels are coherent.
9. No console errors on reload.

## Implementation Preference

The smallest safe implementation is preferred:

- Add the label helper only if inline derivation would make `index.tsx` unclear.
- Move the existing `PracticePairSelector` below `AnswerButtons` if that is a small JSX reorder with no behavior changes.
- Keep `LevelIndicator` near the contrast header or between instruction and listen control so progress reads as group-based contrast progress, not pair-picker state.
- Do not introduce generic abstractions.
