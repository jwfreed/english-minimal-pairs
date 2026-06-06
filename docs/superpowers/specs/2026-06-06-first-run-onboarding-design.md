# First-Run Onboarding Gate — Design Spec

**Date:** 2026-06-06  
**Status:** Approved

---

## Goal

Show a short onboarding screen once to first-time users before they enter the placement/practice flow. Persist a local flag so it never appears again. Existing placement, practice, audio, scoring, mastery, categories, and adaptive progression are completely unchanged.

---

## Render Order

```
showPlacement === null || showOnboarding === null
  → <LoadingView />          (single shared loading state)

showOnboarding === true
  → <OnboardingScreen />     (new — one-shot, inline, not a Modal)

showPlacement === true
  → <PlacementTest />        (existing, unchanged)

default
  → <practice UI />          (existing, unchanged)
```

The loading condition is `showPlacement === null || showOnboarding === null`. Both states are set together in a single `.then()`, so the spinner fires once and clears once.

---

## New File: `app/storage/onboardingStorage.ts`

Owns the onboarding flag key and the pure decision helper.

```ts
export const ONBOARDING_SEEN_KEY = '@hasSeenOnboarding';

/** Returns true if onboarding should be shown (key absent), false otherwise. */
export function shouldShowOnboarding(raw: string | null): boolean {
  return raw === null;
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
}
```

- Read: presence-based. `null` → show. Any non-null value → skip.
- Write: stores `'true'`. Value is irrelevant; only presence matters.
- `shouldShowOnboarding` is a pure function — directly testable without mounting a component.

---

## Changes to `app/(tabs)/index.tsx`

### New state

```ts
const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
```

### Expanded startup `useEffect`

The existing `Promise.all` adds a fourth item:

```ts
Promise.all([
  AsyncStorage.getItem(perCatKey),
  AsyncStorage.getItem(PLACEMENT_DONE_KEY),
  AsyncStorage.getItem(PLACEMENT_LEGACY_MIGRATION_KEY),
  AsyncStorage.getItem(ONBOARDING_SEEN_KEY),
]).then(async ([categoryRaw, legacyRaw, sentinelRaw, onboardingRaw]) => {
  // existing placement logic — unchanged
  const decision = resolvePlacementStateForCategory({ categoryRaw, legacyRaw, sentinelRaw });
  if (decision.shouldSeedCurrentCategoryFromLegacy) { ... }
  if (decision.shouldWriteLegacyMigrationSentinel) { ... }

  // new
  if (!cancelled) {
    setShowOnboarding(shouldShowOnboarding(onboardingRaw));
    setShowPlacement(decision.shouldShowPlacement);
  }
}).catch(() => {
  if (!cancelled) {
    setShowOnboarding(false);
    setShowPlacement(false);
  }
});
```

The `cancelled` flag follows the pattern already used in `useContrastPairs.ts`:

```ts
let cancelled = false;
// ... Promise.all ...
return () => { cancelled = true; };
```

This guards against state updates on unmounted components when the category changes mid-load.

### Dismiss handler

```ts
const handleOnboardingDismiss = useCallback(async () => {
  try {
    await markOnboardingSeen();
  } catch {
    // Write failure: onboarding won't show again this session (state is set),
    // but may reappear on next cold launch. Acceptable — user continues now.
  }
  setShowOnboarding(false);
}, []);
```

Flag is written **before** `setShowOnboarding(false)`. If the write fails, the session continues without interruption. The risk is that onboarding reappears on next cold launch — acceptable given the low-stakes nature of this flag.

### Render block additions (in order)

```tsx
if (showPlacement === null || showOnboarding === null) {
  return <LoadingView />;   // existing loading view, condition expanded
}

if (showOnboarding) {
  return <OnboardingScreen onDismiss={handleOnboardingDismiss} />;
}

if (showPlacement) {
  return <PlacementTest ... />;   // unchanged
}

// existing practice UI — unchanged
```

---

## New File: `app/components/OnboardingScreen.tsx`

A plain full-screen `<View>` — not a Modal. Styled consistently with `PlacementTest`.

