// src/storage/progressStorage.ts

import AsyncStorage from '@react-native-async-storage/async-storage';

const PROGRESS_KEY = '@userProgress';

export type PairAttempt = {
  timestamp: number;
  isCorrect: boolean;
  durationMin?: number;
};

export type PairStats = {
  attempts: PairAttempt[];
  totalPracticeTimeMin?: number;
};

export const saveAttempt = async (
  pairId: string,
  isCorrect: boolean,
  durationMin: number = 0
): Promise<void> => {
  try {
    const currentData = await AsyncStorage.getItem(PROGRESS_KEY);
    const parsed: Record<string, PairStats> = currentData
      ? JSON.parse(currentData)
      : {};

    const newAttempt: PairAttempt = {
      timestamp: Date.now(),
      isCorrect,
      durationMin,
    };

    const updatedPairAttempts = parsed[pairId]?.attempts || [];
    updatedPairAttempts.push(newAttempt);

    const totalPracticeTimeMin = updatedPairAttempts.reduce(
      (acc, attempt) => acc + (attempt.durationMin || 0),
      0
    );

    parsed[pairId] = {
      attempts: updatedPairAttempts,
      totalPracticeTimeMin,
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
  maxGapMs = 2 * 60 * 1000
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
): { accuracy: number; timestamp: number }[] => {
  if (attempts.length === 0) return [];

  const sorted = [...attempts].sort((a, b) => a.timestamp - b.timestamp);
  const result: { accuracy: number; timestamp: number }[] = [];

  let session: PairAttempt[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const prev = sorted[i - 1];
    const gap = current.timestamp - prev.timestamp;

    if (gap <= sessionGapMs) {
      session.push(current);
    } else {
      const accuracy =
        session.filter((a) => a.isCorrect).length / session.length;
      result.push({
        accuracy,
        timestamp: session[session.length - 1].timestamp,
      });
      session = [current];
    }
  }

  if (session.length) {
    const accuracy = session.filter((a) => a.isCorrect).length / session.length;
    result.push({ accuracy, timestamp: session[session.length - 1].timestamp });
  }

  return result;
};
