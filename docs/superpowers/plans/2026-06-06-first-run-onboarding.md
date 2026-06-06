# First-Run Onboarding Gate — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show a one-shot onboarding screen before placement/practice on first launch, persisted via `@hasSeenOnboarding` in AsyncStorage.

**Architecture:** Inline gate in `index.tsx` with render order: loading → onboarding → placement → practice. Both flags (`showOnboarding`, `showPlacement`) are loaded together in one `Promise.all`. A new `onboardingStorage.ts` module owns the key and pure decision helper. `OnboardingScreen` is a plain full-screen View that mirrors the PlacementTest visual weight.

**Tech Stack:** React Native, Expo, AsyncStorage, TypeScript. No new npm dependencies. Tests use existing `node scripts/run-tests.js` infrastructure (Node.js + `assert`).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `app/storage/onboardingStorage.ts` | Key constant, pure decision helper, write helper |
| Create | `app/components/OnboardingScreen.tsx` | Onboarding UI component |
| Create | `scripts/onboarding.test.js` | Tests for pure onboarding logic |
| Modify | `app/constants/translationKeys.ts` | Add 7 new translation key names |
| Modify | `app/constants/alternateLanguages.ts` | Add 7 keys to English + all 14 other languages |
| Modify | `app/(tabs)/index.tsx` | Wire onboarding state, handler, and render gate |

---

## Task 1: Create `app/storage/onboardingStorage.ts`

**Files:**
- Create: `app/storage/onboardingStorage.ts`

- [ ] **Step 1: Create the file with the complete content**

```typescript
import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_SEEN_KEY = '@hasSeenOnboarding';

/** Returns true when onboarding should be shown (key absent from storage). */
export function shouldShowOnboarding(raw: string | null): boolean {
  return raw === null;
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
}
```

- [ ] **Step 2: Commit**

```bash
git add app/storage/onboardingStorage.ts
git commit -m "feat: add onboardingStorage module with key and decision helper"
```

---

## Task 2: Write and run tests for `onboardingStorage`

**Files:**
- Create: `scripts/onboarding.test.js`
- Test runner: `npm run test`

- [ ] **Step 1: Create the test file**

```javascript
const assert = require('assert');
const path = require('path');
const { loadTsModule } = require('./load-ts-module');

const {
  ONBOARDING_SEEN_KEY,
  shouldShowOnboarding,
} = loadTsModule(path.join(__dirname, '..', 'app', 'storage', 'onboardingStorage.ts'));

function runTest(name, fn) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    console.error(`not ok - ${name}`);
    throw error;
  }
}

// ── ONBOARDING_SEEN_KEY ──────────────────────────────────────────────────────

runTest('ONBOARDING_SEEN_KEY has expected value', () => {
  assert.strictEqual(ONBOARDING_SEEN_KEY, '@hasSeenOnboarding');
});

// ── shouldShowOnboarding ─────────────────────────────────────────────────────

runTest('null raw → show onboarding (fresh install, key absent)', () => {
  assert.strictEqual(shouldShowOnboarding(null), true);
});

runTest("'true' raw → skip onboarding (previously dismissed)", () => {
  assert.strictEqual(shouldShowOnboarding('true'), false);
});

runTest("empty string raw → skip onboarding (any non-null value skips)", () => {
  assert.strictEqual(shouldShowOnboarding(''), false);
});

runTest("arbitrary non-null string → skip onboarding", () => {
  assert.strictEqual(shouldShowOnboarding('anything'), false);
});
```

- [ ] **Step 2: Run tests and confirm they pass**

```bash
npm run test
```

Expected: all existing tests pass, plus four new `ok - ...` lines from `onboarding.test.js`.

- [ ] **Step 3: Commit**

```bash
git add scripts/onboarding.test.js
git commit -m "test: add onboarding flag decision helper tests"
```

---

## Task 3: Add translation keys to `translationKeys.ts`

**Files:**
- Modify: `app/constants/translationKeys.ts`

- [ ] **Step 1: Add 7 new keys to the `tKeys` object**

Open `app/constants/translationKeys.ts`. The file ends with:
```typescript
  helpButton: 'helpButton',
} as const;
```

