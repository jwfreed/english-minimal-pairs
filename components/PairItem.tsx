// src/components/PairItem.tsx
import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import AccuracyTimeChart from './AccuracyTimeChart';
import {
  getWeightedAccuracy,
  getAccuracyAndTimeOverTime,
  estimateActivePracticeTime,
} from '../src/storage/progressStorage';

interface FlattenedPair {
  id: string;
  word1: string;
  word2: string;
  audio1: string;
  audio2: string;
  category: string;
}

interface PairAttempt {
  isCorrect: boolean;
  timestamp: number;
}

interface PairStats {
  attempts: PairAttempt[];
}

interface ThemeColors {
  background: string;
  text: string;
  success: string;
  error: string;
  primary: string;
  buttonText: string;
  cardBackground: string;
  shadow: string;
  icon: string;
}

interface Styles {
  container: any;
  title: any;
  // extend if needed
}

interface Props {
  item: FlattenedPair;
  stats: PairStats;
  t: (key: string) => string;
  themeColors: ThemeColors;
  styles: Styles;
}

const PairItem: React.FC<Props> = React.memo(
  ({ item, stats, t, themeColors, styles }) => {
    const attempts = stats.attempts || [];
    const total = attempts.length;

    const { rawAvg, weightedAvg, trendData, timePracticed } = useMemo(() => {
      const correct = attempts.filter((a) => a.isCorrect).length;
      const rawAvgValue = total > 0 ? (correct / total) * 100 : 0;
      return {
        rawAvg: rawAvgValue,
        weightedAvg: getWeightedAccuracy(attempts) * 100,
        trendData: getAccuracyAndTimeOverTime(attempts),
        timePracticed:
          total > 0
            ? Math.round(estimateActivePracticeTime(attempts) / 60000)
            : 0,
      };
    }, [attempts, total]);

    return (
      <View style={pairItemStyles.container}>
        <View style={pairItemStyles.row}>
          {/* Left Column */}
          <View style={pairItemStyles.leftColumn}>
            <Text style={[styles.title, { color: themeColors.text }]}>
              {`${item.word1} - ${item.word2}`}
            </Text>
            <Text style={{ color: themeColors.text }}>
              {`${t('total')}: ${
                total -
                (total -
                  (total > 0 ? attempts.filter((a) => a.isCorrect).length : 0))
              }/${total} (${rawAvg.toFixed(1)}%) — ${t(
                'weightedAverage'
              )}: ${weightedAvg.toFixed(1)}%`}
            </Text>
          </View>

          {/* Right Column */}
          {trendData.length > 0 && (
            <View style={pairItemStyles.rightColumn}>
              <AccuracyTimeChart practiceData={trendData} />
              <View style={{ marginTop: 10 }}>
                <Text
                  style={{
                    fontSize: 14,
                    marginBottom: 6,
                    fontWeight: '600',
                    color: themeColors.text,
                  }}
                >
                  {`${t('timePracticed')}: ${timePracticed} / 60 ${t('min')}`}
                </Text>
                <View style={pairItemStyles.progressBarOuter}>
                  <View
                    style={[
                      pairItemStyles.progressBarInner,
                      { width: `${Math.min(timePracticed / 60, 1) * 100}%` },
                    ]}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </View>
    );
  }
);

export default PairItem;

const pairItemStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.125)',
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  leftColumn: {
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 140,
    paddingRight: 8,
  },
  rightColumn: {
    flexGrow: 1,
    minWidth: 180,
    maxWidth: '100%',
  },
  progressBarOuter: {
    height: 12,
    width: '100%',
    backgroundColor: '#e5e7eb',
    borderRadius: 6,
    overflow: 'hidden',
  },
  progressBarInner: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
});
