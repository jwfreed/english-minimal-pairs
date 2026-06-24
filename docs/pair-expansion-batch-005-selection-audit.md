# Pair Expansion Candidates — Batch 005 Selection Audit

> **Status:** Audit and selection packet only. No pairs in this document have been added to app data.
> Human review and approval are required before any pair is added to `src/constants/minimalPairs/*.ts`.
> Draft IPA is provided for review orientation only — it is not production-ready.
> Created by: `app-040-pair-expansion-batch-005-selection-audit`

---

## 1. Executive Summary

**Outcome:** Complete. A **69-candidate High-confidence packet** was selected across 13 L1/contrast
slots, divided into a recommended Batch 005A (41 pairs, 8 slots) and Batch 005B (28 pairs, 5 slots).
An additional 9 Medium-confidence, 9 Deferred, and 7 Rejected candidates are documented with precise
reasons. All repo inspection commands were run from a clean working tree on `main` at commit
`28236ce`. Post-app-039 baseline is confirmed.

**Priority policy vs. script output:** The planned priority order (Bahasa Indonesia → Vietnamese →
Arabic → others) is confirmed by the current script output. No contradiction was found. Türkçe
(ranks 15–18) and higher-ranked Español slots (aVsE, thetaS, uhVsAh at ranks 5–7) are deferred to
a future batch in favour of cleaner candidate pools and better batch diversity.

**beer/veer:** Explicitly excluded. No product-owner approval is present in this prompt. See
Section 16.

**her/err TTS:** Recorded as a follow-up planning note. Not a blocker for this audit. See
Section 17.

---

## 2. Branch / Repo State

| Field | Value |
|---|---|
| Branch | `main` |
| HEAD commit | `28236ce` — Merge pull request #14 from jwfreed/app-039-pair-expansion-batch-004-import |
| app-039 merge commit present? | **Yes** — `28236ce` is HEAD of `main` |
| Working tree before audit | **Clean** — no uncommitted changes |
| Working tree after audit | Changed only: `docs/pair-expansion-batch-005-selection-audit.md` |

---

## 3. Commands Run

| Command | Result | Notes |
|---|---|---|
| `git status --short --branch` | Clean, `main` | Confirmed pre-audit clean state |
| `git log --oneline -5` | `28236ce` at HEAD | app-039 merge confirmed |
| `npm run validate:data` | **Passed** — 14 categories valid | All L1 files well-formed |
| `npm run audit:pair-targets` | **Passed** — full underfilled slot matrix generated | See Section 5 |
| `npm run audit:sparse-tiers` | **Passed** — 362 single-pair tiers identified | See Section 5 |

---

## 4. Inventory Baseline

| Metric | Value | Source |
|---|---:|---|
| Total categories | 14 | `validate:data` |
| Total category × group combinations | 70 | `audit:pair-targets` |
| Total target slots | 420 | `audit:pair-targets` |
| Complete slots (≥ target pairs) | 51 | `audit:pair-targets` |
| Underfilled slots | 369 | `audit:pair-targets` |
| Total missing pairs | 523 | `audit:pair-targets` |
| Existing pair count | 529 | `audit:pair-targets` |
| Target pair count | 1050 | `audit:pair-targets` |
| Fill percentage | 50% | `audit:pair-targets` |
| Healthy tiers (≥ 2 pairs) | 58 | `audit:sparse-tiers` |
| Single-pair tiers (HIGH + MEDIUM severity) | 362 | `audit:sparse-tiers` |

Observed values match expected post-app-039 inventory exactly.

---

## 5. Target Priorities (from Current Script Output)

Script ranks by missing pairs weighted by tier (T1 ×5, T2 ×4, T3 ×3, T4 ×2, T5–T6 ×1).
All HIGH-severity slots have current=1, target=3 at tiers 1–3 (missing 6 pairs minimum each).

| Script rank | L1 | Group | Contrast | HIGH tiers | Batch 005 action |
|---:|---|---|---|---|---|
| 1 | Bahasa Indonesia | aVsUh | æ/ʌ | 1, 2, 3 | **005A Slot 1** |
| 2 | Bahasa Indonesia | ethD | ð/d | 1, 2, 3 | **005A Slot 4** (partial — pool limited) |
| 3 | Bahasa Indonesia | iVsI | iː/ɪ | 1, 2, 3 | **005A Slot 2** |
| 4 | Bahasa Indonesia | thetaT | θ/t | 1, 2, 3 | **005A Slot 3** |
| 5 | Español | aVsE | æ/ɛ | 1, 2, 3 | Deferred — Batch 006 |
| 6 | Español | thetaS | θ/s | 1, 2, 3 | Deferred — Batch 006 |
| 7 | Español | uhVsAh | ʌ/ɑː | 1, 2, 3 | Deferred — Batch 006 |
| 8 | Português | aVsE | æ/ɛ | 1, 2, 3 | Deferred — Batch 006 |
| 9 | Português | ethD | ð/d | 1, 2, 3 | Deferred — Batch 006 |
| 10 | Português | uVsU | uː/ʊ | 1, 2, 3 | Deferred — pool thin |
| 11 | Tiếng Việt | aVsUh | æ/ʌ | 1, 2, 3 | **005A Slot 5** |
| 12 | Tiếng Việt | ethD | ð/d | 1, 2, 3 | **005B Slot 12** (partial) |
| 13 | Tiếng Việt | thetaT | θ/t | 1, 2, 3 | **005B Slot 13** |
| 14 | Tiếng Việt | zS | z/s | 1, 2, 3 | **005A Slot 6** |
| 15–18 | Türkçe | ethD, iVsI, thetaT, uVsU | multiple | 1, 2, 3 | Deferred — Batch 006 |
| 19 | Русский | aVsUh | æ/ʌ | 1, 2, 3 | **005B Slot 9** |
| 20 | Русский | iVsI | iː/ɪ | 1, 2, 3 | **005B Slot 10** |
| 21 | Русский | thetaS | θ/s | 1, 2, 3 | Deferred — Batch 006 |
| 22 | العربية | ethD | ð/d | 1, 2, 3 | Deferred — Batch 006 |
| 23 | العربية | iVsI | iː/ɪ | 1, 2, 3 | Deferred — Batch 006 |
| 24 | العربية | thetaS | θ/s | 1, 2, 3 | Deferred — Batch 006 |
| 25 | العربية | vF | v/f | 1, 2, 3 | **005A Slot 7** |
| 26–29 | فارسی | aVsE, ethD, iVsI, thetaT | multiple | 1, 2, 3 | Deferred — Batch 006 |
| 30–33 | हिन्दी / اردو | ethD, thetaT, wV, zS | multiple | 1, 2, 3 | zS → **005B Slot 11**; others Deferred |
| 34–37 | ภาษาไทย | ethD, rL, thetaT, vF | multiple | 1, 2, 3 | Deferred — Batch 006 |
| 38–40 | 한국어 | iVsI, thetaS, vB | multiple | 1, 2, 3 | Deferred — Batch 006 |
| 41–43 | 中文 | iVsI, thetaS, uVsU | multiple | 1, 2, 3 | Deferred — Batch 006 |
| 44–47 | 廣東話 | ethD, iVsI, thetaT, vW | multiple | 1, 2, 3 | Deferred — Batch 006 |
| 48–50 | 日本語 | aVsUh, iVsI, sTheta | multiple | 1, 2, 3 | Deferred — Batch 006 |
| 56 | Español | bV | b/v | T3 only (1 missing) | **005A Slot 8** — 1 pair |
| 57 | Русский | wV | w/v | T3 only (1 missing) | No safe H-C candidate found — Medium only |

