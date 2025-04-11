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

  it('saveAttempt stores correct structure', async () => {
    const pairId = 'pair1';
    const isCorrect = true;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null);

    await saveAttempt(pairId, isCorrect);

    const storedValue = (AsyncStorage.setItem as jest.Mock).mock.calls[0][1];
    const parsed = JSON.parse(storedValue);

    expect(parsed[pairId].attempts).toHaveLength(1);
    expect(typeof parsed[pairId].attempts[0].timestamp).toBe('number');
    expect(parsed[pairId].attempts[0].isCorrect).toBe(true);
  });

  it('getProgress returns correct structure', async () => {
    const data = {
      pair1: {
        attempts: [
          { timestamp: 123, isCorrect: true },
          { timestamp: 456, isCorrect: false },
        ],
      },
    };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(data)
    );
    const progress = await getProgress();

    expect(progress.pair1.attempts).toHaveLength(2);
    expect(progress.pair1.attempts[0].isCorrect).toBe(true);
    expect(progress.pair1.attempts[1].isCorrect).toBe(false);
  });

  it('resetProgress calls AsyncStorage.removeItem', async () => {
    await resetProgress();
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });

  it('handles AsyncStorage errors gracefully in saveAttempt', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    await saveAttempt('pair1', true);
    expect(console.log).toHaveBeenCalledWith(
      'Failed to save attempt',
      expect.any(Error)
    );
  });

  it('handles AsyncStorage errors gracefully in getProgress', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    const result = await getProgress();
    expect(console.log).toHaveBeenCalledWith(
      'Failed to fetch progress',
      expect.any(Error)
    );
    expect(result).toEqual({});
  });

  it('handles AsyncStorage errors gracefully in resetProgress', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    (AsyncStorage.removeItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    await resetProgress();
    expect(console.log).toHaveBeenCalledWith(
      'Failed to reset progress',
      expect.any(Error)
    );
  });
});
