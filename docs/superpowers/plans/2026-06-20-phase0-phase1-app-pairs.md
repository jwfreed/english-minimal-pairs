# Phase 0 Phase 1 App Pairs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strengthen targeted L1 minimal-pair inventories and validation for the Soundwise app without website or SEO page changes.

**Architecture:** Keep the existing `Pair` schema, category ordering, and group IDs. Permit multiple real-word examples at the same difficulty tier so already-full groups can be expanded, while mastery stays keyed by `group` and difficulty remains a 1-6 tier.

**Tech Stack:** React Native / Expo app data in TypeScript, Node-based validation scripts and tests.

---

### Repository Evidence

- Data source: `app/constants/minimalPairs/*.ts`, aggregated by `app/constants/minimalPairs.ts`.
- Pair contract: `word1`, `word2`, `ipa1`, `ipa2`, `difficulty`, `group`, `position`, `contrastPhoneme1`, `contrastPhoneme2`.
- Mastery contract: `app/domain/practiceSession.ts` and `app/hooks/useContrastPairs.ts` store mastery by `group`.
- Current validator: `scripts/validate-data.js` enforces exactly five groups and currently exactly one pair per tier in each group.
- Baseline commands passed before edits: `npm test`, `npm run lint`, `npm run typecheck`, `npm run validate:data`.

### Approach Options Considered

- Replace existing pairs to keep exactly six pairs per group: smallest model change, but loses inventory and contradicts app expansion.
- Add new contrast groups: rejected because the prompt forbids new L1 categories and discourages new groups.
- Add same-group examples and update validation/visibility: chosen because it preserves group IDs, preserves mastery keys, and makes the added inventory selectable.

### Task 1: Validation Contract Tests

**Files:**
- Modify: `scripts/validate-data.test.js`
- Modify later: `scripts/validate-data.js`

- [ ] **Step 1: Write failing validator tests**

Add tests that assert:
- duplicate same-direction word pairs within one L1 are rejected;
- reversed word pairs within one L1 are rejected;
- empty `group` and contrast phonemes are rejected;
- invalid difficulty values are rejected;
- each L1 category must contain at least one pair;
- groups may contain more than one pair at the same difficulty tier as long as all tiers 1-6 remain represented.

- [ ] **Step 2: Run validator tests and verify failure**

Run: `rtk node scripts/validate-data.test.js`

Expected: FAIL before implementation because reversed duplicates, category emptiness, and same-tier expansion support are missing or incompatible with the current validator.

- [ ] **Step 3: Update `scripts/validate-data.js`**

Implement:
- category pair arrays must be non-empty;
- pair words must differ;
- difficulty must be an integer in `1..6`;
- pair duplicate detection is scoped within each category and catches reversed duplicates;
- group tier coverage requires at least one pair for every tier, but no longer rejects multiple pairs at one tier.

- [ ] **Step 4: Re-run validator tests**

Run: `rtk node scripts/validate-data.test.js`

Expected: PASS.

### Task 2: Mastery Visibility Tests

**Files:**
- Modify: `scripts/practiceSession.test.js`
- Modify later: `app/domain/practiceSession.ts`

- [ ] **Step 1: Write failing test for same-tier examples**

Add a test proving `selectVisiblePairsByMastery` returns all pairs for a mastered group tier, not only the first matching pair.

- [ ] **Step 2: Run practice-session tests and verify failure**

Run: `rtk node scripts/practiceSession.test.js`

Expected: FAIL before implementation because the function currently returns one pair per group.

- [ ] **Step 3: Update `selectVisiblePairsByMastery`**

Return all pairs whose `difficulty` matches the group mastery tier, with the existing fallback to the first group pair when a tier is missing.

- [ ] **Step 4: Re-run practice-session tests**

Run: `rtk node scripts/practiceSession.test.js`

Expected: PASS.

### Task 3: Phase 1 Pair Additions

**Files:**
- Modify: `app/constants/minimalPairs/japanese.ts`
- Modify: `app/constants/minimalPairs/cantonese.ts`
- Modify: `app/constants/minimalPairs/korean.ts`
- Modify: `app/constants/minimalPairs/spanish.ts`

- [ ] **Step 1: Confirm exact pair presence before edit**

Use a repository data enumeration command to confirm requested pairs are absent or already present.

- [ ] **Step 2: Add only missing required pairs**

Add the missing examples to existing groups only:
- Japanese `rL`: `right/light`, `rice/lice`, `road/load`, `rip/lip`.
- Cantonese `rL`: `rice/lice`, `rate/late`; `road/load` is already present.
- Korean `rL`: `rice/lice`, `rate/late`.
- Spanish `iVsI`: `seat/sit`, `feel/fill` in file order, matching the existing `/iː/` then `/ɪ/` convention for exact support of `sit/seat` and `fill/feel`.

Use existing IPA conventions:
- `/raɪt/` vs `/laɪt/`
- `/raɪs/` vs `/laɪs/`
- `/roʊd/` vs `/loʊd/`
- `/rɪp/` vs `/lɪp/`
- `/reɪt/` vs `/leɪt/`
- `/siːt/` vs `/sɪt/`
- `/fiːl/` vs `/fɪl/`

- [ ] **Step 3: Run data validation**

Run: `rtk npm run validate:data`

Expected: PASS with increased pair counts in edited categories.

### Task 4: App SEO Support Matrix

**Files:**
- Create: `docs/app-seo-pair-support-matrix.md`

- [ ] **Step 1: Generate support classifications from app data**

Classify each required L1 slug as:
- `EXACT_PAIR_EXISTS` when the exact pair exists in either word order;
- `CONTRAST_EXISTS_ONLY` when the L1 has a group for the contrast but not the exact words;
- `NO_APP_SUPPORT` when no matching contrast group exists.

- [ ] **Step 2: Write the markdown report**

Include the required slug set:
- Japanese: `ship/sheep`, `right/light`, `rice/lice`
- Cantonese: `right/light`, `rice/lice`, `vest/west`
- Korean: `right/light`, `rice/lice`, `ship/sheep`
- Spanish: `ship/sheep`, `sit/seat`, `fill/feel`
- Mandarin: `vest/west`, `ship/sheep`
- Vietnamese: `right/light`, `ship/sheep`
- Thai: `right/light`, `ship/sheep`
- Hindi/Urdu: `vest/west`

Also record that this is an app/SEO alignment reference, not website implementation.

### Task 5: Final Verification

**Files:**
- Review all changed files.

- [ ] **Step 1: Run full available verification**

Run:
- `rtk npm test`
- `rtk npm run lint`
- `rtk npm run typecheck`
- `rtk npm run validate:data`
- `rtk npm run validate:audio`

- [ ] **Step 2: Scope audit**

Run:
- `rtk git diff --name-only`
- `rtk git diff --stat`

Confirm no website/landing repo files or SEO pages were created.

- [ ] **Step 3: Requirements audit**

Confirm:
- required pair additions are present or documented as already present;
- validation covers shape, difficulty, positions, duplicate/reversed duplicate pairs, non-empty groups and contrast phonemes;
- group IDs are unchanged;
- the app/SEO support matrix exists.