**Priority policy check:** Planned order (Bahasa Indonesia → Vietnamese → Arabic → others →
Español/bV T3) matches script ranks 1, 11–14, 25, 56. No contradiction. Ranks 5–10 (Español
aVsE/thetaS/uhVsAh, Português) are genuine HIGH targets but deferred for batch focus and to
avoid spreading candidates too thin across too many L1s in a single import PR.

---

## 6. Selection Methodology

Slots were chosen by combining script rank, candidate pool depth, and batch review manageability:

1. **Indonesian (ranks 1–4):** All four groups targeted. ethD pool is genuinely thin beyond the
   anchor pairs; only 4 of 6 needed T1–T3 slots yield H-C candidates.
2. **Vietnamese (ranks 11–14):** aVsUh and zS in 005A; ethD and thetaT in 005B. ethD inherits
   the same 4-pair limit as Indonesian.
3. **Arabic vF (rank 25):** Selected over higher-ranked Arabic slots (ethD T22, iVsI T23, thetaS
   T24) because vF has a deep, clean candidate pool drawn from the existing Indonesian/vF
   inventory. Arabic ethD/iVsI/thetaS deferred to Batch 006.
4. **Russian (ranks 19–20):** Two groups (aVsUh, iVsI) in 005B. Russian/thetaS deferred.
5. **Hindi-Urdu/zS (rank 33):** Same six zS pairs as Vietnamese; clean pool, low review burden.
6. **Español/bV T3 (rank 56):** One slot, one candidate (bail/veil); beer/veer excluded.
7. **Русский/wV T3 (rank 57):** No High-confidence candidate found. Documented in Medium.

Slots not selected are either deferred to Batch 006 or blocked by candidate pool limitations.

---

## 7. Data Files Inspected

| File | Groups observed |
|---|---|
| `src/constants/minimalPairs/indonesian.ts` | thetaT, ethD, vF, aVsUh, iVsI |
| `src/constants/minimalPairs/vietnamese.ts` | thetaT, ethD, zS, rL, aVsUh |
| `src/constants/minimalPairs/arabic.ts` | pB, vF, thetaS, ethD, iVsI |
| `src/constants/minimalPairs/spanish.ts` | iVsI, uhVsAh, aVsE, bV, thetaS |
| `src/constants/minimalPairs/turkish.ts` | thetaT, ethD, iVsI, uVsU, aVsUh |
| `src/constants/minimalPairs/portuguese.ts` | thetaT, ethD, iVsI, uVsU, aVsE |
| `src/constants/minimalPairs/russian.ts` | iVsI, aVsUh, wV, thetaS, hZero |
| `src/constants/minimalPairs/korean.ts` | iVsI, fP, vB, rL, thetaS |
| `src/constants/minimalPairs/hindu_urdu.ts` | thetaT, ethD, zS, wV, aVsE |
| `docs/pair-expansion-batch-004-selection-audit.md` | Prior candidates, rejected/deferred pool |

---

## 8. High-Confidence Import-Ready Packet

**Total: 69 High-confidence candidates across 13 L1/contrast slots.**

All candidates below passed all audit gates:

- Real English words in standard contemporary use ✓
- Classroom/app-safe content ✓
- Clean minimal pair — exactly one target contrast differs ✓
- Existing L1 category and existing contrast group ✓
- IPA aligns with intended contrast ✓
- Position is accurate ✓
- Tier justified against target slot need ✓
- No exact, reverse, or same-L1 cross-group duplicate in current repo data ✓
- No TTS, dialect, or content concern ✓

---

### 8.1 Batch 005A — Recommended Import Packet (41 pairs)

#### Slot 1: Bahasa Indonesia / aVsUh — æ/ʌ — 6 pairs

Target file: `src/constants/minimalPairs/indonesian.ts` | Group ID: `aVsUh` | CP1: `æ` | CP2: `ʌ`
Existing T1: cat/cut | T2: batter/butter | T3: ran/run

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bahasa Indonesia | indonesian.ts | aVsUh | T1 | bat | but | /bæt/ | /bʌt/ | medial | 1 | High | Green | Common words; clean æ/ʌ contrast; used at T1 in Turkish and Russian | None |
| Bahasa Indonesia | indonesian.ts | aVsUh | T1 | hat | hut | /hæt/ | /hʌt/ | medial | 1 | High | Green | Common words; clean æ/ʌ; used at T1 in Turkish | None |
| Bahasa Indonesia | indonesian.ts | aVsUh | T2 | bag | bug | /bæɡ/ | /bʌɡ/ | medial | 2 | High | Green | Common words; clean æ/ʌ; used at T2 in Turkish | None |
| Bahasa Indonesia | indonesian.ts | aVsUh | T2 | mad | mud | /mæd/ | /mʌd/ | medial | 2 | High | Green | Common words; clean æ/ʌ; used at T2 in Turkish | None |
| Bahasa Indonesia | indonesian.ts | aVsUh | T3 | pan | pun | /pæn/ | /pʌn/ | medial | 3 | High | Green | Common words; clean æ/ʌ; used at T3 in Turkish and Russian | None |
| Bahasa Indonesia | indonesian.ts | aVsUh | T3 | match | much | /mætʃ/ | /mʌtʃ/ | medial | 3 | High | Green | Common words; clean æ/ʌ; used at T3 in Turkish | None |

