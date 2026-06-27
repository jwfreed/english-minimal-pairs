# Post-app-051 Coverage Audit

## 1. Executive Summary

app-051 / PR #20 merged Batch 008B and brought the app to 761 existing pairs. app-050 and app-051 together completed Batch 008. The remaining 291 pair deficits are not all equally valuable: many groups now have full early-tier coverage and only upper-tier rotation gaps, while a smaller set still has high-value early-tier gaps.

Recommendation: proceed with limited Batch 009. Focus on clean FILL_NEXT early-tier gaps only. Do not fill ethD, uVsU, or w/v-family gaps with weak pairs, and do not change target policy in the batch.

## 2. Current Inventory Snapshot

| Metric | Value | Source |
|---|---:|---|
| Existing pairs | 761 | `npm run validate:data`, `npm run audit:pair-targets` |
| Missing pairs | 291 | `npm run audit:pair-targets` |
| Underfilled slots | 248 | `npm run audit:pair-targets` |
| Complete slots | 172 | `npm run audit:pair-targets` |
| Fill percentage | 72% | `npm run audit:pair-targets` |
| Sparse single-pair tiers | 223 | `npm run audit:sparse-tiers` |

Missing is the slot-level target deficit from `docs/pair-expansion-targets.md`; overfilled tiers do not offset underfilled tiers.

## 3. Remaining Group Classification

| L1 | Group | Current Count | Target | Missing | Classification | Rationale |
|---|---|---:|---:|---:|---|---|
| Bahasa Indonesia | aVsUh | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Bahasa Indonesia | ethD | 10 | 15 | 5 | SCARCITY_LIMITED | Documented voiced dental fricative pool is structurally thin; remaining slots should not be padded. |
| Bahasa Indonesia | iVsI | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Bahasa Indonesia | thetaT | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Bahasa Indonesia | vF | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Español | aVsE | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Español | bV | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Español | iVsI | 14 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Español | thetaS | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Español | uhVsAh | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Português | aVsE | 15 | 15 | 0 | COMPLETE | At numeric target across all tiers. |
| Português | ethD | 11 | 15 | 4 | SCARCITY_LIMITED | Documented voiced dental fricative pool is structurally thin; remaining slots should not be padded. |
| Português | iVsI | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Português | thetaT | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Português | uVsU | 7 | 15 | 8 | SCARCITY_LIMITED | Clean u/oo vs short-u pool is nearly exhausted; target reduction remains a product question. |
| Tiếng Việt | aVsUh | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Tiếng Việt | ethD | 10 | 15 | 5 | SCARCITY_LIMITED | Documented voiced dental fricative pool is structurally thin; remaining slots should not be padded. |
| Tiếng Việt | rL | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Tiếng Việt | thetaT | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Tiếng Việt | zS | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Türkçe | aVsUh | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Türkçe | ethD | 11 | 15 | 4 | SCARCITY_LIMITED | Documented voiced dental fricative pool is structurally thin; remaining slots should not be padded. |
| Türkçe | iVsI | 15 | 15 | 0 | COMPLETE | At numeric target across all tiers. |
| Türkçe | thetaT | 15 | 15 | 0 | COMPLETE | At numeric target across all tiers. |
| Türkçe | uVsU | 7 | 15 | 8 | SCARCITY_LIMITED | Clean u/oo vs short-u pool is nearly exhausted; target reduction remains a product question. |
| Русский | aVsUh | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Русский | hZero | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Русский | iVsI | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| Русский | thetaS | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean theta/s pools are likely reusable. |
| Русский | wV | 11 | 15 | 4 | SCARCITY_LIMITED | w/v-family pool has reusable anchors but few clean remaining high-tier candidates; avoid weak fillers. |
| العربية | ethD | 11 | 15 | 4 | SCARCITY_LIMITED | Documented voiced dental fricative pool is structurally thin; remaining slots should not be padded. |
| العربية | iVsI | 15 | 15 | 0 | COMPLETE | At numeric target across all tiers. |
| العربية | pB | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| العربية | thetaS | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean theta/s pools are likely reusable. |
| العربية | vF | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| فارسی | aVsE | 15 | 15 | 0 | COMPLETE | At numeric target across all tiers. |
| فارسی | ethD | 11 | 15 | 4 | SCARCITY_LIMITED | Documented voiced dental fricative pool is structurally thin; remaining slots should not be padded. |
| فارسی | iVsI | 15 | 15 | 0 | COMPLETE | At numeric target across all tiers. |
| فارسی | thetaT | 15 | 15 | 0 | COMPLETE | At numeric target across all tiers. |
| فارسی | wV | 11 | 15 | 4 | SCARCITY_LIMITED | w/v-family pool has reusable anchors but few clean remaining high-tier candidates; avoid weak fillers. |
| हिन्दी / اردو | aVsE | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| हिन्दी / اردو | ethD | 11 | 15 | 4 | SCARCITY_LIMITED | Documented voiced dental fricative pool is structurally thin; remaining slots should not be padded. |
| हिन्दी / اردو | thetaT | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean theta/t pools are likely reusable. |
| हिन्दी / اردو | wV | 6 | 15 | 9 | SCARCITY_LIMITED | w/v-family pool has reusable anchors but few clean remaining high-tier candidates; avoid weak fillers. |
| हिन्दी / اردو | zS | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| ภาษาไทย | ethD | 11 | 15 | 4 | SCARCITY_LIMITED | Documented voiced dental fricative pool is structurally thin; remaining slots should not be padded. |
| ภาษาไทย | rL | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| ภาษาไทย | thetaT | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| ภาษาไทย | vF | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean v/f pools are likely reusable. |
| ภาษาไทย | zS | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| 한국어 | fP | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| 한국어 | iVsI | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean i/ih pools are likely reusable. |
| 한국어 | rL | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| 한국어 | thetaS | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean theta/s pools are likely reusable. |
| 한국어 | vB | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| 中文 | iVsI | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean i/ih pools are likely reusable. |
| 中文 | rL | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| 中文 | thetaS | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| 中文 | uVsU | 7 | 15 | 8 | SCARCITY_LIMITED | Clean u/oo vs short-u pool is nearly exhausted; target reduction remains a product question. |
| 中文 | vW | 11 | 15 | 4 | SCARCITY_LIMITED | w/v-family pool has reusable anchors but few clean remaining high-tier candidates; avoid weak fillers. |
| 廣東話 | ethD | 11 | 15 | 4 | SCARCITY_LIMITED | Documented voiced dental fricative pool is structurally thin; remaining slots should not be padded. |
| 廣東話 | iVsI | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean i/ih pools are likely reusable. |
| 廣東話 | rL | 14 | 15 | 1 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| 廣東話 | thetaT | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| 廣東話 | vW | 11 | 15 | 4 | SCARCITY_LIMITED | w/v-family pool has reusable anchors but few clean remaining high-tier candidates; avoid weak fillers. |
| 日本語 | aVsUh | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean ae/uh pools are likely reusable. |
| 日本語 | bV | 10 | 15 | 5 | QUALITY_LIMITED | Remaining b/v candidates for this residue are lower-confidence, content-sensitive, or TTS/dialect fragile. |
| 日本語 | iVsI | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean i/ih pools are likely reusable. |
| 日本語 | rL | 12 | 15 | 3 | COMPLETE | Early tiers are covered; remaining upper-tier rotation gap is lower pedagogical priority. |
| 日本語 | sTheta | 6 | 15 | 9 | FILL_NEXT | Early-tier gaps remain and clean s/theta pools are likely reusable. |

