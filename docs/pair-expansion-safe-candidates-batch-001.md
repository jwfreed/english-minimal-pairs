# Safe Pair Expansion Candidates — Batch 001

> **Status:** Selection document only. No pairs in this document have been added to app data.
> A future data-import PR is required before any selected candidate enters
> `app/constants/minimalPairs/*.ts`. Selected candidates are not production-ready until
> that PR is reviewed, TTS-tested where applicable, and merged.

---

## Scope

This document selects the safest candidates from `docs/pair-expansion-candidates-batch-001.md`
(app-027, corrected in app-028) for use in a future data-import PR.

**What this document does:**
- Applies a conservative selection policy to the corrected Batch 001 candidate packet
- Lists candidates that passed all selection gates in a single reference table per group
- Lists all excluded candidates with their exclusion reason
- Documents that no same-category duplicates exist among selected candidates
- Provides a template for the next data-import PR

**What this document does not do:**
- Add, edit, or delete any pairs in `app/constants/minimalPairs/*.ts`
- Approve candidates as production-ready
- Change any candidate status in `docs/pair-expansion-candidates-batch-001.md`
- Propose new candidates
- Change any app behavior

---

## Selection Policy

Only candidates that satisfy **all** of the following conditions are selected:

1. Status in the corrected Batch 001 packet is exactly `recommended`
2. Risks column contains no unresolved TTS, IPA, dialect, or vocabulary-frequency concern
3. No `needs_human_decision` flag
4. No `too_obscure_for_tier` flag
5. No same-category duplicate or reversed duplicate in `app/constants/minimalPairs/*.ts`
6. No collision note requiring a product or spelling decision

Candidates with any of these statuses are excluded without exception:

`candidate` · `needs_tts_review` · `needs_ipa_review` · `needs_dialect_review` ·
`needs_human_decision` · `near_minimal_risky` · `too_obscure_for_tier` · `reject`

When uncertain, the policy is: **exclude**.

---

## Selected Candidates Summary

| Category | Group ID | Target contrast | Selected | Excluded | Notes |
|---|---|---|---:|---:|---|
| 日本語 (Japanese) | bV | b/v | 4 | 4 | All selected are initial-position T1–T2 |
| 中文 (Mandarin) | vW | v/w | 4 | 4 | T1–T3; vise/wise excluded (needs_tts_review) |
| Español (Spanish) | iVsI | iː/ɪ | 6 | 3 | T1–T3; heal/hill selected with display note |
| العربية (Arabic) | pB | p/b | 6 | 3 | T1–T3 initial position only; final-position pairs excluded |
| فارسی (Farsi) | wV | w/v | 3 | 5 | T1–T2; wise/vise excluded (needs_tts_review) |
| **Total** | | | **23** | **19** | |

---

## Selected Candidates by Group

### 日本語 (Japanese) / bV — b/v contrast

**Source:** `docs/pair-expansion-candidates-batch-001.md` · Japanese/bV table
**Existing pairs in this group:** ban/van (T1), berry/very (T2), bow/vow (T3), bat/vat (T4), marble/marvel (T5), curb/curve (T6)
**Same-category duplicate check:** none of the 4 selected pairs appear in the existing data above in either word order.

| Tier | Word 1 | Word 2 | IPA 1 | IPA 2 | Position | Contrast phonemes | Why selected |
|---:|---|---|---|---|---|---|---|
| 1 | bet | vet | /bɛt/ | /vɛt/ | initial | b/v | Recommended; no risks; true minimal pair; common CVC |
| 1 | best | vest | /bɛst/ | /vɛst/ | initial | b/v | Recommended; no risks; common CVCC pair |
| 2 | boat | vote | /boʊt/ | /voʊt/ | initial | b/v | Recommended; no risks; high-frequency vocabulary |
| 2 | bail | veil | /beɪl/ | /veɪl/ | initial | b/v | Recommended; risks note confirms all meanings content-safe |

---

### 中文 (Mandarin) / vW — v/w contrast

