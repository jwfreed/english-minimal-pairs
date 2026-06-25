# app-042: Batch 005B Import + Safe-Maximization Audit

> **Created by:** `app-042-pair-expansion-batch-005b-max-import`
> **Source baseline:** PR #15 — app-041 merge commit `c0273d880e71a759bf9cb53ea736ecfd41ab1be1`
> **Branch:** `app-042-pair-expansion-batch-005b-max-import`

---

## 1. Purpose

This document records all import decisions made in app-042:

1. **Batch 005B import:** All 28 High-confidence candidates from
   `docs/pair-expansion-batch-005-selection-audit.md` (Slots 9–13).
2. **Safe-maximization pass:** 18 additional High-confidence pairs for the top three
   underfilled existing Español contrast groups, identified after Batch 005B validation.

---

## 2. Pre-Import Baseline (post-app-041)

| Metric | Value | Source |
|---|---:|---|
| Existing pair count | 570 | `validate:data` |
| Missing pairs | 482 | `audit:pair-targets` |
| Underfilled slots | 349 | `audit:pair-targets` |
| Fill percentage | 54% | `audit:pair-targets` |

---

## 3. Batch 005B Imports (28 pairs)

All 28 candidates imported from the audited packet in
`docs/pair-expansion-batch-005-selection-audit.md` Section 8.3.

### Slot 9: Русский / aVsUh — æ/ʌ — 6 pairs

File: `src/constants/minimalPairs/russian.ts` | Group ID: `aVsUh`

| word1 | word2 | IPA1 | IPA2 | Tier | Position | Notes |
|---|---|---|---|---:|---|---|
| cat | cut | /kæt/ | /kʌt/ | 1 | medial | Not in Russian/aVsUh; in Indonesian/Vietnamese T1 (different L1) |
| hat | hut | /hæt/ | /hʌt/ | 1 | medial | Common; not in Russian/aVsUh |
| bag | bug | /bæɡ/ | /bʌɡ/ | 2 | medial | Common; not in Russian/aVsUh |
| mad | mud | /mæd/ | /mʌd/ | 2 | medial | Common; not in Russian/aVsUh |
| match | much | /mætʃ/ | /mʌtʃ/ | 3 | medial | Common; not in Russian/aVsUh |
| ran | run | /ræn/ | /rʌn/ | 3 | medial | Common; not in Russian/aVsUh |

### Slot 10: Русский / iVsI — iː/ɪ — 6 pairs

File: `src/constants/minimalPairs/russian.ts` | Group ID: `iVsI`

| word1 | word2 | IPA1 | IPA2 | Tier | Position | Notes |
|---|---|---|---|---:|---|---|
| bean | bin | /biːn/ | /bɪn/ | 1 | medial | Common; not in Russian/iVsI |
| keen | kin | /kiːn/ | /kɪn/ | 1 | medial | Common; not in Russian/iVsI |
| reed | rid | /riːd/ | /rɪd/ | 2 | medial | Common; not in Russian/iVsI |
| deep | dip | /diːp/ | /dɪp/ | 2 | medial | Common; not in Russian/iVsI |
| seal | sill | /siːl/ | /sɪl/ | 3 | medial | Common; not in Russian/iVsI |
| heap | hip | /hiːp/ | /hɪp/ | 3 | medial | Common; not in Russian/iVsI |

### Slot 11: हिन्दी / اردو / zS — z/s — 6 pairs

File: `src/constants/minimalPairs/hindu_urdu.ts` | Group ID: `zS`

| word1 | word2 | IPA1 | IPA2 | Tier | Position | Notes |
|---|---|---|---|---:|---|---|
| zap | sap | /zæp/ | /sæp/ | 1 | initial | Same pool as Vietnamese/zS; not in Hindi-Urdu/zS |
| zinc | sink | /zɪŋk/ | /sɪŋk/ | 1 | initial | Common; not in Hindi-Urdu/zS |
| rise | rice | /raɪz/ | /raɪs/ | 2 | final | Common; not in Hindi-Urdu/zS |
| maze | mace | /meɪz/ | /meɪs/ | 2 | final | Common; not in Hindi-Urdu/zS |
| phase | face | /feɪz/ | /feɪs/ | 3 | final | Common; not in Hindi-Urdu/zS |
| prize | price | /praɪz/ | /praɪs/ | 3 | final | Common; not in Hindi-Urdu/zS |