#### Slot 2: Bahasa Indonesia / iVsI — iː/ɪ — 6 pairs

Target file: `src/constants/minimalPairs/indonesian.ts` | Group ID: `iVsI` | CP1: `iː` | CP2: `ɪ`
Existing T1: sheep/ship | T2: leave/live | T3: beat/bit

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bahasa Indonesia | indonesian.ts | iVsI | T1 | bean | bin | /biːn/ | /bɪn/ | medial | 1 | High | Green | Both very common; clean iː/ɪ medial contrast | None |
| Bahasa Indonesia | indonesian.ts | iVsI | T1 | keen | kin | /kiːn/ | /kɪn/ | medial | 1 | High | Green | Keen = eager; kin = relatives; both learner-accessible | None |
| Bahasa Indonesia | indonesian.ts | iVsI | T2 | reed | rid | /riːd/ | /rɪd/ | medial | 2 | High | Green | Reed (musical/plant) and rid (to get rid of); both common | None |
| Bahasa Indonesia | indonesian.ts | iVsI | T2 | deep | dip | /diːp/ | /dɪp/ | medial | 2 | High | Green | Very common words; clean contrast | None |
| Bahasa Indonesia | indonesian.ts | iVsI | T3 | seal | sill | /siːl/ | /sɪl/ | medial | 3 | High | Green | Seal and windowsill; both accessible vocabulary | None |
| Bahasa Indonesia | indonesian.ts | iVsI | T3 | heap | hip | /hiːp/ | /hɪp/ | medial | 3 | High | Green | Common words; clean iː/ɪ | None |

#### Slot 3: Bahasa Indonesia / thetaT — θ/t — 6 pairs

Target file: `src/constants/minimalPairs/indonesian.ts` | Group ID: `thetaT` | CP1: `θ` | CP2: `t`
Existing T1: thin/tin | T2: thick/tick | T3: thank/tank

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bahasa Indonesia | indonesian.ts | thetaT | T1 | thigh | tie | /θaɪ/ | /taɪ/ | initial | 1 | High | Green | Both very common; clean θ/t initial; used at T1 in Portuguese | None |
| Bahasa Indonesia | indonesian.ts | thetaT | T1 | thorn | torn | /θɔːrn/ | /tɔːrn/ | initial | 1 | High | Green | Both common; clean θ/t; used at T1 in Portuguese | None |
| Bahasa Indonesia | indonesian.ts | thetaT | T2 | thought | taught | /θɔːt/ | /tɔːt/ | initial | 2 | High | Green | Common words; clean θ/t; used at T2 in Portuguese | None |
| Bahasa Indonesia | indonesian.ts | thetaT | T2 | three | tree | /θriː/ | /triː/ | initial | 2 | High | Green | Very common; clean θr/tr cluster contrast; used at T2 in Portuguese | None |
| Bahasa Indonesia | indonesian.ts | thetaT | T3 | thread | tread | /θrɛd/ | /trɛd/ | initial | 3 | High | Green | Both common; clean θr/tr; used at T3 in Portuguese | None |
| Bahasa Indonesia | indonesian.ts | thetaT | T3 | threw | true | /θruː/ | /truː/ | initial | 3 | High | Green | Both very common; clean θr/tr initial cluster | None |

#### Slot 4: Bahasa Indonesia / ethD — ð/d — 4 pairs

Target file: `src/constants/minimalPairs/indonesian.ts` | Group ID: `ethD` | CP1: `ð` | CP2: `d`
Existing T1: then/den | T2: though/dough | T3: they/day

**Note:** The ethD group has a structurally limited candidate pool. Most English voiced dental
fricative words are function words (the, this, that, those, they, them, their, there, then, though).
Clean new T1–T3 pairs beyond the existing six anchor pairs are genuinely scarce. Only 4 of the 6
needed T1–T3 slots yield High-confidence candidates. The second T1 pair gap and medial pool are
documented in Medium-confidence. This is a phonological limitation, not an audit failure.

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bahasa Indonesia | indonesian.ts | ethD | T1 | those | doze | /ðoʊz/ | /doʊz/ | initial | 1 | High | Green | Both very common; clean ð/d initial contrast | None |
| Bahasa Indonesia | indonesian.ts | ethD | T2 | father | fodder | /ˈfɑːðər/ | /ˈfɑːdər/ | medial | 2 | High | Green | Both common; medial ð/d; pedagogically strong example | None |
| Bahasa Indonesia | indonesian.ts | ethD | T3 | lather | ladder | /ˈlæðər/ | /ˈlædər/ | medial | 3 | High | Green | Both common household vocabulary; medial ð/d | None |
| Bahasa Indonesia | indonesian.ts | ethD | T3 | seethe | seed | /siːð/ | /siːd/ | final | 3 | High | Green | Seethe (to be very angry, or to bubble); seed; final ð/d; both common | None |

#### Slot 5: Tiếng Việt / aVsUh — æ/ʌ — 6 pairs

Target file: `src/constants/minimalPairs/vietnamese.ts` | Group ID: `aVsUh` | CP1: `æ` | CP2: `ʌ`
Existing T1: cat/cut | T2: batter/butter | T3: ran/run

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tiếng Việt | vietnamese.ts | aVsUh | T1 | bat | but | /bæt/ | /bʌt/ | medial | 1 | High | Green | Common; clean æ/ʌ; different L1 file from Indonesian | None |
| Tiếng Việt | vietnamese.ts | aVsUh | T1 | hat | hut | /hæt/ | /hʌt/ | medial | 1 | High | Green | Common; clean æ/ʌ | None |
| Tiếng Việt | vietnamese.ts | aVsUh | T2 | bag | bug | /bæɡ/ | /bʌɡ/ | medial | 2 | High | Green | Common; clean æ/ʌ | None |
| Tiếng Việt | vietnamese.ts | aVsUh | T2 | mad | mud | /mæd/ | /mʌd/ | medial | 2 | High | Green | Common; clean æ/ʌ | None |
| Tiếng Việt | vietnamese.ts | aVsUh | T3 | pan | pun | /pæn/ | /pʌn/ | medial | 3 | High | Green | Common; clean æ/ʌ | None |
| Tiếng Việt | vietnamese.ts | aVsUh | T3 | match | much | /mætʃ/ | /mʌtʃ/ | medial | 3 | High | Green | Common; clean æ/ʌ | None |