**Props:**
```ts
interface OnboardingScreenProps {
  onDismiss: () => Promise<void>;
}
```

**Structure:**
- Wraps in `<View style={styles.container}>`
- Title: `tKeys.onboardingTitle` → "Welcome to Soundwise"
- Five bullet points (`tKeys.onboardingBullet1`–`5`), rendered with `ThemedText`
- CTA button using `styles.button` / `styles.buttonText`
- Button: `accessibilityRole="button"`, `accessibilityLabel={translate(tKeys.onboardingCTA)}`
- No images, no animations, no new dependencies

**Bullet copy:**
1. Train your ear.
2. Listen to the word.
3. Choose which word you heard.
4. Practice adapts to your progress.
5. No microphone needed.

---

## Translation Keys

### `app/constants/translationKeys.ts` — new entries

```ts
onboardingTitle: 'onboardingTitle',
onboardingCTA: 'onboardingCTA',
onboardingBullet1: 'onboardingBullet1',
onboardingBullet2: 'onboardingBullet2',
onboardingBullet3: 'onboardingBullet3',
onboardingBullet4: 'onboardingBullet4',
onboardingBullet5: 'onboardingBullet5',
```

### `app/constants/alternateLanguages.ts` — English values only

```ts
onboardingTitle: 'Welcome to Soundwise',
onboardingCTA: 'Start Listening',
onboardingBullet1: 'Train your ear.',
onboardingBullet2: 'Listen to the word.',
onboardingBullet3: 'Choose which word you heard.',
onboardingBullet4: 'Practice adapts to your progress.',
onboardingBullet5: 'No microphone needed.',
```

Other language entries must also be updated. `TranslationSchema` is typed as `Record<keyof typeof englishTranslations, string>`, so adding new keys to `englishTranslations` requires the same keys in every language object or TypeScript will error. Each non-English language entry gets the English string as a placeholder — this is consistent with how other keys were bootstrapped and `translate()` already falls back to English at runtime anyway.

---

## Tests: `scripts/onboarding.test.js`

Plain Node `assert` pattern — same as existing test scripts.

Tests for `shouldShowOnboarding` (pure function):

| `raw` input | Expected `shouldShowOnboarding(raw)` |
|---|---|
| `null` | `true` |
| `'true'` | `false` |
| `''` (empty string) | `false` |
| `'anything'` | `false` |

No component rendering. No new test framework.

---

## What Is Not Changed

- Placement state, migration, scoring: **unchanged**
- Audio, mastery, categories, adaptive progression: **unchanged**
- No new npm dependencies
- No analytics, accounts, backend, microphone
- No multi-screen tutorial
- No Modal overlay

---

## Manual Retest — First-Run Onboarding

To manually verify first-run behavior:

**Option 1 — Clear the flag only (fastest):**
```js
// In a dev console / Expo DevTools / Flipper AsyncStorage viewer:
AsyncStorage.removeItem('@hasSeenOnboarding')
```

**Option 2 — Via app debug menu (if accessible):**  
Add a temporary "Reset Onboarding" button to Settings (dev-only) that calls `AsyncStorage.removeItem('@hasSeenOnboarding')` and navigates back to Practice tab.

**Option 3 — Full clear:**  
Uninstall and reinstall the app, or clear all app data from device Settings → Apps → Soundwise → Clear Data.

After clearing, cold-launch the app and navigate to the Practice tab. Onboarding should appear. Tap "Start Listening." Onboarding should dismiss and placement/practice flow should proceed normally. Relaunch — onboarding should not appear.

---

## Risks / Follow-Up

- **Write failure on dismiss:** If `AsyncStorage.setItem` fails, the flag is not persisted. Onboarding will reappear on next cold launch. Risk is low (AsyncStorage is local) but acknowledged. No retry logic added.
- **Translation coverage:** Non-English languages will render English onboarding copy via fallback. Acceptable for now; translations can be added per-language incrementally.
- **Category change race:** The `cancelled` flag prevents stale state writes when the category changes during the async startup read. This matches the existing `useContrastPairs` pattern.
