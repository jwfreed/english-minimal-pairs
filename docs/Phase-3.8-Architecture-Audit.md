# Phase 3.8 Architecture Audit

Date: 2026-07-31
Branch: `docs/phase-3-migration-strategy` (HEAD `c5b16d7`)
Status: **Authoritative record of the completed Phase 3.8 audit.** Documentation
only — no code, tests, or configuration were modified to produce this document
or any finding in it.

Evidence base: `npm test` → 431 assertions pass, 0 failures. All file:line
citations reference the repository at the commit above.

This document is a peer of `Contrast-Domain-Architecture-Decisions.md` and
`Contrast-Domain-Architecture-Evolution Plan.md`. It does not renumber or
supersede any accepted Decision in that file. The retirement-gating conclusion
in Section 4 is recorded formally as Decision 011 in
`Contrast-Domain-Architecture-Decisions.md`; any other findings below that
imply further decisions remain **proposals**, not recorded as accepted.

---

## 1. Executive Summary

The Phase 3.8 audit is complete. Its conclusion:

- **The migration architecture is sound.** Identity, historical mapping, stable
  mastery persistence, orphan recovery, and controlled rollout are
  implementation-complete, internally consistent with Decisions 001–010, and
  covered by 431 passing test assertions.
- **Retirement of any compatibility component is deferred.** No legacy read
  path, legacy write path, migration marker, or orphan-recovery capability
  should be removed in Phase 3.8.
