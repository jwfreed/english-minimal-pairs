import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import AccuracyTimeChart from './AccuracyTimeChart';
import LevelIndicator from './LevelIndicator';
import {
  getWeightedAccuracy,
  getAccuracyAndTimeOverTime,
  estimateActivePracticeTime,
  PairStats,
} from '@/src/storage/progressStorage';
import { tKeys, TranslationKey } from '@/src/constants/translationKeys';

// Maximum minutes to display in the progress bar
const MAX_PRACTICE_MIN = 60;

interface FlattenedPair {
  id: string;
  word1: string;
  word2: string;
  category: string;
  group?: string;
}

interface Props {
  item: FlattenedPair;
  stats: PairStats;
  /** Mastery tier (1–6) for this contrast group */
  tier?: number;
  translate: (key: TranslationKey) => string;
  themeColors: Record<string, string>;
  styles: any;
}

const PairItem: React.FC<Props> = React.memo(
  ({ item, stats, tier, translate, themeColors, styles }) => {
    const attempts = useMemo(() => stats.attempts ?? [], [stats.attempts]);

    // Compute averages and trend data
    const {
      rawAvg,
      weightedAvg,
      trendData,
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
            {tier != null && attempts.length > 0 && (
              <View style={styles.masteryBadge}>
                <LevelIndicator currentTier={tier} compact />
              </View>
            )}
            <Text style={styles.pairItemStatsText}>
              {`${translate(tKeys.total)}: ${
                attempts.filter((a) => a.isCorrect).length
              }/${attempts.length} (${rawAvg.toFixed(1)}%) — ${translate(
                tKeys.weightedAverage
              )}: ${weightedAvg.toFixed(1)}%`}
            </Text>
          </View>

          {trendData.length > 0 && (
            <View style={styles.pairItemRightColumn}>
              <AccuracyTimeChart practiceData={trendData} />
              <View style={{ marginTop: 10 }}>
                <Text style={styles.timePracticedText}>
                  {`${translate(tKeys.timePracticed)}: ${displayPracticeMin.toFixed(
                    1
                  )} / ${MAX_PRACTICE_MIN} ${translate(tKeys.min)}`}
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

PairItem.displayName = 'PairItem';

export default PairItem;
