# Truthful Session Progress Reward Design

## Goal

Preserve a satisfying correct-answer reward without making the daily-goal bar display practice time that has not elapsed.

## Current behavior and cause

The practice screen converts correct-answer feedback into `PROGRESS_SURGE_FRACTION` and passes it through `PracticeHeader` as `progressBoost`. `SessionTimer` adds that transient fraction to `elapsedToday / goalSeconds`, so the bar temporarily advances while the adjacent time label remains based only on `elapsedToday`.

Timer ticking, idle handling, and persistence do not depend on `progressBoost`. The mismatch is confined to the presentation path and progress-width calculation.

## Approved design

Remove the `progressBoost` contract and `PROGRESS_SURGE_FRACTION`. The bar fill width will be calculated only as `Math.min(elapsedToday / goalSeconds, 1)`.

Replace the artificial width advance with a brief vertical pulse of the existing whole progress bar while correct-answer feedback is visible. Scaling the track and fill together only on the vertical axis preserves their exact quantitative ratio. The pulse will use the established Reanimated CSS motion-token pattern and will not run when `useReducedMotion()` is true.

The practice screen will pass a presentation-only correct-feedback boolean through `PracticeHeader` to `SessionTimer`. This boolean may select the pulse animation but must never enter the progress calculation.

## Component and data flow

- `app/(tabs)/index.tsx` maps `feedback === 'correct'` to a visual reward prop and no longer imports or computes a progress fraction.
- `src/components/practice/PracticeHeader.tsx` forwards that visual-only prop to `SessionTimer`.
- `src/components/SessionTimer.tsx` derives fill width exclusively from elapsed time and applies the pulse to the whole bar only when requested and motion is allowed.
- `src/constants/motion.ts` replaces the obsolete surge fraction with a small reusable bar-pulse animation token.

No new state, component, dependency, or animation system is introduced.

## Testing

Update the existing practice UI source-contract tests to prove:

1. The old `progressBoost` and `PROGRESS_SURGE_FRACTION` contracts are absent.
2. Progress is calculated only from `elapsedToday / goalSeconds` and clamped at the goal.
3. Correct feedback requests the visual reward without supplying any quantitative value.
4. The bar pulse is applied to the existing whole bar and is guarded by `!reduceMotion`.
5. Existing timer motion and mastery truthfulness contracts remain covered.

Run the targeted practice UI test for the red-green cycle, then run `npm test`, `npm run check`, and `git diff --check`.

## Scope constraints

The implementation may modify only the practice screen, `PracticeHeader`, `SessionTimer`, the shared motion tokens, and the related practice UI source-contract test unless verification exposes a directly related issue. It must not change timer ticking, idle timeout, persistence, mastery, scheduling, domain data, or unrelated UI.

## Risks

Source-contract tests validate wiring and calculation semantics but do not render the animation. A physical-device check remains useful to confirm that the vertical pulse feels appropriately subtle and renders consistently on iOS and Android. Reduced-motion behavior is statically protected by the existing component guard.