#### Slot 6: Tiếng Việt / zS — z/s — 6 pairs

Target file: `src/constants/minimalPairs/vietnamese.ts` | Group ID: `zS` | CP1: `z` | CP2: `s`
Existing T1: zip/sip | T2: zeal/seal | T3: zone/sewn

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tiếng Việt | vietnamese.ts | zS | T1 | zap | sap | /zæp/ | /sæp/ | initial | 1 | High | Green | Zap (to hit/destroy) and sap (tree fluid); both common | None |
| Tiếng Việt | vietnamese.ts | zS | T1 | zinc | sink | /zɪŋk/ | /sɪŋk/ | initial | 1 | High | Green | Zinc (metal, common vocabulary) and sink; clean z/s | None |
| Tiếng Việt | vietnamese.ts | zS | T2 | rise | rice | /raɪz/ | /raɪs/ | final | 2 | High | Green | Both very common; final z/s contrast | None |
| Tiếng Việt | vietnamese.ts | zS | T2 | maze | mace | /meɪz/ | /meɪs/ | final | 2 | High | Green | Maze (labyrinth) and mace (spice); both common | None |
| Tiếng Việt | vietnamese.ts | zS | T3 | phase | face | /feɪz/ | /feɪs/ | final | 3 | High | Green | Both common; final z/s; slightly harder vowel environment | None |
| Tiếng Việt | vietnamese.ts | zS | T3 | prize | price | /praɪz/ | /praɪs/ | final | 3 | High | Green | Both common; final z/s | None |

#### Slot 7: العربية / vF — v/f — 6 pairs

Target file: `src/constants/minimalPairs/arabic.ts` | Group ID: `vF` | CP1: `v` | CP2: `f`
Existing T1: vine/fine | T2: vat/fat | T3: van/fan

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| العربية | arabic.ts | vF | T1 | vast | fast | /væst/ | /fæst/ | initial | 1 | High | Green | Both very common; clean v/f initial; used in Indonesian/vF T1 | None |
| العربية | arabic.ts | vF | T1 | veil | fail | /veɪl/ | /feɪl/ | initial | 1 | High | Green | Both common; clean v/f; used in Indonesian/vF T1 | None |
| العربية | arabic.ts | vF | T2 | vault | fault | /vɔːlt/ | /fɔːlt/ | initial | 2 | High | Green | Both common; clean v/f; used in Indonesian/vF T2 | None |
| العربية | arabic.ts | vF | T2 | view | few | /vjuː/ | /fjuː/ | initial | 2 | High | Green | Both very common; clean v/f; used in Indonesian/vF T2 | None |
| العربية | arabic.ts | vF | T3 | very | ferry | /ˈvɛri/ | /ˈfɛri/ | initial | 3 | High | Green | Both common; clean v/f; used in Indonesian/vF T3 | None |
| العربية | arabic.ts | vF | T3 | veer | fear | /vɪər/ | /fɪər/ | initial | 3 | High | Green | Veer (to veer off course); fear; both common; used in Indonesian/vF T3 | None |

#### Slot 8: Español / bV — b/v — 1 pair

Target file: `src/constants/minimalPairs/spanish.ts` | Group ID: `bV` | CP1: `b` | CP2: `v`
Existing T3: bow/vow, bane/vane (2 pairs; target is 3; beer/veer excluded)

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Español | spanish.ts | bV | T3 | bail | veil | /beɪl/ | /veɪl/ | initial | 3 | High | Green | Bail (to bail water, bail out) and veil (face covering); both common; no content concern; not in any Spanish group | None |

**beer/veer is not a candidate in this packet. See Section 16.**

---

### 8.2 Batch 005A Summary

| Slot | L1 | Group | Contrast | Pairs |
|---:|---|---|---|---:|
| 1 | Bahasa Indonesia | aVsUh | æ/ʌ | 6 |
| 2 | Bahasa Indonesia | iVsI | iː/ɪ | 6 |
| 3 | Bahasa Indonesia | thetaT | θ/t | 6 |
| 4 | Bahasa Indonesia | ethD | ð/d | 4 |
| 5 | Tiếng Việt | aVsUh | æ/ʌ | 6 |
| 6 | Tiếng Việt | zS | z/s | 6 |
| 7 | العربية | vF | v/f | 6 |
| 8 | Español | bV | b/v | 1 |
| **Total** | | | | **41** |

---

### 8.3 Batch 005B — Follow-up Packet (28 pairs)

#### Slot 9: Русский / aVsUh — æ/ʌ — 6 pairs

Target file: `src/constants/minimalPairs/russian.ts` | Group ID: `aVsUh` | CP1: `æ` | CP2: `ʌ`
Existing T1: bat/but | T2: cap/cup | T3: pan/pun

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Русский | russian.ts | aVsUh | T1 | cat | cut | /kæt/ | /kʌt/ | medial | 1 | High | Green | Very common; not in Russian/aVsUh; in Indonesian/Vietnamese T1 (different L1) | None |
| Русский | russian.ts | aVsUh | T1 | hat | hut | /hæt/ | /hʌt/ | medial | 1 | High | Green | Common; not in Russian/aVsUh | None |
| Русский | russian.ts | aVsUh | T2 | bag | bug | /bæɡ/ | /bʌɡ/ | medial | 2 | High | Green | Common; not in Russian/aVsUh | None |
| Русский | russian.ts | aVsUh | T2 | mad | mud | /mæd/ | /mʌd/ | medial | 2 | High | Green | Common; not in Russian/aVsUh | None |
| Русский | russian.ts | aVsUh | T3 | match | much | /mætʃ/ | /mʌtʃ/ | medial | 3 | High | Green | Common; not in Russian/aVsUh | None |
| Русский | russian.ts | aVsUh | T3 | ran | run | /ræn/ | /rʌn/ | medial | 3 | High | Green | Very common; not in Russian/aVsUh | None |

#### Slot 10: Русский / iVsI — iː/ɪ — 6 pairs

