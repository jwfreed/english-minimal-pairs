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

export const resetProgress = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(PROGRESS_KEY);
  } catch (e) {
    console.log('Failed to reset progress', e);
  }
};
