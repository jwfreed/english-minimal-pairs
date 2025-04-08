// components/AccuracyTimeChart.tsx

import React from 'react';
import { View, Text } from 'react-native';
import { LineChart, XAxis, Grid } from 'react-native-svg-charts';
import * as shape from 'd3-shape';

interface ChartEntry {
  timeLabel: string;
  accuracy: number;
  cumulativeTimeMin: number;
}

interface Props {
  data: ChartEntry[];
}

export default function AccuracyTimeChart({ data }: Props) {
  if (!data || data.length === 0) return <Text>No data available.</Text>;

  const accuracyData = data.map((d) => d.accuracy * 100); // percent
  const labels = data.map((d) => d.timeLabel);

  const contentInset = { top: 20, bottom: 20 };

  return (
    <View style={{ height: 220, width: '100%', paddingHorizontal: 10 }}>
      <Text style={{ marginBottom: 10, fontWeight: 'bold' }}>
        Accuracy Trend
      </Text>
      <LineChart
        style={{ height: 160, width: '100%' }}
        data={accuracyData}
        svg={{ stroke: 'green', strokeWidth: 2 }}
        contentInset={contentInset}
        curve={shape.curveMonotoneX}
      >
        <Grid />
      </LineChart>
      <XAxis
        style={{ marginTop: 10 }}
        data={accuracyData}
        formatLabel={(_value: number, index: number) => labels[index]}
        contentInset={{ left: 20, right: 20 }}
        svg={{ fontSize: 10, fill: 'black' }}
      />
    </View>
  );
}
