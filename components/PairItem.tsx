import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import AccuracyTimeChart from './AccuracyTimeChart';
import {
  getWeightedAccuracy,
  getAccuracyAndTimeOverTime,
  estimateActivePracticeTime,
} from '../src/storage/progressStorage';
import { tKeys } from '../constants/translationKeys';

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
  durationMin?: number;
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
  pairItemContainer: any;
  pairItemRow: any;
  pairItemLeftColumn: any;
  pairItemRightColumn: any;
  progressBarOuter: any;
  progressBarInner: any;
}

interface Props {
  item: FlattenedPair;
  stats: PairStats;
  translate: (key: string) => string;
  themeColors: ThemeColors;
  styles: Styles;
}

const PairItem: React.FC<Props> = React.memo(
  ({ item, stats, translate, themeColors, styles }) => {
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
      <View style={styles.pairItemContainer}>
        <View style={styles.pairItemRow}>
          <View style={styles.pairItemLeftColumn}>
            <Text style={[styles.title, { color: themeColors.text }]}>
              {`${item.word1} - ${item.word2}`}
            </Text>
            <Text style={{ color: themeColors.text }}>
              {`${translate(tKeys.total)}: ${
                total -
                (total -
                  (total > 0 ? attempts.filter((a) => a.isCorrect).length : 0))
              }/${total} (${rawAvg.toFixed(1)}%) — ${translate(
                tKeys.weightedAverage
              )}: ${weightedAvg.toFixed(1)}%`}
            </Text>
          </View>

          {trendData.length > 0 && (
            <View style={styles.pairItemRightColumn}>
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
                  {`${translate(
                    tKeys.timePracticed
                  )}: ${timePracticed} / 60 ${translate(tKeys.min)}`}
                </Text>
                <View style={styles.progressBarOuter}>
                  <View
                    style={[
                      styles.progressBarInner,
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