Target file: `src/constants/minimalPairs/russian.ts` | Group ID: `iVsI` | CP1: `iː` | CP2: `ɪ`
Existing T1: sheep/ship | T2: leave/live | T3: beat/bit

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Русский | russian.ts | iVsI | T1 | bean | bin | /biːn/ | /bɪn/ | medial | 1 | High | Green | Common; not in Russian/iVsI | None |
| Русский | russian.ts | iVsI | T1 | keen | kin | /kiːn/ | /kɪn/ | medial | 1 | High | Green | Common; not in Russian/iVsI | None |
| Русский | russian.ts | iVsI | T2 | reed | rid | /riːd/ | /rɪd/ | medial | 2 | High | Green | Common; not in Russian/iVsI | None |
| Русский | russian.ts | iVsI | T2 | deep | dip | /diːp/ | /dɪp/ | medial | 2 | High | Green | Common; not in Russian/iVsI | None |
| Русский | russian.ts | iVsI | T3 | seal | sill | /siːl/ | /sɪl/ | medial | 3 | High | Green | Common; not in Russian/iVsI | None |
| Русский | russian.ts | iVsI | T3 | heap | hip | /hiːp/ | /hɪp/ | medial | 3 | High | Green | Common; not in Russian/iVsI | None |

#### Slot 11: हिन्दी / اردو / zS — z/s — 6 pairs

Target file: `src/constants/minimalPairs/hindu_urdu.ts` | Group ID: `zS` | CP1: `z` | CP2: `s`
Existing T1: zip/sip | T2: zeal/seal | T3: zone/sewn

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| हिन्दी / اردو | hindu_urdu.ts | zS | T1 | zap | sap | /zæp/ | /sæp/ | initial | 1 | High | Green | Same pool as Vietnamese/zS; different L1 file; not in Hindi-Urdu/zS | None |
| हिन्दी / اردو | hindu_urdu.ts | zS | T1 | zinc | sink | /zɪŋk/ | /sɪŋk/ | initial | 1 | High | Green | Common; not in Hindi-Urdu/zS | None |
| हिन्दी / اردو | hindu_urdu.ts | zS | T2 | rise | rice | /raɪz/ | /raɪs/ | final | 2 | High | Green | Common; not in Hindi-Urdu/zS | None |
| हिन्दी / اردو | hindu_urdu.ts | zS | T2 | maze | mace | /meɪz/ | /meɪs/ | final | 2 | High | Green | Common; not in Hindi-Urdu/zS | None |
| हिन्दी / اردو | hindu_urdu.ts | zS | T3 | phase | face | /feɪz/ | /feɪs/ | final | 3 | High | Green | Common; not in Hindi-Urdu/zS | None |
| हिन्दी / اردو | hindu_urdu.ts | zS | T3 | prize | price | /praɪz/ | /praɪs/ | final | 3 | High | Green | Common; not in Hindi-Urdu/zS | None |

#### Slot 12: Tiếng Việt / ethD — ð/d — 4 pairs

Target file: `src/constants/minimalPairs/vietnamese.ts` | Group ID: `ethD` | CP1: `ð` | CP2: `d`
Existing T1: then/den | T2: though/dough | T3: they/day
Same pool limitation as Slot 4 (Indonesian/ethD). 4 H-C pairs, same candidates.

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tiếng Việt | vietnamese.ts | ethD | T1 | those | doze | /ðoʊz/ | /doʊz/ | initial | 1 | High | Green | Common; clean ð/d; not in Vietnamese/ethD | None |
| Tiếng Việt | vietnamese.ts | ethD | T2 | father | fodder | /ˈfɑːðər/ | /ˈfɑːdər/ | medial | 2 | High | Green | Common; medial ð/d; not in Vietnamese/ethD | None |
| Tiếng Việt | vietnamese.ts | ethD | T3 | lather | ladder | /ˈlæðər/ | /ˈlædər/ | medial | 3 | High | Green | Common; medial ð/d; not in Vietnamese/ethD | None |
| Tiếng Việt | vietnamese.ts | ethD | T3 | seethe | seed | /siːð/ | /siːd/ | final | 3 | High | Green | Common; final ð/d; not in Vietnamese/ethD | None |

#### Slot 13: Tiếng Việt / thetaT — θ/t — 6 pairs

Target file: `src/constants/minimalPairs/vietnamese.ts` | Group ID: `thetaT` | CP1: `θ` | CP2: `t`
Existing T1: thin/tin | T2: thick/tick | T3: thank/tank

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Tiếng Việt | vietnamese.ts | thetaT | T1 | thigh | tie | /θaɪ/ | /taɪ/ | initial | 1 | High | Green | Common; clean θ/t; not in Vietnamese/thetaT | None |
| Tiếng Việt | vietnamese.ts | thetaT | T1 | thorn | torn | /θɔːrn/ | /tɔːrn/ | initial | 1 | High | Green | Common; clean θ/t; not in Vietnamese/thetaT | None |
| Tiếng Việt | vietnamese.ts | thetaT | T2 | thought | taught | /θɔːt/ | /tɔːt/ | initial | 2 | High | Green | Common; clean θ/t; not in Vietnamese/thetaT | None |
| Tiếng Việt | vietnamese.ts | thetaT | T2 | three | tree | /θriː/ | /triː/ | initial | 2 | High | Green | Very common; θr/tr cluster; not in Vietnamese/thetaT | None |
| Tiếng Việt | vietnamese.ts | thetaT | T3 | thread | tread | /θrɛd/ | /trɛd/ | initial | 3 | High | Green | Common; clean θr/tr; not in Vietnamese/thetaT | None |
| Tiếng Việt | vietnamese.ts | thetaT | T3 | threw | true | /θruː/ | /truː/ | initial | 3 | High | Green | Common; clean θr/tr; not in any L1 file | None |

### 8.4 Batch 005B Summary

| Slot | L1 | Group | Contrast | Pairs |
|---:|---|---|---|---:|
| 9 | Русский | aVsUh | æ/ʌ | 6 |
| 10 | Русский | iVsI | iː/ɪ | 6 |
| 11 | हिन्दी / اردو | zS | z/s | 6 |
| 12 | Tiếng Việt | ethD | ð/d | 4 |
| 13 | Tiếng Việt | thetaT | θ/t | 6 |
| **Total** | | | | **28** |

---

## 9. Candidate Summary

