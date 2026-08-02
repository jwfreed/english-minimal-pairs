// components/LevelIndicator.tsx
// -----------------------------------------------------------------------------
// Visual indicator showing the current mastery tier (1–6) as a row of dots
// with a text label. Used on both the practice and results screens.
// Optionally shows leveling criteria text (practice screen only).
// -----------------------------------------------------------------------------
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Reanimated, { useReducedMotion } from 'react-native-reanimated';
import createStyles from '@/src/constants/styles';
import { levelPopAnimation } from '@/src/constants/motion';
import { useAllThemeColors } from '@/src/context/theme';
import { useLanguage } from '@/src/context/LanguageContext';
import { tKeys } from '@/src/constants/translationKeys';
import { formatTranslation } from '@/utils/formatTranslation';

const TOTAL_TIERS = 6;

interface Props {
  /** Current mastery tier (1–6) */
  currentTier: number;
  /** Compact mode for results list items */
  compact?: boolean;
  /** Show leveling-criteria hint below the dots (practice screen only) */
  showCriteria?: boolean;
  /**
   * Pop the current filled segment while correct-answer feedback is showing.
   * Does not change the durable mastery state represented by the indicator.
   */
  highlightCurrentTier?: boolean;
}

export default function LevelIndicator({
  currentTier,
  compact = false,
  showCriteria = false,
  highlightCurrentTier = false,
}: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { translate } = useLanguage();
  const reduceMotion = useReducedMotion();

  const isMastered = currentTier >= TOTAL_TIERS;
  const levelText = isMastered
    ? translate(tKeys.mastered)
    : compact
      ? formatTranslation(translate(tKeys.levelCompact), { level: currentTier })
      : formatTranslation(translate(tKeys.levelProgress), {
          level: currentTier,
          total: TOTAL_TIERS,
        });

  return (
    <View style={styles.levelIndicatorRow}>
      <View style={styles.levelDotsRow}>
        {Array.from({ length: TOTAL_TIERS }, (_, i) => {
          const tier = i + 1;
          const isFilled = tier <= currentTier;
          const isHighlighted =
            highlightCurrentTier && tier === currentTier;
          return (
            <Reanimated.View
              key={tier}
              style={[
                styles.levelDot,
                {
                  width: compact ? 16 : 26,
                  height: compact ? 4 : 5,
                  borderRadius: 3,
                  backgroundColor: isFilled ? '#E67E22' : theme.track,
                },
                isHighlighted && !reduceMotion && levelPopAnimation,
              ]}
            />
          );
        })}
      </View>
      <Text
        accessibilityLabel={levelText}
        style={[
          compact ? styles.levelLabelCompact : styles.levelLabel,
          isMastered && { color: theme.success },
        ]}
      >
        {isMastered
          ? `✔ ${levelText}`
          : levelText}
      </Text>
      {showCriteria && !isMastered && (
        <Text style={styles.levelCriteriaText}>
          {translate(tKeys.levelCriteria)}
        </Text>
      )}
    </View>
  );
}
