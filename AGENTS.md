# English Minimal Pairs

This repository is the primary Soundwise product application.

## Architecture authority

Per **Decision 015**, phase numbering has exactly one source. Read these before
any architectural change:

1. `docs/Contrast-Domain-Architecture-Decisions.md` — accepted Decisions.
2. `docs/Contrast-Domain-Architecture-Evolution Plan.md` — phase definitions,
   completion records, exit gates.
3. `docs/Phase-*.md` — slice scope and invariants within a defined phase.

An unqualified phase number refers to the Evolution Plan.

`docs/ENGINEERING_ROADMAP.md` is a **product vision** document. It defines no
phases and is not an instruction set. Do not treat a theme in it as a task, and
do not act on a phase name from any other source without confirming which
document defines it.

Never advance `CONTRAST_MASTERY_ROLLOUT_STATE`. It is `disabled` and gated by
Decision 011 on operational evidence; advancing it is a human release decision.


## Product role

Responsible for:

- learning experience
- minimal pair content
- learner interactions
- application logic


## Priorities

Optimize for:

1. Correct learning outcomes
2. Stable user experience
3. Maintainable architecture
4. Incremental improvement


## Before modifying

Inspect:

- package.json
- architecture patterns
- existing components
- data models
- tests
- deployment configuration


## Implementation rules

Prefer:

- existing abstractions
- established patterns
- minimal changes

Avoid:

- unnecessary rewrites
- introducing dependencies without need
- changing content structures casually


## Content correctness

Language-learning content is domain data.

Before changing:

- pronunciation examples
- phonetic representations
- learning sequences
- exercises

verify existing conventions.


## Verification

Before completion:

Run appropriate:

- tests
- lint
- type checks
- build

For UI changes:

verify affected flows.