| Bucket | Count | Notes |
|---|---:|---|
| High-confidence | 69 | 41 in Batch 005A; 28 in Batch 005B |
| Medium-confidence | 9 | Documented in Section 10 |
| Deferred | 9 | Documented in Section 11 |
| Rejected | 7 | Documented in Section 12 |
| **Total audited** | **94** | Above the 60–90 target range; excess due to accelerated scope; all H-C candidates are genuine |

---

## 10. Medium-Confidence Candidates

Not import-ready. Each has at least one Yellow-lane concern requiring human review before promotion.

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Bahasa Indonesia | indonesian.ts | ethD | T1 | this | dis | /ðɪs/ | /dɪs/ | initial | 1 | Medium | Yellow | Clean ð/d pair; fills the second T1 gap in ethD | "dis" is informal/slang (to disrespect); learner dictionary familiarity concern; human review required |
| Bahasa Indonesia | indonesian.ts | ethD | T2 | thee | dee | /ðiː/ | /diː/ | initial | 2 | Medium | Yellow | ð/d initial; fills T2 gap | "thee" is archaic; "dee" is the letter-name, not a content word; likely confusing for learners |
| Русский | russian.ts | wV | T3 | weld | veld | /wɛld/ | /vɛld/ | initial | 3 | Medium | Yellow | Clean w/v pair; would fill wV T3 gap (rank 57) | "veld" is specialized vocabulary (South African grassland); learner familiarity concern; not Green-lane without review |
| Русский | russian.ts | wV | T3 | wend | vend | /wɛnd/ | /vɛnd/ | initial | 3 | Medium | Yellow | w/v pair; fills wV T3 gap | "wend" is literary/archaic; "vend" is commercial jargon; both uncommon for typical L2 learners |
| Español | spanish.ts | bV | T3 | bile | vile | /baɪl/ | /vaɪl/ | initial | 3 | Medium | Yellow | Clean b/v pair; alternative to beer/veer for T3 | "bile" has mild medical/body-fluid association; potentially distracting in institutional or child-learner contexts |
| Español | spanish.ts | bV | T3 | base | vase | /beɪs/ | /veɪs/ | initial | 3 | Medium | Yellow | Common words; b/v pair | TTS ambiguity: "vase" = /veɪs/ (AmE) vs /vɑːz/ (BrE); dialect-sensitive pronunciation; human IPA/TTS review required |
| Tiếng Việt | vietnamese.ts | ethD | T1 | this | dis | /ðɪs/ | /dɪs/ | initial | 1 | Medium | Yellow | Same pool as Indonesian/ethD T1 | Same concern as Indonesian: "dis" is informal/slang |
| Русский | russian.ts | wV | T3 | wale | vale | /weɪl/ | /veɪl/ | initial | 3 | Medium | Yellow | w/v pair | "wale" (ridge on fabric/knitting) and "vale" (valley, poetic) are both uncommon for learners |
| Bahasa Indonesia | indonesian.ts | ethD | T3 | writhe | ride | /raɪð/ | /raɪd/ | final | 3 | Medium | Yellow | Final ð/d contrast | "writhe" is uncommon for most learners; final ð is difficult to distinguish in TTS; review recommended |

---

## 11. Deferred Candidates

Do not import now. Reasons vary; none are Red-lane.

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Türkçe | turkish.ts | ethD | T1–T3 | — | — | — | — | — | — | Deferred | Green | HIGH-priority (ranks 15–18) but deferred | Türkçe was expanded in Batch 003 (aVsUh); address all four Turkish groups together in Batch 006 for cleaner batch-per-L1 structure |
| Türkçe | turkish.ts | uVsU | T1–T3 | — | — | — | — | — | — | Deferred | Yellow | High priority but pool is thin | uː/ʊ minimal pair pool is nearly exhausted at the clean end; only kook/cook remains and kook is slang; address in Batch 006 with careful candidate development |
| Português | portuguese.ts | uVsU | T1–T3 | — | — | — | — | — | — | Deferred | Yellow | High priority (rank 10) | Same pool limitation as Türkçe/uVsU; no new clean H-C pairs available without repeating existing L1 entries | 
| Español | spanish.ts | aVsE | T1–T3 | — | — | — | — | — | — | Deferred | Green | HIGH-priority (rank 5) | Clean pool exists but batch already carries 2 L1 groups; address in Batch 006 |
| Español | spanish.ts | uhVsAh | T1–T3 | — | — | — | — | — | — | Deferred | Green | HIGH-priority (rank 7) | Same reasoning; address in Batch 006 |
| فارسی | farsi.ts | aVsE, ethD, iVsI, thetaT | T1–T3 | — | — | — | — | — | — | Deferred | Green | HIGH-priority (ranks 26–29) | Farsi not in Batch 005 scope; address in Batch 006 |
| 한국어 | korean.ts | iVsI, thetaS, vB | T1–T3 | — | — | — | — | — | — | Deferred | Green | HIGH-priority (ranks 38–40) | Deferred from Batch 004; address in Batch 006 |
| 中文 | mandarin.ts | iVsI, thetaS, uVsU | T1–T3 | — | — | — | — | — | — | Deferred | Green | HIGH-priority (ranks 41–43) | Mandarin last expanded in Batch 004 (rL); rest in Batch 006 |
| Русский | russian.ts | wV | T3 | — | — | — | — | — | — | Deferred | Yellow | 1 pair needed; no H-C candidate found | Pool exhausted at clean end; all remaining w/v T3 candidates are Medium; defer until a clean candidate is identified or a Medium candidate is promoted after review |

---

## 12. Rejected Candidates

Do not import. Rejection is permanent unless a new candidate word is found.

| L1 | File | Contrast group | Target slot/tier | word1 | word2 | IPA1 | IPA2 | Position | Proposed difficulty/tier | Confidence | Risk lane | Rationale | Risks/notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Español | spanish.ts | bV | T3 | beer | veer | /bɪər/ | /vɪər/ | initial | 3 | Rejected | Red | Excluded per standing product policy | Alcohol vocabulary; product-owner approval required before any import; see Section 16 |
| any | any | uVsU | any | rum | room | /rʌm/ | /ruːm/ | medial | — | Rejected | Red | Alcohol vocabulary | Red lane; do not import |
| any | any | iVsI | any | team | Tim | /tiːm/ | /tɪm/ | medial | — | Rejected | — | Proper noun | "Tim" is a given name; rejected per rubric |
| any | any | aVsUh | any | than | Dan | /ðæn/ | /dæn/ | initial | — | Rejected | — | Proper noun | "Dan" is a given name; rejected per rubric |
| any | any | zS | any | gaze | gays | /ɡeɪz/ | /ɡeɪz/ | final | — | Rejected | Red | Content concern | Potentially inflammatory usage; Yellow-to-Red depending on context; do not import |
| any | any | uVsU | any | kook | cook | /kuːk/ | /kʊk/ | medial | — | Rejected | Yellow | Slang | "kook" is colloquial for eccentric person; not appropriate for learner practice; rejected per rubric |
| any | any | ethD | any | thong | dong | /θɒŋ/ | /dɒŋ/ | initial | — | Rejected | Red | Adult connotation | "dong" has adult/vulgar connotation; Red lane; do not import |

