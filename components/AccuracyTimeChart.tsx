// components/AccuracyTimeChart.tsx

import React from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useLanguageScheme } from '@/hooks/useLanguageScheme';

interface ChartEntry {
  timeLabel: string;
  accuracy: number;
  cumulativeTimeMin: number;
}

interface Props {
  data: ChartEntry[];
}

export default function AccuracyTimeChart({ data }: Props) {
  const { t } = useLanguageScheme();
  if (!data || data.length === 0) return <Text>No data available.</Text>;

  const accuracyData = data.map((d) => d.accuracy * 100); // percent
  const labels = data.map((d) => d.timeLabel);

  return (
    <View style={{ paddingHorizontal: 10 }}>
      <Text style={{ marginBottom: 10, fontWeight: 'bold' }}>
        {t('accuracyTrend')}
      </Text>
      <LineChart
        data={{
          labels,
          datasets: [{ data: accuracyData }],
        }}
        width={Dimensions.get('window').width - 20}
        height={220}
        yAxisSuffix="%"
        chartConfig={{
          backgroundColor: '#ffffff',
          backgroundGradientFrom: '#ffffff',
          backgroundGradientTo: '#ffffff',
          decimalPlaces: 0,
          color: (opacity = 1) => `rgba(0, 128, 0, ${opacity})`,
          labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
          propsForDots: {
            r: '4',
            strokeWidth: '2',
            stroke: '#388e3c',
          },
        }}
        bezier
        style={{ borderRadius: 8 }}
      />
    </View>
  );
}
