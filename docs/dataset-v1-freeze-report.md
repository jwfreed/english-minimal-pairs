# Dataset v1 Freeze Report

> app-058 — Dataset v1 Freeze Verification.
> All metrics in this report were produced by live repository tooling on the
> verification branch and reconciled against committed audit history. This is a
> certification record, not a pair-expansion task. No pair data, schema,
> category, contrast group, or target policy was changed.

## Executive Verdict

**Dataset v1 is ready to freeze.**

The repository is internally consistent, validates cleanly under every gate, and
its final data import is provenance-verified. The final micro-batch import
(app-057, PR #22) adds exactly the 28 High-confidence pairs specified by the
final micro-batch selection audit (app-056) — every word pair, tier, IPA,
contrast group, and syllable position matches. The pair-count chain reconciles
end to end: 761 (post-app-051) → +24 Batch 009 → 785 → +28 final micro-batch →
**813** live.

One provenance gap was found and is closed by this change set: the app-056
selection audit (`docs/pair-expansion-final-microbatch-selection-audit.md`) had
been left on its feature branch and never merged to `main`, even though every
prior batch's selection audit is on `main`. app-058 restores that document so
the audit trail for the final import is complete on `main`. With that record in
place, no blocking inconsistency remains.

All remaining coverage deficits (239 missing slot-pairs; 197 single-pair tiers)
map to previously documented, intentionally accepted classifications. None is a
new or unexplained gap. Pedagogical completeness — not numeric target closure —
is the freeze standard, and most contrast groups now provide early-tier
rotation variety at tiers 1–2 (most also at tier 3). The remaining
single-pair early tiers are intentional, documented SCARCITY_LIMITED
exceptions — Português/uVsU, Türkçe/uVsU, 中文/uVsU (pool/pull and
suit/soot exhaust the clean uː/ʊ pool), and हिन्दी / اردو/wV (w/v-family
scarcity) — all catalogued in §Remaining Gap Taxonomy below.

## Final Inventory

Source: `npm run validate:data`, `npm run audit:pair-targets`,
`npm run audit:sparse-tiers` (live, this branch).

| Metric | Value |
|---|---:|
| Categories (L1 learner profiles) | 14 |
| Contrast groups (category × group) | 70 |
| Group/tier slots present | 420 |
| Existing pairs | 813 |
| Target pairs | 1050 |
| Fill percentage | 77% |
| Complete target slots | 198 |
| Underfilled target slots | 222 |
| Missing pairs (slot-level deficit) | 239 |
| Exception slots | 0 |
| Healthy tiers (≥ 2 pairs) | 223 |
| Single-pair (sparse) tiers | 197 |
| Possible missing-tier gaps | 0 |
| i18n coverage | 87 tKeys × 15 locales (14 L1 + English UI) |

Per-category pair counts (5 groups each): 日本語 56, 中文 52, ภาษาไทย 57,
Español 62, العربية 60, Русский 57, 한국어 56, Português 57, Tiếng Việt 58,
Türkçe 60, فارسی 67, 廣東話 60, Bahasa Indonesia 58, हिन्दी / اردو 53. Sum = 813.

## Validation Status

All six gates pass (exit 0). Re-run on the verification branch after the
documentation changes.

| Command | Result | Notes |
|---|---|---|
| `npm run validate:data` | PASS | 14 categories; dataset validation passed |
| `npm run audit:pair-targets` | PASS | 239 missing, 222 underfilled, 198 complete, 77% fill, 0 exceptions |
| `npm run audit:sparse-tiers` | PASS | 197 single-pair tiers (47%), 0 possible tier gaps |
| `npm run validate:audio` | PASS | Audio asset validation passed |
| `npm test` | PASS | Full suite (adaptive progression, scheduler, persistence, i18n, data/audit generators) |
| `npm run typecheck` | PASS | `tsc --noEmit` clean |

No validation drift: live metrics match the expected v1 baseline exactly
(813 pairs, 239 missing, 77% fill, 197 sparse tiers).

## Pair Expansion History

The dataset reached v1 through audited, single-purpose import batches. Each
import batch was preceded by a committed selection audit and merged via its own
PR. Verified recent lineage:

| Stage | Work | Evidence |
|---|---|---|
| Batches 001–005 | Initial candidate pools and Batches 002–005B imports | `docs/pair-expansion-*-selection-audit.md`, branches app-034…app-042 |
| Batch 006 | Selection audit (app-043) → import (app-044) | PR #17 |
| Batch 007 | Selection audit (app-045) → import (app-046) | PR #18 |
| Batch 008A/008B | Selection audit (app-049) → imports (app-050, app-051) | PR #19, PR #20 → **761 pairs** |
| Coverage audit | app-052 remaining pedagogical coverage audit | `docs/post-app-051-coverage-audit.md` |
| Batch 009 (limited) | Selection audit (app-053) → import (app-054), +24 pairs | PR #21 → **785 pairs** |
| Final micro-batch | Selection audit (app-056) → import (app-057), +28 pairs | PR #22 → **813 pairs** |
| Freeze verification | app-058 (this change set) | inventory regen + provenance restore + this report |

Note: there are no `app-055` commits in any ref; the number was skipped. No
work is stranded under it.

## Remaining Gap Taxonomy

All 239 missing slot-pairs and 197 single-pair tiers fall into documented,
accepted categories. No undocumented deficit exists.

| Class | Groups affected | Treatment | Source |
|---|---|---|---|
| SCARCITY_LIMITED — ethD (ð/d) | 9 L1s: Bahasa Indonesia, Português, Tiếng Việt, Türkçe, العربية, فارسی, हिन्दी / اردو, ภาษาไทย, 廣東話 | Structural English /ð/ scarcity (function words, archaic forms, proper nouns). Do not pad. | post-app-051 §7 |
| SCARCITY_LIMITED — uVsU (uː/ʊ) | Português, Türkçe, 中文 | Clean u/oo vs short-u pool exhausted. Target-reduction is a future product question, not a v1 fill. | post-app-051 §7, Batch 005 |
| SCARCITY_LIMITED — w/v-family (wV, vW) | Русский/wV, فارسی/wV, हिन्दी / اردو/wV, 中文/vW, 廣東話/vW | Reusable anchors but thin clean high-tier supply; no weak fillers. | post-app-051 §7 |
| QUALITY_LIMITED — bV (b/v) | 日本語/bV | Remaining residue is lower-confidence / content-sensitive / TTS-fragile. | post-app-051 §8 |
| Intentional T3 backlog (FILL_NEXT) | Русский/thetaS, العربية/thetaS, 한국어/thetaS, 한국어/iVsI, 中文/iVsI, ภาษาไทย/vF | Batch 009 deliberately added tier-1×2 + tier-2×2 only; tier-3 left as a singleton ("does not attempt full numeric target closure"). | app-053 §6 |
| Intentional T3 limit (sTheta) | 日本語/sTheta | Micro-batch added 4 (tiers 1–2); tier-3 alternatives were reverse duplicates or below the final-batch bar. | app-056 |
| Upper-tier (T4–T6) rotation gaps | COMPLETE groups across all L1s | Early tiers covered; upper-tier variety is explicit lower-priority backlog, not a freeze blocker. | post-app-051 §4 |

## Final Product Decisions

These decisions are settled for v1 and are **not reopened** by this report.

- **beer/veer excluded** (alcohol-vocabulary policy). Verified absent from data.
  (`veer/fear` is a separate, legitimate v/f pair and remains.)
- **uVsU policy unchanged.** Target reduction remains a future product question.
- **ethD structural scarcity accepted.** Upper and residual early-tier slots stay open by design.
- **w/v-family scarcity accepted.** Medium-confidence acceptability is a future decision.
- **Quality-limited groups intentionally incomplete** (notably 日本語/bV).
- **Product-gated filler intentionally excluded.** No filler pairs.
- **No schema, category, contrast-group, or target-policy changes.** `TARGET_EXCEPTIONS` is empty (0 exception slots); scarcity is handled by classification, not formal target exceptions.

## Batch 010 Decision

**Batch 010 is not planned and should not be started.**

The app-056 audit explicitly recommends freezing after the 28-pair packet:
the remaining deficits "would not justify another ordinary expansion batch under
the current standards." They are scarcity-limited, policy-limited, quality-limited,
upper-tier rotation, or intentionally-deferred tier-3 slots. Per the freeze
verification, no clean FILL_NEXT pool remains unaddressed — all eleven FILL_NEXT
groups identified post-app-051 were filled across Batch 009 and the final
micro-batch. Future pair work, if any, is maintenance under the change policy
below, not a v1 expansion batch.

## Dataset Freeze Policy

- Pair data, schema, categories, contrast groups, and target policy are **frozen**
  for v1.
- The six validation gates (`validate:data`, `audit:pair-targets`,
  `audit:sparse-tiers`, `validate:audio`, `test`, `typecheck`) must remain green.
- Generated documents (`docs/sparse-tier-inventory.md`,
  `docs/pair-expansion-targets.md`) are tool-generated and must be regenerated
  via their scripts with `--write`, never hand-edited.
- Provenance rule: every import that lands on `main` must have its selection
  audit on `main`. (This rule motivated restoring the app-056 audit in app-058.)

## Future Change Policy

Any post-freeze pair change is a maintenance exception, not resumed expansion,
and must:

1. Represent a clean single-contrast minimal pair using real, common words and
   established IPA conventions.
2. Avoid any same-L1 exact, reverse, or cross-group duplicate.
3. Pass human + product review before import; no filler to reduce missing counts.
4. Ship in a dataset-only PR, separate from scheduler or UI changes.
5. After import, regenerate `audit:sparse-tiers --write` and
   `audit:pair-targets --write`, commit the regenerated docs, and re-run
   `validate:data`.
6. Reopening ethD / uVsU / w-v scarcity, the beer/veer policy, or target
   reductions requires an explicit product-owner decision recorded in a new audit.

## Recommended Engineering Priorities

| Rank | Priority | Reason |
|---:|---|---|
| 1 | Regenerate generated docs on every data change | The sparse-tier inventory was stale by two imports (showed 223 vs live 197); enforce the regenerate-and-commit step (ideally in CI) so generated docs never drift again. |
| 2 | TTS / manual QA spot-checks | Audit QA notes flag θ-onset and cluster pairs (e.g. thaw/saw, thought/sought, three/tree, view/few) for voice verification. |
| 3 | Record future product decisions as audits, not code | uVsU target reduction, ethD/w-v policy, and Medium-confidence acceptability are deferred product calls; capture them in dated audits if revisited. |
| 4 | Ledger hygiene | Document the skipped app-055 number for traceability; keep the audit-on-main provenance rule enforced for any future import. |

(The previously-open provenance item — merging the app-056 micro-batch audit to
`main` — is resolved within app-058 and is no longer outstanding.)

## Final Recommendation

**Freeze Dataset v1 now.**

The dataset validates cleanly, reconciles exactly to expected metrics, carries a
complete and verifiable provenance trail (with the app-056 audit restored to
`main` in this change set), and has no undocumented coverage gap. Remaining
deficits are intentional, classified, and explicitly out of scope for v1.
Transition pair expansion from active development into maintenance.