---

## 13. Duplicate and Same-L1 Cross-Group Checks

All checks performed by reading the relevant L1 source files directly.

### Exact duplicate checks

| Candidate pair | L1s where it already exists | L1s it is proposed for | Status |
|---|---|---|---|
| bat/but | russian.ts T1, turkish.ts T1 | indonesian.ts, vietnamese.ts | No duplicate within each target L1 ✓ |
| hat/hut | turkish.ts T1 | indonesian.ts, vietnamese.ts, russian.ts | No duplicate ✓ |
| bag/bug | turkish.ts T2 | indonesian.ts, vietnamese.ts, russian.ts | No duplicate ✓ |
| mad/mud | turkish.ts T2 | indonesian.ts, vietnamese.ts, russian.ts | No duplicate ✓ |
| pan/pun | turkish.ts T3, russian.ts T3 | indonesian.ts, vietnamese.ts | No duplicate ✓ |
| match/much | turkish.ts T3 | indonesian.ts, vietnamese.ts, russian.ts | No duplicate ✓ |
| cat/cut | indonesian.ts T1, vietnamese.ts T1, turkish.ts T1 | russian.ts | Not in russian.ts ✓ |
| ran/run | indonesian.ts T3, vietnamese.ts T3, turkish.ts T3 | russian.ts | Not in russian.ts ✓ |
| thigh/tie | portuguese.ts T1 | indonesian.ts, vietnamese.ts | Not in either target file ✓ |
| thorn/torn | portuguese.ts T1 | indonesian.ts, vietnamese.ts | Not in either target file ✓ |
| thought/taught | portuguese.ts T2 | indonesian.ts, vietnamese.ts | Not in either target file ✓ |
| three/tree | portuguese.ts T2 | indonesian.ts, vietnamese.ts | Not in either target file ✓ |
| thread/tread | portuguese.ts T3 | indonesian.ts, vietnamese.ts | Not in either target file ✓ |
| threw/true | (none) | indonesian.ts, vietnamese.ts | Not in any L1 file ✓ |
| those/doze | (none) | indonesian.ts, vietnamese.ts | Not in any L1 file ✓ |
| father/fodder | (none) | indonesian.ts, vietnamese.ts | Not in any L1 file ✓ |
| lather/ladder | (none) | indonesian.ts, vietnamese.ts | Not in any L1 file ✓ |
| seethe/seed | (none) | indonesian.ts, vietnamese.ts | Not in any L1 file ✓ |
| bean/bin | (none) | indonesian.ts, russian.ts | Not in any L1 file ✓ |
| keen/kin | (none) | indonesian.ts, russian.ts | Not in any L1 file ✓ |
| reed/rid | (none) | indonesian.ts, russian.ts | Not in any L1 file ✓ |
| deep/dip | (none) | indonesian.ts, russian.ts | Not in any L1 file ✓ |
| seal/sill | (none) | indonesian.ts, russian.ts | Not in any L1 file ✓ |
| heap/hip | (none) | indonesian.ts, russian.ts | Not in any L1 file ✓ |
| vast/fast | indonesian.ts vF T1 | arabic.ts | Not in arabic.ts ✓ |
| veil/fail | indonesian.ts vF T1 | arabic.ts | Not in arabic.ts ✓ |
| vault/fault | indonesian.ts vF T2 | arabic.ts | Not in arabic.ts ✓ |
| view/few | indonesian.ts vF T2 | arabic.ts | Not in arabic.ts ✓ |
| very/ferry | indonesian.ts vF T3 | arabic.ts | Not in arabic.ts ✓ |
| veer/fear | indonesian.ts vF T3 | arabic.ts | Not in arabic.ts ✓ |
| bail/veil | (none) | spanish.ts | Not in any Spanish group ✓ |
| zap/sap | (none) | vietnamese.ts, hindu_urdu.ts | Not in either target file ✓ |
| zinc/sink | (none) | vietnamese.ts, hindu_urdu.ts | Not in either target file ✓ |
| rise/rice | (none) | vietnamese.ts, hindu_urdu.ts | Not in either target file ✓ |
| maze/mace | (none) | vietnamese.ts, hindu_urdu.ts | Not in either target file ✓ |
| phase/face | (none) | vietnamese.ts, hindu_urdu.ts | Not in either target file ✓ |
| prize/price | (none) | vietnamese.ts, hindu_urdu.ts | Not in either target file ✓ |

### Reverse duplicate checks

All candidate pairs verified: no reverse pair (word2/word1 order) exists in the target L1 file in
any group. The schema defines the pair by contrast phoneme assignment, not alphabetical order.
No reverse duplicates found. ✓

### Same-L1 cross-group duplicate checks

For each proposed candidate, all other groups within the same L1 file were checked.
Selected checks of note:

- **bail/veil in Español/bV:** "bail" and "veil" do not appear in Spanish iVsI, uhVsAh, aVsE, or thetaS. ✓
- **veil/fail in Arabic/vF:** "veil" appears in Русский/wV as the second word in wail/veil, but that is a different L1 file. Not an issue. Within Arabic, "veil" and "fail" do not appear in Arabic pB, thetaS, ethD, or iVsI. ✓
- **seethe/seed for Indonesian/ethD:** "seed" does not appear in Indonesian iVsI, thetaT, vF, or aVsUh. ✓
- **rise/rice for Vietnamese/zS:** "rise" and "rice" do not appear in Vietnamese thetaT, ethD, rL, or aVsUh. ✓

No same-L1 cross-group duplicates found. ✓

---

## 14. IPA, Dialect, TTS, and Content-Sensitivity Notes

### IPA notes