## 4. Pedagogically Complete Groups

41 groups are pedagogically complete for current product purposes. They either hit the numeric target or have complete early-tier coverage with only upper-tier variety gaps. These gaps can remain as backlog items, but they should not outrank early-tier deficits in Batch 009.

Examples: Português/aVsE, Türkçe/iVsI, Türkçe/thetaT, العربية/iVsI, فارسی/aVsE, فارسی/iVsI, and فارسی/thetaT are at numeric target. Most other COMPLETE groups have 12 pairs with all early tiers covered.

## 5. Fill-Next Opportunities

FILL_NEXT groups have early-tier gaps and plausible learner value. Candidate pools should still be reviewed before import, but these are the strongest places to look for Batch 009:

- Русский/thetaS, العربية/thetaS, 한국어/thetaS, and 日本語/sTheta: theta/s contrasts with reusable, familiar word families.
- हिन्दी / اردو/thetaT: high early-tier deficit and strong learner relevance.
- ภาษาไทย/vF: high early-tier deficit and existing v/f pools in other L1s suggest reusable candidates.
- 한국어/iVsI, 中文/iVsI, 廣東話/iVsI, 日本語/iVsI: high-value vowel-contrast gaps with likely reusable pairs.
- 日本語/aVsUh: large early-tier vowel gap with common ae/uh pairs likely available.

## 6. Top 10 Highest-Value Remaining Expansion Opportunities

| Rank | L1 | Group | Reason |
|---:|---|---|---|
| 1 | 中文 | iVsI | Large Mandarin learner segment, 9 missing slot pairs, clean vowel-pair pool likely remains. |
| 2 | 한국어 | iVsI | High learner value and 9 missing slot pairs; clean i/ih pool should be easier than fricative-scarcity groups. |
| 3 | 한국어 | thetaS | 9 missing slot pairs; theta/s confusion is high value and candidate quality is better than uVsU. |
| 4 | ภาษาไทย | vF | 9 missing slot pairs; v/f is a salient Thai learner target with reusable cross-L1 inventory. |
| 5 | العربية | thetaS | 9 missing slot pairs; strong learner value and likely reusable theta/s candidates. |
| 6 | Русский | thetaS | 9 missing slot pairs; strong coverage gain without relying on w/v scarce candidates. |
| 7 | हिन्दी / اردو | thetaT | 9 missing slot pairs; high learner value and better candidate outlook than Hindi-Urdu/wV. |
| 8 | 廣東話 | iVsI | 9 missing slot pairs; clean vowel contrast and high early-tier gain. |
| 9 | 日本語 | iVsI | 9 missing slot pairs; common flagship contrast and likely reusable vocabulary. |
| 10 | 日本語 | aVsUh | 9 missing slot pairs; clean vowel inventory work with strong coverage gain. |

