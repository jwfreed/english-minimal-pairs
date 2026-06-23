import AsyncStorage from '@react-native-async-storage/async-storage';

export const ONBOARDING_SEEN_KEY = '@hasSeenOnboarding';

/** Returns true when onboarding should be shown (key absent from storage). */
export function shouldShowOnboarding(raw: string | null): boolean {
  return raw === null;
}

export async function markOnboardingSeen(): Promise<void> {
  await AsyncStorage.setItem(ONBOARDING_SEEN_KEY, 'true');
}
