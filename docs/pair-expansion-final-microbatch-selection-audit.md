# Final Micro-Batch Selection Audit

## Executive Verdict

Proceed with final micro-batch

Repository evidence supports one last High-confidence packet before Dataset v1 freezes. The packet should stay limited to the remaining clean early-tier FILL_NEXT groups and should not reopen ethD, uVsU, w/v-family, product-policy, schema, category, or target-policy decisions.

The selected packet contains 28 High-confidence pairs across 5 groups. It uses only existing L1 categories, existing contrast groups, real English words, clean minimal pairs, previously established IPA conventions, and cross-L1 reuse patterns already accepted in prior imports. The selection is based on learner impact and candidate quality, not numeric target completion.

## Baseline Inventory

Live repository output matched the expected prompt baseline.

| Metric | Value | Source |
|---|---:|---|
| Existing pairs | 785 | `npm run validate:data`, `npm run audit:pair-targets` |
| Missing pairs | 267 | `npm run audit:pair-targets` |
| Underfilled slots | 236 | `npm run audit:pair-targets` |
| Complete slots | 184 | `npm run audit:pair-targets` |
| Fill percentage | 75% | `npm run audit:pair-targets` |
| Sparse single-pair tiers | 211 | `npm run audit:sparse-tiers` |

## Methodology

Candidate quality was evaluated by reading the current pair files, the live target and sparse-tier audits, `docs/post-app-051-coverage-audit.md`, and the prior selection/import audits that established reusable High-confidence pools. The current source files were treated as authoritative for duplicates, reverse duplicates, tier state, group IDs, contrast order, and IPA conventions.

Pedagogical value outweighed numeric completion. A candidate was selected only when it improved an early-tier learner bottleneck, used common vocabulary, preserved a clean single-contrast minimal pair, and had low dialect and TTS risk. Cross-L1 reuse was allowed only where the same English pair remained valid for the target L1 and did not create a same-L1 exact, reverse, or cross-group duplicate.

The rejection standard was conservative: uncertain candidates were rejected or left out. Medium-confidence, Deferred, Rejected, product-sensitive, obscure, dialect-fragile, schema-changing, group-changing, and target-policy-changing candidates were excluded.

No other remaining group was promoted into scope. Hindi/Urdu `wV`, ethD residues, uVsU residues, and w/v-family residues remain scarcity-limited or policy-limited under the existing repository audits.

## Group Reviews

| L1 | Group | Remaining High Pool | Candidate Quality | Decision | Selected Count | Rationale |
|---|---|---:|---|---|---:|---|
| हिन्दी / اردو | thetaT | 6 | Strong | SELECT | 6 | High learner relevance, severe early-tier sparsity, and a proven theta/t pool from prior imports. Selected rows fill tiers 1-3 without weak fillers. |
| 廣東話 | iVsI | 6 | Strong | SELECT | 6 | Cantonese iː/ɪ remains a clean early-tier vowel gap. Selected rows are common, TTS-safe, and already fit accepted iVsI conventions. |
| 日本語 | iVsI | 6 | Strong | SELECT | 6 | Japanese iː/ɪ is learner-salient and still has only one pair in tiers 1-3. The selected pool is clean and reusable. |
| 日本語 | aVsUh | 6 | Strong | SELECT | 6 | Japanese æ/ʌ remains a high-value vowel contrast with six common, previously validated early-tier candidates available. |
| 日本語 | sTheta | 4 | Adequate but limited | SELECT | 4 | Four strong early-tier s/θ candidates remain. T3 alternatives are reverse duplicates, upper-tier candidates, or weaker than the final-batch bar. |

Pool detail:

| L1 | Group | High-confidence Pool | Medium-confidence Pool | Weak / Excluded Pool |
|---|---|---|---|---|
| हिन्दी / اردو | thetaT | thigh/tie, thorn/torn, thought/taught, three/tree, thread/tread, threw/true | Existing upper-tier residues only; no new Medium candidate selected | w/v-family and ethD residues excluded by prior scarcity decisions |
| 廣東話 | iVsI | peel/pill, bean/bin, feel/fill, reed/rid, seal/sill, heap/hip | Upper-tier target rows such as feet/fit, neat/knit, peach/pitch already exist as singletons and are not a final-batch reason | No weak early-tier iVsI row needed |
| 日本語 | iVsI | peel/pill, bean/bin, feel/fill, reed/rid, seal/sill, heap/hip | Upper-tier target rows such as feet/fit, neat/knit, peach/pitch already exist as singletons and are not a final-batch reason | No weak early-tier iVsI row needed |
| 日本語 | aVsUh | bat/but, hat/hut, bag/bug, mad/mud, pan/pun, match/much | Upper-tier target rows cap/cup, hang/hung, stamp/stump already exist as singletons and are not a final-batch reason | No weak early-tier aVsUh row needed |
| 日本語 | sTheta | saw/thaw, sum/thumb, sought/thought, sank/thank | Upper-tier residues such as sigh/thigh, moss/moth, face/faith already exist as singletons and are not a final-batch reason | reverse duplicates: think/sink, faith/face, math/mass; lower-priority upper-tier rows: mouse/mouth, boss/both, pass/path |

## Selected Final Micro-Batch

| L1 | Group | Pair | IPA | Tier | Position | Confidence | Reason |
|---|---|---|---|---:|---|---|---|
| हिन्दी / اردو | thetaT | thigh/tie | /θaɪ/ /taɪ/ | 1 | initial | High-confidence | Common, clean θ/t onset contrast; already accepted in prior thetaT pools. |
| हिन्दी / اردو | thetaT | thorn/torn | /θɔːrn/ /tɔːrn/ | 1 | initial | High-confidence | Common concrete vocabulary and clean initial contrast. |
| हिन्दी / اردو | thetaT | thought/taught | /θɔːt/ /tɔːt/ | 2 | initial | High-confidence | High-frequency pair with stable IPA and no policy concern. |
| हिन्दी / اردو | thetaT | three/tree | /θriː/ /triː/ | 2 | initial | High-confidence | Flagship learner pair; cluster contrast follows existing repo precedent. |
| हिन्दी / اردو | thetaT | thread/tread | /θrɛd/ /trɛd/ | 3 | initial | High-confidence | Common words; clean θr/tr contrast. |
| हिन्दी / اردو | thetaT | threw/true | /θruː/ /truː/ | 3 | initial | High-confidence | Common, TTS-stable θr/tr contrast. |
| 廣東話 | iVsI | peel/pill | /piːl/ /pɪl/ | 1 | medial | High-confidence | Familiar CVC pair; clean tense/lax vowel contrast. |
| 廣東話 | iVsI | bean/bin | /biːn/ /bɪn/ | 1 | medial | High-confidence | Common early vowel pair with low TTS risk. |
| 廣東話 | iVsI | feel/fill | /fiːl/ /fɪl/ | 2 | medial | High-confidence | Very common words; strong learner value. |
| 廣東話 | iVsI | reed/rid | /riːd/ /rɪd/ | 2 | medial | High-confidence | Clean vowel-only contrast and accepted prior usage. |
| 廣東話 | iVsI | seal/sill | /siːl/ /sɪl/ | 3 | medial | High-confidence | Common enough for practice; clean contrast. |
| 廣東話 | iVsI | heap/hip | /hiːp/ /hɪp/ | 3 | medial | High-confidence | Clear medial vowel contrast; standard vocabulary. |
| 日本語 | iVsI | peel/pill | /piːl/ /pɪl/ | 1 | medial | High-confidence | Familiar CVC pair; clean iː/ɪ contrast. |
| 日本語 | iVsI | bean/bin | /biːn/ /bɪn/ | 1 | medial | High-confidence | Common, imageable words; low dialect risk. |
| 日本語 | iVsI | feel/fill | /fiːl/ /fɪl/ | 2 | medial | High-confidence | Very common words and strong ESL value. |
| 日本語 | iVsI | reed/rid | /riːd/ /rɪd/ | 2 | medial | High-confidence | Clean contrast; accepted in prior High-confidence pools. |
| 日本語 | iVsI | seal/sill | /siːl/ /sɪl/ | 3 | medial | High-confidence | Standard words and clean vowel-only distinction. |
| 日本語 | iVsI | heap/hip | /hiːp/ /hɪp/ | 3 | medial | High-confidence | Clear iː/ɪ contrast; no same-L1 duplicate. |
| 日本語 | aVsUh | bat/but | /bæt/ /bʌt/ | 1 | medial | High-confidence | Very common words; clean æ/ʌ contrast. |
| 日本語 | aVsUh | hat/hut | /hæt/ /hʌt/ | 1 | medial | High-confidence | Common concrete vocabulary; low TTS risk. |
| 日本語 | aVsUh | bag/bug | /bæɡ/ /bʌɡ/ | 2 | medial | High-confidence | Common words; clean medial vowel contrast. |
| 日本語 | aVsUh | mad/mud | /mæd/ /mʌd/ | 2 | medial | High-confidence | Common and pedagogically transparent. |
| 日本語 | aVsUh | pan/pun | /pæn/ /pʌn/ | 3 | medial | High-confidence | Common enough; clean contrast and prior repo precedent. |
| 日本語 | aVsUh | match/much | /mætʃ/ /mʌtʃ/ | 3 | medial | High-confidence | Common words; clear æ/ʌ contrast with appropriate T3 complexity. |
| 日本語 | sTheta | saw/thaw | /sɔː/ /θɔː/ | 1 | initial | High-confidence | Common words; clean s/θ onset contrast. |
| 日本語 | sTheta | sum/thumb | /sʌm/ /θʌm/ | 1 | initial | High-confidence | Common vocabulary; only initial target contrast differs. |
| 日本語 | sTheta | sought/thought | /sɔːt/ /θɔːt/ | 2 | initial | High-confidence | Standard words; clean initial contrast under repo IPA conventions. |
| 日本語 | sTheta | sank/thank | /sæŋk/ /θæŋk/ | 2 | initial | High-confidence | Clear s/θ onset contrast and useful classroom vocabulary. |