**Source:** `docs/pair-expansion-candidates-batch-001.md` · Mandarin/vW table
**Existing pairs in this group:** vine/wine (T1), vest/west (T2), vow/wow (T3), vane/wane (T4), veal/wheel (T5), viper/wiper (T6)
**Same-category duplicate check:** none of the 4 selected pairs appear in the existing data above in either word order.

| Tier | Word 1 | Word 2 | IPA 1 | IPA 2 | Position | Contrast phonemes | Why selected |
|---:|---|---|---|---|---|---|---|
| 1 | vent | went | /vɛnt/ | /wɛnt/ | initial | v/w | Recommended; no risks; common everyday words |
| 1 | vet | wet | /vɛt/ | /wɛt/ | initial | v/w | Recommended; no risks; common CVC words |
| 2 | vile | while | /vaɪl/ | /waɪl/ | initial | v/w | Recommended; no risks; common words |
| 3 | veil | wail | /veɪl/ | /weɪl/ | initial | v/w | Recommended; no risks; both familiar |

---

### Español (Spanish) / iVsI — iː/ɪ contrast

**Source:** `docs/pair-expansion-candidates-batch-001.md` · Spanish/iVsI table
**Existing pairs in this group:** sheep/ship (T1), seat/sit (T1), leave/live (T2), feel/fill (T2), beat/bit (T3), feet/fit (T4), neat/knit (T5), peach/pitch (T6)
**Same-category duplicate check:** none of the 6 selected pairs appear in the existing data above in either word order.

| Tier | Word 1 | Word 2 | IPA 1 | IPA 2 | Position | Contrast phonemes | Why selected |
|---:|---|---|---|---|---|---|---|
| 1 | teen | tin | /tiːn/ | /tɪn/ | medial | iː/ɪ | Recommended; no risks; common words; distinct from thin/tin (θ/t contrast) |
| 1 | deed | did | /diːd/ | /dɪd/ | medial | iː/ɪ | Recommended; no risks; very high frequency |
| 2 | heat | hit | /hiːt/ | /hɪt/ | medial | iː/ɪ | Recommended; no risks; common everyday words |
| 2 | bead | bid | /biːd/ | /bɪd/ | medial | iː/ɪ | Recommended; no risks; common CVC words |
| 3 | heal | hill | /hiːl/ | /hɪl/ | medial | iː/ɪ | Recommended; display note only: use spelling "heal" (not "heel") in app data |
| 3 | meal | mill | /miːl/ | /mɪl/ | medial | iː/ɪ | Recommended; no risks; common everyday words |

> **heal/hill display note:** "heal" and "heel" are homophones (/hiːl/). The data-import PR must use the spelling "heal" to show the intended word on screen. The phonemic pair is valid regardless of spelling choice.

---

### العربية (Arabic) / pB — p/b contrast

**Source:** `docs/pair-expansion-candidates-batch-001.md` · Arabic/pB table
**Existing pairs in this group:** pat/bat (T1), pan/ban (T2), pear/bear (T3), pack/back (T4), rapid/rabid (T5), cap/cab (T6)
**Same-category duplicate check:** none of the 6 selected pairs appear in the existing data above in either word order.

| Tier | Word 1 | Word 2 | IPA 1 | IPA 2 | Position | Contrast phonemes | Why selected |
|---:|---|---|---|---|---|---|---|
| 1 | pig | big | /pɪɡ/ | /bɪɡ/ | initial | p/b | Recommended; no risks; common CVC words |
| 1 | pin | bin | /pɪn/ | /bɪn/ | initial | p/b | Recommended; no risks; common CVC words |
| 2 | pet | bet | /pɛt/ | /bɛt/ | initial | p/b | Recommended; no risks; common CVC words |
| 2 | pill | bill | /pɪl/ | /bɪl/ | initial | p/b | Recommended; no risks; common words |
| 3 | peak | beak | /piːk/ | /biːk/ | initial | p/b | Recommended; no risks; both familiar |
| 3 | pale | bale | /peɪl/ | /beɪl/ | initial | p/b | Recommended; risks note confirms "bale" is widely understood |

---

### فارسی (Farsi) / wV — w/v contrast

