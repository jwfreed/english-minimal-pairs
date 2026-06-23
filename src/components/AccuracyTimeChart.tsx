import React, { useMemo, useState } from 'react';
import { View, Text, LayoutChangeEvent } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useThemeColor } from '@/src/hooks/useThemeColor';
import { useLanguage } from '@/src/context/LanguageContext';
import { tKeys } from '@/src/constants/translationKeys';

interface PracticeData {
  accuracy: number;
  timestamp: number;
}

interface Props {
  practiceData: PracticeData[];
}

export default function AccuracyTimeChart({ practiceData }: Props) {
  const { translate } = useLanguage();
  const [chartWidth, setChartWidth] = useState(0);

  const themeColors = {
    background: useThemeColor({}, 'background'),
    text: useThemeColor({}, 'text'),
    success: useThemeColor({}, 'success'),
    error: useThemeColor({}, 'error'),
    primary: useThemeColor({}, 'primary'),
    buttonText: useThemeColor({}, 'buttonText'),
    cardBackground: useThemeColor({}, 'cardBackground'),
    shadow: useThemeColor({}, 'shadow'),
    icon: useThemeColor({}, 'icon'),
  };

  const smoothedData = useMemo(() => {
    return practiceData.map((point, i, arr) => {
      const window = arr.slice(Math.max(0, i - 2), i + 1);
      const avg =
        window.reduce((sum, p) => sum + p.accuracy, 0) / window.length;
      return avg;
    });
  }, [practiceData]);

  const chartData = useMemo(
    () => ({
      labels: practiceData.map((_, i) => (i % 5 === 0 ? String(i + 1) : '')),
      datasets: [
        {
          data: smoothedData.map((v) => v * 100),
          strokeWidth: 2,
          color: () => themeColors.primary,
        },
      ],
    }),
    [practiceData, smoothedData, themeColors.primary]
  );

  return (
    <View onLayout={(event: LayoutChangeEvent) => setChartWidth(event.nativeEvent.layout.width)}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 4,
          color: themeColors.text,
        }}
      >
        {translate(tKeys.accuracyTrend)}
      </Text>
      {chartWidth > 0 && (
        <LineChart
          data={chartData}
          width={chartWidth}
          height={160}
          chartConfig={{
            backgroundGradientFrom: themeColors.background,
            backgroundGradientTo: themeColors.background,
            color: () => themeColors.primary,
            labelColor: () => themeColors.text,
            propsForDots: {
              r: '1',
              strokeWidth: '1',
              stroke: themeColors.primary,
            },
            propsForBackgroundLines: { stroke: '#ddd' },
            decimalPlaces: 0,
          }}
          yAxisSuffix=""
          withDots={true}
          withShadow={true}
          withInnerLines={true}
          withOuterLines={false}
          bezier
          fromZero
          yLabelsOffset={10}
          yAxisInterval={0.1}
          segments={5}
          style={{ marginVertical: 8, borderRadius: 8 }}
        />
      )}
    </View>
  );
}
