# app-053 Batch 009 Selection Audit

## 1. Executive Verdict

Proceed with limited Batch 009.

The post-app-051 inventory still has high-value early-tier deficits, but only a subset are worth selecting before declaring pair expansion v1 near-complete. The recommended Batch 009 packet is 24 High-confidence pairs across 6 FILL_NEXT groups. It uses existing L1 categories, existing group IDs, conservative cross-L1 reuse, and no target-policy, schema, category, or group changes.

## 2. Current Baseline

| Metric | Value | Source |
|---|---:|---|
| Existing pairs | 761 | `npm run validate:data`, `npm run audit:pair-targets` |
| Missing pairs | 291 | `npm run audit:pair-targets` |
| Underfilled slots | 248 | `npm run audit:pair-targets` |
| Complete slots | 172 | `npm run audit:pair-targets` |
| Fill percentage | 72% | `npm run audit:pair-targets` |
| Sparse single-pair tiers | 223 | `npm run audit:sparse-tiers` |

Live script output matched the app-052 expected baseline.

## 3. Method

This audit used `docs/post-app-051-coverage-audit.md` as the group-classification source of truth. Only FILL_NEXT groups were considered for selection; mathematically underfilled COMPLETE, SCARCITY_LIMITED, QUALITY_LIMITED, and product-gated groups were not promoted.

Pedagogical value was judged by learner segment value, L1 salience, and whether selected rows improve early-tier contrast variety. Target-matrix emptiness was treated as supporting evidence only, not a selection rule. Lexical scarcity excluded groups whose prior audits show thin clean pools, especially ethD, uVsU, and w/v-family residues. Quality risk excluded Medium-confidence, dialect-fragile, content-sensitive, TTS-risky, duplicate, reverse-duplicate, and same-L1 cross-group-conflict candidates.

## 4. Candidate Group Review

| Rank | L1 | Group | Current Coverage | Candidate Pool Quality | Decision | Reason |
|---:|---|---|---|---|---|---|
| 1 | 中文 | iVsI | 6/15; tiers 1-3 each have 1/3 | Strong | SELECT | Large learner segment, flagship vowel contrast, clean reusable i/ih pool, and no policy risk. |
| 2 | 한국어 | iVsI | 6/15; tiers 1-3 each have 1/3 | Strong | SELECT | High learner value with clean common vowel pairs available across early tiers. |
| 3 | 한국어 | thetaS | 6/15; tiers 1-3 each have 1/3 | Strong | SELECT | Salient Korean learner contrast; clean theta/s initial pairs remain available. |
| 4 | ภาษาไทย | vF | 6/15; tiers 1-3 each have 1/3 | Strong | SELECT | Thai v/f contrast is high-value and existing cross-L1 v/f pools provide clean early candidates. |
| 5 | العربية | thetaS | 6/15; tiers 1-3 each have 1/3 | Strong | SELECT | Strong Arabic learner relevance; reusable theta/s candidates improve early-tier variety. |
| 6 | Русский | thetaS | 6/15; tiers 1-3 each have 1/3 | Strong | SELECT | Strong learner relevance and cleaner than remaining Russian w/v-family residue. |
| 7 | हिन्दी / اردو | thetaT | 6/15; tiers 1-3 each have 1/3 | Strong | DEFER | Pedagogically valid, but outside this limited 24-row packet after selecting the six strongest cleaner pools. |
| 8 | 廣東話 | iVsI | 6/15; tiers 1-3 each have 1/3 | Strong | DEFER | Clean pool remains, but Mandarin and Korean iVsI outrank it for this limited batch. |
| 9 | 日本語 | iVsI | 6/15; tiers 1-3 each have 1/3 | Strong | DEFER | Clean and useful, but deferred to keep Batch 009 limited and avoid over-expanding vowel rows. |
| 10 | 日本語 | aVsUh | 6/15; tiers 1-3 each have 1/3 | Adequate | DEFER | Valid early-tier gap, but the selected packet prioritizes larger learner segments and more reusable pools. |
| 11 | 日本語 | sTheta | 6/15; tiers 1-3 each have 1/3 | Adequate | DEFER | Valid contrast, but lower priority than the selected theta/s groups and deferred under the six-group cap. |

## 5. Selected Batch 009 Packet