### Slot 12: Tiếng Việt / ethD — ð/d — 4 pairs

File: `src/constants/minimalPairs/vietnamese.ts` | Group ID: `ethD`

**Note:** Pool limitation inherited from Indonesian/ethD (audit Section 8.1 Slot 4). Only 4
High-confidence candidates are available at T1–T3. No filler pairs were invented to reach 6.

| word1 | word2 | IPA1 | IPA2 | Tier | Position | Notes |
|---|---|---|---|---:|---|---|
| those | doze | /ðoʊz/ | /doʊz/ | 1 | initial | Common; not in Vietnamese/ethD |
| father | fodder | /ˈfɑːðər/ | /ˈfɑːdər/ | 2 | medial | Common; medial ð/d |
| lather | ladder | /ˈlæðər/ | /ˈlædər/ | 3 | medial | Common; medial ð/d |
| seethe | seed | /siːð/ | /siːd/ | 3 | final | Common; final ð/d |

### Slot 13: Tiếng Việt / thetaT — θ/t — 6 pairs

File: `src/constants/minimalPairs/vietnamese.ts` | Group ID: `thetaT`

| word1 | word2 | IPA1 | IPA2 | Tier | Position | Notes |
|---|---|---|---|---:|---|---|
| thigh | tie | /θaɪ/ | /taɪ/ | 1 | initial | Common; not in Vietnamese/thetaT |
| thorn | torn | /θɔːrn/ | /tɔːrn/ | 1 | initial | Common; not in Vietnamese/thetaT |
| thought | taught | /θɔːt/ | /tɔːt/ | 2 | initial | Common; not in Vietnamese/thetaT |
| three | tree | /θriː/ | /triː/ | 2 | initial | θr/tr cluster; not in Vietnamese/thetaT |
| thread | tread | /θrɛd/ | /trɛd/ | 3 | initial | Common; not in Vietnamese/thetaT |
| threw | true | /θruː/ | /truː/ | 3 | initial | Common; not in Vietnamese/thetaT |

### Batch 005B Summary

| Slot | L1 | Group | Contrast | Pairs |
|---:|---|---|---|---:|
| 9 | Русский | aVsUh | æ/ʌ | 6 |
| 10 | Русский | iVsI | iː/ɪ | 6 |
| 11 | हिन्दी / اردو | zS | z/s | 6 |
| 12 | Tiếng Việt | ethD | ð/d | 4 |
| 13 | Tiếng Việt | thetaT | θ/t | 6 |
| **Total** | | | | **28** |

---

## 4. Safe-Maximization Pass — Español Groups (18 pairs)

### Selection Rationale

After Batch 005B import, `npm run audit:pair-targets` ranked Español/aVsE (priority 1),
Español/thetaS (priority 2), and Español/uhVsAh (priority 3) as the highest-value remaining
underfilled slots. All three groups:

- Exist in `src/constants/minimalPairs/spanish.ts`
- Were deferred from Batch 005 for batch management reasons only (audit Section 5, notes 6),
  not for quality, pool, or candidate concerns — no individual pairs in these groups were
  evaluated as Medium, Deferred, or Rejected
- Have abundant clean, common, content-neutral candidate pools

Each candidate below independently satisfies all High-confidence rubric gates:
real English word, clean minimal pair (one target contrast only), accurate IPA, correct group ID
and position, no exact/reverse/cross-group duplicate within Español, content-neutral,
no TTS concern, appropriate for A2–B2 learners.

### Safe-Max Slot A: Español / aVsE — æ/ɛ — 6 pairs

File: `src/constants/minimalPairs/spanish.ts` | Group ID: `aVsE`
Existing (pre-app-042): bad/bed T1, pan/pen T2, dad/dead T3, bat/bet T4, band/bend T5, ham/hem T6

| word1 | word2 | IPA1 | IPA2 | Tier | Position | Justification |
|---|---|---|---|---:|---|---|
| man | men | /mæn/ | /mɛn/ | 1 | medial | Very common; clean æ/ɛ; same pair in Hindi-Urdu/aVsE T1 (different L1) |
| sat | set | /sæt/ | /sɛt/ | 1 | medial | Both common; clean æ/ɛ; not in any Spanish group |
| gas | guess | /ɡæs/ | /ɡɛs/ | 2 | medial | Both common; clean æ/ɛ; same pair in Hindi-Urdu/aVsE T2 |
| sad | said | /sæd/ | /sɛd/ | 2 | medial | Both common; clean æ/ɛ; same pair in Hindi-Urdu/aVsE T2 |
| land | lend | /lænd/ | /lɛnd/ | 3 | medial | Both common; clean æ/ɛ; same pair in Hindi-Urdu/aVsE T3 |
| mat | met | /mæt/ | /mɛt/ | 3 | medial | Both common; clean æ/ɛ; same pair in Hindi-Urdu/aVsE T3 |