## Count Reconciliation

| L1 | Group | Count |
|---|---|---:|
| हिन्दी / اردو | thetaT | 6 |
| 廣東話 | iVsI | 6 |
| 日本語 | iVsI | 6 |
| 日本語 | aVsUh | 6 |
| 日本語 | sTheta | 4 |
| Total |  | 28 |

No target size is required. The packet deliberately stops at 28 because the remaining possible rows are not strong enough to justify extending Dataset v1.

## Rejected Candidates

| Candidate | Reason Rejected |
|---|---|
| Japanese/sTheta `think/sink` | Reverse duplicate of existing `sink/think`. |
| Japanese/sTheta `faith/face` | Reverse duplicate of existing `face/faith`. |
| Japanese/sTheta `math/mass` | Reverse duplicate of existing `mass/math`. |
| Japanese/sTheta upper-tier residues such as `mouse/mouth`, `boss/both`, `pass/path` | Not selected for final import: upper-tier or lower-priority residues, not needed to justify Dataset v1 freeze. |
| Hindi/Urdu `wV` residue | Not reopened; repository audit classifies the w/v-family residue as scarcity-limited. |
| ethD and uVsU residues | Not reopened; prior audits classify these pools as structurally scarce or policy-limited. |

## Explicit Exclusions

Confirmed:

- no beer/veer
- no Medium candidates
- no Deferred candidates
- no Rejected candidates
- no policy changes
- no schema changes
- no category changes
- no group changes

## Dataset Freeze Recommendation

Yes.

If this 28-pair packet is imported, Dataset v1 should freeze. The remaining deficits would not justify another ordinary expansion batch under the current standards. They are mostly scarcity-limited groups, policy-limited groups, upper-tier rotation gaps, Medium-confidence residues, reverse duplicates, or target-matrix gaps where clean candidate supply is weaker than the learner value of importing them.

Dataset v1 should freeze after the packet and leave target reductions, ethD/uVsU policy, w/v-family scarcity, and TTS/manual QA as future product decisions rather than Dataset v1 blockers.
