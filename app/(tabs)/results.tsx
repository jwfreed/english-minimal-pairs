import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import createStyles from '../../constants/styles';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
import { getWeightedAccuracy } from '../../src/storage/progressStorage';

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

    return (
      <View style={styles.buttonRow}>
        <Text style={[styles.title, { color: themeColors.text }]}>
          {`${item.word1} - ${item.word2}`}
        </Text>
        <Text style={{ color: themeColors.text }}>
          {`${correct}/${total} (${rawAvg.toFixed(
            1
          )}%) — Weighted: ${weightedAvg.toFixed(1)}%`}
        </Text>
      </View>
    );
  };

  return (
    <View
      style={[styles.container, { backgroundColor: themeColors.background }]}
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
