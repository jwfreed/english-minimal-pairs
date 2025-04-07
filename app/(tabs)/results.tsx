import React from 'react';
import { View, Text, FlatList } from 'react-native';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';
import { useThemeColor } from '@/hooks/useThemeColor';
import createStyles from '../../constants/styles';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';

/**
 * FlattenedPair
 * Simple interface to identify a minimal pair
 */
interface FlattenedPair {
  id: string;
  word1: string;
  word2: string;
}

/**
 * ResultsScreen
 *
 * Displays the user’s progress (correct/attempts) by pair,
 * broken down per category.
 */
export default function ResultsScreen() {
  const { progress } = usePairProgress();
  const { t, categoryIndex } = useLanguageScheme();

  // Theming
  const themeColors = {
    background: useThemeColor({}, 'background')(),
    text: useThemeColor({}, 'text')(),
    success: useThemeColor({}, 'success')(),
    error: useThemeColor({}, 'error')(),
    primary: useThemeColor({}, 'primary')(),
    buttonText: useThemeColor({}, 'buttonText')(),
  };
  const styles = createStyles(themeColors);

  // Get category name from minimalPairs
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

  /**
   * Flatten the category’s pairs into a simpler array
   * each with a unique ID used to look up stats in progress.
   */
  const flattenedPairs: FlattenedPair[] = catObj.pairs.map((pairObj) => {
    const pairID = `${pairObj.word1}-${pairObj.word2}-(${catObj.category})`;
    return {
      id: pairID,
      word1: pairObj.word1,
      word2: pairObj.word2,
    };
  });

  /**
   * Render each pair’s stats in a row
   */
  const renderPair = ({ item }: { item: FlattenedPair }) => {
    const stats = progress[item.id] || { attempts: 0, correct: 0 };
    const { attempts, correct } = stats;
    const avg = attempts > 0 ? (correct / attempts) * 100 : 0;

    return (
      <View
        style={
          styles.buttonRow /* repurposing buttonRow or create a new row style */
        }
      >
        <Text style={[styles.title, { color: themeColors.text }]}>
          {`${item.word1} - ${item.word2}`}
        </Text>
        <Text style={{ color: themeColors.text }}>
          {`${correct}/${attempts} (${avg.toFixed(1)}%)`}
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
        // If you want a bit of spacing, you can add contentContainerStyle or ItemSeparatorComponent
      />
    </View>
  );
}
