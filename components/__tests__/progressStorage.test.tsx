import {
  getWeightedAccuracy,
  estimateActivePracticeTime,
  getAccuracyAndTimeOverTime,
  saveAttempt,
  getProgress,
  resetProgress,
} from '../../src/storage/progressStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('progressStorage advanced logic', () => {
  it('getWeightedAccuracy returns 1 for all correct', () => {
    const now = Date.now();
    const attempts = [
      { timestamp: now - 1000, isCorrect: true },
      { timestamp: now - 2000, isCorrect: true },
    ];
    const accuracy = getWeightedAccuracy(attempts);
    expect(accuracy).toBeCloseTo(1);
  });

  it('getWeightedAccuracy returns 0.5 for half correct', () => {
    const now = Date.now();
    const attempts = [
      { timestamp: now - 1000, isCorrect: true },
      { timestamp: now - 2000, isCorrect: false },
    ];
    const accuracy = getWeightedAccuracy(attempts);
    expect(accuracy).toBeGreaterThan(0);
    expect(accuracy).toBeLessThan(1);
  });

  it('estimateActivePracticeTime includes session breaks correctly', () => {
    const now = Date.now();
    const attempts = [
      { timestamp: now - 10 * 60000, isCorrect: true },
      { timestamp: now - 9 * 60000, isCorrect: true },
      { timestamp: now, isCorrect: true },
    ];
    const total = estimateActivePracticeTime(attempts);
    expect(total).toBeGreaterThan(0);
  });

  it('estimateActivePracticeTime returns 0 for fewer than 2 attempts', () => {
    const attempts = [{ timestamp: Date.now(), isCorrect: true }];
    const total = estimateActivePracticeTime(attempts);
    expect(total).toBe(0);
  });

  it('getAccuracyAndTimeOverTime returns sessions with accuracy', () => {
    const now = Date.now();
    const attempts = [
      { timestamp: now - 5000, isCorrect: true },
      { timestamp: now - 3000, isCorrect: false },
      { timestamp: now - 1000, isCorrect: true },
    ];
    const sessions = getAccuracyAndTimeOverTime(attempts);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toHaveProperty('accuracy');
    expect(sessions[0]).toHaveProperty('cumulativeTimeMin');
  });
});

describe('progressStorage persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('saveAttempt calls AsyncStorage.setItem', async () => {
    await saveAttempt('pair1', true);
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  it('getProgress calls AsyncStorage.getItem', async () => {
    await getProgress();
    expect(AsyncStorage.getItem).toHaveBeenCalled();
  });

  it('resetProgress calls AsyncStorage.removeItem', async () => {
    await resetProgress();
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });

  it('handles AsyncStorage errors gracefully in saveAttempt', async () => {
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    await saveAttempt('pair1', true); // Should not throw
  });

  it('handles AsyncStorage errors gracefully in getProgress', async () => {
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    await getProgress(); // Should not throw
  });

  it('handles AsyncStorage errors gracefully in resetProgress', async () => {
    (AsyncStorage.removeItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    await resetProgress(); // Should not throw
  });
});