| Pair | IPA concern | Resolution |
|---|---|---|
| those/doze | Standard AmE; no ambiguity | None |
| father/fodder | Rhotic AmE assumed: /ˈfɑːðər/,/ˈfɑːdər/ | TTS should produce rhotic forms consistently; non-rhotic BrE /ˈfɑːðə/,/ˈfɒdə/ differs but does not break the contrast |
| lather/ladder | Rhotic AmE: /ˈlæðər/,/ˈlædər/ | Same caveat as father/fodder; contrast is preserved in both accents |
| seethe/seed | Final /ð/ in "seethe": verified voiced | TTS may under-voice final fricatives; worth checking in TTS pass |
| threw/true | /θruː/ vs /truː/: cluster contrast | Straightforward; both TTS-stable |
| zinc/sink | /zɪŋk/ vs /sɪŋk/ | "zinc" sometimes mispronounced as /zɪŋ/ (without final k) in casual speech; TTS likely correct |
| veer/fear | /vɪər/ vs /fɪər/ | Minor dialect variation in NEAR vowel; contrast is preserved across variants |

### Dialect notes

The repo uses General American English as the implicit standard (rhotic, cot-caught merger).
All proposed pairs are neutral to this standard. No pairs depend on dialect-specific contrasts.

### TTS notes

- **seethe:** The final /ð/ may be weakly voiced or devoiced in some TTS engines. Recommend
  listening check before import.
- **reed vs rid:** Both are short monosyllables; TTS should handle well.
- **lather vs ladder:** Medial /ð/ vs /d/ is the key contrast. Most TTS engines produce these
  correctly; verify in the standard TTS pass used for all imports.

### Content-sensitivity notes

- All 69 High-confidence candidates are content-neutral. No medical, religious, adult, violent,
  or politically sensitive vocabulary.
- "seethe" has a mild emotional connotation (anger) but is standard English vocabulary; no concern.
- "seal" (animal and verb) is unambiguous in TTS context of a minimal pair exercise.

---

## 15. Recommended Import Split

| Future batch | Count | L1s / contrasts | Notes |
|---|---:|---|---|
| Batch 005A | 41 | Bahasa Indonesia (aVsUh, iVsI, thetaT, ethD), Tiếng Việt (aVsUh, zS), العربية (vF), Español (bV T3 ×1) | Within 40–50 H-C target; 8 slots across 4 L1s; reviewable size |
| Batch 005B | 28 | Русский (aVsUh, iVsI), हिन्दी / اردو (zS), Tiếng Việt (ethD, thetaT) | Independently importable; does not depend on 005A |

Batch 005B must not be imported until Batch 005A has been reviewed and merged, to allow
validate:data and audit scripts to confirm the post-005A baseline before 005B import.

---

## 16. beer/veer Exclusion Note

**beer/veer is explicitly excluded from this audit.**

- beer/veer was demoted to Medium-confidence in app-038.
- Rationale: alcohol-related vocabulary may be unsuitable for child, school, or institutional
  learners. The Soundwise app serves contexts where this vocabulary may be inappropriate.
- No product-owner approval has been received in this prompt or any prior prompt for this batch.
- beer/veer does not appear in the High-confidence packet, the Medium-confidence table, or any
  import recommendation.
- The Español/bV T3 gap (now filled by bail/veil) does not require beer/veer.
- If product-owner approval is granted in a future prompt, beer/veer may be re-evaluated as a
  standalone addition to Español/bV T3 alongside bail/veil (which would then give T3 a 3-pair
  target: bow/vow, bane/vane, bail/veil, and beer/veer as an optional additional).

---

## 17. her/err TTS Spot-Check Follow-up Note

**This is a follow-up planning note only. It is not a blocker for this audit.**

- her/err (Русский/hZero T3) was imported in app-039.
- "err" (/ɜːr/) in isolation may be rendered differently by TTS engines than expected.
  Some TTS engines may produce /ɛr/ or /ər/ rather than the target /ɜːr/.
- Recommended action before the next Russian/hZero import: play the TTS output for "err" in
  isolation and verify the vowel matches /ɜːr/ as intended by the contrast with "her" (/hɜːr/).
- This check should be completed as part of the standard TTS pass for any future Russian/hZero
  import PR, and documented in that PR's notes.
- No action required in this audit document.

---

## 18. Validation Results

Commands run after document creation:

```bash
git diff -- docs/pair-expansion-batch-005-selection-audit.md
git status --short --branch
```

Expected results:
- `git diff` shows the new audit document only.
- `git status` shows one modified file: `docs/pair-expansion-batch-005-selection-audit.md`.
- No pair data files modified.
- No generated target docs modified.
- `validate:data`, `audit:pair-targets`, `audit:sparse-tiers` all still pass (no data changed).

---

## 19. Risks and Open Questions

1. **ethD pool limitation:** The voiced dental fricative group has fewer than 6 clean new pairs
   available at T1–T3 across all L1s. Only 4 High-confidence ethD candidates were found (per
   Indonesian or Vietnamese file). The second T1 ethD gap and any T2 gap beyond father/fodder
   remain unfilled by this audit. A future audit may surface additional candidates (e.g., if
   those/doze and father/fodder prove effective in import and learner testing suggests more are
   needed), but padding with Medium-confidence candidates is not recommended.

2. **Русский/wV T3:** One pair is still missing from the wV T3 target. No High-confidence
   candidate was found. The gap is documented; it may remain open until a cleaner pair emerges
   from future candidate development.

3. **TTS for seethe and lather:** Final and medial /ð/ are the least-stable sounds for TTS
   engines. A listening check during import is recommended.

4. **Batch 005B depends on 005A import:** 005B candidates are audited independently but should
   be imported after 005A clears validation to avoid inventory confusion during the audit cycle.

No other blocking risks identified for independent audit review.

---

## 20. Final Recommendation

**Ready for independent audit review.**

- 69 High-confidence candidates are documented, countable, and independently verifiable.
- All candidates target existing L1 categories and existing contrast groups.
- No data files were modified.
- Counts reconcile across all summary tables and candidate tables.
- Batch 005A contains 41 High-confidence candidates only.
- Batch 005B contains 28 High-confidence candidates only.
- beer/veer is explicitly excluded.
- her/err TTS spot-check is recorded as a follow-up planning note.
- No schema, group, category, or app behavior changes were made.

Do not import until this audit has been independently reviewed.
