# ContrastKnowledge Practice Suggestion Design

## Purpose

Add the first learner-facing `ContrastKnowledge` consumer as one narrow,
advisory suggestion on the Practice screen. The feature remains disabled by
default, preserves learner choice, and describes only observational coverage.
It does not infer ability, mastery, weakness, retention, priority, or practice
timing.

Decisions 001–017 remain authoritative. In particular, Contrast identity is
language-scoped, the full pair-progress projection owns completeness,
`ContrastKnowledge` is observational rather than evaluative, and
`CONTRAST_MASTERY_ROLLOUT_STATE` remains `disabled`.

## Scope

The vertical slice adds:

- `src/domain/practice/nextContrastSuggestion.ts`, a pure feature-local rule;
- `src/hooks/useNextContrastSuggestion.ts`, the React/context adapter;
- `src/components/practice/NextContrastSuggestion.tsx`, presentation and an
  explicit learner action;
- behavioral, type, completeness, localization, and UI source-contract tests;
- one false-by-default boolean feature flag;
- three localized copy keys, with English placeholders where authoritative
  translations are unavailable;
- one accepted architecture decision recording the policy and rollout
  follow-up.

The slice does not add persistence, analytics, navigation, autoplay, a generic
learning-policy layer, or changes to the legacy Results recommender.

## Product policy

The practice feature owns
`PRODUCT_SUFFICIENCY_MINIMUM_ATTRIBUTED_ATTEMPTS = 6`:

- zero attributed attempts is `unobserved`;
- one through five attributed attempts is `insufficient`;
- six or more attributed attempts is `observed`.

This threshold is observational coverage only. It is intentionally independent
from the developer-only `CONTRAST_KNOWLEDGE_INSPECTION_MINIMUM` and has no
mastery, ability, retention, scheduling, strength, or due-status meaning.

## Pure suggestion boundary

`getNextContrastSuggestion(...)` accepts the whole
`ContrastPairProgressProjection`, the resolved active `LanguageId`, the
resolved current `ContrastId` or `undefined`, an explicit evaluation timestamp,
and an explicit positive minimum. It calls `inspectContrastKnowledge` itself,
passing `projection` and the canonical `contrastRegistry` as unchanged bare
identifiers.

It returns only:

```ts
type ContrastPracticeSuggestion =
  | { readonly kind: 'continue-current'; readonly contrastId: ContrastId }
  | { readonly kind: 'try-unobserved'; readonly contrastId: ContrastId }
  | null;
```

The rule applies this precedence:

1. Any `indeterminate` entry returns `null`.
2. An unresolved current identity, a registry/language ownership mismatch, or
   a current identity missing from the inspection returns `null`.
3. A current `insufficient` entry returns `continue-current`.
4. Otherwise, the first stable-order `unobserved` entry other than the current
   identity returns `try-unobserved`.
5. Otherwise, return `null`.

Correctness, recency, timestamps, mastery, speed, streak, duration, scores, and
rankings do not participate in the decision. Invalid minimum and timestamp
inputs retain the existing domain validation behavior rather than being
silently normalized.

## Adapter and data flow

`useNextContrastSuggestion(currentGroup)` reads the existing pair-progress,
category, and language contexts. It obeys this order inside its derived-value
calculation:

1. If `CONTRAST_PRACTICE_SUGGESTION_ENABLED` is false, return `null` before
   projection or inspection.
2. If pair progress is loading, return `null` before projection.
3. Require the category and language contexts to identify the same current
   category; otherwise return `null`.
4. Resolve `LanguageId` and current `ContrastId` through
   `historicalIdentityMapping` without a throwing resolver.
5. Build the whole projection with `projectPairProgressToContrasts(progress)`.
6. Call the pure rule with `Date.now()` as its explicit evaluation instant and
   the product minimum of six.
7. Catch projection or inspection failures and return `null` without retaining
   a stale suggestion.

The hook has no policy precedence or candidate-selection logic. With the flag
off it performs zero projection and inspection work.

## Practice presentation and selection

`NextContrastSuggestion` receives the suggestion and an explicit selection
callback. It resolves the canonical Contrast definition by `ContrastId`,
builds the phoneme-pair display label from that definition, and returns `null`
for no suggestion or an unknown identity.

The Practice screen renders the component next to `PracticePairSelector`
inside the existing `feedback === null` block. On tap, the screen maps the
suggested Contrast's compatibility `legacyGroup` to an existing visible pair
and invokes `handlePairChange`, preserving the current manual-selection
lifecycle. The component does not navigate, auto-select, autoplay, hide
choices, or interrupt feedback.

Copy is observational and advisory:

- eyebrow: `Suggested next`;
- continue current: `Just a few tries recorded here so far.`;
- try unobserved: `You haven't tried {contrastLabel} yet.`.

No learner-facing copy uses weakness, strength, mastery, review, due, struggle,
obligation, or streak language.

## Failure behavior

The feature renders nothing for loading evidence, projection or inspection
failure, global incompleteness, unresolved category/language/current identity,
wrong-language current identity, a current identity absent from inspection, an
unknown presentation identity, an unavailable selectable pair, or no eligible
unobserved candidate. Errors never fall back to cached or stale suggestions.

## Testing

Behavior tests cover incomplete evidence, all precedence cases, current-ID
exclusion, unresolved and wrong-language identities, stable ordering, the
0/1/5/6/7 threshold boundary, outcome and timestamp invariance, domain
validation, and the pure module's no-storage boundary.

Type tests protect exhaustive narrowing and ensure only actionable variants
expose `contrastId`. Completeness contracts add the new approved inspection
caller without weakening bare-identifier forwarding. Hook/UI source contracts
prove flag-off zero work, loading-before-projection, placement inside the
no-feedback block, presentation-only dependencies, and absence of navigation
or autoplay. Localization contracts require all locales to carry matching
placeholders.

Targeted tests run first, followed by lint, type checking, the full
`npm run check` gate, `git diff --check`, and manual diff/protected-file review.

## Architecture record and rollout follow-up

An accepted decision records the product minimum of six and its narrow
observational meaning. It also records this required follow-up:

> Review and reconcile the legacy accuracy-based Results recommender before
> broad rollout of the new ContrastKnowledge-based recommendation.

The follow-up does not block this disabled slice. It does block treating two
independent learner-facing recommendation semantics as settled architecture or
enabling the new feature broadly.

## Remaining risk

Global completeness is intentionally conservative: malformed or unmapped
evidence from any language suppresses the active-language suggestion. English
placeholder copy in non-English locale entries requires human localization
review before the flag is enabled for those audiences. The feature flag and
legacy recommender isolation keep both risks dormant in the shipped default
state.
