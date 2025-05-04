// app/(tabs)/results.tsx
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { minimalPairs } from '../../constants/minimalPairs';
import { useProgress } from '../../src/context/PairProgressContext';
import { useAllThemeColors } from '../../src/context/theme';
import createStyles from '../../constants/styles';
import { useLanguage } from '../../src/context/LanguageContext';
import { useCategory } from '../../src/context/CategoryContext';
import { tKeys } from '../../constants/translationKeys';
import PairItem from '../../components/PairItem';
import { buildPairId } from '@/src/utils/idHelpers';

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
  const { translate } = useLanguage();
  const { categoryIndex } = useCategory();
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

  const flattenedPairs = useMemo(() => {
    return catObj.pairs.map((pairObj) => {
      const id = buildPairId(pairObj, catObj.category);
      return {
        id,
        word1: pairObj.word1,
        word2: pairObj.word2,
        audio1: pairObj.audio1,
        audio2: pairObj.audio2,
        category: catObj.category,
      };
    });
  }, [catObj]);

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <Text style={[styles.title, { color: themeColors.text, margin: 16 }]}>
        {translate(tKeys.accuracyTrend)}
      </Text>
      <FlashList
        contentContainerStyle={{ padding: 16 }}
        data={flattenedPairs}
        extraData={progress} // ← add this
        keyExtractor={(item) => item.id}
        estimatedItemSize={220}
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
