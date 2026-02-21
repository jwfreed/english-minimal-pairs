## Plan: HVPT-Aligned App Overhaul

**TL;DR:** Overhaul the app across 8 workstreams to align with High-Variability Phonetic Training research. Auto-rotate all available en-* TTS voices for talker variability. Expand each contrast group from 4→6 tiers covering initial/medial/final positions. Replace all non-real words and false minimal pairs. Add rich combined feedback (correct answer, IPA, phoneme highlighting, replay button). Add a placement diagnostic test. Add a daily session timer. Widen the adaptive speed range and persist mastery. Remove the duplicate chinese.ts. No .mp3 assets — all voice variability comes from the device's TTS engine.

**Steps**

### 1. Expand TTS voice pool + auto-rotation

- In `app/context/SettingsContext.tsx`, rewrite `selectPriorityVoices` (L82–L115) to collect **all** en-* voices (not just Samantha/Daniel). Filter `voices.filter(v => v.language.startsWith('en'))` and deduplicate by `identifier`. Store the full array in `availableVoices`.
- Remove the single `selectedVoice` model. Replace with a `voicePool: Voice[]` that is the full set of discovered `en-*` voices.
- Add a new export `getNextVoice(): Voice` that cycles through `voicePool` in round-robin order using a `useRef` index counter. Each call to `play()` picks the next voice.
- In `app/hooks/useAudio.ts`, change the `voice` parameter from a single `Voice | null` to accept the `getNextVoice` function. In `play()` (L160–L208), call `getNextVoice()` each time to select the voice for that utterance.
- In `app/(tabs)/settings.tsx`, replace the voice picker section with a read-only display: "X voices available" with a "Refresh" button. Remove the single-voice selection UI and `formatVoiceName`. Update `tKeys` and translations accordingly.
- Update `app/(tabs)/index.tsx` to pass the pool/getter instead of `selectedVoice`.

### 2. Fix all non-real words + false minimal pairs + mislabeled entries

Replace these entries across all 14 language files:

| Current pair | Problem | Replacement | IPA | Files to edit |
|---|---|---|---|---|
| `think / tink` | "tink" non-real | `thaw / taw` | `/θɔː/` `/tɔː/` | farsi.ts, hindu_urdu.ts, indonesian.ts, portuguese.ts, thai.ts, turkish.ts, vietnamese.ts |
| `seal / theel` | "theel" non-real | `sigh / thigh` | `/saɪ/` `/θaɪ/` | japanese.ts |
| `cash / cush` | "cush" non-real + wrong IPA | `cap / cup` | `/kæp/` `/kʌp/` | japanese.ts |
| `vest / fest` | "fest" borderline | `vat / fat` | `/væt/` `/fæt/` | arabic.ts, indonesian.ts, thai.ts |
| `mouth / tout` | False pair (2 segments differ) | `math / mat` | `/mæθ/` `/mæt/` | farsi.ts, hindu_urdu.ts, indonesian.ts, portuguese.ts, turkish.ts |
| `boot / book` | False pair (t→k also differs) | `suit / soot` | `/suːt/` `/sʊt/` | mandarin.ts, portuguese.ts, turkish.ts |
| `sip / thick` | False pair (p→k also differs) | `sick / thick` | `/sɪk/` `/θɪk/` | japanese.ts |
| `zoom / soon` | False pair (m→n also differs) | `zone / sewn` | `/zoʊn/` `/soʊn/` | hindu_urdu.ts, thai.ts, vietnamese.ts |
| `ball / wall` | Mislabeled in bV group (is b/w) | `bat / vat` | `/bæt/` `/væt/` | japanese.ts, spanish.ts |

### 3. Expand contrast groups from 4→6 tiers with positional coverage

- Add a `position: 'initial' | 'medial' | 'final'` field to the `Pair` type in `app/constants/minimalPairs.ts`.
- Update the `Row` tuple type in each language file to include a 7th element for position.
- Expand the `Difficulty` type from `1 | 2 | 3 | 4` to `1 | 2 | 3 | 4 | 5 | 6`.
- For each contrast group in each language file, add 2 new pairs:
  - One targeting **medial** position (e.g., for /r/-/l/: `arrive / alive`)
  - One targeting **final** position (e.g., for /r/-/l/: `pour / pole`)
  - Existing 4 pairs get `position: 'initial'` (or `'medial'` for vowel groups).
- Update `app/hooks/useContrastPairs.ts` to cap mastery at **6** instead of 4.
- Update the promotion logic in `app/(tabs)/index.tsx` to accommodate 6 tiers.

### 4. Implement rich combined feedback

- In the `Pair` type (`app/constants/minimalPairs.ts`), add `contrastPhoneme1: string` and `contrastPhoneme2: string` fields that identify the contrasting segment (e.g., `'r'` and `'l'` for rake/lake). Populate these in each language file.
- Rewrite `app/components/AnswerButtons.tsx`:
  - After incorrect answer, replace the ✗ overlay with a new `FeedbackPanel` component.
  - `FeedbackPanel` shows: "The word was **[correct word]** /IPA/" with the contrasting phoneme **bolded and colored** in both the word text and IPA.
  - Add a "Listen Again" `TouchableOpacity` button that calls `play(playedIdx)` so the user can replay with the answer visible.
  - After correct answer, keep the ✓ overlay but also briefly display the played word.
