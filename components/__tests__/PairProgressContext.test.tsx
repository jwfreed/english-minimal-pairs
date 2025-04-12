import React from 'react';
import { render, waitFor, act } from '@testing-library/react-native';
import { Text } from 'react-native'; // 👈 This fixes the JSX props error

import {
  PairProgressProvider,
  useProgress,
  useRecordAttempt,
} from '../../src/context/PairProgressContext';

import * as storage from '../../src/storage/progressStorage';

jest.mock('../../src/storage/progressStorage', () => ({
  getProgress: jest.fn(),
  saveAttempt: jest.fn(),
}));

describe('PairProgressContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('loads initial progress from storage', async () => {
    const mockProgress = {
      'cat-dog-(Animals)': {
        attempts: [{ timestamp: Date.now(), isCorrect: true }],
      },
    };
    (storage.getProgress as jest.Mock).mockResolvedValueOnce(mockProgress);

    const TestComponent = () => {
      const progress = useProgress();
      return (
        <>
          {Object.keys(progress).map((k) => (
            <Text key={k}>{k}</Text>
          ))}
        </>
      );
    };

    const { getByText } = render(
      <PairProgressProvider>
        <TestComponent />
      </PairProgressProvider>
    );

    await waitFor(() => getByText('cat-dog-(Animals)'));
  });

  it('updates progress after recordAttempt', async () => {
    const mockInitial = {};
    const mockUpdated = {
      'fish-dish-(Food)': {
        attempts: [{ timestamp: Date.now(), isCorrect: false }],
      },
    };

    (storage.getProgress as jest.Mock)
      .mockResolvedValueOnce(mockInitial) // initial load
      .mockResolvedValueOnce(mockUpdated); // after attempt

    const TestComponent = () => {
      const progress = useProgress();
      const recordAttempt = useRecordAttempt();

      return (
        <>
          <Text testID="count">{Object.keys(progress).length}</Text>
          <Text
            testID="trigger"
            onPress={() => {
              recordAttempt('fish-dish-(Food)', false, 0.01);
            }}
          >
            Fire
          </Text>
        </>
      );
    };

    const { getByTestId } = render(
      <PairProgressProvider>
        <TestComponent />
      </PairProgressProvider>
    );

    // Initial: no keys
    await waitFor(() => {
      expect(getByTestId('count').props.children).toBe(0);
    });

    // Trigger recordAttempt
    await act(async () => {
      getByTestId('trigger').props.onPress();
    });

    // Now progress has one key
    await waitFor(() => {
      expect(getByTestId('count').props.children).toBe(1);
    });

    expect(storage.saveAttempt).toHaveBeenCalledWith(
      'fish-dish-(Food)',
      false,
      0.01
    );
  });
});
