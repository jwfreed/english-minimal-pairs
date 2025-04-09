import {
  saveAttempt,
  getProgress,
  resetProgress,
  getWeightedAccuracy,
  estimateActivePracticeTime,
  getAccuracyAndTimeOverTime,
} from '../../src/storage/progressStorage';

import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

describe('progressStorage.ts functionality', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('saves a new attempt and retrieves it', async () => {
    const now = Date.now();
    jest.spyOn(Date, 'now').mockReturnValueOnce(now);

    await saveAttempt('sheep-ship-(Vowels)', true);
    const result = await getProgress();

    expect(result['sheep-ship-(Vowels)'].attempts[0]).toEqual({
      timestamp: now,
      isCorrect: true,
    });
  });

  it('handles error during saveAttempt gracefully', async () => {
    jest.spyOn(AsyncStorage, 'setItem').mockImplementationOnce(() => {
      throw new Error('fail');
    });
    await expect(saveAttempt('key', true)).resolves.toBeUndefined();
  });

  it('returns empty object if getProgress fails', async () => {
    jest.spyOn(AsyncStorage, 'getItem').mockImplementationOnce(() => {
      throw new Error('fail');
    });
    const result = await getProgress();
    expect(result).toEqual({});
  });

  it('resets progress', async () => {
    await resetProgress();
    const result = await getProgress();
    expect(result).toEqual({});
  });

  it('handles resetProgress error gracefully', async () => {
    jest.spyOn(AsyncStorage, 'removeItem').mockImplementationOnce(() => {
      throw new Error('fail');
    });
    await expect(resetProgress()).resolves.toBeUndefined();
  });

  it('calculates weighted accuracy correctly', () => {
    const now = Date.now();
    const attempts = [
      { isCorrect: true, timestamp: now - 1000 },
      { isCorrect: false, timestamp: now - 3000 },
      { isCorrect: true, timestamp: now - 5000 },
    ];
    const result = getWeightedAccuracy(attempts);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThanOrEqual(1);
  });

  it('returns 0 weighted accuracy for empty attempts', () => {
    expect(getWeightedAccuracy([])).toBe(0);
  });

  it('returns 0 active practice time for <2 attempts', () => {
    const result = estimateActivePracticeTime([
      { isCorrect: true, timestamp: Date.now() },
    ]);
    expect(result).toBe(0);
  });

  it('calculates active practice time across multiple sessions', () => {
    const now = Date.now();
    const attempts = [
      { isCorrect: true, timestamp: now },
      { isCorrect: false, timestamp: now + 5000 },
      { isCorrect: true, timestamp: now + 200000 },
      { isCorrect: true, timestamp: now + 205000 },
    ];
    const result = estimateActivePracticeTime(attempts);
    expect(result).toBeGreaterThan(0);
  });

  it('returns empty trend for no attempts', () => {
    expect(getAccuracyAndTimeOverTime([])).toEqual([]);
  });

  it('generates trend data from attempts', () => {
    const now = Date.now();
    const attempts = [
      { isCorrect: true, timestamp: now },
      { isCorrect: false, timestamp: now + 5000 },
      { isCorrect: true, timestamp: now + 200000 },
      { isCorrect: false, timestamp: now + 205000 },
    ];
    const trend = getAccuracyAndTimeOverTime(attempts);
    expect(trend.length).toBeGreaterThan(0);
    expect(trend[0]).toHaveProperty('timeLabel');
    expect(trend[0]).toHaveProperty('accuracy');
    expect(trend[0]).toHaveProperty('cumulativeTimeMin');
  });
});