- Pass `play` callback and `playedIdx` down from `app/(tabs)/index.tsx` to `AnswerButtons` as new props.
- Add `feedbackPanel`, `feedbackWord`, `feedbackIPA`, `feedbackHighlight`, `replayButton` styles to `app/constants/styles.ts`.
- Add translation keys for "The word was" and "Listen Again" to `app/constants/translationKeys.ts` and all 15 entries in `app/constants/alternateLanguages.ts`.

### 5. Add placement diagnostic test

- Create new file `app/components/PlacementTest.tsx`:
  - Renders a quick forced-choice quiz: 2 items per contrast group for the user's selected L1 (10 items for 5 groups).
  - Uses the same `useAudio` hook for playback.
  - Records results with no persisted progress (test-only).
  - Returns a `Record<string, number>` mapping group → starting difficulty tier (1–6) based on accuracy: 2/2 correct → start at tier 4; 1/2 → tier 2; 0/2 → tier 1.
- Create new context or extend `PairProgressContext` to store placement results in AsyncStorage (key `@placementResults`).
- In `app/(tabs)/index.tsx`, check for placement results on mount. If none exist, show the placement test instead of the practice screen.
- In `app/hooks/useContrastPairs.ts`, initialize `mastery` from placement results instead of defaulting all groups to 1.
- Add a "Retake Placement Test" option in `app/(tabs)/settings.tsx` that clears `@placementResults`.
- Add all needed translation keys to `app/constants/translationKeys.ts` and `app/constants/alternateLanguages.ts`.

### 6. Add daily session timer

- Create new file `app/components/SessionTimer.tsx`:
  - Tracks today's active practice time (wall-clock timer running while on the practice screen, paused when inactive or navigated away).
  - Displays: "Today: **X** / 30 min" with a mini progress bar.
  - Persists daily totals in AsyncStorage (key `@dailySessions`) with date-keyed entries.
  - Uses `AppState` listener to pause/resume on background/foreground.
- Integrate `SessionTimer` into the home screen layout in `app/(tabs)/index.tsx` above the `PairPicker`.
- Add styles for `sessionTimerContainer`, `sessionTimerText`, `sessionTimerBar` to `app/constants/styles.ts`.
- Add translation keys "todaySession" and "dailyGoal" to `app/constants/translationKeys.ts` and all translations in `app/constants/alternateLanguages.ts`.

### 7. Widen adaptive speed range + persist mastery

- In `app/(tabs)/index.tsx`, change `SPEED_TABLE` from `{ 0: 1.0, 1: 1.1, 2: 1.2 }` to `{ 0: 0.8, 1: 1.0, 2: 1.1, 3: 1.2, 4: 1.3 }` and update `MAX_SPEED` to `4`. This means new users start hearing words at a slow, clear pace and must earn their way to natural speed.
- In `app/hooks/useContrastPairs.ts`, persist `mastery` state to AsyncStorage keyed by category (e.g., `@mastery_日本語`). Hydrate on mount. This prevents mastery reset on remount.
- No difficulty demotion per user preference — keep one-way mastery, but make the speed axis more aggressive as a "challenge point" proxy.

### 8. Remove duplicate chinese.ts + clean up aggregator

- Delete `app/constants/minimalPairs/chinese.ts`.
- In `app/constants/minimalPairs.ts`, remove the `import chinese from './minimalPairs/chinese'` line (if it exists — currently the aggregator only imports `mandarin`). Verify no other file references `chinese.ts`.

---

## Verification

- **Type safety:** Run `npx tsc --noEmit` to verify all new `Pair` fields (position, contrastPhoneme1/2), expanded `Difficulty` type, and changed function signatures compile cleanly.
- **Data integrity:** Write a script (`scripts/validate-pairs.ts`) that iterates all language files and asserts: (a) every pair uses real English words (against a dictionary), (b) no pair has >1 phoneme difference, (c) every group has exactly 6 tiers, (d) every group has at least 1 initial, 1 medial, and 1 final position pair.
- **Voice auto-rotation:** On a physical iOS device, verify that successive `Play Audio` taps produce audibly different voices. Log `voice.name` in dev mode.
- **Placement test:** Launch app with cleared AsyncStorage (`@placementResults`), verify placement quiz appears, complete it, and verify mastery starts at the predicted tiers.
- **Session timer:** Open home screen, practice for 2 minutes, background the app for 30 seconds, return — verify timer shows ~2 min, not ~2.5 min.
- **Feedback:** Answer incorrectly, verify the correct word + IPA appears with highlighted phoneme and a working "Listen Again" button.
- **Manual regression:** Cycle through all 14 languages, verify each loads 5 groups × 6 tiers = 30 pairs without crashes.

---

## Decisions

- **Voices:** Auto-rotation of all device en-* voices (no user selection) — maximizes HVPT talker variability without added complexity.
- **Pairs:** Expand to 6 tiers per group for initial/medial/final coverage.
- **Feedback:** Full combined feedback (correct word + IPA + phoneme highlight + replay).
- **Mastery:** No demotion across difficulty tiers; aggressively widen speed axis (0.8×–1.3×) instead.
- **chinese.ts:** Remove (exact duplicate of mandarin.ts).
- **No .mp3 assets:** All voice variability via device TTS.
