import {
  saveAttempt,
  getProgress,
  resetProgress,
  getWeightedAccuracy,
  estimateActivePracticeTime,
  getAccuracyAndTimeOverTime,
} from '../../src/storage/progressStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.mock('@react-native-async-storage/async-storage');

describe('progressStorage basic usage', () => {
  beforeEach(() => {
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.getItem as jest.Mock).mockClear();
    (AsyncStorage.removeItem as jest.Mock).mockClear();
  });

  it('saves and retrieves progress correctly', async () => {
    const pairId = 'pair1';
    const attempt = { timestamp: 123, isCorrect: true };
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(null); // initial empty

    await saveAttempt(pairId, attempt.isCorrect);

    const stored = JSON.parse(
      (AsyncStorage.setItem as jest.Mock).mock.calls[0][1]
    );
    expect(stored[pairId].attempts.length).toBe(1);

    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce(
      JSON.stringify(stored)
    );
    const result = await getProgress();
    expect(result[pairId].attempts[0].isCorrect).toBe(true);
  });

  it('handles failure in saveAttempt gracefully', async () => {
    expect.assertions(1);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(
      new Error('fail')
    );
    await saveAttempt('test', true);
    expect(console.log).toHaveBeenCalledWith(
      'Failed to save attempt',
      expect.any(Error)
    );
  });

  it('handles failure in getProgress gracefully', async () => {
    expect.assertions(2);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    (AsyncStorage.getItem as jest.Mock).mockRejectedValueOnce(
      new Error('fail')
    );
    const progress = await getProgress();
    expect(console.log).toHaveBeenCalledWith(
      'Failed to fetch progress',
      expect.any(Error)
    );
    expect(progress).toEqual({});
  });

  it('handles failure in resetProgress gracefully', async () => {
    expect.assertions(1);
    jest.spyOn(console, 'log').mockImplementation(() => {});
    (AsyncStorage.removeItem as jest.Mock).mockRejectedValueOnce(
      new Error('fail')
    );
    await resetProgress();
    expect(console.log).toHaveBeenCalledWith(
      'Failed to reset progress',
      expect.any(Error)
    );
  });
});

describe('progressStorage advanced logic', () => {
  const now = Date.now();
  const makeAttempt = (minAgo: number, isCorrect: boolean) => ({
    timestamp: now - minAgo * 60000,
    isCorrect,
  });

  it('getWeightedAccuracy favors recent correct answers', () => {
    const attempts = [
      makeAttempt(1, true),
      makeAttempt(10, false),
      makeAttempt(20, true),
    ];
    const accuracy = getWeightedAccuracy(attempts, 30);
    expect(accuracy).toBeGreaterThan(0.5);
  });

  it('estimateActivePracticeTime includes session breaks correctly', () => {
    const attempts = [
      makeAttempt(10, true),
      makeAttempt(8, true),
      makeAttempt(4, false),
      makeAttempt(0, true),
    ];
    const total = estimateActivePracticeTime(attempts);
    expect(total).toBeGreaterThan(0);
  });

  it('getAccuracyAndTimeOverTime returns sessions with accuracy', () => {
    const attempts = [
      makeAttempt(30, true),
      makeAttempt(25, false),
      makeAttempt(5, true),
      makeAttempt(0, true),
    ];
    const sessions = getAccuracyAndTimeOverTime(attempts);
    expect(sessions.length).toBeGreaterThan(0);
    sessions.forEach((session) => {
      expect(typeof session.timeLabel).toBe('string');
      expect(typeof session.accuracy).toBe('number');
      expect(typeof session.cumulativeTimeMin).toBe('number');
    });
  });
});
