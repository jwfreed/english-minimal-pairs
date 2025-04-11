import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { minimalPairs } from '../../constants/minimalPairs';
import {
  useProgress,
  useRecordAttempt,
} from '../../src/context/PairProgressContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import createStyles from '../../constants/styles';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
import {
  getWeightedAccuracy,
  getAccuracyAndTimeOverTime,
  estimateActivePracticeTime,
} from '../../src/storage/progressStorage';
import AccuracyTimeChart from '../../components/AccuracyTimeChart';

/* -- Data Interfaces -- */
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

/* -- Theme and Styles Interfaces -- */
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
  // add additional style properties if needed
}

/* -- Consolidated Theme Hook -- */
const useAllThemeColors = (): ThemeColors => ({
  background: useThemeColor({}, 'background'),
  text: useThemeColor({}, 'text'),
  success: useThemeColor({}, 'success'),
  error: useThemeColor({}, 'error'),
  primary: useThemeColor({}, 'primary'),
  buttonText: useThemeColor({}, 'buttonText'),
  cardBackground: useThemeColor({}, 'cardBackground'),
  shadow: useThemeColor({}, 'shadow'),
  icon: useThemeColor({}, 'icon'),
});

/* -- Static Styles for PairItem -- */
const pairItemStyles = StyleSheet.create({
  container: {
    marginBottom: 24,
    borderRadius: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.125)', // corresponds to "#ffffff20"
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

/* -- Memoized PairItem Component -- */
const PairItem: React.FC<{
  item: FlattenedPair;
  stats: PairStats;
  t: (key: string) => string;
  themeColors: ThemeColors;
  styles: Styles;
}> = React.memo(({ item, stats, t, themeColors, styles }) => {
  const attempts = stats.attempts || [];
  const total = attempts.length;

  // Memoize computed values
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
        {/* Left Column: Pair Title and Accuracy Stats */}
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
        {/* Right Column: Chart and Inline Progress Bar */}
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
});

/* -- Main ResultsScreen Component -- */
export default function ResultsScreen() {
  const progress = useProgress();
  const recordAttempt = useRecordAttempt();
  const { t, categoryIndex } = useLanguageScheme();
  const themeColors = useAllThemeColors();
  const styles: Styles = createStyles(themeColors);

  const categories = useMemo(() => minimalPairs.map((cat) => cat.category), []);
  const selectedCategoryName = categories[categoryIndex];
  const catObj = useMemo(
    () => minimalPairs.find((cat) => cat.category === selectedCategoryName),
    [selectedCategoryName]
  );

  if (!catObj || catObj.pairs.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: themeColors.background }]}
      >
        <Text style={[styles.title, { color: themeColors.text }]}>
          {`No pairs found for ${selectedCategoryName}`}
        </Text>
      </View>
    );
  }

  // Memoize flattenedPairs so that they are not recalculated on every render
  const flattenedPairs: FlattenedPair[] = useMemo(() => {
    return catObj.pairs.map((pairObj) => {
      const pairID = `${pairObj.word1}-${pairObj.word2}-(${catObj.category})`;
      return {
        id: pairID,
        word1: pairObj.word1,
        word2: pairObj.word2,
        audio1: pairObj.audio1,
        audio2: pairObj.audio2,
        category: catObj.category,
      };
    });
  }, [catObj]);

  return (
    <View
      style={[
        styles.container,
        { flex: 1, backgroundColor: themeColors.background, padding: 16 },
      ]}
    >
      <Text
        style={[styles.title, { color: themeColors.text, marginBottom: 12 }]}
      >
        {t('averageByPair')}
      </Text>
      <FlatList
        data={flattenedPairs}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const stats = progress[item.id] || { attempts: [] };
          return (
            <PairItem
              item={item}
              stats={stats}
              t={t}
              themeColors={themeColors}
              styles={styles}
            />
          );
        }}
      />
    </View>
  );
}
