// src/storage/progressStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRESS_KEY = '@userProgress';

/**
 * Represents a single quiz attempt on a specific pair
 */
export interface PairAttempt {
  isCorrect: boolean;
  timestamp: number; // when the attempt was made
  durationMin?: number; // how many minutes spent on this attempt (optional)
}

/**
 * Cumulative stats for a single minimal pair
 */
export interface PairStats {
  attempts: PairAttempt[];
  totalPracticeTimeMin: number; // sum of all durations for this pair
}

/**
 * Load all progress from AsyncStorage
 */
export async function getProgress(): Promise<Record<string, PairStats>> {
  try {
    const stored = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!stored) {
      return {};
    }
    return JSON.parse(stored);
  } catch (error) {
    console.error('Error loading progress from storage:', error);
    return {};
  }
}

/**
 * Save a single attempt for a given pairId
 *
 * @param pairId - unique ID for the minimal pair (e.g. "ship-sheep" or "bit-beat")
 * @param isCorrect - whether the user got it right
 * @param durationMin - optional time in minutes spent on this attempt
 */
export async function saveAttempt(
  pairId: string,
  isCorrect: boolean,
  durationMin = 0
) {
  try {
    // Load existing progress
    const progress = await getProgress();

    // Ensure the pairStats object exists
    if (!progress[pairId]) {
      progress[pairId] = {
        attempts: [],
        totalPracticeTimeMin: 0,
      };
    }

    // Create a new attempt
    const newAttempt: PairAttempt = {
      isCorrect,
      timestamp: Date.now(),
      durationMin,
    };

    // Push attempt
    progress[pairId].attempts.push(newAttempt);

    // Increment total practice time
    progress[pairId].totalPracticeTimeMin += durationMin;

    // Persist updated progress
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Error saving attempt:', error);
  }
}

/**
 * Reset all user progress (remove from AsyncStorage)
 */
export async function resetProgress() {
  try {
    await AsyncStorage.removeItem(PROGRESS_KEY);
  } catch (error) {
    console.error('Error resetting progress:', error);
  }
}
