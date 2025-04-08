// src/storage/progressStorage.js

import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRESS_KEY = '@userProgress';

export type PairAttempt = {
  timestamp: number;
  isCorrect: boolean;
};

export type PairStats = {
  attempts: PairAttempt[];
};

export const saveAttempt = async (
  pairId: string,
  isCorrect: boolean
): Promise<void> => {
  try {
    const currentData = await AsyncStorage.getItem(PROGRESS_KEY);
    const parsed: Record<string, PairStats> = currentData
      ? JSON.parse(currentData)
      : {};

    const newAttempt: PairAttempt = {
      timestamp: Date.now(),
      isCorrect,
    };

    const updatedPairAttempts = parsed[pairId]?.attempts || [];
    updatedPairAttempts.push(newAttempt);

    parsed[pairId] = {
      attempts: updatedPairAttempts,
    };

    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(parsed));
  } catch (e) {
    console.log('Failed to save attempt', e);
  }
};

export const getProgress = async (): Promise<Record<string, PairStats>> => {
  try {
    const savedProgress = await AsyncStorage.getItem(PROGRESS_KEY);
    return savedProgress != null ? JSON.parse(savedProgress) : {};
  } catch (e) {
    console.log('Failed to fetch progress', e);
    return {};
  }
};

export const getWeightedAccuracy = (
  attempts: PairAttempt[],
  halfLifeMinutes: number = 60
): number => {
  const now = Date.now();
  const decayRate = Math.log(2) / (halfLifeMinutes * 60 * 1000);

  let weightedCorrect = 0;
  let totalWeight = 0;

  attempts.forEach(({ timestamp, isCorrect }: PairAttempt) => {
    const age = now - timestamp;
    const weight = Math.exp(-decayRate * age);
    totalWeight += weight;
    if (isCorrect) weightedCorrect += weight;
  });

  return totalWeight ? weightedCorrect / totalWeight : 0;
};

export const estimateActivePracticeTime = (
  attempts: PairAttempt[],
  maxGapMs: number = 2 * 60 * 1000
): number => {
  if (attempts.length < 2) return 0;

  const sorted = [...attempts].sort((a, b) => a.timestamp - b.timestamp);
  let total = 0;
  let sessionStart = sorted[0].timestamp;

  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i].timestamp - sorted[i - 1].timestamp;
    if (gap > maxGapMs) {
      total += sorted[i - 1].timestamp - sessionStart;
      sessionStart = sorted[i].timestamp;
    }
  }

  total += sorted[sorted.length - 1].timestamp - sessionStart;
  return total;
};

export const getAccuracyAndTimeOverTime = (
  attempts: PairAttempt[],
  sessionGapMs: number = 2 * 60 * 1000
): { timeLabel: string; accuracy: number; cumulativeTimeMin: number }[] => {
  if (attempts.length === 0) return [];

  const sorted = [...attempts].sort((a, b) => a.timestamp - b.timestamp);
  let sessionStart = sorted[0].timestamp;
  let cumulativeTime = 0;
  let sessionAttempts: PairAttempt[] = [];
  const output = [];

  for (let i = 0; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = sorted[i - 1];
    const isNewSession =
      i > 0 && current.timestamp - prev.timestamp > sessionGapMs;

    if (isNewSession) {
      const sessionEnd = prev.timestamp;
      const sessionDuration = sessionEnd - sessionStart;
      cumulativeTime += sessionDuration;

      const correct = sessionAttempts.filter((a) => a.isCorrect).length;
      const accuracy = sessionAttempts.length
        ? correct / sessionAttempts.length
        : 0;
      const timeLabel = new Date(sessionEnd).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      output.push({
        timeLabel,
        accuracy,
        cumulativeTimeMin: cumulativeTime / 60000,
      });

      sessionStart = current.timestamp;
      sessionAttempts = [];
    }

    sessionAttempts.push(current);
  }

  // Add the final session
  const last = sorted[sorted.length - 1].timestamp;
  const lastSessionDuration = last - sessionStart;
  cumulativeTime += lastSessionDuration;
  const correct = sessionAttempts.filter((a) => a.isCorrect).length;
  const accuracy = sessionAttempts.length
    ? correct / sessionAttempts.length
    : 0;
  const timeLabel = new Date(last).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

  output.push({
    timeLabel,
    accuracy,
    cumulativeTimeMin: cumulativeTime / 60000,
  });

  return output;
};

export const resetProgress = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PROGRESS_KEY);
  } catch (e) {
    console.log('Failed to reset progress', e);
  }
};
