import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { useThemeColor } from '@/hooks/useThemeColor';
import { minimalPairs } from '../../constants/minimalPairs';
import { usePairProgress } from '../../src/context/PairProgressContext';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';

interface FlattenedPair {
  id: string;
  word1: string;
  word2: string;
}

export default function ResultsScreen() {
  const { progress } = usePairProgress();
  const { t, categoryIndex } = useLanguageScheme();

  // Fetch theme-based colors inside the component
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const shadowColor = useThemeColor({}, 'shadow');
  const successColor = useThemeColor({}, 'success');

  // Dynamically create styles with the colors
  const styles = createStyles({
    backgroundColor,
    textColor,
    cardBackground,
    shadowColor,
    successColor,
  });

  const categories = minimalPairs.map((catObj) => catObj.category);
  const selectedCategoryName = categories[categoryIndex];
  const catObj = minimalPairs.find(
    (cat) => cat.category === selectedCategoryName
  );

  if (!catObj || catObj.pairs.length === 0) {
    return (
      <View style={styles.container}>
        <Text
          style={styles.header}
        >{`No pairs found for ${selectedCategoryName}`}</Text>
      </View>
    );
  }

  const flattenedPairs: FlattenedPair[] = catObj.pairs.map((pairObj) => {
    const pairID = `${pairObj.word1}-${pairObj.word2}-(${catObj.category})`;
    return { id: pairID, word1: pairObj.word1, word2: pairObj.word2 };
  });

  const renderPair = ({ item }: { item: FlattenedPair }) => {
    const stats = progress[item.id] || { attempts: 0, correct: 0 };
    const { attempts, correct } = stats;
    const avg = attempts > 0 ? (correct / attempts) * 100 : 0;

    return (
      <View style={styles.row}>
        <Text style={styles.pairTitle}>{`${item.word1} - ${item.word2}`}</Text>
        <Text style={styles.stats}>{`${correct}/${attempts} (${avg.toFixed(
          1
        )}%)`}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.header}>{t('averageByPair')}</Text>
      <FlatList
        data={flattenedPairs}
        keyExtractor={(item) => item.id}
        renderItem={renderPair}
      />
    </View>
  );
}

// Function to generate styles dynamically
const createStyles = (themeColors: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      paddingTop: 40,
      backgroundColor: themeColors.backgroundColor,
    },
    header: {
      fontSize: 22,
      marginBottom: 8,
      textAlign: 'center',
      color: themeColors.textColor,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 8,
      width: '80%',
      padding: 10,
      backgroundColor: themeColors.cardBackground,
      borderRadius: 5,
      shadowColor: themeColors.shadowColor,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    pairTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: themeColors.textColor,
    },
    stats: {
      fontSize: 16,
      color: themeColors.successColor,
      fontWeight: 'bold',
    },
  });
