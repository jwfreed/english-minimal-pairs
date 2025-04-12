import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ResultsScreen from '../../app/(tabs)/results';
import { LanguageSchemeProvider } from '../../hooks/useLanguageScheme';
import { PairProgressProvider } from '../../src/context/PairProgressContext';

jest.mock('../../components/AccuracyTimeChart', () => 'MockedChart');

describe('ResultsScreen', () => {
  it('renders mocked progress stats using exact UI keys', async () => {
    const mockProgress = {
      'road - load': {
        attempts: [
          { isCorrect: true, timestamp: 123 },
          { isCorrect: false, timestamp: 456 },
          { isCorrect: true, timestamp: 789 },
        ],
      },
    };

    const wrapper = (
      <PairProgressProvider>
        <LanguageSchemeProvider>
          <ResultsScreen />
        </LanguageSchemeProvider>
      </PairProgressProvider>
    );

    const { getByText } = render(wrapper);

    await waitFor(() => {
      expect(getByText(/road - load/)).toBeTruthy();
    });
  });
});
