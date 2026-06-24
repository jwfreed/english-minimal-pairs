# Pair Expansion Candidates - Batch 003 Selection Audit

> **Status:** Audit and selection packet only. No pairs in this document have been added to app data.
> Human review and approval are required before any pair is added to `src/constants/minimalPairs/*.ts`.
> Draft IPA is provided for review orientation only - it is not production-ready.
> Created by: `app-036-pair-expansion-batch-003-selection-audit`

---

## Scope

This document is the Batch 003 candidate-selection audit. It identifies a conservative
High-confidence packet for a later app-037 data-import PR after the merged app-035
Batch 002 import.

**What this document does:**
- Reproduces the current post-app-035 inventory snapshot from repo scripts
- Ranks valuable underfilled L1/contrast slots for the next import batch
- Selects 24 High-confidence candidate pairs for later import
- Documents duplicate checks, tier assignments, and selection rationale
- Separates Medium/needs-review candidates from the import-ready packet
- Lists rejected and deferred candidates with reasons

**What this document does not do:**
- Add, edit, or delete any pairs in `src/constants/minimalPairs/*.ts`
- Change scheduler, mastery, recommendation, UI, persistence, analytics, or i18n behavior
- Regenerate generated reports
- Start app-037
- Constitute final linguistic, IPA, or TTS approval

---

## Baseline and Scripts

Baseline branch: `app-036-pair-expansion-batch-003-selection-audit`

Baseline commit: `bb0dfa2cd0367ac7b7d452127d5a7846b622f460`

Required app-035 merge commit present on `main`: yes.

Scripts run before selection:

```bash
npm run audit:pair-targets
npm run audit:sparse-tiers
npm run validate:data
```

Files inspected:
- `docs/pair-expansion-targets.md`
- `docs/pair-expansion-batch-002-selection-audit.md`
- `docs/pair-expansion-candidates-batch-001.md`
- `docs/pair-expansion-safe-candidates-batch-001.md`
- `src/constants/minimalPairs.ts`
- `src/constants/minimalPairs/cantonese.ts`
- `src/constants/minimalPairs/turkish.ts`
- `src/constants/minimalPairs/thai.ts`
- `src/constants/minimalPairs/hindu_urdu.ts`
- `scripts/audit-pair-expansion-targets.js`
- `scripts/audit-sparse-tiers.js`
- `scripts/validate-data.js`

---

## Inventory Snapshot

Generated from `npm run audit:pair-targets` and `npm run audit:sparse-tiers` on commit
`bb0dfa2cd0367ac7b7d452127d5a7846b622f460`.

| Metric | Count |
|---|---:|
| Total categories | 14 |
| Total category × group combinations | 70 |
| Total target slots | 420 |
| Complete slots | 27 |
| Underfilled slots | 393 |
| Total missing pairs | 570 |
| Exception slots | 0 |
| Existing pair count | 482 |
| Target pair count | 1050 |
| Fill percentage | 46% |

Sparse-tier inventory:

| Metric | Count |
|---|---:|
| Total contrast groups | 70 |
| Total group/tier combinations present | 420 |
| Healthy tiers with 2+ pairs | 33 |
| Single-pair tiers | 387 |
| Possible missing-tier gaps | 0 |

The current matrix matches the expected post-app-035 values exactly:

- Existing pairs: 482
- Missing pairs: 570
- Underfilled slots: 393
- Fill percentage: 46%

`npm run validate:data` passed for 14 categories.

---

## Selection Basis

Batch 001/app-030 imported 23 pairs across:
- 日本語 / bV
- 中文 / vW
- Español / iVsI
- العربية / pB
- فارسی / wV

Batch 002/app-035 imported 29 pairs across:
- Tiếng Việt / rL
- 한국어 / fP
- Bahasa Indonesia / vF
- Português / thetaT
- Русский / wV

Batch 003 therefore prioritizes L1s not expanded in app-030 or app-035 while still selecting
from high-value, underfilled target-matrix slots. The selected packet also avoids repeating
one contrast family across the whole batch.

### Candidate-Selection Risks Checked

- Same-category duplicate or reverse-duplicate pair
- Non-real, archaic, rare, slang, proper-noun, culturally loaded, offensive, or unsafe words
- IPA mismatch or dialect-sensitive pronunciation
- Non-minimal or near-minimal pairs
- Wrong contrast group
- Weak L1 learner relevance
- Over-concentration in one L1 or one recently expanded contrast
- Importing data instead of documenting candidates

### Priority Scoring Rubric

