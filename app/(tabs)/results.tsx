// app/(tabs)/results.tsx
import React, { useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { FlashList } from '@shopify/flash-list';
import { useNavigation, useRouter } from 'expo-router';
import { minimalPairs } from '@/src/constants/minimalPairs';
import { usePairProgress } from '@/src/context/PairProgressContext';
import { useAllThemeColors } from '@/src/context/theme';
import createStyles, { getCardShadowStyles, type ThemeColors } from '@/src/constants/styles';
import { FontFamily } from '@/src/constants/typography';
import { useLanguage } from '@/src/context/LanguageContext';
import { useCategory } from '@/src/context/CategoryContext';
import { tKeys } from '@/src/constants/translationKeys';
import PairItem from '@/src/components/PairItem';
import LevelIndicator from '@/src/components/LevelIndicator';
import { buildPairId } from '@/utils/idHelpers';
import { estimateActivePracticeTime } from '@/src/storage/progressStorage';
import { useContrastPairs } from '@/src/hooks/useContrastPairs';
import { computePracticeNextRecommendation } from '@/utils/recommendNextPractice';
import { usePracticeTarget } from '@/src/context/PracticeTargetContext';

type ContrastHeader = {
  type: 'header';
  group: string;
  phoneme1: string;
  phoneme2: string;
};
type PairRow = {
  type: 'pair';
  id: string;
  word1: string;
  word2: string;
  category: string;
  group: string;
  colIndex: number;
};
type ListItem = ContrastHeader | PairRow;

export default function ResultsScreen() {
  const { progress } = usePairProgress();
  const { translate } = useLanguage();
  const { categoryIndex } = useCategory();
  const themeColors = useAllThemeColors();
  const styles = useMemo(() => createStyles(themeColors), [themeColors]);
  const resultsStyles = useMemo(() => createResultsStyles(themeColors), [themeColors]);
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
      ? translate(tKeys.practiceThisNextReasonNew)
      : translate(tKeys.practiceThisNextReason)
    : translate(tKeys.practiceThisNextEmpty);

  const listData = useMemo((): ListItem[] => {
    if (!catObj || catObj.pairs.length === 0) return [];

    const groupOrder: string[] = [];
    const groupedPairs: Record<string, typeof catObj.pairs> = {};

    for (const pairObj of catObj.pairs) {
      if (!groupedPairs[pairObj.group]) {
        groupOrder.push(pairObj.group);
        groupedPairs[pairObj.group] = [];
      }
      groupedPairs[pairObj.group].push(pairObj);
    }

    const items: ListItem[] = [];
    for (const group of groupOrder) {
      const sorted = [...groupedPairs[group]].sort((a, b) => a.difficulty - b.difficulty);
      const rep = sorted[0];
      items.push({ type: 'header', group, phoneme1: rep.contrastPhoneme1, phoneme2: rep.contrastPhoneme2 });
      sorted.forEach((pairObj, i) => {
        items.push({
          type: 'pair',
          id: buildPairId(pairObj, catObj.category),
          word1: pairObj.word1,
          word2: pairObj.word2,
          category: catObj.category,
          group,
          colIndex: i % numColumns,
        });
      });
    }
    return items;
  }, [catObj, numColumns]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.type === 'header') {
        return (
          <View style={resultsStyles.pairSectionHeader}>
            <View>
              <Text style={resultsStyles.pairSectionTitle}>
                {`/${item.phoneme1}/ – /${item.phoneme2}/`}
              </Text>
            </View>
            <LevelIndicator currentTier={mastery[item.group] ?? 1} compact />
          </View>
        );
      }

      const stats = progress[item.id] || { attempts: [] };
      const itemStyle: object = numColumns > 1
        ? { flex: 1, marginRight: item.colIndex === 0 ? gap / 2 : 0, marginLeft: item.colIndex !== 0 ? gap / 2 : 0 }
        : {};

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
    [progress, mastery, translate, themeColors, styles, resultsStyles, numColumns, gap],
  );

  if (!catObj || catObj.pairs.length === 0) {
    return (
      <View
        style={[styles.container, { backgroundColor: themeColors.background }]}
      >
        <Text style={[styles.title, { color: themeColors.text }]}>
          {`${translate(tKeys.noPairsFound)} ${selectedCategoryName}`}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.background }}>
      <View style={{ width: '100%', maxWidth: isTablet ? 800 : 600, alignSelf: 'center', flex: 1 }}>
        <View style={resultsStyles.header}>
          <Text style={resultsStyles.screenTitle}>{translate(tKeys.results)}</Text>
          <Text style={resultsStyles.practicedLabel}>
            Practiced{' '}
            <Text style={resultsStyles.practicedValue}>
              {totalPracticeMin.toFixed(1)} {translate(tKeys.min)}
            </Text>
          </Text>
        </View>

        <View style={resultsStyles.statsRow}>
          <View style={resultsStyles.statCard}>
            <Text style={resultsStyles.statValue}>
              {masterySummary.masteredGroups}
              <Text style={resultsStyles.statDenominator}> / {masterySummary.totalGroups}</Text>
            </Text>
            <Text style={resultsStyles.statLabel}>
              {translate(tKeys.pairsMastered)}
            </Text>
          </View>
          <View style={resultsStyles.statCard}>
            <Text style={resultsStyles.statValue}>
              {masterySummary.completedLevels}
              <Text style={resultsStyles.statDenominator}> / {masterySummary.totalLevels}</Text>
            </Text>
            <Text style={resultsStyles.statLabel}>
              {translate(tKeys.levelsCompleted)}
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
            resultsStyles.nextCard,
            pressed && recommendation ? { opacity: 0.7 } : null,
          ]}
        >
          <View style={resultsStyles.nextContent}>
            <Text style={resultsStyles.nextBadge}>{translate(tKeys.practiceThisNext)}</Text>
            {recommendation ? (
              <>
                <Text style={resultsStyles.nextTitle}>{recommendation.label}</Text>
                <Text style={resultsStyles.nextReason}>{reasonText}</Text>
              </>
            ) : (
              <Text style={resultsStyles.nextReason}>{reasonText}</Text>
            )}
          </View>
          {recommendation && (
            <View style={resultsStyles.nextArrow}>
              <Ionicons name="arrow-forward" size={17} color={themeColors.primaryText} />
            </View>
          )}
        </Pressable>

        <View style={{ flex: 1, paddingHorizontal: 16 }}>
          <FlashList
            data={listData}
            extraData={[progress, mastery, numColumns]}
            keyExtractor={(item) => item.type === 'header' ? `header-${item.group}` : item.id}
            renderItem={renderItem}
            numColumns={numColumns}
            key={numColumns.toString()} // Force re-render when columns change
            contentContainerStyle={{ paddingBottom: 20 }}
            overrideItemLayout={(layout, item) => { if (item.type === 'header') { layout.span = numColumns; } }}
          />
        </View>
      </View>
    </View>
  );
}

const createResultsStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 16,
      marginBottom: 16,
      paddingHorizontal: 16,
    },
    screenTitle: {
      fontFamily: FontFamily.extraBold,
      fontSize: 22,
      fontWeight: '800',
      letterSpacing: -0.4,
      color: colors.text,
    },
    practicedLabel: {
      fontFamily: FontFamily.semibold,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
      fontVariant: ['tabular-nums'],
    },
    practicedValue: {
      color: colors.primaryText,
    },
    statsRow: {
      flexDirection: 'row',
      gap: 12,
      marginBottom: 12,
      paddingHorizontal: 16,
    },
    statCard: {
      flex: 1,
      minHeight: 94,
      justifyContent: 'center',
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      ...getCardShadowStyles(colors),
    },
    statValue: {
      fontFamily: FontFamily.extraBold,
      fontSize: 26,
      fontWeight: '800',
      color: colors.primaryText,
      fontVariant: ['tabular-nums'],
    },
    statDenominator: {
      fontFamily: FontFamily.bold,
      fontSize: 15,
      fontWeight: '700',
      color: colors.textSecondary,
    },
    statLabel: {
      marginTop: 4,
      fontFamily: FontFamily.semibold,
      fontSize: 12,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    nextCard: {
      minHeight: 104,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginHorizontal: 16,
      marginBottom: 14,
      padding: 16,
      borderRadius: 18,
      backgroundColor: colors.surface,
      ...getCardShadowStyles(colors),
    },
    nextContent: {
      flex: 1,
      alignItems: 'flex-start',
    },
    nextBadge: {
      marginBottom: 7,
      paddingVertical: 4,
      paddingHorizontal: 8,
      borderRadius: 999,
      overflow: 'hidden',
      backgroundColor: colors.surfaceTint,
      fontFamily: FontFamily.bold,
      fontSize: 10,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
      color: colors.primaryText,
    },
    nextTitle: {
      fontFamily: FontFamily.extraBold,
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    nextReason: {
      marginTop: 3,
      fontFamily: FontFamily.regular,
      fontSize: 12,
      color: colors.textSecondary,
    },
    nextArrow: {
      width: 32,
      height: 32,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surfaceTint,
    },
    pairSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    pairSectionTitle: {
      fontFamily: FontFamily.bold,
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
  });
