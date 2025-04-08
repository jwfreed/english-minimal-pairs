import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import createStyles from '../../constants/styles';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
import {
  getWeightedAccuracy,
  getAccuracyAndTimeOverTime,
} from '../../src/storage/progressStorage';
import AccuracyTimeChart from '../../components/AccuracyTimeChart';
import TimePracticedBar from '../../components/TimePracticedBar';

interface FlattenedPair {
  id: string;
  word1: string;
  word2: string;
}

export default function ResultsScreen() {
  const { progress } = usePairProgress();
  const { t, categoryIndex } = useLanguageScheme();

  const themeColors = {
    background: useThemeColor({}, 'background')(),
    text: useThemeColor({}, 'text')(),
    success: useThemeColor({}, 'success')(),
    error: useThemeColor({}, 'error')(),
    primary: useThemeColor({}, 'primary')(),
    buttonText: useThemeColor({}, 'buttonText')(),
  };
  const styles = createStyles(themeColors);

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

  const flattenedPairs: FlattenedPair[] = catObj.pairs.map((pairObj) => {
    const pairID = `${pairObj.word1}-${pairObj.word2}-(${catObj.category})`;
    return {
      id: pairID,
      word1: pairObj.word1,
      word2: pairObj.word2,
    };
  });

  const renderPair = ({ item }: { item: FlattenedPair }) => {
    const stats = progress[item.id] || { attempts: [] };
    const attempts = stats.attempts || [];
    const total = attempts.length;
    const correct = attempts.filter((a) => a.isCorrect).length;
    const rawAvg = total > 0 ? (correct / total) * 100 : 0;
    const weightedAvg = getWeightedAccuracy(attempts) * 100;
    const trendData = getAccuracyAndTimeOverTime(attempts);
    const timePracticed =
      trendData.length > 0
        ? Math.max(...trendData.map((d) => d.cumulativeTimeMin))
        : 0;

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
          {/* Left Column: Pair + Accuracy Text */}
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

          {/* Right Column: Chart + Bar */}
          {trendData.length > 0 && (
            <View style={{ flexGrow: 1, minWidth: 180, maxWidth: '100%' }}>
              <AccuracyTimeChart data={trendData} />
              <TimePracticedBar minutes={timePracticed} />
            </View>
          )}
        </View>
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        { flex: 1, backgroundColor: themeColors.background },
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
        renderItem={renderPair}
      />
    </View>
  );
}