Each slot was scored 0-2 on five dimensions.

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Underfill severity | Mildly under target | Clearly under | HIGH sparse T1-T3 slots |
| Learner impact | Lower-priority | Plausible issue | Well-known learner contrast |
| Candidate availability | Few safe pairs | Some safe pairs | Many safe pairs |
| Data balance | Repeats recent L1/contrast focus | Neutral | Improves L1 and contrast balance |
| Risk profile | High ambiguity or safety concern | Moderate | Low risk, easy to validate |

---

## Ranked Slots for Batch 003

| Rank | L1 | Group ID | Contrast | Matrix status | Score | Why prioritized |
|---:|---|---|---|---|---:|---|
| 1 | 廣東話 | rL | r/l | HIGH T1 and T3 gaps; T2 already has 3 pairs | 10/10 | Deferred from Batch 002, strong Cantonese learner relevance, safe candidate pool |
| 2 | Türkçe | aVsUh | æ/ʌ | HIGH T1-T3 gaps | 10/10 | Turkish has not been expanded yet; common vowel contrast; many familiar CVC candidates |
| 3 | ภาษาไทย | zS | z/s | HIGH T1-T3 gaps | 10/10 | Thai has not been expanded yet; final and initial z/s pairs are abundant and safe |
| 4 | हिन्दी / اردو | aVsE | æ/ɛ | HIGH T1-T3 gaps | 10/10 | Hindi-Urdu has not been expanded yet; high-impact vowel contrast; strong safe pool |
| 5 | 한국어 | vB | v/b | HIGH T1-T3 gaps | 7/10 | Valuable but deferred because app-035 already expanded Korean and the candidate pool is narrower |
| 6 | ภาษาไทย | ethD | ð/d | HIGH T1-T3 gaps | 6/10 | Valuable but many plausible pairs have word-frequency, proper-noun, or safety issues |

The selected packet uses ranks 1-4: 24 candidates across 4 L1/contrast slots, 6 candidates
per selected slot.

---

## Batch 003 High-Confidence Candidate Packet

All candidates below passed the audit gates for this document:

- Real English words in standard contemporary use
- Classroom/app-safe content
- Minimal or cleanly contrastive pair for the target group
- No same-category duplicate or reverse duplicate in the current repo data
- Appropriate for early-tier expansion, pending final human IPA/TTS review in app-037

### 廣東話 / rL - r/l contrast

**Existing pairs inspected:** right/light (T1), rate/late (T2), road/load (T2),
rice/lice (T2), rip/lip (T3), rake/lake (T4), correct/collect (T5), crowd/cloud (T6)

**Matrix gap addressed:** T1 missing 2 pairs, T3 missing 2 pairs, T4-T6 each missing 1 pair.

**Duplicate check:** All 6 proposed pairs are absent from `cantonese.ts` rL in both word
order and reversed word order. The same word pairs now exist in `vietnamese.ts` rL after
app-035; cross-L1 reuse is informational and follows the existing repo pattern.

| Tier | Word 1 | Word 2 | IPA 1 | IPA 2 | Position | Rationale |
|---:|---|---|---|---|---|---|
| 1 | red | led | /rɛd/ | /lɛd/ | initial | Very common CVC pair; clean r/l contrast |
| 1 | row | low | /roʊ/ | /loʊ/ | initial | Very common words; no coda complexity |
| 3 | rain | lane | /reɪn/ | /leɪn/ | initial | Common vocabulary; stable diphthong and coda |
| 3 | read | lead | /riːd/ | /liːd/ | initial | Very common verbs; importer must use present-tense `read` IPA |
| 4 | rung | lung | /rʌŋ/ | /lʌŋ/ | initial | Both common; adds a nasal coda context |
| 5 | ride | lied | /raɪd/ | /laɪd/ | initial | Both common and safe; later tier because `lied` is less basic than `ride` |

### Türkçe / aVsUh - æ/ʌ contrast

**Existing pairs inspected:** cat/cut (T1), batter/butter (T2), ran/run (T3),
cap/cup (T4), hang/hung (T5), stamp/stump (T6)

**Matrix gap addressed:** T1-T3 each missing 2 pairs.

**Duplicate check:** All 6 proposed pairs are absent from `turkish.ts` aVsUh in both word
order and reversed word order. `bat/but` and `pan/pun` exist in `russian.ts` aVsUh; that
cross-L1 reuse is informational and not a same-category collision.

| Tier | Word 1 | Word 2 | IPA 1 | IPA 2 | Position | Rationale |
|---:|---|---|---|---|---|---|
| 1 | bat | but | /bæt/ | /bʌt/ | medial | Common CVC pair; only vowel differs |
| 1 | hat | hut | /hæt/ | /hʌt/ | medial | Concrete, familiar words; clean vowel contrast |
| 2 | bag | bug | /bæɡ/ | /bʌɡ/ | medial | Common nouns; same onset and coda |
| 2 | mad | mud | /mæd/ | /mʌd/ | medial | Common words; classroom safe |
| 3 | pan | pun | /pæn/ | /pʌn/ | medial | Common words; `pun` is a teachable everyday noun |
| 3 | match | much | /mætʃ/ | /mʌtʃ/ | medial | Very common words; affricate coda adds appropriate tier-3 complexity |