- **The reason is insufficient production evidence, not unfinished
  architecture.** `CONTRAST_MASTERY_ROLLOUT_STATE` is `'disabled'`
  ([featureFlags.ts:18](../src/config/featureFlags.ts#L18)). No shipped install
  has ever written a stable mastery document. The retirement criteria already
  written into the evolution plan ("3.8 closes legacy writes only") presuppose
  a rollout that reached `enabled` and produced clean real-install evidence.
  That precondition is unmet, and — as detailed in Finding 1 below — the
  repository currently has no wired mechanism to produce it.

**Phase 3.8 is correctly scoped as a stabilization and evidence phase, not a
cleanup phase.** The engineering work this audit calls for is building the
evidence pipeline that a future retirement decision would require, not
deleting code.

---

## 2. Current Runtime Reality

These are observed facts about the shipped build, not aspirations from the
architecture documents:

- **Rollout state is `disabled`.** Verified at
  [featureFlags.ts:18-19](../src/config/featureFlags.ts#L18-L19). This is a
  build-time constant; there is no remote override.
- **Legacy mastery is the sole authority in shipped installs.** With rollout
  `disabled`, `useContrastPairs` bypasses the compatibility layer entirely and
  reads/writes `@mastery_${categoryLabel}` directly via `AsyncStorage`
  ([useContrastPairs.ts:72](../src/hooks/useContrastPairs.ts#L72),
  [:126](../src/hooks/useContrastPairs.ts#L126),
  [:177](../src/hooks/useContrastPairs.ts#L177)). The stable compatibility
  layer (`readCompatibleMastery`, `writeCompatibleMastery`,
  `compareMasteryInShadow`) is not invoked.
- **Stable mastery capability exists but is not operationalized.** The schema,
  validation, reconciliation, storage, dual-write state machine, shadow
  comparison, and safety gate are all implemented and tested
  ([contrastMasteryPersistence.ts](../src/domain/contrastMasteryPersistence.ts),
  [contrastMasteryStorage.ts](../src/storage/contrastMasteryStorage.ts),
  [masteryCompatibility.ts](../src/storage/masteryCompatibility.ts),
  [masteryRolloutSafety.ts](../src/domain/masteryRolloutSafety.ts)). None of it
  has executed against real learner data, because rollout has never left
  `disabled` in production.
- **`useContrastPairs` is the only production consumer of the entire Phase
  3.5–3.7 surface.** Verified by repository-wide search:
  `getContrastProgress`, `getMasteryRolloutMetrics`,
  `setMasteryRolloutDiagnosticSink`, `evaluateMasteryRolloutSafetyGate`,
  `migrateLanguageMastery`, and `adoptOrphanedMasteryForLanguage` have no
  callers in `src/` or `app/`. The last is explicitly asserted by test
  ([orphanMasteryAdoption.test.js:1270](../scripts/orphanMasteryAdoption.test.js#L1270)).

**Summary of runtime reality:** the target architecture exists as tested,
dormant capability. The system currently behaves exactly as it did before
Phase 3.1 began, from the learner's perspective.

---

## 3. Key Findings

### Finding 1 — Migration markers are not produced by normal runtime paths

`writeCompatibleMastery` writes only the stable mastery document; it never
writes `@masteryByContrastMigration_${LanguageId}`
([masteryCompatibility.ts:912](../src/storage/masteryCompatibility.ts#L912)).
The only two functions that write the marker —
`migrateLanguageMastery` ([masteryCompatibility.ts:141](../src/storage/masteryCompatibility.ts#L141))
and `adoptOrphanedMasteryForLanguage`
([orphanMasteryAdoption.ts (storage):101](../src/storage/orphanMasteryAdoption.ts#L101)) —
are explicit operations with no caller in application code.

**Consequence:** under an `enabled` rollout as currently wired, a stable
document would be created lazily by the learner's first mastery mutation, but
the migration marker would never exist. The "marker lost" recovery branch in
`migrateLanguageMastery`
([:252-277](../src/storage/masteryCompatibility.ts#L252-L277)) — designed as an
edge case — would become the default case if this path were ever invoked. This
is not unsafe (it baselines rather than resurrects stale evidence), but it
means the marker's steady-state value is currently unrealized.

### Finding 2 — Legacy reads are a permanent historical compatibility boundary, not temporary migration debt

No startup migration is wired. Any language a learner has not practiced since
upgrading has no stable document, so `readCompatibleMastery` falls through to
legacy on `missing` stable state
([masteryCompatibility.ts:646-680](../src/storage/masteryCompatibility.ts#L646-L680)).
Combined with an offline-first app with no remote kill switch and unbounded
rollback windows, legacy reads are not a fallback that shrinks over time — they
are a permanent runtime dependency for as long as the historical identity
mapping's alias table exists (which Decision 007 requires to be append-only and
permanent).

**Reframing:** this component should be understood as the **historical mastery
reader**, a permanent part of the architecture, not as migration debt awaiting
cleanup.

### Finding 3 — Legacy writes cannot be retired without operational evidence

The Decision 008 hard invariant is that a previous application version must
continue to read learner progress correctly throughout the compatibility
period, and rollback requires no data repair. That invariant is currently
satisfied entirely by the legacy write leg — dual writes are legacy-first, and
a legacy failure stops before any stable write is attempted
([masteryCompatibility.ts:830-857](../src/storage/masteryCompatibility.ts#L830-L857)).

Removing legacy writes converts rollback from "revert the code" into "revert
the code and accept data loss for everything written after the release,"
because a reverted build would read a legacy map frozen at the retirement
release. For an app with no remote configuration and rollback latency equal to
a release cycle, that is an unbounded, silent loss window on affected installs.

This cannot be evaluated against evidence that does not exist. See Section 5.

### Finding 4 — Orphan recovery should remain explicit historical compatibility infrastructure

`analyzeOrphanedMastery` / `proposeOrphanMasteryAdoption`
([orphanMasteryAdoption.ts (domain)](../src/domain/orphanMasteryAdoption.ts))
and `adoptOrphanedMasteryForLanguage`
([orphanMasteryAdoption.ts (storage)](../src/storage/orphanMasteryAdoption.ts))
are pure, deterministic, and never wired to startup, background work, or the
learner UI — confirmed by test. As long as legacy writes persist (Finding 3),
rollback-era and interrupted-write scenarios that produce orphaned legacy
evidence remain possible indefinitely, so the recovery capability that
addresses them is not transitional either.

The correct lifecycle is: implemented → reachable via an explicit,
operator-invoked diagnostic surface → never wired to automatic execution. This
closes Phase 3 Open Question 3 ("whether orphan recovery is surfaced to the
learner or applied silently") as: **neither** — it is operator-invoked only,
never learner-facing, never automatic.

### Finding 5 — Placement identity still requires investigation because it remains label-derived

`@placementDone_${categoryLabel}`
([masteryPersistence.ts:21](../src/domain/masteryPersistence.ts#L21)) is keyed
by the mutable display label. It has no `LanguageId`-keyed counterpart, no
alias resolution through `historicalIdentityMapping`, and no representation in
the stable mastery document. This is the same label-rename orphaning failure
mode that Decision 007 was written to eliminate for mastery — but Decision 007
was scoped to mastery identity only, and placement was never brought under it.

This was in scope neither for Phase 3.1–3.7 nor for this audit's remediation.
It is recorded here as an open architectural gap requiring its own
investigation and, likely, its own phase or decision — not as something Phase
3.8 resolves.

---

## 4. Retirement Decision

**Retirement is deferred.**

The following must **not** be removed, disabled by default-off flag removal, or
otherwise retired in Phase 3.8:

- legacy mastery reads (`@mastery_${categoryLabel}` and the historical
  identity mapping that resolves it)
- legacy mastery writes (the legacy leg of `writeCompatibleMastery`)
- the migration marker (`@masteryByContrastMigration_${LanguageId}`) and its
  write paths
- orphan recovery (`analyzeOrphanedMastery`, `proposeOrphanMasteryAdoption`,
  `adoptOrphanedMasteryForLanguage`)

This holds regardless of how much of the above currently has zero production
callers. Absence of a wired caller reflects that rollout has never left
`disabled`, not that the capability is unneeded — removing any of these
components today would remove the only proven data-safety mechanism (legacy
reads/writes) or the only recovery mechanism (orphan adoption) before the
mechanism they are meant to protect (stable mastery) has ever run against real
learner data.

This decision will be revisited only after the evidence gates in Section 5 are
satisfied. It is not on a calendar timeline.

---

## 5. Evidence Required Before Retirement

None of the following evidence currently exists. Retirement of any component
listed in Section 4 requires all of it:

- **Real-install shadow observations.** `shadow` rollout state run on at least
  one internal build carrying real learner history, including at least one
  language that has a historical label rename (the plan's existing sequencing
  rule — six such alias rows exist in `HISTORICAL_CATEGORY_LABELS`). Target:
  `unexplainedDivergenceCount == 0` and `unresolvedMappingCount == 0` from
  `compareMasteryInShadow`
  ([masteryCompatibility.ts:460](../src/storage/masteryCompatibility.ts#L460)).
- **Rollout safety gate results.** `evaluateMasteryRolloutSafetyGate`
  ([masteryRolloutSafety.ts:30](../src/domain/masteryRolloutSafety.ts#L30))
  evaluated against real, persisted diagnostic counters — not
  hand-constructed test evidence. This requires the diagnostics store to
  survive app restart, which it currently does not
  (`masteryRolloutDiagnostics.ts` metrics are an in-memory module-level object).
- **Production divergence measurements** across a sustained window, not a
  single observation — specifically `partialWrites`, `unresolvedMappings`, and
  `shadowDivergences` at or near zero across multiple releases.
- **Rollback confidence** demonstrated by actually exercising an `enabled →
  disabled` rollback on a build that has performed real stable writes, and
  confirming legacy reads recover full fidelity.
- **Migration recovery validation** — at least one exercised, non-simulated run
  of `migrateLanguageMastery` and `adoptOrphanedMasteryForLanguage` against
  real device state, since both are currently unexercised outside of unit
  tests with synthetic fixtures.

No operational or production data currently exists to satisfy any of these
gates. This audit does not estimate values for them.

---

## 6. Phase 3.8 Scope

**Phase 3.8 is: Migration Stabilization and Evidence.**

It is explicitly **not**:

- migration cleanup
- legacy deletion
- retirement of any compatibility component

The engineering work this scope implies (for a future implementation phase,
not performed by this audit) is building the capability to observe and act on
real-install evidence: persisting rollout diagnostics across restarts, adding
an operator-facing surface to invoke `migrateLanguageMastery` and
`adoptOrphanedMasteryForLanguage` and to read `getMasteryRolloutMetrics()`, and
advancing rollout one state at a time on internal builds while re-verifying
rollback at each step. None of that work is a retirement action, and none of
it was performed as part of this documentation-only audit.

---

## 7. Phase 4 Readiness

**Phase 4 is not blocked by domain design. It is blocked by operational
authority validation.**

The identity foundation (`LanguageId`/`ContrastId`, immutable, registry-backed,
golden-file-fenced) and the domain boundary
(`src/domain/contrast/`) are sound and ready. What is not ready is runtime
mastery authority: `useContrastPairs` currently contains two complete,
per-render-selected authority modes — a direct-`AsyncStorage` legacy path and a
compatibility-layer stable path
([useContrastPairs.ts:38-43](../src/hooks/useContrastPairs.ts#L38-L43)). Phase
4's planned `ProgressUpdater` extraction targets exactly this hook.

Before Phase 4 begins:

- **Migration authority boundaries must be operationally proven** — i.e.
  rollout must have reached and held a single authoritative state (stable or
  legacy, not a per-render branch) against real learner data, per Section 5.
- **Avoid creating competing compatibility paths.** Extracting a
  `ProgressUpdater` while the dual-authority branch in `useContrastPairs` is
  still live would fork the Phase 3.5 write-ordering and blocked-read
  invariants into a second implementation, doubling the surface that has to
  prove correctness.
- **Remaining identity-derived learner state risks must be resolved or
  explicitly scoped out**, in particular the placement-identity gap in
  Finding 5, before it is carried unexamined into a new engine boundary.

A scope reduction is available if Phase 4 is time-sensitive: extracting
`Scheduler`, `Evaluator`, and `AnalyticsEmitter` while explicitly leaving
`ProgressUpdater`/persistence inside `useContrastPairs` would not touch the
compatibility state machine. This should be recorded as an explicit, deliberate
scope decision if pursued — not treated as an implicit workaround.

---

## 8. Open Questions

These are preserved, not resolved, by this audit. They must not be silently
answered by a future implementation choice:

- **Install distribution.** What application versions are actually installed,
  and in what proportion. Unknown; no telemetry source exists in this
  offline-first app.
- **Real shadow divergence rate.** What `compareMasteryInShadow` actually
  reports against real learner history. Unknown until Section 5's shadow
  observation is performed.
- **Rollback frequency.** How often installs actually roll back, and the
  realistic latency of a rollback given app-store review cycles. Unknown.
- **Abandoned pre-`v2` pair-progress payload existence.** Whether any
  pre-`@pairProgress_v2` payload still exists on any device, and in what
  format (Phase 3 Open Question 1, still open). Nothing may delete or ignore
  such a payload until this is answered by direct device-key enumeration.
- **Placement identity migration requirements.** Whether placement state
  should be migrated to a `LanguageId`-keyed, alias-resolved scheme matching
  mastery, and if so under what decision and phase (Finding 5). Not scoped by
  Phase 3.1–3.7 and not resolved here.
- **Dual-write window length.** The concrete number of releases the legacy +
  stable dual-write period should span. Already flagged as open in the
  evolution plan; this audit does not close it, since no adoption metric is
  available (Section 5).

---

## Architectural Invariants Preserved

This audit's conclusions do not weaken any invariant already established by
Decisions 001–010. The following invariants hold across the current state of
the system and are unaffected by, and in several cases are the direct reason
for, the retirement deferral recorded in Section 4 and Decision 011:

- **Stable identities are immutable after release.** `LanguageId` and
  `ContrastId` values, once shipped, are never renamed, merged, or reused
  (Decisions 003, 006, 007). Nothing in this audit proposes changing that.
- **Historical identities resolve through explicit mappings.** Every
  historical label or group value reaches current identity only through
  `historicalIdentityMapping`, never through inference, normalization, or
  pattern matching. The alias table remains append-only.
- **Learner progress must never silently disappear.** Every read/write path
  reviewed in this audit either preserves prior state on failure (blocked
  reads, legacy-first writes) or fails explicitly and retryably; none of them
  resolve an ambiguous or failed state by discarding data.
- **Compatibility reads may remain as historical infrastructure where
  required.** Legacy mastery reads are not scoped as temporary scaffolding
  (Finding 2); permanence is an accepted architectural outcome, not a gap to
  be closed on a schedule.
- **Retirement requires operational evidence.** Formalized in Decision 011:
  no compatibility component is removed on the basis of implementation
  completeness, test coverage, or phase-number progression alone.
- **Migration paths must preserve rollback safety or explicitly document
  irreversible decisions.** The legacy-first write ordering, the Decision 008
  hard invariant, and the requirement that any future move to a lossy write
  scheme (Option B in prior analysis) be an explicit, recorded product
  decision all remain intact.
- **Cleanup must not remove information required to interpret learner state.**
  Migration markers, the historical identity mapping, and orphan-recovery
  evidence are all retained specifically because removing them would strand
  the system's ability to interpret legacy learner data correctly, even though
  none currently has a production caller.

---

## Consistency Note

This document does not alter, renumber, or contradict Decisions 001–010 in
`Contrast-Domain-Architecture-Decisions.md`. Its retirement-gating conclusion is
recorded as Decision 011, appended after Decision 010 without renumbering any
prior entry. It also does not alter the Phase 3.1–3.7 status records or
PR-boundary sequencing in `Contrast-Domain-Architecture-Evolution Plan.md`;
the Phase 3.8 status entries in that document were updated to reflect this
audit's conclusion that retirement is deferred, consistent with Decision 011.
Where this audit's findings imply further decisions worth recording formally
(for example, opening a placement-identity workstream), those remain
proposals for future Decision entries, not decisions this document makes on
its own. No new phase is created by this document; Phase 3.8 remains
stabilization and evidence work, not cleanup.
