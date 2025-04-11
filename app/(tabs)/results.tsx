import React from 'react';
import { View, Text, FlatList } from 'react-native';
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

/* 
  Updated type interface for attempts to match what's expected in progressStorage.
  Now called PairAttempt and includes the required timestamp property.
*/
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

/* -- PairItem Component Props -- */
interface PairItemProps {
  item: FlattenedPair;
  stats: PairStats;
  t: (key: string) => string;
  themeColors: ThemeColors;
  styles: Styles;
}

/* -- Memoized PairItem Component -- */
const PairItem: React.FC<PairItemProps> = React.memo(
  ({ item, stats, t, themeColors, styles }) => {
    const attempts = stats.attempts || [];
    const total = attempts.length;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const rawAvg = total > 0 ? (correct / total) * 100 : 0;
    const weightedAvg = getWeightedAccuracy(attempts) * 100;
    const trendData = getAccuracyAndTimeOverTime(attempts);
    const timePracticed =
      total > 0 ? Math.round(estimateActivePracticeTime(attempts) / 60000) : 0;

    return (
      <View
        style={{
          marginBottom: 24,
          backgroundColor: '#ffffff20',
          borderRadius: 12,
          padding: 12,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
          }}
        >
          {/* Left Column: Pair Title and Accuracy Stats */}
          <View
            style={{
              flexGrow: 1,
              flexShrink: 1,
              minWidth: 140,
              paddingRight: 8,
            }}
          >
            <Text style={[styles.title, { color: themeColors.text }]}>
              {`${item.word1} - ${item.word2}`}
            </Text>
            <Text style={{ color: themeColors.text }}>
              {`${t('total')}: ${correct}/${total} (${rawAvg.toFixed(
                1
              )}%) — ${t('weightedAverage')}: ${weightedAvg.toFixed(1)}%`}
            </Text>
          </View>
          {/* Right Column: Chart and Inline Progress Bar */}
          {trendData.length > 0 && (
            <View style={{ flexGrow: 1, minWidth: 180, maxWidth: '100%' }}>
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
                <View
                  style={{
                    height: 12,
                    width: '100%',
                    backgroundColor: '#e5e7eb',
                    borderRadius: 6,
                    overflow: 'hidden',
                  }}
                >
                  <View
                    style={{
                      height: '100%',
                      width: `${Math.min(timePracticed / 60, 1) * 100}%`,
                      backgroundColor: '#3b82f6',
                    }}
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

/* -- Main ResultsScreen Component -- */
export default function ResultsScreen() {
  const progress = useProgress();
  const recordAttempt = useRecordAttempt();

  const { t, categoryIndex } = useLanguageScheme();

  const themeColors: ThemeColors = {
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

  const styles: Styles = createStyles(themeColors);

  const categories = minimalPairs.map((cat) => cat.category);
  const selectedCategoryName = categories[categoryIndex];
  const catObj = minimalPairs.find(
    (cat) => cat.category === selectedCategoryName
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

  // Map pairs to our flattened format including audio and category details
  const flattenedPairs: FlattenedPair[] = catObj.pairs.map((pairObj) => {
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
