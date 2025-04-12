import React from 'react';
import { Text } from 'react-native'; // ✅ Needed for <Text>
import { render } from '@testing-library/react-native';
import AccuracyTimeChart from '../../components/AccuracyTimeChart';

// ✅ Mock react-native-chart-kit and output chart data as JSON inside <Text>
jest.mock('react-native-chart-kit', () => ({
  LineChart: ({ data }: { data: any }) => (
    <Text testID="chart">{JSON.stringify(data)}</Text>
  ),
}));

// ✅ Mock useThemeColor
jest.mock('@/hooks/useThemeColor', () => ({
  useThemeColor: (_props: any, key: string) => {
    const mockColors: Record<string, string> = {
      background: '#fff',
      text: '#000',
      success: '#0f0',
      error: '#f00',
      primary: '#00f',
      buttonText: '#111',
      cardBackground: '#eee',
      shadow: '#ccc',
      icon: '#888',
    };
    return mockColors[key] || '#000';
  },
}));

// ✅ Mock useLanguageScheme
jest.mock('@/hooks/useLanguageScheme', () => ({
  useLanguageScheme: () => ({
    translate: (key: string) => {
      const dictionary: Record<string, string> = {
        accuracyTrend: 'Accuracy Over Time',
      };
      return dictionary[key] || key;
    },
  }),
}));

describe('AccuracyTimeChart', () => {
  const mockData = [
    { accuracy: 0.75, timestamp: 1000 },
    { accuracy: 0.8, timestamp: 2000 },
    { accuracy: 0.9, timestamp: 3000 },
  ];

  it('renders without crashing and maps data correctly', () => {
    const { getByText } = render(<AccuracyTimeChart practiceData={mockData} />);
    expect(getByText('Accuracy Over Time')).toBeTruthy();
  });

  it('limits to 100 data points', () => {
    const longData = Array.from({ length: 200 }, (_, i) => ({
      accuracy: 0.8,
      timestamp: i * 1000,
    }));

    const { getByTestId } = render(
      <AccuracyTimeChart practiceData={longData} />
    );
    const chartJSON = getByTestId('chart').props.children;
    const parsed = JSON.parse(chartJSON);
    expect(parsed.datasets[0].data).toHaveLength(100);
  });
});
