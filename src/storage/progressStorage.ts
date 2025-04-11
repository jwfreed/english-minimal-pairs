// progressStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

/* -- Interfaces -- */
export interface PairAttempt {
  isCorrect: boolean;
  timestamp: number;
}

export interface PairStats {
  attempts: PairAttempt[];
}

const STORAGE_KEY = 'pairProgress';

/* -- Storage Functions -- */
// Retrieve the progress from storage. If none exists, return an empty object.
export async function getProgress(): Promise<Record<string, PairStats>> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Record<string, PairStats>;
    }
  } catch (error) {
    console.error('Error reading progress:', error);
  }
  return {};
}

// Save an attempt for a given pair.
// The function reads the current progress, appends a new attempt (while limiting to the last 100),
// and writes the updated progress back to storage.
export async function saveAttempt(
  pairId: string,
  isCorrect: boolean,
  durationMin: number = 0
): Promise<void> {
  try {
    const progress = await getProgress();
    const now = Date.now();
    const newAttempt: PairAttempt = { isCorrect, timestamp: now };

    const pairStats = progress[pairId] || { attempts: [] };
    const updatedAttempts = [...pairStats.attempts, newAttempt];

    // Limit attempts to the last 100 for memory efficiency.
    pairStats.attempts = updatedAttempts.slice(-100);
    progress[pairId] = pairStats;

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Error saving attempt:', error);
  }
}

/* -- Calculation Helpers -- */
// Compute a weighted accuracy giving more weight to recent attempts.
export function getWeightedAccuracy(attempts: PairAttempt[]): number {
  if (attempts.length === 0) return 0;

  let weightSum = 0;
  let correctWeightedSum = 0;
  const total = attempts.length;

  for (let i = 0; i < total; i++) {
    // Here, the weight increases linearly for more recent attempts.
    const weight = (i + 1) / total;
    weightSum += weight;
    if (attempts[i].isCorrect) {
      correctWeightedSum += weight;
    }
  }
  return correctWeightedSum / weightSum;
}

// Generate data showing accuracy over time for charting purposes.
export function getAccuracyAndTimeOverTime(
  attempts: PairAttempt[]
): { timestamp: number; accuracy: number }[] {
  const data: { timestamp: number; accuracy: number }[] = [];
  let correct = 0;

  attempts.forEach((attempt, index) => {
    if (attempt.isCorrect) {
      correct += 1;
    }
    const accuracy = (correct / (index + 1)) * 100;
    data.push({ timestamp: attempt.timestamp, accuracy });
  });
  return data;
}

// Estimate active practice time based on the timestamp difference between the first
// and the last attempt. The result is clamped to 1 hour (3600000 ms) as a conservative estimate.
export function estimateActivePracticeTime(attempts: PairAttempt[]): number {
  if (attempts.length === 0) return 0;

  const first = attempts[0].timestamp;
  const last = attempts[attempts.length - 1].timestamp;
  const delta = last - first;

  // Clamp the elapsed time to a maximum of 1 hour.
  const clampedTime = Math.min(delta, 3600000);

  // Scale down the earned time by a factor (e.g., 0.5 for 50%).
  const scalingFactor = 0.5;
  return clampedTime * scalingFactor;
}
