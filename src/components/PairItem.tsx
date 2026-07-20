import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import AccuracyTimeChart from './AccuracyTimeChart';
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
  translate: (key: TranslationKey) => string;
  themeColors: Record<string, string>;
  styles: any;
}

const PairItem: React.FC<Props> = React.memo(
  ({ item, stats, translate, themeColors, styles }) => {
    const attempts = useMemo(() => stats.attempts ?? [], [stats.attempts]);

    // Compute averages and trend data
    const {
      rawAvg,
      weightedAvg,
      trendData,
      displayPracticeMin,
      correctCount,
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
        correctCount,
      };
    }, [attempts]);

    const percentFilled = displayPracticeMin / MAX_PRACTICE_MIN;

    return (
      <View style={styles.pairItemContainer}>
        <View style={styles.pairItemHeadingRow}>
          <Text style={styles.pairItemTitle}>{`${item.word1} · ${item.word2}`}</Text>
          {attempts.length > 0 && (
            <Text
              style={[
                styles.pairItemAccuracy,
                { color: rawAvg >= 70 ? themeColors.success : themeColors.primaryText },
              ]}
            >
              {rawAvg.toFixed(1)}%
            </Text>
          )}
        </View>

        {attempts.length === 0 ? (
          <View style={styles.unpracticedRow}>
            <Text style={styles.unpracticedText}>Not practiced yet</Text>
            <Text style={styles.unpracticedText}>—</Text>
          </View>
        ) : (
          <>
            <Text style={styles.pairItemStatsText}>
              {`${correctCount} of ${attempts.length} correct · weighted ${weightedAvg.toFixed(1)}%`}
            </Text>
            {trendData.length > 0 && <AccuracyTimeChart practiceData={trendData} />}
            <View style={styles.pairTimeRow}>
              <View style={styles.progressBarOuter}>
                <View
                  style={[
                    styles.progressBarInner,
                    {
                      width: `${percentFilled * 100}%`,
                      backgroundColor:
                        percentFilled >= 1 ? themeColors.success : themeColors.primaryText,
                    },
                  ]}
                />
              </View>
              <Text style={styles.timePracticedText}>
                {`${displayPracticeMin.toFixed(1)} / ${MAX_PRACTICE_MIN} ${translate(tKeys.min)}`}
              </Text>
            </View>
          </>
        )}
      </View>
    );
  }
);

PairItem.displayName = 'PairItem';

export default PairItem;