Change it to:
```typescript
  helpButton: 'helpButton',
  // Onboarding
  onboardingTitle: 'onboardingTitle',
  onboardingCTA: 'onboardingCTA',
  onboardingBullet1: 'onboardingBullet1',
  onboardingBullet2: 'onboardingBullet2',
  onboardingBullet3: 'onboardingBullet3',
  onboardingBullet4: 'onboardingBullet4',
  onboardingBullet5: 'onboardingBullet5',
} as const;
```

- [ ] **Step 2: Run typecheck to catch any immediate issues**

```bash
npm run typecheck
```

Expected: errors about `TranslationSchema` — the new keys must appear in every language object. This is expected and will be fixed in Task 4.

- [ ] **Step 3: Commit** (after Task 4 makes typecheck pass — skip this commit and do it together with Task 4's commit)

---

## Task 4: Add translation values to `alternateLanguages.ts`

**Files:**
- Modify: `app/constants/alternateLanguages.ts`

`TranslationSchema` is typed as `Record<keyof typeof englishTranslations, string>`, so every language object in `alternateLanguages` must include all 7 new keys. Non-English entries use English strings as placeholders — `translate()` already falls back to English at runtime for missing keys, so this is just satisfying the type system.

- [ ] **Step 1: Add 7 keys to `englishTranslations`**

Locate the end of `englishTranslations` in `app/constants/alternateLanguages.ts`. It currently ends with:
```typescript
    helpButton: 'Got it',
  } as const;
```

Change it to:
```typescript
    helpButton: 'Got it',
    onboardingTitle: 'Welcome to Soundwise',
    onboardingCTA: 'Start Listening',
    onboardingBullet1: 'Train your ear.',
    onboardingBullet2: 'Listen to the word.',
    onboardingBullet3: 'Choose which word you heard.',
    onboardingBullet4: 'Practice adapts to your progress.',
    onboardingBullet5: 'No microphone needed.',
  } as const;
```

- [ ] **Step 2: Add 7 keys to each non-English language object**

There are 14 non-English language objects. Each ends with a `helpButton: '...',` line. For every one of them, add the 7 onboarding keys (with English placeholder values) immediately after `helpButton`.

The 14 language objects are: `日本語`, `中文`, `ภาษาไทย`, `Español`, `العربية`, `Русский`, `한국어`, `हिन्दी / اردو`, `Português`, `Tiếng Việt`, `Türkçe`, `فارسی`, `廣東話`, `Bahasa Indonesia`.

For **each** of those objects, find the closing pattern:
```typescript
    helpButton: '<native text>',
  },
```

And replace it with:
```typescript
    helpButton: '<native text>',
    onboardingTitle: 'Welcome to Soundwise',
    onboardingCTA: 'Start Listening',
    onboardingBullet1: 'Train your ear.',
    onboardingBullet2: 'Listen to the word.',
    onboardingBullet3: 'Choose which word you heard.',
    onboardingBullet4: 'Practice adapts to your progress.',
    onboardingBullet5: 'No microphone needed.',
  },
```

Note: the last language object (`Bahasa Indonesia`) ends with `},` followed by `};` — handle accordingly.

- [ ] **Step 3: Run typecheck — expect clean output**

```bash
npm run typecheck
```

Expected: no errors. If TypeScript still complains about `TranslationSchema`, verify you've added the keys to every language object.

- [ ] **Step 4: Commit**

```bash
git add app/constants/translationKeys.ts app/constants/alternateLanguages.ts
git commit -m "feat: add onboarding translation keys (English values; other languages use English fallback)"
```

---

## Task 5: Create `app/components/OnboardingScreen.tsx`

**Files:**
- Create: `app/components/OnboardingScreen.tsx`

- [ ] **Step 1: Create the file with the complete content**

```typescript
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAllThemeColors } from '@/app/context/theme';
import { useLanguage } from '@/app/context/LanguageContext';
import { tKeys } from '@/app/constants/translationKeys';
import { ThemedText } from '@/app/components/ThemedText';
import createStyles from '@/app/constants/styles';

interface OnboardingScreenProps {
  onDismiss: () => Promise<void>;
}

const BULLET_KEYS = [
  tKeys.onboardingBullet1,
  tKeys.onboardingBullet2,
  tKeys.onboardingBullet3,
  tKeys.onboardingBullet4,
  tKeys.onboardingBullet5,
] as const;

export default function OnboardingScreen({ onDismiss }: OnboardingScreenProps) {
  const theme = useAllThemeColors();
  const { translate } = useLanguage();
  const sharedStyles = useMemo(() => createStyles(theme), [theme]);
  const localStyles = useMemo(() => createOnboardingStyles(theme), [theme]);

  return (
    <View style={sharedStyles.container}>
      <View style={sharedStyles.mainCard}>
        <ThemedText style={localStyles.title} type="subtitle">
          {translate(tKeys.onboardingTitle)}
        </ThemedText>

        <View style={localStyles.bulletList}>
          {BULLET_KEYS.map((key) => (
            <View key={key} style={localStyles.bulletRow}>
              <ThemedText style={localStyles.bullet}>•</ThemedText>
              <ThemedText style={localStyles.bulletText}>{translate(key)}</ThemedText>
            </View>
          ))}
        </View>

        <TouchableOpacity
          accessibilityLabel={translate(tKeys.onboardingCTA)}
          accessibilityRole="button"
          activeOpacity={0.85}
          onPress={onDismiss}
          style={sharedStyles.button}
        >
          <Text style={sharedStyles.buttonText}>{translate(tKeys.onboardingCTA)}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createOnboardingStyles = (theme: ReturnType<typeof useAllThemeColors>) =>
  StyleSheet.create({
    title: {
      fontSize: 24,
      lineHeight: 30,
      marginBottom: 20,
      textAlign: 'center',
      color: theme.text,
    },
    bulletList: {
      width: '100%',
      gap: 12,
      marginBottom: 24,
    },
    bulletRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
    },
    bullet: {
      width: 18,
      lineHeight: 24,
      color: theme.text,
    },
    bulletText: {
      flex: 1,
      fontSize: 16,
      lineHeight: 24,
      color: theme.text,
    },
  });
```

- [ ] **Step 2: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/components/OnboardingScreen.tsx
git commit -m "feat: add OnboardingScreen component"
```

---

## Task 6: Wire onboarding gate into `app/(tabs)/index.tsx`

**Files:**
- Modify: `app/(tabs)/index.tsx`

This task has five sub-steps. Apply them in order on the same file before committing.

- [ ] **Step 1: Add imports**

At the top of `app/(tabs)/index.tsx`, after the existing imports block, add:

```typescript
import {
  ONBOARDING_SEEN_KEY,
  shouldShowOnboarding,
  markOnboardingSeen,
} from '@/app/storage/onboardingStorage';
import OnboardingScreen from '@/app/components/OnboardingScreen';
```

- [ ] **Step 2: Add `showOnboarding` state**

Locate the existing state declaration (around line 79):
```typescript
const [showPlacement, setShowPlacement] = useState<boolean | null>(null); // null = loading
```

Add `showOnboarding` immediately after it:
```typescript
const [showPlacement, setShowPlacement] = useState<boolean | null>(null); // null = loading
const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null); // null = loading
```

- [ ] **Step 3: Add `handleOnboardingDismiss` callback**

Locate `handlePlacementComplete` (around line 107). Add `handleOnboardingDismiss` immediately before it:

```typescript
const handleOnboardingDismiss = useCallback(async () => {
  try {
    await markOnboardingSeen();
  } catch {
    // Write failure: onboarding may reappear on next cold launch.
    // User continues in the current session.
  }
  setShowOnboarding(false);
}, []);

