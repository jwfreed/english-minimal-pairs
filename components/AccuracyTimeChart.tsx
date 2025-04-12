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

  const chartData = useMemo(() => {
    const limitedData = practiceData.slice(-100);
    return {
      labels: limitedData.map((_, idx) => `${idx + 1}`),
      datasets: [
        {
          // Remove the extra multiplication so that accuracy is already in 0-100 range.
          data: limitedData.map((d) => d.accuracy),
        },
      ],
    };
  }, [practiceData]);

  return (
    <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20 }}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '600',
          marginBottom: 10,
          color: themeColors.text,
        }}
      >
        {translate('accuracyTrend')}
      </Text>
      <LineChart
        data={chartData}
        width={Dimensions.get('window').width - 40}
        height={220}
        yAxisLabel=""
        yAxisSuffix="%"
        yAxisInterval={1}
        chartConfig={{
          backgroundGradientFrom: themeColors.background,
          backgroundGradientTo: themeColors.background,
          decimalPlaces: 1,
          color: () => themeColors.primary,
          labelColor: () => themeColors.text,
          propsForDots: {
            r: '3',
            strokeWidth: '1',
            stroke: themeColors.primary,
          },
        }}
        bezier
        style={{
          marginVertical: 8,
          borderRadius: 16,
        }}
      />
    </View>
  );
}
