# Pair Expansion Target Matrix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic tooling and a generated Markdown report that compare current minimal-pair coverage against tier-specific expansion targets.

**Architecture:** Follow `scripts/audit-sparse-tiers.js`: a CommonJS script exports pure audit/render helpers, loads repo data only in the CLI path, prints Markdown by default, and writes `docs/pair-expansion-targets.md` with `--write`. The audit unit is `category × group × difficulty tier`; no production app code or pair data changes.

**Tech Stack:** Node.js CommonJS scripts, plain Node `assert` tests, existing `loadRepoData()` helper from `scripts/validate-data.js`, npm package scripts.

---

### Task 1: Add Failing Audit Tests

**Files:**
- Create: `scripts/audit-pair-expansion-targets.test.js`

- [x] **Step 1: Write tests first**

Add plain Node `assert` tests with the existing local `runTest()` convention. Cover target counts, complete slots, early and upper severity, no hypothetical groups, stable ordering, Markdown sections, and exception behavior.

- [x] **Step 2: Verify RED**

Run: `rtk test node scripts/audit-pair-expansion-targets.test.js`
Expected: fail with `Cannot find module './audit-pair-expansion-targets'`.

### Task 2: Implement Audit Helper and Markdown Renderer

**Files:**
- Create: `scripts/audit-pair-expansion-targets.js`

- [x] **Step 1: Add constants and pure helper**

Export `TARGET_PAIRS_BY_TIER`, `TARGET_EXCEPTIONS`, `auditPairExpansionTargets`, and `generatePairExpansionMarkdown`. Generate tiers 1-6 for existing category/group data only, count current pairs, apply tier targets, preserve missing counts for exceptions, and sort deterministically.

- [x] **Step 2: Verify GREEN**

Run: `rtk test node scripts/audit-pair-expansion-targets.test.js`
Expected: all tests pass.

### Task 3: Add CLI and Package Script

**Files:**
- Modify: `scripts/audit-pair-expansion-targets.js`
- Modify: `package.json`

- [x] **Step 1: Add CLI behavior**

Default command prints Markdown to stdout. `--write` writes `docs/pair-expansion-targets.md` and logs a short summary. The report content from the renderer is the single source for both paths.

- [x] **Step 2: Add npm script**

Add `"audit:pair-targets": "node scripts/audit-pair-expansion-targets.js"` next to `audit:sparse-tiers`.

### Task 4: Generate Report and Verify

**Files:**
- Create: `docs/pair-expansion-targets.md`

- [x] **Step 1: Generate report**

Run: `rtk test node scripts/audit-pair-expansion-targets.js --write`

- [x] **Step 2: Run verification**

Run:
- `rtk test npm test`
- `rtk test npm run validate:data`
- `rtk test npm run audit:sparse-tiers`
- `rtk test npm run audit:pair-targets`
- `rtk test node scripts/audit-pair-expansion-targets.js --write`
- `rtk git diff --check`
- `rtk git diff -- app/constants/minimalPairs app/constants/minimalPairs.ts`

- [x] **Step 3: Review diff**

Confirm changed files are limited to the new audit script, test, generated report, package script, and this plan. Confirm no production code or pair data changed.