const handlePlacementComplete = useCallback(async (startTier: number) => {
```

- [ ] **Step 4: Replace the startup `useEffect`**

Locate the full existing `useEffect` (around lines 89–105):

```typescript
useEffect(() => {
    const perCatKey = buildPlacementStorageKey(catKey);
    Promise.all([
      AsyncStorage.getItem(perCatKey),
      AsyncStorage.getItem(PLACEMENT_DONE_KEY),
      AsyncStorage.getItem(PLACEMENT_LEGACY_MIGRATION_KEY),
    ]).then(async ([categoryRaw, legacyRaw, sentinelRaw]) => {
      const decision = resolvePlacementStateForCategory({ categoryRaw, legacyRaw, sentinelRaw });
      if (decision.shouldSeedCurrentCategoryFromLegacy) {
        await AsyncStorage.setItem(perCatKey, serializePlacementDone()).catch(() => {});
      }
      if (decision.shouldWriteLegacyMigrationSentinel) {
        await AsyncStorage.setItem(PLACEMENT_LEGACY_MIGRATION_KEY, serializePlacementDone()).catch(() => {});
      }
      setShowPlacement(decision.shouldShowPlacement);
    }).catch(() => setShowPlacement(false));
  }, [catKey]);
```

Replace it in full with:

```typescript
useEffect(() => {
    let cancelled = false;
    const perCatKey = buildPlacementStorageKey(catKey);
    Promise.all([
      AsyncStorage.getItem(perCatKey),
      AsyncStorage.getItem(PLACEMENT_DONE_KEY),
      AsyncStorage.getItem(PLACEMENT_LEGACY_MIGRATION_KEY),
      AsyncStorage.getItem(ONBOARDING_SEEN_KEY),
    ]).then(async ([categoryRaw, legacyRaw, sentinelRaw, onboardingRaw]) => {
      const decision = resolvePlacementStateForCategory({ categoryRaw, legacyRaw, sentinelRaw });
      if (decision.shouldSeedCurrentCategoryFromLegacy) {
        await AsyncStorage.setItem(perCatKey, serializePlacementDone()).catch(() => {});
      }
      if (decision.shouldWriteLegacyMigrationSentinel) {
        await AsyncStorage.setItem(PLACEMENT_LEGACY_MIGRATION_KEY, serializePlacementDone()).catch(() => {});
      }
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
    return () => { cancelled = true; };
  }, [catKey]);
```

- [ ] **Step 5: Update the render block**

Locate the loading return (around line 290):
```typescript
if (showPlacement === null) {
```

Replace it with:
```typescript
if (showPlacement === null || showOnboarding === null) {
```

Then locate the placement return (around line 299):
```typescript
if (showPlacement) {
    return (
      <PlacementTest
```

Add the onboarding gate immediately before it:
```typescript
if (showOnboarding) {
    return <OnboardingScreen onDismiss={handleOnboardingDismiss} />;
  }

  if (showPlacement) {
    return (
      <PlacementTest
```

- [ ] **Step 6: Run typecheck and tests**

```bash
npm run typecheck && npm run test
```

Expected: no typecheck errors, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add app/(tabs)/index.tsx
git commit -m "feat: wire first-run onboarding gate into practice tab startup"
```

---

## Task 7: Run full validation

- [ ] **Step 1: Run all checks**

```bash
npm run test && npm run typecheck && npm run lint
```

Expected: all pass with no errors or warnings introduced by this change.

- [ ] **Step 2: Confirm diff scope**

```bash
git diff main --stat
```

Expected output — only these files appear:
```
app/(tabs)/index.tsx
app/components/OnboardingScreen.tsx
app/constants/alternateLanguages.ts
app/constants/translationKeys.ts
app/storage/onboardingStorage.ts
docs/superpowers/plans/2026-06-06-first-run-onboarding.md
docs/superpowers/specs/2026-06-06-first-run-onboarding-design.md
scripts/onboarding.test.js
```

No placement, audio, mastery, scoring, or category files should appear.

---

## Manual Retest — First-Run Onboarding

**To simulate a first-time user:**

Option 1 (fastest — dev console / Flipper / Expo DevTools):
```javascript
AsyncStorage.removeItem('@hasSeenOnboarding')
```
Then navigate away and back to the Practice tab (or cold-launch).

Option 2 (full clean):
Uninstall and reinstall the app, or clear all app data via: device Settings → Apps → Soundwise → Clear Data.

**Expected first-run flow:**
1. App opens Practice tab
2. Brief "Loading…" (single spinner, same as before)
3. Onboarding screen appears: title + 5 bullet points + "Start Listening" button
4. Tap "Start Listening"
5. Onboarding dismisses
6. Placement test appears (if not yet done for this category) — OR practice screen directly (if placement already done)
7. Everything works as before

**Expected return visit:**
1. App opens Practice tab
2. Brief "Loading…"
3. Onboarding does NOT appear
4. Placement or practice screen as normal

---

## Known Risks

- **AsyncStorage write failure on dismiss:** If `markOnboardingSeen()` throws, `setShowOnboarding(false)` still runs so the current session is unaffected. On the next cold launch, onboarding will reappear. No retry logic is added — acceptable for a low-stakes flag.
- **Translation coverage:** Non-English languages show English onboarding copy. This is intentional and consistent with how other bootstrap keys were added. Per-language translations can be added incrementally.
