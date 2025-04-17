import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import AccuracyTimeChart from './AccuracyTimeChart';
import {
  getWeightedAccuracy,
  getAccuracyAndTimeOverTime,
  estimateActivePracticeTime,
} from '../src/storage/progressStorage';

// Maximum minutes to display in the progress bar
const MAX_PRACTICE_MIN = 60;

interface PairAttempt {
  isCorrect: boolean;
  timestamp: number;
  durationMin?: number;
}

interface PairStats {
  attempts: PairAttempt[];
}

interface FlattenedPair {
  id: string;
  word1: string;
  word2: string;
  audio1: string;
  audio2: string;
  category: string;
}

interface Props {
  item: FlattenedPair;
  stats: PairStats;
  translate: (key: string) => string;
  themeColors: Record<string, string>;
  styles: any;
}

const PairItem: React.FC<Props> = React.memo(
  ({ item, stats, translate, themeColors, styles }) => {
    const attempts = stats.attempts || [];

    // Compute averages and trend data
    const {
      rawAvg,
      weightedAvg,
      trendData,
      rawPracticeMin,
      displayPracticeMin,
    } = useMemo(() => {
      const total = attempts.length;
      const correctCount = attempts.filter((a) => a.isCorrect).length;
      const rawAvgValue = total > 0 ? (correctCount / total) * 100 : 0;

      const weightedAvgValue = getWeightedAccuracy(attempts) * 100;
      const trend = getAccuracyAndTimeOverTime(attempts);

      const totalMs = estimateActivePracticeTime(attempts);
      const rawMin = totalMs / 60000;
      const cappedMin = Math.min(rawMin, MAX_PRACTICE_MIN);

      return {
        rawAvg: rawAvgValue,
        weightedAvg: weightedAvgValue,
        trendData: trend,
        rawPracticeMin: rawMin,
        displayPracticeMin: cappedMin,
      };
    }, [attempts]);

    const percentFilled = displayPracticeMin / MAX_PRACTICE_MIN;

    return (
      <View style={styles.pairItemContainer}>
        <View style={styles.pairItemRow}>
          <View style={styles.pairItemLeftColumn}>
            <Text style={[styles.title, { color: themeColors.text }]}>
              {`${item.word1} - ${item.word2}`}
            </Text>
            <Text style={{ color: themeColors.text }}>
              {`${translate('total')}: ${
                attempts.filter((a) => a.isCorrect).length
              }/${attempts.length} (${rawAvg.toFixed(1)}%) — ${translate(
                'weightedAverage'
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
                  {`${translate('timePracticed')}: ${displayPracticeMin.toFixed(
                    1
                  )} / ${MAX_PRACTICE_MIN} ${translate('min')}`}
                </Text>
                <View style={styles.progressBarOuter}>
                  <View
                    style={[
                      styles.progressBarInner,
                      {
                        width: `${percentFilled * 100}%`, // smooth fractional width
                        backgroundColor:
                          percentFilled >= 1
                            ? themeColors.success
                            : themeColors.primary,
                      },
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
