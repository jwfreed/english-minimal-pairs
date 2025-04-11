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
  const { t } = useLanguageScheme();

  const themeColors = {
    background: useThemeColor({}, 'background'),
    text: useThemeColor({}, 'text'),
    success: useThemeColor({}, 'success'),
    error: useThemeColor({}, 'error'),
    primary: useThemeColor({}, 'primary'),
    buttonText: useThemeColor({}, 'buttonText'),
  };

  const styles = createStyles(themeColors);

  const chartData = useMemo(() => {
    const limitedData = practiceData.slice(-100);

    return {
      labels: limitedData.map((_, idx) => `${idx + 1}`),
      datasets: [
        {
          data: limitedData.map((d) => d.accuracy * 100),
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
        {t('accuracyTrend')}
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
