// app/(tabs)/results.tsx
import React, { useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, useWindowDimensions } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRouter } from 'expo-router';
import { minimalPairs } from '@/app/constants/minimalPairs';
import { usePairProgress } from '@/app/context/PairProgressContext';
import { useAllThemeColors } from '@/app/context/theme';
import createStyles from '@/app/constants/styles';
import { useLanguage } from '@/app/context/LanguageContext';
import { useCategory } from '@/app/context/CategoryContext';
import { tKeys } from '@/app/constants/translationKeys';
import PairItem from '@/app/components/PairItem';
import { buildPairId } from '@/utils/idHelpers';
import { estimateActivePracticeTime } from '@/app/storage/progressStorage';
import { useContrastPairs } from '@/app/hooks/useContrastPairs';
import { computePracticeNextRecommendation } from '@/utils/recommendNextPractice';
import { usePracticeTarget } from '@/app/context/PracticeTargetContext';

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

  // Compute total practice time from per-pair response durations (consistent
  // with the per-pair "Time Practiced" shown on each card).
  const totalPracticeMin = useMemo(() => {
    let totalMs = 0;
    for (const stats of Object.values(progress)) {
      totalMs += estimateActivePracticeTime(stats.attempts ?? []);
    }
    return totalMs / 60000;
  }, [progress]);

  const categories = useMemo(() => minimalPairs.map((cat) => cat.category), []);
  const selectedCategoryName = categories[categoryIndex];
  const catObj = useMemo(
    () => minimalPairs.find((cat) => cat.category === selectedCategoryName),
    [selectedCategoryName]
  );

  // Get mastery data for the current category
  const { mastery, refresh: refreshMastery } = useContrastPairs(catObj?.pairs ?? [], catObj?.category ?? '');

  // Compute mastery summary stats
  const masterySummary = useMemo(() => {
    if (!catObj) return { totalGroups: 0, masteredGroups: 0, totalLevels: 0, completedLevels: 0 };
    const groups = new Set<string>();
    catObj.pairs.forEach((p) => groups.add(p.group));
    const totalGroups = groups.size;
    const TOTAL_TIERS = 6;
    let masteredGroups = 0;
    let completedLevels = 0;
    for (const g of groups) {
      const tier = mastery[g] ?? 1;
      // Tiers start at 1; completed levels = tier - 1 (levels already passed)
      completedLevels += Math.min(tier - 1, TOTAL_TIERS);
      if (tier >= TOTAL_TIERS) masteredGroups++;
    }
    return {
      totalGroups,
      masteredGroups,
      totalLevels: totalGroups * TOTAL_TIERS,
      completedLevels,
    };
  }, [catObj, mastery]);

  // Refresh mastery from AsyncStorage whenever this tab gains focus,
  // so it stays in sync with promotions made on the practice screen.
  const navigation = useNavigation();
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refreshMastery();
    });
    return unsubscribe;
  }, [navigation, refreshMastery]);

  const recommendation = useMemo(
    () => computePracticeNextRecommendation(progress, catObj?.pairs ?? [], selectedCategoryName ?? ''),
    [progress, catObj, selectedCategoryName]
  );

  const { requestPractice } = usePracticeTarget();
  const router = useRouter();
  const handlePracticeNextPress = useCallback(() => {
    if (!recommendation) return;
    requestPractice(recommendation.groupId);
    router.navigate('/');
  }, [recommendation, requestPractice, router]);

  const reasonText = recommendation
    ? recommendation.reason === 'newPair'
      ? "You haven't practiced this contrast yet."
      : 'Your recent accuracy is lower for this contrast.'
    : 'Practice a few contrasts to get a recommendation.';

  const flattenedPairs = useMemo(() => {
    if (!catObj || catObj.pairs.length === 0) return [];
    const pairs = catObj.pairs.map((pairObj) => {
      const id = buildPairId(pairObj, catObj.category);
      return {
        id,
        word1: pairObj.word1,
        word2: pairObj.word2,
        category: catObj.category,
        group: pairObj.group,
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
            tier={mastery[item.group] ?? 1}
            translate={translate}
            themeColors={themeColors}
            styles={styles}
          />
        </View>
      );
    },
    [progress, mastery, translate, themeColors, styles, numColumns]
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

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={{ width: '100%', maxWidth: isTablet ? 800 : 600, alignSelf: 'center', flex: 1 }}>
        <Text style={[styles.headerTitle, { marginTop: 16, marginBottom: 8 }]}>
          {translate(tKeys.accuracyTrend)}
        </Text>
        <Text style={[styles.timePracticedText, { textAlign: 'center', marginBottom: 12, paddingHorizontal: 16 }]}>
          {`${translate(tKeys.timePracticed)}: ${totalPracticeMin < 60
            ? `${totalPracticeMin.toFixed(1)} ${translate(tKeys.min)}`
            : `${(totalPracticeMin / 60).toFixed(1)} ${translate(tKeys.hr) || 'hr'}`}`}
        </Text>

        {/* Mastery Summary Card */}
        <View style={[styles.masterySummaryCard, { marginHorizontal: 16 }]}>    
          <View style={styles.masterySummaryItem}>
            <Text style={styles.masterySummaryValue}>
              {masterySummary.masteredGroups} / {masterySummary.totalGroups}
            </Text>
            <Text style={styles.masterySummaryLabel}>
              Contrasts Mastered
            </Text>
          </View>
          <View style={styles.masterySummaryItem}>
            <Text style={styles.masterySummaryValue}>
              {masterySummary.completedLevels} / {masterySummary.totalLevels}
            </Text>
            <Text style={styles.masterySummaryLabel}>
              Contrast Levels Completed
            </Text>
          </View>
        </View>

        {/* Practice This Next Card — tappable when a recommendation exists */}
        <Pressable
          onPress={recommendation ? handlePracticeNextPress : undefined}
          disabled={!recommendation}
          accessible={true}
          accessibilityRole={recommendation ? 'button' : undefined}
          accessibilityLabel={
            recommendation
              ? `${translate(tKeys.practiceThisNext)}: ${recommendation.label}. ${reasonText}`
              : translate(tKeys.practiceThisNextEmpty)
          }
          style={({ pressed }) => [
            styles.masterySummaryCard,
            { marginHorizontal: 16, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' },
            pressed && recommendation ? { opacity: 0.7 } : null,
          ]}
        >
          <Text style={styles.masterySummaryLabel}>
            {translate(tKeys.practiceThisNext)}
          </Text>
          {recommendation ? (
            <>
              <Text style={[styles.masterySummaryValue, { marginTop: 4 }]}>
                {recommendation.label}
              </Text>
              <Text style={[styles.masterySummaryLabel, { marginTop: 4 }]}>
                {reasonText}
              </Text>
            </>
          ) : (
            <Text style={[styles.masterySummaryLabel, { marginTop: 4 }]}>
              {reasonText}
            </Text>
          )}
        </Pressable>

        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <FlashList
            data={flattenedPairs}
            extraData={[progress, numColumns]}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            numColumns={numColumns}
            key={numColumns.toString()} // Force re-render when columns change
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>
      </View>
    </View>
  );
}
