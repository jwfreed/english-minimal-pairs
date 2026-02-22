// app/(tabs)/results.tsx
import React, { useMemo, useCallback, useEffect, useState } from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { minimalPairs } from '@/app/constants/minimalPairs';
import { usePairProgress } from '@/app/context/PairProgressContext';
import { useAllThemeColors } from '@/app/context/theme';
import createStyles from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { useCategory } from '@/app/context/CategoryContext';
import { tKeys } from '@/app/constants/translationKeys';
import PairItem from '@/app/components/PairItem';
import { buildPairId } from '@/app/utils/idHelpers';
import { getCumulativeSeconds } from '@/app/components/SessionTimer';

export default function ResultsScreen() {
  const { progress } = usePairProgress();
  const { translate } = useLanguage();
  const { categoryIndex } = useCategory();
  const themeColors = useAllThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const { width } = useWindowDimensions();
  const isTablet = width > 700;

  const numColumns = isTablet ? 2 : 1;
  const gap = 16;

  // Load cumulative practice time
  const [cumulativeMin, setCumulativeMin] = useState(0);
  useEffect(() => {
    getCumulativeSeconds().then((sec) => setCumulativeMin(sec / 60));
  }, [progress]); // re-read whenever progress changes (proxy for "user practiced")

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
    const pairs = catObj.pairs.map((pairObj) => {
      const id = buildPairId(pairObj, catObj.category);
      return {
        id,
        word1: pairObj.word1,
        word2: pairObj.word2,
        category: catObj.category,
      };
    });

    return pairs.sort((a, b) => {
      const statsA = progress[a.id];
      const statsB = progress[b.id];
      const hasAttemptsA = statsA?.attempts?.length > 0;
      const hasAttemptsB = statsB?.attempts?.length > 0;

      if (hasAttemptsA && !hasAttemptsB) return -1;
      if (!hasAttemptsA && hasAttemptsB) return 1;
      return 0;
    });
  }, [catObj, progress]);

  const renderItem = useCallback(
    ({ item, index }: { item: any; index: number }) => {
      const stats = progress[item.id] || { attempts: [] };
      
      // Add spacing for grid layout
      const isLeftColumn = index % numColumns === 0;
      const itemStyle = numColumns > 1 ? {
        flex: 1,
        marginRight: isLeftColumn ? gap / 2 : 0,
        marginLeft: !isLeftColumn ? gap / 2 : 0,
      } : {};

      return (
        <View style={itemStyle}>
          <PairItem
            item={item}
            stats={stats}
            translate={translate}
            themeColors={themeColors}
            styles={styles}
          />
        </View>
      );
    },
    [progress, translate, themeColors, styles, numColumns]
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={{ width: '100%', maxWidth: isTablet ? 800 : 600, alignSelf: 'center', flex: 1 }}>
        <Text style={[styles.headerTitle, { marginTop: 16, marginBottom: 8 }]}>
          {translate(tKeys.accuracyTrend)}
        </Text>
        <Text style={[styles.timePracticedText, { textAlign: 'center', marginBottom: 12, paddingHorizontal: 16 }]}>
          {`${translate(tKeys.timePracticed)}: ${cumulativeMin < 60
            ? `${cumulativeMin.toFixed(1)} ${translate(tKeys.min)}`
            : `${(cumulativeMin / 60).toFixed(1)} hr`}`}
        </Text>
        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <FlashList
            data={flattenedPairs}
            extraData={[progress, numColumns]}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={numColumns}
            key={numColumns.toString()} // Force re-render when columns change
            estimatedItemSize={200}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </View>
    </View>
  );
}