### Safe-Max Slot B: Español / thetaS — θ/s — 6 pairs

File: `src/constants/minimalPairs/spanish.ts` | Group ID: `thetaS`
Existing (pre-app-042): thin/sin T1, thick/sick T2, think/sink T3, theme/seem T4, mouth/mouse T5, path/pass T6

| word1 | word2 | IPA1 | IPA2 | Tier | Position | Justification |
|---|---|---|---|---:|---|---|
| thaw | saw | /θɔː/ | /sɔː/ | 1 | initial | Both very common; clean θ/s initial; not in any Spanish group |
| thumb | sum | /θʌm/ | /sʌm/ | 1 | initial | Both common; clean θ/s initial; not in any Spanish group |
| thought | sought | /θɔːt/ | /sɔːt/ | 2 | initial | Both very common; clean θ/s initial; not in any Spanish group |
| thank | sank | /θæŋk/ | /sæŋk/ | 2 | initial | Both common; clean θ/s initial; not in any Spanish group |
| faith | face | /feɪθ/ | /feɪs/ | 3 | final | Both common; clean θ/s final; appears reversed (face/faith) in Japanese/sTheta; not in Spanish |
| math | mass | /mæθ/ | /mæs/ | 3 | final | Both very common; clean θ/s final; not in any Spanish group |

### Safe-Max Slot C: Español / uhVsAh — ʌ/ɑː — 6 pairs

File: `src/constants/minimalPairs/spanish.ts` | Group ID: `uhVsAh`
Existing (pre-app-042): cut/cot T1, luck/lock T2, cup/cop T3, duck/dock T4, hut/hot T5, sung/song T6

| word1 | word2 | IPA1 | IPA2 | Tier | Position | Justification |
|---|---|---|---|---:|---|---|
| nut | not | /nʌt/ | /nɑːt/ | 1 | medial | Both very common; clean ʌ/ɑː; not in any Spanish group |
| bus | boss | /bʌs/ | /bɑːs/ | 1 | medial | Both common; clean ʌ/ɑː; not in any Spanish group |
| gun | gone | /ɡʌn/ | /ɡɑːn/ | 2 | medial | Both common; clean ʌ/ɑː; not in any Spanish group |
| done | don | /dʌn/ | /dɑːn/ | 2 | medial | Both common; 'don' = to put on; clean ʌ/ɑː; not in any Spanish group |
| sub | sob | /sʌb/ | /sɑːb/ | 3 | medial | Both common; clean ʌ/ɑː; not in any Spanish group |
| bug | bog | /bʌɡ/ | /bɑːɡ/ | 3 | medial | Both common; clean ʌ/ɑː; not in any Spanish group |

### Safe-Max Summary

| Slot | L1 | Group | Contrast | Pairs |
|---:|---|---|---|---:|
| A | Español | aVsE | æ/ɛ | 6 |
| B | Español | thetaS | θ/s | 6 |
| C | Español | uhVsAh | ʌ/ɑː | 6 |
| **Total** | | | | **18** |

---

## 5. Candidates Considered and Not Imported

### beer/veer

Excluded. Standing product policy (alcohol vocabulary, no product-owner approval).
See `docs/pair-expansion-batch-005-selection-audit.md` Section 16.

### Medium-confidence candidates (from Batch 005 audit Section 10)

Not imported. None of these were reconsidered for app-042:
this/dis, thee/dee, weld/veld, wend/vend, bile/vile, base/vase, wale/vale, writhe/ride.

### Русский/wV T3

Still deferred. Audit documented that no High-confidence candidate was found. Pool remains
exhausted at the clean end. Not addressed in app-042.

### Português/aVsE, ethD (Priority Backlog ranks 4–5)

Not imported. Português was not expanded in app-041 or Batch 005A/B scope. Deferring both
groups to Batch 006 maintains the batch-per-major-L1 discipline. Pool is clean and will
remain available.