### ภาษาไทย / zS - z/s contrast

**Existing pairs inspected:** zip/sip (T1), zeal/seal (T2), zone/sewn (T3),
zoo/sue (T4), buzz/bus (T5), lies/lice (T6)

**Matrix gap addressed:** T1-T3 each missing 2 pairs.

**Duplicate check:** All 6 proposed pairs are absent from `thai.ts` zS in both word order
and reversed word order. No exact or reversed zS collision was found in any other L1 file.

| Tier | Word 1 | Word 2 | IPA 1 | IPA 2 | Position | Rationale |
|---:|---|---|---|---|---|---|
| 1 | zap | sap | /zæp/ | /sæp/ | initial | Common, clear initial z/s CVC pair |
| 1 | zinc | sink | /zɪŋk/ | /sɪŋk/ | initial | Familiar noun/verb pair; same vowel and coda |
| 2 | raise | race | /reɪz/ | /reɪs/ | final | Very common words; final voicing contrast is clear in isolation |
| 2 | eyes | ice | /aɪz/ | /aɪs/ | final | Very common vocabulary; compact final z/s contrast |
| 3 | rise | rice | /raɪz/ | /raɪs/ | final | Common pair; later tier because final contrast is less salient than onset |
| 3 | phase | face | /feɪz/ | /feɪs/ | final | Common words; useful final-position z/s practice |

### हिन्दी / اردو / aVsE - æ/ɛ contrast

**Existing pairs inspected:** bad/bed (T1), pan/pen (T2), dad/dead (T3),
bat/bet (T4), band/bend (T5), ham/hem (T6)

**Matrix gap addressed:** T1-T3 each missing 2 pairs.

**Duplicate check:** All 6 proposed pairs are absent from `hindu_urdu.ts` aVsE in both word
order and reversed word order. No exact or reversed aVsE collision was found in any other
L1 file.

| Tier | Word 1 | Word 2 | IPA 1 | IPA 2 | Position | Rationale |
|---:|---|---|---|---|---|---|
| 1 | bag | beg | /bæɡ/ | /bɛɡ/ | medial | Common CVC words; clean vowel contrast |
| 1 | man | men | /mæn/ | /mɛn/ | medial | Very common words; high learner value |
| 2 | gas | guess | /ɡæs/ | /ɡɛs/ | medial | Common words; same onset and coda |
| 2 | sad | said | /sæd/ | /sɛd/ | medial | Very common words; `said` is high-frequency |
| 3 | land | lend | /lænd/ | /lɛnd/ | medial | Common verbs/nouns; cluster coda fits tier 3 |
| 3 | mat | met | /mæt/ | /mɛt/ | medial | Common words; compact CVC contrast |

---

## Candidate Summary

| L1 | Group ID | Contrast | New pairs | Tiers addressed | Notes |
|---|---|---|---:|---|---|
| 廣東話 | rL | r/l | 6 | T1 x2, T3 x2, T4 x1, T5 x1 | Fills missing early tiers without touching already-complete T2 |
| Türkçe | aVsUh | æ/ʌ | 6 | T1 x2, T2 x2, T3 x2 | Early-tier vowel expansion |
| ภาษาไทย | zS | z/s | 6 | T1 x2, T2 x2, T3 x2 | Initial and final z/s practice |
| हिन्दी / اردو | aVsE | æ/ɛ | 6 | T1 x2, T2 x2, T3 x2 | Early-tier vowel expansion |
| **Total** | | | **24** | | |

---

## Medium / Needs-Review Candidates

These candidates or slots are plausible but should not be included in the app-037 import-ready
packet without additional human review.

