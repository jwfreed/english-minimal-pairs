import React, { useMemo } from 'react';
import { View, Text, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useLanguageScheme } from '@/hooks/useLanguageScheme';
import createStyles from '@/constants/styles';
import { useThemeColor } from '@/hooks/useThemeColor';

interface PracticeData {
  accuracy: number;
  timestamp: number;
}

interface Props {
  practiceData: PracticeData[];
}

export default function AccuracyTimeChart({ practiceData }: Props) {
  const { translate } = useLanguageScheme();

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

  const styles = createStyles(themeColors);

  // Optional smoothing: moving average over 3 points
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
    <View>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '600',
          marginBottom: 4,
          color: themeColors.text,
        }}
      >
        {translate('accuracyTrend')}
      </Text>
      <LineChart
        data={chartData}
        width={Dimensions.get('window').width - 64}
        height={160}
        chartConfig={{
          backgroundGradientFrom: themeColors.background,
          backgroundGradientTo: themeColors.background,
          color: () => themeColors.primary,
          labelColor: () => themeColors.text,
          propsForDots: {
            r: '2',
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
        // yAxisMin={0}
        // yAxisMax={1}
        style={{ marginVertical: 8, borderRadius: 8 }}
      />
    </View>
  );
}
