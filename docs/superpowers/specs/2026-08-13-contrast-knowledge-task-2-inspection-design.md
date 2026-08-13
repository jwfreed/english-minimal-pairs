# ContrastKnowledge Task 2 Inspection Design

## Purpose

Add the smallest developer-only Settings inspection that answers whether
ContrastKnowledge produces useful, trustworthy information from real stored
device evidence. The surface is descriptive only and gives ContrastKnowledge
no learner-facing, adaptive, scheduling, mastery, persistence, analytics, or
recommendation authority.

Decision 017 remains authoritative. Unknown evidence is not weak evidence,
completeness is supplied by the full projection, sufficiency is caller-owned
policy, and recency is observational only.

## Scope

The implementation is a four-file vertical slice:

- `src/dev/contrastKnowledgeInspectionReport.ts`
- `src/dev/ContrastKnowledgeInspectionSection.tsx`
- `app/(tabs)/settings.tsx`
- `scripts/contrastKnowledgeInspectionSurface.test.js`

No route, tab registration, navigation file, persistence schema, storage key,
feature flag, domain semantics, or learner-facing flow changes.

## Pure report boundary

`buildContrastKnowledgeInspectionReport(...)` is pure and side-effect-free. It
accepts a supplied `ContrastPairProgressProjection`, active category label,
evaluation timestamp, and developer inspection minimum. It does not read
storage or the clock, import React Native, or mutate its inputs.

The builder resolves the category label only through
`historicalIdentityMapping.resolveCategoryLabel`. If exact canonical resolution
fails, it returns a discriminated `unavailable` result with an inspectable
reason and does not guess a language identity.

For a resolved language, the builder calls the existing
`inspectContrastKnowledge` with `contrastRegistry` unchanged. The resulting
available report exposes:

- `evidenceScope: 'GLOBAL'`;
- the resolved `LanguageId` and supplied category label;
- the supplied developer inspection minimum;
- completeness, unmapped entry count, malformed entry count, and malformed
  attempt count;
- `attributedRetainedAttemptCount`, sourced from the projection's mapped
  retained-attempt total;
- a descriptive census of the four standings, with no combined score or
  ranking;
- one row for every registered contrast in stable identity order.

Each row includes `ContrastId`, an existing phoneme-pair label from the
registry, and the Task 1 standing. `indeterminate` and `unobserved` rows do not
synthesize zero observation fields. `insufficient` and `observed` rows include
the attributed retained-attempt count, correct count, and recency exposed by
Task 1.

## Developer inspection policy

One fixed positive minimum lives in `src/dev/` as
`CONTRAST_KNOWLEDGE_INSPECTION_MINIMUM = 5`. Its comment states that it is
developer inspection policy only, not a ContrastKnowledge default and not a
learner, product, or adaptive threshold. The value is passed explicitly into
the pure report builder and displayed with each inspection so it cannot be
mistaken for hidden domain truth.

The constant is not imported by domain, learning, persistence, scheduling, or
learner-facing modules.

## Recency presentation

Positive observations expose recency in this shape:

```ts
recency: {
  elapsedMilliseconds: number;
  displayText: string;
}
```

`elapsedMilliseconds` is the authoritative raw signed observation.
`displayText` is deterministic presentation derived from that raw value. It
uses elapsed-time units without describing staleness, retention, forgetting,
review timing, or due-ness. Negative elapsed values remain negative in both
forms and are never clamped. The raw milliseconds remain visible alongside the
human-readable text, so presentation rounding cannot hide the observation.

## Async UI boundary

`ContrastKnowledgeInspectionSection` is the only async/UI layer. It receives
the active category label, reads the real projection through
`getContrastProgress()`, obtains the evaluation instant from `Date.now()`,
supplies the fixed developer minimum, and passes those inputs to the pure
builder.

The component renders three states:

- loading;
- read failure or unresolved-language unavailability;
- inspection report.

The report makes `Evidence scope: GLOBAL` explicit and explains that any
unmapped or malformed evidence anywhere in the projection makes completeness
unattested for the active-language inspection. It displays the global
diagnostics, attributed retained-attempt count, developer-only minimum,
standing census, and stable-order contrast rows. Copy identifies attempt counts
as retained evidence rather than lifetime totals and recency as observation
rather than interpretation.

The component performs no storage writes, emits no analytics, and imports no
mastery, scheduling, progression, or recommendation code.

## Settings integration

The existing Settings screen passes its current category label and renders the
section at the bottom through a direct guard:

```tsx
{__DEV__ && (
  <ContrastKnowledgeInspectionSection categoryLabel={currentCatKey} />
)}
```

The supported claim is only that the section cannot render when `__DEV__` is
false. The design does not claim that the static import is excluded from a
release bundle. No route, standalone screen, tab, or conditional navigation
registration is added.

## Error handling

Storage-read rejection produces a visible developer inspection error and no
fallback projection. Failed category resolution produces the report builder's
`unavailable` result and no guessed `LanguageId`. Existing Task 1 validation of
the positive minimum remains authoritative; the fixed local value is valid and
is always passed explicitly.

## Testing

`scripts/contrastKnowledgeInspectionSurface.test.js` follows the repository's
Node source-contract and TypeScript-loader conventions.

Behavior tests verify that:

- supplied projection, category label, evaluation instant, and minimum produce
  the expected available report;
- unresolved category labels fail closed;
- changing the supplied minimum changes the resulting standing through the
  explicit caller-policy path;
- changing only the instant changes only recency-derived output;
- raw signed milliseconds and signed human-readable text are both preserved,
  including negative elapsed values;
- the census contains counts only and produces no score or ranking.

Source-contract tests verify that:

- Settings directly guards the section with `__DEV__`;
- the UI reads only through `getContrastProgress()`;
- no inspection route or navigation registration is added;
- the new files introduce no storage writes or imports from mastery,
  scheduling, progression, recommendation, analytics, or feature flags;
- the inspection constant is confined to `src/dev/` and is not consumed by
  protected or learner-facing modules.

Tests protect boundaries without pinning irrelevant JSX formatting or
duplicating Task 1 standing-semantics coverage.

## Verification

Run the new inspection-surface test first, followed by existing
ContrastKnowledge, ContrastKnowledge inspection, pair-progress projection, and
progress-storage tests. Then run type checking, lint, `npm run check`, and
`git diff --check`. Finally inspect the diff, changed-file list, repository
status, protected-file diffs, and
`CONTRAST_MASTERY_ROLLOUT_STATE = 'disabled'`.

## Remaining interpretation limits

The production parser caps each pair's history and normalizes a non-array
attempt container to an empty retained history. Displayed counts are therefore
retained evidence, not lifetime totals, and one raw diagnostic reason is
already unrecoverable at the read-only boundary. Completeness remains global:
unrelated-language malformed or unmapped evidence can make every row for the
active language indeterminate. The surface must make both limits visible and
must not turn fixture results into release or scheduler recommendations.
