// components/LevelIndicator.tsx
// -----------------------------------------------------------------------------
// Visual indicator showing a contrast's mastery level as a row of six tier
// dots with a text label. Used on both the practice and results screens.
// On the practice screen a slim bar under the dots shows progress toward the
// next level; it can also show leveling criteria text.
// -----------------------------------------------------------------------------
import React, { useMemo } from 'react';
import { View, Text } from 'react-native';
import Reanimated, { useReducedMotion } from 'react-native-reanimated';
import createStyles from '@/src/constants/styles';
import { barFillTransition, levelPopAnimation } from '@/src/constants/motion';
import { useAllThemeColors } from '@/src/context/theme';
import { useLanguage } from '@/src/context/LanguageContext';
import { tKeys } from '@/src/constants/translationKeys';
import { formatTranslation } from '@/utils/formatTranslation';
import {
  FINAL_PRACTICE_TIER,
  isMasteredLevel,
  practiceTierOf,
} from '@/src/domain/masteryLevel';

interface Props {
  /** Mastery level (1–7); 7 means the final tier is complete. */
  masteryLevel: number;
  /** Compact mode for results list items */
  compact?: boolean;
  /** Show leveling-criteria hint below the dots (practice screen only) */
  showCriteria?: boolean;
  /**
   * Pop the current filled segment while correct-answer feedback is showing.
   * Does not change the durable mastery state represented by the indicator.
   */
  highlightCurrentTier?: boolean;
  /**
   * Fraction (0–1) of the way to the next level, from the session's promotion
   * state. Omit to hide the bar (results list, mastered contrasts).
   */
  nextLevelProgress?: number;
}

export default function LevelIndicator({
  masteryLevel,
  compact = false,
  showCriteria = false,
  highlightCurrentTier = false,
  nextLevelProgress,
}: Props) {
  const theme = useAllThemeColors();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const { translate } = useLanguage();
  const reduceMotion = useReducedMotion();

  // Reaching the final tier means practicing it; only completing it is mastery.
  const currentTier = practiceTierOf(masteryLevel);
  const isMastered = isMasteredLevel(masteryLevel);
  const levelText = isMastered
    ? translate(tKeys.mastered)
    : compact
      ? formatTranslation(translate(tKeys.levelCompact), { level: currentTier })
      : formatTranslation(translate(tKeys.levelProgress), {
          level: currentTier,
          total: FINAL_PRACTICE_TIER,
        });

  const progressPercent =
    nextLevelProgress === undefined || isMastered || compact
      ? null
      : Math.round(Math.min(Math.max(nextLevelProgress, 0), 1) * 100);

  return (
    <View style={styles.levelIndicatorRow}>
      <View>
        <View style={styles.levelDotsRow}>
          {Array.from({ length: FINAL_PRACTICE_TIER }, (_, i) => {
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
                    backgroundColor: isFilled ? theme.accent : theme.track,
                  },
                  isHighlighted && !reduceMotion && levelPopAnimation,
                ]}
              />
            );
          })}
        </View>
        {progressPercent !== null && (
          <View
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={levelText}
            accessibilityHint={translate(tKeys.levelCriteria)}
            accessibilityValue={{ min: 0, max: 100, now: progressPercent }}
            style={styles.levelProgressTrack}
          >
            <Reanimated.View
              style={[
                styles.levelProgressFill,
                { width: `${progressPercent}%` },
                !reduceMotion && barFillTransition,
              ]}
            />
          </View>
        )}
      </View>
      <Text
        accessibilityLabel={levelText}
        style={[
          compact ? styles.levelLabelCompact : styles.levelLabel,
          isMastered && { color: theme.success },
        ]}
      >
        {isMastered ? `✔ ${levelText}` : levelText}
      </Text>
      {showCriteria && !isMastered && (
        <Text style={styles.levelCriteriaText}>
          {translate(tKeys.levelCriteria)}
        </Text>
      )}
    </View>
  );
}
