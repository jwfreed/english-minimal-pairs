# Design: App-027 — Pair Expansion Candidate Packet (Batch 001)

## Problem

The pair expansion target matrix (app-026) shows 620 missing pairs across 417 underfilled
slots. Before any pair data can be added, a human curator must review candidate pairs for
linguistic quality, IPA accuracy, TTS reliability, and dialect robustness.

This PR creates the first candidate review packet — documentation only.

## Goal

Produce `docs/pair-expansion-candidates-batch-001.md`: a structured document proposing
candidate word pairs for 5 high-priority category × group combinations, formatted for
human review. No pair data is added in this PR.

## Scope

Documentation only. No scripts, tests, package.json changes, or production app file changes.

## Selected groups

Default batch scope confirmed. All 5 groups are present in the repo and HIGH severity at
tiers 1–3. They appear lower in the alphabetical priority ranking because Unicode CJK and
Arabic characters sort after Latin characters, but their linguistic priority is equivalent.

| # | Category | Group | Contrast | Missing early pairs | Justification |
|---|---|---|---|---:|---|
| 1 | 日本語 | bV | b/v | 6 | /v/ absent in Japanese phonology; flagship contrast |
| 2 | 中文 | vW | v/w | 6 | /v/ absent in standard Mandarin; flagship contrast |
| 3 | Español | iVsI | iː/ɪ | 4 | Major Spanish-English vowel contrast; partially filled |
| 4 | العربية | pB | p/b | 6 | /p/ absent in Arabic phonology; highest-priority Arabic group |
| 5 | فارسی | wV | w/v | 6 | w/v confusion common; highest-priority Farsi group |

## Output file

`docs/pair-expansion-candidates-batch-001.md`

Following docs naming convention: `docs/<kebab-case-topic>.md`

## Document sections

1. Title (`# Pair Expansion Candidates — Batch 001`)
2. Scope disclaimer (candidates only, no app data changed)
3. Selection basis (target matrix source, groups, why)
4. Candidate summary table
5. Per-group candidate tables (status, tier, IPA, position, contrast phonemes, rationale, risks)
6. Collision notes (existing pairs inspected, cross-category overlaps)
7. Human review checklist
8. Next implementation PR template
9. Non-goals

## IPA approach

Draft GAm IPA for all candidates. Mark `needs_ipa_review` where uncertain.
Mark `needs_dialect_review` for known regional variation.
No IPA in this document is production-ready.

## Review statuses

`candidate` | `recommended` | `needs_ipa_review` | `needs_tts_review` |
`needs_dialect_review` | `near_minimal_risky` | `too_obscure_for_tier` | `reject`

## Key collision notes

- Japanese/bV and Spanish/bV share the same existing pairs — cross-category overlap noted.
- Mandarin/vW and Farsi/wV share the same phonemic contrast with reversed word order.
  Candidate proposals for Farsi/wV are the word-reversed versions of Mandarin/vW proposals.
- Spanish/iVsI: the iː/ɪ contrast appears in almost every category; all cross-category
  occurrences noted but not auto-rejected.

## Acceptance criteria

- `docs/pair-expansion-candidates-batch-001.md` exists
- Each group has 6–10 candidates
- Each candidate has status, tier, words, IPA or TBD, position, contrast phonemes, rationale, risks
- Collision notes cover all 5 groups
- Human review checklist present
- Implementation PR template present
- No pair data changed
- No production app files changed
- All existing tests pass
- All existing audits pass
