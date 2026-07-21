import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import {
  PLACEMENT_DONE_KEY,
  PLACEMENT_LEGACY_MIGRATION_KEY,
  buildPlacementStorageKey,
  resolvePlacementStateForCategory,
  serializePlacementDone,
} from '@/src/domain/masteryPersistence';
import {
  ONBOARDING_SEEN_KEY,
  markOnboardingSeen,
  shouldShowOnboarding,
} from '@/src/storage/onboardingStorage';

interface EntryStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

interface PracticeEntryState {
  showOnboarding: boolean;
  showPlacement: boolean;
}

export async function initializePracticeEntryState(
  categoryKey: string,
  storage: EntryStorage = AsyncStorage
): Promise<PracticeEntryState> {
  const perCategoryKey = buildPlacementStorageKey(categoryKey);
  const [categoryRaw, legacyRaw, sentinelRaw, onboardingRaw] =
    await Promise.all([
      storage.getItem(perCategoryKey),
      storage.getItem(PLACEMENT_DONE_KEY),
      storage.getItem(PLACEMENT_LEGACY_MIGRATION_KEY),
      storage.getItem(ONBOARDING_SEEN_KEY),
    ]);
  const decision = resolvePlacementStateForCategory({
    categoryRaw,
    legacyRaw,
    sentinelRaw,
  });

  if (decision.shouldSeedCurrentCategoryFromLegacy) {
    await storage
      .setItem(perCategoryKey, serializePlacementDone())
      .catch(() => {});
  }
  if (decision.shouldWriteLegacyMigrationSentinel) {
    await storage
      .setItem(PLACEMENT_LEGACY_MIGRATION_KEY, serializePlacementDone())
      .catch(() => {});
  }

  return {
    showOnboarding: shouldShowOnboarding(onboardingRaw),
    showPlacement: decision.shouldShowPlacement,
  };
}

async function markPlacementDone(categoryKey: string): Promise<void> {
  const perCategoryKey = buildPlacementStorageKey(categoryKey);
  await AsyncStorage.setItem(perCategoryKey, serializePlacementDone()).catch(
    () => {}
  );
}

export function usePracticeEntryState(categoryKey: string) {
  const [showPlacement, setShowPlacement] = useState<boolean | null>(null);
  const [showOnboarding, setShowOnboarding] = useState<boolean | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  // Re-check placement each time the category changes. Legacy placement is
  // allowed to seed only the first category opened after migration.
  useEffect(() => {
    let cancelled = false;

    initializePracticeEntryState(categoryKey)
      .then((entryState) => {
        if (!cancelled) {
          setShowOnboarding(entryState.showOnboarding);
          setShowPlacement(entryState.showPlacement);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setShowOnboarding(false);
          setShowPlacement(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [categoryKey, refreshToken]);

  const refreshEntryState = useCallback(() => {
    // Tabs remain mounted while the user visits Settings. Return to the
    // loading gate before rereading storage so stale practice content cannot
    // flash after a placement reset.
    setShowPlacement(null);
    setShowOnboarding(null);
    setRefreshToken((current) => current + 1);
  }, []);

  const completeOnboarding = useCallback(async () => {
    try {
      await markOnboardingSeen();
    } catch {
      // Write failure: onboarding may reappear on next cold launch.
      // User continues in the current session.
    }
    setShowOnboarding(false);
  }, []);

  const completePlacement = useCallback(async () => {
    await markPlacementDone(categoryKey);
    setShowPlacement(false);
  }, [categoryKey]);

  const skipPlacement = useCallback(async () => {
    await markPlacementDone(categoryKey);
    setShowPlacement(false);
  }, [categoryKey]);

  return {
    showOnboarding,
    showPlacement,
    completeOnboarding,
    completePlacement,
    skipPlacement,
    refreshEntryState,
    isLoading: showPlacement === null || showOnboarding === null,
    isPracticeReady: showOnboarding === false && showPlacement === false,
  };
}