| L1 | Group | Pair | Tier | Position | IPA 1 | IPA 2 | Confidence | Reason |
|---|---|---|---:|---|---|---|---|---|
| 中文 | iVsI | sheep/ship | 1 | medial | /ʃiːp/ | /ʃɪp/ | High-confidence | Familiar, clean i/ih contrast not already present in Mandarin. |
| 中文 | iVsI | bean/bin | 1 | medial | /biːn/ | /bɪn/ | High-confidence | Common early vowel pair with clear tense/lax contrast. |
| 中文 | iVsI | feel/fill | 2 | medial | /fiːl/ | /fɪl/ | High-confidence | Familiar lexical pair that fills tier-2 variety without dialect risk. |
| 中文 | iVsI | reed/rid | 2 | medial | /riːd/ | /rɪd/ | High-confidence | Clean vowel-only contrast and useful high-frequency words. |
| 한국어 | iVsI | peel/pill | 1 | medial | /piːl/ | /pɪl/ | High-confidence | Clean early i/ih pair not already present in Korean. |
| 한국어 | iVsI | bean/bin | 1 | medial | /biːn/ | /bɪn/ | High-confidence | Familiar vowel contrast with low TTS risk. |
| 한국어 | iVsI | feel/fill | 2 | medial | /fiːl/ | /fɪl/ | High-confidence | Common pair that improves tier-2 rotation. |
| 한국어 | iVsI | reed/rid | 2 | medial | /riːd/ | /rɪd/ | High-confidence | Clean contrast and useful vocabulary. |
| 한국어 | thetaS | thaw/saw | 1 | initial | /θɔː/ | /sɔː/ | High-confidence | Familiar theta/s initial pair with clean contrast. |
| 한국어 | thetaS | thumb/sum | 1 | initial | /θʌm/ | /sʌm/ | High-confidence | Common words and strong initial contrast. |
| 한국어 | thetaS | thought/sought | 2 | initial | /θɔːt/ | /sɔːt/ | High-confidence | Clean initial theta/s contrast and useful classroom vocabulary. |
| 한국어 | thetaS | thank/sank | 2 | initial | /θæŋk/ | /sæŋk/ | High-confidence | High-value functional word plus clear minimal contrast. |
| ภาษาไทย | vF | vast/fast | 1 | initial | /væst/ | /fæst/ | High-confidence | Clean initial v/f pair and common adjectives. |
| ภาษาไทย | vF | veil/fail | 1 | initial | /veɪl/ | /feɪl/ | High-confidence | Clear v/f contrast with familiar word shapes. |
| ภาษาไทย | vF | vault/fault | 2 | initial | /vɔːlt/ | /fɔːlt/ | High-confidence | Clean initial contrast and useful vocabulary. |
| ภาษาไทย | vF | view/few | 2 | initial | /vjuː/ | /fjuː/ | High-confidence | Common words with clear v/f onset contrast. |
| العربية | thetaS | thaw/saw | 1 | initial | /θɔː/ | /sɔː/ | High-confidence | Clean early theta/s pair not already present in Arabic. |
| العربية | thetaS | thumb/sum | 1 | initial | /θʌm/ | /sʌm/ | High-confidence | Familiar words and strong initial contrast. |
| العربية | thetaS | thought/sought | 2 | initial | /θɔːt/ | /sɔːt/ | High-confidence | Reusable, dialect-safe theta/s candidate. |
| العربية | thetaS | thank/sank | 2 | initial | /θæŋk/ | /sæŋk/ | High-confidence | High learner value and clean phoneme-only contrast. |
| Русский | thetaS | thaw/saw | 1 | initial | /θɔː/ | /sɔː/ | High-confidence | Clean theta/s pair and good early-tier variety. |
| Русский | thetaS | thumb/sum | 1 | initial | /θʌm/ | /sʌm/ | High-confidence | Familiar initial contrast with low quality risk. |
| Русский | thetaS | thought/sought | 2 | initial | /θɔːt/ | /sɔːt/ | High-confidence | Clean reusable pair and useful vocabulary. |
| Русский | thetaS | thank/sank | 2 | initial | /θæŋk/ | /sæŋk/ | High-confidence | High-value theta/s candidate with clear contrast. |

## 6. Count Reconciliation

| L1 | Group | Selected Count | Expected Import Count | Notes |
|---|---|---:|---:|---|
| 中文 | iVsI | 4 | 4 | Adds two tier-1 and two tier-2 rows; does not attempt full numeric target closure. |
| 한국어 | iVsI | 4 | 4 | Adds two tier-1 and two tier-2 rows. |
| 한국어 | thetaS | 4 | 4 | Adds two tier-1 and two tier-2 rows. |
| ภาษาไทย | vF | 4 | 4 | Adds two tier-1 and two tier-2 rows. |
| العربية | thetaS | 4 | 4 | Adds two tier-1 and two tier-2 rows. |
| Русский | thetaS | 4 | 4 | Adds two tier-1 and two tier-2 rows. |
| Total |  | 24 | 24 | Within the required 24-36 pair range and 4-6 group range. |

## 7. Explicit Exclusions

Confirmed:

- no beer/veer
- no Medium candidates
- no Deferred candidates
- no Rejected candidates
- no SCARCITY_LIMITED groups
- no QUALITY_LIMITED groups
- no product-gated groups
- no target-policy changes
- no schema/category/group changes

## 8. Duplicate / Conflict Checks

Exact duplicate check: the selected 24 rows were checked against the target L1 categories; no selected pair is already present in the same L1.

Reverse duplicate check: no selected row appears in reverse word order within the same target L1.

Same-L1 cross-group check: no selected row appears as an exact or reverse pair in another group within the same target L1.

Cross-L1 reuse policy: deliberate cross-L1 reuse is allowed and used here. Reusing the same clean English pair across several L1s is acceptable when the target contrast, group ID, IPA, tier, and position remain valid for that L1.

## 9. TTS / Manual QA Notes

- `thaw/saw` and `thought/sought` should be manually spot-checked in the configured TTS voice for clear /θ/ onset and for vowel consistency across the pair.
- `view/few` should be spot-checked for onset clarity, especially that `few` keeps /fjuː/ rather than being overly reduced.
- No content-policy, alcohol-vocabulary, slang, or schema issues were identified in the selected packet.
