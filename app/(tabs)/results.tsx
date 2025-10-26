// app/(tabs)/results.tsx
import React, { useMemo, useCallback } from 'react';
import { View, Text } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { minimalPairs } from '@/app/constants/minimalPairs';
import { useProgress } from '@/app/context/PairProgressContext';
import { useAllThemeColors } from '@/app/context/theme';
import createStyles from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { useCategory } from '@/app/context/CategoryContext';
import { tKeys } from '@/app/constants/translationKeys';
import PairItem from '@/app/components/PairItem';
import { buildPairId } from '@/app/utils/idHelpers';

export default function ResultsScreen() {
  const progress = useProgress();
  const { translate } = useLanguage();
  const { categoryIndex } = useCategory();
  const themeColors = useAllThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);

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
        category: catObj.category,
      };
    });
  }, [catObj]);

  const renderItem = useCallback(
    ({ item }: { item: any }) => {
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
    },
    [progress, translate, themeColors, styles]
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <Text style={[styles.title, { color: themeColors.text, margin: 16 }]}>
        {translate(tKeys.accuracyTrend)}
      </Text>
      <FlashList
        contentContainerStyle={{ padding: 16 }}
        data={flattenedPairs}
        extraData={progress}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}