**Source:** `docs/pair-expansion-candidates-batch-001.md` · Farsi/wV table
**Existing pairs in this group:** wine/vine (T1), west/vest (T2), wow/vow (T3), wane/vane (T4), wheel/veal (T5), wiper/viper (T6)
**Same-category duplicate check:** none of the 3 selected pairs appear in the existing data above in either word order.

| Tier | Word 1 | Word 2 | IPA 1 | IPA 2 | Position | Contrast phonemes | Why selected |
|---:|---|---|---|---|---|---|---|
| 1 | went | vent | /wɛnt/ | /vɛnt/ | initial | w/v | Recommended; risks note is informational only (cross-category consistency note) |
| 1 | wet | vet | /wɛt/ | /vɛt/ | initial | w/v | Recommended; risks note is informational only |
| 2 | while | vile | /waɪl/ | /vaɪl/ | initial | w/v | Recommended; no risks |

> **Cross-category note:** went/vent (Farsi/wV) and vent/went (Mandarin/vW) are reversed forms of the same phonemic pair. Both are selected in their respective groups. A data-import PR that adds pairs to both groups should import consistently. This is expected and documented in Batch 001.

---

## Excluded Candidates

All 19 Batch 001 candidates not meeting the selection policy. Every candidate from the
corrected packet is accounted for in either the selected tables above or this table.

| Category | Group ID | Word 1 | Word 2 | Tier | Status | Reason excluded |
|---|---|---|---|---:|---|---|
| 日本語 | bV | bend | vend | 3 | candidate | Not `recommended`; policy excludes all `candidate` rows |
| 日本語 | bV | bile | vile | 3 | candidate | Not `recommended`; policy excludes all `candidate` rows |
| 日本語 | bV | robe | rove | 4 | needs_tts_review | Final b/v TTS devoicing risk unresolved |
| 日本語 | bV | rebel | revel | 5 | needs_ipa_review | IPA and TTS risk in unstressed medial position unresolved |
| 中文 | vW | vise | wise | 2 | needs_tts_review | TTS rendering of "vise" not yet verified against app voice |
| 中文 | vW | very | wary | 3 | candidate | Not `recommended`; policy excludes all `candidate` rows |
| 中文 | vW | vend | wend | 4 | needs_tts_review | "Wend" TTS reliability unverified |
| 中文 | vW | vim | whim | 4 | too_obscure_for_tier | "Vim" too low-frequency for L2 learner populations |
| Español | iVsI | deep | dip | 3 | candidate | Not `recommended`; policy excludes all `candidate` rows |
| Español | iVsI | seal | sill | 4 | candidate | Not `recommended`; policy excludes all `candidate` rows |
| Español | iVsI | least | list | 5 | candidate | Not `recommended`; policy excludes all `candidate` rows |
| العربية | pB | pest | best | 4 | candidate | Not `recommended`; policy excludes all `candidate` rows |
| العربية | pB | tap | tab | 5 | needs_tts_review | Final p/b TTS rendering unverified |
| العربية | pB | cup | cub | 6 | needs_tts_review | Final p/b TTS rendering unverified; depends on cap/cab TTS check first |
| فارسی | wV | wise | vise | 2 | needs_tts_review | TTS rendering of "vise" not yet verified against app voice |
| فارسی | wV | wary | vary | 3 | needs_human_decision | "vary"/"very" homophone; spelling choice requires product decision |
| فارسی | wV | wail | veil | 3 | candidate | Not `recommended`; policy excludes all `candidate` rows |
| فارسی | wV | wend | vend | 4 | needs_tts_review | "Wend" TTS reliability unverified |
| فارسی | wV | whim | vim | 4 | too_obscure_for_tier | "Vim" too low-frequency for L2 learner populations |

---

## Collision and Safety Notes

**Same-category duplicate check (selected candidates only):**

All 23 selected candidates were confirmed absent from the existing pairs in their respective
category × group in `app/constants/minimalPairs/*.ts` in both word order and reversed word
order. No same-category collisions found.

**Cross-category overlap (informational, not exclusionary):**

The following cross-category word reuses exist among selected candidates. None are collisions
within any single category × group. A data-import PR author should be aware of them:

| Words | Categories | Context |
|---|---|---|
| vent/went and went/vent | 中文/vW and فارسی/wV | Same phonemic pair reversed; expected and documented in Batch 001 |
| vet/wet and wet/vet | 中文/vW and فارسی/wV | Same phonemic pair reversed; expected and documented in Batch 001 |
| vile/while and while/vile | 中文/vW and فارسی/wV | Same phonemic pair reversed; expected and documented in Batch 001 |
| bet/vet (Japanese/bV) and vet/wet (Mandarin/vW) | Different contrasts | "vet" appears in both; b/v vs. v/w contrast — not the same pair |
| pet/bet (Arabic/pB) and bet/vet (Japanese/bV) | Different contrasts | "bet" appears in both; p/b vs. b/v contrast — not the same pair |

**Homophone/product-decision candidates remain excluded:**

`wary/vary` (Farsi/wV) is excluded because "vary" and "very" are homophones in General
American (/ˈvɛri/) and a product decision on spelling is required before this pair can be
imported. The Batch 001 collision notes cover this in detail.

**TTS-gated candidates remain excluded:**

Candidates with `needs_tts_review` status must be verified against the app's actual TTS voice
before being reconsidered. They are not eligible for the next data-import PR without that step.

---

## Future Data-Import PR Guidance

When the data-import PR is ready, use this as a starting point. Replace bracketed values.

```markdown
## PR: Add safe expansion pairs from Batch 001 selection (app-029 follow-up)

### Source

Selected candidates from `docs/pair-expansion-safe-candidates-batch-001.md` (app-029).
Do not add any candidate that is not listed in that document's selected tables.

### Changes

Modified files:
- `app/constants/minimalPairs/japanese.ts` — bV group
- `app/constants/minimalPairs/mandarin.ts` — vW group
- `app/constants/minimalPairs/spanish.ts` — iVsI group
- `app/constants/minimalPairs/arabic.ts` — pB group
- `app/constants/minimalPairs/farsi.ts` — wV group

For each file:
- Add pairs to the correct group array (bV, vW, iVsI, pB, wV)
- Preserve existing group ID strings exactly
- Preserve the Row tuple structure: [word1, word2, difficulty, ipa1, ipa2, groupId, position]
- Add pairs at the proposed tiers only — confirm tier is still appropriate at import time
- For heal/hill (Spanish/iVsI): use spelling "heal" (not "heel") for word1

### Pre-import checklist

- [ ] Re-read `docs/pair-expansion-safe-candidates-batch-001.md` — confirm selected list unchanged
- [ ] Verify IPA against Merriam-Webster GAm for any pair you are uncertain about
- [ ] Manually synthesize each pair with the app's TTS voice and confirm contrast is audible
- [ ] Confirm no reversed duplicate exists within the target category × group before import

### Verification

- [ ] `npm test` passes
- [ ] `npm run validate:data` passes (no duplicate or reversed-duplicate errors)
- [ ] `npm run audit:sparse-tiers` — note which tiers improved
- [ ] `npm run audit:pair-targets` — regenerate `docs/pair-expansion-targets.md` with `--write`
- [ ] No scheduler, mastery, recommendation, UI, persistence, or analytics files changed

### Excluded candidates

Do NOT import from the following — they require TTS verification or product decisions first:

- robe/rove, rebel/revel (Japanese/bV)
- vise/wise, very/wary, vend/wend, vim/whim (Mandarin/vW)
- deep/dip, seal/sill, least/list (Spanish/iVsI)
- pest/best, tap/tab, cup/cub (Arabic/pB)
- wise/vise, wary/vary, wail/veil, wend/vend, whim/vim (Farsi/wV)
```

---

## Non-Goals

This PR explicitly does not:

- Add, edit, or delete any word pairs in `app/constants/minimalPairs/*.ts`
- Modify `app/constants/minimalPairs.ts`
- Change candidate statuses in `docs/pair-expansion-candidates-batch-001.md`
- Propose new candidates beyond those in Batch 001
- Change scheduler behavior
- Change mastery behavior
- Change recommendation behavior
- Change UI or copy
- Change persistence or analytics
- Change package scripts, tests, or audit scripts
- Claim any selected candidate is production-ready
