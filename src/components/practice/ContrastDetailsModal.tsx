import React, { useMemo } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import LevelIndicator from '@/src/components/LevelIndicator';
import type { Pair } from '@/src/constants/minimalPairs';
import { tKeys } from '@/src/constants/translationKeys';
import { useAllThemeColors } from '@/src/context/theme';
import { useLanguage } from '@/src/context/LanguageContext';
import { buildTrialPairId } from '@/src/domain/practiceSession';
import { buildContrastLabel } from '@/utils/contrastLabel';
import { formatTranslation } from '@/utils/formatTranslation';

interface ContrastDetailsModalProps {
  visible: boolean;
  representativePair: Pair | undefined;
  pairs: Pair[];
  availablePairs: Pair[];
  masteryLevel: number;
  onSelectPair: (pair: Pair) => void;
  onClose: () => void;
}

export default function ContrastDetailsModal({
  visible,
  representativePair,
  pairs,
  availablePairs,
  masteryLevel,
  onSelectPair,
  onClose,
}: ContrastDetailsModalProps) {
  const theme = useAllThemeColors();
  const { translate } = useLanguage();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const availablePairIds = useMemo(
    () => new Set(availablePairs.map(buildTrialPairId)),
    [availablePairs]
  );
  const sortedPairs = useMemo(
    () =>
      [...pairs].sort(
        (a, b) =>
          Number(availablePairIds.has(buildTrialPairId(b))) -
            Number(availablePairIds.has(buildTrialPairId(a))) ||
          a.difficulty - b.difficulty
      ),
    [availablePairIds, pairs]
  );
  const contrastLabel = buildContrastLabel(representativePair);

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      presentationStyle="overFullScreen"
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.root}>
        <Pressable
          accessibilityLabel={translate(tKeys.closeContrastDetails)}
          accessibilityRole="button"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />

        <View
          accessibilityViewIsModal
          onAccessibilityEscape={onClose}
          style={styles.sheet}
        >
          <View style={styles.handle} />
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.eyebrow}>{translate(tKeys.contrastDetails)}</Text>
              <Text accessibilityRole="header" style={styles.title}>
                {contrastLabel}
              </Text>
            </View>
            <TouchableOpacity
              accessibilityLabel={translate(tKeys.closeContrastDetails)}
              accessibilityRole="button"
              hitSlop={8}
              onPress={onClose}
              style={styles.closeButton}
            >
              <Ionicons name="close" color={theme.text} size={22} />
            </TouchableOpacity>
          </View>

          <LevelIndicator currentTier={masteryLevel} />

          <Text style={styles.sectionTitle}>{translate(tKeys.practiceExamples)}</Text>
          <ScrollView
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
          >
            {sortedPairs.map((pair) => {
              const pairId = buildTrialPairId(pair);
              const isAvailable = availablePairIds.has(pairId);
              const row = (
                <>
                  <View
                    style={[
                      styles.availabilityDot,
                      isAvailable && styles.availabilityDotActive,
                    ]}
                  />
                  <View style={styles.pairCopy}>
                    <Text
                      style={[
                        styles.pairWords,
                        !isAvailable && styles.unavailableText,
                      ]}
                    >
                      {pair.word1} ↔ {pair.word2}
                    </Text>
                    <Text style={styles.pairIpa}>
                      {pair.ipa1} · {pair.ipa2}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.status,
                      isAvailable ? styles.availableStatus : styles.levelStatus,
                    ]}
                  >
                    {isAvailable
                      ? translate(tKeys.availableNow)
                      : formatTranslation(translate(tKeys.levelAt), {
                          level: pair.difficulty,
                        })}
                  </Text>
                </>
              );

              return isAvailable ? (
                <TouchableOpacity
                  accessibilityHint={translate(tKeys.doubleTapToSelectWord)}
                  accessibilityLabel={`${pair.word1}, ${pair.word2}. ${translate(tKeys.availableNow)}`}
                  accessibilityRole="button"
                  key={pairId}
                  onPress={() => onSelectPair(pair)}
                  style={styles.pairRow}
                >
                  {row}
                </TouchableOpacity>
              ) : (
                <View
                  accessibilityLabel={`${pair.word1}, ${pair.word2}. ${formatTranslation(
                    translate(tKeys.levelAt),
                    { level: pair.difficulty }
                  )}`}
                  key={pairId}
                  style={styles.pairRow}
                >
                  {row}
                </View>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (theme: ReturnType<typeof useAllThemeColors>) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      justifyContent: 'flex-end',
    },
    sheet: {
      width: '100%',
      maxHeight: '82%',
      paddingTop: 10,
      paddingHorizontal: 20,
      paddingBottom: 28,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: theme.border,
      backgroundColor: theme.cardBackground,
    },
    handle: {
      width: 40,
      height: 4,
      alignSelf: 'center',
      marginBottom: 14,
      borderRadius: 2,
      backgroundColor: theme.border,
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 12,
    },
    titleCopy: {
      flex: 1,
    },
    eyebrow: {
      color: theme.textSecondary,
      fontSize: 12,
      fontWeight: '700',
      letterSpacing: 0.8,
      textTransform: 'uppercase',
    },
    title: {
      color: theme.text,
      fontSize: 26,
      fontWeight: '800',
      marginTop: 2,
    },
    closeButton: {
      width: 44,
      height: 44,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 22,
      borderWidth: 1,
      borderColor: theme.border,
    },
    sectionTitle: {
      color: theme.text,
      fontSize: 17,
      fontWeight: '800',
      marginTop: 22,
      marginBottom: 8,
    },
    list: {
      gap: 8,
      paddingBottom: 8,
    },
    pairRow: {
      minHeight: 64,
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      backgroundColor: theme.background,
    },
    availabilityDot: {
      width: 9,
      height: 9,
      marginRight: 11,
      borderRadius: 5,
      borderWidth: 1,
      borderColor: theme.textSecondary,
    },
    availabilityDotActive: {
      borderColor: theme.primary,
      backgroundColor: theme.primary,
    },
    pairCopy: {
      flex: 1,
    },
    pairWords: {
      color: theme.text,
      fontSize: 16,
      fontWeight: '700',
    },
    pairIpa: {
      color: theme.textSecondary,
      fontSize: 13,
      marginTop: 2,
    },
    unavailableText: {
      color: theme.textSecondary,
    },
    status: {
      maxWidth: 96,
      marginLeft: 8,
      fontSize: 11,
      fontWeight: '700',
      textAlign: 'right',
    },
    availableStatus: {
      color: theme.primary,
    },
    levelStatus: {
      color: theme.textSecondary,
    },
  });