## 7. Scarcity-Limited Groups

ethD: Bahasa Indonesia, Português, Tiếng Việt, Türkçe, العربية, فارسی, हिन्दी / اردو, ภาษาไทย, and 廣東話 remain constrained. Prior audits document the structural issue: many English /ð/ words are function words, archaic forms, proper nouns, slang-adjacent pairs, or lower-frequency words. Existing High-confidence imports used the cleanest anchors such as those/doze, father/fodder, lather/ladder, seethe/seed, and soothe/sued. Remaining gaps should not be filled mechanically.

uVsU: Português, Türkçe, and 中文 remain constrained. Batch 005 documented that the clean u/oo vs short-u pool is nearly exhausted; examples such as kook/cook and rum/room were rejected for slang or content policy. These are target-reduction candidates rather than ordinary fill candidates.

w/v-family: Русский/wV, فارسی/wV, हिन्दी / اردو/wV, 中文/vW, and 廣東話/vW remain constrained. Some reusable anchors exist, but prior audits found Russian/wV T3 had no High-confidence remaining candidate. For Hindi-Urdu/wV and Cantonese/Mandarin vW, use a dedicated review instead of treating raw missing count as sufficient evidence.

## 8. Quality-Limited Groups

日本語/bV is the only primary QUALITY_LIMITED group in this audit. It still has numeric underfill, but the remaining b/v residue is more likely to require lower-confidence, content-sensitive, or TTS/dialect-fragile pairs than the FILL_NEXT vowel and theta groups.

Weak or rejected pools documented in prior audits include beer/veer, bile/vile, base/vase, wend/vend, this/dis, thee/dee, than/Dan, herb/erb, room/loom, rum/room, kook/cook, and thong/dong. These should not be promoted simply to reduce missing count.

## 9. Product-Decision Candidates

No group is classified primarily as PRODUCT_DECISION_REQUIRED because the strongest product decisions are cross-cutting policy questions rather than a single current group classification.

Target-reduction candidates:

- uVsU for Português, Türkçe, and 中文: consider reducing targets because clean high-confidence supply is thin.
- ethD across the nine listed L1s: consider an exception or lower target for upper tiers and residual early-tier slots.
- w/v-family T3+ residuals, especially Русский/wV and हिन्दी / اردو/wV: require a decision on whether Medium-confidence candidates are acceptable.

Content/product approval candidates:

- beer/veer remains excluded. Do not import unless product-owner approval explicitly changes the alcohol-vocabulary policy.
- uVsU rejected pairs involving alcohol or slang remain excluded.

## 10. Batch 009 Recommendation

Proceed with limited Batch 009.

Recommended scope: 24 to 36 High-confidence pairs across 4 to 6 FILL_NEXT groups, prioritizing early tiers. Avoid appending upper-tier fillers to COMPLETE groups. Do not alter target policy, schemas, categories, or contrast groups.

Suggested Batch 009 short list:

- 中文/iVsI
- 한국어/iVsI
- 한국어/thetaS
- ภาษาไทย/vF
- العربية/thetaS
- Русский/thetaS

If candidate review finds weak pools in any selected group, skip the weak group rather than backfilling from SCARCITY_LIMITED groups.

## 11. Validation Evidence

| Command | Result | Notes |
|---|---|---|
| `gh pr view 20 --json number,title,state,isDraft,headRefName,baseRefName,commits,changedFiles,url,mergeStateStatus` | PASS | PR #20 was open, non-draft, CLEAN, and at expected tip before merge. |
| `npm run validate:data` | PASS | 14 categories; 761 existing pairs after app-051. |
| `npm run audit:pair-targets` | PASS | 291 missing pairs, 248 underfilled slots, 172 complete slots, 72% fill. |
| `npm run audit:sparse-tiers` | PASS | 223 sparse single-pair tiers. |
| `npm run validate:audio` | PASS | Audio asset validation passed before merge. |
| `npm test` | PASS | Full test suite passed before merge. |
| `npm run typecheck` | PASS | TypeScript check passed before merge. |
| `git diff --check origin/main...HEAD` | PASS | No whitespace errors in PR diff. |
| `gh pr checks 20` | PASS | GitHub checks summary reported 1 passed, 0 failed. |