| Candidate or slot | L1 / Contrast | Concern | What needs review |
|---|---|---|---|
| 한국어 / vB slot | Korean / v/b | Valid learner target, but app-035 already expanded Korean/fP and the safe high-frequency v/b pool is narrower after existing van/ban, vest/best, vow/bow, vase/base | Build a dedicated Korean/vB packet with more review time |
| vote / boat | Korean / vB | Plausible minimal pair, but duplicates the word set used elsewhere for b/v directionality | Confirm word order and contrast direction for Korean/vB |
| veil / bail | Korean / vB | Plausible, but `bail` has multiple senses and overlaps with Japanese/bV Batch 001 directionality | Confirm learner familiarity and display clarity |
| Thai / ethD slot | Thai / ð/d | High matrix value, but the clean ð/d candidate pool is small | Review as a dedicated slot rather than forcing weak candidates |
| those / doze | Thai / ethD | Plausible minimal pair; `doze` is lower-frequency than `those` | Confirm vocabulary level and TTS clarity |
| seethe / seed | Any / ethD | Final ð/d contrast is valid, but `seethe` is lower-frequency and emotionally loaded | Confirm teachability and classroom tone |
| bat / but and pan / pun cross-L1 reuse | Turkish / aVsUh | Already appear in Russian/aVsUh | Acceptable if product wants cross-L1 reuse; not a same-category duplicate |
| red / led packet reuse | Cantonese / rL | Same six rL pairs appear in Vietnamese/rL after app-035 | Acceptable if product wants parallel L1 coverage; not a same-category duplicate |

---

## Rejected / Deferred Candidates

| Pair or slot | L1 / Contrast | Rejection or deferral reason |
|---|---|---|
| this / dis | Any / ethD | `dis` is slang; fails standard-register gate |
| than / Dan | Any / ethD | `Dan` is a proper noun; fails real-word/common-vocabulary gate |
| thee / dee | Any / ethD | `thee` is archaic and `dee` is letter-name/informal usage |
| thy / die | Any / ethD | `thy` is archaic; not appropriate for early learner tiers |
| bathe / bade | Any / ethD | `bade` pronunciation and frequency are problematic for broad learner use |
| writhe / ride | Any / ethD | `writhe` is lower-frequency and less suitable for early tiers |
| zed / said | Any / zS | Different vowels in common General American pronunciation; not a clean z/s minimal pair |
| zip / sip | Thai / zS | Already exists in Thai/zS |
| zeal / seal | Thai / zS | Already exists in Thai/zS |
| zone / sewn | Thai / zS | Already exists in Thai/zS |
| bad / bed | Hindi-Urdu / aVsE | Already exists in Hindi-Urdu/aVsE |
| pan / pen | Hindi-Urdu / aVsE | Already exists in Hindi-Urdu/aVsE |
| dad / dead | Hindi-Urdu / aVsE | Already exists in Hindi-Urdu/aVsE |
| Cantonese / vW | Cantonese / v/w | Valid slot, but Batch 001 already expanded Mandarin/vW and Batch 002 expanded Russian/wV; defer to avoid w/v over-concentration |
| Turkish / uVsU | Turkish / uː/ʊ | Valid slot, but safe high-frequency /uː/ vs /ʊ/ minimal pairs are harder to source without contractions, rare words, or dialect issues |

---

## Recommended app-037 Import Plan

**Suggested next branch:** `app-037-pair-expansion-batch-003-import`

**Import-ready pair count:** 24

Expected future import files:
- `src/constants/minimalPairs/cantonese.ts` - add 6 rL pairs
- `src/constants/minimalPairs/turkish.ts` - add 6 aVsUh pairs
- `src/constants/minimalPairs/thai.ts` - add 6 zS pairs
- `src/constants/minimalPairs/hindu_urdu.ts` - add 6 aVsE pairs
- `docs/pair-expansion-targets.md` - regenerate with `node scripts/audit-pair-expansion-targets.js --write`

Pre-import checklist for app-037:
- Re-read this audit and import only the High-confidence packet
- Verify IPA against a reliable General American reference before adding data
- Confirm TTS output for each pair using the app voice
- Confirm same-category duplicate and reverse-duplicate absence immediately before import
- Preserve existing group IDs, contrast phoneme ordering, and Row tuple structure
- Do not add new L1 categories or new contrast groups

Validation commands for app-037:

```bash
npm run validate:data
npm run audit:pair-targets
npm run audit:sparse-tiers
npm run validate:audio
npm run lint
npm run typecheck
npm test
git diff --check
```

---

## Verification Summary

Audit inputs checked:
- Current generated target matrix from `npm run audit:pair-targets`
- Current sparse-tier inventory from `npm run audit:sparse-tiers`
- Current dataset validity from `npm run validate:data`
- Prior Batch 001 and Batch 002 candidate/audit documents
- Existing same-group pairs in the four target L1 data files
- Same-category duplicate and reverse-duplicate status for all 24 selected candidates

Verified audit snapshot:
- Existing pairs: 482
- Missing pairs: 570
- Underfilled slots: 393
- Fill percentage: 46%
- High-confidence Batch 003 candidates selected: 24

## Scope Check

This app-036 audit does not import pair data. It does not change app behavior, audio,
scheduler/mastery logic, UI, native files, SEO files, dependencies, scripts, tests, or
generated reports. The selected Batch 003 candidates are documented only as the source of
truth for a future app-037 data-import PR.