### Türkçe groups (Priority Backlog ranks 7–10)

Not imported. The app-040 audit recommended addressing all four Turkish groups together in
Batch 006 for cleaner batch-per-L1 structure. Türkçe was last expanded in Batch 003.

### All groups at Priority Backlog ranks 11 and below

Not imported. These were lower-priority and either lack pre-audited pools for app-042 or
were explicitly scoped to Batch 006 in the original selection strategy.

---

## 6. Exclusion Confirmations

| Check | Status |
|---|---|
| beer/veer absent | ✓ Not imported |
| Medium-confidence candidates absent | ✓ Not imported |
| Deferred candidates (specific pairs) absent | ✓ Not imported |
| Rejected candidates absent | ✓ Not imported |
| No new L1 category added | ✓ Still 14 categories |
| No new contrast group added | ✓ Still 5 groups × 14 L1s = 70 combinations |
| Schema unchanged | ✓ Row type and make() function unchanged |
| Existing group IDs stable | ✓ No rename |
| No existing pair modified or deleted | ✓ Only appended |

---

## 7. Post-Import Inventory

| Metric | Before app-042 | After app-042 | Delta | Source |
|---|---:|---:|---:|---|
| Existing pairs | 570 | 616 | +46 | `validate:data` |
| Missing pairs | 482 | 436 | −46 | `audit:pair-targets` |
| Underfilled slots | 349 | 327 | −22 | `audit:pair-targets` |
| Complete slots | 51 | 93 | +42 | `audit:pair-targets` |
| Fill percentage | 54% | 59% | +5 pp | `audit:pair-targets` |

---

## 8. Validation Commands Run

| Command | Result |
|---|---|
| `npm run validate:data` (pre-safe-max, post-005B) | Passed — 14 categories valid |
| `npm run validate:data` (post-safe-max) | Passed — 14 categories valid |
| `npm run audit:pair-targets` (post-005B) | 598 pairs, 57% fill |
| `npm run audit:sparse-tiers` (post-safe-max) | 317 single-pair tiers (down from 362) |
| `node scripts/audit-pair-expansion-targets.js --write` | targets doc regenerated |
| `npm run audit:pair-targets` (final) | 616 pairs, 59% fill |
| `npm run typecheck` | Passed — no type errors |
| `npm test` | Passed — all tests green |
| `git diff --check` | No whitespace errors |

---

## 9. TTS / Manual QA Notes

**Inherited from app-041:**

- **seethe/seed** — imported in app-041 (Indonesian/ethD) and again in app-042
  (Vietnamese/ethD). Final /ð/ in "seethe" may be weakly voiced in some TTS engines.
  Listening check recommended before audio asset generation.
- **lather/ladder** — same note. Medial /ð/ vs /d/ should receive TTS spot-check.
- **her/err** — imported in app-039 (Russian/hZero). TTS rendering of "err" (/ɜːr/)
  should be verified.

**New in app-042:**

- **father/fodder** (Vietnamese/ethD T2) — rhotic AmE /ˈfɑːðər/ vs /ˈfɑːdər/; contrast
  is preserved in both rhotic and non-rhotic accents. TTS likely stable.
- **thought/sought** (Español/thetaS T2) — both /θɔːt/ and /sɔːt/; straightforward
  for TTS. No concern.
- **thank/sank** (Español/thetaS T2) — both initial consonant contrast; standard. No concern.
- **faith/face** (Español/thetaS T3) — final /θ/ vs /s/; reversed version exists in
  Japanese/sTheta. Same TTS caution as other final /θ/ words.
- **math/mass** (Español/thetaS T3) — final /θ/ vs /s/; standard. Low TTS risk.
- **done/don** (Español/uhVsAh T2) — TTS renders both correctly in isolation. No concern.

---

## 10. Files Changed

- `src/constants/minimalPairs/russian.ts` — aVsUh +6, iVsI +6
- `src/constants/minimalPairs/hindu_urdu.ts` — zS +6
- `src/constants/minimalPairs/vietnamese.ts` — ethD +4, thetaT +6
- `src/constants/minimalPairs/spanish.ts` — aVsE +6, thetaS +6, uhVsAh +6
- `docs/pair-expansion-targets.md` — regenerated by script
- `docs/pair-expansion-batch-005b-max-import-audit.md` — this file (new)
