import AsyncStorage from '@react-native-async-storage/async-storage';
import { PairStats } from './types';

const PROGRESS_KEY = '@userProgress';

// Utility: compute time weighting based on attention span
function computeEffectiveDuration(durationMs: number): number {
  if (durationMs < 500) return 0; // Likely a guess
  if (durationMs > 10000) return 0.2 * (5000 / 60000); // Distracted: heavily discounted
  return Math.min(durationMs, 5000) / 60000; // Max 5 seconds counted
}

export async function saveAttempt(
  pairId: string,
  isCorrect: boolean,
  durationMin: number = 0
) {
  try {
    const data = await AsyncStorage.getItem(PROGRESS_KEY);
    const progress = data ? JSON.parse(data) : {};
    const attempts = progress[pairId]?.attempts || [];

    attempts.push({
      isCorrect,
      timestamp: Date.now(),
      durationMin,
    });

    progress[pairId] = { attempts };
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    console.error('Failed to save progress', e);
  }
}

export async function getProgress(): Promise<Record<string, PairStats>> {
  try {
    const data = await AsyncStorage.getItem(PROGRESS_KEY);
    return data ? JSON.parse(data) : {};
  } catch (e) {
    console.error('Failed to get progress', e);
    return {};
  }
}

export async function resetProgress() {
  try {
    await AsyncStorage.removeItem(PROGRESS_KEY);
  } catch (e) {
    console.error('Failed to reset progress', e);
  }
}

// Analytics functions
export function getWeightedAccuracy(attempts: { isCorrect: boolean; timestamp: number }[]): number {
  if (!attempts.length) return 0;
  const now = Date.now();
  const decay = 0.95;
  let weightedCorrect = 0;
  let totalWeight = 0;

  for (let i = 0; i < attempts.length; i++) {
    const { isCorrect, timestamp } = attempts[i];
    const age = now - timestamp;
    const weight = Math.pow(decay, age / 3600000); // Decay per hour
    totalWeight += weight;
    if (isCorrect) weightedCorrect += weight;
  }

  return totalWeight > 0 ? weightedCorrect / totalWeight : 0;
}

export function estimateActivePracticeTime(attempts: { durationMin?: number }[]): number {
  return attempts.reduce((total, attempt) => total + (attempt.durationMin || 0), 0) * 60000; // in ms
}

export function getAccuracyAndTimeOverTime(
  attempts: { isCorrect: boolean; timestamp: number; durationMin?: number }[]
): { timestamp: number; accuracy: number }[] {
  const windowSize = 5;
  const result = [];

  for (let i = windowSize - 1; i < attempts.length; i++) {
    const window = attempts.slice(i - windowSize + 1, i + 1);
    const correctCount = window.filter((a) => a.isCorrect).length;
    result.push({
      timestamp: attempts[i].timestamp,
      accuracy: correctCount / window.length,
    });
  }

  return result;
}

// Optional: helper for computing effective duration externally
export function getEffectiveDurationMs(startTime: number): number {
  const now = Date.now();
  const elapsed = now - startTime;
  return Math.round(computeEffectiveDuration(elapsed) * 60000); // Return ms value for display or saving
}
