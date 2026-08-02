# Truthful Mastery Reward Design

## Goal

Preserve a satisfying correct-answer reward without making transient feedback look like durable mastery advancement.

## Current behavior and cause

The practice screen passes `previewNextTier={feedback === 'correct'}` to `LevelIndicator`. The component responds by filling the segment after `currentTier`, even though the mastery record and level label have not changed. Users can therefore read a correct-answer animation as an achieved mastery tier.

Durable mastery remains owned by the existing practice-session and contrast-pair flows. A real promotion updates mastery, sets `promotedTier`, clears ordinary answer feedback where required, and renders `LevelUpCelebration`. This design does not change that flow.

## Approved design

Replace the `previewNextTier` presentation contract with `highlightCurrentTier`.

When correct-answer feedback is visible, `LevelIndicator` may apply the existing pop animation to the segment represented by `currentTier`. It must not fill an empty segment. Both the number of filled segments and the displayed level label remain derived exclusively from `currentTier`.

The highlight is visual-only and must continue to skip animation when `useReducedMotion()` is true. Existing correct-answer rewards remain in place: success haptic and accessibility announcement, animated feedback panel and badge, and the temporary goal-bar surge.

## Component and data flow

- `app/(tabs)/index.tsx` maps `feedback === 'correct'` to `highlightCurrentTier` on the practice-screen indicator.
- `src/components/LevelIndicator.tsx` fills segments only when `tier <= currentTier`. If `highlightCurrentTier` is active, it animates only `tier === currentTier`, subject to reduced-motion preference.
- `src/components/practice/LevelUpCelebration.tsx` remains unchanged and continues to render its compact indicator from `promotedTier`.

No new state, service, abstraction, or progression concept is introduced.

## Testing

Update the existing practice UI contract tests to prove:

1. Correct feedback requests a current-tier highlight rather than a next-tier preview.
2. Segment fill remains based only on `tier <= currentTier`; the highlight targets `tier === currentTier`.
3. The highlight animation is guarded by the existing reduced-motion value.
4. The existing promotion route still passes `promotedTier` into `LevelUpCelebration`, which renders `LevelIndicator currentTier={promotedTier}`.

Run the targeted UI test first for the red-green cycle, followed by `npm test` and `npm run check`.

## Scope constraints

The implementation may modify only the practice screen, `LevelIndicator`, and the related presentation test unless verification exposes a directly related issue. It must not modify trial scheduling, practice-session scheduling logic, mastery calculations, adaptive progression, persistence, AsyncStorage handling, feature flags, migrations, or Phase 3.8 workstreams.

## Risks

The repository uses source-contract UI tests rather than a component-rendering test stack, so the regression coverage validates wiring and component semantics statically. A visual device check remains useful to judge the perceived strength of the current-tier pop, but correctness does not depend on that subjective tuning.
