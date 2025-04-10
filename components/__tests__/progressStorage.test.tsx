// Tests for TimePracticedBar and progressStorage advanced logic
import React from 'react';
import { render } from '@testing-library/react-native';
import TimePracticedBar from '../../components/TimePracticedBar';
import {
  getWeightedAccuracy,
  estimateActivePracticeTime,
  getAccuracyAndTimeOverTime,
} from '../../src/storage/progressStorage';

jest.mock('@/hooks/useLanguageScheme', () => ({
  useLanguageScheme: () => ({
    t: (key: string) => {
      if (key === 'timePracticed') return 'Time Practiced';
      if (key === 'min') return 'min';
      return key;
    },
  }),
}));

describe('TimePracticedBar', () => {
  const getWidthStyle = (barFill: any) => {
    return Array.isArray(barFill.props.style)
      ? barFill.props.style.find((s: any) => s?.width)
      : barFill.props.style;
  };

  it('renders with default goal and expected text', () => {
    const { getByText } = render(<TimePracticedBar minutes={15} />);
    expect(getByText('Time Practiced: 15 / 60 min')).toBeTruthy();
  });

  it('renders correct bar width for full progress', () => {
    const { getByTestId } = render(<TimePracticedBar minutes={60} goal={60} />);
    const barFill = getByTestId('progress-bar-fill');
    const style = getWidthStyle(barFill);
    expect(style?.width).toBe('100%');
  });

  it('caps progress at 100%', () => {
    const { getByTestId } = render(
      <TimePracticedBar minutes={120} goal={60} />
    );
    const barFill = getByTestId('progress-bar-fill');
    const style = getWidthStyle(barFill);
    expect(style?.width).toBe('100%');
  });

  it('renders correctly with 0 minutes', () => {
    const { getByText, getByTestId } = render(
      <TimePracticedBar minutes={0} goal={60} />
    );
    expect(getByText('Time Practiced: 0 / 60 min')).toBeTruthy();
    const barFill = getByTestId('progress-bar-fill');
    const style = getWidthStyle(barFill);
    expect(style?.width).toBe('0%');
  });
});

describe('progressStorage advanced logic', () => {
  const now = Date.now();
  const mockAttempts = [
    { timestamp: now - 10 * 60 * 1000, isCorrect: true },
    { timestamp: now - 5 * 60 * 1000, isCorrect: false },
    { timestamp: now, isCorrect: true },
  ];

  it('getWeightedAccuracy returns 0 for empty array', () => {
    expect(getWeightedAccuracy([])).toBe(0);
  });

  it('getWeightedAccuracy calculates with decay', () => {
    const result = getWeightedAccuracy(mockAttempts, 60);
    expect(result).toBeGreaterThan(0);
    expect(result).toBeLessThan(1);
  });

  it('estimateActivePracticeTime returns 0 for < 2 attempts', () => {
    expect(
      estimateActivePracticeTime([{ timestamp: now, isCorrect: true }])
    ).toBe(0);
  });

  it('estimateActivePracticeTime calculates session time correctly', () => {
    const attempts = [
      { timestamp: now - 4 * 60 * 1000, isCorrect: true },
      { timestamp: now - 2 * 60 * 1000, isCorrect: true },
      { timestamp: now, isCorrect: true },
    ];
    const totalMs = estimateActivePracticeTime(attempts);
    expect(totalMs).toBeGreaterThan(0);
  });

  it('getAccuracyAndTimeOverTime returns sessions with accuracy', () => {
    const sessions = getAccuracyAndTimeOverTime(mockAttempts, 2 * 60 * 1000);
    expect(Array.isArray(sessions)).toBe(true);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toHaveProperty('timeLabel');
    expect(sessions[0]).toHaveProperty('accuracy');
    expect(sessions[0]).toHaveProperty('cumulativeTimeMin');
  });
});
