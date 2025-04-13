// app/(tabs)/results.tsx
import React, { useMemo } from 'react';
import { View, Text, FlatList } from 'react-native';
import { minimalPairs } from '../../constants/minimalPairs';
import { useProgress } from '../../src/context/PairProgressContext';
import { useAllThemeColors } from '../../src/context/theme';
import createStyles from '../../constants/styles';
import { useLanguageScheme } from '../../hooks/useLanguageScheme';
import { tKeys } from '../../constants/translationKeys';
import PairItem from '../../components/PairItem';

interface FlattenedPair {
  id: string;
  word1: string;
  word2: string;
  audio1: string;
  audio2: string;
  category: string;
}

export default function ResultsScreen() {
  const progress = useProgress();
  const { translate, categoryIndex } = useLanguageScheme();
  const themeColors = useAllThemeColors();
  const styles = createStyles(themeColors);

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
        {translate(tKeys.accuracyTrend)}
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
              translate={translate}
              themeColors={themeColors}
              styles={styles}
            />
          );
        }}
      />
    </View>
  );
}
