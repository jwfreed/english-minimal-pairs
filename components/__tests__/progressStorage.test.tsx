import {
  getWeightedAccuracy,
  estimateActivePracticeTime,
  getAccuracyAndTimeOverTime,
  saveAttempt,
  getProgress,
} from '../../src/storage/progressStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('progressStorage advanced logic', () => {
  it('getWeightedAccuracy returns ~1 for all correct', () => {
    const now = Date.now();
    const attempts = [
      { timestamp: now - 1000, isCorrect: true },
      { timestamp: now - 2000, isCorrect: true },
    ];
    const accuracy = getWeightedAccuracy(attempts);
    expect(accuracy).toBeCloseTo(1, 2);
  });

  it('getWeightedAccuracy returns ~0.5 for half correct', () => {
    const now = Date.now();
    const attempts = [
      { timestamp: now - 1000, isCorrect: true },
      { timestamp: now - 2000, isCorrect: false },
    ];
    const accuracy = getWeightedAccuracy(attempts);
    expect(accuracy).toBeCloseTo(0.333, 2);
  });

  it('getAccuracyAndTimeOverTime returns an accuracy fraction (0–1) for each attempt', () => {
    const now = Date.now();
    const attempts = [
      { timestamp: now - 60000, isCorrect: true }, // 1 minute ago
      { timestamp: now - 30000, isCorrect: false }, // 30 seconds ago
      { timestamp: now, isCorrect: true }, // now
    ];

    const sessions = getAccuracyAndTimeOverTime(attempts);

    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions).toHaveLength(attempts.length);

    sessions.forEach((session, index) => {
      const expectedAccuracy = getWeightedAccuracy(
        attempts.slice(0, index + 1)
      );
      expect(session).toHaveProperty('timestamp');
      expect(session).toHaveProperty('accuracy');
      expect(typeof session.timestamp).toBe('number');
      expect(typeof session.accuracy).toBe('number');
      expect(session.accuracy).toBeCloseTo(expectedAccuracy * 100, 2);
    });
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

  it('handles AsyncStorage errors gracefully in saveAttempt', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (AsyncStorage.setItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    await saveAttempt('pair1', true);
    expect(console.error).toHaveBeenCalledWith(
      'Error saving attempt:',
      expect.any(Error)
    );
  });

  it('handles AsyncStorage errors gracefully in getProgress', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockImplementationOnce(() => {
      throw new Error('fail');
    });
    const progress = await getProgress();
    expect(console.error).toHaveBeenCalledWith(
      'Error reading progress:',
      expect.any(Error)
    );
    expect(progress).toEqual({});
  });
});
